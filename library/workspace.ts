import { compareText, diagnostic, digest, digestJson, IntentError, limitsFor, normalizedPath, orderedDiagnostics } from "./foundation.js";
import { inspectCoverage, inspectDescriptionStructure, type CoverageInspection } from "./coverage.js";
import { inspectGraph, type KnowledgeGraph } from "./graph.js";
import { cloneRecordInspection, inspectRecord, readLocalHeader } from "./records.js";
import { emptyContext, inspectGlobalContext, indexRecordContexts, validateGlobalOwners } from "./globals.js";
import { validateSchema } from "./schemas.js";
import { parseStrictJson } from "./strict-json.js";
import { createWorkspaceOperation, isWorkspaceOperation, memoizedWorkspaceValue, observedDigest, relevantListing } from "./observation.js";
import { inspectDisciplineRegistry, type DisciplineRegistryInspection } from "./disciplines.js";
import type { Diagnostic, Digest, Json, KnowledgeRecord, Limits, ProjectConfig, RecordInspection, SourceEntry, SourceReader, SourceReference, RecordContext } from "./types.js";

export type SourceDisposition="resolved"|"unrequested"|"unsupported"|"retrieval-denied"|"missing"|"unreadable"|"digest-mismatch"|"revision-mismatch"|"role-mismatch";
export interface SourceResolution {disposition:SourceDisposition;bytes?:Uint8Array;revision?:string|null;role?:string;message?:string}
export interface SourceObservation {record:string;id:string;reference:string;required:boolean;disposition:SourceDisposition;sourceDigest:Digest|null;bytes:number;message:string|null}
export interface WorkspaceStage {name:string;complete:boolean;valid:boolean}
export interface WorkspaceInspection {
  profile:"workspace-v1";processor:"intent.processing.v2";mode:"knowledge"|"reconciliation";
  sourceBasis:{kind:"working-tree"|"export";id:Digest;reader:string};
  config:ProjectConfig|null;context:RecordContext|null;limits:Limits;
  records:KnowledgeRecord[];inspections:RecordInspection[];
  graph:KnowledgeGraph;coverage:CoverageInspection|null;
  disciplines:DisciplineRegistryInspection|null;
  sources:SourceObservation[];inventory:{path:string;sourceDigest:Digest}[];
  stages:WorkspaceStage[];diagnostics:Diagnostic[];complete:boolean;valid:boolean;
}
export interface WorkspaceOptions {
  limits?:Partial<Limits>;resolveSources?:boolean;reconcileImplementation?:boolean;
  resolver?:(reference:SourceReference,record:KnowledgeRecord,maximumBytes:number)=>Promise<SourceResolution>;
}
const ROOTS=["intent/behavior","intent/assurance","intent/blueprint","intent/checks","intent/description","intent/disciplines"];
const textDecoder=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true});
export function readJsonBytes(bytes:Uint8Array,limits:Limits):Json {
  if(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf) throw new IntentError("intent.text.bom","Byte-order mark is not allowed");
  let text:string;try {text=textDecoder.decode(bytes);}catch {throw new IntentError("intent.text.utf8","Invalid UTF-8");}
  return parseStrictJson(text,{maxBytes:limits.maxFrontMatterBytes,maxDepth:limits.maxJsonDepth,maxNodes:limits.maxJsonNodes});
}

/** Read one bounded observation. No commands, network retrieval, or durable writes are implicit. */
export async function readWorkspace(source:SourceReader,options:WorkspaceOptions={}):Promise<WorkspaceInspection> {
  if(options.reconcileImplementation!==undefined&&typeof options.reconcileImplementation!=="boolean")throw new IntentError("intent.workspace.options","reconcileImplementation must be boolean");
  const mode=options.reconcileImplementation?"reconciliation" as const:"knowledge" as const;
  const operation=isWorkspaceOperation(source)?null:createWorkspaceOperation(source);
  if(operation)source=operation.source;
  let limits=limitsFor(options.limits), config:ProjectConfig|null=null, context:RecordContext|null=null;
  const diagnostics:Diagnostic[]=[],stages:WorkspaceStage[]=[],observed=new Map<string,Uint8Array>(),listings=new Map<string,SourceEntry[]>();
  let changed=false;
  const reader:SourceReader={identity:source.identity,immutable:source.immutable,
    async read(path,maximumBytes){
      const bytes=await source.read(path,maximumBytes);
      if(bytes.length>maximumBytes) throw new IntentError("intent.limit.source-bytes",`Reader exceeded byte bound for ${path}`);
      const previous=observed.get(path);
      if(previous&&observedDigest(source,previous)!==observedDigest(source,bytes)) {changed=true;throw new IntentError("intent.source.changed",`Source changed during observation: ${path}`);}
      observed.set(path,bytes);return bytes;
    },
    async list(prefix){
      const entries=await source.list(prefix);
      if(entries.length>262144) throw new IntentError("intent.limit.source-entries","Source listing exceeds 262144 entries");
      for(const entry of entries) {normalizedPath(entry.path,true,limits.maxPathBytes);if(prefix!=="."&&entry.path!==prefix&&!entry.path.startsWith(`${prefix}/`)) throw new IntentError("intent.source.scope",`Reader returned ${entry.path} outside ${prefix}`);}
      const sorted=relevantListing(prefix,entries);
      const prior=listings.get(prefix);
      if(prior&&JSON.stringify(prior)!==JSON.stringify(sorted)) {changed=true;throw new IntentError("intent.source.changed",`Source listing changed: ${prefix}`);}
      listings.set(prefix,sorted);return entries;
    }};
  const stage=(name:string,start:number,complete=true)=>stages.push({name,complete,valid:complete&&!diagnostics.slice(start).some(d=>d.severity==="error")});
  let start=diagnostics.length;
  let projectValue:Json|undefined;
  try {
    await reader.list("intent/project.json");
    const bytes=await reader.read("intent/project.json",limits.maxFrontMatterBytes);
    projectValue=memoizedWorkspaceValue(source,`json:${observedDigest(source,bytes)}:${JSON.stringify(limits)}`,()=>readJsonBytes(bytes,limits));
    diagnostics.push(...validateSchema("project",projectValue,"intent/project.json"));
  }catch(error){diagnostics.push(diagnostic(error,"intent/project.json","configuration"));}
  // Observe both names independently. An obsolete file cannot hide changes to
  // the surviving configuration while a reviewed repair removes that file.
  try {
    const obsolete=await reader.list("intent/intent.json");
    if(obsolete.length){
      if(obsolete.some(entry=>entry.path==="intent/intent.json"&&entry.kind==="file"))await reader.read("intent/intent.json",limits.maxFrontMatterBytes);
      throw new IntentError("intent.configuration.obsolete","intent/intent.json is unsupported; the only configuration path is intent/project.json");
    }
  }catch(error){diagnostics.push(diagnostic(error,"intent/intent.json","configuration"));}
  if(projectValue!==undefined&&!diagnostics.slice(start).some(issue=>issue.severity==="error"))try {
    config=projectValue as unknown as ProjectConfig;
    const declared=limitsFor(config.limits);
    limits=Object.fromEntries(Object.entries(declared).map(([key,value])=>[key,Math.min(value,limits[key as keyof Limits])])) as unknown as Limits;
    for(const path of config.implementationRoots)normalizedPath(path,true,limits.maxPathBytes);
    for(const exempt of config.exemptions)normalizedPath(exempt.path,false,limits.maxPathBytes);
  }catch(error){config=null;diagnostics.push(diagnostic(error,"intent/project.json","configuration"));}
  stage("configuration",start,config!==null);
  start=diagnostics.length;
  const globalValues:Record<string,Json>={};
  for(const name of ["catalog","connections"] as const)try {
    await reader.list(`intent/${name}.json`);
    const bytes=await reader.read(`intent/${name}.json`,limits.maxSourceBytes),jsonLimits={...limits,maxFrontMatterBytes:limits.maxSourceBytes};
    globalValues[name]=memoizedWorkspaceValue(source,`json:${observedDigest(source,bytes)}:${JSON.stringify(jsonLimits)}`,()=>readJsonBytes(bytes,jsonLimits));
  }catch(error){diagnostics.push(diagnostic(error,`intent/${name}.json`,"globals"));}
  if(Object.hasOwn(globalValues,"catalog")&&Object.hasOwn(globalValues,"connections")){
    const issues=inspectGlobalContext(globalValues as unknown as RecordContext,"intent",limits);diagnostics.push(...issues);
    if(!issues.some(issue=>issue.severity==="error"))context=globalValues as unknown as RecordContext;
  }
  stage("globals",start,context!==null);
  const contexts=context?indexRecordContexts(context):new Map<string,RecordContext>();
  const coordinates:string[]=[],declarations:{id:string;path:string}[]=[];
  const paths=new Set<string>(), inspections:RecordInspection[]=[],records:KnowledgeRecord[]=[];
  start=diagnostics.length;let discoveryComplete=true;
  for(const root of ROOTS) {
    try {for(const entry of await reader.list(root)) {
      if(entry.kind==="directory") continue;
      if(entry.kind!=="file") {diagnostics.push({code:"intent.source.unsupported",severity:"error",stage:"discovery",path:entry.path,message:"Knowledge discovery requires regular files and directories"});discoveryComplete=false;continue;}
      if(!entry.path.endsWith(".md")) continue;
      if(paths.size>=limits.maxRecords) throw new IntentError("intent.limit.records",`Record count exceeds ${limits.maxRecords}`);
      paths.add(entry.path);
    }} catch(error) {diagnostics.push(diagnostic(error,root,"discovery"));discoveryComplete=false;}
  }
  stage("discovery",start,discoveryComplete);
  start=diagnostics.length;let structuralComplete=true,total=0;
  for(const path of [...paths].sort(compareText)) {
    try {
      if(total>=limits.maxTotalRecordBytes) throw new IntentError("intent.limit.total-record-bytes","Aggregate record byte limit exhausted");
      const bytes=await reader.read(path,Math.min(limits.maxRecordBytes,limits.maxTotalRecordBytes-total));total+=bytes.length;
      if(total>limits.maxTotalRecordBytes) throw new IntentError("intent.limit.total-record-bytes","Aggregate record byte limit exceeded");
      let selected:RecordContext|undefined;
      try {const local=memoizedWorkspaceValue(source,`header:${observedDigest(source,bytes)}:${JSON.stringify(limits)}`,()=>readLocalHeader(bytes,{limits}));coordinates.push(local.id);declarations.push({id:local.id,path});if(context)selected=contexts.get(local.id)??emptyContext();}catch {/* Full local diagnostics remain owned by inspectRecord. */}
      const inspection=memoizedWorkspaceValue(source,`record:${path}:${observedDigest(source,bytes)}:${digestJson({limits,context:selected??null} as unknown as Json)}`,()=>inspectRecord(bytes,{path,limits,...(selected?{context:selected}:{})}),cloneRecordInspection);inspections.push(inspection);diagnostics.push(...inspection.diagnostics);
      structuralComplete&&=inspection.complete;if(inspection.record) records.push(inspection.record);
    }catch(error){const entry=diagnostic(error,path,"records");diagnostics.push(entry);inspections.push({path,raw:null,record:null,identity:null,valid:false,complete:false,diagnostics:[entry]});structuralComplete=false;}
  }
  if(context)diagnostics.push(...validateGlobalOwners(context,coordinates,"intent"));
  stage("records",start,structuralComplete);
  start=diagnostics.length;
  const graph=inspectGraph(records,{limits,declarations,...(config?{owners:config.owners}:{})});diagnostics.push(...graph.diagnostics);
  stage("identity-relationships",start,graph.complete);
  const seenIds=new Set<string>(),ambiguousIds=new Set<string>();
  for(const declaration of declarations){if(seenIds.has(declaration.id))ambiguousIds.add(declaration.id);else seenIds.add(declaration.id);}
  // Full parsed siblings remain in inspections for explicit review, but cannot
  // supply identity-based current reading, ownership or selected publication.
  const effectiveRecords=records.filter(record=>!ambiguousIds.has(record.header.id));
  start=diagnostics.length;let coverage:CoverageInspection|null=null;
  if(mode==="reconciliation"){
    if(config){coverage=await inspectCoverage(effectiveRecords,{...config,limits},reader);diagnostics.push(...coverage.diagnostics);}
    stage("coverage",start,coverage?.complete??false);
  }else{
    diagnostics.push(...inspectDescriptionStructure(effectiveRecords,listings.get("intent/description")??[],limits));
    stage("description-structure",start,discoveryComplete);
  }
  start=diagnostics.length;const sources:SourceObservation[]=[];let sourceComplete=true,sourceBytes=0;
  for(const record of effectiveRecords) for(const reference of record.header.sources) {
    const required=reference.required&&record.header.status==="current"&&record.header.kind!=="discipline";
    let resolution:SourceResolution={disposition:"unrequested"};
    if(sources.length>=limits.maxSources){diagnostics.push({code:"intent.limit.sources",severity:"error",stage:"sources",path:record.path,message:"Source count limit exceeded"});sourceComplete=false;break;}
    if(options.resolveSources) {
      try {
        if(options.resolver) resolution=await options.resolver(reference,record,Math.min(limits.maxSourceBytes,Math.max(0,limits.maxTotalSourceBytes-sourceBytes)));
        else if(/^[A-Za-z][A-Za-z0-9+.-]*:/.test(reference.reference)) resolution={disposition:"unsupported",message:"No external source resolver selected"};
        else {normalizedPath(reference.reference);resolution={disposition:"resolved",bytes:await reader.read(reference.reference,Math.min(limits.maxSourceBytes,Math.max(0,limits.maxTotalSourceBytes-sourceBytes))),revision:null,role:reference.role};}
        if(resolution.disposition==="resolved") {
          if(!resolution.bytes) resolution={disposition:"unreadable",message:"Resolver supplied no bytes"};
          else if(resolution.bytes.length>limits.maxSourceBytes||sourceBytes+resolution.bytes.length>limits.maxTotalSourceBytes) {
            diagnostics.push({code:"intent.limit.resolved-source-bytes",severity:"error",stage:"sources",path:record.path,message:"Resolver exceeded the selected source byte budget"});sourceComplete=false;
            resolution={disposition:"unsupported",message:"Source byte budget exceeded"};
          }
          else if(reference.revision!==null&&resolution.revision!==reference.revision) resolution={disposition:"revision-mismatch",message:"Resolver did not establish the authored immutable revision"};
          else if(resolution.role!==undefined&&resolution.role!==reference.role) resolution={disposition:"role-mismatch",message:"Resolver role differs from the declared source role"};
        }
      }catch(error){resolution={disposition:error instanceof IntentError&&error.code==="intent.source.missing"?"missing":"unreadable",message:error instanceof Error?error.message:String(error)};}
    }
    const bytes=resolution.disposition==="resolved"?resolution.bytes:undefined;sourceBytes+=bytes?.length??0;
    sources.push({record:record.header.id,id:reference.id,reference:reference.reference,required,disposition:resolution.disposition,sourceDigest:bytes?digest(bytes):null,bytes:bytes?.length??0,message:resolution.message??null});
    if(resolution.disposition!=="resolved") {if(required)sourceComplete=false;diagnostics.push({code:`intent.source.${resolution.disposition}`,severity:required?"error":"warning",stage:"sources",path:record.path,message:`Source ${reference.id}: ${resolution.message??resolution.disposition}`});}
  }
  stage("sources",start,sourceComplete);
  start=diagnostics.length;let disciplines:DisciplineRegistryInspection|null=null,disciplineComplete=true;
  try {
    let registry:Json;
    try{const bytes=await reader.read("intent/disciplines/registry.json",limits.maxFrontMatterBytes);registry=memoizedWorkspaceValue(source,`json:${observedDigest(source,bytes)}:${JSON.stringify(limits)}`,()=>readJsonBytes(bytes,limits));}
    catch(error){if(error instanceof IntentError&&error.code==="intent.source.missing"&&!effectiveRecords.some(r=>r.header.kind==="discipline"))registry={schema:"intent.discipline-registry.v1",packs:[],adoptions:[],workTypes:[]};else throw error;}
    disciplines=await inspectDisciplineRegistry(registry,{records:effectiveRecords,source:reader,limits});diagnostics.push(...disciplines.diagnostics);disciplineComplete=disciplines.complete;
  }catch(error){diagnostics.push(diagnostic(error,"intent/disciplines/registry.json","disciplines"));disciplineComplete=false;}
  stage("disciplines",start,disciplineComplete);
  // Fingerprint governed implementation bytes, including untracked additions, for
  // this exact scope. Coverage ownership alone is never content identity.
  start=diagnostics.length;let basisComplete=!diagnostics.some(d=>d.code.startsWith("intent.limit.")),implementationBytes=0;
  for(const artifact of coverage?.artifacts??[]) try {
    if(implementationBytes>=limits.maxTotalSourceBytes) throw new IntentError("intent.limit.implementation-bytes","Implementation observation byte budget exhausted");
    const bytes=await reader.read(artifact.path,Math.min(limits.maxSourceBytes,limits.maxTotalSourceBytes-implementationBytes));implementationBytes+=bytes.length;
    if(implementationBytes>limits.maxTotalSourceBytes) throw new IntentError("intent.limit.implementation-bytes","Implementation observation exceeds aggregate byte limit");
  } catch(error){diagnostics.push(diagnostic(error,artifact.path,"source-basis"));basisComplete=false;}
  if(operation)try {await operation.verify();}catch(error){diagnostics.push(diagnostic(error,"intent","source-basis"));basisComplete=false;}
  stage("source-basis",start,basisComplete&&!changed);
  const inventory=[...observed].map(([path,bytes])=>({path,sourceDigest:observedDigest(source,bytes)})).sort((a,b)=>compareText(a.path,b.path));
  const sourceBasis={
    kind:source.immutable?"export" as const:"working-tree" as const,
    id:digestJson({profile:"workspace-v1",processor:"intent.processing.v2",mode,limits:limits as unknown as Json,inventory,sources:sources as unknown as Json,
      listings:[...listings].sort(([a],[b])=>compareText(a,b)).map(([prefix,entries])=>({prefix,entries:entries.map(({path,kind})=>({path,kind}))}))}),
    reader:source.identity,
  };
  const complete=stages.every(s=>s.complete);
  return {profile:"workspace-v1",processor:"intent.processing.v2",mode,sourceBasis,config,context,limits,records:effectiveRecords,inspections:inspections.map(inspection=>inspection.record&&effectiveRecords.includes(inspection.record)?{...inspection,record:null,raw:null}:inspection),graph,coverage,disciplines,sources,inventory,stages,diagnostics:orderedDiagnostics(diagnostics),complete,valid:complete&&!diagnostics.some(d=>d.severity==="error")};
}

/** Explicitly reconcile authored Description coverage with governed implementation files. */
export function reconcileWorkspace(source:SourceReader,options:WorkspaceOptions={}):Promise<WorkspaceInspection> {
  return readWorkspace(source,{...options,reconcileImplementation:true});
}
