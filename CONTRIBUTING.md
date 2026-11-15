# Contributing

Open an issue describing the problem and evidence. For changes, use a branch and pull request, run the affected-surface checks below, and add a meaningful regression test for behavior changes. Keep the public playground synthetic. Never include credentials, real logs or customer data in fixtures, screenshots, issues or PRs.

Policy changes must show replay differences and retain urgent-evidence precedence, uncertainty handling, parallel security follow-up and bounded observation. Changes to runtime behavior need relevant durability/integration tests. CI must pass and discussions must be resolved before merge; this repository allows the owner to merge their own PRs.

Tool/action updates must update immutable pins and checksums. Avoid adding dependencies to browser or replay code. Do not enable automatic paging, alert suppression or remediation as an incidental change.

## Validate the surface you change

Use the pinned Node 26.13.0 and npm 12.2.2 toolchain (the root package supports Node `>=26.13.0 <27`). Root `npm test` covers the internal service, replay and playground/dogfood tests. Run relevant chart assertions and durability/integration checks for container changes.

For the separate public MCP package, run from `mcp/`:

These commands require the separate implementation checkout; this documentation-only checkpoint does not add its source, package manifests or tooling. Publishing that implementation with dedicated hosted CI remains milestone M0.

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run package
```

`npm run package` regenerates the synthetic review cases before packaging. Changes to shared `web/policy.js` or `web/replay.js` require both root and MCP suites, with replay/expectation differences reviewed. Follow [MCP local checks](mcp/README.md#local-checks) and [Worker operations](mcp/OPERATIONS.md) for build receipts, dry runs and separately authorized runtime/deployment checks.

The existing GitHub CI workflow does not yet install or run the nested MCP suite/build/package. A green root `verify` check therefore does not prove MCP coverage. Dedicated MCP CI is planned in the [roadmap](ROADMAP.md), not implemented by these instructions. Do not substitute local results for hosted checks or claim either proves native plugin-host behavior.
