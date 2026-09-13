import { posix } from "node:path";
import { containsPath, compareText, digest, digestJson, diagnostic, IntentError, limitsFor, normalizedPath, orderedDiagnostics, scalarString } from "./foundation.js";
import { parseStrictJson } from "./strict-json.js";
import { validateSchema } from "./schemas.js";
import { BODY_SECTIONS, readDocument } from "./document.js";
import { assembleHeader, canonicalContext, inspectGlobalContext, projectRecordContext } from "./globals.js";
import type { Diagnostic, Header, Json, Kind, Limits, LocalHeader, RecordContext, RecordInspection, KnowledgeRecord } from "./types.js";

export { BODY_SECTIONS } from "./document.js";
const ROOTS: Record<string,Kind>={behavior:"behavior",assurance:"assurance",blueprint:"blueprint",description:"description",checks:"check",disciplines:"discipline"};
export function recordKindAt(path:string): Kind | null {
  const parts=path.split("/");
  if(parts[0]!=="intent" || parts.length<3 || !path.endsWith(".md")) return null;
  const kind=ROOTS[parts[1]!]??null;
  if(kind === "description" && !/^_.+\.desc\.md$/.test(posix.basename(path))) return null;
  return kind;
}
function setBy<T>(values:T[],key:(value:T)=>string,label:string):T[] {
  const seen=new Set<string>();
  for(const value of values) { const id=key(value); if(seen.has(id)) throw new IntentError("intent.record.duplicate",`Duplicate ${label}: ${id}`);seen.add(id); }
  return [...values].sort((a,b)=>compareText(key(a),key(b)));
}
export function canonicalHeader(header:Header): Json {
  const value=structuredClone(header);
  value.owners=setBy(value.owners,v=>v,"owner");
  value.tags=setBy(value.tags,v=>v,"tag");
  value.sources=setBy(value.sources,v=>v.id,"source id");
  value.relationships=setBy(value.relationships,v=>`${v.type}\0${v.target}`,"relationship");
  value.conflicts=setBy(value.conflicts,v=>`${v.type}\0${v.target}\0${v.localFact}\0${v.targetFact}`,"conflict");
  if(value.kind === "description") {
    value.coverage=setBy(value.coverage!,v=>`${v.mode}\0${v.path}`,"coverage selector").map(selector=>selector.exclude?{...selector,exclude:setBy(selector.exclude,v=>v,"exclusion")}:selector);
  }
  if(value.kind === "check") {
    value.evidenceKinds=setBy(value.evidenceKinds!,v=>v,"evidenceKinds");
    value.subjects=setBy(value.subjects!,v=>`${v.kind}\0${v.selector}`,"Check subject");
  }
  return value as unknown as Json;
}
export interface RecordInspectionOptions {path?:string;limits?:Partial<Limits>;location?:"repository"|"pack"|"unplaced";context?:RecordContext}
/** Inspect a document's identity without inventing its collection metadata. */
export function readLocalHeader(input:string|Uint8Array,options:{limits?:Partial<Limits>}={}):LocalHeader {
  const limits=limitsFor(options.limits),bytes=typeof input==="string"?Buffer.from(input):input;
  if(typeof input==="string")scalarString(input);
  if(bytes.byteLength>limits.maxRecordBytes)throw new IntentError("intent.limit.record-bytes",`Record exceeds ${limits.maxRecordBytes} bytes`);
  if(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)throw new IntentError("intent.record.bom","Knowledge must not start with a byte-order mark");
  let text:string;try{text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw new IntentError("intent.record.utf8","Knowledge is not valid UTF-8");}
  if(text.includes("\0"))throw new IntentError("intent.record.nul","Knowledge must not contain NUL");
  if(/\r(?!\n)/.test(text))throw new IntentError("intent.record.line-ending","Use LF or CRLF line endings");
  const frame=/^---\r?\n([\s\S]*?)^---\r?\n/m.exec(text);
  if(!frame||frame.index!==0)throw new IntentError("intent.record.front-matter","Knowledge requires exact opening and closing delimiter lines");
  const value=parseStrictJson(frame[1]!,{maxBytes:limits.maxFrontMatterBytes,maxDepth:limits.maxJsonDepth,maxNodes:limits.maxJsonNodes});
  const errors=validateSchema("knowledge-record",value);
  if(errors.length)throw new IntentError("intent.schema.invalid",errors.map(issue=>issue.message).join("; "),{pointer:errors[0]!.pointer!});
  const local=value as unknown as LocalHeader;
  return local;
}
/** Read identities even when a document's body cannot be assembled. */
export function recordDeclarations(inspections:readonly RecordInspection[],limits:Partial<Limits>):{id:string;path:string}[] {
  return inspections.flatMap(inspection=>{
    if(inspection.identity)return [{id:inspection.identity.id,path:inspection.path}];
    if(inspection.raw===null)return [];
    try{return [{id:readLocalHeader(inspection.raw,{limits}).id,path:inspection.path}];}catch{return [];}
  });
}
export function ambiguousRecordIds(inspections:readonly RecordInspection[],limits:Partial<Limits>):Set<string> {
  const seen=new Set<string>(),ambiguous=new Set<string>();
  for(const {id} of recordDeclarations(inspections,limits)){if(seen.has(id))ambiguous.add(id);else seen.add(id);}
  return ambiguous;
}
/** Validate independently checkable document syntax. This does not assemble a
 * KnowledgeRecord, resolve connections or establish a semantic fingerprint. */
export function validateLocalRecord(input:string|Uint8Array,options:{path?:string;limits?:Partial<Limits>}={}):Diagnostic[] {
  const path=options.path??"";
  try{
    const local=readLocalHeader(input,options),text=typeof input==="string"?input:new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(input);
    const frame=/^---\r?\n([\s\S]*?)^---\r?\n/m.exec(text)!,body=text.slice(frame[0].length),offset=frame[0].split("\n").length-1;
    const meaning=readDocument(body,local as Header,offset,undefined,true);
    return [...validateSchema(`urn:intent:schema:reader-results:v1#/$defs/${local.kind}Meaning`,meaning.spec,path),...validateSchema("urn:intent:schema:common:v1#/$defs/line",meaning.title,path),...validateSchema("urn:intent:schema:common:v1#/$defs/text",meaning.summary,path)];
  }catch(error){return [diagnostic(error,path,"local-document")];}
}
export function inspectRecord(input:string|Uint8Array,options:RecordInspectionOptions={}):RecordInspection {
  const path=options.path??"";
  const result:RecordInspection={path,identity:null,raw:null,record:null,valid:false,complete:true,diagnostics:[]};
  let stage="framing";
  try {
    const limits=limitsFor(options.limits);
    if(typeof input === "string") scalarString(input);
    const bytes=typeof input === "string"?Buffer.from(input):input;
    if(bytes.byteLength>limits.maxRecordBytes) throw new IntentError("intent.limit.record-bytes",`Record exceeds ${limits.maxRecordBytes} bytes`);
    if(bytes[0]===0xef && bytes[1]===0xbb && bytes[2]===0xbf) throw new IntentError("intent.record.bom","Knowledge must not start with a byte-order mark");
    let text:string;
    try {text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes);} catch {throw new IntentError("intent.record.utf8","Knowledge is not valid UTF-8");}
    result.raw=text;
    if(text.includes("\0"))throw new IntentError("intent.record.nul","Knowledge must not contain NUL");
    if(/\r(?!\n)/.test(text)) throw new IntentError("intent.record.line-ending","Use LF or CRLF line endings");
    const first=/^---\r?\n/.exec(text);
    if(!first) throw new IntentError("intent.record.front-matter","Knowledge must start with an exact --- delimiter line",{line:1});
    const rest=text.slice(first[0].length);
    const end=/^---(?:\r?\n|$)/m.exec(rest);
    if(!end || !end[0].endsWith("\n")) throw new IntentError("intent.record.front-matter","Missing closing delimiter followed by a body");
    const front=rest.slice(0,end.index);
    stage="json";
    const value=parseStrictJson(front,{maxBytes:limits.maxFrontMatterBytes,maxDepth:limits.maxJsonDepth,maxNodes:limits.maxJsonNodes});
    stage="schema";
    result.diagnostics.push(...validateSchema("knowledge-record",value,path));
    if(result.diagnostics.length) return result;
    result.identity=value as unknown as LocalHeader;
    let context:RecordContext|undefined;
    {
      stage="globals";
      if(!options.context){result.complete=false;result.diagnostics.push(...validateLocalRecord(input,{path,limits}));throw new IntentError("intent.record.context-required","Supply catalog.json and connections.json context to inspect complete format 2 Knowledge");}
      const issues=inspectGlobalContext(options.context,"intent",limits);result.diagnostics.push(...issues);
      if(issues.length){result.complete=!issues.some(issue=>issue.code.startsWith("intent.limit."));return result;}
      context=projectRecordContext(options.context,value as unknown as LocalHeader);
    }
    const header=assembleHeader(value as unknown as LocalHeader,context!);
    stage="record";
    if(options.location!=="unplaced") {
      normalizedPath(path,false,limits.maxPathBytes);
      if(options.location === "pack") {
        if(header.kind!=="discipline" || !path.startsWith("records/") || !path.endsWith(".md")) throw new IntentError("intent.record.location","Pack records must be Discipline Markdown under records/");
      } else if(recordKindAt(path)!==header.kind) throw new IntentError("intent.record.location",`Record kind ${header.kind} does not match its Intent location`);
    }
    if(header.kind === "description") {
      for(const selector of header.coverage!) {
        normalizedPath(selector.path,selector.mode === "tree",limits.maxPathBytes);
        for(const exclude of selector.exclude??[]) {
          normalizedPath(exclude,false,limits.maxPathBytes);
          if(!containsPath(selector.path,exclude)||exclude===selector.path) throw new IntentError("intent.coverage.exclusion","Tree exclusions must be exact descendants");
        }
      }
    }
    canonicalHeader(header);
    const body=rest.slice(end.index+end[0].length);
    if(!body.trim()) throw new IntentError("intent.record.body-empty","Knowledge must contain a nonempty Markdown body");
    const normalizedBody=body.replace(/\r\n/g,"\n");
    const bodyOffset=text.slice(0,text.length-body.length).split("\n").length-1;
    {
      stage="meaning";
      const meaning=readDocument(body,header,bodyOffset,context);
      result.diagnostics.push(...validateSchema(`urn:intent:schema:reader-results:v1#/$defs/${header.kind}Spec`,meaning.spec,path));
      result.diagnostics.push(...validateSchema("urn:intent:schema:common:v1#/$defs/line",meaning.title,path));
      result.diagnostics.push(...validateSchema("urn:intent:schema:common:v1#/$defs/text",meaning.summary,path));
      result.diagnostics.push(...validateSchema("urn:intent:schema:reader-results:v1#/$defs/recordDocument",{body,...meaning},path));
      if(result.diagnostics.length)return result;
      result.record={path,header,sourceText:text,title:meaning.title,summary:meaning.summary,...(context?{authoredHeader:value as unknown as LocalHeader,context}:{}),sourceDigest:digest(bytes),semanticDigest:digestJson({body:normalizedBody,frontMatter:value,context:canonicalContext(context!)})};
      result.diagnostics.push(...validateSchema("urn:intent:schema:reader-results:v1#/$defs/record",result.record as unknown as Json,path));
      if(result.diagnostics.length){result.record=null;return result;}
      documents.set(result.record,{key:documentKey(result.record),value:{body,...meaning}});
      result.raw=null;
      result.valid=true;
      return result;
    }
  } catch(error) {
    const issue=diagnostic(error,path,stage);
    if(stage==="globals"&&/^\/(catalog|connections)\//.test(issue.pointer??"")){
      const [,owner,...parts]=issue.pointer!.split("/");issue.path=`${options.location==="pack"?"":"intent/"}${owner}.json`;issue.pointer=`/${parts.join("/")}`;
    }
    result.diagnostics.push(issue);
    if(issue.code.startsWith("intent.limit.")) result.complete=false;
  }
  result.diagnostics=orderedDiagnostics(result.diagnostics);
  return result;
}

export type RecordDocument = ReturnType<typeof readDocument> & {body:string};
const documents = new WeakMap<KnowledgeRecord,{key:string;value:RecordDocument}>();
const documentKey=(record:KnowledgeRecord)=>JSON.stringify([record.sourceText,record.header,record.context]);
/** Preserve operation-local parsing when detaching a validated inspection. */
export function cloneRecordInspection(inspection:RecordInspection):RecordInspection {
  const cloned=structuredClone(inspection);
  if(inspection.record&&cloned.record){
    const cached=documents.get(inspection.record);
    if(cached?.key===documentKey(inspection.record))documents.set(cloned.record,cached);
  }
  return cloned;
}
/** Request a detached structured document view. The canonical record owns source once. */
export function readRecordDocument(record:KnowledgeRecord):RecordDocument {
  const key=documentKey(record),cached=documents.get(record);
  if(cached?.key===key)return structuredClone(cached.value);
  const frame=/^---\r?\n([\s\S]*?)^---\r?\n/m.exec(record.sourceText);
  if(!frame||frame.index!==0)throw new IntentError("intent.record.front-matter","Knowledge requires framed Markdown source");
  const body=record.sourceText.slice(frame[0].length),offset=frame[0].split("\n").length-1;
  const value={body,...readDocument(body,record.header,offset,record.context)};
  documents.set(record,{key,value});
  return structuredClone(value);
}
/** Include excluded parsed occurrences only for explicit diagnostic/path reading. */
export function inspectedRecords(workspace:{records:KnowledgeRecord[];inspections:RecordInspection[]}):KnowledgeRecord[] {
  return [...workspace.records,...workspace.inspections.flatMap(item=>item.record?[item.record]:[])];
}
