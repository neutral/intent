# Intent Portal

Intent Portal builds a static publication from selected current Knowledge. It
ships as `@neutral/intent/portal` and uses the shared Library to read source.

## Installed usage

Create an explicit selection:

```json
{
  "recordIds": ["behavior.example"]
}
```

```sh
intent export /path/to/repository selection.json new-output-directory --preview
```

The command writes to a new directory outside the installation. The destination
parent must exist; existing destinations are refused. `--preview` opens a local
preview and prints a fallback URL. Stop it with Ctrl-C. The generated directory
remains independently usable with any ordinary static HTTP server. Export does not
upload or deploy it.

For guided selection, run `intent open` and choose **Export site**. Select current
records, inspect the preview and omitted references, then explicitly export the
reviewed selection. The suggested destination is a sibling `PROJECT-site`
directory; choose the destination that suits your project. `intent-portal` remains
a compatibility command.

Selected records include exact Markdown downloads and selected metadata projections;
complete shared files remain outside the output. Relationships do not recursively
select records or files.
The format includes no implementation-code or operational-report attachments.
The [Portal contract](../../spec/spec/PORTAL.md) defines selection, output,
omissions and bounds.

## Develop and verify

`build.ts` implements the public builder; `export.ts` owns the shared destination
writer and local preview; `assets/` contains the static reader. The unified command
owns installed launch behavior. From a source checkout,
`npm run build` produces the builder and `node --test tests/portal.test.mjs`
exercises it. `npm run release:check` also compares the installed CLI and API
outputs and serves the result over local HTTP.

Original source uses the repository's CC0-1.0 OR 0BSD license choice.
