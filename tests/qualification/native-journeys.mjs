// Operate an exact native installation in disposable projects without ambient Node/npm.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, cp, readFile, writeFile, readdir, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';

const executable = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Supply the exact installed native intent executable');
const run = await mkdtemp(join(tmpdir(), 'intent-native-journeys-'));
const emptyPath = join(run, 'empty PATH'), state = join(run, 'durable user data');
await mkdir(emptyPath);
const env = { ...process.env, PATH: emptyPath, INTENT_STATE_DIR: state };
delete env.INTENT_EXECUTABLE;
const execute = promisify(execFile), services = new Set();
const report = { executable, run, node: process.version, platform: process.platform, arch: process.arch, installedPath: emptyPath, checks: [], status: 'running' };
const check = async (name, operation) => {
  const started = Date.now();
  await operation();
  report.checks.push({ name, status: 'pass', elapsedMs: Date.now() - started });
  console.log(`PASS ${name}`);
};
const cli = async (args, cwd = run) => (await execute(executable, args, { cwd, env, timeout: 20000, maxBuffer: 16000000 })).stdout;
async function fingerprint(folder) {
  const rows = [];
  async function visit(path, prefix = '') {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name === 'tmp') continue;
      const relative = join(prefix, entry.name), absolute = join(path, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else rows.push([relative, createHash('sha256').update(await readFile(absolute)).digest('hex')]);
    }
  }
  await visit(folder);
  return rows.sort((a, b) => a[0].localeCompare(b[0]));
}
async function service(args, cwd = run) {
  const child = spawn(executable, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', errors = '';
  child.stderr.on('data', bytes => { errors += bytes; });
  const closed = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    const result = await closed; clearTimeout(timer); services.delete(stop);
    assert.equal(result.signal, null, `Service required forced shutdown: ${errors}`);
    assert.equal(result.code, 0, errors);
  };
  services.add(stop);
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No service URL: ${output} ${errors}`)), 15000);
    child.once('error', reject);
    child.once('close', () => { clearTimeout(timer); reject(new Error(`Service exited before URL: ${output} ${errors}`)); });
    child.stdout.on('data', bytes => { output += bytes; const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]; if (url) { clearTimeout(timer); resolve(url); } });
  });
  return { child, url, stop, output: () => output };
}
async function editor(root, cwd) {
  const running = await service(['open', ...(root ? [root] : []), '--no-browser'], cwd);
  const html = await (await fetch(running.url)).text();
  const token = html.match(/name="intent-token" content="([^"]+)"/)?.[1];
  assert.ok(token, 'Browser bootstrap contains its local API token');
  const headers = { 'x-intent-token': token, 'content-type': 'application/json' };
  const request = async (path, body, status = 200) => {
    const response = await fetch(running.url + path, { headers, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
    const value = await response.json();
    assert.equal(response.status, status, JSON.stringify(value));
    return value;
  };
  return { ...running, request, headers };
}
async function mcp(config, root) {
  const child = spawn(config.command, config.args, { cwd: run, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let errors = '', id = 0;
  child.stderr.on('data', bytes => { errors += bytes; });
  const pending = new Map(), lines = createInterface({ input: child.stdout });
  const closed = new Promise(resolve => child.once('close', resolve));
  lines.on('line', line => {
    let value;
    try { value = JSON.parse(line); } catch { for (const { reject } of pending.values()) reject(new Error(`Non-protocol stdout: ${line}`)); return; }
    pending.get(value.id)?.resolve(value); pending.delete(value.id);
  });
  const call = (method, params) => new Promise((resolve, reject) => {
    const current = ++id, timer = setTimeout(() => reject(new Error(`MCP timeout ${method}: ${errors}`)), 10000);
    pending.set(current, { resolve: value => { clearTimeout(timer); resolve(value); }, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: current, method, params }) + '\n');
  });
  const tool = async (name, args = {}) => {
    const value = await call('tools/call', { name, arguments: args });
    assert.equal(value.error, undefined, JSON.stringify(value));
    assert.equal(value.result.isError, false, JSON.stringify(value));
    return JSON.parse(value.result.content[0].text);
  };
  try {
    const initialized = await call('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'native-journeys', version: '1' } });
    assert.equal(initialized.result.protocolVersion, '2025-11-25');
    assert.equal(initialized.result.serverInfo.version, (await cli(['--version'])).trim());
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    assert.ok((await call('tools/list', {})).result.tools.some(tool => tool.name === 'intent_prepare_change'));
    const inspected = await tool('intent_inspect');
    assert.equal(inspected.mode, 'knowledge');
    await tool('intent_read_check', { session: inspected.session, id: 'check.integer-boundaries' });
    assert.ok((await tool('intent_guidance')).files.length > 0);
    const reconciled = await tool('intent_inspect', { reconcileImplementation: true });
    assert.equal(reconciled.mode, 'reconciliation');
    await tool('intent_coverage', { session: reconciled.session });
    assert.equal(config.args.at(-1), await realpath(root));
  } finally {
    child.stdin.end(); const timer = setTimeout(() => child.kill('SIGKILL'), 3000); await closed; clearTimeout(timer); lines.close();
  }
}
try {
  await check('installed help/version with Node/npm absent from PATH', async () => {
    assert.match(await cli(['--version']), /^\d+\.\d+\.\d+/);
    const help = await cli(['--help']);
    for (const command of ['open', 'export', 'mcp', 'read-check', 'reconcile', 'apply']) assert.ok(help.includes(command));
    await assert.rejects(execute('node', ['--version'], { env }), error => error.code === 'ENOENT');
    await assert.rejects(execute('npm', ['--version'], { env }), error => error.code === 'ENOENT');
  });
  const ordinary = join(run, 'Ordinary project with spaces');
  await mkdir(ordinary); await writeFile(join(ordinary, 'README.md'), '# Ordinary project\n');
  await check('open and initialization proposal leave authored files unchanged until explicit apply', async () => {
    const before = await fingerprint(ordinary), app = await editor(undefined, ordinary);
    try {
      assert.deepEqual(await fingerprint(ordinary), before);
      const workspace = await app.request('/api/workspace');
      const proposed = await app.request('/api/initialize', { sourceBasis: workspace.sourceBasis.id, request: { name: 'Native empty scope', owners: ['maintainer'], implementationRoots: [] } });
      assert.ok(proposed.fileProposal); assert.deepEqual(proposed.scope.implementationRoots, []);
      assert.deepEqual(await fingerprint(ordinary), before);
      await app.request('/api/proposal-review', proposed.fileProposal);
      assert.deepEqual(await fingerprint(ordinary), before);
      assert.equal((await app.request('/api/apply', proposed.fileProposal)).status, 'completed');
      assert.deepEqual(JSON.parse(await readFile(join(ordinary, 'intent/project.json'), 'utf8')).implementationRoots, []);
      assert.equal((await app.request('/api/workspace')).coverage, null);
    } finally { await app.stop(); }
  });
  const project = join(run, 'Consumer with spaces');
  await cp(fileURLToPath(new URL('../fixtures/bounded-integer/', import.meta.url)), project, { recursive: true });
  await check('Knowledge reading and explicit implementation reconciliation keep distinct scope', async () => {
    const before = await fingerprint(project);
    const knowledge = JSON.parse(await cli(['inspect', project, '--json']));
    assert.equal(knowledge.mode, 'knowledge'); assert.equal(knowledge.coverage, null);
    assert.match(await cli(['read-check', project, 'check.integer-boundaries']), /Supported Knowledge/);
    const reconciled = JSON.parse(await cli(['reconcile', project, '--json']));
    assert.equal(reconciled.mode, 'reconciliation'); assert.ok(reconciled.coverage.artifacts.length >= 2);
    assert.deepEqual(await fingerprint(project), before);
  });
  await check('canonical nested discovery, invalid direct project, missing roots and ambiguity', async () => {
    const alias = join(run, 'project alias'); await symlink(project, alias);
    const app = await editor(join(alias, 'src'));
    try { assert.equal((await app.request('/api/connection')).root, await realpath(project)); } finally { await app.stop(); }
    await assert.rejects(cli(['open', join(run, 'absent'), '--no-browser']), /existing.*directory/i);
    const nested = join(project, 'nested'); await mkdir(join(nested, 'intent'), { recursive: true }); await writeFile(join(nested, 'intent/project.json'), '{invalid'); await mkdir(join(nested, 'child'));
    await assert.rejects(cli(['open', join(nested, 'child'), '--no-browser']), /Several|ambiguous/);
    const invalid = await editor(nested);
    try { assert.equal((await invalid.request('/api/connection')).root, await realpath(nested)); assert.equal((await invalid.request('/api/workspace')).valid, false); } finally { await invalid.stop(); }
  });
  const path = 'intent/behavior/integer-token.md';
  let app, original, proposed, changed;
  await check('installed Editor saves durable draft and exact reviewed proposal without authored writes', async () => {
    app = await editor(project);
    assert.equal((await fetch(app.url + '/api/workspace')).status, 403);
    assert.equal((await fetch(app.url + '/api/workspace', { headers: { ...app.headers, origin: 'https://unrelated.example' } })).status, 403);
    original = await app.request('/api/edit-state?path=' + encodeURIComponent(path));
    changed = original.source.replace('A single canonical spelling', 'One canonical spelling');
    assert.notEqual(changed, original.source);
    await app.request('/api/recovery', { draft: { kind: 'source', path, before: original.source, beforeContext: original.context, beforeMetadata: JSON.stringify(original.context, null, 2), source: changed, metadata: JSON.stringify(original.context, null, 2) } });
    proposed = await app.request('/api/change', { path, before: original.source, beforeContext: original.context, sourceBasis: original.workspace.sourceBasis.id, operation: { kind: 'edit', sourceText: changed, context: original.context } });
    assert.ok(proposed.fileProposal); await app.request('/api/proposal-review', proposed.fileProposal);
    assert.equal(await readFile(join(project, path), 'utf8'), original.source);
    await app.stop();
  });
  await check('restart recovery preserves draft/proposal, exact stale apply refuses, fresh review applies', async () => {
    app = await editor(project);
    const recovered = await app.request('/api/recovery');
    assert.equal(recovered.draft.source, changed); assert.deepEqual(recovered.proposal, proposed.fileProposal);
    await app.request('/api/proposal-review', recovered.proposal);
    const external = original.source.replace('A single canonical spelling', 'An externally reviewed canonical spelling');
    await writeFile(join(project, path), external);
    assert.equal((await app.request('/api/apply', recovered.proposal)).status, 'refused');
    assert.equal(await readFile(join(project, path), 'utf8'), external);
    const fresh = await app.request('/api/edit-state?path=' + encodeURIComponent(path));
    const proposal = await app.request('/api/change', { path, before: fresh.source, beforeContext: fresh.context, sourceBasis: fresh.workspace.sourceBasis.id, operation: { kind: 'edit', sourceText: changed, context: fresh.context } });
    await app.request('/api/proposal-review', proposal.fileProposal);
    assert.equal((await app.request('/api/apply', proposal.fileProposal)).status, 'completed');
    assert.equal(await readFile(join(project, path), 'utf8'), changed);
    assert.equal((await app.request('/api/recovery')).proposal, null);
  });
  await check('selected site preview and explicit export exclude unselected sources and preserve Knowledge', async () => {
    const before = await fingerprint(project), workspace = await app.request('/api/workspace');
    const preview = await app.request('/api/export-preview', { recordIds: ['behavior.integer-token'], sourceBasis: workspace.sourceBasis.id });
    const destination = join(run, 'Selected static site');
    assert.equal((await fetch(preview.url)).status, 200);
    const exported = await app.request('/api/export', { previewId: preview.previewId, destination });
    assert.equal(exported.records, 1);
    const manifest = JSON.parse(await readFile(join(destination, 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest.selection.recordIds, ['behavior.integer-token']);
    assert.deepEqual(await fingerprint(project), before);
    await app.request('/api/export', { previewId: preview.previewId, destination }, 400);
  });
  await check('intent export selection review and local preview run without ambient tools', async () => {
    const selection = join(run, 'Selected content.json'), output = join(run, 'CLI static reader');
    await writeFile(selection, JSON.stringify({ recordIds: ['behavior.integer-token'] }));
    const before = await fingerprint(project);
    const reviewed = await cli(['export', project, '--selection', selection, '--dry-run', '--json']);
    assert.ok(reviewed.includes('behavior.integer-token'));
    const preview = await service(['export', project, '--selection', selection, '--output', output, '--preview', '--no-browser']);
    try {
      assert.equal((await fetch(preview.url)).status, 200);
      const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
      assert.deepEqual(manifest.selection.recordIds, ['behavior.integer-token']);
      assert.deepEqual(await fingerprint(project), before);
    } finally { await preview.stop(); }
  });
  await check('generated browser MCP configuration performs real initialization/read/guidance/reconciliation', async () => {
    const connection = await app.request('/api/connection');
    assert.equal(await realpath(connection.config.mcpServers.intent.command), await realpath(executable));
    await mcp(connection.config.mcpServers.intent, project);
  });
  await app.stop();
  report.status = 'pass';
} catch (error) {
  report.status = 'fail'; report.error = error.stack; process.exitCode = 1; console.error(error);
} finally {
  for (const stop of services) await stop().catch(error => { report.cleanupError = error.message; process.exitCode = 1; });
  await writeFile(join(run, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`NATIVE_JOURNEYS ${join(run, 'report.json')}`);
}
