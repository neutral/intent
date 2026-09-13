import { Parser, type Node } from "commonmark";
import { IntentError } from "./foundation.js";
import { CONNECTION_KINDS } from "./globals.js";
import type { ConnectionDetail, Header, Heading, Json, Kind, MarkdownEntry, MarkdownSection, RecordContext, RelationshipDetail } from "./types.js";

interface SectionDefinition { name:string; field:string; scalar?:boolean; required:boolean }
const scalar=(name:string,field:string):SectionDefinition=>({name,field,scalar:true,required:true});
const entries=(name:string,field:string,required=false):SectionDefinition=>({name,field,required});
/** The only prose fields interpreted by the reader. Other prose stays narrative. */
export const SECTION_DEFINITIONS:Readonly<Record<Kind,readonly SectionDefinition[]>>=Object.freeze({
  behavior:[scalar("Outcome","outcome"),entries("Actors","actors"),entries("Conditions","conditions"),entries("Included","included",true),entries("Excluded","excluded"),entries("Examples","examples"),entries("Falsifiers","falsifiers",true)],
  assurance:[scalar("Obligation","obligation"),entries("Scope","scope",true),entries("Failure Modes","failureModes",true),entries("Limits","limits",true),entries("Degradation","degradation"),entries("Falsifiers","falsifiers",true)],
  blueprint:[scalar("Decision","decision"),entries("Scope","scope",true),entries("Components","components"),entries("Constraints","constraints",true),entries("Interfaces","interfaces"),entries("Data Flows","dataFlows"),entries("Tradeoffs","tradeoffs",true),entries("Evolution","evolution")],
  description:[scalar("Responsibility","responsibility"),entries("Behavior","behavior",true),entries("Boundaries","boundaries",true),entries("Invariants","invariants"),entries("Dependencies","dependencies"),entries("Failure Behavior","failure",true),entries("Rationale","rationale",true)],
  check:[scalar("Proposition","proposition"),scalar("Pass","pass"),scalar("Fail","fail"),scalar("Indeterminate","indeterminate"),scalar("Not Run","notRun"),scalar("Evidence","evidence"),entries("Limits","limits",true),entries("Falsifiers","falsifiers",true)],
  discipline:[scalar("Practice","practice"),entries("Applicability","appliesWhen",true),entries("Exclusions","doesNotApplyWhen"),entries("Guidance","guidance",true),entries("Verification Guidance","verification")],
});
export const BODY_SECTIONS=Object.freeze(Object.fromEntries(Object.entries(SECTION_DEFINITIONS).map(([kind,fields])=>[kind,fields.map(field=>field.name)]))) as unknown as Readonly<Record<Kind,readonly string[]>>;
export const ENTRY_ID=/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
/** Remove separator lines, retaining indentation and every interior Markdown byte. */
export function meaningMarkdown(value:string):string {
  return value.replace(/^(?:[ \t]*\r?\n)+/,"").replace(/(?:\r?\n[ \t]*)+$/,"");
}
function visibleText(node:Node):string {
  let text="";const walker=node.walker();
  for(let event=walker.next();event;event=walker.next())if(event.entering){
    if(event.node.type==="text"||event.node.type==="code")text+=event.node.literal??"";
    if(event.node.type==="softbreak"||event.node.type==="linebreak")text+=" ";
    if(Buffer.byteLength(text)>16384)throw new IntentError("intent.limit.heading-bytes","Markdown heading exceeds 16384 bytes");
  }
  return text.trim();
}
function fail(code:string,message:string,line:number):never {throw new IntentError(`intent.record.${code}`,message,{line});}

export function readDocument(body:string,header:Header,offset:number,context?:RecordContext,localOnly=false):{title:string;summary:string;spec:Record<string,Json>;sections:MarkdownSection[];relationshipDetails:RelationshipDetail[];connectionDetails:ConnectionDetail[];headings:Heading[]} {
  const lines=body.split(/(?<=\n)/);
  if(lines.length>131072)throw new IntentError("intent.limit.body-lines","Markdown body exceeds 131072 lines");
  const document=new Parser({smart:false}).parse(body),nodes:Node[]=[],headings:Heading[]=[];
  let count=0;const walker=document.walker();
  for(let event=walker.next();event;event=walker.next())if(event.entering&&event.node.type==="heading"&&++count>4096)throw new IntentError("intent.limit.headings","Markdown body exceeds 4096 headings");
  for(let node=document.firstChild;node;node=node.next){nodes.push(node);if(node.type==="heading")headings.push({level:node.level,text:visibleText(node),line:node.sourcepos[0][0]+offset});}
  const first=nodes[0];
  if(first?.type!=="heading"||first.level!==1||headings.filter(item=>item.level===1).length!==1)fail("body-title","Body must begin with exactly one level-one title",offset+1);
  const title=visibleText(first);
  if(!title)fail("body-title","The level-one title must be nonempty",first.sourcepos[0][0]+offset);
  const paragraph=nodes[1];
  if(paragraph?.type!=="paragraph")fail("body-summary","The title must be followed by an opening paragraph",first.sourcepos[1][0]+offset+1);
  const summary=meaningMarkdown(lines.slice(paragraph.sourcepos[0][0]-1,paragraph.sourcepos[1][0]).join(""));
  const sections:MarkdownSection[]=[],relationshipDetails:RelationshipDetail[]=[],connectionDetails:ConnectionDetail[]=[],connectionIds=new Set<string>(),spec:Record<string,Json>={};
  const content=(start:Node,endLine:number)=>lines.slice(start.sourcepos[1][0],endLine).join("");
  const hasContent=(start:Node,endLine:number)=>nodes.some(item=>item.type!=="heading"&&item.sourcepos[0][0]>start.sourcepos[1][0]&&item.sourcepos[0][0]-1<endLine);
  const headingNodes=nodes.filter(node=>node.type==="heading");
  const h2=headingNodes.filter(node=>node.level===2);
  for(let index=0;index<h2.length;index++){
    const node=h2[index]!,endLine=h2[index+1]?h2[index+1]!.sourcepos[0][0]-1:lines.length;
    const name=visibleText(node),definition=SECTION_DEFINITIONS[header.kind].find(item=>item.name===name),markdown=content(node,endLine);
    const section:MarkdownSection={name,markdown,line:node.sourcepos[0][0]+offset,entries:[]};sections.push(section);
    if(name.startsWith("Connection:")){
      const id=name.startsWith("Connection: ")?name.slice(12):"";
      if(!id||!ENTRY_ID.test(id)||id.length>160||connectionIds.has(id))fail("connection-entry",`Invalid or duplicate Connection identity: ${name}`,section.line);
      connectionIds.add(id);
      const declarations=CONNECTION_KINDS.flatMap(kind=>(context?.connections[kind]??[]).filter(item=>item.id===id&&item.record===header.id).map(item=>({kind,item})));
      if(!localOnly&&declarations.length!==1)fail("connection-entry",`Connection ${id} must resolve exactly once in this record's global connections`,section.line);
      const value=meaningMarkdown(markdown);
      if(!value.trim())fail("connection-entry",`Connection ${id} requires nonempty Markdown`,section.line);
      const detail:Omit<ConnectionDetail,"kind">={id,markdown:value,line:section.line};
      const h3=headingNodes.filter(item=>item.level===3&&item.sourcepos[0][0]>node.sourcepos[1][0]&&item.sourcepos[0][0]-1<endLine);
      for(const [fieldIndex,fieldNode]of h3.entries()){
        const field=visibleText(fieldNode);if(field!=="Scope"&&field!=="Rationale")continue;
        const key=field==="Scope"?"scope":"rationale",fieldEnd=h3[fieldIndex+1]?h3[fieldIndex+1]!.sourcepos[0][0]-1:endLine,prose=meaningMarkdown(content(fieldNode,fieldEnd));
        if(Object.hasOwn(detail,key)||!prose.trim())fail("connection-entry",`Connection ${field} must occur once with nonempty Markdown`,fieldNode.sourcepos[0][0]+offset);
        detail[key]=prose;
      }
      if(!localOnly)connectionDetails.push({...detail,kind:declarations[0]!.kind});
      if(!localOnly&&declarations[0]!.kind==="relationships"){
        const edge=context!.connections.relationships.find(item=>item.id===id&&item.record===header.id)!;
        if(detail.scope!==undefined||detail.rationale!==undefined)relationshipDetails.push({type:edge.type,target:edge.target,...(detail.scope!==undefined?{scope:detail.scope}:{}),...(detail.rationale!==undefined?{rationale:detail.rationale}:{})});
      }
      continue;
    }
    if(name==="Relationships")fail("connection-entry","Association prose requires identified Connection sections",section.line);
    if(definition&&sections.filter(item=>item.name===name).length!==1)fail("body-section",`Body permits one level-two ${name} section`,section.line);
    const h3=headingNodes.filter(item=>item.level===3&&item.sourcepos[0][0]>node.sourcepos[1][0]&&item.sourcepos[0][0]-1<endLine);
    const prose:string[]=[],preamble=meaningMarkdown(content(node,h3[0]?h3[0].sourcepos[0][0]-1:endLine));
    if(preamble.trim())prose.push(preamble);
    const ids=new Set<string>();
    for(let entryIndex=0;entryIndex<h3.length;entryIndex++){
      const entryNode=h3[entryIndex]!,entryEnd=h3[entryIndex+1]?h3[entryIndex+1]!.sourcepos[0][0]-1:endLine;
      const key=visibleText(entryNode),entryLine=entryNode.sourcepos[0][0]+offset;
      if(!key.startsWith("entry:")){
        prose.push(meaningMarkdown(lines.slice(entryNode.sourcepos[0][0]-1,entryEnd).join("")));
        continue;
      }
      const id=key.slice(6);
      if(!id||!ENTRY_ID.test(id)||id.length>160||ids.has(id))fail("body-entry",`Invalid or duplicate entry identity: ${key}`,entryLine);
      ids.add(id);
      const entry:MarkdownEntry={id,markdown:content(entryNode,entryEnd),line:entryLine};section.entries.push(entry);
      if(!entry.markdown.trim()||!hasContent(entryNode,entryEnd))fail("body-entry",`Entry ${id} must contain Markdown`,entryLine);
      prose.push(meaningMarkdown(entry.markdown));
    }
    if(definition){
      const value=meaningMarkdown(markdown);
      if(definition.required&&(!value.trim()||!hasContent(node,endLine)))fail("body-section",`${name} must contain Markdown beyond its headings`,section.line);
      if(header.kind==="check"&&["pass","fail","indeterminate","notRun"].includes(definition.field)){
        spec.evaluation??={};(spec.evaluation as Record<string,Json>)[definition.field]=value;
      }else spec[definition.field]=definition.scalar?value:prose;
    }
  }
  for(const definition of SECTION_DEFINITIONS[header.kind])if(!sections.some(section=>section.name===definition.name)){
    if(definition.required)fail("body-section",`Body requires a level-two ${definition.name} section`,offset+1);
    spec[definition.field]=[];
  }
  if(!localOnly&&header.kind==="description")spec.coverage=structuredClone(header.coverage!) as unknown as Json;
  if(!localOnly&&header.kind==="check"){spec.subjects=structuredClone(header.subjects!) as unknown as Json;spec.evidenceKinds=structuredClone(header.evidenceKinds!);}
  return {title,summary,spec,sections,relationshipDetails,connectionDetails,headings};
}
