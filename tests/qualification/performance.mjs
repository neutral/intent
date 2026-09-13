#!/usr/bin/env node
import { mkdtemp, mkdir, writeFile, readFile, readdir, copyFile, symlink, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { tmpdir, cpus, totalmem, platform, release, version, arch, loadavg } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve, relative } from "node:path";
import { performance } from "node:perf_hooks";

// Fixed before the first run. Do not adjust these ceilings to turn a run green.
const THRESHOLDS=Object.freeze({
  100:{coldInspectMs:5000,firstQueryMs:500,warmQueryP95Ms:250,reconcileMs:15000,proposalMs:15000,peakRssMiB:2048},
  1000:{coldInspectMs:30000,firstQueryMs:2000,warmQueryP95Ms:750,reconcileMs:90000,proposalMs:90000,peakRssMiB:2048},
  5000:{coldInspectMs:180000,firstQueryMs:8000,warmQueryP95Ms:3000,reconcileMs:300000,proposalMs:300000,peakRssMiB:2048},
});
const requestedCounts=process.argv.find(arg=>arg.startsWith('--counts='))?.slice(9);
const COUNTS=requestedCounts?requestedCounts.split(',').map(Number):[100,1000,5000];
if(!COUNTS.length||new Set(COUNTS).size!==COUNTS.length||COUNTS.some(count=>!Object.hasOwn(THRESHOLDS,count)))throw new Error('Select unique declared scales with --counts=100,1000,5000');
const WARM_REPETITIONS=20,WORKER_TIMEOUT_MS=600000;
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,"../.."),script=fileURLToPath(import.meta.url);
const hash=bytes=>`sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const outputHash=value=>hash(JSON.stringify(value));
const clock=()=>performance.now();
const query={text:"storage",kinds:["blueprint"],statuses:["current"],owners:["qualification"],limit:50};
const pageIdentity=page=>({basis:page.basis,records:page.records,total:page.total,complete:page.complete,hasNext:page.nextCursor!==null});
const hardware=()=>({platform:platform(),release:release(),version:version(),arch:arch(),node:process.version,v8:process.versions.v8,logicalCpus:cpus().length,cpuModels:[...new Set(cpus().map(cpu=>cpu.model))],memoryGiB:totalmem()/1024**3,loadAverage:loadavg()});
const peakRssMiB=()=>process.resourceUsage().maxRSS/1024;
const progress=value=>process.stdout.write(JSON.stringify(value)+"\n");

async function publicLibrary(runtime) {
  const start=clock();
  const main=await import(pathToFileURL(join(runtime,"dist/library/index.js")));
  return {...main,moduleImportMs:clock()-start};
}
async function treeFiles(root) {
  const files=[];
  async function visit(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await visit(path);else if(entry.isFile())files.push(path);}}
  await visit(root);return files.sort();
}
async function snapshotRuntime(runRoot) {
  const runtime=join(runRoot,"runtime"),copied=[];
  for(const folder of ["dist/library","spec/schemas"]){
    for(const source of await treeFiles(join(repo,folder))){const name=relative(repo,source),target=join(runtime,name);await mkdir(dirname(target),{recursive:true});await copyFile(source,target);copied.push({path:name,digest:hash(await readFile(target))});}
  }
  for(const name of ["package.json","package-lock.json"]){await copyFile(join(repo,name),join(runtime,name));copied.push({path:name,digest:hash(await readFile(join(runtime,name)))});}
  const dependencies=await realpath(join(repo,"node_modules"));await symlink(dependencies,join(runtime,"node_modules"));
  // Abort a snapshot assembled across a concurrent rebuild. A later rebuild does
  // not change the staged bytes that workers import.
  for(const file of copied)if(hash(await readFile(join(repo,file.path)))!==file.digest)throw new Error(`Build changed during runtime snapshot: ${file.path}`);
  return {runtime,files:copied,closureDigest:outputHash(copied),dependencyPath:dependencies,lockDigest:hash(await readFile(join(repo,"package-lock.json")))};
}
function sourceFor(kind,index,{status="current",relationships=[]}={}) {
  const name=String(index).padStart(5,"0"),id=`${kind}.unit-${name}`,title=`${kind==="blueprint"?"Storage component":"Storage implementation"} ${name}`;
  const unit=`src/units/unit-${name}`;
  const spec=kind==="description"?{responsibility:`Normalize and store values within generated unit ${name}.`,coverage:[{path:unit,mode:"tree",role:"primary"}],behavior:["Reads return a normalized value; writes replace the supplied value."],boundaries:["Each generated module has local arguments and no external service."],invariants:["Input values are represented as strings."],dependencies:[],failure:["An absent value is represented by an empty string."],rationale:["Separate generated units exercise literal implementation ownership."]}:
    {decision:`Keep storage component ${name} behind a small function boundary.`,scope:[`Generated component ${name}`],components:["Read helper","Write helper"],constraints:["Calls use explicit arguments."],interfaces:["Named JavaScript functions"],dataFlows:["Argument to normalized return value"],tradeoffs:["More small files require explicit navigation."],evolution:["Revise the decision when the generated boundary changes."]};
  const header={schema:"intent.knowledge-record.v2",kind,id,status};
  const coordinate=id,context={catalog:{schema:"intent.catalog.v1",sources:[],records:[{record:coordinate,owners:["qualification"],tags:["scale-fixture"]}]},connections:{schema:"intent.connections.v1",relationships:relationships.map((edge,index)=>({id:`relation-${index+1}`,record:coordinate,...edge})),conflicts:[],sourceUses:[],coverage:kind==="description"?spec.coverage.map((selector,index)=>({id:`coverage-${index+1}`,record:coordinate,...selector})):[],checkSelections:[]}};
  const sections=kind==="description"?[["Responsibility","responsibility"],["Behavior","behavior"],["Boundaries","boundaries"],["Invariants","invariants"],["Dependencies","dependencies"],["Failure Behavior","failure"],["Rationale","rationale"]]:[["Decision","decision"],["Scope","scope"],["Components","components"],["Constraints","constraints"],["Interfaces","interfaces"],["Data Flows","dataFlows"],["Tradeoffs","tradeoffs"],["Evolution","evolution"]];
  const sourceText = `---\n${JSON.stringify(header)}\n---\n# ${title}\n\nSynthetic scale fixture for storage unit ${name}; no real product claim.\n\n${sections.map(([section,field])=>`## ${section}\n\n${Array.isArray(spec[field])?spec[field].map((text,index)=>`### entry:${field.replace(/[A-Z]/g,char=>`-${char.toLowerCase()}`)}-${index+1}\n\n${text}\n`).join("\n"):spec[field]}\n`).join("\n")}`;
  return {sourceText,context};
}
export async function generateCorpus(runtime,root,count) {
  const api=await publicLibrary(runtime),files=new Map(),context={catalog:{schema:"intent.catalog.v1",sources:[],records:[]},connections:{schema:"intent.connections.v1",relationships:[],conflicts:[],sourceUses:[],coverage:[],checkSelections:[]}};let previousBlueprint=null,edges=0;
  const config={schema:"intent.project.v1",name:`Synthetic storage corpus ${count}`,owners:["qualification"],implementationRoots:["src"],exemptions:[]};
  files.set("intent/project.json",JSON.stringify(config,null,2)+"\n");
  files.set("intent/disciplines/registry.json",JSON.stringify({schema:"intent.discipline-registry.v1",packs:[],adoptions:[],workTypes:[]})+"\n");
  for(let index=0;index<count;index++) {
    const slot=index%10,name=String(index).padStart(5,"0"),kind=slot<5?"description":"blueprint",status=slot>=8?"draft":"current";
    const group=index-slot,targetDescription=`description.unit-${String(group).padStart(5,"0")}`,targetBlueprint=`blueprint.unit-${String(group+5).padStart(5,"0")}`;
    const relationships=kind==="description"?[{type:"realizes",target:targetBlueprint,required:true}]:status==="current"?[
      {type:"related-to",target:targetDescription,required:false},...(previousBlueprint?[{type:"depends-on",target:previousBlueprint,required:true}]:[]),]:[];
    if(kind==="blueprint"&&status==="current")previousBlueprint=`blueprint.unit-${name}`;edges+=relationships.length;
    const path=kind==="description"?`intent/description/src/units/unit-${name}/_unit.desc.md`:`intent/blueprint/unit-${name}.md`;
    const source=sourceFor(kind,index,{status,relationships}),inspected=api.inspectRecord(source.sourceText,{path,context:source.context});
    if(!inspected.valid)throw new Error(`Fixture record invalid: ${JSON.stringify(inspected.diagnostics)}`);
    files.set(path,source.sourceText);
    context.catalog.records.push(...source.context.catalog.records);for(const key of ["relationships","conflicts","sourceUses","coverage","checkSelections"])context.connections[key].push(...source.context.connections[key]);
    if(kind==="description")for(const operation of ["read","write"])files.set(`src/units/unit-${name}/${operation}.js`,`// Synthetic ordinary JavaScript module: ${name}\nexport function ${operation}Value(value) {\n  if (value === undefined || value === null) return '';\n  return String(value).trim();\n}\n`);
  }
  for(const [name,value]of Object.entries(context))files.set(`intent/${name}.json`,JSON.stringify(value,null,2)+"\n");
  let bytes=0;await mkdir(root,{recursive:true});
  const all=[...files];let cursor=0;
  await Promise.all(Array.from({length:16},async()=>{for(;;){const index=cursor++;if(index>=all.length)return;const [path,text]=all[index];await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),text,{flag:"wx"});bytes+=Buffer.byteLength(text);}}));
  return {authoredRecords:count,codeFiles:count,descriptionCurrent:count/2,blueprintCurrent:count*0.3,blueprintDraft:count/5,globalFiles:2,requiredEdges:count*0.8-1,optionalEdges:count*0.3,totalGraphEdges:edges,requiredDependencyChainNodes:count*0.3,sourceFiles:files.size,sourceBytes:bytes};
}

function workspaceSummary(workspace) {
  const diagnostics={};for(const issue of workspace.diagnostics)diagnostics[issue.code]=(diagnostics[issue.code]??0)+1;
  return {mode:workspace.mode,basis:workspace.sourceBasis.id,outputDigest:outputHash(workspace),records:workspace.records.length,governedArtifacts:workspace.coverage?.artifacts.length,graphEdges:workspace.graph.edges.length,complete:workspace.complete,valid:workspace.valid,diagnostics,serializedBytes:Buffer.byteLength(JSON.stringify(workspace))};
}
async function worker({runtime,root,phase}) {
  const api=await publicLibrary(runtime),result={phase,moduleImportMs:api.moduleImportMs,startedAt:new Date().toISOString(),measurements:{},agreements:{}};
  try{
    const source=await api.FileSystemSource.open(root);
    if(phase==="cold-inspect"){
      const start=clock(),inspection=await api.readWorkspace(source);result.measurements.coldInspectMs=clock()-start;
      result.workspace=workspaceSummary(inspection);result.queryDigest=outputHash(pageIdentity(api.queryKnowledge(inspection,query)));
      result.agreements.valid=inspection.valid&&inspection.complete;
    }else if(phase==="queries"){
      const inspection=await api.readWorkspace(source),start=clock(),page=api.queryKnowledge(inspection,query);
      result.measurements.firstQueryMs=clock()-start;result.queryDigest=outputHash(pageIdentity(page));result.workspace=workspaceSummary(inspection);
      const times=[];for(let index=0;index<WARM_REPETITIONS;index++){
        const begin=clock(),next=api.queryKnowledge(inspection,query);times.push(clock()-begin);
        if(outputHash(pageIdentity(next))!==result.queryDigest)throw new Error("Queries over the same observation disagreed");
      }
      const ordered=[...times].sort((a,b)=>a-b);result.measurements.warmQueryP50Ms=ordered[Math.ceil(times.length*.5)-1];result.measurements.warmQueryP95Ms=ordered[Math.ceil(times.length*.95)-1];result.warmQuerySamplesMs=times;
      const independent=await api.readWorkspace(source);result.agreements.freshWorkspace=outputHash(independent)===outputHash(inspection);
      result.agreements.query=outputHash(pageIdentity(api.queryKnowledge(independent,query)))===result.queryDigest;
      if(page.nextCursor)result.agreements.secondPage=outputHash(api.queryKnowledge(independent,{...query,cursor:page.nextCursor}))===outputHash(api.queryKnowledge(inspection,{...query,cursor:page.nextCursor}));
    }else if(phase==="prepare-edit"){
      const recordPath="intent/blueprint/unit-00005.md",before=await readFile(join(root,recordPath),"utf8"),after=before.replace("Keep storage component","Keep this explicit storage component");
      const start=clock(),proposal=await api.proposeRecordChange(source,{path:recordPath,operation:{kind:"edit",sourceText:after}});result.measurements.proposalMs=clock()-start;
      if(!proposal.complete||!proposal.fileProposal)throw new Error(`Proposal unavailable: ${JSON.stringify(proposal.diagnostics)}`);
      result.agreements.exactProposal=proposal.fileProposal.changes.some(change=>change.path===recordPath&&change.before===before&&change.after===after);
      result.agreements.noWrite=await readFile(join(root,recordPath),"utf8")===before;
      const overlay={identity:source.identity,immutable:false,read:(path,max)=>path===recordPath?Promise.resolve(Buffer.from(after)):source.read(path,max),async list(prefix){return(await source.list(prefix)).map(entry=>entry.path===recordPath?{...entry,size:Buffer.byteLength(after)}:entry);}};
      const independent=await api.readWorkspace(overlay);result.agreements.proposedBasis=proposal.proposed.sourceBasis.id===independent.sourceBasis.id;
      result.agreements.proposedRecords=outputHash(proposal.proposed.records.map(record=>[record.path,record.sourceDigest,record.semanticDigest]))===outputHash(independent.records.map(record=>[record.path,record.sourceDigest,record.semanticDigest]));
      result.review={complete:proposal.complete,workspaceValid:proposal.proposed.valid,impactComplete:proposal.impact.complete,affectedIds:proposal.impact.affectedIds.length,shownRecords:proposal.impact.records.length,serializedBytes:Buffer.byteLength(JSON.stringify(proposal))};
    }else{
      const before=await api.reconcileWorkspace(source),changedPath=phase==="reconcile-edit"?"src/units/unit-00000/read.js":"src/units/unit-00000/extra.js";
      await writeFile(join(root,changedPath),phase==="reconcile-edit"?"export function readValue(value) { return String(value ?? '').trim().toLowerCase(); }\n":"export const generatedExtra = true;\n",phase==="reconcile-add"?{flag:"wx"}:{});
      const start=clock(),after=await api.reconcileWorkspace(source),comparison=api.compareWorkspaces(before,after,{recordLimit:4096,recordByteLimit:67108864});result.measurements.reconcileMs=clock()-start;
      result.workspace=workspaceSummary(after);result.comparison={complete:comparison.complete,affectedIds:comparison.affectedIds.length,changedPaths:comparison.changes.map(change=>change.path)};
      const independent=await api.reconcileWorkspace(source);result.agreements.freshWorkspace=outputHash(independent)===outputHash(after);
      result.agreements.changedBasis=before.sourceBasis.id!==after.sourceBasis.id;result.agreements.changedPath=comparison.changes.some(change=>change.path===changedPath);
      result.agreements.valid=after.valid&&after.complete&&comparison.complete;
    }
    if(Object.values(result.agreements).some(value=>value!==true))throw new Error("An independently checked observation or proposal disagreed");
    result.ok=true;
  }catch(error){result.ok=false;result.error={code:error.code??null,message:error.message,stack:error.stack};}
  finally{result.peakRssMiB=peakRssMiB();result.endedAt=new Date().toISOString();}
  return result;
}
async function runWorker(options) {
  const destination=join(options.root,`${options.phase}.measurement.json`);progress({count:options.count,phase:options.phase,status:"starting"});
  return new Promise(resolveResult=>{
    const child=spawn(process.execPath,[script,"--worker",JSON.stringify({...options,destination})],{stdio:["ignore","pipe","pipe"]});let stdout="",stderr="",timedOut=false;
    child.stdout.on("data",bytes=>{stdout+=bytes;process.stdout.write(bytes);});child.stderr.on("data",bytes=>{stderr+=bytes;});
    const timer=setTimeout(()=>{timedOut=true;child.kill("SIGKILL");},WORKER_TIMEOUT_MS);
    child.once("error",error=>{clearTimeout(timer);resolveResult({phase:options.phase,ok:false,error:{message:error.message},stderr});});
    child.once("close",async code=>{clearTimeout(timer);let result;try{result=JSON.parse(await readFile(destination,"utf8"));}catch{result={phase:options.phase,ok:false,error:{message:timedOut?"Fixed 600-second worker timeout":`Worker exited ${code} without a measurement`}};}result.workerExitCode=code;result.stderr=stderr.trim();progress({count:options.count,phase:options.phase,status:"finished",ok:result.ok,measurements:result.measurements,peakRssMiB:result.peakRssMiB});resolveResult(result);});
  });
}
const seconds=value=>value===undefined?"unavailable":(value/1000).toFixed(3);
function renderReport(report) {
  const lines=["# Knowledge observation performance","",`Measured ${report.startedAt} through ${report.endedAt} against copied compiled source ${report.snapshot.closureDigest}. Outcome: **${report.passed?"PASS":"FAIL"}** for the selected synthetic scales and declared ceilings.`,"","| Records | Cold read | First query | Repeated query p95 | Reconcile edit | Reconcile addition | Prepare edit | Peak RSS |","| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"];
  for(const item of report.scales){const phases=Object.fromEntries(item.workers.map(worker=>[worker.phase,worker]));lines.push(`| ${item.count} | ${seconds(phases["cold-inspect"]?.measurements?.coldInspectMs)} s | ${seconds(phases.queries?.measurements?.firstQueryMs)} s | ${seconds(phases.queries?.measurements?.warmQueryP95Ms)} s | ${seconds(phases["reconcile-edit"]?.measurements?.reconcileMs)} s | ${seconds(phases["reconcile-add"]?.measurements?.reconcileMs)} s | ${seconds(phases["prepare-edit"]?.measurements?.proposalMs)} s | ${item.peakRssMiB.toFixed(1)} MiB |`);}
  lines.push("","A cold read runs in a fresh Node process after module import. Queries use one in-memory workspace observation; their timings exclude its initial read. Reconciliation measures an explicit reconcileWorkspace read and comparison after a controlled implementation edit or addition. Proposal timing includes coherent record-change preparation and source verification without application. No operation writes a persistent query index.","","The source has an explicit 80% current / 20% draft mix, literal Description ownership and a sparse required Blueprint dependency chain. Each fresh reconciliation must change the expected source identity and agree with a separate complete read. Repeated query samples and pagination must agree with the same observation and a fresh read. A proposal's exact change and selected record identities are compared with an independently read overlay; the authored source must remain unchanged.","","Thresholds and selected scales were recorded before workers ran. All 20 repeated-query samples contribute to p95. The fixed 600-second worker timeout is independent of each latency ceiling. Filesystem caches are not flushed. Corpus creation, imports and independent comparison reads are excluded from the main operation timers; process memory includes their overhead. Default proposal impact limits may produce a bounded review at larger scales; each result reports impact completeness separately from coherent proposal preparation.","",`Machine/runtime: ${JSON.stringify(report.hardware)}. Full samples, thresholds, exact copied-file identities, failures and limits: ${report.jsonPath}. Third-party dependency bytes use the existing read-only installation; its lock digest is ${report.snapshot.lockDigest}.`,"","These synthetic measurements establish no user latency requirement, human usefulness, production SLA or implementation correctness. Browser/Portal rendering, dense graphs, very large individual documents, network retrieval, package installation and human studies need separate evidence.","","Run `node tests/qualification/performance.mjs` for all declared scales, or select a subset such as `--counts=100`. Selection narrows the reported claim; it does not change any ceiling.","");
  return lines.join("\n");
}

async function main() {
  const runRoot=await realpath(await mkdtemp(join(tmpdir(),"intent-performance-"))),startedAt=new Date().toISOString();
  // This machine-readable declaration is durable before any corpus or measured worker runs.
  const declaration={startedAt,thresholds:THRESHOLDS,counts:COUNTS,warmRepetitions:WARM_REPETITIONS,workerTimeoutMs:WORKER_TIMEOUT_MS};
  await writeFile(join(runRoot,"thresholds-before-run.json"),JSON.stringify(declaration,null,2)+"\n");progress({status:"thresholds-declared",runRoot,...declaration});
  const snapshot=await snapshotRuntime(runRoot),report={startedAt,runRoot,jsonPath:join(runRoot,"measurements.json"),hardware:hardware(),snapshot,scales:[]};
  for(const count of COUNTS){
    const root=join(runRoot,`corpus-${count}`),generationStart=clock();progress({count,status:"generating"});const metadata=await generateCorpus(snapshot.runtime,root,count);
    const item={count,root,corpus:metadata,generationMs:clock()-generationStart,workers:[],checks:[]};
    for(const phase of ["cold-inspect","queries","reconcile-edit","reconcile-add","prepare-edit"]){
      item.workers.push(await runWorker({runtime:snapshot.runtime,root,count,phase}));
    }
    const w=Object.fromEntries(item.workers.map(worker=>[worker.phase,worker])),t=THRESHOLDS[count],check=(name,pass)=>item.checks.push({name,pass:!!pass});
    check("workers completed",item.workers.every(worker=>worker.ok));
    for(const [phase,key,limit] of [["cold-inspect","coldInspectMs",t.coldInspectMs],["queries","firstQueryMs",t.firstQueryMs],["queries","warmQueryP95Ms",t.warmQueryP95Ms],["reconcile-edit","reconcileMs",t.reconcileMs],["reconcile-add","reconcileMs",t.reconcileMs],["prepare-edit","proposalMs",t.proposalMs]])check(`${phase} ${key}`,typeof w[phase]?.measurements?.[key]==="number"&&w[phase].measurements[key]<=limit);
    item.peakRssMiB=Math.max(...item.workers.map(worker=>worker.peakRssMiB??Infinity));check("peak RSS",item.peakRssMiB<=t.peakRssMiB);
    check("independent first read and query observation",w["cold-inspect"]?.workspace?.outputDigest===w.queries?.workspace?.outputDigest&&w["cold-inspect"]?.queryDigest===w.queries?.queryDigest);
    check("governed addition changed inventory",w["reconcile-add"]?.workspace?.governedArtifacts===count+1);
    check("independent observation and proposal agreement",item.workers.every(worker=>worker.ok&&Object.values(worker.agreements??{}).every(Boolean)));
    item.passed=item.checks.every(check=>check.pass);report.scales.push(item);await writeFile(report.jsonPath,JSON.stringify(report,null,2)+"\n");progress({count,status:"scale-complete",passed:item.passed,checks:item.checks});
  }
  report.endedAt=new Date().toISOString();report.dependencyLockUnchanged=hash(await readFile(join(repo,"package-lock.json")))===snapshot.lockDigest;report.passed=report.scales.every(item=>item.passed)&&report.dependencyLockUnchanged;
  await writeFile(report.jsonPath,JSON.stringify(report,null,2)+"\n");await writeFile(join(runRoot,"report.md"),renderReport(report));progress({status:"complete",passed:report.passed,report:join(runRoot,"report.md"),measurements:report.jsonPath});
  if(!report.passed)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===script&&process.argv[2]==="--worker") {
  const options=JSON.parse(process.argv[3]),result=await worker(options);await writeFile(options.destination,JSON.stringify(result,null,2)+"\n");if(!result.ok)process.exitCode=1;
}else if(process.argv[1]&&resolve(process.argv[1])===script) await main();
