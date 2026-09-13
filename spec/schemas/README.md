# Intent schemas

[manifest.json](manifest.json) lists the closed JSON Schema Draft 2020-12 bundle and its
references. Schemas constrain authored Knowledge and generated public results. The
current authored record schema contains four local identity/state fields. Catalog and
connection schemas own metadata and literal selectors; the assembled-header schema
constrains their effective reading model. Required Markdown sections and entry identity
belong to record processing. The reader result schema contains the derived `spec` shapes. Normative prose remains in the
[specification](../SPEC.md).

The manifest names the sole supported Knowledge, Pack, global and result schemas.
Their identifiers are separate; each requires its exact current shape. Unsupported
fields and formats are refused without conversion. Processing resolves
the bundle locally without fetching schemas from the network. `fixture-manifest.schema.json`
describes the source repository's conformance manifest; the actual fixtures are
excluded from installed npm and application archives.

From a source checkout, `node spec/tools/check-schemas.mjs` checks schema
closure and each fixture's independently declared outcome. `npm test` runs this check
after the clean TypeScript build.
