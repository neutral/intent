import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageName='@neutral/intent';
const repositoryUrl='git+https://github.com/neutral/intent.git';
const requiredChecks=['regression','type-and-links','independent-reader','npm-archive','installed-consumer','bounded-integer','native-assembly','native-installed'];
const refuse=message=>{throw new Error(message);};
async function regularFile(path) {
  if(!(await lstat(path)).isFile())refuse(`Release input must be a regular file: ${path}`);
  return readFile(path);
}
const jsonFile=async path=>JSON.parse(await regularFile(path));

export async function validateReleaseSource({root}) {
  const metadata=await jsonFile(join(root,'package.json'));
  const version=metadata.version;
  if(metadata.name!==packageName||metadata.private===true)refuse('Select the public @neutral/intent package');
  if(typeof version!=='string'||!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version))refuse('npm releases require a stable major.minor.patch version');
  if(metadata.repository?.type!=='git'||metadata.repository.url!==repositoryUrl)refuse('Package repository must identify https://github.com/neutral/intent');
  if((await regularFile(join(root,'VERSION'))).toString().trim()!==version)refuse('VERSION differs from package.json');
  const lock=await jsonFile(join(root,'package-lock.json'));
  if(lock.name!==packageName||lock.version!==version||lock.packages?.['']?.name!==packageName||lock.packages[''].version!==version)refuse('Package lock identity or version differs from package.json');
  const changelog=(await regularFile(join(root,'CHANGELOG.md'))).toString();
  if(changelog.match(/^## .+$/m)?.[0]!==`## ${version}`)refuse('The first changelog release heading must name the package version');
  return {name:packageName,version,repository:metadata.repository};
}

export async function releaseReportFromLog(path) {
  const reports=(await regularFile(path)).toString().split(/\r?\n/).filter(line=>line.startsWith('RELEASE_REPORT ')).map(line=>line.slice(15));
  if(reports.length!==1||!reports[0])refuse('Qualification must identify exactly one release report');
  return reports[0];
}

export async function validateQualifiedRelease({root,reportPath}) {
  const source=await validateReleaseSource({root});
  const report=await jsonFile(reportPath),run=await realpath(dirname(reportPath));
  if(report.schema!=='intent.release-check.v2'||report.status!=='pass'||report.version!==source.version)refuse('Release qualification did not pass for this version');
  if(await realpath(report.run)!==run||await realpath(report.candidate)!==await realpath(root))refuse('Qualification report identifies another run or source checkout');
  if(!Array.isArray(report.checks)||report.checks.some(check=>check.status!=='pass')||requiredChecks.some(name=>report.checks.filter(check=>check.name===name).length!==1))refuse('Release qualification is missing a required passing check');
  if(!Array.isArray(report.artifacts)||report.artifacts.length!==1)refuse('Qualification must select exactly one npm archive');
  const artifact=report.artifacts[0],filename=`neutral-intent-${source.version}.tgz`;
  if(artifact.name!==source.name||artifact.version!==source.version||artifact.filename!==filename)refuse('Qualified npm archive identity or filename differs from the release');
  if(!/^[0-9a-f]{64}$/.test(artifact.sha256)||!Number.isSafeInteger(artifact.bytes)||artifact.bytes<1)refuse('Qualified npm archive must have a SHA-256 and positive byte count');
  const archives=join(run,'archives');
  if(await realpath(archives)!==archives)refuse('The qualified archive directory must not be a symbolic link');
  const inventory=await jsonFile(join(archives,'artifacts.json'));
  if(inventory.schema!=='intent.release-artifacts.v1'||inventory.version!==source.version||inventory.artifacts?.length!==1)refuse('Archive inventory differs from successful qualification');
  for(const key of ['name','version','filename','sha256','bytes'])if(inventory.artifacts[0][key]!==artifact[key])refuse(`Archive inventory differs from qualification: ${key}`);
  const archive=join(archives,filename),bytes=await regularFile(archive);
  if(bytes.length!==artifact.bytes||createHash('sha256').update(bytes).digest('hex')!==artifact.sha256)refuse('The qualified npm archive bytes have changed');
  const entry=path=>execFileSync('tar',['-xOf',archive,`package/${path}`],{encoding:'utf8',maxBuffer:2_000_000,stdio:['ignore','pipe','pipe']});
  const packed=JSON.parse(entry('package.json'));
  if(packed.name!==source.name||packed.version!==source.version||packed.private===true||packed.repository?.type!=='git'||packed.repository.url!==repositoryUrl||packed.publishConfig?.access!=='public'||entry('VERSION').trim()!==source.version)refuse('The qualified archive package metadata differs from the public release');
  return {...source,archive,sha256:artifact.sha256,bytes:artifact.bytes,report:await realpath(reportPath),run};
}

async function main() {
  const [operation,...args]=process.argv.slice(2),options={};
  if(!['source','artifact'].includes(operation))refuse('Usage: verify-release.mjs source | artifact --report FILE | artifact --log FILE');
  for(let i=0;i<args.length;i+=2) {
    if(!['--report','--log'].includes(args[i])||!args[i+1]||Object.hasOwn(options,args[i]))refuse(`Unsupported or repeated release argument: ${args[i]}`);
    options[args[i]]=args[i+1];
  }
  const root=fileURLToPath(new URL('../../',import.meta.url));
  let result;
  if(operation==='artifact') {
    if(Boolean(options['--report'])===Boolean(options['--log']))refuse('Select exactly one qualification report or release-check log');
    const reportPath=options['--report']??await releaseReportFromLog(options['--log']);
    result=await validateQualifiedRelease({root,reportPath});
  } else {
    if(options['--report']||options['--log'])refuse('Source validation does not take qualification inputs');
    result=await validateReleaseSource({root});
  }
  console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main().catch(error=>{console.error(error.message);process.exitCode=1;});
