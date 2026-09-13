# Third-party software

These versions form the source lockfile's runtime dependency set, used by native
and application payload builds. npm installs the declared direct dependencies
and resolves their transitive dependencies for the consuming project. Native
builds also include Node.js 24.18.0. Each package retains its own license and
notices. The native bundle includes the
complete Node license and bundled component notices at `licenses/Node.js-LICENSE`.

| Package | Version | License |
| --- | --- | --- |
| ajv | 8.18.0 | MIT |
| ajv-formats | 3.0.1 | MIT |
| commonmark | 0.31.2 | BSD-2-Clause |
| fast-deep-equal | 3.1.3 | MIT |
| fast-uri | 3.1.7 | BSD-3-Clause |
| json-schema-traverse | 1.0.0 | MIT |
| require-from-string | 2.0.2 | MIT |
| entities | 3.0.1 | BSD-2-Clause |
| mdurl | 1.0.1 | MIT |
| minimist | 1.2.8 | MIT |

Build tools are TypeScript 5.8.3 (Apache-2.0), @types/commonmark 0.27.10 (MIT),
@types/node 24.10.0 (MIT) and undici-types 7.16.0 (MIT). The package lock records
the exact dependency closure. Native runtime archives and SHA-256 values are
pinned to the [official Node distribution](https://nodejs.org/dist/v24.18.0/SHASUMS256.txt).

Original Intent material uses the license choice in [LICENSE](LICENSE).
