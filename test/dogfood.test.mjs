import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,symlinkSync,rmSync,readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {authorized,evidence,createLab} from '../examples/dogfood/workload.mjs';
import {replay} from '../web/replay.js';
test('ConfigMap-style symlink entrypoint runs token validation',()=>{
 const dir=mkdtempSync(join(tmpdir(),'alert-lab-symlink-'));
 try{const entry=join(dir,'workload.mjs');symlinkSync(fileURLToPath(new URL('../examples/dogfood/workload.mjs',import.meta.url)),entry);
  const r=spawnSync(process.execPath,[entry],{env:{...process.env,SERVICE_TOKEN_FILE:join(dir,'missing-token')},encoding:'utf8'});
  assert.equal(r.status,1);assert.match(r.stderr,/ENOENT/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('synthetic evidence derives rate, success and latency from observed responses',()=>{
 const samples=[...Array.from({length:10},()=>({invalid:false,status:200,ms:20})),...Array.from({length:10},()=>({invalid:true,status:400,ms:10}))];
 const e=evidence(samples,5,20,false);assert.equal(e.rate,50);assert.equal(e.success,100);assert.equal(e.latency,20);assert.equal(e.samples,1);assert.equal(e.security,1);
 assert.equal(evidence([],0,0,false).samples,0);assert.equal(evidence(samples,5,20,true).security,0);
 samples[10].status=500;assert.equal(evidence(samples,5,20,false).rate,45);assert.equal(evidence(samples,5,20,false).rejection,0);
 samples[0].status=500;assert.equal(evidence(samples,5,20,false).success,90);
});
test('controls and episode proxy require exact bearer authentication',async()=>{
 const token='a'.repeat(64);assert.equal(authorized('Bearer '+token,token),true);assert.equal(authorized('Bearer wrong',token),false);
 const server=createLab(token);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(base+'/scenario/spike',{method:'POST'})).status,401);
  assert.equal((await fetch(base+'/episodes')).status,401);
  assert.equal((await fetch(base+'/scenario/other',{method:'POST',headers:{Authorization:'Bearer '+token}})).status,400);
  const r=await fetch(base+'/scenario/spike',{method:'POST',headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);assert.equal((await r.json()).scenario,'spike');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('browser replay assets reuse shared policy; authenticated exports preserve evidence and pagination',async()=>{
 const token='a'.repeat(64),id='b'.repeat(64),empty='c'.repeat(64),redirect='d'.repeat(64),requests=[];
 const suite=JSON.parse(readFileSync(new URL('../web/examples.json',import.meta.url),'utf8'));suite.cases=[{...suite.cases[0],id}];
 const upstream=createServer((req,res)=>{
  requests.push({path:req.url,authorization:req.headers.authorization});res.setHeader('content-type','application/json');
  if(req.url==='/v1/episodes/'+empty+'/replay'){res.writeHead(409);res.end(JSON.stringify({error:'No decisions recorded yet'}));return;}
  if(req.url==='/v1/episodes/'+redirect+'/replay'){res.writeHead(302,{location:'http://127.0.0.1:1/should-not-follow'});res.end('{}');return;}
  res.end(JSON.stringify(req.url.endsWith('/replay')?suite:{items:[{id}],nextCursor:null}));
 });
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const server=createLab(token,'http://127.0.0.1:'+upstream.address().port);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,headers={Authorization:'Bearer '+token};
 try {
  for(const [path,file] of [['/replay.js','replay.js'],['/policy.js','policy.js']]) {
   const r=await fetch(base+path);assert.equal(r.status,200);assert.equal(await r.text(),readFileSync(new URL('../web/'+file,import.meta.url),'utf8'));
  }
  const html=await fetch(base+'/');assert.match(await html.text(),/type="module"/);assert.ok(!html.headers.get('content-security-policy').includes('unsafe-inline'));
  assert.equal((await fetch(base+'/app.js')).status,200);assert.equal((await fetch(base+'/styles.css')).status,200);
  assert.equal((await fetch(base+'/episodes/'+id+'/replay')).status,401);
  const exported=await (await fetch(base+'/episodes/'+id+'/replay',{headers})).json();assert.deepEqual(exported,suite);assert.deepEqual(replay(exported),replay(suite));
  await fetch(base+'/episodes?cursor=50&limit=50',{headers});assert.equal(requests.at(-1).path,'/v1/episodes?cursor=50&limit=50');
  const before=requests.length;
  assert.equal((await fetch(base+'/episodes?url=http://example.com',{headers})).status,400);
  assert.equal((await fetch(base+'/episodes/'+id+'/replay?cursor=1',{headers})).status,400);
  assert.equal((await fetch(base+'/episodes/short/replay',{headers})).status,404);assert.equal(requests.length,before);
  assert.equal((await fetch(base+'/episodes/'+empty+'/replay',{headers})).status,409);
  assert.equal((await fetch(base+'/episodes/'+redirect+'/replay',{headers})).status,502);
  assert.ok(requests.every(r=>r.authorization==='Bearer '+token));
 } finally {server.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>upstream.close(r))]);}
});
