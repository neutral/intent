import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, rm, symlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer, request } from 'node:http';
import { createInterface } from 'node:readline';
import { discoverProjectRoot } from '../dist/library/project-location.js';
import { intentInvocation } from '../dist/apps/cli/runtime.js';
import { FileSystemSource, readWorkspace } from '../dist/library/index.js';
import { buildPortal } from '../dist/apps/portal/build.js';
import { writePortal, startPortalPreview } from '../dist/apps/portal/export.js';
import { fixtureFiles, document, header, location } from './fixtures.mjs';

const bin = fileURLToPath(new URL('../apps/cli/intent.mjs', import.meta.url));
const exec = promisify(execFile);
const cli = (...args) => exec(process.execPath, [bin, ...args], { maxBuffer: 8000000 });
async function temporary(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'Intent command with spaces ')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function fixture(root) {
  for (const [path, text] of Object.entries(fixtureFiles({
    'intent/project.json': JSON.stringify({ schema: 'intent.project.v1', name: 'PRIVATE PROJECT', owners: ['example'], implementationRoots: [], exemptions: [] }),
    [location('blueprint')]: document(header('blueprint', { status: 'current' })),
    [location('behavior')]: document(header('behavior', { status: 'current', summary: 'UNSELECTED CONTENT' })),
  }))) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); }
}
async function service(t, args, options = {}) {
  const child = spawn(process.execPath, [bin, ...args], { stdio: ['pipe', 'pipe', 'pipe'], ...options });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; });
  child.stderr.on('data', bytes => { stderr += bytes; });
  t.after(async () => { if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } });
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Service did not open: ${stdout}\n${stderr}`)), 10000);
    child.stdout.on('data', () => { const match = /http:\/\/127\.0\.0\.1:\d+/.exec(stdout); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error(`Service exited: ${stdout}\n${stderr}`)); });
  });
  return { child, url, output: () => stdout };
}

test('browser discovery keeps direct scope, canonical aliases, and ambiguous ancestors explicit without writes', async t => {
  const root = await temporary(t), project = join(root, 'project'), nested = join(project, 'nested'), leaf = join(nested, 'src');
  await mkdir(leaf, { recursive: true });
  assert.equal(await discoverProjectRoot(project), project);
  assert.deepEqual(await readdir(project), ['nested']);
  await mkdir(join(project, 'intent'));
  assert.equal(await discoverProjectRoot(leaf), project);
  await mkdir(join(nested, 'intent'));
  assert.equal(await discoverProjectRoot(nested), nested);
  await assert.rejects(discoverProjectRoot(leaf), error => error.code === 'intent.project.ambiguous' && error.message.includes(project) && error.message.includes(nested));
  await symlink(nested, join(root, 'alias'));
  assert.equal(await discoverProjectRoot(join(root, 'alias')), nested);
  await assert.rejects(discoverProjectRoot(join(root, 'missing')), error => error.code === 'intent.project.directory');
  await writeFile(join(root, 'file'), 'ordinary');
  await assert.rejects(discoverProjectRoot(join(root, 'file')), error => error.code === 'intent.project.directory');
});

test('open defaults to current directory, serves actual browser, and never initializes on open', async t => {
  const root = await temporary(t), project = join(root, 'ordinary project');
  await mkdir(project); await writeFile(join(project, 'ordinary.txt'), 'preserve');
  const { child, url, output } = await service(t, ['open', '--no-browser', '--state-dir', join(root, 'durable state')], { cwd: project, env: { ...process.env, PATH: '/nonexistent' } });
  const page = await (await fetch(url)).text();
  assert.match(page, /intent-token/);
  assert.match(output(), new RegExp(project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual(await readdir(project), ['ordinary.txt']);
  const exited = once(child, 'exit'); child.kill('SIGTERM'); assert.equal((await exited)[0], 0);
  await assert.rejects(fetch(url));
  assert.deepEqual(await readdir(project), ['ordinary.txt']);
});

test('unified CLI rejects missing roots, unsupported open arguments, invalid ports, and missing explicit MCP scope', async t => {
  const root = await temporary(t);
  for (const args of [['open', join(root, 'missing')], ['open', root, 'extra'], ['open', root, '--port', '-1'], ['open', root, '--port', '65536'], ['open', root, '--resolve-sources'], ['open', root, '--bind', '0.0.0.0'], ['open', root, '--origin', 'ftp://localhost'], ['mcp'], ['mcp', root, 'extra']]) await assert.rejects(cli(...args), error => error.code === 2 && error.stdout === '');
  const help = (await cli('--help')).stdout;
  for (const command of ['intent open', 'intent export', 'intent mcp', 'intent read-check', 'intent reconcile']) assert.ok(help.includes(command));
});

test('an occupied explicit port fails startup and preserves the project', async t => {
  const root = await temporary(t), listener = createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => listener.close(resolve)));
  await assert.rejects(cli('open', root, '--no-browser', '--port', String(listener.address().port)), error => error.code === 2 && error.stderr.includes('EADDRINUSE'));
  assert.deepEqual(await readdir(root), []);
});

test('payload invocation retains an explicitly configured external runtime in host configuration', async t => {
  const root = await temporary(t), launcher = join(root, 'bin', 'intent');
  const moduleUrl = new URL('../dist/apps/cli/runtime.js', import.meta.url).href;
  const result = await exec(process.execPath, ['--input-type=module', '-e', `import { intentInvocation } from ${JSON.stringify(moduleUrl)}; process.stdout.write(JSON.stringify(intentInvocation()));`], { env: { ...process.env, INTENT_EXECUTABLE: launcher, INTENT_NODE: process.execPath } });
  assert.deepEqual(JSON.parse(result.stdout), { command: launcher, args: [], env: { INTENT_NODE: process.execPath } });
});

test('export reviews exact selection without writes, writes selected bytes to a new directory, and preserves source boundaries', async t => {
  const root = await temporary(t), project = join(root, 'project'), destination = join(root, 'selected site'), selection = join(root, 'selection.json');
  await mkdir(project); await fixture(project);
  await writeFile(selection, JSON.stringify({ recordIds: ['blueprint.store'] }));
  const proposed = JSON.parse((await cli('export', project, '--selection', selection, '--dry-run', '--json')).stdout);
  assert.equal(proposed.destination, null); assert.deepEqual(proposed.selection.recordIds, ['blueprint.store']);
  assert.ok(!(await readdir(root)).includes('selected site'));
  const result = JSON.parse((await cli('export', project, '--selection', selection, '--output', destination, '--json')).stdout);
  assert.equal(result.destination, destination); assert.equal(result.uploaded, false);
  const manifest = JSON.parse(await readFile(join(destination, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.selection.recordIds, ['blueprint.store']);
  const browse = await readFile(join(destination, 'index.html'), 'utf8');
  assert.ok(!browse.includes('PRIVATE PROJECT')); assert.ok(!browse.includes('UNSELECTED CONTENT'));
  await assert.rejects(cli('export', project, '--selection', selection, '--output', destination), error => error.code === 2 && error.stderr.includes('already exists'));
  await assert.rejects(cli('export', project, '--selection', selection), error => error.code === 2 && error.stderr.includes('explicit --output'));
  await assert.rejects(cli('export', project, '--selection', root, '--dry-run'), error => error.code === 2 && error.stderr.includes('regular JSON file'));
  await writeFile(selection, ' '.repeat(1048577));
  await assert.rejects(cli('export', project, '--selection', selection, '--dry-run'), error => error.code === 2 && error.stderr.includes('exceeds 1 MiB'));
});

test('selected site preview serves captured bytes only, refuses unrelated hosts, and export cannot write into the installation', async t => {
  const root = await temporary(t); await fixture(root);
  const source = await FileSystemSource.open(root), plan = await buildPortal(await readWorkspace(source), source, { recordIds: ['blueprint.store'] });
  const service = await startPortalPreview(plan); t.after(() => service.close());
  assert.equal((await fetch(service.url)).status, 200);
  assert.equal((await fetch(service.url + '/intent/project.json')).status, 404);
  assert.equal((await fetch(service.url, { method: 'POST' })).status, 405);
  assert.equal((await fetch(service.url, { headers: { origin: 'http://elsewhere.test' } })).status, 403);
  const status = await new Promise(resolve => { const req = request(service.url, { headers: { host: 'elsewhere.test' } }, response => { response.resume(); resolve(response.statusCode); }); req.end(); });
  assert.equal(status, 403);
  const original = await (await fetch(service.url + '/index.html')).text();
  await writeFile(join(root, location('blueprint')), 'replaced authored text');
  assert.equal(await (await fetch(service.url + '/index.html')).text(), original);
  await assert.rejects(writePortal(plan, fileURLToPath(new URL('../SHOULD-NOT-EXIST-site', import.meta.url))), error => error.code === 'intent.portal.destination');
});

test('generated absolute invocation initializes real MCP with stdout reserved for protocol', async t => {
  const root = await temporary(t); await fixture(root);
  const invocation = intentInvocation();
  const child = spawn(invocation.command, [...invocation.args, 'mcp', root], { env: { ...process.env, PATH: '/nonexistent' }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = ''; child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
  t.after(() => { if (child.exitCode === null) child.kill('SIGTERM'); });
  const waiters = new Map(), lines = createInterface({ input: child.stdout });
  lines.on('line', line => { const message = JSON.parse(line); waiters.get(message.id)?.(message); });
  const call = message => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { waiters.delete(message.id); reject(new Error('MCP response timeout')); }, 10000);
    waiters.set(message.id, result => { clearTimeout(timeout); waiters.delete(message.id); resolve(result); });
    child.stdin.write(JSON.stringify(message) + '\n');
  });
  await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'configuration-test', version: '1' } } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  await call({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  await call({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'intent_inspect', arguments: {} } });
  child.stdin.end();
  assert.equal((await once(child, 'exit'))[0], 0, stderr);
  const messages = stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(messages.find(message => message.id === 1).result.serverInfo.name, 'intent-agent');
  assert.ok(messages.find(message => message.id === 2).result.tools.some(tool => tool.name === 'intent_read_check'));
  assert.ok(!messages.find(message => message.id === 3).error);
  assert.ok(!messages.find(message => message.id === 3).result.isError);
  assert.equal(JSON.parse(messages.find(message => message.id === 3).result.content[0].text).mode, 'knowledge');
  assert.equal(stderr, '');
});
