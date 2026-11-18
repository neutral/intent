# MCP server

`intent mcp [DIR]` runs a Model Context Protocol server over standard input
and output. It offers sixteen tools, one for each command but `mcp` and `portal`, and each
returns exactly what its command prints. This page binds nothing: the server
is stated in
[presentation.md, The MCP server](../../spec/presentation.md#mcp). How to
add it to a host is in
[Install Intent](../how-to/install.md#connect-an-mcp-host).

## Each call is one command

- **A tool is a command of the same name.** Its parameters are the command's
  arguments and options, and its result's text is exactly what the command
  prints, closing limits included.
- **The server keeps nothing between calls.** Each call finds the project
  again by walking up from the server's folder (`DIR`, or the working
  directory), reads the files through the index, and runs the operation once.
  An edit to `intent/` shows in the next call.
- **Relative paths resolve against the server's folder**, as a command's
  resolve against the working directory.
- **`more` continues an answer** as `--more` does.

What each operation does is in [Commands](commands.md) and
[project.md](../../spec/project.md#operations).

## Tool results

A result is:

```json
{"content": [{"type": "text", "text": "<what the command prints>"}], "isError": false}
```

- `isError` is `true` exactly when the command would exit 2: a refusal.
- An answer with findings, which the command ends with exit 1 (`validate`
  errors, a refused `report`, a move `follow` could not resolve), has
  `isError` `false`. Its text says what was found.
- A call whose arguments do not fit the tool's input schema is a result, not
  a protocol error: `isError` is `true` and its text is an `ARGS` refusal,
  as the command would print it.

## The tools

`tools/list` returns them in this order:

| Tool | Parameters | Required | The command |
| --- | --- | --- | --- |
| `fetch` | `args` (array), `base` (string), `more` (string) | none | `intent fetch [ARG]... [--base REV] [--more TOKEN]` |
| `search` | `words` (array, at least one), `more` (string) | `words` | `intent search WORDS... [--more TOKEN]` |
| `read` | `ids` (array, at least one) | `ids` | `intent read ID...` |
| `checks` | `paths` (array), `base` (string), `judge` (string) | none | `intent checks [PATH]... [--base REV] [--judge CHECK-ID]` |
| `report` | `form` (string) | none | `intent report [FORM]` |
| `start` | `codeRoot` (array) | none | `intent start [--code-root DIR]...` |
| `create` | `layer` (one of `behavior`, `assurance`, `blueprint`, `description`), `title` (string), `path` (string) | `layer` | `intent create LAYER TITLE...` or `intent create description PATH` |
| `validate` | none | none | `intent validate` |
| `review` | `base` (string) | none | `intent review [--base REV]` |
| `gaps` | none | none | `intent gaps` |
| `drift` | `ids` (array) | none | `intent drift [ID]...` |
| `stamp` | `ids` (array, at least one) | `ids` | `intent stamp ID...` |
| `follow` | none | none | `intent follow` |
| `reports` | `check`, `record`, `path`, `since` (strings) | none | `intent reports [--check ID] [--record ID] [--path PATH] [--since DATE]` |
| `adopt` | `dir` (string), `applies` (array) | `dir` | `intent adopt DIR [--applies GLOB]...` |
| `guide` | `topic` (`using`, a page of the base, `base`, `spec`, or `spec/<contract>`) | none | `intent guide [TOPIC]` |

`intent mcp` itself is no tool.

**How parameters map to the command line.**

- `args`, `words`, `ids` and `paths` are the positional arguments.
- `form`, `dir`, `topic`, `title` and `path` are the positional argument of
  their command.
- `codeRoot` is `--code-root`. Every other parameter is the option of its
  name: `base` is `--base`, `applies` is `--applies`.
- Each element of an array is one argument, as the command line would receive
  it. One element holding spaces is one argument, so a title goes in one
  string: `{"layer": "behavior", "title": "A snoozed reminder fires again at the time the user chose"}`.
- `create` with `layer` `description` takes `path` and no `title`; every
  other layer takes `title` and no `path`. Any other mix is the `ARGS`
  refusal.

**Input schemas** are built one way, so two servers give the same schemas:
`{"type": "object", "properties": {...}, "additionalProperties": false}`,
with `"required"` only when a parameter is required. A string is
`{"type": "string"}`, a list of words adds `"enum"`, and an array is
`{"type": "array", "items": {"type": "string"}}`, with `"minItems": 1` when
at least one is needed. No property has a description; no tool has a
`title` or an `outputSchema`. The `checks` tool, as `tools/list` gives it:

```json
{
  "name": "checks",
  "description": "The Checks bearing on your change, how each is applied, and a report form to fill; with `judge`, one Check's material for a judge other than you.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "paths": {"type": "array", "items": {"type": "string"}},
      "base": {"type": "string"},
      "judge": {"type": "string"}
    },
    "additionalProperties": false
  }
}
```

A call and its result, abridged:

```json
{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "fetch", "arguments": {"args": ["snooze", "src/reminders/snooze.js"]}}}
```

```json
{"jsonrpc": "2.0", "id": 3, "result": {"content": [{"type": "text", "text": "8 records, 6 Checks bear on what you gave.\nTook src/reminders/snooze.js as a path; \"snooze\" as words.\n[...]"}], "isError": false}}
```

## Transport

- Messages are JSON-RPC 2.0, one JSON object per line, UTF-8, with no LF
  inside a message.
- The server writes nothing but messages to standard output.
- It answers every request that has an `id`, and no notification.
- It handles requests one at a time, in the order they arrive, and runs until
  its input ends.
- It sends no notification and makes no request of the client.

## Protocol revisions

The server supports `2026-07-28`, `2025-11-25`, `2025-06-18`, `2025-03-26`
and `2024-11-05`, and serves both ways a client may open.

### With a handshake: 2025-11-25 and earlier

The client sends `initialize`. The result holds:

- `protocolVersion`: the version the client asked for when it is one of the
  four, and `2025-11-25` otherwise;
- `capabilities`: `{"tools": {}}`;
- `serverInfo`: `{"name": "intent", "version": <the package version>}`;
- `instructions`: the text `intent` alone prints, in the server's folder.

`notifications/initialized` is accepted and needs no answer.

```json
{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "probe", "version": "1"}}}
```

### Per request: 2026-07-28

A request whose `params._meta` holds `io.modelcontextprotocol/protocolVersion`
is served on its own, by that version, with no handshake.

- It must also hold `io.modelcontextprotocol/clientCapabilities`, or it is
  the error `-32602`.
- A version the server does not support is the error `-32022`, with `data`
  holding `supported` (the five revisions, newest first) and `requested`.
- Every result holds `resultType` `"complete"`, and `_meta` holding
  `io.modelcontextprotocol/serverInfo`, `{"name": "intent", "version": <the
  package version>}`.
- `server/discover` returns `supportedVersions` (the five revisions, newest
  first), `capabilities` `{"tools": {}}` and `instructions`.
- The results of `server/discover` and `tools/list` also hold `ttlMs`
  `3600000` and `cacheScope` `"public"`, since neither changes while the
  server runs.

```json
{"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "gaps", "arguments": {}, "_meta": {"io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {}}}}
```

### Both ways

- `ping` returns an empty result.
- `tools/list` returns every tool, in the order above, with no `nextCursor`.
- `tools/call` runs one tool.

| Error | When |
| --- | --- |
| `-32700` | a message that is not JSON |
| `-32600` | a message that is not a request |
| `-32601` | an unknown method |
| `-32602` | an unknown tool; a per-request call without client capabilities |
| `-32022` | a per-request call for a version the server does not support |

Contract: [presentation.md, Transport and protocol](../../spec/presentation.md#protocol),
[The tools](../../spec/presentation.md#tools).
