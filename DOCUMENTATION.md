# Documentation index and review

Reviewed 15 November 2026 against source baseline `73a643fed7aeb640be1784560433593f7bbc50f9` and the separate local MCP working tree. This is a documentation/source reconciliation, not a new security scan, architecture test, deployment or plugin submission.

| Document | Purpose and review result |
| --- | --- |
| [README](README.md) | Current public playground, replay contract, released runtime and install commands. Added roadmap/status navigation; no inference occurs today. |
| [Roadmap](ROADMAP.md) | Delivered baseline, separate optional internal Jev and public MCP tracks, acceptance gates and deferred work. |
| [Contributing](CONTRIBUTING.md) | Regression, policy-preservation and CI expectations. No incidental automation of operational actions. |
| [Operations](OPERATIONS.md) | Backup/restore, single-replica/PVC lifecycle and protected artifact publishing. Updated chart verification example to released v0.1.3. |
| [Security](SECURITY.md) | Supported scope, bundled-zlib backport and dated residual-CVE disclosure. Counts remain historical until a new scan; this review does not renew them. |
| [Review record](REVIEW.md) | Historical Astra review and validation snapshots. Earlier pending statements describe their dated candidate, not current release status. Publication of v0.1.3 was verified through the GitHub release record; no historical review evidence rewritten. |
| [Isolated lab](examples/dogfood/README.md) | Host isolation, real rechecks, UI/replay/comparison and teardown. Confirmed launcher/image/chart still v0.1.2; documented mismatch and tracked separate upgrade. No host/VM operations performed. |

## Separate MCP/plugin documentation and implementation

This checkpoint publishes [MCP guidance](mcp/README.md), [Worker operations](mcp/OPERATIONS.md) and [the dated MCP review record](mcp/REVIEW.md). The Worker implementation, package manifests, scripts and plugin package remain in a separate local working tree and are not part of this documentation change. The documented package commands require that implementation checkout; dedicated MCP CI remains an open milestone.

The source/metadata review covers deterministic supplied sanitized evidence, a simulated classifier, no private-runtime connector and no operational actions. Recorded 13–14 November evidence describes deployment and automated draft scans; the owner chose ready without submitting. This documentation reconciliation does not rerun those checks or establish native host behavior, current health, external approval or publication. Earlier candidate-pending statements remain historical, and any future runtime source publication requires exact source/artifact and current receipt reconciliation.

## Maintenance

Update current user guidance when behavior changes; retain dated review evidence and label its limits. New model behavior must update runtime configuration, security/privacy guidance, replay/version compatibility and local UI docs together. Verify official provider contracts during implementation, keep secrets server-side and use recorded results for offline replay. Private delivery tracking records owner, milestone, dependencies, acceptance, blockers and exact review/check evidence; public documentation contains no operator credentials or real evidence.
