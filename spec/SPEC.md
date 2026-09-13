# Intent specification

Intent connects software to its definition and definitions of its verification
requirements. Its Library, Tools, Editor, and static Portal work in ordinary
repositories. The [Intent overview](../README.md) describes the
product purpose. This specification defines authored format 2 and owns reading,
current-file authoring, advisory adoption and selected publication contracts.
API and interaction guides describe the callable surfaces.

## Normative owners

- **Terms and ordinary use.** [Glossary](GLOSSARY.md), [operating guide](OPERATING.md).

- **Authored Knowledge and lifecycle meaning.** [Knowledge](spec/KNOWLEDGE.md).

- **Catalogs, selectors and explicit connection ownership.** [Globals](spec/GLOBALS.md).

- **Typed graph and conflicts.** [Relationships](spec/RELATIONSHIPS.md).

- **JSON, Markdown, fingerprints, ordering, and source reading.**
  [Processing](spec/PROCESSING.md).

- **Project configuration, Description shadow and current files.**
  [Workspace](spec/WORKSPACE.md).

- **Advisory guidance, Pack, Registry, and adoption provenance.**
  [Disciplines](spec/DISCIPLINES.md).

- **Check propositions and verification criteria.** [Checks](spec/CHECKS.md).

- **Public reading, authoring effect, and publication result carriers.**
  [Results](spec/RESULTS.md).

- **Selected static publication and portable reading.** [Portal](spec/PORTAL.md).

- **Exact record-change proposals and recoverable application.**
  [Authoring](spec/AUTHORING.md).

- **Public Library APIs and effect boundaries.** [API](spec/API.md).

- **Command and maintained agent surfaces.** [Tools](spec/TOOLS.md).

- **Local interactive controls and limits.** [Editor](spec/EDITOR.md).

- **Supported format boundary.** [Supported format](SPEC.md#version-and-closure).

- **Profiles, diagnostics, and fixture limits.** [Validation](spec/VALIDATION.md).

- **Conformance and verification limits.** [Conformance](spec/CONFORMANCE.md).

- **Structural wire shapes.** [Distributed schemas](schemas/manifest.json).

- **Actual fixture assertions.** [Fixture manifest](examples/manifest.json).

MUST, MUST NOT, SHOULD, and MAY express required, prohibited, recommended, and optional
contract behavior. Prose owns semantic requirements; JSON Schema owns structural
constraints. Neither can silently override the other. A mismatch is a publication
defect. An example creates no rule absent from these owners.

## Product boundaries

The specification includes [common authoring guidance](GUIDANCE.md) and optional
[families](families/README.md). Family items are descriptive authoring aids, not
record kinds or validation profiles. Replacing the supplied family collection
MUST NOT change record interpretation, validity, identity, lifecycle status or required
relationships. Tools MUST NOT require named family items to process Knowledge.
Changed guidance can inform a new authoring proposal; it cannot revise existing
meaning without the normal explicit authoring operation.

Intent owns Knowledge and stops at Check definitions. The implementation area owns
implementing, performing verification, and reporting satisfaction. Intent has no
executable bindings, runners, operational result/evidence protocols, or code/evidence
publication attachments. A definition can be valid before its implementation or verifier
exists.

Authored files own current meaning.
Ordinary reading assembles current Knowledge without scanning implementation roots.
Explicit reconciliation pairs it with governed code.

Reading does not execute project commands, fetch remote sources without caller
authorization, adopt a Pack, promote a draft, or grant merge permission. Structural
validity is not evidence that implementation matches prose. Discipline is advisory even
when current and adopted.

The six kinds, stable identity and lifecycle semantics, Description coverage, Check definitions,
Editor, Portal, ordinary-repository use and usefulness evidence remain full-product
scope. An implementation MUST name its implemented profiles and unavailable operations.
The API, Tools and Editor guides describe the current implementation; merely publishing
a result schema does not implement an operation or qualify a user journey.

## Version and closure

The current authored discriminator is `intent.knowledge-record.v2`, interpreted under
`intent.processing.v2`. Local headers, catalog registrations and connection entries have
separate schema owners. The distributed manifest lists their exact Draft 2020-12
identities. All references resolve within that bundle except the standard dialect declaration; processing does not retrieve schemas
from the network.

Authored format, generated result formats, Library API and package release have
separate version coordinates. A future incompatible change needs an
explicit coordinated contract. Only the current format is accepted; unsupported
source cannot become valid merely by changing its label.
Unknown fields, unsupported discriminators and incompatible carriers MUST be
rejected. Readers MUST NOT infer a format from familiar fields, supply missing
required fields or convert unsupported formats. Contract changes require coordinated
implementation, schema, fixture and documentation changes.
