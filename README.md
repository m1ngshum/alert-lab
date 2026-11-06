# Alert Lab

From alert evidence to accountable follow-up: an interactive playground, deterministic replay tool and deployable **shadow-mode** service.

The service receives Alertmanager webhooks, reads explicitly configured Prometheus evidence, records recommendations and performs bounded rechecks. It never changes workloads, silences alerts, pages responders or calls a model. Keep your existing paging path active.

## Playground and replay

Open the public demo linked in this repository's About section, or serve `web/` with `python3 -m http.server 8771 --directory web`.

Choose one of five scenarios, edit evidence, inspect the decision and simulate rechecks. Import JSON to replay ordered evidence snapshots separately from the sliders. Export current evidence or download JSON/Markdown results. The public demo uses synthetic evidence and makes no connection to a deployed runtime.

With Node 26.13.0:

```sh
node bin/replay.mjs web/examples.json
node bin/replay.mjs web/examples.json --format markdown
```

Replay needs no dependencies. Format: `{"schemaVersion":1,"cases":[{"id":"example","steps":[{"evidence":{...},"expectedKind":"observe"}]}]}`. Use `web/examples.json` for complete valid evidence. Each step needs explicit `rechecks`; `expectedKind` is optional (`observe`, `review`, `security`, `page`, `resolved`). An omitted expectation is reported as unasserted. The policy and format have separate versions. Reports have no runtime timestamps.

Limits: 1 MiB input, 1,000 total steps, unique case IDs. Exit codes: 0 success, 1 expectation mismatch, 2 input/usage error. Input is data, never executable code. Markdown reports escape imported strings.

## Install the service

The OCI image is `ghcr.io/m1ngshum/alert-lab:0.1.2` (Linux amd64/arm64). The chart is `oci://ghcr.io/m1ngshum/charts/alert-lab`, version `0.1.2`. Pin the image digest from the release for reproducible installations.

Create a namespace and an existing Secret using a token file containing at least 32 random non-whitespace characters. Do not place tokens in Helm values or command-line literals:

```sh
kubectl create namespace alert-lab
kubectl -n alert-lab create secret generic alert-lab-auth --from-file=service-token=/private/path/service-token
helm install alert-lab oci://ghcr.io/m1ngshum/charts/alert-lab --version 0.1.2 -n alert-lab --set credentials.existingSecret=alert-lab-auth -f my-values.yaml
```

Review your kubeconfig/context before these user-run installation commands. The repository's automated kind test always uses its own isolated kubeconfig.

The chart installs one replica with Recreate updates, a retained 1 GiB PVC and a ClusterIP service. No ingress, Kubernetes API access or generated credentials. Existing PVCs and Prometheus credential Secrets are supported; see `charts/alert-lab/values.yaml`. Kubernetes 1.35+ and Helm 4 are the supported baseline; the integration test pins Kubernetes 1.37.

Configure Alertmanager with `send_resolved: true`, `max_alerts: 0` and an authenticated webhook to `http://alert-lab:8080/v1/webhooks/alertmanager`. Mount its copy of the bearer token and use `http_config.authorization.credentials_file`. Preserve your existing receiver using a parallel route with `continue: true`; Alert Lab must not become your sole notification receiver.

## Evidence configuration

One deployment has one exact-match alert-label selector and one fixed Prometheus base URL. Each mapping needs `query`, `freshnessQuery` and `maxAgeSeconds` (1–3600). Queries never come from alerts and cannot interpolate labels. Scope every query to the same service/traffic window represented by the configured selector; deploy separately for other services.

```json
{
  "selector": {"alertname":"Api400Spike","service":"example-api"},
  "prometheus": {
    "url":"http://prometheus.monitoring.svc:9090",
    "queries": {
      "cpu": {
        "query":"example_api_cpu_percent{service=\"example-api\"}",
        "freshnessQuery":"time() - timestamp(example_api_cpu_percent{service=\"example-api\"})",
        "maxAgeSeconds":120
      }
    }
  }
}
```

Query results must be one finite scalar or one instant-vector sample, with no warnings/partial-data notices. `freshnessQuery` returns **source data age in seconds**. Account for original samples when using aggregations/recording rules; their evaluation timestamp alone does not establish freshness. Negative age, old data, ambiguity, failure or missing mappings remain unknown and require review. Requests have individual timeouts, a total collection budget and response-size limits; redirects are rejected and TLS validation stays enabled.

Numeric fields: `rate`, `success`, `cpu`, `memory` are percentages (0–100); `latency` is p95 milliseconds (0–10,000). Boolean fields: `logs`, `samples`, `metrics`, `journeys` accept 0/1. Categorical fields require an explicit `values` map, such as `{"0":"unknown","1":"suspicious","2":"confirmed"}` for `security`. Supported categories are visible in the playground. `consistency` is `consistent` or `conflicting`. The service supplies the recheck count and policy-only classifier gate internally; no inference occurs.

Do not configure constant healthy evidence in real deployments. An available metric cannot establish that rejection samples were inspected or that security evidence is clear. Those fields require actual instrumented evidence; omit them when unavailable. The example above intentionally cannot reach automatic observation by itself. All policy thresholds are illustrative and require service-specific evaluation before operational use.

## Episodes and API

`POST /v1/webhooks/alertmanager` accepts complete v4 batches of 1–100 alerts, up to 1 MiB. Accepted state and pending work are committed before HTTP 202. Invalid/truncated batches fail validation; storage failure or capacity exhaustion returns 503 so Alertmanager can retry.

All `/v1/` endpoints require `Authorization: Bearer <token>`:

| Endpoint | Result |
|---|---|
| `GET /v1/episodes?cursor=0&limit=50` | Sequence-based pagination, maximum 100 |
| `GET /v1/episodes/{id}` | Source lifecycle, normalized evidence and decisions |
| `GET /v1/episodes/{id}/replay` | Replay-compatible evidence with recorded decisions as expectations |

`GET /healthz` and `/readyz` return status only. Readiness checks writable database storage. Detailed API responses may contain operational evidence: keep this service internal and use TLS termination when crossing a trust boundary. It is single-tenant; the bearer token grants ingestion and reading.

Episodes are identified by fingerprint plus normalized start time from a single trusted Alertmanager source. Retries do not duplicate episodes or reset deadlines. Observation rechecks after five minutes; two persistent rechecks end observation and recommend review. Other outcomes await a new source episode. Due work resumes after restart; stale in-flight work cannot overwrite source resolution.

Resolved source events cancel rechecks and are retained independently of policy conclusions. They do not prove health. Completed source-resolved episodes are deleted after seven days. Unresolved episodes are retained, with a limit of 1,000 open episodes and backpressure at capacity. Only allowlisted labels (`alertname`, `service`, `namespace`, `severity`), normalized evidence and decisions are stored. Raw annotations/logs/credentials are omitted.

## Local Kubernetes verification

Requires a running Docker daemon, Python 3 and kubectl. Install checksum-pinned tools without changing system packages:

```sh
python3 scripts/install-tools.py helm kind trivy gitleaks
PATH="$PWD/.tools:$PATH" node scripts/chart-check.mjs
docker build -t alert-lab:local .
PATH="$PWD/.tools:$PATH" python3 scripts/kind-test.py
```

The test creates and deletes its own kind cluster and kubeconfig. Real Prometheus/Alertmanager use explicitly synthetic constant-vector evidence. It verifies webhook delivery, evidence collection, bounded follow-up, restart recovery and Helm upgrade persistence. Only its disposable test database clock is advanced to avoid a ten-minute wait; production intervals remain five minutes. Images are pinned in `examples/images.lock.json`.

## Development and release

Use the pinned current Node/npm versions in `tools.lock.json` and `package.json`, then `npm ci` and `npm test`. CI verifies tests, chart assertions, secret/dependency/image scans, real kind integration and CodeQL. Public-release workflow is manually invoked on protected `main`; it checks successful verification for that exact commit, publishes versioned multi-architecture images/OCI chart and attaches provenance and SBOMs.

The container builds a checksum-pinned Node source release with the upstream bundled-zlib backport in `patches/node-zlib.patch`. The custom version, source/patch pins, binary digest and direct regression results are included in each image and release. Both architectures build and test natively; the first source build is substantially slower than pulling the upstream binary, and later builds reuse compilation layers. Local development Node installations are unchanged. See [SECURITY.md](SECURITY.md) for the fix and maintenance scope.

No runtime credentials or evidence enter the public playground. Reporting reduced paging, incident accuracy or production readiness requires historical evaluation and shadow-operation evidence that this project does not yet have.
