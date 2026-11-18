// The MCP server's tools: one per command, with schemas built from the options, each call returning exactly what its command prints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../../apps/cli/src/run.mjs';
import { HELP } from '../../apps/cli/src/help.mjs';
import { copyFixture, git, repo, readText } from '../support.mjs';
import { server, tinyRepo, textOf } from './client.mjs';

const T = { timeout: 60000 };
const command = (cwd, ...argv) => runCommand(argv, { cwd });
const S = { type: 'string' };
const A = { type: 'array', items: { type: 'string' } };
const A1 = { type: 'array', items: { type: 'string' }, minItems: 1 };
const schema = (properties, required) => ({ type: 'object', properties, additionalProperties: false, ...(required ? { required } : {}) });

/** The tools as the commands contract lists them. */
const EXPECTED = {
  fetch: [schema({ args: A, base: S, more: S }), 'The intent bearing on paths, IDs or words, or on your change: each record and Check with why it is included, and what nothing covers.'],
  search: [schema({ words: A1, more: S }, ['words']), 'Candidate records and Checks for words, with excerpts; lexical only.'],
  read: [schema({ ids: A1 }, ['ids']), 'Records or Checks, complete, with their relations both ways; for a Check, the question a judge of its strength asks.'],
  checks: [schema({ paths: A, base: S, judge: S }), "The Checks bearing on your change, how each is applied, and a report form to fill; with `judge`, one Check's material for a judge other than you."],
  report: [schema({ form: S }), 'Check a filled report form against its rules and the change, and keep it, or say why not.'],
  start: [schema({ codeRoot: A }), 'Create intent/ in this folder, and list the code nobody explains.'],
  create: [schema({ layer: S, title: S, path: S }, ['layer']),
    "Create a record with its ID and its layer's skeleton: a title for a Behavior, Assurance or Blueprint, a path for a Description."],
  validate: [schema({}), 'Everything code can check in intent, each finding with its code, file and line.'],
  review: [schema({ base: S }), 'What changed in intent since BASE, record by record and section by section, and what it affects.'],
  gaps: [schema({}), 'Code nobody explains, Behaviors and Assurances with no Check, Checks nothing applies, and Descriptions that relate to nothing.'],
  drift: [schema({ ids: A }), 'What changed under each record since it was last read against its sources.'],
  stamp: [schema({ ids: A1 }, ['ids']), 'Record that each record was reread against its sources as they are now; nothing checks the reread.'],
  follow: [schema({}), 'Move Descriptions after code moves and update covered paths, from git.'],
  reports: [schema({ check: S, record: S, path: S, since: S }), "The kept reports that match, each as one agent's account, with no totals."],
  adopt: [schema({ dir: S, applies: A }, ['dir']), 'Copy a Pack release as released and record where it applies; on an update, what changed.'],
  guide: [schema({ topic: S }), 'The page on working on intent; with a topic, the page on using it, one page of what agents lean on for a kind of work, the model page or a contract.'],
};

test('tools/list: every command but mcp, in their order, each with its description and the schema built from its arguments and options', T, async (t) => {
  const rpc = server(t, copyFixture('tiny'));
  const listed = (await rpc.request('tools/list')).result;
  assert.deepEqual(Object.keys(listed), ['tools']);
  const names = Object.keys(HELP).filter((name) => name !== 'mcp' && name !== 'portal');
  assert.deepEqual(listed.tools.map((tool) => tool.name), names);
  assert.deepEqual(Object.keys(EXPECTED), names);
  for (const tool of listed.tools) {
    assert.deepEqual(Object.keys(tool), ['name', 'description', 'inputSchema'], tool.name);
    assert.deepEqual(tool.inputSchema, EXPECTED[tool.name][0], tool.name);
    assert.deepEqual(Object.keys(tool.inputSchema), ['type', 'properties', 'additionalProperties', ...(tool.inputSchema.required ? ['required'] : [])], tool.name);
    assert.deepEqual(Object.keys(tool.inputSchema.properties), Object.keys(EXPECTED[tool.name][0].properties), tool.name);
    assert.equal(tool.description, EXPECTED[tool.name][1], tool.name);
  }
  assert.equal((await rpc.close()).code, 0);
});

/** Each read tool's call, and the command line it mirrors. */
const READS = [
  ['fetch', {}, ['fetch']],
  ['fetch', { args: ['src/scheduler/queue.js'] }, ['fetch', 'src/scheduler/queue.js']],
  ['fetch', { args: ['snooze', 'behavior:reminder-fires-time-once-even'] }, ['fetch', 'snooze', 'behavior:reminder-fires-time-once-even']],
  ['fetch', { args: ['lost reminders'] }, ['fetch', 'lost reminders']],
  ['fetch', { base: 'HEAD' }, ['fetch', '--base', 'HEAD']],
  ['fetch', { args: ['--help'] }, ['fetch', '--', '--help']],
  ['fetch', { base: '--x' }, ['fetch', '--base=--x']],
  ['search', { words: ['reminder'] }, ['search', 'reminder']],
  ['search', { words: ['reminder', 'lost'] }, ['search', 'reminder', 'lost']],
  ['read', { ids: ['behavior:reminder-fires-time-once-even', 'assurance:reminder-app-accepted-never-lost:survives-kill'] },
    ['read', 'behavior:reminder-fires-time-once-even', 'assurance:reminder-app-accepted-never-lost:survives-kill']],
  ['read', { ids: ['behavior:nobody'] }, ['read', 'behavior:nobody']],
  ['checks', { judge: 'behavior:reminder-fires-time-once-even:fires-once' }, ['checks', '--judge', 'behavior:reminder-fires-time-once-even:fires-once']],
  ['validate', {}, ['validate']],
  ['review', {}, ['review']],
  ['review', { base: 'HEAD' }, ['review', '--base', 'HEAD']],
  ['gaps', {}, ['gaps']],
  ['drift', {}, ['drift']],
  ['drift', { ids: ['description:tests.queue-test-js'] }, ['drift', 'description:tests.queue-test-js']],
  ['reports', {}, ['reports']],
  ['reports', { since: '2026-01-01', path: 'src', record: 'behavior:reminder-fires-time-once-even' }, ['reports', '--since', '2026-01-01', '--path', 'src', '--record', 'behavior:reminder-fires-time-once-even']],
  ['guide', {}, ['guide']],
  ['guide', { topic: 'checks' }, ['guide', 'checks']],
  ['guide', { topic: 'spec/records' }, ['guide', 'spec/records']],
];

test('each read tool returns exactly what its command prints, isError only where it would exit 2, and writes nothing', T, async (t) => {
  const dir = tinyRepo();
  const rpc = server(t, dir);
  const status = git(dir, 'status', '--porcelain', '--untracked-files=all');
  const exits = new Set();
  for (const [name, args, argv] of READS) {
    const result = await rpc.call(name, args);
    const r = await command(dir, ...argv);
    exits.add(r.exitCode);
    assert.equal(textOf(result), r.text, argv.join(' '));
    assert.equal(result.isError, r.exitCode === 2, argv.join(' '));
    assert.deepEqual(Object.keys(result), ['content', 'isError']);
  }
  assert.deepEqual([...exits].sort(), [0, 2]);
  assert.equal(git(dir, 'status', '--porcelain', '--untracked-files=all'), status);
  const done = await rpc.close();
  assert.deepEqual([done.code, done.stderr, done.unanswered], [0, '', []]);
});

test('an answer with findings, which the command ends with exit 1, is not an error', T, async (t) => {
  const dir = tinyRepo();
  fs.copyFileSync(path.join(dir, 'intent/behavior/snooze.md'), path.join(dir, 'intent/behavior/snooze-again.md'));
  const rpc = server(t, dir);
  const r = await command(dir, 'validate');
  assert.equal(r.exitCode, 1);
  const result = await rpc.call('validate', {});
  assert.deepEqual([textOf(result), result.isError], [r.text, false]);
  assert.match(r.text, /error ID_DUPLICATE /);
  assert.equal((await rpc.close()).code, 0);
});

test('arguments that do not fit a schema are the ARGS refusal, values the command refuses are its own refusal, and neither writes', T, async (t) => {
  const dir = tinyRepo();
  const rpc = server(t, dir);
  const status = git(dir, 'status', '--porcelain', '--untracked-files=all');
  const args = (name, text) => new RegExp(`^error ARGS ${text}\nRun intent ${name} --help for its arguments and options\\.\n$`);
  // Where the command line has the same mistake, the text is what the command prints.
  const asCommand = [
    ['search', {}, ['search']], ['search', { words: [] }, ['search']], ['search', { more: 'x' }, ['search', '--more', 'x']],
    ['read', {}, ['read']], ['read', { ids: [] }, ['read']], ['stamp', { ids: [] }, ['stamp']],
    ['adopt', {}, ['adopt']], ['adopt', { applies: ['src/**'] }, ['adopt', '--applies', 'src/**']],
    ['create', {}, ['create']], ['create', { layer: 'description' }, ['create', 'description']],
    ['fetch', { base: '' }, ['fetch', '--base=']], ['reports', { since: '' }, ['reports', '--since=']],
  ];
  for (const [name, a, argv] of asCommand) {
    const result = await rpc.call(name, a);
    const r = await command(dir, ...argv);
    assert.equal(r.exitCode, 2, argv.join(' '));
    assert.match(r.text, /^error ARGS /, argv.join(' '));
    assert.deepEqual([textOf(result), result.isError], [r.text, true], JSON.stringify([name, a]));
  }
  // Where it has none, the text is an ARGS refusal of the same form.
  const misfits = [
    ['gaps', { foo: 1 }, 'unknown parameter foo; gaps takes no parameter'],
    ['fetch', { help: true }, 'unknown parameter help; fetch takes args, base, more'],
    ['start', { 'code-root': ['src'] }, 'unknown parameter code-root; start takes codeRoot'],
    ['search', { words: 'reminder' }, 'words must be an array of strings'],
    ['read', { ids: [1] }, 'ids must be an array of strings'],
    ['fetch', { base: 5 }, 'base must be a string'],
    ['fetch', { more: null }, 'more must be a string'],
    ['create', { layer: 'blueprint', path: 'src' }, 'create with layer blueprint takes title and no path'],
    ['create', { layer: 'assurance', title: 'A title', path: 'src' }, 'create with layer assurance takes title and no path'],
    ['create', { layer: 'description', title: 'A title', path: 'src' }, 'create with layer description takes path and no title'],
    ['create', { layer: 'description', title: 'A title' }, 'create with layer description takes path and no title'],
    ['create', { title: 'A title' }, 'create takes layer, with title for behavior, assurance or blueprint and path for description'],
    ['validate', [], 'validate takes its parameters as an object'],
    ['drift', 'description:src', 'drift takes its parameters as an object'],
    ['follow', null, 'follow takes its parameters as an object'],
  ];
  for (const [name, a, message] of misfits) {
    const result = await rpc.call(name, a);
    assert.equal(result.isError, true, JSON.stringify([name, a]));
    assert.match(textOf(result), args(name, message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), JSON.stringify([name, a]));
  }
  // A value the command itself refuses is the command's own refusal, word for word: no schema turns it into ARGS.
  const refusedByCommand = [
    ['create', { layer: 'nope', title: 'A title' }, ['create', 'nope', 'A title'], 'CREATE_LAYER'],
    ['create', { layer: 'nope' }, ['create', 'nope'], 'CREATE_LAYER'],
    ['create', { layer: 'discipline', title: 'Rules' }, ['create', 'discipline', 'Rules'], 'CREATE_LAYER'],
    ['create', { layer: 'discipline', path: 'src' }, ['create', 'discipline', 'src'], 'CREATE_LAYER'],
    ['create', { layer: 'behavior' }, ['create', 'behavior'], 'CREATE_TITLE'],
    ['create', { layer: 'behavior', title: '  ' }, ['create', 'behavior', '  '], 'CREATE_TITLE'],
    ['guide', { topic: 'nope' }, ['guide', 'nope'], 'GUIDE_TOPIC'],
  ];
  for (const [name, a, argv, refusal] of refusedByCommand) {
    const result = await rpc.call(name, a);
    const r = await command(dir, ...argv);
    assert.equal(r.exitCode, 2, argv.join(' '));
    assert.match(r.text, new RegExp(`^error ${refusal} `), argv.join(' '));
    assert.deepEqual([textOf(result), result.isError], [r.text, true], JSON.stringify([name, a]));
  }
  // A call with no arguments at all is a call with none.
  const bare = await rpc.request('tools/call', { name: 'gaps' });
  assert.deepEqual([textOf(bare.result), bare.result.isError], [(await command(dir, 'gaps')).text, false]);
  assert.equal(git(dir, 'status', '--porcelain', '--untracked-files=all'), status);
  const done = await rpc.close();
  assert.deepEqual([done.code, done.stderr, done.unanswered], [0, '', []]);
});

test('the writing tools take their parameters as their commands take arguments and options', T, async (t) => {
  // Each pair of twins: one changed by the tool, one by the command; the texts and the files written agree.
  const files = { 'src/a.js': 'a\n', 'tests/a.test.js': 't\n', 'docs/readme.md': 'd\n' };
  const [byTool, byCommand] = [repo(files), repo(files)];
  const rpc = server(t, byTool);
  const pairs = [
    ['start', { codeRoot: ['src', 'tests'] }, ['start', '--code-root', 'src', '--code-root', 'tests']],
    ['create', { layer: 'behavior', title: 'Adding one  gives the next number' }, ['create', 'behavior', 'Adding', 'one', '', 'gives', 'the', 'next', 'number']],
    ['create', { layer: 'description', path: 'src/a.js' }, ['create', 'description', 'src/a.js']],
    ['stamp', { ids: ['description:src.a-js'] }, ['stamp', 'description:src.a-js']],
    ['validate', {}, ['validate']],
  ];
  for (const [name, args, argv] of pairs) {
    const result = await rpc.call(name, args);
    const r = await command(byCommand, ...argv);
    assert.deepEqual([textOf(result), result.isError], [r.text, r.exitCode === 2], argv.join(' '));
  }
  for (const rel of ['intent/intent.json', 'intent/behavior/adding-one-gives-next-number.md', 'intent/description/src/a.js.md']) {
    assert.equal(readText(byTool, rel), readText(byCommand, rel), rel);
  }
  assert.equal(git(byTool, 'status', '--porcelain', '--untracked-files=all'), git(byCommand, 'status', '--porcelain', '--untracked-files=all'));
  const done = await rpc.close();
  assert.deepEqual([done.code, done.stderr, done.unanswered], [0, '', []]);
});

test('relative paths in a call resolve against the server folder, as a command resolves them against its working directory', T, async (t) => {
  const dir = tinyRepo();
  const src = path.join(dir, 'src');
  const rpc = server(t, src);
  const result = await rpc.call('fetch', { args: ['scheduler/queue.js'] });
  const r = await command(src, 'fetch', 'scheduler/queue.js');
  assert.equal(textOf(result), r.text);
  assert.match(r.text, /\nTook scheduler\/queue\.js as the path src\/scheduler\/queue\.js\.\n/);
  assert.equal((await rpc.close()).code, 0);
});
