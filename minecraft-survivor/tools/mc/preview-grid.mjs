// Grid of every rendered mob (one pose each) for a quick visual check.
//   node tools/mc/preview-grid.mjs [anim] [dir 0-7] [out.png] [filter: base|variants|all]
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PNG } from 'pngjs';
import { ROSTER } from './roster.mjs';

const game = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [anim = 'Idle', dirArg = '1', out = path.join(game, '../artifacts/mobs-grid.png'), which = 'base'] = process.argv.slice(2);
const dir = +dirArg;
const mobs = ROSTER.filter(m => which === 'all' || (which === 'base' ? !m.v : m.v));
const Z = 2, cell = 100, cols = 12, rows = Math.ceil(mobs.length / cols);
const img = new PNG({ width: cell * cols * Z, height: cell * rows * Z });
for (let i = 0; i < img.data.length; i += 4) img.data.set([0x55, 0x8a, 0x3c, 255], i);
for (const [k, m] of mobs.entries()) {
  const png = PNG.sync.read(await readFile(path.join(game, 'assets/mobs', m.key, anim + '.png')));
  const meta = JSON.parse(await readFile(path.join(game, 'assets/mobs', m.key, 'meta.json'), 'utf8'));
  const { w, h } = meta.a[anim];
  const ox = (k % cols) * cell + ((cell - w) >> 1), oy = Math.floor(k / cols) * cell + ((cell - h) >> 1);
  for (let y = 0; y < Math.min(h, cell); y++) for (let x = 0; x < Math.min(w, cell); x++) {
    const s = ((dir * h + y) * png.width + x) * 4;
    if (png.data[s + 3] < 128) continue;
    for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++) {
      const X = (ox + x) * Z + dx, Y = (oy + y) * Z + dy;
      if (X < 0 || Y < 0 || X >= img.width || Y >= img.height) continue;
      img.data.set(png.data.subarray(s, s + 3), (Y * img.width + X) * 4);
    }
  }
}
await writeFile(out, PNG.sync.write(img));
console.log(out, mobs.map(m => m.key).join(' '));
