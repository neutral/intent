# Intent distribution

Install the `@neutral/intent` npm package for the command and Library. Source
builds also produce a runtime-free application payload and native bundles
containing that same application with a pinned Node runtime.
[Installation](../docs/install.md) owns installed use, updates and removal;
[integration](../docs/integration.md) defines externally managed runtimes.

## Build from source

Use Node.js 24 or later, npm, Python 3.10 or later and `tar` from this source root:

```sh
npm ci
npm test
npm run check
npm run release:check
```

The release checker tests this source tree, assembles one npm archive, exercises
its installed interfaces and bounded integer consumer, then builds the host's
native bundle from that same archive. It verifies installation, relocation,
update, removal, application-payload equality and service/MCP journeys in
disposable directories. Reports and archives remain under the printed temporary
run directory. Interactive browser, performance and other-host results require
separate observations.

For individual artifacts, choose a new output directory:

```sh
node distribution/assemble.mjs /tmp/intent-npm-build
npm run native:assemble -- --target darwin-arm64 /tmp/intent-native-build
npm run native:check -- /tmp/intent-native-build
npm run payload:assemble -- /tmp/intent-application-build
```

Native targets are macOS arm64/x64 and glibc Linux arm64/x64. Runtime checksums
live in `node-runtimes.json`. Native archives fix ordering, ownership, modes and
timestamps, and include inventories, licenses and SHA-256 sidecars. The native
CI matrix runs matching-host checks; an unexecuted job is not tested support.

## Application payload and shared runtimes

The payload contains `bin/intent`, `app/`, licenses and `payload.json`. Set
`INTENT_NODE` to an explicit compatible executable when using it without the
embedded native runtime. The launcher does not discover Node through `PATH`.
The [integration guide](../docs/integration.md) covers relocation and containers.

## Publish a release

npm publication is a manual maintainer action. Follow the
[npm release workflow](../workflows/npm-release/npm-release-workflow.md) from
this public source checkout to check versioned inputs, qualify the package,
verify the exact archive and publish it through npm. The workflow owns the
commands, registry authentication, failure handling and release record.

For native releases, the separate native CI matrix must pass on each claimed
target. Attach the checked archives and checksum sidecars to a draft release,
then publish it explicitly.

If qualification fails, inspect the preserved report, repair its source and
prepare new artifacts. Preserve old installed versions for explicit rollback;
do not overwrite a released version or silently replace its archives.
