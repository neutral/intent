// Words, matched lexically: terms, stems, the ranking of records by the words given, and an excerpt that shows a match.
// It needs nothing from the host, so the portal serves this file to the browser as it is, and its search ranks as Search does.
import { lower, trim } from './plain.mjs';

const STOP = new Set(('a an and are as at be by can could do does doing for from has have how i if in into is it its me my no not of on '
  + 'or our should so than that the their them then there these they this to too was we were what when where which while who why '
  + 'will with would you your').split(' '));
const ENDINGS = [['ations', ''], ['ation', ''], ['ments', ''], ['ment', ''], ['ness', ''], ['ings', ''], ['ing', ''], ['ies', 'y'],
  ['ers', ''], ['er', ''], ['ed', ''], ['es', ''], ['ly', ''], ['s', '']];

export function stem(w) {
  if (w.length <= 3) return w;
  for (const [e, r] of ENDINGS) {
    if (w.endsWith(e) && w.length - e.length >= 3 && !(e === 's' && w.endsWith('ss'))) { w = w.slice(0, -e.length) + r; break; }
  }
  w = w.replace(/([bcdfghjklmnpqrstvwxyz])\1$/, '$1');
  if (w.length >= 4 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

export const terms = (text) => (lower(text.normalize('NFKD').replace(/\p{Mn}/gu, '')).match(/[a-z0-9]{2,}/g) || []).filter((w) => !STOP.has(w));
export const stems = (text) => terms(text).map(stem);

/** The query's stems, each with the first word that gave it, in order. */
export function queryStems(words) {
  const said = new Map();
  for (const w of words) for (const t of terms(w)) { const s = stem(t); if (!said.has(s)) said.set(s, w); }
  return said;
}

/** The fields Fetch reads: the title, the summary and each Check's claim. */
export const fieldsOf = (rec) => [rec.title, rec.summary, ...rec.checks.map((c) => c.claim)];
/** The prose Search adds to them: the lines of the record's prose sections. */
export const proseOf = (rec) => rec.sections.filter((s) => s.kind === 'prose').flatMap((s) => s.lines.map((l) => l.text));
/** The stems of the texts, each once, in the order first met. */
export const unique = (texts) => [...new Set(texts.flatMap(stems))];

/**
 * Rank documents against the words. Each document is {id, set, checkIds, checkSets}: the stems it holds, and its
 * Checks' IDs with the stems of each claim. Returns the hits by score, highest first, then by `order` of their IDs:
 * {id, score, words (as written, that matched), stems (matched), marked (Check IDs whose claim holds a matched term)},
 * the words that matched nothing, and the words too common to search.
 */
export function rank(docs, words, order) {
  const said = queryStems(words);
  const q = [...said.keys()];
  const N = docs.length;
  const df = new Map(q.map((t) => [t, docs.filter((x) => x.set.has(t)).length]));
  const hits = [];
  for (const x of docs) {
    const got = q.filter((t) => x.set.has(t));
    if (!got.length) continue;
    hits.push({ id: x.id, score: got.reduce((s, t) => s + Math.log(1 + N / df.get(t)), 0), stems: got,
      words: [...new Set(got.map((t) => said.get(t)))],
      marked: x.checkIds.filter((c, k) => got.some((t) => x.checkSets[k].has(t))) });
  }
  hits.sort((a, b) => b.score - a.score || order(a.id, b.id));
  const unmatched = words.filter((w) => terms(w).length && !terms(w).some((t) => df.get(stem(t)) > 0));
  const common = words.filter((w) => !terms(w).length);
  return { hits, unmatched, common };
}

/** Split a paragraph into sentences after `.`, `!` or `?` followed by white space and a capital, backtick, quote or `(`. */
export function sentences(paragraph) {
  const out = [];
  let from = 0;
  const re = /[.!?](?=[ \t]+[A-Z`"(])/g;
  let m;
  while ((m = re.exec(paragraph))) { out.push(trim(paragraph.slice(from, m.index + 1))); from = m.index + 1; }
  out.push(trim(paragraph.slice(from)));
  return out.filter((s) => s !== '');
}

/** The first sentence of the summary, the prose paragraphs, then the Checks, that holds a matched stem. */
export function excerpt(rec, matched) {
  const paragraphs = [rec.summary, ...rec.paragraphs, ...rec.checks.map((c) => `Check ${c.slug}: ${c.claim}`)];
  let found = null;
  for (const p of paragraphs) {
    for (const s of sentences(p)) if (stems(s).some((t) => matched.has(t))) { found = s; break; }
    if (found) break;
  }
  const e = found ?? rec.summary;
  const chars = [...e];
  return chars.length > 240 ? chars.slice(0, 240).join('') + '...' : e;
}
