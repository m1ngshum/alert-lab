#!/usr/bin/env python3
"""Build the pinned Node release with the exact upstream zlib security backport."""
import hashlib, json, os, shutil, subprocess, tarfile, urllib.request
from pathlib import Path

root=Path('/build');pin=json.loads((root/'node-source.json').read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def run(*command,**options):return subprocess.run(command,check=True,timeout=9000,**options)
archive=root/'node.tar.xz'
with urllib.request.urlopen(pin['url'],timeout=120) as response:archive.write_bytes(response.read())
assert sha(archive)==pin['sha256'],'Node source checksum mismatch'
with tarfile.open(archive) as source:source.extractall(root,filter='data')
source=root/('node-v'+pin['version']);gzwrite=source/'deps/zlib/gzwrite.c';patch=root/'node-zlib.patch'
assert sha(gzwrite)==pin['originalGzwriteSha256'],'Unexpected bundled zlib source'
assert sha(patch)==pin['patchSha256'],'Backport checksum mismatch'
run('patch','--batch','--fuzz=0','-p1','-i',str(patch),cwd=source)
assert sha(gzwrite)==pin['patchedGzwriteSha256'],'Patched source checksum mismatch'
run('./configure','--without-npm','--tag='+pin['tag'],cwd=source)
run('make','-j'+os.environ.get('NODE_BUILD_JOBS','4'),cwd=source)
binary=source/'out/Release/node'
version=subprocess.check_output([str(binary),'--version'],text=True).strip()
assert version=='v'+pin['version']+'-'+pin['tag'],version
receipt={**pin,'nodeVersion':version,'binarySha256':sha(binary)}
(root/'node-build.json').write_text(json.dumps(receipt,indent=2)+'\n')
shutil.copyfile(binary,root/'patched-node');(root/'patched-node').chmod(0o755)
shutil.copyfile(source/'LICENSE',root/'NODE-LICENSE')
for name in ['node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h']:
    (root/'include/node').mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source/'src'/name,root/'include/node'/name)
(root/'include/zlib').mkdir(parents=True)
for header in (source/'deps/zlib').glob('*.h'):shutil.copyfile(header,root/'include/zlib'/header.name)
shutil.rmtree(source);archive.unlink()
print('Built pinned Node with upstream bundled-zlib backport; binary regression is a separate required stage.',flush=True)
