#!/usr/bin/env python3
"""Validate a complete native-image scan and retain every residual finding."""
import collections, json, re, sys
from pathlib import Path

def inspect(scan,architecture,image_id):
    assert scan['SchemaVersion']==2 and scan['ArtifactType']=='container_image','Expected a full image scan'
    metadata=scan['Metadata']
    assert metadata['ImageID']==image_id and re.fullmatch('sha256:[a-f0-9]{64}',image_id),'Image identity mismatch'
    assert metadata['ImageConfig']['architecture']==architecture and architecture in ['amd64','arm64'],'Architecture mismatch'
    assert metadata['OS']['Family']=='debian','Unexpected OS'
    results=scan['Results'];assert any(r.get('Class')=='os-pkgs' and r.get('Packages') for r in results),'Missing package inventory'
    assert not any(r.get('Secrets') for r in results),'Secrets found; do not export scan contents'
    expected=json.loads((Path(__file__).resolve().parents[1]/'runtime/debian.json').read_text())
    packages={p['Name']:(str(p['Epoch'])+':' if p.get('Epoch') else '')+p['Version']+('-'+p['Release'] if p.get('Release') else '') for r in results if r.get('Class')=='os-pkgs' for p in r.get('Packages',[])}
    assert all(packages.get(k)==v for k,v in expected.items()),'Debian runtime package versions changed; review before release'
    findings=[]
    for result in results:
        for v in result.get('Vulnerabilities',[]):
            assert v['Severity'] in ['UNKNOWN','LOW','MEDIUM','HIGH','CRITICAL'],'Unknown severity'
            assert v['Severity'] not in ['HIGH','CRITICAL'],'High/critical vulnerability found'
            assert not v.get('FixedVersion'),'A vendor fix is available; patch before release'
            assert re.fullmatch('CVE-[0-9]{4}-[0-9]+',v['VulnerabilityID']),'Unexpected vulnerability identifier'
            findings.append((v['PkgName'],v['InstalledVersion'],v['VulnerabilityID'],v['Severity'],v.get('Status','unknown')))
    return sorted(findings)

def main():
    scan_path,architecture,image_id,output,*previous=sys.argv[1:]
    scan=json.loads(Path(scan_path).read_text());findings=inspect(scan,architecture,image_id)
    if previous:
        assert len(previous)==1 and findings==inspect(json.loads(Path(previous[0]).read_text()),architecture,image_id),'Findings changed after review; obtain follow-up review'
    counts=dict(sorted(collections.Counter(f[3] for f in findings).items()));unique=len({f[2] for f in findings})
    def safe(value):return str(value).replace('\\','\\\\').replace('|','\\|').replace('`','\\`').replace('\n',' ')
    lines=['# Native image security inventory','',f'Architecture: {architecture}. Image ID: `{image_id}`.',
           f'Scan created: {scan["CreatedAt"]}. Trivy version: {scan["Trivy"]["Version"]}.',
           f'Package findings: {len(findings)}; unique CVEs: {unique}; severities: {counts}.','',
           'No HIGH/CRITICAL findings, secrets or available vendor fixes were accepted. Remaining findings are disclosed, not suppressed or claimed fixed. Package-level detection is not proof of application reachability. See SECURITY.md for vendor status and limitations.','',
           '| Package | Installed version | CVE | Severity | Vendor status |','| --- | --- | --- | --- | --- |']
    for name,version,cve,severity,status in findings:
        lines.append(f'| {safe(name)} | {safe(version)} | [{cve}](https://security-tracker.debian.org/tracker/{cve}) | {severity} | {safe(status)}; no fixed version reported |')
    Path(output).write_text('\n'.join(lines)+'\n')

if __name__=='__main__':main()
