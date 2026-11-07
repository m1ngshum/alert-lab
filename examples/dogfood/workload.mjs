import {createServer} from 'node:http';
import {readFileSync,realpathSync} from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export function authorized(header, token) {
  const a=Buffer.from(header??''),b=Buffer.from('Bearer '+token);
  return a.length===b.length&&timingSafeEqual(a,b);
}
export function evidence(samples,cpu,memory,unrecognized) {
  const valid=samples.filter(s=>!s.invalid),bad=samples.filter(s=>s.invalid);
  const latency=valid.map(s=>s.ms).sort((a,b)=>a-b);
  const complete=valid.length>=10&&bad.length>=3;
  return {rate:samples.length?100*samples.filter(s=>s.status===400).length/samples.length:0,
    success:valid.length?100*valid.filter(s=>s.status===200).length/valid.length:0,
    latency:latency[Math.max(0,Math.ceil(latency.length*.95)-1)]??0,
    cpu,memory,rejection:bad.every(s=>s.status===400)?1:0,downstream:valid.every(s=>s.status===200)?1:0,
    security:unrecognized?0:1,consistency:1,samples:complete?1:0,logs:complete?1:0,metrics:1,journeys:valid.length>=10?1:0};
}
export function createLab(token, upstream='http://alert-lab:8080') {
  let scenario='baseline',samples=[],unrecognized=false,cpu=0,previous=process.cpuUsage(),last=performance.now();
  const server=createServer(async(req,res)=>{
    let url;try{url=new URL(req.url,'http://lab');}catch{res.writeHead(400);res.end();return;}
    const send=(status,value,type='application/json')=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; frame-ancestors 'none'; object-src 'none'"});res.end(type==='application/json'?JSON.stringify(value):value);};
    if(req.method==='GET'&&url.pathname==='/healthz')return send(200,{status:'ok'});
    if(req.method==='GET'&&url.pathname==='/')return send(200,'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Alert Lab dogfood</title><h1>Alert Lab dogfood</h1><p>Synthetic traffic only. Real five-minute rechecks; keep a spike for ten minutes to see bounded human review.</p><label>Sandbox token <input id="token" type="password" autocomplete="off"></label><p><button data-scenario="baseline">Baseline</button> <button data-scenario="spike">Spike</button> <button data-scenario="recovery">Recovery</button> <button id="refresh">Refresh episodes</button></p><pre id="result" aria-live="polite"></pre><script src="/app.js"></script></html>','text/html');
    if(req.method==='GET'&&url.pathname==='/app.js')return send(200,`const result=document.querySelector('#result');async function call(path,method='GET'){try{const r=await fetch(path,{method,headers:{Authorization:'Bearer '+document.querySelector('#token').value}});result.textContent=JSON.stringify(await r.json(),null,2)}catch(e){result.textContent=String(e)}}document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>call('/scenario/'+b.dataset.scenario,'POST')));document.querySelector('#refresh').addEventListener('click',()=>call('/episodes'));`,'text/javascript');
    if(req.method==='GET'&&url.pathname==='/metrics') {
      const used=process.cpuUsage(previous),now=performance.now();cpu=Math.min(100,100*(used.user+used.system)/((now-last)*1000));previous=process.cpuUsage();last=now;
      const e=evidence(samples,cpu,Math.min(100,100*process.memoryUsage().rss/(256*1024*1024)),unrecognized);
      return send(200,Object.entries(e).map(([k,v])=>`# TYPE alert_lab_${k} gauge\nalert_lab_${k} ${v}`).join('\n')+'\n','text/plain; version=0.0.4');
    }
    if(!authorized(req.headers.authorization,token)){if(url.pathname==='/sample')unrecognized=true;return send(401,{error:'Unauthorized'});}
    if(req.method==='GET'&&url.pathname==='/sample')return send(url.searchParams.get('invalid')==='1'?400:200,{synthetic:true});
    if(req.method==='POST'&&url.pathname.startsWith('/scenario/')) {
      const name=url.pathname.slice('/scenario/'.length);if(!['baseline','spike','recovery'].includes(name))return send(400,{error:'Unknown scenario'});
      scenario=name;samples=[];unrecognized=false;return send(200,{scenario,synthetic:true});
    }
    if(req.method==='GET'&&(url.pathname==='/episodes'||/^\/episodes\/[a-f0-9]+(?:\/replay)?$/.test(url.pathname))) {
      try {const response=await fetch(upstream+'/v1'+url.pathname,{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(5000)});return send(response.status,await response.json());}
      catch{return send(502,{error:'Alert Lab unavailable'});}
    }
    return send(404,{error:'Not found'});
  });
  server.requestTimeout=5000;server.headersTimeout=5000;server.maxHeadersCount=30;
  let timer,busy=false;
  server.on('listening',()=>{timer=setInterval(async()=>{
    if(busy)return;busy=true;
    try {for(let i=0;i<10;i++) {
      const invalid=scenario==='spike'&&i%2===0,start=performance.now();let status=0;
      try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/sample?invalid='+(invalid?1:0),{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(1000)});status=r.status;await r.arrayBuffer();}catch{}
      samples.push({invalid,status,ms:performance.now()-start});if(samples.length>1000)samples.shift();
    }}finally{busy=false;}
  },1000);});
  server.on('close',()=>clearInterval(timer));
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href){
  const token=readFileSync(process.env.SERVICE_TOKEN_FILE,'utf8').trim();if(token.length<32)throw new Error('Sandbox token required');
  createLab(token).listen(8081,'0.0.0.0');
}
