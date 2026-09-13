import { summarizeRecord, type RecordSummary } from "./projections.js";
import { readRecordDocument } from "./records.js";
import { compareText, digestJson, IntentError, orderedDiagnostics } from "./foundation.js";
import type { Diagnostic, Json, Kind, KnowledgeRecord, Status } from "./types.js";
import type { WorkspaceInspection } from "./workspace.js";
import { ambiguousRecordIds } from "./records.js";

export interface Query {text?:string;kinds?:Kind[];statuses?:Status[];tags?:string[];owners?:string[];limit?:number;cursor?:string}
export interface QueryPage {basis:string;records:RecordSummary[];total:number;nextCursor:string|null;complete:boolean}
export function queryKnowledge(workspace:WorkspaceInspection,query:Query={}):QueryPage {
  const {cursor,...parameters}=query,limit=query.limit??50;
  if(!Number.isInteger(limit)||limit<1||limit>256) throw new IntentError("intent.query.limit","Page size must be between 1 and 256");
  const key=digestJson(parameters as unknown as Json);let offset=0;
  if(cursor){
    let value:{basis:string;key:string;offset:number};
    try{value=JSON.parse(Buffer.from(cursor,"base64url").toString("utf8"));}catch{throw new IntentError("intent.query.cursor","Malformed cursor");}
    if(value.basis!==workspace.sourceBasis.id||value.key!==key||!Number.isSafeInteger(value.offset)||value.offset<0) throw new IntentError("intent.query.cursor","Cursor belongs to a different observation or query");
    offset=value.offset;
  }
  const text=query.text?.toLocaleLowerCase("en-US"),ambiguous=ambiguousRecordIds(workspace.inspections,workspace.limits);
  const all=workspace.records.filter(record=>{const {header,title,summary,sourceText}=record;return !ambiguous.has(header.id)&&(!query.kinds||query.kinds.includes(header.kind))&&(!query.statuses||query.statuses.includes(header.status))&&(!query.tags||query.tags.every(tag=>header.tags.includes(tag)))&&(!query.owners||query.owners.every(owner=>header.owners.includes(owner)))&&(!text||`${header.id}\n${title}\n${summary}\n${sourceText}`.toLocaleLowerCase("en-US").includes(text));})
    .sort((a,b)=>compareText(a.header.id,b.header.id)||compareText(a.path,b.path));
  const next=offset+limit<all.length?Buffer.from(JSON.stringify({basis:workspace.sourceBasis.id,key,offset:offset+limit})).toString("base64url"):null;
  return {basis:workspace.sourceBasis.id,records:all.slice(offset,offset+limit).map(summarizeRecord),total:all.length,nextCursor:next,complete:!ambiguous.size&&workspace.stages.filter(s=>["discovery","globals","records"].includes(s.name)).every(s=>s.complete)};
}
export interface SelectionReason {id:string;reason:"root"|"required-outgoing"|"incoming-constraint"|"incoming-realization"|"optional-navigation";from:string|null;relationship:string|null}
export interface KnowledgeSelection {basis:string;roots:string[];records:KnowledgeRecord[];reasons:SelectionReason[];unresolved:string[];complete:boolean;limit:number;diagnostics:Diagnostic[];maxWork:number;workPerformed:number}
export function selectKnowledge(workspace:WorkspaceInspection,roots:string[],options:{limit?:number;includeRealizations?:boolean;includeOptional?:boolean}={}):KnowledgeSelection {
  const limit=options.limit??4096,maxWork=workspace.limits.maxGraphWork;
  if(!Number.isInteger(limit)||limit<1||limit>65536) throw new IntentError("intent.selection.limit","Selection limit must be 1 to 65536");
  if(roots.length>workspace.limits.maxRecords)throw new IntentError("intent.selection.roots",`Selection roots exceed ${workspace.limits.maxRecords}`);
  const current=new Map<string,KnowledgeRecord>(),duplicates=ambiguousRecordIds(workspace.inspections,workspace.limits);
  const reasons:SelectionReason[]=[],selected=new Set<string>(),unresolved=new Set<string>(),queue=[...new Set(roots)].sort(compareText),queued=new Set(queue),diagnostics:Diagnostic[]=[];
  let bounded=false,workPerformed=0,index=0;
  const STOP=Symbol("selection-bound");
  const visit=()=>{
    if(workPerformed>=maxWork){bounded=true;diagnostics.push({code:"intent.limit.selection-work",severity:"error",stage:"selection",path:"intent",message:`Selection work exceeds ${maxWork} item visits`});throw STOP;}
    workPerformed++;
  };
  for(const id of queue)reasons.push({id,reason:"root",from:null,relationship:null});
  try {
    for(const record of workspace.records) {
      visit();if(record.header.status==="current"){if(current.has(record.header.id))duplicates.add(record.header.id);else current.set(record.header.id,record);}
    }
    // One index pass replaces a complete graph scan for each selected record.
    const outgoing=new Map<string,typeof workspace.graph.edges>(),incoming=new Map<string,typeof workspace.graph.edges>();
    for(const edge of workspace.graph.edges) {
      visit();const from=outgoing.get(edge.source)??[],to=incoming.get(edge.target)??[];
      from.push(edge);to.push(edge);outgoing.set(edge.source,from);incoming.set(edge.target,to);
    }
    for(;index<queue.length;index++) {
      visit();const id=queue[index]!;if(selected.has(id))continue;
      if(!current.has(id)||duplicates.has(id)){unresolved.add(id);continue;}
      if(selected.size>=limit){bounded=true;unresolved.add(id);continue;}
      selected.add(id);
      const follow=(next:string,reason:SelectionReason["reason"],relationship:string)=>{
        reasons.push({id:next,reason,from:id,relationship});
        if(!queued.has(next)){queued.add(next);queue.push(next);}
      };
      for(const edge of outgoing.get(id)??[]) {
        visit();if(edge.required)follow(edge.target,"required-outgoing",edge.type);
        else if(options.includeOptional)follow(edge.target,"optional-navigation",edge.type);
      }
      for(const edge of incoming.get(id)??[]) {
        visit();if(edge.type==="constrains"&&edge.required)follow(edge.source,"incoming-constraint",edge.type);
        else if(edge.type==="realizes"&&options.includeRealizations)follow(edge.source,"incoming-realization",edge.type);
      }
    }
  } catch(error) {if(error!==STOP)throw error;for(const id of queue.slice(index))if(!selected.has(id))unresolved.add(id);}
  if(bounded&&!diagnostics.length)diagnostics.push({code:"intent.limit.selection-records",severity:"error",stage:"selection",path:"intent",message:`Selection reaches its ${limit}-record limit`});
  if(!workspace.graph.complete)diagnostics.push({code:"intent.selection.graph-incomplete",severity:"error",stage:"selection",path:"intent",message:"Required selection is incomplete because graph processing was bounded"});
  return {basis:workspace.sourceBasis.id,roots:[...new Set(roots)].sort(compareText),records:[...selected].sort(compareText).map(id=>current.get(id)!),reasons:reasons.sort((a,b)=>compareText(a.id,b.id)||compareText(a.reason,b.reason)||compareText(a.from??"",b.from??"")||compareText(a.relationship??"",b.relationship??"")),unresolved:[...unresolved].sort(compareText),complete:!bounded&&!unresolved.size&&workspace.graph.complete&&workspace.stages.filter(s=>["discovery","globals","records","identity-relationships"].includes(s.name)).every(s=>s.valid),limit,diagnostics:orderedDiagnostics(diagnostics),maxWork,workPerformed};
}
export function compareWorkspaces(before:WorkspaceInspection,after:WorkspaceInspection,options:{recordLimit?:number;recordByteLimit?:number}={}) {
  const recordLimit=options.recordLimit??256,recordByteLimit=options.recordByteLimit??8388608;
  if(!Number.isSafeInteger(recordByteLimit)||recordByteLimit<1||recordByteLimit>67108864)throw new IntentError("intent.comparison.limit","Comparison record byte limit must be 1 to 67108864");
  if(!Number.isSafeInteger(recordLimit)||recordLimit<1||recordLimit>4096)throw new IntentError("intent.comparison.limit","Comparison record limit must be 1 to 4096");
  const left=new Map(before.inventory.map(item=>[item.path,item.sourceDigest])),right=new Map(after.inventory.map(item=>[item.path,item.sourceDigest]));
  const changes=[...new Set([...left.keys(),...right.keys()])].sort(compareText).filter(path=>left.get(path)!==right.get(path)).map(path=>({path,change:!left.has(path)?"added" as const:!right.has(path)?"deleted" as const:"modified" as const,before:left.get(path)??null,after:right.get(path)??null}));
  const changedPaths=new Set(changes.map(c=>c.path)),affected=new Set<string>(),neighbors=new Map<string,Set<string>>();
  for(const workspace of [before,after]) {
    for(const record of workspace.records) if(changedPaths.has(record.path))affected.add(record.header.id);
    for(const artifact of workspace.coverage?.artifacts??[]) if(changedPaths.has(artifact.path))for(const owner of artifact.owners)affected.add(owner);
    if(changes.some(c=>["intent/project.json","intent/intent.json","intent/disciplines/registry.json"].includes(c.path))) for(const record of workspace.records) if(record.header.status==="current")affected.add(record.header.id);
    for(const edge of workspace.graph.edges)for(const [from,to]of [[edge.source,edge.target],[edge.target,edge.source]]){const adjacent=neighbors.get(from! )??new Set<string>();adjacent.add(to!);neighbors.set(from!,adjacent);}
  }
  const index=(workspace:WorkspaceInspection)=>{const result=new Map<string,KnowledgeRecord[]>();for(const record of workspace.records){const rows=result.get(record.header.id)??[];rows.push(record);result.set(record.header.id,rows);}for(const rows of result.values())rows.sort((a,b)=>compareText(a.path,b.path));return result;};
  const beforeRecords=index(before),afterRecords=index(after);
  const occurrences=(workspace:WorkspaceInspection,id:string)=>(workspace===before?beforeRecords:afterRecords).get(id)??[];
  const identity=(records:KnowledgeRecord[])=>JSON.stringify(records.map(record=>[record.path,record.sourceDigest,record.semanticDigest]));
  for(const id of new Set([...before.records,...after.records].map(record=>record.header.id)))if(identity(occurrences(before,id))!==identity(occurrences(after,id)))affected.add(id);
  const queue=[...affected];
  for(let i=0;i<queue.length;i++)for(const id of neighbors.get(queue[i]!)??[])if(!affected.has(id)){affected.add(id);queue.push(id);}
  const affectedIds=[...affected].sort(compareText);let recordBytes=0;
  const records: {id:string;changed:boolean;before:RecordSummary[];after:RecordSummary[]}[]=[];
  for(const id of affectedIds.slice(0,recordLimit)){
    const original=occurrences(before,id),proposed=occurrences(after,id);
    const row={id,changed:identity(original)!==identity(proposed),before:original.map(summarizeRecord),after:proposed.map(summarizeRecord)};
    const size=Buffer.byteLength(JSON.stringify(row));if(recordBytes+size>recordByteLimit)break;recordBytes+=size;records.push(row);
  }
  const context=(workspace:WorkspaceInspection)=>({config:workspace.config,coverage:workspace.coverage,diagnostics:workspace.diagnostics,complete:workspace.complete,valid:workspace.valid});
  return structuredClone({before:before.sourceBasis,after:after.sourceBasis,changes,affectedIds,records,recordTotal:affectedIds.length,recordLimit,recordByteLimit,recordBytes,context:{before:context(before),after:context(after)},complete:before.complete&&after.complete&&records.length===affectedIds.length,limitations:["Affected records include relationship neighbors; they are review candidates, not a judgment that authored meaning must change.","Only records and files examined by the two declared scopes are compared. A missing side can mean outside that scope.",...(records.length<affectedIds.length?[`Only ${records.length} of ${affectedIds.length} affected record identities include their metadata summaries, within ${recordLimit} identities and ${recordByteLimit} serialized bytes.`]:[])],interpretation:"Impact identifies candidates for examination; it does not decide whether prose must change."});
}
