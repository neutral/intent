# Changes

## 0.1.0

Initial release of Intent as the `@neutral/intent` npm package.

- Read and maintain six Knowledge kinds: Behavior, Assurance, Blueprint,
  Description, Check and advisory Discipline. Markdown owns substantive meaning;
  separate catalogs, connections and project configuration own shared context.
- Use `intent open` for local reading, guided initialization, editing, exact
  change review and interrupted-write recovery. The CLI and Library expose the
  same processing and authoring operations.
- Connect agents through the MCP adapter and export selected current Knowledge
  as a static Portal. Discipline Pack adoption requires explicit selection and
  review.
- Install one npm package containing the commands, Library APIs, built browser
  assets, specifications, schemas and authoring guidance. Source builds also
  produce native bundles and a payload for externally managed Node runtimes.

### Compatibility and support

Intent accepts only authored format 2 (`intent.knowledge-record.v2` with
`intent.processing.v2`). Earlier formats require independent reauthoring;
Intent provides no legacy readers or converters. Package, Library API, authored
format and generated result versions are separate coordinates.

npm use requires Node.js 24 or newer. Native build targets are macOS arm64/x64
and glibc Linux arm64/x64; Windows and musl Linux bundles are outside the
matrix. The [installation guide](docs/install.md) records runtime requirements
and platform verification limits.

Intent defines Checks. The implementation area performs verification and
reports satisfaction. Structural validation and package qualification do not
establish satisfaction of user Checks or human usefulness.
