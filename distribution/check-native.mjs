import assert from 'node:assert/strict';
import { cp, lstat, mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'commonmark';

const root=fileURLToPath(new URL('../',import.meta.url));
if(process.argv.length!==3)throw new Error('Usage: node distribution/check-native.mjs ARTIFACT_DIRECTORY');
const artifacts=resolve(process.argv[2]);
const index=JSON.parse(await readFile(join(artifacts,'artifacts.json'),'utf8'));
assert.equal(index.schema,'intent.native-artifacts.v1');
const artifact=index.artifacts.find(item=>item.target===`${process.platform}-${process.arch}`);
assert.ok(artifact,'No native artifact for this host');
const run=await mkdtemp(join(tmpdir(),'intent-native-check-'));
const report={schema:'intent.native-check.v1',run,version:artifact.version,target:artifact.target,artifact:artifact.filename,checks:[],status:'running'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const taskHome=join(run,'Isolated user data'),emptyPath=join(run,'empty-path');
await mkdir(taskHome);await mkdir(emptyPath);
const env={...process.env,PATH:emptyPath,INTENT_STATE_DIR:join(taskHome,'data/intent')};
function command(name,executable,args,options={}) {
  const log=join(run,name+'.log');
  try {
    const output=execFileSync(executable,args,{cwd:run,env,encoding:'utf8',timeout:300000,maxBuffer:32000000,...options});
    report.checks.push({name,status:'pass',command:[executable,...args],log});
  writeFile(log,output).catch(()=>{});console.log(`PASS ${name}`);return output;
  } catch(error) {
    report.checks.push({name,status:'fail',command:[executable,...args],log});
    writeFile(log,String(error.stdout??'')+String(error.stderr??'')+'\n'+error.message).catch(()=>{});throw error;
  }
}
const exists=path=>lstat(path).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
try {
  assert.equal(sha(await readFile(join(artifacts,artifact.filename))),artifact.sha256);
  command('extract','/usr/bin/tar',['-xzf',join(artifacts,artifact.filename),'-C',run]);
  const bundle=join(run,artifact.filename.slice(0,-7));
  const inventory=JSON.parse(await readFile(join(bundle,'inventory.json'),'utf8'));
  for(const entry of inventory.files)assert.equal(sha(await readFile(join(bundle,entry.path))),entry.sha256,entry.path);
  report.checks.push({name:'extracted-inventory',status:'pass',files:inventory.files.length});
  let documentationLinks=0;
  const guides=inventory.files.filter(entry=>entry.path.endsWith('.md')&&!entry.path.startsWith('app/node_modules/'));
  for(const entry of guides) {
    const document=join(bundle,entry.path),walker=new Parser().parse(await readFile(document,'utf8')).walker();let event;
    while((event=walker.next()))if(event.entering&&['link','image'].includes(event.node.type)) {
      const target=event.node.destination??'';
      if(/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target))continue;
      const destination=resolve(dirname(document),decodeURIComponent(target.split(/[?#]/)[0]||'.')),local=relative(bundle,destination);
      assert.ok(!isAbsolute(local)&&local!=='..'&&!local.startsWith('../'),`Documentation link leaves bundle: ${entry.path} -> ${target}`);
      assert.ok(await exists(destination),`Missing bundled documentation link: ${entry.path} -> ${target}`);
      documentationLinks++;
    }
  }
  report.checks.push({name:'bundled-documentation-links',status:'pass',guides:guides.length,relativeFileLinks:documentationLinks,scope:'Intent Markdown link/image file targets; dependency documentation, remote URLs and heading fragments are not checked'});
  const payloadArtifact=index.artifacts.find(item=>item.kind==='application');assert.ok(payloadArtifact);
  assert.equal(sha(await readFile(join(artifacts,payloadArtifact.filename))),payloadArtifact.sha256);
  command('extract-application','/usr/bin/tar',['-xzf',join(artifacts,payloadArtifact.filename),'-C',run]);
  const payload=join(run,payloadArtifact.filename.slice(0,-7));
  assert.equal(await exists(join(payload,'runtime')),false);
  for(const entry of JSON.parse(await readFile(join(payload,'inventory.json'),'utf8')).files) {
    assert.equal(sha(await readFile(join(payload,entry.path))),entry.sha256,entry.path);
    assert.equal(sha(await readFile(join(bundle,entry.path))),entry.sha256,'native payload '+entry.path);
  }
  assert.throws(()=>command('application-requires-explicit-runtime',join(payload,'bin/intent'),['--help'],{env:{...env,INTENT_NODE:''}}),/requires INTENT_NODE/);
  report.checks.at(-1).status='pass';
  assert.match(command('application-help',join(payload,'bin/intent'),['--help'],{env:{...env,INTENT_NODE:process.execPath}}),/intent open/);
  assert.match(command('application-version',join(payload,'bin/intent'),['--version'],{env:{...env,INTENT_NODE:process.execPath}}),new RegExp(artifact.version.replaceAll('.','\\.')));
  assert.match(command('portable-help',join(bundle,'bin/intent'),['--help']),/intent open/);
  assert.match(command('portable-version',join(bundle,'bin/intent'),['--version']),new RegExp(artifact.version.replaceAll('.','\\.')));
  const relocated=join(run,'Relocated Intent bundle');await rename(bundle,relocated);
  assert.match(command('relocated-help',join(relocated,'bin/intent'),['--help']),/intent mcp/);
  const prefix=join(run,'Installed versions'),bin=join(run,'User commands');await mkdir(bin);
  const project=join(run,'Consumer project'),data=join(taskHome,'data/intent');await mkdir(project);await mkdir(data,{recursive:true});
  await writeFile(join(project,'keep.txt'),'authored sentinel');await writeFile(join(data,'draft.json'),'durable sentinel');
  const executable=join(bin,'intent');await writeFile(executable,'unrelated command');
  assert.throws(()=>command('install-conflict-refusal',join(relocated,'install'),['--prefix',prefix,'--bin-dir',bin]),/Preserving existing command/);
  report.checks.at(-1).status='pass';
  assert.equal(await readFile(executable,'utf8'),'unrelated command');
  const {rm}=await import('node:fs/promises');await rm(executable);
  command('install',join(relocated,'install'),['--prefix',prefix,'--bin-dir',bin]);
  assert.match(command('installed-help',executable,['--help']),/intent export/);
  assert.throws(()=>command('same-version-refusal',join(relocated,'install'),['--prefix',prefix,'--bin-dir',bin]),/Version already exists/);
  report.checks.at(-1).status='pass';
  command('native-journeys',process.execPath,[join(root,'tests/qualification/native-journeys.mjs'),executable],{env:{...env,INTENT_NATIVE_CHECK_RUN:run}});
  // A synthetic next manifest exercises installation switching, not release behavior.
  const manifest=JSON.parse(await readFile(join(relocated,'bundle.json'),'utf8'));
  manifest.version=artifact.version+'-installation-test';await writeFile(join(relocated,'bundle.json'),JSON.stringify(manifest));
  command('update',join(relocated,'install'),['--prefix',prefix,'--bin-dir',bin]);
  assert.equal(JSON.parse(await readFile(join(prefix,'installation.json'),'utf8')).versions.length,2);
  command('updated-help',executable,['--help']);
  command('uninstall',executable,['uninstall']);
  assert.equal(await exists(executable),false);assert.equal(await exists(prefix),false);
  assert.equal(await readFile(join(project,'keep.txt'),'utf8'),'authored sentinel');
  assert.equal(await readFile(join(data,'draft.json'),'utf8'),'durable sentinel');
  report.checks.push({name:'project-and-durable-data-preserved',status:'pass'});
  report.status='pass';
} catch(error) {report.status='fail';report.error=error.stack;process.exitCode=1;}
await writeFile(join(run,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
console.log('NATIVE_CHECK '+join(run,'report.json'));
