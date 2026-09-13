# Use Intent in a repository

Select one repository and the implementation scope its Knowledge describes.
An empty implementation scope is useful while defining a product. Explicit
reconciliation examines the selected implementation files and their Description
coverage.

## Open, initialize and edit

After [installation](install.md), run `intent open /path/to/project`, or
`intent open` from your project. Intent discovers an existing project using its
project marker and reports ambiguous selections explicitly. A directory without
Intent opens guided initialization: enter its name, owners and implementation
roots, preview the proposed files and explicitly apply them. Empty implementation
scope is valid and makes no whole-repository coverage claim. Opening alone
does not create or modify authored files.

Use the browser Editor to inspect Knowledge and prepare changes. Review the
original and proposed files and affected records before applying. Changed
inputs refuse stale writes. Durable drafts survive service restarts in the
displayed user-data location. Stop the local service with Ctrl+C.

Choose **Export site** to preview an explicit current-record selection and
write a static reader to a chosen new directory. Choose **Connect an agent**
to generate configuration for a host running `intent mcp` with one fixed root.
The host receives that scope; Intent does not change the host's settings.

## Read from the command line

```sh
intent inspect /path/to/repository --json
intent query /path/to/repository storage --json
intent read /path/to/repository blueprint.storage --json
intent read-check /path/to/repository check.storage --json
intent reconcile /path/to/repository --json
```

Inspect `complete`, `valid`, stage flags and diagnostics together. A complete
observation can be invalid. A readable Check includes its own Markdown, subjects,
evidence kinds and the current Knowledge that directly declares it as a verifier.
Give that assembled reading to the person or agent assessing the implementation.

## Initialize from the command line

Save a request as `initialization.json`:

```json
{
  "name": "Example service",
  "owners": ["service-team"],
  "implementationRoots": ["src"]
}
```

```sh
intent init-propose /path/to/repository initialization.json --json > initialization-result.json
```

Review the proposed files, diagnostics and scope. Save the nested `fileProposal`
as `reviewed-proposal.json`, then apply it:

```sh
intent apply /path/to/repository reviewed-proposal.json --json
```

Initialization prepares project configuration, catalogs, connections and an
empty Discipline registry. It requires an absent or empty Intent tree. An
existing collection uses explicit editing operations.

## Author

Use `intent open /path/to/repository` to open the local Editor, or edit the
ordinary files with a text editor. `intent guidance` lists the supplied advice;
`intent guidance guidance/check.md` reads a selected guide.

`create-propose` prepares Product drafts. `change-propose` prepares an edit,
status change, move or removal. Every proposal includes exact original and
replacement text. Review the affected Markdown and global metadata together.
Replace template placeholders with supported definitions before making a record
current. A current Behavior or Assurance requires a current Check through a
required `verified-by` connection.

Preserve `--resolve-sources` and `--reconcile` choices between preparation and
application. If inputs change, inspect them and prepare again. After an
interruption, use `operation` to inspect actual files and `resume-propose` to
prepare the remaining original files. `operation-discard` removes the exactly
inspected journal. `lock-release` requires an inspected abandoned lock and
rechecks the associated process.

## Select advice

A Discipline Pack supplies current publisher advice and its metadata. Validate
the selected Pack, choose practices or Sets, and inspect the proposed local
copies and registry changes. Adoption applies only through an explicit reviewed
proposal. Reinspect publisher updates and local edits when comparing adoption
correspondence. Advice remains optional.

## Export a reading

Save an explicit selection:

```json
{"recordIds":["blueprint.storage","check.storage"]}
```

```sh
intent export /path/to/repository --selection selection.json --dry-run --preview
intent export /path/to/repository --selection selection.json --output /path/to/new-site --preview
```

Review the complete generated output before a separate hosting operation.
Export writes a static reader; it does not upload or deploy. Selection includes
exactly the named current records. Omitted reference
targets appear as omissions. The [security guide](../SECURITY.md) describes
content review and local service access.
