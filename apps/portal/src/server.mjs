// The portal served: on 127.0.0.1 only, for GET and HEAD only, each page made from the files at the moment it is asked for.
import http from 'node:http';
import { answerAt } from './site.mjs';
import { CSP } from './pages.mjs';

/**
 * Serve the portal of the project at `root` on 127.0.0.1 at `port`, a free one when it is 0. Resolves to
 * {server, port, url, close}, or rejects with an error whose `code` is PORT_IN_USE when the port is taken.
 */
export function startPortal(root, { port = 0, base, now = () => new Date() } = {}) {
  const server = http.createServer((req, res) => handle(req, res, root, server.address().port, { base, now }));
  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') reject(Object.assign(new Error(`port ${port} is in use`), { code: 'PORT_IN_USE' }));
      else reject(error);
    });
    server.listen(port, '127.0.0.1', () => {
      const at = server.address().port;
      resolve({ server, port: at, url: `http://127.0.0.1:${at}/`, close: () => new Promise((done) => { server.closeAllConnections?.(); server.close(() => done()); }) });
    });
  });
}

const HEADERS = {
  'Content-Security-Policy': `${CSP}; frame-ancestors 'none'`,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function handle(req, res, root, port, { base, now }) {
  const send = (status, type, body, extra = {}) => {
    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
    res.writeHead(status, { ...HEADERS, 'Content-Type': type, 'Content-Length': bytes.length, ...extra });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'text/plain; charset=utf-8', 'The portal only reads: it answers GET and HEAD.\n', { Allow: 'GET, HEAD' });
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
  if (!hosts.includes(req.headers.host)) return send(403, 'text/plain; charset=utf-8', 'The portal answers this machine only, by its own address.\n');
  const origin = req.headers.origin;
  if (origin !== undefined && !hosts.some((h) => origin === `http://${h}`)) return send(403, 'text/plain; charset=utf-8', 'The portal answers its own pages only.\n');
  let rel;
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    rel = decodeURIComponent(url.pathname).slice(1);
  } catch {
    return send(400, 'text/plain; charset=utf-8', 'The address cannot be read.\n');
  }
  try {
    const a = answerAt(root, rel, { served: true, base, now });
    if (a.status === 308) return send(308, 'text/plain; charset=utf-8', '', { Location: a.location });
    return send(a.status, a.type, a.body);
  } catch (error) {
    return send(500, 'text/plain; charset=utf-8', `The portal failed to make this page: ${error?.message ?? error}\n`);
  }
}
