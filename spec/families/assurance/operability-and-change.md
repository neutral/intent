# Assurance guidance: operability and change

Use this guidance when people must diagnose, restore, deploy or modify a system
under a defined quality obligation. A broad adjective such as maintainable needs
a concrete operational or change scenario before it can guide implementation
usefully.

## Choose the scenario that matters

Identify the actor, the initiating condition, the affected scope and the result
that must be achievable. An operator distinguishing a failed dependency from
invalid input, a team restoring service after interruption and a worker adding a
supported representation involve different quality questions. Explain why the
scenario matters when the source establishes that need.

State relevant assumptions about available authority, information, environment
or expertise. An obligation that silently assumes the original author is
available may fail the intended operating conditions. Avoid promising ease of
change without naming the change and the consequences that need to remain
bounded.

## Define an assessable response

Describe the information, action or preserved property needed for success. An
operational response may require recognizing the affected service, determining
whether work took effect or knowing what recovery remains possible. A change
scenario may require preserving compatibility, containing affected boundaries
or restoring the prior state under stated conditions.

Use a quantitative bound only where the promise needs one. A duration, number
of affected components or resource allowance requires a supported interpretation
and assessment context. Do not manufacture a metric because the underlying
quality is difficult to express. A precise scenario and observable response can
establish meaningful scope without an arbitrary score.

Consider competing obligations. Diagnostic detail can expose protected data;
a rapid recovery process can lose acknowledged work; an easy local modification
can break a consumer's contract. Keep independently changing obligations
distinguishable and explain any supported exception. A Blueprint can choose
instrumentation, dependency boundaries or migration mechanisms that serve them.

## Example and review

“The system is observable” could be satisfied by emitting many events that do
not help anyone understand a failure. A developed Assurance might require an
authorized operator, under specified information-access conditions, to
distinguish a completed operation with a lost response from an operation that
never took effect. It needs the observable distinctions and applicable limits;
the specific log or trace arrangement belongs in the design.

“The parser is easy to extend” leaves the intended change open. A useful
Assurance could instead define a supported representation change and what must
remain stable for existing consumers. The owner must decide which constraints
on that change matter. A successful demonstration for one extension does not
establish every future modification's cost or safety.

Watch for tool names substituted for usable operational outcomes, a dashboard
claimed as proof of diagnosability, and maintainability claims without change
scenarios. Ask whether a worker can recognize success and a concrete violation
without inventing the operator's resources or the modification's scope. The
Check owns the examination, including the limits of simulated or selected cases.

Apply this optional guidance within the common shape described by
[Assurance authoring](../../guidance/assurance.md) and the
[shared guide](../../GUIDANCE.md).
