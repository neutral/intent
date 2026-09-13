# Interfaces

The package `@neutral/intent` supports Node.js 24 or newer. Its root export and
`@neutral/intent/library` expose the shared Library API. The `/processing`
export provides deterministic processing helpers. `/schemas/*` resolves the
schema files. `/cli`, `/agent`, `/editor` and `/portal` expose their adapters.

## Library

Run `npm install @neutral/intent` in the consuming project before importing it.

```js
import { FileSystemSource, readWorkspace, queryKnowledge, toWire } from '@neutral/intent';

const source = await FileSystemSource.open('/path/to/repository');
const workspace = await readWorkspace(source);
const results = queryKnowledge(workspace, { text: 'storage', limit: 20 });
console.log(JSON.stringify(toWire(results)));
```

`MemorySource` supplies immutable in-memory inputs. `readWorkspace` reads
Knowledge; `reconcileWorkspace` adds implementation inventory and coverage.
`queryKnowledge`, `selectKnowledge` and `compareWorkspaces` operate on retained
observations. `readCheck` assembles a Check and its directly supported current
Knowledge. `readRecordDocument` exposes structured sections of a parsed record.

`proposeInitialization`, `proposeRecordCreation` and `proposeRecordChange`
prepare exact file changes. `reviewFileProposal` compares their proposed overlay.
`applyFileProposal` applies reviewed text under the same workspace options.
`inspectOperation` and `proposeOperationResume` support explicit recovery.
`inspectAuthoringLock` and `releaseAbandonedAuthoringLock` inspect and release
abandoned locks. `discardOperation` removes an exactly inspected journal.

`buildDisciplinePack` and `validateDisciplinePack` examine a supplied publisher
Pack. `proposeRepositoryAdoption` and `proposeRepositoryDisciplineRemoval`
prepare corresponding target edits. `listGuidance` and `readGuidance` read the
supplied authoring collection. Exact argument and result signatures are in the
installed `.d.ts` files.

## Commands

Run `intent --help` for invocation syntax and `intent --version` for the package
version. `--json` requests structured output. `--resolve-sources` examines
supported local sources. `--reconcile` requests implementation reconciliation.
Preserve the selected options across proposal preparation and application.

| Operation | Commands |
| --- | --- |
| Open the browser | open |
| Export selected static content | export |
| Connect an agent over MCP | mcp |
| Read Knowledge | inspect, validate, query, read, read-check, select, compare |
| Examine code coverage | reconcile |
| Read advice | guidance |
| Prepare Knowledge | init-propose, template, create-propose, change-propose |
| Apply reviewed files | apply |
| Inspect and recover | operation, resume-propose, operation-discard, lock-inspect, lock-release |
| Use a Discipline Pack | pack-build, pack-validate, adopt-propose, remove-adoption-propose |
| Compatibility aliases | editor, agent, intent-editor, intent-agent, intent-portal |

Validation exits with 0 for valid, 1 for completely observed invalid and 2 for
incomplete. Invocation or processing errors exit with 2. Read commands returning
0 have produced a result; its flags describe validity and completeness.
Proposal commands use 0 for a usable proposal and 1 otherwise. Apply uses 0 for
completion and 1 for refusal or interruption.

## Agent, Editor and Portal

`intent mcp /path/to/repository` starts an MCP stdio service using protocol
version `2025-11-25`. The browser's **Connect an agent** control generates a host
configuration using the installed executable and one fixed project root.
Review and copy it into your selected host. Intent does not edit host settings.
Its [tool catalog](../apps/agent/tools.json) defines bounded inputs.
Inspect a session, retrieve the required source, prepare a change, retrieve the
whole retained result and separately apply the selected proposal token.
`intent_prepare_edit` accepts one staged replacement under
`tmp/intent-agent/edits/`, verified by SHA-256, up to one MiB.

`intent open [PROJECT]` discovers and opens the selected project in the local
Editor. It opens a browser and prints its URL. `--no-browser` prints the URL
without launching a browser; `--port NUMBER` selects a port and `--state-dir DIR`
overrides the automatic durable-state location. Ctrl+C closes the service.
The Library's `startEditor(root, {port})` returns the service URL and a `close`
operation. The Editor supports inspection, guided authoring, comparison,
reviewed application, recovery and selected Discipline adoption.

`intent export ROOT --selection SELECTION.json --output NEW_DIRECTORY` saves a
static reading. Use `--dry-run` to review selected content without writing, or
`--preview` to start a local reader. Export never uploads or deploys. The
Library's `buildPortal(workspace, source, {recordIds}, {title})` returns an
inspectable file plan. Every selected ID resolves to one current record, and
selected input drift refuses the build. Serve the saved directory with a
static host after reviewing its contents.
