#!/usr/bin/env python3
"""Install checksum-pinned verification tools without changing system packages."""
import hashlib, io, json, os, platform, sys, tarfile, urllib.request, zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
lock=json.loads((root/'tools.lock.json').read_text())
destination=Path(os.environ.get('ALERT_LAB_TOOLS',root/'.tools'));destination.mkdir(parents=True,exist_ok=True)
system={'Darwin':'darwin','Linux':'linux'}[platform.system()]
machine={'arm64':'arm64','aarch64':'arm64','x86_64':'amd64'}[platform.machine()]
for name in sys.argv[1:] or ['helm','kind','trivy','gitleaks']:
    entry=lock['tools'][name][system+'-'+machine]
    with urllib.request.urlopen(entry['url'],timeout=120) as response:data=response.read()
    if hashlib.sha256(data).hexdigest()!=entry['sha256']:raise RuntimeError('Checksum mismatch: '+name)
    executable='gh' if name=='cli' else name
    if entry['url'].endswith('.tar.gz'):
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            member=next(m for m in archive.getmembers() if m.isfile() and Path(m.name).name==executable)
            data=archive.extractfile(member).read()
    elif entry['url'].endswith('.zip'):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:data=archive.read(next(n for n in archive.namelist()if Path(n).name==executable))
    target=destination/executable;target.write_bytes(data);target.chmod(0o755)
    print(executable+' '+entry['version'])
