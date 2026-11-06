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
