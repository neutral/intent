# Independent narrow Intent reader

This Python standard-library implementation reads one explicitly selected
Knowledge Markdown file and supplied global catalogs without importing Intent
Library, its parser, its schemas at runtime, or another product’s code. Its independently authored tests
exercise its own implementation. It is a narrow reading/canonicalization
comparison implementation, **not an independent Knowledge validator**.

```sh
python3 tests/independent-reader/reader.py path/to/record.md \
  --catalog path/to/catalog.json --connections path/to/connections.json
python3 -m unittest discover -s tests/independent-reader -p 'test_*.py' -v
```

Use Python 3.10 or later. There are no third-party dependencies. The CLI writes
one JSON object to stdout: exit 0 means the selected read profile completed,
exit 1 means malformed or unreadable input, and exit 2 means an unsupported
numeric domain. Invocation/argument errors also use argparse's exit 2.

## Advertised profile

`intent.independent-reader.strict-integer.v2` implements UTF-8/BOM/NUL rules,
exact opening and closing delimiters, one strict JSON front-matter object,
decoded-key uniqueness, scalar Unicode, safe integers, a nonempty body, bounded
bytes/depth/nodes, and the declared set normalization in
[Intent Processing](../../spec/spec/PROCESSING.md). It preserves body
bytes as decoded text; only fingerprint construction converts body CRLF to LF.
The local header must use the current v2 schema and its four identity/state fields.
The reader selects the exact stable record ID owner from supplied globals,
including used source definitions. It normalizes declared global sets and
preserves extension array order. Description coverage and Check selections
belong to connections. Missing context and unsupported formats are refused. The reader
preserves canonical Markdown sections and entry identifiers as body text; it does not
assemble derived title, summary, sections, relationships or `spec` data.

Canonical serialization follows the RFC 8785 subset containing objects, arrays,
strings, booleans, null and integers from −(2^53−1) to 2^53−1. Property names use
UTF-16 ordering; declared set keys use Unicode scalar ordering. Escaping and
integer serialization follow that subset exactly. Negative integer zero
normalizes to zero. Decimal and exponent tokens, including `1.0` and `1e0`, are
explicitly **unsupported** rather than passed through Python's different float
formatting. `NaN` and infinity constants are invalid JSON, not supported floats.

The whole file and front matter obey the published 4,194,304 and 524,288 byte
limits. The decoder is preceded by lexical depth/node checks at the published
64-depth and 65,536-node limits. Root depth is one and property names do not
count as nodes. The Python API accepts lower positive profile limits for tests.
Only a regular selected file is read; a final-path symlink is refused. This is
not a repository discovery or root-containment implementation. The caller supplies
the exact global files; this reader does not establish a coherent multi-file
source snapshot or retrieve registered sources.

## Meaning of the output

`sourceDigest` fingerprints the exact input. `semanticDigest` is a **conditional
comparison candidate** over canonical `{body, frontMatter, context}` with the
selected global closure. Its accompanying
`semanticDigestStatus: conditional-on-schema-validation` is essential: this
reader does not run the authored schema or CommonMark validation and never
returns `valid: true`. A caller must separately establish that an input meets
the intended schema/profile before treating this as an agreement result for a
valid Knowledge record. Normalization failures never yield a semantic digest.

Use fixed, caller-qualified valid fixtures when comparing this reader with
Intent Library. Agreement proves only the advertised reading and integer-domain
normalization behavior for those inputs. An object accepted here can still be
an invalid Knowledge header. This reader does not verify kind-specific schema
requirements, headings, identity grammar, graphs, adoption, sources,
Description ownership, publication or adoption authority. It reads only the three
explicitly selected files and never executes a project command.

The test fixture builders are independent examples, not imported Library test
outputs. Exact source/semantic expectations, set/sequence distinctions,
Unicode ordering, preserved newlines and rejection boundaries are checked
locally. Cross-reader fixture agreement must be reported separately after the
actual public Library comparison is run; these tests do not claim it.
