import {collect} from './prometheus.mjs';
export function startWorker({store,config,prometheusToken,log=()=>{},collectEvidence=collect,now=Date.now,interval=1000}) {
  let stopped=false,busy=false,nextCleanup=0,pending=Promise.resolve();
  async function tick() {
    if(stopped||busy)return;
    busy=true;
    try {
      if(now()>=nextCleanup){store.prune(now());nextCleanup=now()+3600000;}
      const episode=store.due(now());if(!episode)return;
      const collected=await collectEvidence(config.prometheus,prometheusToken,episode.rechecks,{now:now()});
      if(store.complete(episode,collected,now()))log({event:'decision_recorded',episode:episode.id});
    }catch{log({event:'worker_failed'});}finally{busy=false;}
  }
  const timer=setInterval(()=>{pending=tick();},interval);timer.unref();pending=tick();
  return {tick,async stop(){stopped=true;clearInterval(timer);await pending;while(busy)await new Promise(resolve=>setTimeout(resolve,10));}};
}
