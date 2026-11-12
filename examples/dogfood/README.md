# Persistent isolated full-VM lab

This lab runs the published v0.1.2 image and chart with real Prometheus, Alertmanager and an authenticated synthetic workload. It keeps real five-minute rechecks and persistent SQLite history. Everything is synthetic; security/rejection/journey evidence describes only the instrumented self-generated workload, never your Mac or production traffic.

## Host isolation

Use the pinned Lima 2.3.0 **VZ full VM in plain mode** on an Apple Silicon Mac. It has its own Linux kernel, no Mac directory mounts, no forwarded SSH agent, no guest agent, no dynamic port forwarding and no Docker Desktop integration. Tools and VM state use a dedicated private directory; do not change Docker contexts, existing kubeconfigs or shell startup files.

The template disables host-loopback access using Lima's host-side `networkOpts.hostLoopback: false`. It also disables host DNS/proxy inheritance. Guest nftables blocks new outbound private-network/metadata connections and external IPv6; public IPv4 internet remains available. This guest firewall is a guard against accidental access, not a boundary against guest root, which can change its own rules. Use synthetic data and sandbox credentials only.

OrbStack was rejected for this workflow: in tested 2.2.5, GUI and command-line startups rewrote Docker's credential-helper setting and user plugin links even with its Docker Engine disabled. Restoring those files afterward does not satisfy unchanged host configuration. This lab does not install, launch or repair OrbStack.

From a reviewed checkout on the Mac, install the official checksum-pinned Lima bundle without Homebrew or global tool changes:

```sh
export ALERT_LAB_VM_ROOT="$HOME/.local/share/alert-lab-vm"
export LIMA_HOME="$ALERT_LAB_VM_ROOT/lima"
export PATH="$ALERT_LAB_VM_ROOT/tools/lima/bin:$PATH"
(
set -eu
mkdir -p "$ALERT_LAB_VM_ROOT/tools/lima" "$LIMA_HOME"
chmod 700 "$ALERT_LAB_VM_ROOT" "$LIMA_HOME"
curl -fL https://github.com/lima-vm/lima/releases/download/v2.3.0/lima-2.3.0-Darwin-arm64.tar.gz -o "$ALERT_LAB_VM_ROOT/lima.tgz"
printf '%s  %s\n' b7af444bd8f91d3c307477e562f2cf3bd7595d62b9429185e4fa841563578cfc "$ALERT_LAB_VM_ROOT/lima.tgz" | shasum -a 256 -c -
tar -xzf "$ALERT_LAB_VM_ROOT/lima.tgz" -C "$ALERT_LAB_VM_ROOT/tools/lima"
limactl start --name alert-lab-dogfood --tty=false examples/dogfood/lima.yaml
limactl shell --workdir /home/lab alert-lab-dogfood
)
```

`lima.yaml` pins the Ubuntu image digest and limits the VM to four CPUs, 6 GiB memory and a 32 GiB disk. The root provisioning marker binds its identity to its machine ID. Use this dedicated `LIMA_HOME`; do not adopt an existing Lima instance or enable mounts, host-loopback access or agent forwarding. The pins are also recorded in `tools.lock.json`.

## Setup inside the guest

Clone inside the VM, never mount your Mac checkout. Use a reviewed revision. During local development, selectively copy only lab sources/tests and the tool lock with `limactl copy`; do not copy credentials, home directories or Docker configuration.

```sh
git clone https://github.com/m1ngshum/alert-lab.git
cd alert-lab
ALERT_LAB_SANDBOX=alert-lab-dogfood sh examples/dogfood/bootstrap.sh
export PATH="$PWD/.tools:$PATH"
python3 examples/dogfood/lab.py up
python3 examples/dogfood/lab.py status
```

Bootstrap installs rootless Podman and enables lingering for `lab`, so the kind node survives terminal disconnects. The launcher refuses macOS, missing or changed VM/bootstrap markers, host mounts and forwarded agents. It forces guest-local rootless Podman and its own kubeconfig; ownership binds the guest, UID, provider, node ID and kubeconfig hash. Existing unowned or changed resources are refused. A failed cluster creation does not create an ownership record; inspect and remove only that failed lab node before retrying.

## Manual exercises

Use the browser controls below for spike, recovery and replay without the CLI. Optional guest commands:

```sh
python3 examples/dogfood/lab.py scenario spike
python3 examples/dogfood/lab.py episodes
# Keep the spike active for at least ten minutes to see two real persisted rechecks.
python3 examples/dogfood/lab.py restart
python3 examples/dogfood/lab.py up  # Helm upgrade; keeps token, PVC and history
python3 examples/dogfood/lab.py scenario recovery
python3 examples/dogfood/lab.py replay EPISODE_ID > replay.json
```

Replay the exported evidence inside the pinned container without installing Node on the Mac or VM:

```sh
podman run --rm --network=none --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  -v "$PWD/replay.json:/replay.json:ro" \
  ghcr.io/m1ngshum/alert-lab@sha256:aad5f89aeb6aa742bdc7fc44a81c4cdc84169621427528cbcbe3131e5691d9f0 \
  node bin/replay.mjs /replay.json
```

Add `--format markdown` after the input path for a Markdown report.

Baseline/recovery emit valid requests; spike emits a mix of valid and deliberately invalid requests. Prometheus scrapes observed response rate, valid-request success, latency, Node CPU usage as a fraction of one core and RSS as a fraction of the workload's 256 MiB limit. Bounded probe records supply explicitly synthetic audit/sample evidence. An unauthorized sample request makes the synthetic security assessment unknown. Missing samples prevent automatic observation.

Recovery clears the alert at its source; source resolution is separate from a healthy policy conclusion. Restarting Prometheus or Alertmanager can create a new source start time and therefore a separate episode; an earlier episode is not assumed resolved without its matching source event. Monitoring fixtures use disposable storage, while Alert Lab history uses its retained PVC.

Run `lab.py tunnel` in a guest terminal. From a second Mac terminal with the same `LIMA_HOME`, forward only loopback using Lima's private generated SSH configuration:

```sh
ssh -F "$LIMA_HOME/alert-lab-dogfood/ssh.config" -S none -o ForwardAgent=no -o StrictHostKeyChecking=yes -o ExitOnForwardFailure=yes -N -L 127.0.0.1:8780:127.0.0.1:8780 lima-alert-lab-dogfood
```

Open `http://127.0.0.1:8780/`. Run `lab.py token` inside the guest and paste the sandbox-only token into the password field. The page keeps it in memory only; requests use the Authorization header. Do not put tokens in URLs, shell arguments, screenshots or committed files. Controls and episode/replay data require authentication; static UI/policy assets, `/healthz` and `/metrics` contain only public synthetic fixture information.

The **Auto-refresh every 5 seconds** checkbox is enabled initially. Entering the token starts polling while the page is visible. The page follows newly discovered episodes; selecting an episode pins it until you click **Spike** again. **Refresh episodes** and **Run replay** remain available while auto-refresh is paused. **Load more episodes** reads the next page; auto-refresh also discovers subsequent pages without dropping the current selection.

For the full workflow, click **Start ten-minute exercise**. It checks that prior episodes are resolved, starts a fresh spike, pins its new episode, waits for recorded `observe → observe → review` at counts `0 → 1 → 2`, requests recovery, waits for source resolution, then requests one ZIP download containing `replay.json` and `replay.md`. Keep this page open and visible. Token, episode, scenario and polling controls are locked during the exercise. **Cancel and recover** ends automation and requests recovery without automatic downloads; it becomes available after the startup request finishes. Cancellation does not claim source resolution until the timeline records it. Unexpected decisions, early resolution, request failures or a twenty-minute limit stop automation with recovery unconfirmed; use **Recovery** and check the timeline before retrying. Reloading/closing the page stops browser automation and does not recover the workload. A single archive avoids requesting multiple automatic files; browser restrictions can still block any download. If blocked, the report buttons remain available afterward.

Click **Spike** and watch **Live timeline**: source start, recorded decisions with their service timestamps, and the next collection due time. Keep the spike active for ten minutes to see `observe → observe → review` at recheck counts `0 → 1 → 2`. The **Ten-minute exercise** progress bar advances only on recorded rechecks (`0/2`, `1/2`, `2/2`), with the latest recommendation alongside it. The live countdown estimates time until the service's persisted next collection due time using the browser clock; it does not schedule work. At zero it waits for recorded evidence. Paused, hidden or stale updates suppress the countdown; early source resolution keeps partial progress. Click **Recovery**; auto-refresh will show source resolution separately from the policy conclusion. Replay results and downloads update from the same recorded evidence without manual refresh. These are real five-minute collection intervals; the shared illustrative policy explanation may refer to simulated rechecks.

Open **Exercise history** to review persisted episodes or download a past run’s ZIP without starting another spike. History includes manual spikes because the service does not distinguish one-click runs. Resolved episodes are retained for seven days after source resolution; unresolved episodes remain. Newest loaded episodes appear first. Use **Load more episodes** or auto-refresh to load further pages. Listed source statuses are snapshots; **Review** refreshes the selected run and its recorded decisions. **Download ZIP** fetches that run before exporting `replay.json` and `replay.md`. Both actions only read data, stay locked during an exercise, and clear stale reports on failure. Episodes without recorded decisions cannot be exported. Changing the token clears the panel.

Use **Compare latest two episodes** in history for side-by-side evidence and recorded policy decisions. It reads all listing pages, then fetches the two latest episodes by recording order, including manual spikes. Tables align steps by recorded order and label changed values. **Changes only** hides unchanged rows locally without new requests; captions count changed fields and explicitly identify steps with no differences. Turn it off to restore every row. The filter preference lasts until reload. Numeric **Delta** is latest minus previous in the original units, rounded to six significant digits with `≈` when rounded. Zero means no numeric difference; `—` means no numeric delta for missing, unknown or non-numeric values; overflow says **Out of range**. Raw values remain unchanged. As before, missing fields/steps say **Not recorded**, while JSON `null` remains unknown. It shows a fetched-at snapshot, not a live comparison or a rerun of policy. Source status/resolution stay separate from decisions. Click Compare again to refresh; other foreground actions, token changes and request failures clear the snapshot. The tables scroll horizontally on narrow screens and their region is keyboard focusable. Comparison itself triggers no spike, recovery or download. **Download changes JSON** and **Download changes Markdown** export only changed fields from this loaded snapshot, regardless of the checkbox. Both include full previous/latest episode IDs, the fetched-at time, ordered-step alignment and source-resolution caveats. JSON preserves raw values with explicit `recorded` flags for missing fields, exact finite `numericDelta` values and the displayed `delta` text (including rounding or overflow); Markdown escapes imported text and uses displayed deltas. Empty sections say no differences. These comparison reports are not replay inputs. Exports make no requests and clear/lock with the comparison after token changes, errors or foreground actions.

Download **Evidence JSON** (importable into the playground), **Report JSON** or **Report Markdown**. Replay runs locally using the shared policy and never schedules work. Requests are serialized. Token changes and failed requests clear stale reports; failures pause auto-refresh until you retry and enable it again. Episodes without decisions show a waiting message. Polling pauses in hidden tabs, so a visible page may show updates a few seconds after the service records them. The last-update time indicates freshness; it is not an evidence timestamp. Reloading clears the token. Updating fixture assets rolls the workload back to baseline while retaining service history and its PVC; reconnect the guest tunnel after that rollout.

## Stop, resume and destruction

`lab.py stop` stops the owned kind node and preserves data; `lab.py up` starts it and reapplies the chart. From the Mac, `limactl stop alert-lab-dogfood` stops only this VM and preserves its disk. Resume with `limactl start alert-lab-dogfood`, enter the guest and run `lab.py up`. Re-establish both foreground tunnels after a VM/node restart. Verify `systemctl is-active alert-lab-egress` and `sudo nft list table inet alert_lab` after reboot.

`lab.py down --destroy` explicitly deletes the owned kind cluster and its lab history; it never targets another kubeconfig or cluster. `limactl delete alert-lab-dogfood` discards the dedicated VM's entire disk; use it only when you want to destroy the sandbox.

Guest logs: `kubectl --kubeconfig ~/.local/share/alert-lab-dogfood/kubeconfig --context kind-alert-lab-dogfood -n alert-lab-dogfood logs deployment/alert-lab` (or workload/prometheus/alertmanager). Test credentials and state live in the sandbox's private `~/.local/share/alert-lab-dogfood` directory and Kubernetes Secret.
