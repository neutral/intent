import { State } from "../../sheet/marks";
import type { Observed } from "./api";
import { Action, Actions, Fold, Pre } from "./controls";
import { dirty, useEditor, type Edit } from "./context";
import { Columns } from "./review";

/* The open editor's states: a conflict with the repository, unapplied local text,
   and the draft's recovery save. */

const saveWords = {
  idle: ["info", "Source drafts are saved automatically outside the project."],
  saving: ["saving", "Saving recovery…"],
  saved: ["saved", "Draft saved for recovery."],
  clean: ["info", "No unsaved source draft."],
  failed: ["error", "Recovery save failed. Keep this browser open."],
  cleared: ["info", "Saved recovery cleared."],
} as const;

export function EditStatus() {
  const { edit, saveStatus } = useEditor();
  const [mark, words] = saveWords[saveStatus];
  return (
    <p className="edit-status" role="status" aria-live="polite">
      {edit?.conflict ? <State mark="invalid" attention>source changed outside this form</State>
        : edit && dirty(edit) ? <State mark="unsaved" attention>unapplied local edit</State>
        : <State mark="info">no local changes</State>}
      <State mark={mark} attention={saveStatus === "failed"} className="save">{words}</State>
    </p>
  );
}

/** Shown when the source or metadata changed after editing began. Preparation stays
 * blocked until the person keeps their text or takes the current source. */
export function ConflictPanel() {
  const editor = useEditor();
  const edit = editor.edit;
  if (!edit?.conflict) return null;
  const observed = edit.conflict;
  const parts: [string, string | null, string | null][] = [["Source", edit.before, observed.source]];
  if (edit.metadata !== null) parts.push(["Selected metadata", edit.beforeMetadata, JSON.stringify(observed.context, null, 2) ?? null]);
  return (
    <section className="conflict" aria-labelledby="conflict-title">
      <h2 id="conflict-title"><span className="mark" aria-hidden="true">✕</span>Edited source changed outside this form</h2>
      <p>Your local text is preserved. Compare the original and current source before choosing how to continue. Preparing changes is blocked until you resolve this conflict.</p>
      {parts.map(([label, before, current]) => (
        <Fold key={label} title={`${label}: original and current`}>
          <Columns before={before} after={current} labels={["Original when editing began", "Current repository"]} render={text => <Pre kind="raw">{text ?? "(absent)"}</Pre>} />
        </Fold>
      ))}
      <Actions>
        <Action onAction={() => adopt(editor, edit, observed, true)}>Keep local text and review against current source</Action>
        <Action variant="danger" onAction={() => adopt(editor, edit, observed, false)}>Use current source and discard local edits</Action>
      </Actions>
    </section>
  );
}

/** Resolve a conflict exactly as each editor always has: keep the local text against
 * the current original, or take the current source. Nothing is merged or written. */
function adopt(editor: ReturnType<typeof useEditor>, edit: Edit, observed: Observed, keep: boolean): void {
  if (edit.kind === "configuration") {
    editor.changeEdit(current => ({ ...current, before: observed.source, conflict: null, ...(keep ? {} : { source: observed.source ?? "" }) }), true);
    editor.notice(keep ? "Local text retained. Review the configuration against its current source." : "Current configuration loaded; local edits discarded.");
    return;
  }
  if (edit.kind === "restored") {
    editor.changeEdit(current => ({
      ...current, before: observed.source, beforeContext: observed.context,
      beforeMetadata: current.metadata !== null ? JSON.stringify(observed.context, null, 2) : null, conflict: null,
      ...(keep ? {} : { source: observed.source ?? "", ...(current.metadata !== null ? { metadata: JSON.stringify(observed.context, null, 2) } : {}) }),
    }), true);
    return;
  }
  if (keep && !observed.context) {
    editor.changeEdit(current => ({ ...current, before: observed.source, beforeContext: null, conflict: null, repair: true }), true);
    return;
  }
  const { workspace } = editor;
  const inspected = workspace.inspections.find(item => item.path === edit.path);
  if (!inspected) { editor.endEdit(); editor.leave(); return; }
  const record = workspace.records.find(item => item.path === edit.path) ?? inspected.record;
  const before = record?.sourceText ?? inspected.raw ?? null;
  const metadata = record && record.header.kind !== "discipline" ? JSON.stringify(record.context, null, 2) : null;
  const fresh = { kind: "record" as const, path: edit.path, before, beforeContext: record?.context ?? null, beforeMetadata: metadata, source: before ?? "", metadata, conflict: null, repair: false };
  if (keep) editor.startEdit({ ...fresh, source: edit.source, metadata: fresh.metadata !== null && edit.metadata !== null ? edit.metadata : fresh.metadata }, true);
  else editor.startEdit(fresh);
  editor.notice(keep ? "Local text retained. Review it against the current source before applying." : "Current source loaded; local edits discarded.");
}
