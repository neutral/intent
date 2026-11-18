// The MCP server: JSON-RPC 2.0 over standard input and output, one message per line, each tool call one command run.
import fs from 'node:fs';
import { TOOLS, isTool, commandLine } from './tools.mjs';

/** The protocol revisions served, newest first: the first per request, the others with a handshake. */
export const SUPPORTED = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const PER_REQUEST = SUPPORTED[0];
const HANDSHAKE = SUPPORTED.slice(1);
const META_VERSION = 'io.modelcontextprotocol/protocolVersion';
const META_CAPABILITIES = 'io.modelcontextprotocol/clientCapabilities';
const META_SERVER = 'io.modelcontextprotocol/serverInfo';
const CACHE = { ttlMs: 3600000, cacheScope: 'public' };

/** The package version: the root package.json's, or this package's own. */
function packageVersion() {
  for (const file of ['../../../package.json', '../package.json']) {
    try {
      const { version } = JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
      if (typeof version === 'string' && version) return version;
    } catch { /* the next file */ }
  }
  return '0.0.0';
}

export const SERVER_INFO = { name: 'intent', version: packageVersion() };

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isId = (v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
class RpcError extends Error {
  constructor(code, message, data) { super(message); this.code = code; this.data = data; }
}

/**
 * Serve over `input` and `output` until `input` ends, answering each request
 * in turn. `run(argv, {cwd})` is the command line, resolving to
 * {exitCode, text}; every call runs it in `folder`, and nothing is kept
 * between calls. Resolves when the last answer is written.
 */
export function serve({ folder, run, input = process.stdin, output = process.stdout, errors = process.stderr }) {
  const queue = [];
  let chunks = [], ended = false, working = false, closed = false, finish;
  const done = new Promise((resolve) => { finish = resolve; });

  const write = (message) => new Promise((resolve) => {
    if (closed || output.destroyed || output.writableEnded) { resolve(); return; }
    if (output.write(JSON.stringify(message) + '\n')) resolve();
    else output.once('drain', resolve);
  });

  async function work() {
    if (working) return;
    working = true;
    while (queue.length && !closed) {
      const reply = await answer(queue.shift());
      if (reply) await write(reply);
    }
    working = false;
    if (ended || closed) { input.removeListener('data', onData); finish(); }
  }

  /** The answer to one line, or null for a notification. */
  async function answer(bytes) {
    let message;
    try { message = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { return failure(null, new RpcError(-32700, 'Parse error: the message is not JSON')); }
    const request = isObject(message) && message.jsonrpc === '2.0' && typeof message.method === 'string';
    if (request && !Object.hasOwn(message, 'id')) return null;
    if (!request || !isId(message.id)) {
      return failure(isObject(message) && isId(message.id) ? message.id : null, new RpcError(-32600, 'Invalid request: expected a JSON-RPC 2.0 request'));
    }
    try { return { jsonrpc: '2.0', id: message.id, result: await method(message) }; }
    catch (error) {
      if (error instanceof RpcError) return failure(message.id, error);
      errors.write(`intent mcp: ${error?.stack ?? error}\n`);
      return failure(message.id, new RpcError(-32603, 'Internal error'));
    }
  }

  const failure = (id, error) => ({ jsonrpc: '2.0', id, error: { code: error.code, message: error.message, ...(error.data === undefined ? {} : { data: error.data }) } });

  /** One request's result, by the revision it is served by. */
  async function method({ method: name, params = {} }) {
    if (!isObject(params)) throw new RpcError(-32602, 'Invalid params: params must be an object');
    const meta = isObject(params._meta) ? params._meta : {};
    const perRequest = Object.hasOwn(meta, META_VERSION);
    if (perRequest) {
      const requested = meta[META_VERSION];
      if (!SUPPORTED.includes(requested)) throw new RpcError(-32022, 'Unsupported protocol version', { supported: SUPPORTED, requested });
      if (!isObject(meta[META_CAPABILITIES])) throw new RpcError(-32602, `Invalid params: _meta must hold ${META_CAPABILITIES}`);
    }
    const current = perRequest && meta[META_VERSION] === PER_REQUEST;
    const complete = (result, extra = {}) => (current ? { ...result, ...extra, resultType: 'complete', _meta: { [META_SERVER]: SERVER_INFO } } : result);

    if (name === 'initialize' && !current) {
      const asked = params.protocolVersion;
      return { protocolVersion: HANDSHAKE.includes(asked) ? asked : HANDSHAKE[0], capabilities: { tools: {} }, serverInfo: SERVER_INFO, instructions: await instructions() };
    }
    if (name === 'server/discover' && current) {
      return complete({ supportedVersions: SUPPORTED, capabilities: { tools: {} }, instructions: await instructions() }, CACHE);
    }
    if (name === 'ping') return complete({});
    if (name === 'tools/list') return complete({ tools: TOOLS }, current ? CACHE : {});
    if (name === 'tools/call') {
      if (typeof params.name !== 'string') throw new RpcError(-32602, 'Invalid params: tools/call needs the name of a tool');
      if (!isTool(params.name)) throw new RpcError(-32602, `Unknown tool: ${params.name}`);
      return complete(await call(params.name, params.arguments));
    }
    throw new RpcError(-32601, `Method not found: ${name}`);
  }

  /** What `intent` alone prints in the server's folder. */
  const instructions = async () => (await run([], { cwd: folder })).text;

  /** One tool call: the command's text, and isError when the command would exit 2. */
  async function call(name, args) {
    const line = commandLine(name, args === undefined ? {} : args);
    if (line.text) return { content: [{ type: 'text', text: line.text }], isError: true };
    const { exitCode, text } = await run(line.argv, { cwd: folder });
    return { content: [{ type: 'text', text }], isError: exitCode === 2 };
  }

  /** Split the input into lines; a blank line is no message. */
  function take(final) {
    let buffer = Buffer.concat(chunks), newline;
    while ((newline = buffer.indexOf(10)) >= 0) {
      const line = buffer.subarray(0, newline);
      buffer = buffer.subarray(newline + 1);
      if (line.toString('latin1').trim()) queue.push(line);
    }
    if (final && buffer.toString('latin1').trim()) { queue.push(buffer); buffer = Buffer.alloc(0); }
    chunks = buffer.length ? [buffer] : [];
    void work();
  }
  function onData(chunk) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); take(false); }
  function onEnd() { if (ended) return; ended = true; take(true); }

  input.on('data', onData);
  input.once('end', onEnd);
  input.once('error', (error) => { errors.write(`intent mcp: ${error.message}\n`); onEnd(); });
  output.once('error', (error) => { errors.write(`intent mcp: ${error.message}\n`); closed = true; input.destroy?.(); finish(); });
  return done;
}
