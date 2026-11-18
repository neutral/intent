// Search: candidate records and Checks for words, with excerpts; lexical only.
import { score } from './words.mjs';
import { sentences, excerpt } from './rank.mjs';
import { recordLine, titleOf } from './render.mjs';
import { openProject, refuse, argsRefusal, answer, couldNotRead, closing, bounded, parseToken, command, count } from './answer.mjs';
import { oneLine } from './text.mjs';

export { sentences, excerpt };

export function search({ cwd, words = [], more }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  const { M } = p;
  if (!words.length) return argsRefusal('search takes one or more words', 'Give the words to search for: intent search WORDS...');
  let token = null;
  if (more !== undefined) {
    token = parseToken(more);
    if (!token) return argsRefusal(`--more ${oneLine(more)} is not a token <k>-<hash> from an earlier answer`, 'Give --more the token a bounded answer printed.');
  }
  const s = score(M, words, { sections: true });
  const entries = s.hits.map((h) => {
    const rec = M.records.get(h.id), matched = new Set(h.stems);
    return { id: h.id, title: titleOf(rec), checks: rec.checks.length,
      lines: [`  ${recordLine(rec)}`, `    ${excerpt(rec, matched) || '(no summary)'}`, ...h.marked.map((c) => `    Check ${c}`)] };
  });
  const start = token ? token.k : 0;
  if (token && (token.h !== bounded({ opening: [], entries, start: 0, closingLines: [], repeat: () => '' }).hash || start < 1 || start >= entries.length)) {
    return refuse({ code: 'MORE_STALE', message: `the token ${more} does not belong to the answer these words now give` }, `Run ${command('search', words)} again for the answer as it is now.`);
  }
  const notCovered = [...s.unmatched.map((x) => `the word "${x}" matched nothing`), ...s.common.map((x) => `"${x}" is too common a word to search`)];
  const closingLines = [...(entries.length ? ['', 'Read one with intent read <id>, or fetch what bears on it with intent fetch <id>.'] : []), '',
    ...closing({ notCovered, notSearched: ['meaning: the words were matched as written and by simple stems, in titles, summaries, sections and Check claims', 'code contents'],
      couldNotRead: couldNotRead(M, s.hits.map((h) => M.records.get(h.id).file)) })];
  const head = `${count(s.hits.length, 'candidate')} for ${words.map((w) => `"${w}"`).join(' ')}.`;
  const opening = [head + (token ? ` Continuing from record ${start + 1} of ${entries.length}.` : ''), ...(entries.length ? ['', 'Candidates:'] : [])];
  return answer(bounded({ opening, entries, start, closingLines, repeat: (tok) => command('search', words, { after: ['--more', tok] }) }).lines);
}
