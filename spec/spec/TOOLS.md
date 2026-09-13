# Intent Tools v1

Intent supplies one `intent` command through the `@neutral/intent` npm package.
The package includes its dependencies and built browser assets and requires
Node.js 24 or later. Native source builds also include a pinned Node runtime.
The reusable application payload requires an explicit `INTENT_NODE` absolute
path to a supported Node.js 24 or later runtime. See
[installation](../../docs/install.md) for npm use and source builds.

`intent --help` is the current command inventory and `intent --version` identifies
the release. Machine output uses `toWire`; ordinary output uses IDs, states and
diagnostics. Supply roots explicitly for reading and authoring in automation.

## Open a project

`intent open [PROJECT]` opens the local browser Editor, defaulting to the current
directory. Selection first canonicalizes the supplied existing directory. If it
contains an `intent` entry, that exact root is selected, including an invalid or
incomplete bucket that needs repair. Otherwise the command examines only ancestor
`intent` entries. One containing project is selected; several candidates refuse
with their roots and require an explicit selection. With no candidate, the supplied
directory is selected for guided initialization. Discovery does not search descendant
projects, enumerate implementation files or create authored files.

The selected canonical root stays fixed for the service. Merely opening it MUST
NOT initialize or modify authored content. The browser prepares initialization
from an explicit project name, owners and implementation roots, then shows the
proposal before separate application. Empty implementation scope remains valid
and makes no repository-wide implementation coverage claim.

The command binds loopback on an available port, prints the URL and selected root,
and attempts to open the system browser. If launching the browser fails, the URL
remains usable. `--no-browser` prints the URL without launching. `--port NUMBER`
selects a port from 0 through 65535; 0 requests an available port. An occupied
explicit port refuses startup. Ctrl+C or SIGTERM closes the service and its previews.
There is no background startup service.

For an explicitly configured container or forwarding host, `--bind ADDRESS` changes
the listening address and `--origin URL` declares the browser-visible origin.
Non-loopback binding requires an explicit origin and the returned session access
URL; the service continues to enforce its declared Host, Origin and local session
access protections. The default remains loopback. Startup prints the access URL,
fixed project root and actual listening URL. Reverse proxies must preserve the
declared public origin. Expose only the selected service port; the browser's site
preview shares it.

`--state-dir DIRECTORY` overrides the Editor's automatic project-keyed user-data
location for durable recovery. This state is separate from authored Knowledge and
from disposable cache; see [Editor](EDITOR.md). Opening a project does not make
agent sessions or comparison observations durable.

## Export a site

`intent export [PROJECT] --selection FILE --output DIRECTORY` reads an explicit
`{recordIds: string[]}` selection and builds the complete static reader before
creating a new destination. Selection JSON must be a regular UTF-8 file bounded
to 1 MiB. Root discovery follows `open`. The destination's parent
must exist; the destination must be absent and outside the Intent installation.
An occupied destination is refused. If a write fails after output creation, the
command identifies the partial output for inspection; authored sources remain unchanged.

`--dry-run` reviews the selected IDs, source paths and omitted-reference count
without writing output; `--output` may be omitted. Add `--json` to include the
selected output inventory and omitted references. `--title TEXT` supplies the public
site title; the default is `Intent publication`, without copying the project name.

`--preview` starts a loopback reader of the captured selected output and opens the
browser. It also works with `--dry-run`, so a site can be reviewed before a separate
export. `--no-browser` and `--port NUMBER` control preview launch. Ctrl+C stops it.
In JSON mode the preview URL goes to stderr so stdout remains one JSON value.

Export does not upload, deploy, resolve external references, expand selection through
relationships, or perform Checks. [Portal](PORTAL.md) owns the selected-content and
source-publication boundary. The positional form `intent export ROOT SELECTION.json
DIRECTORY` and `intent-portal ROOT SELECTION.json DIRECTORY` use the same implementation.

## Reading and preparation

- `intent guidance [GUIDE_PATH]`: Discover the installed shared, kind and family
  guidance, or read one discovered Markdown path. No repository root is needed.
  Discovery returns `{files, interpretation}`; a selected guide prints complete
  Markdown, or `{path, markdown, bytes, sourceDigest}` with `--json`. Files are
  discovered dynamically and individual reads are bounded to 256 KiB.

- `intent inspect ROOT`, `intent validate ROOT`: Read current Knowledge without
  scanning implementation roots; validate also maps validity/completeness to exit
  status. `intent reconcile ROOT` explicitly adds implementation inventory and
  Description coverage.

- `intent query ROOT TEXT`, `intent read ROOT ID`, `intent select ROOT ID...`: Search,
  exact source for parsed identity occurrences, or bounded graph selection. Invalid raw
  source remains available through workspace/Editor inspection.

- `intent read-check ROOT ID`: Read one current Check with its subjects, evidence kinds,
  full Markdown definition, directly supported current Knowledge and relationship
  scope. Ordinary output is readable Markdown; `--json` returns the Library
  `checkReading` carrier. The complete JSON carrier is bounded to 16 MiB; oversize
  reads fail without truncation. This command does not perform the Check.

- `intent compare BEFORE_ROOT AFTER_ROOT`: Compare two explicit observed scopes and
  affected IDs.

- `intent template KIND OPTIONS.json`: Emit JSON containing `sourceText` and its
  selected `context`; `--json` also includes the kind. Preserve both parts when creating the record.

- `intent init-propose ROOT REQUEST.json`, `intent create-propose ROOT REQUEST.json`:
  Prepare initialization or one new Product draft with explicit selectors.

- `intent change-propose ROOT REQUEST.json`: Prepare `edit`, `set-status`, `move`
  or `remove` for one current document. An edit may include a one-record `context`
  replacement; review shared-file changes with the Markdown.

- `intent pack-validate PACK_ROOT`: Inspect supplied Pack and existing manifest.

- `intent pack-build PACK_ROOT`: Return a candidate generated
  manifest for the supplied current Pack; does not save it.

- `intent adopt-propose ROOT REQUEST.json`: Prepare selected copies and
  Registry/provenance changes; request includes local `packRoot`.

- `intent remove-adoption-propose ROOT REQUEST.json`: Prepare removal of explicit `ids`;
  affected Work Type changes require `removeWorkTypeMemberships: true`.

- `intent operation ROOT ID`, `intent resume-propose ROOT ID`: Inspect a text-operation
  journal or prepare still-original pending changes.

- `intent lock-inspect ROOT`: Read exact lock and process state.

Add `--json` for complete structured output. Preparation/recovery commands emit
JSON regardless; specify it explicitly in scripts. The common
`--resolve-sources` option applies to workspace reading, query/read/read-check/select,
comparison, record change, initialization, creation, recovery and text
application. It examines supported local references, never external URLs.
Preserve the same setting for a proposal and its application. Adoption/removal
always resolve local sources; apply their FileProposal with `--resolve-sources`.
Editor uses its documented local-resolution profile. The CLI provides
no injected network resolver. Add `--reconcile` to workspace reading, comparison,
preparation, recovery or application when code correspondence is needed. Preserve
that mode on application too; ordinary Knowledge proposals do not depend on
unexamined implementation bytes.

## Explicit effects

`intent apply ROOT REVIEWED_FILE_PROPOSAL.json --resolve-sources` applies a
**FileProposal**, not its containing initialization/record-change/adoption result.
Extract and review `fileProposal`, every before/after file and proposed diagnostics.
A null proposal is not applicable. Preparation itself writes no file; shell
redirection, when used, is the caller's explicit save operation.

`intent operation-discard ROOT INSPECTED_OPERATION.json` removes the same inspected
interrupted journal using its exact digest, without changing source files.

`intent lock-release ROOT INSPECTED_LOCK.json` rechecks a saved observation and
refuses live, unknown or replaced locks. Application and recovery perform no
automatic merge or rollback.

## Exit results and limits

Thrown invocation/processing errors return 2. `validate` returns 0 for valid,
1 for completely observed invalid, and 2 for incomplete. Inspect/query/read/read-check/select/
compare/reconcile return 0 when a result was produced; inspect its stage flags. Proposals
and Pack checks use 0 for usable/valid and 1 otherwise. Apply uses 0 for completed
and 1 for refused or interrupted. A prewrite refusal has `journal: null` and no
written paths; interrupted operations name their actual recovery journal.
Operation inspection returning 0 does not mean every file is applied.

Request/proposal and Library limits remain enforced. Unsupported options are rejected. See [API](API.md) for custom host seams.

## Editor and maintained agent

`intent mcp ROOT` starts the maintained MCP stdio adapter with one explicit,
fixed root. It never discovers an ambient project or prints a startup banner to
stdout. The browser's **Connect an agent** flow generates host configuration with
an absolute command, its required arguments and this selected root. Configuration
is a proposal for the user to copy into their host; Intent does not modify host
settings. External-runtime payload configuration carries the explicit `INTENT_NODE`
path. A user-supplied container name produces a `docker exec -i` configuration,
without a TTY, using the selected executable and project path inside that container.
MCP observations and views remain process-local.

`intent editor ROOT` and `intent-editor ROOT` are compatibility aliases for `open`.
`intent agent ROOT` and `intent-agent --root ROOT` are aliases for `mcp`. Its immutable
progressive sessions, tool catalog, protocol date, bounds and unsupported
operations are in the [agent guide](../../apps/agent/README.md).

`intent_prepare_edit` prepares one existing UTF-8 Intent file from the agent
session's exact original bytes and an explicitly staged replacement under
`tmp/intent-agent/edits/`. The request supplies its relative path and SHA-256
digest; preparation verifies and copies at most one MiB into the reviewable
proposal. Larger replacements use a fresh Library observation/proposal and
application with identical options. CLI application needs a fresh preparation
using CLI-compatible default limits; the reduced agent limits cannot be dropped
from an existing proposal's basis. Shared file and serialized-journal limits
remain enforced.

The agent exposes guidance discovery, Knowledge reading, comparison and authoring operations. There
are no verification execution or operational-result tools. `intent_prepare_change`
exposes the Library `edit`, `set-status`, `move` and `remove` operations with the
inspected session profile. Its
retained result contains original/proposed workspace summaries, impact and the
nested FileProposal with exact before/after text; `intent_apply`
accepts the same result token only when that proposal exists. Stale sessions refuse
preparation and stale proposals refuse application. The tool catalog bounds inline
source text and validates the operation shape; the Library owns context and exact-source
rules. Adoption remains a separate Library/CLI/Editor workflow. [Editor](EDITOR.md)
names its implemented controls.
