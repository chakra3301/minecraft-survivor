// Copies the Minecraft textures the game uses out of Mojang's bedrock-samples into
// assets/mc/<group>/..., converting TGA to PNG. Skips PBR maps (_mers, _normal) and
// texture_set.json files.   node tools/mc/import-textures.mjs
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PNG } from 'pngjs';

const game = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = path.join(game, '../vendor/bedrock-samples/resource_pack/textures');
const dst = path.join(game, 'assets/mc');
const GROUPS = ['blocks', 'items', 'particle', 'environment'];

/** Decodes uncompressed or RLE true-colour / greyscale TGA into RGBA. */
export function decodeTga(buf) {
  const idLen = buf[0], cmapType = buf[1], type = buf[2];
  const w = buf.readUInt16LE(12), h = buf.readUInt16LE(14), bpp = buf[16], desc = buf[17];
  if (cmapType) throw new Error('colour-mapped TGA not supported');
  const grey = type === 3 || type === 11, rle = type >= 9;
  const bytes = bpp / 8;
  let p = 18 + idLen;
  const px = new Uint8Array(w * h * 4);
  const read = o => {
    if (grey) return [buf[o], buf[o], buf[o], bytes === 2 ? buf[o + 1] : 255];
    return [buf[o + 2], buf[o + 1], buf[o], bytes === 4 ? buf[o + 3] : 255];
  };
  let i = 0;
  while (i < w * h) {
    if (rle) {
      const c = buf[p++], n = (c & 0x7f) + 1;
      if (c & 0x80) { const v = read(p); p += bytes; for (let k = 0; k < n; k++) px.set(v, 4 * i++); }
      else for (let k = 0; k < n; k++) { px.set(read(p), 4 * i++); p += bytes; }
    } else { px.set(read(p), 4 * i++); p += bytes; }
  }
  // Bit 5 of the descriptor: origin at top. Otherwise rows are bottom-up.
  const png = new PNG({ width: w, height: h });
  const top = desc & 0x20;
  for (let y = 0; y < h; y++) {
    const sy = top ? y : h - 1 - y;
    png.data.set(px.subarray(sy * w * 4, (sy + 1) * w * 4), y * w * 4);
  }
  return png;
}

async function walk(dir, rel = '') {
  const out = [];
  for (const e of await readdir(path.join(dir, rel), { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) out.push(...await walk(dir, r));
    else out.push(r);
  }
  return out;
}

let n = 0;
for (const g of GROUPS) {
  const files = (await walk(path.join(src, g))).filter(f => /\.(png|tga)$/i.test(f) && !/_mers\.|_normal\.|_heightmap\./i.test(f));
  const pngs = new Set(files.filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)));
  for (const f of files) {
    const base = f.slice(0, -4);
    if (f.endsWith('.tga') && pngs.has(base)) continue;      // PNG of the same texture wins
    const out = path.join(dst, g, base + '.png');
    await mkdir(path.dirname(out), { recursive: true });
    const data = await readFile(path.join(src, g, f));
    await writeFile(out, f.endsWith('.tga') ? PNG.sync.write(decodeTga(data)) : data);
    n++;
  }
}
console.log(`${n} textures → assets/mc/{${GROUPS.join(',')}}`);
