# Install Intent

## Install from npm

Use Node.js 24 or newer and npm:

```sh
npx @neutral/intent --help
npx @neutral/intent open /path/to/project
```

The package includes the command, Library, MCP adapter, built browser assets,
schemas and authoring guides. It uses the Node runtime available to your shell;
installed use requires no build step.

For the shorter `intent` commands used throughout the guides, install globally:

```sh
npm install --global @neutral/intent
intent --help
```

npm's global command directory must be on `PATH`.

`intent open PROJECT` opens the selected project. Omit `PROJECT` to start from
the current directory. Opening a directory changes no authored files until you
explicitly apply a reviewed proposal in the browser. Keep the terminal running;
Ctrl+C stops the local service.

## Update and remove

Use npm to update or remove the global installation:

```sh
npm install --global @neutral/intent@latest
npm uninstall --global @neutral/intent
```

Project files and durable Editor drafts remain in their separate locations.
Restart a running Intent service or agent host after an update to use the new
version. Generated agent configurations use absolute Node and package paths;
regenerate them after changing the Node installation or npm global prefix.
Intent installs no background startup service or update daemon.

## Use the Library

Install the package in the consuming project for module imports:

```sh
npm install @neutral/intent
```

The [Library guide](../library/README.md) covers imports and the
[interface guide](interfaces.md) describes exports and commands. A global command
installation does not add the Library to another project's dependencies.

## Build from source

From a source checkout, use Node.js 24 or newer and npm:

```sh
npm ci
npm run build
node apps/cli/intent.mjs --help
node apps/cli/intent.mjs open /path/to/project
```

Run `npm test` and `npm run check` for source verification. The full
`npm run release:check` also needs Python 3.10 or later and `tar`; it qualifies
installed npm and native artifacts in temporary consumers.

### Build an npm archive

After building, choose a new output directory and install the resulting archive:

```sh
node distribution/assemble.mjs /tmp/intent-npm-build
npm install --global /tmp/intent-npm-build/neutral-intent-0.1.0.tgz
intent --help
```

### Build native bundles and the application payload

From the same checkout, choose new output directories:

```sh
npm run native:assemble -- --target darwin-arm64 /tmp/intent-native-build
npm run native:check -- /tmp/intent-native-build
npm run payload:assemble -- /tmp/intent-application-build
```

The native bundle adds its pinned Node.js 24.18.0 runtime to the application.
Native bundles are unsigned.
The runtime-free payload uses one explicitly supplied compatible Node runtime.
The [distribution guide](../distribution/README.md) describes assembly and
qualification; the [integration contract](integration.md) defines the payload's
layout and shared-runtime use.

The selected native targets are macOS arm64 and x64, and Linux arm64 and x64.
The bundled runtime requires macOS 13.5 or newer, or Linux kernel 4.18 or newer
with glibc 2.28 or newer. Linux packages target glibc systems. Windows and musl
Linux bundles are outside this matrix. Runtime requirements follow the
[pinned Node build contract](https://github.com/nodejs/node/blob/v24.18.0/BUILDING.md).
The native bundle has been exercised locally on macOS arm64. The application
payload has also been exercised with Node 24.18.0 in a Linux arm64 Debian
container. Other native targets have assembly and CI definitions; their tested
support awaits passing those jobs. A container result does not qualify Linux
desktop browser integration.

### Native installation, updates and removal

Extract the built native archive, open a terminal in its directory, then run:

```sh
./install
~/.local/bin/intent --help
~/.local/bin/intent open /path/to/project
```

This form includes Node and its runtime dependencies. It needs neither Node nor
npm installed separately. Add `~/.local/bin` to `PATH` for the shorter command.

The installer puts versioned bundles under `~/.local/opt/intent` and a command
link at `~/.local/bin/intent`. Supply both locations explicitly when needed:

```sh
./install --prefix "/path/to/Intent versions" --bin-dir "/path/to/commands"
```

To update, extract a newer Intent archive and run its `./install` with the same
options. The command switches to the new version. Previous installed versions
remain available until removal. The installer refuses to overwrite an unrelated
command or an existing copy of the same version. There is no update daemon or
background startup service.

Installation and removal acquire one exclusive installation lock. Wait for an
active installer to finish. After an interrupted installer, confirm no installer
is running before removing the reported `.installation.lock` file and retrying.

Agent configurations generated through the installed command retain its stable
command link and follow that link on the next host process start. A host already
running Intent keeps its current process until restarted.

For this native installation, run `intent uninstall` to remove the command and all versions recorded by that
installation. It preserves project files and durable Editor drafts. A changed
command or unrecognized installation is preserved for manual review.

The extracted bundle also runs directly as `./bin/intent`. You may move that
whole directory and continue using its command. Remove the extracted directory
to remove a portable copy. If an agent host used its absolute path, generate a
new configuration after relocation.

## Project and recovery data

Authored Knowledge belongs in each project's `intent/` directory. Editor drafts
and prepared recovery state use the operating system's user-data directory,
keyed by the canonical selected project. `intent open PROJECT --state-dir DIR`
selects an advanced durable-state override. Preserve that directory when moving
your working environment. The browser displays the active state location.

Temporary authoring journals in a project's `tmp/intent/` support interrupted
file application. Review and resolve them through the recovery controls. Build
and download caches are disposable and are separate from authored files and
durable drafts. MCP sessions and views stay in process memory.
