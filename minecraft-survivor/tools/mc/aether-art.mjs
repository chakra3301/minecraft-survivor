// The Aether mod's passive mobs (The Aether I): Mojang has no models for them, so this script writes their
// Bedrock-format geometry and paints their textures (Minecraft-style 1 texel = 1 model pixel, Aether palette):
//   tools/mc/aether/aether.geo.json   custom geometry (render-mobs.mjs loads it next to the vendor pack)
//   tools/mc/aether/{name}.png        textures (roster.mjs refers to them as 'aether:{name}')
// Sheepuff wool is fitted to Mojang's sheep (same bones and bind pose); the Phyg's and Flying Cow's wings are
// layers fitted to the pig and cow. node tools/mc/aether-art.mjs   (then render-mobs.mjs <keys> and gen-data.mjs)
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PNG } from 'pngjs';
import { loadGeometries } from './geo.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'aether');
const vendor = await loadGeometries(path.join(here, '../../../vendor/bedrock-samples/resource_pack/models/entity'));

// ---------------- painting helpers ----------------
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
/** Stable per-texel noise 0..1 (no Math.random: the art is the same on every run). */
const noise = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** Base colour with a little Minecraft-style dither toward a shade. */
const dither = (base, shade, k = 0.25) => (x, y, s) => noise(x, y, s) < k ? shade : base;

/**
 * Packs every cube's box UV into a texture and paints it. paint(bone, cubeIndex, face, u, v, w, h) → '#rrggbb' or null
 * (transparent) for texel (u, v) of a face w×h texels (u from the face's left as seen from outside, v from its top).
 * → { texW, texH, png } and sets each cube's uv.
 */
function pack(bones, paint, minW = 64, minH = 32) {
  const items = [];
  for (const b of bones) b.cubes.forEach((c, i) => {
    const [w, h, d] = c.size.map(v => Math.floor(Math.abs(v)));
    items.push({ b, c, i, w, h, d, fw: 2 * d + 2 * w, fh: d + h });
  });
  let W = minW;
  while (items.some(it => it.fw > W)) W *= 2;
  // Shelf packing, tallest first.
  const order = items.slice().sort((a, b) => b.fh - a.fh || b.fw - a.fw);
  let x = 0, y = 0, row = 0;
  for (const it of order) {
    if (x + it.fw > W) { x = 0; y += row; row = 0; }
    it.u = x; it.v = y; x += it.fw; row = Math.max(row, it.fh);
    it.c.uv = [it.u, it.v];
  }
  let H = minH;
  while (y + row > H) H *= 2;
  const png = new PNG({ width: W, height: H });
  png.data.fill(0);
  const put = (px, py, col) => { if (!col) return; const c = typeof col === 'string' ? hex(col) : col; png.data.set(c, (py * W + px) * 4); };
  for (const it of items) {
    const { u, v, w, h, d } = it;
    // Face rectangles of Bedrock's box UV (render-page.js boxFaces), as [x, y, w, h].
    const faces = { east: [u, v + d, d, h], north: [u + d, v + d, w, h], west: [u + d + w, v + d, d, h], south: [u + 2 * d + w, v + d, w, h],
      up: [u + d, v, w, d], down: [u + d + w, v, w, d] };
    for (const [f, [fx, fy, fw, fh]] of Object.entries(faces))
      for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) put(fx + i, fy + j, paint(it.b.name, it.i, f, i, j, fw, fh, fx + i, fy + j));
  }
  return { texW: W, texH: H, png };
}

const cube = (origin, size, extra = {}) => ({ origin, size, uv: [0, 0], ...extra });
const bone = (name, pivot, cubes, extra = {}) => ({ name, pivot, cubes, ...extra });
const geometries = [], textures = {};
function add(id, bones, tex, paint, minW, minH) {
  const p = pack(bones, paint, minW, minH);
  geometries.push({ description: { identifier: id, texture_width: p.texW, texture_height: p.texH }, bones });
  textures[tex] = p.png;
  return p;
}

// ---------------- Sheepuff: Mojang's sheep under a cloud of Aether wool ----------------
// Wool: white with soft blue-grey cloud lumps. The puffed shell (the 'sheepuff_puff' skin) swells the body into a ball.
const WOOL = ['#fbfcff', '#eef1fa', '#dde3f2', '#c9d3ea'];
const woolPaint = (bn, ci, f, i, j, w, h, gx, gy) => {
  const n = noise(gx, gy, 7), m = noise(Math.floor(gx / 2), Math.floor(gy / 2), 3);
  if (f === 'down') return m < 0.5 ? WOOL[2] : WOOL[3];
  return m < 0.12 ? WOOL[2] : n < 0.18 ? WOOL[1] : n > 0.93 ? WOOL[2] : WOOL[0];
};
function woolFrom(id, inflate) {
  const sheep = vendor.get('geometry.sheep.v1.8');
  return sheep.bones.map(b => ({ name: b.name, parent: b.parent || undefined, pivot: b.pivot, ...(b.bindPose ? { bind_pose_rotation: b.bindPose } : {}),
    cubes: b.cubes.map(c => cube(c.origin, c.size, { inflate: inflate[b.name.replace(/\d/, '')] ?? c.inflate })) }));
}
// (64×64 like the vanilla sheep texture: the roster's texSize applies to every layer.)
add('geometry.sheepuff.wool', woolFrom('wool', { body: 2.4, head: 0.8, leg: 0.6 }), 'sheepuff_wool', woolPaint, 64, 64);
// Puffed: the swollen body plus soft lumps on its top, sides and rump, so it reads as a round cloud ball.
add('geometry.sheepuff.puff', [...woolFrom('puff', { body: 4.6, head: 0.8, leg: 0.8 }),
  bone('cloud', [0, 19, 2], [cube([-6, 22, -9], [12, 3, 17]), cube([-4, 24.5, -6], [8, 2, 11]), cube([8, 11, -8], [2, 9, 15]),
    cube([-10, 11, -8], [2, 9, 15], { mirror: true }), cube([-6, 11, 12], [12, 9, 2]), cube([-5, 8, -8], [10, 2, 18])])],
  'sheepuff_puff', woolPaint, 64, 64);

// ---------------- feathered wings (Phyg, Flying Cow) ----------------
// A flat white wing each side, raised and swept back; render-page.js flaps any bone named "wing".
const FEATHER = { base: '#ffffff', soft: '#eef1f7', line: '#d2d8e6', tip: '#b9c3d8', root: '#f6e9c8' };
const wingPaint = (bn, ci, f, i, j, w, h) => {
  if (f === 'east' || f === 'west') {
    // i runs along the wing, j from its top down to the shoulder. Silhouette: a bird's wing seen from the side,
    // low and rounded at the front, rising to long flight feathers at the back with scalloped tips.
    const back = f === 'west' ? i : w - 1 - i, fromRoot = h - 1 - j, k = back / (w - 1);
    const top = Math.round((h - 1) * (0.35 + 0.65 * Math.sqrt(k)));
    if (fromRoot > top) return null;
    if (fromRoot === top && back % 2 === 1 && back > 1) return null;                  // scalloped feather tips
    if (fromRoot <= 1) return fromRoot === 0 ? FEATHER.root : FEATHER.soft;          // coverts at the shoulder
    if ((back + fromRoot) % 3 === 0 && fromRoot > 2) return FEATHER.line;            // feather shafts, swept back
    if (fromRoot >= top - 1) return FEATHER.tip;
    return noise(i, j, 11) < 0.15 ? FEATHER.soft : FEATHER.base;
  }
  return f === 'up' ? FEATHER.soft : FEATHER.line;
};
function wings(id, tex, side, y, z, size, tilt) {
  const [t, h, l] = size;
  const bones = [
    bone('wing0', [side, y, z], [cube([side, y, z - l / 2], [t, h, l])], { rotation: [0, 12, tilt] }),
    bone('wing1', [-side, y, z], [cube([-side - t, y, z - l / 2], [t, h, l], { mirror: true })], { rotation: [0, -12, -tilt] })
  ];
  return add(id, bones, tex, wingPaint, 32, 32);
}
wings('geometry.phyg.wings', 'phyg_wings', 5, 13, -2, [1, 10, 12], 30);
wings('geometry.flying_cow.wings', 'flying_cow_wings', 6, 21, -3, [1, 12, 15], 30);

// ---------------- Aerbunny: a small round puff of white fur ----------------
const BUN = { fur: '#fbfbfe', shade: '#e8eaf4', deep: '#d3d8e8', pink: '#ffb3cc', nose: '#ff8fb4', eye: '#1c1a26', glint: '#ffffff' };
add('geometry.aerbunny', [
  bone('body', [0, 5, 0], [cube([-4, 1, -3], [8, 7, 8], { inflate: 0.3 })]),
  bone('head', [0, 7, -3], [cube([-3, 4, -7], [6, 6, 5])], { parent: 'body' }),
  bone('ear0', [1.5, 10, -4.5], [cube([0.5, 10, -5], [2, 5, 1])], { parent: 'head', rotation: [-15, 0, -12] }),
  bone('ear1', [-1.5, 10, -4.5], [cube([-2.5, 10, -5], [2, 5, 1])], { parent: 'head', rotation: [-15, 0, 12] }),
  bone('tail', [0, 4, 5], [cube([-1.5, 3, 5], [3, 3, 2])], { parent: 'body' }),
  bone('leg0', [2.5, 1, -2], [cube([1.5, 0, -3.5], [2, 1, 3])]),
  bone('leg1', [-2.5, 1, -2], [cube([-3.5, 0, -3.5], [2, 1, 3])]),
  bone('leg2', [2.5, 1, 3], [cube([1.5, 0, 2], [2, 1, 3])]),
  bone('leg3', [-2.5, 1, 3], [cube([-3.5, 0, 2], [2, 1, 3])])
], 'aerbunny', (bn, ci, f, i, j, w, h, gx, gy) => {
  if (bn === 'head' && f === 'north') {
    if (j === 2 && (i === 1 || i === w - 2)) return BUN.eye;
    if (j === 1 && (i === 1 || i === w - 2)) return BUN.glint;
    if (j === 3 && (i === 2 || i === 3)) return BUN.nose;
    if (j === 3 && (i === 0 || i === w - 1)) return BUN.pink;                         // rosy cheeks
  }
  if (/ear/.test(bn) && f === 'north' && j > 0) return BUN.pink;
  if (/leg/.test(bn)) return f === 'down' ? BUN.pink : BUN.shade;
  if (f === 'down') return BUN.deep;
  const n = noise(gx, gy, 5);
  return n < 0.16 ? BUN.shade : n > 0.95 ? BUN.deep : BUN.fur;
});

// ---------------- Moa: the Aether's big flightless bird (Blue, White, Black) ----------------
const moaBones = () => [
  bone('body', [0, 17, 1], [cube([-4, 13, -5], [8, 8, 12])]),
  bone('neck', [0, 20, -3], [cube([-1.5, 19, -5], [3, 10, 3])], { parent: 'body', rotation: [-8, 0, 0] }),
  bone('head', [0, 28, -4], [cube([-2, 28, -8], [4, 4, 6]), cube([-1, 28.5, -11], [2, 2, 3])], { parent: 'neck' }),
  bone('tail', [0, 20, 7], [cube([-3, 19, 6], [6, 2, 7])], { parent: 'body', rotation: [28, 0, 0] }),
  bone('wing0', [4, 20, -1], [cube([4, 15, -3], [1, 6, 10])], { parent: 'body' }),
  bone('wing1', [-4, 20, -1], [cube([-5, 15, -3], [1, 6, 10], { mirror: true })], { parent: 'body' }),
  bone('leg0', [2, 13, 1], [cube([1.5, 1, 0.5], [1, 12, 1]), cube([0.5, 0, -2], [3, 1, 4])]),
  bone('leg1', [-2, 13, 1], [cube([-2.5, 1, 0.5], [1, 12, 1]), cube([-3.5, 0, -2], [3, 1, 4])])
];
function moaPaint(P) {
  return (bn, ci, f, i, j, w, h, gx, gy) => {
    if (/leg/.test(bn)) return ci === 1 ? (f === 'up' ? P.foot : P.footDark) : (i % 2 ? P.leg : P.legDark);
    if (bn === 'head' && ci === 1) return f === 'down' ? P.beakDark : j === 0 && f !== 'up' ? P.beakDark : P.beak;
    if (bn === 'head' && (f === 'east' || f === 'west')) {
      const front = f === 'east' ? i : w - 1 - i;        // texels from the front of the head
      if (front === 1 && j === 1) return P.eye;
      if (front === 2 && j === 1) return P.eyeRing;
      if (front === 1 && j === 0) return P.glint;
    }
    const n = noise(gx, gy, 9);
    if (bn === 'body' && f === 'down') return n < 0.3 ? P.base : P.belly;
    if (bn === 'body' && f === 'north') return j > h * 0.4 ? P.belly : P.base;
    if (/wing/.test(bn)) {
      if (f === 'up' || f === 'down') return P.dark;
      return (i + (j >> 1)) % 3 === 0 ? P.line : j > h - 3 ? P.dark : n < 0.2 ? P.line : P.wing;
    }
    if (bn === 'tail') return (i % 2 === 0 && f !== 'down') ? P.line : P.dark;
    if (bn === 'body' && f === 'up') return (i + j) % 4 === 0 ? P.line : n < 0.25 ? P.dark : P.base;
    return n < 0.18 ? P.dark : P.base;
  };
}
const MOA = {
  moa:       { base: '#79b9ea', dark: '#5c9ddf', line: '#3f78bf', wing: '#68a8e6', belly: '#c6e4fb', beak: '#f4c75c', beakDark: '#c9952e',
               eye: '#16141e', eyeRing: '#ffffff', glint: '#ffffff', leg: '#7a7a88', legDark: '#5d5d6a', foot: '#8c8c9a', footDark: '#5d5d6a' },
  moa_white: { base: '#f3f5fa', dark: '#dde2ee', line: '#bfc8da', wing: '#e9edf6', belly: '#ffffff', beak: '#f4c75c', beakDark: '#c9952e',
               eye: '#16141e', eyeRing: '#c9d2e4', glint: '#ffffff', leg: '#9c9ca8', legDark: '#77778a', foot: '#a8a8b4', footDark: '#77778a' },
  moa_black: { base: '#2f2d3a', dark: '#22212c', line: '#4a4762', wing: '#3a3848', belly: '#46435a', beak: '#e0ad44', beakDark: '#a87a22',
               eye: '#e8e4ff', eyeRing: '#5a5674', glint: '#ffffff', leg: '#4c4c58', legDark: '#33333e', foot: '#585866', footDark: '#33333e' }
};
// The packing is deterministic, so every Moa texture shares geometry.moa's UV layout.
add('geometry.moa', moaBones(), 'moa', moaPaint(MOA.moa));
for (const k of ['moa_white', 'moa_black']) textures[k] = pack(moaBones(), moaPaint(MOA[k]), 64, 32).png;

// ---------------- Aerwhale: the gentle giant of the sky ----------------
const WHALE = { top: '#6c9fe0', topDark: '#5a8cd2', stripe: '#a9cdf6', belly: '#f2f6fc', pleat: '#cfdbee', eye: '#1a1c2c', glint: '#ffffff', fin: '#5a8cd2' };
add('geometry.aerwhale', [
  bone('body', [0, 8, 0], [cube([-8, 2, -14], [16, 12, 26]), cube([-6, 14, -11], [12, 2, 19])]),
  bone('tail', [0, 8, 12], [cube([-4, 5, 12], [8, 6, 10])], { parent: 'body' }),
  bone('fluke', [0, 8, 21], [cube([-9, 7, 21], [18, 2, 7])], { parent: 'tail' }),
  bone('wing0', [8, 6, -4], [cube([8, 5, -7], [7, 1, 6])], { parent: 'body', rotation: [0, 0, -15] }),
  bone('wing1', [-8, 6, -4], [cube([-15, 5, -7], [7, 1, 6], { mirror: true })], { parent: 'body', rotation: [0, 0, 15] })
], 'aerwhale', (bn, ci, f, i, j, w, h, gx, gy) => {
  const n = noise(gx, gy, 13), spot = noise(Math.floor(gx / 2), Math.floor(gy / 2), 17) > 0.86;
  if (f === 'down') return bn === 'body' && i % 3 === 1 ? WHALE.pleat : WHALE.belly;
  if (f === 'up') return bn === 'body' && ci === 1 && i === (w >> 1) ? WHALE.topDark : spot ? WHALE.stripe : n < 0.22 ? WHALE.topDark : WHALE.top;
  if (bn === 'body' && ci === 0 && (f === 'east' || f === 'west')) {
    const front = f === 'east' ? i : w - 1 - i;
    if (front === 4 && j === h - 7) return WHALE.eye;
    if (front === 5 && j === h - 8) return WHALE.glint;
    if (j >= h - 5) return WHALE.belly;
    if (j === h - 6) return WHALE.stripe;
    return spot ? WHALE.stripe : n < 0.2 ? WHALE.topDark : WHALE.top;
  }
  if (bn === 'body' && ci === 0 && f === 'north') {
    if (j === h - 5 && i > 1 && i < w - 2) return WHALE.topDark;                    // the smile
    return j >= h - 5 ? WHALE.belly : n < 0.2 ? WHALE.topDark : WHALE.top;
  }
  if (/wing|fluke/.test(bn)) return WHALE.fin;
  return j >= h - 2 ? WHALE.belly : n < 0.2 ? WHALE.topDark : WHALE.top;
}, 128, 64);

// ---------------- write ----------------
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'aether.geo.json'), JSON.stringify({ format_version: '1.12.0', 'minecraft:geometry': geometries }, null, 1));
for (const [k, png] of Object.entries(textures)) await writeFile(path.join(out, k + '.png'), PNG.sync.write(png));
console.log(geometries.length + ' geometries, ' + Object.keys(textures).length + ' textures in ' + path.relative(process.cwd(), out));
