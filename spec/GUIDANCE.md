# Authoring guidance

Intent records give readers enough meaning to understand the intended software,
make design decisions, explain an implementation or assess a proposition. Keep
each record's common shape and develop the information its subject needs. The
opening summary introduces that meaning; it does not limit the document's depth.

The [Knowledge contract](spec/KNOWLEDGE.md) owns record kinds, essential sections
and authored structure. Common guidance explains the high-level purpose and
essential meaning of each kind:

| Kind | Essential question |
| --- | --- |
| [Behavior](guidance/behavior.md) | What outcome should a participant obtain, under what conditions? |
| [Assurance](guidance/assurance.md) | What property or assessable limit must hold, and where? |
| [Blueprint](guidance/blueprint.md) | What design agreement must an implementation preserve, and why? |
| [Description](guidance/description.md) | How does this inspected implementation unit actually work? |
| [Check](guidance/check.md) | What proposition is examined, with what evidence and assessment criteria? |
| [Discipline](guidance/discipline.md) | What advice helps an author exercise judgment in a relevant situation? |

## Establish and develop meaning

Read the relevant source material and related Knowledge. Identify the subject,
claim or decision, its scope, the distinctions a reader needs, and what would
make it wrong or inapplicable. Give each requirement and explanation an owner;
declare relationships through the [global contract](spec/GLOBALS.md) rather than
repeating the same meaning in several records.

Separate established product decisions, observed implementation facts, proposed
choices and consequential unknowns. Explain the basis of an assertion. Resolve
missing product decisions with their responsible owner while continuing work
that does not depend on the answer. Do not turn an example or plausible default
into an agreed requirement.

Choose enough detail for a future reader to act without reconstructing private
context. Use multiple paragraphs, entries and representations when needed. Keep
coupled reasoning together and separate independently changing subjects. Neither
a word quota nor the size of a generated placeholder determines useful depth.

## Use optional families

[Families](families/README.md) offer detailed questions, methods and examples in
folders for the six kinds. Discover the items available in the distributed
specification, select what helps, and adapt or combine their guidance within
the common record sections. A family may be replaced or removed without
changing a record's format, meaning, identity, validity or tool behavior.

Common guidance and tools do not require a particular family item. Families
introduce no subtype field, required metadata, adoption operation or executable
binding. They can influence an author's proposal; only an explicit authored
change alters recorded meaning. More suitable guidance can be added without
changing the common contract or completing a fixed catalog.

## Review and revise

Read the proposed record as someone who did not attend the discussion. Check
that its essential meaning, boundaries, rationale and uncertainty are usable.
Try a consequential misreading or counterexample and locate the passage that
resolves it. Use the common [Check review](guidance/check-review.md) when
examining criteria. Structural validation and semantic review have different
scopes; neither establishes implementation satisfaction or human usefulness.

Preserve recorded meaning through the [authoring workflow](OPERATING.md#change-meaning-coherently).
Implementation verification and its actual results remain in the implementation
area. These shared specification documents apply through every authoring surface.
