import { cp,mkdir,readFile,readdir,writeFile,stat } from 'node:fs/promises';
import { resolve,join,dirname,relative,isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Parser } from 'commonmark';

if(process.argv.includes('--native')||process.argv.includes('--payload')) {
  await import('./assemble-native.mjs');
  process.exit(process.exitCode??0);
}

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const destination=resolve(process.argv[2]??join(root,'tmp/release',metadata.version));
await mkdir(destination,{recursive:true});
const version=metadata.version,license=metadata.license;
if((await readFile(join(root,'VERSION'),'utf8')).trim()!==version)throw new Error('VERSION and package.json must match before assembly');
if(license!=='CC0-1.0 OR 0BSD')throw new Error('Assembly requires the repository license choice');
const exists=path=>stat(path).then(()=>true,()=>false);
if(metadata.name!=='@neutral/intent')throw new Error('The distributable package is @neutral/intent');
const packageInputs=metadata.files;
if(!Array.isArray(packageInputs)||packageInputs.some(path=>typeof path!=='string'||path.startsWith('/')||path.split('/').includes('..')))throw new Error('Package files must be explicit repository-relative files or trees');
const internalPath=path=>/^(?:atlas|tests|examples|scripts|workflows|packs|catalogs)(?:\/|$)/.test(path)||/^spec\/(?:examples|tools)(?:\/|$)/.test(path)||path==='distribution/assemble.mjs'||path==='AGENTS.md';
async function documentLinks(folder){
  const pending=[folder],markdown=[];
  while(pending.length){const directory=pending.pop();for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())pending.push(path);else if(entry.isFile()&&entry.name.endsWith('.md'))markdown.push(path);}}
  let checked=0;
  for(const path of markdown){
    const walker=new Parser().parse(await readFile(path,'utf8')).walker();let event;
    while((event=walker.next()))if(event.entering&&(event.node.type==='link'||event.node.type==='image')){
      const target=event.node.destination??'';
      if(/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)||target.startsWith('//'))continue;
      const locator=decodeURIComponent(target.split(/[?#]/,1)[0]);
      const resolved=resolve(dirname(path),locator||'.'),local=relative(folder,resolved);
      if(isAbsolute(local)||local==='..'||local.startsWith('../')||!await exists(resolved))throw new Error(`Broken/out-of-archive documentation link: ${relative(folder,path)} -> ${target}`);
      checked++;
    }
  }
  return {markdownFiles:markdown.length,relativeFileLinks:checked,status:'closed',scope:'Markdown link/image file targets; remote targets and heading fragments are not fetched or qualified'};
}
// Public specifications describe development conformance work without shipping
// its fixtures or harnesses. Keep those source references explicit but unlinked;
// every remaining archive-local Markdown link must still resolve below.
async function adaptDevelopmentLinks(folder,archiveRoot=folder){
  for(const entry of await readdir(folder,{withFileTypes:true})){
    const path=join(folder,entry.name);
    if(entry.isDirectory()){await adaptDevelopmentLinks(path,archiveRoot);continue;}
    if(!entry.name.endsWith('.md'))continue;
    const markdown=await readFile(path,'utf8');
    const adjusted=markdown.replace(/(?<!!)\[([^\]\n]+)\]\(([^)\n]+)\)/g,(link,label,target)=>{
      if(/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)||target.startsWith('//'))return link;
      const locator=decodeURIComponent(target.split(/[?#]/,1)[0]);
      const sourcePath=relative(archiveRoot,resolve(dirname(path),locator)).split('\\').join('/');
      if(!internalPath(sourcePath))return link;
      const replacement=`${label} (repository source: \`${sourcePath}\`)`;
      linkRewrites.push({path:relative(archiveRoot,path),from:link,to:replacement,occurrences:1});
      return replacement;
    });
    if(adjusted!==markdown)await writeFile(path,adjusted);
  }
}
const linkRewrites=[];
const folder=join(destination,'package');
if(await exists(folder)||await exists(join(destination,'artifacts.json')))throw new Error(`Refusing to replace an existing assembly: ${destination}`);
await mkdir(folder,{recursive:true});
for(const input of new Set([...packageInputs,'README.md','LICENSE','LICENSE.CC0-1.0','LICENSE.0BSD'])){
  if(internalPath(input))throw new Error(`Development input cannot be included in the package: ${input}`);
  if(!await exists(join(root,input)))throw new Error(`Required package input is missing: ${input}`);
  await mkdir(dirname(join(folder,input)),{recursive:true});
  await cp(join(root,input),join(folder,input),{recursive:true});
}
const manifest={name:metadata.name,version,description:metadata.description,type:metadata.type,license,engines:metadata.engines,exports:metadata.exports,bin:metadata.bin,dependencies:metadata.dependencies,...(metadata.repository?{repository:metadata.repository}:{}),...(metadata.publishConfig?{publishConfig:metadata.publishConfig}:{})};
if(Object.keys(manifest.dependencies).some(name=>name.startsWith('@neutral/intent')))throw new Error('Intent ships as one package without companion package dependencies');
await writeFile(join(folder,'package.json'),JSON.stringify(manifest,null,2)+'\n');
await adaptDevelopmentLinks(folder);
const documentation=await documentLinks(folder);
const packed=spawnSync('npm',['--cache','/tmp/intent-npm-cache','pack','--json','--ignore-scripts','--pack-destination',destination],{cwd:folder,encoding:'utf8'});
if(packed.status!==0)throw new Error(packed.stderr||packed.stdout);
const item=JSON.parse(packed.stdout)[0],bytes=await readFile(join(destination,item.filename));
const paths=item.files.map(file=>file.path);
for(const licenseFile of ['LICENSE','LICENSE.CC0-1.0','LICENSE.0BSD'])if(!paths.includes(licenseFile))throw new Error(`Missing ${licenseFile} in ${item.filename}`);
if(paths.some(path=>internalPath(path)||path.startsWith('node_modules/')||path.startsWith('intent/')||path.startsWith('catalogs/')))throw new Error('Unexpected private/development archive input');
if(paths.some(path=>/^dist\/library\/(?:history|revisions|cache)\./.test(path)||/^spec\/schemas\/(?:history(?:-v1)?|knowledge-record-v1|discipline-adoption(?:-v1)?|discipline-pack(?:-manifest)?-v1)\.schema\.json$/.test(path)))throw new Error('Only current contracts and modules may ship; run the clean build');
const artifacts=[{name:manifest.name,version,filename:item.filename,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,documentation,files:paths}];
await writeFile(join(destination,'artifacts.json'),JSON.stringify({schema:'intent.release-artifacts.v1',version,artifacts,linkRewrites},null,2)+'\n');
process.stdout.write(JSON.stringify({destination,artifacts:artifacts.map(({files,...artifact})=>artifact)},null,2)+'\n');
