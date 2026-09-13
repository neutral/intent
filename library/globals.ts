import { canonicalJson, compareText, diagnostic, IntentError, limitsFor, orderedDiagnostics, scalarString } from "./foundation.js";
import { validateSchema } from "./schemas.js";
import type { Catalog, Connections, ConnectionKind, Diagnostic, Header, Json, Limits, LocalHeader, RecordContext } from "./types.js";

export const CONNECTION_KINDS:readonly ConnectionKind[]=["relationships","conflicts","sourceUses","coverage","checkSelections"];
export const recordCoordinate=(value:string|{id:string}):string=>typeof value==="string"?value:value.id;
const sameOwner=(a:string|{id:string},b:string|{id:string})=>recordCoordinate(a)===recordCoordinate(b);
export function emptyContext():RecordContext {
  return {catalog:{schema:"intent.catalog.v1",sources:[],records:[]},connections:{schema:"intent.connections.v1",relationships:[],conflicts:[],sourceUses:[],coverage:[],checkSelections:[]}};
}
function issue(code:string,message:string,path:string,pointer:string):Diagnostic{return {code:code==="limit"?"intent.limit.globals":`intent.globals.${code}`,message,path,pointer,severity:"error",stage:"globals"};}
/** Match the strict byte reader's JSON domain before schema traversal or cloning. */
function boundedData(value:unknown,limits:Limits):void {
  const active=new Set<object>(),stack:{value:unknown;depth:number;exit?:boolean}[]=[{value,depth:1}];let nodes=0;
  while(stack.length){
    const entry=stack.pop()!,item=entry.value;
    if(entry.exit){active.delete(item as object);continue;}
    if(++nodes>limits.maxJsonNodes)throw new IntentError("intent.limit.json-nodes","Global JSON data exceeds the selected node limit");
    if(entry.depth>limits.maxJsonDepth)throw new IntentError("intent.limit.json-depth","Global JSON data exceeds the selected depth limit");
    if(item===null||typeof item==="boolean")continue;
    if(typeof item==="string"){scalarString(item);continue;}
    if(typeof item==="number"){if(!Number.isFinite(item)||(Number.isInteger(item)&&!Number.isSafeInteger(item)))throw new IntentError("intent.json.number","Global JSON number is outside the exact supported domain");continue;}
    if(typeof item!=="object"||(!Array.isArray(item)&&![null,Object.prototype].includes(Object.getPrototypeOf(item))))throw new IntentError("intent.json.type","Global inputs must contain ordinary JSON data");
    if(active.has(item))throw new IntentError("intent.json.cycle","Global JSON data cannot contain cycles");
    active.add(item);stack.push({value:item,depth:entry.depth,exit:true});
    const descriptors=Object.getOwnPropertyDescriptors(item),keys=Reflect.ownKeys(descriptors);
    for(const key of keys){
      if(typeof key!=="string")throw new IntentError("intent.json.type","Global JSON data cannot contain symbol properties");
      scalarString(key);const descriptor=descriptors[key]!;
      if(Array.isArray(item)&&key==="length")continue;
      if(!Object.hasOwn(descriptor,"value")||!descriptor.enumerable)throw new IntentError("intent.json.type","Global JSON data cannot contain accessors or hidden properties");
      if(Array.isArray(item)&&(!/^(?:0|[1-9][0-9]*)$/.test(key)||Number(key)>=item.length))throw new IntentError("intent.json.type","Global JSON arrays cannot contain named properties");
      stack.push({value:descriptor.value,depth:entry.depth+1});
    }
    if(Array.isArray(item)&&keys.length!==item.length+1)throw new IntentError("intent.json.type","Global JSON arrays cannot contain holes");
  }
  if(Buffer.byteLength(JSON.stringify(value))>limits.maxSourceBytes)throw new IntentError("intent.limit.json-bytes","Global JSON data exceeds the selected source byte limit");
}
/** Validate supplied JSON data. Readers must also enforce strict source framing. */
export function inspectGlobalContext(context:RecordContext,pathPrefix="intent",selectedLimits:Partial<Limits>={}):Diagnostic[] {
  const limits=limitsFor(selectedLimits),path=(name:string)=>pathPrefix?`${pathPrefix}/${name}.json`:`${name}.json`;
  if(!context||typeof context!=="object"||![null,Object.prototype].includes(Object.getPrototypeOf(context)))return [issue("context","Supply an ordinary catalog and connections context",pathPrefix,"")];
  const fields=Object.getOwnPropertyDescriptors(context);
  if(Reflect.ownKeys(fields).some(key=>typeof key!=="string"||!["catalog","connections"].includes(key))||Object.values(fields).some(field=>!Object.hasOwn(field,"value")||!field.enumerable))return [issue("context","Context contains only ordinary catalog and connections data fields",pathPrefix,"")];
  const preflight:Diagnostic[]=[];
  for(const name of ["catalog","connections"] as const)try{boundedData(fields[name]?.value,limits);}catch(error){preflight.push(diagnostic(error,path(name),"globals"));}
  if(preflight.length)return orderedDiagnostics(preflight);
  const diagnostics=[...validateSchema("catalog",context?.catalog,path("catalog")),...validateSchema("connections",context?.connections,path("connections"))];
  if(diagnostics.length)return diagnostics;
  if(context.catalog.records.length>limits.maxRecords||context.catalog.sources.length>limits.maxSources)diagnostics.push(issue("limit","Global registrations exceed the selected record/source bound",path("catalog"),""));
  const unique=(values:readonly unknown[],key:(value:any)=>string,where:string,pointer:string)=>{
    const seen=new Set<string>();for(const [index,value]of values.entries()){const id=key(value);if(seen.has(id))diagnostics.push(issue("duplicate",`Duplicate global identity: ${id}`,where,`${pointer}/${index}`));seen.add(id);}
  };
  unique(context.catalog.sources,v=>v.id,path("catalog"),"/sources");
  unique(context.catalog.records,v=>recordCoordinate(v.record),path("catalog"),"/records");
  const ids=new Set<string>(),sources=new Set(context.catalog.sources.map(source=>source.id));
  let count=0;
  for(const kind of CONNECTION_KINDS){
    count+=context.connections[kind].length;
    const semantic=new Set<string>();
    for(const [index,connection]of context.connections[kind].entries()){
      const owner=recordCoordinate(connection.record),key=`${owner}\0${connection.id}`,pointer=`/${kind}/${index}`;
      if(ids.has(key))diagnostics.push(issue("connection-id",`Connection ${connection.id} is repeated for ${owner}`,path("connections"),`${pointer}/id`));ids.add(key);
      const item=connection as unknown as Record<string,Json>;
      const semanticKey=kind==="relationships"?`${item.type}\0${item.target}`:kind==="conflicts"?`${item.type}\0${item.target}\0${item.localFact}\0${item.targetFact}`:kind==="sourceUses"?String(item.source):kind==="coverage"?`${item.mode}\0${item.path}`:"selection";
      const scoped=`${owner}\0${semanticKey}`;
      if(semantic.has(scoped))diagnostics.push(issue("duplicate",`Duplicate ${kind} declaration for ${owner}`,path("connections"),pointer));semantic.add(scoped);
      if(kind==="sourceUses"&&!sources.has(String(item.source)))diagnostics.push(issue("source-missing",`Source ${item.source} is not registered in catalog.json`,path("connections"),`${pointer}/source`));
      if(kind==="coverage"&&!connection.record.startsWith("description."))diagnostics.push(issue("kind","Coverage belongs only to a Description",path("connections"),`${pointer}/record`));
      if(kind==="checkSelections"&&!connection.record.startsWith("check."))diagnostics.push(issue("kind","Check selection belongs only to a Check",path("connections"),`${pointer}/record`));
    }
  }
  if(count>limits.maxGraphEdges)diagnostics.push(issue("limit","Global connection count exceeds the selected edge bound",path("connections"),""));
  return orderedDiagnostics(diagnostics);
}
/** One pass over the global files; no path inventory, cache or mutable memoization. */
export function indexRecordContexts(context:RecordContext):Map<string,RecordContext> {
  const index=new Map<string,RecordContext>();
  const get=(owner:string)=>{const key=recordCoordinate(owner);let selected=index.get(key);if(!selected){selected=emptyContext();index.set(key,selected);}return selected;};
  for(const registration of context.catalog.records)get(registration.record).catalog.records.push(structuredClone(registration));
  for(const kind of CONNECTION_KINDS)for(const connection of context.connections[kind]){
    (get(connection.record).connections[kind] as unknown[]).push(structuredClone(connection));
  }
  const users=new Map<string,RecordContext[]>();
  for(const selected of index.values()){
    const ids=new Set(selected.connections.sourceUses.map(use=>use.source));
    for(const id of ids){const selectedUsers=users.get(id)??[];selectedUsers.push(selected);users.set(id,selectedUsers);}
  }
  for(const source of context.catalog.sources)for(const selected of users.get(source.id)??[])selected.catalog.sources.push(structuredClone(source));
  return index;
}
export function projectRecordContext(context:RecordContext,coordinate:string|{id:string}):RecordContext {
  // Select first, but preserve duplicate declarations so assembly rejects them.
  const selected=emptyContext();
  selected.catalog.records=structuredClone(context.catalog.records.filter(item=>sameOwner(item.record,coordinate)));
  for(const kind of CONNECTION_KINDS)(selected.connections[kind] as unknown[])=structuredClone(context.connections[kind].filter(item=>sameOwner(item.record,coordinate)));
  const sources=new Set(selected.connections.sourceUses.map(use=>use.source));
  selected.catalog.sources=structuredClone(context.catalog.sources.filter(source=>sources.has(source.id)));
  return selected;
}
export function validateGlobalOwners(context:RecordContext,coordinates:readonly string[],pathPrefix="intent"):Diagnostic[] {
  const owners=new Set(coordinates.map(recordCoordinate)),diagnostics:Diagnostic[]=[];
  const path=(name:string)=>pathPrefix?`${pathPrefix}/${name}.json`:`${name}.json`;
  for(const [index,item]of context.catalog.records.entries())if(!owners.has(recordCoordinate(item.record)))diagnostics.push(issue("owner-missing",`No document declares ${recordCoordinate(item.record)}`,path("catalog"),`/records/${index}/record`));
  for(const kind of CONNECTION_KINDS)for(const [index,item]of context.connections[kind].entries())if(!owners.has(recordCoordinate(item.record)))diagnostics.push(issue("owner-missing",`No document declares ${recordCoordinate(item.record)}`,path("connections"),`/${kind}/${index}/record`));
  return orderedDiagnostics(diagnostics);
}
export function assembleHeader(local:LocalHeader,context:RecordContext):Header {
  const selected=projectRecordContext(context,local),registration=selected.catalog.records;
  const invalid=inspectGlobalContext(selected);
  if(invalid.length)throw new IntentError(invalid[0]!.code,invalid[0]!.message,{pointer:invalid[0]!.pointer!});
  if(registration.length!==1)throw new IntentError("intent.globals.registration",`Declare exactly one catalog registration for ${recordCoordinate(local)}`,{pointer:"/catalog/records"});
  const {record:_record,owners,tags,...extensions}=registration[0]!;
  const withoutOwner=<T extends {record:string;id:string}>(item:T)=>{const {record:_owner,id:_id,...fields}=item;return fields;};
  const header:Header={...local,owners:structuredClone(owners),tags:structuredClone(tags),...extensions,
    sources:selected.connections.sourceUses.map(use=>({id:use.source,reference:selected.catalog.sources.find(source=>source.id===use.source)!.reference,required:use.required,revision:use.revision,role:use.role})),
    relationships:selected.connections.relationships.map(withoutOwner),conflicts:selected.connections.conflicts.map(withoutOwner)};
  if(local.kind==="description")header.coverage=selected.connections.coverage.map(withoutOwner);
  if(local.kind==="check"){
    if(selected.connections.checkSelections.length!==1)throw new IntentError("intent.globals.check-selection",`Declare exactly one Check selection for ${recordCoordinate(local)}`,{pointer:"/connections/checkSelections"});
    const selection=selected.connections.checkSelections[0]!;header.subjects=structuredClone(selection.subjects);header.evidenceKinds=structuredClone(selection.evidenceKinds);
  }
  const errors=validateSchema("assembled-header",header);
  if(errors.length){
    const field=errors[0]!.pointer?.split("/")[1]??"",array=field==="sources"?"sourceUses":["subjects","evidenceKinds"].includes(field)?"checkSelections":field;
    const pointer=["sourceUses","relationships","conflicts","coverage","checkSelections"].includes(array)?`/connections/${array}`:"/catalog/records";
    throw new IntentError("intent.globals.metadata",`Invalid assembled metadata for ${recordCoordinate(local)}: ${errors.map(error=>error.message).join("; ")}`,{pointer});
  }
  return header;
}
/** Set normalization is explicit; extensions preserve their own array order. */
export function canonicalContext(context:RecordContext):Json {
  const value=structuredClone(context);
  const sort=<T>(items:T[],key:(item:T)=>string)=>items.sort((a,b)=>compareText(key(a),key(b)));
  sort(value.catalog.sources,item=>item.id);sort(value.catalog.records,item=>recordCoordinate(item.record));
  for(const item of value.catalog.records){sort(item.owners,String);sort(item.tags,String);}
  for(const kind of CONNECTION_KINDS)sort(value.connections[kind] as {record:string;id:string}[],item=>`${recordCoordinate(item.record)}\0${item.id}`);
  for(const item of value.connections.coverage)if(item.exclude)sort(item.exclude,String);
  for(const item of value.connections.checkSelections){sort(item.subjects,subject=>`${subject.kind}\0${subject.selector}`);sort(item.evidenceKinds,String);}
  return value as unknown as Json;
}
/** Build explicit authoring context from a current assembled header. */
export function contextForHeader(header:Header):RecordContext {
  const value=emptyContext(),record=header.id,used=new Set<string>();
  const id=(label:string)=>{let stem=label.toLowerCase().replace(/[^a-z0-9.-]+/g,"-").replace(/[.-]{2,}/g,"-").replace(/^[.-]|[.-]$/g,"").slice(0,140).replace(/[.-]$/g,"")||"connection",selected=stem,suffix=2;while(used.has(selected))selected=`${stem}-${suffix++}`;used.add(selected);return selected;};
  value.catalog.records.push({record,owners:structuredClone(header.owners),tags:structuredClone(header.tags),...Object.fromEntries(Object.entries(header).filter(([key])=>key.startsWith("x-")))});
  for(const source of header.sources){value.catalog.sources.push({id:source.id,reference:source.reference});value.connections.sourceUses.push({id:id(`source-${source.id}`),record,source:source.id,required:source.required,revision:source.revision,role:source.role});}
  for(const edge of header.relationships)value.connections.relationships.push({id:id(`${edge.type}-${edge.target}`),record,...structuredClone(edge)});
  for(const conflict of header.conflicts)value.connections.conflicts.push({id:id(`${conflict.type}-${conflict.target}-${conflict.localFact}`),record,...structuredClone(conflict)});
  for(const selector of header.coverage??[])value.connections.coverage.push({id:id(`coverage-${selector.mode}-${selector.path}`),record,...structuredClone(selector)});
  if(header.kind==="check")value.connections.checkSelections.push({id:id("check-selection"),record,subjects:structuredClone(header.subjects??[]),evidenceKinds:structuredClone(header.evidenceKinds??[])});
  return value;
}
/** Replace one occurrence only; shared definitions are never silently pruned. */
export function mergeRecordContext(base:RecordContext,replacement:RecordContext,coordinate:string|{id:string}):RecordContext {
  for(const context of [base,replacement]){const issues=inspectGlobalContext(context);if(issues.length)throw new IntentError(issues[0]!.code,issues[0]!.message);}
  if(replacement.catalog.records.some(item=>!sameOwner(item.record,coordinate))||CONNECTION_KINDS.some(kind=>replacement.connections[kind].some(item=>!sameOwner(item.record,coordinate))))throw new IntentError("intent.globals.scope","Replacement context must select only the requested record coordinate");
  const result=structuredClone(base);
  const replace=<T extends {record:string}>(original:T[],next:T[]):T[]=>{
    let cursor=0;const result:T[]=[];
    for(const item of original){if(!sameOwner(item.record,coordinate))result.push(item);else if(cursor<next.length)result.push(structuredClone(next[cursor++]!));}
    result.push(...structuredClone(next.slice(cursor)));return result;
  };
  result.catalog.records=replace(result.catalog.records,replacement.catalog.records);
  for(const kind of CONNECTION_KINDS)(result.connections[kind] as {record:string}[])=replace<{record:string}>(result.connections[kind],replacement.connections[kind]);
  for(const source of replacement.catalog.sources){const previous=result.catalog.sources.find(item=>item.id===source.id);if(previous&&canonicalJson(previous)!==canonicalJson(source))throw new IntentError("intent.globals.source-conflict",`Source ${source.id} already has a different shared definition; review an explicit catalog change`);if(!previous)result.catalog.sources.push(structuredClone(source));}
  return result;
}
