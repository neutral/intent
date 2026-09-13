# Explain a design or review practice

Use this optional approach when the Discipline helps a worker shape or assess an
artifact through a particular quality concern. Explain why the concern matters,
how it appears in concrete work, and what would make a proposed improvement
worthwhile. The reader needs a reasoned lens they can adapt to the artifact.

## Develop the guidance

Identify the recurring difficulty and the intended benefit. Describe the kinds
of artifacts and situations where the practice is useful. Explain important
prerequisites and exclusions so a worker can recognize when applying it would
be premature or add cost without addressing the real problem.

Connect the concern to observable properties. For an interface, these might
include what a caller must know, which errors are distinguishable, and whether
ownership is visible. For an explanation, they might include prerequisites,
causal relationships, and the information needed for the reader's next action.
Choose properties that reveal the concern in this context.

Explain useful questions and changes. Show how a worker can find a consequential
gap and propose a correction that addresses its cause. Include the tradeoffs of
the correction: reducing one kind of complexity can move responsibility elsewhere.
Keep the advice open to a well-supported reason for leaving an artifact as it is.

Describe misapplication. A checklist can be satisfied cosmetically, and a familiar
pattern can be introduced where its assumptions do not hold. Explain warning
signs and how to reconsider the change. Suggest how a worker could evaluate the
practice's contribution without treating completion of the review as proof of
the artifact's quality or human usefulness.

## What richer information adds

“Design clear interfaces” can compare caller understanding, information hiding,
failure semantics, and migration costs. One example can show why exposing storage
details creates fragile callers; another can show why hiding a needed transaction
boundary makes correct usage difficult. These contexts explain why the same
instruction cannot determine the shape of every interface.

“Document the code” can become a practice of explaining responsibilities,
consequential mechanisms, and uncertainty. A worked critique might show why a
line-by-line paraphrase adds little, while explaining invalidation ownership lets
a maintainer reason about a change. The practice should also recognize simple
code whose behavior needs little additional explanation.

A worked critique, before-and-after excerpt, or contrasting examples can carry
the reasoning more clearly than a long catalog of desirable traits. Explain why
the revised example helps and what remains unresolved. Do not invent a history
of successful use or rejected alternatives to make the advice seem established.

## Judge the result

A worker should recognize the concern, find a relevant manifestation, reason
about a correction, and identify its costs and limits. Expand where the reader
would otherwise apply a slogan or imitate an example without understanding it.

Use the [common Discipline guidance](../../guidance/discipline.md) and
[Discipline contract](../../spec/DISCIPLINES.md). This optional approach creates
advice, not product obligations, mandatory reviews, or permission for changes.
