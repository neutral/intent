# Behavior guidance: information retrieval

Use this guidance when the product helps someone find, inspect, list or export
information. Explain what the result means and why it serves the participant's
purpose. A response containing plausible records can still omit the information
the product promised to provide.

## Define the population and result meaning

Identify the participant, their authority and the population the operation
considers. Develop filters, scope boundaries, ordering, relevance or grouping
when they affect the intended use. Clarify whether the result is complete,
ranked, sampled or otherwise limited. An empty result, an unavailable source and
an incomplete examination may require different product responses.

Explain which information the result preserves and what the recipient needs to
understand it. Units, contextual labels or relationships can be essential to a
usable export even when every raw value is present. Distinguish retrieving a
stored fact from presenting an estimate or derived interpretation where that
changes the promise.

Consider when the selected information is observed. Changes during pagination,
search or export can affect completeness and consistency. State the externally
meaningful expectation; leave the storage or snapshot mechanism to Blueprint
unless a specific choice is already part of the governing design.

## Use contrasting cases

Pair a normal query or selection with cases that expose the scope: no matches,
boundary permissions, archived information, tied ordering or a source changing
while the operation proceeds. Choose the cases that make plausible alternative
interpretations visible. A small input/result table can be clearer than a
lengthy description of independent records.

Explain the distinction each example illustrates. If the promise is complete
retrieval, a few correct returned values do not establish that omissions are
acceptable. If it is ranked discovery, define the supported meaning of
relevance sufficiently for a worker to avoid inventing it; an unresolved
ranking policy remains a product or design decision.

## Example and review

“Users can export records” leaves selection, completeness and completion open.
For a hypothetical filtered export, richer meaning could say that it contains
every record in the user's authorized filtered view at the defined selection
point, preserves information needed for the recipient's stated use, and reports
incomplete production as incomplete. An empty selection and a changing source
then expose different decisions. Whether the design uses a snapshot, background
job or stream does not by itself settle those product meanings.

Watch for “all” without a population, “relevant” without a basis, a success
response that conceals partial retrieval, and exclusions copied from an
implementation's limitations. Ask whether a plausible result could look correct
while misleading its recipient about what was considered or omitted. Quality
limits for freshness, response time or confidentiality belong in Assurance when
they need their own assessable obligation.

Apply this optional guidance within the common shape described by
[Behavior authoring](../../guidance/behavior.md) and the
[shared guide](../../GUIDANCE.md).
