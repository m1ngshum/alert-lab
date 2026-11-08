import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {crc32} from 'node:zlib';
import {parseSuite,replay,markdown} from '../web/replay.js';

// Exercise the shipped browser script with a small DOM and controlled network/timer.
class Element {
 constructor(){this.children=[];this.listeners={};this.textContent='';this.disabled=false;this.checked=true;this.selection='';}
 get options(){return this.children;}
 get value(){return this.selection||this.children[0]?.value||'';}
 set value(value){this.selection=value;}
 get selectedOptions(){return this.children.filter(option=>option.value===this.value);}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;this.selection='';}
 addEventListener(name,handler){this.listeners[name]=handler;}
 async fire(name){return this.listeners[name]?.();}
 remove(){}
}
function browser(extraMarkdown='') {
 const elements=Object.fromEntries(['token','episode','status','steps','auto','live','timeline','refresh','more','replay','evidence','json','markdown','exercise','exercise-state','countdown','auto-run','cancel-run','run-status'].map(id=>[id,new Element()]));
 const saved=[],blobs=[];
 class DownloadsURL extends URL {static createObjectURL(blob){blobs.push(blob);return URL.createObjectURL(blob);}}
 const scenarios=['spike','recovery'].map(name=>Object.assign(new Element(),{dataset:{scenario:name},textContent:name}));
 const document={hidden:false,querySelector:selector=>elements[selector.slice(1)],querySelectorAll:()=>scenarios,body:new Element(),createElement:tag=>{const el=new Element();if(tag==='a')el.click=()=>saved.push(el.download);return el;},createDocumentFragment:()=>new Element()};
 const fixture=JSON.parse(readFileSync(new URL('../web/examples.json',import.meta.url),'utf8')).cases.find(item=>item.id==='persistent-spike').steps;
 const id='a'.repeat(64),other='b'.repeat(64),start='2026-11-08T00:00:00.000Z';
 let count=1,resolved=false,error=0,hold=null,heldPath='',tick,paint,now=Date.parse(start);
 const calls=[];let rows=[{id,seq:1,starts_at:start,source_status:'firing',rechecks:1}];
 const fetch=async(path,options)=>{
  calls.push({path,options});if(hold&&(!heldPath||path===heldPath))await hold;
  let data;
  if(path.startsWith('/episodes?'))data={items:rows.filter(row=>row.seq>Number(new URLSearchParams(path.split('?')[1]).get('cursor'))).map(row=>({...row,source_status:resolved?'resolved':'firing'})),nextCursor:null};
  else if(path.startsWith('/scenario/'))data={};
  else data={id:path.split('/').at(-1),starts_at:start,source_status:resolved?'resolved':'firing',next_due:count<3?Date.parse(start)+count*300000:null,completed_at:resolved?Date.parse(start)+610000:null,decisions:fixture.slice(0,count).map((step,i)=>({evidence:step.evidence,decision:{kind:step.expectedKind},created_at:Date.parse(start)+i*300000}))};
  return {ok:!error,status:error||200,json:async()=>data};
 };
 runInNewContext(readFileSync(new URL('../examples/dogfood/ui.js',import.meta.url),'utf8').replace(/^import .*\n/,''),{document,fetch,parseSuite,replay,markdown:report=>markdown(report)+extraMarkdown,AbortSignal,AbortController,setInterval:(fn,ms)=>{if(ms===5000)tick=fn;else paint=fn;},Date:class extends Date {static now(){return now;}},URL:DownloadsURL,Blob,TextEncoder,setTimeout});
 return {elements,document,scenarios,calls,saved,blobs,tick:()=>tick(),paint:()=>paint(),advance:ms=>{now+=ms;},setCount:n=>{count=n;},resolve:()=>{resolved=true;},firing:()=>{resolved=false;},fail:n=>{error=n;},hold:(p,path='')=>{hold=p;heldPath=path;},add:()=>{rows.push({...rows[0],id:other,seq:2});},id,other};
}
test('live UI polls persisted decisions, follows new episodes, preserves selection and separates resolution',async()=>{
 const b=browser(),e=b.elements;
 await b.tick();assert.equal(b.calls.length,0);
 e.token.value='sandbox-only';await e.token.fire('input');await b.tick();
 assert.equal(e.episode.value,b.id);assert.equal(e.timeline.children.length,3);assert.match(e.timeline.children[2].textContent,/next evidence collection due/);assert.equal(e.json.disabled,false);
 b.setCount(2);await b.tick();assert.match(e.status.textContent,/2 steps/);assert.match(e.timeline.children[2].textContent,/recheck 1/);
 b.setCount(3);await b.tick();assert.match(e.status.textContent,/3 steps · 3 passed/);assert.match(e.timeline.children[3].textContent,/recheck 2 · review/);assert.match(e.timeline.children[4].textContent,/No recheck scheduled/);
 b.resolve();await b.tick();assert.match(e.timeline.children[4].textContent,/source resolution received; policy conclusion is unchanged/);assert.match(e.status.textContent,/3 passed/);
 b.add();await b.tick();assert.equal(e.episode.value,b.other);
 e.episode.value=b.id;await e.episode.fire('change');await b.tick();assert.equal(e.episode.value,b.id);
 assert.ok(b.calls.every(call=>call.options.headers.Authorization==='Bearer sandbox-only'&&call.options.redirect==='error'));
 e.token.value='';await e.token.fire('input');assert.equal(e.timeline.children.length,0);assert.equal(e.json.disabled,true);
});
test('auto-refresh pauses when hidden or unchecked, serializes requests and fails closed',async()=>{
 const b=browser(),e=b.elements;e.token.value='sandbox-only';
 b.document.hidden=true;await b.tick();assert.equal(b.calls.length,0);b.document.hidden=false;
 e.auto.checked=false;await b.tick();assert.equal(b.calls.length,0);e.auto.checked=true;
 let release;b.hold(new Promise(resolve=>{release=resolve;}));const pending=b.tick();await b.tick();assert.equal(b.calls.length,1);release();b.hold(null);await pending;
 b.fail(401);await b.tick();assert.equal(e.auto.checked,false);assert.equal(e.json.disabled,true);assert.equal(e.timeline.children.length,0);assert.match(e.status.textContent,/Unauthorized/);
 const count=b.calls.length;await b.tick();assert.equal(b.calls.length,count);
});

test('typing or selecting during a delayed poll cancels stale results without locking controls',async()=>{
 const b=browser(),e=b.elements;e.token.value='original';await b.tick();b.add();
 let release;b.hold(new Promise(resolve=>{release=resolve;}));const old=b.tick();
 assert.equal(e.token.disabled,false);assert.equal(e.episode.disabled,false);assert.equal(e.replay.disabled,false);
 e.token.value='replacement';await e.token.fire('input');assert.equal(e.episode.options.length,0);release();b.hold(null);await old;
 assert.equal(e.episode.options.length,0);assert.equal(e.json.disabled,true);assert.equal(e.auto.checked,true);
 await b.tick();assert.equal(e.episode.value,b.other);
 b.hold(new Promise(resolve=>{release=resolve;}));const poll=b.tick();
 e.episode.value=b.id;const selection=e.episode.fire('change');release();b.hold(null);await Promise.all([poll,selection]);
 assert.equal(e.episode.value,b.id);assert.match(e.status.textContent,/1 steps/);assert.equal(e.auto.checked,true);
});

test('following a new episode clears the old report before its delayed detail arrives',async()=>{
 const b=browser(),e=b.elements;e.token.value='sandbox-only';await b.tick();assert.equal(e.json.disabled,false);
 b.add();let release;b.hold(new Promise(resolve=>{release=resolve;}),'/episodes/'+b.other);const poll=b.tick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(e.episode.value,b.other);assert.equal(e.timeline.children.length,0);assert.equal(e.steps.children.length,0);
 assert.equal(e.evidence.disabled,true);assert.equal(e.json.disabled,true);assert.equal(e.markdown.disabled,true);
 release();b.hold(null);await poll;assert.equal(e.json.disabled,false);assert.match(e.status.textContent,/1 passed/);
});

test('countdown uses the due time and progress requires recorded decisions, including pause/stale/overdue/resolution',async()=>{
 const b=browser(),e=b.elements;e.token.value='sandbox-only';await b.tick();
 assert.match(e.countdown.textContent,/5:00/);assert.match(e['exercise-state'].textContent,/0\/2/);
 b.advance(1000);b.paint();assert.match(e.countdown.textContent,/4:59/);
 e.auto.checked=false;await e.auto.fire('change');assert.match(e.countdown.textContent,/paused/);
 e.auto.checked=true;await e.auto.fire('change');
 b.advance(15000);b.paint();assert.match(e.countdown.textContent,/stale/);
 b.advance(284000);await b.tick();assert.match(e.countdown.textContent,/due; waiting/);assert.match(e['exercise-state'].textContent,/0\/2/);
 b.setCount(2);await b.tick();assert.equal(e.exercise.value,1);assert.match(e.countdown.textContent,/5:00/);
 b.advance(300000);await b.tick();assert.equal(e.exercise.value,1);assert.match(e.countdown.textContent,/due; waiting/);
 b.setCount(3);await b.tick();assert.equal(e.exercise.value,2);assert.match(e['exercise-state'].textContent,/human review recommended/);assert.match(e.countdown.textContent,/No recheck scheduled/);
 b.resolve();await b.tick();assert.equal(e.exercise.value,2);assert.match(e.countdown.textContent,/Source resolved/);
 e.token.value='';await e.token.fire('input');assert.match(e.countdown.textContent,/No recheck countdown/);
});
test('early resolution retains partial exercise progress',async()=>{
 const b=browser(),e=b.elements;e.token.value='sandbox-only';b.resolve();await b.tick();
 assert.match(e['exercise-state'].textContent,/0\/2.*source resolved before both rechecks/);assert.match(e.countdown.textContent,/no further recheck/);
});

test('one-click run pins a fresh episode, waits for recorded review, recovers and downloads exactly once',async()=>{
 const b=browser(),e=b.elements;e.token.value='sandbox-only';b.resolve();await e['auto-run'].fire('click');
 assert.equal(b.calls.filter(call=>call.path==='/scenario/spike').length,1);assert.equal(e.token.disabled,true);assert.equal(e.auto.disabled,true);
 b.firing();b.add();await b.tick();assert.equal(e.episode.value,b.other);assert.equal(b.saved.length,0);
 b.advance(300000);b.setCount(2);await b.tick();assert.equal(b.calls.filter(call=>call.path==='/scenario/recovery').length,0);
 b.advance(300000);b.setCount(3);await b.tick();assert.equal(b.calls.filter(call=>call.path==='/scenario/recovery').length,1);assert.equal(b.saved.length,0);
 b.resolve();await b.tick();assert.deepEqual(b.saved,['alert-lab-'+b.other+'-reports.zip']);
 const zip=Buffer.from(await b.blobs[0].arrayBuffer()),entries={};let offset=0;
 while(zip.readUInt32LE(offset)===0x04034b50){const size=zip.readUInt32LE(offset+18),length=zip.readUInt16LE(offset+26),name=zip.subarray(offset+30,offset+30+length).toString(),body=zip.subarray(offset+30+length,offset+30+length+size);assert.equal(zip.readUInt32LE(offset+14),crc32(body));entries[name]=body.toString();offset+=30+length+size;}
 assert.deepEqual(Object.keys(entries),['replay.json','replay.md']);const exported=JSON.parse(entries['replay.json']);assert.equal(exported.cases[0].id,b.other);assert.equal(exported.totals.passed,3);assert.equal(entries['replay.md'],markdown(exported));assert.equal(zip.readUInt32LE(offset),0x02014b50);assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);assert.equal(zip.readUInt32LE(zip.length-6),offset);
 await b.tick();assert.equal(b.saved.length,1);assert.equal(e.token.disabled,false);assert.match(e['run-status'].textContent,/Exercise complete/);
});
test('one-click refuses an existing spike; cancel recovers without downloads',async()=>{
 const b=browser(),e=b.elements;e.token.value='sandbox-only';await e['auto-run'].fire('click');
 assert.equal(b.calls.some(call=>call.path==='/scenario/spike'),false);assert.match(e.status.textContent,/Recover all firing/);
 b.resolve();await e['auto-run'].fire('click');b.firing();b.add();await b.tick();await e['cancel-run'].fire('click');
 assert.equal(b.calls.filter(call=>call.path==='/scenario/recovery').length,1);assert.equal(b.saved.length,0);assert.match(e['run-status'].textContent,/Cancelled/);
 b.setCount(3);await b.tick();assert.equal(b.saved.length,0);
});

test('exercise timeout or network failure stops without exporting or claiming recovery',async()=>{
 for(const failure of ['timeout','network']) {
  const b=browser(),e=b.elements;e.token.value='sandbox-only';b.resolve();await e['auto-run'].fire('click');
  b.firing();b.add();await b.tick();
  if(failure==='timeout')b.advance(20*60000+1);else b.fail(503);
  await b.tick();assert.equal(b.saved.length,0);assert.equal(e.token.disabled,false);assert.equal(e.auto.checked,false);
  assert.match(e['run-status'].textContent,/Recovery is not confirmed/);assert.equal(b.calls.some(call=>call.path==='/scenario/recovery'),false);
 }
});
test('cancel does not abort a foreground spike POST; a later cancelled poll cannot recover or export twice',async()=>{
 const b=browser(),e=b.elements;e.token.value='sandbox-only';b.resolve();let release;
 b.hold(new Promise(resolve=>{release=resolve;}),'/scenario/spike');const starting=e['auto-run'].fire('click');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(e['cancel-run'].disabled,true);await e['cancel-run'].fire('click');assert.equal(b.calls.some(call=>call.path==='/scenario/recovery'),false);
 release();b.hold(null);await starting;b.firing();b.add();await b.tick();b.setCount(3);
 b.hold(new Promise(resolve=>{release=resolve;}),'/episodes/'+b.other);const poll=b.tick();await new Promise(resolve=>setImmediate(resolve));
 const cancel=e['cancel-run'].fire('click');release();b.hold(null);await Promise.all([poll,cancel]);
 assert.equal(b.calls.filter(call=>call.path==='/scenario/recovery').length,1);assert.equal(b.saved.length,0);assert.match(e['run-status'].textContent,/Cancelled/);
});

test('waiting for a fresh episode never displays an older completed exercise',async()=>{
 const b=browser(),e=b.elements;e.token.value='sandbox-only';b.resolve();b.setCount(3);await b.tick();
 await e['auto-run'].fire('click');await b.tick();assert.equal(e.timeline.children.length,0);assert.equal(e.json.disabled,true);assert.match(e.status.textContent,/Waiting for the fresh/);
});

test('automatic ZIP preserves Unicode Markdown bytes and CRC',async()=>{
 const b=browser('\n雪 🧪'),e=b.elements;e.token.value='sandbox-only';b.resolve();await e['auto-run'].fire('click');b.firing();b.add();b.setCount(3);await b.tick();b.resolve();await b.tick();
 const zip=Buffer.from(await b.blobs[0].arrayBuffer());let offset=0;const bodies=[];
 while(zip.readUInt32LE(offset)===0x04034b50){const size=zip.readUInt32LE(offset+18),length=zip.readUInt16LE(offset+26),body=zip.subarray(offset+30+length,offset+30+length+size);assert.equal(zip.readUInt32LE(offset+14),crc32(body));bodies.push(body);offset+=30+length+size;}
 assert.match(bodies[1].toString(),/雪 🧪$/);assert.equal(zip.readUInt16LE(zip.length-12),2);
});
