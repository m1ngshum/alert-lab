import {parseSuite,replay,markdown} from '/replay.js';

const token=document.querySelector('#token'),episode=document.querySelector('#episode');
const status=document.querySelector('#status'),steps=document.querySelector('#steps');
const refresh=document.querySelector('#refresh'),more=document.querySelector('#more'),run=document.querySelector('#replay');
const downloads=['evidence','json','markdown'].map(id=>document.querySelector('#'+id));
const scenarios=[...document.querySelectorAll('[data-scenario]')];
let busy=false,cursor=null,suite=null,report=null;

function controls() {
  token.disabled=busy;episode.disabled=busy||!episode.value;
  refresh.disabled=busy;more.disabled=busy||cursor===null;run.disabled=busy||!episode.value;
  scenarios.forEach(button=>{button.disabled=busy;});
  downloads.forEach(button=>{button.disabled=busy||report===null;});
}
function clearReplay() {suite=null;report=null;steps.replaceChildren();}
async function request(path,method='GET') {
  const response=await fetch(path,{method,headers:{Authorization:'Bearer '+token.value},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok) {
    if(response.status===401)throw new Error('Unauthorized. Enter the sandbox token and refresh episodes.');
    if(response.status===409)throw new Error('No decisions recorded yet. Refresh episodes and retry.');
    throw new Error('Request failed (HTTP '+response.status+').');
  }
  return response;
}
async function perform(message,action) {
  if(busy)return;
  busy=true;clearReplay();status.textContent=message;controls();
  try {await action();}
  catch(error) {clearReplay();status.textContent='Error: '+error.message;}
  finally {busy=false;controls();}
}
async function loadEpisodes(append) {
  const previous=episode.value;
  const response=await request('/episodes'+(append?'?cursor='+encodeURIComponent(cursor):''));
  const data=await response.json();
  if(!Array.isArray(data.items)||!data.items.every(row=>row&&/^[a-f0-9]{64}$/.test(row.id))||(data.nextCursor!==null&&!/^\d+$/.test(data.nextCursor)))throw new Error('Invalid episode listing.');
  if(!append)episode.replaceChildren();
  for(const row of data.items) {
    const option=document.createElement('option');option.value=row.id;
    option.textContent=row.starts_at+' · '+row.source_status+' · rechecks '+row.rechecks+' · '+row.id.slice(0,12);
    episode.append(option);
  }
  cursor=data.nextCursor;
  if([...episode.options].some(option=>option.value===previous))episode.value=previous;
  else if(episode.options.length)episode.value=episode.options[episode.options.length-1].value;
  if(!episode.options.length) {const option=document.createElement('option');option.value='';option.textContent='No episodes yet';episode.append(option);}
  status.textContent=episode.value?'Choose an episode and run its replay.':'No episodes yet. Start a spike, wait about ten seconds, then refresh.';
}
refresh.addEventListener('click',()=>perform('Loading episodes…',()=>loadEpisodes(false)));
more.addEventListener('click',()=>perform('Loading more episodes…',()=>loadEpisodes(true)));
episode.addEventListener('change',()=>{clearReplay();status.textContent='Run replay for the selected episode.';controls();});
token.addEventListener('input',()=>{clearReplay();cursor=null;episode.replaceChildren();status.textContent='Token changed. Refresh episodes to unlock access.';controls();});
scenarios.forEach(button=>button.addEventListener('click',()=>perform('Changing synthetic scenario…',async()=>{
  await request('/scenario/'+button.dataset.scenario,'POST');
  status.textContent=button.textContent+' started. Refresh episodes after about ten seconds. Rechecks use real five-minute intervals.';
})));
run.addEventListener('click',()=>perform('Replaying recorded evidence…',async()=>{
  const id=episode.value,response=await request('/episodes/'+id+'/replay');
  const imported=parseSuite(await response.text());
  if(imported.cases.length!==1||imported.cases[0].id!==id)throw new Error('Replay evidence does not match the selected episode.');
  const result=replay(imported),fragment=document.createDocumentFragment();
  for(const item of result.cases)for(const [index,step] of item.steps.entries()) {
    const li=document.createElement('li'),reason=document.createElement('p');
    li.textContent='Step '+(index+1)+' · recheck '+step.evidence.rechecks+' · actual '+step.decision.kind+' · expected '+(step.expectedKind??'unasserted')+' · '+(step.passed===null?'UNASSERTED':step.passed?'PASS':'FAIL');
    reason.textContent=step.decision.reasons.join(' ');li.append(reason);fragment.append(li);
  }
  steps.replaceChildren(fragment);suite=imported;report=result;
  const totals=report.totals;
  status.textContent='Policy '+report.policyVersion+' · '+totals.steps+' steps · '+totals.passed+' passed · '+totals.failed+' failed · '+totals.unasserted+' unasserted. Downloads are ready.';
}));
function download(kind) {
  if(busy||report===null)return;
  const isMarkdown=kind==='markdown',body=isMarkdown?markdown(report):JSON.stringify(kind==='evidence'?suite:report,null,2)+'\n';
  const url=URL.createObjectURL(new Blob([body],{type:isMarkdown?'text/markdown;charset=utf-8':'application/json;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='alert-lab-'+episode.value+'-'+(kind==='evidence'?'evidence':'replay')+(isMarkdown?'.md':'.json');
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
downloads.forEach(button=>button.addEventListener('click',()=>download(button.id)));
status.textContent='Enter the sandbox token, then refresh episodes.';controls();
