import { createWorkspaceOperation } from "./observation.js";
import { summarizeWorkspace, type WorkspaceSummary } from "./projections.js";
import { proposeFiles, type FileChange, type FileProposal } from "./authoring.js";
import { compareText, diagnostic, IntentError, normalizedPath } from "./foundation.js";
import { createRecordTemplate, type InitializationTemplate } from "./initialize.js";
import { mergeRecordContext } from "./globals.js";
import { inspectRecord } from "./records.js";
import { MemorySource } from "./sources.js";
import { readWorkspace, type WorkspaceInspection, type WorkspaceOptions } from "./workspace.js";
import type { Diagnostic, SourceReader } from "./types.js";

export interface RecordCreationRequest extends InitializationTemplate {workspaceOptions?:WorkspaceOptions}
export interface RecordCreationProposal {
  schema:"intent.record-creation-proposal.v1";
  fileProposal:FileProposal|null;
  original:WorkspaceSummary;
  proposed:WorkspaceSummary|null;
  diagnostics:Diagnostic[];
  complete:boolean;
  limitations:string[];
}
function reject(message:string,code="intent.create.request"):never {throw new IntentError(code,message);}
async function absent(source:SourceReader,path:string,maximum:number):Promise<void> {
  if((await source.list(path)).length)reject(`Creation cannot replace existing content: ${path}`,"intent.create.exists");
  try {await source.read(path,maximum);}
  catch(error) {if((error as {code?:string}).code==="intent.source.missing"||(error as {code?:string}).code==="ENOENT")return;throw error;}
  reject(`Creation cannot replace existing content: ${path}`,"intent.create.exists");
}

/** Prepare one new Product draft with explicit selectors; never writes or adopts it. */
export async function proposeRecordCreation(source:SourceReader,request:RecordCreationRequest):Promise<RecordCreationProposal> {
  const observation=createWorkspaceOperation(source);source=observation.source;
  const original=await readWorkspace(source,request.workspaceOptions);
  const result:Omit<RecordCreationProposal,"original"|"proposed"> & {original:WorkspaceInspection;proposed:WorkspaceInspection|null}={schema:"intent.record-creation-proposal.v1",fileProposal:null,original,proposed:null,diagnostics:[],complete:false,
    limitations:["This creates a proposed draft with visible placeholders, not a current Product promise or completed examination.","Description coverage and Check subjects are caller-selected. The template does not infer implementation meaning, establish readiness or produce an implementation report.","Edit the draft and change its status when its present meaning is ready."]};
  try {
    if(!original.config)reject("Initialize or repair intent/project.json before creating Product drafts","intent.create.configuration");
    if(original.stages.find(stage=>stage.name==="configuration")?.valid!==true||original.stages.find(stage=>stage.name==="source-basis")?.valid!==true)reject("The project configuration and observed source basis must be valid before preparing a new draft","intent.create.source-incomplete");
    if(!["behavior","assurance","blueprint","description","check"].includes(request.kind))reject("Product drafts use Behavior, Assurance, Blueprint, Description, or Check. Discipline source belongs in a publisher Pack.","intent.create.kind");
    normalizedPath(request.path,false,original.limits.maxPathBytes);
    const owners=request.owners??original.config.owners;
    if(!Array.isArray(owners)||!owners.length||owners.some(owner=>!original.config!.owners.includes(owner)))reject("Draft owners must name declared project owners","intent.create.owner");
    if(original.inspections.some(item=>item.identity?.id===request.id))reject("This identity already exists in authored Knowledge; edit the existing record","intent.create.identity");
    await absent(source,request.path,original.limits.maxRecordBytes);
    const created=createRecordTemplate(request.kind,{...request,owners}),content=created.sourceText;
    const inspected=inspectRecord(content,{path:request.path,limits:original.limits,context:created.context});
    if(!inspected.valid){result.diagnostics.push(...inspected.diagnostics);return {...result,original:summarizeWorkspace(result.original),proposed:result.proposed?summarizeWorkspace(result.proposed):null};}
    if(!original.context)reject("Repair the authored catalog and connections before creating Knowledge","intent.create.context");
    const context=mergeRecordContext(original.context,created.context,inspected.record!.header);
    const changes:FileChange[]=[{path:request.path,before:null,after:content}];
    for(const [path,value] of [["intent/catalog.json",context.catalog],["intent/connections.json",context.connections]] as const){const before=new TextDecoder("utf-8",{fatal:true}).decode(await source.read(path,original.limits.maxSourceBytes));const after=JSON.stringify(value,null,2)+"\n";if(before!==after)changes.push({path,before,after});}
    const proposal=proposeFiles(original.sourceBasis.id,changes);
    result.proposed=await readWorkspace(observation.overlay(changes),request.workspaceOptions);
    if(result.proposed.stages.find(stage=>stage.name==="source-basis")?.valid!==true)reject("Cannot prepare a draft from a changing or incomplete source observation","intent.create.source-incomplete");
    await observation.verify();
    result.fileProposal=proposeFiles(original.sourceBasis.id,changes,{proposedBasis:result.proposed.sourceBasis.id});result.complete=true;return {...result,original:summarizeWorkspace(result.original),proposed:result.proposed?summarizeWorkspace(result.proposed):null};
  }catch(error){result.diagnostics.push(diagnostic(error,request.path,"authoring"));return {...result,original:summarizeWorkspace(result.original),proposed:result.proposed?summarizeWorkspace(result.proposed):null};}
}
