# Deployment and runtime environments

Choose this family when placement, configuration or environmental dependencies constrain
the design. Identify runtime units, services and stores, then the environments in
which they run. Explain dependencies, communication paths, state placement, fault
domains and relevant isolation boundaries. Distinguish an application component from
an instance of it deployed in a particular environment.

## Develop the design

A [C4 deployment view](https://c4model.com/diagrams/deployment) can map software instances
to infrastructure. A readiness graph can explain startup prerequisites; a configuration
table can distinguish fixed decisions, required inputs and environment-specific choices.
Develop shutdown, draining, health, restoration and observability where they affect the
design. Name the signal an operator needs and what it means, without turning this record
into a log of actual operations.

For a worker that writes temporary files, show which storage survives restart, which
instance owns cleanup, and whether another instance can resume the work. A deployment
picture containing only service logos does not explain that behavior.

Use this family for a development environment when its design matters to reproducibility
or boundaries. Installation commands and a performed setup report retain their own
owners. The Blueprint explains the required environment and why it is arranged that
way; it does not schedule or perform its creation.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
