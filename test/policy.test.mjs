import assert from 'node:assert/strict';
import {evaluate,presets} from '../web/policy.js';
const baseline = {...presets[0].data};
let checks=0;
function route(patch,expected) { assert.equal(evaluate({...baseline,...patch}).kind,expected,JSON.stringify(patch));checks++; }
for(const [i,expected] of ['observe','review','page','security','review'].entries()) {assert.equal(evaluate(presets[i].data).kind,expected);checks++;}
route({rate:100},'observe');
route({success:96.9,metrics:false},'page');
route({success:97},'review');
route({success:99},'observe');
route({cpu:90,logs:false},'page');
route({cpu:89},'review');
route({cpu:74},'observe');
route({cpu:100,metrics:false},'review');
route({security:'confirmed',logs:false,metrics:false,journeys:false},'page');
route({security:'suspicious',classifier:'normal'},'security');
route({security:'suspicious',metrics:false},'security');
for(const key of ['logs','metrics','journeys'])route({[key]:false},'review');
for(const key of ['rejection','downstream','security'])route({[key]:'unknown'},'review');
for(const classifier of ['uncertain','unavailable','invalid'])route({classifier},'review');
route({consistency:'conflicting'},'review');
route({consistency:'conflicting',cpu:95},'page');
route({samples:false},'review');
for(const patch of [{security:'suspicious',metrics:false},{security:'suspicious',cpu:95},{security:'confirmed',logs:false}]) {assert.ok(evaluate({...baseline,...patch}).securityTask);checks++;}
for(const value of [NaN,Infinity,-1,null,'50'])route({cpu:value},'review');
route({latency:1500},'page');route({latency:800},'review');route({latency:799},'observe');
route({downstream:'outage'},'page');route({downstream:'strained'},'review');
route({rejection:'unexpected'},'review');
route({rechecks:1},'observe');route({rechecks:2},'review');route({rechecks:-1},'review');
route({rate:2,rechecks:2},'resolved');
route({rate:2,metrics:false},'review');
route({rate:2,consistency:'conflicting'},'review');
route({rate:2,security:'suspicious'},'security');
route({rate:2,cpu:95},'page');
for(const patch of [{success:98,rejection:'unexpected'},{metrics:false}]) {
  const result=evaluate({...baseline,...patch,security:'suspicious'});
  assert.match(result.deadline,/15 simulated/);
  assert.ok(result.reasons.some(reason=>/98\.0|missing or stale/.test(reason)));
  assert.ok(result.securityTask);
  checks+=3;
}
console.log(`${checks} policy checks passed.`);
