// The Library's operations on copies of the fixture projects, outside git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as I from '../../library/src/index.mjs';
import { copyFixture, tempDir, write, readText, record, FIXTURES } from '../support.mjs';

test('every operation but Start and Guide refuses with NO_PROJECT outside a project', () => {
  const cwd = tempDir();
  for (const op of [I.fetch, I.search, I.read, I.checks, I.report, I.create, I.validate, I.review, I.gaps, I.drift, I.stamp, I.follow, I.reports, I.adopt]) {
    const r = op({ cwd, words: ['x'], ids: ['behavior:x'], layer: 'behavior', title: 'x', dir: '.' });
    assert.equal(r.outcome, 'refused', op.name);
    assert.match(r.text, /^error NO_PROJECT /, op.name);
  }
});

test('fetch takes paths, IDs and words, and closes with its limits', () => {
  const cwd = copyFixture('tiny');
  const r = I.fetch({ cwd, args: ['src/notify', 'behavior:nothing-here', 'snooze', 'the', 'src/new/x.js'] });
  assert.equal(r.outcome, 'answer');
  const lines = r.text.split('\n');
  assert.match(lines[0], /^\d+ records, \d+ Checks bear on what you gave\.$/);
  assert.equal(lines[1], 'Took src/notify as a path; src/new/x.js as a path, which does not exist yet; behavior:nothing-here as an ID; "snooze" "the" as words.');
  for (const item of ['  nothing explains src/notify', '  no record or Check has the ID behavior:nothing-here', '  "the" is too common a word to search',
    '  nothing explains src/new/x.js, which does not exist yet', '  code contents']) assert.ok(lines.includes(item), item);
  assert.ok(r.text.endsWith('\n'));
});

test('fetch from a folder inside the project resolves paths from there, and lists paths outside the project', () => {
  const cwd = copyFixture('tiny');
  const r = I.fetch({ cwd: path.join(cwd, 'src'), args: ['scheduler/queue.js', '..', '/'] });
  assert.match(r.text, /Took scheduler\/queue\.js as the path src\/scheduler\/queue\.js; \.\. as the path \./);
  assert.match(r.text, /Outside the project:\n {2}\/\n/);
});

test('search ranks candidates and gives excerpts', () => {
  const cwd = copyFixture('tiny');
  const r = I.search({ cwd, words: ['snooze'] });
  assert.match(r.text, /^1 candidate for "snooze"\.\n\nCandidates:\n/);
  assert.match(r.text, /\n\nRead one with intent read <id>, or fetch what bears on it with intent fetch <id>\.\n\nNot searched:\n/);
  // No candidate: nothing to read next.
  assert.match(I.search({ cwd, words: ['zzzz'] }).text, /^0 candidates for "zzzz"\.\n\nNot covered:\n {2}the word "zzzz" matched nothing\nNot searched:\n/);
  assert.match(r.text, /Candidates:\n {2}behavior:snooze-delays-reminder-ten {2}Snooze delays a reminder by ten minutes {2}\(intent\/behavior\/snooze\.md\)\n/);
  assert.equal(I.search({ cwd, words: [] }).outcome, 'refused');
});

test('read prints records and Checks complete, and lists IDs that name nothing', () => {
  const cwd = copyFixture('tiny');
  const r = I.read({ cwd, ids: ['assurance:reminder-app-accepted-never-lost', 'behavior:none:here', 'behavior:snooze-delays-reminder-ten'] });
  assert.match(r.text, /^2 records and 0 Checks, each complete/);
  assert.match(r.text, /Related from:\n {2}behavior:reminder-fires-time-once-even bounded by it /);
  assert.match(r.text, /Not covered:\n {2}no record or Check has the ID behavior:none:here\n/);
  assert.equal(I.read({ cwd, ids: ['src/index.js'] }).outcome, 'refused');
});

test('validate, gaps and drift on the broken project answer what they can', () => {
  const cwd = copyFixture('broken');
  const v = I.validate({ cwd });
  assert.equal(v.outcome, 'findings');
  assert.match(v.text, /^13 records, \d+ Checks; \d+ errors, 7 warnings\.\n/);
  assert.match(v.text, /\nintent\/discipline\/orphan\/: error PACK_NOT_ADOPTED /);
  const g = I.gaps({ cwd });
  assert.equal(g.outcome, 'answer');
  assert.match(g.text, /\nCode nobody explains:\n {2}src\/lib\/util\.js {2}intent create description src\/lib\/util\.js\n/);
  assert.match(g.text, /\nCould not read:\n/);
  assert.equal(I.drift({ cwd }).outcome, 'answer');
  assert.equal(I.fetch({ cwd, args: ['src/app.js'] }).outcome, 'answer');
});

test('stamp writes the stamp, then finds it unchanged; it refuses Checks, Disciplines and records with no sources', () => {
  const cwd = copyFixture('tiny');
  const id = 'description:tests.queue-test-js';
  const r = I.stamp({ cwd, ids: [id] });
  assert.equal(r.outcome, 'answer');
  assert.match(r.text, /^Wrote intent\/description\/tests\/queue\.test\.js\.md, section Read against:\n {2}- tests\/queue\.test\.js sha256:[0-9a-f]{16}\n/);
  assert.match(I.stamp({ cwd, ids: [id] }).text, /unchanged: its stamp already matches its sources\./);
  assert.equal(I.drift({ cwd, ids: [id] }).text, 'Sources changed under 0 records; never stamped: 0; unchanged: 1.\n\nNot checked:\n  whether the reread a stamp records happened\n');
  const no = I.stamp({ cwd, ids: ['behavior:snooze-delays-reminder-ten', 'discipline:js-async.timers-within-range', 'behavior:x:y', 'behavior:gone', 'bad id'] });
  assert.equal(no.outcome, 'refused');
  assert.deepEqual(no.text.split('\n').slice(0, 5).map((l) => l.split(' ')[1]), ['STAMP_NO_SOURCES', 'STAMP_DISCIPLINE', 'STAMP_NOT_RECORD', 'ID_UNKNOWN', 'ARGS']);
});

test('drift lists a Check ID as no record, with the record holding it', () => {
  const cwd = copyFixture('tiny');
  const r = I.drift({ cwd, ids: ['behavior:reminder-fires-time-once-even:fires-once'] });
  assert.match(r.text, /Not covered:\n {2}no record has the ID behavior:reminder-fires-time-once-even:fires-once: it is a Check of behavior:reminder-fires-time-once-even/);
});

test('create places a record with its skeleton and a free ID, and refuses what it must not create', () => {
  const cwd = copyFixture('tiny');
  const a = I.create({ cwd, layer: 'behavior', title: 'Snooze delays a reminder by ten minutes' });
  assert.match(a.text, /^Created intent\/behavior\/snooze-delays-reminder-ten-2\.md with the ID behavior:snooze-delays-reminder-ten-2\.\n/);
  assert.equal(readText(cwd, 'intent/behavior/snooze-delays-reminder-ten-2.md'),
    '---\n{"id":"behavior:snooze-delays-reminder-ten-2"}\n---\n# Snooze delays a reminder by ten minutes\n\n## Outcome\n\n## Edge cases\n\n## Relations\n');
  const d = I.create({ cwd, layer: 'description', path: 'src/notify' });
  assert.match(d.text, /^Created intent\/description\/src\/notify\/README\.md with the ID description:src\.notify\./);
  const code = (r) => r.text.split(' ')[1];
  assert.equal(code(I.create({ cwd, layer: 'discipline', title: 'x' })), 'CREATE_LAYER');
  assert.equal(code(I.create({ cwd, layer: 'blueprint', title: '  ' })), 'CREATE_TITLE');
  assert.equal(code(I.create({ cwd, layer: 'description', path: 'src/missing.js' })), 'CREATE_PATH');
  assert.equal(code(I.create({ cwd, layer: 'description', path: 'intent/behavior' })), 'CREATE_PATH');
  assert.equal(code(I.create({ cwd, layer: 'description', path: 'src/scheduler/queue.js' })), 'CREATE_PLACE_TAKEN');
  assert.equal(I.validate({ cwd }).outcome, 'findings');
});

test('start creates intent/ once, with the code nobody explains', () => {
  const cwd = path.join(tempDir(), 'proj');
  write(cwd, { 'src/a.js': 'a', 'src/b.js': 'b', 'README.md': 'r', 'intent/.gitignore': '/.index/' });
  const r = I.start({ cwd, codeRoot: ['src', 'src'] });
  assert.match(r.text, /^Created intent\/ for proj\.\nWrote:\n {2}intent\/intent\.json\n/);
  assert.match(r.text, /\n {2}intent\/\.gitignore\n {2}intent\/\.index\/\nCode nobody explains:\n/);
  assert.match(r.text, /Code nobody explains:\n {2}src\/ \(2 files\) {2}each needs its own Description, or a covers line in one Description of src\/; for the first: intent create description src\/a\.js\n/);
  assert.equal(readText(cwd, 'intent/.gitignore'), '/.index/\n/.reports/\n');
  assert.deepEqual(JSON.parse(readText(cwd, 'intent/intent.json')), { name: 'proj', code: ['src'], packs: [] });
  assert.match(I.start({ cwd }).text, /^error START_EXISTS /);
  assert.match(I.start({ cwd: tempDir(), codeRoot: ['nope', '..'] }).text, /^error START_CODE_ROOT nope does not exist\nerror START_CODE_ROOT \.\. is not inside the start folder\n/);
});

test('adopt copies a release, records it, writes nothing when it already matches, and reports an update', () => {
  const cwd = path.join(tempDir(), 'proj');
  write(cwd, { 'src/a.js': 'a' });
  I.start({ cwd });
  const release = path.join(FIXTURES, 'pack/js-async-1.0.0');
  const a = I.adopt({ cwd, dir: release, applies: ['src/**/*.js'] });
  assert.match(a.text, /^Adopted js-async 1\.0\.0 \(Asynchronous JavaScript that fails loudly\) into intent\/discipline\/js-async\/: await-every-promise\.md, timers-within-range\.md\.\nRecorded in intent\/intent\.json, applying to src\/\*\*\/\*\.js\.\n$/);
  assert.ok(!fs.existsSync(path.join(cwd, 'intent/discipline/js-async/NOTES.txt')));
  assert.match(I.adopt({ cwd, dir: release }).text, /nothing was written/);
  assert.equal(I.validate({ cwd }).outcome, 'answer');
  const next = path.join(tempDir(), 'js-async-1.1.0');
  fs.cpSync(release, next, { recursive: true });
  write(next, { 'pack.json': '{"name": "js-async", "version": "1.1.0", "title": "Asynchronous JavaScript that fails loudly"}\n' });
  fs.rmSync(path.join(next, 'timers-within-range.md'));
  write(cwd, { 'intent/blueprint/b.md': record('blueprint:b', 'B', 'S.\n\n## Relations\n\n- practice discipline:js-async.timers-within-range\n') });
  const u = I.adopt({ cwd, dir: next });
  assert.match(u.text, /\nUpdated from 1\.0\.0\.\nDisciplines removed:\n {2}discipline:js-async\.timers-within-range\n/);
  assert.match(u.text, /\nProject records that name a changed or removed Discipline:\n {2}blueprint:b practice discipline:js-async\.timers-within-range\n/);
  assert.deepEqual(fs.readdirSync(path.join(cwd, 'intent/discipline/js-async')), ['await-every-promise.md']);
  assert.match(I.adopt({ cwd, dir: path.join(FIXTURES, 'pack/invalid-release') }).text, /^error ADOPT_RELEASE /);
  assert.match(I.adopt({ cwd, dir: release, applies: ['/x'] }).text, /^error ARGS /);
  write(cwd, { 'intent/intent.json': '{"name": "proj", "code": ["."], "packs": [], "extra": 1}\n' });
  assert.match(I.adopt({ cwd, dir: release }).text, /^error ADOPT_PROJECT /);
});

test('guide prints a page as written, and refuses an unknown topic', () => {
  const repository = path.join(FIXTURES, '../..');
  for (const [topic, file] of [[undefined, 'spec/OPERATING.md'], ['using', 'spec/USING.md'], ['judge', 'base/judge.md'], ['base', 'base/README.md'],
    ['spec', 'spec/SPEC.md'], ['spec/records', 'spec/records.md'], ['spec/presentation', 'spec/presentation.md']]) {
    assert.equal(I.guide({ topic }).text, fs.readFileSync(path.join(repository, file), 'utf8'), file);
  }
  for (const topic of I.GUIDE_TOPICS) assert.equal(I.guide({ topic }).outcome, 'answer', topic);
  assert.deepEqual(I.GUIDE_TOPICS, ['using', 'principles', 'behavior', 'assurance', 'blueprint', 'description', 'discipline', 'checks', 'judge', 'keeping-true',
    'base', 'spec', 'spec/project', 'spec/records', 'spec/checks', 'spec/relations', 'spec/reports', 'spec/currency', 'spec/packs', 'spec/presentation', 'spec/portal']);
  assert.match(I.guide({ topic: 'format' }).text, /^error GUIDE_TOPIC /);
  assert.match(I.guide({ topic: 'nope' }).text, /^error GUIDE_TOPIC /);
  assert.equal(I.guide({ topic: 'code-work' }).text, `error GUIDE_TOPIC code-work is not a topic; the topics are ${I.GUIDE_TOPICS.join(', ')}\nRun intent guide TOPIC with one of them, or intent guide for the page on working on intent.\n`);
});

test('the walk and the answers change with the files, with nothing kept between operations', () => {
  const cwd = copyFixture('tiny');
  const before = I.fetch({ cwd, args: ['snooze'] }).text;
  fs.rmSync(path.join(cwd, 'intent/behavior/snooze.md'));
  const after = I.fetch({ cwd, args: ['snooze'] }).text;
  assert.notEqual(before, after);
  assert.match(after, /the word "snooze" matched nothing/);
});

test('Not searched: Fetch gives code contents, then what meaning it did not search; Search gives meaning, then code contents', () => {
  const cwd = copyFixture('tiny');
  const tail = (text) => text.slice(text.indexOf('\nNot searched:\n'));
  assert.equal(tail(I.search({ cwd, words: ['snooze'] }).text),
    '\nNot searched:\n  meaning: the words were matched as written and by simple stems, in titles, summaries, sections and Check claims\n  code contents\n');
  assert.ok(tail(I.fetch({ cwd, args: ['snooze'] }).text).startsWith('\nNot searched:\n  code contents\n  meaning beyond the words given: words were matched as written '
    + 'and by simple stems, then relations were followed from the records they matched\n'));
  assert.ok(tail(I.fetch({ cwd, args: ['src/scheduler/queue.js'] }).text).startsWith('\nNot searched:\n  code contents\n  meaning: no words were given\n'));
});

test('reports closes with what it could not read, then what it does not list', () => {
  const cwd = copyFixture('tiny');
  write(cwd, { 'intent/.reports/2026-01-01-aaaa.md': 'an unkept form\n', 'intent/.reports/kept/2026-01-02-bbbb.md': 'no header\n' });
  const r = I.reports({ cwd });
  assert.equal(r.text, '0 kept reports match.\n\nCould not read:\n  intent/.reports/kept/2026-01-02-bbbb.md: its header cannot be read\n'
    + 'Not listed:\n  1 unkept form in intent/.reports/, which is no account\n');
});

test('a relation whose target is missing is still a relation: Read shows it, it is a source, and it makes no edge', () => {
  const cwd = path.join(tempDir(), 'proj');
  write(cwd, { 'src/a.js': 'a\n' });
  I.start({ cwd });
  write(cwd, { 'intent/description/src/a.js.md': record('description:src.a-js', 'A', 'Does a.\n\n## Relations\n\n- serves behavior:gone\n- covers src/a.js\n') });
  const r = I.read({ cwd, ids: ['description:src.a-js'] });
  assert.match(r.text, /\nRelations:\n {2}- serves behavior:gone {2}\(no such record\)\n {2}- covers src\/a\.js\n/);
  assert.match(I.gaps({ cwd }).text, /\nDescriptions that relate to nothing:\n {2}description:src\.a-js {2}A {2}intent read description:src\.a-js\n/);
  const s = I.stamp({ cwd, ids: ['description:src.a-js'] });
  assert.match(s.text, /^error STAMP_SOURCE_MISSING description:src\.a-js: its source behavior:gone is not there/);
  const M = I.readProject(cwd);
  assert.deepEqual(M.records.get('description:src.a-js').sources.map((x) => x.source), ['src/a.js', 'behavior:gone']);
  assert.deepEqual(M.edges, []);
});

test('create refuses a title with a line break, a path that is neither a file nor a folder, and a Description file that already exists', () => {
  const cwd = path.join(tempDir(), 'proj');
  write(cwd, { 'src/a.js': 'a\n', 'src/b.js': 'b\n' });
  I.start({ cwd });
  fs.symlinkSync('a.js', path.join(cwd, 'src/link.js'));
  write(cwd, { 'intent/description/src/b.js.md': 'not a record\n' });
  const code = (r) => r.text.split(' ')[1];
  assert.equal(code(I.create({ cwd, layer: 'behavior', title: 'Two\nlines' })), 'CREATE_TITLE');
  assert.equal(code(I.create({ cwd, layer: 'behavior', title: 'Two\rlines' })), 'CREATE_TITLE');
  assert.match(I.create({ cwd, layer: 'description', path: 'src/link.js' }).text, /^error CREATE_PATH src\/link\.js is neither a regular file nor a folder\n/);
  assert.match(I.create({ cwd, layer: 'description', path: 'src/b.js' }).text, /^error CREATE_PLACE_TAKEN intent\/description\/src\/b\.js\.md already exists\n/);
  assert.equal(readText(cwd, 'intent/description/src/b.js.md'), 'not a record\n');
});

test('create describes the project root at intent/description/README.md, and still refuses a path with a component that begins with a dot', () => {
  const cwd = path.join(tempDir(), 'proj');
  write(cwd, { 'src/a.js': 'a\n', '.config/b.js': 'b\n' });
  I.start({ cwd });
  const r = I.create({ cwd, layer: 'description', path: '.' });
  assert.equal(r.outcome, 'answer', r.text);
  assert.match(r.text, /^Created intent\/description\/README\.md with the ID description:root\.\n/);
  assert.equal(readText(cwd, 'intent/description/README.md'),
    '---\n{"id":"description:root"}\n---\n# the project root\n\n## How it works\n\n## Why it is shaped this way\n\n## What callers rely on\n\n## Relations\n');
  assert.match(I.create({ cwd, layer: 'description', path: '.' }).text, /^error CREATE_PLACE_TAKEN description:root is already placed at \., in intent\/description\/README\.md\n/);
  assert.equal(I.create({ cwd, layer: 'description', path: '.config/b.js' }).text, 'error CREATE_PATH .config/b.js has a component that begins with .\nGive a file or folder of the project to describe.\n');
  assert.equal(I.create({ cwd, layer: 'description', path: '.config' }).text, 'error CREATE_PATH .config has a component that begins with .\nGive a file or folder of the project to describe.\n');
});

test('gaps and start say what explains a folder of unexplained files: a Description of each, or a covers line for each in one', () => {
  const cwd = path.join(tempDir(), 'proj');
  write(cwd, { 'src/a.js': 'a', 'src/b.js': 'b', 'lib/c.js': 'c', 'lib/d.js': 'd' });
  const s = I.start({ cwd, codeRoot: ['src', 'lib'] });
  assert.match(s.text, /\n {2}lib\/ \(2 files\) {2}each needs its own Description, or a covers line in one Description of lib\/; for the first: intent create description lib\/c\.js\n/);
  I.create({ cwd, layer: 'description', path: 'src' });
  const g = I.gaps({ cwd }).text;
  assert.match(g, /\n {2}src\/ \(2 files\) {2}each needs its own Description, or a covers line in description:src; for the first: intent create description src\/a\.js\n/);
  write(cwd, { 'intent/description/src/README.md': record('description:src', 'The sources', 'Two files.\n\n## Relations\n\n- covers src/a.js\n- covers src/b.js\n') });
  assert.doesNotMatch(I.gaps({ cwd }).text, /src\//);
});

test('create refuses a path that is not a project path, naming it on one line, and such a file is no code file', () => {
  const cwd = path.join(tempDir(), 'proj');
  write(cwd, { 'src/a\tb.js': 'x', 'src/c\\d.js': 'x', 'src/e\nf.js': 'x', 'src/ok.js': 'x' });
  I.start({ cwd });
  for (const [p, shown] of [['src/a\tb.js', '"src/a\\tb.js"'], ['src/c\\d.js', 'src/c\\d.js'], ['src/e\nf.js', '"src/e\\nf.js"']]) {
    const r = I.create({ cwd, layer: 'description', path: p });
    assert.equal(r.outcome, 'refused', p);
    assert.equal(r.text, `error CREATE_PATH ${shown} is not a project path: it holds a backslash or a control character such as a tab\nGive a file or folder of the project to describe.\n`);
  }
  assert.deepEqual(I.readProject(cwd).code, ['src/ok.js']);
  assert.match(I.gaps({ cwd }).text, /\nCode nobody explains:\n {2}src\/ok\.js {2}intent create description src\/ok\.js\n\n/);
  assert.deepEqual(fs.readdirSync(path.join(cwd, 'intent/description')), []);
});

test('start takes a file as a code root, refuses one that is not a project path, and lists the index only when it made it', () => {
  const cwd = path.join(tempDir(), 'proj');
  write(cwd, { 'server.mjs': 's', 'a\tb/x.js': 'x' });
  assert.equal(I.start({ cwd, codeRoot: ['a\tb'] }).text, 'error START_CODE_ROOT "a\\tb" is not a project path: it holds a backslash or a control character such as a tab\n'
    + 'Give --code-root files or folders that exist inside this folder and outside intent/, or none for the whole folder.\n');
  assert.ok(!fs.existsSync(path.join(cwd, 'intent')));
  const r = I.start({ cwd, codeRoot: ['server.mjs'] });
  assert.match(r.text, /\nCode nobody explains:\n {2}server\.mjs {2}intent create description server\.mjs\n/);
  assert.deepEqual(JSON.parse(readText(cwd, 'intent/intent.json')).code, ['server.mjs']);
  const again = path.join(tempDir(), 'again');
  write(again, { 'intent/.index/x': 'left over' });
  assert.doesNotMatch(I.start({ cwd: again }).text, /intent\/\.index\//);
});

test('a path outside the code roots is listed only under Outside the code roots, by Checks for a change and by Fetch', () => {
  const cwd = copyFixture('tiny');
  const c = I.checks({ cwd, paths: ['README.md', 'src/scheduler/tick.js'] }).text;
  assert.match(c, /\nNot covered:\n {2}nothing explains src\/scheduler\/tick\.js\nOutside the code roots:\n {2}README\.md\n/);
  assert.doesNotMatch(c, /nothing explains README\.md/);
  const f = I.fetch({ cwd, args: ['README.md', 'docs/new.md'] }).text;
  assert.match(f, /\nOutside the code roots:\n {2}README\.md\n {2}docs\/new\.md\n/);
  assert.doesNotMatch(f, /Not covered:/);
});

test('fetch names every record under what it is to the change, then gives each whole: the whole-product Assurances first, the rest most direct first', () => {
  const cwd = copyFixture('tiny');
  const r = I.fetch({ cwd, args: ['src/scheduler/queue.js'] });
  const lines = r.text.split('\n');
  assert.equal(lines[0], '8 records, 10 Checks bear on what you gave.');
  const whole = lines.indexOf('Each record, whole:');
  const list = lines.slice(3, whole - 1);
  // The five groups, in their order, each holding the records of one layer in the walk's order.
  assert.deepEqual(list.filter((l) => !l.startsWith(' ')), ['The code', 'What it must still do', 'How well and how safely', 'The design to keep', 'How to build here']);
  assert.deepEqual(list.filter((l) => /^ {2}\S/.test(l)).map((l) => l.trim().split('  ')[0]), ['description:src.scheduler.queue-js', 'description:src',
    'behavior:reminder-fires-time-once-even', 'behavior:snooze-delays-reminder-ten', 'assurance:reminder-app-accepted-never-lost',
    'blueprint:one-stored-queue-holds-every', 'discipline:js-async.await-every-promise', 'discipline:js-async.timers-within-range']);
  assert.deepEqual(list.slice(0, 6), ['The code', '  description:src.scheduler.queue-js  The reminder queue: stored entries the scheduler takes when due',
    '      why: placed at src/scheduler/queue.js', '      explains: src/scheduler/queue.js',
    '      Check take-marks-nothing        test: tests/queue.test.js "takeDue marks nothing"', '      Check committed-before-resolve  test: none named yet']);
  assert.ok(list.includes('      Check set-means-saved  judgment') && list.includes('      Check failure-leaves-unfired  none yet') && list.includes('      Check one-firer               judgment'));
  // Whole: the Assurance that bounds the whole product first, then the walk's order.
  const given = lines.filter((l, n) => lines[n - 1] === '---').map((l) => l.split('  ')[0]);
  assert.deepEqual(given, ['assurance:reminder-app-accepted-never-lost', 'description:src.scheduler.queue-js', 'blueprint:one-stored-queue-holds-every',
    'behavior:reminder-fires-time-once-even', 'description:src', 'discipline:js-async.await-every-promise', 'behavior:snooze-delays-reminder-ten',
    'discipline:js-async.timers-within-range']);
  // A record's text runs from its title line and leaves out its Relations and Read against sections.
  const from = lines.indexOf('description:src.scheduler.queue-js  (intent/description/src/scheduler/queue.js.md)');
  const text = lines.slice(from + 1, lines.indexOf('---', from));
  const file = readText(cwd, 'intent/description/src/scheduler/queue.js.md').split('\n');
  assert.equal(text[0], '# The reminder queue: stored entries the scheduler takes when due');
  assert.deepEqual(text, file.slice(3, file.indexOf('## Relations')).join('\n').trimEnd().split('\n'));
  assert.ok(file.includes('## Relations') && file.includes('## Read against'));
  assert.equal(text.some((l) => l === '## Relations' || l === '## Read against' || l.startsWith('- serves ')), false);
  assert.deepEqual(lines.slice(lines.indexOf('After changing the code: intent checks') - 1, lines.indexOf('After changing the code: intent checks') + 3),
    ['', 'After changing the code: intent checks', '', 'May be out of date:']);
  // A word that matches nothing still brings the Assurance that bounds the whole product, and only its group.
  const word = I.fetch({ cwd, args: ['zzzz'] }).text.split('\n');
  assert.deepEqual(word.slice(0, 6), ['1 record, 2 Checks bear on what you gave.', 'Took "zzzz" as words.', '', 'How well and how safely',
    '  assurance:reminder-app-accepted-never-lost  A reminder the app accepted is never lost', '      why: bounds the whole product']);
  // Nothing bears: no list, no records, no next step.
  const empty = path.join(tempDir(), 'empty');
  write(empty, { 'src/a.js': 'a\n' });
  I.start({ cwd: empty });
  const none = I.fetch({ cwd: empty, args: ['zzzz'] });
  assert.deepEqual(none.text.split('\n').slice(0, 3), ['0 records, 0 Checks: nothing in intent bears on what was given.', 'Took "zzzz" as words.', '']);
  assert.equal(none.text.includes('After changing the code') || none.text.includes('Each record, whole:'), false);
});

test('an answer opens with a line that counts, then gives its items, then what to do next, then its limits, an empty line between them', () => {
  const cwd = copyFixture('tiny');
  // Gaps: Behaviors and Assurances by their names, and one count's noun singular.
  const gaps = I.gaps({ cwd }).text;
  const head = gaps.split('\n')[0];
  assert.match(head, /^\d+ code files? nobody explains, \d+ (Behaviors and Assurances|Behavior or Assurance) with no Check, \d+ Checks? nothing applies, \d+ Descriptions? with no relation\.$/);
  assert.match(gaps, /\n\nThis is work nobody has done\. Decide with the person what comes first, and never invent a relation or a Check to empty a list\.\n\nNot listed:\n {2}whether existing intent is right; intent drift lists what changed under each record\n$/);
  assert.equal(gaps.includes('romise'), false);
  assert.ok(head.includes(', 1 Behavior or Assurance with no Check, '), head);
  write(cwd, { 'intent/behavior/bare.md': record('behavior:bare', 'Bare', 'A summary.\n') });
  const two = I.gaps({ cwd }).text;
  assert.ok(two.includes(', 2 Behaviors and Assurances with no Check, '), two.split('\n')[0]);
  assert.match(two, /\nBehaviors and Assurances with no Check:\n {2}behavior:bare {2}Bare {2}intent read behavior:bare\n/);
  // Drift: what to do next only when a record is listed.
  fs.appendFileSync(path.join(cwd, 'src/scheduler/queue.js'), '// changed\n');
  const drift = I.drift({ cwd }).text;
  assert.match(drift, /^Sources changed under 2 records; never stamped: \d+; unchanged: \d+\.\n\nChanged:\n {2}description:src\.scheduler\.queue-js /);
  assert.match(drift, /\n\nReread each against what changed, edit it where it no longer holds, then: intent stamp <id>\n\nNot checked:\n {2}whether the reread a stamp records happened\n$/);
  // Validate: the count, each finding, what to do, what it does not check.
  write(cwd, { 'intent/behavior/bare.md': record('behavior:bare', 'Bare', 'A summary.\n\n### Check x\n**Claim.** It holds.\n**Fails when.** It breaks.\n') });
  const bad = I.validate({ cwd });
  assert.equal(bad.outcome, 'findings');
  assert.match(bad.text, /^\d+ records, \d+ Checks; 1 error, 0 warnings\.\n\nintent\/behavior\/bare\.md:\d+: error CHECK_FIELD_MISSING .+\n\nFix every error, then run intent validate again\.\n\nNot checked:\n/);
});

test('create says when the name it made left words of the title out, and nothing when it did not', () => {
  const cwd = copyFixture('tiny');
  const cut = I.create({ cwd, layer: 'assurance', title: 'No reminder a person was told is set is ever lost' }).text.split('\n');
  assert.equal(cut[0], 'Created intent/assurance/no-reminder-person-told-set-ever.md with the ID assurance:no-reminder-person-told-set-ever.');
  assert.equal(cut[1], "The ID leaves out the title's last words, lost: a name keeps whole words up to 32 characters. An ID never changes, so if this one misleads, "
    + 'remove intent/assurance/no-reminder-person-told-set-ever.md and create the record again under a shorter title.');
  const two = I.create({ cwd, layer: 'behavior', title: 'A snoozed reminder comes back ten minutes later, once' }).text.split('\n');
  assert.match(two[1], /^The ID leaves out the title's last words, minutes, later, once: a name keeps whole words up to 32 characters\. /);
  const long = I.create({ cwd, layer: 'blueprint', title: 'Supercalifragilisticexpialidociousness everywhere' }).text.split('\n');
  assert.equal(long[0], 'Created intent/blueprint/supercalifragilisticexpialidocio.md with the ID blueprint:supercalifragilisticexpialidocio.');
  assert.match(long[1], /^The ID is the first 32 characters of the title's first word\. An ID never changes, so if this one misleads, remove intent\/blueprint\/supercalifragilisticexpialidocio\.md /);
  const whole = I.create({ cwd, layer: 'behavior', title: 'No reminder shown as set is ever lost' }).text.split('\n');
  assert.equal(whole[0], 'Created intent/behavior/no-reminder-shown-set-ever-lost.md with the ID behavior:no-reminder-shown-set-ever-lost.');
  assert.equal(whole[1].startsWith('The ID '), false);
});
