const booleans = new Set(['samples','logs','metrics','journeys']);
const enums = {rejection:['expected','unexpected','unknown'],downstream:['healthy','strained','outage','unknown'],security:['none','suspicious','confirmed','unknown'],consistency:['consistent','conflicting']};
export async function collect(config, token, rechecks, {fetchImpl=fetch, now=Date.now()} = {}) {
  const evidence = {rechecks, classifier:'normal', rejection:'unknown', downstream:'unknown',security:'unknown',consistency:'conflicting',samples:false,logs:false,metrics:false,journeys:false};
  const errors = [];
  const budget = AbortSignal.timeout(30000);
  async function query(expression) {
    const url = new URL(config.url.endsWith('/') ? config.url : config.url+'/');
    url.pathname = url.pathname.replace(/\/$/,'') + '/api/v1/query';
    url.searchParams.set('query',expression); url.searchParams.set('time',String(now/1000));url.searchParams.set('timeout','5s');
    const response = await fetchImpl(url,{headers:token?{Authorization:`Bearer ${token}`}:{},redirect:'error',signal:AbortSignal.any([budget,AbortSignal.timeout(6000)])});
    if (!response.ok) throw new Error('query failed');
    if (Number(response.headers.get('content-length') ?? 0) > 65536) throw new Error('response too large');
    const reader=response.body.getReader();let size=0;const chunks=[];
    try { for (;;) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw new Error('response too large');chunks.push(value);} }
    finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (body.status !== 'success' || body.warnings?.length || body.infos?.length) throw new Error('query incomplete');
    const result=body.data?.result;
    const sample=body.data?.resultType==='scalar' ? result : body.data?.resultType==='vector' && result?.length===1 ? result[0].value : null;
    if (!Array.isArray(sample) || sample.length!==2 || typeof sample[0]!=='number' || typeof sample[1]!=='string' || !sample[1].trim() || !Number.isFinite(sample[0]) || !Number.isFinite(Number(sample[1])) || Math.abs(now/1000-sample[0])>30) throw new Error('invalid query result');
    return Number(sample[1]);
  }
  // Sequential bounded requests avoid a webhook turning into unbounded fan-out.
  for (const [field,mapping] of Object.entries(config.queries)) {
    try {
      const age=await query(mapping.freshnessQuery);
      if (age<0 || age>mapping.maxAgeSeconds) throw new Error('stale evidence');
      const value=await query(mapping.query);
      let decoded=mapping.values ? mapping.values[String(value)] : value;
      if (booleans.has(field)) {if(![0,1,true,false].includes(decoded))throw new Error('invalid boolean');decoded=decoded===1||decoded===true;}
      if (enums[field] && !enums[field].includes(decoded)) throw new Error('invalid category');
      if (decoded===undefined) throw new Error('unmapped value');
      evidence[field]=decoded;
    } catch {errors.push(field);}
  }
  return {evidence,errors};
}
