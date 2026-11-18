import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stem, terms, queryStems } from '../../library/src/words.mjs';

test('stems as the contract gives them', () => {
  for (const w of ['filled', 'fills', 'fill']) assert.equal(stem(w), 'fil', w);
  assert.equal(stem('exported'), 'export');
  assert.equal(stem('export'), 'export');
  assert.equal(stem('class'), 'clas');
  assert.equal(stem('stories'), 'story');
  assert.equal(stem('run'), 'run');
});

test('terms drop stop words, single characters and marks', () => {
  assert.deepEqual(terms('The Café is a 2x win'), ['cafe', '2x', 'win']);
  assert.deepEqual([...queryStems(['filling', 'fills']).entries()], [['fil', 'filling']]);
});
