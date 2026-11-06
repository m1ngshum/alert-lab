#!/usr/bin/env python3
"""Real Prometheus/Alertmanager test. Only creates and targets its own kind cluster."""
import argparse,json,os,secrets,socket,subprocess,tempfile,time,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--image',default='alert-lab:local');parser.add_argument('--chart',default=str(root/'charts/alert-lab'));args=parser.parse_args()
images=json.loads((root/'examples/images.lock.json').read_text())
name='alert-lab-'+secrets.token_hex(4)
def run(command,**kwargs):return subprocess.run(command,check=True,text=True,**kwargs)
def wait_for(check,seconds=120):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        try:
            value=check()
            if value:return value
        except Exception:pass
        time.sleep(1)
    raise RuntimeError('Timed out waiting for integration condition')
with tempfile.TemporaryDirectory(prefix='alert-lab-kind-') as directory:
    directory=Path(directory);kubeconfig=directory/'kubeconfig';forward=None
    token=secrets.token_hex(32)
    def kube(*command,**kwargs):return run(['kubectl','--kubeconfig',str(kubeconfig),*command],**kwargs)
    def apply(item):kube('apply','-f','-',input=json.dumps(item),stdout=subprocess.DEVNULL)
    try:
        command=['kind','create','cluster','--name',name,'--kubeconfig',str(kubeconfig),'--wait','120s']
        if images.get('kindNode'):command+=['--image',images['kindNode']]
        run(command)
        if args.image.endswith(':local'):run(['kind','load','docker-image',args.image,'--name',name])
        apply({'apiVersion':'v1','kind':'Namespace','metadata':{'name':'alert-lab-test','labels':{'pod-security.kubernetes.io/enforce':'restricted'}}})
        def resource(kind,name,**extra):return {'apiVersion':'v1','kind':kind,'metadata':{'name':name,'namespace':'alert-lab-test'},**extra}
        apply(resource('Secret','alert-lab-auth',stringData={'service-token':token}))
        baseline=json.loads((root/'web/examples.json').read_text())['cases'][0]['steps'][0]['evidence'];queries={}
        for field,value in baseline.items():
            if field in ['classifier','rechecks']:continue
            queries[field]={'query':f'vector({value if type(value)in [int,float] else 1})','freshnessQuery':'vector(0)','maxAgeSeconds':120}
            if isinstance(value,str):queries[field]['values']={'1':value}
        values={'credentials':{'existingSecret':'alert-lab-auth'},'config':{'selector':{'alertname':'AlertLabSpike'},'prometheus':{'url':'http://prometheus:9090','queries':queries}}}
        if '@'in args.image:repository,digest=args.image.split('@',1);values['image']={'repository':repository,'digest':digest}
        else:repository,tag=args.image.rsplit(':',1);values['image']={'repository':repository,'tag':tag}
        valuesPath=directory/'values.json';valuesPath.write_text(json.dumps(values))
        helm=['helm','upgrade','--install','alert-lab',args.chart,'--kubeconfig',str(kubeconfig),'-n','alert-lab-test','-f',str(valuesPath),'--wait','--timeout','180s']
        run(helm)
        prometheus={'global':{'evaluation_interval':'2s'},'alerting':{'alertmanagers':[{'static_configs':[{'targets':['alertmanager:9093']}]}]},'rule_files':['/etc/fixture/rules.yml'],'scrape_configs':[]}
        rules={'groups':[{'name':'synthetic','interval':'2s','rules':[{'alert':'AlertLabSpike','expr':'vector(1)','labels':{'service':'synthetic'}}]}]}
        alertmanager={'route':{'receiver':'alert-lab','group_wait':'1s','group_interval':'5s','repeat_interval':'1h'},'receivers':[{'name':'alert-lab','webhook_configs':[{'url':'http://alert-lab:8080/v1/webhooks/alertmanager','send_resolved':True,'http_config':{'authorization':{'type':'Bearer','credentials_file':'/etc/auth/token'}}}]}]}
        apply(resource('ConfigMap','fixture-config',data={'prometheus.yml':json.dumps(prometheus),'rules.yml':json.dumps(rules),'alertmanager.yml':json.dumps(alertmanager)}))
        for component,port in [('prometheus',9090),('alertmanager',9093)]:
            command=['--config.file=/etc/fixture/'+component+'.yml']+(['--storage.tsdb.path=/data']if component=='prometheus'else['--storage.path=/data'])
            container={'name':component,'image':images[component]['image'],'args':command,'ports':[{'containerPort':port}], 'resources':{'requests':{'cpu':'50m','memory':'64Mi'},'limits':{'cpu':'500m','memory':'256Mi'}},'securityContext':{'allowPrivilegeEscalation':False,'readOnlyRootFilesystem':True,'capabilities':{'drop':['ALL']}},'volumeMounts':[{'name':'config','mountPath':'/etc/fixture','readOnly':True},{'name':'data','mountPath':'/data'}]}
            volumes=[{'name':'config','configMap':{'name':'fixture-config'}},{'name':'data','emptyDir':{}}]
            if component=='alertmanager':
                container['volumeMounts'].append({'name':'auth','mountPath':'/etc/auth','readOnly':True});volumes.append({'name':'auth','secret':{'secretName':'alert-lab-auth','items':[{'key':'service-token','path':'token'}]}})
            apply({'apiVersion':'apps/v1','kind':'Deployment','metadata':{'name':component,'namespace':'alert-lab-test'},'spec':{'replicas':1,'selector':{'matchLabels':{'app':component}},'template':{'metadata':{'labels':{'app':component}},'spec':{'automountServiceAccountToken':False,'securityContext':{'runAsNonRoot':True,'runAsUser':65534,'runAsGroup':65534,'fsGroup':65534,'seccompProfile':{'type':'RuntimeDefault'}},'containers':[container],'volumes':volumes}}}})
            apply(resource('Service',component,spec={'selector':{'app':component},'ports':[{'port':port,'targetPort':port}]}))
            kube('-n','alert-lab-test','rollout','status','deployment/'+component,'--timeout=180s')
        with socket.socket()as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        forward=subprocess.Popen(['kubectl','--kubeconfig',str(kubeconfig),'-n','alert-lab-test','port-forward','service/alert-lab',f'{port}:8080'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        def api(path):
            request=urllib.request.Request(f'http://127.0.0.1:{port}'+path,headers={'Authorization':'Bearer '+token})
            with urllib.request.urlopen(request,timeout=3)as response:return json.load(response)
        items=wait_for(lambda:api('/v1/episodes')['items'])
        episode=items[0]['id'];detail=wait_for(lambda:(d if d['decisions']else None)if(d:=api('/v1/episodes/'+episode))else None)
        assert detail['decisions'][0]['decision']['kind']=='observe',detail
        replay=api('/v1/episodes/'+episode+'/replay');assert replay['schemaVersion']==1
        # Advance only the disposable test database's persisted clock; production uses five minutes.
        advance="const D=require('better-sqlite3');const d=new D('/data/alert-lab.db');d.prepare('UPDATE episodes SET next_due=0 WHERE next_due IS NOT NULL').run();d.close()"
        kube('-n','alert-lab-test','exec','deployment/alert-lab','--','node','-e',advance)
        wait_for(lambda:len(api('/v1/episodes/'+episode)['decisions'])==2)
        kube('-n','alert-lab-test','rollout','restart','deployment/alert-lab');kube('-n','alert-lab-test','rollout','status','deployment/alert-lab','--timeout=120s')
        forward.terminate();forward.wait();forward=subprocess.Popen(['kubectl','--kubeconfig',str(kubeconfig),'-n','alert-lab-test','port-forward','service/alert-lab',f'{port}:8080'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        wait_for(lambda:len(api('/v1/episodes/'+episode)['decisions'])==2)
        kube('-n','alert-lab-test','exec','deployment/alert-lab','--','node','-e',advance)
        detail=wait_for(lambda:(d if len(d['decisions'])==3 else None)if(d:=api('/v1/episodes/'+episode))else None)
        assert detail['decisions'][-1]['decision']['kind']=='review';assert detail['next_due']is None
        run(helm)
        assert api('/v1/episodes/'+episode)['decisions']==detail['decisions']
        print('PASS: Alertmanager → Prometheus evidence → observe → restart → bounded review; Helm upgrade retained SQLite history.')
    finally:
        if forward:forward.terminate();forward.wait()
        subprocess.run(['kind','delete','cluster','--name',name],check=False)
