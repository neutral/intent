# Bounded integer parser

This repository separates six Product Knowledge definitions under `intent/`
from an ordinary implementation under `src/` and `checks/`. The parser accepts
canonical ASCII decimal strings from `"0"` through `"999"`. It rejects coercion,
signs, leading zeroes, whitespace, decimal points and exponents.

Intent stops at definition. An implementing agent reads the Knowledge, changes
the implementation, independently performs verification, and owns its report.
Intent does not run tests or consume their results.

The current Knowledge headers contain identity and lifecycle status. Shared
metadata lives in `intent/catalog.json`; relationships and selectors live in
`intent/connections.json`. `intent/project.json` declares project owners and
implementation scope. Markdown remains the sole source of substantive meaning.

## Read and maintain Knowledge

Copy this example from the Intent source repository to a disposable directory.
The example ships with public source, outside the installed npm and application
archives. Use Node.js 24 or later and install `@neutral/intent` in the copy:

```sh
npm install @neutral/intent
npx --no-install intent inspect . --json
npx --no-install intent validate .
npx --no-install intent query . integer --json
npx --no-install intent open .
```

No executable configuration is needed. Current definitions are useful before
implementation verification. Change related Markdown and shared metadata together.

Implementation scope is `src/` and `checks/`, with one primary Description for
each unit. Follow Behavior → Check and Blueprint → Description to understand
the obligations, explanation, and finite verification criteria.

## Implementation work

After reading the Check, an implementing agent may independently run the
ordinary test and write its report outside `intent/`:

```sh
node checks/boundaries.mjs > implementation-report.json
```

This script exercises eight accepted tokens, fourteen rejected strings and five
non-string inputs against the checkout. A successful run reports 27 passing
cases. It provides finite regression observations, not an exhaustive proof.
The report is ordinary implementation output with no Intent result protocol.

In a disposable copy, changing `value > 999` to `value >= 999` should expose the
upper-bound regression with a failed `"999"` case. Restore the original code
after this probe. The implementing agent decides how to perform and report
verification; Intent does not orchestrate any of these steps.

## Publish Knowledge

Optional Discipline Packs may be supplied from an independently selected external
package. This repository bundles no guidance catalog.

`selection.json` publishes the six Product definitions. Only current Knowledge can be selected:

```sh
npx --no-install intent export . --selection selection.json --output portal-output
```

Serve the output through an ordinary static HTTP server. Building it does not
upload or host it. The Intent source repository's `distribution/README.md`
describes archive qualification.
The three included license notices remain with redistributed copies
(CC0-1.0 OR 0BSD).
