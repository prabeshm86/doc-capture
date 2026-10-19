// Tiny static server for the bundled demo app (used by `npm run demo`).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = path.join(dir, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(4173, '127.0.0.1', () => console.log('Demo app on http://127.0.0.1:4173'));
