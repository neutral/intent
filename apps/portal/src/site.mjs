// The portal's addresses: what answers each one, for the service and the export alike, from the project read at that moment.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as m from './model.mjs';
import * as P from './pages.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JS = 'text/javascript; charset=utf-8', HTML = 'text/html; charset=utf-8';
/** The files the portal serves as they are: its stylesheet and script, and the Library's ranking with the text rules it needs. */
export const ASSETS = {
  '_/sheet.css': { file: path.join(HERE, '../assets/sheet.css'), type: 'text/css; charset=utf-8' },
  '_/portal.js': { file: path.join(HERE, '../assets/portal.js'), type: JS },
  '_/rank.mjs': { file: path.join(HERE, '../../../library/src/rank.mjs'), type: JS },
  '_/plain.mjs': { file: path.join(HERE, '../../../library/src/plain.mjs'), type: JS },
};
const RECORD = /^(behavior|assurance|blueprint|description|discipline)\/([a-z0-9_](?:[a-z0-9._-]*[a-z0-9_])?)\/$/;
const REPORT = /^_\/reports\/([^/]+)\/$/;
/** The way home from an address, as a relative prefix. */
export const upOf = (rel) => '../'.repeat((rel.match(/\//g) || []).length);

/**
 * What answers the address `rel` (the path after the first `/`, as asked for): {status, type, body}, or
 * {status: 308, location} for a page asked for without its last `/` and for the Disciplines' old address. `served` says whether
 * the page is served, so that Review and Reports exist; `base` is the base Review compares with; `now` gives the moment the files are read.
 */
export function answerAt(root, rel, { served, base, now }) {
  if (Object.hasOwn(ASSETS, rel)) return { status: 200, type: ASSETS[rel].type, body: fs.readFileSync(ASSETS[rel].file) };
  // The Disciplines stand on Home; their old address is sent there.
  if (rel === '_/disciplines/' || rel === '_/disciplines') return { status: 308, location: `${upOf(rel) || './'}#disciplines` };
  const read = m.hasProject(root) ? m.readModel(root) : null;
  const ctx = { M: read?.M ?? null, name: read?.name ?? path.basename(root), served, readAt: now() };
  if (!read) return { status: 404, type: HTML, body: P.noProjectPage(ctx) };
  if (rel === '_/search.json') return { status: 200, type: 'application/json; charset=utf-8', body: JSON.stringify(m.searchIndex(ctx.M)) };
  const page = pageAt(root, rel, ctx, { served, base });
  if (page) return { status: 200, type: HTML, body: page };
  if (!rel.endsWith('/') && pageAt(root, `${rel}/`, ctx, { served, base, probe: true })) return { status: 308, location: `${rel.slice(rel.lastIndexOf('/') + 1)}/` };
  return { status: 404, type: HTML, body: P.notFoundPage(ctx, upOf(rel)) };
}

/** The page at `rel`, or null. With `probe`, only whether there is one. */
function pageAt(root, rel, ctx, { served, base, probe = false }) {
  const { M } = ctx;
  if (rel === '') return probe || P.homePage(ctx);
  if (rel === '_/gaps/') return probe || P.gapsPage(ctx);
  if (rel === '_/help/') return probe || P.helpPage(ctx);
  if (served && rel === '_/review/') return probe || P.reviewPage(ctx, m.reviewFor(root, base), { base });
  if (served && rel === '_/reports/') return probe || P.reportsPage(ctx, m.reportsOf(root));
  const r = REPORT.exec(rel);
  if (served && r) {
    const k = m.reportsOf(root).kept.find((x) => x.name === r[1]);
    return k ? (probe || P.reportPage(ctx, k)) : null;
  }
  const x = RECORD.exec(rel);
  if (x) {
    const rec = M.records.get(`${x[1]}:${x[2]}`);
    return rec ? (probe || P.recordPage(ctx, rec)) : null;
  }
  return null;
}

/** Every address an export writes: home, each record's page, Gaps and Help, the assets and what search ranks. */
export function exportedAddresses(M) {
  return ['', ...[...M.records.keys()].sort().map(m.recordHref), '_/gaps/', '_/help/', ...Object.keys(ASSETS), '_/search.json'];
}
