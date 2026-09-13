import { cp, chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveBundle } from './archive.mjs';

export async function assembleBundle({publicSource,destination,target=`${process.platform}-${process.arch}`,payloadOnly=false,assetsRoot,runtimesPath,installGuide,integrationGuide,packageArchive}) {
const metadata=JSON.parse(await readFile(join(publicSource,'package.json'),'utf8'));
const sourceMetadata=metadata;
const runtimes=JSON.parse(await readFile(runtimesPath,'utf8'));
if(metadata.name!=='@neutral/intent'||metadata.license!=='CC0-1.0 OR 0BSD')throw new Error('Unexpected application identity or license');
if((await readFile(join(publicSource,'VERSION'),'utf8')).trim()!==metadata.version)throw new Error('VERSION and package.json must match before assembly');
if(!Object.hasOwn(runtimes.targets,target))throw new Error(`Unsupported target ${target}; choose ${Object.keys(runtimes.targets).join(', ')}`);
const run=await mkdtemp(join(tmpdir(),'intent-bundle-build-'));
destination??=join(run,'artifacts');
const exists=path=>lstat(path).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
if(await exists(destination))throw new Error(`Choose a new assembly destination: ${destination}`);
await mkdir(destination,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function command(executable,args,cwd=publicSource) {
  return execFileSync(executable,args,{cwd,encoding:'utf8',maxBuffer:32000000,timeout:300000,env:{...process.env,npm_config_cache:join(tmpdir(),'intent-npm-cache')}});
}
const payload=join(destination,`intent-${metadata.version}-application`);
const app=join(payload,'app');await mkdir(app,{recursive:true});
if(!packageArchive)throw new Error('An exact qualified npm archive is required');
command('tar',['-xzf',packageArchive,'--strip-components=1','-C',app]);
await cp(join(publicSource,'package-lock.json'),join(app,'package-lock.json'));
process.stderr.write('Installing locked runtime dependencies…\n');
command('npm',['ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],app);
await rm(join(app,'node_modules/.bin'),{recursive:true,force:true});
await rm(join(app,'node_modules/.package-lock.json'),{force:true});
await mkdir(join(payload,'licenses'));
await mkdir(join(payload,'bin'));
for(const [source,path] of [['intent','bin/intent'],['install','install'],['install.mjs','install.mjs']])await cp(join(assetsRoot,source),join(payload,path));
for(const path of ['bin/intent','install'])await chmod(join(payload,path),0o755);
for(const path of ['LICENSE','LICENSE.CC0-1.0','LICENSE.0BSD'])await cp(join(publicSource,path),join(payload,path));
await writeFile(join(payload,'INSTALL.md'),(await readFile(installGuide,'utf8'))
  .replaceAll('](interfaces.md)','](app/docs/interfaces.md)')
  .replaceAll('](integration.md)','](INTEGRATION.md)')
  .replaceAll('](../library/README.md)','](app/library/README.md)')
  .replaceAll('](../distribution/README.md)','](app/distribution/README.md)'));
await cp(integrationGuide,join(payload,'INTEGRATION.md'));
const payloadManifest={schema:'intent.application-payload.v1',version:metadata.version,target:'any',platform:'any',arch:'any',supportedTargets:Object.keys(runtimes.targets),engines:metadata.engines,entry:'bin/intent',application:'app',runtimeVariable:'INTENT_NODE',license:metadata.license,dependencies:sourceMetadata.dependencies};
await writeFile(join(payload,'payload.json'),JSON.stringify(payloadManifest,null,2)+'\n');
async function inventory(directory,prefix='') {
  const result=[];
  for(const name of (await readdir(directory)).sort()) {
    const path=join(directory,name),local=prefix?prefix+'/'+name:name,info=await lstat(path);
    if(info.isDirectory())result.push(...await inventory(path,local));
    else if(info.isFile())result.push({path:local,sha256:sha(await readFile(path)),bytes:info.size});
    else throw new Error(`Unsupported bundled path: ${local}`);
  }
  return result;
}
async function pack(folder,details) {
  const files=await inventory(folder);
  await writeFile(join(folder,'inventory.json'),JSON.stringify({schema:'intent.native-inventory.v1',files},null,2)+'\n');
  const archive=folder+'.tar.gz';await archiveBundle(folder,archive);
  const bytes=await readFile(archive);
  const artifact={name:'Intent',version:metadata.version,filename:archive.slice(destination.length+1),sha256:sha(bytes),bytes:bytes.length,files:files.map(file=>file.path),...details};
  await writeFile(archive+'.sha256',`${artifact.sha256}  ${artifact.filename}\n`);
  return artifact;
}
for(const file of await inventory(join(app,'node_modules'))) {
  if(file.path.endsWith('.node'))throw new Error('A native addon requires target-specific application packaging');
  if(file.path.endsWith('/package.json')) {
    const dependency=JSON.parse(await readFile(join(app,'node_modules',file.path),'utf8'));
    if(dependency.os||dependency.cpu||dependency.libc)throw new Error(`Dependency ${dependency.name} requires target-specific application packaging`);
  }
}
const payloadArtifact=await pack(payload,{kind:'application',target:'any',engines:metadata.engines});
const artifacts=[payloadArtifact];
let folder,archive;
if(!payloadOnly) {
  folder=join(destination,`intent-${metadata.version}-${target}`);
  await cp(payload,folder,{recursive:true});
  await rm(join(folder,'inventory.json'));
  const runtimeName=`node-v${runtimes.version}-${target}`,runtimeArchive=runtimeName+'.tar.gz';
  const cache=join(tmpdir(),'intent-node-downloads');await mkdir(cache,{recursive:true});
  const cached=join(cache,runtimeArchive);
  if(!await exists(cached)) {
    process.stderr.write(`Downloading pinned Node ${runtimes.version} for ${target}…\n`);
    const response=await fetch(`https://nodejs.org/dist/v${runtimes.version}/${runtimeArchive}`);
    if(!response.ok)throw new Error(`Node download failed: ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(sha(bytes)!==runtimes.targets[target])throw new Error('Downloaded Node archive failed the pinned SHA-256 check');
    await writeFile(cached,bytes,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
  }
  if(sha(await readFile(cached))!==runtimes.targets[target])throw new Error(`Cached Node archive failed the pinned SHA-256 check: ${cached}`);
  command('tar',['-xzf',cached,'-C',run,`${runtimeName}/bin/node`,`${runtimeName}/LICENSE`]);
  await mkdir(join(folder,'runtime/bin'),{recursive:true});
  await cp(join(run,runtimeName,'bin/node'),join(folder,'runtime/bin/node'));
  await cp(join(run,runtimeName,'LICENSE'),join(folder,'licenses/Node.js-LICENSE'));
  await chmod(join(folder,'runtime/bin/node'),0o755);
  const manifest={schema:'intent.native-bundle.v1',version:metadata.version,target,node:{version:runtimes.version,archive:runtimeArchive,sha256:runtimes.targets[target],source:runtimes.source},entry:'bin/intent',application:'app',payload:{filename:payloadArtifact.filename,sha256:payloadArtifact.sha256},license:metadata.license,dependencies:sourceMetadata.dependencies};
  await writeFile(join(folder,'bundle.json'),JSON.stringify(manifest,null,2)+'\n');
  artifacts.push(await pack(folder,{kind:'native',target,node:manifest.node,payload:manifest.payload,nativeExecution:target===`${process.platform}-${process.arch}`?'requires-installed-check':'not-executed-on-build-host'}));
  archive=folder+'.tar.gz';
}
await writeFile(join(destination,'artifacts.json'),JSON.stringify({schema:'intent.native-artifacts.v1',version:metadata.version,artifacts},null,2)+'\n');
return {destination,payload,payloadArchive:payload+'.tar.gz',bundle:folder,archive,target,publicSource};
}
