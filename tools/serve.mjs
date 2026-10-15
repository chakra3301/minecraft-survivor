import http from 'node:http';
import { stat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { csp } from './local-policy.mjs';
import { game } from './games.mjs';

// node tools/serve.mjs [game] [--src]   (default minecraft-survivor; PORT overrides the game's port)
// --src serves the unbundled source folder instead of dist/ (open /dev.html; no build step needed).
const args = process.argv.slice(2);
const g = game(args.find(a => !a.startsWith('--')) || 'minecraft-survivor');
const fromSrc = args.includes('--src');
const root = await realpath(fileURLToPath(new URL(`../${fromSrc ? g.src : g.out}/`, import.meta.url)));
const port = Number(process.env.PORT || g.port);
const host = '127.0.0.1'; // Private development server only.
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4'
};

async function resolve(urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  let file = path.join(root, path.normalize(rel));
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const real = await realpath(file);
    return real === root || real.startsWith(root + path.sep) ? real : null;
  } catch { return null; }
}

const server = http.createServer(async (req, res) => {
  const headers = { 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, headers).end(); return; }
  const file = await resolve(req.url || '/');
  if (!file) {
    const notFound = await resolve('/404.html');
    res.writeHead(404, { ...headers, 'Content-Type': types['.html'] });
    if (notFound && req.method === 'GET') await pipeline(createReadStream(notFound), res).catch(() => {});
    else res.end();
    return;
  }
  const type = types[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const size = (await stat(file)).size;
  // Range requests let the browser seek and know the length of streamed audio.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    const start = range[1] ? +range[1] : Math.max(0, size - +range[2]);
    const end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
    if (start >= size || start > end) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end(); return; }
    res.writeHead(206, { ...headers, 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${size}` });
    if (req.method === 'HEAD') { res.end(); return; }
    await pipeline(createReadStream(file, { start, end }), res).catch(() => {});
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
  if (req.method === 'HEAD') { res.end(); return; }
  await pipeline(createReadStream(file), res).catch(() => {});
});

server.on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${port} is busy; run with PORT=<other> npm start` : e.message);
  process.exit(1);
});
server.listen(port, host, () => {
  console.log(`${g.name}${fromSrc ? ' (source)' : ''}: http://${host}:${port}/${fromSrc ? 'dev.html' : g.name === 'pokesurvivor' ? 'en/' : ''}`);
});
