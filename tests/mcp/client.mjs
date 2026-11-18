// A client for the MCP server tests: `intent mcp` spawned as a program, spoken to in JSON-RPC lines over its standard input and output.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CLI, REPO, copyFixture, git } from '../support.mjs';

export const VERSION = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;
export const SUPPORTED = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export const PER_REQUEST = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
};
export const SERVER_META = { 'io.modelcontextprotocol/serverInfo': { name: 'intent', version: VERSION } };

/** A copy of the tiny fixture project, committed on main in a new git repository. */
export function tinyRepo() {
  const dir = copyFixture('tiny');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'first');
  return dir;
}

/**
 * Start `intent mcp` with `args` in `cwd`. Every line it writes must be JSON;
 * the answers are taken in the order they come, as the server answers in the
 * order it is asked.
 */
export function server(t, cwd, ...args) {
  const child = spawn(process.execPath, [CLI, 'mcp', ...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  const backlog = [], waiting = [];
  let buffer = '', stderr = '', id = 0;
  const exit = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (text) => { stderr += text; });
  child.stdout.on('data', (text) => {
    buffer += text;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const message = JSON.parse(line);
      if (waiting.length) waiting.shift()(message);
      else backlog.push(message);
    }
  });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const next = () => (backlog.length ? Promise.resolve(backlog.shift()) : new Promise((resolve) => waiting.push(resolve)));
  const raw = (bytes) => { child.stdin.write(bytes); return next(); };
  return {
    /** Send one request and take its answer. */
    request(method, params) {
      const message = { jsonrpc: '2.0', id: ++id, method, ...(params === undefined ? {} : { params }) };
      return raw(JSON.stringify(message) + '\n');
    },
    /** Send a notification, which has no answer. */
    notify(method, params) { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) }) + '\n'); },
    /** Write bytes as they are and take the next answer. */
    raw,
    write: (bytes) => child.stdin.write(bytes),
    next,
    /** Call a tool and take its result. */
    async call(name, args, meta) {
      const answer = await this.request('tools/call', { name, ...(args === undefined ? {} : { arguments: args }), ...(meta ? { _meta: meta } : {}) });
      if (!answer.result) throw new Error(`tools/call ${name}: ${JSON.stringify(answer)}`);
      return answer.result;
    },
    /** End the input; resolves to {code, signal, stderr, unanswered}, where unanswered holds any message nobody took. */
    async close() {
      child.stdin.end();
      const r = await exit;
      return { ...r, stderr, unanswered: backlog.splice(0) };
    },
  };
}

/** The text of a tool result. */
export const textOf = (result) => {
  if (result.content.length !== 1 || result.content[0].type !== 'text') throw new Error(`not one text: ${JSON.stringify(result)}`);
  return result.content[0].text;
};
