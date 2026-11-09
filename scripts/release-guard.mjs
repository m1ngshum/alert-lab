import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export async function reserveRelease(env,fetchImpl=fetch) {
  if(env.GITHUB_REPOSITORY!=='m1ngshum/alert-lab'||env.GITHUB_REF!=='refs/heads/main'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')||!env.GH_TOKEN)throw new Error('Release requires this repository, main, an exact commit and authentication.');
  const repo=env.GITHUB_REPOSITORY;
  const headers={Authorization:`Bearer ${env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  async function request(url,options={}) {return fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});}
  const checks=await request(`https://api.github.com/repos/${repo}/commits/${env.GITHUB_SHA}/check-runs?per_page=100`,{headers});
  if(!checks.ok)throw new Error('Cannot verify CI.');
  const runs=(await checks.json()).check_runs;
  for(const name of ['verify','codeql'])if(!runs?.some(c=>c.name===name&&c.head_sha===env.GITHUB_SHA&&c.app?.slug==='github-actions'&&c.status==='completed'&&c.conclusion==='success'))throw new Error(`Missing successful ${name} for this commit.`);
  for(const path of ['releases/tags/v0.1.3','git/ref/tags/v0.1.3']) {
    const response=await request(`https://api.github.com/repos/${repo}/${path}`,{headers});
    if(response.status!==404)throw new Error('Version already exists or its absence cannot be verified.');
  }
  // Include failed prior attempts' draft reservations, which may not have a Git tag yet.
  const releases=await request(`https://api.github.com/repos/${repo}/releases?per_page=100`,{headers});
  if(!releases.ok||(await releases.json()).some(r=>r.tag_name==='v0.1.3'))throw new Error('Release version is already reserved or unavailable.');
  for(const name of ['m1ngshum/alert-lab','m1ngshum/charts/alert-lab']) {
    const tokenResponse=await request('https://ghcr.io/token?'+new URLSearchParams({service:'ghcr.io',scope:`repository:${name}:pull,push`}),{headers:{Authorization:'Basic '+Buffer.from(`${env.GITHUB_ACTOR}:${env.GH_TOKEN}`).toString('base64')}});
    if(!tokenResponse.ok)throw new Error('Cannot verify registry version absence.');
    const credentials=await tokenResponse.json();const token=credentials.token??credentials.access_token;
    if(!token)throw new Error('Registry did not supply scoped access.');
    for(const version of name==='m1ngshum/alert-lab'?['0.1.3','0.1.3-amd64','0.1.3-arm64']:['0.1.3']) {
      const response=await request(`https://ghcr.io/v2/${name}/manifests/${version}`,{method:'HEAD',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json'}});
      if(response.status!==404)throw new Error('Registry version exists or its absence cannot be verified.');
    }
  }
  const response=await request(`https://api.github.com/repos/${repo}/releases`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({tag_name:'v0.1.3',target_commitish:env.GITHUB_SHA,name:'Alert Lab v0.1.3',draft:true})});
  if(response.status!==201)throw new Error('Could not reserve the release version.');
  return (await response.json()).id;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {const id=await reserveRelease(process.env);if(!Number.isSafeInteger(id))throw new Error('Invalid release reservation.');appendFileSync(process.env.GITHUB_OUTPUT,`release_id=${id}\n`);console.log('Version absence verified and draft release reserved.');}
  catch(error){console.error(error.message);process.exitCode=1;}
}
