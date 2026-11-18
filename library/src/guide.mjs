// Guide: the page on working on intent, the page on using it, the pages agents lean on for each kind of work, the model page and the contracts.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { refuse, argsRefusal } from './answer.mjs';

const BASE_PAGES = ['principles', 'behavior', 'assurance', 'blueprint', 'description', 'discipline', 'checks', 'judge', 'keeping-true'];
const CONTRACTS = ['project', 'records', 'checks', 'relations', 'reports', 'currency', 'packs', 'presentation', 'portal'];
export const GUIDE_TOPICS = ['using', ...BASE_PAGES, 'base', 'spec', ...CONTRACTS.map((c) => `spec/${c}`)];

/** The file a topic is read from, relative to the package: the page on working on intent with no topic. */
export const guidePath = (topic) => (topic === undefined ? 'spec/OPERATING.md' : topic === 'using' ? 'spec/USING.md' : topic === 'base' ? 'base/README.md'
  : topic === 'spec' ? 'spec/SPEC.md' : topic.startsWith('spec/') ? `${topic}.md` : `base/${topic}.md`);
export const guideFile = (topic) => fileURLToPath(new URL(`../../${guidePath(topic)}`, import.meta.url));

export function guide({ topic, args = [] }) {
  const topics = topic === undefined ? args : [topic, ...args];
  if (topics.length > 1) return argsRefusal('guide takes at most one topic', `Run intent guide TOPIC, with one of: ${GUIDE_TOPICS.join(', ')}.`);
  const t = topics[0];
  if (t !== undefined && !GUIDE_TOPICS.includes(t)) return refuse({ code: 'GUIDE_TOPIC', message: `${t} is not a topic; the topics are ${GUIDE_TOPICS.join(', ')}` }, 'Run intent guide TOPIC with one of them, or intent guide for the page on working on intent.');
  const text = fs.readFileSync(guideFile(t), 'utf8').replace(/\r\n/g, '\n');
  return { outcome: 'answer', text: text.endsWith('\n') ? text : text + '\n' };
}
