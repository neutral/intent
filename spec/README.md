# Intent specification

Start with [Operating Intent](OPERATING.md). [SPEC.md](SPEC.md) defines the product
boundary and indexes the normative owners. [GLOSSARY.md](GLOSSARY.md) defines shared
terms.

[Authoring guidance](GUIDANCE.md) states the high-level responsibilities of each
record kind. [Families](families/README.md) supply interchangeable detailed
guidance under one folder per kind. Common contracts and downstream tools do
not depend on particular family items. All ship together as the specification.

- **`spec/KNOWLEDGE.md`, `spec/GLOBALS.md`, `spec/RELATIONSHIPS.md`.** Authored meaning,
  global metadata and graph rules.

- **`spec/CHECKS.md`.** Verification definitions and the implementation-area boundary.

- **`spec/PROCESSING.md`, `spec/VALIDATION.md`.** Parsing, ordering, diagnostics and
  validation.

- **`spec/WORKSPACE.md`, `spec/AUTHORING.md`, `spec/DISCIPLINES.md`.** Scope, current-file
  authoring and advisory adoption.

- **`spec/INITIALIZATION.md`.** Initial project scope and Knowledge templates.

- **`spec/API.md`, `spec/TOOLS.md`, `spec/EDITOR.md`, `spec/PORTAL.md`.** Product
  interfaces.

- **`spec/RESULTS.md`.** Public result contracts.

- **[Schemas](schemas/README.md).** Closed structural contracts.

- **[Fixture manifest](examples/manifest.json).** Independently authored conformance
  cases.

Definitions and structural constraints have distinct owners. Fixtures do not create
additional requirements. The public source repository includes these conformance
fixtures and the implementation tests. Installed npm and application archives
include the contracts, schemas and authoring guidance; test programs and fixtures
remain in the source repository.
