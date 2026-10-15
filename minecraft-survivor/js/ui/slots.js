/* ============ slots.js — el Mob Spawner del gacha ============
 * Se dibuja entero en un <canvas> a resolución de arte (176×170) y se escala
 * sin suavizado, como el resto del juego: una jaula de Mob Spawner (su textura
 * de Minecraft) con llamas dentro, tres rodillos y una palanca.
 *
 *   palanca → giran los 3 rodillos → paran uno a uno en el material de la
 *   rareza que ha salido (carbón, hierro, oro, diamante y estrella del Nether,
 *   como en G.Icons.rarity; la estrella violeta es el Encantado). Si es Épica,
 *   Legendaria o encantado, el último rodillo se hace esperar y las lámparas
 *   de redstone se vuelven locas.
 *   La ×10 son 10 tiradas rápidas; cada premio cae a la bandeja.
 *
 * Un clic acelera la animación.
 */
G.Slots = (() => {
  const W = 176, H = 170, CELL = 36, ICO = 32;
  const SYM = G.Icons.RARITY_BALL;
  const STRIP = ['ball', 'ball2', 'ball', 'ball3', 'ball', 'ball2', 'ballLux', 'ball', 'ball4', 'ball2', 'ball3', 'shiny', 'ball', 'ball2'];
  const REEL_X = [26, 65, 104], REEL_W = 36, REEL_Y = 44, REEL_H = 46, MID = REEL_Y + REEL_H / 2;
  const C = {
    iron: '#3a3d44', ironL: '#6a6e78', ironD: '#1c1e23', dark: '#0b0b0e', inside: '#120c0a',
    glass: '#0d0d12', slot: '#8b8b8b', slotD: '#373737', slotL: '#c6c6c6',
    led: '#140808', lampOn: '#ff4a2a', lampHi: '#ffc2a0', lampOff: '#4a1a14', text: '#f0f0f0',
    stone: '#7a7a7a', stoneD: '#4e4e4e', stick: '#8a5a2b', stickD: '#5a3a1a'
  };
  const ENCHANT = '#c77dff';

  let cv = null, ctx = null, st = null, raf = 0, last = 0, fast = false;

  const symOf = r => (r.shiny ? 'shiny' : SYM[r.rarity]);
  const colOf = r => (r.shiny ? ENCHANT : G.Gacha.RARITY_COLOR[r.rarity]);

  function wait(s) {
    return new Promise(res => {
      const end = performance.now() + s * 1000 * (fast ? 0.25 : 1);
      (function chk() { if (performance.now() >= end || !st) res(); else setTimeout(chk, 16); })();
    });
  }

  /** Anima las tiradas. → Promise que se resuelve al terminar. */
  async function play(canvas, results) {
    cv = canvas; ctx = cv.getContext('2d');
    fast = false;
    cv.onclick = () => { fast = true; };
    st = {
      t: 0, lever: 0, reels: REEL_X.map(() => ({ off: Math.random() * 400, spin: false, sym: 'ball', bounce: 0, speed: 0 })),
      ten: results.length === 10, tray: [], led: results.length === 10 ? '×10 SPAWN' : 'GOOD LUCK!', ledCol: C.lampHi, win: null, frenzy: 0, sparks: [], flames: []
    };
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);

    const ten = results.length === 10;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (ten) st.led = 'SPAWN ' + (i + 1) + '/10';
      // Palanca.
      G.Audio.sfx('ball');
      await tween(v => { st.lever = v; }, 0, 1, ten ? 0.12 : 0.22);
      for (const rl of st.reels) { rl.spin = true; rl.speed = 520; }
      await tween(v => { st.lever = v; }, 1, 0, ten ? 0.1 : 0.2);
      st.win = null;
      await wait(ten ? 0.18 : 0.6);
      const big = r.rarity >= 4 || r.shiny;
      for (let k = 0; k < 3; k++) {
        if (k === 2 && big) {
          // Suspense: el último rodillo frena despacio y las luces parpadean.
          st.frenzy = 1;
          st.led = r.shiny ? 'ENCHANTED?!' : r.rarity === 5 ? 'LEGENDARY?!' : 'EPIC?!';
          st.ledCol = colOf(r);
          await tween(v => { st.reels[2].speed = v; }, 520, 120, ten ? 0.5 : 1.1);
        }
        stopReel(st.reels[k], symOf(r));
        G.Audio.sfx('shake');
        await wait(ten ? 0.08 : 0.32);
      }
      st.frenzy = 0;
      // Premio.
      st.win = { col: colOf(r), t: 0 };
      st.led = (r.shiny ? 'ENCHANTED · ' : '') + G.Gacha.RARITY_NAME[r.rarity].toUpperCase();
      st.ledCol = colOf(r);
      G.Audio.sfx('reveal', { rarity: r.rarity });
      if (r.rarity === 5) G.Audio.sfx('legend');
      if (r.shiny) G.Audio.sfx('shiny');
      if (big) burst(colOf(r), r.rarity === 5 || r.shiny ? 60 : 30);
      // Al cajón: uno grande en el centro, o diez en dos filas de cinco.
      const j = st.tray.length;
      const tx = ten ? 34 + (j % 5) * 20 : W / 2 - ICO / 2 - 7, ty = ten ? 124 + Math.floor(j / 5) * 17 : 123;
      st.tray.push({ sym: symOf(r), x: tx, ty, y: ty - 22, vy: 0, done: false });
      await wait(ten ? (big ? 0.7 : 0.28) : 1.0);
    }
    await wait(0.4);
    stopAll();
  }

  function stopAll() { cancelAnimationFrame(raf); st = null; if (cv) cv.onclick = null; }

  function tween(set, a, b, dur) {
    return new Promise(res => {
      const t0 = performance.now(), d = dur * 1000 * (fast ? 0.25 : 1);
      (function step() {
        const k = Math.min(1, (performance.now() - t0) / d);
        set(a + (b - a) * k);
        if (k < 1 && st) requestAnimationFrame(step); else res();
      })();
    });
  }

  function stopReel(rl, sym) { rl.spin = false; rl.sym = sym; rl.bounce = 1; rl.speed = 0; }

  function burst(col, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, s = 30 + Math.random() * 70;
      st.sparks.push({ x: W / 2, y: MID, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, t: 0, life: 0.6 + Math.random() * 0.6,
                       col: Math.random() < 0.5 ? col : '#ffffff' });
    }
  }

  // ---------------- dibujo ----------------

  function frame(now) {
    if (!st) return;
    const dt = Math.min(0.05, (now - last) / 1000) * (fast ? 2 : 1);
    last = now;
    st.t += dt;
    let tick = false;
    for (const rl of st.reels) {
      if (rl.spin) { const before = Math.floor(rl.off / CELL); rl.off += rl.speed * dt; if (Math.floor(rl.off / CELL) !== before) tick = true; }
      if (rl.bounce > 0) rl.bounce = Math.max(0, rl.bounce - dt * 5);
    }
    if (tick && Math.random() < 0.5) G.Audio.sfx('hover');
    if (st.win) st.win.t += dt;
    for (const b of st.tray) if (!b.done) { b.vy += 400 * dt; b.y += b.vy * dt; if (b.y >= b.ty) { b.y = b.ty; b.vy *= -0.35; if (Math.abs(b.vy) < 20) b.done = true; } }
    for (const p of st.sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
    st.sparks = st.sparks.filter(p => p.t < p.life);
    // Llamas y humo dentro de la jaula (más cuando gira).
    const spinning = st.reels.some(r => r.spin);
    if (Math.random() < dt * (spinning || st.frenzy ? 40 : 12)) {
      const side = Math.random() < 0.5;
      const zone = Math.random();
      // A los lados de la ventana y por debajo del cajón.
      const fx = zone < 0.35 ? 12 + Math.random() * 8 : zone < 0.7 ? 142 + Math.random() * 8 : 14 + Math.random() * 134;
      st.flames.push({ x: fx, y: zone < 0.7 ? 150 + Math.random() * 10 : 160, t: 0, life: 0.7 + Math.random() * 0.8 });
    }
    for (const f of st.flames) { f.t += dt; f.y -= 34 * dt; f.x += Math.sin(f.t * 9 + f.y) * 6 * dt; }
    st.flames = st.flames.filter(f => f.t < f.life);
    draw();
    raf = requestAnimationFrame(frame);
  }

  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  /** Recuadro con bisel de un texel. */
  function bevel(x, y, w, h, fill, lite, dark) {
    R(x, y, w, h, fill);
    R(x, y, w, 1, lite); R(x, y, 1, h, lite);
    R(x, y + h - 1, w, 1, dark); R(x + w - 1, y, 1, h, dark);
  }

  /** La textura del Mob Spawner en mosaico (a 1×, el texel del arte). */
  function cage(x, y, w, h) {
    const tex = G.Icons.canvas('blocks/mob_spawner');
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    for (let ty = y; ty < y + h; ty += 16) for (let tx = x; tx < x + w; tx += 16) ctx.drawImage(tex, tx, ty);
    ctx.restore();
  }

  function sym(name, x, y) {
    const s = name === 'shiny' ? 24 : ICO;
    G.Icons.draw(ctx, name, x + (ICO - s) / 2, y + (ICO - s) / 2, s);
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    const t = st.t;

    // --- jaula: interior con brasas, llamas y la reja del spawner encima ---
    R(9, 33, 144, 131, C.dark);
    R(10, 34, 142, 129, C.inside);
    const glow = ctx.createLinearGradient(0, 160, 0, 40);
    const flick = 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 17) * 0.07;
    glow.addColorStop(0, st.frenzy ? 'rgba(255,90,30,.95)' : `rgba(255,110,30,${(0.7 * flick).toFixed(2)})`);
    glow.addColorStop(0.55, 'rgba(200,50,20,.25)');
    glow.addColorStop(1, 'rgba(120,30,60,0)');
    ctx.fillStyle = glow; ctx.fillRect(10, 34, 142, 129);
    for (const f of st.flames) {
      const k = f.t / f.life;
      const sz = k < 0.35 ? 3 : 2;
      R(Math.round(f.x), Math.round(f.y), sz, sz, k < 0.35 ? '#ffd23f' : k < 0.7 ? '#ff7a2a' : '#4a4a4a');
    }
    cage(10, 34, 142, 129);
    // Marco de hierro.
    R(10, 34, 142, 1, C.ironL); R(10, 34, 1, 129, C.ironL);
    R(10, 162, 142, 1, C.ironD); R(151, 34, 1, 129, C.ironD);
    R(9, 164, 144, 2, C.dark);

    // --- cartel con lámparas de redstone ---
    R(13, 3, 136, 30, C.dark);
    bevel(14, 4, 134, 28, C.iron, C.ironL, C.ironD);
    R(18, 8, 126, 20, C.led);
    const winCol = st.win && Math.floor(st.win.t * 8) % 2 === 0 ? st.win.col : null;
    let i = 0;
    for (let x = 16; x < 146; x += 7) { lamp(x, 5, i++, winCol); lamp(x, 29, i++, winCol); }
    for (let y = 12; y < 28; y += 7) { lamp(15, y, i++, winCol); lamp(146, y, i++, winCol); }
    ctx.font = '700 12px Pixelify,"Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3c3c3c'; ctx.fillText('MOB SPAWNER', W / 2 + 1, 23);
    ctx.fillStyle = C.text; ctx.fillText('MOB SPAWNER', W / 2, 22);

    // --- ventana de rodillos ---
    R(19, 37, 124, 60, C.dark);
    bevel(20, 38, 122, 58, C.iron, C.ironL, C.ironD);
    R(23, 41, 116, 52, C.glass);
    st.reels.forEach((rl, k) => drawReel(rl, REEL_X[k]));
    // Línea de premio.
    const lineCol = st.win ? st.win.col : C.lampOn;
    R(21, MID - 1, 4, 2, lineCol); R(137, MID - 1, 4, 2, lineCol);
    if (st.win && st.win.t < 1.2 && Math.floor(st.win.t * 10) % 2 === 0) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = st.win.col; ctx.lineWidth = 2;
      ctx.strokeRect(22, 40, 118, 54);
      ctx.globalAlpha = 1;
    }

    // --- marcador ---
    R(35, 99, 92, 18, C.dark);
    bevel(36, 100, 90, 16, C.iron, C.ironL, C.ironD);
    R(38, 102, 86, 12, C.led);
    ctx.font = '700 8px Pixelify,"Segoe UI",sans-serif';
    ctx.fillStyle = st.ledCol || C.lampHi;
    if (!st.frenzy || Math.floor(t * 10) % 2 === 0) ctx.fillText(st.led, 81, 111);
    // Botones de piedra a los lados.
    bevel(23, 103, 8, 7, C.stone, '#a8a8a8', C.stoneD); R(23, 110, 8, 1, C.dark);
    bevel(131, 103, 8, 7, C.stone, '#a8a8a8', C.stoneD); R(131, 110, 8, 1, C.dark);

    // --- cajón (ranura de inventario) ---
    R(25, 119, 112, 40, C.dark);
    R(26, 120, 110, 38, C.slot);
    R(26, 120, 110, 2, C.slotD); R(26, 120, 2, 38, C.slotD);
    R(26, 156, 110, 2, C.slotL); R(134, 120, 2, 38, C.slotL);
    R(28, 122, 106, 34, '#6f6f6f');
    st.tray.forEach(b => {
      if (st.ten) G.Icons.draw(ctx, b.sym, b.x, Math.round(b.y), b.sym === 'shiny' ? 12 : 16);
      else sym(b.sym, b.x + 7, Math.round(b.y));
    });

    // --- palanca de Minecraft: base de piedra y palo de madera ---
    R(152, 84, 16, 16, C.dark);
    bevel(153, 85, 14, 14, C.stone, '#a8a8a8', C.stoneD);
    R(156, 88, 2, 2, C.stoneD); R(162, 93, 2, 2, C.stoneD); R(158, 95, 2, 1, C.stoneD);
    const knobY = Math.round(36 + st.lever * 48);
    const top = Math.min(knobY, 90), bot = Math.max(knobY, 90);
    R(158, top, 4, bot - top, C.stickD); R(158, top, 2, bot - top, C.stick);
    R(156, knobY - 4, 8, 7, C.dark); R(157, knobY - 3, 6, 5, C.stick); R(157, knobY - 3, 2, 2, '#b07a40');

    // --- chispas del premio ---
    for (const p of st.sparks) R(Math.round(p.x), Math.round(p.y), 2, 2, p.col);
  }

  /** Lámpara de redstone del cartel. */
  function lamp(x, y, i, winCol) {
    const on = st.frenzy ? Math.floor(st.t * 14 + i) % 2 === 0 : Math.floor(st.t * 4 + i) % 3 !== 0;
    R(x, y, 3, 3, winCol || (on ? C.lampOn : C.lampOff));
    if (on && !winCol) R(x, y, 1, 1, C.lampHi);
  }

  function drawReel(rl, x) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, REEL_Y, REEL_W, REEL_H); ctx.clip();
    // Fondo de ranura de inventario.
    R(x, REEL_Y, REEL_W, REEL_H, C.slot);
    const ix = x + (REEL_W - ICO) / 2;
    if (rl.spin) {
      const base = rl.off % CELL, i0 = Math.floor(rl.off / CELL);
      for (let k = -2; k <= 2; k++) {
        const name = STRIP[((i0 - k) % STRIP.length + STRIP.length) % STRIP.length];
        const y = Math.round(MID - ICO / 2 + k * CELL + base);
        ctx.globalAlpha = rl.speed > 300 ? 0.75 : 1;
        sym(name, ix, y);
        if (rl.speed > 300) { ctx.globalAlpha = 0.25; sym(name, ix, y - 6); }
        ctx.globalAlpha = 1;
      }
    } else {
      const by = Math.round(Math.sin(rl.bounce * Math.PI) * 5);
      const n = STRIP.indexOf(rl.sym);
      ctx.globalAlpha = 0.35;
      sym(STRIP[(n + 3) % STRIP.length], ix, MID - ICO / 2 - CELL + by);
      sym(STRIP[(n + 5) % STRIP.length], ix, MID - ICO / 2 + CELL + by);
      ctx.globalAlpha = 1;
      sym(rl.sym, ix, MID - ICO / 2 + by);
    }
    // Bisel hundido y sombra curva del rodillo (arriba y abajo más oscuro).
    R(x, REEL_Y, REEL_W, 1, C.slotD); R(x, REEL_Y + REEL_H - 1, REEL_W, 1, C.slotL);
    ctx.globalAlpha = 0.3;
    R(x, REEL_Y, REEL_W, 6, '#000'); R(x, REEL_Y + REEL_H - 6, REEL_W, 6, '#000');
    ctx.globalAlpha = 1;
    ctx.restore();
    R(x - 1, REEL_Y, 1, REEL_H, C.dark); R(x + REEL_W, REEL_Y, 1, REEL_H, C.dark);
  }

  return { play, stop: stopAll };
})();
