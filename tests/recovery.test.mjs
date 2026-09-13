import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,mkdir,writeFile,readFile,rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { applyFileProposal,proposeFiles,inspectOperation } from "../dist/library/authoring.js";
import { FileSystemSource } from "../dist/library/sources.js";
import { readWorkspace } from "../dist/library/workspace.js";
import { discardOperation,proposeOperationResume,inspectAuthoringLock,releaseAbandonedAuthoringLock } from "../dist/library/recovery.js";
import { createWorkspaceOperation } from "../dist/library/observation.js";
const fixture=async(run)=>{const root=await mkdtemp(join(tmpdir(),"intent-recovery-"));try{await mkdir(join(root,"intent"),{recursive:true});await mkdir(join(root,"tmp/intent"),{recursive:true});await run(root);}finally{await rm(root,{recursive:true,force:true});}};

test("an interrupted multi-file operation resumes only pending bytes under a new reviewed journal",()=>fixture(async root=>{
  const basis=(await readWorkspace(await FileSystemSource.open(root))).sourceBasis.id;
  const proposal=proposeFiles(basis,[{path:"intent/first.md",before:null,after:"first"},{path:"intent/second.md",before:null,after:"second"}]);
  let reads=0;
  const interrupted=await applyFileProposal(root,proposal,{signal:{get aborted(){return reads++>0;}}});
  assert.equal(interrupted.status,"interrupted");assert.deepEqual(interrupted.written,["intent/first.md"]);
  const originalJournal=await readFile(join(root,interrupted.journal),"utf8");
  const resume=await proposeOperationResume(root,proposal.id);
  assert.deepEqual(resume.remainingPaths,["intent/second.md"]);assert.notEqual(resume.fileProposal.id,proposal.id);
  assert.equal((await applyFileProposal(root,resume.fileProposal)).status,"completed");
  assert.equal(await readFile(join(root,interrupted.journal),"utf8"),originalJournal);
  assert.equal(await readFile(join(root,"intent/first.md"),"utf8"),"first");
  assert.equal(await readFile(join(root,"intent/second.md"),"utf8"),"second");
  assert.equal((await proposeOperationResume(root,proposal.id)).fileProposal,null);
  await writeFile(join(root,"intent/first.md"),"external change");
  await assert.rejects(proposeOperationResume(root,proposal.id),/externally changed/);
}));

test("explicit abandoned lock recovery refuses a live process and a replaced observation",()=>fixture(async root=>{
  const lockPath=join(root,"tmp/intent/.authoring.lock"),id="fixture-lock",journal=`tmp/intent/operations/${id}.json`;
  await writeFile(lockPath,JSON.stringify({id,pid:process.pid,journal}));
  const live=await inspectAuthoringLock(root);assert.equal(live.processState,"running");
  await assert.rejects(releaseAbandonedAuthoringLock(root,live),/process is running/);
  const child=spawn(process.execPath,["-e",""],{stdio:"ignore"});const pid=child.pid;await once(child,"exit");
  await writeFile(lockPath,JSON.stringify({id,pid,journal}));
  const abandoned=await inspectAuthoringLock(root);assert.equal(abandoned.processState,"not-running");
  await writeFile(lockPath,JSON.stringify({id,pid,journal})+"\n");
  await assert.rejects(releaseAbandonedAuthoringLock(root,abandoned),/changed since inspection/);
  const selected=await inspectAuthoringLock(root);
  assert.deepEqual(await releaseAbandonedAuthoringLock(root,selected),{id,released:true});
  assert.equal(await inspectAuthoringLock(root),null);
}));

test("recovery preserves the reviewed proposed scope and refuses changed prospective inputs",()=>fixture(async root=>{
  await mkdir(join(root,"lib"));await writeFile(join(root,"lib/new.js"),"reviewed implementation");
  const workspaceOptions={reconcileImplementation:true},operation=createWorkspaceOperation(await FileSystemSource.open(root));
  const changes=[{path:"intent/catalog.json",before:null,after:JSON.stringify({schema:"intent.catalog.v1",records:[],sources:[]})},{path:"intent/project.json",before:null,after:JSON.stringify({schema:"intent.project.v1",name:"Recovery scope",owners:["test"],implementationRoots:["lib"],exemptions:[]})}];
  const original=await readWorkspace(operation.source,workspaceOptions),proposed=await readWorkspace(operation.overlay(changes),workspaceOptions);await operation.verify();
  const proposal=proposeFiles(original.sourceBasis.id,changes,{proposedBasis:proposed.sourceBasis.id});
  let writes=0;const interrupted=await applyFileProposal(root,proposal,{workspaceOptions,signal:{get aborted(){return writes++>0;}}});
  assert.equal(interrupted.status,"interrupted");assert.deepEqual(interrupted.written,["intent/catalog.json"]);
  await writeFile(join(root,"lib/new.js"),"changed implementation");
  await assert.rejects(proposeOperationResume(root,proposal.id,{workspaceOptions}),/proposed workspace changed/);
  await writeFile(join(root,"lib/new.js"),"reviewed implementation");
  const resume=await proposeOperationResume(root,proposal.id,{workspaceOptions});assert.equal(resume.fileProposal.proposedBasis,proposal.proposedBasis);assert.deepEqual(resume.remainingPaths,["intent/project.json"]);
  await writeFile(join(root,"lib/new.js"),"changed after resume review");
  const refused=await applyFileProposal(root,resume.fileProposal,{workspaceOptions});assert.equal(refused.status,"refused");assert.match(refused.error,/proposed workspace changed/);
  await writeFile(join(root,"lib/new.js"),"reviewed implementation");assert.equal((await applyFileProposal(root,resume.fileProposal,{workspaceOptions})).status,"completed");
}));

test("an interrupted document and globals update remains recoverable from an invalid assembled workspace",()=>fixture(async root=>{
  const {proposeInitialization,proposeRecordCreation}=await import("../dist/library/index.js");
  await rm(join(root,"intent"),{recursive:true,force:true});
  const setup=await proposeInitialization(await FileSystemSource.open(root),{name:"Recovery",owners:["maintainer"],implementationRoots:[]});
  assert.equal((await applyFileProposal(root,setup.fileProposal)).status,"completed");
  const created=await proposeRecordCreation(await FileSystemSource.open(root),{kind:"check",id:"check.recovery",title:"Recovery",path:"intent/checks/recovery.md",subjects:[{kind:"repository",selector:"."}]});
  let writes=0;const interrupted=await applyFileProposal(root,created.fileProposal,{signal:{get aborted(){return writes++>0;}}});
  assert.equal(interrupted.status,"interrupted");assert.deepEqual(interrupted.written,["intent/checks/recovery.md"]);
  const partial=await readWorkspace(await FileSystemSource.open(root));assert.equal(partial.valid,false);assert.equal(partial.stages.find(stage=>stage.name==="source-basis").complete,true);
  const resume=await proposeOperationResume(root,interrupted.id);assert.deepEqual(resume.remainingPaths,["intent/catalog.json","intent/connections.json"]);
  assert.equal((await applyFileProposal(root,resume.fileProposal)).status,"completed");
  const completed=await readWorkspace(await FileSystemSource.open(root));assert.equal(completed.records[0].header.id,"check.recovery");assert.equal(completed.inspections[0].valid,true);
}));

test("discard requires the exact inspected journal and an inactive operation",()=>fixture(async root=>{
  const proposal=proposeFiles((await readWorkspace(await FileSystemSource.open(root))).sourceBasis.id,[{path:"intent/pending.md",before:null,after:"pending"}]);
  const applied=await applyFileProposal(root,proposal,{signal:AbortSignal.abort()});
  const inspected=await inspectOperation(root,applied.id);
  await assert.rejects(discardOperation(root,{id:inspected.id,journalDigest:`sha256:${"0".repeat(64)}`}),/changed since inspection/);
  const lockPath=join(root,"tmp/intent/.authoring.lock");await writeFile(lockPath,JSON.stringify({id:applied.id,pid:process.pid,journal:applied.journal}));
  await assert.rejects(discardOperation(root,{id:inspected.id,journalDigest:inspected.journalDigest}),/existing authoring lock/);await rm(lockPath);
  assert.deepEqual(await discardOperation(root,{id:inspected.id,journalDigest:inspected.journalDigest}),{id:applied.id,discarded:true});
  await assert.rejects(inspectOperation(root,applied.id),/journal not found/);
  await assert.rejects(readFile(join(root,"intent/pending.md")),{code:"ENOENT"});
}));
