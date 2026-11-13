import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input, Label, Link, ListBox, ListBoxItem, RouterProvider, SearchField } from "react-aria-components";
import { Lifecycle, State } from "../../sheet/marks";
import {
  api, clearRecovery, configurationPaths, draftSaves, saveDraft,
  type Draft, type FileProposal, type Inspection, type KnowledgeRecord, type Observed, type SavedRecovery, type SaveStatus, type Workspace,
} from "./api";
import { Action, Choice, Field } from "./controls";
import { dirty, EditorContext, NoticeContext, useEditor, useNotice, type Edit, type EditorApi, type NoticeKind, type ProposalContext } from "./context";
import { RecordView } from "./record";
import { ProposalDialog, type OpenProposal } from "./review";
import { href, parseRoute, sameRoute, type Route } from "./route";
import { Comparison, Configuration, Connection, Creation, Export, Home, Initialization, Practices, Recovery } from "./screens";

const places = [
  { screen: "configuration", label: "Project configuration" },
  { screen: "practices", label: "Advisory practices" },
  { screen: "comparison", label: "Compare changes" },
  { screen: "export", label: "Export site" },
  { screen: "agent", label: "Connect an agent" },
  { screen: "recovery", label: "Saved authoring work" },
] as const;

const kindOptions = [{ id: "", name: "All kinds" }, ...["behavior", "assurance", "blueprint", "description", "check", "discipline"].map(kind => ({ id: kind, name: kind }))];

/** Why leaving for `target` would lose open work, in the words each view has always used. */
function blocked(target: Route, current: Route): string {
  if (target.screen === "record") return current.screen === "record" && current.path === target.path ? "Apply or discard the open edit first." : "Keep or apply the open source edit before changing records.";
  if (target.screen === "new") return "Apply or discard the open edit before starting another draft.";
  if (target.screen === "comparison") return "Apply or discard the open edit before opening the repository comparison.";
  if (target.screen === "export") return "Apply or discard the open edit before exporting selected Knowledge.";
  if (target.screen === "agent") return "Apply or discard the open edit before connecting an agent.";
  if (target.screen === "recovery") return "Review or discard the open form before opening saved recovery.";
  return "Apply or discard the open edit first.";
}

function snapshot(edit: Edit | null): Draft | null {
  if (!edit || !dirty(edit)) return null;
  return { kind: configurationPaths.includes(edit.path) ? "configuration" : "source", path: edit.path, before: edit.before ?? null, beforeContext: edit.beforeContext ?? null, beforeMetadata: edit.beforeMetadata ?? null, source: edit.source, metadata: edit.metadata ?? null };
}

const conflictOf = (edit: Edit, observed: Observed): Observed | null => {
  const same = edit.before === observed.source && JSON.stringify(sortKeys(edit.beforeContext)) === JSON.stringify(sortKeys(observed.context));
  return same ? null : observed;
};
function sortKeys(value: unknown): unknown {
  return Array.isArray(value) ? value.map(sortKeys) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys((value as Record<string, unknown>)[key])])) : value;
}

let sessions = 0, notices = 0, proposals = 0;

export function App({ home }: { home: string }) {
  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [edit, setEditState] = useState<Edit | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [retained, setRetainedState] = useState<Draft | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [notice, setNoticeState] = useState<{ message: string; kind: NoticeKind; key: number } | null>(null);
  const [proposal, setProposal] = useState<OpenProposal | null>(null);
  const [operationId, setOperationId] = useState("");
  const [operation, setOperation] = useState<{ inspected: any; id: string } | { discarded: true } | { refused: string } | null>(null);
  const [comparisonLabel, setComparisonLabel] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<SavedRecovery | null>(null);

  // Async work reads the latest state through refs, as the old script read its globals.
  const refs = useRef({ workspace, route, edit, formDirty, retained });
  refs.current.workspace = workspace; refs.current.route = route;
  const setEdit = useCallback((next: Edit | null) => { refs.current.edit = next; setEditState(next); }, []);
  const setDirty = useCallback((next: boolean) => { refs.current.formDirty = next; setFormDirty(next); }, []);
  const setRetained = useCallback((next: Draft | null) => { refs.current.retained = next; setRetainedState(next); }, []);
  const setWorkspace = useCallback((next: Workspace) => { refs.current.workspace = next; setWorkspaceState(next); setLoadError(null); }, []);
  const unsavedNow = useCallback(() => refs.current.formDirty || refs.current.retained !== null || (refs.current.edit !== null && dirty(refs.current.edit)), []);
  const unsaved = formDirty || retained !== null || (edit !== null && dirty(edit));

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showNotice = useCallback((message: string, kind?: NoticeKind) => {
    setNoticeState({ message, kind, key: ++notices });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNoticeState(null), 6500);
  }, []);

  const save = useCallback((next: Edit | null) => {
    saveDraft(snapshot(next), setSaveStatus).catch(error => showNotice(error.message, "error"));
  }, [showNotice]);

  /** Enter a route the guard has admitted; leaving clears editors and forms that hold nothing. */
  const admit = useCallback((target: Route): boolean => {
    const current = refs.current.route;
    if (sameRoute(target, current)) return true;
    if (unsavedNow()) {
      const local = snapshot(refs.current.edit);
      if (target.screen === "recovery" && local && !refs.current.formDirty) {
        setRetained(local); setEdit(null);
      } else {
        showNotice(blocked(target, current), "warning");
        return false;
      }
    } else { setEdit(null); setDirty(false); }
    refs.current.route = target;
    setRoute(target);
    window.scrollTo({ top: 0, behavior: "instant" });
    return true;
  }, [unsavedNow, setEdit, setDirty, setRetained, showNotice]);

  const navigate = useCallback((target: Route): boolean => {
    const admitted = admit(target);
    if (admitted && location.hash !== href(target)) history.pushState(null, "", href(target));
    return admitted;
  }, [admit]);

  const leave = useCallback(() => {
    setDirty(false); setRetained(null); setEdit(null);
    navigate({ screen: "home" });
  }, [navigate, setDirty, setRetained, setEdit]);

  useEffect(() => {
    const restore = () => {
      const target = parseRoute(location.hash);
      if (!admit(target)) history.pushState(null, "", href(refs.current.route));
    };
    addEventListener("popstate", restore);
    addEventListener("hashchange", restore);
    return () => { removeEventListener("popstate", restore); removeEventListener("hashchange", restore); };
  }, [admit]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (unsavedNow()) { event.preventDefault(); event.returnValue = ""; } };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [unsavedNow]);

  /** Observe the repository again. Open text is never replaced: a changed editor keeps its
   * local text and is checked against the exact current original. */
  const refresh = useCallback(async (after?: { applied: true; select: string | null }) => {
    const current = refs.current.edit;
    const observed = current ? await api<Observed>(`/api/edit-state?path=${encodeURIComponent(current.path)}`) : null;
    const next = observed?.workspace ?? await api<Workspace>("/api/workspace");
    if ((refs.current.edit?.session ?? null) !== (current?.session ?? null)) return;
    setWorkspace(next);
    if (unsavedNow()) {
      let conflict: Observed | null = null;
      if (current && observed) {
        conflict = conflictOf(current, observed);
        const latest = refs.current.edit;
        if (latest && latest.session === current.session) setEdit({ ...latest, conflict, repair: false });
      }
      showNotice(conflict ? "Repository refreshed. Resolve the edited-source conflict; your local text is preserved." : "Repository refreshed. Your local text is preserved; prepare the change again.", conflict ? "warning" : undefined);
      return;
    }
    setEdit(null);
    if (after) {
      const view: Route = after.select ? { screen: "record", path: after.select, view: "source" } : refs.current.route.screen === "record" && next.inspections.some(item => item.path === (refs.current.route as { path: string }).path) ? refs.current.route : { screen: "home" };
      navigate(view);
    }
  }, [navigate, setEdit, setWorkspace, showNotice, unsavedNow]);

  const restore = useCallback(async (draft: Draft) => {
    const observed = await api<Observed>(`/api/edit-state?path=${encodeURIComponent(draft.path)}`);
    setWorkspace(observed.workspace);
    const restored: Edit = { session: ++sessions, kind: "restored", path: draft.path, before: draft.before, beforeContext: draft.beforeContext, beforeMetadata: draft.beforeMetadata, source: draft.source, metadata: draft.metadata, conflict: null, repair: false };
    restored.conflict = conflictOf(restored, observed);
    setRetained(null);
    setEdit(restored);
  }, [setEdit, setRetained, setWorkspace]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await refresh();
        const saved = await api<SavedRecovery>("/api/recovery");
        if (active && (saved.draft || saved.proposal)) { setRecovery(saved); navigate({ screen: "recovery" }); }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!refs.current.workspace) setLoadError(message);
        showNotice(message, "error");
      }
    })();
    return () => { active = false; };
  }, []);

  const apply = useCallback(async (open: OpenProposal) => {
    await draftSaves();
    const result = await api("/api/apply", open.value);
    if (result.status === "completed") {
      setDirty(false); setRetained(null); setEdit(null); setOperation(null);
      setSaveStatus(result.recoveryError ? "failed" : "idle");
      try {
        await refresh({ applied: true, select: open.createdPath });
        showNotice(`Applied ${result.written.length} files. ${result.recoveryError ? `Saved recovery could not be cleared: ${result.recoveryError}` : "Repository refreshed."}`, result.recoveryError ? "warning" : undefined);
      } catch (error) {
        showNotice(`Applied ${result.written.length} files, but refresh failed: ${error instanceof Error ? error.message : String(error)}. Refresh before continuing.`, "error");
      } finally { setProposal(null); }
    } else {
      setProposal(null);
      if (result.status === "refused") {
        setOperationId(""); setOperation({ refused: result.error });
        showNotice("Application refused. Your local text is preserved; refresh and prepare a new proposal.", "warning");
      } else {
        setOperationId(result.id);
        showNotice(`Operation interrupted: ${result.error}. Journal: ${result.journal}`, "error");
      }
    }
  }, [refresh, setDirty, setEdit, setRetained, showNotice]);

  const api_: EditorApi | null = workspace ? {
    workspace,
    notice: showNotice,
    review: (value: FileProposal, context: ProposalContext | null = null) => setProposal({ value, context, createdPath: context?.createdPath ?? null, key: ++proposals }),
    navigate, leave, setWorkspace,
    unsaved,
    markDirty: () => setDirty(true),
    clearDirty: () => setDirty(false),
    edit,
    startEdit: (next, persist = false) => { const opened = { ...next, session: ++sessions }; setEdit(opened); if (persist) save(opened); },
    changeEdit: (update, persist = false) => { const latest = refs.current.edit; if (!latest) return; const next = update(latest); setEdit(next); if (persist) save(next); },
    endEdit: () => setEdit(null),
    discardEdit: async () => {
      await clearRecovery(setSaveStatus);
      setDirty(false); setRetained(null); setEdit(null);
      const current = refs.current.route;
      if (current.screen === "record" && !refs.current.workspace?.inspections.some(item => item.path === current.path)) navigate({ screen: "home" });
    },
    discardRecovery: async () => { await clearRecovery(setSaveStatus); leave(); },
    saveStatus, setSaveStatus,
    refresh: () => refresh(),
    retained, restore, recovery,
    comparisonLabel, setComparisonLabel,
  } : null;

  return (
    <NoticeContext.Provider value={showNotice}>
    <RouterProvider navigate={path => { if (path.startsWith("#")) navigate(parseRoute(path)); else location.assign(path); }}>
      <Link className="skip" href="#main" onPress={() => document.getElementById("main")?.focus()}>Skip to content</Link>
      <div className="sheet">
        <header className="top">
          <Link className="brand" href={home}>Intent Editor</Link>
          <p className="project">{workspace ? workspace.config?.name ?? "Repository needs intent/project.json" : loadError ? "Repository unavailable" : "Opening repository…"}</p>
          <Action onAction={() => refresh()}>Refresh</Action>
          <nav className="places" aria-label="Project tools">
            {places.map(place => (
              <Link key={place.screen} className="place" href={href({ screen: place.screen })} aria-current={route.screen === place.screen ? "page" : undefined}>{place.label}</Link>
            ))}
          </nav>
        </header>
        <div className="layout">
          <Knowledge workspace={workspace} route={route} navigate={navigate} />
          <main id="main" tabIndex={-1}>
            {api_ ? (
              <EditorContext.Provider value={api_}>
                <Screen route={route} />
                <ProposalDialog proposal={proposal} onApply={apply} onClose={() => setProposal(null)} />
              </EditorContext.Provider>
            ) : loadError ? (
              <>
                <p className="cap">Repository Knowledge</p>
                <h1>The repository could not be read.</h1>
                <p className="attention"><span className="mark" aria-hidden="true">✕</span>{loadError}</p>
              </>
            ) : (
              <>
                <p className="cap">Repository Knowledge</p>
                <h1>Opening repository…</h1>
                <p className="note" aria-busy="true">Reading Knowledge and its stage results from the selected repository.</p>
              </>
            )}
          </main>
          <Inspector workspace={workspace} operationId={operationId} setOperationId={setOperationId} operation={operation} setOperation={setOperation}
            onRefresh={() => refresh()} review={api_?.review} />
        </div>
      </div>
      <div className={`notice${notice?.kind ? " diff" : ""}`} role="status" aria-live="polite" hidden={!notice}>
        {notice ? <>{notice.kind ? <span className="mark" aria-hidden="true">{notice.kind === "error" ? "✕" : "△"}</span> : null}{notice.message}</> : null}
      </div>
    </RouterProvider>
    </NoticeContext.Provider>
  );
}

function Screen({ route }: { route: Route }) {
  const { workspace } = useEditor();
  if (!workspace.config && (route.screen === "home" || route.screen === "record" || route.screen === "new")) return <Initialization />;
  switch (route.screen) {
    case "home": return <Home />;
    case "record": return <RecordView path={route.path} view={route.view} />;
    case "new": return <Creation />;
    case "configuration": return <Configuration />;
    case "practices": return <Practices />;
    case "comparison": return <Comparison />;
    case "export": return <Export />;
    case "agent": return <Connection />;
    case "recovery": return <Recovery />;
  }
}


function recordOf(workspace: Workspace, inspection: Inspection): KnowledgeRecord | null {
  return workspace.records.find(item => item.path === inspection.path) ?? inspection.record;
}

function Knowledge({ workspace, route, navigate }: { workspace: Workspace | null; route: Route; navigate: (route: Route) => boolean }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const items = useMemo(() => {
    if (!workspace) return [];
    const query = search.toLowerCase();
    return workspace.inspections.flatMap(inspection => {
      const record = recordOf(workspace, inspection);
      if (kind && record?.header.kind !== kind) return [];
      if (query && !`${record?.header.id ?? inspection.path} ${record?.title ?? ""} ${record?.summary ?? ""} ${record?.sourceText ?? inspection.raw ?? ""}`.toLowerCase().includes(query)) return [];
      return [{ id: inspection.path, record }];
    });
  }, [workspace, search, kind]);
  const total = workspace?.inspections.length ?? 0;
  const filtered = Boolean(search || kind);
  return (
    <aside className="knowledge" aria-label="Knowledge navigation">
      <Link className={`button wide${route.screen === "new" ? " current" : ""}`} href={href({ screen: "new" })} isDisabled={!workspace?.config} aria-current={route.screen === "new" ? "page" : undefined}>New Product draft</Link>
      <SearchField className="field" value={search} onChange={setSearch}>
        <Label className="field-label">Find Knowledge</Label>
        <Input className="input" placeholder="Title, meaning, or ID" autoComplete="off" />
      </SearchField>
      <Choice label="Kind" value={kind} onChange={setKind} options={kindOptions} />
      <p className="count note" role="status" aria-live="polite">{workspace ? filtered ? `${items.length} of ${total} records match` : total ? `${total} records` : "" : "Reading records…"}</p>
      <ListBox className="records" aria-label="Records" items={items} selectionMode="single" disallowEmptySelection
        selectedKeys={route.screen === "record" ? [route.path] : []}
        onSelectionChange={keys => { const key = [...keys][0]; if (key !== undefined) navigate({ screen: "record", path: String(key), view: "meaning" }); }}
        renderEmptyState={() => <p className="empty">{!workspace ? "" : filtered ? "No records match." : "No Knowledge records yet."}</p>}>
        {item => (
          <ListBoxItem className="record-item" id={item.id} textValue={item.record?.title ?? item.id}>
            <span className={item.record ? "title" : "title path"}>{item.record?.title ?? item.id}</span>
            <span className="meta">
              {item.record ? <>{`${item.record.header.kind} · `}<Lifecycle status={item.record.header.status} /></> : <><State mark="invalid" attention>invalid source</State>{" · available for repair"}</>}
            </span>
          </ListBoxItem>
        )}
      </ListBox>
    </aside>
  );
}

function Inspector({ workspace, operationId, setOperationId, operation, setOperation, onRefresh, review }: {
  workspace: Workspace | null; operationId: string; setOperationId: (id: string) => void;
  operation: { inspected: any; id: string } | { discarded: true } | { refused: string } | null;
  setOperation: (value: { inspected: any; id: string } | { discarded: true } | { refused: string } | null) => void;
  onRefresh: () => Promise<void>; review: EditorApi["review"] | undefined;
}) {
  const notice = useNotice();
  return (
    <aside className="inspector" aria-label="Repository inspection">
      <section aria-labelledby="stages-title">
        <h2 id="stages-title" className="part">Repository state</h2>
        {workspace ? (
          <ul className="stages">
            {workspace.stages.map(stage => (
              <li key={stage.name}>
                <span className="name">{stage.name}</span>
                {stage.valid ? <State mark="valid">valid</State> : stage.complete ? <State mark="invalid" attention>invalid</State> : <State mark="incomplete" attention>incomplete</State>}
              </li>
            ))}
          </ul>
        ) : <p className="note">Reading…</p>}
      </section>
      <section aria-labelledby="findings-title">
        <h2 id="findings-title" className="part">Findings</h2>
        {workspace ? workspace.diagnostics.length ? (
          <ul className="findings">
            {workspace.diagnostics.slice(0, 100).map((issue, index) => (
              <li key={index} className={`finding ${issue.severity}`}>
                <State mark={issue.severity} attention={issue.severity !== "info"}>{issue.severity}</State>
                <p className="message">{issue.message}</p>
                <p className="where">{issue.path}</p>
                <p className="where">{issue.code}</p>
              </li>
            ))}
          </ul>
        ) : <p className="empty">No findings.</p> : null}
        {workspace && workspace.diagnostics.length > 100 ? <p>{`${workspace.diagnostics.length - 100} additional findings are available through the CLI.`}</p> : null}
        <p className="note">Coverage names a structural owner. It does not establish that prose explains new code or that a Check has run.</p>
      </section>
      <section aria-labelledby="operation-title">
        <h2 id="operation-title" className="part">Operation recovery</h2>
        <Field label="Operation ID from the retained journal" value={operationId} onChange={setOperationId} />
        <div className="actions">
          <Action onAction={async () => { const id = operationId; setOperation({ inspected: await api(`/api/operation?id=${encodeURIComponent(id)}`), id }); }}>Inspect operation</Action>
        </div>
        <div className="operation" aria-live="polite">
          {operation === null ? null : "refused" in operation ? (
            <>
              <p className="attention"><span className="mark" aria-hidden="true">△</span>{`Application refused: ${operation.refused}. No files were written and no recovery journal was created.`}</p>
              <div className="actions"><Action onAction={onRefresh}>Refresh and keep local edits</Action></div>
            </>
          ) : "discarded" in operation ? <p>Recovery journal discarded.</p> : (
            <>
              <p>{`Operation ${operation.inspected.id}: `}<span className="state">{operation.inspected.status}</span></p>
              <ul className="plain">{operation.inspected.files.map((file: any) => <li key={file.path} className="note">{`${file.path}: ${file.state}`}</li>)}</ul>
              <div className="actions">
              <Action onAction={async () => {
                const prepared = await api("/api/resume", { id: operation.id, sourceBasis: workspace?.sourceBasis.id });
                if (!prepared.fileProposal) { notice("All files are already applied; no remaining changes were proposed."); return; }
                review?.(prepared.fileProposal, prepared);
              }}>Review remaining changes</Action>
              <Action variant="danger" onAction={async () => {
                await api("/api/discard-operation", { id: operation.inspected.id, journalDigest: operation.inspected.journalDigest });
                setOperation({ discarded: true });
              }}>Discard inspected recovery journal</Action>
              </div>
            </>
          )}
        </div>
      </section>
    </aside>
  );
}
