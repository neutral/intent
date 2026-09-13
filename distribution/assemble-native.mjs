import { readFile, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { assembleBundle } from './bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const args=process.argv.slice(2);let target=`${process.platform}-${process.arch}`,destination,publicSource,packageArchive,payloadOnly=false;
for(let i=0;i<args.length;i++) {
 if(args[i]==='--native')payloadOnly=false;
 else if(args[i]==='--payload')payloadOnly=true;
 else if(args[i]==='--target'&&args[i+1])target=args[++i];
 else if(args[i]==='--public-source'&&args[i+1])publicSource=resolve(args[++i]);
 else if(args[i]==='--package-archive'&&args[i+1])packageArchive=resolve(args[++i]);
 else if(!args[i].startsWith('-')&&!destination)destination=resolve(args[i]);
 else throw new Error(`Unsupported assembly argument: ${args[i]}`);
}
const command=(args,cwd=root)=>execFileSync(process.execPath,args,{cwd,encoding:'utf8',timeout:900000,maxBuffer:32000000,stdio:['ignore','pipe','inherit']});
if(metadata.private&&(!publicSource||!packageArchive))throw new Error('Development assembly requires an explicitly qualified public source and package archive');
publicSource??=root;
const sourceMetadata=JSON.parse(await readFile(join(publicSource,'package.json'),'utf8'));
if(sourceMetadata.private||sourceMetadata.name!==metadata.name||sourceMetadata.version!==metadata.version)throw new Error('Select the matching public source candidate');
if(!packageArchive) {
 const run=await mkdtemp(join(tmpdir(),'intent-native-package-')),archives=join(run,'archives');
 process.stdout.write(command(['distribution/assemble.mjs',archives],publicSource));
 const index=JSON.parse(await readFile(join(archives,'artifacts.json'),'utf8'));packageArchive=join(archives,index.artifacts[0].filename);
}
const index=JSON.parse(await readFile(join(packageArchive,'..','artifacts.json'),'utf8'));
const artifact=index.artifacts.find(item=>join(packageArchive,'..',item.filename)===packageArchive);
if(!artifact||artifact.name!==metadata.name||artifact.version!==metadata.version||createHash('sha256').update(await readFile(packageArchive)).digest('hex')!==artifact.sha256)throw new Error('Selected npm archive identity or checksum differs');
console.log(JSON.stringify(await assembleBundle({publicSource,destination,target,payloadOnly,packageArchive,
 assetsRoot:join(publicSource,'distribution/native'),runtimesPath:join(publicSource,'distribution/node-runtimes.json'),installGuide:join(publicSource,'docs/install.md'),integrationGuide:join(publicSource,'docs/integration.md')}),null,2));
