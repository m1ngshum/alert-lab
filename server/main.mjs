import {loadConfig} from './config.mjs';
import {openStore} from './store.mjs';
import {makeServer} from './http.mjs';
import {startWorker} from './worker.mjs';
const log=event=>console.log(JSON.stringify({...event,time:new Date().toISOString()}));
try {
  const settings=loadConfig();const store=openStore(settings.dbPath);
  const server=makeServer({...settings,store,log});
  const worker=startWorker({...settings,store,log});
  let stopping=false;
  async function stop(){if(stopping)return;stopping=true;const closed=new Promise(resolve=>server.close(resolve));server.closeIdleConnections();await worker.stop();await closed;store.close();}
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
  server.on('error',async()=>{log({event:'server_failed'});process.exitCode=1;await stop();});
  server.listen(settings.port,'0.0.0.0',()=>log({event:'listening',port:settings.port,mode:'shadow'}));
} catch {console.error(JSON.stringify({event:'startup_failed',message:'Check configuration, credential files and writable database storage.'}));process.exitCode=1;}
