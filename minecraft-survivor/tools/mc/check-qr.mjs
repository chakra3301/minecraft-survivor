// Checks that the Support screen's Solana QR code scans. Encodes `solana:<G.SUPPORT.solana>` with the
// game's own encoder (js/core/qr.js), writes it to artifacts/qr/solana-qr.png and decodes it with
// macOS's two QR readers (CoreImage and Vision, through `swift`). Pass other PNGs (e.g. a screenshot
// of the Support screen) to decode them too.
//   node tools/mc/check-qr.mjs [image.png ...]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { PNG } from 'pngjs';

const game = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(game, '..');
const ctx = { TextEncoder, Math, Array, Error };
vm.createContext(ctx);
vm.runInContext('var G = {};', ctx);
for (const f of ['js/data/support.js', 'js/core/qr.js']) vm.runInContext(await readFile(path.join(game, f), 'utf8'), ctx, { filename: f });
const G = ctx.G;
const want = 'solana:' + G.SUPPORT.solana;

const q = G.QR.matrix(want), quiet = 4, scale = 8, side = (q.size + quiet * 2) * scale;
const png = new PNG({ width: side, height: side });
for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
  const mx = Math.floor(x / scale) - quiet, my = Math.floor(y / scale) - quiet;
  const dark = mx >= 0 && my >= 0 && mx < q.size && my < q.size && q.dark(mx, my);
  const i = (y * side + x) * 4;
  png.data[i] = png.data[i + 1] = png.data[i + 2] = dark ? 0 : 255;
  png.data[i + 3] = 255;
}
const out = path.join(root, 'artifacts/qr/solana-qr.png');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, PNG.sync.write(png));
console.log(`encoded ${JSON.stringify(want)}: ${q.size}×${q.size} modules → ${path.relative(root, out)}`);

const SWIFT = `
import CoreImage
import Vision
import Foundation
for p in CommandLine.arguments.dropFirst() {
  let url = URL(fileURLWithPath: p)
  guard let img = CIImage(contentsOf: url) else { print("\\(p)\\tunreadable"); continue }
  let det = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
  for f in det.features(in: img) { if let s = (f as? CIQRCodeFeature)?.messageString { print("\\(p)\\tcoreimage\\t\\(s)") } }
  let req = VNDetectBarcodesRequest()
  req.symbologies = [.qr]
  try? VNImageRequestHandler(url: url).perform([req])
  for r in req.results ?? [] { if let s = r.payloadStringValue { print("\\(p)\\tvision\\t\\(s)") } }
}`;
if (process.platform !== 'darwin') { console.log('No decoder: CoreImage/Vision need macOS. Scan artifacts/qr/solana-qr.png with a phone.'); process.exit(0); }
const swift = path.join(os.tmpdir(), 'mcs-check-qr.swift');
await writeFile(swift, SWIFT);
const files = [out, ...process.argv.slice(2).map(f => path.resolve(f))];
const lines = execFileSync('swift', [swift, ...files], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
let bad = 0;
for (const f of files) {
  const got = lines.filter(l => l.startsWith(f + '\t')).map(l => l.split('\t'));
  const ok = ['coreimage', 'vision'].map(d => { const r = got.find(g => g[1] === d); return [d, r ? r[2] : null]; });
  for (const [d, s] of ok) {
    const pass = s === want;
    if (!pass) bad++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${d.padEnd(9)} ${path.relative(root, f)}: ${s === null ? '(no QR found)' : JSON.stringify(s)}`);
  }
}
if (bad) { console.log(`${bad} decode(s) did not return ${JSON.stringify(want)}`); process.exit(1); }
