// Run this development-owned fixture against an explicit consumer installation.
// Usage: node tests/qualification/verify-installed.mjs /absolute/path/to/consumer
// The consumer must contain the installed @neutral/intent package; neither
// this harness nor its bounded-integer fixture is part of the distribution.
// Knowledge operations use Intent. Implementation tests run independently and
// their ordinary reports stay outside intent/.
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

assert.equal(process.argv.length, 3, 'Usage: node tests/qualification/verify-installed.mjs /absolute/path/to/consumer');
const installation = await realpath(resolve(process.argv[2]));
const runRoot = await mkdtemp(join(installation, 'intent-fixture-run-'));
const repository = join(runRoot, 'repository');
const fixtureSource = fileURLToPath(new URL('../fixtures/bounded-integer/', import.meta.url));
let FileSystemSource, readWorkspace, buildPortal;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const thresholds = {
  parserPass: 'ordinary implementation report: pass, 27 PASS findings',
  negativeProbe: 'completed, explicit fail for 999 after > changes to >=, oracle bytes unchanged',
  portal: 'six selected current Knowledge records',
  participants: { human: 0, freshAgent: 0 },
};
const report = { schema: 'intent.installed-fixture-qualification.v1', startedAt: new Date().toISOString(), runRoot, installation, fixtureSource, node: process.version, platform: process.platform, arch: process.arch, thresholds, observations: [], commands: [] };
await writeFile(join(runRoot, 'thresholds-before-run.json'), JSON.stringify(thresholds, null, 2) + '\n');
await cp(fixtureSource, repository, { recursive: true });
const cli = join(installation, 'node_modules/@neutral/intent/apps/cli/intent.mjs');
const portal = join(installation, 'node_modules/@neutral/intent/apps/portal/portal-cli.mjs');
function run(script, args, expected = 0, cwd = repository) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 30000, maxBuffer: 8000000 });
  report.commands.push({ script, args, status: result.status, elapsedMs: Date.now() - started, stderr: result.stderr });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result.stdout;
}

try {
  // Resolve the import condition from a module located under the selected
  // consumer, so the development checkout's dependency tree cannot satisfy it.
  const resolver = join(runRoot, 'resolve-public.mjs');
  await writeFile(resolver, `console.log(JSON.stringify(Object.fromEntries(['library', 'portal'].map(name => [name, import.meta.resolve('@neutral/intent/' + name)]))));\n`);
  const installedUrls = JSON.parse(run(resolver, [], 0, installation));
  for (const [name, url] of Object.entries(installedUrls)) {
    const installedPath = await realpath(fileURLToPath(url));
    assert.ok(installedPath.startsWith(join(installation, 'node_modules') + '/'), `Installed ${name} escapes selected consumer: ${installedPath}`);
  }
  ({ FileSystemSource, readWorkspace } = await import(installedUrls.library));
  ({ buildPortal } = await import(installedUrls.portal));
  report.installedImports = installedUrls;
  const initial = await readWorkspace(await FileSystemSource.open(repository));
  assert.equal(initial.records.length, 6);
  assert.equal(initial.complete, true, JSON.stringify(initial.diagnostics));
  assert.equal(Object.hasOwn(initial, 'history'), false);
  const ready = await readWorkspace(await FileSystemSource.open(repository));
  assert.equal(ready.complete, true, JSON.stringify(ready.diagnostics));
  assert.equal(ready.valid, true, JSON.stringify(ready.diagnostics));
  const parserPath = join(repository, 'src/parse-integer.mjs');
  const oraclePath = join(repository, 'checks/boundaries.mjs');
  const parser = await readFile(parserPath);
  const oracle = await readFile(oraclePath);
  const examineImplementation = expected => JSON.parse(run(oraclePath, [], expected));
  const passed = examineImplementation(0);
  assert.equal(passed.outcome, 'pass');
  assert.equal(passed.findings.length, 27);
  assert.equal(passed.findings.every(finding => finding.message.startsWith('PASS ')), true);
  await writeFile(join(runRoot, 'implementation-pass.json'), JSON.stringify(passed, null, 2) + '\n');
  let failed;
  try {
    const negative = parser.toString('utf8').replace('value > 999', 'value >= 999');
    assert.notEqual(negative, parser.toString('utf8'));
    await writeFile(parserPath, negative);
    failed = examineImplementation(1);
    assert.equal(failed.outcome, 'fail');
    assert.deepEqual(failed.findings.filter(finding => finding.message.startsWith('FAIL ')).map(finding => finding.message), ['FAIL "999"']);
    assert.deepEqual(await readFile(oraclePath), oracle);
    await writeFile(join(runRoot, 'negative-probe.json'), JSON.stringify(failed, null, 2) + '\n');
  } finally { await writeFile(parserPath, parser); }
  report.observations.push({ operation: 'independent-implementation', pass: passed.outcome, negativeProbe: failed.outcome, reportsOutsideIntent: true });
  run(portal, [repository, join(repository, 'selection.json'), join(runRoot, 'portal')]);
  const final = await readWorkspace(await FileSystemSource.open(repository), { resolveSources: true });
  assert.equal(final.complete, true, JSON.stringify(final.diagnostics));
  assert.equal(final.valid, true, JSON.stringify(final.diagnostics));
  const selection = JSON.parse(await readFile(join(repository, 'selection.json'), 'utf8'));
  assert.equal(selection.recordIds.length, 6);
  assert.deepEqual(Object.keys(selection), ['recordIds']);
  const expectedPortal = await buildPortal(final, await FileSystemSource.open(repository), selection);
  assert.equal(expectedPortal.complete, true);
  async function filesIn(directory, prefix = '') {
    const paths = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory()) paths.push(...await filesIn(join(directory, entry.name), path + '/'));
      else paths.push(path);
    }
    return paths.sort();
  }
  const output = join(runRoot, 'portal');
  assert.deepEqual(await filesIn(output), expectedPortal.files.map(file => file.path).sort());
  for (const file of expectedPortal.files) assert.deepEqual(await readFile(join(output, file.path)), Buffer.from(file.bytes));
  report.observations.push({ operation: 'selected-portal', records: selection.recordIds.length, exactFiles: expectedPortal.files.length });
  report.sources = { parser: sha256(parser), oracle: sha256(oracle), installedLibraryPackage: sha256(await readFile(join(installation, 'node_modules/@neutral/intent/package.json'))) };
  report.status = 'pass';
} catch (error) { report.status = 'fail'; report.error = error.stack; process.exitCode = 1; }
report.endedAt = new Date().toISOString();
await writeFile(join(runRoot, 'report.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
