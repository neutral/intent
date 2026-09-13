# Selected Knowledge Portal

Portal builds a portable static reading of explicitly selected current Knowledge.
Its only selection is `{recordIds: string[]}`. Each ID MUST resolve to exactly one
current record in the supplied observation. No relationship expands selection
implicitly. Unsupported selection fields are rejected before source reads.

## Selected input and output

`buildPortal(workspace, source, selection, {title?})` returns an inspectable file
plan and manifest without writing a destination. It reads selected record bytes
and the globals needed to derive their selected context, then compares source and
semantic fingerprints with the supplied workspace. Invalid, missing, ambiguous,
changed or non-current selections refuse the whole build.

The output contains a browse page, selected-source page, one page and exact
Markdown source per selected record, selected per-record metadata, fixed local
assets, and a manifest. Full global files, unselected records, implementation
files, runtime reports and temporary authoring journals are not
publication attachments. Authored references remain visible with explicit
omissions when their targets are not selected.

The manifest is `intent.portal-manifest.v1` under processor
`intent.processing.v2`. It binds the explicit selection, portable source basis,
selected record/source/context fingerprints, output inventory and self-digest.
Records identify stable IDs and current status.
The manifest excludes its own raw bytes from its output inventory to avoid
recursive hashing. Its canonical self-digest and returned file digest have
separate meanings. [Results](RESULTS.md) owns the exact carrier.

## Confinement and limits

Selected inputs MUST be bounded regular files within the source reader's scope.
Record count, selection count, per-file bytes, aggregate input bytes and generated
output bytes obey the supplied limits. Mutable inputs are rechecked after reading;
observed drift refuses publication. Failure returns no output files or manifest.
No external retrieval or destination write is implicit.

Only selected content participates in pages, search data, source downloads and
public provenance. Reader-local roots and unrelated diagnostics or inventories
MUST NOT leak into the output. A publication's whole selected Markdown and selected
metadata must be suitable for its audience; no automatic secret scanner is implied.

## Reading and serving

Render ordinary CommonMark as inert readable text and basic structure. Escape
authored HTML. Authored links, images and media MUST NOT become active embeds or
network requests. Fixed assets use local relative paths, so an ordinary static
host can serve the publication under a prefix. The host owns MIME handling,
access controls and deployment.

Provide labeled search, visible keyboard focus, a skip link, readable headings,
selected source downloads and omitted-reference explanations. These structural
features do not by themselves establish accessible or useful reading.

`intent export PROJECT SELECTION.json DESTINATION` takes a project, explicit
selection JSON and an absent output directory. The browser's **Export site** uses
the same builder and writer. Both build the complete plan before creating output
and refuse an occupied directory or a destination inside the installation. The
destination parent must already exist. Output remains outside the installation
and independent of the Editor service.

`--preview` serves the selected plan on an ephemeral loopback port and opens the
browser, with a printed URL fallback. The browser previews its selection before
writing an explicit destination and refuses changed source or selection after
review. Editor previews use the same configured origin and service port under an
unguessable selection URL, including in containers. Preview serves only captured
selected output bytes, rejects unrelated Host headers and ends when its owning
process closes. It needs no authored-content
writes, background service, upload or deployment. Generated files can subsequently
be served by an ordinary static host.

Publication establishes correspondence to the selected current Knowledge, not
adoption, implementation satisfaction or author authority.
