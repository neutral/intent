import { useEffect, useState } from "react";
import { Link, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { State } from "../../sheet/marks";
import { api, configurationPaths, downloadJson, draftSaves, lines, type Observed, type SavedRecovery } from "./api";
import { Action, Actions, Area, Check, Choice, Field, Fold, Intro, Pre } from "./controls";
import { requireResolved, useEditor } from "./context";
import { ConflictPanel, EditStatus } from "./editing";
import { WorkspaceReview } from "./review";

/** Carriers from the service are drawn here, not modelled. */
type Value = any;

export function Home() {
  return <Intro cap="Repository Knowledge" title="Understand what this code is for.">Select a record to read its meaning, or create a proposed Product draft with explicit placeholders.</Intro>;
}

export function Initialization() {
  const editor = useEditor();
  const [name, setName] = useState(""), [owners, setOwners] = useState(""), [roots, setRoots] = useState(""), [description, setDescription] = useState("");
  const change = (set: (value: string) => void) => (value: string) => { set(value); editor.markDirty(); };
  return (
    <>
      <Intro cap="Set up this repository" title="Start with an explicit scope.">Choose the project owners and implementation roots. Review the proposed files before applying them. Existing Intent content is preserved.</Intro>
      <div className="form">
        <Field label="Project name" value={name} onChange={change(setName)} placeholder="My project" />
        <Area label="Owners — one declared role or principal per line" value={owners} onChange={change(setOwners)} placeholder="maintainer" />
        <Area label="Implementation roots — one exact repository path per line" value={roots} onChange={change(setRoots)} placeholder="src"
          description="Leaving implementation roots empty declares an empty adopted scope. Selecting a root does not explain its code; draft Descriptions do not supply current ownership." />
        <Area label="Project description (optional)" value={description} onChange={change(setDescription)} />
        <Actions>
          <Action variant="primary" onAction={async () => {
            const request = { name, owners: lines(owners), implementationRoots: lines(roots), ...(description ? { description } : {}) };
            const prepared = await api("/api/initialize", { sourceBasis: editor.workspace.sourceBasis.id, request });
            editor.review(prepared.fileProposal, prepared);
          }}>Review initialization</Action>
        </Actions>
      </div>
    </>
  );
}

interface SelectorRow { key: number; kind: string; value: string }
let rowKeys = 0;

function Selectors({ label, kinds, rows, onChange }: { label: string; kinds: string[]; rows: SelectorRow[]; onChange: (rows: SelectorRow[]) => void }) {
  const options = kinds.map(kind => ({ id: kind, name: kind }));
  return (
    <section className="selectors" aria-labelledby={`selectors-${label}`}>
      <h2 id={`selectors-${label}`} className="cap">{label}</h2>
      {rows.map(row => (
        <div key={row.key} className="selector-row">
          <Choice label={`${label} type`} labelHidden value={row.kind} options={options} onChange={kind => onChange(rows.map(item => item === row ? { ...item, kind } : item))} />
          <Field label={`${label} path or selector`} value={row.value} placeholder="Choose an exact repository-relative path or subject" onChange={value => onChange(rows.map(item => item === row ? { ...item, value } : item))} />
          <Action onAction={() => onChange(rows.filter(item => item !== row))}>Remove</Action>
        </div>
      ))}
      <Actions><Action onAction={() => onChange([...rows, { key: ++rowKeys, kind: kinds[0]!, value: "" }])}>{`Add ${label.toLowerCase()}`}</Action></Actions>
    </section>
  );
}

const kinds = ["behavior", "assurance", "blueprint", "description", "check"];

export function Creation() {
  const editor = useEditor();
  const config = editor.workspace.config!;
  const [kind, setKind] = useState("behavior"), [id, setId] = useState(""), [title, setTitle] = useState(""), [path, setPath] = useState("");
  const [owners, setOwners] = useState(config.owners.join("\n"));
  const [rows, setRows] = useState<SelectorRow[]>([]);
  const change = <T,>(set: (value: T) => void) => (value: T) => { set(value); editor.markDirty(); };
  const selectorKinds = kind === "description" ? ["file", "tree"] : kind === "check" ? ["file", "tree", "repository", "record", "diff", "artifact"] : [];
  return (
    <>
      <Intro cap="New Product draft" title="Propose a new piece of Knowledge.">A template starts at draft with visible placeholders. It creates a proposed definition, for review before it becomes a current promise.</Intro>
      <div className="form">
        <Choice label="Product kind" value={kind} options={kinds.map(value => ({ id: value, name: value }))}
          onChange={value => { setKind(value); setRows(value === "description" || value === "check" ? [{ key: ++rowKeys, kind: "file", value: "" }] : []); editor.markDirty(); }} />
        <Field label="Stable record ID" value={id} onChange={change(setId)} placeholder={`${kind}.checkout`} />
        <Field label="Title" value={title} onChange={change(setTitle)} />
        <Field label="Record path" value={path} onChange={change(setPath)} placeholder={kind === "description" ? "intent/description/src/_checkout.desc.md" : `intent/${kind === "check" ? "checks" : kind}/checkout.md`} />
        <Area label="Owners — declared project owners, one per line" value={owners} onChange={change(setOwners)} />
        {kind === "description" ? <p className="note">Select literal proposed primary coverage. Use a filename beginning with _ and ending with .desc.md in the matching shadow directory, for example intent/description/src/_checkout.desc.md for code in src/. No code meaning is inferred.</p> : null}
        {kind === "check" ? <p className="note">Describe the proposed subjects and verification requirements. The implementation area decides how to perform verification and report satisfaction; Intent maintains the definition.</p> : null}
        {selectorKinds.length ? <Selectors label={kind === "description" ? "Coverage" : "Subject"} kinds={selectorKinds} rows={rows} onChange={change(setRows)} /> : null}
        <Actions>
          <Action variant="primary" onAction={async () => {
            const request: Record<string, unknown> = { kind, id, title, path, owners: lines(owners) };
            if (kind === "description") request.coverage = rows.map(row => ({ path: row.value, mode: row.kind, role: "primary" }));
            if (kind === "check") request.subjects = rows.map(row => ({ kind: row.kind, selector: row.value }));
            const prepared = await api("/api/create", { sourceBasis: editor.workspace.sourceBasis.id, request });
            editor.review(prepared.fileProposal, { ...prepared, createdPath: path });
          }}>Review draft template</Action>
          <Action variant="danger" onAction={() => editor.leave()}>Discard new draft</Action>
        </Actions>
      </div>
    </>
  );
}

export function Configuration() {
  const editor = useEditor();
  const [picked, setPicked] = useState(configurationPaths[0]!);
  const open = editor.edit?.kind === "configuration" ? editor.edit : null;
  return (
    <>
      <Intro cap="Project configuration" title="Review scope and local choices.">These authored JSON files own Description coverage scope and advisory adoption choices. Review the proposed bytes before applying.</Intro>
      <div className="row">
        <Choice label="Configuration file" value={picked} onChange={setPicked} options={configurationPaths.map(path => ({ id: path, name: path }))} />
        <Actions>
          <Action onAction={async () => {
            if (editor.unsaved) throw new Error("Apply or discard the open edit first.");
            const observed = await api<Observed>(`/api/edit-state?path=${encodeURIComponent(picked)}`);
            editor.setWorkspace(observed.workspace);
            editor.startEdit({ kind: "configuration", path: picked, before: observed.source, beforeContext: null, beforeMetadata: null, source: observed.source ?? "", metadata: null, conflict: null, repair: false });
          }}>Read configuration</Action>
        </Actions>
      </div>
      {open ? (
        <section className="editing" aria-labelledby="configuration-title">
          <h2 id="configuration-title" className="path-title">{open.path}</h2>
          <ConflictPanel />
          <Area label="Configuration source" source rows={20} value={open.source} onChange={value => editor.changeEdit(current => ({ ...current, source: value }), true)} />
          <EditStatus />
          <Actions>
            <Action variant="primary" onAction={async () => {
              requireResolved(open);
              editor.review(await api("/api/propose", { path: open.path, before: open.before, after: open.source, sourceBasis: editor.workspace.sourceBasis.id }));
            }}>Review configuration change</Action>
            <Action variant="danger" onAction={() => editor.discardEdit()}>Discard configuration edit</Action>
          </Actions>
        </section>
      ) : null}
    </>
  );
}

export function Practices() {
  const editor = useEditor();
  const { workspace } = editor;
  const [root, setRoot] = useState("");
  const [inspection, setInspection] = useState<{ root: string; response: Value } | null>(null);
  const [source, setSource] = useState(""), [revision, setRevision] = useState("");
  const [chosen, setChosen] = useState<Record<string, boolean>>({}), [targets, setTargets] = useState<Record<string, string>>({});
  const [removals, setRemovals] = useState<Record<string, boolean>>({}), [memberships, setMemberships] = useState(false);
  const dirtyChange = <T,>(set: (value: T) => void) => (value: T) => { set(value); editor.markDirty(); };
  if (!workspace.config) return (
    <>
      <Intro cap="Advisory practices" title="Choose guidance deliberately." />
      <p className="attention"><span className="mark" aria-hidden="true">△</span>Initialize Intent before adopting practices.</p>
    </>
  );
  const registry = workspace.disciplines?.registry;
  const pack = inspection?.response.pack;
  return (
    <>
      <Intro cap="Advisory practices" title="Choose guidance deliberately.">Inspect an exact local Pack, read its practices, and select target copies. Guidance remains optional. Current selected copies and publisher references are reviewed together.</Intro>
      <div className="form">
        <Field label="Local Pack directory" value={root} onChange={setRoot} placeholder="/path/to/catalog/packs/example" />
        <Actions>
          <Action onAction={async () => {
            const selectedRoot = root, response = await api("/api/pack", { root: selectedRoot });
            setInspection({ root: selectedRoot, response });
            setSource(response.source); setRevision(response.pack.definition?.version ?? "");
            setChosen({}); setTargets({});
          }}>Inspect selected Pack</Action>
        </Actions>
      </div>
      {inspection && pack ? (
        <section className="pack" aria-labelledby="pack-title">
          <h2 id="pack-title" className="part">{pack.definition?.title ?? "Pack inspection"}</h2>
          {pack.diagnostics.length ? (
            <ul className="findings">
              {pack.diagnostics.map((issue: Value, index: number) => (
                <li key={index} className={`finding ${issue.severity}`}>
                  <State mark={issue.severity} attention={issue.severity !== "info"}>{issue.severity}</State>
                  <p className="message">{issue.message}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {!pack.valid ? <p className="attention"><span className="mark" aria-hidden="true">✕</span>This supplied Pack cannot be adopted until its inspection succeeds.</p> : (
            <div className="form">
              <Field label="Publisher source reference" value={source} onChange={dirtyChange(setSource)} />
              <Field label="Selected publisher release or revision" value={revision} onChange={dirtyChange(setRevision)} />
              <p>{`${pack.records.length} practices · version ${pack.definition.version} · publisher ${pack.definition.publisher}`}</p>
              {pack.definition.sets.length ? (
                <Actions>
                  {pack.definition.sets.map((set: Value) => (
                    <Action key={set.id ?? set.title} onAction={() => { setChosen(Object.fromEntries(pack.records.map((record: Value) => [record.header.id, set.recordIds.includes(record.header.id)]))); editor.markDirty(); }}>{`Select Set: ${set.title}`}</Action>
                  ))}
                </Actions>
              ) : null}
              <ul className="practices">
                {pack.records.map((record: Value) => {
                  const id = record.header.id;
                  const target = targets[id] ?? registry?.adoptions.find(choice => choice.id === id)?.path ?? `intent/disciplines/${id.slice("discipline.".length)}.md`;
                  return (
                    <li key={id} className="practice">
                      <Check isSelected={chosen[id] ?? false} onChange={selected => dirtyChange(setChosen)({ ...chosen, [id]: selected })}>{`Select ${id}`}</Check>
                      <Fold title={<span className="record-title">{record.title}</span>}>
                        <p className="person">{record.summary}</p>
                        <Pre kind="raw">{record.sourceText}</Pre>
                      </Fold>
                      <Field label={`Target path for ${id}`} value={target} onChange={value => dirtyChange(setTargets)({ ...targets, [id]: value })} />
                    </li>
                  );
                })}
              </ul>
              <Actions>
                <Action variant="primary" onAction={async () => {
                  const selected = pack.records.filter((record: Value) => chosen[record.header.id]);
                  if (!selected.length) throw new Error("Select at least one practice.");
                  const request = { source, revision, choices: selected.map((record: Value) => ({ id: record.header.id, packId: pack.definition.id, packVersion: pack.definition.version, path: targets[record.header.id] ?? registry?.adoptions.find(choice => choice.id === record.header.id)?.path ?? `intent/disciplines/${record.header.id.slice("discipline.".length)}.md` })) };
                  const prepared = await api("/api/adopt", { packRoot: inspection.root, sourceBasis: workspace.sourceBasis.id, request });
                  editor.review(prepared.fileProposal, prepared);
                }}>Review selected adoption or update</Action>
              </Actions>
            </div>
          )}
        </section>
      ) : null}
      {registry?.adoptions.length ? (
        <section className="removal" aria-labelledby="removal-title">
          <h2 id="removal-title" className="part">Current target choices</h2>
          {registry.adoptions.map(choice => (
            <Check key={choice.id} isSelected={removals[choice.id] ?? false} onChange={selected => dirtyChange(setRemovals)({ ...removals, [choice.id]: selected })}>{`${choice.id} · ${choice.packId} ${choice.packVersion}`}</Check>
          ))}
          <Check isSelected={memberships} onChange={dirtyChange(setMemberships)}>Include affected Work Type memberships and remove emptied groups</Check>
          <Actions>
            <Action onAction={async () => {
              const ids = registry.adoptions.filter(choice => removals[choice.id]).map(choice => choice.id);
              if (!ids.length) throw new Error("Select at least one adopted practice.");
              const prepared = await api("/api/remove-adoption", { ids, removeWorkTypeMemberships: memberships, sourceBasis: workspace.sourceBasis.id });
              editor.review(prepared.fileProposal, prepared);
            }}>Review selected removals</Action>
          </Actions>
        </section>
      ) : null}
      <Actions><Action variant="danger" onAction={() => editor.leave()}>Discard practice choices</Action></Actions>
    </>
  );
}

export function Comparison() {
  const editor = useEditor();
  const [state, setState] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ limitations: string } | { review: Value } | null>(null);
  const label = state ?? editor.comparisonLabel ?? "No baseline has been retained from this browser view. A baseline retained by this service can still be compared.";
  return (
    <>
      <Intro cap="Repository comparison" title="Review code with its meaning.">Retain an original observation before editing through repository tools. Compare it with a later observation to inspect code, Knowledge, scope and coverage together. No source files are written.</Intro>
      <p className="baseline" role="status">{label}</p>
      <Actions>
        <Action onAction={async () => {
          const result = await api("/api/comparison", { action: "retain", sourceBasis: editor.workspace.sourceBasis.id });
          const text = `Original observation retained ${result.observedAt} · ${result.records} records · ${result.sizeBytes} bytes`;
          editor.setComparisonLabel(text); setState(text); setPanel({ limitations: result.limitations.join(" ") });
        }}>Retain current review baseline</Action>
        <Action variant="primary" onAction={async () => {
          const result = await api("/api/comparison", { action: "compare" });
          const text = `Comparing with original observation retained ${result.observedAt}`;
          editor.setComparisonLabel(text); setState(text); setPanel({ review: result.review });
        }}>Compare with repository now</Action>
        <Action variant="danger" onAction={async () => {
          await api("/api/comparison", { action: "release" });
          editor.setComparisonLabel(null); setState("The service no longer retains a comparison baseline."); setPanel(null);
        }}>Release review baseline</Action>
      </Actions>
      <Fold title="Baseline retention and limits">
        <p className="note">One baseline is retained in service memory, bounded at 64 MiB of examined bytes. Retaining another replaces it. Process exit releases it. Save comparison JSON when you need a portable record of the authoring comparison.</p>
      </Fold>
      {panel === null ? null : "limitations" in panel ? <p className="note">{panel.limitations}</p> : <WorkspaceReview review={panel.review} />}
    </>
  );
}

export function Recovery() {
  const editor = useEditor();
  const [saved, setSaved] = useState<SavedRecovery | null>(editor.recovery);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    draftSaves().then(() => api<SavedRecovery>("/api/recovery")).then(value => { if (current) setSaved(value); }).catch(reason => { if (current) setError(reason.message); });
    return () => { current = false; };
  }, []);
  if (editor.edit?.kind === "restored") return <RestoredDraft />;
  const local = editor.retained;
  return (
    <>
      <Intro cap="Saved authoring work" title="Continue a draft or reviewed change.">Saved drafts and prepared changes survive browser and service restarts. Restoring a draft changes only the editor. Review it against the current project before applying.</Intro>
      {error ? <p className="attention"><span className="mark" aria-hidden="true">✕</span>{error}</p> : null}
      {saved ? (
        <dl className="facts">
          <dt className="cap">Project</dt><dd>{saved.root}</dd>
          <dt className="cap">Durable recovery</dt><dd>{saved.directory}</dd>
        </dl>
      ) : error ? null : <p className="note" aria-busy="true">Reading saved authoring work…</p>}
      {local ? (
        <section className="retained">
          <p className="attention"><span className="mark" aria-hidden="true">△</span>The open draft is retained in this view. Download it or return to it before leaving if its last recovery save failed.</p>
          <Actions>
            <Action onAction={() => downloadJson(local, "intent-local-draft.json")}>Download open draft</Action>
            <Action onAction={() => editor.restore(local)}>Return to open draft</Action>
          </Actions>
        </section>
      ) : null}
      {saved && !saved.draft && !saved.proposal ? <p className="empty">No saved draft or prepared change.</p> : null}
      {saved && (saved.draft || saved.proposal) ? (
        <>
          <ul className="saved">
            {saved.draft ? (
              <li>
                <p>Saved draft: <span className="path">{saved.draft.path}</span></p>
                <Actions><Action variant="primary" onAction={() => editor.restore(saved.draft!)}>Restore saved draft</Action></Actions>
              </li>
            ) : null}
            {saved.proposal ? (
              <li>
                <p>{`Prepared change: ${saved.proposal.changes.length} files`}</p>
                <Actions><Action onAction={() => editor.review(saved.proposal!)}>Review saved proposal</Action></Actions>
              </li>
            ) : null}
          </ul>
          <Actions>
            <Action onAction={() => downloadJson(saved, "intent-editor-recovery.json")}>Download saved recovery</Action>
            <Action variant="danger" onAction={() => editor.discardRecovery()}>Discard saved recovery</Action>
          </Actions>
        </>
      ) : null}
    </>
  );
}

function RestoredDraft() {
  const editor = useEditor();
  const open = editor.edit!;
  return (
    <>
      <Intro cap="Recovered source draft" title={open.path}>Your exact local text is restored. Review source and selected metadata before applying.</Intro>
      <section className="editing" aria-label="Recovered draft">
        <ConflictPanel />
        <Area label="Recovered source" source rows={24} value={open.source} onChange={value => editor.changeEdit(current => ({ ...current, source: value }), true)} />
        {open.metadata !== null ? <Area label="Selected record metadata" source rows={14} value={open.metadata} onChange={value => editor.changeEdit(current => ({ ...current, metadata: value }), true)} /> : null}
        <EditStatus />
        <Actions>
          <Action variant="primary" onAction={async () => {
            requireResolved(open);
            if (open.metadata !== null && open.beforeContext && open.before !== null) {
              const prepared = await api("/api/change", { path: open.path, before: open.before, beforeContext: open.beforeContext, sourceBasis: editor.workspace.sourceBasis.id, operation: { kind: "edit", sourceText: open.source, context: JSON.parse(open.metadata) } });
              editor.review(prepared.fileProposal, prepared);
            } else editor.review(await api("/api/propose", { path: open.path, before: open.before, after: open.source, sourceBasis: editor.workspace.sourceBasis.id }));
          }}>Review recovered change</Action>
          <Action variant="danger" onAction={() => editor.discardRecovery()}>Discard recovered draft</Action>
        </Actions>
      </section>
    </>
  );
}

export function Export() {
  const editor = useEditor();
  const { workspace } = editor;
  const [defaults, setDefaults] = useState<{ destination: string } | { error: string } | null>(null);
  const [title, setTitle] = useState(workspace.config?.name ?? "Intent Knowledge");
  const [destination, setDestination] = useState("");
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<{ prepared: Value; selection: string } | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  useEffect(() => {
    api("/api/export-options").then(value => { setDefaults(value); setDestination(value.destination); }).catch(error => setDefaults({ error: error.message }));
  }, []);
  const current = workspace.records.filter(record => record.header.status === "current");
  const selected = () => current.filter(record => chosen[record.header.id]).map(record => record.header.id);
  if (defaults === null) return <><ExportIntro /><p className="note" aria-busy="true">Reading export options…</p></>;
  if ("error" in defaults) return <><ExportIntro /><p className="attention"><span className="mark" aria-hidden="true">✕</span>{defaults.error}</p></>;
  return (
    <>
      <ExportIntro />
      <div className="form">
        <Field label="Site title" value={title} onChange={setTitle} />
        <Field label="New destination directory" value={destination} onChange={setDestination} />
        <fieldset className="choices">
          <legend className="cap">Current records</legend>
          {current.length ? current.map(record => (
            <Check key={record.header.id} isSelected={chosen[record.header.id] ?? false} onChange={value => setChosen({ ...chosen, [record.header.id]: value })}>
              <span className="record-title">{record.title}</span> <span className="id">{record.header.id}</span>
            </Check>
          )) : <p className="empty">There are no current records to export. Promote supported draft meaning through reviewed authoring when it is ready.</p>}
        </fieldset>
        <Actions>
          <Action onAction={async () => {
            const recordIds = selected();
            if (!recordIds.length) throw new Error("Select at least one current record.");
            const prepared = await api("/api/export-preview", { recordIds, title, sourceBasis: workspace.sourceBasis.id });
            setPreview({ prepared, selection: JSON.stringify({ recordIds, title }) }); setExported(null);
          }}>Preview selected site</Action>
        </Actions>
      </div>
      {preview ? (
        <section className="export-preview" aria-labelledby="preview-title">
          <h2 id="preview-title" className="part">{`${preview.prepared.manifest.records.length} selected records`}</h2>
          <p>Review the complete selected Markdown and metadata for your audience. Unselected records, complete shared files and implementation files stay outside the site.</p>
          <p><Link className="link" href={preview.prepared.url} target="_blank" rel="noopener noreferrer">Open selected site preview<span className="mark external" aria-hidden="true">↗</span><span className="hidden-text"> (opens a new tab)</span></Link></p>
          <ul className="plain ids">{preview.prepared.manifest.records.map((record: Value) => <li key={record.id}>{record.id}</li>)}</ul>
          {preview.prepared.manifest.omissions.length ? (
            <ul className="plain">
              {preview.prepared.manifest.omissions.map((omission: Value, index: number) => (
                <li key={index}><State mark="omitted" attention={omission.required}>{`${omission.recordId}: ${omission.target} is not selected.`}</State></li>
              ))}
            </ul>
          ) : null}
          <Actions>
            <Action variant="primary" onAction={async () => {
              if (JSON.stringify({ recordIds: selected(), title }) !== preview.selection) throw new Error("The selection changed. Preview it again before exporting.");
              const result = await api("/api/export", { previewId: preview.prepared.previewId, destination });
              setExported(`Exported ${result.records} records to ${result.destination}. The preview remains available while Intent is open.`);
            }}>Export reviewed site</Action>
          </Actions>
          {exported ? <p role="status"><State mark="complete">exported</State> {exported}</p> : null}
        </section>
      ) : null}
    </>
  );
}

function ExportIntro() {
  return <Intro cap="Export site" title="Share selected Knowledge.">Choose current records, preview the selected static reader, and export to a new directory. Relationships do not add content to your selection. Export does not upload or deploy anything.</Intro>;
}

export function Connection() {
  const [connection, setConnection] = useState<Value | { error: string } | null>(null);
  const [mode, setMode] = useState<"Local host" | "Docker container">("Local host");
  const [container, setContainer] = useState("");
  useEffect(() => { api("/api/connection").then(setConnection).catch(error => setConnection({ error: error.message })); }, []);
  const intro = <Intro cap="Connect an agent" title="Give your agent this project’s Knowledge.">Add this MCP server entry to your host’s local configuration, then restart or reconnect the host. The host starts Intent as a stdio service for this one fixed project root. Intent does not change your host settings.</Intro>;
  if (connection === null) return <>{intro}<p className="note" aria-busy="true">Reading the agent connection…</p></>;
  if ("error" in connection) return <>{intro}<p className="attention"><span className="mark" aria-hidden="true">✕</span>{connection.error}</p></>;
  const generated = () => {
    if (mode === "Local host") return connection.config;
    const name = container.trim();
    if (!name || name.startsWith("-")) throw new Error("Enter the existing container name.");
    const invocation = connection.invocation;
    return { mcpServers: { intent: { command: "docker", args: ["exec", "-i", ...Object.entries(invocation.env ?? {}).flatMap(([key, value]) => ["-e", `${key}=${value}`]), name, invocation.command, ...invocation.args, "mcp", connection.root] } } };
  };
  let configuration: string, invalid = false;
  try { configuration = JSON.stringify(generated(), null, 2); } catch (error) { configuration = error instanceof Error ? error.message : String(error); invalid = true; }
  return (
    <>
      {intro}
      <dl className="facts"><dt className="cap">Selected project</dt><dd>{connection.root}</dd></dl>
      <div className="form">
        <div className="field">
          <span className="field-label" id="runs-label">Where Intent runs</span>
          <ToggleButtonGroup className="switch" aria-labelledby="runs-label" selectionMode="single" disallowEmptySelection selectedKeys={[mode]}
            onSelectionChange={keys => { const key = [...keys][0]; if (key === "Local host" || key === "Docker container") setMode(key); }}>
            <ToggleButton className="toggle" id="Local host">Local host</ToggleButton>
            <ToggleButton className="toggle" id="Docker container">Docker container</ToggleButton>
          </ToggleButtonGroup>
        </div>
        <Field label="Container name" value={container} onChange={setContainer} placeholder="intent-workspace" isDisabled={mode !== "Docker container"}
          description={mode !== "Docker container" ? "Used only when Intent runs in a Docker container." : undefined} />
        <p className="cap">Agent configuration</p>
        {invalid ? <p className="attention" role="status"><span className="mark" aria-hidden="true">△</span>{configuration}</p> : <Pre kind="data" label="Agent configuration">{configuration}</Pre>}
        <Actions><Action onAction={() => downloadJson(generated(), "intent-mcp.json")}>Download agent configuration</Action></Actions>
      </div>
      <p className="note">For a container, use its running name and mount the selected project at the displayed path. The host uses docker exec -i without a TTY; the MCP process inherits the container’s project access.</p>
      <p className="note">The agent can read definitions and prepare coordinated changes for review and explicit application. Implementation reconciliation is explicit; Intent does not execute Checks or report their results.</p>
      <p>After connecting, ask the agent to inspect this project with intent_inspect and read the relevant Knowledge. Regenerate this configuration if you move the installation or project.</p>
    </>
  );
}
