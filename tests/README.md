# Intent tests

- `*.test.mjs`: Shared Library and app regression tests. `ui-assets.test.mjs`
  checks where the built browser assets sit, their license notices and each
  script's gzipped size budget.

- `browser/`: Playwright tests that drive the built Editor and an exported Portal
  in headless Chromium: refresh, conflict and recovery paths, keyboard paths,
  reading without scripts, and axe rules at 1440px and 375px. Run
  `npm run test:browser` after `npm run build`. Set `INTENT_CHROMIUM` to a
  Chromium executable to use one other than Playwright's own; results go to
  the ignored `tmp/browser/`.

- [fixtures/](fixtures/README.md): Synthetic consumer examples.

- [independent-reader/](independent-reader/README.md): Separate Python interpretation of
  the supported record subset.

- [qualification/](qualification/README.md): Installed-package tests and
  operated-fixture programs.

`npm test` builds and runs schema fixtures plus the native regression suite.
Tests use disposable repositories. These programs belong to Intent's
implementation area and do not turn user Check definitions into executable
product bindings. Qualification programs write run evidence to their selected
output directories; the native release gate uses a temporary directory.

`markdown-authoring.test.mjs` uses literal authored records to check declared
sections, explicit entry identity, relationship explanations and exact Markdown
preservation. Test helpers construct the sole current four-field local header and
its explicit global context. Unsupported format fixtures exercise refusal; no test
helper or public reader converts earlier representations into current Knowledge.

## Verification owners

- Record and Markdown tests exercise source framing, essential meaning, optional
  prose, explicit anchors and global metadata. Schema fixtures check closed carriers.
- Graph and coverage tests exercise relationships, mirrored Description placement
  and explicit implementation reconciliation. Boundary tests keep Checks at definition.
- Authoring, creation, adoption and recovery tests exercise coordinated proposals,
  stale-source refusal and interrupted writes. Discipline tests check selected Packs.
- App tests exercise CLI, agent, Editor and Portal behavior. The independent reader
  checks a separately implemented format subset. Installed qualification exercises
  the assembled package in an external consumer. Native journeys exercise the
  bundled runtime and unified workflows with Node/npm absent from `PATH`.

Run `npm test` for native regression checks and `npm run release:check` for the
assembled-package gate. These checks establish their exercised behavior, not
human usefulness, implementation satisfaction of user Checks or untested platform
support. Report performed checks and material limits in the task or pull request;
keep generated artifacts in the selected temporary run directory.
