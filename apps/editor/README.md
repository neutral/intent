# Intent Editor

Intent Editor provides local browser reading, navigation and Knowledge authoring
for one explicitly selected repository. It uses the shared Library and ships as
`@neutral/intent/editor`.

## Installed usage

```sh
intent open /path/to/repository
```

The browser opens automatically; use the printed loopback URL if it does not.
Omit the path to discover the project from your current directory. A directory
without Intent opens guided initialization: choose the project name, owners and
implementation roots, review the proposed files, then explicitly apply them.
An empty implementation scope is valid. Merely opening a directory changes no
authored files. `intent editor` and `intent-editor` remain compatibility aliases.

The Editor shows definitions, relationships and source, and prepares Knowledge
changes for review and application.
The Source view edits Markdown and selected record metadata through one change
proposal. Project configuration also exposes the shared catalog and connections
for explicit repair. It does not run Checks or store implementation outcomes.

Refresh keeps unsaved Markdown, selected metadata and configuration text while
updating repository information. If the edited inputs are unchanged, prepare
again against the refreshed workspace. If they changed, compare the original
and current text and explicitly choose how to continue; local edits remain in
the form. Source and configuration drafts save automatically to private user data
outside the project. Prepared changes are retained there as well. **Saved authoring work**
restores a draft or reviews a saved proposal after a browser or service restart.
Restoration keeps exact originals and requires a conflict choice if source changed.
Form choices for initialization, new records and adoption remain in browser memory
until a proposal is prepared.

An application refusal preserves the form and offers refresh and preparation of
a new proposal. A refusal with no journal does not offer operation recovery.
Interrupted operations with retained journals remain recoverable separately.

Use **Export site** to choose current records, preview their static reader and
write the reviewed selection to a new destination. Export does not upload or deploy
anything. **Connect an agent** generates the fixed-project MCP configuration for
your host; download it and add the entry in the host's settings.

Stop the terminal command with Ctrl-C to close the Editor and previews. Saved drafts
survive. Their default base is `~/Library/Application Support/Intent` on macOS,
`%LOCALAPPDATA%\Intent` on Windows and `$XDG_DATA_HOME/intent` or
`~/.local/share/intent` on Linux. Use `intent open PROJECT --state-dir DIRECTORY`
for an advanced base override. Each canonical project root has its own directory.
Recovery is durable authoring work, not disposable cache. Interrupted write journals
remain under the project's `tmp/intent/`; comparison baselines remain in service
memory. See the [installation guide](../../docs/install.md) for updating and
removing the application while preserving authored files and saved drafts.

For a container or an explicit routed service, use a fixed bind and port, its
externally reachable origin, a persistent state mount and `--no-browser`:

```sh
intent open /project --bind 0.0.0.0 --port 8787 \
  --origin http://localhost:8787 --state-dir /state --no-browser
```

Open the exact access URL printed by the service; its secret is required for the
Editor page. The project root remains `/project` inside the container. **Connect an
agent** can generate a `docker exec -i` configuration after you enter the running
container name. Site preview uses the same exposed port. Restarting the service
changes its access URL secret while retaining drafts under the mounted state
location.

The [Editor contract](../../spec/spec/EDITOR.md) owns the interaction and
service boundary. The [security model](../../SECURITY.md) explains local access,
session tokens and authoring preconditions.

## Develop and verify

From a source checkout:

```sh
npm run build
node apps/cli/intent.mjs open /path/to/repository
```

`server.ts` owns the local service; `assets/` holds its browser files. Tests live
in `tests/editor.test.mjs`, `tests/editor-workflows.test.mjs`,
`tests/editor-refresh.test.mjs` and `tests/editor-experience.test.mjs`. The refresh
tests exercise the real service and the browser script with a small DOM harness; they do not qualify visual layout
or accessibility.
`node tests/qualification/editor-fixture.mjs` starts a disposable repository and
external Pack for browser checks. Use its printed URL to exercise reading, reviewed
authoring, refresh conflicts and adoption. Examine keyboard navigation, control
labels and narrow layouts separately; starting the fixture establishes no result.

Original source uses the repository's CC0-1.0 OR 0BSD license choice.
