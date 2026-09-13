# Use Intent from another repository

Install Intent outside the target repository, select the repository explicitly, and
start with one promise and one Check. The [operating guide](../spec/OPERATING.md)
explains authoring; the [IntentForge portfolio guide](https://github.com/neutral/intentforge/blob/main/README.md)
explains how a Director can combine Intent definitions, Atlas navigation and Forge
Workers. Each product remains independently usable.

## Install and open

Use Node.js 24 or newer and npm. Install the command globally, then select the
project to open:

```sh
npm install --global @neutral/intent
intent --help
intent open /path/to/project
```

One package supplies the browser, commands, MCP adapter, site export, schemas
and authoring guides. The [installation guide](install.md) covers updates,
removal and source builds.

`intent open` defaults to the current directory. It selects the current Intent
project using the [command discovery rules](../spec/spec/TOOLS.md), reports
ambiguous selection, and opens the local browser. The terminal also prints a URL
if automatic browser opening is unavailable. Keep that terminal running while you
work; Ctrl-C stops its local service.

For a directory without Intent, the browser offers a project name, owners and
implementation roots. Review every proposed file, then choose **Apply reviewed
changes**. Opening the directory and preparing initialization leave authored files
untouched. Empty implementation roots mean no implementation scope has been
selected; they make no whole-repository coverage claim.

Commit the current authored `intent/` files with the target project. Source roots
are deliberate selections, and implementation reports belong in the implementation
area. The [workspace contract](../spec/spec/WORKSPACE.md) owns the layout and
current-file boundary. Contributor instructions in the Intent source repository
govern Intent itself; consumer projects supply their own instructions.

## Read, edit and recover

Select a record to read its meaning, relationships and source. Edit its Markdown
and selected metadata together, choose **Review source change**, and inspect the
before/after files and affected Knowledge. Apply is a separate explicit action.
Changed source or metadata requires fresh review; a stale proposal cannot overwrite
newer authored content.

The Editor keeps recoverable drafts and prepared changes in the operating system's
user-data location for the canonical selected project. Its recovery view lets you
restore or discard that material. Installation updates and removal preserve it.
The [Editor guide](../apps/editor/README.md) explains the advanced storage override
and the distinction between draft recovery, authored files and temporary operation
journals. Agent sessions and comparison observations remain process-local.

Ordinary reading assembles Knowledge without scanning implementation files. Open
**Implementation** or run `intent reconcile /path/to/project` to examine the declared
implementation scope and Description coverage. `--resolve-sources` examines selected
local source references. Resolution, reconciliation and structural validation answer
different questions; none proves that software satisfies a Check.

## Export a site

Choose **Export site** in the browser, select the current records to share, and
preview their selected content. Supply an explicit new destination outside the
installation and review it before export. The generated static reader includes the
selected Markdown and its selected metadata. Relationships do not add records to
the selection, and implementation files and reports are excluded.

For the command line, save the exact selection to a JSON file:

```json
{"recordIds":["behavior.integer-token","check.integer-boundaries"]}
```

Use IDs from your project, then review the selection before creating a new directory:

```sh
intent export /path/to/project --selection selection.json --dry-run
intent export /path/to/project --selection selection.json --output /path/to/new-site --preview
```

The output's parent directory must exist. `--preview` serves the captured static
reader on loopback while the command runs. Export creates local files; you choose
any later hosting or deployment separately. The [Portal guide](../apps/portal/README.md)
explains the publication boundary.

## Connect an agent

Choose **Connect an agent** in the browser. Copy the generated configuration for
your host, which launches the installed `intent mcp` command with the fixed,
canonical project root. Intent shows the configuration for review and does not
edit host settings. The [agent guide](../apps/agent/README.md) explains the supported
protocol, write authorization and process-local sessions.

## Library and container use

For Library imports, run `npm install @neutral/intent` in the consuming project.
The [Library guide](../library/README.md) covers its independently usable API.
Containers can consume the [runtime-free payload](../distribution/README.md#application-payload-and-shared-runtimes)
with one explicit compatible Node runtime. Project paths, persistent state and export
destinations belong to the container filesystem.

## Give the Worker authoring guidance

The specification's [common guidance](../spec/GUIDANCE.md) explains each
kind's essential meaning. Optional [families](../spec/families/README.md)
supply deeper questions, examples and design methods. Workers develop the
record's essential sections and add useful views; optional categories can be
omitted and ordinary prose needs no generated entry IDs.

Discover and read the supplied guidance through the installed CLI:

```sh
intent guidance
intent guidance GUIDANCE.md
intent guidance guidance/blueprint.md
```

Then read the discovered family paths that address the design questions. Family
contents can change independently; choose from the returned files instead of
requiring a named method. The common specification remains usable with no families.

MCP workers use the same collection without needing filesystem access to the
installation:

```json
{"name":"intent_guidance","arguments":{}}
{"name":"intent_guidance","arguments":{"path":"GUIDANCE.md"}}
{"name":"intent_guidance","arguments":{"path":"guidance/blueprint.md"}}
```

Each read returns complete Markdown, its source digest and byte size. Oversized
files fail explicitly rather than supplying partial instructions. Direct host file
access to the installed `spec/` is also available when convenient.

A Director can adapt this instruction in the target's agent guidance:

```text
Before creating or revising Intent records, discover the supplied guidance with
intent_guidance or intent guidance. Read GUIDANCE.md and the relevant kind guide.
Start from supported product meaning and inspected sources. Select useful families
and representations for this subject. Keep the essential sections, omit empty
categories and develop enough detail for another Worker to act without guessing.
For Blueprints, explain which design questions the chosen views settle and how
the decisions support the relevant Behavior and Assurance. Identify consequential
unknowns and propose supported improvements. Preserve record ownership, declared
relationships and the normal stable-ID and current-file authoring rules.
```

Use existing target authorization for proposals and application. The referral
below supplies the definitions to which that authoring judgment applies.

## Give the Director and Worker the complete definition

The browser's **Connect an agent** flow supplies an absolute executable and project
path for the host's MCP configuration. The [agent guide](../apps/agent/README.md)
documents the supported profile and limits. The host supplies authorization for
writes. The adapter reads one selected root and retains observations until release
or process exit.

Ordinary inspection reads definitions. Request `reconcileImplementation: true` in
`intent_inspect`, or run `intent reconcile ROOT`, when the task needs governed code
inventory and Description coverage. Preserve that mode when preparing and applying
a change based on the observation.

Begin with one user-visible Behavior and a Check that could expose a plausible broken
implementation. Draft them with the Editor or `create-propose`, replace placeholder
meaning, and review their connection before promotion. A current Check defines the
assessment; it does not claim the implementation exists or passes.

For an existing Check, give the Worker this reading rather than only its Markdown path:

```sh
intent read-check /path/to/project check.committed-values
```

With MCP, inspect, discover the actual Check ID using `intent_query`, then call
`intent_read_check` with that session and ID. Use the selected occurrence's path when
reviewing a draft. The reading includes the full definition, subjects and evidence
kinds selected in `intent/connections.json`, and directly supported current Knowledge
connected through `verified-by`. It also carries relationship scope, diagnostics and
limits. A subject selector alone does not declare that a Check supports that record.
Use `intent_select` for additional context beyond this direct support.

A Director can place this instruction in the target's agent guidance:

```text
Before implementation, inspect this repository's Intent and read the selected Check
with read-check or intent_read_check. Read its supported Knowledge, subjects,
criteria, evidence requirements, limits and diagnostics. State which definition IDs and source basis you consumed. Ask the Director to resolve an ambiguous requirement and
propose a precise definition change when needed. Perform verification in the
implementation area and report its actual scope and result there. Do not change a
current definition merely to make a failing implementation pass.
```

When Atlas leads to an Intent source, read its current Intent definition before acting.
When Forge starts a Worker, include the target paths available inside that Worker and
the selected definition IDs in its Direction. The portfolio guide owns the combined
procedure; Intent assigns no Worker, merge or completion authority.

## Turn a Worker proposal into a Director change

Suppose `intent/checks/committed-values.md`, ID `check.committed-values`, supports a
Behavior promising that acknowledged values survive writer closure. Its Pass section
currently says:

> The writer reads back the acknowledged value.

The Worker reports: “A memory-only store can satisfy this criterion. I propose closing
the writer and requiring a fresh reader to recover the value. Failure should include a
missing or different value after closure. Missing closure or reader identity evidence
should remain indeterminate.” Actual findings stay in the implementation report; this
is a proposed definition improvement.

The Director reads the supported Behavior and the
[Check review guide](../spec/guidance/check-review.md), then reviews the complete
revised Check. Keep the identity when it still defines the same proposition. Update
Pass, Fail, Indeterminate, Evidence and Method together where needed; preserve the
actual scope exclusions, such as power failure.

1. Inspect the target and use `intent_read` for exact original Markdown. Prepare the
   complete edited document, preserving its four-field header and essential
   sections. Do not serialize derived reading fields into its header.
2. Call `intent_prepare_change` with that `session`, exact `path`, and an `operation`
   containing `kind: "edit"` and complete `sourceText`. If subjects or evidence kinds
   change, include the selected record's complete replacement `context` from
   `intent_select`, preserving its unrelated entries.
3. Read every result chunk through `intent_result`. Review original/proposed workspace
   summaries, affected record metadata and every exact `fileProposal` change. Check
   `complete`, the presence of `fileProposal` and remaining diagnostics. A targeted change can be prepared despite unrelated
   workspace findings.
4. Apply the reviewed, authorized result token through `intent_apply`. Inspect its
   status, refresh and reread the Check before referring another Worker.

An edit preserves ID, kind and lifecycle status. Change status separately with
`set-status`; `move` preserves identity and metadata ownership; `remove` removes the
current document and owned metadata. Each ID has one document across all statuses.
The [authoring contract](../spec/spec/AUTHORING.md) owns these operations.

Stale sessions or proposals require fresh inspection and review. A refused apply with
no journal has nothing to resume. For interrupted application, inspect actual file
states, prepare only pending original changes and explicitly discard the exact inspected
journal when it is no longer needed. Completed operations remove their own journals.

## Ease into routine use

Start with one risky boundary, one explicit implementation scope and one useful Check.
Read the definition at task start and review whether the actual result satisfies it at
task end. Expand after the first task reveals a real missing promise, selector or
explanation. A narrow accurate definition is easier to maintain than placeholders for
all six kinds.

Add Atlas navigation when finding the relevant sources becomes difficult. Use Forge
when the work benefits from an independently addressable Worker and environment. Keep
current promises in Intent, navigation in Atlas and task instructions in Forge. Link
to each owner instead of maintaining copies of its meaning. Revisit definitions when
implementation exposes ambiguity.
