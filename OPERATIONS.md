# Operations

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

The schema is versioned. The service rejects databases from a newer schema rather than downgrading them. Version 0.1.0 creates schema 1; it contains no upgrade migration from other products.

## Upgrade, rollback and uninstall

Back up first. Review image digest, chart diff, policy version and schema compatibility. `Recreate` deliberately allows downtime so two replicas cannot share SQLite. Alertmanager retries must remain enabled. A rollback requires a compatible database schema or restoration of a pre-upgrade backup.

Helm retains chart-created PVCs on uninstall. Do not delete a retained PVC until its history is backed up or intentionally discarded. Reinstall using `persistence.existingClaim` to reuse it. Scaling above one replica is unsupported and rejected by the chart.

## Artifact verification

Use the versioned image digest in the GitHub release. Native build jobs attest their tested Docker image archives. The publishing job verifies those archives against the same source commit and release workflow, loads and rechecks them, and promotes the exact images without rebuilding. GitHub provenance covers the final image index, chart, SBOMs and custom Node receipts. Verify image provenance with `gh attestation verify oci://ghcr.io/m1ngshum/alert-lab@sha256:<digest> --repo m1ngshum/alert-lab`. Download the release's chart archive and verify it with `gh attestation verify alert-lab-0.1.2.tgz --repo m1ngshum/alert-lab`. The release includes readable CycloneDX inventories and `node-build-amd64.json` / `node-build-arm64.json` with source/patch pins, tested binary hashes and regression results. See SECURITY.md for the custom Node backport and maintenance scope.

## Failed release recovery

The release workflow verifies that the GitHub release/tag and both registry versions are absent, then reserves a draft release before registry writes. A rerun fails closed if any artifact or reservation exists. Do not delete the reservation and rerun after a partial publish: verify the existing digests and attestations, complete that same release manually, or choose a new version through a reviewed change. The workflow never intentionally overwrites a released version.
