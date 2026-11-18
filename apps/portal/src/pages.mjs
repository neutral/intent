// Each page of the portal as a function from the model to a whole HTML document. A page reads no file and no clock:
// everything it shows is an argument. Every link to another page of the portal is relative, through `up`, the way home.
import path from 'node:path';
import { esc, renderMarkdown, inline } from './markdown.mjs';
import * as m from './model.mjs';

/** The Content Security Policy every page carries: its own stylesheet, script and modules, requests to its own origin, and nothing else. */
export const CSP = "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'";
const NOT_CHECKED = {
  intent: ['whether a record says what you want', 'whether a relation is true', 'whether a Check would fail a wrong program'],
  gaps: ['what records mean', 'whether a Check is strong', 'whether a reread recorded by a stamp happened'],
  reports: ['whether a report is true, or who judged'],
};
const stamp = (d) => d.toISOString().slice(0, 16).replace('T', ' ');
const home = (up) => up || './';

/** A whole page: the strip, the main part and the foot. */
function page({ ctx, up, title, current, body, foot = true, notChecked = NOT_CHECKED.intent, wide = false }) {
  const { M, name, served, readAt } = ctx;
  const place = (key, label, href) => `<a href="${up}${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  // A fault is something broken, not work waiting: what Validate finds stands over every page, going to its list on Gaps.
  const notice = M ? m.noticeOf(M) : null;
  const footer = foot ? `<footer class="foot">
<p class="says">Read from the files at ${stamp(readAt)} UTC.</p>
${notChecked.length ? `<p class="cap">Not checked</p>\n<ul class="says">${notChecked.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
</footer>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${up}_/sheet.css">
<script type="module" src="${up}_/portal.js"></script>
</head>
<body data-up="${up}"${served ? ' data-served' : ''}>
<div class="sheet">
<header class="strip">
<a class="title" href="${home(up)}">${esc(name)}</a>
<nav class="places" aria-label="Pages">${place('gaps', 'Gaps', '_/gaps/')}${served ? place('review', 'Review', '_/review/') + place('reports', 'Reports', '_/reports/') : ''}</nav>
<div class="tools"><a class="control" href="${home(up)}" data-outline>Outline</a><a class="control help" href="${up}_/help/" data-help aria-label="Help">?</a></div>
</header>
${notice ? `<p class="notice"><a href="${up}_/gaps/#faults">Validate: ${esc(notice.count)}.</a>${notice.errors ? ' The pages are made from what could be read.' : ''}</p>\n` : ''}<main class="page${wide ? ' wide' : ''}" id="main">
${body}
</main>
${footer}
</div>
</body>
</html>
`;
}

/** How a page links what a record's text names: a record or Check ID the project holds, and a relative link to a record's file. */
function links(ctx, up, rec) {
  const { M } = ctx;
  return {
    idLink: (id) => (M.records.has(id) ? up + m.recordHref(id) : M.checks.has(id) ? up + m.checkHref(M, id) : null),
    link: (target) => {
      if (!rec || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) return null;
      const [file] = target.split('#');
      const at = path.posix.normalize(path.posix.join(path.posix.dirname(rec.file), decodeURIComponentSafe(file)));
      const to = M.byFile.get(at);
      return to ? up + m.recordHref(to.id) : null;
    },
  };
}
function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch { return s; } }

const mark = (cls, words) => ` <span class="${cls}">${esc(words)}</span>`;
const hasNoCheck = (rec) => (rec.layer === 'behavior' || rec.layer === 'assurance') && !rec.checks.length;
const recordMarks = (M, rec) => [
  ...(hasNoCheck(rec) ? [mark('red', 'no Check')] : []),
  ...(m.mayBeOutOfDate(M, rec) ? [mark('red', 'may be out of date')] : []),
  ...(rec.wholeProduct ? [mark('blue', 'bounds the whole product')] : []),
].join('');

/** A set holding more than this many items draws every folder in it closed: past it, a list is too long to read whole. */
const FOLD_ABOVE = 40;

/** The sets of Home: the project's own intent, then the Disciplines. Home's body, and what Outline lays over a page. */
function sets(ctx, up, current = null) {
  const { M } = ctx;
  const here = (id) => (id === current ? ' aria-current="page"' : '');
  const item = (r) => `<li><a class="name" href="${up}${m.recordHref(r.id)}"${here(r.id)}>${esc(m.titleOf(r))}</a>${recordMarks(M, r)}${r.summary
    ? `<p class="summary">${inline(r.summary, links(ctx, up, r))}</p>` : ''}</li>`;
  // What a closed folder says of what it hides: each red mark inside it with how many carry it, as Drift writes `never stamped: 0`.
  const tally = (pairs) => pairs.filter(([, n]) => n > 0).map(([words, n]) => mark('red', `${words}: ${n}`)).join('');
  const late = (recs) => recs.filter((r) => m.mayBeOutOfDate(M, r)).length;
  // A layer's records under the folders they sit in, as the Descriptions tree holds the code: a folder's name is a label,
  // and in a folded set it opens and closes the folder.
  const list = (layer) => {
    const n = m.recordsOf(M, layer).length, fold = n > FOLD_ABOVE;
    const within = (node) => [...node.records, ...node.folders.flatMap(within)];
    const level = (node) => [...node.folders.map((f) => (fold ? closedFolder(f) : `<li class="folder"><span class="path">${esc(f.name)}/</span>
<ul class="items">${level(f)}</ul></li>`)), ...node.records.map(item)].join('\n');
    const closedFolder = (f) => {
      const recs = within(f);
      return `<li class="folder"><details><summary><span class="path">${esc(f.name)}/</span> <span class="says">${esc(m.L.count(recs.length, m.KIND[layer]))}</span>${tally([
        ['no Check', recs.filter(hasNoCheck).length], ['may be out of date', late(recs)]])}</summary>
<ul class="items">${level(f)}</ul></details></li>`;
    };
    return set(layer, n, n ? `<ul class="items">${level(m.recordTree(M, layer))}</ul>` : '<p class="says none">none</p>');
  };
  const set = (layer, n, inner) => `<section class="set" id="${m.SET[layer].toLowerCase()}">
<div class="set-head"><h2 class="cap">${m.SET[layer]}</h2><p class="count says">${n}</p><p class="gloss says">${m.SAYS[layer]}</p></div>
<div class="set-body">${inner}</div>
</section>`;
  const { root, tree } = m.codeTree(M);
  const desc = (r) => `<a href="${up}${m.recordHref(r.id)}"${here(r.id)}>${esc(m.titleOf(r))}</a>${m.mayBeOutOfDate(M, r) ? mark('red', 'may be out of date') : ''}`;
  const filesWithin = (node) => [...node.files, ...node.folders.flatMap(filesWithin)];
  const descriptionsWithin = (node) => [...new Set([...node.files.flatMap((f) => f.by),
    ...node.folders.flatMap((sub) => [...(sub.description ? [sub.description] : []), ...descriptionsWithin(sub)])])];
  const folder = (node) => {
    const head = `<span class="path">${esc(node.name)}/</span>${node.description ? ` ${desc(node.description)}` : ''}`;
    if (!foldCode) return `<li class="folder">${head}${branch(node)}</li>`;
    const inside = filesWithin(node);
    return `<li class="folder"><details><summary>${head} <span class="says">${esc(m.L.count(inside.length, 'file'))}</span>${tally([
      ['nothing explains it', inside.filter((f) => !f.by.length).length], ['may be out of date', late(descriptionsWithin(node))]])}</summary>${branch(node)}</details></li>`;
  };
  const branch = (node) => {
    const inner = [...node.folders.map(folder), ...node.files.map((f) => `<li class="file"><span class="path">${esc(f.name)}</span> ${f.by.length
      ? f.by.map(desc).join(' · ') : '<span class="red">nothing explains it</span>'}</li>`)];
    return inner.length ? `<ul class="tree">${inner.join('\n')}</ul>` : '';
  };
  const files = M.code.length, explained = M.code.filter((f) => M.explained.has(f)).length, foldCode = files > FOLD_ABOVE;
  const code = set('description', `${files} ${files === 1 ? 'file' : 'files'}, ${explained} explained`,
    `${root ? `<p class="root"><span class="path">the project root</span> ${desc(root)}</p>` : ''}${branch(tree) || '<p class="says none">none</p>'}`);
  // The Disciplines come from Packs, not from the project, so they stand last: each Pack a label over its Disciplines, as a folder is.
  const { packs, loose } = m.disciplinesOf(M);
  const foldPacks = m.recordsOf(M, 'discipline').length > FOLD_ABOVE;
  const pack = (p, name, applies = '') => {
    const body = `${p.faults.length ? faultList(p.faults) : ''}
${p.disciplines.length ? `<ul class="items">${p.disciplines.map(item).join('\n')}</ul>` : '<p class="says none">none</p>'}`;
    if (!foldPacks) return `<li class="folder pack" id="pack-${esc(p.name)}"><p class="pack-head">${name}${applies}</p>${body}</li>`;
    return `<li class="folder pack" id="pack-${esc(p.name)}"><details><summary class="pack-head">${name} <span class="says">${esc(m.L.count(p.disciplines.length, 'Discipline'))}</span>${applies}${tally([
      ['faults', p.faults.length], ['may be out of date', late(p.disciplines)]])}</summary>${body}</details></li>`;
  };
  const packItems = [...packs.map((p) => pack(p, `<span class="path">${esc(p.name)} ${esc(p.version)}</span>`, ` <span class="says">applies to ${p.applies.length
    ? p.applies.map((x) => `<code>${esc(x)}</code>`).join(', ') : 'nowhere'}</span>`)), ...loose.map((f) => pack(f, `<span class="path">${esc(f.name)}</span>`))];
  const disciplines = set('discipline', m.recordsOf(M, 'discipline').length,
    packItems.length ? `<ul class="items">${packItems.join('\n')}</ul>` : '<p class="says none">No Pack is adopted.</p>');
  return `<div class="sets" data-sets>
${list('behavior')}
${list('assurance')}
${list('blueprint')}
${code}
${disciplines}
</div>`;
}

export function homePage(ctx) {
  return page({ ctx, up: '', title: ctx.name, current: 'home', body: `<div class="home">
<h1>${esc(ctx.name)}</h1>
${sets(ctx, '')}
</div>` });
}

/** A Check drawn where it is written: its slug and ID, its parts, and how it is applied. */
function checkHtml(ctx, up, rec, b) {
  const { M } = ctx;
  const c = b.check, opts = links(ctx, up, rec);
  const parts = [['Claim', c.claim], ['Holds when', c.holdsWhen], ['Fails when', c.failsWhen], ['Evidence', c.evidence], ['Limits', c.limits]]
    .filter(([, v]) => v).map(([label, v]) => `<dt>${label}</dt><dd>${inline(v, opts)}</dd>`);
  const how = m.howApplied(M, c);
  const applied = how.ties.length
    ? `<span class="says">test: ${how.ties.map((t) => `<a href="${up}${m.recordHref(t.by)}">${esc(t.path)}</a> "${esc(t.test)}"`).join('; ')}</span>`
    : `${c.appliedBy === null && b.appliedWritten ? `${esc(b.appliedWritten)} ` : ''}<span class="${how.attend ? 'red' : 'says'}">${esc(how.words)}</span>`;
  const stray = b.stray.length ? `<div class="unread">${faultList(b.faults)}<pre>${esc(b.stray.join('\n'))}</pre></div>` : '';
  return `<section class="check" id="check-${esc(c.slug)}">
<h3 class="check-head"><span class="cap">Check</span> <span class="slug">${esc(c.slug)}</span></h3>
<p class="id"><code class="select">${esc(c.id)}</code></p>
<dl class="parts">
${parts.join('\n')}
<dt>Applied by</dt><dd>${applied}</dd>
</dl>
${stray}</section>`;
}

/** What Validate says of lines it could not read, in red, as it prints it. */
const faultList = (faults) => `<ul class="red">${faults.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`;

/** A record's kind: the layer's word in small capitals, and its place or Pack as Intent writes it. */
function kindHtml(M, rec) {
  const k = m.kindOf(M, rec);
  return `<p class="kind"><span class="cap">${esc(k.kind)}</span>${k.detail ? `<span class="says"> · ${esc(k.detail)}</span>` : ''}</p>`;
}

/** A record as its page's main column draws it, and as an opened record shows it beside another page. */
function recordHtml(ctx, up, rec) {
  const { M } = ctx;
  const opts = links(ctx, up, rec);
  const late = m.outOfDate(M, rec), faults = m.faultsOf(M, rec.file);
  const blocks = m.textBlocks(M, rec).map((b) => (b.type === 'md' ? renderMarkdown(b.lines, opts) : b.type === 'check' ? checkHtml(ctx, up, rec, b)
    : `<div class="unread">${faultList(b.faults)}<pre>${esc(b.lines.join('\n'))}</pre></div>`));
  return `<article class="record" data-record="${esc(rec.id)}" data-href="${esc(up + m.recordHref(rec.id))}">
${kindHtml(M, rec)}
<h1>${esc(m.titleOf(rec))}</h1>
<p class="id"><code class="select">${esc(rec.id)}</code></p>
${late.length ? `<div class="marks"><p class="cap red">May be out of date</p><ul class="says">${late.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
${faults.length ? `<div class="marks"><p class="cap red">Faults</p><ul class="says">${faults.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
${rec.summary ? `<p class="summary">${inline(rec.summary, opts)}</p>` : ''}
<div class="body">
${blocks.join('\n')}
</div>
</article>`;
}

/** The margin: the record's relations in both directions, in their fixed frame. */
function marginHtml(ctx, up, rec) {
  const { M } = ctx;
  const g = m.marginOf(M, rec);
  const opens = (it) => `<a class="opens${it.mono ? ' mono' : ''}" href="${up}${m.recordHref(it.id)}" data-open="${esc(it.id)}">${esc(it.name)}</a>`;
  const group = (title, inner) => `<section class="group"><h2 class="cap">${title}</h2>${inner}</section>`;
  if (rec.layer === 'discipline') {
    return group('Pack', g.pack ? `<p><a href="${home(up)}#pack-${esc(g.pack.name)}">${esc(g.pack.name)}${g.pack.version ? ` ${esc(g.pack.version)}` : ''}</a></p>`
      : '<p class="says none">none</p>')
      + group('Where it applies', g.applies.length ? `<ul>${g.applies.map((x) => `<li><code>${esc(x)}</code></li>`).join('')}</ul>` : '<p class="says none">nowhere</p>')
      + group("The project's own rule", g.rules.length ? `<ul>${g.rules.map((it) => `<li>${opens(it)}</li>`).join('')}</ul>` : '<p class="says none">none</p>');
  }
  const item = (it) => {
    if (it.text !== undefined) return `<li><span class="path">${esc(it.text)}</span></li>`;
    const ties = (it.ties ?? []).length ? `<ul class="ties">${it.ties.map((t) => `<li><span class="slug">${esc(t.slug)}</span> "${esc(t.test)}"${t.missing
      ? mark('red', t.missing) : ''}</li>`).join('')}</ul>` : '';
    return `<li>${opens(it)}${ties}</li>`;
  };
  const groups = g.groups.map((x) => group(x.title, x.phrases.length
    ? x.phrases.map((p) => `<p class="phrase says">${esc(p.phrase)}</p>${p.items.length ? `<ul>${p.items.map(item).join('')}</ul>` : ''}`).join('')
    : '<p class="says none">none</p>'));
  if (g.notLinked.length) groups.push(group('Not linked', `<ul>${g.notLinked.map((x) => `<li><code>${esc(x.text)}</code>${x.faults.length ? faultList(x.faults) : ''}</li>`).join('')}</ul>`));
  return groups.join('\n');
}

export function recordPage(ctx, rec) {
  const up = '../../';
  return page({ ctx, up, title: `${m.titleOf(rec)} · ${ctx.name}`, current: null, body: `<div class="doc">
<div class="row">
${recordHtml(ctx, up, rec)}
<aside class="margin" aria-label="Relations">
${marginHtml(ctx, up, rec)}
</aside>
</div>
</div>` });
}

/** Gaps: what Gaps finds, under its headings; then what Drift finds, under `Drift`; then, only when it finds any, what Validate finds. */
export function gapsPage(ctx) {
  const up = '../../';
  const { M } = ctx;
  const w = m.gapsOf(M), notice = m.noticeOf(M);
  const go = (rec) => `<a href="${up}${m.recordHref(rec.id)}">${esc(m.nameOf(rec))}</a>`;
  const part = (h, id, title, n, inner) => `<section class="set" id="${id}"><div class="set-head"><${h} class="cap">${title}</${h}><p class="count says">${n}</p></div>
<div class="set-body">${n ? inner : '<p class="says none">none</p>'}</div></section>`;
  const ul = (items) => `<ul class="items">${items.join('\n')}</ul>`;
  const gaps = [
    part('h2', 'code', 'Code nobody explains', w.code.length, ul(w.code.map((x) => `<li><span class="path">${esc(x.item)}</span>${x.note ? ` <span class="says">${esc(x.note)}</span>` : ''}<p class="command"><code class="select">${esc(x.command)}</code></p></li>`))),
    part('h2', 'no-check', 'Behaviors and Assurances with no Check', w.noCheck.length, ul(w.noCheck.map((r) => `<li>${go(r)}</li>`))),
    part('h2', 'nothing-applies', 'Checks nothing applies', w.nothingApplies.length, ul(w.nothingApplies.map((x) => `<li><a class="check-id" href="${up}${m.checkHref(M, x.id)}"><code>${esc(x.id)}</code></a><p class="says">${esc(x.why)}</p></li>`))),
    part('h2', 'relate-to-nothing', 'Descriptions that relate to nothing', w.lonely.length, ul(w.lonely.map((r) => `<li>${go(r)}</li>`))),
  ];
  const drift = [
    part('h3', 'changed', 'Sources changed', w.changed.length, ul(w.changed.map((x) => `<li>${go(x.rec)}<ul class="says">${x.changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></li>`))),
    part('h3', 'never-stamped', 'Never stamped', w.never.length, ul(w.never.map((r) => `<li>${go(r)}</li>`))),
  ];
  const validate = notice ? `<h2 class="part-title" id="faults">Validate</h2>
<div class="sets">
${part('h3', 'fault-list', 'Faults', notice.count, ul(w.faults.map((f) => `<li class="says">${f.rec ? `<a href="${up}${m.recordHref(f.rec.id)}">${esc(f.text)}</a>` : esc(f.text)}</li>`)))}
</div>` : '';
  return page({ ctx, up, title: `Gaps · ${ctx.name}`, current: 'gaps', notChecked: NOT_CHECKED.gaps, body: `<div class="home">
<h1>Gaps</h1>
<div class="sets">
${gaps.join('\n')}
</div>
<h2 class="part-title">Drift</h2>
<div class="sets">
${drift.join('\n')}
</div>
${validate}
</div>` });
}

export function reviewPage(ctx, r, { base }) {
  const up = '../../';
  const { M } = ctx;
  const go = (id, name) => (M.records.has(id) ? `<a href="${up}${m.recordHref(id)}">${esc(name)}</a>` : esc(name));
  const ids = (list) => list.map((id) => go(id, M.records.has(id) ? m.nameOf(M.records.get(id)) : id)).join(', ');
  let body;
  if (r.refusal) {
    body = `<pre class="says refusal">${esc(r.refusal.text)}</pre>
<p class="says">Start the portal with the state to compare with: <code class="select">intent portal --base REV</code></p>`;
  } else {
    const head = (rec, word, linkTitle = true) => `<h3 class="change-head"><span class="red">${word}</span> <span class="cap">${esc(m.KIND[rec.layer])}</span> ${linkTitle
      ? go(rec.id, m.titleOf(rec)) : `<span class="gone">${esc(m.titleOf(rec))}</span>`}</h3>
<p class="id"><code class="select">${esc(rec.id)}</code></p>`;
    const sec = [];
    if (r.project.length) sec.push(`<section class="set"><div class="set-head"><h2 class="cap">Project file</h2></div><div class="set-body"><ul class="says">${r.project.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></section>`);
    if (r.added.length) sec.push(`<section class="set"><div class="set-head"><h2 class="cap">Added</h2><p class="count says">${r.added.length}</p></div><div class="set-body">${r.added.map(({ rec }) => `<div class="change">${head(rec, 'added')}
${rec.checks.length ? `<p class="says">Checks: ${rec.checks.map((c) => `<a href="${up}${m.recordHref(rec.id)}#check-${esc(c.slug)}">${esc(c.slug)}</a>`).join(', ')}</p>` : ''}
${rec.relations.length ? `<ul class="says">${rec.relations.map((x) => `<li><code>${esc(x.text)}</code></li>`).join('')}</ul>` : ''}</div>`).join('\n')}</div></section>`);
    if (r.removed.length) sec.push(`<section class="set"><div class="set-head"><h2 class="cap">Removed</h2><p class="count says">${r.removed.length}</p></div><div class="set-body">${r.removed.map(({ rec, relatedFrom }) => `<div class="change">${head(rec, 'removed', false)}
<p class="says">at the base, ${esc(rec.file)}</p>${relatedFrom.length ? `<p class="says">related from: ${ids(relatedFrom)}</p>` : ''}</div>`).join('\n')}</div></section>`);
    if (r.changed.length) sec.push(`<section class="set"><div class="set-head"><h2 class="cap">Changed</h2><p class="count says">${r.changed.length}</p></div><div class="set-body">${r.changed.map((x) => `<div class="change">${head(x.now, 'changed')}
${x.items.map((it) => changeItem(it, up, x.now)).join('\n')}
${x.readAgainstIt.length ? `<p class="says">read against it: ${ids(x.readAgainstIt)}</p>` : ''}
${x.relatedFrom.length ? `<p class="says">related from: ${ids(x.relatedFrom)}</p>` : ''}
${x.appliedBy.length ? `<p class="says">applied by: ${ids(x.appliedBy)}</p>` : ''}</div>`).join('\n')}</div></section>`);
    if (r.dangling.length) sec.push(`<section class="set"><div class="set-head"><h2 class="cap">Dangling references</h2></div><div class="set-body"><ul class="says">${r.dangling.map((d) => `<li>${esc(m.L.printDiagnostic(d))}</li>`).join('')}</ul></div></section>`);
    if (r.judged.length) sec.push(`<section class="set"><div class="set-head"><h2 class="cap">For a judge of each new or changed Check's strength</h2></div><div class="set-body"><ul class="items">${r.judged.map((id) => `<li><a href="${up}${m.checkHref(M, id)}"><code>${esc(id)}</code></a><p class="command"><code class="select">intent read ${esc(id)}</code></p></li>`).join('\n')}</ul></div></section>`);
    const limits = [...r.outOfDate.map((x) => `may be out of date: ${x}`), ...r.couldNotRead.map((x) => `could not read: ${x}`)];
    body = `<p class="says">${esc(r.heading)}</p>
${sec.length ? `<div class="sets">${sec.join('\n')}</div>` : `<p>Nothing in the intent differs from ${esc(base ?? 'the base')}.</p>`}
${limits.length ? `<ul class="says limits">${limits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
  }
  return page({ ctx, up, title: `Review · ${ctx.name}`, current: 'review', notChecked: [], body: `<div class="home review-page">
<h1>Review</h1>
${body}
<p class="says judged"><span class="cap">Not judged</span> what each change means, and whether it is right: that is yours to judge. Nothing records who judged.</p>
</div>` });
}

/** One change Review names in a record, drawn: a section's lines struck or ruled in red, a Check's parts now and before. */
function changeItem(it, up, rec) {
  if (it.kind === 'moved') return `<p class="says">moved from ${esc(it.from)}</p>`;
  if (it.kind === 'title' || it.kind === 'summary') {
    return `<div class="part"><p class="says">${it.kind}</p><p>${esc(it.now)}</p><details class="before"><summary>Before</summary><p>${esc(it.was)}</p></details></div>`;
  }
  if (it.kind === 'section') {
    const lines = (it.diff ?? []).map((d) => (d.startsWith('- ') ? `<li class="gone">${esc(d.slice(2)) || '&nbsp;'}</li>` : `<li class="added">${esc(d.slice(2)) || '&nbsp;'}</li>`));
    return `<div class="part"><p class="says">section "${esc(it.name)}" <span class="red">${it.change}</span></p>${lines.length ? `<ul class="diff">${lines.join('')}</ul>` : ''}</div>`;
  }
  if (it.kind === 'check') {
    const name = it.change === 'removed' ? `<span class="gone">${esc(it.slug)}</span>` : `<a href="${up}${m.recordHref(rec.id)}#check-${esc(it.slug)}">${esc(it.slug)}</a>`;
    const fields = (it.fields ?? []).map((f) => `<div class="field"><p class="says">${esc(f.label)}</p><p>${f.now ? esc(f.now) : '<span class="says">(none)</span>'}</p><details class="before"><summary>Before</summary><p>${f.was ? esc(f.was) : '<span class="says">(none)</span>'}</p></details></div>`);
    return `<div class="part"><p class="says">Check ${name} <span class="red">${it.change}</span></p>${fields.join('')}</div>`;
  }
  if (it.kind === 'relation') return `<p class="says">relation <span class="red">${it.change}</span>: <code${it.change === 'removed' ? ' class="gone"' : ''}>${esc(it.text)}</code></p>`;
  return '<p class="blue">stamp rewritten</p>';
}

export function reportsPage(ctx, r) {
  const up = '../../';
  const rows = r.kept.map((k) => `<li><a class="name" href="${up}_/reports/${esc(k.name)}/">${esc(k.name)}</a><p class="says">kept ${esc(k.h.kept)}: ${k.h.paths.length} ${k.h.paths.length === 1 ? 'path' : 'paths'} ${k.h.given ? 'given'
    : `since ${esc(k.h.base ? k.h.base.slice(0, 7) : 'its base')}`}, revision ${esc(k.h.revision ? k.h.revision.slice(0, 7) : 'none')}${k.h.codeMoved ? '; the code moved after its form was made' : ''}</p></li>`);
  return page({ ctx, up, title: `Reports · ${ctx.name}`, current: 'reports', notChecked: NOT_CHECKED.reports, body: `<div class="home">
<h1>Reports</h1>
<p class="says lead">Each report is one agent's account of its change, and nothing adds them up.</p>
${rows.length ? `<ul class="items reports">${rows.join('\n')}</ul>` : '<p class="says none">No report is kept.</p>'}
${r.unreadable.length ? `<ul class="says">${r.unreadable.map((x) => `<li><span class="red">could not read</span> ${esc(x)}</li>`).join('')}</ul>` : ''}
${r.forms ? `<p class="says">Not listed: ${r.forms} ${r.forms === 1 ? 'unkept form' : 'unkept forms'} in intent/.reports/, which ${r.forms === 1 ? 'is' : 'are'} no account.</p>` : ''}
</div>` });
}

export function reportPage(ctx, k) {
  const up = '../../../';
  const { M } = ctx;
  const blocks = k.body.blocks.map((b) => `<section class="check report-block">
<h3 class="check-head">${M.checks.has(b.check) ? `<a href="${up}${m.checkHref(M, b.check)}"><code>${esc(b.check)}</code></a>` : `<code>${esc(b.check)}</code>`}</h3>
<dl class="parts"><dt>Result</dt><dd>${esc(b.result ?? '(not read)')}</dd><dt>Applied by</dt><dd>${esc(b.appliedBy)}</dd><dt>Evidence</dt><dd>${esc(b.evidence)}</dd><dt>Judged by</dt><dd>${esc(b.judgedBy)}</dd></dl>
</section>`);
  const handed = ['Tests that apply Checks', 'Intent that looked missing, wrong or unclear'].map((sub) => `<section class="set"><div class="set-head"><h2 class="cap">${sub}</h2></div>
<div class="set-body">${(k.body.handingOn[sub] ?? []).length ? `<ul class="items">${k.body.handingOn[sub].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="says none">none</p>'}</div></section>`);
  return page({ ctx, up, title: `Report ${k.name} · ${ctx.name}`, current: 'reports', notChecked: NOT_CHECKED.reports, body: `<div class="home">
<p class="kind cap">Kept report</p>
<h1>${esc(k.name)}</h1>
<p class="says lead">One agent's account of one change. Nothing here says that a Check passes.</p>
<p class="says">kept ${esc(k.h.kept)}; revision ${esc(k.h.revision ?? 'none')}; ${k.h.given ? 'paths given' : `since ${esc(k.h.base ?? 'its base')}`}: ${k.h.paths.map((p) => `<code>${esc(p)}</code>`).join(', ')}</p>
${blocks.join('\n')}
<h2 class="cap handing">Handing on</h2>
<div class="sets">${handed.join('\n')}</div>
</div>` });
}

const WORDS = [
  ['Behavior', 'One outcome that a person or a system obtains from the software, under the conditions it names.'],
  ['Assurance', 'One quality the software must have, in its performance, reliability, security, privacy, accessibility, compatibility or compliance. It applies to the Behaviors it is related to, or to the whole product.'],
  ['Blueprint', 'One agreement about structure: the decision, what it serves, what was rejected, and the cost accepted.'],
  ['Description', 'How one unit of code works now, placed at the mirror of the code it explains.'],
  ['Discipline', "One practice, from a Pack: a set of Disciplines released under a name and a version, which the project adopted as released."],
  ['Check', 'A claim about the software that can be shown false, written inside the record whose meaning it protects.'],
  ['Relation', 'A line a record writes to name a record it relates to. It is written once, and read both ways.'],
  ['applies', "The line in the Description of a test file that ties one test to one Check. It is in force while the test's name occurs in that file."],
];
const MOVES = [
  ['An underlined name', 'goes to the page of what it names.'],
  ['▸ A name in a margin', 'opens that record in a panel over the page, with its own margin, whose names open panels within it. Close or Escape closes it and brings you back to the name. Without the script, it goes there.'],
  ['▸ A folder', 'in a set of more than 40 items, opens and closes what the folder holds. Closed, it says how many it holds and each red mark inside it, with how many carry it.'],
  ['Gaps', 'lists the work nobody has done, as intent gaps finds it, and what intent drift finds; and, when intent validate finds a fault, every fault.'],
  ['Review', 'shows what changed in the intent since the base, as intent review finds it. Only on your machine.'],
  ['Reports', 'lists the reports agents kept, each one agent\'s account of its change. Only on your machine.'],
  ['Outline', 'lays Home over the page: every Behavior, Assurance, Blueprint and code file, and last the Disciplines.'],
  ['Search', 'ranks the records by the words typed, as intent search does. A record ID, a Check ID or a code path goes straight there.'],
  ['An ID', 'is selected whole by one click, to hand to an agent.'],
];
const MARKS = [
  ['may be out of date', 'a source of the record changed since it was last read against it.'],
  ['no Check', 'a Behavior or Assurance with no Check.'],
  ['test: none named yet', 'a Check applied by a test, with no test named in force.'],
  ['nothing explains it', 'code no Description explains.'],
  ['Not linked', 'a relation that is not linked, with what Validate says of it. Intent does not follow it.'],
  ['bounds the whole product', 'an Assurance that applies to everything.'],
  ['added, changed, removed', 'what Review finds since the base, on Review.'],
  ['Validate:', 'over every page when intent validate finds a fault: how many errors and warnings, going to the list on Gaps.'],
  ['Before', 'what a changed part said at the base.'],
];

/** What Help names only where its strip holds Review and Reports: on the service, never in an export. */
const SERVED_ONLY = new Set(['Review', 'Reports', 'added, changed, removed', 'Before']);

export function helpPage(ctx) {
  const up = '../../';
  const dl = (pairs) => `<dl>${pairs.filter(([t]) => ctx.served || !SERVED_ONLY.has(t)).map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`;
  return page({ ctx, up, title: `Help · ${ctx.name}`, current: 'help', foot: false, body: `<div class="home help" data-help-text>
<h1>Help</h1>
<section><h2 class="cap">The words</h2>${dl(WORDS)}</section>
<section><h2 class="cap">Moving around</h2>${dl(MOVES)}</section>
<section><h2 class="cap">The marks</h2>${dl(MARKS)}<p class="says">A mark in red needs your attention, and always comes with its words.</p></section>
<section><h2 class="cap">What Intent cannot know</h2><p>Whether a record says what you want. Whether a relation is true. Whether a Check would fail a wrong program. Whether the test tied to a Check still decides all of it. Whether a report is true, or who judged. Whether a declared reread happened. Each is somebody's judgment, and the pages never make it.</p></section>
<section><h2 class="cap">Changing the intent</h2><p>The portal writes nothing. To change a record, ask an agent, naming it by its ID; the page shows the change once it is made.</p></section>
</div>` });
}

export function notFoundPage(ctx, up) {
  return page({ ctx, up, title: `Nothing here · ${ctx.name}`, current: null, foot: false, body: `<div class="home">
<h1>Nothing is here</h1>
<p>No page of the portal has this address. <a href="${home(up)}">Home</a> lists the project's intent.</p>
</div>` });
}

export function noProjectPage(ctx) {
  return page({ ctx: { ...ctx, M: null }, up: '', title: 'No intent here', current: null, foot: false, body: `<div class="home">
<h1>No intent/ here</h1>
<p>The folder the portal was started for no longer holds <code>intent/intent.json</code>. <code class="select">intent start</code> creates it.</p>
</div>` });
}
