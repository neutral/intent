import { readFileSync, readdirSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import formats from "ajv-formats";
import type { AnySchema, ErrorObject, ValidateFunction } from "ajv";
import { parseStrictJson } from "./strict-json.js";
import { IntentError, orderedDiagnostics } from "./foundation.js";
import type { Diagnostic } from "./types.js";

const root=new URL("../../spec/schemas/", import.meta.url);
let engine: Ajv2020 | undefined;
function schemaEngine(): Ajv2020 {
  if(engine) return engine;
  const instance=new Ajv2020({allErrors:true,strict:true,strictTypes:false,strictRequired:false});
  formats.default(instance);
  // Register the complete distributed bundle, including public result carriers,
  // before resolving any entry point. References never fetch remote schemas.
  for(const file of readdirSync(root).filter(file=>file.endsWith(".schema.json")).sort()) {
    const schema=parseStrictJson(readFileSync(new URL(file,root),"utf8"),{maxBytes:4194304,maxNodes:262144});
    instance.addSchema(schema as AnySchema);
  }
  engine=instance;
  return instance;
}
export function schemaValidator(name: string): ValidateFunction {
  const current:Record<string,string>={"knowledge-record":"v2","assembled-header":"v2","discipline-pack":"v2","discipline-pack-manifest":"v2"};
  const id=name.startsWith("urn:")?name:`urn:intent:schema:${name}:${current[name]??"v1"}`;
  const validator=schemaEngine().getSchema(id);
  if(!validator) throw new IntentError("intent.schema.unsupported",`Unsupported schema ${id}`);
  return validator;
}
function issue(error: ErrorObject,path:string): Diagnostic {
  return {code:"intent.schema.invalid",severity:"error",stage:"schema",path,pointer:error.instancePath,message:`${error.instancePath || "/"} ${error.message ?? error.keyword}`};
}
export function validateSchema(name:string,value:unknown,path=""): Diagnostic[] {
  const validator=schemaValidator(name);
  if(validator(value)) return [];
  return orderedDiagnostics((validator.errors??[]).map(error=>issue(error,path)));
}
