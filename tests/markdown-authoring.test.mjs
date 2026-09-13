import test from "node:test";
import assert from "node:assert/strict";
import { inspectRecord, inspectGraph, readRecordDocument } from "../dist/library/index.js";
import { header, currentRecord, context, location } from "./fixtures.mjs";

// Literal authored source and expectations deliberately do not use a serializer
// or the production parser to manufacture their oracle.
const source = `---
{"schema":"intent.knowledge-record.v2","kind":"blueprint","id":"blueprint.literal","status":"draft"}
---
# A *literal* \`decision\`

An opening **summary** with a [reference](https://example.test/rule).

## Decision

Keep **meaning** here.

> A quoted paragraph with \`code\`.

## Scope

### entry:local-scope

Only the selected module.

## Components

### entry:module

- First component
  - Nested **detail**

~~~md
## Conditions
### entry:not-a-declaration
~~~

## Constraints

### entry:interface

Use the interface.

### entry:separate-rule

Use the interface.

## Interfaces

### entry:api

\`read(key)\` returns a value.

## Data Flows

## Tradeoffs

### entry:boundary-cost

An additional call boundary.\x20\x20
Preserve this hard break.

## Evolution

## Connection: caller-contract

### Scope

Only **local** reads.

### Rationale

Keep the [caller contract](#scope) visible.

## Notes

This sentence mentions assurance.undeclared and says callers must retry.
It develops the design without declaring a graph relationship.
`;
const literalContext={catalog:{schema:"intent.catalog.v1",sources:[],records:[{record:"blueprint.literal",owners:["example"],tags:[]}]},connections:{schema:"intent.connections.v1",relationships:[{id:"caller-contract",record:"blueprint.literal",type:"realizes",target:"behavior.store",required:true}],conflicts:[],sourceUses:[],coverage:[],checkSelections:[]}};
const read = (text,context=literalContext) => inspectRecord(text, {path:"intent/blueprint/literal.md",context});
const document=(value,options)=>currentRecord(value,options).sourceText;
const plain = value => JSON.parse(JSON.stringify(value));

test("essential sections accept developed prose without empty categories or generated entry IDs", () => {
  const raw = `---
{"schema":"intent.knowledge-record.v2","kind":"blueprint","id":"blueprint.literal","status":"draft"}
---
# Shared writes

Explain the agreement a caller and writer preserve.

## Decision

Commit each operation once. The caller supplies a stable request key.

## Scope

This agreement covers authenticated writes to the selected tenant.

### An interrupted caller

A retry uses the same key after losing a response.

## Constraints

Validate authority before inspecting a prior result.

### Durable effects

- Store the result and its key together.
- Return the stored result for a repeated key.

## Tradeoffs

Stored results cost space; retention defines how long retry protection lasts.

## Recovery reasoning

The result survives the connection. A caller timeout does not imply rollback.
`;
  const result = read(raw);
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
  const view = readRecordDocument(result.record);
  assert.deepEqual(view.spec.components, []);
  assert.deepEqual(view.spec.scope, ["This agreement covers authenticated writes to the selected tenant.", "### An interrupted caller\n\nA retry uses the same key after losing a response."]);
  assert.deepEqual(view.spec.constraints, ["Validate authority before inspecting a prior result.", "### Durable effects\n\n- Store the result and its key together.\n- Return the stored result for a repeated key."]);
  assert.equal(view.sections.every(section => section.entries.length === 0), true);
  assert.equal(view.sections.find(section => section.name === "Recovery reasoning").markdown.trim(), "The result survives the connection. A caller timeout does not imply rollback.");
  assert.equal(result.record.sourceText, raw);
});

test("ordinary prose and explicitly referenced passages remain ordered and complete together", () => {
  const raw = source.replace("## Constraints\n\n", "## Constraints\n\nThe boundary protects several related promises.\n\n")
    .replace("### entry:separate-rule", "### Further consequences")
    .replace("## Notes\n\n", "## Notes\n\n### entry:recovery-note\n\n");
  const result = read(raw);
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
  const view = readRecordDocument(result.record);
  assert.deepEqual(view.spec.constraints, ["The boundary protects several related promises.", "Use the interface.", "### Further consequences\n\nUse the interface."]);
  assert.deepEqual(view.sections.find(section => section.name === "Constraints").entries.map(entry => entry.id), ["interface"]);
  assert.equal(view.sections.find(section => section.name === "Notes").entries[0].id, "recovery-note");
  assert.equal(view.sections.find(section => section.name === "Constraints").markdown, raw.slice(raw.indexOf("## Constraints") + "## Constraints\n".length, raw.indexOf("## Interfaces")));
});

test("literal Markdown owns title, summary, sections and identified entries once", () => {
  const result = read(source);
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
  const record = {...result.record,...readRecordDocument(result.record)};
  assert.equal(record.title, "A literal decision");
  assert.equal(record.summary, "An opening **summary** with a [reference](https://example.test/rule).");
  for (const field of ["title", "summary", "spec"]) assert.equal(Object.hasOwn(record.header, field), false, field);
  assert.equal(record.spec.decision, "Keep **meaning** here.\n\n> A quoted paragraph with `code`.");
  assert.deepEqual(record.spec.constraints, ["Use the interface.", "Use the interface."]);
  assert.deepEqual(record.spec.dataFlows, []);
  const component = record.sections.find(section => section.name === "Components").entries[0];
  assert.equal(component.id, "module");
  assert.equal(component.markdown.replace(/^\s*\n|\n\s*$/g, ""), "- First component\n  - Nested **detail**\n\n~~~md\n## Conditions\n### entry:not-a-declaration\n~~~");
  assert.ok(record.spec.tradeoffs[0].includes("boundary.  \nPreserve"));
  assert.equal(component.line, source.slice(0, source.indexOf("### entry:module")).split("\n").length);
  assert.equal(record.sourceText, source);
  assert.deepEqual(plain(record.relationshipDetails), [{type:"realizes",target:"behavior.store",scope:"Only **local** reads.",rationale:"Keep the [caller contract](#scope) visible."}]);
  assert.equal(record.header.relationships.length, 1);
  assert.equal(record.spec.obligation, undefined);
});

test("CRLF, indented code and separator lines survive derived reading without reformatting", () => {
  const raw = source.replace("Only the selected module.", "    const selected = \"module\";\n    return selected;  ").replaceAll("\n", "\r\n");
  const result = read(raw);
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
  const scope = readRecordDocument(result.record).sections.find(section => section.name === "Scope");
  assert.equal(scope.markdown, "\r\n### entry:local-scope\r\n\r\n    const selected = \"module\";\r\n    return selected;  \r\n\r\n");
  assert.equal(scope.entries[0].markdown, "\r\n    const selected = \"module\";\r\n    return selected;  \r\n\r\n");
  assert.equal(readRecordDocument(result.record).spec.scope[0], "    const selected = \"module\";\r\n    return selected;  ");
  assert.equal(result.record.sourceText, raw);
  assert.equal(readRecordDocument(result.record).body, raw.slice(raw.indexOf("# A *literal*")));
});

test("relationship Markdown obeys the published prose bound", () => {
  const oversized = source.replace("Only **local** reads.", "x".repeat(16385));
  const result = read(oversized);
  assert.equal(result.valid, false);
  assert.equal(result.record, null);
  assert.equal(result.raw, oversized);
  assert.ok(result.diagnostics.length > 0);
});

test("current authoring refuses duplicate JSON prose and prose relationships", () => {
  for (const extra of [{title:"Duplicate"}, {summary:"Duplicate"}, {spec:{decision:"Duplicate"}}]) {
    const invalid = source.replace('"status":"draft"}', `"status":"draft",${JSON.stringify(extra).slice(1)}`);
    assert.equal(read(invalid).valid, false, JSON.stringify(extra));
  }
  for (const field of ["scope", "rationale"]) {
    const invalid=structuredClone(literalContext);invalid.connections.relationships[0][field]='Duplicate';
    assert.equal(read(source,invalid).valid, false, field);
  }
});

test("required declarations and opening paragraph diagnose absence or ambiguity", () => {
  const cases = [
    [source.replace("## Scope\n", "## Uninterpreted Scope\n"), "intent.record.body-section"],
    [source.replace("## Data Flows\n", "## Scope\n"), "intent.record.body-section"],
    [source.replace("## Evolution\n", "## Components\n"), "intent.record.body-section"],
    [source.replace("### entry:local-scope\n\nOnly the selected module.", "### Scope details"), "intent.record.body-section"],
    [source.replace("### entry:separate-rule", "### entry:interface"), "intent.record.body-entry"],
    [source.replace("### entry:module", "### entry:INVALID"), "intent.record.body-entry"],
    [source.replace("## Notes", "## Relationships"), "intent.record.connection-entry"],
    [source.replace("### entry:module\n\n- First component\n  - Nested **detail**\n\n~~~md\n## Conditions\n### entry:not-a-declaration\n~~~", "### entry:module"), "intent.record.body-entry"],
    [source.replace("An opening **summary** with a [reference](https://example.test/rule).\n\n", ""), "intent.record.body-summary"],
    [source.replace("An opening **summary**", "> An opening **summary**"), "intent.record.body-summary"],
    [source.replace("## Connection: caller-contract", "## Connection: absent"), "intent.record.connection-entry"],
    [source.replace("### Rationale", "### Scope"), "intent.record.connection-entry"],
    [source.replace("### Scope\n\nOnly **local** reads.", "### Scope"), "intent.record.connection-entry"],
    [source.replace("## Notes", "## Connection: caller-contract\n\n### Rationale\n\nDuplicated.\n\n## Notes"), "intent.record.connection-entry"],
  ];
  for (const [text, code] of cases) {
    const result = read(text);
    assert.equal(result.valid, false, text);
    assert.ok(result.diagnostics.some(issue => issue.code === code), JSON.stringify(result.diagnostics));
  }
});

test("essential section meaning and scalar criteria is checked from Markdown", () => {
  for (const kind of ["behavior", "assurance", "blueprint", "description", "check", "discipline"]) {
    const value = header(kind), valid = document(value);
    const firstList = {behavior:"Included",assurance:"Scope",blueprint:"Scope",description:"Behavior",check:"Limits",discipline:"Applicability"}[kind];
    const empty = valid.replace(new RegExp(`(## ${firstList}\\n)[\\s\\S]*?(?=\\n## |$)`), "$1\n");
    const result = inspectRecord(empty,{path:location(kind),context:context(value)});
    assert.equal(result.valid, false, kind);
    assert.ok(result.diagnostics.some(issue => issue.code === "intent.record.body-section"), JSON.stringify(result.diagnostics));
  }
  const raw = document(header("check"));
  for (const section of ["Proposition", "Pass", "Fail", "Indeterminate", "Not Run", "Evidence"]) {
    const result = inspectRecord(raw.replace(new RegExp(`(## ${section}\\n)[\\s\\S]*?(?=\\n## |$)`), "$1\n"), {path:location("check"),context:context(header("check"))});
    assert.equal(result.valid, false, section);
  }
});

test("conflict facts identify declared entries and survive text edits", () => {
  const declaration = (target,localFact="constraints-1") => [{type:"blueprint-constraint",target,localFact,targetFact:"constraints-1"}];
  const first = header("blueprint", {id:"blueprint.first",status:"current",conflicts:declaration("blueprint.second")});
  const second = header("blueprint", {id:"blueprint.second",status:"current",conflicts:declaration("blueprint.first")});
  second.spec.constraints = ["Use a different **interface**."];
  const records = [first,second].map(value => inspectRecord(document(value),{path:location("blueprint"),context:context(value)}).record);
  assert.equal(inspectGraph(records).diagnostics.filter(issue => issue.code === "intent.conflict.authority").length, 1);
  records[0].header.conflicts[0].localFact = "missing-entry";
  assert.ok(inspectGraph(records).diagnostics.some(issue => issue.code !== "intent.conflict.authority"));
});
