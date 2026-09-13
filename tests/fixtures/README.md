# Intent consumer fixtures

[Bounded integer parser](bounded-integer/README.md) is an ordinary repository with
six Product definitions, two Description units, and selected Knowledge Portal
inputs. Its parser and tests live in the implementation area. Intent stops at
Check definition; an implementing agent independently runs tests and owns reports.

Copy the example from the Intent source repository to a disposable directory and
follow its commands against an explicitly selected Intent installation. It runs
independently. Optional Discipline Packs require explicit selection from external
packages; this fixture bundles none.

The public source repository includes the consumer fixtures and their CC0-1.0 OR
0BSD notices. Installed npm and application archives exclude these fixtures and
test programs. Conformance fixtures under `spec/examples/` likewise ship
with public source and stay outside installed archives. Neither collection
establishes human usefulness or satisfaction of a user's Check definitions.

With `@neutral/intent` installed in a clean consumer, run
`node tests/qualification/verify-installed.mjs CONSUMER` from the Intent source
root to inspect a disposable copy and verify selected Knowledge publication.
The harness also performs ordinary implementation tests directly and writes
reports outside `intent/`. This implementation qualification is not an Intent
execution capability.

The bounded-integer Knowledge uses the current Markdown authoring contract.
Canonical sections own substantive meaning. Local JSON contains only identity
and state. `catalog.json` assigns metadata; `connections.json` owns typed
references and explicit selectors. `project.json` declares implementation scope.
Additional narrative gives context without creating inferred relationships or
obligations.
