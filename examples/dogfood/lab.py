#!/usr/bin/env python3
"""Persistent synthetic lab. Run only inside the dedicated isolated Linux machine."""
import argparse,hashlib,json,os,platform,pwd,re,secrets,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
NAME='alert-lab-dogfood'
IMAGE='ghcr.io/m1ngshum/alert-lab@sha256:aad5f89aeb6aa742bdc7fc44a81c4cdc84169621427528cbcbe3131e5691d9f0'
STATE=Path.home()/'.local/share'/NAME
NS=NAME

def run(args,**kwargs):return subprocess.run(args,check=True,text=True,**kwargs)
def guard():
    marker=Path('/etc/alert-lab-dogfood')
    if platform.system()!='Linux' or not marker.is_file():raise RuntimeError('Run inside the dedicated isolated lab machine; bootstrap marker missing')
    if platform.node().split('.')[0]!=NAME or marker.stat().st_uid!=0 or marker.read_text().splitlines()!=[NAME,Path('/etc/machine-id').read_text().strip()]:raise RuntimeError('Guest identity does not match the root-owned bootstrap marker')
    vm=Path('/etc/alert-lab-vm')
    if not vm.is_file() or vm.stat().st_uid!=0 or vm.read_text()!=marker.read_text():raise RuntimeError('Dedicated full-VM provisioning marker missing or changed')
    if Path('/mnt/mac').exists() or os.environ.get('SSH_AUTH_SOCK'):raise RuntimeError('Host sharing/SSH forwarding must be disabled')
    if os.getuid()==0 or pwd.getpwuid(os.getuid()).pw_name!='lab':raise RuntimeError('Run as the unprivileged lab user')
    for key in list(os.environ):
        if key.startswith(('KUBE','HELM_KUBE','DOCKER_','CONTAINER_','CONTAINERS_','REGISTRY_','KIND_')):os.environ.pop(key,None)
    STATE.mkdir(parents=True,exist_ok=True,mode=0o700);STATE.chmod(0o700)
    config=STATE/'containers.conf';config.write_text('[containers]\nlog_driver="k8s-file"\npids_limit=65536\n[engine]\nremote=false\n')
    os.environ['CONTAINERS_CONF']=str(config)
    os.environ['XDG_RUNTIME_DIR']='/run/user/'+str(os.getuid())
    os.environ['XDG_CONFIG_HOME']=str(Path.home()/'.config')
    os.environ['XDG_DATA_HOME']=str(Path.home()/'.local/share')
    os.environ['DBUS_SESSION_BUS_ADDRESS']='unix:path='+os.environ['XDG_RUNTIME_DIR']+'/bus'
    os.environ['KIND_EXPERIMENTAL_PROVIDER']='podman'
    info=json.loads(run(['podman','--remote=false','info','--format','json'],capture_output=True).stdout)
    if not info['host']['security']['rootless'] or info['host']['cgroupVersion']!='v2':raise RuntimeError('Rootless local Podman with cgroup v2 is required')

def guest_identity():return Path('/etc/machine-id').read_text().strip()
def node_identity():
    node=json.loads(run(['podman','--remote=false','inspect',NAME+'-control-plane'],capture_output=True).stdout)[0]
    if node.get('Config',{}).get('Labels',{}).get('io.x-k8s.kind.cluster')!=NAME:raise RuntimeError('Container is not the expected kind node')
    return node['Id']
def verify_owned():
    try:record=json.loads((STATE/'owned').read_text())
    except (OSError,ValueError):raise RuntimeError('No valid lab ownership record; refusing adoption/destruction')
    if {k:record.get(k) for k in ['name','guest','node','provider','uid']}!={'name':NAME,'guest':guest_identity(),'node':node_identity(),'provider':'podman','uid':os.getuid()}:raise RuntimeError('Guest/node identity differs from the owned lab; refusing replacement')
    if record.get('kubeconfigSha256')!=hashlib.sha256((STATE/'kubeconfig').read_bytes()).hexdigest():raise RuntimeError('Owned kubeconfig changed; refusing Kubernetes/Helm operations')

def create_cluster(image):
    if (STATE/'owned').exists():raise RuntimeError('Stale ownership record; inspect the missing cluster before recreating')
    run(['systemd-run','--scope','--user','-p','Delegate=yes','kind','create','cluster','--name',NAME,'--kubeconfig',str(STATE/'kubeconfig'),'--image',image,'--wait','120s'])
    record={'name':NAME,'guest':guest_identity(),'node':node_identity(),'provider':'podman','uid':os.getuid(),'kubeconfigSha256':hashlib.sha256((STATE/'kubeconfig').read_bytes()).hexdigest()}
    with (STATE/'owned').open('x') as f:json.dump(record,f)

def kube(*args,**kwargs):return run(['kubectl','--kubeconfig',str(STATE/'kubeconfig'),'--context','kind-'+NAME,'-n',NS,*args],**kwargs)
def wait_ready():
    deadline=time.monotonic()+180
    while time.monotonic()<deadline:
        try:
            if kube('get','--raw=/readyz','--request-timeout=3s',capture_output=True).stdout.strip()=='ok':return
        except subprocess.CalledProcessError:pass
        time.sleep(1)
    raise RuntimeError('Owned cluster API did not become ready within180seconds')

def wait_service():
    deadline=time.monotonic()+180
    code="fetch('http://alert-lab:8080/readyz',{signal:AbortSignal.timeout(3000)}).then(r=>{if(!r.ok)process.exitCode=1}).catch(()=>{process.exitCode=1})"
    while time.monotonic()<deadline:
        try:
            kube('exec','deployment/workload','--','node','-e',code,capture_output=True,timeout=10);return
        except (subprocess.CalledProcessError,subprocess.TimeoutExpired):time.sleep(1)
    raise RuntimeError('Lab service did not become reachable within180seconds')

def apply(obj):kube('apply','-f','-',input=json.dumps(obj),stdout=subprocess.DEVNULL)
def resource(kind,name,**extra):return dict(apiVersion='v1',kind=kind,metadata={'name':name,'namespace':NS},**extra)
def pod(name,image,command,port,auth=False):
    mounts=[{'name':'fixture','mountPath':'/fixture','readOnly':True},{'name':'data','mountPath':'/data'}]
    volumes=[{'name':'fixture','configMap':{'name':'fixture'}},{'name':'data','emptyDir':{}}]
    if auth:
        mounts.append({'name':'auth','mountPath':'/auth','readOnly':True});volumes.append({'name':'auth','secret':{'secretName':'auth','items':[{'key':'service-token','path':'token'}]}})
    container={'name':name,'image':image,'command':command,'ports':[{'containerPort':port}], 'volumeMounts':mounts,'resources':{'requests':{'cpu':'50m','memory':'64Mi'},'limits':{'cpu':'500m','memory':'256Mi'}},'securityContext':{'allowPrivilegeEscalation':False,'readOnlyRootFilesystem':True,'capabilities':{'drop':['ALL']}}}
    container['readinessProbe']={'httpGet':{'path':'/healthz' if name=='workload' else '/-/ready','port':port},'periodSeconds':2}
    if name=='workload':container['env']=[{'name':'SERVICE_TOKEN_FILE','value':'/auth/token'}]
    return {'apiVersion':'apps/v1','kind':'Deployment','metadata':{'name':name,'namespace':NS},'spec':{'replicas':1,'selector':{'matchLabels':{'app':name}},'template':{'metadata':{'labels':{'app':name}},'spec':{'automountServiceAccountToken':False,'securityContext':{'runAsNonRoot':True,'runAsUser':1000,'runAsGroup':1000,'fsGroup':1000,'seccompProfile':{'type':'RuntimeDefault'}},'containers':[container],'volumes':volumes}}}}

def up():
    STATE.mkdir(parents=True,exist_ok=True,mode=0o700);STATE.chmod(0o700)
    clusters=run(['kind','get','clusters'],capture_output=True).stdout.splitlines()
    if NAME not in clusters:
        images=json.loads((ROOT/'examples/images.lock.json').read_text());create_cluster(images['kindNode'])
    else:
        verify_owned();run(['podman','--remote=false','start',NAME+'-control-plane'],stdout=subprocess.DEVNULL)
    (STATE/'kubeconfig').chmod(0o600)
    verify_owned()
    wait_ready()
    token=STATE/'token'
    if not token.exists():
        fd=os.open(token,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        with os.fdopen(fd,'w') as f:f.write(secrets.token_hex(32))
    apply({'apiVersion':'v1','kind':'Namespace','metadata':{'name':NS,'labels':{'pod-security.kubernetes.io/enforce':'restricted'}}})
    apply(resource('Secret','auth',stringData={'service-token':token.read_text()}))
    prom={'global':{'scrape_interval':'2s','evaluation_interval':'2s'},'scrape_configs':[{'job_name':'synthetic','static_configs':[{'targets':['workload:8081']}]}],'rule_files':['/fixture/rules.json'],'alerting':{'alertmanagers':[{'static_configs':[{'targets':['alertmanager:9093']}]}]}}
    rules={'groups':[{'name':'synthetic','rules':[{'alert':'AlertLabDogfood','expr':'alert_lab_rate > 10','for':'5s','labels':{'service':'synthetic'}}]}]}
    am={'route':{'receiver':'lab','group_wait':'1s','group_interval':'5s','repeat_interval':'1h'},'receivers':[{'name':'lab','webhook_configs':[{'url':'http://alert-lab:8080/v1/webhooks/alertmanager','send_resolved':True,'http_config':{'authorization':{'credentials_file':'/auth/token'}}}]}]}
    apply(resource('ConfigMap','fixture',data={'prometheus.json':json.dumps(prom),'rules.json':json.dumps(rules),'alertmanager.json':json.dumps(am),'workload.mjs':(ROOT/'examples/dogfood/workload.mjs').read_text()}))
    images=json.loads((ROOT/'examples/images.lock.json').read_text())
    components=[('workload',IMAGE,['/usr/local/bin/node','/fixture/workload.mjs'],8081,True),('prometheus',images['prometheus']['image'],['/bin/prometheus','--config.file=/fixture/prometheus.json','--storage.tsdb.path=/data'],9090,False),('alertmanager',images['alertmanager']['image'],['/bin/alertmanager','--config.file=/fixture/alertmanager.json','--storage.path=/data'],9093,True)]
    for name,image,command,port,auth in components:
        apply(pod(name,image,command,port,auth));apply(resource('Service',name,spec={'selector':{'app':name},'ports':[{'port':port,'targetPort':port}]}))
    queries={}
    categories={'rejection':{'0':'unexpected','1':'expected'},'downstream':{'0':'outage','1':'healthy'},'security':{'0':'unknown','1':'none'},'consistency':{'1':'consistent'}}
    for field in ['rate','success','latency','cpu','memory','rejection','downstream','security','consistency','samples','logs','metrics','journeys']:
        q='alert_lab_'+field+'{job="synthetic"}'
        queries[field]={'query':q,'freshnessQuery':'time() - timestamp('+q+')','maxAgeSeconds':30}
        if field in categories:queries[field]['values']=categories[field]
    values={'credentials':{'existingSecret':'auth'},'image':{'repository':'ghcr.io/m1ngshum/alert-lab','digest':IMAGE.split('@')[1]},'config':{'selector':{'alertname':'AlertLabDogfood','service':'synthetic'},'prometheus':{'url':'http://prometheus:9090','queries':queries}}}
    path=STATE/'values.json';path.write_text(json.dumps(values))
    run(['helm','pull','oci://ghcr.io/m1ngshum/charts/alert-lab','--version','0.1.2','--destination',str(STATE)])
    chart=STATE/'alert-lab-0.1.2.tgz'
    if hashlib.sha256(chart.read_bytes()).hexdigest()!='8d21c15ece7ce3671d9a14b8afdd8f57f3ca1c3b4a762b615dac6342e88d3dce':raise RuntimeError('Published chart checksum mismatch')
    run(['helm','upgrade','--install','alert-lab',str(chart),'--kubeconfig',str(STATE/'kubeconfig'),'--kube-context','kind-'+NAME,'-n',NS,'-f',str(path),'--wait','--timeout','240s'])
    for name,_,_,_,_ in components:kube('rollout','status','deployment/'+name,'--timeout=180s')
    wait_service()
    print('Lab ready. Run: lab.py tunnel; lab.py token. Real five-minute rechecks; spike for >=10 minutes.')

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('action',choices=['up','status','down','stop','tunnel','token','scenario','episodes','replay','restart']);parser.add_argument('value',nargs='?');parser.add_argument('--destroy',action='store_true');args=parser.parse_args()
    guard()
    if args.action=='up':return up()
    verify_owned()
    if args.action=='down':
        if not args.destroy:raise RuntimeError('Destruction requires down --destroy; use stop to preserve data')
        run(['kind','delete','cluster','--name',NAME,'--kubeconfig',str(STATE/'kubeconfig')]);(STATE/'owned').unlink();(STATE/'token').unlink(missing_ok=True);return
    if args.action=='stop':return run(['podman','--remote=false','stop',NAME+'-control-plane'])
    if args.action=='status':return kube('get','pods,pvc')
    if args.action=='restart':return kube('rollout','restart','deployment/alert-lab')
    if args.action=='token':print((STATE/'token').read_text());return
    if args.action=='tunnel':return kube('port-forward','--address','127.0.0.1','service/workload','8780:8081')
    if args.action=='scenario' and args.value not in ['baseline','spike','recovery']:raise RuntimeError('Choose baseline, spike or recovery')
    if args.action=='replay' and not re.fullmatch('[a-f0-9]{64}',args.value or ''):raise RuntimeError('Replay needs a hexadecimal episode ID')
    route='/scenario/'+args.value if args.action=='scenario' else '/episodes/'+args.value+'/replay' if args.action=='replay' else '/episodes'
    code="const fs=require('node:fs');fetch('http://127.0.0.1:8081"+route+"',{method:'"+('POST' if args.action=='scenario' else 'GET')+"',headers:{Authorization:'Bearer '+fs.readFileSync('/auth/token','utf8').trim()}}).then(async r=>{console.log(await r.text());if(!r.ok)process.exitCode=1})"
    kube('exec','deployment/workload','--','node','-e',code)
if __name__=='__main__':
    try:main()
    except (RuntimeError,subprocess.CalledProcessError) as e:sys.exit(str(e))
