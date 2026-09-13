import { createWorkspaceOperation } from "../../library/observation.js";
import { inspectedRecords, reconcileWorkspace } from "../../library/index.js";
import { readRecordDocument } from "../../library/records.js";
import { retainWorkspaceObservation, compareWorkspaceSources, reviewFileProposal, type RetainedWorkspaceObservation } from "../../library/index.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { editorRecovery, validateDraft } from "./recovery.js";
import { buildPortal, type PortalBuild } from "../portal/build.js";
import { writePortal } from "../portal/export.js";
import { intentInvocation, type IntentInvocation } from "../cli/runtime.js";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { renderKnowledgeMarkdown } from "../../library/index.js";
import { canonicalJson, normalizedPath } from "../../library/foundation.js";
import type { Json } from "../../library/index.js";
import { validateDisciplinePack,proposeRepositoryAdoption,proposeRepositoryDisciplineRemoval,toWire,type DisciplineAdoptionProposalOptions } from "../../library/index.js";
import { proposeOperationResume, discardOperation } from "../../library/index.js";
import { FileSystemSource, readWorkspace, readJsonBytes, DEFAULT_LIMITS, proposeFiles, applyFileProposal, inspectOperation, IntentError, proposeRecordChange, proposeInitialization, proposeRecordCreation, type InitializationRequest, type RecordCreationRequest, type RecordChangeRequest, type FileProposal } from "../../library/index.js";

export interface EditorService {url:string;listenUrl?:string;root:string;close:()=>Promise<void>}
export async function startEditor(repositoryRoot:string,options:{port?:number;bind?:string;publicOrigin?:string;stateDirectory?:string;command?:IntentInvocation}={}):Promise<EditorService> {
  const selected=await FileSystemSource.open(repositoryRoot),root=selected.root,token=randomBytes(32).toString("hex");
  const bind=options.bind??"127.0.0.1",remote=!["127.0.0.1","::1","localhost"].includes(bind),protectedPage=remote||Boolean(options.publicOrigin);
  if(remote&&!options.publicOrigin)throw new IntentError("intent.editor.origin","A non-loopback bind requires an explicit --origin http(s) URL");
  let declaredOrigin:URL|undefined;
  if(options.publicOrigin){declaredOrigin=new URL(options.publicOrigin);if(!["http:","https:"].includes(declaredOrigin.protocol)||declaredOrigin.username||declaredOrigin.password||declaredOrigin.pathname!=="/"||declaredOrigin.search||declaredOrigin.hash)throw new IntentError("intent.editor.origin","The public origin must be an http(s) origin without credentials, a path, query or fragment");}
  const recovery=editorRecovery(root,options.stateDirectory);await recovery.read();
  let exportPreview:{id:string;plan:PortalBuild;sourceBasis:string;recordIds:string[];title:string}|null=null;
  let origin="",host="";
  const assets=new URL("../../../apps/editor/assets/",import.meta.url);
  const send=(response:ServerResponse,status:number,value:unknown)=>{response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});response.end(JSON.stringify(toWire(value)));};
  const remember=async(value:FileProposal|{fileProposal?:FileProposal|null},response:ServerResponse,expectedRevision?:string)=>{const proposal="fileProposal" in value?value.fileProposal:value as FileProposal;if(proposal){await recovery.update({proposal},expectedRevision);response.setHeader("x-intent-recovery-revision",recovery.revision??"");}};
  const load=()=>readWorkspace(selected,{resolveSources:true});
  const editState=async(path:string)=>{
    normalizedPath(path);
    if(!["intent/project.json","intent/catalog.json","intent/connections.json","intent/disciplines/registry.json"].includes(path)&&!/^intent\/(behavior|assurance|blueprint|description|checks|disciplines)\/.+\.md$/.test(path))throw new IntentError("intent.editor.scope","Select an authored Knowledge or configuration file");
    const observation=await retainWorkspaceObservation(selected,{resolveSources:true}),workspace=observation.workspace;
    const inspection=workspace.inspections.find(item=>item.path===path);
    let source:string|null=null;
    if(workspace.inventory.some(item=>item.path===path))source=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(await observation.source.read(path,4194304));
    else if(inspection||workspace.stages.some(stage=>["discovery","source-basis"].includes(stage.name)&&!stage.complete)||workspace.diagnostics.some(issue=>issue.path===path&&issue.severity==="error"&&issue.code!=="intent.source.missing"))throw new IntentError("intent.editor.incomplete","The edited source could not be read completely; local text must be preserved");
    return {workspace,path,source,context:inspectedRecords(workspace).find(record=>record.path===path)?.context??null};
  };
  let reviewBaseline:{observation:RetainedWorkspaceObservation;observedAt:string}|null=null;
  const server=createServer(async(request,response)=>{
    try{
      if(request.headers.host!==host)throw new IntentError("intent.editor.host","Request host does not match the selected local service");
      const url=new URL(request.url??"/",origin);
      response.setHeader("content-security-policy","default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      response.setHeader("referrer-policy","no-referrer");
      response.setHeader("cross-origin-resource-policy","same-origin");
      if(url.pathname.startsWith("/api/")){
        if(request.headers.origin&&request.headers.origin!==origin)throw new IntentError("intent.editor.origin","Unrelated browser origins cannot access the local service");
        if(request.headers["x-intent-token"]!==token)throw new IntentError("intent.editor.token","A local session token is required");
        if(request.method==="GET"&&url.pathname==="/api/recovery"){send(response,200,{...await recovery.read(),directory:recovery.directory});return;}
        if(request.method==="GET"&&url.pathname==="/api/connection"){
          const invocation=options.command??intentInvocation();
          send(response,200,{root,invocation,config:{mcpServers:{intent:{...invocation,args:[...invocation.args,"mcp",root]}}}});return;
        }
        if(request.method==="GET"&&url.pathname==="/api/export-options"){send(response,200,{destination:join(dirname(root),`${basename(root)}-site`)});return;}
        if(request.method==="GET"&&url.pathname==="/api/workspace"){send(response,200,await load());return;}
        if(request.method==="GET"&&url.pathname==="/api/edit-state"){send(response,200,await editState(url.searchParams.get("path")??""));return;}
        if(request.method==="GET"&&url.pathname==="/api/meaning"){
          const path=url.searchParams.get("path")??"",workspace=await load(),record=workspace.records.find(record=>record.path===path);
          if(!record)throw new IntentError("intent.editor.scope","Select a readable Knowledge record from this workspace");
          send(response,200,{path,sourceDigest:record.sourceDigest,semanticDigest:record.semanticDigest,html:renderKnowledgeMarkdown(readRecordDocument(record).body,{omitTitle:true})});return;
        }
        if(request.method==="GET"&&url.pathname==="/api/source"){
          const path=url.searchParams.get("path")??"",workspace=await load();
          const inspected=workspace.inspections.find(item=>item.path===path);
          const record=inspectedRecords(workspace).find(item=>item.path===path);
          if(record){send(response,200,{path,source:record.sourceText});return;}
          if(inspected?.raw!==null&&inspected?.raw!==undefined){send(response,200,{path,source:inspected.raw});return;}
          if(!workspace.inventory.some(item=>item.path===path))throw new IntentError("intent.editor.scope","File is outside this observed repository scope");
          send(response,200,{path,source:new TextDecoder("utf-8",{fatal:true}).decode(await selected.read(path,4194304))});return;
        }
        if(request.method==="GET"&&url.pathname==="/api/implementation"){
          const workspace=await reconcileWorkspace(selected,{resolveSources:true}),id=url.searchParams.get("record");
          send(response,200,{mode:workspace.mode,artifacts:workspace.coverage?.artifacts.filter(file=>file.owners.includes(id??""))??[],complete:workspace.coverage?.complete??false,diagnostics:workspace.coverage?.diagnostics??[]});return;
        }
        if(request.method==="GET"&&url.pathname==="/api/implementation-source"){
          const path=url.searchParams.get("path")??"",observed=await retainWorkspaceObservation(selected,{resolveSources:true,reconcileImplementation:true});
          if(!observed.workspace.coverage?.artifacts.some(file=>file.path===path))throw new IntentError("intent.editor.scope","Select a governed implementation file through reconciliation");
          send(response,200,{path,source:new TextDecoder("utf-8",{fatal:true}).decode(await observed.source.read(path,4194304))});return;
        }
        if(request.method==="GET"&&url.pathname==="/api/operation"){send(response,200,await inspectOperation(root,url.searchParams.get("id")??""));return;}
        if(request.method!=="POST"){send(response,405,{error:"Unsupported method"});return;}
        const chunks:Buffer[]=[];let size=0;
        for await(const chunk of request){size+=chunk.length;if(size>4000000)throw new IntentError("intent.editor.limit","Request exceeds 4 MB");chunks.push(chunk);}
        const body=readJsonBytes(Buffer.concat(chunks),{...DEFAULT_LIMITS,maxFrontMatterBytes:4000000}) as unknown as Record<string,unknown>;
        const fields:Record<string,string[]>={
          "/api/comparison":["action","sourceBasis"],"/api/pack":["root"],"/api/adopt":["sourceBasis","packRoot","request"],
          "/api/remove-adoption":["sourceBasis","ids","removeWorkTypeMemberships"],"/api/discard-operation":["id","journalDigest"],"/api/resume":["id","sourceBasis"],
          "/api/initialize":["sourceBasis","request"],"/api/create":["sourceBasis","request"],"/api/propose":["path","before","after","sourceBasis"],
          "/api/change":["path","before","beforeContext","operation","sourceBasis"],
          "/api/recovery":["draft","clear","revision"],"/api/export-preview":["recordIds","sourceBasis","title"],"/api/export":["previewId","destination"],
        };
        if(fields[url.pathname]&&(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(key=>!fields[url.pathname]!.includes(key))))throw new IntentError("intent.editor.request","Unexpected fields in the current operation request");
        if(url.pathname==="/api/recovery"){
          if(body.revision!==undefined&&typeof body.revision!=="string")throw new IntentError("intent.editor.request","The recovery revision must be exact text");
          if(body.clear===true&&Object.keys(body).every(key=>["clear","revision"].includes(key)))await recovery.update({draft:null,proposal:null},body.revision as string|undefined);
          else {if(!Object.hasOwn(body,"draft")||Object.hasOwn(body,"clear"))throw new IntentError("intent.editor.request","Save a draft or explicitly clear recovery");validateDraft(body.draft);await recovery.update({draft:body.draft},body.revision as string|undefined);}
          send(response,200,{saved:true,revision:recovery.revision});return;
        }
        if(url.pathname==="/api/export-preview"){
          const workspace=await load();if(body.sourceBasis!==workspace.sourceBasis.id)throw new IntentError("intent.editor.stale","Refresh before previewing the selected site");
          if(body.title!==undefined&&typeof body.title!=="string")throw new IntentError("intent.editor.request","The site title must be text");
          const title=body.title as string|undefined??"Intent Knowledge",plan=await buildPortal(workspace,selected,{recordIds:body.recordIds as string[]},{title});
          if(!plan.complete||!plan.manifest){send(response,422,plan);return;}
          exportPreview={id:randomBytes(24).toString("hex"),plan,sourceBasis:workspace.sourceBasis.id,recordIds:plan.manifest.selection.recordIds,title};
          send(response,200,{previewId:exportPreview.id,url:`${origin}/site-preview/${exportPreview.id}/`,manifest:plan.manifest});return;
        }
        if(url.pathname==="/api/export"){
          if(!exportPreview||body.previewId!==exportPreview.id)throw new IntentError("intent.editor.stale","Preview the selected content again before exporting");
          if(typeof body.destination!=="string"||!body.destination.trim())throw new IntentError("intent.editor.request","Choose an explicit new destination directory");
          const workspace=await load();if(workspace.sourceBasis.id!==exportPreview.sourceBasis)throw new IntentError("intent.editor.stale","Knowledge changed after the preview; refresh and preview again");
          const fresh=await buildPortal(workspace,selected,{recordIds:exportPreview.recordIds},{title:exportPreview.title});
          if(!fresh.complete||fresh.manifest?.digest!==exportPreview.plan.manifest?.digest)throw new IntentError("intent.editor.stale","Selected content changed after the preview; preview again");
          const destination=await writePortal(exportPreview.plan,body.destination);
          send(response,200,{destination,url:`${origin}/site-preview/${exportPreview.id}/`,records:exportPreview.recordIds.length});return;
        }
        if(url.pathname==="/api/comparison"){
          if(body.action==="release"){reviewBaseline=null;send(response,200,{released:true});return;}
          if(body.action==="retain"){
            const operation=createWorkspaceOperation(selected),knowledge=await readWorkspace(operation.source,{resolveSources:true});
            if(body.sourceBasis!==knowledge.sourceBasis.id)throw new IntentError("intent.editor.stale","Refresh before retaining this comparison baseline");
            const observation=await retainWorkspaceObservation(operation.source,{resolveSources:true,reconcileImplementation:true});await operation.verify();
            if(observation.workspace.stages.find(stage=>stage.name==="source-basis")?.complete!==true)throw new IntentError("intent.editor.incomplete","Resolve the incomplete source observation before retaining a comparison baseline");
            reviewBaseline={observation,observedAt:new Date().toISOString()};
            send(response,200,{observedAt:reviewBaseline.observedAt,sourceBasis:observation.workspace.sourceBasis,sizeBytes:observation.sizeBytes,records:observation.workspace.records.length,limitations:["This exact comparison baseline is retained only in this service process. Process exit releases it."]});return;
          }
          if(body.action!=="compare")throw new IntentError("intent.editor.request","Choose retain, compare or release explicitly");
          if(!reviewBaseline)throw new IntentError("intent.editor.comparison","Retain an original observation before editing code or Knowledge");
          const after=await retainWorkspaceObservation(selected,{resolveSources:true,reconcileImplementation:true});
          send(response,200,{observedAt:reviewBaseline.observedAt,review:await compareWorkspaceSources(reviewBaseline.observation,after)});return;
        }
        if(url.pathname==="/api/proposal-review"){
          send(response,200,await reviewFileProposal(selected,body as unknown as FileProposal,{resolveSources:true}));return;
        }
        if(url.pathname==="/api/pack"){
          if(typeof body.root!=="string")throw new IntentError("intent.editor.request","Select the local Pack directory explicitly");
          const packSource=await FileSystemSource.open(body.root),pack=await validateDisciplinePack(packSource);
          send(response,200,{pack,source:pathToFileURL(packSource.root).href});return;
        }
        if(url.pathname==="/api/adopt"||url.pathname==="/api/remove-adoption"){
          const workspace=await load();if(body.sourceBasis!==workspace.sourceBasis.id)throw new IntentError("intent.editor.stale","Refresh before preparing an adoption change");
          if(url.pathname==="/api/adopt"){
            if(typeof body.packRoot!=="string"||!body.request||typeof body.request!=="object")throw new IntentError("intent.editor.request","Select a local Pack and explicit adoption choices");
            const prepared=await proposeRepositoryAdoption(selected,await FileSystemSource.open(body.packRoot),body.request as unknown as DisciplineAdoptionProposalOptions);
            await remember(prepared,response,request.headers["x-intent-recovery-revision"] as string|undefined);send(response,prepared.fileProposal?200:422,prepared);return;
          }
          const prepared=await proposeRepositoryDisciplineRemoval(selected,{ids:body.ids as string[],...(Object.hasOwn(body,"removeWorkTypeMemberships")?{removeWorkTypeMemberships:body.removeWorkTypeMemberships as boolean}:{})});
          await remember(prepared,response,request.headers["x-intent-recovery-revision"] as string|undefined);send(response,200,prepared);return;
        }
        if(url.pathname==="/api/discard-operation"){send(response,200,await discardOperation(root,body as unknown as Parameters<typeof discardOperation>[1]));return;}
        if(url.pathname==="/api/resume"){
          const workspace=await load();
          if(body.sourceBasis!==workspace.sourceBasis.id)throw new IntentError("intent.editor.stale","Refresh before preparing recovery");
          if(typeof body.id!=="string")throw new IntentError("intent.editor.request","Select the operation ID from its retained journal");
          const prepared=await proposeOperationResume(root,body.id,{workspaceOptions:{resolveSources:true}});await remember(prepared,response,request.headers["x-intent-recovery-revision"] as string|undefined);send(response,200,prepared);return;
        }
        if(url.pathname==="/api/initialize"||url.pathname==="/api/create"){
          const workspace=await load();
          if(body.sourceBasis!==workspace.sourceBasis.id)throw new IntentError("intent.editor.stale","Refresh before preparing new Intent content");
          if(!body.request||typeof body.request!=="object"||Array.isArray(body.request))throw new IntentError("intent.editor.request","Supply explicit initialization or draft options");
          const result=url.pathname==="/api/initialize"?await proposeInitialization(selected,body.request as InitializationRequest,{workspaceOptions:{resolveSources:true}}):await proposeRecordCreation(selected,{...body.request as RecordCreationRequest,workspaceOptions:{resolveSources:true}});
          await remember(result,response,request.headers["x-intent-recovery-revision"] as string|undefined);send(response,result.fileProposal?200:422,result);return;
        }
        if(url.pathname==="/api/propose"){
          if(typeof body.path!=="string"||typeof body.after!=="string"||(body.before!==null&&typeof body.before!=="string"))throw new IntentError("intent.editor.request","An edit requires path, exact before content, and after content");
          const observed=await editState(body.path),workspace=observed.workspace;
          if(body.sourceBasis!==workspace.sourceBasis.id)throw new IntentError("intent.editor.stale","Refresh the repository before preparing this edit");
          if(body.before!==observed.source)throw new IntentError("intent.editor.conflict","The edited source changed. Refresh and resolve the conflict while preserving your local text");
          const prepared=proposeFiles(workspace.sourceBasis.id,[{path:body.path,before:body.before as string|null,after:body.after}]);await remember(prepared,response,request.headers["x-intent-recovery-revision"] as string|undefined);send(response,200,prepared);return;
        }
        if(url.pathname==="/api/apply") {const result=await applyFileProposal(root,body as unknown as FileProposal,{workspaceOptions:{resolveSources:true}});if(result.status==="completed"){try{await recovery.update({draft:null,proposal:null},request.headers["x-intent-recovery-revision"] as string|undefined);response.setHeader("x-intent-recovery-revision",recovery.revision??"");}catch(error){send(response,200,{...result,recoveryError:error instanceof Error?error.message:String(error)});return;}}send(response,200,result);return;}
        if(url.pathname==="/api/change"){
          const workspace=await load();
          if(body.sourceBasis!==workspace.sourceBasis.id)throw new IntentError("intent.editor.stale","Refresh before preparing a record change");
          if(typeof body.path!=="string"||!body.operation||typeof body.operation!=="object")throw new IntentError("intent.editor.request","A record change requires the record path and explicit operation");
          if(Object.hasOwn(body,"before")){
            const inspection=workspace.inspections.find(item=>item.path===body.path),record=inspectedRecords(workspace).find(item=>item.path===body.path);
            if(body.before!==(record?.sourceText??inspection?.raw??null)||canonicalJson((body.beforeContext??null) as Json)!==canonicalJson((record?.context??null) as Json))throw new IntentError("intent.editor.conflict","The edited source or selected metadata changed. Refresh and resolve the conflict while preserving both editors");
          }
          const changeRequest={path:body.path,operation:body.operation,workspaceOptions:{resolveSources:true}} as RecordChangeRequest;
          const result=await proposeRecordChange(selected,changeRequest);
          if(result.original.sourceBasis.id!==body.sourceBasis)throw new IntentError("intent.editor.stale","The repository changed during change preparation. Refresh with your local text preserved and prepare again");
          await remember(result,response,request.headers["x-intent-recovery-revision"] as string|undefined);send(response,result.fileProposal?200:422,result);return;
        }
        send(response,404,{error:"Unknown operation"});return;
      }
      if(request.method!=="GET"){send(response,405,{error:"Unsupported method"});return;}
      if(exportPreview&&url.pathname.startsWith(`/site-preview/${exportPreview.id}/`)){
        const path=url.pathname.slice(`/site-preview/${exportPreview.id}/`.length)||"index.html",file=exportPreview.plan.files.find(file=>file.path===path);
        if(!file){send(response,404,{error:"Unknown selected site file"});return;}
        response.writeHead(200,{"content-type":file.mediaType,"cache-control":"no-store","x-content-type-options":"nosniff"});response.end(file.bytes);return;
      }
      if(protectedPage&&url.pathname==="/"&&url.searchParams.get("token")!==token)throw new IntentError("intent.editor.token","Open the authenticated session URL printed by Intent");
      const asset=url.pathname==="/"?"index.html":url.pathname==="/app.js"?"app.js":url.pathname==="/style.css"?"style.css":null;
      if(!asset){send(response,404,{error:"Unknown asset"});return;}
      response.writeHead(200,{"content-type":asset.endsWith("html")?"text/html; charset=utf-8":asset.endsWith("css")?"text/css; charset=utf-8":"application/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});
      const bytes=await readFile(new URL(asset,assets));
      response.end(asset==="index.html"?bytes.toString("utf8").replace("__INTENT_TOKEN__",token).replace('class="brand" href="/"',`class="brand" href="/${protectedPage?`?token=${token}`:""}"`):bytes);
    }catch(error){const code=error instanceof IntentError?error.code:"intent.editor.failed";send(response,code.includes("stale")||code.includes("conflict")?409:code.includes("token")||code.includes("origin")||code.includes("host")?403:400,{code,error:error instanceof Error?error.message:String(error)});}
  });
  server.requestTimeout=300000;server.headersTimeout=10000;
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(options.port??0,bind,()=>resolve());});
  const address=server.address();if(!address||typeof address==="string")throw new Error("Editor failed to bind a TCP port");
  const listenUrl=`http://${address.address.includes(":")?`[${address.address}]`:address.address}:${address.port}`;
  origin=declaredOrigin?.origin??listenUrl;host=new URL(origin).host;
  return {url:origin+(protectedPage?`/?token=${token}`:""),listenUrl,root,close:async()=>{exportPreview=null;await new Promise<void>((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeIdleConnections();});}};
}
