import { cp, lstat, mkdir, open, readFile, readlink, realpath, rename, rm, rmdir, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const bundle=await realpath(fileURLToPath(new URL('.',import.meta.url)));
const manifest=JSON.parse(await readFile(join(bundle,'bundle.json'),'utf8').catch(error=>{
  if(error.code!=='ENOENT')throw error;return readFile(join(bundle,'payload.json'),'utf8');
}));
const [action,...args]=process.argv.slice(2);
const options={prefix:join(homedir(),'.local/opt/intent'),'bin-dir':join(homedir(),'.local/bin')};
for(let i=0;i<args.length;i++) {
  const name=args[i].slice(2);
  if(!args[i].startsWith('--')||!Object.hasOwn(options,name)||!args[i+1])throw new Error(`Unsupported installation argument: ${args[i]}`);
  options[name]=resolve(args[++i]);
}
const exists=path=>lstat(path).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
async function readRegistry(prefix) {
  const path=join(prefix,'installation.json');
  if(!await exists(path))return {schema:'intent.installation.v1',prefix,versions:[],command:null};
  const value=JSON.parse(await readFile(path,'utf8'));
  if(value.schema!=='intent.installation.v1'||value.prefix!==prefix||!Array.isArray(value.versions)||typeof value.command!=='string'||!isAbsolute(value.command))throw new Error(`Unrecognized installation: ${prefix}`);
  return value;
}
async function managedVersion(path,prefix) {
  if(dirname(path)!==prefix||!await exists(path))throw new Error(`Invalid installed version: ${path}`);
  const receipt=JSON.parse(await readFile(join(path,'installation-receipt.json'),'utf8'));
  if(receipt.schema!=='intent.installation-receipt.v1'||receipt.path!==path||receipt.prefix!==prefix)throw new Error(`Unrecognized installed version: ${path}`);
}
let installationLock,lockPath,uninstalledPrefix;
async function lockInstallation(prefix) {
  lockPath=join(prefix,'.installation.lock');
  installationLock=await open(lockPath,'wx',0o600).catch(error=>{
    if(error.code==='EEXIST')throw new Error(`Installation is locked: ${lockPath}. Wait for the installer to finish. After an interruption, confirm no installer is running before removing this lock.`);
    throw error;
  });
  await installationLock.writeFile(JSON.stringify({pid:process.pid})+'\n');
}
try {
if(action==='install') {
  if(manifest.target!=='any'&&manifest.target!==`${process.platform}-${process.arch}`)throw new Error(`This bundle requires ${manifest.target}; this host is ${process.platform}-${process.arch}`);
  const scope=relative(bundle,resolve(options.prefix));
  if(scope!== '..'&&!scope.startsWith('..'+sep)&&!isAbsolute(scope))throw new Error('Installation prefix must be outside the extracted bundle');
  await mkdir(options.prefix,{recursive:true});
  const prefix=await realpath(options.prefix),canonicalScope=relative(bundle,prefix);
  if(canonicalScope!=='..'&&!canonicalScope.startsWith('..'+sep)&&!isAbsolute(canonicalScope))throw new Error('Installation prefix must be outside the extracted bundle');
  await lockInstallation(prefix);
  const registry=await readRegistry(prefix);
  await mkdir(options['bin-dir'],{recursive:true});
  const command=join(await realpath(options['bin-dir']),'intent');
  if(registry.command&&registry.command!==command)throw new Error(`This installation uses ${registry.command}; supply its directory with --bin-dir`);
  if(await exists(command)) {
    if(!(await lstat(command)).isSymbolicLink())throw new Error(`Preserving existing command: ${command}`);
    const current=resolve(dirname(command),await readlink(command));
    if(!registry.versions.some(path=>join(path,'bin/intent')===current))throw new Error(`Preserving unrelated command: ${command}`);
  }
  const destination=join(prefix,`intent-${manifest.version}-${manifest.target}`);
  if(await exists(destination))throw new Error(`Version already exists: ${destination}. Keep it or uninstall before reinstalling the same version.`);
  for(const path of registry.versions)await managedVersion(path,prefix);
  const staging=join(prefix,`.install-${process.pid}`);
  if(await exists(staging))throw new Error(`Installation staging path exists: ${staging}`);
  try {
    await cp(bundle,staging,{recursive:true,errorOnExist:true,force:false});
    await writeFile(join(staging,'installation-receipt.json'),JSON.stringify({schema:'intent.installation-receipt.v1',path:destination,prefix,command},null,2)+'\n');
    await rename(staging,destination);
    const next={...registry,versions:[...registry.versions,destination],command};
    await writeFile(join(prefix,'installation.json.pending'),JSON.stringify(next,null,2)+'\n');
    await rename(join(prefix,'installation.json.pending'),join(prefix,'installation.json'));
    const link=command+`.install-${process.pid}`;
    await symlink(join(destination,'bin/intent'),link);
    await rename(link,command);
  } catch(error) {await rm(staging,{recursive:true,force:true});throw error;}
  console.log(`Installed Intent ${manifest.version}\nCommand: ${command}\nRun: "${command}" open\nAdd ${dirname(command)} to PATH if needed.\nUpdates: run ./install from a newer bundle with the same installation options.\nRemove installed versions: "${command}" uninstall\nProject files and durable drafts are retained during updates and removal.`);
} else if(action==='uninstall') {
  if(args.length)throw new Error('intent uninstall takes no options; it removes the installation containing this command');
  const receiptPath=join(bundle,'installation-receipt.json');
  if(!await exists(receiptPath))throw new Error('This is a portable bundle. Remove its extracted directory to uninstall; project files and durable drafts are separate.');
  const receipt=JSON.parse(await readFile(receiptPath,'utf8')),prefix=receipt.prefix;
  await managedVersion(bundle,prefix);
  await lockInstallation(prefix);
  const registry=await readRegistry(prefix);
  if(!registry.versions.includes(bundle))throw new Error('The installation registry does not own this bundle');
  for(const path of registry.versions)await managedVersion(path,prefix);
  if(await exists(registry.command)) {
    const target=(await lstat(registry.command)).isSymbolicLink()?resolve(dirname(registry.command),await readlink(registry.command)):null;
    if(!registry.versions.some(path=>join(path,'bin/intent')===target))throw new Error(`Preserving changed command: ${registry.command}`);
    await rm(registry.command);
  }
  for(const path of registry.versions)await rm(path,{recursive:true});
  await rm(join(prefix,'installation.json'));
  uninstalledPrefix=prefix;
  console.log('Intent installation removed. Project files and durable drafts were retained.');
} else throw new Error('Expected install or uninstall');
} finally {
  if(installationLock) {await installationLock.close();await rm(lockPath);}
  if(uninstalledPrefix)await rmdir(uninstalledPrefix).catch(error=>{if(error.code!=='ENOTEMPTY')throw error;});
}
