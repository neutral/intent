import type { KnowledgeRecord } from "./types.js";
import type { WorkspaceInspection } from "./workspace.js";

/** Metadata for navigation and review; exact prose lives in a record or FileProposal. */
export type RecordSummary = Pick<KnowledgeRecord,"path"|"header"|"title"|"summary"|"sourceDigest"|"semanticDigest">;
export function summarizeRecord(record:KnowledgeRecord):RecordSummary {
  const {path,header,title,summary,sourceDigest,semanticDigest}=record;
  return structuredClone({path,header,title,summary,sourceDigest,semanticDigest});
}
export type WorkspaceSummary = Pick<WorkspaceInspection,"mode"|"sourceBasis"|"config"|"coverage"|"disciplines"|"stages"|"diagnostics"|"complete"|"valid"> & {records:RecordSummary[]};
export function summarizeWorkspace(workspace:WorkspaceInspection):WorkspaceSummary {
  const {mode,sourceBasis,config,coverage,disciplines,stages,diagnostics,complete,valid}=workspace;
  return structuredClone({mode,sourceBasis,config,coverage,disciplines,stages,diagnostics,complete,valid,records:workspace.records.map(summarizeRecord)});
}
