import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reserveRelease} from '../scripts/release-guard.mjs';
const env={GITHUB_REPOSITORY:'m1ngshum/alert-lab',GITHUB_REF:'refs/heads/main',GITHUB_SHA:'a'.repeat(40),GH_TOKEN:'synthetic-token',GITHUB_ACTOR:'m1ngshum'};
function mock({existing='',status=200}={}){let writes=0;return {get writes(){return writes;},async fetch(url,options){
  assert.equal(options.redirect,'error');
  if(options.method==='POST'){writes++;return Response.json({id:123},{status:201});}
  if(url.includes('check-runs'))return Response.json({check_runs:['verify','codeql'].map(name=>({name,head_sha:env.GITHUB_SHA,app:{slug:'github-actions'},status:'completed',conclusion:'success'}))});
  if(url.includes('/token?')){assert.ok(url.includes(encodeURIComponent(':pull,push')));return existing==='token-forbidden'?new Response(null,{status:403}):Response.json({token:'scoped-synthetic-token'});}
  if(url.endsWith('/releases?per_page=100'))return Response.json(existing==='draft'?[{tag_name:'v0.1.3'}]:[]);
  return new Response(null,{status:existing&&url.includes(existing)?status:404});
}};}
test('release reserves only after checking GitHub and both registry versions',async()=>{const m=mock();assert.equal(await reserveRelease(env,m.fetch),123);assert.equal(m.writes,1);});
test('release fails closed on existing artifacts, draft reservations and network errors',async()=>{
  for(const existing of ['releases/tags','git/ref','manifests','draft','token-forbidden','0.1.3-amd64','0.1.3-arm64']){const m=mock({existing});await assert.rejects(()=>reserveRelease(env,m.fetch));assert.equal(m.writes,0);}
  const m=mock({existing:'manifests',status:503});await assert.rejects(()=>reserveRelease(env,m.fetch));assert.equal(m.writes,0);
  await assert.rejects(()=>reserveRelease({...env,GITHUB_REF:'refs/heads/feature'},mock().fetch));
});
