import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linesOf, trim, lower, byPath, shellWord, length, decode, short } from '../../library/src/text.mjs';
import { parseJSON, tryJSON, plain } from '../../library/src/json.mjs';

test('lines split at LF, drop a CR before an LF only, and drop a byte order mark', () => {
  assert.deepEqual(linesOf(''), []);
  assert.deepEqual(linesOf('a\nb\n'), ['a', 'b']);
  assert.deepEqual(linesOf('a\r\nb'), ['a', 'b']);
  assert.deepEqual(linesOf('a\rb\r'), ['a\rb\r']);
  assert.deepEqual(linesOf('﻿---\n'), ['---']);
  assert.deepEqual(linesOf('a\n\n'), ['a', '']);
});

test('white space is space and tab only, and lowercasing is ASCII only', () => {
  assert.equal(trim(' \t x  '), 'x  ');
  assert.equal(lower('ÄBc'), 'Äbc');
});

test('path order is UTF-8 byte order', () => {
  assert.deepEqual(['b', 'B', 'é', 'a/b', 'a-b'].sort(byPath), ['B', 'a-b', 'a/b', 'b', 'é']);
});

test('a shell word is bare when safe and single-quoted otherwise', () => {
  assert.equal(shellWord('src/a.js'), 'src/a.js');
  assert.equal(shellWord('two words'), "'two words'");
  assert.equal(shellWord("it's"), "'it'\\''s'");
});

test('lengths count scalar values, decoding is strict, and short is 16 hex characters', () => {
  assert.equal(length('a😀'), 2);
  assert.equal(decode(Buffer.from([0xff])), null);
  assert.equal(decode(Buffer.from('﻿x')), '﻿x');
  assert.match(short('x'), /^[0-9a-f]{16}$/);
});

test('JSON with a repeated member name is not valid, and lines are kept', () => {
  assert.equal(tryJSON('{"a":1,"a":2}'), null);
  assert.equal(tryJSON('﻿{}'), null);
  const n = parseJSON('{\n  "a": [\n    1\n  ]\n}');
  assert.equal(n.members[0].keyLine, 2);
  assert.equal(n.members[0].node.elements[0].line, 3);
  assert.deepEqual(plain(n), { a: [1] });
});
