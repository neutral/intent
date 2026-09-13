import { summarizeWorkspace } from "./projections.js";
import { proposeDisciplineAdoption, type DisciplineAdoptionProposalOptions, type DisciplineRegistry } from "./disciplines.js";
import { proposeFiles, type FileChange } from "./authoring.js";
import { IntentError } from "./foundation.js";
import { readWorkspace } from "./workspace.js";
import { createWorkspaceOperation } from "./observation.js";
import { emptyContext, mergeRecordContext, projectRecordContext } from "./globals.js";
import { inspectRecord } from "./records.js";
import { validateSchema } from "./schemas.js";
import type { SourceReader } from "./types.js";

/** Plan adoption/update and Registry edits together without applying effects. */
export async function proposeRepositoryAdoption(target:SourceReader,pack:SourceReader,options:DisciplineAdoptionProposalOptions) {
  const targetOperation=createWorkspaceOperation(target),packOperation=createWorkspaceOperation(pack);
  target=targetOperation.source;pack=packOperation.source;
  const original=await readWorkspace(target,{resolveSources:true}),adoption=await proposeDisciplineAdoption(pack,options);
  if(!adoption.valid||!adoption.packChoice)return {adoption,fileProposal:null,original:summarizeWorkspace(original),proposed:null};
  if(!original.context)throw new IntentError("intent.adoption.context","Repair the target catalog and connections before adoption");
  let context=structuredClone(original.context);
  const changes:FileChange[]=[];
  const read=async(path:string)=>{try{return new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(await target.read(path,4194304));}catch(error){if(error instanceof IntentError&&error.code==="intent.source.missing")return null;throw error;}};
  const registryPath="intent/disciplines/registry.json";
  let registryBefore:string|null;
  try{registryBefore=await read(registryPath);}catch{throw new IntentError("intent.adoption.registry","The existing Registry is unreadable; repair it before proposing adoption");}
  if(registryBefore!==null&&(!original.disciplines?.registry||original.disciplines.diagnostics.some(issue=>issue.severity==="error"&&(issue.path===registryPath||issue.code==="intent.discipline.choice-pack"))))throw new IntentError("intent.adoption.registry","Repair the invalid existing Registry before proposing adoption");
  const registry:DisciplineRegistry=structuredClone(original.disciplines?.registry??{schema:"intent.discipline-registry.v1",packs:[],adoptions:[],workTypes:[]});
  const originalChoices=[...registry.adoptions];
  const existingPack=registry.packs.find(pack=>pack.id===adoption.packChoice!.id&&pack.version===adoption.packChoice!.version);
  if(existingPack&&(existingPack.source!==adoption.packChoice.source||existingPack.revision!==adoption.packChoice.revision)&&originalChoices.some(choice=>choice.packId===existingPack.id&&choice.packVersion===existingPack.version&&!adoption.choices.some(selected=>selected.id===choice.id)))throw new IntentError("intent.adoption.shared-selection","Changing a shared Pack source selection requires explicitly selecting all its adopted records");
  const requireSelectedIdentity=(path:string,sourceText:string,id:string)=>{
    const inspected=inspectRecord(sourceText,{path,limits:original.limits,context:original.context!});
    if(!inspected.valid||inspected.record?.header.kind!=="discipline"||inspected.record.header.id!==id)throw new IntentError("intent.adoption.destination",`Adoption cannot replace or delete unrelated or invalid content at ${path}`);
  };
  for(const choice of adoption.choices){
    for(const record of original.records.filter(record=>record.header.id===choice.id))context=mergeRecordContext(context,emptyContext(),record.header);
    const selected=adoption.pack.records.find(record=>record.header.id===choice.id)!;
    context=mergeRecordContext(context,projectRecordContext(adoption.context,selected.header),selected.header);
    const prior=registry.adoptions.find(item=>item.id===choice.id);
    if(originalChoices.some(item=>item.path===choice.path&&item.id!==choice.id))throw new IntentError("intent.adoption.destination",`Target path is already selected for another Discipline: ${choice.path}`);
    if(prior&&prior.path!==choice.path){const before=await read(prior.path);if(before!==null){requireSelectedIdentity(prior.path,before,choice.id);changes.push({path:prior.path,before,after:null});}}
    registry.adoptions=registry.adoptions.filter(item=>item.id!==choice.id);registry.adoptions.push(choice);
  }
  registry.packs=registry.packs.filter(item=>!(item.id===adoption.packChoice!.id&&item.version===adoption.packChoice!.version));registry.packs.push(adoption.packChoice);
  registry.packs=registry.packs.filter(pack=>registry.adoptions.some(choice=>choice.packId===pack.id&&choice.packVersion===pack.version));
  for(const file of adoption.files){
    const before=await read(file.path),after=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(file.bytes);
    if(before!==null){
      const choice=adoption.choices.find(item=>item.path===file.path)!;
      requireSelectedIdentity(file.path,before,choice.id);
      if(before!==after&&!originalChoices.some(item=>item.id===choice.id&&item.path===file.path))throw new IntentError("intent.adoption.destination",`Replacing existing guidance requires its explicit prior Registry choice: ${file.path}`);
    }
    changes.push({path:file.path,before,after});
  }
  changes.push({path:registryPath,before:registryBefore,after:JSON.stringify(registry,null,2)+"\n"});
  for(const [path,value] of [["intent/catalog.json",context.catalog],["intent/connections.json",context.connections]] as const){const before=await read(path),after=JSON.stringify(value,null,2)+"\n";if(before!==after)changes.push({path,before,after});}
  const fileProposal=proposeFiles(original.sourceBasis.id,changes);
  const proposed=await readWorkspace(targetOperation.overlay(changes),{resolveSources:true});
  if(original.stages.find(stage=>stage.name==="source-basis")?.complete!==true)throw new IntentError("intent.adoption.changed","Observe coherent target files before adoption preparation");
  try{await targetOperation.verify();await packOperation.verify();}catch{throw new IntentError("intent.adoption.changed","Examined source changed during adoption preparation");}
  return {adoption,fileProposal:proposeFiles(original.sourceBasis.id,changes,{proposedBasis:proposed.sourceBasis.id}),original:summarizeWorkspace(original),proposed:summarizeWorkspace(proposed)};
}

/** Remove explicit target choices, copies, and unused Pack selections. */
export async function proposeRepositoryDisciplineRemoval(target:SourceReader,options:{ids:string[];removeWorkTypeMemberships?:boolean}) {
  if(!options||typeof options!=="object"||Array.isArray(options)||Object.keys(options).some(key=>!["ids","removeWorkTypeMemberships"].includes(key))||(options.removeWorkTypeMemberships!==undefined&&typeof options.removeWorkTypeMemberships!=="boolean"))throw new IntentError("intent.adoption.removal","Use only ids and optional boolean removeWorkTypeMemberships");
  if(!Array.isArray(options.ids)||!options.ids.length||options.ids.length>4096||new Set(options.ids).size!==options.ids.length||options.ids.some(id=>typeof id!=="string"))throw new IntentError("intent.adoption.removal","Select 1 to 4096 unique adopted Discipline IDs");
  const targetOperation=createWorkspaceOperation(target);target=targetOperation.source;
  const ids=new Set(options.ids),original=await readWorkspace(target,{resolveSources:true});
  const registryPath="intent/disciplines/registry.json",beforeRegistry=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(await target.read(registryPath,4194304));
  const registry=structuredClone(original.disciplines?.registry);
  if(!registry||validateSchema("discipline-registry",registry).length)throw new IntentError("intent.adoption.registry","Repair the existing Registry before removing choices");
  const selected=registry.adoptions.filter(choice=>ids.has(choice.id));
  if(selected.length!==ids.size)throw new IntentError("intent.adoption.removal","Every selected ID must have an authored adoption choice");
  const affectedWorkTypes=registry.workTypes.filter(type=>type.disciplineIds.some(id=>ids.has(id)));
  if(affectedWorkTypes.length&&!options.removeWorkTypeMemberships)throw new IntentError("intent.adoption.work-types","Selected advice belongs to Work Types; explicitly include their membership changes in the removal proposal");
  if(!original.context)throw new IntentError("intent.adoption.context","Repair the catalog and connections before removal");
  let context=structuredClone(original.context);
  const changes:FileChange[]=[];
  for(const choice of selected) {
    for(const registration of original.context.catalog.records.filter(entry=>entry.record===choice.id))context=mergeRecordContext(context,emptyContext(),registration.record);
    let before:string;
    try{before=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(await target.read(choice.path,original.limits.maxRecordBytes));}
    catch(error){if(error instanceof IntentError&&error.code==="intent.source.missing")continue;throw error;}
    const inspected=inspectRecord(before,{path:choice.path,limits:original.limits,context:original.context});
    if(!inspected.valid||inspected.record?.header.kind!=="discipline"||inspected.record.header.id!==choice.id)throw new IntentError("intent.adoption.destination",`Removal cannot delete unrelated or invalid content at ${choice.path}`);
    changes.push({path:choice.path,before,after:null});
  }
  registry.adoptions=registry.adoptions.filter(choice=>!ids.has(choice.id));
  registry.workTypes=registry.workTypes.map(type=>({...type,disciplineIds:type.disciplineIds.filter(id=>!ids.has(id))})).filter(type=>type.disciplineIds.length);
  registry.packs=registry.packs.filter(pack=>!selected.some(choice=>choice.packId===pack.id&&choice.packVersion===pack.version)||registry.adoptions.some(choice=>choice.packId===pack.id&&choice.packVersion===pack.version));
  changes.push({path:registryPath,before:beforeRegistry,after:JSON.stringify(registry,null,2)+"\n"});
  for(const [path,value] of [["intent/catalog.json",context.catalog],["intent/connections.json",context.connections]] as const){const before=new TextDecoder("utf-8",{fatal:true}).decode(await target.read(path,original.limits.maxSourceBytes)),after=JSON.stringify(value,null,2)+"\n";if(before!==after)changes.push({path,before,after});}
  const fileProposal=proposeFiles(original.sourceBasis.id,changes);
  const proposed=await readWorkspace(targetOperation.overlay(changes),{resolveSources:true});
  if(original.stages.find(stage=>stage.name==="source-basis")?.complete!==true)throw new IntentError("intent.adoption.changed","Observe coherent target files before removal preparation");
  try{await targetOperation.verify();}catch{throw new IntentError("intent.adoption.changed","Examined target changed during removal preparation");}
  return {fileProposal:proposeFiles(original.sourceBasis.id,changes,{proposedBasis:proposed.sourceBasis.id}),original:summarizeWorkspace(original),proposed:summarizeWorkspace(proposed),removedIds:selected.map(choice=>choice.id),affectedWorkTypes:affectedWorkTypes.map(type=>type.id),limitations:["The proposal removes current target choices and exact selected file paths.","Empty affected Work Types and now-unused selected Pack choices are removed explicitly in the Registry diff; unrelated choices remain."]};
}
