import { readRecordDocument } from "./records.js";
import { compareText, limitsFor, orderedDiagnostics } from "./foundation.js";
import type { Diagnostic, Kind, KnowledgeRecord, Limits, Relationship } from "./types.js";

export interface GraphEdge extends Relationship { source:string; sourcePath:string; scope?:string|null; rationale?:string|null }
export interface KnowledgeGraph { edges:GraphEdge[]; components:string[][]; diagnostics:Diagnostic[]; complete:boolean; limits:Limits; workPerformed:number }
const pairs:Record<Relationship["type"],Partial<Record<Kind,readonly Kind[]>>>={
  refines:{behavior:["behavior"],assurance:["assurance"],blueprint:["blueprint"],check:["check"]},
  constrains:{assurance:["behavior","assurance","blueprint","description"]},
  realizes:{blueprint:["behavior","assurance","blueprint"],description:["behavior","assurance","blueprint","description"]},
  "verified-by":{behavior:["check"],assurance:["check"],blueprint:["check"],description:["check"],check:["check"]},
  "depends-on":{blueprint:["blueprint","description"],description:["blueprint","description"]},
  "related-to":Object.fromEntries(["behavior","assurance","blueprint","description","check","discipline"].map(kind=>[kind,["behavior","assurance","blueprint","description","check","discipline"]])) as Partial<Record<Kind,readonly Kind[]>>,
};
/** Iterative Kosaraju traversal avoids recursion limits on large ordinary graphs. */
export function stronglyConnected(nodes:string[],edges:{source:string;target:string}[],visit:()=>void=()=>{}):string[][] {
  const forward=new Map<string,string[]>(), reverse=new Map<string,string[]>();
  for(const id of nodes){visit();forward.set(id,[]);reverse.set(id,[]);}
  for(const edge of edges){visit();if(forward.has(edge.source)&&forward.has(edge.target)){forward.get(edge.source)!.push(edge.target);reverse.get(edge.target)!.push(edge.source);}}
  const seen=new Set<string>(), order:string[]=[];
  for(const start of nodes) {
    visit();if(seen.has(start))continue;
    const stack:[string,boolean][]=[[start,false]];
    while(stack.length) {
      visit();const [id,finish]=stack.pop()!;
      if(finish){order.push(id);continue;}
      if(seen.has(id))continue;seen.add(id);stack.push([id,true]);
      for(const next of forward.get(id)??[]){visit();if(!seen.has(next))stack.push([next,false]);}
    }
  }
  const assigned=new Set<string>(), result:string[][]=[];
  for(const start of order.reverse()) {
    visit();if(assigned.has(start))continue;
    const group:string[]=[],stack=[start];
    while(stack.length){visit();const id=stack.pop()!;if(assigned.has(id))continue;assigned.add(id);group.push(id);for(const next of reverse.get(id)??[]){visit();if(!assigned.has(next))stack.push(next);}}
    result.push(group.sort(compareText));
  }
  return result.sort((a,b)=>compareText(a[0]!,b[0]!));
}

/** Inspect deterministic bounded graph work; an incomplete graph never grants a complete selection. */
export function inspectGraph(records:KnowledgeRecord[],options:{limits?:Partial<Limits>;owners?:readonly string[];declarations?:readonly {id:string;path:string}[]}={}):KnowledgeGraph {
  const limits=limitsFor(options.limits), diagnostics:Diagnostic[]=[],edges:GraphEdge[]=[];
  let components:string[][]=[],complete=true,workPerformed=0;
  const halt=(code:string,message:string,path="intent"):never=>{
    complete=false;
    diagnostics.push({code,severity:"error",stage:"graph",message,path});
    throw STOP;
  };
  const STOP=Symbol("graph-bound");
  const visit=()=>{if(workPerformed>=limits.maxGraphWork)halt("intent.limit.graph-work",`Graph work exceeds ${limits.maxGraphWork} item visits`);workPerformed++;};
  const add=(code:string,message:string,record:Pick<KnowledgeRecord,"path">,severity:Diagnostic["severity"]="error",related?:string[])=>{
    visit();
    // Reserve one slot for the diagnostic explaining why findings are partial.
    if(diagnostics.length>=limits.maxGraphDiagnostics-1)halt("intent.limit.graph-diagnostics",`Graph findings reach the ${limits.maxGraphDiagnostics}-diagnostic limit`,record.path);
    diagnostics.push({code,severity,stage:"graph",message,path:record.path,...(related?{related}:{})});
  };
  try {
    if(records.length>limits.maxRecords)halt("intent.limit.graph-records",`Graph input exceeds ${limits.maxRecords} records`);
    const ordered=[...records].sort((a,b)=>compareText(a.header.id,b.header.id)||compareText(a.path,b.path));
    const current=new Map<string,KnowledgeRecord>(),identities=new Map<string,{path:string}[]>();
    const declarations=options.declarations??ordered.map(record=>({id:record.header.id,path:record.path}));
    if(declarations.length>limits.maxRecords)halt("intent.limit.graph-records",`Graph identity input exceeds ${limits.maxRecords} records`);
    for(const declaration of declarations){visit();const group=identities.get(declaration.id)??[];group.push(declaration);identities.set(declaration.id,group);}
    const declaredOwners=options.owners?new Set(options.owners):null;
    let edgeCount=0;
    for(const record of ordered) {
      visit();edgeCount+=record.header.relationships.length;
      if(edgeCount>limits.maxGraphEdges)halt("intent.limit.graph-edges",`Graph input exceeds ${limits.maxGraphEdges} authored edges`,record.path);
      if(declaredOwners&&record.header.status==="current"&&record.header.kind!=="discipline")for(const owner of [...record.header.owners].sort(compareText)) {
        visit();if(!declaredOwners.has(owner))add("intent.knowledge.owner",`Undeclared repository owner ${owner}`,record);
      }
      if(record.header.status === "current") {
        const prior=current.get(record.header.id);
        if(prior)add("intent.identity.current-duplicate",`Multiple current records for ${record.header.id}`,record,"error",[prior.path]);
        else current.set(record.header.id,record);
      }
    }
    for(const [id,group] of identities) {
      visit();
      for(const record of group.slice(1)){visit();add("intent.identity.duplicate",`Multiple authored records declare ${id}`,record,"error",[group[0]!.path]);}
      if(group.length>1)current.delete(id);
    }
    const incoming=new Map<string,number>(),outgoing=new Map<string,number>();
    const conflicts=new Map<string,Set<string>>(),facts=new Map<string,Set<string>>();
    const conflictKey=(type:string,target:string,localFact:string,targetFact:string)=>JSON.stringify([type,target,localFact,targetFact]);
    for(const [id,record] of current) {
      visit();const declared=new Set<string>();
      for(const conflict of record.header.conflicts){visit();declared.add(conflictKey(conflict.type,conflict.target,conflict.localFact,conflict.targetFact));}
      conflicts.set(id,declared);
      const localFacts=new Set<string>();
      if(record.header.kind==="assurance"||record.header.kind==="blueprint")for(const fact of readRecordDocument(record).sections.find(section=>section.name===(record.header.kind==="assurance"?"Limits":"Constraints"))?.entries??[]){visit();localFacts.add(fact.id);}
      facts.set(id,localFacts);
    }
    for(const record of ordered) {
      visit();let requiredCheck=false;
      const relationshipDetails=new Map<string,ReturnType<typeof readRecordDocument>["relationshipDetails"][number]>();
      for(const detail of readRecordDocument(record).relationshipDetails){visit();relationshipDetails.set(`${detail.type}\0${detail.target}`,detail);}
      const orderedEdges=[...record.header.relationships].sort((a,b)=>compareText(a.type,b.type)||compareText(a.target,b.target));
      for(const edge of orderedEdges) {
        visit();const targetKind=edge.target.split(".")[0] as Kind;
        if(!pairs[edge.type][record.header.kind]?.includes(targetKind))add("intent.relationship.kind",`Invalid ${edge.type} relationship from ${record.header.kind} to ${targetKind}`,record);
        if(edge.target===record.header.id)add("intent.relationship.self","Self relationships are not supported",record);
        if(record.header.status!=="current"||!current.has(record.header.id))continue;
        const out=(outgoing.get(record.header.id)??0)+1,into=(incoming.get(edge.target)??0)+1;
        if(out>limits.maxGraphDegree||into>limits.maxGraphDegree)halt("intent.limit.graph-degree",`Current ${out>limits.maxGraphDegree?"outgoing":"incoming"} degree exceeds ${limits.maxGraphDegree} at ${out>limits.maxGraphDegree?record.header.id:edge.target}`,record.path);
        outgoing.set(record.header.id,out);incoming.set(edge.target,into);
        const detail=relationshipDetails.get(`${edge.type}\0${edge.target}`);
        edges.push({...edge,...detail,source:record.header.id,sourcePath:record.path});
        if(edge.type==="verified-by"&&edge.required&&current.get(edge.target)?.header.kind==="check")requiredCheck=true;
        if(!current.has(edge.target))add(edge.required?"intent.relationship.required-target":"intent.relationship.optional-target",`Target ${edge.target} is ${identities.has(edge.target)?"non-current or ambiguous":"missing"}`,record,edge.required?"error":"warning");
      }
      if(record.header.status!=="current"||!current.has(record.header.id))continue;
      if(["behavior","assurance"].includes(record.header.kind)&&!requiredCheck)add("intent.relationship.required-check","Current Behavior and Assurance require a current Check",record);
      const declared=[...record.header.conflicts].sort((a,b)=>compareText(a.type,b.type)||compareText(a.target,b.target)||compareText(a.localFact,b.localFact)||compareText(a.targetFact,b.targetFact));
      for(const conflict of declared) {
        visit();const target=current.get(conflict.target),field=record.header.kind==="assurance"?"limits":"constraints";
        if(!target||target.header.kind!==record.header.kind||!facts.get(record.header.id)?.has(conflict.localFact)||!facts.get(target.header.id)?.has(conflict.targetFact)) {add("intent.conflict.invalid","Conflict must bind current same-kind records and explicit entry IDs",record);continue;}
        const reciprocal=conflicts.get(target.header.id)?.has(conflictKey(conflict.type,record.header.id,conflict.targetFact,conflict.localFact));
        if(!reciprocal)add("intent.conflict.reciprocal","Conflict lacks its exact reciprocal declaration",record,"error",[target.path]);
        else if(compareText(record.header.id,target.header.id)<0)add("intent.conflict.authority",`Declared conflicting ${field}: ${conflict.localFact} / ${conflict.targetFact}`,record,"error",[target.path]);
      }
    }
    const ids=[...current.keys()].sort(compareText);
    for(const type of ["refines","verified-by"] as const) {
      const selected:GraphEdge[]=[];
      for(const edge of edges){visit();if(edge.type===type&&(type!=="verified-by"||current.get(edge.source)?.header.kind==="check"))selected.push(edge);}
      for(const component of stronglyConnected(ids,selected,visit)){visit();if(component.length>1)add("intent.relationship.cycle",`${type} cycle: ${component.join(", ")}`,current.get(component[0]!)!,"error",component.slice(1).map(id=>current.get(id)!.path));}
    }
    const behaviors:KnowledgeRecord[]=[];
    for(const record of current.values()){visit();if(record.header.kind==="behavior")behaviors.push(record);}
    const excluded=new Map<string,KnowledgeRecord[]>();
    for(const record of behaviors)for(const fact of readRecordDocument(record).spec.excluded as string[]){visit();const owners=excluded.get(fact)??[];owners.push(record);excluded.set(fact,owners);}
    for(const record of behaviors)for(const fact of readRecordDocument(record).spec.included as string[]){visit();for(const other of excluded.get(fact)??[]){visit();add("intent.conflict.behavior",`Behavior includes an explicitly excluded fact: ${fact}`,record,"error",[other.path]);}}
    const dependencies:GraphEdge[]=[];
    for(const edge of edges){visit();if(edge.type==="depends-on"&&edge.required)dependencies.push(edge);}
    components=stronglyConnected(ids,dependencies,visit).filter(group=>group.length>1);
  } catch(error) {if(error!==STOP)throw error;}
  return {edges:edges.sort((a,b)=>compareText(a.source,b.source)||compareText(a.type,b.type)||compareText(a.target,b.target)),components,diagnostics:orderedDiagnostics(diagnostics),complete,limits,workPerformed};
}
