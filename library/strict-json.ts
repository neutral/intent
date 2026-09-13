import { IntentError, scalarString } from "./foundation.js";
import type { Json } from "./types.js";

/** A bounded JSON parser that rejects duplicate decoded keys before object construction. */
export function parseStrictJson(text: string, options: { maxBytes?: number; maxDepth?: number; maxNodes?: number } = {}): Json {
  const { maxBytes=524288, maxDepth=64, maxNodes=65536 }=options;
  if(Buffer.byteLength(text)>maxBytes) throw new IntentError("intent.limit.json-bytes", `JSON exceeds ${maxBytes} bytes`);
  scalarString(text);
  let offset=0, nodes=0;
  const fail=(message:string,code="intent.json.syntax"): never => { throw new IntentError(code,message,{line:text.slice(0,offset).split("\n").length}); };
  const whitespace=()=>{while(/[ \t\r\n]/.test(text[offset]??"_") && offset<text.length) offset++;};
  function string(): string {
    const start=offset++;
    while(offset<text.length) {
      const char=text[offset++];
      if(char === "\\") { offset++; continue; }
      if(char === '"') {
        let result:string;
        try { result=JSON.parse(text.slice(start,offset)) as string; } catch { return fail("Invalid JSON string"); }
        scalarString(result); return result;
      }
    }
    return fail("Unterminated JSON string");
  }
  function value(depth:number): Json {
    if(depth>maxDepth) return fail(`JSON exceeds depth ${maxDepth}`,"intent.limit.json-depth");
    if(++nodes>maxNodes) return fail(`JSON exceeds ${maxNodes} nodes`,"intent.limit.json-nodes");
    whitespace();
    const char=text[offset];
    if(char === '"') return string();
    if(char === "{") {
      offset++; whitespace();
      const result:Record<string,Json>=Object.create(null) as Record<string,Json>;
      const keys=new Set<string>();
      if(text[offset] === "}") {offset++;return result;}
      while(true) {
        if(text[offset] !== '"') return fail("Expected a JSON object key");
        const key=string();
        if(keys.has(key)) return fail(`Duplicate JSON key ${JSON.stringify(key)}`,"intent.json.duplicate-key");
        keys.add(key);whitespace();
        if(text[offset++]!==":") return fail("Expected a colon after object key");
        result[key]=value(depth+1);whitespace();
        if(text[offset] === "}") {offset++;return result;}
        if(text[offset++]!==",") return fail("Expected a comma or closing brace");
        whitespace();
      }
    }
    if(char === "[") {
      offset++;whitespace();const result:Json[]=[];
      if(text[offset] === "]") {offset++;return result;}
      while(true) {
        result.push(value(depth+1));whitespace();
        if(text[offset] === "]") {offset++;return result;}
        if(text[offset++]!==",") return fail("Expected a comma or closing bracket");
      }
    }
    for(const [literal, decoded] of [["true",true],["false",false],["null",null]] as const) {
      if(text.startsWith(literal,offset)) {offset+=literal.length;return decoded;}
    }
    const numeric=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(offset));
    if(numeric) {
      offset+=numeric[0].length;const number=Number(numeric[0]);
      if(!Number.isFinite(number) || (Number.isInteger(number)&&!Number.isSafeInteger(number))) return fail("JSON number is outside the supported exact domain","intent.json.number");
      return Object.is(number,-0)?0:number;
    }
    return fail("Expected a JSON value");
  }
  const result=value(1);whitespace();
  if(offset !== text.length) return fail("Unexpected content after JSON value");
  return result;
}
