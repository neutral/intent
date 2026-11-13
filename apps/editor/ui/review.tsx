import { useEffect, useState, type ReactNode } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { State } from "../../sheet/marks";
import { api, downloadJson, type FileProposal } from "./api";
import { Action, Actions, Fold, Pre } from "./controls";
import type { ProposalContext } from "./context";

/* The review of a prepared change: what the proposal claims, every file before and
   after, and the code and obligations around it. Application waits for the review. */

/** Review carriers are the Library's; the Editor only draws them. */
type Review = any;

export interface OpenProposal { value: FileProposal; context: ProposalContext | null; createdPath: string | null; key: number }

function validity(valid: boolean) {
  return <State mark={valid ? "valid" : "invalid"} attention={!valid}>{valid ? "valid" : "incomplete or invalid"}</State>;
}

export function ProposalDialog({ proposal, onApply, onClose }: { proposal: OpenProposal | null; onApply: (proposal: OpenProposal) => Promise<void>; onClose: () => void }) {
  return (
    <ModalOverlay className="overlay" isOpen={proposal !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <Modal className="modal">
        <Dialog className="dialog">
          {proposal ? <ProposalReview key={proposal.key} proposal={proposal} onApply={onApply} onClose={onClose} /> : null}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function ProposalReview({ proposal, onApply, onClose }: { proposal: OpenProposal; onApply: (proposal: OpenProposal) => Promise<void>; onClose: () => void }) {
  const [review, setReview] = useState<{ value: Review } | { error: string } | null>(null);
  useEffect(() => {
    let current = true;
    api("/api/proposal-review", proposal.value)
      .then(value => { if (current) setReview({ value }); })
      .catch(error => { if (current) setReview({ error: error.message }); });
    return () => { current = false; };
  }, [proposal]);
  const context = proposal.context;
  return (
    <>
      <div className="dialog-top">
        <p className="cap">Review file changes</p>
        <Button className="button round" aria-label="Close proposal" onPress={onClose}>×</Button>
      </div>
      <Heading slot="title" level={2}>Apply this proposal</Heading>
      {context ? (
        <div className="claims">
          {context.proposed ? (
            <p className="states">
              {context.original ? <span>Original repository {validity(context.original.valid)}</span> : null}
              <span>Proposed repository {validity(context.proposed.valid)}</span>
            </p>
          ) : null}
          {context.scope ? <p>{context.scope.claim}</p> : null}
          {(context.limitations ?? []).map((limitation, index) => <p key={index} className="note">{limitation}</p>)}
          {context.proposed?.diagnostics?.length ? (
            <ul className="findings">
              {context.proposed.diagnostics.map((issue, index) => (
                <li key={index} className={`finding ${issue.severity}`}>
                  <State mark={issue.severity} attention={issue.severity !== "info"}>{issue.severity}</State>
                  <p className="message">{issue.message}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {context.impact ? <p>{`Affected records: ${context.impact.affectedIds.join(", ") || "none"}`}</p> : null}
        </div>
      ) : null}
      <h3 className="part">File changes</h3>
      {proposal.value.changes.map(file => (
        <section key={file.path} className="file-change" aria-label={file.path}>
          <h4 className="path">{file.path}</h4>
          <Columns before={file.before} after={file.after} labels={["Before", "After"]}
            render={text => <Pre kind="raw">{text ?? "(absent)"}</Pre>} />
        </section>
      ))}
      <section className="code-review" aria-busy={review === null}>
        {review === null ? (
          <>
            <h3 className="part">Code and obligations</h3>
            <p className="note">Preparing exact original and proposed observations…</p>
          </>
        ) : "error" in review ? (
          <>
            <h3 className="part">Comparison unavailable</h3>
            <p className="attention"><span className="mark" aria-hidden="true">✕</span>{review.error}</p>
          </>
        ) : <WorkspaceReview review={review.value} level={3} />}
      </section>
      <div className="dialog-end">
        <p className="note">Review the current source and metadata together before applying the change.</p>
        <Action variant="primary" isDisabled={review === null || "error" in review} onAction={() => onApply(proposal)}>Apply reviewed changes</Action>
      </div>
    </>
  );
}

export function Columns<T>({ before, after, render, labels = ["Original", "Proposed / later observation"] }: { before: T; after: T; render: (value: T) => ReactNode; labels?: [string, string] }) {
  return (
    <div className="columns">
      {([[labels[0], before], [labels[1], after]] as const).map(([label, value]) => (
        <section key={label} className="column">
          <p className="cap">{label}</p>
          {render(value as T)}
        </section>
      ))}
    </div>
  );
}

/** The exact original and proposed (or later) observations of code and Knowledge. */
export function WorkspaceReview({ review, level = 2 }: { review: Review; level?: 2 | 3 }) {
  const comparison = review.comparison;
  const Title = level === 2 ? "h2" : "h3";
  const Sub = level === 2 ? "h3" : "h4";
  const records = [...comparison.records].sort((a: Review, b: Review) => Number(b.changed) - Number(a.changed) || a.id.localeCompare(b.id));
  return (
    <div className="workspace-review">
      <Title className="part">Code and obligations</Title>
      <p>{`${comparison.changes.length} changed examined files · ${comparison.affectedIds.length} affected record identities · ${review.codeTotal} implementation paths`}</p>
      {review.complete
        ? <p className="note"><span className="mark" aria-hidden="true">✓</span>Both observations and all selected comparison content are complete. This does not establish correctness.</p>
        : <p className="attention"><span className="mark" aria-hidden="true">△</span>This comparison is incomplete. Inspect missing observations, findings and any explicit preview limits.</p>}
      <Fold title="What this comparison covers">
        {[...comparison.limitations, ...review.limitations].map((limitation: string, index: number) => <p key={index} className="note">{limitation}</p>)}
      </Fold>
      <Actions><Action onAction={() => downloadJson(review, "intent-workspace-review.json")}>Download exact comparison JSON</Action></Actions>
      <Fold title="Changed examined files">
        <ul className="plain">{comparison.changes.map((change: Review) => <li key={change.path}><State mark="changed" attention>{change.change}</State> {change.path}</li>)}</ul>
      </Fold>
      <Fold title="Scope, coverage, exclusions and validation">
        <Columns before={comparison.context.before} after={comparison.context.after} render={(value: Review) => (
          <>
            <p>Observation <State mark={value.complete ? "complete" : "incomplete"} attention={!value.complete}>{value.complete ? "complete" : "incomplete"}</State> · <State mark={value.valid ? "valid" : "invalid"} attention={!value.valid}>{value.valid ? "valid" : "invalid"}</State></p>
            <p className="cap">Adopted scope and exemptions</p><Pre kind="data">{JSON.stringify(value.config, null, 2)}</Pre>
            <p className="cap">Coverage and exclusions</p><Pre kind="data">{JSON.stringify(value.coverage, null, 2)}</Pre>
            <p className="cap">Findings</p><Pre kind="data">{JSON.stringify(value.diagnostics, null, 2)}</Pre>
          </>
        )} />
      </Fold>
      <section>
        <Sub className="sub">{`Original and proposed record summaries (${comparison.records.length} of ${comparison.recordTotal})`}</Sub>
        {records.map((change: Review) => (
          <Fold key={change.id} defaultExpanded={change.changed} title={<><span className="id">{change.id}</span> <State mark={change.changed ? "changed" : "related"} attention={change.changed}>{change.changed ? "changed authored occurrence" : "related examination candidate"}</State></>}>
            <Columns before={change.before} after={change.after} render={(occurrences: Review[]) => occurrences.length ? occurrences.map((record: Review) => (
              <div key={record.path} className="occurrence">
                <p className="record-title">{record.title}</p>
                <p className="note">{`${record.header.kind} · ${record.header.status} · ${record.path}`}</p>
                <p className="person">{record.summary}</p>
                <Fold title="Relationships, source citations and owners">
                  <Pre kind="data">{JSON.stringify({ relationships: record.header.relationships, sources: record.header.sources, owners: record.header.owners }, null, 2)}</Pre>
                </Fold>
              </div>
            )) : <p className="empty">No parsed occurrence in this observation. Inspect changed source bytes and findings.</p>} />
          </Fold>
        ))}
      </section>
      <section>
        <Sub className="sub">{`Implementation (${review.code.length} of ${review.codeTotal} paths)`}</Sub>
        {review.code.map((file: Review) => (
          <Fold key={file.path} defaultExpanded={file.before.sourceDigest !== file.after.sourceDigest} title={<span className="id">{file.path}</span>}>
            <Columns before={{ preview: file.before, owners: file.beforeOwners }} after={{ preview: file.after, owners: file.afterOwners }} render={({ preview, owners }: Review) => (
              <>
                <p className="note">{`Primary Descriptions: ${owners.join(", ") || "none in this observation"}`}</p>
                <p>{`${preview.status}${preview.sizeBytes === null ? "" : ` · ${preview.sizeBytes} bytes`}${preview.truncated ? " · truncated preview" : ""}`}</p>
                {preview.message ? <p className="attention"><span className="mark" aria-hidden="true">△</span>{preview.message}</p> : null}
                {preview.text !== null ? <Pre kind="raw">{preview.text}</Pre> : null}
              </>
            )} />
          </Fold>
        ))}
      </section>
      <Fold title="Technical observation identities and limits">
        <Pre kind="data">{JSON.stringify({ before: comparison.before, after: comparison.after, limits: review.limits }, null, 2)}</Pre>
      </Fold>
    </div>
  );
}
