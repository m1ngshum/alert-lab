#!/usr/bin/env python3
"""Recapture GCC libraries, package metadata and licenses after apt installation."""
import hashlib, json, shutil, subprocess
from pathlib import Path

root=Path('/runtime');expected=json.loads(Path('/build/debian.json').read_text());inventory={}
for package,library in [('libatomic1','libatomic.so.1'),('libgcc-s1','libgcc_s.so.1'),('libstdc++6','libstdc++.so.6')]:
    version=subprocess.check_output(['dpkg-query','-W','-f=${Version}',package],text=True)
    assert version==expected[package],f'Review new Debian package version before release: {package} {version}'
    files=list(Path('/usr/lib').glob('*-linux-gnu/'+library));assert len(files)==1,files
    target=root/'usr/lib'/library;shutil.copyfile(files[0],target)
    metadata=subprocess.check_output(['dpkg-query','-s',package],text=True)
    (root/'var/lib/dpkg/status.d'/package).write_text(metadata)
    docs=root/'usr/share/doc'/package
    if docs.exists():shutil.rmtree(docs)
    shutil.copytree(Path('/usr/share/doc')/package,docs,symlinks=False)
    inventory[package]={'version':version,'path':'/usr/lib/'+library,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
receipt=root/'usr/share/doc/alert-lab/libraries.json';receipt.parent.mkdir(parents=True,exist_ok=True)
receipt.write_text(json.dumps(inventory,indent=2)+'\n')
