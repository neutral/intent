import test from "node:test";
import assert from "node:assert/strict";
import { inspectRecord, inspectGraph, selectKnowledge, validateSchema, DEFAULT_LIMITS } from "../dist/library/index.js";
import {header,currentRecord,location} from "./fixtures.mjs";
const read=(kind,changes)=>{const {sourceText,context}=currentRecord(header(kind,changes));const inspected=inspectRecord(sourceText,{path:location(kind),context});assert.equal(inspected.valid,true,JSON.stringify(inspected.diagnostics));return inspected.record;};
test("each stable ID has one record while optional missing context warns",()=>{
  const current=read("description",{status:"current",relationships:[{type:"related-to",target:"blueprint.absent",required:false}]});
  const draft=read("description",{id:"description.proposed"});
  const graph=inspectGraph([draft,current]);assert.equal(graph.diagnostics.filter(d=>d.severity==="error").length,0);assert.equal(graph.diagnostics[0].code,"intent.relationship.optional-target");
  const duplicate=read("description",{status:"draft"});
  assert.ok(inspectGraph([duplicate,current]).diagnostics.some(d=>d.severity==="error"));
});

test("required graph edges resolve compatible current targets",()=>{
  const behavior=read("behavior",{status:"current",relationships:[{type:"verified-by",target:"check.store",required:true}]});
  const check=read("check",{status:"current"});
  assert.equal(inspectGraph([check,behavior]).diagnostics.length,0);
  check.header.status="draft";assert.ok(inspectGraph([check,behavior]).diagnostics.some(d=>d.code==="intent.relationship.required-target"));
});
test("required dependency cycles are components while refinement cycles fail",()=>{
  const a=read("blueprint",{id:"blueprint.a",status:"current",relationships:[{type:"depends-on",target:"blueprint.b",required:true}]});
  const b=read("blueprint",{id:"blueprint.b",status:"current",relationships:[{type:"depends-on",target:"blueprint.a",required:true}]});
  assert.deepEqual(inspectGraph([b,a]).components,[["blueprint.a","blueprint.b"]]);
  a.header.relationships[0].type="refines";b.header.relationships[0].type="refines";
  assert.ok(inspectGraph([a,b]).diagnostics.some(d=>d.code==="intent.relationship.cycle"));
});
test("reciprocal exact conflicts emit one finding and unilateral declarations fail",()=>{
  const a=read("blueprint",{id:"blueprint.a",status:"current",conflicts:[{type:"blueprint-constraint",target:"blueprint.b",localFact:"constraints-1",targetFact:"constraints-1"}]});
  const b=read("blueprint",{id:"blueprint.b",status:"current",conflicts:[{type:"blueprint-constraint",target:"blueprint.a",localFact:"constraints-1",targetFact:"constraints-1"}]});
  assert.equal(inspectGraph([a,b]).diagnostics.filter(d=>d.code==="intent.conflict.authority").length,1);
  b.header.conflicts=[];assert.ok(inspectGraph([a,b]).diagnostics.some(d=>d.code==="intent.conflict.reciprocal"));
});

test("incoming and outgoing degree bounds stop deterministically without claiming a complete graph",()=>{
  const leaves=Array.from({length:7},(_,i)=>read("blueprint",{id:`blueprint.leaf-${i}`,status:"current"}));
  const hub=read("blueprint",{id:"blueprint.hub",status:"current",relationships:leaves.map(record=>({type:"depends-on",target:record.header.id,required:true}))});
  const outgoing=inspectGraph([hub,...leaves],{limits:{maxGraphDegree:3}});
  assert.equal(outgoing.complete,false);assert.equal(outgoing.edges.length,3);
  assert.equal(outgoing.limits.maxGraphDegree,3);
  assert.ok(outgoing.diagnostics.some(issue=>issue.code==="intent.limit.graph-degree"&&issue.message.includes("outgoing")));
  assert.deepEqual(outgoing,inspectGraph([...leaves].reverse().concat(hub),{limits:{maxGraphDegree:3}}));
  hub.header.relationships=[];
  for(const leaf of leaves)leaf.header.relationships=[{type:"depends-on",target:hub.header.id,required:true}];
  const incoming=inspectGraph([hub,...leaves],{limits:{maxGraphDegree:3}});
  assert.equal(incoming.complete,false);assert.equal(incoming.edges.length,3);
  assert.ok(incoming.diagnostics.some(issue=>issue.code==="intent.limit.graph-degree"&&issue.message.includes("incoming")));
  assert.deepEqual(validateSchema("urn:intent:schema:reader-results:v1#/$defs/graph",incoming),[]);
});

test("Behavior conflict cross-products stop at explicit finding and work limits",()=>{
  const check=read("check",{id:"check.shared",status:"current"});
  const behaviors=Array.from({length:100},(_,i)=>{
    const value=header("behavior",{id:`behavior.case-${i}`,status:"current",relationships:[{type:"verified-by",target:"check.shared",required:true}]});
    value.spec.included=["one shared fact"];value.spec.excluded=["one shared fact"];
    const {sourceText,context}=currentRecord(value);const inspected=inspectRecord(sourceText,{path:location("behavior"),context});
    assert.equal(inspected.valid,true);return inspected.record;
  });
  const bounded=inspectGraph([check,...behaviors],{limits:{maxGraphDiagnostics:10}});
  assert.equal(bounded.complete,false);assert.equal(bounded.diagnostics.length,10);
  assert.equal(bounded.diagnostics.filter(issue=>issue.code==="intent.conflict.behavior").length,9);
  assert.equal(bounded.diagnostics.filter(issue=>issue.code==="intent.limit.graph-diagnostics").length,1);
  assert.deepEqual(bounded,inspectGraph([...behaviors].reverse().concat(check),{limits:{maxGraphDiagnostics:10}}));
  const firstConflictWork=bounded.workPerformed-1;
  const workBounded=inspectGraph([check,...behaviors],{limits:{maxGraphWork:firstConflictWork}});
  assert.equal(workBounded.complete,false);assert.equal(workBounded.workPerformed,firstConflictWork);
  assert.ok(workBounded.diagnostics.some(issue=>issue.code==="intent.limit.graph-work"));
  assert.ok(workBounded.diagnostics.some(issue=>issue.code==="intent.conflict.behavior"));
});

test("a long required chain uses indexed selection with bounded visits and no omitted dependency",()=>{
  const count=1000;
  const records=Array.from({length:count},(_,i)=>read("blueprint",{id:`blueprint.unit-${String(i).padStart(4,"0")}`,status:"current",relationships:i+1<count?[{type:"depends-on",target:`blueprint.unit-${String(i+1).padStart(4,"0")}`,required:true}]:[]}));
  const graph=inspectGraph(records);assert.equal(graph.complete,true);
  const workspace={sourceBasis:{id:`sha256:${"0".repeat(64)}`},records,inspections:records.map(record=>({path:record.path,raw:record.sourceText,record,valid:true,complete:true,diagnostics:[]})),graph,limits:{...DEFAULT_LIMITS,maxGraphWork:count*6},stages:[{name:"identity-relationships",valid:true,complete:true}]};
  const selected=selectKnowledge(workspace,[records[0].header.id]);
  assert.equal(selected.complete,true);assert.equal(selected.records.length,count);
  assert.ok(selected.workPerformed<=count*6);
  assert.equal(selected.reasons.filter(reason=>reason.reason==="required-outgoing").length,count-1);
  assert.deepEqual(validateSchema("urn:intent:schema:reader-results:v1#/$defs/selection",selected),[]);
  workspace.limits.maxGraphWork=count*3;
  const bounded=selectKnowledge(workspace,[records[0].header.id]);
  assert.equal(bounded.complete,false);assert.equal(bounded.workPerformed,count*3);
  assert.ok(bounded.diagnostics.some(issue=>issue.code==="intent.limit.selection-work"));
  const partialGraph=inspectGraph(records,{limits:{maxGraphWork:100}});
  const partial=selectKnowledge({...workspace,graph:partialGraph,limits:DEFAULT_LIMITS},[records[0].header.id]);
  assert.equal(partial.complete,false);assert.ok(partial.diagnostics.some(issue=>issue.code==="intent.selection.graph-incomplete"));
});
