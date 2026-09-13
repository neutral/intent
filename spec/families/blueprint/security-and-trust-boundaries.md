# Security and trust boundaries

Choose this family when design choices determine who can act, which information can
cross a boundary, or how a compromised participant is contained. Identify assets,
principals, entry points and the authority exercised at each boundary. Explain where
identity is established, permissions are checked and delegated authority ends.

## Develop the design

Use a data-flow diagram to expose boundary crossings and a permission matrix to make
allowed actions precise. Select abuse cases, attack trees or structured threat prompts
where they help challenge assumptions. [OWASP's threat-modeling guidance](https://owasp.org/www-community/Threat_Modeling)
connects a system model, threats, mitigation choices and review; it permits different
methods for the subject at hand. The detailed choices below remain design questions
for the worker and the product's own obligations.

Consider alternate entry points, background work, caches, logs, exports, deletion,
credential changes and recovery where they can bypass a protection. Explain the
enforcement point and the assumptions it relies on. For tenant isolation, a tenant ID
field is insufficient if callers may select an arbitrary ID or a worker loses the
original authorization context.

The Assurance owns the protection being promised and its threat scope. This Blueprint
owns the chosen enforcement structure, relevant tradeoffs and remaining assumptions.
Checks can examine bypasses and boundaries. A named security mechanism does not by
itself establish the protection.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
