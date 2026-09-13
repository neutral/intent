# Events and message protocols

Choose this family when participants communicate asynchronously and cannot rely on one
call returning one result. Define what each message means, its identity, producer and
consumers, and whether it announces a completed fact or requests work. Explain delivery
assumptions, ordering scope, duplication, correlation and evolution when relevant.

## Develop the design

Pair the message shape with traces of important deliveries. A sequence can show a lost
acknowledgment; a small table can show duplicate, delayed and out-of-order messages and
the intended receiver action. Identify acknowledgment and durable-effect boundaries,
deduplication ownership and retention, retry policy ownership, and handling of messages
that cannot be processed.

Avoid an unqualified "exactly once." State the effect whose duplication is prevented,
the identity used, the participating boundary and the assumptions under which that
protection holds. Consider a crash after an effect but before acknowledgment: specify
what the receiver does with the resulting redelivery.

An `ExportReady` event might identify one completed export and its representation
version. Its contract must distinguish a duplicate announcement from a second export.
The product's completion promise stays in its owning Behavior; this Blueprint settles
how the asynchronous arrangement preserves it. A broker name and a payload example
leave most of that protocol undecided.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
