# Integrate the application payload

For application-level composition, source builds produce two versioned archive
forms. The native bundle includes the application payload and a pinned Node
runtime. The application
archive contains the same built application, runtime dependencies, browser
assets, schemas, guides and dependency licenses, with no Node runtime. Both
forms use the same `bin/intent` launcher and command implementation.

The runtime-free payload is intended for an environment that explicitly supplies
a compatible runtime. It never searches `PATH` for Node or npm:

```sh
INTENT_NODE="/absolute/path/to/node" "/path/to/intent-0.1.0-application/bin/intent" --help
INTENT_NODE="/absolute/path/to/node" "/path/to/intent-0.1.0-application/bin/intent" open /path/to/project
```

The supplied executable must be Node.js 24 or newer. The launcher refuses a
missing, relative, nonexecutable or older runtime path. A native bundle always
uses its embedded pinned runtime. A host configuration generated from the
application payload retains the explicit runtime choice. Regenerate that
configuration if the application or shared runtime moves.

## Stable layout and compatibility

`payload.json` identifies `intent.application-payload.v1`, the Intent version,
required Node engine, declared `supportedTargets`, `application: "app"`,
`entry: "bin/intent"`, and the
`INTENT_NODE` environment variable. The `app/` directory is the complete built
npm application with installed locked runtime dependencies. Its package exports
remain available to a Node host. `inventory.json` records the payload files and
their SHA-256 digests. The supplied application dependencies contain no native
addons or target restrictions, so the application bytes are platform-neutral
across the declared macOS and glibc Linux targets. A future dependency with
platform-specific code requires a new target-specific assembly decision.

Native assembly copies that exact payload, then adds `runtime/bin/node`,
`licenses/Node.js-LICENSE` and `bundle.json`. The native manifest identifies the
OS/architecture, pinned runtime archive checksum, and exact application archive
checksum. The native application files must match the payload inventory. The
native archive has its own complete inventory and SHA-256 sidecar.

A consuming environment can keep versioned payload directories and supply one
compatible runtime by absolute path. It owns runtime installation, updates,
compatibility qualification and the process environment. Intent owns the
application's declared engine requirement and command behavior. Do not mix
files from different payload versions. Move the complete directory to relocate
it. No installer, suite registry, task orchestrator or external product is
required to run the payload.

## Data and effects

`intent open [PROJECT]` discovers one project and starts a foreground local
browser service. The command prints the URL, opens the browser where supported,
and stops on Ctrl+C. `--no-browser` supports hosts that manage browser launching.
Prepared authored changes require explicit application. Project files stay in
the chosen project; durable Editor state uses the operating system's user-data
location or explicit `--state-dir`. Preserve durable state during application
or runtime updates. Disposable download/build caches are separate.

`intent export` writes a reviewed, selected static site to an explicit directory
outside the installation. `intent mcp PROJECT` uses stdio with one host-selected
root. Its observations and retained views remain process-local. The payload
neither executes Check definitions nor uploads or deploys exported sites.

## Container service contract

Mount the payload read-only, supply one compatible Node executable explicitly,
and choose a fixed container project root. The service reads that root only.
Project paths and export destinations are interpreted inside the container;
Intent does not translate host paths or discover host installations.

For example, this component-only launch uses the official Node image as the
runtime supplier. Replace the three host data paths and payload path with
existing absolute directories:

```sh
docker run --name intent-workspace --rm \
  --publish 127.0.0.1:8787:8787 \
  --mount type=bind,src=/absolute/payload,dst=/opt/intent,readonly \
  --mount type=bind,src=/absolute/project,dst=/project \
  --mount type=bind,src=/absolute/intent-state,dst=/state \
  --mount type=bind,src=/absolute/site-exports,dst=/exports \
  --env INTENT_NODE=/usr/local/bin/node \
  --env INTENT_STATE_DIR=/state \
  --entrypoint /opt/intent/bin/intent \
  node:24.18.0-bookworm-slim \
  open /project --no-browser --bind 0.0.0.0 --port 8787 \
  --origin http://127.0.0.1:8787
```

A suite may supply its shared Node installation at a different absolute path;
the application launch contract is the same. The process user must have read
access to the payload and selected sources, and write access to the project,
state and chosen export mounts for the corresponding effects. Mount only the
project and explicitly granted sources that the process needs. No Docker socket,
host home directory or host agent settings are needed inside this container.

`--no-browser` suppresses automatic browser opening. `--bind` defaults to
`127.0.0.1`; a non-loopback binding requires an explicit `--origin`. Port `0`
selects an available port for ordinary local use. Container port publication
normally needs an explicit nonzero port. The origin is the exact HTTP(S) origin
seen by the browser, including its published port. It may differ from the bind
address. The service prints `Intent ready: URL`, the selected canonical project,
and its listening address after binding. This readiness means the service is
available; inspect the browser's project findings separately. Invocation errors
and diagnostics use stderr. SIGINT and SIGTERM close the foreground service
and its captured previews; no startup daemon is installed.

The printed URL for an explicit origin includes a per-process session token.
Only that URL can bootstrap the browser page; an ordinary request without the
token receives HTTP 403. API requests require the same session token in
`x-intent-token`. Host must match the declared origin, and any supplied Origin
must match exactly. Public JavaScript and CSS contain no project bytes or
session token. A restarted service issues a new session URL. Treat the URL as
local authoring access and keep its logs private. The container example publishes
only on host loopback, following Docker's
[port-publishing controls](https://docs.docker.com/engine/network/port-publishing/).

The Editor occupies the root path of its origin. Path-prefix proxy mounting,
cross-origin API calls and forwarded-header inference are unsupported. A proxy
must preserve the declared Host and browser Origin, forward the session query
and API token header, and supply its own local access controls. Use a separate
origin or port per browser application. The service itself speaks HTTP; an
HTTPS origin requires a trusted terminating proxy. Site previews use secret,
selected-content URLs on this same origin and port. They expose captured
publication files only, never a generic filesystem server. The exported static
reader can be hosted under a prefix independently of the Editor.

## Persistent state and publication mounts

`INTENT_STATE_DIR=/state` or `--state-dir /state` selects the durable state base.
The explicit command option takes precedence. Under it, `projects/<key>/editor.json`
holds a draft and prepared proposal keyed by the canonical container project
path. Keep the container project mount path stable across restarts and updates
to retain that association. Saved state can contain exact source text and must
have the same access protection as the project. Restore requires review, and
application still refuses stale source. Concurrent recovery changes are refused
rather than silently overwriting a newer revision.

Authored files live under `/project/intent/`. Interrupted application journals
live under `/project/tmp/intent/` and belong with the project mount until the
operation is resolved. MCP sessions and comparison observations remain in
memory and disappear on process exit. The running browser and MCP service have
no persistent disk cache. Build/download caches belong to assembly and are
separate from these runtime mounts; container temporary storage can be disposable.

Choose an explicit new site directory under the export mount, for example
`/exports/reviewed-site`, in **Export site**. Its parent must already exist.
The browser previews the exact selection before writing it. The equivalent
command is:

```sh
INTENT_NODE=/usr/local/bin/node /opt/intent/bin/intent export /project \
  --selection /project/selection.json --output /exports/reviewed-site
```

Export neither writes the installation nor uploads or deploys content. Local
preview lasts until its foreground service stops; the exported reader persists
in the selected mount.

## Host-launched MCP stdio

Use the same adapter inside the running container. A host outside it can use
this generated configuration, replacing the explicit container name and paths:

```json
{
  "mcpServers": {
    "intent": {
      "command": "docker",
      "args": [
        "exec", "-i", "-e", "INTENT_NODE=/usr/local/bin/node",
        "intent-workspace", "/opt/intent/bin/intent", "mcp", "/project"
      ]
    }
  }
}
```

Docker's [`exec -i`](https://docs.docker.com/reference/cli/docker/container/exec/)
keeps stdin attached. Do not add `-t`: MCP needs newline-delimited JSON stdio
without a TTY. The host must have Docker access, and the container must already
be running. The adapter has the fixed `/project` root and prints protocol
messages only to stdout. **Connect an agent** can generate the Docker form from
an explicitly entered container name and the current process's executable,
runtime and project paths. It does not modify host settings.

`bin/intent --version` and MCP initialization report the same application
version in either payload form. Container qualification covers this component's
launch contract. A shared landing page, final image, project-selection composition
and suite installation/update flow require separate integration and verification.
