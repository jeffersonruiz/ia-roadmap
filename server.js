const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// ── LIVE RELOAD ───────────────────────────────────────────────────────────────
const clients = new Set();

// data files written by the app itself — no need to trigger a browser reload for them
const IGNORE = ['node_modules', '.git', 'CLAUDE.md', 'custom.json', 'progress.json'];

fs.watch(ROOT, { recursive: true }, (_, filename) => {
  if (!filename) return;
  if (IGNORE.some(p => filename.includes(p))) return;
  console.log('  ↺  Cambio detectado: ' + filename);
  for (const res of clients) res.write('data: reload\n\n');
});

// ── SERVER ────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // SSE endpoint for live reload
  if (req.url === '/livereload') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    res.write('data: connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // Generic save endpoint for local data files — POST /api/save/filename.json
  if (req.method === 'POST' && req.url.startsWith('/api/save/')) {
    const filename = req.url.slice('/api/save/'.length);
    const allowed  = ['custom.json', 'progress.json'];
    if (!allowed.includes(filename)) { res.writeHead(403); res.end('Forbidden'); return; }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        JSON.parse(body); // validate JSON before writing
        fs.writeFile(path.join(ROOT, 'data', filename), body, err => {
          if (err) { res.writeHead(500); res.end('Error saving'); return; }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
        });
      } catch(e) {
        res.writeHead(400); res.end('Invalid JSON');
      }
    });
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405); res.end(); return;
  }

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ✦  IA Expert Roadmap corriendo en:');
  console.log('');
  console.log('     http://localhost:' + PORT);
  console.log('');
  console.log('  Escuchando cambios en archivos...');
  console.log('  Presiona Ctrl+C para detener el servidor.');
  console.log('');
});
