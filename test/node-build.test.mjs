import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const pin=JSON.parse(readFileSync(new URL('../runtime/node-source.json',import.meta.url)));
test('source and backport pins match the toolchain and checked-in patch',()=>{
  const tools=JSON.parse(readFileSync(new URL('../tools.lock.json',import.meta.url)));
  assert.equal(pin.version,tools.node);
  assert.equal(pin.patchSha256,createHash('sha256').update(readFileSync(new URL('../patches/node-zlib.patch',import.meta.url))).digest('hex'));
});
test('SBOM includes both custom binaries and rejects incomplete backport evidence before writing',()=>{
  const directory=mkdtempSync(join(tmpdir(),'node-sbom-'));
  try {
    const sboms=['amd64','arm64'].map(a=>join(directory,'image-sbom-'+a+'.cdx.json'));
    const original=JSON.stringify({bomFormat:'CycloneDX',components:[]});
    sboms.forEach(f=>writeFileSync(f,original));
    const receipt={...pin,nodeVersion:'v'+pin.version+'-'+pin.tag,binarySha256:'a'.repeat(64),unpatchedControl:{EPIPE:'stale',EAGAIN:'stale'},patchedRegression:{EPIPE:'reset',EAGAIN:'reset'}};
    const files=['amd64','arm64'].map(a=>join(directory,'node-build-'+a+'.json'));
    files.forEach((f,i)=>writeFileSync(f,JSON.stringify({...receipt,binarySha256:(i?'b':'a').repeat(64)})));
    const run=(...architectures)=>spawnSync('python3',['scripts/node-sbom.py',directory,...architectures],{encoding:'utf8'});
    rmSync(files[1]);rmSync(sboms[1]);
    assert.equal(run('amd64').status,0);
    assert.deepEqual(JSON.parse(readFileSync(sboms[0])).components.map(c=>c['bom-ref']),['alert-lab:node:amd64']);
    writeFileSync(files[1],JSON.stringify({...receipt,binarySha256:'b'.repeat(64)}));
    sboms.forEach(f=>writeFileSync(f,original));
    assert.equal(run().status,0);
    const components=sboms.flatMap(f=>JSON.parse(readFileSync(f)).components);
    assert.deepEqual(components.map(c=>c['bom-ref']),['alert-lab:node:amd64','alert-lab:node:arm64']);
    assert.notEqual(components[0].hashes[0].content,components[1].hashes[0].content);
    assert.ok(components.every(c=>c.properties.some(p=>p.name==='alert-lab:node:patchCommit'&&p.value===pin.patchCommit)));
    for(const bad of [{...receipt,patchedRegression:{EPIPE:'reset',EAGAIN:'stale'}},{...receipt,patchCommit:'0'.repeat(40)}]){
      sboms.forEach(f=>writeFileSync(f,original));writeFileSync(files[1],JSON.stringify(bad));
      assert.notEqual(run().status,0);assert.ok(sboms.every(f=>readFileSync(f,'utf8')===original));
    }
  } finally {rmSync(directory,{recursive:true});}
});
