import { compareText, digest, IntentError, normalizedPath } from "./foundation.js";
import type { SourceReader } from "./types.js";

const allowed=(path:string)=>path==="GUIDANCE.md"||/^(guidance|families)\/.+\.md$/.test(path);
/** Discover the supplied collection without assuming particular family filenames. */
export async function listGuidance(source:SourceReader) {
  const entries=(await Promise.all(["GUIDANCE.md","guidance","families"].map(prefix=>source.list(prefix)))).flat();
  if(entries.length>4096)throw new IntentError("intent.guidance.limit","Guidance discovery exceeds 4096 entries");
  const files=entries.filter(entry=>entry.kind==="file"&&allowed(entry.path)).map(({path,size})=>({path,bytes:size})).sort((a,b)=>compareText(a.path,b.path));
  return {files,interpretation:"Read shared and kind guidance, then select available families for the actual question. Family files supply advice and do not change record validity."};
}
/** Read one complete supplied guide. Never truncate its instructions. */
export async function readGuidance(source:SourceReader,path:string) {
  normalizedPath(path);
  if(!allowed(path))throw new IntentError("intent.guidance.path","Select GUIDANCE.md or a Markdown file under guidance/ or families/");
  const bytes=await source.read(path,262144);
  if(bytes.length>262144)throw new IntentError("intent.guidance.limit","One guide exceeds 256 KiB");
  let markdown:string;
  try{markdown=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw new IntentError("intent.guidance.utf8","Guidance must be UTF-8 Markdown");}
  return {path,markdown,bytes:bytes.length,sourceDigest:digest(bytes)};
}
