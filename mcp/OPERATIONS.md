# Alert Evidence Review operations

This runbook covers only the public stateless Cloudflare Worker. It has no SQLite database, Helm release, ingestion token or Prometheus connector. The internal service has a separate [runbook](../OPERATIONS.md).

## Current operating boundary

Production: `https://alert-evidence.m1ngshum.com/mcp`. Staging: `https://alert-evidence-staging.m1ngshum.com/mcp`. The plugin is version 0.1.0; directory submission is on owner hold. Last recorded functional/portal evidence is from 13–14 November 2026, not a current health guarantee.

Application limits are 1 MiB per request, 100 combined steps per call and 512 KiB per response. The native limiter is configured for 30 requests per 60 seconds per client IP, approximately and separately per Cloudflare location. Shared proxy IPs can cause users to share that allowance. It is neither authentication nor a global quota/spending cap. Rejected requests can still consume platform requests.

The last recorded billing check showed Workers Free. No paid upgrade is authorized. Recheck entitlement and account-wide usage before capacity decisions. Platform runtime limits and shared quotas can cause failure even within application limits.

## Before a release

1. Follow [local validation](README.md#local-checks) and contribution rules. Record source revision, lockfile, Worker SHA256, package hash and check outcomes. Local checks are not hosted CI.
2. Inspect actual target host bindings, rate limiter, observability, direct provider ingress and the scoped BIC exception. Compare against reviewed configuration; source does not prove deployed parity.
3. Preserve production `/.well-known/openai-apps-challenge` and the staging reviewer recording on updates. Keep the MCP hostname stable. The existing asset-inclusive deployment is not reproduced by a code-only deployment command.
4. Validate the exact candidate on staging, then obtain Astra review. Retain the previous known-good Worker version and required assets before an authorized production promotion.
5. Repeat MCP checks and verify source identity after promotion. Record deployment/version IDs privately. Refresh package/portal checks when their inputs change. Do not submit the plugin as part of deployment.

## Monitoring to establish before broad launch

Track availability, invocation errors, CPU, latency, traffic, quota use and rate-limit responses. External checks use synthetic evidence only. `/health` checks reachability/source identity; it does not exercise initialization, discovery, resource reading or tools. It cannot replace a complete MCP synthetic.

Application observability/body logging is currently disabled. Design metrics and failure alerts without storing evidence, bodies, credentials or identifying labels. Review Cloudflare operational metadata and retention separately from application non-retention. A monitoring destination or recurring notification needs explicit setup authorization. Monitoring and alert delivery are not implemented or verified by this document.

## Incident triage

- **429:** inspect traffic and shared-client contention. Honor retry-after; do not routinely disable the limiter.
- **413 / output-limit rejection:** reduce suite size. Never silently truncate evidence or reports.
- **400 / validation error:** follow the policy schema. SDK errors can echo caller-controlled field/tool names; not every error is generic. Support reports must use synthetic evidence.
- **5xx / quota failure:** check provider status, account usage, resource errors, recent releases and configuration parity. Prepare rollback for release-related failures; do not enable body logs to debug evidence.
- **Host-specific 403:** check host/origin and the approved two-host BIC exception. Do not disable zone-wide controls or introduce browser challenges incompatible with MCP clients.

## Recovery and emergency stop

Select the retained known-good Worker version, confirm compatibility/static assets and perform an authorized rollback. Recheck source identity and MCP synthetics after propagation. A rollback drill is pending; no measured recovery time is claimed.

For active abuse or a harmful release, prepare disabling the production custom-domain route as the emergency stop; this intentionally makes the service unavailable. Record the incident and require a verified candidate before restoration. Never redirect plugin traffic to an unreviewed hostname. Do not run an availability drill against production.

There is no evidence database to back up. Preserve reviewed source, lockfiles, build/deployment receipts and required public assets. Keep credentials and scoped upload sessions out of files, commands, tracking and logs.

## Security and support

Use the private reporting path in [SECURITY.md](../SECURITY.md). Ordinary support examples must be minimal and synthetic. No review proves absence of all vulnerabilities. The focused 14 November source review did not validate adversarial load, provider retention or actual host rendering/instruction handling.

Remaining work is in [the roadmap](../ROADMAP.md); current task status and detailed operator evidence belong in the private delivery tracker.
