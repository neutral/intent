# Blueprint: explain the design agreement

A Blueprint explains a structural decision that an implementation is expected
to preserve. State the decision and why it matters to the supported product
meaning. Leave room for implementation choices where they do not affect that
decision.

## Essential meaning

Identify the decision's scope, the structural constraints it establishes, and
the tradeoffs that make the choice understandable. Explain who relies on the
agreement and enough of the affected structure to assess whether an
implementation follows it. Separate established reasons from assumptions and
unresolved choices; do not invent rejected alternatives or past deliberations.

A local choice can narrow implementations only within its supported scope. If
it depends on a larger unresolved decision, expose that dependency. Link the
Behavior or Assurance the design intends to realize. A Description explains an
inspected implementation, and a Check defines an examination; neither replaces
the Blueprint's structural meaning.

## Use the common shape

The [Knowledge contract](../spec/KNOWLEDGE.md#six-kinds) owns the common sections:

- **Decision** states the chosen arrangement or contract and what it settles.
- **Scope** identifies the parts, consumers and situations it governs.
- **Components** develops responsibilities; **Constraints** states what an
  implementation must preserve.
- **Interfaces** explains agreements across boundaries; **Data Flows** explains
  consequential movement, transformation and state.
- **Tradeoffs** explains benefits, costs and assumptions; **Evolution** develops
  transition or reconsideration conditions when needed.

Decision, Scope, Constraints and Tradeoffs carry the essential design agreement.
Develop them with prose, examples, tables, diagrams and meaningful subheadings.
Add Components, Interfaces, Data Flows, Evolution or other narrative sections
when they clarify the decision; omit categories that add nothing. Use an explicit
entry ID only where a stable passage reference is useful or a conflict declaration
requires it. Extra views can develop the design without creating parser fields.

## Choose the depth the decision needs

Optional authoring material can help explore a subject, but it does not define
a required inventory or another layer of metadata. Select, combine or set aside
approaches according to the actual question. Their presence or absence changes
no record kind, schema, tool behavior or obligation.

Keep complementary views of one coherent decision together and explain their
relationship. Split when decisions have independent scope, consumers or reasons
to change; length alone is not a reason. Review whether two workers could follow
the record yet make incompatible choices about a boundary it was meant to settle.
Preserve original meaning through the [authoring contract](../spec/AUTHORING.md).
