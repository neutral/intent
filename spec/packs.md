# Packs

Spells out [SPEC.md](SPEC.md) for Packs: a Pack release, the copy a project holds of it, and
Adopt. Where a Pack applies is recorded in the project file,
[project.md §project-file](project.md#project-file). A project's own rule about a practice is the
`practice` relation, in [relations.md §relations-section](relations.md#relations-section).

Each section says which lines of the model it spells out: `M<n>` is line n of
[SPEC.md](SPEC.md). A section the model does not imply says so.

<a id="release"></a>

## Pack releases

From the model: M251–252.

A Pack release is a folder holding `pack.json` and the Pack's Discipline
records: every regular file directly in the folder whose name ends in `.md` and
does not begin with `.`. Nothing else in the folder is part of the release, and
subfolders are not read.

`pack.json` is a JSON object with exactly `name`, `version` and `title`
(`PACK_MANIFEST` for a missing or unreadable file, invalid JSON, a value that
is not an object, or a missing, unknown or invalid member):

- `name` is a Pack name: `^[a-z0-9]+(-[a-z0-9]+)*$`;
- `version` is a Pack version: `^[0-9A-Za-z][0-9A-Za-z.+-]*$`, compared
  exactly; Intent does not order versions;
- `title` is a string that is not blank once trimmed.

```json
{"name": "js-async", "version": "1.2.0", "title": "Asynchronous JavaScript that fails loudly"}
```

A release is valid when its manifest is valid, it holds at least one record
(`PACK_EMPTY`), and every record is a Discipline whose ID names this Pack
(`DISCIPLINE_ID_PACK`, at line 2, for a record of another layer too, and for
a name that breaks the Discipline name pattern; checked only when the manifest
is valid) and has no error under the rules for record files, Relations lines
and `DISCIPLINE_READ_AGAINST` included. Two records with one ID are
`ID_DUPLICATE`, at line 2 of the later file in name order, and that file is
not read further. `PACK_MANIFEST` is reported once, however many faults the
manifest has. Diagnostics in a release are
reported against paths relative to the release folder. A release is validated on its
own, outside any project: its records' relations are not resolved, and a
record in it is never a code file.

**The fingerprint** of a set of Discipline files is `sha256:` followed by
`sha256` of the text made of one line per file, in the order of the file
names: the file's name, a space and `sha256` of its exact bytes; the lines are
joined with LF, with no LF after the last. `pack.json` is not part of it: the
project file records the Pack's name and version beside the fingerprint.

<a id="adopted-copy"></a>

### The adopted copy

From the model: M252–260.

Adopting a release copies its record files, byte for byte and under the same
names, into `intent/discipline/<name>/`, and nothing else, and records the
adoption in the project file: the release's name and version, the fingerprint
of its records, and the globs where it applies. The copy is never edited.

- The copy's record files are the regular files directly in the folder whose
  names end in `.md` and do not begin with `.`. Their fingerprint, when it
  differs from the adoption's, is `PACK_COPY_CHANGED`, on the folder. Each of
  them is also a record file read under every rule for a record file.
- An adoption with no folder `intent/discipline/<name>/` is
  `PACK_COPY_MISSING`, at the line of the adoption's `name` member.
- A folder in `intent/discipline/`, its name not beginning with `.`, that no
  adoption names is `PACK_NOT_ADOPTED`, on the folder. An adoption names the
  folder when it is an object whose `name` member is a string equal to the
  folder's name, even when it is left out for `PACK_ENTRY`, `PACK_REPEATED` or
  `GLOB_INVALID`: that fault is reported once, on the adoption.

<a id="adopt"></a>

## Adopt

From the model: M191, M252–255.

**Takes** a Pack release folder `DIR` on this machine; `--applies GLOB`, any
number of times. Intent fetches nothing from the network: how a release
reaches the machine is outside Intent.

**Refuses** with `ADOPT_RELEASE` when `DIR` is not a valid release, listing
its diagnostics; with `ADOPT_PROJECT` when reading the project file itself
gives an error, since adopting rewrites the file: `FILE_UTF8`, any
`PROJECT_*`, `CODE_ROOT_INVALID`, `PACK_ENTRY`, `PACK_REPEATED` or
`GLOB_INVALID`, naming each; and with `ARGS` for a `--applies` that is not a
glob. `PACK_COPY_MISSING` and `PACK_COPY_CHANGED` do not stop it, since
adopting again fixes them.

**Writes**:

- the release's record files into `intent/discipline/<name>/`, byte for byte,
  removing the record files there that the release does not hold, and leaving
  any other entry;
- the adoption in `intent/intent.json`: the release's name and version, the
  fingerprint of its records, and as `applies` the globs given, or, when none
  is given, those of the earlier adoption of this Pack, or none.

When the adoption and the copy already match the release and no glob is given,
it writes nothing and says so.

**Returns** `Adopted <name> <version> (<title>) into
intent/discipline/<name>/: <files>.`, then `Recorded in intent/intent.json,
applying to <globs>.`, or `Recorded in intent/intent.json; it applies nowhere
yet: run intent adopt <DIR> --applies GLOB.` On an update from an earlier
version, comparing the copy as it was with the release by ID: `Updated from
<old version>.`; `Disciplines added:`, `Disciplines removed:` and
`Disciplines changed:`, each changed one with what changed (its meaning, and
each Check added, removed or changed, by slug); `The copy differed from its
release; those edits were replaced.` when its fingerprint did not match the
earlier adoption; and `Project records that name a changed or removed
Discipline:` each record with a linked `practice` relation to one, as `<id>
practice <discipline id>`, then `Reread each, then stamp it: intent drift lists
them.`

**On broken intent** only an error from reading the project file can stop it
(`ADOPT_PROJECT`);
records with errors elsewhere do not, and the copy as it was is read under the
record rules for the comparison. It refuses with `NO_PROJECT` too, and reads
no change.
