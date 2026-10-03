// Production server for the Frilly app: serves the Vite build and forwards
// /api/* to the generated rulebook API, so the browser sees ONE origin.
// No business logic here; it is a static file server plus a proxy.
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PORT = Number(process.env.PORT || 8080);
const API = process.env.API_URL || `http://127.0.0.1:${process.env.API_PORT || 42441}`;
const DIST = new URL('./dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const target = new URL(req.url, API);
    const up = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', (e) => { res.writeHead(502); res.end(`API unreachable: ${e.message}`); });
    req.pipe(up);
    return;
  }
  let file = join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html'); // SPA fallback: routes come from the rulebook
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`frilly app on http://0.0.0.0:${PORT} (api → ${API})`));
