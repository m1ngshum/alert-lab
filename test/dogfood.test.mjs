import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {authorized,evidence,createLab} from '../examples/dogfood/workload.mjs';
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
