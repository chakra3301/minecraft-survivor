// App icons and favicon: an isometric grass block on a dark background, drawn from
// the game's own textures (blocks/grass_top tinted plains green + blocks/grass_side_carried).
//   node tools/mc/make-icons.mjs
// Writes assets/icons/icon-{48,96,144,180,192,512}.png, icon-maskable-512.png and favicon.ico.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PNG } from 'pngjs';

const game = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tex = async n => PNG.sync.read(await readFile(path.join(game, 'assets/mc/blocks', n + '.png')));
const top = await tex('grass_top'), side = await tex('grass_side_carried');
const TINT = [0x79, 0xc0, 0x5a];                 // plains grass (CONTENT.md)
const BG_TOP = [0x22, 0x22, 0x28], BG_BOT = [0x0b, 0x0b, 0x0f];

/** Texel (x, y) of a 16×16 texture (first frame of a strip), as [r, g, b, a]. */
function texel(png, u, v, tint) {
  const x = Math.min(15, Math.max(0, Math.floor(u * 16))), y = Math.min(15, Math.max(0, Math.floor(v * 16)));
  const i = (y * png.width + x) * 4, d = png.data;
  const c = [d[i], d[i + 1], d[i + 2], d[i + 3]];
  if (tint) for (let k = 0; k < 3; k++) c[k] = Math.round(c[k] * tint[k] / 255);
  return c;
}

/** Solves p = o + U·a + V·b; returns [U, V] or null outside the face. */
function inFace(px, py, o, a, b) {
  const det = a[0] * b[1] - a[1] * b[0];
  const dx = px - o[0], dy = py - o[1];
  const U = (dx * b[1] - dy * b[0]) / det, V = (a[0] * dy - a[1] * dx) / det;
  return U >= 0 && U < 1 && V >= 0 && V < 1 ? [U, V] : null;
}

/** Colour of the cube at a sample point (or null), with Minecraft's face shading. */
function cube(px, py, cx, cy, r) {
  const a = r * Math.cos(Math.PI / 6);
  let f;
  if ((f = inFace(px, py, [cx, cy - r], [a, r / 2], [-a, r / 2]))) return texel(top, f[0], f[1], TINT);
  if ((f = inFace(px, py, [cx - a, cy - r / 2], [a, r / 2], [0, r]))) return shadeC(texel(side, f[0], f[1]), 0.8);
  if ((f = inFace(px, py, [cx, cy], [a, -r / 2], [0, r]))) return shadeC(texel(side, f[0], f[1]), 0.6);
  return null;
}
const shadeC = (c, k) => [c[0] * k, c[1] * k, c[2] * k, c[3]];

/**
 * @param size   output side in px
 * @param scale  cube "radius" as a fraction of the side
 * @param bg     dark background (false: transparent, for the favicon)
 */
function render(size, scale, bg) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2, r = size * scale, cy = size / 2 + r * 0.06;
  const SS = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let R = 0, G = 0, B = 0, A = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
      let c = cube(px, py, cx, cy, r);
      if (!c && bg) {
        const t = py / size, k = 1 - t;
        c = [BG_TOP[0] * k + BG_BOT[0] * t, BG_TOP[1] * k + BG_BOT[1] * t, BG_TOP[2] * k + BG_BOT[2] * t, 255];
        // Soft green glow and a ground shadow under the block.
        const g = Math.max(0, 1 - Math.hypot(px - cx, py - cy) / (r * 1.9));
        c = [c[0] + 40 * g * g, c[1] + 70 * g * g, c[2] + 30 * g * g, 255];
        const sh = ((px - cx) / (r * 1.05)) ** 2 + ((py - (cy + r * 1.08)) / (r * 0.28)) ** 2;
        if (sh < 1) { const k2 = 1 - 0.55 * (1 - sh); c = [c[0] * k2, c[1] * k2, c[2] * k2, 255]; }
      }
      if (!c) continue;
      const al = c[3] / 255;
      R += c[0] * al; G += c[1] * al; B += c[2] * al; A += al;
    }
    const i = (y * size + x) * 4, n = SS * SS;
    png.data[i + 3] = Math.round(A / n * 255);
    if (A > 0) { png.data[i] = Math.round(R / A); png.data[i + 1] = Math.round(G / A); png.data[i + 2] = Math.round(B / A); }
  }
  return PNG.sync.write(png);
}

/** ICO with PNG-compressed entries. */
function ico(images) {
  const head = Buffer.alloc(6 + images.length * 16);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let off = head.length;
  images.forEach(({ size, data }, k) => {
    const e = 6 + k * 16;
    head[e] = size >= 256 ? 0 : size; head[e + 1] = size >= 256 ? 0 : size;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += data.length;
  });
  return Buffer.concat([head, ...images.map(i => i.data)]);
}

const dir = path.join(game, 'assets/icons');
await mkdir(dir, { recursive: true });
for (const s of [48, 96, 144, 180, 192, 512]) await writeFile(path.join(dir, `icon-${s}.png`), render(s, 0.36, true));
// Maskable: the block stays inside the 80% safe circle.
await writeFile(path.join(dir, 'icon-maskable-512.png'), render(512, 0.27, true));
await writeFile(path.join(game, 'favicon.ico'), ico([16, 32, 48].map(size => ({ size, data: render(size, 0.5, false) }))));
console.log('icons written to', path.relative(process.cwd(), dir), '+ favicon.ico');
