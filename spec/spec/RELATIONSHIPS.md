# Knowledge relationships

An edge belongs to its source record's stable ID in `connections.json` and
names `id`, `record`, `type`, target stable identity, and explicit `required`.
JSON MUST NOT contain textual `scope` or `rationale`. Build inverse indexes from
these exact authored edges. No index invents relationships from proximity,
tags, text similarity, or search ranking.

Optional explanations belong in identified `Connection` sections in the owning
Markdown document. [Globals](GLOBALS.md#explanations) defines that grammar and
the derived `relationshipDetails` view. Explanations do not create edges or
change requiredness. Graph and selection results may expose those derived
values without creating another authored copy.

- **`refines`.** Allowed source → target: Behavior/Assurance/Blueprint/Check → same
  kind.
  More specific compatible meaning; acyclic among current records.

- **`constrains`.** Allowed source → target: Assurance →
  Behavior/Assurance/Blueprint/Description.
  Include applicable incoming required constraints when selecting the target.

- **`realizes`.** Allowed source → target: Blueprint → Behavior/Assurance/Blueprint;
  Description → those or Description.
  Intended realization, not proof of conformance or transfer of authority.

- **`verified-by`.** Allowed source → target: Product Knowledge → Check.
  Required verification definition; Check→Check edges are acyclic.

- **`depends-on`.** Allowed source → target: Blueprint/Description →
  Blueprint/Description.
  Technical dependency; cycles are allowed and reported as strongly connected
  components.

- **`related-to`.** Allowed source → target: Any kind → any kind.
  Optional navigation only; `required` must be false.

Discipline can originate only `related-to`. Self-edges are invalid for every
relationship type. Duplicate
type/target edges are invalid even if their optional explanation differs.
Required edges from current records resolve to exactly one current compatible
target. Missing or non-current optional targets remain visible but cannot supply
required dependencies.

Selection follows required outgoing refinement, verification, and dependency
edges and applicable incoming constraints. Selecting a required dependency
includes its complete strongly connected component. Realizations and optional
navigation have explicit inclusion reasons. Plain-text scope is not an
executable predicate; ambiguous applicability is reported for judgment rather
than silently interpreted by a model. Focused selections distinguish omitted
required meaning from optional context and state their exact roots and limits.

Graph inspection and selection enforce the explicit degree, item-visit and
diagnostic ceilings in [Processing](PROCESSING.md#limits). Incoming and outgoing
indexes preserve authored edges and avoid rescanning the whole graph for each
selected ID. A degree, work or finding limit leaves an explicitly incomplete
graph and selection; partial edges cannot stand in for the governing set.

## Conflicts

The global `conflicts` array assigns declarations to their owning records.
Only Assurance and Blueprint may own conflict connections. Assurance uses `assurance-limit` over identified Limits entries;
Blueprint uses `blueprint-constraint` over identified Constraints entries.
Each declaration names a current same-kind `target`; `localFact` and `targetFact`
are the exact local entry IDs in the corresponding sections. They MUST NOT copy
the entries' prose. The target MUST declare the exact reciprocal mirror.
Missing entries, wrong kinds, missing targets and unilateral declarations are
invalid. The processor resolves entry identity explicitly; it does not search
sentences for a matching assertion. Emit one conflict per
valid reciprocal pair, in stable source-ID/fact order.

Also report exact Behavior inclusion/exclusion conflicts within the selected
scope, duplicate currentness, ambiguous primary coverage, required non-current
targets. A prose-only concern may be an
attributed indeterminate finding with both sources; no extension or model can
invent a standard conflict or silently resolve one. Advisory Discipline does not
participate in Product Knowledge conflict authority.

Changes expose incoming/outgoing impact on records, coverage, Checks, and adoptions. Impact is a Knowledge review aid; it is not an assessment
of implementation verification.
