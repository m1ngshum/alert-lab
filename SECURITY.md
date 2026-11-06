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
