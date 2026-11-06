import {evaluate, policyVersion} from './policy.js';

export const maxBytes = 1024 * 1024;
const kinds = new Set(['observe','review','security','page','resolved']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseSuite(text) {
  if (new TextEncoder().encode(text).length > maxBytes) throw new Error('Replay file exceeds 1 MiB.');
  const suite = JSON.parse(text);
  validateSuite(suite);
  return suite;
}

export function validateSuite(suite) {
  if (!object(suite) || suite.schemaVersion !== 1 || !Array.isArray(suite.cases) || !suite.cases.length) throw new Error('Expected schemaVersion 1 and a nonempty cases array.');
  const ids = new Set();
  let steps = 0;
  for (const item of suite.cases) {
    if (!object(item) || typeof item.id !== 'string' || !item.id.trim() || item.id.length > 200 || ids.has(item.id)) throw new Error('Case IDs must be unique nonempty strings, at most 200 characters.');
    ids.add(item.id);
    if (!Array.isArray(item.steps) || !item.steps.length) throw new Error(`Case ${item.id} needs steps.`);
    for (const step of item.steps) {
      if (++steps > 1000) throw new Error('Replay exceeds 1,000 steps.');
      if (!object(step) || !object(step.evidence) || !Number.isInteger(step.evidence.rechecks) || step.evidence.rechecks < 0) throw new Error('Every step needs an evidence object with an explicit nonnegative integer rechecks.');
      if (step.expectedKind !== undefined && !kinds.has(step.expectedKind)) throw new Error('Invalid expectedKind.');
    }
  }
}

export function replay(suite) {
  validateSuite(suite);
  const totals = {steps:0, passed:0, failed:0, unasserted:0};
  const cases = suite.cases.map(item => ({id:item.id, steps:item.steps.map(step => {
    const evidence = structuredClone(step.evidence);
    const decision = evaluate(evidence);
    const expectedKind = step.expectedKind ?? null;
    const passed = expectedKind === null ? null : decision.kind === expectedKind;
    totals.steps++;
    totals[passed === null ? 'unasserted' : passed ? 'passed' : 'failed']++;
    return {evidence, decision, expectedKind, passed};
  })}));
  return {schemaVersion:1, policyVersion, totals, cases};
}

export function markdown(report) {
  // Imported strings stay literal text when this report is rendered as Markdown.
  const literal = value => String(value).replace(/[\\`*_{}[\]()#+.!<>|~-]/g, '\\$&').replace(/[\r\n]/g, ' ');
  const lines = ['# Alert Lab replay', '', `Policy: ${report.policyVersion}`, '', `Steps: ${report.totals.steps}; passed: ${report.totals.passed}; failed: ${report.totals.failed}; unasserted: ${report.totals.unasserted}.`, ''];
  for (const item of report.cases) {
    lines.push(`## ${literal(item.id)}`, '');
    item.steps.forEach((step,i) => {
      lines.push(`${i+1}. **${step.decision.kind}** — expected: ${step.expectedKind ?? 'not asserted'}; result: ${step.passed === null ? 'unasserted' : step.passed ? 'pass' : 'FAIL'}.`);
      lines.push(`   ${literal(step.decision.reasons.join(' '))}`, '');
    });
  }
  return lines.join('\n');
}
