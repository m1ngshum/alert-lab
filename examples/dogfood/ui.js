import {parseSuite,replay,markdown} from '/replay.js';

const token=document.querySelector('#token'),episode=document.querySelector('#episode');
const status=document.querySelector('#status'),steps=document.querySelector('#steps');
const auto=document.querySelector('#auto'),live=document.querySelector('#live'),timeline=document.querySelector('#timeline');
const refresh=document.querySelector('#refresh'),more=document.querySelector('#more'),run=document.querySelector('#replay');
const downloads=['evidence','json','markdown'].map(id=>document.querySelector('#'+id));
const scenarios=[...document.querySelectorAll('[data-scenario]')];
let busy=false,active=null,cursor=null,tail=0,follow=true,suite=null,report=null;

function controls() {
  const locked=busy&&!active?.quiet;
  token.disabled=locked;episode.disabled=locked||!episode.value;
  refresh.disabled=locked;more.disabled=locked||cursor===null;run.disabled=locked||!episode.value;
  scenarios.forEach(button=>{button.disabled=locked;});
  downloads.forEach(button=>{button.disabled=locked||report===null;});
}
function clearReplay() {suite=null;report=null;steps.replaceChildren();timeline.replaceChildren();}
async function request(path,method='GET') {
  const job=active;
  const current=()=>{if(active!==job||job.abort.signal.aborted)throw new Error('Request cancelled.');};
  const response=await fetch(path,{method,headers:{Authorization:'Bearer '+token.value},redirect:'error',signal:AbortSignal.any([job.abort.signal,AbortSignal.timeout(10000)])});
  current();
  if(!response.ok) {
    if(response.status===401)throw new Error('Unauthorized. Enter the sandbox token and refresh episodes.');
    if(response.status===409)throw new Error('No decisions recorded yet. Refresh episodes and retry.');
    throw new Error('Request failed (HTTP '+response.status+').');
  }
  return {json:async()=>{const data=await response.json();current();return data;}};
}
function cancelBackground() {
  if(active?.quiet) {active.abort.abort();active=null;busy=false;}
}
async function perform(message,action,quiet=false) {
  if(!quiet)cancelBackground();
  if(busy)return;
  const job={quiet,abort:new AbortController()};active=job;
  busy=true;if(!quiet) {clearReplay();status.textContent=message;}controls();
  try {await action();}
  catch(error) {
    if(active!==job||job.abort.signal.aborted)return;
    clearReplay();auto.checked=false;live.textContent='Auto-refresh paused after an error. Refresh to retry, then enable it again.';status.textContent='Error: '+error.message;
  }
  finally {if(active===job) {busy=false;active=null;controls();}}
}
async function loadEpisodes() {
  const previous=episode.value;
  const response=await request('/episodes?cursor='+tail);
  const data=await response.json();
  if(!Array.isArray(data.items)||!data.items.every(row=>row&&/^[a-f0-9]{64}$/.test(row.id))||(data.nextCursor!==null&&!/^\d+$/.test(data.nextCursor)))throw new Error('Invalid episode listing.');
  if(data.items.length&&episode.options.length===1&&!episode.options[0].value)episode.replaceChildren();
  for(const row of data.items) {
    if(!Number.isSafeInteger(row.seq)||row.seq<=tail)throw new Error('Invalid episode order.');
    tail=row.seq;
    const option=document.createElement('option');option.value=row.id;
    option.textContent=row.starts_at+' · '+row.source_status+' · rechecks '+row.rechecks+' · '+row.id.slice(0,12);
    episode.append(option);
  }
  cursor=data.nextCursor;
  const selected=!follow&&[...episode.options].some(option=>option.value===previous)?previous:episode.options[episode.options.length-1]?.value;
  if(selected!==undefined&&episode.value!==selected) {
    clearReplay();episode.value=selected;controls();status.textContent='Loading the selected episode…';
  }
  if(!episode.options.length) {const option=document.createElement('option');option.value='';option.textContent='No episodes yet';episode.append(option);}
  if(!episode.value)status.textContent='No episodes yet. Start a spike and wait for Alertmanager.';
}
refresh.addEventListener('click',()=>perform('Loading live evidence…',update));
more.addEventListener('click',()=>perform('Loading more episodes…',update));
episode.addEventListener('change',()=>{follow=false;perform('Loading selected episode…',loadDetail);});
token.addEventListener('input',()=>{cancelBackground();clearReplay();cursor=null;tail=0;follow=true;episode.replaceChildren();status.textContent='Token changed. Refresh episodes to unlock access.';controls();});
scenarios.forEach(button=>button.addEventListener('click',()=>perform('Changing synthetic scenario…',async()=>{
  await request('/scenario/'+button.dataset.scenario,'POST');
  if(button.dataset.scenario==='spike')follow=true;
  status.textContent=button.textContent+' started. Auto-refresh will show source events and real five-minute rechecks.';
})));
function showReplay(imported,sourceStatus) {
  const result=replay(imported),fragment=document.createDocumentFragment();
  for(const item of result.cases)for(const [index,step] of item.steps.entries()) {
    const li=document.createElement('li'),reason=document.createElement('p');
    li.textContent='Step '+(index+1)+' · recheck '+step.evidence.rechecks+' · actual '+step.decision.kind+' · expected '+(step.expectedKind??'unasserted')+' · '+(step.passed===null?'UNASSERTED':step.passed?'PASS':'FAIL');
    reason.textContent=step.decision.reasons.join(' ');li.append(reason);fragment.append(li);
  }
  steps.replaceChildren(fragment);suite=imported;report=result;
  const totals=report.totals;
  const summary='Source '+sourceStatus+' · Policy '+report.policyVersion+' · '+totals.steps+' steps · '+totals.passed+' passed · '+totals.failed+' failed · '+totals.unasserted+' unasserted. Downloads are ready.';
  if(status.textContent!==summary)status.textContent=summary;
}
function addEvent(text) {const li=document.createElement('li');li.textContent=text;timeline.append(li);}
function time(value) {return new Date(value).toISOString();}
async function loadDetail() {
  if(!episode.value)return;
  const id=episode.value,data=await (await request('/episodes/'+id)).json();
  if(data.id!==id||!Array.isArray(data.decisions)||!['firing','resolved'].includes(data.source_status))throw new Error('Invalid episode detail.');
  timeline.replaceChildren();
  addEvent(time(data.starts_at)+' · Alertmanager firing started');
  for(const row of data.decisions) addEvent(time(row.created_at)+' · recheck '+row.evidence.rechecks+' · '+row.decision.kind);
  if(data.source_status==='resolved')addEvent(time(data.completed_at)+' · Alertmanager source resolution received; policy conclusion is unchanged');
  else if(data.next_due!==null)addEvent(time(data.next_due)+' · next evidence collection due');
  else addEvent('No recheck scheduled; recommendation awaits a new source event.');
  const label=data.starts_at+' · '+data.source_status+' · '+data.decisions.length+' recorded decisions · '+id.slice(0,12);
  if(episode.selectedOptions[0].textContent!==label)episode.selectedOptions[0].textContent=label;
  if(data.decisions.length)showReplay(parseSuite(JSON.stringify({schemaVersion:1,cases:[{id,steps:data.decisions.map(row=>({evidence:row.evidence,expectedKind:row.decision.kind}))}]})),data.source_status);
  else {suite=null;report=null;steps.replaceChildren();status.textContent='No decisions recorded yet. Waiting for evidence collection.';}
}
async function update() {
  await loadEpisodes();await loadDetail();
  live.textContent='Last updated '+time(Date.now())+(auto.checked?' · auto-refresh every 5 seconds':' · auto-refresh paused');
}
run.addEventListener('click',()=>perform('Replaying recorded evidence…',loadDetail));
auto.addEventListener('change',()=>{if(!auto.checked) {cancelBackground();controls();}live.textContent=auto.checked?'Auto-refresh enabled.':'Auto-refresh paused.';});
setInterval(()=>{
  if(auto.checked&&!document.hidden&&token.value&&!busy)return perform('Refreshing live evidence…',update,true);
},5000);
function download(kind) {
  if((busy&&!active?.quiet)||report===null)return;
  const isMarkdown=kind==='markdown',body=isMarkdown?markdown(report):JSON.stringify(kind==='evidence'?suite:report,null,2)+'\n';
  const url=URL.createObjectURL(new Blob([body],{type:isMarkdown?'text/markdown;charset=utf-8':'application/json;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='alert-lab-'+episode.value+'-'+(kind==='evidence'?'evidence':'replay')+(isMarkdown?'.md':'.json');
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
downloads.forEach(button=>button.addEventListener('click',()=>download(button.id)));
status.textContent='Enter the sandbox token to start watching episodes.';controls();
