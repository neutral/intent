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
| fast-uri | 3.1.9 | BSD-3-Clause |
| json-schema-traverse | 1.0.0 | MIT |
| require-from-string | 2.0.2 | MIT |
| entities | 3.0.1 | BSD-2-Clause |
| mdurl | 1.0.1 | MIT |
| minimist | 1.2.8 | MIT |

The built browser assets bundle these packages from the same lockfile. Vite
compiles them into the Editor's `app.js`, the Portal reader's `reader.js` and the
Portal's export-time prerenderer `render.js`; npm does not install them for the
package. The build writes every bundled package's complete license and notice
files beside its bundle, in `third-party-licenses.txt` or `render-licenses.txt`,
and an exported site carries its reader's notice in `assets/`.

| Package | Version | License | Bundled into |
| --- | --- | --- | --- |
| react | 19.3.1 | MIT | Editor, reader, prerenderer |
| react-dom | 19.3.1 | MIT | Editor, reader, prerenderer |
| scheduler | 0.28.0 | MIT | Editor, reader |
| react-aria-components | 1.22.1 | Apache-2.0 | Editor, reader, prerenderer |
| react-aria | 3.53.1 | Apache-2.0 | Editor, reader, prerenderer |
| react-stately | 3.51.0 | Apache-2.0 | Editor, reader, prerenderer |
| @internationalized/string | 3.2.10 | Apache-2.0 | Editor, reader, prerenderer |
| clsx | 2.1.1 | MIT | Editor, reader, prerenderer |
| use-sync-external-store | 1.7.0 | MIT | Editor |

Build tools are TypeScript 7.0.2 with its platform compiler package (Apache-2.0),
Vite 8.3.8 with Rolldown 1.2.19 (MIT), @vitejs/plugin-react 6.3.0 (MIT), and the
type packages @types/react 19.3.0, @types/react-dom 19.3.0, csstype 3.2.3,
@types/commonmark 0.27.10, @types/node 24.10.0 and undici-types 7.16.0 (MIT).
Browser tests use @playwright/test and playwright 1.65.0 (Apache-2.0) and
@axe-core/playwright 4.14.0 with axe-core (MPL-2.0). The package lock records the
exact dependency closure. Native runtime archives and SHA-256 values are
pinned to the [official Node distribution](https://nodejs.org/dist/v24.18.0/SHASUMS256.txt).

Original Intent material uses the license choice in [LICENSE](LICENSE).
