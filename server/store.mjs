import Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {evaluate} from '../web/policy.js';

const labelsToKeep = ['alertname','service','namespace','severity'];
export function validateWebhook(body) {
  if (!body || body.version!=='4' || !Array.isArray(body.alerts) || body.alerts.length<1 || body.alerts.length>100 || !Number.isInteger(body.truncatedAlerts ?? 0) || (body.truncatedAlerts ?? 0)!==0) throw new Error('Expected a complete Alertmanager v4 batch of 1–100 alerts.');
  return body.alerts.map(alert => {
    if (!alert || !['firing','resolved'].includes(alert.status) || !/^[a-fA-F0-9]{16}$/.test(alert.fingerprint) || typeof alert.startsAt!=='string' || alert.startsAt.length>40 || !/^\d{4}-\d\d-\d\dT/.test(alert.startsAt) || !Number.isFinite(Date.parse(alert.startsAt)) || !alert.labels || typeof alert.labels!=='object' || Array.isArray(alert.labels) || !Object.entries(alert.labels).every(([k,v])=>k.length<=200&&typeof v==='string'&&v.length<=1000)) throw new Error('Invalid alert identity, status or labels.');
    const startsAt=new Date(alert.startsAt).toISOString();
    return {id:createHash('sha256').update(alert.fingerprint.toLowerCase()+'\n'+startsAt).digest('hex'),startsAt,status:alert.status,labels:alert.labels};
  });
}

export function openStore(path) {
  const db=new Database(path);
  db.pragma('journal_mode = WAL');db.pragma('synchronous = FULL');db.pragma('foreign_keys = ON');db.pragma('busy_timeout = 5000');
  if (db.pragma('user_version',{simple:true})>1) {db.close();throw new Error('Unsupported database version.');}
  db.exec(`CREATE TABLE IF NOT EXISTS episodes (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,starts_at TEXT NOT NULL,labels TEXT NOT NULL,source_status TEXT NOT NULL,generation INTEGER NOT NULL DEFAULT 1,rechecks INTEGER NOT NULL DEFAULT 0,next_due INTEGER,completed_at INTEGER);
    CREATE TABLE IF NOT EXISTS decisions (seq INTEGER PRIMARY KEY AUTOINCREMENT,episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,generation INTEGER NOT NULL,rechecks INTEGER NOT NULL,evidence TEXT NOT NULL,decision TEXT NOT NULL,errors TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(episode_id,generation,rechecks));
    CREATE INDEX IF NOT EXISTS due ON episodes(next_due);
    CREATE TABLE IF NOT EXISTS health (id INTEGER PRIMARY KEY CHECK(id=1),value INTEGER); INSERT OR IGNORE INTO health VALUES (1,0); PRAGMA user_version=1;`);
  const get=db.prepare('SELECT * FROM episodes WHERE id=?');
  return {
    db,
    ingest: db.transaction((alerts,selector,now) => {
      let accepted=0,duplicates=0,ignored=0;
      // Resolve first so an atomic mixed batch can free capacity before admission.
      for(const alert of [...alerts.filter(a=>a.status==='resolved'),...alerts.filter(a=>a.status==='firing')]) {
        if(!Object.entries(selector).every(([k,v])=>alert.labels[k]===v)){ignored++;continue;}
        const old=get.get(alert.id);
        if(old) {
          if(old.source_status==='resolved'||alert.status==='firing'){duplicates++;continue;}
          db.prepare("UPDATE episodes SET source_status='resolved',generation=generation+1,next_due=NULL,completed_at=? WHERE id=?").run(now,alert.id);
        } else {
          if(alert.status==='firing'&&db.prepare("SELECT count(*) AS count FROM episodes WHERE source_status='firing'").get().count>=1000) throw new Error('Episode capacity reached.');
          const labels=Object.fromEntries(labelsToKeep.filter(k=>alert.labels[k]!==undefined).map(k=>[k,alert.labels[k]]));
          db.prepare('INSERT INTO episodes (id,starts_at,labels,source_status,next_due,completed_at) VALUES (?,?,?,?,?,?)').run(alert.id,alert.startsAt,JSON.stringify(labels),alert.status,alert.status==='firing'?now:null,alert.status==='resolved'?now:null);
        }
        accepted++;
      }
      return {accepted,duplicates,ignored};
    }),
    due(now) {return db.prepare("SELECT * FROM episodes WHERE source_status='firing' AND next_due<=? ORDER BY next_due,seq LIMIT 1").get(now);},
    complete: db.transaction((episode,collected,now) => {
      const current=get.get(episode.id);
      if(!current || current.generation!==episode.generation || current.source_status!=='firing' || current.next_due===null) return false;
      const evidence={...collected.evidence,rechecks:episode.rechecks};
      const decision=evaluate(evidence);
      db.prepare('INSERT INTO decisions (episode_id,generation,rechecks,evidence,decision,errors,created_at) VALUES (?,?,?,?,?,?,?)').run(episode.id,episode.generation,episode.rechecks,JSON.stringify(evidence),JSON.stringify(decision),JSON.stringify(collected.errors),now);
      db.prepare('UPDATE episodes SET generation=generation+1,rechecks=?,next_due=? WHERE id=?').run(decision.kind==='observe'?episode.rechecks+1:episode.rechecks,decision.kind==='observe'?now+300000:null,episode.id);
      return true;
    }),
    list(cursor,limit) {return db.prepare('SELECT seq,id,starts_at,source_status,rechecks,next_due FROM episodes WHERE seq>? ORDER BY seq LIMIT ?').all(cursor,limit);},
    detail(id) {const row=get.get(id);if(!row)return null;return {...row,labels:JSON.parse(row.labels),decisions:db.prepare('SELECT evidence,decision,errors,created_at FROM decisions WHERE episode_id=? ORDER BY seq').all(id).map(r=>({...r,evidence:JSON.parse(r.evidence),decision:JSON.parse(r.decision),errors:JSON.parse(r.errors)}))};},
    prune(now) {db.prepare('DELETE FROM episodes WHERE completed_at IS NOT NULL AND completed_at<?').run(now-7*86400000);},
    healthy() {db.prepare('UPDATE health SET value=1-value WHERE id=1').run();return true;},
    close() {db.close();}
  };
}
