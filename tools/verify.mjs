// Static checks on each built game: complete sprite sheets and no production backend.
//   node tools/verify.mjs [game ...]
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { GAMES, game } from './games.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let failed = false;

async function verify(g) {
  if (g.format === 'osrs-webgl') {
    try { execFileSync(process.execPath, [path.join(root, g.src, 'tools/verify.mjs')], { stdio: 'inherit' }); }
    catch { failed = true; }
    return;
  }
  const dist = path.join(root, g.out);
  const fail = [];
  const bundle = await readFile(path.join(dist, 'js/app.min.js'), 'utf8');
  if (!bundle.includes('G.FIREBASE_CONFIG=null')) fail.push('bundle does not null the Firebase config');
  if (/pokesurvivor-free|AIzaSy/.test(bundle)) fail.push('bundle still contains the production Firebase project');
  const cfg = await readFile(path.join(dist, 'js/core/firebase-config.js'), 'utf8');
  if (/apiKey/.test(cfg)) fail.push('dev.html would load the production Firebase config');

  // Every sprite sheet listed in the metadata must exist on disk.
  const ctx = { G: {} };
  for (const f of ['js/data/mobdex.js', 'js/data/pokedex.js']) {
    try { vm.runInNewContext(await readFile(path.join(dist, f), 'utf8'), ctx); } catch {}
  }
  vm.runInNewContext(await readFile(path.join(dist, 'js/data/sprites-meta.js'), 'utf8'), ctx);
  const meta = ctx.G.SPRITE_META, by = ctx.G.DEX_BY || {};
  // PokéSurvivor: assets/pokemon/{dex}; Minecraft Survivor: assets/mobs/{key}.
  const folder = by[Object.keys(meta)[0]] && by[Object.keys(meta)[0]].key ? 'mobs' : 'pokemon';
  const dirOf = dex => folder === 'mobs' && by[dex] ? by[dex].key : dex;     // skins are keyed by their folder name
  const have = new Set();
  for (const d of await readdir(path.join(dist, 'assets', folder))) {
    for (const f of await readdir(path.join(dist, 'assets', folder, d), { recursive: true })) have.add(`${d}/${f}`);
  }
  let expected = 0;
  for (const [dex, m] of Object.entries(meta)) {
    const d = dirOf(dex);
    for (const anim of Object.keys(m.a)) {
      expected++;
      if (!have.has(`${d}/${anim}.png`)) fail.push(`missing ${d}/${anim}.png`);
      if (m.sh && !(m.sm || []).includes(anim)) {
        expected++;
        if (!have.has(`${d}/s/${anim}.png`)) fail.push(`missing ${d}/s/${anim}.png`);
      }
    }
  }
  if (ctx.G.DEX) for (const p of ctx.G.DEX) if (!meta[p.dex]) fail.push(`${p.name} (${p.dex}) has no sprites`);

  const version = JSON.parse(await readFile(path.join(dist, 'version.json'), 'utf8')).v;
  for (const page of ['index.html', 'dev.html', ...(g.name === 'pokesurvivor' ? ['en/index.html'] : [])]) {
    const html = await readFile(path.join(dist, page), 'utf8');
    if (!html.includes('Content-Security-Policy')) fail.push(`${page} has no CSP`);
    if (page !== 'dev.html' && !html.includes(`app.min.js?v=${version}`)) fail.push(`${page} points at a stale bundle`);
  }

  console.log(`${g.name}: ${Object.keys(meta).length} creatures · ${expected} sprite sheets expected · ${fail.length ? fail.length + ' problems' : 'all present'}`);
  if (fail.length) { console.error(fail.slice(0, 20).join('\n')); failed = true; }
}

const names = process.argv.slice(2);
for (const name of names.length ? names : Object.keys(GAMES)) await verify(game(name));
if (failed) process.exit(1);
