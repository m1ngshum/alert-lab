# Security policy

Version 0.1.x is supported. Report vulnerabilities through this repository's private GitHub Security Advisories reporting feature. Do not post credentials, operational evidence or exploit details in public issues. If private reporting is unavailable, do not post sensitive details publicly.

The service is an internal single-tenant shadow tool. Its bearer token grants both ingestion and reading; its Prometheus identity must have read-only query access. Deployers own TLS termination, network boundaries, credential rotation, storage encryption and backups. Alert payloads cannot configure queries, destinations or actions. No Kubernetes API permissions are needed.

Illustrative policy recommendations do not replace incident response, security investigation or existing paging.

## Initial image scan

The 6 November 2026 scan of v0.1.0 found two inherited high-severity Debian `zlib1g` findings with no vendor fix available: CVE-2026-76844 and CVE-2026-85091.

## v0.1.1 runtime patch

The runtime now uses pinned distroless `base-nossl-debian13`, which omits the unused system OpenSSL and its zlib dependency. Node uses its bundled OpenSSL. The three required GCC runtime libraries retain their Debian package metadata and copyright files for inventory and scanning. No vulnerability ignore rules or VEX exceptions are used. CI and releases reject **all** detected high/critical vulnerabilities and secrets, including vulnerabilities without vendor fixes.

This removes the two reported **OS-package** findings; it is not a claim that every bundled component is vulnerability-free. Node 26.13.0 remains the latest stable release checked on 7 November 2026 and embeds zlib `1.3.2.1-motley-456ae73`. Its binary includes the gzip file routines implicated by these CVEs; the corresponding bundled source lacks the upstream pointer-reset fix. Node's JavaScript `node:zlib` API exposes compression streams, not the `gzwrite`/`gzprintf` file interfaces, and Alert Lab does not call those C interfaces. Keep tracking Node security updates; adding native consumers of those interfaces requires reassessment. The OS package scan does not establish the safety of this bundled code.

References: [distroless image contents](https://github.com/GoogleContainerTools/distroless/blob/main/base/README.md), [upstream zlib fix](https://github.com/madler/zlib/commit/df84af25dc1942490e1d1c899a07619152a46148), [pinned Node gzip source](https://github.com/nodejs/node/blob/v26.13.0/deps/zlib/gzwrite.c), [Node compression API](https://nodejs.org/docs/latest-v26.x/api/zlib.html).
