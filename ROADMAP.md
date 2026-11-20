# Alert Lab roadmap

Status reviewed 15 November 2026. This roadmap separates delivered behavior from future work; it does not authorize implementation, paid API calls, merges, deployments or releases. Owner: m1ngshum.

## Delivered baseline

- Public synthetic browser-local playground with five scenarios, deterministic policy, JSON import and replay/export; CLI shares the policy and replay schema.
- Released v0.1.3 Alertmanager/Prometheus shadow service, SQLite durability, bounded five-minute rechecks, container and Helm artifacts for Linux amd64/arm64. Residual image findings are disclosed in SECURITY.md; it is not a zero-vulnerability release.
- Isolated full-VM dogfood UI: timeline/countdown, one-click exercise, history, side-by-side changes and numeric deltas, JSON/Markdown/ZIP reports. The committed launcher still pins v0.1.2; a separately upgraded local lab does not change that default.
- Homepage links to the public playground. No production alert-accuracy or paging-reduction claim is established.

## Shadow-service reliability

Proposed on 19 November 2026. Prioritize these checks before expanding the runtime classifier. Use synthetic data and keep the existing paging route active.

- **Configuration changes.** Restart on a retained database with a changed selector or Prometheus mapping. Every pending decision must use evidence from the service that admitted the episode, or collection must stop with a documented recovery path. Verify that existing episodes can still receive their source resolution and that old replay links work.
- **Grouped delivery.** Exercise the documented shadow route with the supported Alertmanager version. Send a group at the receiver limit and another above it. Demonstrate a configuration that records every expected firing and resolution, preserves the primary receiver’s grouping, and makes unsupported deliveries visible to the operator.

### Developer experiment

Pair one Prometheus rule test with four HTTP-400 replay cases covering expected rejection, broken client journeys, stale evidence and suspicious activity. Ask three developers to choose a follow-up with the rule result and runbook, and with replay added. Vary which version they see first. Continue only if at least two correct a missed follow-up or identify a missed evidence gap and everyone preserves the security and stale-evidence follow-ups. Stop after one pilot if the added evidence does not meet that bar.

## Next: optional decision model

Selected direction: **Jev through OpenRouter, off by default**, used at the existing classifier gate to help recommendations. This is planned, not implemented. The current UI classifier is simulated and the runtime performs no inference.

1. **Provider contract and evaluation cases.** Verify current official API/model identifiers, typed outcomes, confidence semantics, privacy/retention controls and cost limits. Define a versioned fixed question and synthetic labeled replay cases. Acceptance: documented request/response contract, failure fixtures and reviewed evaluation criteria; no real operational evidence sent.
2. **Gated runtime integration.** Add one server-side provider with an existing Secret, fixed HTTPS endpoint/model, bounded requests/timeouts and validated responses. Preserve urgent/security/missing/degraded-evidence precedence and the two-recheck bound. Model uncertainty, malformed replies and API failures recommend human review; a model never establishes missing health evidence. Persist provenance and outcomes; replay consumes recorded results without network calls. Acceptance: default-off parity, precedence, failure, restart/resolution race and export/replay compatibility tests; no automatic paging, silencing or remediation.
3. **Local UI and isolated validation.** Expose model-used/skipped/failure and policy-versus-model outcomes in authenticated local reports/comparison. Keep public demo synthetic and browser-local, with no credentials or live provider calls. Acceptance: keyboard/mobile/hostile-text checks and real isolated lab exercise with explicit synthetic-call budget and exact reviewed artifacts; Docker and existing kubeconfig stay untouched.
4. **Reviewed release.** Astra reviews the exact source and material follow-up changes; both native architecture checks and release-artifact review pass before separately authorized publication. Acceptance: disclosed limits, provenance/SBOMs and verified published artifacts/rollback guidance. A roadmap item does not grant release approval.

## Parallel follow-ups

- Reconcile the committed dogfood launcher/README/chart/image pins with v0.1.3 in a separate tested change; do not silently substitute a local upgrade for a repository default.
- Review the open base-image update with fresh, unsuppressed scans and both-architecture validation. Previously dated vulnerability counts are not a current scan.
- Reconcile the separate uncommitted Alert Evidence Review MCP/plugin implementation before source publication. Its recorded deployment and unsubmitted directory status are detailed in the [public MCP track](#public-mcp-track) below; it is separate from the internal Jev proposal.
- After a useful synthetic model evaluation, prepare a short demo and reproducible engineering post. Never claim measured incident improvement without labeled historical/shadow evaluation. External posts need explicit authorization.

GPT Decisions, other providers, operator/CRDs, Terraform/CDK, automatic remediation and new internal-service production deployments are deferred. Scope them separately if needed.

## Public MCP track

Planning baseline: 15 November 2026. Owner: m1ngshum. This roadmap covers the internal shadow service, public synthetic playground and isolated Alert Evidence Review MCP plugin. They share a reference policy, not a deployment or release version.

The private Alert Lab Delivery Project tracks live status, blockers, acceptance evidence and dependencies. Private planning issues are the execution record; this file is the public-safe milestone map. Roadmap inclusion does not authorize deployment, spending, merge or submission.

### MCP recorded baseline

- The internal service and OCI chart have a documented v0.1.3 release. Their database, credentials, Prometheus collection and backup procedure do not apply to the public Worker.
- Alert Evidence Review 0.1.0 was deployed to staging and production. Recorded 13–14 November checks include matching source receipts and seven passing synthetic SDK checks per environment. These are dated evidence, not continuous health or capacity assurance.
- The plugin draft's metadata, skill and MCP scans passed on 14 November. The owner chose **ready without submitting**. No legal submission attestations were accepted; no review or publication is claimed.
- The 14 November focused source/configuration review, including Astra, found no confirmed reachable vulnerability. That pass did not establish current live configuration parity, provider retention, adversarial-load resilience or native host behavior.

### MCP milestones and acceptance

| Milestone | Scope and acceptance | Dependencies |
| --- | --- | --- |
| M0 — Reproducible source baseline | Review and commit the currently local MCP implementation; run required hosted CI including dedicated MCP checks; record exact source/build/package identities and reconcile them with the deployed candidate. A local digest is not a reviewed main-branch commit. | Owner authorization for merge/source publication where required |
| M1 — Repeatable release | Build once, retain the artifact, validate staging, obtain exact-candidate Astra review, promote the same bundle, preserve ownership proof/recording assets, verify production and retain rollback identity. No automatic plan upgrade. | M0 |
| M2 — Private operational visibility | Track request/error/CPU/latency and quota signals; run synthetic MCP discovery/resource/tool checks and send failure alerts to an owner-approved destination. Test delivery. Keep submitted evidence, bodies, credentials and identifying labels out of telemetry. Review provider metadata/retention and policy changes before enabling them. | M0; separate authorization for recurring checks/notifications |
| M3 — Capacity and abuse validation | On isolated staging, measure representative and maximum supported calls, invalid/oversized requests and shared-client behavior. Record CPU/error/latency and a supported envelope. Validate deployed host/TLS/origin/limiter settings; document approximate per-IP/per-location limits, shared-proxy contention and quota exhaustion. Paid capacity or a new access model is a separate decision. | M0; bounded test scope agreed before traffic generation |
| M4 — Recovery drill | Restore a previous known-good Worker version on staging, preserve required assets, repeat functional checks and rehearse endpoint shutdown. Record measured recovery time and exact versions. Do not stop production for the drill. | M1 |
| M5 — Native host pilot | Exercise both tools and the policy resource in actual Codex/plugin-host sessions with sanitized fixtures. Verify missing evidence, alignment, invalid input and operational-action refusal. Record compatibility and feedback; SDK receipts alone do not pass this gate. | M1–M4 |
| M6 — Directory decision | Refresh package/portal checks for the final candidate and review demonstration suitability. Legal attestations/submission require a new explicit owner decision. External approval and publication remain separate outcomes. | M5; currently on owner hold |
| M7 — Maintenance | Review dependency/runtime advisories, update pins through normal review, maintain support/privacy pages and track reference-policy changes with replay differences. Internal container maintenance and Worker dependency maintenance stay distinct. | Independent; recurring automation requires separate request |

### Delivery rules

Use **Backlog → Ready → Building → Review → Done**. Record **Delivery stage** separately as Planned, Implemented, Merged, Deployed or Verified: a manually deployed candidate can still be in Review. Done means the issue's own checks passed with dated evidence and remaining limits. Do not narrow acceptance to hide a blocker.

Each issue records owner, milestone, checks, dependencies, next action and blockers. Reviews identify exact revisions or document digests. Later edits invalidate prior verdicts for changed content. Publication, paid upgrades, production access and submission remain distinct decisions.

### MCP scope limits

The delivery Project also contains separate optional Jev research and internal-service maintenance proposals. Their scope and approval gates remain in their own issues; they do not change the model-free first MCP release described here.

The first plugin release stays anonymous, stateless and advisory, with the existing illustrative HTTP-400/rejection policy. No model calls, production connectors, accounts, executable policies, silencing, paging or remediation are planned here. Submitted evidence is not stored; no result caching is introduced. Production reliability remains a roadmap goal, not a current guarantee.

See [MCP operations](mcp/OPERATIONS.md), [MCP review history](mcp/REVIEW.md), [internal-service operations](OPERATIONS.md) and [security boundaries](SECURITY.md).
