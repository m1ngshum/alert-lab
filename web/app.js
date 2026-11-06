import {presets, evaluate} from "./policy.js";
(() => {
  const $ = id => document.getElementById(id);
  let selected = presets[0];
  let rechecks = 0;
  let journal = [];
  let lastRun = null;
  let episode = 0;
  let episodeStart = '';
  const keys = ['rate','success','latency','cpu','memory','rejection','downstream','security','classifier','consistency','samples','logs','metrics','journeys'];
  const numberKeys = ['rate','success','latency','cpu','memory'];
  const checkKeys = ['logs','samples','metrics','journeys'];
  function read() { const e = {rechecks}; for (const key of keys) e[key] = checkKeys.includes(key) ? $(key).checked : numberKeys.includes(key) ? Number($(key).value) : $(key).value; return e; }
  function assign(e) { for (const key of keys) { if(checkKeys.includes(key)) $(key).checked = e[key]; else $(key).value = e[key]; } }
  function text(tag, content, className) { const node = document.createElement(tag); node.textContent = content; if(className) node.className = className; return node; }
  function renderFlow(result, completed) {
    const steps = [ ['Event','HTTP 400 spike'], ['Collect','Logs, metrics, user/client journeys'], ['Policy','Urgency, security, completeness'], ['Jev',result.classifierUsed ? 'Simulated typed recommendation' : 'Bypassed by policy'], ['Follow-up',result.kind === 'observe' ? 'Record + bounded recheck' : result.kind === 'resolved' ? 'Record resolution; loop closed' : result.kind === 'page' ? 'Page incident owner' : 'Human investigation'] ];
    $('flow').replaceChildren(...steps.map(([label,caption],i) => { const li = document.createElement('li'); li.className = i===3 && !result.classifierUsed ? 'skipped' : completed ? 'active' : ''; li.append(text('div',String(i+1).padStart(2,'0'),'step-number'),text('strong',label),text('span',caption)); return li; }));
    $('flow-detail').textContent = (completed ? 'Recorded route. ' : 'Preview route. ') + result.explanation;
  }
  function render() {
    const e = read(); const result = evaluate(e);
    for(const key of numberKeys) { $(key+'Out').textContent = key==='latency' ? `${e[key]} ms` : `${key==='success' ? e[key].toFixed(1) : e[key]}%`; $(key).setAttribute('aria-valuetext',$(key+'Out').textContent); }
    $('result-state').textContent = lastRun ? 'Recorded' : 'Preview';
    const card = document.createElement('div'); card.className = 'decision '+result.kind;
    card.append(text('div',result.kind==='page' ? 'Urgent follow-up' : result.kind==='observe' ? 'Bounded observation' : result.kind==='resolved' ? 'Observation resolved' : 'Human follow-up','decision-label'),text('h3',result.title),text('p',result.explanation));
    const list=document.createElement('ul'); list.className='reason-list'; result.reasons.forEach(reason=>list.append(text('li',reason))); card.append(list);
    const action=document.createElement('div'); action.className='next-action'; action.append(text('strong',result.owner),text('div',result.deadline)); if(result.kind==='review'||result.kind==='security') action.append(text('p','If unacknowledged: escalate to the on-call lead. No real deadline or notification is running.')); if(result.securityTask)action.append(text('p',result.securityTask)); card.append(action); $('result').replaceChildren(card);
    $('recheck').hidden = !lastRun || result.kind!=='observe';
    renderFlow(result,!!lastRun);
    return {e,result};
  }
  function load(preset) { selected=preset; rechecks=0; lastRun=null; episode++;episodeStart=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});assign(preset.data); for(const button of $('scenarios').children)button.setAttribute('aria-pressed',String(button.dataset.id===preset.id)); $('copy-status').textContent=''; render(); }
  function record(label) {
    const {e,result}=render(); lastRun={e:{...e},result};
    journal.unshift({e:{...e},result,label,episode,episodeStart,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}); journal=journal.slice(0,10);
    $('audit').replaceChildren(...journal.map(item => { const entry=document.createElement('article'); entry.className='audit-entry '+item.result.kind; const heading=document.createElement('div'); heading.className='audit-heading'; heading.append(text('span',`Episode ${item.episode} · ${item.label} · ${item.result.title}`),text('span',item.time)); entry.append(heading,text('p',`Started ${item.episodeStart} · 400: ${item.e.rate}% · journey success: ${item.e.success.toFixed(1)}% · CPU: ${item.e.cpu}% · memory: ${item.e.memory}% · rechecks: ${item.e.rechecks}`),text('p',item.result.reasons.join(' ')),text('p',`${item.result.owner} · ${item.result.deadline}`)); if(item.result.securityTask)entry.append(text('p',item.result.securityTask)); const snapshot=document.createElement('details');snapshot.append(text('summary','Evidence snapshot'),text('p',`Logs: ${item.e.logs}; adequate samples: ${item.e.samples}; metrics current: ${item.e.metrics}; journey signals current: ${item.e.journeys}; rejection: ${item.e.rejection}; dependencies: ${item.e.downstream}; security: ${item.e.security}; consistency: ${item.e.consistency}; classifier: ${item.e.classifier}.`));entry.append(snapshot);return entry; }));
    render();
  }
  presets.forEach(preset => { const button=document.createElement('button'); button.className='scenario'; button.dataset.id=preset.id; button.setAttribute('aria-pressed','false'); button.append(text('strong',preset.title),text('span',preset.subtitle)); button.addEventListener('click',()=>load(preset)); $('scenarios').append(button); });
  keys.forEach(key=>$(key).addEventListener('input',()=>{lastRun=null;for(const b of $('scenarios').children)b.setAttribute('aria-pressed','false');$('copy-status').textContent='';render();}));
  $('run').addEventListener('click',()=>record('Triage run'));
  $('reset').addEventListener('click',()=>load(selected));
  document.querySelectorAll('[data-recheck]').forEach(button=>button.addEventListener('click',()=>{
    const e=read(); rechecks++;
    if(button.dataset.recheck==='cleared') {e.rate=2;rechecks=0;}
    if(button.dataset.recheck==='worse') {e.success=95;e.latency=1700;}
    assign(e);record('Simulated recheck: '+button.dataset.recheck);
  }));
  $('copy').addEventListener('click',async()=>{const {e,result}=render();const summary=`DESIGN SIMULATION — synthetic evidence; no live integrations\nEpisode ${episode}; started ${episodeStart}; rechecks ${rechecks}\n${lastRun?'Recorded':'Preview'} decision: ${result.title}\n400 rate ${e.rate}%; user/client journey success ${e.success.toFixed(1)}%; p95 ${e.latency}ms; CPU ${e.cpu}%; memory ${e.memory}%\nEvidence: logs ${e.logs}; samples ${e.samples}; metrics ${e.metrics}; journeys ${e.journeys}; security ${e.security}; rejection ${e.rejection}; consistency ${e.consistency}\nReasons: ${result.reasons.join(' ')}\nOwner: ${result.owner}\nNext action: ${result.deadline}\nSecurity follow-up: ${result.securityTask||'No separate security follow-up triggered.'}\n${result.explanation}`;try{await navigator.clipboard.writeText(summary);$('copy-status').textContent='Copied. The summary includes the simulation label.';}catch{$('copy-status').textContent='Clipboard is unavailable here. Select the decision text to copy it.';}});
  document.addEventListener('alert-lab-export', () => document.dispatchEvent(new CustomEvent('alert-lab-evidence', {detail:read()})));
  load(selected);
})();
