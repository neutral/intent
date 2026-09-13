import { lstat, open, readFile, realpath, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { inspectOperation, proposeFiles, type FileChange } from "./authoring.js";
import { digest, IntentError } from "./foundation.js";
import { parseStrictJson } from "./strict-json.js";
import { FileSystemSource } from "./sources.js";
import { readWorkspace, type WorkspaceOptions } from "./workspace.js";
import type { Digest } from "./types.js";
import { createWorkspaceOperation } from "./observation.js";

/** Resume only still-original files; a new review and operation journal are required. */
export async function proposeOperationResume(repositoryRoot:string,id:string,options:{workspaceOptions?:WorkspaceOptions}={}) {
  if(!options||typeof options!=="object"||Array.isArray(options)||Object.keys(options).some(key=>key!=="workspaceOptions"))throw new IntentError("intent.recovery.options","Use only current workspaceOptions for resumption");
  const workspaceOptions=options.workspaceOptions?{...options.workspaceOptions,...(options.workspaceOptions.limits?{limits:{...options.workspaceOptions.limits}}:{})}:undefined;
  const operation=createWorkspaceOperation(await FileSystemSource.open(repositoryRoot));
  const original=await readWorkspace(operation.source,workspaceOptions);
  if(original.stages.find(stage=>stage.name==="source-basis")?.complete!==true)throw new IntentError("intent.recovery.source","Cannot prepare recovery from an incomplete source observation");
  const inspected=await inspectOperation(repositoryRoot,id),changes:FileChange[]=[];
  for(const file of inspected.files) {
    if(file.state==="changed-externally")throw new IntentError("intent.recovery.changed",`Reconcile externally changed content before resuming: ${file.path}`);
    if(file.state==="original")changes.push(inspected.proposal.changes.find(change=>change.path===file.path)!);
  }
  const proposedBasis=inspected.proposal.proposedBasis;
  if(proposedBasis!==null){
    const proposed=await readWorkspace(operation.overlay(changes),workspaceOptions);
    if(proposed.stages.find(stage=>stage.name==="source-basis")?.complete!==true||proposed.sourceBasis.id!==proposedBasis)throw new IntentError("intent.recovery.changed","Inputs examined by the proposed workspace changed; inspect and prepare a new change using the same source options");
  }
  try{await operation.verify();}catch{throw new IntentError("intent.recovery.changed","Examined workspace changed during recovery preparation");}
  return {operationId:id,fileProposal:changes.length?proposeFiles(original.sourceBasis.id,changes,proposedBasis===null?{}:{proposedBasis}):null,files:inspected.files,remainingPaths:changes.map(change=>change.path),complete:true,
    limitations:["Resumption is a new reviewed proposal using the current workspace; the interrupted journal remains until explicitly discarded.","Already-applied files are preserved. Externally changed files require explicit reconciliation. Recovery does not decide whether the original proposed meaning is still appropriate."]};
}

export interface AuthoringLockInspection {id:string;pid:number;journal:string;sourceDigest:Digest;processState:"running"|"not-running"|"unknown"}
async function lockBytes(repositoryRoot:string):Promise<{path:string;bytes:Buffer}|null> {
  const root=await realpath(resolve(repositoryRoot));
  let path=root;
  for(const [index,part] of ["tmp","intent",".authoring.lock"].entries()) {
    path=join(path,part);
    const stat=await lstat(path).catch(error=>{if(error.code==="ENOENT")return null;throw error;});
    if(!stat)return null;
    if(stat.isSymbolicLink()||(index<2?!stat.isDirectory():!stat.isFile()||stat.nlink!==1||stat.size>4096))throw new IntentError("intent.recovery.lock","Lock must be one bounded ordinary file under the selected repository");
  }
  const bytes=await readFile(path);if(bytes.length>4096)throw new IntentError("intent.recovery.lock","Lock exceeds 4096 bytes");
  return {path,bytes};
}
export async function inspectAuthoringLock(repositoryRoot:string):Promise<AuthoringLockInspection|null> {
  const value=await lockBytes(repositoryRoot);if(!value)return null;
  const body=parseStrictJson(new TextDecoder("utf-8",{fatal:true}).decode(value.bytes),{maxBytes:4096,maxNodes:16}) as unknown as {id:string;pid:number;journal:string};
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).sort().join(",")!=="id,journal,pid"||typeof body.id!=="string"||!/^[A-Za-z0-9-]{1,100}$/.test(body.id)||!Number.isSafeInteger(body.pid)||body.pid<1||body.pid>2147483647||body.journal!==`tmp/intent/operations/${body.id}.json`)throw new IntentError("intent.recovery.lock","Lock identity is malformed; inspect the source file explicitly");
  let processState:AuthoringLockInspection["processState"]="running";
  try{process.kill(body.pid,0);}catch(error){processState=(error as NodeJS.ErrnoException).code==="ESRCH"?"not-running":"unknown";}
  return {...body,sourceDigest:digest(value.bytes),processState};
}

/** Explicit release refuses a live/unknown process and a replaced lock. */
export async function releaseAbandonedAuthoringLock(repositoryRoot:string,expected:AuthoringLockInspection):Promise<{id:string;released:true}> {
  const actual=await inspectAuthoringLock(repositoryRoot);
  if(!actual||actual.id!==expected.id||actual.pid!==expected.pid||actual.journal!==expected.journal||actual.sourceDigest!==expected.sourceDigest)throw new IntentError("intent.recovery.lock-changed","Lock changed since inspection; inspect it again");
  if(actual.processState!=="not-running")throw new IntentError("intent.recovery.lock-live","The lock process is running or unavailable for inspection; do not release it");
  const value=await lockBytes(repositoryRoot);
  if(!value||digest(value.bytes)!==actual.sourceDigest)throw new IntentError("intent.recovery.lock-changed","Lock changed before release");
  await unlink(value.path);return {id:actual.id,released:true};
}

/** Discard only the exact inspected inactive recovery journal under the authoring lock. */
export async function discardOperation(repositoryRoot:string,expected:{id:string;journalDigest:Digest}):Promise<{id:string;discarded:true}> {
  if(!expected||typeof expected!=="object"||Array.isArray(expected)||Object.keys(expected).sort().join(",")!=="id,journalDigest"||typeof expected.id!=="string"||typeof expected.journalDigest!=="string")throw new IntentError("intent.recovery.options","Discard requires exactly id and journalDigest from the current inspection");
  const root=await realpath(resolve(repositoryRoot));
  const inspected=await inspectOperation(root,expected.id);
  if(inspected.journalDigest!==expected.journalDigest)throw new IntentError("intent.recovery.journal-changed","Operation journal changed since inspection");
  const parent=join(root,"tmp","intent"),info=await lstat(parent);
  if(!info.isDirectory()||info.isSymbolicLink())throw new IntentError("intent.recovery.lock","Recovery directory must be an ordinary directory");
  const lockPath=join(parent,".authoring.lock");
  let lock;
  try{lock=await open(lockPath,"wx",0o600);}catch(error){if((error as NodeJS.ErrnoException).code==="EEXIST")throw new IntentError("intent.recovery.lock-live","Inspect and resolve the existing authoring lock before discarding an operation");throw error;}
  let discarded=false;
  try{
    await lock.writeFile(JSON.stringify({id:expected.id,pid:process.pid,journal:`tmp/intent/operations/${expected.id}.json`})+"\n");await lock.sync();
    const current=await inspectOperation(root,expected.id);
    if(current.journalDigest!==expected.journalDigest)throw new IntentError("intent.recovery.journal-changed","Operation journal changed before discard");
    await unlink(join(parent,"operations",`${expected.id}.json`));
    discarded=true;return {id:expected.id,discarded:true};
  }finally{try{await lock.close();await unlink(lockPath);}catch(error){throw new IntentError("intent.recovery.discard-cleanup",`${discarded?"Operation journal was discarded":"Operation journal was preserved"}, but authoring lock cleanup failed: ${error instanceof Error?error.message:String(error)}`);}}
}
