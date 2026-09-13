import test from "node:test";
import assert from "node:assert/strict";
import { inspectRecord, readRecordDocument, KINDS, parseStrictJson } from "../dist/library/index.js";
import { header, currentRecord, context, authoredHeader, location } from "./fixtures.mjs";

const document=(value,options)=>currentRecord(value,options).sourceText;

test("all six independently authored records expose rich typed meaning",()=>{
  for(const kind of KINDS){const h=header(kind);const inspected=inspectRecord(document(h),{path:location(kind),context:context(h)});assert.equal(inspected.valid,true,JSON.stringify(inspected.diagnostics));assert.equal(inspected.complete,true);assert.deepEqual(JSON.parse(JSON.stringify(inspected.record.header)),{...authoredHeader(h),owners:h.owners,tags:h.tags,sources:h.sources,relationships:h.relationships,conflicts:h.conflicts,...(kind==="description"?{coverage:h.spec.coverage}:{}),...(kind==="check"?{subjects:h.spec.subjects,evidenceKinds:h.spec.evidenceKinds}:{})});assert.equal(inspected.record.title,h.title);assert.equal(inspected.record.summary,h.summary);assert.deepEqual(JSON.parse(JSON.stringify(readRecordDocument(inspected.record).spec)),h.spec);assert.ok(readRecordDocument(inspected.record).body.includes(h.title));}
});
test("JSON rejects duplicate decoded names, bad Unicode, syntax and unsafe numbers",()=>{
  for(const text of ['{"x":1,"\\u0078":2}','{"x":NaN}','{"x":Infinity}','{"x":1e400}','{"x":9007199254740993}','{"x":"\\ud800"}','{"x":1,}','[1,]','{}{}','/* comment */ {}'])assert.throws(()=>parseStrictJson(text),undefined,text);
  const value=parseStrictJson('{"__proto__":{"polluted":true},"constructor":0}');assert.equal(Object.getPrototypeOf(value),null);assert.equal({}.polluted,undefined);
});
test("JSON parsing is bounded before deep or large recursive work",()=>{
  assert.throws(()=>parseStrictJson('[[[0]]]',{maxDepth:2}),error=>error.code==="intent.limit.json-depth");
  assert.throws(()=>parseStrictJson('[1,2,3]',{maxNodes:3}),error=>error.code==="intent.limit.json-nodes");
  assert.throws(()=>parseStrictJson('"long"',{maxBytes:3}),error=>error.code==="intent.limit.json-bytes");
  const exact='{"a":1,"b":[true]}';
  assert.deepEqual(JSON.parse(JSON.stringify(parseStrictJson(exact,{maxDepth:3,maxNodes:4}))),{a:1,b:[true]});
  assert.throws(()=>parseStrictJson(exact,{maxDepth:2}),error=>error.code==="intent.limit.json-depth");
  assert.throws(()=>parseStrictJson(exact,{maxNodes:3}),error=>error.code==="intent.limit.json-nodes");
});
test("line endings preserve byte identity while declared normalization agrees",()=>{
  const h=header("description");
  const lf=inspectRecord(document(h),{path:location(h.kind),context:context(h)}).record;
  const crlf=inspectRecord(document(h,{ending:"\r\n"}),{path:location(h.kind),context:context(h)}).record;
  assert.notEqual(lf.sourceDigest,crlf.sourceDigest);assert.equal(lf.semanticDigest,crlf.semanticDigest);
  const noTerminal=inspectRecord(document(h).replace(/\n$/,""),{path:location(h.kind),context:context(h)}).record;
  assert.notEqual(lf.semanticDigest,noTerminal.semanticDigest);
});
test("declared set permutations agree but authored sequence order remains meaningful",()=>{
  const a=header("behavior",{owners:["a","b"],tags:["two","one"]});
  const b=structuredClone(a);b.owners.reverse();b.tags.reverse();
  const read=h=>inspectRecord(document(h),{path:location(h.kind),context:context(h)}).record;
  assert.equal(read(a).semanticDigest,read(b).semanticDigest);
  a.spec.examples=["first","second"];b.spec.examples=["second","first"];
  assert.notEqual(read(a).semanticDigest,read(b).semanticDigest);
});
test("authored local fields reject version bookkeeping and source uses reject extra digest fields",()=>{
  const h=header("description");const fixture=currentRecord(h);
  for(const extra of ['"revision": 2','"supersedes": null']){
    const invalid=fixture.sourceText.replace('"status": "draft"',`"status": "draft", ${extra}`);
    assert.equal(inspectRecord(invalid,{path:location(h.kind),context:fixture.context}).valid,false);
  }
  h.sources=[{id:"reference",required:false,reference:"README.md",revision:null,role:"decision",digest:`sha256:${"0".repeat(64)}`}];
  const invalidContext=context(h);invalidContext.connections.sourceUses[0].digest="sha256:"+"0".repeat(64);
  assert.equal(inspectRecord(document(h),{path:location(h.kind),context:invalidContext}).valid,false);
});

test("invalid drafts preserve raw source for repair and don't claim a valid model",()=>{
  const raw=document(header("behavior")).replace('"kind": "behavior"','"kind": "unknown"');
  const result=inspectRecord(raw,{path:location("behavior"),context:context(header("behavior"))});assert.equal(result.raw,raw);assert.equal(result.valid,false);assert.equal(result.record,null);assert.ok(result.diagnostics.some(d=>d.code==="intent.schema.invalid"));
});
test("CommonMark body requirements ignore quoted and fenced headings",()=>{
  const h=header("behavior");
  const normal=document(h);
  for(const fake of ["> ## Falsifiers","```md\n## Falsifiers\n```"]){const result=inspectRecord(normal.replace("## Falsifiers",fake),{path:location(h.kind),context:context(h)});assert.equal(result.valid,false);assert.ok(result.diagnostics.some(d=>d.code==="intent.record.body-section"));}
  const setext=normal.replace(`# ${h.title}`,`${h.title}\n================`);
  assert.equal(inspectRecord(setext,{path:location(h.kind),context:context(h)}).valid,true);
});
test("explicit locators place Descriptions under the declared record kind",()=>{
  const raw=document(header("description"));
  for(const path of ["src/_store.desc.md","intent/behavior/_store.desc.md"]){const result=inspectRecord(raw,{path,context:context(header("description"))});assert.equal(result.valid,false);}
  assert.equal(inspectRecord(raw,{path:location("description"),context:context(header("description"))}).valid,true);
});
test("Discipline cannot create authoritative relationships or required source retrieval",()=>{
  const h=header("discipline");
  h.sources=[{id:"paper",required:true,reference:"https://example.org/paper",revision:null,role:"research"}];
  assert.equal(inspectRecord(document(h),{path:location(h.kind),context:context(h)}).valid,false);
  h.sources=[];h.relationships=[{type:"related-to",target:"behavior.store",required:true}];
  assert.equal(inspectRecord(document(h),{path:location(h.kind),context:context(h)}).valid,false);
});
test("UTF8, BOM, bare CR and byte limits are explicit failures",()=>{
  const valid=Buffer.from(document(header("behavior")));
  for(const input of [Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),valid]),Buffer.from([0xff,0xfe]),valid.toString().replace(/\n/g,"\r")])assert.equal(inspectRecord(input,{path:location("behavior"),context:context(header("behavior"))}).valid,false);
  const limited=inspectRecord(valid,{path:location("behavior"),limits:{maxRecordBytes:10}});assert.equal(limited.complete,false);assert.equal(limited.record,null);
});
