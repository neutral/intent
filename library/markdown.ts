import { Parser, HtmlRenderer, Node } from "commonmark";
import { IntentError } from "./foundation.js";

/** Read-only CommonMark rendering: raw HTML and unsafe links are disabled; images become text. */
export function renderKnowledgeMarkdown(body:string,options:{omitTitle?:boolean}={}):string {
  if(typeof body!=="string"||Buffer.byteLength(body)>4194304)throw new IntentError("intent.markdown.limit","Markdown body exceeds the 4 MiB reading profile");
  const document=new Parser().parse(body),images:Node[]=[];
  const walker=document.walker();let event;
  while((event=walker.next()))if(event.entering&&event.node.type==="image")images.push(event.node);
  for(const image of images){let alt="";const children=image.walker();let child;while((child=children.next()))if(child.entering&&child.node.type==="text")alt+=child.node.literal??"";const replacement=new Node("text");replacement.literal=`[Image: ${alt||"description unavailable"}]`;image.insertBefore(replacement);image.unlink();}
  if(options.omitTitle&&document.firstChild?.type==="heading"&&document.firstChild.level===1)document.firstChild.unlink();
  return new HtmlRenderer({safe:true}).render(document);
}
