// The portal's script. It adds conveniences and no content: a record opened as a panel over the page, Outline and Help laid over
// the page, and search, which ranks with the Library's own module. Without it, every name still goes to its page.
const up = document.body.dataset.up ?? '';
const homeUrl = new URL(up || './', location.href);
const pages = new Map();
/** A page of the portal, parsed, fetched once. */
function pageAt(href) {
  if (!pages.has(href)) {
    pages.set(href, fetch(href, { headers: { Accept: 'text/html' } }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    }).then((html) => new DOMParser().parseFromString(html, 'text/html')));
  }
  return pages.get(href);
}
/** A part taken from another page, with each of its links resolved from that page, so that it works where it is placed. */
function adopt(node, from) {
  const copy = document.importNode(node, true);
  for (const a of copy.querySelectorAll('a[href]')) a.setAttribute('href', new URL(a.getAttribute('href'), from).href);
  return copy;
}
const sameDoc = (a, b) => { const x = new URL(a), y = new URL(b); x.hash = ''; y.hash = ''; return x.href === y.href; };
const button = (text, cls, label) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = text; if (label) b.setAttribute('aria-label', label); return b; };

/* Panels: a name after ▸ in a margin opens its record as a panel under the record whose margin named it, with its own
   margin and Close, shifted in and scrolled into view. A holder is the page or a panel: a row (a record beside its
   margin) and, under it, at most one panel, which the one open name of that margin names. */
const doc = document.querySelector('.doc');
const items = (holder) => [...holder.querySelectorAll(':scope > .row > .margin a.opens[data-open]')];
const opener = (holder) => items(holder).find((a) => a.getAttribute('aria-expanded') === 'true');
const isChain = (hash) => hash.length > 1 && decodeURIComponent(hash.slice(1)).split('/').every((t) => /^[a-z]+:[a-z0-9_.-]+$/.test(t));

/** Write the chain of what is open, outermost first, as the address's fragment. */
function recordChain() {
  const chain = [];
  for (let holder = doc, item; holder && (item = opener(holder)); holder = holder.querySelector(':scope > .panel')) chain.push(item.dataset.open);
  if (chain.length) history.replaceState(null, '', `#${chain.join('/')}`);
  else if (isChain(location.hash)) history.replaceState(null, '', location.pathname + location.search);
}
/** Close what a holder's margin has open, and everything opened under it. */
function shut(holder) {
  holder.querySelector(':scope > .panel')?.remove();
  for (const a of items(holder)) a.setAttribute('aria-expanded', 'false');
}
/** A record's page as a panel: its record, with its kind and Close and its title going to its page, and its own margin. */
function panelOf(page, item) {
  const from = new URL(item.href);
  const rec = page.querySelector('[data-record]'), margin = page.querySelector('.row > .margin');
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.dataset.panel = item.dataset.open;
  const row = document.createElement('div');
  row.className = 'row';
  const art = adopt(rec, from);
  for (const el of art.querySelectorAll('[id]')) el.id = `panel-${el.id}`;
  const h1 = art.querySelector('h1');
  const title = document.createElement('h2');
  title.className = 'title';
  const link = document.createElement('a');
  link.href = from.href;
  link.textContent = h1.textContent;
  title.append(link);
  h1.replaceWith(title);
  art.querySelector('.kind')?.append(button('Close', 'close'));
  row.append(art);
  if (margin) {
    const m = adopt(margin, from);
    for (const h of m.querySelectorAll('h2.cap')) { const lower = document.createElement('h3'); lower.className = 'cap'; lower.append(...h.childNodes); h.replaceWith(lower); }
    for (const a of m.querySelectorAll('a.opens')) a.setAttribute('aria-expanded', 'false');
    row.append(m);
  }
  panel.append(row);
  return panel;
}
/** Open what a margin name names under the record its margin belongs to; a name that is open closes. */
async function openPanel(item, jump = true) {
  const holder = item.closest('.panel') ?? doc;
  const wasOpen = item.getAttribute('aria-expanded') === 'true';
  shut(holder);
  if (wasOpen) { recordChain(); return null; }
  let page;
  try { page = await pageAt(new URL(item.href).href); } catch { location.assign(item.href); return null; }
  if (!holder.isConnected || !page.querySelector('[data-record]')) { if (holder.isConnected) location.assign(item.href); return null; }
  shut(holder);
  const panel = holder.appendChild(panelOf(page, item));
  item.setAttribute('aria-expanded', 'true');
  recordChain();
  if (jump) panel.scrollIntoView({ block: 'start' });
  return panel;
}
/** Close a panel and those within it, and give the focus back to the name that opened it. */
function closePanel(panel) {
  const holder = panel.parentElement, item = opener(holder);
  shut(holder);
  recordChain();
  item?.focus({ preventScroll: true });
  item?.scrollIntoView({ block: 'nearest' });
}
if (doc) {
  for (const a of items(doc)) a.setAttribute('aria-expanded', 'false');
  doc.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const close = e.target.closest?.('.panel .close'), item = e.target.closest?.('.margin a.opens[data-open]');
    if (close) closePanel(close.closest('.panel'));
    else if (item) { e.preventDefault(); openPanel(item); }
  });
}

/* Outline and Help: each strip link becomes a button that lays the page it led to over this one. */
function layer(link, { pick, label }) {
  if (!link) return;
  const b = button(link.textContent, link.className, link.getAttribute('aria-label'));
  link.replaceWith(b);
  b.addEventListener('click', async () => {
    const from = new URL(link.getAttribute('href'), location.href);
    let part;
    try { part = (await pageAt(from.href)).querySelector(pick); } catch { part = null; }
    if (!part) { location.href = from.href; return; }
    const dialog = document.createElement('dialog');
    dialog.className = 'layer';
    dialog.setAttribute('aria-label', label);
    const head = document.createElement('header');
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = label;
    const close = button('Close', 'close');
    head.append(title, close);
    const body = document.createElement('div');
    body.className = 'home';
    body.append(adopt(part, from));
    for (const a of body.querySelectorAll('a[href]')) if (sameDoc(a.href, location.href)) a.setAttribute('aria-current', 'page');
    for (const a of body.querySelectorAll('[aria-current="page"]')) openAround(a);
    dialog.append(head, body);
    document.body.append(dialog);
    const done = () => { dialog.close(); };
    close.addEventListener('click', done);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) done(); });
    dialog.addEventListener('close', () => { dialog.remove(); b.focus(); });
    dialog.showModal();
    body.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'center' });
  });
}
layer(document.querySelector('.tools [data-outline]'), { pick: '[data-sets]', label: 'Outline' });
layer(document.querySelector('.tools [data-help]'), { pick: '[data-help-text]', label: 'Help' });

document.addEventListener('keydown', (e) => {
  const innermost = doc ? [...doc.querySelectorAll('.panel')].at(-1) : null;
  if (e.key === 'Escape' && innermost && !document.querySelector('dialog[open]') && document.activeElement?.type !== 'search') closePanel(innermost);
});

/* Search: a field in the strip, ranked as intent search ranks, with an exact ID or code path going straight there. */
const tools = document.querySelector('.tools');
if (tools) {
  const ask = document.createElement('div');
  ask.className = 'ask';
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Search';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Search the intent by words, an ID or a code path');
  const results = document.createElement('div');
  results.className = 'results';
  results.hidden = true;
  ask.append(input, results);
  tools.insertBefore(ask, tools.lastElementChild);
  let loaded = null, active = -1;
  const load = () => (loaded ??= Promise.all([
    fetch(new URL('_/search.json', homeUrl)).then((r) => r.json()),
    import(new URL('_/rank.mjs', homeUrl).href),
  ]).then(([index, R]) => {
    const docs = index.records.map((d) => ({ id: d.id, set: new Set([...R.unique(R.fieldsOf(d)), ...R.unique(d.prose)]),
      checkIds: d.checks.map((c) => c.id), checkSets: d.checks.map((c) => new Set(R.unique([c.claim]))) }));
    return { index, R, docs, byId: new Map(index.records.map((d) => [d.id, d])) };
  }));
  // Code point order, which is the UTF-8 byte order the Library sorts paths and IDs in.
  const order = (a, b) => {
    const x = [...a], y = [...b];
    for (let i = 0; i < Math.min(x.length, y.length); i++) { const d = x[i].codePointAt(0) - y[i].codePointAt(0); if (d) return d < 0 ? -1 : 1; }
    return x.length === y.length ? 0 : x.length < y.length ? -1 : 1;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const link = (href, kind, title, extra = [], detail = null) => {
    const a = el('a');
    a.href = new URL(href, homeUrl).href;
    const k = el('span', 'kind');
    k.append(el('span', 'cap', kind));
    if (detail) k.append(el('span', 'says', ` · ${detail}`));
    a.append(k, el('span', 'claim', title), ...extra);
    return a;
  };
  async function run() {
    const q = input.value.trim();
    active = -1;
    if (!q) { results.hidden = true; results.replaceChildren(); return; }
    const { index, R, docs, byId } = await load();
    if (input.value.trim() !== q) return;
    const list = el('ul');
    const exact = [];
    if (byId.has(q)) { const d = byId.get(q); exact.push(link(d.href, d.kind, d.name, [], d.detail)); }
    const check = index.records.find((d) => d.checks.some((c) => c.id === q));
    if (check) { const c = check.checks.find((x) => x.id === q); exact.push(link(`${check.href}#check-${c.slug}`, 'Check', `${check.name}: ${c.slug}`, [], c.id)); }
    const path = q.replace(/^\.\//, '');
    if (Object.hasOwn(index.code, path)) {
      const by = index.code[path].map((id) => byId.get(id)).filter(Boolean);
      if (by.length) for (const d of by) exact.push(link(d.href, d.kind, d.name, [], d.detail));
      else { const n = el('div', 'item'); n.append(el('span', 'red', `nothing explains ${path}`)); exact.push(n); }
    }
    const words = q.split(/\s+/).filter(Boolean);
    const { hits } = R.rank(docs, words, order);
    const shown = hits.slice(0, Math.max(0, 12 - exact.length));
    for (const n of exact) { const li = el('li'); li.append(n); list.append(li); }
    for (const h of shown) {
      const d = byId.get(h.id);
      if (exact.length && exact[0].href === new URL(d.href, homeUrl).href) continue;
      const extra = [el('span', 'excerpt', R.excerpt(d, new Set(h.stems)))];
      if (h.marked.length) extra.push(el('span', 'checks', h.marked.map((id) => `Check ${id.slice(id.lastIndexOf(':') + 1)}`).join(' · ')));
      const li = el('li');
      li.append(link(d.href, d.kind, d.name, extra, d.detail));
      list.append(li);
    }
    results.replaceChildren(list);
    if (hits.length > shown.length) results.append(el('p', 'more', `${shown.length} of ${hits.length} shown`));
    if (!list.children.length) results.append(el('p', 'more', `Nothing matches ${q}.`));
    results.hidden = false;
  }
  input.addEventListener('input', () => { run().catch(() => {}); });
  input.addEventListener('focus', () => { if (input.value.trim()) results.hidden = false; });
  input.addEventListener('keydown', (e) => {
    const items = [...results.querySelectorAll('a')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((a, k) => a.setAttribute('aria-selected', String(k === active)));
      items[active].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      const a = items[active] ?? items[0];
      if (a) { e.preventDefault(); location.href = a.href; }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.value = '';
      results.hidden = true;
      results.replaceChildren();
    }
  });
  document.addEventListener('click', (e) => { if (!ask.contains(e.target)) results.hidden = true; });
}

/* Folded sets: a place inside a closed folder is opened to, with the folders around it, and a folder it names. */
function openAround(node) {
  let opened = false;
  for (let d = node.closest('details'); d; d = d.parentElement?.closest('details')) if (!d.open) { d.open = true; opened = true; }
  return opened;
}
function openTo(hash) {
  if (hash.length < 2 || !document.querySelector('main [data-sets]')) return;
  let target;
  try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return; }
  if (!target) return;
  const own = target.querySelector(':scope > details');
  const opened = openAround(target) || (own && !own.open && (own.open = true));
  if (opened) target.scrollIntoView();
}
openTo(location.hash);
addEventListener('hashchange', () => openTo(location.hash));

/* A page loaded with a fragment that names a chain of records opens the chain again; any other fragment is the browser's. */
if (doc && isChain(location.hash)) {
  let holder = doc;
  for (const token of decodeURIComponent(location.hash.slice(1)).split('/')) {
    const item = items(holder).find((a) => a.dataset.open === token);
    holder = item && await openPanel(item, false);
    if (!holder) break;
  }
  [...doc.querySelectorAll('.panel')].at(-1)?.scrollIntoView({ block: 'start' });
  recordChain();
}
