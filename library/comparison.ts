import { compareText, digest, digestJson, IntentError, normalizedPath } from "./foundation.js";
import { compareWorkspaces } from "./query.js";
import { readWorkspace, type WorkspaceInspection, type WorkspaceOptions } from "./workspace.js";
import { proposeFiles, type FileProposal } from "./authoring.js";
import { validateSchema } from "./schemas.js";
import { createWorkspaceOperation, isWorkspaceOperation, observedDigest, reuseWorkspaceOperation } from "./observation.js";
import type { Json } from "./types.js";
import type { SourceEntry, SourceReader } from "./types.js";

/** Exact bytes actually read during one workspace observation. No durable history is implied. */
export interface RetainedWorkspaceObservation {workspace:WorkspaceInspection;source:SourceReader;sizeBytes:number}
export async function retainWorkspaceObservation(source:SourceReader,options:WorkspaceOptions={},maximumBytes=67108864):Promise<RetainedWorkspaceObservation> {
  if(!Number.isSafeInteger(maximumBytes)||maximumBytes<1||maximumBytes>268435456)throw new IntentError("intent.comparison.limit","Retained observation budget must be 1 to 268435456 bytes");
  const operation=isWorkspaceOperation(source)?null:createWorkspaceOperation(source);
  if(operation)source=operation.source;
  const snapshots=new Map<string,Uint8Array>();let sizeBytes=0,exhausted=false;
  const observed:SourceReader={identity:source.identity,immutable:source.immutable,list:prefix=>source.list(prefix),async read(path,maximum){
    const bytes=await source.read(path,maximum),previous=snapshots.get(path);
    if(previous&&observedDigest(source,previous)!==observedDigest(source,bytes))throw new IntentError("intent.source.changed",`Source changed while retaining ${path}`);
    if(!previous){if(sizeBytes+bytes.length>maximumBytes){exhausted=true;throw new IntentError("intent.comparison.retention-limit","Examined bytes exceed the explicit retained observation budget");}snapshots.set(path,Uint8Array.from(bytes));sizeBytes+=bytes.length;}
    return bytes;
  }};
  reuseWorkspaceOperation(observed,source);
  const workspace=await readWorkspace(observed,options);
  if(operation)await operation.verify();
  if(exhausted)throw new IntentError("intent.comparison.retention-limit","The original observation was not retained: examined bytes exceed its budget");
  const retained:SourceReader={identity:`retained:${workspace.sourceBasis.id}`,immutable:true,
    async list(prefix){normalizedPath(prefix,true);const entries=new Map<string,SourceEntry>();for(const [path,bytes]of snapshots){if(prefix!=="."&&path!==prefix&&!path.startsWith(`${prefix}/`))continue;entries.set(path,{path,kind:"file",size:bytes.length});const parts=path.split("/");for(let i=1;i<parts.length;i++){const directory=parts.slice(0,i).join("/");if(prefix==="."||directory===prefix||directory.startsWith(`${prefix}/`))entries.set(directory,{path:directory,kind:"directory",size:0});}}return [...entries.values()].sort((a,b)=>compareText(a.path,b.path));},
    async read(path,maximum){normalizedPath(path);const bytes=snapshots.get(path);if(!bytes)throw new IntentError("intent.comparison.unobserved","Only exact previously examined bytes are retained");if(bytes.length>maximum)throw new IntentError("intent.limit.source-bytes",`${path} exceeds the selected comparison byte bound`);return Uint8Array.from(bytes);}
  };
  return {workspace:structuredClone(workspace),source:retained,sizeBytes};
}
export interface ComparisonSourcePreview {sourceDigest:string|null;sizeBytes:number|null;text:string|null;status:"observed"|"outside-observation"|"binary"|"unavailable";truncated:boolean;message:string|null}
export interface WorkspaceReview {
  schema:"intent.workspace-review.v1";comparison:ReturnType<typeof compareWorkspaces>;
  code:{path:string;beforeOwners:string[];afterOwners:string[];before:ComparisonSourcePreview;after:ComparisonSourcePreview}[];
  codeTotal:number;limits:{maxFiles:number;maxFileBytes:number;maxTotalBytes:number;maxPreviewBytes:number};
  complete:boolean;limitations:string[];
}
/** Compare exact observed code alongside authored meanings, coverage and findings. Reads never execute Checks. */
export async function compareWorkspaceSources(before:RetainedWorkspaceObservation,after:RetainedWorkspaceObservation,options:Partial<WorkspaceReview["limits"]>={}):Promise<WorkspaceReview> {
  const limits={maxFiles:128,maxFileBytes:4194304,maxTotalBytes:16777216,maxPreviewBytes:32768,...options};
  for(const [key,maximum]of Object.entries({maxFiles:4096,maxFileBytes:16777216,maxTotalBytes:268435456,maxPreviewBytes:1048576}))if(!Number.isSafeInteger(limits[key as keyof typeof limits])||limits[key as keyof typeof limits]<1||limits[key as keyof typeof limits]>maximum)throw new IntentError("intent.comparison.limit",`Invalid ${key} comparison limit`);
  const comparison=compareWorkspaces(before.workspace,after.workspace),affected=new Set(comparison.affectedIds),changed=new Set(comparison.changes.map(change=>change.path));
  const owners=(observation:RetainedWorkspaceObservation,path:string)=>observation.workspace.coverage?.artifacts.find(file=>file.path===path)?.owners??[];
  const paths=new Set<string>();for(const observation of [before,after])for(const artifact of observation.workspace.coverage?.artifacts??[])if(changed.has(artifact.path)||artifact.owners.some(id=>affected.has(id)))paths.add(artifact.path);
  let remaining=limits.maxTotalBytes,complete=comparison.complete&&paths.size<=limits.maxFiles;
  const preview=async(observation:RetainedWorkspaceObservation,path:string):Promise<ComparisonSourcePreview>=>{
    const expected=observation.workspace.inventory.find(file=>file.path===path)?.sourceDigest;
    if(!expected)return {sourceDigest:null,sizeBytes:null,text:null,status:"outside-observation",truncated:false,message:"No exact bytes for this path were examined in this side's scope."};
    try {
      if(remaining<1)throw new IntentError("intent.comparison.bytes","Aggregate comparison byte budget exhausted");
      const bytes=await observation.source.read(path,Math.min(limits.maxFileBytes,remaining));remaining-=bytes.length;
      if(digest(bytes)!==expected)throw new IntentError("intent.comparison.source-changed","Comparison reader bytes differ from the selected observed identity");
      let text:string;try{text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes);}catch{return {sourceDigest:expected,sizeBytes:bytes.length,text:null,status:"binary",truncated:false,message:"Exact bytes were verified; this binary input has no text preview."};}
      const truncated=bytes.length>limits.maxPreviewBytes;
      if(truncated){let end=limits.maxPreviewBytes;while(end>0&&(bytes[end]!&0xc0)===0x80)end--;text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes.subarray(0,end));}
      if(truncated)complete=false;
      return {sourceDigest:expected,sizeBytes:bytes.length,text,status:"observed",truncated,message:truncated?`Preview is limited to ${limits.maxPreviewBytes} UTF-8 bytes; the displayed source is incomplete.`:null};
    }catch(error){complete=false;return {sourceDigest:expected,sizeBytes:null,text:null,status:"unavailable",truncated:false,message:error instanceof Error?error.message:String(error)};}
  };
  const code:WorkspaceReview["code"]=[];
  for(const path of [...paths].sort(compareText).slice(0,limits.maxFiles))code.push({path,beforeOwners:owners(before,path),afterOwners:owners(after,path),before:await preview(before,path),after:await preview(after,path)});
  const result:WorkspaceReview={schema:"intent.workspace-review.v1",comparison,code,codeTotal:paths.size,limits,complete,limitations:["This review compares retained observations, not the live filesystem and not established software correctness.","Code includes changed governed files and implementation owned by affected records. Exemptions, excluded paths and scope changes remain in the two coverage/configuration contexts.","Comparison describes observed differences and makes no implementation verdict.",...(paths.size>limits.maxFiles?[`Only ${limits.maxFiles} of ${paths.size} selected implementation paths are shown.`]:[]),"The complete serialized review is bounded at 32 MiB; a larger review is unavailable until its adopted scope or limits are narrowed."]};
  if(Buffer.byteLength(JSON.stringify(result))>33554432)throw new IntentError("intent.comparison.result-limit","Comparison exceeds the 32 MiB output profile; narrow the adopted scope or comparison limits");
  return result;
}
/** Materialize a reviewed text proposal over the explicitly selected source without writing it. */
export async function reviewFileProposal(source:SourceReader,proposal:FileProposal,options:WorkspaceOptions={}):Promise<WorkspaceReview> {
  if(validateSchema("urn:intent:schema:authoring-results:v1#/$defs/fileProposal",proposal).length)throw new IntentError("intent.comparison.proposal","Expected an exact public FileProposal");
  proposal=structuredClone(proposal);const {digest:expected,...body}=proposal;
  if(digestJson(body as unknown as Json)!==expected)throw new IntentError("intent.comparison.proposal","The proposal changed after preparation");
  proposeFiles(proposal.sourceBasis,proposal.changes,proposal.proposedBasis===null?{}:{proposedBasis:proposal.proposedBasis});
  const operation=createWorkspaceOperation(source);source=operation.source;
  const before=await retainWorkspaceObservation(source,options);
  if(before.workspace.sourceBasis.id!==proposal.sourceBasis)throw new IntentError("intent.comparison.stale","Refresh before comparing a proposal from another source observation");
  for(const change of proposal.changes){let text:string|null=null;try{text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(await source.read(change.path,4194304));}catch(error){if(!(error instanceof IntentError&&error.code==="intent.source.missing"))throw error;}if(text!==change.before)throw new IntentError("intent.comparison.stale",`Original proposal bytes changed: ${change.path}`);}
  const after=await retainWorkspaceObservation(operation.overlay(proposal.changes),options);
  if(proposal.proposedBasis!==null&&after.workspace.sourceBasis.id!==proposal.proposedBasis)throw new IntentError("intent.comparison.stale","Inputs examined by the proposed workspace changed; prepare the proposal again before comparing it");
  try{await operation.verify();}catch{throw new IntentError("intent.comparison.stale","The repository changed while preparing the comparison");}
  return compareWorkspaceSources(before,after);
}
