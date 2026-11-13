import { useEffect, useMemo, useState } from "react";
import { Link, ListBox, ListBoxItem, Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { Lifecycle, State } from "../../sheet/marks";
import { api, type Inspection, type KnowledgeRecord } from "./api";
import { Action, Actions, Area, Choice, Field, Pre } from "./controls";
import { dirty, requireResolved, useEditor } from "./context";
import { ConflictPanel, EditStatus } from "./editing";
import { href, views, type View } from "./route";

const viewNames: Record<View, string> = { meaning: "Meaning", relationships: "Relationships", implementation: "Implementation", source: "Source" };

/** One record: its title block, then its four views as tabs kept in the URL. */
export function RecordView({ path, view }: { path: string; view: View }) {
  const editor = useEditor();
  const { workspace, edit } = editor;
  // An open editor outlives its file: deleted or moved source keeps the local text on screen.
  const inspected = workspace.inspections.find(item => item.path === path)
    ?? (edit?.kind === "record" && edit.path === path ? { path, raw: null, record: null } : undefined);
  if (!inspected) {
    return (
      <div className="record-view">
        <p className="cap">Record</p>
        <h1 className="path">{path}</h1>
        <p className="attention"><span className="mark" aria-hidden="true">✕</span>This path is not a record in the observed repository. It may have moved or been removed; refresh or choose another record.</p>
      </div>
    );
  }
  const record = workspace.records.find(item => item.path === path) ?? inspected.record;
  return (
    <div className="record-view">
      <p className="cap">{record?.header.kind ?? "Source repair"}</p>
      <h1 className={record ? "title" : "path"}>{record?.title ?? path}</h1>
      {record ? <p className="summary">{record.summary}</p> : null}
      <p className="meta">
        <span className="id">{record?.header.id ?? path}</span>
        {record ? <Lifecycle status={record.header.status} /> : <State mark="invalid" attention>invalid source</State>}
      </p>
      {/* Each tab is a link to its view, so the router's guard keeps open work. */}
      <Tabs className="tabs" selectedKey={view} keyboardActivation="manual">
        <TabList className="tab-list" aria-label="Record view">
          {views.map(name => <Tab key={name} id={name} className="tab" href={href({ screen: "record", path, view: name })}>{viewNames[name]}</Tab>)}
        </TabList>
        <TabPanel id="meaning" className="tab-panel"><Meaning record={record} path={path} /></TabPanel>
        <TabPanel id="relationships" className="tab-panel"><Relationships record={record} /></TabPanel>
        <TabPanel id="implementation" className="tab-panel"><Implementation record={record} /></TabPanel>
        <TabPanel id="source" className="tab-panel"><Source record={record} inspected={inspected} /></TabPanel>
      </Tabs>
    </div>
  );
}

/** Split the rendered body: drop its opening paragraph when the summary above already
 * says it word for word, and mark explicit entry headings as the references they are. */
function readable(html: string, summary: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const first = template.content.firstElementChild;
  if (first?.tagName === "P" && first.textContent?.trim() === summary.trim()) first.remove();
  for (const heading of Array.from(template.content.children).filter(element => element.tagName === "H3"))
    if (/^entry:[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(heading.textContent ?? "")) heading.classList.add("entry");
  return template.innerHTML;
}

function Meaning({ record, path }: { record: KnowledgeRecord | null; path: string }) {
  const [state, setState] = useState<{ html: string } | { stale: true } | { error: string } | null>(null);
  useEffect(() => {
    if (!record) return;
    let current = true;
    setState(null);
    api(`/api/meaning?path=${encodeURIComponent(path)}`).then(view => {
      if (!current) return;
      if (view.sourceDigest !== record.sourceDigest || view.semanticDigest !== record.semanticDigest) setState({ stale: true });
      else setState({ html: readable(view.html, record.summary) });
    }).catch(error => { if (current) setState({ error: error.message }); });
    return () => { current = false; };
  }, [path, record?.sourceDigest, record?.semanticDigest]);
  if (!record) return <p className="attention"><span className="mark" aria-hidden="true">✕</span>This source is invalid. Open Source to inspect and repair the original text.</p>;
  if (state === null) return <p className="note" aria-busy="true">Loading meaning…</p>;
  if ("stale" in state) return <p className="attention"><span className="mark" aria-hidden="true">△</span>Source changed since this view. Refresh to read its new meaning.</p>;
  if ("error" in state) return <p className="attention"><span className="mark" aria-hidden="true">✕</span>{state.error}</p>;
  return <div className="prose" dangerouslySetInnerHTML={{ __html: state.html }} />;
}

function Relationships({ record }: { record: KnowledgeRecord | null }) {
  const { workspace } = useEditor();
  const id = record?.header.id;
  const edges = id ? workspace.graph.edges.filter(edge => edge.source === id || edge.target === id) : [];
  if (!edges.length) return <p className="empty">No current authored relationships.</p>;
  return (
    <ul className="relations">
      {edges.map((edge, index) => {
        const outgoing = edge.source === id, other = outgoing ? edge.target : edge.source;
        const target = workspace.records.find(item => item.header.id === other && item.header.status === "current");
        return (
          <li key={`${edge.type}-${other}-${index}`}>
            <State mark={outgoing ? "outgoing" : "incoming"}>{outgoing ? "Outgoing" : "Incoming"}</State>
            <span className="type">{edge.type}</span>
            <span className="requirement">{edge.required ? "required" : "optional"}</span>
            <span className="target">
              {target
                ? <Link className="link" href={href({ screen: "record", path: target.path, view: "meaning" })}>{other}</Link>
                : <><span className="id">{other}</span> <State mark="missing" attention>no current record</State></>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Implementation({ record }: { record: KnowledgeRecord | null }) {
  const [view, setView] = useState<{ artifacts: { path: string }[]; complete: boolean } | { error: string } | null>(null);
  const [shown, setShown] = useState<{ path: string; source: string } | { path: string; error: string } | null>(null);
  const id = record?.header.id ?? "";
  useEffect(() => {
    let current = true;
    setView(null); setShown(null);
    api(`/api/implementation?record=${encodeURIComponent(id)}`)
      .then(value => { if (current) setView(value); })
      .catch(error => { if (current) setView({ error: error.message }); });
    return () => { current = false; };
  }, [id]);
  if (view === null) return <p className="note" aria-busy="true">Reading implementation coverage…</p>;
  if ("error" in view) return <p className="attention"><span className="mark" aria-hidden="true">✕</span>{view.error}</p>;
  if (!view.artifacts.length) return view.complete
    ? <p className="empty">This record has no primary implementation ownership. Follow its relationships to a Description.</p>
    : <p className="attention"><span className="mark" aria-hidden="true">△</span>Implementation coverage could not be examined completely.</p>;
  return (
    <>
      <ListBox className="files" aria-label="Governed implementation files" items={view.artifacts.map(file => ({ id: file.path }))}
        selectionMode="single" selectedKeys={shown ? [shown.path] : []}
        onSelectionChange={async keys => {
          const path = [...keys][0];
          if (path === undefined) return;
          try { setShown({ path: String(path), source: (await api(`/api/implementation-source?path=${encodeURIComponent(String(path))}`)).source }); }
          catch (error) { setShown({ path: String(path), error: error instanceof Error ? error.message : String(error) }); }
        }}>
        {file => <ListBoxItem className="file" id={file.id} textValue={file.id}>{file.id}</ListBoxItem>}
      </ListBox>
      {shown ? (
        <figure className="file-source">
          <figcaption className="path">{shown.path}</figcaption>
          {"error" in shown ? <p className="attention"><span className="mark" aria-hidden="true">✕</span>{shown.error}</p> : <Pre kind="raw" label={shown.path}>{shown.source}</Pre>}
        </figure>
      ) : null}
    </>
  );
}

function Source({ record, inspected }: { record: KnowledgeRecord | null; inspected: Inspection }) {
  const editor = useEditor();
  const { edit, workspace } = editor;
  const path = inspected.path;
  const product = Boolean(record && record.header.kind !== "discipline");
  const [status, setStatus] = useState(record?.header.status ?? "draft");
  const [target, setTarget] = useState("");
  // Opening the Source view opens an editor on the exact text it began from.
  useEffect(() => {
    if (edit && edit.kind === "record" && edit.path === path) return;
    if (edit) return;
    const before = record?.sourceText ?? inspected.raw ?? null;
    const metadata = record && record.header.kind !== "discipline" ? JSON.stringify(record.context, null, 2) : null;
    editor.startEdit({ kind: "record", path, before, beforeContext: record?.context ?? null, beforeMetadata: metadata, source: before ?? "", metadata, conflict: null, repair: false });
  }, [edit, path, record, inspected]);
  useEffect(() => setStatus(record?.header.status ?? "draft"), [record?.header.status]);
  const open = edit && edit.kind === "record" && edit.path === path ? edit : null;
  const statuses = useMemo(() => ["draft", "current", "superseded", "retired"].map(value => ({ id: value, name: value })), []);
  if (!open) return <p className="note" aria-busy="true">Opening the source…</p>;
  const prepare = async (operation: unknown) => {
    requireResolved(open);
    const prepared = await api("/api/change", { path, before: open.before, beforeContext: open.beforeContext, operation, sourceBasis: workspace.sourceBasis.id });
    editor.review(prepared.fileProposal, prepared);
  };
  const unapplied = editor.edit ? dirty(editor.edit) : false;
  return (
    <div className="editing">
      <ConflictPanel />
      {open.repair ? <p className="attention"><span className="mark" aria-hidden="true">△</span>Local text retained for source repair. Current metadata is unavailable; change preparation may require repair first.</p> : null}
      <Area label="Markdown source" source rows={24} value={open.source}
        description="Edit the original Markdown. Refresh preserves both editors while updating repository information. Review Markdown and metadata together. A plain source save remains available for unreadable source repair."
        onChange={value => editor.changeEdit(current => ({ ...current, source: value }), true)} />
      {open.metadata !== null ? (
        <Area label="Record metadata" source rows={14} value={open.metadata}
          description="Edit this record’s selected catalog and connections. The proposal reviews Markdown and shared metadata together."
          onChange={value => editor.changeEdit(current => ({ ...current, metadata: value }), true)} />
      ) : null}
      <EditStatus />
      <Actions>
        <Action variant="primary" onAction={async () => {
          requireResolved(open);
          if (record && record.header.kind !== "discipline" && open.before !== null && open.beforeContext) {
            const prepared = await api("/api/change", { path, before: open.before, beforeContext: open.beforeContext, operation: { kind: "edit", sourceText: open.source, context: JSON.parse(open.metadata ?? "null") }, sourceBasis: workspace.sourceBasis.id });
            editor.review(prepared.fileProposal, prepared);
          } else editor.review(await api("/api/propose", { path, before: open.before, after: open.source, sourceBasis: workspace.sourceBasis.id }));
        }}>Review source change</Action>
        <Action variant="danger" onAction={() => editor.discardEdit()}>Discard local edit</Action>
      </Actions>
      {product ? (
        <section className="lifecycle" aria-labelledby="lifecycle-title">
          <h2 id="lifecycle-title" className="part">Status, removal and move</h2>
          <div className="row">
            <Choice label="Record status" value={status} onChange={setStatus} options={statuses} />
            <Actions>
              <Action onAction={() => { if (unapplied) throw new Error("Apply or discard the text edit before changing status."); return prepare({ kind: "set-status", status }); }}>Review status change</Action>
              <Action onAction={() => { if (unapplied) throw new Error("Apply or discard the text edit before removal."); return prepare({ kind: "remove" }); }}>Review record removal</Action>
            </Actions>
          </div>
          <div className="row">
            <Field label="New descriptive record path" value={target} onChange={setTarget} placeholder="intent/description/module/_new-name.desc.md" />
            <Actions>
              <Action onAction={() => { if (unapplied) throw new Error("Apply or discard the text edit before moving."); return prepare({ kind: "move", targetPath: target }); }}>Review record move</Action>
            </Actions>
          </div>
        </section>
      ) : null}
    </div>
  );
}
