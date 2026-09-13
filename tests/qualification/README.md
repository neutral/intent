# Intent qualification programs

Run `npm run release:check` from the source repository root for the full native package
gate. It performs the regression suites, assembles the exact package archive,
installs it in an external consumer and operates the internal bounded integer fixture.

- `installed-consumer.mjs`: Public imports and declarations, archive contents, CLI, MCP,
  explicit reconciliation, supplied guidance, Editor service, Portal, family
  independence and optional
  authoring/Pack scenarios. Family removal and replacement must preserve
  public readings, tool catalogs and current Knowledge authoring.

- `verify-installed.mjs CONSUMER`: Bounded integer fixture against one
  explicit installed consumer.

- `editor-fixture.mjs`: Disposable repository and external Pack for browser
  observations.

- `native-journeys.mjs /absolute/installed/intent`: Runs the exact native launcher
  with an empty `PATH`, using disposable consumers with spaces in their paths.
  Exercises explicit initialization, discovery, Knowledge reading, review/apply,
  durable restart recovery, stale-write refusal, selected export/preview and actual
  MCP calls from generated browser configuration. This service harness is separate
  from real browser interaction and visual review.

- `container-journeys.mjs PAYLOAD [IMAGE]`: Mounts the runtime-free payload
  read-only in a disposable Linux container with one explicit Node runtime.
  Exercises authenticated no-browser startup, mounted authored access, durable
  restart recovery, selected export/preview and MCP stdio through Docker exec.
  Requires Docker and a pre-pulled compatible runtime image. Records image identity
  and actual runtime/platform; it does not compose other products.

- `performance.mjs`: Fixed synthetic corpora, in-memory queries, explicit
  reconciliation and proposal measurements.

Individual installed runs use `--extended --artifacts=/absolute/archive-directory`.
The installed harness prints its report and consumer paths. Fixture verification
requires that explicit consumer; neither the fixture nor its verifier ships in
the package. Optional `--linux` runs the installed harness in its configured
container and requires Docker.

The programs write run evidence to their output directories. Use the exact
artifacts, performed checks, results and limits when reporting a run. Browser,
Linux, performance and participant observations remain separate from the native
gate. Starting a fixture or passing service tests does not establish browser
accessibility or human usefulness.
