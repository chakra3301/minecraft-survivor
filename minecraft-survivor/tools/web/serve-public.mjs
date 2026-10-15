// Serves a built online site locally (like Cloudflare Pages would), with the CSP the build wrote.
//   node minecraft-survivor/tools/web/serve-public.mjs [dir] [--port 4385]
// dir defaults to minecraft-survivor/dist-public (dist-emulator for the emulator build). Ports 4385-4389.
import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { gameDir } from './game-data.mjs';

const args = process.argv.slice(2);
const i = args.indexOf('--port');
const port = Number(i >= 0 ? args[i + 1] : process.env.PORT || 4385);
const dirArg = args.find((a, k) => !a.startsWith('--') && args[k - 1] !== '--port');
const root = await realpath(path.resolve(dirArg || path.join(gameDir, 'dist-public')));
const info = JSON.parse(await readFile(path.join(root, 'online-build.json'), 'utf8'));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg'
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
  const headers = { 'Content-Security-Policy': info.csp, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, headers).end(); return; }
  const file = await resolve(req.url || '/');
  if (!file || path.basename(file) === '_headers') { res.writeHead(404, headers).end(); return; }
  const size = (await stat(file)).size;
  res.writeHead(200, { ...headers, 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': size });
  if (req.method === 'HEAD') { res.end(); return; }
  await pipeline(createReadStream(file), res).catch(() => {});
});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is busy (use --port 4386…4389)` : e.message); process.exit(1); });
server.listen(port, '127.0.0.1', () => console.log(`minecraft-survivor online (${info.mode}): http://127.0.0.1:${port}/`));
