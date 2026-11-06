#!/usr/bin/env python3
"""Check the final image's native libraries and TLS under its hardened settings."""
import json, subprocess, sys, tempfile
from pathlib import Path

with tempfile.TemporaryDirectory(prefix='alert-lab-tls-') as directory:
    directory=Path(directory);key=directory/'key.pem';cert=directory/'cert.pem'
    subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1',
                    '-keyout',str(key),'-out',str(cert),'-subj','/CN=localhost',
                    '-addext','subjectAltName=DNS:localhost'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    pin=json.loads((Path(__file__).resolve().parents[1]/'runtime/node-source.json').read_text())
    source='const expected='+json.dumps(pin)+';\nconst fixture='+json.dumps({'key':key.read_text(),'cert':cert.read_text()})+';\n'+r'''
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createServer,connect,rootCertificates} from 'node:tls';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
assert.equal(process.getuid(),1000);
const receipt=JSON.parse(readFileSync('/usr/share/doc/node/build.json','utf8'));
for(const [key,value] of Object.entries(expected))assert.equal(receipt[key],value);
assert.equal(process.version,'v'+expected.version+'-'+expected.tag);
assert.equal(receipt.nodeVersion,process.version);
assert.equal(receipt.binarySha256,createHash('sha256').update(readFileSync(process.execPath)).digest('hex'));
assert.deepEqual(receipt.unpatchedControl,{EPIPE:'stale',EAGAIN:'stale'});
assert.deepEqual(receipt.patchedRegression,{EPIPE:'reset',EAGAIN:'reset'});
assert.ok(rootCertificates.length>100);
assert.ok(readFileSync('/etc/ssl/certs/ca-certificates.crt','utf8').includes('BEGIN CERTIFICATE'));
for(const packageName of ['libatomic1','libgcc-s1','libstdc++6']) {
  assert.ok(readFileSync('/var/lib/dpkg/status.d/'+packageName,'utf8').includes('Status: install ok installed'));
  assert.ok(existsSync('/usr/share/doc/'+packageName+'/copyright'));
}
assert.ok(!readdirSync('/var/lib/dpkg/status.d').some(n=>n.startsWith('zlib')));
for(const directory of ['/usr/lib','/lib']) {
  assert.ok(!readdirSync(directory,{recursive:true}).some(n=>/(^|\/)libz\.so/.test(n)));
}
const D=require('better-sqlite3');let db=new D('/tmp/check.db');
db.exec('CREATE TABLE check_data (value TEXT); INSERT INTO check_data VALUES (\'durable\')');
await db.backup('/tmp/backup.db');db.close();db=new D('/tmp/backup.db',{readonly:true});
assert.equal(db.prepare('SELECT value FROM check_data').get().value,'durable');db.close();
assert.equal(gunzipSync(gzipSync('alert-lab')).toString(),'alert-lab');
const server=createServer(fixture,socket=>socket.end());
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
  const options={host:'127.0.0.1',port:server.address().port,servername:'localhost'};
  await assert.rejects(()=>new Promise((resolve,reject)=>{
    const socket=connect(options,()=>{socket.end();resolve();});socket.on('error',reject);
  }),{code:'DEPTH_ZERO_SELF_SIGNED_CERT'});
  await new Promise((resolve,reject)=>{
    const socket=connect({...options,ca:fixture.cert},()=>{assert.equal(socket.authorized,true);socket.end();resolve();});socket.on('error',reject);
  });
} finally {await new Promise(resolve=>server.close(resolve));}
console.log('PASS: patched Node receipt/binary identity, UID 1000, library inventory, no OS zlib, SQLite backup, gzip, trusted TLS and untrusted certificate rejection.');
'''
    subprocess.run(['docker','run','--rm','-i','--network','none','--read-only',
                    '--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp',
                    '--entrypoint','/usr/local/bin/node',sys.argv[1], '--input-type=module'],input=source,text=True,check=True)
