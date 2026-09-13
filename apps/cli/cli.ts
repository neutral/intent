import { fileURLToPath } from "node:url";
import { listGuidance, readGuidance } from "../../library/guidance.js";
import { FileSystemSource, readWorkspace, queryKnowledge, selectKnowledge, compareWorkspaces, IntentError, toWire, validateSchema, applyFileProposal, parseStrictJson, buildDisciplinePack, validateDisciplinePack, proposeRepositoryAdoption, proposeRecordChange, proposeInitialization, createRecordTemplate, proposeRecordCreation, type Kind, type RecordTemplateOptions, type InitializationRequest, type RecordCreationRequest, type RecordChangeRequest, type FileProposal, type DisciplineAdoptionProposalOptions } from "../../library/index.js";
import { startEditor } from "../editor/server.js";
import { intentVersion } from "../../library/installation.js";
import { discoverProjectRoot } from "../../library/project-location.js";
import { intentInvocation, manageService, openBrowser } from "./runtime.js";
import { buildPortal, type PortalSelection } from "../portal/build.js";
import { startPortalPreview, writePortal } from "../portal/export.js";
import { open, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { runAgent } from "../agent/agent.js";
import { inspectOperation,discardOperation,proposeOperationResume,inspectAuthoringLock,releaseAbandonedAuthoringLock,type AuthoringLockInspection } from "../../library/index.js";
import { proposeRepositoryDisciplineRemoval } from "../../library/index.js";
import { readCheck, type CheckReading } from "../../library/index.js";

function checkMarkdown(reading: CheckReading): string {
  const check = reading.check;
  const parts = [
    `Check ${check.id} · ${check.status}\nSource: ${check.path}`,
    `Reading: ${reading.valid ? "valid" : reading.complete ? "invalid" : "incomplete"}. Workspace: ${reading.context.valid ? "valid" : reading.context.complete ? "invalid" : "incomplete"}.`,
    `Subjects:\n\n${check.subjects.map(subject => `- ${subject.kind}: ${subject.selector}`).join("\n")}\n\nEvidence kinds: ${check.evidenceKinds.join(", ")}`,
    check.body,
    "## Supported Knowledge",
  ];
  if (!reading.supportedKnowledge.length) parts.push("No directly supported current Knowledge is attached to this occurrence.");
  for (const support of reading.supportedKnowledge) {
    const { knowledge, relationship } = support;
    parts.push(`${knowledge.id} · ${knowledge.status}\nSource: ${knowledge.path}\nverified-by ${relationship.target} · ${relationship.required ? "required" : "optional"}\nSource resolution: ${support.sourceResolution}; target resolution: ${support.targetResolution}`);
    if (relationship.scope !== null) parts.push(`Relationship scope:\n\n${relationship.scope}`);
    if (relationship.rationale !== null) parts.push(`Relationship rationale:\n\n${relationship.rationale}`);
    parts.push(knowledge.body);
  }
  parts.push("## Reading limits", ...reading.limitations);
  const diagnostics = [...reading.diagnostics, ...reading.context.diagnostics];
  if (diagnostics.length) parts.push("## Diagnostics", ...[...new Set(diagnostics.map(issue => `${issue.severity} ${issue.path}: ${issue.message} [${issue.code}]`))]);
  return parts.join("\n\n") + "\n";
}

const usage=`Intent — maintain software Knowledge in an ordinary project

  intent open [project] [--port NUMBER] [--state-dir DIRECTORY] [--no-browser]
              [--bind ADDRESS --origin URL]
  intent export [project] --selection FILE --output DIRECTORY [--preview]
  intent export [project] --selection FILE --dry-run [--preview] [--no-browser]
  intent mcp <project>

  intent guidance [guide-path] [--json]
  intent reconcile [root] [--json] [--resolve-sources]
  intent inspect [root] [--json] [--resolve-sources]
  intent validate [root] [--json] [--resolve-sources]
  intent query [root] [text] [--json]
  intent read [root] <record-id> [--json]
  intent read-check <root> <check-id> [--json]
  intent select [root] <record-id>... [--json]
  intent compare <before-root> <after-root> [--json]
  intent apply <root> <reviewed-proposal.json> [--json]
  intent pack-validate <pack-root> [--json]
  intent pack-build <pack-root> --json
  intent adopt-propose <root> <request.json> --json
  intent change-propose <root> <request.json> --json
  intent init-propose <root> <request.json> --json [--resolve-sources]
  intent template <kind> <options.json> [--json]
  intent create-propose <root> <request.json> --json [--resolve-sources]
  intent operation <root> <operation-id> [--json]
  intent resume-propose <root> <operation-id> --json [--resolve-sources]
  intent operation-discard <root> <inspection.json> [--json]
  intent lock-inspect <root> [--json]
  intent lock-release <root> <inspected-lock.json> [--json]
  intent remove-adoption-propose <root> <request.json> --json

Open defaults to the current directory and discovers a containing Intent project.
The browser offers initialization; files change only after review and explicit apply.
Export requires an explicit recordIds selection and creates a new static site directory.
Use --dry-run to review selected output without writing; --preview opens a local reader.
Open and preview stop with Ctrl+C. Use --no-browser to print the URL only.
Native installation: intent uninstall removes installed versions; project files and durable drafts are retained.
Compatibility aliases: intent editor, intent agent, intent-editor, intent-agent, intent-portal.
Intent maintains Knowledge definitions; implementation and verification belong to the implementation area.
Read operations do not fetch external URLs.
Machine JSON includes full fingerprints; ordinary output uses IDs and states.
Preparation writes no files. Apply the reviewed fileProposal with the same --resolve-sources choice.
Templates require ID, title and owners; Description also requires coverage, Check requires subjects.
Adoption and removal proposals examine local sources; apply them with --resolve-sources.
`;
function options(args: string[], values: string[], flags: string[]): { positional: string[]; values: Map<string, string>; flags: Set<string> } {
  const parsed = { positional: [] as string[], values: new Map<string, string>(), flags: new Set<string>() };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--") { parsed.positional.push(...args.slice(index + 1)); break; }
    if (values.includes(argument)) {
      const value = args[++index];
      if (!value || value.startsWith("--") || parsed.values.has(argument)) throw new IntentError("intent.cli.argument", `${argument} requires one value`);
      parsed.values.set(argument, value);
    } else if (flags.includes(argument)) {
      if (parsed.flags.has(argument)) throw new IntentError("intent.cli.argument", `Repeated option ${argument}`);
      parsed.flags.add(argument);
    } else if (argument.startsWith("--")) throw new IntentError("intent.cli.argument", `Unknown option ${argument}`);
    else parsed.positional.push(argument);
  }
  return parsed;
}
function portOption(value: string | undefined): { port?: number } {
  if (value === undefined) return {};
  if (!/^(0|[1-9][0-9]*)$/.test(value) || Number(value) > 65535) throw new IntentError("intent.cli.argument", "--port requires an integer from 0 to 65535; 0 selects an available port");
  return { port: Number(value) };
}
async function browserMessage(url: string, disabled: boolean): Promise<void> {
  if (!disabled && !await openBrowser(url)) process.stderr.write(`The browser could not be opened automatically. Open ${url} in your browser.\n`);
}
async function openCommand(args: string[]): Promise<number> {
  const parsed = options(args, ["--port", "--state-dir", "--bind", "--origin"], ["--no-browser"]);
  if (parsed.positional.length > 1) throw new IntentError("intent.cli.argument", "open accepts one optional project directory");
  const selected = await discoverProjectRoot(parsed.positional[0] ?? ".");
  const stateDirectory = parsed.values.get("--state-dir"), bind = parsed.values.get("--bind"), publicOrigin = parsed.values.get("--origin");
  const service = await startEditor(selected, { ...portOption(parsed.values.get("--port")), ...(stateDirectory ? { stateDirectory } : {}), ...(bind ? { bind } : {}), ...(publicOrigin ? { publicOrigin } : {}), command: intentInvocation() });
  manageService(service);
  process.stdout.write(`Intent ready: ${service.url}\nProject: ${service.root}\nListening: ${service.listenUrl ?? service.url}\nPress Ctrl+C to stop.\n`);
  await browserMessage(service.url, parsed.flags.has("--no-browser"));
  return 0;
}
async function readSelection(path: string): Promise<PortalSelection> {
  const maximum = 1048576, file = await open(path, fsConstants.O_RDONLY | fsConstants.O_NONBLOCK);
  try {
    const info = await file.stat();
    if (!info.isFile()) throw new IntentError("intent.cli.argument", "The export selection must be a regular JSON file");
    if (info.size > maximum) throw new IntentError("intent.cli.argument", "The export selection exceeds 1 MiB");
    const bytes = Buffer.alloc(maximum + 1);
    let size = 0;
    while (size < bytes.length) {
      const read = await file.read(bytes, size, bytes.length - size, null);
      if (!read.bytesRead) break;
      size += read.bytesRead;
    }
    if (size > maximum) throw new IntentError("intent.cli.argument", "The export selection exceeds 1 MiB");
    return parseStrictJson(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, size)), { maxBytes: maximum }) as unknown as PortalSelection;
  } finally { await file.close(); }
}
async function exportCommand(args: string[]): Promise<number> {
  const parsed = options(args, ["--selection", "--output", "--title", "--port"], ["--dry-run", "--preview", "--no-browser", "--json"]);
  let [root = ".", legacySelection, legacyOutput] = parsed.positional;
  if (parsed.positional.length > 3 || (parsed.positional.length > 1 && (parsed.positional.length !== 3 || parsed.values.has("--selection") || parsed.values.has("--output")))) throw new IntentError("intent.cli.argument", "export accepts [project] --selection FILE --output DIRECTORY, or project selection.json directory");
  const selectionPath = parsed.values.get("--selection") ?? legacySelection;
  const output = parsed.values.get("--output") ?? legacyOutput;
  if (!selectionPath) throw new IntentError("intent.cli.argument", "export requires --selection FILE containing an explicit recordIds array");
  if (!output && !parsed.flags.has("--dry-run")) throw new IntentError("intent.cli.argument", "export requires an explicit --output DIRECTORY; use --dry-run to review without writing");
  if (parsed.values.has("--port") && !parsed.flags.has("--preview")) throw new IntentError("intent.cli.argument", "--port applies only to --preview");
  const port = portOption(parsed.values.get("--port"));
  root = await discoverProjectRoot(root);
  const source = await FileSystemSource.open(root), workspace = await readWorkspace(source);
  const selection = await readSelection(selectionPath);
  const title = parsed.values.get("--title") ?? "Intent publication";
  const plan = await buildPortal(workspace, source, selection, { title });
  if (!plan.complete || !plan.manifest) throw new IntentError("intent.portal.incomplete", plan.diagnostics.map(issue => issue.message).join("\n") || "Selected site could not be prepared");
  const destination = parsed.flags.has("--dry-run") ? null : await writePortal(plan, output!);
  const result = { destination, selection: plan.manifest.selection, records: plan.manifest.records.map(record => ({ id: record.id, path: record.path })), omissions: plan.manifest.omissions, files: plan.manifest.outputs, uploaded: false };
  if (parsed.flags.has("--json")) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  else {
    process.stdout.write(`${destination ? `Site exported: ${destination}` : "Site preview prepared; no files written."}\nSelected ${plan.manifest.records.length} records; ${plan.manifest.omissions.length} omitted references.\n`);
    for (const record of plan.manifest.records) process.stdout.write(`  ${record.id} (${record.path})\n`);
    process.stdout.write("Static reader only. Export does not upload, deploy or perform Checks.\n");
  }
  if (parsed.flags.has("--preview")) {
    const service = await startPortalPreview(plan, port);
    manageService(service);
    // JSON mode keeps stdout a single parseable result.
    (parsed.flags.has("--json") ? process.stderr : process.stdout).write(`Site preview: ${service.url}\nPress Ctrl+C to stop.\n`);
    await browserMessage(service.url, parsed.flags.has("--no-browser"));
  }
  return 0;
}
export async function main(args:string[]):Promise<number> {
  if(!args.length||args.includes("--help")||args[0]==="help"){process.stdout.write(usage);return 0;}
  if(args[0]==="--version"){process.stdout.write(intentVersion()+"\n");return 0;}
  if(args[0]==="open"||args[0]==="editor")return openCommand(args.slice(1));
  if(args[0]==="export")return exportCommand(args.slice(1));
  if(args[0]==="mcp"||args[0]==="agent"){
    if(args.length!==2||!args[1]||args[1].startsWith("--"))throw new IntentError("intent.cli.argument","mcp requires one explicit project root: intent mcp PROJECT");
    await runAgent(args[1]);return 0;
  }
  const json=args.includes("--json"),resolveSources=args.includes("--resolve-sources"),reconcileImplementation=args.includes("--reconcile")||args[0]==="reconcile";
  const unknown=args.find(arg=>arg.startsWith("--")&&!['--json','--resolve-sources','--reconcile'].includes(arg));
  if(unknown)throw new IntentError("intent.cli.argument",`Unknown option ${unknown}`);
  const [command,root=".",...rest]=args.filter(arg=>!arg.startsWith("--"));
  const print=(value:unknown)=>process.stdout.write(JSON.stringify(toWire(value),null,2)+"\n");
  if(command==="guidance"){
    if(rest.length)throw new IntentError("intent.cli.argument","guidance accepts one optional discovered path");
    const supplied=await FileSystemSource.open(fileURLToPath(new URL("../../../spec/",import.meta.url)));
    if(root===".")print(await listGuidance(supplied));
    else {const guide=await readGuidance(supplied,root);if(json)print(guide);else process.stdout.write(guide.markdown);}
    return 0;
  }
  if(command==="remove-adoption-propose"){
    if(rest.length!==1)throw new IntentError("intent.cli.argument","remove-adoption-propose requires a JSON request with explicit adopted Discipline IDs");
    const request=parseStrictJson(await readFile(rest[0]!,"utf8"),{maxBytes:4000000,maxNodes:262144}) as unknown as {ids:string[];removeWorkTypeMemberships?:boolean};
    const result=await proposeRepositoryDisciplineRemoval(await FileSystemSource.open(root),request);print(result);return result.fileProposal?0:1;
  }
  if(command==="operation"||command==="resume-propose"){
    if(rest.length!==1)throw new IntentError("intent.cli.argument",`${command} requires an operation ID`);
    print(command==="operation"?await inspectOperation(root,rest[0]!):await proposeOperationResume(root,rest[0]!,{workspaceOptions:{resolveSources,reconcileImplementation}}));return 0;
  }
  if(command==="operation-discard"){
    if(rest.length!==1)throw new IntentError("intent.cli.argument","operation-discard requires the saved operation inspection JSON");
    const inspected=parseStrictJson(await readFile(rest[0]!,"utf8"),{maxBytes:4000000,maxNodes:262144}) as unknown as Parameters<typeof discardOperation>[1];
    if(validateSchema("urn:intent:schema:authoring-results:v1#/$defs/operationInspection",inspected).length)throw new IntentError("intent.cli.argument","Use the exact current operation inspection JSON");
    print(await discardOperation(root,{id:inspected.id,journalDigest:inspected.journalDigest}));return 0;
  }
  if(command==="lock-inspect"){
    if(rest.length)throw new IntentError("intent.cli.argument","lock-inspect requires only the repository root");
    print(await inspectAuthoringLock(root));return 0;
  }
  if(command==="lock-release"){
    if(rest.length!==1)throw new IntentError("intent.cli.argument","lock-release requires the exact saved lock inspection JSON");
    const inspection=parseStrictJson(await readFile(rest[0]!,"utf8"),{maxBytes:4096}) as unknown as AuthoringLockInspection;
    print(await releaseAbandonedAuthoringLock(root,inspection));return 0;
  }
  if(command==="template"){
    if(rest.length!==1)throw new IntentError("intent.cli.argument","template requires a kind and an options JSON file");
    const options=parseStrictJson(await readFile(rest[0]!,"utf8")) as unknown as RecordTemplateOptions;
    const template=createRecordTemplate(root as Kind,options);print(json?{kind:root,...template}:template);return 0;
  }
  if(command==="init-propose"||command==="create-propose"){
    if(rest.length!==1)throw new IntentError("intent.cli.argument",`${command} requires a request JSON file`);
    const request=parseStrictJson(await readFile(rest[0]!,"utf8"),{maxBytes:4000000,maxNodes:262144});
    const source=await FileSystemSource.open(root);
    const result=command==="init-propose"?await proposeInitialization(source,request as unknown as InitializationRequest,{workspaceOptions:{resolveSources,reconcileImplementation}}):await proposeRecordCreation(source,{...request as unknown as RecordCreationRequest,workspaceOptions:{resolveSources,reconcileImplementation}});
    print(result);return result.fileProposal?0:1;
  }
  if(command==="apply"){
    if(rest.length!==1)throw new IntentError("intent.cli.argument","apply requires a reviewed proposal JSON file");
    const proposal=parseStrictJson(await readFile(rest[0]!,"utf8"),{maxBytes:4000000,maxNodes:262144}) as unknown as FileProposal;
    const result=await applyFileProposal(root,proposal,{workspaceOptions:{resolveSources,reconcileImplementation}});print(result);return result.status==="completed"?0:1;
  }
  if(command==="pack-validate"||command==="pack-build"){
    const source=await FileSystemSource.open(root);
    if(rest.length)throw new IntentError("intent.cli.argument",`${command} requires only a Pack root`);
    const result=command==="pack-build"?await buildDisciplinePack(source):await validateDisciplinePack(source);
    if(json)print(result);else{process.stdout.write(`${result.definition?.title??root}: ${result.valid?"valid":result.complete?"invalid":"incomplete"}\n`);for(const diagnostic of result.diagnostics)process.stdout.write(diagnostic.message+"\n");}
    return result.valid?0:1;
  }
  if(command==="adopt-propose"){
    if(rest.length!==1)throw new IntentError("intent.cli.argument","adopt-propose requires request.json containing packRoot and adoption options");
    const request=parseStrictJson(await readFile(rest[0]!,"utf8")) as unknown as DisciplineAdoptionProposalOptions&{packRoot:string};
    if(typeof request.packRoot!=="string")throw new IntentError("intent.cli.argument","Adoption request requires an explicit packRoot");
    const {packRoot,...options}=request;
    const result=await proposeRepositoryAdoption(await FileSystemSource.open(root),await FileSystemSource.open(packRoot),options);print(result);return result.fileProposal?0:1;
  }
  if(command==="change-propose"){
    if(rest.length!==1)throw new IntentError("intent.cli.argument","change-propose requires a request JSON file");
    const request=parseStrictJson(await readFile(rest[0]!,"utf8"),{maxBytes:4000000,maxNodes:262144}) as unknown as RecordChangeRequest;
    if(!request||typeof request!=="object"||Array.isArray(request)||Object.keys(request).some(key=>!["path","operation"].includes(key)))throw new IntentError("intent.cli.argument","change-propose accepts path and operation; select source resolution with --resolve-sources");
    const result=await proposeRecordChange(await FileSystemSource.open(root),{...request,workspaceOptions:{resolveSources,reconcileImplementation}});print(result);return result.fileProposal?0:1;
  }
  if(!["inspect","validate","reconcile","query","read","read-check","select","compare"].includes(command!)) throw new IntentError("intent.cli.command",`Unknown command ${command}`);
  const workspace=await readWorkspace(await FileSystemSource.open(root),{resolveSources,reconcileImplementation});
  if(command==="read-check") {
    if(rest.length!==1) throw new IntentError("intent.cli.argument","read-check requires one current Check ID after the root");
    const reading=readCheck(workspace,rest[0]!,{maxBytes:16777216});
    if(json)print(reading);else process.stdout.write(checkMarkdown(reading));
    return 0;
  }
  let value:unknown=workspace;
  if(command==="query") value=queryKnowledge(workspace,{text:rest.join(" ")});
  if(command==="read") {
    if(rest.length!==1) throw new IntentError("intent.cli.argument","read requires one record ID after the root");
    const candidates=workspace.records.filter(r=>r.header.id===rest[0]);
    if(!candidates.length)throw new IntentError("intent.query.missing",`Record ${rest[0]} not found`);
    value={basis:workspace.sourceBasis,records:candidates};
    if(!json){for(const record of candidates)process.stdout.write(record.sourceText);return 0;}
  }
  if(command==="select") {if(!rest.length)throw new IntentError("intent.cli.argument","select requires one or more record IDs after the root");value=selectKnowledge(workspace,rest);}
  if(command==="compare") {if(rest.length!==1)throw new IntentError("intent.cli.argument","compare requires exactly two roots");value=compareWorkspaces(workspace,await readWorkspace(await FileSystemSource.open(rest[0]!),{resolveSources,reconcileImplementation}));}
  if(json)print(value);
  else if(command==="inspect"||command==="validate"||command==="reconcile") {
    process.stdout.write(`${workspace.config?.name??root}: ${workspace.valid?"valid":workspace.complete?"invalid":"incomplete"}\n`);
    for(const stage of workspace.stages)process.stdout.write(`  ${stage.name}: ${stage.valid?"valid":stage.complete?"invalid":"incomplete"}\n`);
    for(const record of workspace.records)process.stdout.write(`  ${record.header.id} · ${record.header.status}\n`);
    for(const finding of workspace.diagnostics)process.stdout.write(`${finding.severity} ${finding.path}: ${finding.message} [${finding.code}]\n`);
  } else if(command==="compare"){
    const comparison=value as ReturnType<typeof compareWorkspaces>;
    for(const change of comparison.changes)process.stdout.write(`${change.change} ${change.path}\n`);
    process.stdout.write(`Affected: ${comparison.affectedIds.join(", ")||"none"}\n`);
  }else{
    for(const record of (value as {records:typeof workspace.records}).records) process.stdout.write(`${record.header.id} · ${record.header.status}\n  ${record.summary}\n`);
  }
  return command==="validate"&&!workspace.valid?workspace.complete?1:2:0;
}
