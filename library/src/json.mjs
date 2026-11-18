// RFC 8259 JSON with the line of every value and member name; a repeated member name is invalid.

export function parseJSON(text) {
  let i = 0;
  const newlines = [];
  for (let k = 0; k < text.length; k++) if (text[k] === '\n') newlines.push(k);
  const lineAt = (k) => { let lo = 0, hi = newlines.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (newlines[mid] < k) lo = mid + 1; else hi = mid; } return lo + 1; };
  const fail = () => { throw new SyntaxError('not valid JSON'); };
  const ws = () => { while (i < text.length && ' \t\n\r'.includes(text[i])) i++; };
  const ESC = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
  function str() {
    if (text[i] !== '"') fail();
    i++;
    let s = '';
    for (;;) {
      if (i >= text.length) fail();
      const c = text[i];
      if (c === '"') { i++; return s; }
      if (c < ' ') fail();
      if (c === '\\') {
        const e = text[i + 1];
        i += 2;
        if (e === 'u') {
          const h = text.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(h)) fail();
          s += String.fromCharCode(parseInt(h, 16));
          i += 4;
        } else if (e in ESC) s += ESC[e];
        else fail();
        continue;
      }
      s += c;
      i++;
    }
  }
  function value() {
    ws();
    const line = lineAt(i), c = text[i];
    if (c === '{') {
      i++;
      const members = [], keys = new Set();
      ws();
      if (text[i] === '}') { i++; return { type: 'object', line, members }; }
      for (;;) {
        ws();
        const keyLine = lineAt(i), key = str();
        if (keys.has(key)) fail();
        keys.add(key);
        ws();
        if (text[i] !== ':') fail();
        i++;
        members.push({ key, keyLine, node: value() });
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return { type: 'object', line, members }; }
        fail();
      }
    }
    if (c === '[') {
      i++;
      const elements = [];
      ws();
      if (text[i] === ']') { i++; return { type: 'array', line, elements }; }
      for (;;) {
        elements.push(value());
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; return { type: 'array', line, elements }; }
        fail();
      }
    }
    if (c === '"') return { type: 'string', line, value: str() };
    const m = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(text.slice(i, i + 400));
    if (m && m[0]) { i += m[0].length; return { type: 'number', line, value: Number(m[0]) }; }
    for (const [literal, v, type] of [['true', true, 'boolean'], ['false', false, 'boolean'], ['null', null, 'null']]) {
      if (text.startsWith(literal, i)) { i += literal.length; return { type, line, value: v }; }
    }
    return fail();
  }
  const node = value();
  ws();
  if (i !== text.length) fail();
  return node;
}

/** The plain value of a parsed node. */
export const plain = (n) => (n.type === 'object' ? Object.fromEntries(n.members.map((m) => [m.key, plain(m.node)]))
  : n.type === 'array' ? n.elements.map(plain) : n.value);

/** Parse or return null. */
export function tryJSON(text) {
  try { return parseJSON(text); } catch { return null; }
}
