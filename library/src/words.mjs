// Words, matched lexically: the score of each record, its stems kept in the index. The rules themselves are rank.mjs's.
import { byPath } from './text.mjs';
import { indexOf } from './cache.mjs';
import { stem, terms, stems, queryStems, fieldsOf, proseOf, unique, rank } from './rank.mjs';

export { stem, terms, stems, queryStems };

const strings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * Score every record against the words. Returns the hits by score, highest first, then ID:
 * {id, score, words (as written, that matched), stems (matched), marked (Check IDs whose claim holds a matched term)}.
 */
export function score(M, words, { sections = false } = {}) {
  // Each record's stems depend on its file alone, so the index keeps them by the file's hash.
  const ix = indexOf(M);
  const kept = (rec, kind, make, ok) => (ix ? ix.stems(rec, kind, make, ok) : make());
  const docs = [...M.records.values()].map((rec) => {
    const f = kept(rec, 'fields', () => unique(fieldsOf(rec)), strings);
    const p = sections ? kept(rec, 'prose', () => unique(proseOf(rec)), strings) : [];
    const c = kept(rec, 'claims', () => rec.checks.map((ch) => unique([ch.claim])), (v) => Array.isArray(v) && v.length === rec.checks.length && v.every(strings));
    return { id: rec.id, set: new Set(sections ? [...f, ...p] : f), checkIds: rec.checks.map((ch) => ch.id), checkSets: c.map((x) => new Set(x)) };
  });
  ix?.saveWords();
  return rank(docs, words, byPath);
}
