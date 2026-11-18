# Security

Intent is a command-line tool, an MCP server and a portal that read and write
files in one project. It connects to no other machine, and it runs no code of
the project it works on. Only the portal listens, and only on this machine.

## What it reads

- The files of the project it is run in: the nearest folder, from the working
  directory up, that holds `intent/intent.json`. It reads the files under
  `intent/`, and the code files under the project's code roots, to hash them
  and to look for Intent's IDs and for the test names its records give.
- What `git` says about the project's repository.
- With `intent adopt DIR`, the Pack release folder `DIR`, wherever it is on
  the machine.
- Its own pages, for `intent guide`.

A path outside the project given to `intent fetch` is named in the answer and
not read. `intent checks`, `intent create` and `intent reports` refuse one,
and `intent report` takes a form only from the project's `intent/.reports/`.
A symbolic link in `intent/` is not followed, and a symbolic link is never
taken for a code file.

## What it writes and runs

- It writes only under the project's `intent/` folder: records, the project
  file, the copies of adopted Packs, report forms and kept reports, and the
  derived index. `intent start` creates that folder in the folder it is run
  in. The one exception is `intent portal --export OUT`, which writes the
  portal's pages into `OUT`, a folder outside `intent/` and the code roots
  that does not hold the project.
- The one program it runs is `git`, in the project's repository, with its
  arguments passed as a list and never through a shell. It never runs the
  project's code or tests, nor anything a record, a Check or a Pack names.
- The MCP server speaks over standard input and output and listens on no
  port. Each tool call runs one command. The host that starts the server
  decides which folder it starts in and who can reach it.
- The portal, `intent portal`, listens on `127.0.0.1` alone, at the port it
  prints, until it is stopped. It answers `GET` and `HEAD` only, and refuses a
  request that names another host or comes from another site. Each page reads
  the project's files when it is asked for, without the index, and the portal
  writes nothing. A record's text is shown as text: HTML written in it is
  never run, and an image is never loaded. Every answer carries a Content
  Security Policy that lets a page load only the portal's own stylesheet and
  scripts. Anyone on this machine who can reach the port can read the intent
  and the kept reports while it runs.

## What reaches agents

Records, Checks and adopted Disciplines are text that Intent hands to agents
as what a change must respect. Treat them as the code they sit beside: review
a change to `intent/` as you review a change to the code.

An adopted Pack reaches every agent whose change touches the paths the Pack
applies to. Adopt only a release you trust, and read what `intent adopt` says
changed before you commit an update.

Report forms and kept reports hold whatever an agent wrote as evidence. They
stay in `intent/.reports/`, which the `.gitignore` that `intent start` writes
keeps out of git. Keep secrets out of them.

## The package

The npm package has no runtime dependency and no install script. It runs on
the host's Node.js and uses the host's `git`.

## Reporting a vulnerability

Use the contact and the terms in [CONTRIBUTING.md](CONTRIBUTING.md). Give the
version, the platform, the Node.js version, the boundary you expected and the
smallest reproduction you have. Leave out secrets and personal data.
