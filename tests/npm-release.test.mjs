import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { releaseReportFromLog, validateQualifiedRelease, validateReleaseSource } from '../workflows/npm-release/verify-release.mjs';

const metadata={name:'@neutral/intent',version:'0.1.0',repository:{type:'git',url:'git+https://github.com/neutral/intent.git'},publishConfig:{access:'public'}};
const json=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
async function fixture(t) {
  const root=await realpath(await mkdtemp(join(tmpdir(),'intent-npm-release-')));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await json(join(root,'package.json'),metadata);
  await writeFile(join(root,'VERSION'),'0.1.0\n');
  await json(join(root,'package-lock.json'),{name:metadata.name,version:metadata.version,packages:{'':metadata}});
  await writeFile(join(root,'CHANGELOG.md'),'# Changes\n\n## 0.1.0\n\nInitial release.\n');
  return root;
}
async function qualifiedFixture(t) {
  const root=await fixture(t),run=join(root,'run'),archives=join(run,'archives'),packed=join(run,'staging');
  await mkdir(join(packed,'package'),{recursive:true});
  await mkdir(archives,{recursive:true});
  await json(join(packed,'package/package.json'),metadata);
  await writeFile(join(packed,'package/VERSION'),'0.1.0\n');
  const filename='neutral-intent-0.1.0.tgz',archive=join(archives,filename);
  execFileSync('tar',['-czf',archive,'-C',packed,'package']);
  const bytes=await readFile(archive),artifact={name:metadata.name,version:metadata.version,filename,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
  const inventory={schema:'intent.release-artifacts.v1',version:metadata.version,artifacts:[artifact]};
  const inventoryPath=join(archives,'artifacts.json');await json(inventoryPath,inventory);
  const report={schema:'intent.release-check.v2',version:metadata.version,status:'pass',sourceCommit:null,sourceStatus:'Source has no Git commit',candidate:root,run,artifacts:[artifact],checks:['regression','type-and-links','independent-reader','npm-archive','installed-consumer','bounded-integer','native-assembly','native-installed'].map(name=>({name,status:'pass'}))};
  const reportPath=join(run,'report.json');await json(reportPath,report);
  return {root,reportPath,report,archive,artifact,inventory,inventoryPath};
}

test('manual npm release requires synchronized public version inputs',async t=>{
  const cases=[
    ['unstable version',root=>json(join(root,'package.json'),{...metadata,version:'0.1.0-rc.1'}),/stable/],
    ['unfinished changelog',root=>writeFile(join(root,'CHANGELOG.md'),'# Changes\n\n## Unreleased\n'),/changelog/],
    ['VERSION mismatch',root=>writeFile(join(root,'VERSION'),'0.2.0\n'),/VERSION/],
    ['private package',root=>json(join(root,'package.json'),{...metadata,private:true}),/public/],
    ['repository mismatch',root=>json(join(root,'package.json'),{...metadata,repository:{type:'git',url:'https://github.com/example/intent'}}),/repository/],
    ['root lock version',root=>json(join(root,'package-lock.json'),{name:metadata.name,version:'0.2.0',packages:{'':metadata}}),/lock/],
    ['lock package version',root=>json(join(root,'package-lock.json'),{name:metadata.name,version:metadata.version,packages:{'':{...metadata,version:'0.2.0'}}}),/lock/],
  ];
  for(const [name,change,expected] of cases)await t.test(name,async t=>{
    const root=await fixture(t);await change(root);await assert.rejects(validateReleaseSource({root}),expected);
  });
  const root=await fixture(t);assert.equal((await validateReleaseSource({root})).version,'0.1.0');
});

test('manual source and artifact commands work without Git or a committed source',async t=>{
  const selected=await qualifiedFixture(t),helper=join(selected.root,'workflows/npm-release/verify-release.mjs');
  await mkdir(join(selected.root,'workflows/npm-release'),{recursive:true});
  await cp(new URL('../workflows/npm-release/verify-release.mjs',import.meta.url),helper);
  await assert.rejects(lstat(join(selected.root,'.git')),{code:'ENOENT'});
  const invoke=args=>JSON.parse(execFileSync(process.execPath,[helper,...args],{cwd:selected.root,encoding:'utf8'}));
  assert.equal(invoke(['source']).version,'0.1.0');
  assert.equal(invoke(['artifact','--report',selected.reportPath]).archive,selected.archive);
  selected.report.sourceCommit='a'.repeat(40);selected.report.sourceStatus=' M README.md\n?? VERSION';
  await json(selected.reportPath,selected.report);
  const log=join(selected.root,'release.log');await writeFile(log,`RELEASE_REPORT ${selected.reportPath}\n`);
  assert.equal(invoke(['artifact','--log',log]).archive,selected.archive);
});

test('npm publication selects the bytes of the fully qualified archive',async t=>{
  const selected=await qualifiedFixture(t),result=await validateQualifiedRelease(selected);
  assert.equal(result.archive,selected.archive);assert.equal(result.sha256,selected.artifact.sha256);
  const log=join(selected.root,'release.log');
  await writeFile(log,`PASS regression\nRELEASE_REPORT ${selected.reportPath}\n`);
  assert.equal(await releaseReportFromLog(log),selected.reportPath);
  await writeFile(log,`RELEASE_REPORT ${selected.reportPath}\nRELEASE_REPORT /another/report.json\n`);
  await assert.rejects(releaseReportFromLog(log),/exactly one/);
});

test('npm publication refuses failed, incomplete, changed and unsafe qualification artifacts',async t=>{
  const cases=[
    ['failed report',x=>{x.report.status='fail';},/did not pass/],
    ['wrong version',x=>{x.report.version='0.2.0';},/did not pass/],
    ['different source',x=>{x.report.candidate=x.report.run;},/another run or source/],
    ['different run',x=>{x.report.run=x.root;},/another run or source/],
    ['missing check',x=>{x.report.checks.pop();},/required passing check/],
    ['failed check',x=>{x.report.checks[0].status='fail';},/required passing check/],
    ['duplicate check',x=>{x.report.checks.push(x.report.checks[0]);},/required passing check/],
    ['multiple archives',x=>{x.report.artifacts.push({...x.artifact});},/exactly one/],
    ['path traversal',x=>{x.artifact.filename='../neutral-intent-0.1.0.tgz';},/filename/],
    ['absolute filename',x=>{x.artifact.filename='/tmp/neutral-intent-0.1.0.tgz';},/filename/],
    ['newline filename',x=>{x.artifact.filename+='\noutput=unexpected';},/filename/],
    ['wrong package',x=>{x.artifact.name='@neutral/other';},/identity/],
    ['changed bytes',x=>writeFile(x.archive,'changed'),/bytes have changed/],
    ['changed inventory',x=>{x.inventory.artifacts=[{...x.artifact,sha256:'0'.repeat(64)}];},/inventory differs/],
    ['different packed identity',async x=>{
      const staging=join(x.report.run,'staging');
      await json(join(staging,'package/package.json'),{...metadata,version:'0.2.0'});
      execFileSync('tar',['-czf',x.archive,'-C',staging,'package']);
      const bytes=await readFile(x.archive);x.artifact.bytes=bytes.length;x.artifact.sha256=createHash('sha256').update(bytes).digest('hex');
    },/archive package metadata/],
    ['archive symlink',async x=>{const copy=x.archive+'.copy';await writeFile(copy,await readFile(x.archive));await rm(x.archive);await symlink(copy,x.archive);},/regular file/],
  ];
  for(const [name,change,expected] of cases)await t.test(name,async t=>{
    const selected=await qualifiedFixture(t);await change(selected);
    await json(selected.reportPath,selected.report);await json(selected.inventoryPath,selected.inventory);
    await assert.rejects(validateQualifiedRelease(selected),expected);
  });
});
