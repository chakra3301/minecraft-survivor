// Copies the Minecraft Java Edition soundtrack out of the owner's own launcher install into
// assets/music/<path after sounds/music/> (e.g. assets/music/game/sweden.ogg) and writes the
// manifest js/data/music-files.js (G.MUSIC_FILES: track id -> { dur, gain }).
// Private, offline play only: the files come from the owner's licensed copy and are gitignored.
//
//   node tools/mc/import-music.mjs [--from <minecraft folder>] [--no-level]
//
// dur: seconds, from the last Ogg page. gain: loudness levelling (Mojang's tracks range from
// RMS 0.004 to 0.14): each new or changed file is decoded once in headless Chromium (Playwright),
// gain = TARGET_RMS / rms, kept in [0.4, 6] and below 0.95 / peak. Skipped with --no-level or
// when Playwright isn't installed (gain 1).
//
// Default folder: ~/Library/Application Support/minecraft (macOS), %APPDATA%/.minecraft (Windows),
// ~/.minecraft (Linux). Music lives in assets/indexes/<version>.json, which maps
// "minecraft/sounds/music/..." to a SHA-1 stored at assets/objects/<first 2 chars>/<hash>.
// Idempotent: files already copied with the right SHA-1 are skipped. Without Minecraft the
// script exits with an error and the game keeps using its synthesized tracks.
import { readdir, readFile, writeFile, mkdir, copyFile, stat, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const game = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dst = path.join(game, 'assets/music');
const manifest = path.join(game, 'js/data/music-files.js');
const PREFIX = 'minecraft/sounds/music/';
const TARGET_RMS = 0.09;

function defaultFolder() {
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library/Application Support/minecraft');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || os.homedir(), '.minecraft');
  return path.join(os.homedir(), '.minecraft');
}

function fail(msg) {
  console.error(`import-music: ${msg}\nThe game falls back to its synthesized music. ` +
    'Install Minecraft Java Edition and start it once (so the launcher downloads the assets), ' +
    'or pass --from <path to the minecraft folder>.');
  process.exit(1);
}

const exists = p => stat(p).then(() => true, () => false);
const sha1 = async p => createHash('sha1').update(await readFile(p)).digest('hex');

/** Duration of an Ogg Vorbis file: last page's granule position / sample rate. */
async function oggDuration(file) {
  const fh = await open(file, 'r');
  try {
    const { size } = await fh.stat();
    const head = Buffer.alloc(64);
    await fh.read(head, 0, 64, 0);
    // First page: 27-byte header + segment table, then the identification packet
    // ("\x01vorbis", version u32, channels u8, sample rate u32 LE).
    if (head.toString('latin1', 0, 4) !== 'OggS') return null;
    const p = 27 + head[26];
    if (head.toString('latin1', p + 1, p + 7) !== 'vorbis') return null;
    const rate = head.readUInt32LE(p + 12);
    const n = Math.min(size, 65536);
    const tail = Buffer.alloc(n);
    await fh.read(tail, 0, n, size - n);
    const at = tail.lastIndexOf('OggS');
    if (at < 0 || at + 14 > n || !rate) return null;
    const granule = Number(tail.readBigUInt64LE(at + 6));
    return Math.round(granule / rate * 10) / 10;
  } finally { await fh.close(); }
}

let from = defaultFolder();
const fi = process.argv.indexOf('--from');
if (fi >= 0) {
  if (!process.argv[fi + 1]) fail('--from needs a path');
  from = path.resolve(process.argv[fi + 1]);
}
const indexes = path.join(from, 'assets/indexes'), objects = path.join(from, 'assets/objects');
if (!await exists(indexes) || !await exists(objects)) fail(`no Minecraft assets found in ${from}`);

// Newest index first (by modification time). Older indexes only fill in tracks the newest lacks.
const names = (await readdir(indexes)).filter(f => f.endsWith('.json'));
const dated = await Promise.all(names.map(async f => ({ f, t: (await stat(path.join(indexes, f))).mtimeMs })));
dated.sort((a, b) => b.t - a.t || b.f.localeCompare(a.f, undefined, { numeric: true }));
const tracks = new Map();   // rel path (game/sweden.ogg) -> { hash, size, index }
for (const { f } of dated) {
  let idx;
  try { idx = JSON.parse(await readFile(path.join(indexes, f), 'utf8')); } catch { continue; }
  for (const [name, o] of Object.entries(idx.objects || {})) {
    if (!name.startsWith(PREFIX) || !name.endsWith('.ogg') || tracks.has(name.slice(PREFIX.length))) continue;
    const obj = path.join(objects, o.hash.slice(0, 2), o.hash);
    if (await exists(obj)) tracks.set(name.slice(PREFIX.length), { hash: o.hash, size: o.size, obj, index: f });
  }
}
if (!tracks.size) fail(`no music files in ${indexes} (or their objects are not downloaded yet)`);

// Gains measured by an earlier run, reused for files that haven't changed.
const oldGain = {};
try {
  for (const m of (await readFile(manifest, 'utf8')).matchAll(/'([^']+)': \{[^}]*gain:([\d.]+)/g)) oldGain[m[1]] = +m[2];
} catch { /* first run */ }

let copied = 0, kept = 0, bytes = 0;
const files = {}, toLevel = [];
for (const rel of [...tracks.keys()].sort()) {
  const t = tracks.get(rel), out = path.join(dst, rel);
  await mkdir(path.dirname(out), { recursive: true });
  const same = await exists(out) && (await stat(out)).size === t.size && await sha1(out) === t.hash;
  const id = rel.replace(/\.ogg$/, '');
  if (same) kept++;
  else {
    delete oldGain[id];
    if (await sha1(t.obj) !== t.hash) { console.warn(`  skipped ${rel}: object is corrupt (SHA-1 mismatch)`); continue; }
    await copyFile(t.obj, out);
    copied++;
  }
  bytes += t.size;
  const dur = await oggDuration(out);
  files[id] = dur ? { dur } : {};
  if (oldGain[id]) files[id].gain = oldGain[id];
  else toLevel.push(id);
}

/** Decodes each file in headless Chromium and returns { id: gain }. */
async function measure(ids) {
  let chromium;
  try {
    const { createRequire } = await import('node:module');
    ({ chromium } = createRequire(path.join(game, '../package.json'))('playwright'));
  } catch { console.warn('  loudness levelling skipped: Playwright is not installed (npm install)'); return {}; }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('http://music.local/**', async r => {
      const rel = decodeURIComponent(new URL(r.request().url()).pathname.slice(1));
      if (!rel) return r.fulfill({ contentType: 'text/html', body: '<!doctype html>' });
      r.fulfill({ contentType: 'audio/ogg', body: await readFile(path.join(dst, rel + '.ogg')) });
    });
    await page.goto('http://music.local/');
    const gains = {};
    for (const id of ids) {
      const m = await page.evaluate(async id => {
        const ac = new OfflineAudioContext(2, 44100, 44100);
        const buf = await ac.decodeAudioData(await (await fetch('/' + encodeURIComponent(id))).arrayBuffer());
        let peak = 0, sum = 0, n = 0;
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const d = buf.getChannelData(c);
          for (let i = 0; i < d.length; i += 2) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; n++; }
        }
        return { peak, rms: Math.sqrt(sum / n) };
      }, id).catch(e => { console.warn(`  could not measure ${id}: ${e.message}`); return null; });
      if (!m || !m.rms) continue;
      const g = Math.min(6, Math.max(0.4, TARGET_RMS / m.rms), 0.95 / m.peak);
      gains[id] = Math.round(g * 100) / 100;
    }
    return gains;
  } finally { await browser.close(); }
}

if (toLevel.length && !process.argv.includes('--no-level')) {
  console.log(`  measuring loudness of ${toLevel.length} tracks...`);
  for (const [id, g] of Object.entries(await measure(toLevel))) files[id].gain = g;
}

const body = Object.entries(files).map(([id, v]) => `  '${id}': ${JSON.stringify(v).replace(/"/g, '')}`).join(',\n');
await writeFile(manifest,
  '/* ============ music-files.js — generated by tools/mc/import-music.mjs; do not edit ============\n' +
  ' * Minecraft soundtrack files copied from the owner\'s own install into assets/music/ (gitignored,\n' +
  ' * private offline play only). id = path under assets/music without ".ogg"; dur in seconds;\n' +
  ' * gain: loudness levelling (missing = 1).\n' +
  ' * core/audio.js streams these by context (playlists in data/music.js) and falls back to the\n' +
  ' * synthesized tracks for anything missing.\n' +
  ' */\n' +
  `G.MUSIC_FILES = {\n${body}\n};\n`);

console.log(`import-music: ${Object.keys(files).length} tracks (${copied} copied, ${kept} already up to date), ` +
  `${(bytes / 1048576).toFixed(0)} MB from ${from} (index ${dated[0].f})\n  -> ${path.relative(process.cwd(), dst)}\n  -> ${path.relative(process.cwd(), manifest)}`);
