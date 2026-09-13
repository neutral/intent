import { createWorkspaceOperation } from "./observation.js";
import { summarizeWorkspace, type WorkspaceSummary } from "./projections.js";
import { proposeFiles, type FileChange, type FileProposal } from "./authoring.js";
import { compareText, containsPath, diagnostic, IntentError, normalizedPath, scalarString } from "./foundation.js";
import { BODY_SECTIONS, inspectRecord } from "./records.js";
import { contextForHeader, emptyContext, mergeRecordContext } from "./globals.js";
import { SECTION_DEFINITIONS } from "./document.js";
import { validateSchema } from "./schemas.js";
import { MemorySource } from "./sources.js";
import { readWorkspace, type WorkspaceInspection, type WorkspaceOptions } from "./workspace.js";
import type { CoverageSelector, Diagnostic, Header, Json, Kind, ProjectConfig, RecordContext, SourceEntry, SourceReader } from "./types.js";

export type ProductKind=Exclude<Kind,"discipline">;
export interface TemplateSubject {kind:"repository"|"file"|"tree"|"record"|"diff"|"artifact";selector:string}
export interface RecordTemplateOptions {
  id:string;
  title:string;
  owners:string[];
  /** Required for Description: literal caller-selected coverage, never inferred. */
  coverage?:CoverageSelector[];
  /** Required for Check: explicit proposed subjects, not evidence of examination. */
  subjects?:TemplateSubject[];
  /** Required for Discipline: sole owner of a proposed publisher Pack source. */
  publisher?:string;
  ending?:"\n"|"\r\n";
}
export interface InitializationTemplate extends Omit<RecordTemplateOptions,"owners"|"publisher"|"ending"> {
  kind:ProductKind;
  path:string;
  owners?:string[];
}
export interface InitializationRequest {
  name:string;
  owners:string[];
  implementationRoots:string[];
  description?:string;
  templates?:InitializationTemplate[];
}
export interface InitializationProposal {
  schema:"intent.initialization-proposal.v1";
  fileProposal:FileProposal|null;
  proposed:WorkspaceSummary|null;
  diagnostics:Diagnostic[];
  scope:{implementationRoots:string[];governedArtifacts:number|null;claim:string};
  /** Successful preparation, not complete implementation explanation. */
  complete:boolean;
  limitations:string[];
}

function invalid(message:string,code="intent.template.options"):never {throw new IntentError(code,message);}
const proposed=(instruction:string)=>`PROPOSED PLACEHOLDER: ${instruction}`;
const one=(instruction:string):Json[]=>[proposed(instruction)];
function titleMarkdown(title:string):string {
  // Escape CommonMark punctuation and encode spaces so headings preserve the
  // caller's exact display text, including markup, repeated spaces and tabs.
  scalarString(title);
  return title.replace(/[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/g,"\\$&").replace(/ /g,"&#32;").replace(/\t/g,"&#9;");
}

export interface RecordTemplate {sourceText:string;context:RecordContext}
/** Return coordinated source and metadata; this is neither publication nor adoption. */
export function createRecordTemplate(kind:Kind,options:RecordTemplateOptions):RecordTemplate {
  if(!Object.hasOwn(BODY_SECTIONS,kind))invalid("Choose a supported Knowledge kind");
  if(validateSchema("urn:intent:schema:common:v1#/$defs/line",options.title).length)invalid("A template title must be nonempty single-line text");
  if(options.ending!==undefined&&options.ending!=="\n"&&options.ending!=="\r\n")invalid("Choose LF or CRLF line endings");
  if(kind==="description"&&!options.coverage?.length)invalid("A Description template requires explicit proposed coverage selectors");
  if(kind==="check"&&!options.subjects?.length)invalid("A Check template requires explicit proposed subjects");
  if(kind==="discipline"&&(!options.publisher||options.owners.length!==1||options.owners[0]!==options.publisher))invalid("A Discipline template requires a named publisher as its sole owner and belongs in that publisher's Pack");
  if(kind!=="discipline"&&options.publisher!==undefined)invalid("Publisher is only meaningful for a Discipline Pack template");
  if(kind!=="description"&&options.coverage!==undefined)invalid("Coverage selectors are only meaningful for a Description template");
  if(kind!=="check"&&options.subjects!==undefined)invalid("Subjects are only meaningful for a Check template");
  const specs:Record<Kind,Record<string,Json>>={
    behavior:{outcome:proposed("State the observable outcome to consider."),actors:one("Identify the relevant actor."),conditions:[],included:one("State the included behavior."),excluded:[],examples:one("Describe an example to examine."),falsifiers:one("Describe an observation that would contradict the proposal.")},
    assurance:{obligation:proposed("State the candidate obligation."),scope:one("Identify the proposed scope."),failureModes:one("Name a failure mode to examine."),limits:one("State a measurable proposed limit."),degradation:[],falsifiers:one("Describe a counterexample to the candidate obligation.")},
    blueprint:{decision:proposed("State the candidate design decision."),scope:one("Identify the proposed design scope."),components:[],constraints:one("State a candidate constraint."),interfaces:[],dataFlows:[],tradeoffs:one("Describe a tradeoff to evaluate."),evolution:[]},
    description:{responsibility:proposed("Explain the selected implementation's responsibility after reading it."),coverage:structuredClone(options.coverage??[]) as unknown as Json,behavior:one("Explain observed implementation behavior; no behavior has been inferred."),boundaries:one("Explain the implementation boundary."),invariants:[],dependencies:[],failure:one("Explain actual failure and recovery behavior after inspection."),rationale:one("Record the rationale supported by the implementation or its authors.")},
    check:{proposition:proposed("State the supported promise and a falsifiable proposition to examine."),subjects:structuredClone(options.subjects??[]) as unknown as Json,evidenceKinds:["inspection"],evidence:proposed("Describe the observations and independently grounded expected results needed to assess the proposition."),evaluation:{pass:proposed("Define the evidence needed to support the proposition."),fail:proposed("Define evidence that contradicts the proposition."),indeterminate:proposed("Define when available evidence cannot decide."),notRun:"No examination has been performed by this template."},limits:one("Declare the examination limits before use."),falsifiers:one("Describe an unacceptable implementation that could pass the proposed criteria, then state an observation that would expose it.")},
    discipline:{practice:proposed("Write candidate advisory guidance for publisher review."),appliesWhen:one("Describe when this advice may help."),doesNotApplyWhen:[],guidance:one("Describe an optional practice; it creates no Product obligation."),verification:[]},
  };
  const header:Header={schema:"intent.knowledge-record.v2",kind,id:options.id,status:kind==="discipline"?"current":"draft",
    owners:structuredClone(options.owners),sources:[],relationships:[],conflicts:[],tags:[],
    ...(kind==="description"?{coverage:structuredClone(options.coverage!)}:{}),
    ...(kind==="check"?{subjects:structuredClone(options.subjects!),evidenceKinds:["inspection"]}:{})};
  const notice=kind==="discipline"?"Proposed publisher Pack source. Its current status satisfies the Pack source contract; this template has not been published, adopted, reviewed, or executed. Advice remains optional.":"Proposed draft template. No current Product promise, implementation explanation, completed examination, or review is established.";
  const bodySections=SECTION_DEFINITIONS[kind].filter(section=>section.required).map(section=>{
    const value=kind==="check"&&["pass","fail","indeterminate","notRun"].includes(section.field)?(specs[kind].evaluation as Record<string,Json>)[section.field]:specs[kind][section.field];
    const markdown=section.scalar?String(value):(value as string[]).join("\n\n");
    return `## ${section.name}${markdown?`\n\n${markdown}`:""}`;
  });
  const body=`# ${titleMarkdown(options.title)}\n\n${notice}\n\n${bodySections.join("\n\n")}\n`;
  const context=contextForHeader(header),{schema,kind:recordKind,id,status}=header;
  const source=`---\n${JSON.stringify({schema,kind:recordKind,id,status},null,2)}\n---\n${body}`.replace(/\n/g,options.ending??"\n");
  const inspected=inspectRecord(source,{location:"unplaced",context});
  if(!inspected.valid)invalid(inspected.diagnostics.map(issue=>`${issue.code}: ${issue.message}`).join("; "),"intent.template.invalid");
  return {sourceText:source,context};
}

function checkedIntentEntries(entries:SourceEntry[]):SourceEntry[] {
  if(entries.length>262144)invalid("Intent discovery exceeds the source-entry limit","intent.initialize.limit");
  for(const entry of entries) {normalizedPath(entry.path);if(!containsPath("intent",entry.path))invalid("Reader returned content outside intent/","intent.initialize.source-scope");}
  const sorted=[...entries].sort((a,b)=>compareText(a.path,b.path));
  if(sorted.some(entry=>entry.kind!=="directory"))invalid("Initialization requires an absent or empty intent/ tree; existing files and unsupported entries are preserved","intent.initialize.populated");
  return sorted;
}
async function requireAbsent(source:SourceReader,path:string):Promise<void> {
  try {await source.read(path,4194304);}
  catch(error) {if((error as {code?:string}).code==="intent.source.missing"||(error as {code?:string}).code==="ENOENT")return;throw error;}
  invalid(`Initialization cannot replace existing content: ${path}`,"intent.initialize.populated");
}

/** Prepare ordinary-repository setup without touching implementation or existing Intent files. */
export async function proposeInitialization(source:SourceReader,request:InitializationRequest,options:{workspaceOptions?:WorkspaceOptions}={}):Promise<InitializationProposal> {
  const observation=createWorkspaceOperation(source);source=observation.source;
  const result:Omit<InitializationProposal,"proposed"> & {proposed:WorkspaceInspection|null}={schema:"intent.initialization-proposal.v1",fileProposal:null,proposed:null,diagnostics:[],scope:{implementationRoots:structuredClone(request.implementationRoots),governedArtifacts:null,
    claim:request.implementationRoots.length?(options.workspaceOptions?.reconcileImplementation?"Only caller-selected implementation roots will be examined. Draft templates do not establish current Description ownership or adequate explanation.":"Implementation roots are declared but not examined. Request implementation reconciliation to inspect their Description coverage."):"No implementation roots were selected. This setup makes no claim about repository implementation coverage."},complete:false,
    limitations:["Initialization proposes local Intent carriers only; applying the file proposal is a separate effect.","Templates contain explicit proposed placeholders. They do not infer Product promises, inspect implementation meaning, execute Checks, publish Disciplines, or adopt a Pack.","Sources and relationships require deliberate authored content and can be edited through a reviewed raw-text file proposal."]};
  try {
    const initialEntries=checkedIntentEntries(await source.list("intent"));
    const original=await readWorkspace(source,options.workspaceOptions);
    if(original.stages.find(stage=>stage.name==="source-basis")?.complete!==true)invalid("Cannot prepare initialization from an incomplete source observation","intent.initialize.source-incomplete");
    const config:ProjectConfig={schema:"intent.project.v1",name:request.name,owners:structuredClone(request.owners),implementationRoots:structuredClone(request.implementationRoots),exemptions:[],...(request.description!==undefined?{description:request.description}:{})};
    result.diagnostics.push(...validateSchema("project",config as unknown as Json,"intent/project.json"));
    if(result.diagnostics.some(issue=>issue.severity==="error"))return {...result,proposed:result.proposed?summarizeWorkspace(result.proposed):null};
    for(const root of config.implementationRoots) {normalizedPath(root,true);if(["intent","tmp",".git"].some(reserved=>containsPath(reserved,root)))invalid(`Implementation root ${root} is reserved material`,"intent.initialize.root");}
    if((request.templates?.length??0)>4091)invalid("Initialization supports at most 4091 selected templates","intent.initialize.limit");
    const changes:FileChange[]=[
      {path:"intent/project.json",before:null,after:JSON.stringify(config,null,2)+"\n"},
      {path:"intent/disciplines/registry.json",before:null,after:JSON.stringify({schema:"intent.discipline-registry.v1",packs:[],adoptions:[],workTypes:[]},null,2)+"\n"},
    ];
    let context=emptyContext();
    const ids=new Set<string>();
    for(const template of request.templates??[]) {
      if((template.kind as Kind)==="discipline")invalid("Discipline templates belong in a publisher Pack and require explicit adoption after publication","intent.initialize.discipline");
      if(ids.has(template.id))invalid(`Duplicate template ID ${template.id}`,"intent.initialize.duplicate");ids.add(template.id);
      const created=createRecordTemplate(template.kind,{...template,owners:template.owners??config.owners});
      const sourceText=created.sourceText;
      const inspected=inspectRecord(sourceText,{path:template.path,context:created.context});
      if(!inspected.valid) {result.diagnostics.push(...inspected.diagnostics);return {...result,proposed:result.proposed?summarizeWorkspace(result.proposed):null};}
      if(inspected.record!.header.owners.some(owner=>!config.owners.includes(owner)))invalid("Template owners must be declared in the proposed project","intent.initialize.owner");
      context=mergeRecordContext(context,created.context,inspected.record!.header);
      changes.push({path:template.path,before:null,after:sourceText});
    }
    changes.push({path:"intent/catalog.json",before:null,after:JSON.stringify(context.catalog,null,2)+"\n"},{path:"intent/connections.json",before:null,after:JSON.stringify(context.connections,null,2)+"\n"});
    for(const change of changes)await requireAbsent(source,change.path);
    const sourceBasis=original.sourceBasis.id;
    const fileProposal=proposeFiles(sourceBasis,changes);
    result.proposed=await readWorkspace(observation.overlay(changes),options.workspaceOptions);
    result.scope.governedArtifacts=result.proposed.coverage?.artifacts.length??null;
    if(result.proposed.stages.find(stage=>stage.name==="source-basis")?.valid!==true)invalid("Cannot prepare initialization from a changing or incomplete source observation","intent.initialize.source-incomplete");
    await observation.verify();
    result.fileProposal=proposeFiles(sourceBasis,changes,{proposedBasis:result.proposed.sourceBasis.id});result.complete=true;
    if(!config.implementationRoots.length)result.diagnostics.push({code:"intent.initialize.empty-scope",severity:"info",stage:"initialization",path:"intent/project.json",message:result.scope.claim});
    else if(result.scope.governedArtifacts===0)result.diagnostics.push({code:"intent.initialize.empty-selection",severity:"warning",stage:"initialization",path:"intent/project.json",message:"Selected implementation roots contained no governed regular artifacts in this observation; no implementation explanation is established."});
    return {...result,proposed:result.proposed?summarizeWorkspace(result.proposed):null};
  }catch(error){result.diagnostics.push(diagnostic(error,"intent","initialization"));return {...result,proposed:result.proposed?summarizeWorkspace(result.proposed):null};}
}
