// The MCP server's transport and protocol: the handshake, the per-request revision, errors, notifications, order, and where it starts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../../apps/cli/src/run.mjs';
import { commandHelp } from '../../apps/cli/src/help.mjs';
import { copyFixture, tempDir, intent } from '../support.mjs';
import { server, tinyRepo, textOf, VERSION, SUPPORTED, PER_REQUEST, SERVER_META } from './client.mjs';

const T = { timeout: 30000 };
const client = { capabilities: {}, clientInfo: { name: 'test', version: '1' } };
const command = (cwd, ...argv) => runCommand(argv, { cwd });

test('the handshake: initialize answers the revision asked for, or 2025-11-25, with the tools capability, serverInfo and what intent alone prints', T, async (t) => {
  const dir = copyFixture('tiny');
  const rpc = server(t, dir);
  const instructions = (await command(dir)).text;
  for (const [asked, given] of [['2025-11-25', '2025-11-25'], ['2025-06-18', '2025-06-18'], ['2025-03-26', '2025-03-26'], ['2024-11-05', '2024-11-05'], ['2026-07-28', '2025-11-25'], ['2099-01-01', '2025-11-25']]) {
    const answer = await rpc.request('initialize', { protocolVersion: asked, ...client });
    assert.deepEqual(answer, { jsonrpc: '2.0', id: answer.id, result: { protocolVersion: given, capabilities: { tools: {} }, serverInfo: { name: 'intent', version: VERSION }, instructions } }, asked);
  }
  assert.equal(instructions, "Intent holds this project's intent and the Checks derived from it.\nWhile writing code:\n  before   intent fetch <words from your task> <paths you expect to touch>\n  after    intent checks          apply each Check, then fill the form it names\n           intent report <form>\n  how      intent guide using\nEverything else: intent --help\n");
  rpc.notify('notifications/initialized');
  const ping = await rpc.request('ping');
  assert.deepEqual(ping, { jsonrpc: '2.0', id: ping.id, result: {} });
  const listed = await rpc.request('tools/list');
  assert.deepEqual(Object.keys(listed.result), ['tools']);
  const called = await rpc.call('gaps', {});
  assert.deepEqual(Object.keys(called), ['content', 'isError']);
  const done = await rpc.close();
  assert.deepEqual([done.code, done.stderr, done.unanswered], [0, '', []]);
});

test('the server version is the root package.json version', T, async () => {
  const root = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const own = JSON.parse(fs.readFileSync(new URL('../../apps/mcp/package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, root.version);
  assert.deepEqual([own.name, own.version, own.private, own.dependencies], ['@intent/mcp', root.version, true, undefined]);
  const { SERVER_INFO } = await import('../../apps/mcp/src/server.mjs');
  assert.deepEqual(SERVER_INFO, { name: 'intent', version: root.version });
});

test('per request: a request carrying 2026-07-28 is served on its own, every result complete and naming the server', T, async (t) => {
  const dir = copyFixture('tiny');
  const rpc = server(t, dir);
  const instructions = (await command(dir)).text;
  const discover = await rpc.request('server/discover', { _meta: PER_REQUEST });
  assert.deepEqual(discover.result, {
    supportedVersions: SUPPORTED, capabilities: { tools: {} }, instructions, ttlMs: 3600000, cacheScope: 'public', resultType: 'complete', _meta: SERVER_META,
  });
  const handshakeTools = (await rpc.request('tools/list')).result.tools;
  const listed = await rpc.request('tools/list', { _meta: PER_REQUEST });
  assert.deepEqual(listed.result, { tools: handshakeTools, ttlMs: 3600000, cacheScope: 'public', resultType: 'complete', _meta: SERVER_META });
  assert.deepEqual((await rpc.request('ping', { _meta: PER_REQUEST })).result, { resultType: 'complete', _meta: SERVER_META });
  const called = await rpc.call('gaps', {}, PER_REQUEST);
  assert.deepEqual(called, { content: [{ type: 'text', text: (await command(dir, 'gaps')).text }], isError: false, resultType: 'complete', _meta: SERVER_META });
  const refused = await rpc.call('fetch', {}, PER_REQUEST);
  assert.deepEqual(refused, { content: [{ type: 'text', text: (await command(dir, 'fetch')).text }], isError: true, resultType: 'complete', _meta: SERVER_META });
  assert.match(textOf(refused), /^error CHANGE_NO_GIT /);
  const done = await rpc.close();
  assert.deepEqual([done.code, done.stderr, done.unanswered], [0, '', []]);
});

test('per request: no client capabilities is -32602, and a revision the server does not serve is -32022 with what it serves', T, async (t) => {
  const rpc = server(t, copyFixture('tiny'));
  for (const method of ['server/discover', 'tools/list', 'ping']) {
    const lacking = await rpc.request(method, { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } });
    assert.equal(lacking.error.code, -32602, method);
    assert.equal(lacking.result, undefined);
    const unsupported = await rpc.request(method, { _meta: { ...PER_REQUEST, 'io.modelcontextprotocol/protocolVersion': '2099-01-01' } });
    assert.equal(unsupported.error.code, -32022, method);
    assert.deepEqual(unsupported.error.data, { supported: SUPPORTED, requested: '2099-01-01' });
  }
  const lackingCall = await rpc.request('tools/call', { name: 'gaps', arguments: {}, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } });
  assert.equal(lackingCall.error.code, -32602);
  const done = await rpc.close();
  assert.deepEqual([done.code, done.stderr, done.unanswered], [0, '', []]);
});

test('malformed messages are JSON-RPC errors, notifications have no answer, and the server goes on', T, async (t) => {
  const rpc = server(t, copyFixture('tiny'));
  const error = async (bytes) => { const m = await rpc.raw(bytes); assert.equal(m.result, undefined, String(bytes)); return [m.id, m.error.code]; };
  assert.deepEqual(await error('not json\n'), [null, -32700]);
  assert.deepEqual(await error('{"jsonrpc":"2.0","id":1,"method":"ping"\n'), [null, -32700]);
  assert.deepEqual(await error(Buffer.from([0x7b, 0xc3, 0x28, 0x7d, 0x0a])), [null, -32700]);
  assert.deepEqual(await error('[]\n'), [null, -32600]);
  assert.deepEqual(await error('"ping"\n'), [null, -32600]);
  assert.deepEqual(await error('{"jsonrpc":"2.0","id":7}\n'), [7, -32600]);
  assert.deepEqual(await error('{"jsonrpc":"1.0","id":8,"method":"ping"}\n'), [8, -32600]);
  assert.deepEqual(await error('{"id":9,"method":"ping"}\n'), [9, -32600]);
  assert.deepEqual(await error('{"jsonrpc":"2.0","id":{},"method":"ping"}\n'), [null, -32600]);
  assert.deepEqual(await error('{"jsonrpc":"2.0","id":10,"method":42}\n'), [10, -32600]);
  assert.deepEqual(await error('{"jsonrpc":"2.0","id":11,"method":"resources/list"}\n'), [11, -32601]);
  assert.deepEqual(await error('{"jsonrpc":"2.0","id":12,"method":"server/discover"}\n'), [12, -32601]);
  assert.deepEqual(await error('{"jsonrpc":"2.0","id":13,"method":"tools/call","params":{"name":"nope","arguments":{}}}\n'), [13, -32602]);
  assert.deepEqual(await error('{"jsonrpc":"2.0","id":14,"method":"tools/call","params":{"name":"mcp","arguments":{}}}\n'), [14, -32602]);
  assert.deepEqual(await error('{"jsonrpc":"2.0","id":15,"method":"tools/call","params":{"arguments":{}}}\n'), [15, -32602]);
  assert.deepEqual(await error('{"jsonrpc":"2.0","id":"s","method":"tools/call","params":[]}\n'), ['s', -32602]);
  // Notifications, known or not, and blank lines have no answer: the next answer is the ping's.
  rpc.notify('notifications/initialized');
  rpc.notify('notifications/nothing-known', { x: 1 });
  rpc.notify('tools/call', { name: 'gaps', arguments: {} });
  rpc.write('\n  \n');
  const ping = await rpc.request('ping');
  assert.deepEqual(ping.result, {});
  // The last message, with no LF before the input ends, is still answered.
  rpc.write('{"jsonrpc":"2.0","id":"last","method":"ping"}');
  const last = rpc.next();
  const done = await rpc.close();
  assert.deepEqual(await last, { jsonrpc: '2.0', id: 'last', result: {} });
  assert.deepEqual([done.code, done.stderr, done.unanswered], [0, '', []]);
});

test('requests are answered one at a time, in the order they arrive', T, async (t) => {
  const dir = tinyRepo();
  const rpc = server(t, dir);
  const answers = [rpc.request('tools/call', { name: 'gaps', arguments: {} }), rpc.request('ping'), rpc.request('tools/call', { name: 'guide', arguments: {} }),
    rpc.request('tools/list'), rpc.request('tools/call', { name: 'drift', arguments: {} })];
  const got = await Promise.all(answers);
  assert.deepEqual(got.map((a) => a.id), [1, 2, 3, 4, 5]);
  assert.equal(textOf(got[0].result), (await command(dir, 'gaps')).text);
  assert.equal(textOf(got[2].result), (await command(dir, 'guide')).text);
  assert.equal(textOf(got[4].result), (await command(dir, 'drift')).text);
  const done = await rpc.close();
  assert.deepEqual([done.code, done.stderr, done.unanswered], [0, '', []]);
});

test('intent mcp refuses a DIR that is not a folder, takes --help, and serves the project found from DIR or the folder it starts in', T, async (t) => {
  const cwd = tempDir();
  fs.writeFileSync(path.join(cwd, 'file'), 'x\n');
  for (const dir of ['missing', 'file']) {
    const p = intent(cwd, 'mcp', dir);
    assert.deepEqual([p.code, p.out, p.err], [2, (await command(cwd, 'mcp', dir)).text, ''], dir);
    assert.match(p.out, new RegExp(`^error ARGS ${dir} is not a folder\n.+\n$`));
  }
  const help = intent(cwd, 'mcp', '--help');
  assert.deepEqual([help.code, help.out], [0, commandHelp('mcp').join('\n') + '\n']);
  const dir = tinyRepo();
  const inside = path.join(dir, 'src/scheduler');
  for (const [where, args] of [[cwd, [inside]], [cwd, [path.relative(cwd, inside)]], [inside, []]]) {
    const rpc = server(t, where, ...args);
    const r = await rpc.call('gaps', {});
    assert.equal(textOf(r), (await command(inside, 'gaps')).text);
    assert.equal(r.isError, false);
    const done = await rpc.close();
    assert.deepEqual([done.code, done.stderr, done.unanswered], [0, '', []]);
  }
});

test('with no project, the instructions say so and each call that needs one is refused; a project made later is served', T, async (t) => {
  const dir = path.join(tempDir(), 'app');
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/a.js'), 'a\n');
  const rpc = server(t, dir);
  const before = await rpc.request('initialize', { protocolVersion: '2025-11-25', ...client });
  assert.match(before.result.instructions, /\nNo intent\/ here or above: intent start creates it\.\n$/);
  const refused = await rpc.call('gaps', {});
  assert.equal(refused.isError, true);
  assert.match(textOf(refused), /^error NO_PROJECT /);
  const guide = await rpc.call('guide', { topic: 'checks' });
  assert.equal(guide.isError, false);
  const started = await rpc.call('start', {});
  assert.equal(started.isError, false);
  assert.ok(fs.existsSync(path.join(dir, 'intent/intent.json')));
  const gaps = await rpc.call('gaps', {});
  assert.deepEqual([gaps.isError, textOf(gaps)], [false, (await command(dir, 'gaps')).text]);
  const after = await rpc.request('initialize', { protocolVersion: '2025-11-25', ...client });
  assert.equal(after.result.instructions, (await command(dir)).text);
  assert.doesNotMatch(after.result.instructions, /No intent/);
  const done = await rpc.close();
  assert.deepEqual([done.code, done.stderr, done.unanswered], [0, '', []]);
});

test('a request with no revision in its _meta is served the handshake way, whether or not initialize came first', T, async (t) => {
  const rpc = server(t, copyFixture('tiny'));
  const listed = await rpc.request('tools/list');
  assert.deepEqual(Object.keys(listed.result), ['tools']);
  const called = await rpc.call('guide', { topic: 'checks' });
  assert.deepEqual(Object.keys(called), ['content', 'isError']);
  assert.equal(textOf(called), (await command(tempDir(), 'guide', 'checks')).text);
  const done = await rpc.close();
  assert.deepEqual([done.code, done.stderr, done.unanswered], [0, '', []]);
});

test('a failure of the server itself while answering is -32603, said on standard error, and the server goes on', T, async () => {
  const { serve } = await import('../../apps/mcp/src/server.mjs');
  const { PassThrough } = await import('node:stream');
  const input = new PassThrough(), output = new PassThrough(), errors = new PassThrough();
  let said = '', written = '';
  errors.on('data', (b) => { said += b; });
  output.on('data', (b) => { written += b; });
  const run = async (argv) => { if (argv[0] === 'gaps') throw new Error('broken on purpose'); return { exitCode: 0, text: 'ok\n' }; };
  const done = serve({ folder: tempDir(), run, input, output, errors });
  input.write('{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"gaps","arguments":{}}}\n');
  input.end('{"jsonrpc":"2.0","id":2,"method":"ping"}\n');
  await done;
  const answers = written.trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(answers, [{ jsonrpc: '2.0', id: 1, error: { code: -32603, message: 'Internal error' } }, { jsonrpc: '2.0', id: 2, result: {} }]);
  assert.match(said, /^intent mcp: Error: broken on purpose\n/);
});
