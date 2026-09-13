# Intent Editor v1

Intent Editor is the local interactive reading, navigation, authoring, comparison
and Check-definition surface. Start `intent open [PROJECT]`; the current directory
is the default selection. The command discovers a project under the
[Workspace contract](WORKSPACE.md), starts the local service, opens the browser and
prints a fallback URL. `intent editor` and `intent-editor` remain compatibility
routes. The installed bundle includes its Node.js runtime; SDK callers require
Node.js 24 or later.

The Library entry is `startEditor(root, {port?, bind?, publicOrigin?, stateDirectory?, command?})`.
`stateDirectory` overrides the base directory for durable Editor recovery;
`command` supplies an executable and argument prefix for generated agent
configuration. Its returned `close` operation stops the service and any selected
site preview. The command handles terminal shutdown without a background service.

The service binds `127.0.0.1` by default and prints its URL. It has one selected
root, requires its session token for API access and rejects unrelated Host or
Origin headers. No companion service is required.

An explicit `--bind ADDRESS` supports container routing. Non-loopback binding
requires an explicit `--origin http(s)://HOST[:PORT]`, represented by `bind` and
`publicOrigin` in the SDK. The origin has no path, credentials, query or fragment;
its Host and Origin are the only accepted routing values. When an origin is
supplied or the bind is non-loopback, the printed access URL contains a session
secret. The root HTML requires that secret before exposing the API token; static
application assets contain no secret. In-app home navigation retains the access
URL, and a new service process generates a new secret. The returned `listenUrl`
reports the actual bind separately from the public access URL. Use `--no-browser`
for headless service startup.

This is a single-project service with a bearer session secret, not a remote
collaboration or account system. Container operators explicitly map the service
port, project directory and durable state location. Bind and routing configuration
do not broaden the selected project or local source grants.

## Read and navigate

The sidebar searches source/meaning and filters all six kinds. Invalid records
remain visible by path for repair. Selecting a record opens these views:

- **Meaning**: Request a rendered view of the full Markdown body, including optional
  narrative and entry anchors. Raw HTML/unsafe links are disabled and images become text.

- **Relationships**: Follow authored incoming/outgoing edges to available current
  identities.

- **Implementation**: Explicitly reconcile Description coverage, then read governed
  files for which the selected Description is a primary owner. Other records can
  lead to a Description through relationships.

- **Source**: Inspect and edit original Markdown and selected record metadata
  with coordinated change review.

The repository panel shows stage results and up to 100 findings; further findings
remain available through Tools. Coverage establishes structural ownership, not
that prose explains new code. Refresh creates another source observation and can
expose changes. Initial browsing, source editing and ordinary proposals read Knowledge
without enumerating implementation roots. The Implementation tab and repository
comparison request reconciliation explicitly. The service consistently requests
supported local source resolution.

## Author and compare

An uninitialized root presents an initialization form with explicit owners and
implementation roots. **New Product draft** creates one of the five Product
kinds with visible placeholders. Description requires chosen coverage; Check
requires chosen subjects. Neither operation infers implementation meaning.

**Project configuration** reads and reviews `intent/project.json`,
`intent/catalog.json`, `intent/connections.json` and
`intent/disciplines/registry.json`. Source editing offers **Review source change**; the proposal
shows every original/proposed file. Application is a separate **Apply reviewed changes** action.

For parsed Product records, the Source view offers source edits, explicit
lifecycle status changes, moves and removal. The metadata editor contains only
that stable ID’s catalog registration and connection entries. An edit reviews
Markdown and selected metadata together. The Library enforces operation
eligibility even if a control is displayed. Plain source editing also supports
repair of invalid documents.

Every proposal shows exact before/after file changes and summaries of affected
Knowledge, relationships and source citations. Ordinary editing leaves implementation
coverage unexamined. Scope and diagnostic context remain visible; source diffs
retain invalid text. A comparison failure disables application until a fresh proposal can be
reviewed; incomplete observations and truncated previews remain explicit.

**Compare changes** retains one exact original observation before edits made
through repository tools. **Compare with repository now** reads a later
reconciliation observation and presents original/proposed code with governing record
summaries. Full definitions remain available through their record views.
Retaining another observation replaces the previous in-memory observation; explicit
release and service exit discard it. The observation retains at most 64 MiB of
examined bytes. Download comparison JSON for a portable review copy. Code previews default to 128 paths, 4 MiB per read,
16 MiB total bytes and 32 KiB per displayed source, with explicit omitted/binary/
unavailable/truncated states. Affected record summaries are capped at 256 IDs and
8 MiB; the serialized review has a 32 MiB bound. Arbitrary two-root comparison
remains available through Tools/Library.

Unsaved text blocks in-app navigation and requests a browser leave warning.
**Refresh** preserves the open form while updating repository information. In
the Source view, both Markdown and selected metadata retain their exact local
text. Configuration editing preserves the selected file's text in the same way.
Source and configuration edits also save their exact local text and original
source/context for durable recovery. Saving a draft never writes authored files;
Refresh does not apply it. Initialization, creation and adoption form choices
remain in browser memory until they produce a prepared FileProposal.

When the edited source and selected metadata are unchanged, the author can
prepare again against the refreshed workspace. If either changed, Refresh shows
the original and current text, keeps the local editors, and blocks preparation
until the author explicitly keeps local text for review against the current
source or discards it in favor of current source. Keeping local text does not
merge content or apply a write. A missing or unreadable record cannot silently
replace the retained editor contents. Change preparation uses the Library’s exact source preconditions.

The local `GET /api/edit-state?path=...` endpoint returns one observed workspace,
the selected source text or an observed absence, and its selected record
context. It permits authored Knowledge paths and the four configuration files
named above. The service obtains the source from that same observation, with
the existing 4 MiB source bound and 64 MiB observation-retention bound. Source
preparation checks the exact original text as well as the workspace basis;
browser change requests also carry the original selected context. A source or
context conflict returns HTTP 409 without a proposal. Repository changes during
change preparation also require another refresh and preparation.

Stale source-basis and exact-before checks refuse changed writes during
application. An application refused before journal creation reports no written
files and no recovery journal. The Editor preserves local text and offers
refresh followed by a new preparation. An interrupted application with a real
journal identifies that journal; **Operation recovery** inspects its operation
ID and prepares only pending original files, preserving the old journal.

## Durable authoring recovery

The service automatically retains source/configuration drafts and prepared
FileProposals outside the project. The default base is `~/Library/Application
Support/Intent` on macOS, `%LOCALAPPDATA%\Intent` on Windows and
`$XDG_DATA_HOME/intent` (or `~/.local/share/intent`) on Linux. A project directory
under `projects/` is keyed by a SHA-256 digest of the canonical selected root;
symlink aliases share the same recovery. `--state-dir`, the SDK's `stateDirectory`
option or `INTENT_STATE_DIR` overrides the base in that order. The override does
not change project selection.

Opening a directory creates no recovery file. The first draft save or prepared
proposal creates private recovery data. **Saved authoring work** offers explicit
restoration, download, proposal review and discard. Source/configuration drafts
retain exact original text and selected context. Restoration compares them with
the current source and requires the existing conflict choice when either changed.
A saved proposal must pass fresh proposal review and the same apply preconditions.
Successful application clears its saved draft and proposal; refused application
preserves both. A recovery cleanup error after completed application reports the
completed write and the cleanup error separately.

Recovery uses a 16 MiB bounded, atomically replaced file. Local requests retain the
4 MB input limit. A failed save remains visible and leaves local editor text
available; it must not be reported as saved. Concurrent services use a scoped write
lock and an observed recovery revision to refuse overwriting another session's
newer saved work. Browser requests also carry the last observed revision so another
tab cannot silently replace newer saved drafts or prepared changes. The author can download the open draft and explicitly choose
which saved or local draft to continue. Recovery has no expiry and survives
installation updates/removal. Moving a project selects another recovery key;
the original saved work remains in its previous location.

Authored Knowledge remains under the selected project's `intent/`. Interrupted
write journals retain their existing `tmp/intent/` contract. Durable Editor
recovery is separate from both and is not a cache. Comparison observations and
agent sessions remain process-local and are never serialized into Editor recovery.
Selected site previews are also disposable in-memory data.

## Export and agent connection

**Export site** lists current records for explicit selection and proposes a sibling
`PROJECT-site` destination. **Preview selected site** builds the selected static
reader in memory and provides a preview on the same Editor origin under an
unguessable selection URL. The preview displays the
selected records and omitted references. **Export reviewed site** requires an
explicit new destination directory and an unchanged selection and source basis.
It writes the reviewed plan through the same writer as `intent export`. An occupied
destination is refused. No upload or deployment occurs. [Portal](PORTAL.md) owns
which content can enter the publication. Closing the Editor closes the preview;
the exported static files remain independently usable.

**Connect an agent** generates downloadable MCP host configuration with an absolute
installed invocation and the fixed canonical project root. The author installs this
entry in their host and reconnects it. The Editor does not modify host settings.
The generated server runs `intent mcp PROJECT`, preserving stdio protocol behavior,
local source grants, prepared writes and explicit implementation reconciliation.
The container option takes an explicit running container name and generates
`docker exec -i` with the installed invocation and selected container root, without
a TTY. An explicitly selected external Node runtime is passed through its invocation
environment. Neither mode edits actual host configuration.
Moving the installation or project requires regenerating the configuration. This
flow does not add retained agent observations or execute Check definitions.

## Advisory practices

**Advisory practices** takes an explicitly selected local Pack directory, including
one outside the repository. Inspect its existing manifest, publisher/version,
practice bodies and curated Sets. Selecting a Set fills the record choices; it
does not adopt them. Review target paths, source/release attribution and selected
copy/Registry changes before applying adoption or update.

Removal selects explicit currently adopted identities and optionally includes
affected Work Type memberships. The proposal removes their current target copies, selected metadata and Registry
entries.
Local edits cannot continue to claim exact publisher-byte correspondence. Advice
is optional regardless of current/adopted status.

## Qualification boundary

The implementation has automated real-file/service tests. These tests do not
establish human usefulness, complete fresh-agent workflows, keyboard and focus
behavior, accessibility or responsive layout. Browser qualification must exercise
the exact build and report its scope under [Conformance](CONFORMANCE.md).
Intent Portal has its own [static publication contract](PORTAL.md), without this
local service or any editing controls.
