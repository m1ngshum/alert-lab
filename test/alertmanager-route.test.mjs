import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {openStore,validateWebhook} from '../server/store.mjs';
import {makeServer} from '../server/http.mjs';

const example=new URL('../examples/alertmanager-shadow.yml',import.meta.url);
const tools=process.env.ALERT_LAB_AM_DIR;
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
async function until(check){
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){if(await check())return;await pause();}
  throw new Error('Timed out waiting for synthetic notification');
}
async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;}
async function close(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

test('documented shadow route is separate from primary grouping',()=>{
  const yaml=readFileSync(example,'utf8');
  assert.match(yaml,/group_by: \['\.\.\.'\]/);
  assert.match(yaml,/continue: true/);
  assert.match(yaml,/send_resolved: true/);
  assert.match(yaml,/max_alerts: 0/);
});

test('pinned sender delivers 101 firing/resolved identities and preserves primary grouping',
  {skip:!tools,timeout:90000},async()=>{
  const binary=resolve(tools,'alertmanager'),amtool=resolve(tools,'amtool');
  const pinned=JSON.parse(readFileSync(new URL('../examples/images.lock.json',import.meta.url))).alertmanager.version.slice(1);
  const version=spawnSync(binary,['--version'],{encoding:'utf8'});
  assert.equal(version.status,0);assert.ok((version.stdout+version.stderr).includes(`version ${pinned}`));
  for(const bounded of [false,true]){
    const directory=mkdtempSync(join(tmpdir(),'alert-route-')),store=openStore(join(directory,'state.db'));
    const token='synthetic-route-token-'.repeat(3),headers={Authorization:`Bearer ${token}`};
    const primary=[],shadow=[],config={selector:{alertname:'Api400Spike',service:'example-api'},prometheus:{url:'http://127.0.0.1:1',queries:{}}};
    const service=makeServer({store,config,token});let process;
    const sink=createServer(async(req,res)=>{
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      primary.push(JSON.parse(Buffer.concat(chunks)));res.writeHead(200);res.end();
    });
    service.on('request',(req,res)=>{
      if(req.method!=='POST')return;
      const chunks=[];req.on('data',chunk=>chunks.push(chunk));
      res.on('finish',()=>{
        shadow.push({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks))});
        if(bounded&&res.statusCode===503)store.db.pragma('query_only = OFF');
      });
    });
    try{
      const primaryUrl=await listen(sink),serviceUrl=await listen(service);
      // Reserve an ephemeral loopback port without touching Docker or kubeconfig.
      const reservation=createServer();const amUrl=await listen(reservation);await close(reservation);
      const tokenFile=join(directory,'token');writeFileSync(tokenFile,token,{mode:0o600});
      let yaml=readFileSync(example,'utf8')
        .replace('http://existing-primary:8080/webhook',primaryUrl)
        .replace('http://alert-lab:8080',serviceUrl)
        .replace('/etc/alertmanager/alert-lab.token',tokenFile)
        .replace('group_wait: 30s','group_wait: 1s').replace('group_interval: 5m','group_interval: 1s');
      if(!bounded)yaml=yaml.replace("group_by: ['...']","group_by: ['alertname']");
      const file=join(directory,'alertmanager.yml');writeFileSync(file,yaml);
      const checked=spawnSync(amtool,['check-config',file],{encoding:'utf8'});
      assert.equal(checked.status,0,checked.stderr+checked.stdout);
      let logs='';
      process=spawn(binary,[`--config.file=${file}`,`--storage.path=${directory}/am`,`--web.listen-address=${amUrl.slice(7)}`,'--cluster.listen-address='],{stdio:['ignore','pipe','pipe']});
      process.stdout.on('data',chunk=>{logs+=chunk;});process.stderr.on('data',chunk=>{logs+=chunk;});
      await until(async()=>{try{return (await fetch(amUrl+'/-/ready')).ok;}catch{return false;}});
      const start=new Date(Date.now()-5000).toISOString();
      const alerts=Array.from({length:101},(_,i)=>({labels:{alertname:'Api400Spike',service:'example-api',instance:`synthetic-${i}`},startsAt:start,endsAt:new Date(Date.now()+120000).toISOString()}));
      const unrelated={...alerts[0],labels:{alertname:'OtherAlert',service:'example-api'}};
      const post=async input=>assert.equal((await fetch(amUrl+'/api/v2/alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).status,200);
      const episodes=async()=>{
        const items=[];let cursor='0';
        do{const response=await fetch(`${serviceUrl}/v1/episodes?limit=50&cursor=${cursor}`,{headers});assert.equal(response.status,200);const page=await response.json();items.push(...page.items);cursor=page.nextCursor;}while(cursor);
        return items;
      };
      // One real 503 proves upstream retries; all other notifications can proceed.
      if(bounded)store.db.pragma('query_only = ON');
      await post([...alerts,unrelated]);
      await until(()=>primary.some(b=>b.alerts.length===101&&b.status==='firing'));
      const source=primary.find(b=>b.alerts.length===101&&b.status==='firing');
      assert.equal(new Set(source.alerts.map(a=>a.labels.instance)).size,101);
      const expected=source.alerts.map(a=>validateWebhook({...source,alerts:[a]})[0].id).sort();
      if(!bounded){
        await until(()=>shadow.some(b=>b.status===400));
        assert.equal((await episodes()).length,0);
        assert.ok(shadow.some(b=>b.body.alerts.length===101&&b.body.truncatedAlerts===0));
        await until(()=>/unrecoverable/i.test(logs));
        continue;
      }
      await until(async()=>(await episodes()).length===101);
      const firing=await episodes();assert.deepEqual(firing.map(a=>a.id).sort(),expected);
      assert.ok(firing.every(a=>a.source_status==='firing'));assert.ok(shadow.some(b=>b.status===503));
      const end=new Date(Date.now()-100).toISOString();await post([...alerts,unrelated].map(a=>({...a,endsAt:end})));
      await until(async()=>(await episodes()).every(a=>a.source_status==='resolved'));
      await until(()=>primary.some(b=>b.alerts.length===101&&b.status==='resolved')&&primary.some(b=>b.alerts.length===1&&b.alerts[0].labels.alertname==='OtherAlert'&&b.status==='resolved'));
      const resolved=await episodes();assert.deepEqual(resolved.map(a=>a.id).sort(),expected);
      assert.equal(resolved.length,101);assert.ok(resolved.every(a=>a.source_status==='resolved'));
      assert.ok(shadow.every(b=>b.body.alerts.length===1&&b.body.truncatedAlerts===0));
      assert.ok(shadow.every(b=>b.body.alerts[0].labels.alertname==='Api400Spike'));
      for(const status of ['firing','resolved'])assert.equal(new Set(shadow.filter(b=>b.status===202&&b.body.alerts[0].status===status).map(b=>b.body.alerts[0].fingerprint)).size,101);
    }finally{
      if(process&&process.exitCode===null){process.kill('SIGTERM');await once(process,'exit');}
      await close(service);await close(sink);store.close();rmSync(directory,{recursive:true,force:true});
    }
  }
});
