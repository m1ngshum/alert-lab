# Security policy

Version 0.1.x is supported. Report vulnerabilities through this repository's private GitHub Security Advisories reporting feature. Do not post credentials, operational evidence or exploit details in public issues. If private reporting is unavailable, do not post sensitive details publicly.

The service is an internal single-tenant shadow tool. Its bearer token grants both ingestion and reading; its Prometheus identity must have read-only query access. Deployers own TLS termination, network boundaries, credential rotation, storage encryption and backups. Alert payloads cannot configure queries, destinations or actions. No Kubernetes API permissions are needed.

Illustrative policy recommendations do not replace incident response, security investigation or existing paging.

## Initial image scan

The 6 November 2026 scan of v0.1.0 found two inherited high-severity Debian `zlib1g` findings with no vendor fix available: CVE-2026-76844 and CVE-2026-85091.

## v0.1.1 runtime patch

The runtime now uses pinned distroless `base-nossl-debian13`, which omits the unused system OpenSSL and its zlib dependency. Node uses its bundled OpenSSL. The three required GCC runtime libraries retain their Debian package metadata and copyright files for inventory and scanning. No vulnerability ignore rules or VEX exceptions are used. CI and releases reject **all** detected high/critical vulnerabilities and secrets, including vulnerabilities without vendor fixes.

That release removed the two reported **OS-package** findings. Its official Node 26.13.0 binary still embedded unpatched zlib gzip-file code. Node's JavaScript compression API did not expose those C file interfaces, and no Alert Lab call path was identified. The remaining bundled-code issue is addressed in v0.1.2 below; older release artifacts remain unchanged.

## v0.1.2 bundled-zlib backport

The published container uses a custom `v26.13.0-alertlab-zlib-df84af25` Node build. On 7 November 2026, Node 26.13.0 was still the latest stable upstream release and lacked the fix. We backport the exact three-line pointer reset from upstream zlib commit `df84af25dc1942490e1d1c899a07619152a46148`, the fixing change identified for both CVEs. The source archive, patch, and original/patched `gzwrite.c` are checksum-pinned in `runtime/node-source.json`. HTTPS verification remains enabled. The bundled zlib version string is unchanged; this is an explicit backport, not an upstream zlib version upgrade.

Native amd64 and arm64 builds must pass a test-only addon that resolves the running Node executable's own gzip symbols and verifies their owner. The official unpatched binary must exhibit the exact stale input pointer and length after both an `EPIPE` and an `EAGAIN` failure. The custom binary must clear the pending length, restore the internal pointer, and safely continue through the subsequent formatted write. The addon is not shipped in the runtime. Its checks do not rely on a clean package scan to infer the embedded-code fix.

Each image contains `/usr/share/doc/node/build.json`: source/patch pins, custom version, binary SHA-256, and both negative-control and fixed-binary results. Hardened image checks verify that receipt against the actual executable. Releases include both architecture receipts and identify the custom binaries and backport in the image SBOM. Native build jobs attest and transfer the exact tested image archives; the publishing job verifies their provenance, reloads, rechecks and scans them before exporting any image. It waits for the protected `release` environment approval after Astra reviews the prepared artifacts, and promotes those images without rebuilding. GitHub provenance binds the published image index and release assets to the reviewed main commit.

This fix applies to the published container. Host Node installations used for local development are not modified. The service-specific image omits npm and the Temporal API; Alert Lab does not use either. Its custom runtime does not provide full feature parity with the official Node distribution. A custom Node build adds maintenance responsibility: track upstream security releases and replace the backport when an official fixed release is adopted. No claim is made that these checks establish absence of all unrelated vulnerabilities.

References: [distroless image contents](https://github.com/GoogleContainerTools/distroless/blob/main/base/README.md), [upstream zlib fix](https://github.com/madler/zlib/commit/df84af25dc1942490e1d1c899a07619152a46148), [pinned Node gzip source](https://github.com/nodejs/node/blob/v26.13.0/deps/zlib/gzwrite.c), [Node compression API](https://nodejs.org/docs/latest-v26.x/api/zlib.html).


## v0.1.3 Debian/glibc security maintenance

This release retains supported Debian 13 glibc, the existing checksum-pinned Node/zlib backport and native amd64/arm64 builds. It fixes package-copy ordering: GCC libraries, package metadata and licenses are recaptured after apt installation, with SHA-256 receipts checked against the actual loaded libraries. Reviewed package versions are pinned in `runtime/debian.json`; a new vendor version requires review.

**No additional CVE removal is claimed.** On 9 November 2026 the current distroless Debian 13 digest already included glibc `2.41-12+deb13u4`; GCC packages were `14.2.0-19`. These are the current Debian-stable versions. The available glibc fixes for [CVE-2026-5450](https://security-tracker.debian.org/tracker/CVE-2026-5450) and [CVE-2026-5928](https://security-tracker.debian.org/tracker/CVE-2026-5928) were already present in v0.1.2. The remaining findings have no fixed Debian 13 package version reported by the vendor-backed scanner. Upstream or newer Debian-branch fixes can exist without a stable package fix; no testing/sid packages or unqualified libc replacement are introduced.

The refreshed v0.1.2 arm64 baseline reports **40 package findings: 29 medium and 11 low, representing 28 unique CVEs**. The earlier 29-medium/8-low scan predates the GCC CVE-2026-115456 database entry, which is reported for all three copied GCC packages. These are package findings, not 40 distinct flaws. The exact release counts and package inventories for each architecture are in `scan-amd64.json`, `scan-arm64.json`, `security-amd64.md` and `security-arm64.md`; database updates can change counts. Per-architecture image SBOMs, Node build receipts and GCC library receipts accompany them and are attested. The supported maintenance choice retains these disclosed findings rather than asserting a clean scan.

CI and release validation scan all severities without ignore rules or VEX exceptions. They reject HIGH/CRITICAL vulnerabilities, secrets at any severity, and findings with an available vendor-fixed version. Before registry export, the exact native image IDs are rechecked and a fresh scan must match the reviewed finding inventory. Changed findings require another review. Publishing promotes the reviewed image archives without rebuilding; the protected release environment remains the final artifact-review gate.

### Residual vendor findings checked on 9 November 2026

All rows below remain disclosed with no fixed trixie package version. Status comes from the [Debian glibc tracker](https://security-tracker.debian.org/tracker/source-package/glibc) and [Debian GCC 14 tracker](https://security-tracker.debian.org/tracker/source-package/gcc-14), with the exact links below. “No DSA” is a vendor scheduling decision, not a fix. The scanner can attribute one source-package CVE to several binary packages; the lists preserve that attribution without declaring each binary exploitable. GCC header-template issues also cannot be repaired merely by replacing a shared library; no such remediation claim is made here.

| CVE | Scanner severity | Binary packages | Debian 13 fix |
| --- | --- | --- | --- |
| [CVE-2010-4756](https://security-tracker.debian.org/tracker/CVE-2010-4756) | LOW | libc6 | Unavailable |
| [CVE-2018-20796](https://security-tracker.debian.org/tracker/CVE-2018-20796) | LOW | libc6 | Unavailable |
| [CVE-2019-1010022](https://security-tracker.debian.org/tracker/CVE-2019-1010022) | LOW | libc6 | Unavailable |
| [CVE-2019-1010023](https://security-tracker.debian.org/tracker/CVE-2019-1010023) | LOW | libc6 | Unavailable |
| [CVE-2019-1010024](https://security-tracker.debian.org/tracker/CVE-2019-1010024) | LOW | libc6 | Unavailable |
| [CVE-2019-1010025](https://security-tracker.debian.org/tracker/CVE-2019-1010025) | LOW | libc6 | Unavailable |
| [CVE-2019-9192](https://security-tracker.debian.org/tracker/CVE-2019-9192) | LOW | libc6 | Unavailable |
| [CVE-2026-102010](https://security-tracker.debian.org/tracker/CVE-2026-102010) | MEDIUM | libatomic1, libgcc-s1, libstdc++6 | Unavailable |
| [CVE-2026-114690](https://security-tracker.debian.org/tracker/CVE-2026-114690) | MEDIUM | libatomic1, libgcc-s1, libstdc++6 | Unavailable |
| [CVE-2026-114691](https://security-tracker.debian.org/tracker/CVE-2026-114691) | MEDIUM | libatomic1, libgcc-s1, libstdc++6 | Unavailable |
| [CVE-2026-115455](https://security-tracker.debian.org/tracker/CVE-2026-115455) | MEDIUM | libatomic1, libgcc-s1, libstdc++6 | Unavailable |
| [CVE-2026-115456](https://security-tracker.debian.org/tracker/CVE-2026-115456) | LOW | libatomic1, libgcc-s1, libstdc++6 | Unavailable |
| [CVE-2026-18374](https://security-tracker.debian.org/tracker/CVE-2026-18374) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-19499](https://security-tracker.debian.org/tracker/CVE-2026-19499) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-19542](https://security-tracker.debian.org/tracker/CVE-2026-19542) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-5435](https://security-tracker.debian.org/tracker/CVE-2026-5435) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-6238](https://security-tracker.debian.org/tracker/CVE-2026-6238) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-6368](https://security-tracker.debian.org/tracker/CVE-2026-6368) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-6791](https://security-tracker.debian.org/tracker/CVE-2026-6791) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-77117](https://security-tracker.debian.org/tracker/CVE-2026-77117) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-80489](https://security-tracker.debian.org/tracker/CVE-2026-80489) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-84243](https://security-tracker.debian.org/tracker/CVE-2026-84243) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-8674](https://security-tracker.debian.org/tracker/CVE-2026-8674) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-86805](https://security-tracker.debian.org/tracker/CVE-2026-86805) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-89092](https://security-tracker.debian.org/tracker/CVE-2026-89092) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-95619](https://security-tracker.debian.org/tracker/CVE-2026-95619) | MEDIUM | libatomic1, libgcc-s1, libstdc++6 | Unavailable |
| [CVE-2026-95818](https://security-tracker.debian.org/tracker/CVE-2026-95818) | MEDIUM | libc6 | Unavailable |
| [CVE-2026-97399](https://security-tracker.debian.org/tracker/CVE-2026-97399) | LOW | libc6 | Unavailable |

Application reachability for these residual CVEs has not been established or ruled out. The service runs non-root with a read-only root filesystem, no shell or package manager, no Kubernetes permissions, authenticated fixed-path ingestion and operator-owned queries; these boundaries are not substitutes for library fixes. Continue tracking Debian stable updates. The scanner inventory does not prove absence of unrelated or embedded-code vulnerabilities. Existing direct bundled-zlib regressions remain required.
