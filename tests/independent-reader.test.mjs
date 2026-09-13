import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { inspectRecord } from "../dist/library/index.js";
import { header,currentRecord,location } from "./fixtures.mjs";

test("independently implemented integer-domain reader agrees on qualified six-kind fingerprints",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-independent-"));
  try {
    for(const kind of ["behavior","assurance","blueprint","description","check","discipline"])for(const ending of ["\n","\r\n"])for(const identified of [true,false]) {
      const value=header(kind,{tags:["z","a"],"x-test":{"𐀀":1,"\ue000":2}});
      const fixture=currentRecord(value,{ending}),raw=identified?fixture.sourceText:fixture.sourceText.replace(/^### entry:[^\r\n]+\r?\n\r?\n/gm,""),inspected=inspectRecord(raw,{path:location(kind),context:fixture.context});
      assert.equal(inspected.valid,true,JSON.stringify(inspected.diagnostics));
      const path=join(root,"subject.md");await writeFile(path,raw);
      for(const [name,data]of Object.entries(fixture.context))await writeFile(join(root,`${name}.json`),JSON.stringify(data));
      const independent=JSON.parse(execFileSync("python3",[resolve("tests/independent-reader/reader.py"),path,"--catalog",join(root,"catalog.json"),"--connections",join(root,"connections.json")],{encoding:"utf8"}));
      assert.equal(independent.sourceDigest,inspected.record.sourceDigest);
      assert.equal(independent.semanticDigest,inspected.record.semanticDigest);
      assert.equal(independent.schemaValidation,"not-performed");
    }
  }finally{await rm(root,{recursive:true,force:true});}
});

test("independent current reader agrees on selected global-only changes without including unrelated metadata",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-independent-context-"));
  try{
    const fixture=currentRecord(header("blueprint",{sources:[{id:"manual",reference:"docs/first.md",required:false,revision:null,role:"research"}]}));
    const path=join(root,"subject.md");await writeFile(path,fixture.sourceText);
    const observe=async context=>{
      const record=inspectRecord(fixture.sourceText,{path:location("blueprint"),context});assert.equal(record.valid,true,JSON.stringify(record.diagnostics));
      for(const [name,value]of Object.entries(context))await writeFile(join(root,`${name}.json`),JSON.stringify(value));
      const independent=JSON.parse(execFileSync("python3",[resolve("tests/independent-reader/reader.py"),path,"--catalog",join(root,"catalog.json"),"--connections",join(root,"connections.json")],{encoding:"utf8"}));
      assert.equal(independent.semanticDigest,record.record.semanticDigest);return independent;
    };
    const before=await observe(fixture.context),changed=structuredClone(fixture.context);changed.catalog.sources[0].reference="docs/second.md";
    const after=await observe(changed);assert.equal(before.sourceDigest,after.sourceDigest);assert.notEqual(before.semanticDigest,after.semanticDigest);
    changed.catalog.records.push({record:"blueprint.unrelated",owners:["other"],tags:["other"]});
    assert.equal((await observe(changed)).semanticDigest,after.semanticDigest);
  }finally{await rm(root,{recursive:true,force:true});}
});
