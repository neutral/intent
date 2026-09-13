# Intent command

Use Node.js 24 or newer and [install Intent](../../docs/install.md) with npm:

```sh
npm install --global @neutral/intent
intent --help
intent open /path/to/project
```

With no path, `intent open` uses the current directory. It selects a direct Intent
project or a single containing project, and refuses ambiguous containing roots.
The command opens the browser and prints a fallback URL. Ctrl+C stops the service.
Use `--no-browser` to open the URL yourself, `--port 0` to select an available
port, or `--state-dir DIRECTORY` for an advanced recovery-location override.

The browser guides initialization with a project name, owners and implementation
roots. Review the proposed files and apply them explicitly. Opening an ordinary
directory writes no authored files. Empty implementation roots are allowed and
make no whole-repository coverage claim. Edit existing Knowledge, review the exact
proposed diff and apply; durable recovery survives service restart.

## Export and connect an agent

Choose **Export site** in the browser to preview selected current records and name
a new destination. The command uses the same publication rules:

```sh
intent export /path/to/project --selection selection.json --dry-run --preview
intent export /path/to/project --selection selection.json --output /path/to/new-site
```

The selection file contains an explicit `recordIds` array, for example
`{"recordIds":["behavior.storage","check.storage"]}`. References do not add records
automatically. The output parent must exist and the destination must be new and
outside the installation. Export creates a static reader; it does not upload or
deploy it. `--preview` opens a local reader, and Ctrl+C stops that reader.

Choose **Connect an agent** for host configuration scoped to the selected project.
The adapter command is `intent mcp /path/to/project`. Intent displays configuration
for you to copy; it does not edit your host settings. The adapter reserves stdout
for MCP and keeps observations in the running process.

## Inspect and author from the command line

```sh
intent --help
intent inspect /path/to/project --json
intent validate /path/to/project
intent query /path/to/project storage --json
intent read-check /path/to/project check.storage
intent reconcile /path/to/project --json
```

Format 2 reads compact Markdown headers with `intent/catalog.json` and
`intent/connections.json`; project configuration is `intent/project.json`.
Ordinary reads examine Knowledge. `reconcile` explicitly adds the selected
implementation inventory and Description coverage. Structural validation and
coverage do not establish that implementation satisfies its definitions.

`read-check` assembles a current definition with its subjects and directly supported
Knowledge in readable Markdown. Add `--json` for full definition bodies, selectors
and observation context. Use the [Check review guide](../../spec/guidance/check-review.md)
to examine whether its criteria exclude plausible wrong implementations.

`intent guidance` discovers installed authoring guides and families. The template
command emits both `sourceText` and selected `context`; preserve both. Authoring
commands prepare proposals. Application is a separate operation after review of the
exact proposed changes. The [Tools contract](../../spec/spec/TOOLS.md) defines
commands, options, result shapes and exit behavior. Checks remain definitions;
there is no verification runner or implementation report intake.

## Container and external-runtime use

The reusable application payload contains the same interfaces and assets. Set
`INTENT_NODE` to an absolute supported runtime path and launch its `bin/intent`.
For a container that publishes port 4310 to the host:

```sh
INTENT_NODE=/usr/local/bin/node ./bin/intent open /project --no-browser \
  --bind 0.0.0.0 --port 4310 --origin http://localhost:4310
```

Open the printed access URL, including its session token. Supply persistent storage
for the project and the recovery location, for example `--state-dir /state/intent`.
The default remains loopback; a non-loopback bind requires an explicit browser
origin. The Editor and its selected site preview share the service port. Send
SIGTERM to stop the process cleanly.

**Connect an agent** can generate `docker exec -i` configuration for an explicitly
named running container. It uses the project and executable paths inside that
container and preserves the configured runtime. It does not allocate a TTY or edit
host settings.

## Build from source

The `@neutral/intent` package contains the command, Editor, Portal and MCP adapter.
Its CLI API is `@neutral/intent/cli`. Install it locally in a consuming project
for Library imports. Native source builds also carry their own Node runtime.

From a source checkout, run `npm run build`, then use
`node apps/cli/intent.mjs` in place of `intent`. `cli.ts` owns argument handling,
`runtime.ts` owns command launch support, and `intent.mjs` launches the compiled
adapter. Compatibility launchers share this command implementation. Regression
tests live in `tests/`; installed command coverage lives in `tests/qualification/`.

Original source uses the repository's CC0-1.0 OR 0BSD license choice.
