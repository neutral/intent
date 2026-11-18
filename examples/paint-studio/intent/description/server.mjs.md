---
{"id":"description:server-mjs"}
---
# The fixed local asset server: five routes and nothing else

`server.mjs` serves the page, its three scripts and its stylesheet from `src/` on port 4380, and nothing else.

## How it works

The request's pathname, with any query string ignored, is looked up in a fixed map: `/` gives `index.html`, and `/app.js`, `/model.js`, `/render.js` and `/style.css` give those files. Each is read from `src/` beside the module and sent with its content type, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Any other pathname gets 404; a mapped file that cannot be read gets 500. The server listens on all interfaces at port 4380 and logs one line once it listens. Port and startup errors are ordinary Node process failures. It uses only Node's HTTP and file system modules.

## Why it is shaped this way

A fixed allowlist keeps the served surface easy to inspect: nothing in a request becomes a file path. Artwork stays in the browser, so the server needs no upload, listing, change API or authentication. It is a local server for one machine, not an internet deployment.

## What callers rely on

- The page loads every file it needs from these five routes; a new file in `src/` is not served until it is added to the map.
- Nothing is cached, so a reload always gets the current files.

### Check fixed-routes

**Claim.** Only the five mapped paths are served; any other path, traversal
text included, gets 404 and never reads another file.

**Fails when.** A request for a path outside the map returns a file's content.

**Evidence.** A test that requests each of the five mapped paths and several
others, text that climbs out of the folder among them, and reads the status of
each response.

**Applied by.** test

## Relations

- follows blueprint:one-plain-document-model-owns

## Read against

- server.mjs sha256:6f72c1ab7d7a8e08
- blueprint:one-plain-document-model-owns sha256:f15697f14fb6fd3c
