// A record's Markdown drawn as HTML: headings, paragraphs, lists, fenced code, block quotes, tables and rules, and within
// a line code, emphasis, links and autolinks. HTML written in a record is shown as text, an image is named and never
// loaded, and a line that is not recognised is shown as written, so no text is lost.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Text made safe to stand in HTML, as text or as an attribute's value. */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const BULLET = /^( {0,3})([-*+])([ \t]+)(.*)$/;
const ORDERED = /^( {0,3})(\d{1,9})([.)])([ \t]+)(.*)$/;
const DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const blank = (l) => /^[ \t]*$/.test(l);
const indentOf = (l) => { let n = 0; for (const c of l) { if (c === ' ') n++; else if (c === '\t') n += 4 - (n % 4); else break; } return n; };
/** A line with its first `n` columns of indent removed. */
function dedent(l, n) {
  let col = 0, i = 0;
  while (i < l.length && col < n && (l[i] === ' ' || l[i] === '\t')) { col += l[i] === '\t' ? 4 - (col % 4) : 1; i++; }
  return l.slice(i);
}
const listItem = (l) => {
  const b = BULLET.exec(l);
  if (b) return { ordered: false, marker: b[2], indent: b[1].length, width: b[1].length + 1 + Math.min(b[3].length, 4), rest: b[4], start: 1 };
  const o = ORDERED.exec(l);
  if (o) return { ordered: true, marker: o[3], indent: o[1].length, width: o[1].length + o[2].length + 1 + Math.min(o[4].length, 4), rest: o[5], start: Number(o[2]) };
  return null;
};
const splitRow = (l) => {
  let t = l.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && t[i + 1] === '|') { cur += '|'; i++; } else if (t[i] === '|') { cells.push(cur.trim()); cur = ''; } else cur += t[i];
  }
  cells.push(cur.trim());
  return cells;
};
/** Whether a line begins a block other than a paragraph, so that it ends a paragraph before it. */
const interrupts = (l) => FENCE.test(l) || ATX.test(l) || RULE.test(l) || QUOTE.test(l) || !!listItem(l);

/**
 * Draw Markdown lines as HTML. `opts.link(target)` gives the address a written link goes to, or null for its words
 * alone; `opts.idLink(id)` gives the address of a record or Check ID written in the text, or null.
 */
export function renderMarkdown(lines, opts = {}) {
  return blocks(lines, opts).join('\n');
}

function blocks(lines, opts) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (blank(l)) { i++; continue; }
    const f = FENCE.exec(l);
    if (f && !(f[1][0] === '`' && f[2].includes('`'))) {
      const ch = f[1][0], n = f[1].length, ind = indentOf(l), body = [];
      i++;
      while (i < lines.length) {
        const c = /^ {0,3}(`+|~+)[ \t]*$/.exec(lines[i]);
        if (c && c[1][0] === ch && c[1].length >= n) { i++; break; }
        body.push(dedent(lines[i], ind));
        i++;
      }
      const info = f[2].trim().split(/[ \t]/)[0];
      out.push(`<pre${info ? ` data-lang="${esc(info)}"` : ''}><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    const h = ATX.exec(l);
    if (h) {
      const level = Math.max(2, h[1].length);
      out.push(`<h${level}>${inline(h[2] ?? '', opts)}</h${level}>`);
      i++;
      continue;
    }
    if (RULE.test(l)) { out.push('<hr>'); i++; continue; }
    if (QUOTE.test(l)) {
      const inner = [];
      while (i < lines.length && !blank(lines[i])) {
        const q = QUOTE.exec(lines[i]);
        if (q) inner.push(q[1]); else if (interrupts(lines[i])) break; else inner.push(lines[i]);
        i++;
      }
      out.push(`<blockquote>\n${blocks(inner, opts).join('\n')}\n</blockquote>`);
      continue;
    }
    const item = listItem(l);
    if (item) { i = list(lines, i, item, opts, out); continue; }
    if (l.includes('|') && i + 1 < lines.length && DELIMITER.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(l), align = splitRow(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null));
      const rows = [];
      i += 2;
      while (i < lines.length && !blank(lines[i]) && lines[i].includes('|') && !interrupts(lines[i])) rows.push(splitRow(lines[i++]));
      const cell = (tag, c, k) => `<${tag}${align[k] ? ` class="${align[k]}"` : ''}>${inline(c, opts)}</${tag}>`;
      out.push(`<div class="table"><table>\n<thead><tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr></thead>\n<tbody>\n${rows
        .map((r) => `<tr>${head.map((_, k) => cell('td', r[k] ?? '', k)).join('')}</tr>`).join('\n')}\n</tbody></table></div>`);
      continue;
    }
    const para = [];
    while (i < lines.length && !blank(lines[i]) && !(para.length && interrupts(lines[i]))) para.push(lines[i++].replace(/^[ \t]+/, ''));
    out.push(`<p>${inline(para.join('\n'), opts)}</p>`);
  }
  return out;
}

/** A list from line `i`, whose first item is `first`: its items, each drawn as blocks; returns the line after it. */
function list(lines, i, first, opts, out) {
  const items = [];
  let loose = false;
  while (i < lines.length) {
    const it = listItem(lines[i]);
    if (!it || it.ordered !== first.ordered || it.marker !== first.marker || it.indent > first.width - 1) break;
    const body = [it.rest];
    i++;
    let gap = false;
    while (i < lines.length) {
      const l = lines[i];
      if (blank(l)) { gap = true; body.push(''); i++; continue; }
      const ind = indentOf(l);
      if (ind >= it.width) { if (gap) loose = true; body.push(dedent(l, it.width)); gap = false; i++; continue; }
      if (gap || interrupts(l)) break;
      body.push(l.replace(/^[ \t]+/, ''));
      i++;
    }
    while (body.length && blank(body.at(-1))) body.pop();
    items.push(body);
    if (gap && !(i < lines.length && listItem(lines[i]) && listItem(lines[i]).ordered === first.ordered && listItem(lines[i]).marker === first.marker)) break;
    if (gap) loose = true;
  }
  const drawn = items.map((body) => {
    const inner = blocks(body, opts);
    const tight = !loose && inner.length && inner[0].startsWith('<p>') ? [inner[0].slice(3, -4), ...inner.slice(1)] : inner;
    return `<li>${tight.join('\n')}</li>`;
  });
  const tag = first.ordered ? 'ol' : 'ul';
  out.push(`<${tag}${first.ordered && first.start !== 1 ? ` start="${first.start}"` : ''}>\n${drawn.join('\n')}\n</${tag}>`);
  return i;
}

const ID = /(?<![\w.:-])((?:behavior|assurance|blueprint|description|discipline):[a-z0-9_](?:[a-z0-9._:-]*[a-z0-9_])?)/g;
const PUNCT = /\\([!-/:-@[-`{-~])/g;

/** One line or paragraph of Markdown drawn as HTML. */
export function inline(text, opts = {}) {
  const parts = [];
  let i = 0, plain = '';
  const flush = () => { if (plain) parts.push(textHtml(plain, opts)); plain = ''; };
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && i + 1 < text.length && /[!-/:-@[-`{-~]/.test(text[i + 1])) { plain += text.slice(i, i + 2); i += 2; continue; }
    if (c === '`') {
      const run = /^`+/.exec(text.slice(i))[0];
      const end = text.indexOf(run, i + run.length);
      let close = end;
      while (close >= 0 && text[close + run.length] === '`') close = text.indexOf(run, close + run.length + 1);
      if (close >= 0) {
        flush();
        let code = text.slice(i + run.length, close).replace(/\n/g, ' ');
        if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) code = code.slice(1, -1);
        const href = opts.idLink && /^[a-z]+:[a-z0-9_.:-]+$/.test(code) ? opts.idLink(code) : null;
        parts.push(href ? `<a href="${esc(href)}"><code>${esc(code)}</code></a>` : `<code>${esc(code)}</code>`);
        i = close + run.length;
        continue;
      }
      plain += run;
      i += run.length;
      continue;
    }
    if (c === '<') {
      const a = /^<(https?:\/\/[^\s<>]+)>/.exec(text.slice(i));
      if (a) { flush(); parts.push(external(a[1], esc(a[1]), opts)); i += a[0].length; continue; }
    }
    if (c === '!' && text[i + 1] === '[') {
      const m = linkAt(text, i + 1);
      if (m) { flush(); parts.push(`<span class="image">image: ${esc(m.label || m.target)}</span>`); i = m.end; continue; }
    }
    if (c === '[') {
      const m = linkAt(text, i);
      if (m) {
        flush();
        const label = inline(m.label, { ...opts, noLinks: true });
        const href = opts.noLinks ? null : /^https?:\/\//i.test(m.target) ? 'external' : opts.link ? opts.link(m.target) : null;
        parts.push(href === 'external' ? external(m.target, label, opts) : href ? `<a href="${esc(href)}">${label}</a>` : label);
        i = m.end;
        continue;
      }
    }
    plain += c;
    i++;
  }
  flush();
  return parts.join('');
}

/** A link `[label](target "title")` at `i`, or null. */
function linkAt(text, i) {
  let depth = 0, k = i;
  for (; k < text.length; k++) {
    if (text[k] === '\\') { k++; continue; }
    if (text[k] === '[') depth++;
    else if (text[k] === ']' && --depth === 0) break;
  }
  if (k >= text.length || text[k + 1] !== '(') return null;
  const m = /^\(\s*(<[^>]*>|[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)(?:\s+("[^"]*"|'[^']*'))?\s*\)/.exec(text.slice(k + 1));
  if (!m) return null;
  return { label: text.slice(i + 1, k), target: m[1].replace(/^<|>$/g, ''), end: k + 1 + m[0].length };
}

function external(url, label, opts) {
  if (opts.noLinks || /^https?:\/\/[^/]*@/i.test(url)) return label;
  return `<a class="out" href="${esc(url)}" rel="noreferrer">${label}</a>`;
}

/** Text between code and links: escaped, with emphasis, hard breaks, and the IDs the project holds linked. */
function textHtml(raw, opts) {
  const kept = [];
  let s = esc(raw.replace(PUNCT, (m, ch) => { kept.push(ch); return `\u0000${kept.length - 1}\u0000`; }));
  // A run of asterisks opens or closes only where it touches no other asterisk, so that `src/**` stays as written.
  s = s.replace(/(?<!\*)\*\*(?=[^\s*])([\s\S]*?[^\s*])\*\*(?!\*)/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?![\w])/g, '$1<strong>$2</strong>')
    .replace(/(?<!\*)\*(?=[^\s*])([\s\S]*?[^\s*])\*(?!\*)/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=[^\s_])([\s\S]*?[^\s_])_(?![\w])/g, '$1<em>$2</em>')
    .replace(/(?: {2,}|\\)\n/g, '<br>\n');
  if (opts.idLink && !opts.noLinks) s = s.replace(ID, (m, id) => { const href = opts.idLink(id); return href ? `<a href="${esc(href)}">${id}</a>` : id; });
  return s.replace(/\u0000(\d+)\u0000/g, (m, k) => esc(kept[Number(k)]));
}
