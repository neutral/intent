# Assurance guidance: trust and information protection

Use this guidance when access, authority or information handling could violate
a protected boundary. Sensitive data and multiple principals are reasons to
investigate the needed protections. They do not by themselves establish every
possible security or privacy obligation.

## Define the protected boundary

Identify the resource or information, the principals that interact with it, the
permitted actions and the circumstances in which authority applies. Distinguish
roles that initiate work from people whose information or interests are
affected. Explain relevant trust assumptions and threat conditions so a reader
can understand the scope of the protection.

Describe a breach in observable terms. A resource identifier may be guessable
without granting access; a correct authorization decision may still disclose
information through an error, log or export. Select the observations that matter
to the actual promise. Avoid an unqualified claim that a mechanism makes the
whole system secure.

## Follow authority and information over time

Consider creation, sharing, export, revocation, deletion and recovery when those
transitions affect the property. A permission checked at the start of a long
operation may change before its result is delivered. Explain the intended
protection at relevant boundaries rather than leaving the worker to decide
whether the initial check remains sufficient.

Follow consequential information flows through derived views, error responses,
logs or retained copies when they are in scope. A principal/action table can
expose authority differences. A lifecycle scenario can expose a stale right or
a surviving copy. Use the representation that makes a likely misunderstanding
visible; do not build a universal threat catalog into every record.

State any allowed disclosure, retention or exception with its conditions. Keep
an unresolved policy explicit. A Blueprint can choose the trust architecture or
technical mechanism, while the Assurance retains the resulting protection that
those choices must preserve.

## Example and review

“Exports require authorization” leaves open which principal is authorized, what
information the decision covers and when authority matters. A developed
Assurance might protect organization data against access by members of other
organizations and define the treatment of access revoked during export
production. A Check would then need observations that distinguish an authorized
request from a guessable identifier, a stale permission or an unauthorized
result delivery within that scope.

Similarly, “sensitive fields are encrypted” describes a mechanism without
settling whether those fields can appear in a diagnostic response. If the
promise concerns disclosure, define the permitted recipients and relevant
surfaces. Reference a governing policy or external contract when applicable
rather than inventing its requirements.

Watch for unnamed principals, protection tied only to unchanged files, exceptions
without scope, and claims that exceed the stated threat assumptions. Ask
whether an implementation could use every named mechanism while still exposing
the protected information or granting a forbidden action.

Apply this optional guidance within the common shape described by
[Assurance authoring](../../guidance/assurance.md) and the
[shared guide](../../GUIDANCE.md).
