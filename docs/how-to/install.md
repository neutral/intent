# Install Intent

Intent is the npm package `@neutral/intent`. It gives you one command,
`intent`, which also runs Intent's MCP server.

## What you need

- **Node.js 22.23.2 or later.** The `engines` field of the root
  [`package.json`](../../package.json) states it: `"node": ">=22.23.2"`.
  Check yours with `node --version`.
- **git**, for the commands that read what changed from git: `fetch` with no
  argument, `checks` with no path, `report` for a form made that way,
  `review` and `follow`. Every other command works without git, and `fetch`
  and `checks` work without it when you give them paths.

Intent fetches nothing from the network and runs nothing of your project's.
Only npm goes to the network, to download the package.

## Install the command

Install it once for your user:

```sh
npm install --global @neutral/intent
```

Or run it without installing, through `npx`. Always give the package's full
name; `npx intent` would look for a different package.

```sh
npx @neutral/intent fetch snooze
```

Every example in these pages writes `intent ...`. With `npx`, write
`npx @neutral/intent ...` instead.

## Check that it works

Run `intent` alone, anywhere. It prints exactly this and exits 0:

```text
Intent holds this project's intent and the Checks derived from it.
While writing code:
  before   intent fetch <words from your task> <paths you expect to touch>
  after    intent checks          apply each Check, then fill the form it names
           intent report <form>
  how      intent guide using
Everything else: intent --help
```

Outside a project it adds one line:
`No intent/ here or above: intent start creates it.`

`intent --help` shows the same lines on writing code and lists every command.
`intent <command> --help` explains one. Neither needs a project. See
[Commands](../reference/commands.md).

## Add Intent to a project

In the project's root folder, run `intent start`. It creates `intent/`, with
the project file `intent/intent.json`, the five layer folders and
`intent/.gitignore`, and lists the code nobody explains yet. Give the folders
that hold code, so the rest of the repository is not taken for code:

```sh
cd todo
intent start --code-root src --code-root tests
```

Commit `intent/`. Its `.gitignore` keeps `intent/.index/` and
`intent/.reports/` out of git: the index is derived, and reports are kept
apart from the intent. What to write next is in
[Work on intent](work-on-intent.md).

## Connect an MCP host

`intent mcp DIR` runs Intent's MCP server over standard input and output, for
the project found by walking up from the folder `DIR`. With no `DIR`, it starts
in the working directory. Give `DIR` when your host starts servers in some
other folder, which most hosts do.

Add the server to your host's configuration. Intent's part is the `command`
and its `args`; the key that holds them (here `mcpServers`) and the file they
go in are your host's own, so check its documentation.

```json
{
  "mcpServers": {
    "intent": {
      "command": "intent",
      "args": ["mcp", "/home/dev/todo"]
    }
  }
}
```

Without a global install, let `npx` start it:

```json
{
  "mcpServers": {
    "intent": {
      "command": "npx",
      "args": ["-y", "@neutral/intent", "mcp", "/home/dev/todo"]
    }
  }
}
```

Use an absolute path for `DIR`. The server exits 2 at once, printing an
`ARGS` refusal, when `DIR` is not a folder.

The host then lists sixteen tools, one per command but `mcp` and `portal`: `fetch`,
`search`, `read`, `checks`, `report`, `start`, `create`, `validate`, `review`,
`gaps`, `drift`, `stamp`, `follow`, `reports`, `adopt` and `guide`. Each call
runs the command of the same name once and returns exactly what the command
prints. The server keeps nothing between calls, so edits to `intent/` show in
the next call with no restart. See [MCP server](../reference/mcp.md).

To check the server by hand, send it two requests and read the two answers it
prints, one JSON object per line:

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | intent mcp /home/dev/todo
```

The first answer holds `"serverInfo":{"name":"intent",...}` and, as
`instructions`, the text `intent` alone prints. The second lists the sixteen
tools. The server stops when its input ends.

## Update

Install the package again (`npm install --global @neutral/intent`), or let
`npx` fetch the new version. A Pack is not part of the package: Packs are
adopted into each project with `intent adopt`
([Work on intent](work-on-intent.md#adopt-or-update-a-pack)).
