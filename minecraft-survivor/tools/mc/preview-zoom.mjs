// Close-up of a few mobs: directions 0-3, first frame, 4x.  node tools/mc/preview-zoom.mjs out.png Anim key ...
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PNG } from 'pngjs';
const game = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [out, anim, ...keys] = process.argv.slice(2);
const Z = 4, W = 64, H = 56, D = [0, 1, 2, 3];
const img = new PNG({ width: W * Z * D.length, height: H * Z * keys.length });
img.data.fill(90);
keys.forEach((k, row) => {
  const a = JSON.parse(readFileSync(path.join(game, 'assets/mobs', k, 'meta.json'))).a[anim];
  const p = PNG.sync.read(readFileSync(path.join(game, 'assets/mobs', k, anim + '.png')));
  D.forEach((dir, col) => {
    for (let y = 0; y < Math.min(a.h, H); y++) for (let x = 0; x < Math.min(a.w, W); x++) {
      const s = ((dir * a.h + y) * p.width + x) * 4;
      if (p.data[s + 3] < 128) continue;
      for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++) {
        const t = (((row * H + y) * Z + dy) * img.width + (col * W + x) * Z + dx) * 4;
        img.data.set([p.data[s], p.data[s + 1], p.data[s + 2], 255], t);
      }
    }
  });
});
writeFileSync(out, PNG.sync.write(img));
