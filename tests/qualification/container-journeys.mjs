// Compose only Intent's payload with one explicit Node runtime in a disposable container.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { createInterface } from 'node:readline';

if (!process.argv[2]) throw new Error('Supply an extracted runtime-free payload directory');
const payload = resolve(process.argv[2]), image = process.argv[3] ?? 'node:24.18.0-bookworm-slim';
const run = await mkdtemp(join(tmpdir(), 'intent-container-journeys-'));
const container = `intent-component-qualification-${process.pid}`;
const execute = promisify(execFile);
const docker = async args => (await execute('docker', args, { encoding: 'utf8', timeout: 120000, maxBuffer: 16000000 })).stdout;
const report = { payload, image, container, run, checks: [], status: 'running' };
const project = join(run, 'Consumer with spaces'), state = join(run, 'Durable state'), exports = join(run, 'Exported sites');
await cp(fileURLToPath(new URL('../fixtures/bounded-integer/', import.meta.url)), project, { recursive: true });
await mkdir(state); await mkdir(exports);
const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let started = false, token;
const check = async (name, action) => { await action(); report.checks.push({ name, status: 'pass' }); console.log(`PASS ${name}`); };
const cli = args => docker(['exec', '-e', 'INTENT_NODE=/usr/local/bin/node', container, '/opt/intent/bin/intent', ...args]);
const request = async (path, body, status = 200) => {
  const response = await fetch(origin + path, { headers: { 'x-intent-token': token, 'content-type': 'application/json' }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
  const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value;
};
async function ready() {
  let last;
  for (let attempt = 0; attempt < 100; attempt++) {
    const logs = await docker(['logs', container]);
    const urls = logs.match(/http:\/\/127\.0\.0\.1:\d+[^\s]*/g) ?? [];
    const url = urls.at(-1);
    if (url) {
      try {
        const response = await fetch(url); const html = await response.text();
        token = html.match(/name="intent-token" content="([^"]+)"/)?.[1];
        if (response.status === 200 && token) return;
        last = html;
      } catch (error) { last = error.message; }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Container did not become ready: ${last}\n${await docker(['logs', container])}`);
}
async function mcp() {
  const child = spawn('docker', ['exec', '-i', '-e', 'INTENT_NODE=/usr/local/bin/node', container, '/opt/intent/bin/intent', 'mcp', '/project'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let counter = 0, stderr = ''; const pending = new Map();
  child.stderr.on('data', chunk => { stderr += chunk; });
  const closed = new Promise(resolve => child.once('close', resolve));
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => { const value = JSON.parse(line); pending.get(value.id)?.(value); pending.delete(value.id); });
  const call = (method, params) => new Promise((resolve, reject) => {
    const id = ++counter, timer = setTimeout(() => reject(new Error(`MCP timeout: ${stderr}`)), 10000);
    pending.set(id, value => { clearTimeout(timer); resolve(value); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  try {
    const initialized = await call('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'container-component-check', version: '1' } });
    assert.equal(initialized.result.serverInfo.version, (await cli(['--version'])).trim());
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    assert.ok((await call('tools/list', {})).result.tools.some(tool => tool.name === 'intent_apply'));
    const result = await call('tools/call', { name: 'intent_inspect', arguments: {} });
    assert.equal(result.result.isError, false); const inspection = JSON.parse(result.result.content[0].text);
    assert.equal(inspection.mode, 'knowledge');
    const reading = await call('tools/call', { name: 'intent_read_check', arguments: { session: inspection.session, id: 'check.integer-boundaries' } });
    assert.equal(reading.result.isError, false);
  } finally { child.stdin.end(); const timer = setTimeout(() => child.kill('SIGKILL'), 3000); await closed; clearTimeout(timer); lines.close(); }
}
try {
  report.imageIdentity = JSON.parse(await docker(['image', 'inspect', image]))[0].RepoDigests;
  await check('Linux payload starts with explicit runtime, fixed mounted root and read-only installation', async () => {
    started = true;
    await docker(['run', '--detach', '--rm', '--name', container, '--read-only', '--tmpfs', '/tmp', '--publish', `127.0.0.1:${port}:8787`,
      '--mount', `type=bind,src=${payload},dst=/opt/intent,readonly`, '--mount', `type=bind,src=${project},dst=/project`, '--mount', `type=bind,src=${state},dst=/state`, '--mount', `type=bind,src=${exports},dst=/exports`,
      '--env', 'INTENT_NODE=/usr/local/bin/node', '--env', 'INTENT_STATE_DIR=/state', '--env', 'PATH=/empty', '--entrypoint', '/opt/intent/bin/intent', image,
      'open', '/project', '--no-browser', '--bind', '0.0.0.0', '--port', '8787', '--origin', origin]);
    started = true; await ready();
    report.runtime = (await docker(['exec', container, '/usr/local/bin/node', '-p', 'JSON.stringify({version:process.version,platform:process.platform,arch:process.arch})'])).trim();
    assert.equal(JSON.parse(report.runtime).platform, 'linux');
    assert.equal((await request('/api/connection')).root, '/project');
    assert.equal((await request('/api/workspace')).mode, 'knowledge');
    assert.equal((await request('/api/workspace')).coverage, null);
  });
  await check('container binding protects bootstrap, API session, Host and Origin', async () => {
    assert.equal((await fetch(origin)).status, 403);
    assert.equal((await fetch(origin + '/api/workspace')).status, 403);
    assert.equal((await fetch(origin + '/api/workspace', { headers: { 'x-intent-token': token, origin: 'https://unrelated.example' } })).status, 403);
    const wrongHost = await new Promise((resolve, reject) => { const req = httpRequest(origin + '/api/workspace', { headers: { 'x-intent-token': token, host: 'unrelated.example' } }, response => { response.resume(); resolve(response.statusCode); }); req.on('error', reject); req.end(); });
    assert.equal(wrongHost, 403);
    const connection = await request('/api/connection');
    assert.equal(connection.config.mcpServers.intent.command, '/opt/intent/bin/intent');
  });
  const path = 'intent/behavior/integer-token.md'; let original, revised, proposal;
  await check('container draft/proposal preparation preserves authored bytes and persists in mounted state', async () => {
    original = await request('/api/edit-state?path=' + encodeURIComponent(path));
    revised = original.source.replace('A single canonical spelling', 'One container-reviewed spelling');
    await request('/api/recovery', { draft: { kind: 'source', path, before: original.source, beforeContext: original.context, beforeMetadata: JSON.stringify(original.context, null, 2), source: revised, metadata: JSON.stringify(original.context, null, 2) } });
    proposal = await request('/api/change', { path, before: original.source, beforeContext: original.context, sourceBasis: original.workspace.sourceBasis.id, operation: { kind: 'edit', sourceText: revised, context: original.context } });
    assert.ok(proposal.fileProposal); await request('/api/proposal-review', proposal.fileProposal);
    assert.equal(await readFile(join(project, path), 'utf8'), original.source);
  });
  await check('graceful container restart restores durable changes and explicit apply writes mounted project', async () => {
    await docker(['restart', '--timeout', '10', container]); await ready();
    const recovered = await request('/api/recovery'); assert.equal(recovered.draft.source, revised); assert.deepEqual(recovered.proposal, proposal.fileProposal);
    await request('/api/proposal-review', recovered.proposal);
    assert.equal((await request('/api/apply', recovered.proposal)).status, 'completed');
    assert.equal(await readFile(join(project, path), 'utf8'), revised);
    assert.equal(JSON.parse(await cli(['reconcile', '/project', '--json'])).mode, 'reconciliation');
  });
  await check('forwarded browser selection preview and explicit mounted site export', async () => {
    const workspace = await request('/api/workspace');
    const preview = await request('/api/export-preview', { sourceBasis: workspace.sourceBasis.id, recordIds: ['behavior.integer-token'] });
    assert.equal(new URL(preview.url).origin, origin);
    assert.equal((await fetch(preview.url)).status, 200);
    await request('/api/export', { previewId: preview.previewId, destination: '/exports/selected-site' });
    const manifest = JSON.parse(await readFile(join(exports, 'selected-site/manifest.json'), 'utf8'));
    assert.deepEqual(manifest.selection.recordIds, ['behavior.integer-token']);
  });
  await check('same MCP adapter runs through Docker exec stdin without TTY', mcp);
  await docker(['stop', '--time', '10', container]); started = false;
  report.status = 'pass';
} catch (error) { report.status = 'fail'; report.error = error.stack; process.exitCode = 1; console.error(error); }
finally {
  if (started) await docker(['rm', '--force', container]).catch(() => {});
  await writeFile(join(run, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`CONTAINER_JOURNEYS ${join(run, 'report.json')}`);
}
