import {readFileSync} from 'node:fs';

export const fields = ['rate','success','latency','cpu','memory','rejection','downstream','security','consistency','samples','logs','metrics','journeys'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateConfig(config) {
  if (!object(config) || !object(config.selector) || !Object.keys(config.selector).length || !Object.entries(config.selector).every(([k,v]) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) && typeof v === 'string' && v.length <= 200)) throw new Error('A nonempty exact-match label selector is required.');
  if (!object(config.prometheus) || !object(config.prometheus.queries)) throw new Error('Prometheus URL and query mappings are required.');
  const url = new URL(config.prometheus.url);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Prometheus URL must be HTTP(S), without credentials, query or fragment.');
  for (const [field,mapping] of Object.entries(config.prometheus.queries)) {
    if (!fields.includes(field) || !object(mapping) || ![mapping.query,mapping.freshnessQuery].every(q => typeof q === 'string' && q.trim() && q.length <= 8000) || !Number.isFinite(mapping.maxAgeSeconds) || mapping.maxAgeSeconds < 1 || mapping.maxAgeSeconds > 3600) throw new Error('Each evidence mapping needs a known field, query, freshnessQuery and maxAgeSeconds (1–3600).');
    if (mapping.values !== undefined && (!object(mapping.values) || !Object.values(mapping.values).every(v => ['string','boolean'].includes(typeof v)))) throw new Error('Mapped values must be strings or booleans.');
  }
  return config;
}
export function loadConfig(env = process.env) {
  if (!env.CONFIG_PATH || !env.SERVICE_TOKEN_FILE) throw new Error('CONFIG_PATH and SERVICE_TOKEN_FILE are required.');
  const config = validateConfig(JSON.parse(readFileSync(env.CONFIG_PATH,'utf8')));
  const token = readFileSync(env.SERVICE_TOKEN_FILE,'utf8').trim();
  if (token.length < 32 || token.length > 512 || /\s/.test(token)) throw new Error('Service token must contain 32–512 non-whitespace characters.');
  const prometheusToken = env.PROMETHEUS_TOKEN_FILE ? readFileSync(env.PROMETHEUS_TOKEN_FILE,'utf8').trim() : null;
  const port = Number(env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  return {config,token,prometheusToken,port,dbPath:env.DB_PATH ?? '/data/alert-lab.db'};
}
