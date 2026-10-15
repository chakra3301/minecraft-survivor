// Renders Minecraft mobs (Bedrock geometry + textures) into PokéSurvivor-compatible sprite sheets:
//   assets/mobs/{key}/{Anim}.png, assets/mobs/{key}/s/{Anim}.png (Enchanted), js/data/sprites-meta.js
//   node tools/mc/render-mobs.mjs [key ...]      (no keys = whole roster)
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadGeometries, armorLayers } from './geo.mjs';
import { ROSTER, ANIMS, SKIN_MOBS, ARMOUR } from './roster.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const game = path.join(here, '../..');
const ws = path.join(game, '..');
const rp = path.join(ws, 'vendor/bedrock-samples/resource_pack');
const outDir = path.join(game, 'assets/mobs');

async function texture(rel, patch) {
  // 'aether:name' = a texture painted by tools/mc/aether-art.mjs (the Aether mod's mobs have no Mojang art).
  if (rel.startsWith('aether:')) return { b64: (await readFile(path.join(here, 'aether', rel.slice(7) + '.png'))).toString('base64'), kind: 'png', patch };
  for (const [ext, kind] of [['.png', 'png'], ['.tga', 'tga']]) {
    const f = path.join(rp, rel + ext);
    try { await access(f); return { b64: (await readFile(f)).toString('base64'), kind, patch }; } catch {}
  }
  throw new Error('texture not found: ' + rel);
}

const only = process.argv.slice(2);
const list = [...ROSTER, ...SKIN_MOBS].filter(m => !only.length || only.includes(m.key));
if (only.length && list.length !== only.length) throw new Error('unknown key in: ' + only.join(' '));
const geos = await loadGeometries(path.join(rp, 'models/entity'));
for (const [id, g] of await loadGeometries(path.join(here, 'aether'))) if (!geos.has(id) || g.file === 'aether.geo.json') geos.set(id, g);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const files = {
  '/three.js': path.join(ws, 'node_modules/three/build/three.module.js'),
  '/three.core.js': path.join(ws, 'node_modules/three/build/three.core.js'),
  '/TGALoader.js': path.join(ws, 'node_modules/three/examples/jsm/loaders/TGALoader.js'),
  '/render-page.js': path.join(here, 'render-page.js')
};
await page.route('http://render.local/**', async route => {
  const p = new URL(route.request().url()).pathname;
  if (p === '/') return route.fulfill({ contentType: 'text/html', body:
    '<script type="importmap">{"imports":{"three":"/three.js","three/addons/loaders/TGALoader.js":"/TGALoader.js"}}</script><script type="module" src="/render-page.js"></script>' });
  if (!files[p]) return route.fulfill({ status: 404 });
  let body = await readFile(files[p], 'utf8');
  if (p === '/TGALoader.js') body = body.replace(/from 'three'/g, "from '/three.js'");
  route.fulfill({ contentType: 'text/javascript', body });
});
page.on('pageerror', e => console.error('[page]', e.message));
await page.goto('http://render.local/');
if (process.env.HELD_ROT) await page.evaluate(r => { window.HELD_ROT = r; }, JSON.parse(process.env.HELD_ROT));
await page.waitForFunction(() => window.rendererReady, undefined, { timeout: 20000 });

// bind: extra cube rotations per bone (children unaffected); rot: bone rotations (children follow);
// size: the real texture size when a model declares the wrong one.
const geo = (id, bind, size, rot) => {
  let g = geos.get(id);
  if (!g) throw new Error('geometry not found: ' + id);
  if (bind) g = { ...g, bones: g.bones.map(b => bind[b.name] ? { ...b, bindPose: bind[b.name] } : b) };
  if (rot) g = { ...g, bones: g.bones.map(b => rot[b.name] ? { ...b, rotation: rot[b.name] } : b) };
  if (size) g = { ...g, texW: size[0], texH: size[1] };
  return g;
};
let failed = 0;
for (const m of list) {
  try {
    const parts = [{ geo: geo(m.geo, m.bind, m.texSize, m.rot), texture: await texture(m.tex, m.patch), tint: m.tint }];
    for (const l of m.layers || []) parts.push({ geo: geo(l.geo, m.bind, l.texSize || m.texSize, m.rot), texture: await texture(l.tex), tint: l.tint, glow: l.glow, see: l.see });
    // Armour: Mojang's two armour layers fitted to this humanoid (geo.mjs), with the tier's textures.
    if (m.armor) {
      const [l1, l2] = armorLayers(parts[0].geo);
      for (const [g, n] of [[l2, 2], [l1, 1]]) parts.push({ geo: g, texture: await texture(`textures/models/armor/${m.armor}_${n}`), ench: !!ARMOUR[m.armor].glint });
    }
    // Jockeys: the rider, seated on the mount's back (its root follows the mount's bob, lunge and fall).
    let heldPart = 0;
    if (m.ride) {
      heldPart = parts.length;
      parts.push({ geo: geo(m.ride.geo), texture: await texture(m.ride.tex), mount: 0, at: m.ride.at, rig: m.ride.rig || 'auto', sit: true });
    }
    // Weapon in hand: the item texture, attached to the model's rightItem bone (or `heldAt`).
    const held = m.held ? { b64: (await readFile(path.join(game, 'assets/mc', m.held + '.png'))).toString('base64'), kind: 'png' } : null;
    const job = { parts, hide: m.hide || [], rig: m.rig, scale: m.scale || 1, hover: !!m.hover, anims: ANIMS, held, heldPart,
      heldAt: m.heldAt || null, heldEnch: m.heldEnch || null };
    const res = await page.evaluate(j => window.renderMob(j), job);
    const dir = path.join(outDir, m.key);
    await rm(dir, { recursive: true, force: true });
    await mkdir(path.join(dir, 's'), { recursive: true });
    const a = {};
    for (const [anim, r] of Object.entries(res)) {
      await writeFile(path.join(dir, anim + '.png'), Buffer.from(r.png, 'base64'));
      await writeFile(path.join(dir, 's', anim + '.png'), Buffer.from(r.shiny, 'base64'));
      a[anim] = { w: r.w, h: r.h, n: r.n, r: r.r, d: r.d, ax: r.ax, ay: r.ay };
    }
    // Shadow size from the body width, like PMD's ShadowSize 0/1/2.
    const idle = a.Idle;
    const meta = { s: idle.w < 22 ? 0 : idle.w < 44 ? 1 : 2, a, sh: 1 };
    if (m.hover) meta.hv = 1;
    await writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta));
    console.log('ok', m.key, `${idle.w}x${idle.h}`);
  } catch (e) {
    failed++;
    console.error('FAIL', m.key, e.message);
  }
}
await browser.close();
console.log(`${list.length - failed}/${list.length} rendered`);
if (failed) process.exit(1);
