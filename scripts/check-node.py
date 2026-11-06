#!/usr/bin/env python3
"""Check the actual bundled implementation in both the control and rebuilt Node."""
import hashlib, json, subprocess
from pathlib import Path

root=Path('/build');receipt=json.loads((root/'node-build.json').read_text());binary=root/'patched-node'
assert hashlib.sha256(binary.read_bytes()).hexdigest()==receipt['binarySha256']
subprocess.run(['cc','-shared','-fPIC','-Wall','-Wextra','-Werror','-I/build/include/node','-I/build/include/zlib',
                '/build/node-zlib.c','-ldl','-o','/build/zlib-check.node'],check=True,timeout=60)
needed=subprocess.check_output(['readelf','-d','/build/zlib-check.node'],text=True)
assert 'libz.so' not in needed,'Regression must exercise Node, not system zlib'
def regression(executable):
    result=subprocess.check_output([str(executable),'-e',"console.log(require('/build/zlib-check.node'))"],text=True,timeout=30)
    return json.loads(result)
baseline=regression('/usr/local/bin/node');fixed=regression(binary)
assert baseline=={'EPIPE':'stale','EAGAIN':'stale'},baseline
assert fixed=={'EPIPE':'reset','EAGAIN':'reset'},fixed
receipt.update(unpatchedControl=baseline,patchedRegression=fixed)
(root/'node-build.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('PASS: actual Node bundled-zlib EPIPE/EAGAIN controls fail before backport and pass after backport',flush=True)
