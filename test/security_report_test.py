import copy,importlib.util,json,tempfile,unittest
from unittest.mock import patch
from pathlib import Path

spec=importlib.util.spec_from_file_location('security_report',Path(__file__).resolve().parents[1]/'scripts/security-report.py')
report=importlib.util.module_from_spec(spec);spec.loader.exec_module(report)
class SecurityReportTest(unittest.TestCase):
    def setUp(self):
        packages=json.loads((Path(__file__).resolve().parents[1]/'runtime/debian.json').read_text())
        self.identifier='sha256:'+'a'*64
        self.scan={'SchemaVersion':2,'ArtifactType':'container_image','Metadata':{'ImageID':self.identifier,'ImageConfig':{'architecture':'arm64'},'OS':{'Family':'debian'}},'Results':[{'Class':'os-pkgs','Packages':[{'Name':k,'Version':v.rsplit('-',1)[0],'Release':v.rsplit('-',1)[1]} for k,v in packages.items()],'Vulnerabilities':[{'PkgName':'libc6','InstalledVersion':packages['libc6'],'VulnerabilityID':'CVE-2026-84243','Severity':'MEDIUM','Status':'affected'}]}]}
    def test_retains_residual_findings_and_rejects_available_fixes_secrets_or_wrong_image(self):
        self.assertEqual(report.inspect(self.scan,'arm64',self.identifier)[0][2],'CVE-2026-84243')
        for change in ['fixed','high','secret','inventory','version']:
            scan=copy.deepcopy(self.scan);r=scan['Results'][0]
            if change=='fixed':r['Vulnerabilities'][0]['FixedVersion']='2.41-12+deb13u5'
            elif change=='high':r['Vulnerabilities'][0]['Severity']='HIGH'
            elif change=='secret':r['Secrets']=[{'Severity':'LOW'}]
            elif change=='inventory':r['Packages']=[]
            else:r['Packages'][0]['Version']='unexpected'
            with self.subTest(change=change),self.assertRaises(AssertionError):report.inspect(scan,'arm64',self.identifier)
        with self.assertRaises(AssertionError):report.inspect(self.scan,'amd64',self.identifier)
        with self.assertRaises(AssertionError):report.inspect(self.scan,'arm64','sha256:'+'b'*64)
    def test_distinguishes_package_counts_from_unique_cves(self):
        duplicate=copy.deepcopy(self.scan['Results'][0]['Vulnerabilities'][0]);duplicate['PkgName']='other'
        self.scan['Results'][0]['Vulnerabilities'].append(duplicate)
        findings=report.inspect(self.scan,'arm64',self.identifier)
        self.assertEqual(len(findings),2);self.assertEqual(len({f[2] for f in findings}),1)
    def test_drift_or_invalid_rescan_cannot_overwrite_reviewed_report(self):
        self.scan.update(CreatedAt='2026-11-09T00:00:00Z',Trivy={'Version':'0.76.2'})
        with tempfile.TemporaryDirectory() as directory:
            directory=Path(directory);previous=directory/'previous.json';current=directory/'current.json';output=directory/'report.md'
            previous.write_text(json.dumps(self.scan));current.write_text(json.dumps(self.scan))
            arguments=['security-report',str(current),'arm64',self.identifier,str(output),str(previous)]
            with patch('sys.argv',arguments):report.main()
            original=output.read_text();self.assertIn('unique CVEs: 1',original)
            changed=copy.deepcopy(self.scan);changed['Results'][0]['Vulnerabilities'][0]['Status']='changed'
            current.write_text(json.dumps(changed))
            with patch('sys.argv',arguments),self.assertRaises(AssertionError):report.main()
            self.assertEqual(output.read_text(),original)
