# Validation and fixture scope

Validation identifies its profile, exact subject/source basis, applied limits, ordered
diagnostics, completeness, and validity. `complete: false` implies `valid: false`;
unavailable required work is not a failed or passing unperformed check. A complete
invalid result identifies an observed violation. Independent safe checks and raw source
inspection remain available after a defect.

## Profiles

- `schema` fixture profile

  Establishes: One parsed JSON value conforms to its selected structural schema.

  Does not establish: Strict source parsing, body, whole-set semantics, fingerprints,
  adoption, or execution.

- `inspectRecord` with explicit global context

  Establishes: Strict text/header, current local schema, explicit supplied context,
  assembled metadata, locator, CommonMark sections and connection associations, ID/kind
  agreement, set normalization and generated fingerprints. Missing context is incomplete; unsupported formats are refused.

  Does not establish: Resolved graph, implementation coverage,
  implementation verification, or genuine adoption.

- `workspace-v1`

  Establishes: Declared discovery and semantic stages over the exact examined repository
  scope.

  Does not establish: Any stage explicitly unavailable; implementation truth, human
  adoption, or a performed Check.

- **Generated-carrier structural profiles**

  Establishes: Schema-valid Pack manifest and current adoption declaration shapes.

  Does not establish: Actual supplied bytes, self-digest reproduction, complete Pack
  inventory or publisher authenticity.

- **Named public result schemas**

  Establishes: Closed reader, query/selection/comparison, coverage, authoring operation,
  and Portal carriers; explicit byte transport where needed.

  Does not establish: The truth of the observation, authorization to apply effects,
  executed examination, or independent conformance.

Workspace stages are configuration, discovery, globals, record assembly, identity and
currentness, relationships/conflicts, scope/coverage, requested source resolution, and
current adoption correspondence. The result names which stages its implemented
profile includes. It cannot label a subset a complete full workspace validator.
Structural fixture agreement is not an independent validator conformance claim.

Identity validation counts readable current-format headers independently of body
validity. A duplicate ID excludes all siblings from `workspace.records` and therefore
from effective graph selection, coverage, Registry correspondence and Portal content.
`workspace.inspections` retains raw source and any parsed sibling for explicit path
review. A path-specific Check reading preserves ambiguity diagnostics and remains
incomplete; selecting a path cannot make the ID unambiguous.

## Stable diagnostic families

An initial reader uses the `intent.` namespace. Codes and located facts are
machine-readable; prose messages are explanatory. More specific codes can be added
without collapsing distinct incomplete and invalid states.

[Public results](RESULTS.md) names the exact schema entry point for each implemented
carrier, distinguishes native byte buffers from their portable JSON projection, and
preserves invalid raw source and unresolved request tokens.

Required distinguishable facts by family:

- `intent.text.*`, `intent.json.*`, `intent.schema.*`, `intent.record.*`:
  Encoding/framing, strict JSON, unsupported schema or structural errors,
  missing/ambiguous H1 or opening paragraph, missing/duplicate sections,
  invalid/duplicate/empty entries, wrong kind/location, and orphan connection prose.

- `intent.globals.*`: Missing or duplicate registrations, unknown owners/sources,
  duplicate connection IDs, wrong-kind selectors and invalid assembled metadata.
  Global-file diagnostics name the file path and JSON pointer when available.

- `intent.knowledge.*`: Undeclared project owners.

- `intent.check.*`: Invalid readable-Check identity/path/byte limit, missing,
  ambiguous or wrong-kind occurrence, oversized complete reading, exhausted
  reading work budget, or incomplete definition/support inputs. These describe
  reading, not assessment outcomes.

- `intent.identity.*`: Duplicate stable IDs, including documents with different
  lifecycle statuses.

- `intent.relationship.*`, `intent.conflict.*`: Wrong kinds, duplicate/self-edge,
  cycle/component, missing or non-current required target, exact reciprocal/structured
  conflict.

- `intent.coverage.*`: Missing/ambiguous owner, redundant selector, missing path,
  misplaced file, empty unit, stale exemption, affected review.

- `intent.source.*`: Unrequested, unsupported, denied, missing, unreadable,
  identity/role mismatch, optional versus required.

- `intent.discipline.*`: Pack/choice/adoption correspondence, invalid current
  supplied bytes and advisory-only violations.

- `intent.limit.*`: Exact processing bounds preventing completion.

Diagnostic entries must include a stable code, severity, stage, path/position when
available, and relevant exact identities/facts. Sort by literal path, position, code,
and canonical facts; model output, traversal order, or database row order never
determines standard order. Authoring effect codes are added with their actual
implemented owners, not invented as reader evidence.

## Schema bundle and fixtures

[The schema inventory](../schemas/manifest.json) lists the exact local schema files/IDs
and their direct dependencies. Register the whole selected closed set under Draft
2020-12 with URI/date-time format assertion. A missing reference or unsupported
vocabulary is incomplete, never a pass. Authored local record, catalog, connections,
project, Pack and Registry schemas have no dependency on generated integrity types.
Their generated companions may depend on both primitive bundles.

[The fixture manifest](../examples/manifest.json) names each fixture's exact schema and
expected structural validity. Fixture files are deliberately small parsed JSON subjects.
Generated fixtures may use synthetic fingerprints solely to exercise syntax; they are
not actual Pack/adoption correspondence. Negative cases target actual contract
distinctions rather than arbitrary JSON.

CommonMark/framing, source-byte hashing, normalization permutations, graph,
current record/context operations, global-only impact, coverage, Pack supplied-tree validation,
adoption operations and installed consumer qualification require their own fixtures and
tests. The schema fixture corpus must not be advertised as proving those stages. Run the
repository's installed schema engine over every manifest entry and run the local closure
checker. A nonzero mismatch count blocks a passing schema fixture claim.
