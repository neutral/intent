// Globs: `*` and `?` within one component, `**` as a whole component.
import { isProjectPath } from './ids.mjs';

export const isGlob = (g) => typeof g === 'string' && isProjectPath(g) && g.split('/').every((c) => c === '**' || !c.includes('**'));

const escape = (ch) => ch.replace(/[.+^${}()|[\]\\*?]/g, '\\$&');

/** Whether the glob matches the whole project path. */
export function globMatches(glob, p) {
  const comps = glob.split('/').map((c) => (c === '**' ? c
    : new RegExp('^' + [...c].map((ch) => (ch === '*' ? '[^/]*' : ch === '?' ? '[^/]' : escape(ch))).join('') + '$', 'u')));
  const parts = p.split('/');
  const memo = new Map();
  const m = (gi, pi) => {
    const key = gi * (parts.length + 1) + pi;
    if (memo.has(key)) return memo.get(key);
    let r;
    if (gi === comps.length) r = pi === parts.length;
    else if (comps[gi] === '**') r = m(gi + 1, pi) || (pi < parts.length && m(gi, pi + 1));
    else r = pi < parts.length && comps[gi].test(parts[pi]) && m(gi + 1, pi + 1);
    memo.set(key, r);
    return r;
  };
  return m(0, 0);
}
