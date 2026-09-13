import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { digest, digestJson, IntentError, normalizedPath } from "./foundation.js";
import type { Digest, Json } from "./types.js";
import { readWorkspace, type WorkspaceOptions } from "./workspace.js";
import { FileSystemSource } from "./sources.js";
import { parseStrictJson } from "./strict-json.js";
import { validateSchema } from "./schemas.js";
import { createWorkspaceOperation } from "./observation.js";

export interface FileChange {path:string;before:string|null;after:string|null}
export interface FileProposal {schema:"intent.file-proposal.v1";id:string;sourceBasis:string;proposedBasis:string|null;changes:FileChange[];digest:Digest}
export type ApplyResult =
  | {id:string;status:"refused";journal:null;written:[];error:string}
  | {id:string;status:"completed";journal:null;written:string[];error:null}
  | {id:string;status:"interrupted";journal:string;written:string[];error:string};
export function proposeFiles(sourceBasis:string,changes:FileChange[],options:{proposedBasis?:string}={}):FileProposal {
  if(!/^sha256:[a-f0-9]{64}$/.test(sourceBasis))throw new IntentError("intent.authoring.source-basis","Use the generated source basis from a workspace inspection");
  if(!options||typeof options!=="object"||Array.isArray(options)||Object.keys(options).some(key=>key!=="proposedBasis")||(options.proposedBasis!==undefined&&(typeof options.proposedBasis!=="string"||!/^sha256:[a-f0-9]{64}$/.test(options.proposedBasis))))throw new IntentError("intent.authoring.proposed-basis","Use only the generated proposedBasis from the examined file overlay");
  if(!changes.length||changes.length>4096)throw new IntentError("intent.authoring.limit","A proposal requires 1 to 4096 file changes");
  const paths=new Set<string>();let total=0;
  for(const change of changes) {
    normalizedPath(change.path);
    if(!change.path.startsWith("intent/"))throw new IntentError("intent.authoring.scope","Authored effects are confined to intent/");
    if(paths.has(change.path))throw new IntentError("intent.authoring.duplicate",`Duplicate proposed path ${change.path}`);paths.add(change.path);
    if(change.before===null&&change.after===null)throw new IntentError("intent.authoring.empty","Cannot delete an absent file");
    for(const content of [change.before,change.after])if(content!==null){total+=Buffer.byteLength(content);if(Buffer.byteLength(content)>4194304)throw new IntentError("intent.authoring.limit","One proposed file exceeds 4 MiB");}
  }
  if(total>268435456)throw new IntentError("intent.authoring.limit","Proposal exceeds aggregate byte limit");
  const value={schema:"intent.file-proposal.v1" as const,id:randomUUID(),sourceBasis,proposedBasis:options.proposedBasis??null,changes:structuredClone(changes)};
  if(Buffer.byteLength(JSON.stringify(value))>3000000)throw new IntentError("intent.authoring.limit","Serialized proposal exceeds the 3 MB recoverable journal profile");
  const proposal={...value,digest:digestJson(value as unknown as Json)};
  if(validateSchema("urn:intent:schema:authoring-results:v1#/$defs/fileProposal",proposal).length)throw new IntentError("intent.authoring.proposal","Proposal violates its public carrier");
  return proposal;
}
/** Verify every component. Cooperating Intent writers also hold one durable lock.
 * External writers are checked before each replacement; this is not filesystem CAS.
 */
async function safePath(root:string,path:string,createParents=false):Promise<string> {
  normalizedPath(path);let current=root;
  const parts=path.split("/");
  for(let i=0;i<parts.length;i++) {
    current=join(current,parts[i]!);
    let info=await lstat(current).catch(error=>{if(error.code==="ENOENT")return null;throw error;});
    if(!info&&i<parts.length-1&&createParents){await mkdir(current).catch(error=>{if(error.code!=="EEXIST")throw error;});info=await lstat(current);}
    if(info?.isSymbolicLink())throw new IntentError("intent.authoring.symlink",`Write traverses a symlink: ${path}`);
    if(i<parts.length-1&&info&&!info.isDirectory())throw new IntentError("intent.authoring.path",`Write parent is not a directory: ${path}`);
    if(i===parts.length-1&&info&&(!info.isFile()||info.nlink>1))throw new IntentError("intent.authoring.path",`Write target must be one ordinary file: ${path}`);
  }
  return current;
}
async function readExisting(root:string,path:string):Promise<string|null> {
  const absolute=await safePath(root,path);
  try{if((await lstat(absolute)).size>4194304)throw new IntentError("intent.authoring.limit",`Existing file exceeds edit limit: ${path}`);const bytes=await readFile(absolute);if(bytes.length>4194304)throw new IntentError("intent.authoring.limit",`Existing file exceeds edit limit: ${path}`);return new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes);}
  catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}
}
async function syncDirectory(path:string):Promise<void> {
  const directory=await open(path,"r");try{await directory.sync();}finally{await directory.close();}
}
async function removeFile(root:string,path:string):Promise<void> {
  const absolute=await safePath(root,path);await unlink(absolute);await syncDirectory(dirname(absolute));
}
async function atomicWrite(root:string,path:string,content:string):Promise<void> {
  const absolute=await safePath(root,path,true),temporary=join(dirname(absolute),`.intent-${randomUUID()}.tmp`);
  const handle=await open(temporary,"wx",0o600);
  try{
    try{await handle.writeFile(content);await handle.sync();}finally{await handle.close();}
    await safePath(root,path);await rename(temporary,absolute);await syncDirectory(dirname(absolute));
  }catch(error){
    try{await unlink(temporary);}catch(cleanupError){if((cleanupError as NodeJS.ErrnoException).code!=="ENOENT")throw new IntentError("intent.authoring.temporary-cleanup",`${error instanceof Error?error.message:String(error)}; temporary file cleanup failed at ${temporary}: ${cleanupError instanceof Error?cleanupError.message:String(cleanupError)}`);}
    throw error;
  }
}
export async function applyFileProposal(repositoryRoot:string,proposal:FileProposal,options:{signal?:AbortSignal;workspaceOptions?:WorkspaceOptions}={}):Promise<ApplyResult> {
  if(validateSchema("urn:intent:schema:authoring-results:v1#/$defs/fileProposal",proposal).length)throw new IntentError("intent.authoring.proposal","Proposal violates its public carrier");
  proposal=structuredClone(proposal);
  const workspaceOptions=options.workspaceOptions?{...options.workspaceOptions,...(options.workspaceOptions.limits?{limits:{...options.workspaceOptions.limits}}:{})}:undefined;
  const {digest:expectedDigest,...body}=proposal;
  if(digestJson(body as unknown as Json)!==expectedDigest)throw new IntentError("intent.authoring.proposal-changed","Proposal bytes changed after preparation");
  // Revalidate mutable public input; use the caller's reviewed ID only after validation.
  proposeFiles(proposal.sourceBasis,proposal.changes,proposal.proposedBasis===null?{}:{proposedBasis:proposal.proposedBasis});
  if(!/^[a-zA-Z0-9-]{1,100}$/.test(proposal.id))throw new IntentError("intent.authoring.id","Invalid operation ID");
  const root=await realpath(resolve(repositoryRoot));
  if(!(await lstat(root)).isDirectory())throw new IntentError("intent.authoring.root","Expected a repository directory");
  const lockPath="tmp/intent/.authoring.lock",lockFile=await safePath(root,lockPath,true);
  let lock;
  try{lock=await open(lockFile,"wx",0o600);}catch(error){if((error as NodeJS.ErrnoException).code==="EEXIST")throw new IntentError("intent.authoring.locked","Another authoring operation or interrupted lock exists; inspect it before explicit recovery");throw error;}
  const journal=`tmp/intent/operations/${proposal.id}.json`;
  const result:{id:string;status:"completed"|"interrupted";journal:string;written:string[];error:string|null}={id:proposal.id,status:"interrupted",journal,written:[],error:null};
  let journalCreated=false,journalAttempted=false,refused=false;
  const saveJournal=()=>atomicWrite(root,journal,JSON.stringify({schema:"intent.operation.v1",proposal,...result},null,2)+"\n");
  const failure=(error:unknown)=>{const message=error instanceof Error?error.message:String(error);result.status="interrupted";result.error=result.error?`${result.error}; ${message}`:message;};
  try{
    await lock.writeFile(JSON.stringify({id:proposal.id,pid:process.pid,journal})+"\n");await lock.sync();
    if(await readExisting(root,journal)!==null)throw new IntentError("intent.authoring.operation-exists","Operation journal already exists; inspect or recover it explicitly");
    for(const change of proposal.changes)if(await readExisting(root,change.path)!==change.before)throw new IntentError("intent.authoring.stale",`Source changed since proposal: ${change.path}`);
    const operation=createWorkspaceOperation(await FileSystemSource.open(root));
    const current=await readWorkspace(operation.source,workspaceOptions);
    if(current.stages.find(stage=>stage.name==="source-basis")?.complete!==true||current.sourceBasis.id!==proposal.sourceBasis)throw new IntentError("intent.authoring.stale-basis","Examined workspace changed since proposal; inspect and prepare the change again using the same source options");
    if(proposal.proposedBasis!==null){
      const proposed=await readWorkspace(operation.overlay(proposal.changes),workspaceOptions);
      if(proposed.stages.find(stage=>stage.name==="source-basis")?.complete!==true||proposed.sourceBasis.id!==proposal.proposedBasis)throw new IntentError("intent.authoring.stale-proposed-basis","Inputs examined by the proposed workspace changed since proposal; inspect and prepare the change again using the same source options");
    }
    await operation.verify();
    journalAttempted=true;await saveJournal();journalCreated=true;
    for(const change of proposal.changes) {
      if(options.signal?.aborted)throw new IntentError("intent.authoring.cancelled","Operation cancelled; the recovery journal identifies any completed writes");
      if(await readExisting(root,change.path)!==change.before)throw new IntentError("intent.authoring.stale",`Source changed during proposal application: ${change.path}`);
      if(change.after!==change.before) {
        if(change.after===null)await removeFile(root,change.path);else await atomicWrite(root,change.path,change.after);
        result.written.push(change.path);await saveJournal();
      }
    }
    result.status="completed";await saveJournal();
  }catch(error){
    failure(error);
    if(journalAttempted&&!journalCreated)try{journalCreated=await readExisting(root,journal)!==null;}catch(readError){failure(new Error(`Initial recovery journal could not be inspected: ${readError instanceof Error?readError.message:String(readError)}`));}
    refused=!journalCreated;
    if(journalCreated)try{await saveJournal();}catch(saveError){failure(new Error(`Recovery journal update failed; inspect actual files against its proposal: ${saveError instanceof Error?saveError.message:String(saveError)}`));}
  }
  // Keep a recovery journal when lock cleanup fails, even after all target writes.
  // It is safe to inspect actual bytes against the original reviewed proposal.
  try{await lock.close();await removeFile(root,lockPath);}catch(error){
    failure(new Error(`Authoring lock cleanup failed: ${error instanceof Error?error.message:String(error)}`));
    if(journalCreated)try{await saveJournal();}catch(saveError){failure(new Error(`Recovery journal save failed: ${saveError instanceof Error?saveError.message:String(saveError)}`));}
  }
  if(refused||!journalCreated)return {id:proposal.id,status:"refused",journal:null,written:[],error:result.error??"Operation refused"};
  if(result.status==="completed"){
    try{await removeFile(root,journal);return {id:proposal.id,status:"completed",journal:null,written:result.written,error:null};}
    catch(error){failure(new Error(`Completed operation journal cleanup failed: ${error instanceof Error?error.message:String(error)}`));try{await saveJournal();}catch(saveError){failure(new Error(`Recovery journal update failed: ${saveError instanceof Error?saveError.message:String(saveError)}`));}}
  }
  return {id:proposal.id,status:"interrupted",journal,written:result.written,error:result.error??"Operation interrupted"};

}

export async function inspectOperation(repositoryRoot:string,id:string) {
  if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))throw new IntentError("intent.authoring.id","Invalid operation ID");
  const root=await realpath(resolve(repositoryRoot)),path=`tmp/intent/operations/${id}.json`,text=await readExisting(root,path);
  if(text===null)throw new IntentError("intent.authoring.missing","Operation journal not found");
  const journal=parseStrictJson(text,{maxBytes:4194304,maxNodes:262144}) as unknown as {id:string;journal:string;proposal:FileProposal;status:"completed"|"interrupted";written:string[]};
  if(validateSchema("urn:intent:schema:authoring-results:v1#/$defs/operationJournal",journal).length)throw new IntentError("intent.authoring.journal","Operation journal violates its public carrier");
  if(journal.id!==id||journal.proposal.id!==id||journal.journal!==path)throw new IntentError("intent.authoring.journal","Journal identity does not match its selected operation and path");
  const changedPaths=journal.proposal.changes.filter(change=>change.before!==change.after).map(change=>change.path);
  if(journal.written.some(path=>!changedPaths.includes(path))||(journal.status==="completed"&&changedPaths.some(path=>!journal.written.includes(path))))throw new IntentError("intent.authoring.journal","Journal writes do not correspond to the reviewed proposal and completion state");
  proposeFiles(journal.proposal.sourceBasis,journal.proposal.changes,journal.proposal.proposedBasis===null?{}:{proposedBasis:journal.proposal.proposedBasis});
  const {digest:expected,...body}=journal.proposal;
  if(digestJson(body as unknown as Json)!==expected)throw new IntentError("intent.authoring.journal","Journal proposal fingerprint does not match");
  const files=[];
  for(const change of journal.proposal.changes){const actual=await readExisting(root,change.path);files.push({path:change.path,state:actual===change.after?"applied":actual===change.before?"original":"changed-externally",actualDigest:actual===null?null:digest(actual)});}
  return {id,status:journal.status,journalDigest:digest(text),files,proposal:journal.proposal};
}
