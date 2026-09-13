# Interfaces and API contracts

Choose this family when independently implemented callers and providers must agree.
Explain operations, input and output meaning, preconditions, postconditions, errors and
side effects. Clarify ambiguous values: absent versus empty, unknown versus not found,
accepted versus completed. Address pagination, identity, units, encoding or versioning
when they can change a caller's behavior.

## Develop the design

Use the project's actual schema or interface definition language for machine-readable
shape when useful, with prose for semantics it cannot express. A request/response pair
can settle normal use; an error table can settle retryability and whether an operation
may already have taken effect. Define caller and provider responsibilities explicitly.
Specify compatibility in terms of supported consumers and changes, rather than the
unqualified word "compatible."

For a create operation, a timeout may mean either no resource exists or the response
was lost after creation. Explain how the caller distinguishes or safely handles those
states. A schema showing only the success object cannot resolve that uncertainty.

Reference an existing authoritative schema instead of maintaining a second copy. Label
examples as illustrative or contract-defining according to their intended role. Intent
can describe these contracts; it does not compile, execute or enforce a named schema
tool on behalf of the implementation.

A Markdown link alone does not declare an Intent source dependency. Use the existing
catalog source declaration and connection source use when that dependency must
participate in source resolution; the [global contract](../../spec/GLOBALS.md)
owns those fields.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
