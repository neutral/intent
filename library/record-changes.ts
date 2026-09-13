import { createWorkspaceOperation } from "./observation.js";
import { summarizeWorkspace, type WorkspaceSummary } from "./projections.js";
import { proposeFiles, type FileChange, type FileProposal } from "./authoring.js";
import { canonicalJson, compareText, diagnostic, digest, digestJson, IntentError, normalizedPath } from "./foundation.js";
import { emptyContext, mergeRecordContext, projectRecordContext } from "./globals.js";
import { inspectRecord, readLocalHeader } from "./records.js";
import { compareWorkspaces } from "./query.js";
import { readWorkspace, type WorkspaceInspection, type WorkspaceOptions } from "./workspace.js";
import type { Diagnostic, Json, RecordContext, SourceEntry, SourceReader, Status } from "./types.js";

export type RecordOperation =
  | {kind:"edit";sourceText:string;context?:RecordContext}
  | {kind:"set-status";status:Status}
  | {kind:"move";targetPath:string}
  | {kind:"remove"};
export interface RecordChangeRequest {path:string;operation:RecordOperation;workspaceOptions?:WorkspaceOptions}
export interface RecordChangeProposal {
  schema:"intent.record-change-proposal.v1";
  operation:RecordOperation["kind"];
  fileProposal:FileProposal|null;
  original:WorkspaceSummary;
  proposed:WorkspaceSummary|null;
  impact:ReturnType<typeof compareWorkspaces>|null;
  diagnostics:Diagnostic[];
  complete:boolean;
  limitations:string[];
}
function reject(message:string,code="intent.record-change.request"):never {throw new IntentError(code,message);}
function validateOperation(operation:unknown):RecordOperation {
  if(!operation||typeof operation!=="object"||![null,Object.prototype].includes(Object.getPrototypeOf(operation)))reject("A record operation must be an ordinary object");
  if(Object.values(Object.getOwnPropertyDescriptors(operation)).some(field=>!Object.hasOwn(field,"value")||!field.enumerable))reject("A record operation must contain enumerable data fields");
  const value=operation as Record<string,unknown>;
  const allowed:Record<RecordOperation["kind"],readonly string[]>={edit:["kind","sourceText","context"],"set-status":["kind","status"],move:["kind","targetPath"],remove:["kind"]};
  if(typeof value.kind!=="string"||!Object.hasOwn(allowed,value.kind))reject("Choose edit, set-status, move or remove");
  if(Reflect.ownKeys(value).some(key=>typeof key!=="string"||!allowed[value.kind as RecordOperation["kind"]].includes(key)))reject("Unexpected record operation field");
  if(value.kind==="edit"&&typeof value.sourceText!=="string")reject("An edit requires complete sourceText");
  if(value.kind==="move"&&typeof value.targetPath!=="string")reject("A move requires targetPath");
  if(value.kind==="set-status"&&(typeof value.status!=="string"||!["draft","current","superseded","retired"].includes(value.status)))reject("Choose a supported lifecycle status");
  return structuredClone(value) as RecordOperation;
}
/** Change only present top-level JSON value tokens; retain all other source bytes. */
function metadata(sourceText:string,changes:Record<string,Json>):string {
  const opening=/^---\r?\n/.exec(sourceText)!;
  const remainder=sourceText.slice(opening[0].length),closing=/^---\r?\n/m.exec(remainder)!;
  const front=remainder.slice(0,closing.index),spans=new Map<string,{start:number;end:number}>();
  let cursor=0;
  const whitespace=()=>{while(/[ \t\r\n]/.test(front[cursor]??"x"))cursor++;};
  const string=()=>{const start=cursor++;while(cursor<front.length){const char=front[cursor++];if(char==="\\")cursor++;else if(char==='"')return {start,end:cursor};}reject("Unterminated validated JSON string");};
  const value=()=>{
    if(front[cursor]==='"'){string();return;}
    if(front[cursor]==="{"||front[cursor]==="[") {
      const stack=[front[cursor++]];
      while(stack.length&&cursor<front.length) {
        const char=front[cursor];if(char==='"'){string();continue;}
        cursor++;if(char==="{"||char==="[")stack.push(char);else if(char==="}"||char==="]")stack.pop();
      }
    } else while(cursor<front.length&&!/[ \t\r\n,}]/.test(front[cursor]!))cursor++;
  };
  whitespace();if(front[cursor++]!=="{")reject("Expected validated JSON object");
  for(;;) {
    whitespace();if(front[cursor]==="}")break;
    const key=string();whitespace();if(front[cursor++]!==":")reject("Expected validated JSON colon");whitespace();
    const start=cursor;value();spans.set(JSON.parse(front.slice(key.start,key.end)) as string,{start,end:cursor});
    whitespace();if(front[cursor]==="}")break;if(front[cursor++]!==",")reject("Expected validated JSON comma");
  }
  let edited=front;
  const replacements=Object.entries(changes).flatMap(([key,value])=>{
    const span=spans.get(key);if(!span)reject(`Required metadata field is absent: ${key}`);
    return canonicalJson(JSON.parse(front.slice(span.start,span.end)) as Json)===canonicalJson(value)?[]:[{...span,value:JSON.stringify(value)}];
  });
  for(const replacement of replacements.sort((a,b)=>b.start-a.start)) edited=edited.slice(0,replacement.start)+replacement.value+edited.slice(replacement.end);
  return opening[0]+edited+remainder.slice(closing.index);
}


function snapshotRequest(input:RecordChangeRequest):RecordChangeRequest {
  const plain=(value:unknown,fields:readonly string[],label:string):Record<string,unknown>=>{
    if(!value||typeof value!=="object"||![null,Object.prototype].includes(Object.getPrototypeOf(value)))reject(`${label} must be an ordinary object`);
    const descriptors=Object.getOwnPropertyDescriptors(value);
    if(Reflect.ownKeys(descriptors).some(key=>typeof key!=="string"||!fields.includes(key))||Object.values(descriptors).some(field=>!Object.hasOwn(field,"value")||!field.enumerable))reject(`${label} contains unsupported fields or accessors`);
    return value as Record<string,unknown>;
  };
  const value=plain(input,["path","operation","workspaceOptions"],"Record change request");
  if(typeof value.path!=="string")reject("Record change path must be a string");
  const operation=validateOperation(value.operation);
  let workspaceOptions:WorkspaceOptions|undefined;
  if(value.workspaceOptions!==undefined){
    const options=plain(value.workspaceOptions,["limits","resolveSources","resolver","reconcileImplementation"],"Workspace options");
    if(options.reconcileImplementation!==undefined&&typeof options.reconcileImplementation!=="boolean")reject("reconcileImplementation must be boolean");
    if(options.resolveSources!==undefined&&typeof options.resolveSources!=="boolean")reject("resolveSources must be boolean");
    if(options.resolver!==undefined&&typeof options.resolver!=="function")reject("resolver must be callable");
    workspaceOptions={...options,...(options.limits===undefined?{}:{limits:structuredClone(options.limits)})} as WorkspaceOptions;
  }
  return {path:value.path,operation,...(workspaceOptions?{workspaceOptions}:{})};
}
/** Prepare a current-record change from exact observed bytes; never writes it. */
export async function proposeRecordChange(source:SourceReader,request:RecordChangeRequest):Promise<RecordChangeProposal> {
  request=snapshotRequest(request);
  const operation=request.operation;
  const observation=createWorkspaceOperation(source);source=observation.source;
  const original=await readWorkspace(source,request.workspaceOptions);
  const result:Omit<RecordChangeProposal,"original"|"proposed"> & {original:WorkspaceInspection;proposed:WorkspaceInspection|null}={schema:"intent.record-change-proposal.v1",operation:operation.kind,fileProposal:null,original,proposed:null,impact:null,diagnostics:[],complete:false,
    limitations:["Preparation concerns the selected current files. Workspace validity and unresolved related obligations remain visible in the proposed reading.","Impact identifies review candidates. Applying the exact reviewed proposal is a separate effect."]};
  try {
    normalizedPath(request.path,false,original.limits.maxPathBytes);
    if(original.stages.find(stage=>stage.name==="source-basis")?.valid!==true)reject("Observe a coherent source basis before changing a record","intent.record-change.source-incomplete");
    if(!original.context)reject("Repair the catalog and connections before preparing a record change","intent.record-change.context");
    const inventory=new Map(original.inventory.map(entry=>[entry.path,entry.sourceDigest]));
    const text=async(path:string):Promise<string>=>{
      const bytes=await source.read(path,original.limits.maxSourceBytes);
      if(digest(bytes)!==inventory.get(path))reject(`Source changed or was not examined: ${path}`,"intent.record-change.source-changed");
      return new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes);
    };
    const before=await text(request.path),identity=readLocalHeader(before,{limits:original.limits});
    const declarations=original.inspections.filter(item=>item.identity?.id===identity.id);
    if(declarations.length!==1)reject("Repair duplicate record identities before preparing a targeted change","intent.record-change.identity");
    let proposedContext=original.context;
    let after:string|null=before,targetPath=request.path;
    if(operation.kind==="edit") {
      after=operation.sourceText;
      if(operation.context)proposedContext=mergeRecordContext(original.context,operation.context,identity.id);
    } else if(operation.kind==="set-status")after=metadata(before,{status:operation.status});
    else if(operation.kind==="move") {
      targetPath=operation.targetPath;normalizedPath(targetPath,false,original.limits.maxPathBytes);
      if(targetPath===request.path)reject("A move requires a different target path");
      try {await source.read(targetPath,1);reject("The move destination already exists","intent.record-change.destination");}
      catch(error){if(!(error instanceof IntentError)||error.code!=="intent.source.missing")throw error;}
    } else {
      after=null;proposedContext=mergeRecordContext(original.context,emptyContext(),identity.id);
    }
    if(after!==null) {
      const candidate=readLocalHeader(after,{limits:original.limits});
      if(candidate.id!==identity.id||candidate.kind!==identity.kind)reject("An edit preserves the record identity and kind","intent.record-change.identity");
      if(operation.kind==="edit"&&candidate.status!==identity.status)reject("Use set-status to change lifecycle treatment explicitly","intent.record-change.status");
      const inspected=inspectRecord(after,{path:targetPath,limits:original.limits,context:projectRecordContext(proposedContext,identity.id)});
      if(!inspected.valid||!inspected.record)reject(inspected.diagnostics.map(issue=>`${issue.code}: ${issue.message}`).join("; "),"intent.record-change.invalid-record");
    }
    const changes:FileChange[]=[];
    if(targetPath!==request.path){changes.push({path:request.path,before,after:null});changes.push({path:targetPath,before:null,after});}
    else if(after!==before)changes.push({path:request.path,before,after});
    for(const [path,value] of [["intent/catalog.json",proposedContext.catalog],["intent/connections.json",proposedContext.connections]] as const){
      const previous=await text(path);
      if(digestJson(JSON.parse(previous) as Json)!==digestJson(value as unknown as Json))changes.push({path,before:previous,after:JSON.stringify(value,null,2)+"\n"});
    }
    if(!changes.length)reject("The selected operation makes no change","intent.record-change.unchanged");
    result.fileProposal=proposeFiles(original.sourceBasis.id,changes);
    result.proposed=await readWorkspace(observation.overlay(changes),request.workspaceOptions);
    result.impact=compareWorkspaces(original,result.proposed);
    result.fileProposal=proposeFiles(original.sourceBasis.id,changes,{proposedBasis:result.proposed.sourceBasis.id});
    await observation.verify();
    result.complete=true;
  }catch(error){result.diagnostics.push(diagnostic(error,request.path,"authoring"));result.fileProposal=null;}
  return {...result,original:summarizeWorkspace(result.original),proposed:result.proposed?summarizeWorkspace(result.proposed):null};
}
