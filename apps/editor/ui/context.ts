import { createContext, useContext } from "react";
import type { Diagnostic, Draft, FileProposal, Observed, SavedRecovery, SaveStatus, Workspace } from "./api";
import type { Route } from "./route";

/** An open editor: the exact original it began from and the person's local text.
 * `session` stays the same while the person types, so a refresh that started before
 * a keystroke still belongs to this editor. */
export interface Edit {
  session: number;
  kind: "record" | "configuration" | "restored";
  path: string;
  before: string | null;
  beforeContext: unknown;
  beforeMetadata: string | null;
  source: string;
  metadata: string | null;
  conflict: Observed | null;
  /** Local text kept for source repair after the source's metadata became unavailable. */
  repair: boolean;
}

export interface ProposalContext {
  original?: { valid: boolean } | null;
  proposed?: { valid: boolean; diagnostics?: Diagnostic[] } | null;
  scope?: { claim: string } | null;
  limitations?: string[];
  impact?: { affectedIds: string[] } | null;
  createdPath?: string;
}

export type NoticeKind = "warning" | "error" | undefined;

export interface EditorApi {
  workspace: Workspace;
  notice(message: string, kind?: NoticeKind): void;
  review(proposal: FileProposal, context?: ProposalContext | null): void;
  /** Change the view unless open work would be lost; says why when it refuses. */
  navigate(route: Route): boolean;
  /** Return home after the open work has been applied or discarded. */
  leave(): void;
  setWorkspace(workspace: Workspace): void;
  /** Open work that leaving would lose: a changed editor, a filled form or a retained draft. */
  unsaved: boolean;
  markDirty(): void;
  clearDirty(): void;
  edit: Edit | null;
  /** Open an editor; with `save`, save its draft for recovery straight away. */
  startEdit(edit: Omit<Edit, "session">, save?: boolean): void;
  /** Replace the open editor's state; with `save`, also save its draft for recovery. */
  changeEdit(update: (edit: Edit) => Edit, save?: boolean): void;
  endEdit(): void;
  /** Discard the open editor's local text and its saved recovery, as Discard local edit does. */
  discardEdit(): Promise<void>;
  /** Clear saved recovery and the open work, then return home. */
  discardRecovery(): Promise<void>;
  saveStatus: SaveStatus;
  setSaveStatus(status: SaveStatus): void;
  refresh(): Promise<void>;
  retained: Draft | null;
  restore(draft: Draft): Promise<void>;
  recovery: SavedRecovery | null;
  comparisonLabel: string | null;
  setComparisonLabel(label: string | null): void;
}

export const EditorContext = createContext<EditorApi | null>(null);

/** The notice is the Editor's one place to report a refusal or an outcome; every
 * action reaches it, including those beside the repository panel. */
export const NoticeContext = createContext<(message: string, kind?: NoticeKind) => void>(() => {});
export const useNotice = () => useContext(NoticeContext);

export function useEditor(): EditorApi {
  const value = useContext(EditorContext);
  if (!value) throw new Error("The Editor's views need its context");
  return value;
}

export function dirty(edit: Edit): boolean {
  return edit.source !== (edit.before ?? "") || (edit.metadata !== null && edit.metadata !== edit.beforeMetadata);
}

export function requireResolved(edit: Edit): void {
  if (edit.conflict) throw new Error("Resolve the edited-source conflict below before preparing changes. Your local text is preserved.");
}
