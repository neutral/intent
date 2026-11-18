// The walk: from seeds (paths, IDs, words) up every edge, down one step, and the whole product.
import path from 'node:path';
import { LAYER_ORDER, underIntent } from './ids.mjs';
import { globMatches } from './glob.mjs';
import { isDir } from './fsx.mjs';
import { score } from './words.mjs';

export const TIERS = ['Direct: at the paths, of the change, named or matched', 'One relation away', 'Further',
  'For the whole product, or an adopted practice'];

const cmpKey = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; };
const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };

/** The adopted Packs that apply to a path, each with the first glob that matches. */
export function packsFor(M, p) {
  const out = [];
  const folder = isDir(path.join(M.root, p));
  for (const pack of M.project.packs) {
    const glob = pack.applies.find((g) => globMatches(g, p) || (folder && M.code.some((f) => (p === '.' || f.startsWith(p + '/')) && globMatches(g, f))));
    if (glob) out.push({ pack, glob });
  }
  return out;
}

/** The Disciplines of an adopted Pack: the records in its copy folder. */
const disciplinesOf = (M, name) => [...M.records.values()].filter((r) => r.layer === 'discipline' && r.inFolder && r.pack === name);

/**
 * Walk from paths (project paths), IDs and words. `change` words the reason of a record file in a change.
 * Returns {records: [{id, tier, distance, late, reasons, marked}], checks: [check id], wordHits}.
 */
export function walk(M, { paths = [], ids = [], words = [], change = false } = {}) {
  const seeds = [];
  const descriptions = [...M.records.values()].filter((r) => r.layer === 'description' && r.place !== undefined);
  for (const p of paths) {
    if (underIntent(p)) {
      const rec = M.byFile.get(p);
      if (rec) seeds.push({ id: rec.id, d: 0, late: false, reason: change ? `its file ${p} is in the change` : `named by its file ${p}`, down: true });
      continue;
    }
    for (const rec of descriptions) if (rec.place === p) seeds.push({ id: rec.id, d: 0, late: false, reason: `placed at ${p}` });
    for (const rec of descriptions) {
      if (rec.place !== p && rec.live.some((r) => r.verb === 'covers' && r.target === p)) seeds.push({ id: rec.id, d: 0, late: false, reason: `covers ${p}` });
    }
    if (p !== '.') {
      const parts = p.split('/');
      for (let k = parts.length - 1; k >= 0; k--) {
        const above = k === 0 ? '.' : parts.slice(0, k).join('/');
        for (const rec of descriptions) {
          if (rec.folder && rec.place === above) {
            seeds.push({ id: rec.id, d: parts.length - k, late: false, reason: above === '.' ? `placed above ${p}, at the project root` : `placed above ${p}, at ${above}/` });
          }
        }
      }
    }
    for (const { pack, glob } of packsFor(M, p)) {
      for (const rec of disciplinesOf(M, pack.name)) seeds.push({ id: rec.id, d: 1, late: true, reason: `Pack ${pack.name} applies to ${p} (${glob})`, down: true, pack: true });
    }
  }
  for (const a of ids) {
    if (M.records.has(a)) seeds.push({ id: a, d: 0, late: false, reason: 'named', down: true });
    else if (M.checks.has(a)) seeds.push({ id: M.checks.get(a).record, d: 0, late: false, reason: `holds the Check named, ${a}`, down: true, marks: [a] });
  }
  let wordHits = null;
  if (words.length) {
    wordHits = score(M, words);
    const top = wordHits.hits.length ? wordHits.hits[0].score : 0;
    for (const h of wordHits.hits) {
      if (h.score >= top / 2) seeds.push({ id: h.id, d: 0, late: false, reason: `matched ${h.words.map((w) => `"${w}"`).join(', ')}`, down: true, marks: h.marked });
    }
  }

  const out = new Map(), inc = new Map();
  for (const e of M.edges) { push(out, e.from, e); push(inc, e.to, e); }
  const up = (starts) => {
    const dist = new Map();
    for (const s of starts) if (!dist.has(s.id) || dist.get(s.id) > s.d) dist.set(s.id, s.d);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, dd] of [...dist]) {
        for (const e of out.get(id) || []) if (!dist.has(e.to) || dist.get(e.to) > dd + 1) { dist.set(e.to, dd + 1); changed = true; }
      }
    }
    return dist;
  };
  const upNow = up(seeds.filter((s) => !s.late)), upLate = up(seeds.filter((s) => s.late));
  const upReached = new Set([...upNow.keys(), ...upLate.keys()]);
  const dn = new Map(upNow), dl = new Map(upLate);
  const setMin = (m, id, v) => { if (!m.has(id) || m.get(id) > v) m.set(id, v); };
  const downReasons = [];
  for (const s of seeds) {
    if (!s.down || M.records.get(s.id).layer === 'description') continue;
    const sd = s.late ? upLate.get(s.id) : upNow.get(s.id);
    for (const e of inc.get(s.id) || []) {
      if (e.verb === 'applies') continue;
      setMin(s.late ? dl : dn, e.from, sd + 1);
      downReasons.push({ id: e.from, from: s.id, verb: e.verb });
    }
  }
  const any = paths.length || ids.length || words.length;
  const wholes = any ? [...M.records.values()].filter((r) => r.wholeProduct).map((r) => r.id) : [];
  for (const w of wholes) if (!dn.has(w)) setMin(dl, w, 2);

  // Each record's own seeds, the steps down to it and the whole-product mark, found by ID rather than by search.
  const seedsOf = new Map(), downOf = new Map(), whole = new Set(wholes);
  for (const s of seeds) push(seedsOf, s.id, s);
  for (const r of downReasons) push(downOf, r.id, r);
  const orderKey = (id) => { const late = !dn.has(id); return [late ? 1 : 0, late ? dl.get(id) : dn.get(id), LAYER_ORDER.indexOf(M.records.get(id).layer), id]; };
  const list = [];
  for (const id of new Set([...dn.keys(), ...dl.keys()])) {
    const rec = M.records.get(id);
    const late = !dn.has(id), distance = late ? dl.get(id) : dn.get(id);
    const own = seedsOf.get(id) || [];
    const edgeReasons = [];
    for (const e of inc.get(id) || []) {
      if (!upReached.has(e.from)) continue;
      edgeReasons.push({ from: e.from, text: e.verb === 'applies' ? `${e.from} applies its Check ${e.check}` : e.verb === 'bounded by' ? `bounds ${e.from}`
        : e.verb === 'practice' ? `${e.from} holds a Check on this practice` : `${e.from} ${e.verb} it` });
    }
    for (const r of downOf.get(id) || []) {
      edgeReasons.push({ from: r.from, text: r.verb === 'practice' ? `holds this project's own Check on ${r.from}`
        : r.verb === 'bounded by' ? `is bounded by ${r.from}` : `${r.verb} ${r.from}` });
    }
    edgeReasons.sort((a, b) => cmpKey(orderKey(a.from), orderKey(b.from)));
    const reasons = [...new Set([...own.filter((s) => !s.pack).map((s) => s.reason), ...edgeReasons.map((x) => x.text),
      ...(whole.has(id) ? ['bounds the whole product'] : []), ...own.filter((s) => s.pack).map((s) => s.reason)])];
    const marked = new Set();
    for (const s of own) for (const m of s.marks || []) marked.add(m);
    for (const e of inc.get(id) || []) if (e.verb === 'applies' && upReached.has(e.from)) marked.add(e.check);
    const tier = late ? 4 : distance === 0 ? 1 : distance === 1 ? 2 : 3;
    const order = rec.checks.map((c) => c.id);
    list.push({ id, tier, distance, late, reasons, marked: order.filter((c) => marked.has(c)), layer: rec.layer });
  }
  list.sort((a, b) => cmpKey([a.tier, a.distance, LAYER_ORDER.indexOf(a.layer), a.id], [b.tier, b.distance, LAYER_ORDER.indexOf(b.layer), b.id]));
  const records = list.map(({ layer, ...x }) => x);
  return { records, checks: records.flatMap((it) => M.records.get(it.id).checks.map((c) => c.id)), wordHits };
}
