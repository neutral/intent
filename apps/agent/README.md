# Intent agent adapter

Launch the maintained MCP stdio adapter for one explicitly selected project:

```sh
intent mcp /path/to/project
```

In the browser, **Connect an agent** generates usable host configuration with the
absolute installed executable and canonical project root. Copy it into your host's
settings after review. This flow does not edit host configuration or start an agent
on your behalf. The npm installation and source checkout require Node.js 24 or
later. Their configuration names the absolute Node executable and package path;
regenerate it after changing the Node installation or npm global prefix. Native
bundles include their own runtime.

`intent-agent --root /path/to/project` remains a compatibility route. From the
source root, use `node apps/cli/intent.mjs mcp /path/to/project` after building.
The adapter uses the same public Library operations as the CLI and Editor and runs
independently of the browser service. The host supplies its normal user authorization
and shows declared effects before invoking effectful tools. The root is fixed for
the process; there is no ambient workspace discovery, root-switching tool, generic
shell tool, verification execution tool or external network source resolver.

[tools.json](tools.json) is the shared generic JSON Schema tool catalog and the
exact catalog returned by MCP `tools/list`. Inputs reject unknown fields.
Definitions carry standard read/destructive/idempotent/open-world hints plus
`_meta["io.neutral.intent/effect"]` (`read` or `write`). Pure
preparations additionally name their future `write` effect in
`_meta["io.neutral.intent/preparesEffect"]`. An effect label is descriptive; it
does not grant authorization or establish a sandbox.

## Protocol profile

The adapter implements the dated **2025-11-25** MCP stdio tools profile:
`initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`,
and cancellation notifications. The server responds with its supported date
when another date is requested; a client that cannot use it must disconnect.
It advertises only a fixed tools capability. The transport is newline-delimited
UTF-8 JSON-RPC; stdout contains protocol messages only and diagnostics use stderr.
These contracts follow the official [stdio transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports),
[initialization and version negotiation](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle),
and [tools protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

No HTTP transport, resources, prompts, sampling, elicitation,
task extensions, logging subscriptions, dynamic tool notifications, or batch
messages are implemented. Tool-list pagination is unnecessary for the fixed
maintained tool catalog; supplied list cursors are rejected. This is a tested bounded
adapter profile, not a claim of every optional MCP capability or interoperability
with every host. Tools return JSON in one text content block. Protocol/schema
errors use JSON-RPC errors; operation failures return `isError: true` and an
Intent error code. Hosts must inspect both.

## Reading and progressive results

1. `intent_inspect` reads the selected root and returns an opaque retained
   session, exact source basis, stage flags, counts, and initial diagnostics.
   It reads Knowledge by default. `reconcileImplementation: true` explicitly
   pairs that Knowledge with governed implementation inventory and coverage.
   `resolveSources: true` examines supported local references; external URLs remain
   unsupported. The selected mode participates in the retained source basis.
2. `intent_query` returns compact record metadata and paths. A cursor binds both
   the same session and query. `intent_read` retrieves exact retained Knowledge
   source bytes at a returned path, including invalid drafts. It also reads exact
   examined implementation and configuration files for code navigation, including
   `intent/project.json`, `intent/catalog.json` and `intent/connections.json`.
   Complete assembled Knowledge is available through selection results. Unexamined
   paths are unavailable rather than opened from the live filesystem.
   For a Check, use `intent_read_check` with `session` and `id`: one response contains
   full Check and supported Knowledge bodies, subjects, evidence kinds,
   relationship scope, and the
   [quality review guide](../../spec/guidance/check-review.md). No base64 decoding or global-file
   assembly is needed. The default selects the unique current Check; optional
   `path` selects an exact parsed occurrence such as a draft. Current support
   is not attached to a non-current occurrence.
3. `intent_diagnostics` pages the same observation. `intent_coverage` requires a
   session inspected with `reconcileImplementation: true`; ordinary Knowledge
   reading does not assess coverage.
   `intent_select` applies Library relationship traversal and retains its full
   result. `intent_compare` compares two retained sessions of this root, without
   opening another repository.
4. `intent_result` returns chunks of a retained generated JSON result.
   Source/result chunks use base64, byte offsets, total byte count, and explicit
   next offset, preserving UTF-8 boundaries and original line endings on
   reconstruction. Array pages return total count and next offset.
5. `intent_release` explicitly discards a session or result. Expired tokens fail;
   they never silently select a new observation.

Sessions are immutable observations held in process memory. Later filesystem
edits cannot change a continued page or retained source chunk. Another inspect
creates a new observation; compare exposes examined changes. `freshness:
observed` does not promise live filesystem freshness. Completeness, validity,
source limitations stay visible. Coverage identifies
structural ownership and does not prove prose adequacy or successful execution.
No sessions/results survive process exit. They support Knowledge navigation and
authoring; they do not record implementation outcomes.

`intent_read_check` returns the Library `checkReading` fields with `session` and the
canonical guide's Markdown in `reviewGuide`. Only direct current `verified-by`
sources are included; subject IDs and other edges do not imply support. Reading
flags describe definition/support assembly. The `context` fields retain full
workspace stages and diagnostics, including unrelated coverage findings. Duplicate current
source/target identities remain ambiguous. The guide is advisory; receiving it
does not mean a review has been performed.

For example, after inspection and discovery:

```json
{"name":"intent_read_check","arguments":{"session":"<retained-session>","id":"check.integer-boundaries"}}
```

## Authoring guidance

Before creating or revising Knowledge, use `intent_guidance` with no arguments
to discover the installed shared, kind and optional family guides. Read
`GUIDANCE.md`, the relevant kind guide and selected discovered family paths:

```json
{"name":"intent_guidance","arguments":{}}
{"name":"intent_guidance","arguments":{"path":"guidance/blueprint.md"}}
```

Discovery returns paths and byte sizes. A selected guide returns complete UTF-8
Markdown, its path, byte size and source digest; reads are bounded to 256 KiB
and are never silently truncated. No reading session or target-file access is
needed. Select families for the actual design questions; their names are not a
fixed catalog or record subtype. The [consumer guide](../../docs/using-intent.md#give-the-worker-authoring-guidance)
shows how to supply this guidance in Worker instructions. The common Check review
also accompanies `intent_read_check`.

## Explicit effects

`intent_prepare` takes a selected session and exact FileChange values (`path`,
`before`, `after`). It prepares a Library FileProposal without writes.
The returned token and `intent_result` provide the exact proposal for review.

For replacement of an existing examined Intent file, write the complete UTF-8
replacement under `tmp/intent-agent/edits/` in the selected repository. Then
call `intent_prepare_edit` with `session`, destination `path`, `replacementPath`
and `replacementDigest` in `sha256:<64 lowercase hex digits>` form. The request
contains references only. Preparation reads at most **1,048,576 replacement
bytes (1 MiB)** from the explicit staging file and verifies its digest. The
original destination bytes come from the retained session.

Both original and replacement text preserve their exact UTF-8 bytes and line
endings. Symlinks, unexamined originals, paths outside the staging directory,
digest mismatches and invalid UTF-8 are refused. The tool retains the replacement
inside the FileProposal; changing or deleting the staging file afterward cannot
change that proposal. Preparation writes no files and leaves staging cleanup to
the caller. Ordinary workspace discovery excludes `tmp/`, so staging alone does
not change the observation unless that material is explicitly referenced.

For example, after writing and reviewing `tmp/intent-agent/edits/catalog.json`,
compute its SHA-256 digest and send:

```json
{"name":"intent_prepare_edit","arguments":{"session":"<retained-session>","path":"intent/catalog.json","replacementPath":"tmp/intent-agent/edits/catalog.json","replacementDigest":"sha256:<digest-of-staged-bytes>"}}
```

The selected session needs a complete source basis. A readable invalid document
can still be repaired; whole-workspace validity is not required. Review the
resulting exact before/after text through `intent_result`, then apply separately.
The existing authored `intent/` scope and exact-source rules apply. Coordinated
record changes use `intent_prepare_change` below or their dedicated
Library/CLI/Editor operations.
Use ordinary `intent_prepare` for explicitly absent new files or deletions.

`intent_apply` accepts that prepared token. It re-examines the selected basis,
then applies Library per-file preconditions, the authoring lock, and temporary
operation journal. A stale adapter observation returns an operation error before
application. A Library prewrite refusal returns `status: "refused"`, `journal:
null` and no written paths. Completed operations remove their journal; interrupted operations identify retained
recovery material. Applying a source edit preserves status. Adoption remains a
separate Library/CLI/Editor operation.

## Coordinated record changes

`intent_prepare_change` accepts a retained `session`, exact record `path` and explicit
`operation`. It calls the shared `proposeRecordChange` using that session's limits and
source-resolution choice and reconciliation mode. A stale session refuses preparation.

The operation kinds are `edit`, `set-status`, `move` and `remove`. An edit supplies
complete `sourceText` and may include the selected record's complete replacement
`context`. It preserves local ID, kind and status. A status change supplies `status`;
a move supplies `targetPath`. Each stable ID has one document across all statuses.
The Library owns exact source checks and coordinated global-file changes.

```json
{"name":"intent_prepare_change","arguments":{"session":"<retained-session>","path":"intent/behavior/obsolete-export.md","operation":{"kind":"set-status","status":"retired"}}}
```

The retained `kind: "record-change"` result is available through `intent_result`. It contains
original/proposed workspace summaries, impact, diagnostics and a nullable nested
FileProposal. Workspace summaries contain mode, basis, config, coverage, current Discipline
choices/correspondence, stages, flags, findings and record metadata; exact source appears in the FileProposal changes.
Read all chunks and every changed file before application; preparation does not make
unrelated findings disappear. Pass an applicable, reviewed result token to
`intent_apply` as `proposal`. The [Director example](../../docs/using-intent.md#turn-a-worker-proposal-into-a-director-change)
shows the complete workflow.

## Bounds and termination

Input frames are limited to **1 MiB before full buffering**, strict JSON depth
32 and 32,768 parser nodes; duplicate keys and invalid UTF-8 are rejected.
Oversized unterminated input closes the connection with a stderr diagnostic.
Responses are at most 2 MiB. At most four requests and sixteen queued output
messages are allowed; output backpressure exhaustion closes the connection.
Each request ID is a bounded string or safe integer, unique within a connection;
after 16,384 request IDs the host must reconnect. EOF or termination cancels
active operations and releases ephemeral state. No shutdown RPC is defined.

Read sessions lower Library processing maxima to 4,096 records, 1 MiB per
record/source, 4 MiB aggregate record bytes, 16 MiB aggregate source bytes,
16,384 sources, and 32,768 graph edges. Other Library defaults apply. The actual
effective limits are returned, including any lower project limits. A bounded
partial observation remains labeled incomplete.

At most sixteen sessions (32 MiB total inspection JSON and exact snapshots each), thirty-two generated results
(64 MiB each), and 128 MiB total serialized retained data are allowed. These are
data bounds, not JavaScript heap/RSS guarantees. Each session's examined byte
snapshots are also capped at 16 MiB. Reservations account for active
inspection retention, and nothing is silently evicted. Release data
or reconnect when full. Queries return at most fifty records per page; diagnostics
and coverage return at most one hundred rows, and byte chunks at most 64 KiB.
Readable Check carriers are bounded to 512 KiB before adding the guide and
session. Oversized readings return `intent.check.bytes` with no partial
definition; use the Library's larger explicit bound or `intent read-check ROOT ID`,
or retrieve exact source chunks for manual inspection. The two MiB transport
limit still applies to the whole response.
Ordinary file preparation accepts at most sixty-four explicit changes, with
262,144 characters per before/after string and the whole one MiB frame bound.
Retained-original preparation accepts one existing destination and one staged
replacement file of at most one MiB, matching the adapter's per-source read cap.
Both routes enforce the Library's **3,000,000-byte serialized proposal** bound;
escaping of the retained before/after text contributes to that separate limit.
Lower workspace processing limits still determine whether the replacement can
be read as valid Knowledge or global metadata.

For a larger replacement, create a fresh observation and FileProposal through
the Library, then call `applyFileProposal` with identical reading options. To use
`intent apply ROOT REVIEWED_FILE_PROPOSAL.json`, prepare from a fresh observation
using the CLI's default limits and the same source-resolution and reconciliation
choices. An agent
session's reduced limits are part of its basis and cannot simply be dropped for
CLI application. Library file and journal limits still apply. A size refusal is
not resumable work; inspect the reported limit and revise the proposed change.
Oversized responses fail explicitly;
reduce the selection/page and use exact chunk retrieval.

Only one explicit authoring write runs at a time.
The host can cancel a request; cancellation of pure reader work is checked
before retention, while Library filesystem reads run to their bounded finish.

`tests/agent.test.mjs` exercises actual subprocess stdio, shared schemas/effects,
retained pages/source bytes, invalid requests, prepared writes and stale rejection,
refusal of unsupported execution tools, strict framing, and retention bounds.
Fixtures contain independently authored sample material; they do not establish broad
real-repository usability or universal MCP host conformance.
