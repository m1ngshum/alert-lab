/* All inputs, limits and recommendations are illustrative. No model call occurs. */
const AlertPolicy = (() => {
  const limits = { successReview: 99, successPage: 97, latencyReview: 800, latencyPage: 1500, resourceReview: 75, resourcePage: 90 };
  const base = { rate: 48, success: 99.9, latency: 250, cpu: 35, memory: 46, rejection: 'expected', downstream: 'healthy', security: 'none', classifier: 'normal', consistency: 'consistent', samples: true, logs: true, metrics: true, journeys: true, rechecks: 0 };
  const presets = [
    { id: 'rejected', title: 'Expected rejection', subtitle: 'High 400s, healthy journeys', data: { ...base } },
    { id: 'client', title: 'Broken client', subtitle: 'Correct rejection, affected users', data: { ...base, success: 98, rate: 60 } },
    { id: 'saturated', title: 'Resource saturation', subtitle: 'Capacity needs attention', data: { ...base, cpu: 94, latency: 1700, downstream: 'strained' } },
    { id: 'probing', title: 'Suspicious probing', subtitle: 'Healthy does not mean ignore', data: { ...base, security: 'suspicious' } },
    { id: 'missing', title: 'Missing telemetry', subtitle: 'An unknown is not an OK', data: { ...base, metrics: false, rejection: 'unknown' } }
  ];
  const numeric = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  function evaluate(e) {
    if (!e || typeof e !== "object" || Array.isArray(e)) e = {};
    const result = evaluateCore(e);
    if (e.security === 'suspicious' || e.security === 'confirmed') result.securityTask = 'Security responder: preserve evidence and investigate in parallel; urgent containment for confirmed compromise.';
    return result;
  }
  function evaluateCore(e) {
    const urgent = [];
    if (e.security === 'confirmed') urgent.push('Confirmed security compromise or unexpected access.');
    if (e.journeys === true && numeric(e.success, 0, 100) && e.success < limits.successPage) urgent.push(`User/client journey success is ${e.success.toFixed(1)}%, below the urgent demo threshold.`);
    if (e.journeys === true && numeric(e.latency, 0, 10000) && e.latency >= limits.latencyPage) urgent.push(`Valid-request p95 latency is ${e.latency} ms.`);
    if (e.metrics === true) {
      if (numeric(e.cpu, 0, 100) && e.cpu >= limits.resourcePage) urgent.push(`CPU is ${e.cpu}%; the illustrative capacity-paging rule applies.`);
      if (numeric(e.memory, 0, 100) && e.memory >= limits.resourcePage) urgent.push(`Memory is ${e.memory}%; the illustrative capacity-paging rule applies.`);
      if (e.downstream === 'outage') urgent.push('A downstream dependency is unavailable.');
    }
    if (urgent.length) return decision('page', 'Page the incident owner', urgent, 'On-call incident owner', 'Immediate', 'Known urgent evidence bypasses the simulated classifier.', false);
    const missing = [];
    if (!e.logs) missing.push('Application logs or rejection traces are missing.');
    if (!e.samples) missing.push('Rejection samples are insufficient to establish expected handling.');
    if (!e.metrics) missing.push('Resource and dependency metrics are missing or stale.');
    if (!e.journeys) missing.push('Valid-user journey signals are missing or stale.');
    if (!numeric(e.rate, 0, 100) || !numeric(e.success, 0, 100) || !numeric(e.latency, 0, 10000) || !numeric(e.cpu, 0, 100) || !numeric(e.memory, 0, 100)) missing.push('A required measurement is missing or invalid.');
    for (const [key, allowed] of Object.entries({rejection:['expected','unexpected','unknown'], downstream:['healthy','strained','outage','unknown'], security:['none','suspicious','confirmed','unknown'], classifier:['normal','uncertain','unavailable','invalid'], consistency:['consistent','conflicting']})) if (!allowed.includes(e[key])) missing.push(`Invalid ${key} evidence.`);
    if (![e.logs,e.samples,e.metrics,e.journeys].every(v => typeof v === 'boolean') || !Number.isInteger(e.rechecks) || e.rechecks < 0) missing.push('Evidence availability or recheck count is invalid.');
    if (e.consistency === 'conflicting') missing.push('Evidence sources disagree; a human must resolve the conflict.');
    if (e.rejection === 'unknown') missing.push('Rejection handling has not been verified.');
    if (e.downstream === 'unknown') missing.push('Dependency health has not been verified.');
    if (e.security === 'unknown') missing.push('Security evidence has not been checked.');
    const degraded = [];
    if (e.journeys === true && numeric(e.success,0,100) && e.success < limits.successReview) degraded.push(`User/client journey success is ${e.success.toFixed(1)}%; users may be affected despite correct rejection.`);
    if (e.journeys === true && numeric(e.latency,0,10000) && e.latency >= limits.latencyReview) degraded.push(`Valid-request latency is elevated (${e.latency} ms).`);
    if (e.metrics === true && ((numeric(e.cpu,0,100) && e.cpu >= limits.resourceReview) || (numeric(e.memory,0,100) && e.memory >= limits.resourceReview))) degraded.push('Resource headroom is reduced.');
    if (e.metrics === true && e.downstream === 'strained') degraded.push('Dependency pressure needs investigation.');
    if (e.rejection === 'unexpected') degraded.push('Unexpected rejection, exception or response needs investigation.');
    if (e.security === 'suspicious') return decision('security', missing.length || degraded.length ? 'Security and service review' : 'Ask for security review', ['Suspicious probing requires security investigation; health signals do not remove that need.', ...missing, ...degraded], 'Security responder + service owner', `Acknowledge within ${missing.length || degraded.length ? 15 : 30} simulated minutes`, 'Security adds follow-up while preserving the earliest service-investigation deadline.', false);
    if (missing.length) return decision('review', 'Gather evidence with a human', [...missing,...degraded], 'Service owner', 'Acknowledge within 15 simulated minutes', 'Unknown evidence prevents automatic observation.', false);
    if (degraded.length) return decision('review', 'Investigate with the service owner', degraded, 'Service owner', 'Acknowledge within 15 simulated minutes', 'Known non-urgent concerns bypass the simulated classifier.', false);
    if (e.classifier !== 'normal') return decision('review', 'Ask a human to decide', [e.classifier === 'unavailable' ? 'The simulated classifier timed out or was unavailable.' : e.classifier === 'invalid' ? 'The simulated classifier returned an invalid result.' : 'The simulated recommendation was ambiguous.'], 'Service owner', 'Acknowledge within 15 simulated minutes', 'Classifier failure or ambiguity falls back to human review.', true);
    if (e.rate <= 2) return decision('resolved', 'Close this observation window', ['The 400 rate returned to the illustrative baseline of 2% or below.', 'Fresh, complete and consistent evidence shows no follow-up trigger.'], 'Service owner / observation workflow', 'Record resolution; no further recheck for this episode', 'The observation loop closes only after all evidence and policy gates pass.', true);
    if (e.rechecks >= 2) return decision('review', 'Review the persistent spike', ['The spike persisted through two simulated rechecks. Observation cannot continue indefinitely.'], 'Service owner', 'Acknowledge within 30 simulated minutes', 'Persistence policy overrides the simulated observe recommendation.', true);
    return decision('observe', 'Observe, record and recheck', ['Requests were rejected as expected, with no observed side effects.', 'Valid-user journeys and resource headroom are healthy in this sample.', 'Available security evidence shows no concern requiring follow-up.'], 'Service owner / observation workflow', 'Recheck after 5 simulated minutes', 'Simulated Jev suggests observe; explicit policy permits it for this evidence window.', true);
  }
  function decision(kind, title, reasons, owner, deadline, explanation, classifierUsed) { return {kind,title,reasons,owner,deadline,explanation,classifierUsed}; }
  return { evaluate, presets, limits };
})();

export const { evaluate, presets, limits } = AlertPolicy;
export const policyVersion = "0.1.0";
