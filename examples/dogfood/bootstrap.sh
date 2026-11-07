#!/bin/sh
set -eu
# Run only in the named isolated guest, never on the Mac or an existing server.
[ "$(uname -s)" = Linux ] && [ ! -e /mnt/mac ] && [ -z "${SSH_AUTH_SOCK:-}" ] && [ "$(id -un)" = lab ] && [ "$(hostname -s)" = alert-lab-dogfood ] && [ "${ALERT_LAB_SANDBOX:-}" = alert-lab-dogfood ] && [ -f /etc/alert-lab-vm ] && [ "$(stat -c %u /etc/alert-lab-vm)" = 0 ] && [ "$(cat /etc/alert-lab-vm)" = "$(printf '%s\n%s' alert-lab-dogfood "$(cat /etc/machine-id)")" ] || { echo 'Refusing bootstrap outside the explicitly provisioned lab VM' >&2; exit 2; }
cd "$(dirname "$0")/../.."
sudo apt-get update
sudo apt-get install -y podman uidmap slirp4netns git ca-certificates python3
if ! grep -q '^lab:' /etc/subuid; then sudo usermod --add-subuids 100000-165535 lab; fi
if ! grep -q '^lab:' /etc/subgid; then sudo usermod --add-subgids 100000-165535 lab; fi
sudo loginctl enable-linger lab
printf '%s\n' 'd /dev/mapper 0755 root root -' | sudo tee /etc/tmpfiles.d/alert-lab.conf >/dev/null
sudo systemd-tmpfiles --create /etc/tmpfiles.d/alert-lab.conf
podman system migrate
printf '%s\n%s\n' alert-lab-dogfood "$(cat /etc/machine-id)" | sudo tee /etc/alert-lab-dogfood >/dev/null
python3 scripts/install-tools.py helm kind kubectl
printf '%s\n' 'Bootstrap complete. Put this checkout/.tools on PATH and run examples/dogfood/lab.py up as lab.'
