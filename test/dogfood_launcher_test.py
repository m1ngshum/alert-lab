import hashlib,importlib.util,json,os,tempfile,unittest
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('lab',Path(__file__).resolve().parents[1]/'examples/dogfood/lab.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab)
class LauncherTests(unittest.TestCase):
    def test_guard_forces_local_rootless_provider(self):
        from subprocess import CompletedProcess
        def read(p):return 'alert-lab-dogfood\nguest\n' if str(p) in ['/etc/alert-lab-dogfood','/etc/alert-lab-vm'] else 'guest\n'
        with tempfile.TemporaryDirectory() as d,patch.object(lab,'STATE',Path(d)),patch.object(lab.platform,'system',return_value='Linux'),patch.object(lab.platform,'node',return_value=lab.NAME),patch.object(lab.Path,'is_file',return_value=True),patch.object(lab.Path,'stat',return_value=SimpleNamespace(st_uid=0,st_mode=0o40700)),patch.object(lab.Path,'read_text',read),patch.object(lab.Path,'exists',return_value=False),patch.object(lab.os,'getuid',return_value=501),patch.object(lab.pwd,'getpwuid',return_value=SimpleNamespace(pw_name='lab')),patch.dict(lab.os.environ,{'HOME':str(Path.home()),'CONTAINER_HOST':'ssh://foreign','CONTAINERS_CONF_OVERRIDE':'foreign','DOCKER_CONTEXT':'foreign','KIND_EXPERIMENTAL_PROVIDER':'docker'},clear=True),patch.object(lab,'run',return_value=CompletedProcess([],0,json.dumps({'host':{'security':{'rootless':True},'cgroupVersion':'v2'}}))) as run:
            lab.guard()
            self.assertNotIn('CONTAINER_HOST',lab.os.environ);self.assertNotIn('CONTAINERS_CONF_OVERRIDE',lab.os.environ);self.assertNotIn('DOCKER_CONTEXT',lab.os.environ)
            self.assertEqual(lab.os.environ['KIND_EXPERIMENTAL_PROVIDER'],'podman')
            self.assertEqual(run.call_args.args[0][:2],['podman','--remote=false'])
    def test_host_refused_before_tools(self):
        with patch.object(lab.platform,'system',return_value='Darwin'),patch.object(lab,'run') as run:
            with self.assertRaisesRegex(RuntimeError,'dedicated isolated'):lab.guard()
            run.assert_not_called()
    def test_missing_guest_marker_refused(self):
        with patch.object(lab.platform,'system',return_value='Linux'),patch.object(lab.Path,'is_file',return_value=False),patch.object(lab,'run') as run:
            with self.assertRaises(RuntimeError):lab.guard()
            run.assert_not_called()
    def test_linux_without_full_vm_marker_refused(self):
        def read(p):return 'alert-lab-dogfood\nguest\n' if str(p)=='/etc/alert-lab-dogfood' else 'guest\n'
        with patch.object(lab.platform,'system',return_value='Linux'),patch.object(lab.platform,'node',return_value=lab.NAME),patch.object(lab.Path,'is_file',lambda p:str(p)!='/etc/alert-lab-vm'),patch.object(lab.Path,'stat',return_value=SimpleNamespace(st_uid=0)),patch.object(lab.Path,'read_text',read),patch.object(lab,'run') as run:
            with self.assertRaisesRegex(RuntimeError,'full-VM'):lab.guard()
            run.assert_not_called()
    def test_restart_waits_for_api(self):
        from subprocess import CalledProcessError,CompletedProcess
        with patch.object(lab,'kube',side_effect=[CalledProcessError(1,['kubectl']),CompletedProcess([],0,'ok')]) as kube,patch.object(lab.time,'sleep'):
            lab.wait_ready();self.assertEqual(kube.call_count,2)
    def test_restart_waits_for_service_routing(self):
        from subprocess import CalledProcessError,CompletedProcess
        with patch.object(lab,'kube',side_effect=[CalledProcessError(1,['kubectl']),CompletedProcess([],0,'')]) as kube,patch.object(lab.time,'sleep'):
            lab.wait_service();self.assertEqual(kube.call_count,2)
    def test_readiness_timeout_is_bounded(self):
        from subprocess import CalledProcessError
        with patch.object(lab,'kube',side_effect=CalledProcessError(1,['kubectl'])),patch.object(lab.time,'sleep'),patch.object(lab.time,'monotonic',side_effect=[0,1,181]):
            with self.assertRaisesRegex(RuntimeError,'180seconds'):lab.wait_ready()
    def test_failed_create_does_not_create_ownership(self):
        from subprocess import CalledProcessError
        with tempfile.TemporaryDirectory() as d,patch.object(lab,'STATE',Path(d)),patch.object(lab,'run',side_effect=CalledProcessError(1,['kind'])):
            with self.assertRaises(CalledProcessError):lab.create_cluster('image')
            self.assertFalse((Path(d)/'owned').exists())
    def test_stale_record_prevents_creation(self):
        with tempfile.TemporaryDirectory() as d,patch.object(lab,'STATE',Path(d)),patch.object(lab,'run') as run:
            (Path(d)/'owned').write_text('{}')
            with self.assertRaisesRegex(RuntimeError,'Stale'):lab.create_cluster('image')
            run.assert_not_called()
    def test_foreign_same_name_node_is_rejected(self):
        with tempfile.TemporaryDirectory() as d,patch.object(lab,'STATE',Path(d)),patch.object(lab,'guest_identity',return_value='guest'),patch.object(lab,'node_identity',return_value='foreign'):
            (Path(d)/'owned').write_text(json.dumps({'name':lab.NAME,'guest':'guest','node':'owned','provider':'podman','uid':os.getuid()}))
            with self.assertRaisesRegex(RuntimeError,'identity differs'):lab.verify_owned()
    def test_modified_kubeconfig_refused(self):
        with tempfile.TemporaryDirectory() as d,patch.object(lab,'STATE',Path(d)),patch.object(lab,'guest_identity',return_value='guest'),patch.object(lab,'node_identity',return_value='owned'):
            (Path(d)/'owned').write_text(json.dumps({'name':lab.NAME,'guest':'guest','node':'owned','provider':'podman','uid':os.getuid(),'kubeconfigSha256':hashlib.sha256(b'original').hexdigest()}))
            (Path(d)/'kubeconfig').write_bytes(b'replaced')
            with self.assertRaisesRegex(RuntimeError,'kubeconfig changed'):lab.verify_owned()
    def test_fixture_pod_has_no_host_access(self):
        p=lab.pod('workload',lab.IMAGE,['node'],8081,True)['spec']['template']['spec']
        self.assertFalse(p['automountServiceAccountToken']);self.assertTrue(p['securityContext']['runAsNonRoot'])
        self.assertFalse(any('hostPath' in v for v in p['volumes']));self.assertNotIn('hostNetwork',p)
        c=p['containers'][0];self.assertTrue(c['securityContext']['readOnlyRootFilesystem']);self.assertFalse(c['securityContext']['allowPrivilegeEscalation'])
if __name__=='__main__':unittest.main()
