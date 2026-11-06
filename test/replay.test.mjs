import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseSuite,replay,markdown} from '../web/replay.js';
import {presets} from '../web/policy.js';
const example=readFileSync(new URL('../web/examples.json',import.meta.url),'utf8');
test('bundled ordered scenarios are deterministic and pass',()=>{
  const report=replay(parseSuite(example));assert.equal(report.totals.failed,0);assert.equal(report.totals.steps,8);assert.deepEqual(replay(parseSuite(example)),report);
  assert.equal(report.cases.at(-1).steps.at(-1).decision.kind,'review');
});
test('unasserted, mismatched and hostile case text',()=>{
  const suite={schemaVersion:1,cases:[{id:'<script>alert(1)</script>',steps:[{evidence:presets[0].data},{evidence:presets[0].data,expectedKind:'page'}]}]};
  const report=replay(suite);assert.deepEqual(report.totals,{steps:2,passed:0,failed:1,unasserted:1});assert.ok(!markdown(report).includes('<script>'));
});
test('reject malformed suites before evaluating',()=>{
  for(const text of ['null','{}','[]','{',JSON.stringify({schemaVersion:2,cases:[]}),JSON.stringify({schemaVersion:1,cases:[{id:'x',steps:[{evidence:{rechecks:0}}]},{id:'x',steps:[]}]}),' '.repeat(1048577)])assert.throws(()=>parseSuite(text));
  const step={evidence:{rechecks:0}};
  assert.throws(()=>replay({schemaVersion:1,cases:[{id:'x',steps:Array(1001).fill(step)}]}));
  assert.throws(()=>replay({schemaVersion:1,cases:[{id:'x',steps:[{evidence:{}}]}]}));
});
test('CLI formats and exit codes',()=>{
  const dir=mkdtempSync(join(tmpdir(),'alert-replay-'));
  const run=(...args)=>spawnSync(process.execPath,['bin/replay.mjs',...args],{encoding:'utf8',cwd:new URL('..',import.meta.url)});
  try {
    const file=join(dir,'input.json');writeFileSync(file,example);
    let r=run(file);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).totals.failed,0);
    r=run(file,'--format','markdown');assert.equal(r.status,0);assert.match(r.stdout,/Alert Lab replay/);
    const suite=parseSuite(example);suite.cases[0].steps[0].expectedKind='page';writeFileSync(file,JSON.stringify(suite));assert.equal(run(file).status,1);
    writeFileSync(file,'null');assert.equal(run(file).status,2);assert.equal(run(file,'--format','html').status,2);
    writeFileSync(file,' '.repeat(1048577));assert.equal(run(file).status,2);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
