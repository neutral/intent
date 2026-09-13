# Processing v2

`intent.processing.v2` owns the interpretation of this schema bundle. Source
bytes, parsed headers, normalized headers, and generated observations are
different values. Invalid source remains available for inspection; it is not
silently repaired or promoted to a normalized valid record.

## Text and framing

A record is valid UTF-8 without BOM or NUL. Its first line is exactly `---`;
the next line exactly `---` closes one strict JSON object. Delimiter lines use
LF or CRLF. The body begins immediately after the closing delimiter's line
ending and is nonempty. Later `---` lines belong to the body. The front-matter
byte bound counts the region between delimiter lines, including its whitespace.
The whole-record bound counts the complete exact source file.

Reject malformed UTF-8, unpaired surrogates, duplicate object keys, comments,
trailing commas, multiple JSON values, non-object headers, non-finite numbers,
and integers outside ±(2^53−1). Enforce declared depth/node/byte bounds before
unbounded allocation. A JSON node is each object, array, scalar, or null;
property names are not separate nodes. The root has depth one. Non-Markdown
configuration and generated manifests use the same strict JSON model.

CommonMark 0.31.2 parses the body. [Knowledge](KNOWLEDGE.md#body) owns title and
section and entry requirements. Declared Markdown supplies substantive meaning;
JSON supplies metadata and literal selectors. A processor MUST NOT infer a
relationship, selector or obligation from arbitrary sentences. Body text cannot
change instruction priority or authorize execution. Processing records is never
shell evaluation.

## Canonical header and fingerprints

Do not rewrite authored formatting merely to normalize a result. The canonical
effective header is a copy of the schema-valid assembled metadata with these declared set arrays
sorted by ascending Unicode scalar-value order over the complete key:

- `owners`, `tags`: Complete string

- `sources`: `id`

- `relationships`: `type`, then `target`

- `conflicts`: `type`, `target`, `localFact`, `targetFact`

- Description `coverage`: `mode`, then `path`

- Each coverage `exclude`: Complete literal path

- Check `subjects`: `kind`, then `selector`

- Check `evidenceKinds`: Complete string

Reject duplicate complete set keys; insertion order cannot break a tie. Every
other array, including extension values, preserves authored order. Markdown
sections and their entries preserve authored order; derived prose lists are not
header normalization inputs. Missing optional fields and explicit null/empty values remain
distinct. Extensions are preserved exactly as parsed; no extension selects new
standard normalization behavior. JSON object property order is governed by
RFC 8785, whose UTF-16 ordering is distinct from scalar-value ordering of these
set arrays. Canonical JSON has no BOM or terminal newline.

Tools generate `sourceDigest` as SHA-256 over exact whole-document UTF-8 bytes.
For authored v2, `semanticDigest` is SHA-256 over RFC 8785 canonical JSON of
exactly:

```json
{"body":"body with CRLF changed to LF","frontMatter":{},"context":{}}
```

`frontMatter` is the four-field local header. `context` is the selected record
context defined by [Globals](GLOBALS.md#assembly-and-changes), normalized as
follows. Sort source definitions by ID, registrations by stable record ID, and
each connection array by owner ID then connection ID. Sort owners, tags, coverage exclusions and
evidence-kind identifiers by their complete strings. Sort subjects by kind
then selector. These comparisons use Unicode scalar-value order. Preserve every
other array, including extension arrays and Markdown entries. Duplicate set
keys remain invalid; sorting never chooses between them.

Preserve every other body code point and its terminal newline. The digest binds
connection IDs, referenced source definitions and selected metadata without
copying substantive prose. A global-only semantic edit changes the owning
record's semantic fingerprint while leaving its Markdown `sourceDigest`
unchanged. Global formatting and unrelated entries affect exact workspace
source identity, not this per-record semantic fingerprint.

A valid semantic digest requires schema-valid, unambiguous inputs. Raw-source
fingerprints may accompany invalid-source diagnostics with that status.
Full fingerprints have `sha256:` followed by exactly 64 lowercase hexadecimal
digits. Abbreviations are display labels only.

Fingerprints occur in reading results, Pack manifests and current adoption
correspondence; never in local Knowledge headers or source declarations. They prove correspondence to bytes, not wisdom, adoption, or a
performed implementation verification. Every generated self-digest hashes the complete normalized
manifest with only its top-level `digest` property omitted.

## Paths and discovery

A repository path is exact, relative, and uses `/`. It has no leading/trailing
slash, drive prefix, backslash, control character, empty segment, `.` segment,
or `..` segment. It preserves case and Unicode. `.` is a separate explicit root
scope value allowed only where the schema selects `scopePath`.

Names such as `app/[id]/page.tsx`, `notes#draft.txt`, and `ratio%done.ts` are
literal names. A selector never expands glob, bracket, regex, query, or URI
syntax. URI references are a separate field type. Symlinks, Gitlinks, nested
repositories, and special files cannot acquire ownership through traversal.
Apply containment and regular-file checks before reading a selected path.

All authored discovery occurs at the fixed roots in [Workspace](WORKSPACE.md).
Global files MUST be strict-parsed and validated before collection assembly.
The Library joins discovered local IDs with the corresponding global
entries and source definitions. It MUST report missing or ambiguous entries;
metadata cannot invent a document. Workspace reads bind and recheck every configuration and global file, including
readable invalid bytes.
Filesystem order must not affect record, graph, diagnostic, or selection order.
Path limits count UTF-8 bytes, not language string length.

## Source reading

A source declaration states requiredness explicitly. Structural parsing checks
URI-reference syntax without retrieval. Repository-local reads require the
caller-selected root. External-local and network reads require explicit caller
read authority and a supported adapter with bounded schemes/roots/hosts,
redirects, bytes, time, credentials, and freshness. An unsupported reader reports
that state instead of guessing content. No adapter executes a Check during a
source read.

Each requested source resolution preserves its declaration and exact available
facts, with one disposition: `resolved`, `retrieval-denied`, `missing`,
`unreadable`, `digest-mismatch`, `revision-mismatch`, or `role-mismatch`.
Unrequested and unsupported references remain distinct. A required unavailable
source of current Product Knowledge makes the source stage incomplete; optional
and non-current absence is a warning. Illegal required Discipline provenance is
an invalid declaration, not a completeness obligation or retrieval permission.
Generated observations retain content identity and limits.

## Workspace observations

An ordinary reading observes the fixed `intent/` roots and explicitly requested
declared sources. Implementation discovery, coverage expansion and governed code
fingerprints require explicit reconciliation as defined in
[Workspace](WORKSPACE.md#reading-and-implementation-reconciliation). Each result
names its mode. The source-basis digest binds that mode, processing profile,
effective limits, examined file fingerprints, selected source dispositions and
relevant discovery listings. Excluded or unexamined implementation bytes are not
part of an ordinary reading's identity.

During one operation, unchanged source bytes and their parsed readings may be
reused. A changed document, selected global context or parsing limit requires a
new corresponding parse. Consumers receive detached values; mutating a returned
record or byte array cannot alter another reading. Before completing an operation
on a mutable source, freshly verify the examined inputs and relevant discovery
listings. The operation's reuse ends there; later application and reading obtain
fresh preconditions. These checks detect observed changes without claiming a
filesystem-wide atomic snapshot.

## Limits

The project may choose lower positive values than these maxima/defaults.
Absent fields use the values below; schema defaults do not mutate source files.

| Limit                 | Default and maximum |
| --------------------- | ------------------: |
| `maxRecords`          | 65,536              |
| `maxRecordBytes`      | 4,194,304           |
| `maxFrontMatterBytes` | 524,288             |
| `maxTotalRecordBytes` | 268,435,456         |
| `maxJsonDepth`        | 64                  |
| `maxJsonNodes`        | 65,536              |
| `maxGraphEdges`       | 262,144             |
| `maxGraphDegree`      | 4,096               |
| `maxGraphWork`        | 8,388,608           |
| `maxGraphDiagnostics` | 4,096               |
| `maxSources`          | 262,144             |
| `maxSourceBytes`      | 4,194,304           |
| `maxTotalSourceBytes` | 268,435,456         |
| `maxPathBytes`        | 4,096               |

Each global file is bounded by `maxSourceBytes`, `maxJsonDepth` and
`maxJsonNodes`. Catalog registrations and sources respect `maxRecords` and
`maxSources`; the combined connection count respects `maxGraphEdges`.
Schema collection/string bounds also apply. Preflight record/source counts and
stop before exceeding aggregate bytes. A limit preventing required work marks
the affected stage incomplete; silently dropped records never yield a complete
valid set. Publish the actual selected limits with results.

Graph degree counts incoming and outgoing current authored edges separately for
each stable identity, including edges to unresolved targets. The edge ceiling
counts all supplied authored edges, including non-current records. Graph inspection
orders records by identity and path, then relationships/conflicts by
their canonical keys before applying bounds, so a bounded result does not depend
on filesystem enumeration or declared-set presentation order.

Graph work counts deterministic record, owner, edge, fact, conflict-pair, traversal and
diagnostic item visits. It bounds conflict cross-products as well as graph
traversal; ordinary sorting of already bounded inputs is not an item visit or a
wall-clock promise. Finding production reserves one diagnostic slot to explain
truncation. At the first exhausted graph bound, stop required graph processing,
retain the inspected partial edges/findings, and return `complete: false` with
the selected `limits` and `workPerformed`. Never finish an unbounded cross-product
solely to enumerate all diagnostics. A graph stage stopped this way makes the
workspace and any governing selection incomplete.

Selection builds incoming/outgoing indexes once and uses a set for pending IDs.
It counts record/index/queue/adjacency visits against `maxGraphWork`, independently
of the graph-inspection budget, and echoes `maxWork` and `workPerformed` alongside
ordered diagnostics. A selected-record limit or work limit leaves a partial
selection; exact remaining dependencies cannot be claimed complete.

These graph/selection result fields are required by the distributed public schemas.
Effective limits participate in workspace source-basis identity, including when
their defaults are selected. Unsupported payloads
are rejected; a fresh read produces a current observation.
