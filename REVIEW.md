# Independent release review

Model: gpt-6-astra. Reviewed locally before public source or artifact export on 6 November 2026.

Review covered policy preservation, shared replay, webhook authentication and validation, Prometheus evidence/freshness handling, SQLite durability, shutdown and restart behavior, Helm security, release integrity, privacy and source-level accessibility.

Findings fixed and independently rechecked:

- Fail closed before release writes when a version/tag/image/chart already exists; reserve a draft release to prevent accidental version reuse after partial failure.
- Apply source resolutions before firing admissions so a mixed batch can free capacity atomically; allow resolved tombstones at open-episode capacity.
- Stream documented backup exports with private permissions and overwrite protection.

Final disposition: no outstanding source-review blockers. All 16 tests and the original 56 policy assertions passed. Independent read-only, network-disabled container smoke verified Node 26.13.0 and native SQLite loading as UID 1000.

This review is not production acceptance. Image scanning, browser execution, local Kubernetes integration and published-artifact verification are separate release checks. See SECURITY.md for disclosed base-image findings.

## v0.1.1 patch review

Model: gpt-6-astra. Reviewed locally on 7 November 2026 before public source/artifact export. Final disposition: no actionable blockers; approved for the protected PR and release process.

Reviewed the minimal runtime library closure, retained Debian package inventory/licenses, stricter unsuppressed scan gates, version consistency and immutable release guard. Independently passed all 16 tests, 56 policy assertions, Helm checks and both exact final images' hardened SQLite/backup, compression and TLS checks. Both refreshed architecture scans contained zero HIGH/CRITICAL findings and zero secrets. AMD64 local execution used emulation; hosted release also tests both architectures.

The two Debian OS-package findings are removed. Node still embeds the affected gzip file code; review found no application path through Node's JS compression API or Alert Lab. This scoped assessment does not establish universal non-exploitability. See SECURITY.md. Real kind restart/Helm-upgrade persistence passed separately; the reviewer did not repeat that entire integration test. Hosted CI and published-artifact verification remain release gates.

## v0.1.2 source review

Model: gpt-6-astra. Reviewed locally on 7 November 2026 before public source export. Source disposition: approved for a public PR and native CI, with artifact publication blocked until both native builds and follow-up artifact review pass.

Review fixed two findings: promote exact tested image archives instead of rebuilding after scans, and require the precise failing pointer/length in the unpatched binary control. The final index uses immutable pushed child digests and verifies their image config IDs against the tested images. Source/archive/patch hashes, custom-binary receipt verification, native CI aggregation, release-tag reuse guards, per-architecture SBOM evidence and truthful provenance documentation were reviewed.

At source review, all 18 JavaScript tests and the original 56 policy assertions, Helm checks and secret/dependency scans passed. The stronger official-binary negative control passed separately. The rebuilt binary and native architecture checks remained pending; this source approval is not release approval. No reviewer executed candidate code or published artifacts during that source review.

Local ARM64 validation completed after that source review: the custom executable passed both direct bundled-zlib failure/recovery cases, all 18 application tests and 56 policy assertions, and all 89 pinned upstream compression test files. Hardened receipt/binary-identity, TLS, native SQLite/backup checks passed. Trivy reported zero HIGH/CRITICAL findings and zero secrets without exclusions. Real kind integration passed evidence collection, bounded rechecks, restart recovery and PVC history across Helm upgrade; the owned cluster was deleted. This supplements the source review and does not substitute for native CI or the exact prepared-artifact review. Final artifact approval and hashes must be recorded with the protected release run's environment approval.

Astra also reviewed the custom build's missing Temporal support: the pinned upstream configuration disables it when Rust tools are absent, and no Temporal use was found in Alert Lab or its runtime dependencies. Disclosing the service-specific npm/Temporal omissions was accepted without adding an unused toolchain. Final image checks assert Temporal is absent; full Node feature parity is not claimed.


## Isolated full-VM dogfood review

Model: gpt-6-astra. Local source and evidence review on 8 November 2026, before public source export. The final lab uses a separate Lima 2.3.0 VZ VM after OrbStack 2.2.5 startup was observed changing existing Docker configuration.

Review fixes include binding bootstrap and ownership to VM/user/container identity and kubeconfig bytes, forcing local rootless Podman, waiting for real service routing after restart, handling ConfigMap symlink entrypoints, and disabling Lima host-loopback access, proxy inheritance and host DNS. Plain mode disables Mac mounts, guest integration and dynamic port forwarding. The guest firewall is explicitly described as a guest-controlled guard.

Validation passed: 21 local Node tests, the original 56 policy assertions, 12 Python launcher tests, and 19 runtime tests plus policy assertions in the pinned published Node container inside the full VM. Helm lint/render and source/history secret scans passed. The minimal runtime intentionally lacks Python, so the Python-based SBOM test was run in the local full suite rather than that runtime container.

Real Prometheus/Alertmanager delivery produced observe/observe/review with recheck counts 0/1/2 at intervals of 301086 and 300366 milliseconds. Duplicate delivery preserved scheduled work; real source resolution preserved policy conclusions and cancelled pending work. JSON/Markdown replay passed all three expectations and repeated JSON output was byte-identical. Service restart, node stop/start, Helm upgrade and a full VM reboot retained evidence, decisions, the same PVC and a pending recheck's exact due time.

Effective VM configuration, active firewall after reboot, blocked host/private/metadata connections, public HTTPS, loopback-only tunnel, narrow-screen controls and keyboard focus were checked. All 758 original Docker/kubeconfig file hashes and six Docker Desktop tool/socket links remained unchanged throughout the Lima workflow. Docker Desktop remained healthy on desktop-linux. No production cluster was used.

Final Astra disposition: approved for a public source PR and hosted CI, with no actionable findings remaining. Astra independently inspected the saved configuration, replay/decision records, pending-restart case and four host-audit receipts; it did not independently rerun VM integration, browser checks or live host comparisons. Hosted CI is required before merge. This does not approve a new production image/chart release.

## Local lab UI replay review

Model: gpt-6-astra. Read-only local source review on 8 November 2026 before public source export. No actionable findings remained; public PR approval was conditional on the corrected mobile layout passing its browser recheck, which subsequently passed at 390px with no horizontal overflow. Hosted CI and exact-head merge review remain separate gates.

The UI reuses shared replay/policy modules, provides authenticated episode selection and pagination, ordered replay results, evidence JSON and JSON/Markdown report downloads. Actions are serialized; changes clear stale reports. Credentials stay in page memory and are absent from downloads. The proxy accepts only fixed episode routes and numeric pagination parameters with redirects disabled. ConfigMap asset checksums trigger workload rollout; the final production image contents are unchanged.

Validation: 22 local Node tests, 56 existing policy assertions, 12 Python launcher tests, 18 application tests plus policy assertions inside the pinned published runtime in the isolated VM, source/history secret scans and diff checks passed. Real isolated-VM browser replay matched observe/observe/review at rechecks 0/1/2, all three downloads passed content checks and shared-module round-trip parity. Unauthorized and no-decision errors, selection clearing, keyboard activation and 390px layout were checked. Helm upgrade retained all four episodes. All 758 original Docker/kubeconfig file hashes and six Docker links remained unchanged. Astra reviewed source and parent-reported evidence; it did not independently run the UI/tests. No production image/chart release is approved by this review.

## Live lab timeline and auto-refresh review

Model: gpt-6-astra. Local read-only source/test review on 8 November 2026 before public source export. Follow-up review found no remaining source findings and approved a public PR after final tests and VM checks, which passed. Hosted CI and exact-head merge review remain separate gates.

Review fixes preserve focused controls during background polls, cancel superseded requests and reject stale responses, clear the old report before following a new episode, and label the resolution timestamp as webhook receipt time. Four tests execute the shipped UI script with controlled network/timers, covering both rechecks, resolution, selection, pause/hidden state, errors, delayed token/selection changes and delayed detail after following a new episode. The timeline uses persisted service decision timestamps; replay and downloads reuse the existing policy.

Validation: 26 local Node tests, 56 policy assertions, 12 Python launcher tests, and 22 tests plus policy assertions in the pinned VM runtime passed. The real browser automatically discovered a fresh spike and displayed recovery without manual refresh. The earlier real ten-minute episode rendered both rechecks, review and source resolution. Native selector expansion and token focus survived polling; pause/resume, 390px layout and three downloads passed. Final assets were deployed privately and checked again. Host audit found all 758 Docker/kubeconfig files and six links unchanged. Astra did not independently execute these browser/VM checks. A second full ten-minute spike was not repeated for this UI change; controlled tests cover automatic decision progression. No production image/chart release is included.

## Countdown and exercise-progress review

Model: gpt-6-astra. Read-only local source/test review on 8 November 2026 before public source export. No actionable findings; public-PR approval was conditional on documentation, full-suite and final VM/browser checks, which passed. Exact-head hosted checks and merge review remain separate gates.

The one-second display timer estimates time from the persisted next-due timestamp using the browser clock; it never schedules collection or advances recorded progress. A labeled native progress bar tracks zero, one or two recorded rechecks. Paused/stale/hidden, overdue, resolved and unscheduled states are explicit. Early resolution preserves partial progress; human review is shown only when recorded. The countdown is not a repeatedly announcing live region. Existing cancellation, authentication and focus behavior is unchanged.

Validation: 28 local Node tests, 56 policy assertions, 12 launcher tests, and 24 tests plus policy assertions in the pinned isolated-VM runtime passed. Controlled-clock tests cover ticking, paused/stale/overdue states, both recorded rechecks, review and early resolution. Real browser checks verified a fresh countdown decreasing, pause suppression, early recovery retaining 0/2, the earlier full run displaying 2/2 with human review, and 390px layout. No new full ten-minute run was repeated for this display-only change. Host audit confirmed all 758 Docker/kubeconfig files and six links unchanged. Astra did not independently execute browser or VM checks. No production image/chart release is included.

## One-click exercise review

Model: gpt-6-astra. Local source and captured-archive review on 8 November 2026 before public source export. No actionable findings remained; public-PR approval was conditional on final VM checks, which passed. Hosted CI and exact-head merge review remain separate gates.

The UI checks prior episodes are resolved, binds a new episode after starting the spike, waits for recorded observe/observe/review at counts 0/1/2, requests recovery, waits for source resolution, then requests one ZIP containing JSON and Markdown. Existing individual downloads remain available. Startup cancellation was fixed to prevent aborting an uncertain Spike write ahead of Recovery. Cancel during observation recovers without exporting; timeout, unexpected decisions and failures stop without claiming recovery. Controls are locked during an exercise; the page must stay open and visible.

Validation passed: 34 local Node tests, 56 policy assertions, 12 Python launcher tests and 30 tests plus policy assertions in the pinned isolated-VM runtime. Tests cover episode binding, refusal to reuse a firing episode, cancellation ordering, delayed stale polls, timeout/failure, once-only export, CRC and Unicode ZIP content. Source/history scans and mobile checks passed; all 758 original Docker/kubeconfig hashes and six links remained unchanged.

A real single-click run recorded decisions at 08:31:14.693, 08:36:15.162 and 08:41:15.557 UTC, with source resolution received at 08:41:18.917. Both real intervals exceeded five minutes; recovery needed no further button click. Initial two-file automatic delivery was not established. The final packaging uses one archive, captured automatically from a separate controlled authenticated fixture serving the unchanged final UI. Python zipfile and Astra independently verified its two fixed entries, CRCs, three passing outcomes, exact shared JSON/Markdown parity and absence of credential markers. Archive SHA-256: f2b236f3e0984875be1a8e46b4ed6409f780c5c3eb261c7d485b528d16b06bfa. Subsequent polling is covered by a regression preventing repeat export. The full real ten-minute run preceded the archive-only packaging change; final archive delivery was tested separately. Astra inspected source and the captured archive; real timing/recovery and the browser event remain parent-reported evidence. No production image/chart release is included.

## Exercise history review

Model: gpt-6-astra. Read-only local source/test review on 9 November 2026 before public source export. The retention wording was corrected: completed history is retained for seven days after source resolution; unresolved episodes remain. Follow-up found no remaining source findings. The final VM-browser checks subsequently passed after browser access resumed. Astra’s final review approved a public PR with no actionable findings; hosted checks and exact-head merge review remain separate gates.

The native collapsible panel lists persisted episodes, including manual spikes; the service does not store one-click provenance. Per-run Review and Download ZIP reuse authenticated reads and the existing replay/archive builder. They fetch the selected episode before export, clear stale reports on failure, reject empty reports, preserve row/button elements during polling, clear history on token change and remain locked during an exercise. No service, credential, dependency or production artifact changes are included.

Validation passed: 37 local Node tests, 56 policy assertions, 12 Python launcher tests, and 33 tests plus policy assertions in the pinned isolated-VM runtime. Three added UI regressions cover read-only past-run review/export, delayed/empty/failed detail, exercise locks, token changes and DOM-node preservation. Source and 24-commit history secret scans passed. Private Helm deployment succeeded; host audit found all 758 original Docker/kubeconfig files and six links unchanged. Astra reviewed source; test execution and host/VM results are parent-reported. No new spike was started for this history feature. Real VM-browser checks reviewed the prior 57bc0d662ec7 episode and downloaded its ZIP through keyboard activation without starting a spike. Python zipfile verified both fixed entries and CRCs; shared replay and Markdown exactly matched three passing outcomes. Archive SHA-256: e7e43e289f575a35da7b18929f17c62c132312df9f103842594b3182476d533d. Enter/Space expansion, Tab order and focus survival through polling passed. At 390px the history controls stayed within the viewport with no horizontal scrolling. All 12 persisted episodes remained available; source statuses stayed resolved. Screenshots and the downloaded archive were retained locally. Astra independently verified the archive identity, entries, CRCs, episode ID, replay/Markdown parity and absence of credential markers, and inspected the mobile screenshot. Browser interactions, test execution and host/VM checks remain parent-reported; exact-head review remains required before merge.

## Latest-two episode comparison review

Model: gpt-6-astra. Read-only local source/test review on 9 November 2026 before public source export found no actionable findings. Public-PR approval was conditional on real VM-browser checks, which subsequently passed. Astra’s final evidence review independently matched 66 evidence/decision rows and their change labels to both CRC-valid historical ZIPs, inspected the mobile screenshot and approved a public PR. Hosted checks and exact-head merge review remain separate gates.

The history button reads every listing page and fetches the two latest episodes by persisted recording order, including manual spikes. Static tables align steps by recorded order and show all evidence fields, collection errors and recorded decision fields with explicit Same/Changed labels. Missing fields/steps remain distinct from null. Source resolution is separate from policy conclusions. Tables use text-only cells, captions and scoped headers inside a keyboard-focusable scrolling region. Comparison issues only authenticated reads, stays locked during exercises, and clears on foreground actions, token changes or errors; it never reruns policy or starts a spike.

Validation passed: 40 local Node tests, 56 policy assertions, 12 Python launcher tests and 36 tests plus policy assertions in the pinned VM runtime. Added regressions cover pagination and latest-two selection, changed decisions/evidence, hostile text, unequal/empty runs, missing/null values, insufficient history, invalid cursors, exercise locks and errors. Browser checks compared the retained 57bc0d662ec7 and 3caa45e9c66f episodes; every rendered evidence and decision field matched the two downloaded historical reports, including all change labels. Keyboard activation and Tab access passed; ArrowRight scrolled the focused comparison region. At 390px, page width remained 390px while the tables scrolled within their 358px container. Token changes and unauthorized reads cleared the tables; valid access was restored. No spike was started for this feature. Source/history secret scans passed, and all 758 host Docker/kubeconfig files and six links remained unchanged. Astra source review did not independently execute tests or browser/VM checks. No production image/chart release is included.
