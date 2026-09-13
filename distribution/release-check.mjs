import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const run=await mkdtemp(join(tmpdir(),'intent-release-check-'));
const report={schema:'intent.release-check.v2',run,node:process.version,platform:process.platform,arch:process.arch,version:metadata.version,checks:[],status:'running'};
try{report.sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();report.sourceStatus=execFileSync('git',['status','--short','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();}catch{report.sourceCommit=null;report.sourceStatus='Source candidate has no Git commit';}
async function command(name,executable,args,cwd=root) {
 const log=join(run,name+'.log');
 try{const output=execFileSync(executable,args,{cwd,encoding:'utf8',timeout:900000,maxBuffer:64000000,stdio:['ignore','pipe','pipe']});await writeFile(log,output);report.checks.push({name,command:[executable,...args],status:'pass',log});console.log(`PASS ${name}`);return output;}
 catch(error){await writeFile(log,String(error.stdout??'')+String(error.stderr??'')+'\n'+error.message);report.checks.push({name,status:'fail',log});throw error;}
}
try {
 if(metadata.private)throw new Error('Select a public source checkout for artifact qualification');
 let candidate=root,archives=join(run,'archives');
  await command('regression','npm',['test']);await command('type-and-links','npm',['run','check']);
  await command('independent-reader','python3',['-m','unittest','discover','-s','tests/independent-reader','-p','test_*.py']);
  await command('npm-archive',process.execPath,['distribution/assemble.mjs',archives]);
  const installedPath=join(run,'installed.json');await command('installed-consumer',process.execPath,['tests/qualification/installed-consumer.mjs','--worker','--extended',`--artifacts=${archives}`,`--result=${installedPath}`]);
  const installed=JSON.parse(await readFile(installedPath,'utf8'));if(!installed.passed)throw new Error('Installed qualification failed');
  await command('bounded-integer',process.execPath,['tests/qualification/verify-installed.mjs',installed.root]);
 const artifacts=JSON.parse(await readFile(join(archives,'artifacts.json'),'utf8')).artifacts;
 const nativeArchives=join(run,'native-archives');
 await command('native-assembly',process.execPath,['distribution/assemble.mjs','--native','--public-source',candidate,'--package-archive',join(archives,artifacts[0].filename),nativeArchives],candidate);
 await command('native-installed',process.execPath,['distribution/check-native.mjs',nativeArchives],candidate);
 report.candidate=candidate;report.artifacts=artifacts;report.nativeArtifacts=JSON.parse(await readFile(join(nativeArchives,'artifacts.json'),'utf8')).artifacts;report.status='pass';
}catch(error){report.status='fail';report.error=error.message;process.exitCode=1;}
const path=join(run,'report.json');await writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));console.log('RELEASE_REPORT '+path);
