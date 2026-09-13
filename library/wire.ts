import { IntentError, scalarString } from "./foundation.js";
import type { Json } from "./types.js";
export interface WireBytes {encoding:"base64";data:string}
/** Portable JSON projection. Field contracts identify byte carriers; authored
 * extension objects are never implicitly decoded. String Map keys are fields. */
export function toWire(value:unknown):Json {
  const active=new Set<object>();let nodes=0;
  function visit(value:unknown,depth:number):Json {
    if(++nodes>1000000||depth>128)throw new IntentError("intent.wire.limit","Wire projection exceeds node/depth bounds");
    if(value===null||typeof value==="boolean")return value;
    if(typeof value==="string"){scalarString(value);return value;}
    if(typeof value==="number"){if(!Number.isFinite(value))throw new IntentError("intent.wire.number","Wire numbers must be finite");return value;}
    if(value instanceof Uint8Array)return {encoding:"base64",data:Buffer.from(value).toString("base64")};
    if(typeof value!=="object")throw new IntentError("intent.wire.type","Expected JSON, byte buffer, or string-keyed Map");
    if(active.has(value))throw new IntentError("intent.wire.cycle","Wire projection cannot contain cycles");active.add(value);
    try{
      if(Array.isArray(value))return value.map(item=>visit(item,depth+1));
      if(!(value instanceof Map)&&![null,Object.prototype].includes(Object.getPrototypeOf(value)))throw new IntentError("intent.wire.type","Unsupported wire object prototype");
      const result:{[key:string]:Json}=Object.create(null);
      for(const [key,item]of value instanceof Map?value:Object.entries(value)){
        if(typeof key!=="string")throw new IntentError("intent.wire.map-key","Wire Map keys must be strings");scalarString(key);result[key]=visit(item,depth+1);
      }
      return result;
    }finally{active.delete(value);}
  }
  return visit(value,0);
}
export function decodeWireBytes(value:WireBytes,maximumBytes=67108864):Uint8Array {
  // Unroll the four-character atom: nested counted repetitions exhaust V8's
  // regexp stack on supported multi-MiB byte carriers. Require the absolute end,
  // including when a malformed carrier ends with a newline.
  if(value.encoding!=="base64"||typeof value.data!=="string"||value.data.length>Math.ceil(maximumBytes/3)*4||!/^(?:[A-Za-z0-9+/][A-Za-z0-9+/][A-Za-z0-9+/][A-Za-z0-9+/])*(?:[A-Za-z0-9+/][AQgw]==|[A-Za-z0-9+/][A-Za-z0-9+/][AEIMQUYcgkosw048]=)?$(?![\s\S])/.test(value.data))throw new IntentError("intent.wire.bytes","Invalid or excessive base64 byte carrier");
  const bytes=Buffer.from(value.data,"base64");if(bytes.length>maximumBytes||bytes.toString("base64")!==value.data)throw new IntentError("intent.wire.bytes","Noncanonical or excessive base64 byte carrier");return Uint8Array.from(bytes);
}
