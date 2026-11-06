import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore,validateWebhook} from '../server/store.mjs';
import {collect} from '../server/prometheus.mjs';
import {validateConfig} from '../server/config.mjs';
import {makeServer} from '../server/http.mjs';
import {startWorker} from '../server/worker.mjs';
import {presets,evaluate} from '../web/policy.js';
import {replay} from '../web/replay.js';
const config={selector:{alertname:'AlertLabSpike'},prometheus:{url:'http://prometheus:9090',queries:{}}};
const alert=(status='firing',fingerprint='0123456789abcdef')=>({status,fingerprint,startsAt:'2026-11-06T00:00:00Z',labels:{alertname:'AlertLabSpike',service:'synthetic',private:'DO_NOT_STORE'},annotations:{secret:'DO_NOT_STORE'}});
const batch=(...alerts)=>({version:'4',truncatedAlerts:0,alerts});
const normalized=(...alerts)=>validateWebhook(batch(...alerts));
test('config rejects arbitrary destinations and malformed mappings',()=>{
  assert.equal(validateConfig(structuredClone(config)).selector.alertname,'AlertLabSpike');
  for(const url of ['file:///etc/passwd','https://user:pass@example.com','http://example.com/?query=bad'])assert.throws(()=>validateConfig({...config,prometheus:{url,queries:{}}}));
  assert.throws(()=>validateConfig({...config,selector:{}}));
  assert.throws(()=>validateConfig({...config,prometheus:{...config.prometheus,queries:{cpu:{query:'vector(1)'}}}}));
});
test('validate whole webhook, reject truncation and malformed identities',()=>{
  for(const b of [null,batch(),{...batch(alert()),truncatedAlerts:1},batch(alert(),{...alert(),fingerprint:'bad'}),batch({...alert(),labels:null})])assert.throws(()=>validateWebhook(b));
});
test('durable dedup, bounded rechecks, resolution precedence and retention',()=>{
  const dir=mkdtempSync(join(tmpdir(),'alert-store-')),path=join(dir,'state.db');let store=openStore(path),now=1000;
  try {
    assert.equal(store.ingest(normalized(alert()),config.selector,now).accepted,1);
    assert.equal(store.ingest(normalized(alert()),config.selector,now).duplicates,1);
    const id=normalized(alert())[0].id;
    for(let rechecks=0;rechecks<=2;rechecks++){
      const due=store.due(now);assert.equal(due.rechecks,rechecks);
      assert.equal(store.complete(due,{evidence:{...presets[0].data,rechecks},errors:[]},now),true);
      assert.equal(store.complete(due,{evidence:presets[0].data,errors:[]},now),false);
      store.close();store=openStore(path);now+=300000;
    }
    assert.equal(store.due(now),undefined);const detail=store.detail(id);assert.equal(detail.decisions.length,3);assert.equal(detail.decisions.at(-1).decision.kind,'review');assert.equal(detail.labels.private,undefined);assert.ok(!JSON.stringify(detail).includes('DO_NOT_STORE'));
    const suite={schemaVersion:1,cases:[{id,steps:detail.decisions.map(d=>({evidence:d.evidence,expectedKind:d.decision.kind}))}]};assert.equal(replay(suite).totals.failed,0);
    store.ingest(normalized(alert('resolved')),config.selector,now);store.ingest(normalized(alert()),config.selector,now);assert.equal(store.detail(id).source_status,'resolved');assert.equal(store.due(now),undefined);
    store.prune(now+8*86400000);assert.equal(store.detail(id),null);
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('resolved events invalidate in-flight collection, including reordered delivery',()=>{
  const store=openStore(':memory:');try{
    store.ingest(normalized(alert()),config.selector,1);const due=store.due(1);store.ingest(normalized(alert('resolved')),config.selector,2);
    assert.equal(store.complete(due,{evidence:presets[0].data,errors:[]},3),false);
    store.ingest(normalized(alert('resolved','fedcba9876543210')),config.selector,4);store.ingest(normalized(alert('firing','fedcba9876543210')),config.selector,5);assert.equal(store.due(6),undefined);
  }finally{store.close();}
});
test('batch storage failure rolls back every change',()=>{
  const store=openStore(':memory:');try{
    const original=store.db.prepare("CREATE TRIGGER fail_second BEFORE INSERT ON episodes WHEN NEW.id='"+normalized(alert('firing','fedcba9876543210'))[0].id+"' BEGIN SELECT RAISE(ABORT,'injected'); END");original.run();
    assert.throws(()=>store.ingest(normalized(alert(),alert('firing','fedcba9876543210')),config.selector,1));assert.equal(store.list(0,100).length,0);
  }finally{store.close();}
});
test('mixed batches free capacity before admitting firing episodes',()=>{
  const store=openStore(':memory:');try{
    for(let i=0;i<1000;i+=100)store.ingest(normalized(...Array.from({length:100},(_,j)=>alert('firing',(i+j).toString(16).padStart(16,'0')))),config.selector,1);
    const old=alert('resolved','0000000000000000'),fresh=alert('firing','ffffffffffffffff');
    assert.equal(store.ingest(normalized(fresh,old),config.selector,2).accepted,2);
    assert.equal(store.detail(normalized(old)[0].id).source_status,'resolved');assert.equal(store.detail(normalized(fresh)[0].id).source_status,'firing');
    assert.equal(store.ingest(normalized(alert('resolved','eeeeeeeeeeeeeeee')),config.selector,3).accepted,1);
    assert.equal(store.db.prepare("SELECT count(*) AS n FROM episodes WHERE source_status='firing'").get().n,1000);
  }finally{store.close();}
});
test('Prometheus freshness and explicit decoding; errors remain unknown',async()=>{
  const queries={};for(const [key,value]of Object.entries(presets[0].data))if(!['rechecks','classifier'].includes(key))queries[key]={query:key,freshnessQuery:'age',maxAgeSeconds:120,...(typeof value==='string'?{values:{'1':value}}:{})};
  const fetchImpl=async(url,options)=>{
    assert.equal(options.redirect,'error');const query=url.searchParams.get('query');const value=query==='age'?0:presets[0].data[query];
    return Response.json({status:'success',data:{resultType:'vector',result:[{metric:{},value:[1000,String(typeof value==='number'?value:1)]}]}});
  };
  let r=await collect({...config.prometheus,queries},null,0,{fetchImpl,now:1000000});assert.equal(r.errors.length,0);assert.equal(evaluate(r.evidence).kind,'observe');
  const bad=async()=>Response.json({status:'success',data:{resultType:'vector',result:[]}});
  r=await collect({...config.prometheus,queries},null,0,{fetchImpl:bad,now:1000000});assert.equal(evaluate(r.evidence).kind,'review');assert.equal(r.evidence.logs,false);assert.equal(r.evidence.security,'unknown');
  const stale=async()=>Response.json({status:'success',data:{resultType:'scalar',result:[1000,'121']}});
  r=await collect({...config.prometheus,queries:{cpu:queries.cpu}},null,0,{fetchImpl:stale,now:1000000});assert.deepEqual(r.errors,['cpu']);
  const warnings=async()=>Response.json({status:'success',warnings:['partial'],data:{resultType:'scalar',result:[1000,'0']}});
  r=await collect({...config.prometheus,queries:{cpu:queries.cpu}},null,0,{fetchImpl:warnings,now:1000000});assert.deepEqual(r.errors,['cpu']);
  for(const value of [null,'',true,'NaN','Inf']){
    const invalid=async()=>Response.json({status:'success',data:{resultType:'scalar',result:[1000,value]}});
    r=await collect({...config.prometheus,queries:{cpu:queries.cpu}},null,0,{fetchImpl:invalid,now:1000000});assert.deepEqual(r.errors,['cpu']);
  }
});
test('worker serializes collection and resumes durable due work',async()=>{
  const store=openStore(':memory:');let release,calls=0;const blocked=new Promise(resolve=>release=resolve);
  store.ingest(normalized(alert()),config.selector,1);
  const worker=startWorker({store,config,interval:100000,now:()=>1,collectEvidence:async()=>{calls++;await blocked;return {evidence:presets[0].data,errors:[]};}});
  await worker.tick();assert.equal(calls,1);release();await worker.stop();assert.equal(store.detail(normalized(alert())[0].id).decisions.length,1);store.close();
});
test('HTTP auth, grouped delivery, pagination, export and storage errors',async()=>{
  const store=openStore(':memory:');const token='synthetic-test-token-'.repeat(3);const server=makeServer({store,config,token});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  try{
    assert.equal((await fetch(base+'/healthz')).status,200);assert.equal((await fetch(base+'/v1/episodes')).status,401);
    assert.equal((await fetch(base+'/v1/webhooks/alertmanager',{method:'POST',headers,body:JSON.stringify(batch(alert(),alert('firing','fedcba9876543210')))})).status,202);
    const response=await fetch(base+'/v1/episodes?limit=1',{headers});const page=await response.json();assert.equal(page.items.length,1);assert.ok(page.nextCursor);
    assert.equal((await (await fetch(base+'/v1/episodes?cursor='+page.nextCursor,{headers})).json()).items.length,1);
    const due=store.due(Date.now());store.complete(due,{evidence:presets[0].data,errors:[]},Date.now());
    const suite=await (await fetch(base+'/v1/episodes/'+due.id+'/replay',{headers})).json();assert.equal(replay(suite).totals.failed,0);
    assert.equal((await fetch(base+'/v1/episodes?limit=1000',{headers})).status,400);
    store.db.pragma('query_only = ON');assert.equal((await fetch(base+'/readyz')).status,503);
    assert.equal((await fetch(base+'/v1/webhooks/alertmanager',{method:'POST',headers,body:JSON.stringify(batch(alert('firing','1111111111111111')))})).status,503);
  }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});
