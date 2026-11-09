#!/usr/bin/env python3
"""Include each custom Node binary and its backport evidence in the release SBOM."""
import json, re, sys
from pathlib import Path

directory=Path(sys.argv[1]);pin=json.loads((Path(__file__).resolve().parents[1]/'runtime/node-source.json').read_text())
outputs=[];architectures=sys.argv[2:] or ['amd64','arm64']
assert architectures and len(set(architectures))==len(architectures) and set(architectures)<={'amd64','arm64'},'Unexpected architecture'
for architecture in architectures:
    receipt=json.loads((directory/('node-build-'+architecture+'.json')).read_text())
    assert all(receipt.get(k)==v for k,v in pin.items()),'Runtime source pins differ'
    assert receipt['nodeVersion']=='v'+pin['version']+'-'+pin['tag'],'Unexpected Node build'
    assert re.fullmatch('[a-f0-9]{64}',receipt['binarySha256']),'Invalid binary digest'
    assert receipt['unpatchedControl']=={'EPIPE':'stale','EAGAIN':'stale'},'Missing negative control'
    assert receipt['patchedRegression']=={'EPIPE':'reset','EAGAIN':'reset'},'Missing fixed-binary regression'
    component={'type':'application','name':'node','version':receipt['nodeVersion'][1:],
        'bom-ref':'alert-lab:node:'+architecture,
        'purl':'pkg:generic/node@'+receipt['nodeVersion'][1:]+'?arch='+architecture,
        'hashes':[{'alg':'SHA-256','content':receipt['binarySha256']}],
        'externalReferences':[{'type':'distribution','url':pin['url']},
            {'type':'other','url':'https://github.com/madler/zlib/commit/'+pin['patchCommit'],'comment':'Applied bundled-zlib security backport'}],
        'properties':[{'name':'alert-lab:node:'+k,'value':str(v)} for k,v in pin.items()]}
    path=directory/('image-sbom-'+architecture+'.cdx.json');sbom=json.loads(path.read_text())
    assert sbom['bomFormat']=='CycloneDX'
    assert not any(c.get('bom-ref','').startswith('alert-lab:node:') for c in sbom.get('components',[])),'Node evidence already included'
    sbom.setdefault('components',[]).append(component)
    outputs.append((path,sbom))
for path,sbom in outputs:path.write_text(json.dumps(sbom,indent=2)+'\n')
