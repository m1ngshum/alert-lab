# Internal shadow-service operations

This runbook covers the container/Helm deployment only. The anonymous public MCP Worker has separate [operations](mcp/OPERATIONS.md), with no SQLite database, ingestion token or Prometheus connector. See the [roadmap](ROADMAP.md) for planned work.

Alert Lab is a single-replica shadow service. Keep primary paging unchanged. Monitor pod readiness, `storage_write_failed`/`worker_failed` events, PVC capacity and growing unresolved episodes. Logs contain event names and episode IDs, not tokens, queries or evidence. API evidence and the database can still be sensitive; apply cluster storage encryption and restricted access appropriate to your environment.

## Backup

The image includes an online SQLite backup command. Run it within the pod, choosing a new path on the writable PVC:

```sh
kubectl -n alert-lab exec deployment/alert-lab -- node bin/backup.mjs /data/backup.db
pod="$(kubectl -n alert-lab get pod -l app.kubernetes.io/instance=alert-lab -o jsonpath='{.items[0].metadata.name}')"
(umask 077; set -C; kubectl -n alert-lab exec "$pod" -- node -e 'require("node:stream/promises").pipeline(require("node:fs").createReadStream("/data/backup.db"),process.stdout).catch(()=>{process.exitCode=1})' > ./backup.db)
```

Store the backup securely off the PVC and remove the on-volume copy after verifying it. Never copy only the live `.db` file while SQLite WAL writes are active. The backup command refuses an existing destination and creates a mode-0600 backup. Periodic backups are the deployer's responsibility.

## Restore

Stop ingestion and scale the deployment to zero. Preserve the current database and its `-wal`/`-shm` files for rollback. Restore the verified backup as `/data/alert-lab.db` using an administrative maintenance pod mounting the same PVC; ensure UID/GID 1000 ownership and mode 0600. Do not retain WAL/SHM files from the replaced database. Start one replica and verify readiness and episode history before restoring webhook delivery. Due rechecks resume from persisted state.

The service rejects newer database schemas. Schema 3 marks the database as using precise timestamp identities so older writers refuse it. Advancing from schema 2 changes the SQLite version metadata without rewriting episodes or changing tables. Advancing from schema 1 also creates the evidence configuration record introduced in schema 2. Both paths preserve episode IDs, decisions, and replay.

## Upgrade, rollback and uninstall

Back up first. Review image digest, chart diff, policy version and schema compatibility. `Recreate` deliberately allows downtime so two replicas cannot share SQLite. Alertmanager retries must remain enabled. A rollback requires a compatible database schema or restoration of a pre-upgrade backup.

Before upgrading from schema 1 or 2, or changing the alert selector, Prometheus URL, query mappings, or Prometheus credential, let the original deployment receive source resolutions for every firing episode. An episode may still be firing after its last policy decision. Check `source_status` on all pages of `GET /v1/episodes` and keep resolution delivery enabled.

Once drained, pause delivery at the receiver boundary while keeping Alertmanager retries enabled. Confirm there are still no firing episodes and verify a final backup in the original schema before switching images. After a Prometheus Secret value change, explicitly restart the replica and verify readiness before resuming delivery. The process reads the Secret at startup.

If startup reports a configuration conflict, restore the previous configuration and credential so the service can resume. If an upgrade refuses to start because episodes are still firing, the database keeps its original schema version. Redeploy the previous image with its original configuration on the same PVC, resolve the firing episodes, and retry the change. If the source cannot send resolutions, retain the old database for history and start the new configuration on a separate PVC.

After a successful schema-3 cutover, rolling back to an older writer requires restoring the compatible pre-upgrade backup. Preserve the schema-3 database for history and reconcile source events accepted after that backup before resuming collection on the old deployment.

Helm retains chart-created PVCs on uninstall. Do not delete a retained PVC until its history is backed up or intentionally discarded. Reinstall using `persistence.existingClaim` to reuse it. Scaling above one replica is unsupported and rejected by the chart.

## Legacy timestamp conflicts

New webhook deliveries use an RFC 3339 start time with a UTC designator or numeric offset and up to nine fractional digits. Equivalent representations deduplicate. Older rows keep their millisecond IDs and history. Millisecond-aligned deliveries still match those rows.

Schema 3 requires older firing episodes to resolve before cutover. An aligned delivery matching a retained legacy row is acknowledged as a duplicate of its resolved history. That row lacks the precision to distinguish the original start within the millisecond. Check the source history if an aligned event appears to have been missed.

If a finer-precision start falls in a legacy row's fingerprint and millisecond window, the receiver returns HTTP 409, logs `legacy_timestamp_conflict`, and rolls back the entire batch. Alertmanager treats this response as a terminal notification failure. Check the failed notification against authoritative source history and replay independently verified, unaffected events separately. A confirmed distinct event that must be collected before the legacy row expires needs a separate deployment and PVC. Normal retention still applies.

## Artifact verification

Use the versioned image digest in the GitHub release. Native build jobs attest their tested Docker image archives. The publishing job verifies those archives against the same source commit and release workflow, loads and rechecks them, and promotes the exact images without rebuilding. GitHub provenance covers the final image index, chart, SBOMs and custom Node receipts. Verify image provenance with `gh attestation verify oci://ghcr.io/m1ngshum/alert-lab@sha256:<digest> --repo m1ngshum/alert-lab`. Download the release's chart archive and verify it with `gh attestation verify alert-lab-0.1.4.tgz --repo m1ngshum/alert-lab`. The release includes readable CycloneDX inventories and `node-build-amd64.json` / `node-build-arm64.json` with source/patch pins, tested binary hashes and regression results. See SECURITY.md for the custom Node backport and maintenance scope.

## Failed release recovery

The release workflow verifies that the GitHub release/tag and both registry versions are absent, then reserves a draft release before registry writes. A rerun fails closed if any artifact or reservation exists. Do not delete the reservation and rerun after a partial publish: verify the existing digests and attestations, complete that same release manually, or choose a new version through a reviewed change. The workflow never intentionally overwrites a released version.

The publishing job waits at the `release` environment after both native image archives have been built, checked and attested. This repository configures that environment with the maintainer as required reviewer and protected branches only. Before approval, verify and inspect the artifacts from that exact run and obtain Astra's follow-up review, recording archive and Node binary hashes. The solo maintainer can approve their own manually invoked run; no external reviewer is required. The publishing job then independently verifies archive provenance and repeats image checks/scans before registry writes.
