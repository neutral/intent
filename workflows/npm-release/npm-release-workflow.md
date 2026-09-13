# Publish the npm package

Use this workflow to publish `@neutral/intent` manually from its public source
checkout. Use Node.js 24 or newer, npm, Python 3.10 or newer and `tar`. Publication
requires an npm account permitted to create or publish the package in the
`@neutral` organization. Keep the selected source stable during qualification.
A Git tag and GitHub Actions setup are not required.

## Qualify the release

Run these commands from the public source repository root:

```sh
npm ci
node workflows/npm-release/verify-release.mjs source
npm run release:check
```

The source check requires matching package, lockfile, `VERSION` and versioned
changelog entries. The release checker builds and tests the selected source,
assembles the npm archive, exercises it in an external consumer, and checks the
host native bundle. It prints a `RELEASE_REPORT` path and retains logs and
archives in that temporary run directory. The report records the available
source revision and working state; uncommitted source can be qualified.

Select that successful report explicitly:

```sh
node workflows/npm-release/verify-release.mjs artifact --report /absolute/run/report.json
```

The helper reads the report and archive without publishing. It requires all
release checks to have passed and verifies archive identity, checksum, size and
packed metadata. Its JSON output names the exact archive to publish. The archive
includes the adapted installed documentation that qualification exercised.

## Publish the checked archive

Authenticate, optionally rehearse the command, then upload the selected archive:

```sh
npm login
npm publish /absolute/path/neutral-intent-0.1.0.tgz --dry-run --access public --ignore-scripts
npm publish /absolute/path/neutral-intent-0.1.0.tgz --access public --ignore-scripts
```

Complete any authentication or second-factor prompt required by the account.
The dry run checks local package preparation; it does not test registry
authentication or upload. The final command publishes the selected version with
public access and the `latest` npm tag. It uses the qualified archive without
rerunning package scripts.

After publication, confirm the selected version is available:

```sh
npm view @neutral/intent@0.1.0 version
```

Retain the package version, source state, artifact hash, qualification report and
publication result with the release record. Report the actual platform and
journeys exercised. Native target qualification, browser interaction and human
usefulness have the limits described in the
[distribution guide](../../distribution/README.md).

## Failure and recovery

If qualification or archive verification fails, inspect its log, correct the
source and qualify a new archive. If npm refuses authentication or access, repair
the account access and retry the same checked archive. Before retrying an
uncertain upload, inspect the registry for that version. Do not overwrite a
published version or replace its recorded archive.

Qualification replaces ignored build output and uses temporary consumers and
loopback services. Publication changes the npm registry. It does not modify
project Knowledge or install the package globally. Preserve the checked archive
and reports while the release is under review.
