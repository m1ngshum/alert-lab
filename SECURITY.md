# Security policy

Version 0.1.x is supported. Report vulnerabilities through this repository's private GitHub Security Advisories reporting feature. Do not post credentials, operational evidence or exploit details in public issues. If private reporting is unavailable, do not post sensitive details publicly.

The service is an internal single-tenant shadow tool. Its bearer token grants both ingestion and reading; its Prometheus identity must have read-only query access. Deployers own TLS termination, network boundaries, credential rotation, storage encryption and backups. Alert payloads cannot configure queries, destinations or actions. No Kubernetes API permissions are needed.

Illustrative policy recommendations do not replace incident response, security investigation or existing paging.

## Initial image scan

The 6 November 2026 Trivy 0.76.2 scan of the pinned distroless Debian 13 runtime found two inherited high-severity zlib findings with no vendor fix available: CVE-2026-76844 and CVE-2026-85091. No critical findings or secrets were detected. These findings are disclosed, not suppressed. CI blocks fixable high/critical vulnerabilities and detected secrets; keep monitoring upstream base-image fixes before using this service operationally.
