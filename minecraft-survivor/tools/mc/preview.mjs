// Contact sheet of rendered mobs for eyeballing: one row per mob, chosen anim, 8 directions
// (first frame each; 'key+' = Enchanted), scaled up. node tools/mc/preview.mjs [anim] [out.png] [id ...]
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PNG } from 'pngjs';

const game = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [anim = 'Walk', out = path.join(game, '../artifacts/mobs-preview.png'), ...ids] = process.argv.slice(2);
const mobs = ids.length ? ids : (await readdir(path.join(game, 'assets/mobs'))).sort();
const Z = 2, cell = 96, frameCol = anim === 'Walk' ? 2 : 0;
const img = new PNG({ width: cell * 8 * Z, height: cell * mobs.length * Z });
img.data.fill(0);
for (let i = 0; i < img.data.length; i += 4) { img.data[i] = 0x55; img.data[i + 1] = 0x8a; img.data[i + 2] = 0x3c; img.data[i + 3] = 255; }
for (const [row, id] of mobs.entries()) {
  const [key, shiny] = id.split('+');
  const png = PNG.sync.read(await readFile(path.join(game, 'assets/mobs', key, shiny ? 's' : '', anim + '.png')));
  const meta = JSON.parse(await readFile(path.join(game, 'assets/mobs', key, 'meta.json'), 'utf8'));
  const fw = meta.a[anim].w, fh = meta.a[anim].h;
  for (let dir = 0; dir < 8; dir++) {
    const ox = (dir * cell + (cell - fw) / 2) | 0, oy = (row * cell + (cell - fh) / 2) | 0;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const s = ((dir * fh + y) * png.width + Math.min(frameCol, png.width / fw - 1) * fw + x) * 4;
      if (png.data[s + 3] < 128) continue;
      for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++) {
        const t = (((oy + y) * Z + dy) * img.width + (ox + x) * Z + dx) * 4;
        img.data[t] = png.data[s]; img.data[t + 1] = png.data[s + 1]; img.data[t + 2] = png.data[s + 2];
      }
    }
  }
}
await writeFile(out, PNG.sync.write(img));
console.log(out);
