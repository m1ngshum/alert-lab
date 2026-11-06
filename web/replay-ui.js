import {parseSuite, replay, markdown, maxBytes} from './replay.js';
const $ = id => document.getElementById(id);
let report;
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function run(text) {
  report = null;
  $('replay-results').replaceChildren();
  $('replay-json').disabled = $('replay-markdown').disabled = true;
  try {
    report = replay(parseSuite(text));
    $('replay-status').textContent = `${report.totals.steps} steps: ${report.totals.passed} passed, ${report.totals.failed} failed, ${report.totals.unasserted} unasserted.`;
    for (const item of report.cases) {
      const details = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = item.id;
      const pre = document.createElement('pre'); pre.textContent = JSON.stringify(item.steps,null,2);
      details.append(summary,pre); $('replay-results').append(details);
    }
    $('replay-json').disabled = $('replay-markdown').disabled = false;
  } catch (error) { $('replay-status').textContent = `Cannot replay: ${error.message}`; }
}
let importGeneration = 0;
$('replay-file').addEventListener('change', async event => {
  const generation = ++importGeneration;
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > maxBytes) { run(''); $('replay-status').textContent = 'Cannot replay: file exceeds 1 MiB.'; return; }
  try { const text = await file.text(); if (generation === importGeneration) run(text); }
  catch { if (generation === importGeneration) {run(''); $('replay-status').textContent = 'Cannot read replay file.';} }
});
$('replay-example').addEventListener('click', async () => {
  const generation = ++importGeneration;
  try { const response = await fetch('./examples.json'); if (!response.ok) throw new Error(); const text = await response.text(); if (generation === importGeneration) run(text); }
  catch { if (generation === importGeneration) {run(''); $('replay-status').textContent = 'Cannot load bundled examples.';} }
});
$('replay-export').addEventListener('click', () => document.dispatchEvent(new Event('alert-lab-export')));
document.addEventListener('alert-lab-evidence', event => download('alert-lab-evidence.json', JSON.stringify({schemaVersion:1,cases:[{id:'current-evidence',steps:[{evidence:event.detail}]}]},null,2),'application/json'));
$('replay-json').addEventListener('click', () => {if (report) download('alert-lab-report.json',JSON.stringify(report,null,2),'application/json');});
$('replay-markdown').addEventListener('click', () => {if (report) download('alert-lab-report.md',markdown(report),'text/markdown');});
