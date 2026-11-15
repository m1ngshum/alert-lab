# Alert Evidence Review

Recorded status as of 14 November 2026: release 0.1.0 was deployed and its OpenAI portal metadata, skill and MCP scans passed with no findings. This is dated evidence, not a fresh availability check. The owner chose to leave the plugin ready without submitting it. No legal submission attestations were accepted; no review is queued and no directory listing is published. See [the review record](REVIEW.md) for validation boundaries, [Worker operations](OPERATIONS.md) for release/recovery procedures, and [the roadmap](../ROADMAP.md) for planned work.

Isolated anonymous HTTPS MCP service and portable plugin for supplied, sanitized HTTP-400/rejection evidence. It reuses Alert Lab's pure evaluator; no private runtime, database, ingestion token, scheduler or live infrastructure connector is imported.

## Local checks

This documentation-only checkpoint does not include the Worker implementation, package manifests or tooling on the default branch. The commands below apply to the separate implementation checkout. Publishing and validating that source, including dedicated hosted CI, is milestone M0 in [the roadmap](../ROADMAP.md).

Use the pinned Node 26.13.0 and npm 12.2.2 toolchain; the parent package supports Node `>=26.13.0 <27`. From this directory:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run package
```

The build receipt includes the base Git revision plus a digest of the actual source and dependency lockfile. The archive has an explicit six-file allowlist and excludes service code, receipts, dependencies and credentials. The source manifest targets the deployed production endpoint; its directory package remains an unsubmitted draft by owner choice. Packaging regenerates review cases but does not verify current endpoint health or portal state.

## Deployment

`cloudflare.config.ts` isolates staging and production Workers/domains. It disables application observability, uses the Free plan's platform limits, and binds a 30-request/60-second limiter per client IP per Cloudflare location. The Free API rejects custom limits metadata, so none is submitted; the application implements no outward requests. Cloudflare rate limits are approximate, not a strict global spend cap. There is no account-plan upgrade in the deployment workflow. Verify the actual Workers billing plan first.

Build the source bundle before invoking project-local `cf`; it consumes `dist/worker.js` and does not run the package build script for you:

```sh
npm test
npm run build
./node_modules/.bin/cf deploy --dry-run --mode staging
```

The dry run builds/validates without deployment; it does not prove remote bindings or asset preservation. The current release includes static recording/domain-proof assets: follow [Worker operations](OPERATIONS.md#before-a-release), since a code-only command is not a complete reproduction of that release. For an authorized rollout, validate staging first; use production mode only after exact-candidate Astra review. Run `npm run smoke -- https://alert-evidence-staging.m1ngshum.com/mcp`, then repeat against production. The SDK client checks discovery, policy reading, five positive cases and two schema rejections; the third negative case is host behavior and must be exercised separately.

Keep deployment/version IDs and build/archive hashes in a local release receipt. Roll back by deploying the previous known-good Worker version; do not change the MCP hostname in an existing submission. For the initial release, disabling its domain route is the emergency stop. The static playground and private service remain separate.

## Release gates

- Existing parent tests and MCP tests pass; actual workerd and remote client checks pass.
- Public scope, support, privacy and terms pages identify the publisher. The owner approved the current terms/privacy; preserve that approval. Material changes require review. Legal directory-submission attestations are separate and have not been accepted.
- No application body logs or evidence persistence. Cloudflare security/network metadata and chat-host retention still apply.
- Retain five positive/three negative reviewer cases, a real demonstration URL and exact package identity. Refresh automated portal checks for changed inputs; prior passed scans do not establish external approval or publication.
- Reviewer account: none; the endpoint is anonymous. Never put credentials or reviewer instructions in the package.

Current recorded status is tracked in [REVIEW.md](REVIEW.md) and the release receipt. Existing root CI does not run this nested package; see [contribution checks](../CONTRIBUTING.md#validate-the-surface-you-change). Local SDK tests do not establish OpenAI-host compatibility, production reliability, freshness, or directory acceptance.

## Public endpoint and reviewer access

Production is `https://alert-evidence.m1ngshum.com/mcp`; staging uses `alert-evidence-staging.m1ngshum.com`. The public recording is a rendered walkthrough of actual matching staging SDK receipts, at `https://alert-evidence-staging.m1ngshum.com/reviewer-walkthrough.mp4`, not a native chat-host screen recording.

The owner approved a configuration rule disabling Browser Integrity Check only for those two exact hostnames, because inherited BIC rejected ordinary Python clients with error 1010. Default Python requests passed after the scoped rule; global BIC remains on. Managed WAF, DDoS protection and the Worker limiter were not disabled. Ruleset `07ea29093a0846a6ad10884352f3fdcc`, rule `598604b108ed418795d2e5371d873aa7`; delete that rule to roll back the exception. Preserve other rules if the ruleset later changes.

OpenAI's public domain-ownership proof is a static file under `public/.well-known/`; keep it in future production asset manifests. Asset uploads use short-lived scoped sessions in memory/stdin. The helper rejects redirects and does not save session credentials. Never display its machine-only completion-token output.
