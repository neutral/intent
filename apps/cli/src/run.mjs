// One command run: the arguments parsed, the Library's operation called, and its text and exit code returned.
import path from 'node:path';
import fs from 'node:fs';
import * as L from '../../../library/src/index.mjs';
import { parseArgs, asksHelp } from './args.mjs';
import { BANNER, NO_PROJECT_LINE, HELP, commandHelp, overallHelp } from './help.mjs';

const EXIT = { answer: 0, findings: 1, refused: 2 };
const lines = (list) => list.join('\n') + '\n';
const refusal = (message, instead) => ({ outcome: 'refused', text: lines([`error ARGS ${message}`, instead]) });

/** Each command: its options, how many positional arguments it takes, and the operation it calls. */
const COMMANDS = {
  fetch: { options: { base: 'one', more: 'one' }, run: (cwd, a, o) => L.fetch({ cwd, args: a, base: o.base, more: o.more }) },
  search: { options: { more: 'one' }, min: 1, run: (cwd, a, o) => L.search({ cwd, words: a, more: o.more }) },
  read: { options: {}, min: 1, run: (cwd, a) => L.read({ cwd, ids: a }) },
  checks: { options: { base: 'one', judge: 'one' }, run: (cwd, a, o) => L.checks({ cwd, paths: a, base: o.base, judge: o.judge }) },
  report: { options: {}, max: 1, run: (cwd, a) => L.report({ cwd, form: a[0] }) },
  start: { options: { 'code-root': 'many' }, max: 0, run: (cwd, a, o) => L.start({ cwd, codeRoot: o['code-root'] ?? [] }) },
  create: { options: {}, min: 1, run: (cwd, a) => (a[0] === 'description'
    ? (a.length === 2 ? L.create({ cwd, layer: 'description', path: a[1] }) : refusal('create description takes exactly one PATH', 'Run intent create description PATH.'))
    : L.create({ cwd, layer: a[0], title: a.slice(1).join(' ') })) },
  validate: { options: {}, max: 0, run: (cwd) => L.validate({ cwd }) },
  review: { options: { base: 'one' }, max: 0, run: (cwd, a, o) => L.review({ cwd, base: o.base }) },
  gaps: { options: {}, max: 0, run: (cwd) => L.gaps({ cwd }) },
  drift: { options: {}, run: (cwd, a) => L.drift({ cwd, ids: a }) },
  stamp: { options: {}, min: 1, run: (cwd, a) => L.stamp({ cwd, ids: a }) },
  follow: { options: {}, max: 0, run: (cwd) => L.follow({ cwd }) },
  reports: { options: { check: 'one', record: 'one', path: 'one', since: 'one' }, max: 0,
    run: (cwd, a, o) => L.reports({ cwd, check: o.check, record: o.record, path: o.path, since: o.since }) },
  adopt: { options: { applies: 'many' }, min: 1, max: 1, run: (cwd, a, o) => L.adopt({ cwd, dir: a[0], applies: o.applies ?? [] }) },
  guide: { options: {}, max: 1, run: (cwd, a) => L.guide({ topic: a[0] }) },
  mcp: { options: {}, max: 1, run: (cwd, a, o, io) => mcp(cwd, a[0], io) },
  portal: { options: { port: 'one', base: 'one', export: 'one' }, max: 1, run: (cwd, a, o, io) => portal(cwd, a[0], o, io) },
};

/**
 * The portal of the project found from DIR: served on 127.0.0.1 until `io.signal` aborts, its address written to
 * `io.output` as soon as it listens; or, with `--export OUT`, written into OUT.
 */
async function portal(cwd, dir, o, io) {
  const at = path.resolve(cwd, dir ?? '.');
  let folder = false;
  try { folder = fs.statSync(at).isDirectory(); } catch { folder = false; }
  if (!folder) return refusal(`${dir} is not a folder`, 'Give intent portal the folder the project is found from, or none for the working directory.');
  if (o.export !== undefined && (o.port !== undefined || o.base !== undefined)) {
    return refusal(`--${o.port !== undefined ? 'port' : 'base'} is not taken with --export`, 'Run intent portal --export OUT [DIR] alone to write the portal as files.');
  }
  let port = 0;
  if (o.port !== undefined) {
    if (!/^\d{1,5}$/.test(o.port) || Number(o.port) > 65535) return refusal(`--port ${o.port} is not a whole number from 0 to 65535`, 'Give --port a free port, or 0, or none for a free one.');
    port = Number(o.port);
  }
  const root = L.findRoot(at);
  if (!root) return { outcome: 'refused', text: lines([`error NO_PROJECT no intent/intent.json in ${at} or above it`, 'Run intent start in the project root to create intent/, or run this command inside a project.']) };
  if (o.export !== undefined) {
    const { exportPortal } = await import('../../portal/src/export.mjs');
    const r = exportPortal(root, path.resolve(cwd, o.export));
    if (r.refusal) return { outcome: 'refused', text: lines([`error ${r.refusal.code} ${r.refusal.message}`, r.refusal.instead]) };
    return { outcome: 'answer', text: lines([`Wrote the portal of ${r.name} to ${o.export}: ${r.pages} ${r.pages === 1 ? 'page' : 'pages'}.`]) };
  }
  const { startPortal } = await import('../../portal/src/server.mjs');
  let p;
  try { p = await startPortal(root, { port, base: o.base }); } catch (error) {
    if (error.code === 'PORT_IN_USE') return { outcome: 'refused', text: lines([`error PORT_IN_USE port ${port} is in use`, 'Give intent portal another --port, or none for a free one.']) };
    throw error;
  }
  const name = L.readProjectFile(root).project.name;
  (io.output ?? process.stdout).write(lines([`The portal of ${name} is at ${p.url}`, 'It reads the files at each request and writes nothing. Stop it with Ctrl-C.']));
  await new Promise((resolve) => {
    if (!io.signal) return;
    if (io.signal.aborted) resolve(); else io.signal.addEventListener('abort', resolve, { once: true });
  });
  await p.close();
  return { outcome: 'answer', text: '' };
}

/** The MCP server, over `io.input` and `io.output`, for the project found from DIR; it answers when its input ends. */
async function mcp(cwd, dir, io) {
  const at = path.resolve(cwd, dir ?? '.');
  let folder = false;
  try { folder = fs.statSync(at).isDirectory(); } catch { folder = false; }
  if (!folder) return refusal(`${dir} is not a folder`, 'Give intent mcp the folder the server starts in, or none for the working directory.');
  const { serve } = await import('../../mcp/src/server.mjs');
  await serve({ folder: at, run: runCommand, input: io.input ?? process.stdin, output: io.output ?? process.stdout });
  return { outcome: 'answer', text: '' };
}

/**
 * Run one command. `argv` is the arguments after `intent`; `cwd` is the start folder.
 * Resolves to {exitCode, text}, where `text` is exactly what the command prints.
 * `intent mcp` serves over `input` and `output`, standard input and output when absent, and prints nothing more.
 * `intent portal` writes its address to `output` as soon as it listens, and serves until `signal` aborts.
 */
export async function runCommand(argv, { cwd, input, output, signal }) {
  const r = await dispatch(argv, cwd, { input, output, signal });
  return { exitCode: EXIT[r.outcome], text: r.text };
}

function dispatch(argv, cwd, io) {
  if (!argv.length) {
    return { outcome: 'answer', text: lines([...BANNER, ...(L.findRoot(cwd) ? [] : [NO_PROJECT_LINE])]) };
  }
  const [name, ...rest] = argv;
  if (name === '--help') return { outcome: 'answer', text: lines(overallHelp()) };
  const cmd = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : null;
  if (!cmd) return refusal(`${name} is not a command`, 'Run intent --help for the commands.');
  if (asksHelp(rest)) return { outcome: 'answer', text: lines(commandHelp(name)) };
  const p = parseArgs(rest, cmd.options);
  const instead = `Run intent ${name} --help for its arguments and options.`;
  if (p.error) return refusal(p.error, instead);
  const n = p.positional.length;
  if (cmd.min !== undefined && n < cmd.min) return refusal(`${name} takes ${cmd.min === cmd.max ? 'exactly' : 'at least'} ${cmd.min} argument${cmd.min > 1 ? 's' : ''}; ${HELP[name].synopsis}`, instead);
  if (cmd.max !== undefined && n > cmd.max) return refusal(`${name} takes ${cmd.max ? `at most ${cmd.max} argument` : 'no argument'}; ${HELP[name].synopsis}`, instead);
  return cmd.run(cwd, p.positional, p.options, io);
}
