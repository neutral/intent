export function header(kind, overrides={}) {
  const specs={
    behavior:{outcome:"Return the requested value",actors:["caller"],conditions:[],included:["Return stored values"],excluded:[],examples:["Read a stored key"],falsifiers:["A stored key is lost"]},
    assurance:{obligation:"Retain committed values",scope:["storage"],failureModes:["Lost write"],limits:["No acknowledged write is lost"],degradation:[],falsifiers:["Read loses a committed value"]},
    blueprint:{decision:"Isolate storage behind an interface",scope:["storage"],components:["store"],constraints:["Callers use the interface"],interfaces:["get and set"],dataFlows:[],tradeoffs:["An extra boundary"],evolution:[]},
    description:{responsibility:"Store and retrieve values",coverage:[{path:"src/store.js",mode:"file",role:"primary"}],behavior:["Read stored values"],boundaries:["Local memory"],invariants:[],dependencies:[],failure:["Absent key returns undefined"],rationale:["Small example implementation"]},
    check:{proposition:"A written value can be read",subjects:[{kind:"file",selector:"src/store.js"}],evidenceKinds:["command"],evaluation:{pass:"Roundtrip agrees",fail:"Read differs",indeterminate:"Evidence does not decide",notRun:"No examination"},evidence:"Identify the examined input and actual output",limits:["One supported scenario"],falsifiers:["The value differs"]},
    discipline:{practice:"Examine error paths",appliesWhen:["Adding a failure mode"],doesNotApplyWhen:[],guidance:["Read each recovery path"],verification:["An attributed reviewer examined recovery"]},
  };
  return {schema:"intent.knowledge-record.v2",kind,id:`${kind}.store`,title:`${kind} example`,status:"draft",summary:"An independently authored test record",owners:["example"],sources:[],relationships:[],conflicts:[],tags:[],spec:specs[kind],...overrides};
}
// Test-only input convenience. This independent serializer is not a production
// parser or template oracle: assertions below also use literal authored sources.
export const sections={
  behavior:[["Outcome","outcome"],["Actors","actors"],["Conditions","conditions"],["Included","included"],["Excluded","excluded"],["Examples","examples"],["Falsifiers","falsifiers"]],
  assurance:[["Obligation","obligation"],["Scope","scope"],["Failure Modes","failureModes"],["Limits","limits"],["Degradation","degradation"],["Falsifiers","falsifiers"]],
  blueprint:[["Decision","decision"],["Scope","scope"],["Components","components"],["Constraints","constraints"],["Interfaces","interfaces"],["Data Flows","dataFlows"],["Tradeoffs","tradeoffs"],["Evolution","evolution"]],
  description:[["Responsibility","responsibility"],["Behavior","behavior"],["Boundaries","boundaries"],["Invariants","invariants"],["Dependencies","dependencies"],["Failure Behavior","failure"],["Rationale","rationale"]],
  check:[["Proposition","proposition"],["Pass","evaluation.pass"],["Fail","evaluation.fail"],["Indeterminate","evaluation.indeterminate"],["Not Run","evaluation.notRun"],["Evidence","evidence"],["Limits","limits"],["Falsifiers","falsifiers"]],
  discipline:[["Practice","practice"],["Applicability","appliesWhen"],["Exclusions","doesNotApplyWhen"],["Guidance","guidance"],["Verification Guidance","verification"]],
};
const remembered = new Map();
export function authoredHeader(value) {
  const {schema,kind,id,status}=value;
  return {schema,kind,id,status};
}
export function context(value) {
  const record=value.id;
  const selected={catalog:{schema:"intent.catalog.v1",sources:[],records:[{record,owners:structuredClone(value.owners),tags:structuredClone(value.tags),...Object.fromEntries(Object.entries(value).filter(([key])=>key.startsWith("x-")))}]},connections:{schema:"intent.connections.v1",relationships:[],conflicts:[],sourceUses:[],coverage:[],checkSelections:[]}};
  for(const source of value.sources){selected.catalog.sources.push({id:source.id,reference:source.reference});selected.connections.sourceUses.push({id:`source-${selected.connections.sourceUses.length+1}`,record,source:source.id,required:source.required,revision:source.revision,role:source.role});}
  value.relationships.forEach(({scope,rationale,...edge},index)=>selected.connections.relationships.push({id:`relationship-${index+1}`,record,...structuredClone(edge)}));
  value.conflicts.forEach((entry,index)=>selected.connections.conflicts.push({id:`conflict-${index+1}`,record,...structuredClone(entry)}));
  if(value.kind==="description")value.spec.coverage.forEach((entry,index)=>selected.connections.coverage.push({id:`coverage-${index+1}`,record,...structuredClone(entry)}));
  if(value.kind==="check")selected.connections.checkSelections.push({id:"check-selection",record,subjects:structuredClone(value.spec.subjects),evidenceKinds:structuredClone(value.spec.evidenceKinds)});
  return selected;
}
export function document(value, {body, ending="\n"}={}) {
  const meaning=sections[value.kind].map(([name,field])=>{
    const content=field.split(".").reduce((object,key)=>object?.[key],value.spec);
    const markdown=Array.isArray(content)?content.map((text,index)=>`### entry:${field.replace(/[A-Z]/g,char=>`-${char.toLowerCase()}`)}-${index+1}\n\n${text}\n`).join("\n"):content??"";
    return `## ${name}\n\n${markdown}\n`;
  }).join("\n");
  const details=value.relationships.flatMap((edge,index)=>edge.scope!=null||edge.rationale!=null?[`## Connection: relationship-${index+1}\n\n${["scope","rationale"].filter(name=>edge[name]!=null).map(name=>`### ${name[0].toUpperCase()+name.slice(1)}\n\n${edge[name]}\n`).join("\n")}`]:[]);
  const authoredBody=body??`# ${value.title}\n\n${value.summary}\n\n${meaning}${details.length?`\n${details.join("\n")}`:""}`;
  const text=`---\n${JSON.stringify(authoredHeader(value),null,2)}\n---\n${authoredBody}`;
  const sourceText=ending==="\n"?text:text.replaceAll("\n",ending);
  remembered.set(sourceText,context(value));
  return sourceText;
}
export function currentRecord(value,options={}) {return {sourceText:document(value,options),context:context(value)};}
export function location(kind){return kind==="description"?"intent/description/src/_store.desc.md":`intent/${kind==="check"?"checks":kind==="discipline"?"disciplines":kind}/store.md`;}
/** Add explicitly remembered builder metadata; already-authored files remain exact. */
export function fixtureFiles(files) {
  const result={...files};
  const selected={catalog:{schema:"intent.catalog.v1",sources:[],records:[]},connections:{schema:"intent.connections.v1",relationships:[],conflicts:[],sourceUses:[],coverage:[],checkSelections:[]}};
  const add=(target,items)=>{for(const item of items)if(!target.some(existing=>JSON.stringify(existing)===JSON.stringify(item)))target.push(structuredClone(item));};
  for(const text of Object.values(files)) {
    const known=remembered.get(text);if(!known)continue;
    add(selected.catalog.sources,known.catalog.sources);add(selected.catalog.records,known.catalog.records);
    for(const name of ["relationships","conflicts","sourceUses","coverage","checkSelections"])add(selected.connections[name],known.connections[name]);
  }
  if(!Object.hasOwn(result,"intent/catalog.json"))result["intent/catalog.json"]=JSON.stringify(selected.catalog);
  if(!Object.hasOwn(result,"intent/connections.json"))result["intent/connections.json"]=JSON.stringify(selected.connections);
  return result;
}
