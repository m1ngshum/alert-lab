import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {validateWebhook} from './store.mjs';
import {validateSuite} from '../web/replay.js';

function body(req) {
  return new Promise((resolve,reject)=>{
    let size=0;const chunks=[];
    req.on('data',chunk=>{size+=chunk.length;if(size>1048576){reject(Object.assign(new Error(),{status:413}));return;}chunks.push(chunk);});
    req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(Object.assign(new Error(),{status:400}));}});
    req.on('error',()=>reject(Object.assign(new Error(),{status:400})));
  });
}
export function makeServer({store,config,token,log=()=>{}}) {
  const digest=value=>createHash('sha256').update(value).digest();
  const expected=digest(`Bearer ${token}`);
  const files={'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/app.js':'app.js','/policy.js':'policy.js','/replay.js':'replay.js','/replay-ui.js':'replay-ui.js','/examples.json':'examples.json'};
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    try {
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/healthz')return send(200,{status:'ok'});
      if(req.method==='GET'&&url.pathname==='/readyz') {try{store.healthy();return send(200,{status:'ready'});}catch{return send(503,{status:'unavailable'});}}
      if(req.method==='GET'&&files[url.pathname]) {
        const file=files[url.pathname];const ext=file.split('.').at(-1);
        const data=await readFile(new URL('../web/'+file,import.meta.url));
        res.writeHead(200,{'Content-Type':{html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json'}[ext]});return res.end(data);
      }
      if(!timingSafeEqual(digest(req.headers.authorization??''),expected))return send(401,{error:'Unauthorized'});
      if(req.method==='POST'&&url.pathname==='/v1/webhooks/alertmanager') {
        if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return send(415,{error:'Expected application/json'});
        let alerts;try{alerts=validateWebhook(await body(req));}catch(error){return send(error.status??400,{error:'Invalid or incomplete webhook batch'});}
        try {return send(202,{mode:'shadow',...store.ingest(alerts,config.selector,Date.now())});}
        catch {log({event:'storage_write_failed'});return send(503,{error:'Storage unavailable or episode capacity reached'});}
      }
      if(req.method==='GET'&&url.pathname==='/v1/episodes') {
        const cursor=url.searchParams.get('cursor')??'0',limit=url.searchParams.get('limit')??'50';
        if(!/^\d+$/.test(cursor)||!/^\d+$/.test(limit)||!Number.isSafeInteger(Number(cursor))||Number(limit)<1||Number(limit)>100)return send(400,{error:'Invalid pagination'});
        const items=store.list(Number(cursor),Number(limit));return send(200,{mode:'shadow',items,nextCursor:items.length===Number(limit)?String(items.at(-1).seq):null});
      }
      const match=url.pathname.match(/^\/v1\/episodes\/([a-f0-9]{64})(\/replay)?$/);
      if(req.method==='GET'&&match) {
        const episode=store.detail(match[1]);if(!episode)return send(404,{error:'Episode not found'});
        if(!match[2])return send(200,{mode:'shadow',...episode});
        if(!episode.decisions.length)return send(409,{error:'No decisions recorded yet'});
        const suite={schemaVersion:1,cases:[{id:episode.id,steps:episode.decisions.map(row=>({evidence:row.evidence,expectedKind:row.decision.kind}))}]};
        validateSuite(suite);return send(200,suite);
      }
      return send(404,{error:'Not found'});
    } catch {log({event:'request_failed'});if(!res.headersSent)send(503,{error:'Service unavailable'});else res.end();}
  });
  server.requestTimeout=10000;server.headersTimeout=15000;server.maxHeadersCount=100;
  return server;
}
