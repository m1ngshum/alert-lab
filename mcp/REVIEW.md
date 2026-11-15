# Astra review — Alert Evidence Review

## Current recorded status — 14 November 2026

Documentation reconciled on 15 November without rerunning tests, live probes or portal checks. The observations below retain their recorded dates and evidence sources.

- **Owner decision:** leave the directory draft ready without submitting. No legal submission attestations were accepted, review is Not submitted, and publication is Not published. Current terms/privacy were explicitly approved for production; that approval remains granted. Submission requires a new explicit owner decision.
- **Automated portal checks:** the implementing agent recorded metadata No findings, skill checks passed, MCP configured/domain verified, both tools discovered and no findings in the MCP scan. These are draft checks, not external approval or directory publication.
- **Service:** source digest `83db7f86f265b76c94ebcafbbc54fa8fb2fc4c6d566c6217b1840958c8159595`, base `73a643fed7aeb640be1784560433593f7bbc50f9`, had matching local workerd and staging/production receipts. Astra inspected seven passing synthetic SDK checks per remote environment and independently fetched matching health identities. This is functional synthetic evidence, not continuous health, capacity or native host-interaction proof.
- **Latest recorded production deployment:** `7050305dafc34bc6a562d965a8b63001`, reported after adding the public domain-ownership text asset without changing the service source digest. Staging version `b06b01f8fd1149a4a4bd6e90455e2806` includes the recording. Earlier deployment identifiers below are historical.
- **Access:** owner-approved configuration ruleset `07ea29093a0846a6ad10884352f3fdcc`, rule `598604b108ed418795d2e5371d873aa7`, disables BIC only on the two Alert Evidence hostnames. Global BIC remains on. The implementing agent observed default Python privacy-page requests return 200 after the exception. Earlier Python 403 observations preceded the fix; universal client/network access is not claimed.
- **Recording/package:** the manifest contains the real staging recording URL. Astra independently fetched 343,173 bytes as `video/mp4` and matched the compact file checksum. It is a rendered SDK-receipt walkthrough, not a native chat-host recording. The reviewed six-file plugin archive SHA256 was `bd5b67a6c0cec9c3965e2118bb0cd3060ed03f1b5d8f3d1fa4d33b53d42277f0`; later package changes require new identity/review evidence.
- **Checks/cost:** 11 MCP/package/recording/uploader tests passed; the parent reported 46 existing Alert Lab tests passed. The implementing agent verified Workers Free Active; no paid upgrade occurred. Unsupported custom limits were omitted, so no custom per-Worker CPU cap or enforced zero-subrequest limit is claimed.
- **Security scope:** the separate focused source-only review on 14 November found no confirmed reachable vulnerability. It did not execute target code, probe live endpoints or establish deployed configuration parity, provider retention, adversarial-load resilience or native host rendering. It is not a security certification.

See [Worker operations](OPERATIONS.md) for release/recovery boundaries and [the roadmap](../ROADMAP.md) for outstanding source/CI, monitoring, capacity, recovery and native-host work. The directory decision remains on owner hold. No current rollout approval-review blocker remains: the earlier context-limit failure was resolved through normal approval review with a smaller digest-guarded request, not a bypass.

## Historical review records

The following records describe the candidate and evidence available at each stage. Their pending gates, deployment identifiers, test counts and configuration claims are historical and do not override the dated summary above. Preserve them as audit evidence.

Review date: 2026-11-13. Reviewed the new `mcp/` candidate against Alert Lab base `73a643fed7aeb640be1784560433593f7bbc50f9`. This is source/local-protocol review, not deployment or directory acceptance.

## Findings and fixes

- Package generation replaced the entire `extensions.com.openai.review` object, silently dropping a supplied `demo_recording_url`. An isolated regression fixture reproduced the missing value. Generation now replaces only `test_cases`, retaining other review metadata. The test's synthetic recording URL exists only in temporary fixture data and was not added to the real listing.
- Packaged review cases removed their machine inputs while leaving prompts that referred to an unspecified example. Generated prompts now include the exact synthetic tool arguments, so each case is independently reproducible by reviewers. No production evidence is included.
- The Python packager consumes generated `review/cases.json`; package execution must generate it from `review/cases.mjs` first. This was reported to the parent, who owns package scripts. The regression test imports source cases directly and does not depend on that ignored generated file.

No confirmed blocker was found in the scoped replay/comparison logic. No speculative core change was made. Parent owns deployment configuration and dependency fixes; those require separate final configuration/build/deployed verification.

## Independent checks

- `npm test`: nine tests passed after the fixes, including an actual MCP SDK client connected to the Worker handler, tool/resource discovery, both tools, invalid input rejection, bounded stream cancellation, origin/host rejection, missing-limiter failure, and oversized output rejection.
- `npm run build`: passed, with source/lock-based receipt and a roughly 1.23 MB Worker bundle. This is a bundle build, not Cloudflare runtime or free-tier CPU proof.
- Plugin ZIP built locally; the package regression also checked deterministic rebuilds, retained recording metadata and exact case arguments for five positive/three negative cases. Actual recording URL, final deployment, portal schema/skill scans and review are still pending.
- Additional synthetic assertions verified removal of a metrics-availability flag remains omitted and changes the recommendation to review; expectation-only changes are reported and fail the expectation; all-missing evidence remains review. Invalid `application/jsonp` and `application/json-malformed` requests were rejected with 415 by the SDK; JSON with a charset parameter was accepted. No redundant HTTP fix was needed.
- Read the shared policy/replay implementation, new strict schemas, comparison alignment, Worker body/output bounds, public scope/privacy pages, package metadata, skill and synthetic review cases. Read-only/idempotent annotations match the tools' behavior.

## Fresh skill exercise

The reviewing agent followed the packaged skill and read the same policy data exposed by the resource. Fresh artifacts were kept in a private temporary directory; no remote service, production evidence or credentials were used. These are agent/local-core exercises, not native host-routing proof.

- Supplied only rate 27%, success 99.7% and explicit rechecks 0. Submitted those fields to the local core without copying example defaults. The response retained the omissions and recommended review with missing-evidence reasons.
- When rechecks were missing, asked for a recorded count or an explicitly requested simulation; no count was inferred and no request submitted.
- For reordered before/after steps without a stated correspondence, asked which snapshots should align. Made no chronological-equivalence or improvement claim.
- For unauthorized raw logs, requested authorized sanitized numeric/categorical facts and anonymous labels. Did not transmit raw logs or invent missing signals.
- For an operational paging/silencing request, explained that this plugin cannot perform the action. No infrastructure action occurred.

## Acceptance boundary

Accepted at the reviewed local core/skill/package-logic level, subject to the parent completing the generated-case package entrypoint and final configuration/runtime checks. The current reference policy remains narrow and illustrative; source freshness, operational correctness and model accuracy are not established by replay. No API model is called by this service.

Still unverified: the final Cloudflare configuration and native rate-limit binding; free-tier entitlement and performance; deployed endpoint and actual client/host behavior; final artifact identity after subsequent edits; approved public terms; genuine demonstration recording; and portal scans/acceptance. The parent is handling these separately. This review performed no deployment, installation, portal action, publication, credential-store access or commit.

## Final configuration/transport follow-up

Independently reran tests and build/package after the stateless JSON transport settings were added. `cf deploy --dry-run --mode staging` passed using the checked-in `cloudflare.config.ts`: the generated Worker had the staging hostname and 30-request/60-second rate-limit binding under `env`. This command did not upload or deploy. JSON response mode, zero subscriptions/keep-alive, and the explicit request-body limit match the bounded synchronous workflow. Application observability is disabled; CPU/subrequest limits are configured, but deployed enforcement remains to be checked.

The existing local workerd receipt contains five passing positive cases and two schema rejections, but its source digest was `791ebf64e22a...`, whereas the rebuilt JSON-transport candidate is `af1492eb51a6...`. That receipt is valid evidence for its earlier build only. The parent must rerun workerd or staging smoke against the exact new bundle. The parent reports 46 existing Alert Lab tests passed under Node 26.13.0 and the logged-in billing UI showed Workers Free Active; those two observations were not independently repeated by this reviewer.

Found and fixed a recording safeguard: the rendered walkthrough previously accepted a passing receipt from a different implementation. `record-demo.mjs` now requires the smoke receipt's source revision to match `dist/build.json`; a regression fixture failed before this fix and passes afterward. **Ten local MCP/package/recording tests now pass.** The recording is a rendered walkthrough of actual SDK receipts, not a recording of an interactive ChatGPT/Codex session. Its scope is stated visibly; the host-only operational-action refusal is not proven by SDK calls. A recording artifact, review-accessible URL, final host exercise and portal acceptance remain separate checks.

The npm package entrypoint now generates review cases before invoking Python, resolving the fresh-checkout packaging concern above. The exact generated six-member archive from this follow-up had SHA256 `630e4178f9514c8e46a583fff49c4f22fa883b81c860bdc082b68745f604e0c3`; any later listing/recording changes require rebuilding and reviewing its new hash. No deployment was performed by this reviewer.

## Exact local candidate closeout

The current build and latest local workerd smoke receipt both identify `83db7f86f265b76c94ebcafbbc54fa8fb2fc4c6d566c6217b1840958c8159595`. The reviewer independently verified all seven checks pass and the previous remote `374dba...` receipt remains preserved separately. This closes the earlier exact-local-runtime gap; it does not transfer the result to the deployed older staging version.

`results/reviewer-walkthrough.mp4` exists (1,400,143 bytes). The parent reports its source/build guard passed and rendered a 72-second walkthrough of the current local SDK receipt. This reviewer checked artifact presence, not playback/duration or portal suitability. It remains a rendered receipt walkthrough, not an interactive host screen capture or remote deployment proof.

The user explicitly approved the public terms/privacy for production. Treat this as continuing authorization, not an unresolved approval gate. The current rollout blocker is the automatic approval review's context exhaustion before uploading the final candidate; no retry or bypass was performed. Production deployment and portal submission have not occurred. Local source, tests, build, exact local workerd behavior, and package logic are accepted; final remote rollout, client-host exercises, recording accessibility and portal acceptance remain incomplete.

## Final rollout and one-time uploader security review (2026-11-14)

The reviewer inspected production `results/latest-smoke.json` and current staging `results/staging-83db7f-smoke.json`, confirmed seven passing checks and exact source identity in each, and independently read the two live health endpoints plus the public recording. The initial sandbox DNS failure was resolved with an approved read-only network check; no deployment was performed by the reviewer.

Reviewed the one-time `scripts/upload-asset.py`: scoped upload session arrives on stdin, TTY echo is disabled and restored, no credentials are in arguments or written to disk, the asset size is bounded, the destination is fixed to Cloudflare HTTPS, and failures use a generic message. Its completion session is deliberately emitted only as machine-consumed stdout; the caller must keep it out of user-visible output and storage. The parent reports the orchestrator did so; this reviewer did not inspect secret-bearing process output or search credential stores.

Confirmed and fixed a transport weakness: urllib's default redirect handling could forward the scoped Authorization header away from the intended upload endpoint. Added a redirect-refusing handler and an offline dummy-session regression, which failed before the change and passes afterward. This does not establish that any earlier upload leaked credentials; no such event was observed. Only the one-time uploader/test changed, so the deployed service digest and plugin archive contents are unaffected. No asset upload was repeated for the fix.

The production rollout resolves the prior deployment blocker. Remaining review gates concern native host behavior, reviewer access to the video, actual portal checks and directory review/publication. The uploaded video is evidence of SDK calls rendered into a walkthrough, not proof of interactive host behavior.
