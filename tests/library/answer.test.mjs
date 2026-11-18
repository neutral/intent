import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bounded, labelled, parseToken, tokenHash, refuse, command, BOUND, FETCH_TAIL } from '../../library/src/answer.mjs';
import { length } from '../../library/src/text.mjs';

const repeat = (more) => command('fetch', ['x'], { after: ['--more', more] });
const entry = (k, size, always = false) => ({ id: `behavior:r${k}`, title: `R${k}`, checks: 1, always, lines: [`  behavior:r${k}`, `    ${'x'.repeat(size)}`] });

test('a bounded answer prints whole entries within the bound, then a tail with the command and token', () => {
  const entries = Array.from({ length: 40 }, (_, k) => entry(k, 1500));
  const { lines, hash } = bounded({ opening: ['open', ''], entries, start: 0, closingLines: ['', 'Not searched:', '  code contents'], repeat });
  const text = lines.join('\n') + '\n';
  assert.ok(length(text) <= BOUND);
  const at = lines.findIndex((l) => l.startsWith('Not shown in full'));
  assert.match(lines[at], /^Not shown in full, past the 28000-character bound: \d+ records with \d+ Checks, by ID and title\. Print them with:$/);
  const k = Number(/--more (\d+)-/.exec(lines[at + 1])[1]);
  assert.equal(lines[at + 1], `  intent fetch x --more ${k}-${hash}`);
  assert.equal(hash, tokenHash(entries.map((e) => e.id)));
  assert.equal(lines.filter((l) => /^ {2}behavior:r\d+$/.test(l)).length, k);
  const next = bounded({ opening: ['open', ''], entries, start: k, closingLines: [], repeat });
  assert.equal(next.lines[2], `  behavior:r${k}`);
});

test('an entry marked always is printed whatever the bound, and a tail that lists nothing only says how many are left', () => {
  const entries = [entry(0, 20000, true), entry(1, 20000, true), entry(2, 100), entry(3, 40000), entry(4, 100)];
  const { lines, hash } = bounded({ opening: ['open'], entries, start: 0, closingLines: ['', 'After'], repeat, tail: FETCH_TAIL });
  // Both always entries print, past the bound; the next does not fit, so it and all after it are left to the tail.
  assert.deepEqual(lines.filter((l) => /^ {2}behavior:r\d+$/.test(l)), ['  behavior:r0', '  behavior:r1']);
  const at = lines.indexOf('Not given whole, past the 28000-character bound: 3 records, named in the list above. Print them with:');
  assert.ok(at > 0, lines.filter((l) => l.length < 200).join('\n'));
  assert.deepEqual(lines.slice(at - 1), ['', lines[at], `  intent fetch x --more 2-${hash}`, '', 'After']);
  const small = bounded({ opening: ['open'], entries: [entry(0, 100), entry(1, 100, true)], start: 0, closingLines: [], repeat, tail: FETCH_TAIL });
  assert.equal(small.lines.some((l) => l.startsWith('Not given whole')), false);
});

test('the first entry is always printed', () => {
  const { lines } = bounded({ opening: [], entries: [entry(0, 40000), entry(1, 10)], start: 0, closingLines: [], repeat });
  assert.equal(lines[0], '  behavior:r0');
  assert.ok(lines.at(-1) === '  and 1 more' || lines.at(-1) === '  behavior:r1  R1');
});

test('a limit holds at most 20 items', () => {
  const items = Array.from({ length: 25 }, (_, k) => `item ${k}`);
  const out = labelled('Could not read:', items, 'intent validate lists them all');
  assert.equal(out.length, 21);
  assert.equal(out.at(-1), '  and 6 more: intent validate lists them all');
  assert.deepEqual(labelled('Empty:', []), []);
});

test('a command to run writes an argument that begins with -- after --, with every option before it', () => {
  assert.equal(command('fetch', ['src/a.js'], { after: ['--base', 'main'] }), 'intent fetch src/a.js --base main');
  assert.equal(command('fetch', ['--x.js'], { after: ['--base', 'main'] }), 'intent fetch --base main -- --x.js');
  assert.equal(command('create', ['--x.js'], { before: ['description'] }), 'intent create description -- --x.js');
  assert.equal(command('checks', ['--x.js', 'b c.js'], { before: ['--judge', 'behavior:a:b'] }), "intent checks --judge behavior:a:b -- --x.js 'b c.js'");
  assert.equal(command('checks', ['a.js'], { before: ['--judge', 'behavior:a:b'], after: ['--base', 'main'] }), 'intent checks --judge behavior:a:b a.js --base main');
  const entries = Array.from({ length: 40 }, (_, k) => entry(k, 1500));
  const { lines, hash } = bounded({ opening: [], entries, start: 0, closingLines: [], repeat: (more) => command('fetch', ['--x.js'], { after: ['--more', more] }), tail: FETCH_TAIL });
  assert.match(lines.find((l) => l.includes('--more')), new RegExp(`^  intent fetch --more \\d+-${hash} -- --x\\.js$`));
});

test('tokens and refusals', () => {
  assert.deepEqual(parseToken('12-0123abcd'), { k: 12, h: '0123abcd' });
  assert.equal(parseToken('12-xyz'), null);
  const r = refuse([{ code: 'ARGS', message: 'a' }, { code: 'ARGS', message: 'b' }], 'Do this.');
  assert.deepEqual(r, { outcome: 'refused', text: 'error ARGS a\nerror ARGS b\nDo this.\n' });
});
