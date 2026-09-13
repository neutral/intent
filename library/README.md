# Intent Library

The Library implements Knowledge parsing, relationships, queries, current-file authoring, Description coverage and explicit external Pack adoption. Apps consume the same
public operations. Checks stop at definition.

`readWorkspace` assembles current Markdown with `intent/project.json`, `catalog.json`
and `connections.json`, without enumerating implementation roots. Use
`reconcileWorkspace` when implementation inventory and Description coverage are
needed. Single-record inspection requires an explicit record context.
[Globals](../spec/spec/GLOBALS.md) owns metadata and connection
associations.

`readCheck(workspace, id)` returns one complete readable Check and directly
supported current Knowledge from the same observation. It includes full Markdown
bodies containing the criteria and evidence requirements, with subjects and
relationship scope alongside them, without
additional source reads. The [review guide](../spec/guidance/check-review.md) helps
authors examine what unacceptable implementation could still pass those criteria.

Canonical records keep exact source once. `readRecordDocument(record)` supplies
structured sections and criteria explicitly; queries and proposals return compact
metadata summaries. `listGuidance` and `readGuidance` discover the supplied authoring
material without depending on fixed family names.

## Installed usage

Install the package in the consuming project:

```sh
npm install @neutral/intent
```

```js
import { FileSystemSource, readWorkspace } from '@neutral/intent';

const source = await FileSystemSource.open('/path/to/repository');
const workspace = await readWorkspace(source);
console.log(workspace.valid, workspace.diagnostics);
```

The [API contract](../spec/spec/API.md) owns exports, effects and limits.
Schemas are available through `@neutral/intent/schemas/*`.

## Develop and verify

`index.ts` defines the public surface. The TypeScript build writes `dist/library/`.
Regression tests live in `tests/`, independent interpretation in
`tests/independent-reader/`, and installed qualification in `tests/qualification/`. Use
`npm test` for the TypeScript build and regression suites, or
`npm run release:check` for installed npm and native bundle checks.

Original source uses the repository's CC0-1.0 OR 0BSD license choice.
