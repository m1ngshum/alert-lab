# Alert Lab roadmap

Status reviewed 15 November 2026. This roadmap separates delivered behavior from future work; it does not authorize implementation, paid API calls, merges, deployments or releases. Owner: m1ngshum.

## Delivered baseline

- Public synthetic browser-local playground with five scenarios, deterministic policy, JSON import and replay/export; CLI shares the policy and replay schema.
- Released v0.1.3 Alertmanager/Prometheus shadow service, SQLite durability, bounded five-minute rechecks, container and Helm artifacts for Linux amd64/arm64. Residual image findings are disclosed in SECURITY.md; it is not a zero-vulnerability release.
- Isolated full-VM dogfood UI: timeline/countdown, one-click exercise, history, side-by-side changes and numeric deltas, JSON/Markdown/ZIP reports. The committed launcher still pins v0.1.2; a separately upgraded local lab does not change that default.
- Homepage links to the public playground. No production alert-accuracy or paging-reduction claim is established.

## Next: optional decision model

Selected direction: **Jev through OpenRouter, off by default**, used at the existing classifier gate to help recommendations. This is planned, not implemented. The current UI classifier is simulated and the runtime performs no inference.

1. **Provider contract and evaluation cases.** Verify current official API/model identifiers, typed outcomes, confidence semantics, privacy/retention controls and cost limits. Define a versioned fixed question and synthetic labeled replay cases. Acceptance: documented request/response contract, failure fixtures and reviewed evaluation criteria; no real operational evidence sent.
2. **Gated runtime integration.** Add one server-side provider with an existing Secret, fixed HTTPS endpoint/model, bounded requests/timeouts and validated responses. Preserve urgent/security/missing/degraded-evidence precedence and the two-recheck bound. Model uncertainty, malformed replies and API failures recommend human review; a model never establishes missing health evidence. Persist provenance and outcomes; replay consumes recorded results without network calls. Acceptance: default-off parity, precedence, failure, restart/resolution race and export/replay compatibility tests; no automatic paging, silencing or remediation.
3. **Local UI and isolated validation.** Expose model-used/skipped/failure and policy-versus-model outcomes in authenticated local reports/comparison. Keep public demo synthetic and browser-local, with no credentials or live provider calls. Acceptance: keyboard/mobile/hostile-text checks and real isolated lab exercise with explicit synthetic-call budget and exact reviewed artifacts; Docker and existing kubeconfig stay untouched.
4. **Reviewed release.** Astra reviews the exact source and material follow-up changes; both native architecture checks and release-artifact review pass before separately authorized publication. Acceptance: disclosed limits, provenance/SBOMs and verified published artifacts/rollback guidance. A roadmap item does not grant release approval.

## Parallel follow-ups

- Reconcile the committed dogfood launcher/README/chart/image pins with v0.1.3 in a separate tested change; do not silently substitute a local upgrade for a repository default.
- Review the open base-image update with fresh, unsuppressed scans and both-architecture validation. Previously dated vulnerability counts are not a current scan.
- Reconcile the separate uncommitted Alert Evidence Review MCP/plugin work before source publication. Its local record says deployed and portal scans passed, with owner decision to leave it unsubmitted; this is not a published directory listing or a model integration.
- After a useful synthetic model evaluation, prepare a short demo and reproducible engineering post. Never claim measured incident improvement without labeled historical/shadow evaluation. External posts need explicit authorization.

GPT Decisions, other providers, operator/CRDs, Terraform/CDK, automatic remediation and production deployment are deferred. Scope them separately if needed.
