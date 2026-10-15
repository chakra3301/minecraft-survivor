/* ============ qr.js — tiny offline QR code encoder ============
 * Byte mode, error correction level M, versions 1-6 (up to 106 bytes: plenty
 * for a wallet URI or a link). Used by the Support screen (js/ui/support-ui.js).
 * No network, no library: ISO/IEC 18004 written out, after Project Nayuki's
 * reference encoder (MIT).
 *   G.QR.matrix(text)          -> { size, dark(x, y) }
 *   G.QR.dataURL(text, scale)  -> PNG data URL, black on white with a 4-module quiet zone
 * Check a code with `node tools/mc/check-qr.mjs` (decodes it with macOS CoreImage).
 */
G.QR = (() => {
  // Level M per version: EC codewords per block, data codewords of each block.
  const M = [null,
    [10, [16]], [16, [28]], [26, [44]], [18, [32, 32]], [24, [43, 43]], [16, [27, 27, 27, 27]]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

  // ---------------- Reed-Solomon over GF(256), polynomial 0x11D ----------------
  function mul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function divisor(degree) {
    const r = new Array(degree).fill(0);
    r[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) {
        r[j] = mul(r[j], root);
        if (j + 1 < degree) r[j] ^= r[j + 1];
      }
      root = mul(root, 2);
    }
    return r;
  }
  function remainder(data, div) {
    const r = new Array(div.length).fill(0);
    for (const b of data) {
      const f = b ^ r.shift();
      r.push(0);
      div.forEach((c, i) => { r[i] ^= mul(c, f); });
    }
    return r;
  }

  // ---------------- codewords ----------------
  function codewords(bytes) {
    let ver = 1;
    while (ver <= 6 && bytes.length > M[ver][1].reduce((a, b) => a + b) - 2) ver++;
    if (ver > 6) throw new Error('QR: text too long (' + bytes.length + ' bytes, max 106)');
    const [ecLen, blocks] = M[ver];
    const cap = blocks.reduce((a, b) => a + b) * 8;
    const bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4);                      // byte mode
    put(bytes.length, 8);
    for (const b of bytes) put(b, 8);
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a << 1 | b, 0));
    // Split into blocks, add each block's EC, interleave.
    const div = divisor(ecLen), dBlocks = [], eBlocks = [];
    let k = 0;
    for (const n of blocks) { const d = data.slice(k, k += n); dBlocks.push(d); eBlocks.push(remainder(d, div)); }
    const out = [];
    for (let i = 0; i < Math.max(...blocks); i++) for (const d of dBlocks) if (i < d.length) out.push(d[i]);
    for (let i = 0; i < ecLen; i++) for (const e of eBlocks) out.push(e[i]);
    return { ver, out };
  }

  // ---------------- module placement ----------------
  const MASKS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
  ];

  function build(ver, cw, mask) {
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
    // Timing patterns, then the finders (with separators) and alignment patterns over them.
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    }
    const al = ALIGN[ver];
    for (const ay of al) for (const ax of al) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === al[al.length - 1]) || (ay === 6 && ax === al[al.length - 1])) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    format(set, size, mask);         // reserves the format areas (and the dark module)
    // Data: two-column zigzag from the bottom right, skipping the vertical timing column.
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if (fn[y][x]) continue;
        if (i < cw.length * 8) mod[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
    const m = MASKS[mask];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && m(x, y)) mod[y][x] = !mod[y][x];
    return mod;
  }

  // Format info: level M (00) and the mask, BCH(15,5), XOR 0x5412; two copies.
  function format(set, size, mask) {
    const data = mask;               // level M's bits are 00
    let r = data;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const bits = (data << 10 | r) ^ 0x5412, b = i => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, b(i));
    set(8, 7, b(6)); set(8, 8, b(7)); set(7, 8, b(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, b(i));
    set(8, size - 8, true);
  }

  // Mask penalty (the standard's four rules; finder-like runs read with the quiet zone as light).
  function penalty(mod) {
    const n = mod.length;
    let p = 0, dark = 0;
    const line = get => {
      let s = 0, run = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && get(i) === get(i - 1)) run++;
        else { if (run >= 5) s += run - 2; run = 1; }
      }
      for (let i = -4; i < n; i++) {
        const at = k => k >= 0 && k < n && get(k);
        const core = at(i) && !at(i + 1) && at(i + 2) && at(i + 3) && at(i + 4) && !at(i + 5) && at(i + 6);
        if (!core) continue;
        if (![-4, -3, -2, -1].some(d => at(i + d)) || ![7, 8, 9, 10].some(d => at(i + d))) s += 40;
      }
      return s;
    };
    for (let k = 0; k < n; k++) { p += line(i => mod[k][i]) + line(i => mod[i][k]); }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (mod[y][x]) dark++;
      if (x < n - 1 && y < n - 1 && mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
    }
    return p + 10 * Math.floor(Math.abs(dark * 20 / (n * n) - 10));
  }

  function matrix(text) {
    const { ver, out } = codewords([...new TextEncoder().encode(text)]);
    let best = null, bestP = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const mod = build(ver, out, mask), p = penalty(mod);
      if (p < bestP) { best = mod; bestP = p; }
    }
    return { size: best.length, dark: (x, y) => best[y][x] };
  }

  function dataURL(text, scale = 6) {
    const q = matrix(text), quiet = 4, side = (q.size + quiet * 2) * scale;
    const cv = document.createElement('canvas');
    cv.width = cv.height = side;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, side, side);
    ctx.fillStyle = '#000';
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++)
      if (q.dark(x, y)) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
    return cv.toDataURL('image/png');
  }

  return { matrix, dataURL };
})();
