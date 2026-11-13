import { StrictMode, useEffect, useState } from "react";
import { Button, I18nProvider, Input, Label, Link, SearchField } from "react-aria-components";
import { State } from "../../sheet/marks";
import type { PortalCard, PortalPage, PortalRecordView, PortalReference, PortalSourceReference, PortalSourceRow } from "../page-data";

/** One tree for the prerender at export time and the hydration in the browser. */
export function Root({ page }: { page: PortalPage }) {
  return (
    <StrictMode>
      <I18nProvider locale="en-US">
        <Sheet page={page} />
      </I18nProvider>
    </StrictMode>
  );
}

function Sheet({ page }: { page: PortalPage }) {
  return (
    <>
      <Link className="skip" href="#main">Skip to content</Link>
      <div className="sheet">
        <header className="top">
          <p className="brand cap">Intent Portal</p>
          {page.page === "index" ? null : <p className="publication">{page.publication}</p>}
          <nav className="places" aria-label="Publication">
            <Link className="place" href="index.html" aria-current={page.page === "index" ? "page" : undefined}>Browse</Link>
            <Link className="place" href="sources.html" aria-current={page.page === "sources" ? "page" : undefined}>Selected sources</Link>
            <Link className="place" href="manifest.json">Manifest</Link>
          </nav>
        </header>
        <main id="main" tabIndex={-1}>
          {page.page === "index" ? <Browse publication={page.publication} records={page.records} files={page.files} search={page.search} />
            : page.page === "record" ? <RecordPage record={page.record} />
            : <Sources records={page.records} identity={page.identity} />}
        </main>
        <footer className="foot">Read-only publication. Currentness is authored; publication is not adoption or examination.</footer>
      </div>
    </>
  );
}

function matches(entry: string, words: string[]): boolean {
  const text = entry.toLocaleLowerCase();
  return words.every(word => text.includes(word));
}

function Browse({ publication, records, files, search }: { publication: string; records: PortalCard[]; files: number; search: string[] }) {
  // Search needs the script; until it has hydrated, the field says so by being disabled.
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  useEffect(() => setReady(true), []);
  const words = (query ?? "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const shown = records.map((_, index) => matches(search[index] ?? "", words));
  const count = shown.filter(Boolean).length;
  const status = query === null ? "" : `${count} of ${records.length} selected records${words.length ? " match" : ""}`;
  return (
    <>
      <p className="cap">Selected publication</p>
      <h1>{publication}</h1>
      <p className="lead">Explore the meaning, design, and explanations selected for this publication.</p>
      <p className="facts">
        <span>{`${records.length} Knowledge records`}</span>
        <Link className="link" href="sources.html">{`${files} selected files`}</Link>
        <span>Portable</span>
      </p>
      <section className="browse" aria-labelledby="browse-title">
        <h2 id="browse-title" className="part">Browse Knowledge</h2>
        <div className="search" role="search">
          <SearchField className="field search-field" isDisabled={!ready} value={query ?? ""} onChange={setQuery} aria-describedby="search-status">
            <Label className="field-label">Search selected Knowledge</Label>
            <div className="search-row">
              <Input className="input" placeholder="Find a decision, responsibility, or ID" autoComplete="off" />
              <Button className="button clear">Clear</Button>
            </div>
          </SearchField>
        </div>
        <p id="search-status" className="note" role="status" aria-live="polite">{status}</p>
        <p id="no-results" className="empty" hidden={count !== 0 || records.length === 0}>No selected Knowledge matches this search.</p>
        {records.length ? (
          <ul className="cards">
            {records.map((record, index) => (
              <li key={record.id} className="card" data-record={index} hidden={!shown[index]}>
                <Link className="card-link" href={record.href}>
                  <span className="kind">{record.kind}</span>
                  <div className="card-body">
                    <h3 className="title">{record.title}</h3>
                    <p className="summary" dangerouslySetInnerHTML={{ __html: record.summary }} />
                  </div>
                  <span className="id">{record.id}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="empty">No Knowledge records were selected.</p>}
      </section>
      <p className="scope note">Publication scope is explicit. Only selected current Knowledge is included. Omitted references remain visible.</p>
    </>
  );
}

function Reference({ reference }: { reference: Pick<PortalReference, "target" | "href" | "required"> }) {
  if (reference.href) return <Link className="link" href={reference.href}>{reference.target}</Link>;
  return (
    <span className="omitted">
      <span className="target">{reference.target}</span>
      <State mark="omitted" attention={reference.required}>{`${reference.required ? "Required reference" : "Reference"} omitted from this publication`}</State>
    </span>
  );
}

function RecordPage({ record }: { record: PortalRecordView }) {
  return (
    <>
      <Link className="back link" href="index.html">← All selected Knowledge</Link>
      <p className="cap">{record.kind}</p>
      <h1 className="title">{record.title}</h1>
      <p className="meta"><span className="id">{record.id}</span><State mark="current">current</State></p>
      <p id="lead" className="lead summary" dangerouslySetInnerHTML={{ __html: record.lead }} />
      <div className="record">
        <article id="prose" className="prose" dangerouslySetInnerHTML={{ __html: record.prose }} />
        <aside className="notes" aria-label="Scope and references">
          <p className="note">{record.note}</p>
          <section aria-labelledby="relationships-title">
            <h2 id="relationships-title" className="cap">Relationships</h2>
            {record.relations.length ? (
              <ul className="references">
                {record.relations.map((relation, index) => (
                  <li key={`${relation.relation}-${relation.target}-${index}`}>
                    <span className="relation">{relation.relation}</span>
                    <Reference reference={relation} />
                  </li>
                ))}
              </ul>
            ) : <p className="empty">No authored relationships.</p>}
          </section>
          <section aria-labelledby="sources-title">
            <h2 id="sources-title" className="cap">Sources</h2>
            {record.sources.length ? (
              <ul className="references">
                {record.sources.map((source: PortalSourceReference, index) => (
                  <li key={`${source.id}-${index}`}>
                    <Reference reference={{ target: source.reference, href: source.href, required: source.required }} />
                    <span className="relation">{`${source.role} · ${source.id}`}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="empty">No authored source references.</p>}
            <p className="downloads">
              <Link className="link" href={record.source} download>Download exact Markdown source</Link>
              <Link className="link" href={record.context} download>Download selected metadata</Link>
            </p>
          </section>
        </aside>
      </div>
      <details className="identity">
        <summary>Structured Knowledge and technical identity</summary>
        <p className="path">{record.path}</p>
        <dl>
          <dt className="cap">Source fingerprint</dt><dd><code>{record.sourceDigest}</code></dd>
          <dt className="cap">Semantic fingerprint</dt><dd><code>{record.semanticDigest}</code></dd>
        </dl>
        <pre className="data">{record.structured}</pre>
      </details>
    </>
  );
}

function Sources({ records, identity }: { records: PortalSourceRow[]; identity: string }) {
  return (
    <>
      <p className="cap">Publication boundary</p>
      <h1>Selected sources</h1>
      <p className="lead">Every included source is listed here. Nothing is fetched from the originating repository.</p>
      <h2 className="part">Knowledge</h2>
      {records.length ? (
        <ul className="sources">
          {records.map(record => (
            <li key={record.id}>
              <Link className="link id" href={record.href}>{record.id}</Link>
              <span className="path">{record.path}</span>
              <span className="downloads">
                <Link className="link" href={record.source} download>Exact Markdown</Link>
                <Link className="link" href={record.context} download>Selected metadata</Link>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="empty">No Knowledge records were selected.</p>}
      <details className="identity">
        <summary>Selection and source identity</summary>
        <pre className="data">{identity}</pre>
        <p><Link className="link" href="manifest.json">Inspect the complete publication manifest</Link></p>
      </details>
    </>
  );
}
