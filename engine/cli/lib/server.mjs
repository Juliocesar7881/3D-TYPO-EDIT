// Servidor HTTP local: entrega o motor (raiz do repo), os arquivos do projeto
// (/project/...), a cena normalizada (/__scene) e recebe os frames (POST /__frame).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function safeJoin(root, rel) {
  const p = path.normalize(path.join(root, rel));
  if (!p.startsWith(path.normalize(root))) return null;
  return p;
}

export async function startServer({ repoRoot, projectDir, getScene, onFrame }) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(url.pathname);
    if (req.method === 'POST' && p === '/__frame') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        try {
          const buf = Buffer.concat(chunks);
          await onFrame(Number(url.searchParams.get('w') || 0), Number(url.searchParams.get('i') || 0), buf);
          res.writeHead(200);
          res.end('ok');
        } catch (e) {
          res.writeHead(500);
          res.end(String(e));
        }
      });
      return;
    }
    if (p === '/__scene') {
      res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' });
      res.end(JSON.stringify(getScene()));
      return;
    }
    let file;
    if (p.startsWith('/project/')) file = safeJoin(projectDir, p.slice('/project/'.length));
    else if (p === '/' || p === '/index.html') file = path.join(repoRoot, 'engine/web/index.html');
    else file = safeJoin(repoRoot, p.slice(1));
    if (!file) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('not found: ' + p);
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, port, url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}
