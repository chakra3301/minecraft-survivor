// Builds Minecraft Survivor's ONLINE site (accounts, cloud saves, leaderboard, friends, co-op):
//   node minecraft-survivor/tools/web/build-public.mjs [--config minecraft-survivor/online.config.json]
//        [--out minecraft-survivor/dist-public] [--emulator] [--admins uid,uid] [--google] [--noindex] [--no-music]
//
// It wraps the private build and patches its output, so the offline game never changes:
//   1. `node tools/build.mjs minecraft-survivor` (the normal private build, into minecraft-survivor/dist)
//   2. copies it to --out without dev.html. The Minecraft soundtrack (assets/music, from the owner's
//      install: tools/mc/import-music.mjs) is published too (owner's decision); --no-music leaves it
//      out and the site plays the synthesized music instead
//   3. self-hosts the Firebase web SDK (js/vendor/firebase/, from server/node_modules/firebase)
//   4. writes js/online-config.js from the config (G.ONLINE, with the Firebase web config in
//      G.ONLINE.firebase), loaded right before the bundle: it switches the cloud on (js/core/db.js)
//   5. opens the CSP only for the Firebase endpoints it needs (+ Google sign-in / TURN when on),
//      in every page and in _headers (Cloudflare Pages), and gives the service worker its own caches
//   6. robots: the public site may be indexed (the emulator build stays noindex)
// --emulator: the "demo-minecraft-survivor" project on the local Firebase emulators (tests); it
// needs no config file and contacts nothing outside 127.0.0.1. --admins overrides the moderators;
// --google turns "Sign in with Google" on (as allowGoogleSignIn); --noindex keeps search engines out.
// See minecraft-survivor/ONLINE.md.
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { gameDir } from './game-data.mjs';
import { readConfig, DEFAULT_CONFIG } from './online-config.mjs';

const root = path.join(gameDir, '..');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const emulator = args.includes('--emulator');
const noMusic = args.includes('--no-music');
const out = path.resolve(opt('--out') || path.join(gameDir, emulator ? 'dist-emulator' : 'dist-public'));
const configFile = opt('--config') ? path.resolve(opt('--config')) : DEFAULT_CONFIG;
const SDK_FILES = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js', 'firebase-database-compat.js'];
const sdkDir = path.join(gameDir, 'server/node_modules/firebase');

// ---------------- config ----------------
const cfg = await readConfig(emulator && !opt('--config') ? null : configFile, { emulator });
if (opt('--admins') != null) cfg.online.admins = opt('--admins').split(',').map(s => s.trim()).filter(Boolean);
if (args.includes('--google')) cfg.online.allowGoogleSignIn = true;
for (const f of SDK_FILES) {
  if (!existsSync(path.join(sdkDir, f))) throw new Error(`Firebase SDK missing: run \`npm install\` in minecraft-survivor/server first (${f})`);
}
const sdkVersion = JSON.parse(await readFile(path.join(sdkDir, 'package.json'), 'utf8')).version;

// ---------------- 1. the private build ----------------
const built = spawnSync(process.execPath, [path.join(root, 'tools/build.mjs'), 'minecraft-survivor'], { cwd: root, stdio: 'inherit' });
if (built.status !== 0) throw new Error('tools/build.mjs failed');
const dist = path.join(gameDir, 'dist');
const local = JSON.parse(await readFile(path.join(dist, 'local-build.json'), 'utf8'));

// ---------------- 2. copy ----------------
if (path.relative(gameDir, out).startsWith('..') && !args.includes('--force-out')) throw new Error(`--out must be inside minecraft-survivor/ (got ${out})`);
if (out === dist || out === gameDir) throw new Error('--out must be its own folder');
await rm(out, { recursive: true, force: true });
await cp(dist, out, {
  recursive: true,
  filter: src => {
    const rel = path.relative(dist, src).split(path.sep).join('/');
    if (noMusic && (rel === 'assets/music' || rel.startsWith('assets/music/'))) return false;
    return rel !== 'dev.html' && rel !== 'local-build.json';
  }
});

// ---------------- 3. the Firebase SDK, self-hosted ----------------
const vendor = path.join(out, 'js/vendor/firebase');
await mkdir(vendor, { recursive: true });
for (const f of SDK_FILES) {
  // Without the source-map comment (the maps aren't shipped).
  const js = (await readFile(path.join(sdkDir, f), 'utf8')).replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n');
  await writeFile(path.join(vendor, f), js);
}
await writeFile(path.join(vendor, 'NOTICE.txt'), `Firebase JavaScript SDK ${sdkVersion} (compat builds), © Google LLC, Apache License 2.0.\nhttps://github.com/firebase/firebase-js-sdk\n`);

// ---------------- 4. the site's config ----------------
const online = Object.assign({ firebase: cfg.firebase }, cfg.online, { sdk: 'js/vendor/firebase/', music: !noMusic });
// The emulator build uses no STUN servers: co-op peers on this machine connect directly.
if (cfg.emulator) online.iceServers = [];
const siteConfig = `// Minecraft Survivor online site: generated by tools/web/build-public.mjs${cfg.emulator ? ' --emulator' : ''} from ${cfg.emulator ? 'the emulator defaults' : 'online.config.json'}.
// G.ONLINE.firebase is the Firebase web config (public by design: the security rules protect the data).
// music: false (--no-music) — the site plays the synthesized music instead of the Minecraft soundtrack.
window.G = window.G || {};
G.ONLINE = ${JSON.stringify(online, null, 2)};
`;
await writeFile(path.join(out, 'js/online-config.js'), siteConfig);
const cfgHash = createHash('sha1').update(siteConfig).digest('hex').slice(0, 10);

// ---------------- 5. CSP, pages, service worker ----------------
const fb = cfg.firebase;
const dbHost = new URL(fb.databaseURL).host;
const connect = ["'self'"], script = ["'self'", "'unsafe-inline'"], frame = [];
if (cfg.emulator) {
  const h = '127.0.0.1';
  connect.push(`http://${h}:9099`, `http://${h}:8080`, `http://${h}:9000`, `ws://${h}:9000`);
  script.push(`http://${h}:9000`);                       // Realtime Database long-polling fallback
  if (cfg.online.allowGoogleSignIn) frame.push(`http://${h}:9099`);   // the Auth emulator's sign-in helper
} else {
  connect.push('https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firestore.googleapis.com',
    // Realtime Database (rooms and co-op signalling): the database and the shard servers it redirects to.
    `https://${dbHost}`, `wss://${dbHost}`,
    /\.firebaseio\.com$/.test(dbHost) ? 'https://*.firebaseio.com wss://*.firebaseio.com' : 'https://*.firebasedatabase.app wss://*.firebasedatabase.app');
  script.push(`https://${dbHost}`);                      // Realtime Database long-polling fallback
  if (cfg.online.allowGoogleSignIn) {
    script.push('https://apis.google.com');
    connect.push('https://www.googleapis.com');
    frame.push(`https://${fb.authDomain}`, 'https://accounts.google.com');
  }
  if (cfg.online.turnUrl) connect.push(new URL(cfg.online.turnUrl).origin);
}
const csp = [
  "default-src 'self'", `script-src ${script.join(' ')}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self'", `connect-src ${connect.join(' ')}`, "media-src 'self' blob:", "worker-src 'self'", "object-src 'none'",
  `frame-src ${frame.length ? frame.join(' ') : "'none'"}`, "base-uri 'self'", "form-action 'self'"
].join('; ');

const index = path.join(out, 'index.html');
let html = await readFile(index, 'utf8');
const bundleTag = /<script defer src="js\/app\.min\.js\?v=[a-z0-9]+"><\/script>/;
if (!bundleTag.test(html)) throw new Error('index.html: bundle script tag not found');
html = html.replace(bundleTag, m => `<script defer src="js/online-config.js?v=${cfgHash}"></script>${m}`);
await writeFile(index, html);

const indexable = !cfg.emulator && !args.includes('--noindex');
async function patchHtml(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { await patchHtml(file); continue; }
    if (!entry.name.endsWith('.html')) continue;
    let page = await readFile(file, 'utf8');
    const n = (page.match(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/g) || []).length;
    if (n !== 1) throw new Error(`${entry.name}: expected one CSP meta, found ${n}`);
    page = page.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
    if (indexable) page = page.replace(/\n?<meta name="robots" content="[^"]*">/g, '');
    else page = page.replace(/<meta name="robots" content="[^"]*">/g, '<meta name="robots" content="noindex, nofollow">');
    await writeFile(file, page);
  }
}
await patchHtml(out);
await writeFile(path.join(out, 'robots.txt'), indexable ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');

// Its own service-worker caches (the private build's are "mcs-code-…" / "mcs-art-…").
const swFile = path.join(out, 'sw.js');
const sw = await readFile(swFile, 'utf8');
const sw2 = sw.replace(/(['"])mcs-code-/, '$1mcsweb-code-').replace(/(['"])mcs-art-/, '$1mcsweb-art-');
if ((sw2.match(/mcsweb-(code|art)-/g) || []).length !== 2) throw new Error('sw.js: cache names not found');
await writeFile(swFile, sw2);

// Cloudflare Pages: the same CSP as an HTTP header, plus caching (art is immutable per build).
await writeFile(path.join(out, '_headers'), `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
${indexable ? '' : '  X-Robots-Tag: noindex, nofollow\n'}
/assets/*
  Cache-Control: public, max-age=86400

/sw.js
  Cache-Control: no-cache

/version.json
  Cache-Control: no-cache

/js/online-config.js
  Cache-Control: no-cache
`);

// ---------------- checks ----------------
const bad = [];
let files = 0, biggest = 0, biggestName = '';
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { await scan(file); continue; }
    files++;
    const st = await stat(file);
    if (st.size > biggest) { biggest = st.size; biggestName = path.relative(out, file); }
    if (/\.(js|html|json|css|txt|webmanifest)$/.test(entry.name)) {
      const text = await readFile(file, 'utf8');
      // PokéSurvivor's servers: its sites as URLs, its TURN Worker, its Firebase project, its account email domain.
      // (A leftover dictionary line naming "pokesurvivor.com" as plain text is fine.)
      if (/https?:\/\/[\w.-]*pokesurvivor|turn\.pokesurvivor|jugadores\.pokesurvivor|pokesurvivor-free/i.test(text)) bad.push(`${path.relative(out, file)} mentions PokéSurvivor's servers`);
    }
  }
}
await scan(out);
if (noMusic && existsSync(path.join(out, 'assets/music'))) bad.push('--no-music: assets/music must not be published');
// Cloudflare Pages (free): at most 20,000 files and 25 MiB per file.
if (files > 20000) bad.push(`${files} files: Cloudflare Pages allows 20,000`);
if (biggest > 25 * 1024 * 1024) bad.push(`${biggestName} is over Cloudflare Pages' 25 MiB per file`);
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }

await writeFile(path.join(out, 'online-build.json'), JSON.stringify({
  game: 'minecraft-survivor', mode: cfg.emulator ? 'emulator' : 'online', projectId: fb.projectId, bundle: local.hash, config: cfgHash,
  firebaseSdk: sdkVersion, csp, files
}, null, 2) + '\n');
console.log(`minecraft-survivor online (${cfg.emulator ? 'emulators' : fb.projectId}): ${files} files → ${path.relative(root, out)}`);
