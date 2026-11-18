// The pages that ship: every contract section cites lines of the model page that exist, and every link resolves.
// In spec/, a page named in lower case is a contract; SPEC.md is the model, and the other pages named in upper case
// are what agents are handed, which cite no line of the model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../support.mjs';
import { BOUND } from '../../library/src/answer.mjs';
import { length } from '../../library/src/text.mjs';

const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const specPages = fs.readdirSync(path.join(REPO, 'spec')).filter((f) => f.endsWith('.md')).sort();
const contracts = specPages.filter((f) => f === f.toLowerCase());
const handed = specPages.filter((f) => f !== f.toLowerCase() && f !== 'SPEC.md');
/** Sections that only point elsewhere, so spell out no line of the model. */
const INDEX_SECTIONS = new Set(['project.md#words', 'project.md#operations']);

test('every section of every contract says which lines of the model page it spells out, or that the model does not imply it', () => {
  const model = read('spec/SPEC.md').split('\n');
  let cited = 0;
  for (const file of contracts) {
    const text = read(`spec/${file}`);
    assert.match(text, /`M<n>` is line n of\n\[SPEC\.md\]\(SPEC\.md\)/, `${file} says what M<n> is`);
    for (const m of text.matchAll(/<a id="([^"]+)"><\/a>\n\n#{2,3} [^\n]*\n\n([^\n]*)\n/g)) {
      const [, anchor, line] = m, where = `${file}#${anchor}`;
      if (INDEX_SECTIONS.has(where)) continue;
      if (line === 'Not in the model: the contract adds this.') continue;
      const from = /^From the model: (.+)\.$/.exec(line);
      assert.ok(from, `${where} opens with the lines of the model it spells out: ${line}`);
      for (const part of from[1].split(', ')) {
        const range = /^M(\d+)(?:–(\d+))?$/.exec(part);
        assert.ok(range, `${where}: ${part} is M<n> or M<n>–<m>`);
        const a = Number(range[1]), b = Number(range[2] ?? range[1]);
        assert.ok(a <= b && b <= model.length, `${where}: ${part} is within the model page`);
        assert.ok(model[a - 1].trim() !== '' && model[b - 1].trim() !== '', `${where}: ${part} begins and ends on a line that holds text`);
        cited++;
      }
    }
    assert.equal([...text.matchAll(/<a id="/g)].length, [...text.matchAll(/<a id="[^"]+"><\/a>\n\n#{2,3} /g)].length, `${file}: every anchor stands before a heading`);
  }
  assert.ok(cited > 50, String(cited));
});

test('every link in the pages that ship names a file that exists and a section it has', () => {
  const pages = ['README.md', ...fs.readdirSync(path.join(REPO, 'base')).map((f) => `base/${f}`), 'spec/SPEC.md', ...handed.map((f) => `spec/${f}`), ...contracts.map((f) => `spec/${f}`),
    'spec/fixtures/README.md', ...fs.readdirSync(path.join(REPO, 'docs'), { recursive: true }).filter((f) => String(f).endsWith('.md')).map((f) => `docs/${String(f).split(path.sep).join('/')}`)];
  const slug = (heading) => heading.toLowerCase().replace(/[^\w\- ]/g, '').replace(/ /g, '-');
  const bad = [];
  for (const page of pages) {
    const prose = read(page).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const m of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
      const link = m[1];
      if (/^(https?:|mailto:)/.test(link)) continue;
      const [to, anchor] = link.split('#');
      const target = to ? path.posix.normalize(path.posix.join(path.posix.dirname(page), to)) : page;
      if (!fs.existsSync(path.join(REPO, target))) { bad.push(`${page}: ${link} names no file`); continue; }
      if (!anchor || !target.endsWith('.md')) continue;
      const text = read(target);
      const slugs = new Set([...text.matchAll(/^#+ (.*)$/gm)].map((h) => slug(h[1])));
      if (!text.includes(`<a id="${anchor}"></a>`) && !slugs.has(anchor)) bad.push(`${page}: ${link} names no section`);
    }
  }
  assert.deepEqual(bad, []);
});

test('each page agents are handed is within the bound, so that one command gives it whole', () => {
  assert.deepEqual(handed, ['OPERATING.md', 'USING.md']);
  for (const file of handed) {
    const n = length(read(`spec/${file}`));
    assert.ok(n <= BOUND, `spec/${file} is ${n} characters, past the bound of ${BOUND}`);
  }
});
