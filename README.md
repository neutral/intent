# Intent

Software development spans conversations, contributors, and coding agents,
each carrying only part of the context. Intent preserves the project Knowledge
they need to continue the work: its intended behavior, constraints, design
rationale, implementation explanations, and verification criteria.

One installation supplies the command, browser Editor, site export and MCP
connection. The package also exposes an independent TypeScript Library.

## Install and use

Use Node.js 24 or newer and npm:

```sh
npx @neutral/intent --help
npx @neutral/intent open /path/to/project
```

The package includes the command, built browser assets, schemas and authoring
guides. To use the shorter `intent` command, run
`npm install --global @neutral/intent` and keep npm's global command directory on
`PATH`. The [installation guide](docs/install.md) covers updates, removal and
source builds. Start with [daily use](docs/use.md) and the
[documentation index](docs/README.md).

Intent maintains Check definitions. The implementation project performs the
assessment and records its findings. Current files carry current meaning;
Git retains committed versions.

## Build from source

```sh
npm ci
npm run build
node apps/cli/intent.mjs --help
npm test
npm run check
npm run release:check
```

The [source build instructions](docs/install.md#build-from-source) also cover npm
archives, native bundles and the runtime-free payload.

- [library/](library/README.md): Shared Knowledge processing and public API.
- [apps/](apps/README.md): CLI, MCP, Editor and Portal adapters.
- [spec/](spec/README.md): Canonical contracts, schemas and authoring guidance.
- [docs/](docs/README.md): Installation, use, reference and integration guides.
- [examples/](examples/README.md): Runnable consumer and conformance examples.
- [tests/](tests/README.md): Regression, independent-reader and installed checks.
- [distribution/](distribution/README.md): Build, packaging and release procedures.

[Contributing](CONTRIBUTING.md) states the contact and submission policy. [Security](SECURITY.md)
explains trust boundaries; [third-party notices](THIRD_PARTY.md) describe bundled
dependencies. Original material uses [CC0-1.0 or 0BSD](LICENSE).
