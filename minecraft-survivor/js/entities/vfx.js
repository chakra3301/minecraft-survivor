/* ============ vfx.js — pixel art sprites for skills ============
 * Two kinds of shape share one table (SHAPES) and one API:
 *  - procedural shapes (flame, drop, bubble, leaf, bolt, skull...) generated
 *    by code at art resolution and coloured with the element palette, so one
 *    bubble comes out blue for Aquatic or green for Poison;
 *  - Minecraft textures (`tex`: arrow, fire charge, trident, snowball...),
 *    loaded same-origin from assets/mc/. Until a texture has loaded (or if it
 *    fails) its procedural fallback (`fb`) is drawn instead.
 * Everything is drawn at integer scales with smoothing off.
 *
 *   G.VFX.draw(ctx, shape, pal, x, y, { angle, scale, frame, alpha })
 *   G.VFX.forMove(m)  -> how that skill looks (projectile, beam, swing...)
 *   G.VFX.forType(t)  -> default look of an element (enemy shots, hazards)
 */
G.VFX = (() => {
  const PX = G.Sprites.PX;

  // Palettes per element (mid tone ≈ G.U.TYPE_COLOR): outline, dark, mid, light, glow.
  const PAL = {
    normal:   ['#36302a', '#74684f', '#b9ab88', '#e4dabd', '#ffffff'],   // Overworld: iron and sand
    fire:     ['#5a1500', '#b33a06', '#ff8a2b', '#ffc94a', '#fff6b0'],   // Fire: orange and yellow
    water:    ['#0e2559', '#1f4bb0', '#3f76e4', '#8fb8ff', '#e6f2ff'],   // Aquatic: Minecraft water
    grass:    ['#123d0c', '#22661a', '#3f9e2f', '#7fd05a', '#d8ffc0'],   // Nature: leaves
    electric: ['#2e0000', '#7a0505', '#c81414', '#ff3b30', '#ffc2b8'],   // Redstone: dust red, pink glow
    psychic:  ['#0f0a24', '#3d1f6e', '#7a3fc0', '#2fd0b5', '#d4fff6'],   // Ender: purple with pearl teal
    ice:      ['#1d4f6b', '#3d8fb5', '#7fd0ef', '#c8f2ff', '#ffffff'],   // Frost: packed ice
    fighting: ['#3d1a08', '#7a3a16', '#c0703a', '#e8a874', '#fff0dc'],   // Brute: leather and rust
    poison:   ['#1c3306', '#4c7a14', '#9ad13a', '#cdee7c', '#f6ffd8'],   // Poison: potion green
    ground:   ['#3a2410', '#6e4a22', '#b5844d', '#dcb27c', '#f8e6c4'],   // Earth: dirt and terracotta
    flying:   ['#3a4f6e', '#7891b8', '#b6cdef', '#e2f0ff', '#ffffff'],   // Wind: breeze
    bug:      ['#33280a', '#6e5a14', '#c7a92a', '#ecd66a', '#fff8cc'],   // Arthropod: amber
    rock:     ['#26231f', '#4f4a43', '#8f8578', '#bdb5a8', '#ece8e0'],   // Stone: cobblestone
    ghost:    ['#1a2318', '#3c4f38', '#7e9c78', '#b4ccaa', '#eef8e6'],   // Undead: grey-green
    dragon:   ['#2a0630', '#6e1a7a', '#b83cc0', '#e04fd0', '#ffd0f6'],   // Dragon: dragon's breath
    dark:     ['#060b14', '#122a3a', '#1d4a5c', '#3cc8d4', '#d0fbff'],   // Shadow: sculk, cyan glow
    steel:    ['#2a3038', '#5e6873', '#a0aab4', '#d8e0e8', '#ffffff'],   // Iron: iron block
    fairy:    ['#2e1660', '#5e3aa8', '#9a6cf0', '#cfb4ff', '#fff0ff'],   // Magic: enchantment purple
    // Extra looks for single skills.
    aura:     ['#3a2a10', '#8a6a30', '#e8c878', '#fff0b8', '#ffffff'],   // arrow crit sparks
    lightning: ['#1c2350', '#4a5ab0', '#9fb0ff', '#dfe6ff', '#ffffff'],  // lightning bolt
    shulker:  ['#3b2a4a', '#8c6fa0', '#e8d9b0', '#fff7d6', '#ffffff'],   // shulker bullet
    wither:   ['#050505', '#1a1a1a', '#343434', '#565656', '#8a8a8a'],   // wither skull
    witherBlue: ['#06102a', '#14306a', '#2f5fb8', '#7fb0ff', '#dff0ff'], // charged (blue) wither skull
    soul:     ['#04181c', '#0a4a52', '#1c8f9a', '#5ff0f5', '#e0ffff'],   // soul fire
    bone:     ['#3a3426', '#8a8068', '#cfc6a8', '#eee8d4', '#ffffff'],   // bone, evoker fangs
    cactus:   ['#0d2b0a', '#1f5a14', '#3f8a28', '#79bf4a', '#e8f8c0'],   // cactus
    netherite: ['#1a1418', '#3a2e34', '#5e4c56', '#8e7a84', '#d0c4ca']  // netherite swing
  };
  const IDX = { o: 0, d: 1, m: 2, l: 3, w: 4 };
  const H = (a, b, c) => G.U.hash(a, b, c);

  // ---------------- pixel canvas ----------------
  // Shapes write letters (o d m l w, or L = translucent light);
  // they are coloured with the palette afterwards.

  function grid(w, h) {
    const g = Array.from({ length: h }, () => Array(w).fill(null));
    return {
      w, h, g,
      set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; },
      get(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : null; },
      fill(fn) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); if (c) g[y][x] = c; } },
      // 1 px outline around the opaque pixels, like the mob sprites.
      outline() {
        const marks = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (g[y][x]) continue;
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const c = this.get(x + a, y + b); return c && c !== 'o'; })) marks.push([x, y]);
        }
        for (const [x, y] of marks) g[y][x] = 'o';
      },
      line(x0, y0, x1, y1, c, thick = 0, side = null) {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
        for (let i = 0; i <= n; i++) {
          const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
          if (thick) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.get(Math.round(x + a), Math.round(y + b))) this.set(x + a, y + b, side || c);
          this.set(x, y, c);
        }
      },
      arc(cx, cy, r, a0, a1, c) {
        const n = Math.ceil(r * Math.abs(a1 - a0) * 2) + 2;
        for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; this.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c); }
      }
    };
  }

  // ---------------- procedural shapes ----------------
  // They all face RIGHT (directional ones are rotated when drawn).

  const SHAPES = {
    fire: { w: 15, h: 11, frames: 3, dir: true, gen(P, f) {
      const cx = 10.5, cy = 5;
      for (let x = 1; x <= 9; x++) {                               // flickering tail
        const t = (x - 1) / 8;
        const th = 0.5 + t * 2.6 + (H(x, f, 3) - 0.5) * 1.3;
        const yc = cy + Math.sin(x * 1.4 + f * 2.1) * 0.8 * (1 - t);
        for (let y = 0; y < P.h; y++) {
          const d = Math.abs(y - yc);
          if (d > th || (t < 0.3 && H(x, y + f * 7, 5) < 0.4)) continue;
          P.set(x, y, d < th * 0.4 && t > 0.3 ? 'l' : 'm');
        }
      }
      P.fill((x, y) => {                                           // head
        const d = Math.hypot(x - cx, (y - cy) * 1.1);
        return d < 1.3 ? 'w' : d < 2.4 ? 'l' : d < 3.5 ? 'm' : null;
      });
      P.outline();
    } },
    drop: { w: 13, h: 9, dir: true, gen(P) {
      for (let x = 2; x <= 7; x++) {
        const th = (x - 2) / 5 * 2.6;
        for (let y = 0; y < P.h; y++) { const d = Math.abs(y - 4); if (d <= th) P.set(x, y, d < th * 0.5 ? 'l' : 'm'); }
      }
      P.fill((x, y) => { const d = Math.hypot(x - 8.5, y - 4); return d < 1.6 ? 'l' : d < 3.3 ? 'm' : null; });
      P.set(9, 2, 'w'); P.set(10, 3, 'w');
      P.outline();
    } },
    bubble: { w: 11, h: 11, frames: 2, gen(P, f) {
      const rx = 4.3 + f * 0.3, ry = 4.3 - f * 0.3;
      P.fill((x, y) => { const e = Math.hypot((x - 5) / rx, (y - 5) / ry); return e <= 1 ? (e > 0.76 ? 'm' : 'L') : null; });
      P.set(3, 3, 'w'); P.set(4, 3, 'w'); P.set(3, 4, 'w'); P.set(7, 7, 'l');
      P.outline();
    } },
    leaf: { w: 12, h: 7, spin: true, gen(P) {
      P.fill((x, y) => { const dx = Math.abs(x - 5.5) / 5.6, dy = (y - 3) / 2.7; return dx + dy * dy <= 1 ? (y < 3 ? 'l' : 'm') : null; });
      for (let x = 2; x <= 9; x++) P.set(x, 3, 'd');
      P.set(4, 2, 'w');
      P.outline();
    } },
    bolt: { w: 15, h: 10, frames: 2, dir: true, gen(P, f) {
      const pts = f ? [[0, 3], [4, 7], [7, 2], [10, 7], [14, 4]] : [[0, 6], [4, 2], [7, 7], [10, 2], [14, 5]];
      for (let i = 0; i < pts.length - 1; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 'w', 1, 'l');
      P.outline();
    } },
    shard: { w: 13, h: 7, dir: true, gen(P) {
      P.fill((x, y) => Math.abs(x - 6) / 6.2 + Math.abs(y - 3) / 3.4 <= 1 ? (y < 3 ? 'l' : 'm') : null);
      for (let x = 6; x <= 11; x++) P.set(x, 3, 'w');
      P.set(4, 2, 'w');
      P.outline();
    } },
    rock: { w: 12, h: 11, frames: 3, spin: true, gen(P, f) {
      const r = [0, 1, 2, 3, 4, 5, 6].map(i => 3.6 + H(i, f, 9) * 1.4);
      P.fill((x, y) => {
        const dx = x - 5.5, dy = y - 5, a = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * 6;
        const i = Math.floor(a), t = a - i;
        const R = r[i] * (1 - t) + r[(i + 1) % 6] * t;
        const d = Math.hypot(dx, dy);
        if (d > R) return null;
        const lit = (-dx * 0.6 - dy * 0.8) / R;
        return lit > 0.35 ? 'l' : lit > -0.3 ? 'm' : 'd';
      });
      P.set(6, 5, 'd'); P.set(7, 6, 'd'); P.set(4, 3, 'w');
      P.outline();
    } },
    blob: { w: 12, h: 11, frames: 2, gen(P, f) {
      P.fill((x, y) => {
        const dx = x - 5.5, dy = y - 4.8, a = Math.atan2(dy, dx);
        const R = 3.9 + Math.sin(a * 3 + f * 2) * 0.5;
        const d = Math.hypot(dx, dy);
        if (d > R) return null;
        const lit = (-dx * 0.6 - dy * 0.8) / R;
        return lit > 0.4 ? 'l' : lit > -0.35 ? 'm' : 'd';
      });
      P.set(4, 3, 'w'); P.set(3, 3, 'w');
      P.set(6, 9, 'm'); if (f) P.set(6, 10, 'm');                   // hanging drip
      P.outline();
    } },
    needle: { w: 13, h: 5, dir: true, gen(P) {
      for (let x = 1; x <= 9; x++) P.set(x, 2, 'm');
      for (let x = 3; x <= 8; x++) P.set(x, 1, 'l');
      P.set(10, 2, 'w'); P.set(11, 2, 'w');
      P.set(1, 1, 'd'); P.set(1, 3, 'd');
      P.outline();
    } },
    star: { w: 11, h: 11, frames: 2, spin: true, gen(P, f) {
      const L = f ? 3 : 4;
      for (let i = -L; i <= L; i++) { P.set(5 + i, 5, Math.abs(i) === L ? 'm' : 'l'); P.set(5, 5 + i, Math.abs(i) === L ? 'm' : 'l'); }
      const D = f ? 2 : 1;
      for (let i = 1; i <= D; i++) for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) P.set(5 + a * i, 5 + b * i, 'l');
      P.set(5, 5, 'w'); P.set(4, 5, 'w'); P.set(6, 5, 'w'); P.set(5, 4, 'w'); P.set(5, 6, 'w');
    } },
    streak: { w: 15, h: 5, dir: true, gen(P) {
      for (let x = 0; x < 15; x++) P.set(x, 2, x < 4 ? 'd' : x < 8 ? 'm' : x < 12 ? 'l' : 'w');
      for (let x = 7; x <= 12; x++) { P.set(x, 1, 'l'); P.set(x, 3, 'm'); }
      P.set(13, 1, 'w'); P.set(13, 3, 'w');
    } },
    wind: { w: 13, h: 11, frames: 2, spin: true, gen(P, f) {
      P.arc(6, 5, 4.6, -0.6 + f * 0.7, 2.9 + f * 0.7, 'l');
      P.arc(6, 5, 3.6, -0.3 + f * 0.7, 2.2 + f * 0.7, 'w');
      P.arc(6, 5, 2.2, 1.8 + f, 4.6 + f, 'l');
    } },
    web: { w: 11, h: 11, spin: true, gen(P) {
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; P.line(5, 5, 5 + Math.cos(a) * 5, 5 + Math.sin(a) * 5, 'l'); }
      for (const r of [2.4, 4.4]) for (let k = 0; k < 8; k++) {
        const a0 = k * Math.PI / 4, a1 = (k + 1) * Math.PI / 4;
        P.line(5 + Math.cos(a0) * r, 5 + Math.sin(a0) * r, 5 + Math.cos(a1) * r, 5 + Math.sin(a1) * r, 'w');
      }
    } },
    ring: { w: 13, h: 13, frames: 2, gen(P, f) {
      P.fill((x, y) => {
        const d = Math.hypot(x - 6, y - 6);
        if (Math.abs(d - (5 + f * 0.6)) < 0.75) return 'm';
        if (Math.abs(d - (3 + f * 0.5)) < 0.7) return 'l';
        return null;
      });
      P.set(6, 6, 'w');
    } },
    crescent: { w: 12, h: 11, dir: true, gen(P) {
      P.fill((x, y) => {
        const a = Math.hypot(x - 6.5, y - 5), b = Math.hypot(x - 3.8, y - 5);
        if (a > 4.8 || b < 4.2) return null;
        return b < 5.1 ? 'l' : 'm';
      });
      P.outline();
    } },
    note: { w: 11, h: 11, dir: true, gen(P) {
      P.arc(1, 5, 2.2, -0.7, 0.7, 'w');
      P.arc(1, 5, 4.6, -0.6, 0.6, 'l');
      P.arc(1, 5, 7.2, -0.5, 0.5, 'm');
    } },
    impact: { w: 15, h: 15, frames: 2, gen(P, f) {
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + (f ? Math.PI / 8 : 0), L = (k % 2 ? 3.5 : 6) * (f ? 1 : 0.75);
        P.line(7, 7, 7 + Math.cos(a) * L, 7 + Math.sin(a) * L, 'l');
        P.set(7 + Math.cos(a) * L, 7 + Math.sin(a) * L, 'm');
      }
      P.fill((x, y) => Math.hypot(x - 7, y - 7) < 1.8 ? 'w' : null);
    } },
    claw: { w: 13, h: 13, gen(P) {
      for (let i = 0; i < 3; i++) P.line(1 + i * 3.5, 11, 6 + i * 3.5, 1, 'w', 1, 'l');
      P.outline();
    } },
    jaws: { w: 13, h: 11, frames: 2, gen(P, f) {
      const gap = f ? 0 : 2;
      for (let x = 1; x <= 11; x++) { P.set(x, 1, 'm'); P.set(x, 9, 'm'); }
      for (let t = 0; t < 4; t++) {
        const x = 2 + t * 3;
        P.set(x, 2, 'w'); P.set(x + 1, 2, 'w'); P.set(x, 3, 'w'); P.set(x + 1, 3, 'l');
        if (!gap) { P.set(x, 4, 'w'); }
        P.set(x + 1, 8, 'w'); P.set(x + 2, 8, 'w'); P.set(x + 1, 7, 'w'); P.set(x + 2, 7, 'l');
        if (!gap) P.set(x + 1, 6, 'w');
      }
      P.outline();
    } },
    arrow: { w: 7, h: 9, gen(P) {
      for (let y = 0; y < 4; y++) for (let x = 3 - y; x <= 3 + y; x++) P.set(x, y, x === 3 - y ? 'w' : 'l');
      for (let y = 4; y < 9; y++) for (let x = 2; x <= 4; x++) P.set(x, y, x === 2 ? 'w' : 'm');
      P.outline();
    } },
    ball: { w: 11, h: 11, frames: 2, gen(P, f) {
      P.fill((x, y) => { const d = Math.hypot(x - 5, y - 5); return d < 1.5 ? 'w' : d < 2.9 ? 'l' : d < 4.2 + f * 0.3 ? 'm' : null; });
      P.set(3, 3, 'w');
      P.outline();
    } },
    shadow: { w: 13, h: 13, frames: 3, gen(P, f) {
      P.fill((x, y) => { const d = Math.hypot(x - 6, y - 6); return d < 1.6 ? 'l' : d < 3 ? 'm' : d < 4.4 ? 'd' : null; });
      for (let k = 0; k < 6; k++) {                                 // shadow wisps
        const a = k * 1.05 + f * 0.7, r = 4.8 + H(k, f, 4) * 1.4;
        P.set(6 + Math.cos(a) * r, 6 + Math.sin(a) * r, 'm');
      }
      P.set(5, 5, 'w');
      P.outline();
    } },
    heart: { w: 9, h: 8, gen(P) {
      ['.ll...ll.', 'lwll.llll', 'lllllllll', 'lllllllll', '.lllllll.', '..lllll..', '...lll...', '....l....']
        .forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') P.set(x, y, c === 'w' ? 'w' : 'l'); }));
      P.outline();
    } },
    // Wither skull (eyes are holes in the outline colour).
    skull: { w: 11, h: 10, gen(P) {
      rows(P, 1, 1, ['.lllllll.', 'lllllllll', 'lmmmmmmml', 'moommmoom', 'moommmoom', 'mmmmdmmmm', '.mdmdmdm.', '..mmmmm..']);
      P.outline();
    } },
    // Shulker bullet: a small spinning diamond.
    bullet: { w: 11, h: 11, spin: true, gen(P) {
      rows(P, 1, 1, ['....w....', '...wlw...', '..llmll..', '.lmmmmml.', 'wlmmwmmlw', '.lmmmmml.', '..llmll..', '...wlw...', '....w....']);
      P.outline();
    } },
    // Anvil seen from the side (stays upright while it falls).
    anvil: { w: 15, h: 11, upright: true, gen(P) {
      rows(P, 1, 1, ['wllllllllllll', 'mmmmmmmmmmmmm', '..mmmmmmmmm..', '....mmmmm....', '....mdmmm....', '....ddddd....', '..lllllllll..', '.mmmmmmmmmmm.', '.ddddddddddd.']);
      P.outline();
    } }
  };

  function rows(P, x0, y0, list) {
    list.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') P.set(x0 + x, y0 + y, c); }));
  }

  // ---------------- Minecraft textures ----------------
  /*
   * tex:   texture under assets/mc/ (16×16; strips use frame 0)
   * face:  direction the art points in its image (most items point up-right)
   * dir:   rotated to the flight direction · spin: spins in flight
   * fb:    procedural shape drawn until the texture loads
   */
  const UP_RIGHT = -Math.PI / 4;
  const TEX = {
    bowArrow:     { tex: 'items/arrow', dir: true, face: UP_RIGHT, fb: 'needle' },
    arrowPoison:  { tex: 'items/tipped_arrow_poison', dir: true, face: UP_RIGHT, fb: 'needle' },
    trident:      { tex: 'items/trident', dir: true, face: UP_RIGHT, fb: 'drop' },
    spear:        { tex: 'items/spear/iron_spear', dir: true, face: UP_RIGHT, fb: 'streak' },
    spearEvo:     { tex: 'items/spear/netherite_spear', dir: true, face: UP_RIGHT, fb: 'streak' },
    blazeRod:     { tex: 'items/blaze_rod', dir: true, face: UP_RIGHT, fb: 'fire' },
    bone:         { tex: 'items/bone', spin: true, face: UP_RIGHT, fb: 'crescent' },
    fireball:     { tex: 'items/fireball', fb: 'ball' },
    dragonFireball: { tex: 'items/dragon_fireball', fb: 'ball' },
    snowball:     { tex: 'items/snowball', fb: 'ball' },
    enderPearl:   { tex: 'items/ender_pearl', fb: 'ball' },
    windCharge:   { tex: 'items/wind_charge', spin: true, fb: 'wind' },
    potionPoison: { tex: 'items/potion_bottle_splash_poison', fb: 'blob' },
    pufferfish:   { tex: 'items/fish_pufferfish_raw', fb: 'star' },
    cobweb:       { tex: 'blocks/web', fb: 'web' },
    shriek:       { tex: 'particle/shriek', fb: 'ring' },
    dripstone:    { tex: 'blocks/pointed_dripstone_down_tip', dir: true, face: Math.PI / 2, fb: 'rock' },
    armorStand:   { tex: 'items/armor_stand', fb: 'star' },
    blazePowder:  { tex: 'items/blaze_powder', fb: 'fire' },
    // Melee weapons swept along the arc (see G.FX.slash, melee: 'weapon').
    ironSword:    { tex: 'items/iron_sword', dir: true, face: UP_RIGHT, fb: 'streak' },
    netheriteSword: { tex: 'items/netherite_sword', dir: true, face: UP_RIGHT, fb: 'streak' },
    ironAxe:      { tex: 'items/iron_axe', dir: true, face: UP_RIGHT, fb: 'streak' },
    netheriteAxe: { tex: 'items/netherite_axe', dir: true, face: UP_RIGHT, fb: 'streak' },
    ironPickaxe:  { tex: 'items/iron_pickaxe', dir: true, face: UP_RIGHT, fb: 'streak' },
    diamondPickaxe: { tex: 'items/diamond_pickaxe', dir: true, face: UP_RIGHT, fb: 'streak' },
    mace:         { tex: 'items/mace', dir: true, face: UP_RIGHT, fb: 'streak' }
  };
  const TEX_PX = 16;
  const cache = new Map();                                      // sprite canvases
  const images = new Map();                                     // path -> Image (or 'failed')

  function texImage(path) {
    let im = images.get(path);
    if (!im) {
      im = new Image();
      im.decoding = 'async';
      im.onload = () => { cache.forEach((v, k) => { if (k.startsWith('tex|' + path)) cache.delete(k); }); };
      im.onerror = () => images.set(path, 'failed');
      im.src = new URL('assets/mc/' + path + '.png', document.baseURI).href;
      images.set(path, im);
    }
    return im !== 'failed' && im.complete && im.naturalWidth ? im : null;
  }
  for (const k in TEX) { SHAPES[k] = Object.assign({ w: TEX_PX, h: TEX_PX }, TEX[k]); texImage(TEX[k].tex); }

  // ---------------- cache and drawing ----------------

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }

  /** The shape actually drawn now: a texture until it loads falls back to `fb`. */
  function resolve(shape) {
    const S = SHAPES[shape];
    if (!S) return 'ball';
    if (S.tex && !texImage(S.tex)) return S.fb || 'ball';
    return shape;
  }

  function sprite(shape, pal, frame = 0) {
    shape = resolve(shape);
    const S = SHAPES[shape];
    if (S.tex) {
      // Texture: frame 0 (top square), copied once into its own canvas.
      const k = 'tex|' + S.tex;
      let cv = cache.get(k);
      if (cv) return cv;
      const im = texImage(S.tex), side = im.naturalWidth;
      cv = document.createElement('canvas');
      cv.width = cv.height = side;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(im, 0, 0, side, side, 0, 0, side, side);
      cache.set(k, cv);
      return cv;
    }
    const f = (frame | 0) % (S.frames || 1);
    const k = shape + '|' + pal + '|' + f;
    let cv = cache.get(k);
    if (cv) return cv;
    const P = grid(S.w, S.h);
    S.gen(P, f);
    cv = document.createElement('canvas');
    cv.width = S.w; cv.height = S.h;
    const c = cv.getContext('2d');
    const colors = PAL[pal] || PAL.normal;
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
      const ch = P.g[y][x];
      if (!ch) continue;
      c.fillStyle = ch === 'L' ? rgba(colors[3], 0.5) : colors[IDX[ch]];
      c.fillRect(x, y, 1, 1);
    }
    cache.set(k, cv);
    return cv;
  }

  /** Draws centred on (x, y). opts: angle, scale (1 = one art pixel = PX), frame, alpha. */
  function draw(ctx, shape, pal, x, y, o = {}) {
    shape = resolve(shape);
    const S = SHAPES[shape];
    const cv = sprite(shape, pal, o.frame || 0);
    // Integer scale: crisp pixels. 16-texel textures sit one step smaller than
    // the 11-13 px procedural shapes so both read at about the same size.
    const k = Math.max(1, Math.round(PX * (o.scale || 1) * (S.tex ? 0.8 : 1)));
    const w = S.tex ? cv.width : S.w, h = S.tex ? cv.height : S.h;
    ctx.save();
    if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= o.alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(x), Math.round(y));
    let a = S.upright ? 0 : o.angle || 0;
    if (a || S.face) {
      a = Math.round(a / (Math.PI / 8)) * (Math.PI / 8);          // 16 directions: less flicker
      // Textures that point somewhere (arrows, swords...) only turn with a direction.
      if (S.face && (S.dir || S.spin || o.angle)) a -= S.face;
      if (a) ctx.rotate(a);
    }
    ctx.drawImage(cv, -w * k / 2, -h * k / 2, w * k, h * k);
    ctx.restore();
  }

  function isDir(shape) { return !!(SHAPES[shape] && SHAPES[shape].dir); }
  function spins(shape) { return !!(SHAPES[shape] && SHAPES[shape].spin); }
  function frames(shape) { const S = SHAPES[resolve(shape)]; return (S && S.frames) || 1; }

  // ---------------- how each skill looks ----------------
  //   proj:   projectile shape (also novas, orbs, mines, meteors and turret shots)
  //   beam:   shape that travels along the beam ('lightning' = zigzag)
  //   melee:  extra on the swing (weapon, impact, jaws, claw, vine, feather)
  //   weapon: texture shape swept along the arc when melee is 'weapon'
  //   turret: what the turret itself looks like (default: proj)
  //   aura / buff: particle that comes with it
  //   pal: palette if not the element's · trail: trail particles
  //   evo: overrides once the skill is enchanted (evolved)

  const MOVE = {
    // Overworld
    'tackle':        { melee: 'weapon', weapon: 'ironSword', pal: 'steel', evo: { weapon: 'netheriteSword', pal: 'netherite' } },
    'quick-attack':  { proj: 'spear', evo: { proj: 'spearEvo' } },
    'body-slam':     { melee: 'weapon', weapon: 'mace', pal: 'steel' },
    'hyper-voice':   { proj: 'note' },
    'substitute':    { proj: 'bowArrow', turret: 'armorStand', trail: 'spark', pal: 'aura' },
    'swords-dance':  { buff: 'arrow', pal: 'fighting' },
    'agility':       { buff: 'arrow', pal: 'flying' },
    'harden':        { buff: 'arrow', pal: 'steel' },
    // Fire
    'ember':         { proj: 'fireball', trail: 'ember' },
    'heat-wave':     { proj: 'fire', trail: 'ember' },
    'fire-spin':     { proj: 'blazeRod', trail: 'ember' },
    'flamethrower':  { proj: 'fire', trail: 'ember', beam: 'fire' },
    'will-o-wisp':   { proj: 'fireball', turret: 'blazePowder', trail: 'ember' },
    'flame-wheel':   { proj: 'fire', aura: 'fire' },
    // Aquatic
    'water-gun':     { proj: 'trident', trail: 'drip' },
    'bubble':        { proj: 'bubble' },
    'hydro-pump':    { beam: 'drop' },
    'aqua-ring':     { buff: 'bubble' },
    'bubble-beam':   { proj: 'bubble' },
    // Nature
    'vine-whip':     { melee: 'vine' },
    'razor-leaf':    { proj: 'leaf' },
    'leaf-storm':    { proj: 'leaf' },
    'giga-drain':    { aura: 'leaf', inward: true },
    // Redstone
    'thunder-shock': { proj: 'bolt', trail: 'spark' },
    'discharge':     { aura: 'bolt' },
    'thunderbolt':   { beam: 'lightning', pal: 'lightning' },
    // Ender
    'confusion':     { proj: 'bullet', pal: 'shulker', trail: 'spark' },
    'psybeam':       { beam: 'ring' },
    'psychic':       { proj: 'enderPearl', trail: 'wisp' },
    'psycho-cut':    { proj: 'crescent' },
    // Poison
    'sludge':        { proj: 'potionPoison', trail: 'bubbles' },
    'poison-sting':  { proj: 'arrowPoison', trail: 'bubbles' },
    'toxic':         { aura: 'bubble', rise: true },
    'toxic-spikes':  { proj: 'pufferfish' },
    // Earth
    'mud-shot':      { proj: 'blob', trail: 'dirt' },
    'bulldoze':      { aura: 'rock', rise: true },
    'bonemerang':    { proj: 'bone', pal: 'bone' },
    'spikes':        { proj: 'star', pal: 'cactus' },
    // Wind
    'gust':          { proj: 'windCharge' },
    'wing-attack':   { melee: 'feather' },
    'aerial-ace':    { proj: 'wind' },
    // Arthropod
    'bug-bite':      { melee: 'jaws' },
    'string-shot':   { proj: 'cobweb' },
    'bug-buzz':      { aura: 'note' },
    // Stone
    'rock-throw':    { proj: 'rock', trail: 'dirt' },
    'rock-slide':    { proj: 'dripstone', trail: 'dirt' },
    // Frost
    'ice-beam':      { beam: 'shard' },
    'powder-snow':   { aura: 'star' },
    'hail':          { proj: 'snowball' },
    // Brute
    'karate-chop':   { melee: 'weapon', weapon: 'ironAxe', pal: 'steel', evo: { weapon: 'netheriteAxe', pal: 'netherite' } },
    'aura-sphere':   { proj: 'bowArrow', pal: 'aura', trail: 'spark' },
    // Undead
    'lick':          { melee: 'impact' },
    'shadow-ball':   { proj: 'skull', pal: 'wither', trail: 'wisp', evo: { pal: 'witherBlue' } },
    'hex':           { beam: 'shadow', proj: 'shadow', pal: 'soul' },
    // Dragon
    'dragon-rage':   { beam: 'fire' },
    'dragon-dance':  { buff: 'arrow' },
    // Magic
    'fairy-wind':    { proj: 'star' },
    'dazzling-gleam': { aura: 'star' },
    // Iron
    'metal-claw':    { melee: 'weapon', weapon: 'ironPickaxe', pal: 'steel', evo: { weapon: 'diamondPickaxe' } },
    'flash-cannon':  { beam: 'shard' },
    'meteor-mash':   { proj: 'anvil', trail: 'spark' },
    // Shadow
    'bite':          { melee: 'jaws', pal: 'bone' },
    'dark-pulse':    { proj: 'shriek' },
    'night-shade':   { aura: 'shadow', rise: true }
  };

  // Default look per element: enemy shots and hazards. The shooters decide it:
  // skeletons, strays and drowned (Undead) and pillagers (Shadow) fire arrows,
  // llamas (Overworld) spit, blazes fire charges, snow golems snowballs,
  // witches potions, breezes wind charges, shulkers bullets.
  const TYPE_SHAPE = {
    normal: 'blob', fire: 'fireball', water: 'trident', grass: 'leaf', electric: 'bolt', ice: 'snowball',
    fighting: 'bowArrow', poison: 'potionPoison', ground: 'blob', flying: 'windCharge', psychic: 'bullet',
    bug: 'needle', rock: 'rock', ghost: 'bowArrow', dragon: 'dragonFireball', dark: 'bowArrow', steel: 'shard',
    fairy: 'star'
  };
  const TYPE_PAL = { psychic: 'shulker' };

  function forMove(m) {
    const v = MOVE[m.id] || {};
    const out = Object.assign({ proj: TYPE_SHAPE[m.type] || 'ball' }, v, { pal: v.pal || m.type });
    if (m.evolved && v.evo) Object.assign(out, v.evo);
    delete out.evo;
    return out;
  }
  function forType(type) {
    return { proj: TYPE_SHAPE[type] || 'ball', pal: TYPE_PAL[type] || (PAL[type] ? type : 'normal') };
  }

  return { PAL, SHAPES, draw, sprite, forMove, forType, isDir, spins, frames };
})();
