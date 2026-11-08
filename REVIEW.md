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
