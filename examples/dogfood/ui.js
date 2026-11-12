import {parseSuite,replay,markdown} from '/replay.js';

const token=document.querySelector('#token'),episode=document.querySelector('#episode');
const status=document.querySelector('#status'),steps=document.querySelector('#steps');
const auto=document.querySelector('#auto'),live=document.querySelector('#live'),timeline=document.querySelector('#timeline');
const progress=document.querySelector('#exercise'),exerciseState=document.querySelector('#exercise-state'),countdown=document.querySelector('#countdown');
const startRun=document.querySelector('#auto-run'),cancelRun=document.querySelector('#cancel-run'),runStatus=document.querySelector('#run-status');
const historyList=document.querySelector('#history'),historyState=document.querySelector('#history-state'),historyRows=new Map();
const compare=document.querySelector('#compare'),comparison=document.querySelector('#comparison'),comparisonState=document.querySelector('#comparison-state');
const changesOnly=document.querySelector('#changes-only');
const comparisonDownloads=['comparison-json','comparison-markdown','comparison-zip'].map(id=>document.querySelector('#'+id));
let comparisonTables=[],comparisonSnapshot=null;
const refresh=document.querySelector('#refresh'),more=document.querySelector('#more'),run=document.querySelector('#replay');
const downloads=['evidence','json','markdown'].map(id=>document.querySelector('#'+id));
const scenarios=[...document.querySelectorAll('[data-scenario]')];
let busy=false,active=null,cursor=null,tail=0,follow=true,suite=null,report=null,observed=null,receivedAt=0,exerciseRun=null;

function controls() {
  const locked=Boolean(exerciseRun)||(busy&&!active?.quiet);
  startRun.disabled=locked||!token.value;cancelRun.disabled=!exerciseRun||(busy&&!active?.quiet);auto.disabled=Boolean(exerciseRun);
  token.disabled=locked;episode.disabled=locked||!episode.value;
  refresh.disabled=locked;more.disabled=locked||cursor===null;run.disabled=locked||!episode.value;
  scenarios.forEach(button=>{button.disabled=locked;});
  downloads.forEach(button=>{button.disabled=locked||report===null;});
  for(const row of historyRows.values()) {row.review.disabled=locked;row.zip.disabled=locked;}
  compare.disabled=locked||!token.value;
  changesOnly.disabled=locked||!comparisonTables.length;
  comparisonDownloads.forEach(button=>{button.disabled=locked||comparisonSnapshot===null;});
}
function clearReplay() {suite=null;report=null;observed=null;steps.replaceChildren();timeline.replaceChildren();paintExercise();}
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
  busy=true;if(!quiet) {clearComparison();clearReplay();status.textContent=message;}controls();
  try {await action();}
  catch(error) {
    if(active!==job||job.abort.signal.aborted)return;
    if(exerciseRun) {exerciseRun=null;runStatus.textContent='Exercise stopped. Recovery is not confirmed; use Recovery before retrying.';}
    clearComparison();clearReplay();auto.checked=false;live.textContent='Auto-refresh paused after an error. Refresh to retry, then enable it again.';status.textContent='Error: '+error.message;
  }
  finally {if(active===job) {busy=false;active=null;controls();}}
}
function clearComparison() {comparisonTables=[];comparisonSnapshot=null;changesOnly.disabled=true;comparisonDownloads.forEach(button=>{button.disabled=true;});comparison.replaceChildren();comparisonState.textContent='Compare evidence and recorded decisions without starting a spike.';}
function clearHistory() {clearComparison();historyRows.clear();historyList.replaceChildren();historyState.textContent='No history loaded.';}
function filterComparison() {
  for(const {title,caption,rows} of comparisonTables) {
    const count=rows.filter(row=>row.className==='changed').length;
    for(const row of rows)row.hidden=changesOnly.checked&&row.className!=='changed';
    title.textContent=caption+' · '+count+' changed fields'+(changesOnly.checked&&!count?' · no differences':'');
  }
}
changesOnly.addEventListener('change',filterComparison);
function numericDelta(previous,latest) {
  if(typeof previous!=='number'||typeof latest!=='number'||!Number.isFinite(previous)||!Number.isFinite(latest))return '—';
  const difference=latest-previous;
  if(!Number.isFinite(difference))return 'Out of range';
  const rounded=Number(difference.toPrecision(6));
  return (rounded!==difference?'≈ ':'')+(difference>0?'+':'')+String(rounded);
}
function comparisonTable(caption,previous,latest,ids) {
  const table=document.createElement('table'),title=document.createElement('caption'),head=document.createElement('tr');title.textContent=caption;table.append(title);
  for(const label of ['Field','Previous · '+ids[0].slice(0,12),'Latest · '+ids[1].slice(0,12),'Change','Delta (latest − previous)']) {const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th);}
  table.append(head);
  const rows=[],changes=[];
  for(const key of new Set([...Object.keys(previous),...Object.keys(latest)])) {
    const row=document.createElement('tr'),field=document.createElement('th');field.scope='row';field.textContent=key;row.append(field);
    const values=[previous[key],latest[key]],changed=JSON.stringify(values[0])!==JSON.stringify(values[1]);
    for(const value of values) {const cell=document.createElement('td');cell.textContent=value===undefined?'Not recorded':JSON.stringify(value);row.append(cell);}
    const change=document.createElement('td'),delta=document.createElement('td');change.textContent=changed?'Changed':'Same';delta.textContent=numericDelta(...values);row.append(change,delta);if(changed)row.className='changed';table.append(row);rows.push(row);
    if(changed)changes.push({field:key,previous:values[0]===undefined?{recorded:false}:{recorded:true,value:values[0]},latest:values[1]===undefined?{recorded:false}:{recorded:true,value:values[1]},numericDelta:values.every(value=>typeof value==='number'&&Number.isFinite(value))&&Number.isFinite(values[1]-values[0])?values[1]-values[0]:null,delta:delta.textContent});
  }
  comparison.append(table);comparisonTables.push({title,caption,rows,changes});filterComparison();
}
comparisonDownloads.forEach(button=>button.addEventListener('click',()=>{
  if(exerciseRun||(busy&&!active?.quiet)||comparisonSnapshot===null)return;
  const result={schemaVersion:1,reportType:'changes-only-comparison',...comparisonSnapshot,alignment:'Steps align by recorded order.',sourceResolution:'Source resolution is separate from policy conclusions.',deltaMeaning:'Latest minus previous in original units; display rounded to six significant digits. Missing/non-numeric delta is null; see delta text for out-of-range arithmetic.',sections:comparisonTables.map(({caption,changes})=>({title:caption,fields:changes}))};
  const isMarkdown=button.id==='comparison-markdown',isZip=button.id==='comparison-zip',json=JSON.stringify(result,null,2)+'\n';let body=json;
  if(isMarkdown||isZip) {
    const literal=value=>String(value).replace(/[\\`*_{}[\]()#+.!<>|~-]/g,'\\$&').replace(/[\r\n]/g,' ');
    const value=entry=>entry.recorded?literal(JSON.stringify(entry.value)):'Not recorded';
    const lines=['# Alert Lab changes-only comparison','',`Snapshot fetched: ${result.fetchedAt}`,`Previous: ${result.previousId}`,`Latest: ${result.latestId}`,'',result.alignment+' '+result.sourceResolution+' Only changed fields are included.',result.deltaMeaning,''];
    for(const section of result.sections) {
      lines.push('## '+section.title,'');
      if(!section.fields.length) {lines.push('No differences.','');continue;}
      lines.push('| Field | Previous | Latest | Delta (latest − previous) |','| --- | --- | --- | --- |');
      for(const field of section.fields)lines.push(`| ${literal(field.field)} | ${value(field.previous)} | ${value(field.latest)} | ${literal(field.delta)} |`);
      lines.push('');
    }
    body=lines.join('\n');
  }
  const filename='alert-lab-comparison-'+result.previousId+'-'+result.latestId;
  if(isZip)saveArchive([['comparison.json',json],['comparison.md',body]],filename+'.zip');
  else save(new Blob([body],{type:isMarkdown?'text/markdown;charset=utf-8':'application/json;charset=utf-8'}),filename+(isMarkdown?'.md':'.json'));
}));
compare.addEventListener('click',()=>{
  if(exerciseRun||(busy&&!active?.quiet))return;
  return perform('Loading comparison…',async()=>{
    let after=0,ids=[];
    do {
      const data=await (await request('/episodes?cursor='+after)).json();
      if(!Array.isArray(data.items))throw new Error('Invalid episode listing.');
      for(const row of data.items) {
        if(!row||!/^[a-f0-9]{64}$/.test(row.id)||!Number.isSafeInteger(row.seq)||row.seq<=after)throw new Error('Invalid episode order.');
        after=row.seq;ids.push(row.id);ids=ids.slice(-2);
      }
      if(data.nextCursor===null)break;
      if(!data.items.length||Number(data.nextCursor)!==after)throw new Error('Invalid episode cursor.');
    } while(true);
    if(ids.length<2)throw new Error('Two recorded episodes are needed for comparison.');
    const details=[];
    for(const id of ids) {
      const data=await (await request('/episodes/'+id)).json();
      if(data.id!==id||!Array.isArray(data.decisions)||!['firing','resolved'].includes(data.source_status))throw new Error('Invalid episode detail.');
      details.push(data);
    }
    comparisonTable('Episode metadata',...details.map(data=>({'Started at':data.starts_at,'Source status':data.source_status,'Source resolution received at':data.completed_at===null?null:time(data.completed_at),'Recorded decisions':data.decisions.length})),ids);
    for(let i=0;i<Math.max(...details.map(data=>data.decisions.length));i++) {
      const fields=details.map(data=>{
        const row=data.decisions[i];if(!row)return {};
        return {'Recorded at':time(row.created_at),'Evidence collection errors':row.errors,...Object.fromEntries(Object.entries(row.evidence).map(([k,v])=>['Evidence · '+k,v])),...Object.fromEntries(Object.entries(row.decision).map(([k,v])=>['Decision · '+k,v]))};
      });
      comparisonTable('Recorded step '+(i+1),...fields,ids);
    }
    comparisonSnapshot={fetchedAt:time(Date.now()),previousId:ids[0],latestId:ids[1]};
    comparisonState.textContent='Snapshot fetched '+comparisonSnapshot.fetchedAt+' · two latest episodes by recording order, including manual spikes. Steps align by recorded order; Not recorded means a missing field or step, null remains unknown. Source resolution is separate from policy conclusions. Click Compare again to refresh.';
    status.textContent='Comparison ready. Recorded decisions are shown without rerunning policy or changing either episode.';
  });
});
function historyRow(id,label) {
  let row=historyRows.get(id);
  if(!row) {
    const item=document.createElement('li'),text=document.createElement('p'),buttons=document.createElement('p');buttons.className='controls';
    const review=document.createElement('button'),zip=document.createElement('button');
    review.textContent='Review '+id.slice(0,12);zip.textContent='Download ZIP '+id.slice(0,12);
    for(const [button,exportZip] of [[review,false],[zip,true]])button.addEventListener('click',()=>{
      if(exerciseRun||(busy&&!active?.quiet))return;
      follow=false;
      return perform('Loading past run…',async()=>{
        episode.value=id;await loadDetail();
        if(exportZip) {
          if(report===null)throw new Error('This episode has no recorded decisions to export.');
          downloadArchive();
        }
      });
    });
    buttons.append(review,zip);item.append(text,buttons);historyList.prepend(item);
    row={text,review,zip};historyRows.set(id,row);controls();
    historyState.textContent=historyRows.size+' episodes loaded. Source status is from the last read; review a run to refresh it.';
  }
  if(row.text.textContent!==label)row.text.textContent=label;
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
    historyRow(row.id,row.starts_at+' · source '+row.source_status+' · '+row.id.slice(0,12));
  }
  cursor=data.nextCursor;
  const selected=!follow&&[...episode.options].some(option=>option.value===previous)?previous:episode.options[episode.options.length-1]?.value;
  if(selected!==undefined&&episode.value!==selected) {
    clearReplay();episode.value=selected;controls();status.textContent='Loading the selected episode…';
  }
  if(!episode.options.length) {const option=document.createElement('option');option.value='';option.textContent='No episodes yet';episode.append(option);}
  if(!episode.value)status.textContent='No episodes yet. Start a spike and wait for Alertmanager.';
  return data.items;
}
refresh.addEventListener('click',()=>perform('Loading live evidence…',update));
more.addEventListener('click',()=>perform('Loading more episodes…',update));
episode.addEventListener('change',()=>{follow=false;perform('Loading selected episode…',loadDetail);});
token.addEventListener('input',()=>{cancelBackground();clearReplay();cursor=null;tail=0;follow=true;episode.replaceChildren();clearHistory();status.textContent='Token changed. Refresh episodes to unlock access.';controls();});
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
function paintExercise() {
  if(!observed) {progress.value=0;exerciseState.textContent='Select an episode to watch its two rechecks.';countdown.textContent='No recheck countdown.';return;}
  const last=observed.decisions.at(-1),completed=Math.min(2,last?.evidence.rechecks??0);
  progress.value=completed;
  const reachedReview=completed===2&&last?.decision.kind==='review';
  exerciseState.textContent=completed+'/2 rechecks recorded'+(reachedReview?' · human review recommended':last?' · latest recommendation: '+last.decision.kind:' · waiting for initial evidence')+(observed.source_status==='resolved'?' · source resolved'+(completed<2?' before both rechecks':''):'');
  if(observed.source_status==='resolved')countdown.textContent='Source resolved; no further recheck.';
  else if(observed.next_due===null)countdown.textContent='No recheck scheduled; awaiting a new source event.';
  else if(!auto.checked)countdown.textContent='Auto-refresh paused; countdown unavailable until updates resume.';
  else if(document.hidden||Date.now()-receivedAt>15000)countdown.textContent='Updates stale or hidden; waiting for fresh evidence.';
  else {
    const seconds=Math.max(0,Math.ceil((observed.next_due-Date.now())/1000));
    countdown.textContent=seconds?'Next recheck in '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'Recheck due; waiting for recorded evidence.';
  }
}
setInterval(paintExercise,1000);
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
  historyRow(id,label+(data.decisions.length?' · latest '+data.decisions.at(-1).decision.kind:' · no recorded decisions'));
  if(data.decisions.length)showReplay(parseSuite(JSON.stringify({schemaVersion:1,cases:[{id,steps:data.decisions.map(row=>({evidence:row.evidence,expectedKind:row.decision.kind}))}]})),data.source_status);
  else {suite=null;report=null;steps.replaceChildren();status.textContent='No decisions recorded yet. Waiting for evidence collection.';}
  observed=data;receivedAt=Date.now();paintExercise();
}
async function update() {
  const added=await loadEpisodes();
  if(exerciseRun&&!exerciseRun.id) {
    const candidates=added.filter(row=>row.seq>exerciseRun.baseline);
    if(candidates.length>1)throw new Error('Multiple new episodes; exercise identity is ambiguous.');
    if(candidates.length) {exerciseRun.id=candidates[0].id;follow=false;episode.value=exerciseRun.id;}
  }
  if(exerciseRun&&!exerciseRun.id) {clearReplay();status.textContent='Waiting for the fresh exercise episode…';}
  else await loadDetail();
  await advanceRun();
  live.textContent='Last updated '+time(Date.now())+(auto.checked?' · auto-refresh every 5 seconds':' · auto-refresh paused');
}
startRun.addEventListener('click',()=>perform('Checking for a fresh exercise…',async()=>{
  exerciseRun={id:null,baseline:0,deadline:Date.now()+20*60000,phase:'starting'};controls();
  runStatus.textContent='Checking that prior episodes are resolved…';
  tail=0;cursor=null;episode.replaceChildren();clearHistory();follow=true;
  do {
    const rows=await loadEpisodes();
    if(rows.some(row=>row.source_status!=='resolved'))throw new Error('Recover all firing episodes before starting a fresh exercise.');
  } while(cursor!==null);
  exerciseRun.baseline=tail;
  await request('/scenario/spike','POST');
  exerciseRun.phase='watching';auto.checked=true;
  runStatus.textContent='Spike started. Waiting for its new episode and two real five-minute rechecks.';
}));
cancelRun.addEventListener('click',()=>{
  if(!exerciseRun||(busy&&!active?.quiet))return;
  active?.abort.abort();active=null;busy=false;exerciseRun=null;
  runStatus.textContent='Cancellation requested. Recovery is not confirmed yet.';
  return perform('Cancelling and recovering…',async()=>{
    await request('/scenario/recovery','POST');
    runStatus.textContent='Cancelled. Recovery requested; source resolution will appear in the timeline. No automatic downloads.';
  });
});
async function advanceRun() {
  const running=exerciseRun;if(!running)return;
  if(Date.now()>running.deadline)throw new Error('Exercise exceeded twenty minutes.');
  if(!running.id)return;
  if(observed?.id!==running.id)throw new Error('Exercise episode changed.');
  if(running.phase==='recovering') {
    if(observed.source_status==='resolved') {
      exerciseRun=null;
      downloadArchive();
      runStatus.textContent='Exercise complete: both rechecks and human review recorded; source resolved. ZIP download requested with JSON and Markdown reports. Use the report buttons if your browser blocked it.';
    }
    return;
  }
  if(observed.source_status==='resolved')throw new Error('Source resolved before the exercise completed.');
  const recorded=observed.decisions;
  if(recorded.length===3&&recorded.every((row,i)=>row.evidence.rechecks===i&&row.decision.kind===(i===2?'review':'observe'))&&report?.totals.failed===0) {
    await request('/scenario/recovery','POST');
    running.phase='recovering';
    runStatus.textContent='Human review recorded. Recovery requested; waiting for source resolution before downloads.';
  } else if(recorded.at(-1)?.decision.kind!=='observe'&&recorded.length)throw new Error('Unexpected policy conclusion; automatic exercise stopped.');
}
run.addEventListener('click',()=>perform('Replaying recorded evidence…',loadDetail));
auto.addEventListener('change',()=>{if(!auto.checked) {cancelBackground();controls();}live.textContent=auto.checked?'Auto-refresh enabled.':'Auto-refresh paused.';paintExercise();});
setInterval(()=>{
  if(auto.checked&&!document.hidden&&token.value&&!busy)return perform('Refreshing live evidence…',update,true);
},5000);
function downloadArchive() {
  saveArchive([['replay.json',JSON.stringify(report,null,2)+'\n'],['replay.md',markdown(report)]],'alert-lab-'+episode.value+'-reports.zip');
}
function saveArchive(files,archiveName) {
  const encoder=new TextEncoder();
  const local=[],directory=[];let offset=0;
  for(const [name,text] of files) {
    const filename=encoder.encode(name),body=encoder.encode(text);
    if(offset+30+filename.length+body.length+46+filename.length+22>0xffffffff)throw new Error('Reports exceed ZIP format limits.');
    let crc=0xffffffff;
    for(const byte of body) {crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    crc=(crc^0xffffffff)>>>0;
    const header=new Uint8Array(30),h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,0x21,true);
    h.setUint32(14,crc,true);h.setUint32(18,body.length,true);h.setUint32(22,body.length,true);h.setUint16(26,filename.length,true);
    const central=new Uint8Array(46),c=new DataView(central.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,0x21,true);
    c.setUint32(16,crc,true);c.setUint32(20,body.length,true);c.setUint32(24,body.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);
    local.push(header,filename,body);directory.push(central,filename);offset+=header.length+filename.length+body.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,directory.reduce((size,part)=>size+part.length,0),true);e.setUint32(16,offset,true);
  save(new Blob([...local,...directory,end],{type:'application/zip'}),archiveName);
}
function save(blob,filename) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function download(kind) {
  if((busy&&!active?.quiet)||report===null)return;
  const isMarkdown=kind==='markdown',body=isMarkdown?markdown(report):JSON.stringify(kind==='evidence'?suite:report,null,2)+'\n';
  save(new Blob([body],{type:isMarkdown?'text/markdown;charset=utf-8':'application/json;charset=utf-8'}),'alert-lab-'+episode.value+'-'+(kind==='evidence'?'evidence':'replay')+(isMarkdown?'.md':'.json'));
}
downloads.forEach(button=>button.addEventListener('click',()=>download(button.id)));
status.textContent='Enter the sandbox token to start watching episodes.';controls();
