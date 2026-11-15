# Documentation index and review

Reviewed 15 November 2026 against source baseline `73a643fed7aeb640be1784560433593f7bbc50f9` and the separate local MCP working tree. This is a documentation/source reconciliation, not a new security scan, architecture test, deployment or plugin submission.

| Document | Purpose and review result |
| --- | --- |
| [README](README.md) | Current public playground, replay contract, released runtime and install commands. Added roadmap/status navigation; no inference occurs today. |
| [Roadmap](ROADMAP.md) | Delivered baseline, selected optional Jev integration, acceptance gates and deferred work. |
| [Contributing](CONTRIBUTING.md) | Regression, policy-preservation and CI expectations. No incidental automation of operational actions. |
| [Operations](OPERATIONS.md) | Backup/restore, single-replica/PVC lifecycle and protected artifact publishing. Updated chart verification example to released v0.1.3. |
| [Security](SECURITY.md) | Supported scope, bundled-zlib backport and dated residual-CVE disclosure. Counts remain historical until a new scan; this review does not renew them. |
| [Review record](REVIEW.md) | Historical Astra review and validation snapshots. Earlier pending statements describe their dated candidate, not current release status. Publication of v0.1.3 was verified through the GitHub release record; no historical review evidence rewritten. |
| [Isolated lab](examples/dogfood/README.md) | Host isolation, real rechecks, UI/replay/comparison and teardown. Confirmed launcher/image/chart still v0.1.2; documented mismatch and tracked separate upgrade. No host/VM operations performed. |

## Separate MCP/plugin working tree

The existing checkout has an uncommitted `mcp/` subtree and a README link to it; neither is part of this documentation PR. Reviewed its README, REVIEW record and plugin skill for boundaries: deterministic supplied sanitized evidence, simulated classifier, no private runtime connector, and no operational actions. Its latest local record says deployed, portal scans passed and owner chose not to submit. Earlier candidate-pending entries remain historical. Those are local records, not new live verification in this review. The portal/host and directory status must be reconciled from current receipts before a future source publication; do not interpret ready/unsubmitted as listed.

## Maintenance

Update current user guidance when behavior changes; retain dated review evidence and label its limits. New model behavior must update runtime configuration, security/privacy guidance, replay/version compatibility and local UI docs together. Verify official provider contracts during implementation, keep secrets server-side and use recorded results for offline replay. Private delivery tracking records owner, milestone, dependencies, acceptance, blockers and exact review/check evidence; public documentation contains no operator credentials or real evidence.
