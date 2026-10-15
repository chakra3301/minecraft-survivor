/* ============ hud.js — interfaz dentro del canvas ============
 * Se dibuja en coordenadas de PANTALLA (sin la transformación de cámara).
 * Estilo Minecraft: corazones, barra de experiencia verde con el nivel,
 * ranuras de barra rápida y texto con la sombra dura del juego.
 */
G.HUD = (() => {
  const F = (w, s) => `${w} ${s}px Pixelify,"Segoe UI",system-ui,sans-serif`;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Barra cuadrada con contorno negro y brillo arriba, como las de Minecraft. */
  function bar(ctx, x, y, w, h, frac, col, bg = 'rgba(0,0,0,.55)') {
    x = Math.round(x); y = Math.round(y); w = Math.round(w);
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    const f = Math.round(w * G.U.clamp(frac, 0, 1));
    if (f > 0) {
      ctx.fillStyle = col; ctx.fillRect(x, y, f, h);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, f, Math.max(1, Math.round(h / 4)));
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y + h - Math.max(1, Math.round(h / 4)), f, Math.max(1, Math.round(h / 4)));
    }
  }

  // ---------------- piezas de Minecraft ----------------

  /** Sombra del texto como en Minecraft: el mismo color a un cuarto de brillo. */
  function shadowOf(col) {
    if (typeof col !== 'string' || col[0] !== '#' || col.length !== 7) return 'rgba(0,0,0,.75)';
    const n = parseInt(col.slice(1), 16);
    return 'rgb(' + [(n >> 16 & 255) >> 2, (n >> 8 & 255) >> 2, (n & 255) >> 2].join(',') + ')';
  }
  function sText(ctx, txt, x, y, col, off = 2) {
    ctx.fillStyle = shadowOf(col); ctx.fillText(txt, x + off, y + off);
    ctx.fillStyle = col; ctx.fillText(txt, x, y);
  }

  /** Recuadro oscuro con bisel de un texel (claro arriba-izquierda, oscuro abajo-derecha). */
  function mcBox(ctx, x, y, bw, bh, fill = 'rgba(22,22,24,.82)', edge = '#000') {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = edge; ctx.fillRect(x - 2, y - 2, bw + 4, bh + 4);
    ctx.fillStyle = fill; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x, y, bw, 2); ctx.fillRect(x, y, 2, bh);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y + bh - 2, bw, 2); ctx.fillRect(x + bw - 2, y, 2, bh);
  }

  /** Ranura hundida de inventario/barra rápida. */
  function slot(ctx, x, y, s, fill = 'rgba(28,28,30,.78)') {
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - 2, y - 2, s + 4, s + 4);
    ctx.fillStyle = fill; ctx.fillRect(x, y, s, s);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x, y, s, 2); ctx.fillRect(x, y, 2, s);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x, y + s - 2, s, 2); ctx.fillRect(x + s - 2, y, 2, s);
  }
  /** Marco de color alrededor de una ranura (elegida: blanco, como en Minecraft). */
  function frame(ctx, x, y, s, col, t = 3) {
    ctx.fillStyle = '#000'; ctx.fillRect(x - t - 3, y - t - 3, s + (t + 3) * 2, s + (t + 3) * 2);
    ctx.fillStyle = col; ctx.fillRect(x - t - 2, y - t - 2, s + (t + 2) * 2, s + (t + 2) * 2);
    ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, s + 4, s + 4);
  }

  // Corazón de Minecraft (9×8 texels): k contorno, r rojo, s sombra, w brillo.
  const HEART = ['.kkk.kkk.', 'kwwrkrrsk', 'kwrrrrrsk', 'krrrrrrsk', '.krrrrsk.', '..krrsk..', '...krk...', '....k....'];
  const HEART_PAL = { k: '#000000', r: '#e8191e', s: '#9c0d0f', w: '#ffc2c2' };
  const HEART_EMPTY = { k: '#000000', r: '#3a1012', s: '#2a0b0c', w: '#4a1416' };
  function heart(ctx, x, y, px, pal, cut = 9) {
    HEART.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.' || (i >= cut && ch !== 'k')) return;
      ctx.fillStyle = pal[ch]; ctx.fillRect(x + i * px, y + j * px, px, px);
    }));
  }
  /** Fila de 10 corazones (cada uno, una décima de la vida; se llenan por mitades). Devuelve el ancho. */
  function hearts(ctx, x, y, frac, px = 2) {
    const n = 10, step = 9 * px + px, low = frac <= 0.25 && frac > 0;
    for (let i = 0; i < n; i++) {
      const f = Math.round(G.U.clamp(frac * n - i, 0, 1) * 2) / 2;
      // Con poca vida tiemblan, como en el juego.
      const jy = low ? Math.round(Math.sin(performance.now() / 45 + i * 2.1) * px) : 0;
      heart(ctx, x + i * step, y + jy, px, HEART_EMPTY);
      if (f > 0) heart(ctx, x + i * step, y + jy, px, HEART_PAL, f >= 1 ? 9 : 4);
      if (f > 0 && f < 1) HEART.forEach((row, j) => { if (row[4] === 'k') { ctx.fillStyle = '#000'; ctx.fillRect(x + i * step + 4 * px, y + jy + j * px, px, px); } });
    }
    return n * step - px;
  }

  /** Barra de experiencia de Minecraft (a lo ancho del borde superior). */
  function xpBar(ctx, w, frac) {
    const H = 8, f = Math.round(w * G.U.clamp(frac, 0, 1));
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, H + 2);
    ctx.fillStyle = '#1d2a12'; ctx.fillRect(0, 0, w, H);
    ctx.fillStyle = '#2c3d1c'; ctx.fillRect(0, 0, w, 2);
    if (f > 0) {
      ctx.fillStyle = '#80ff20'; ctx.fillRect(0, 0, f, H);
      ctx.fillStyle = '#c8ff7a'; ctx.fillRect(0, 0, f, 2);
      ctx.fillStyle = '#4fb010'; ctx.fillRect(0, H - 2, f, 2);
    }
    // Muescas, como las 18 divisiones de la barra del juego.
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    for (let i = 1; i < 18; i++) ctx.fillRect(Math.round(w * i / 18), 0, 2, H);
  }

  // Arrow palettes: Trial Chamber (copper), each floor's exit portal, the Eye of Ender and End Crystals.
  const PAL = {
    trial:      { halo: '#d9894a', light: '#ffd9b0', mid: '#c8743a', dark: '#2a1408', sub: '#f0b888' },
    dive:       { halo: '#3fb8d0', light: '#d8f8ff', mid: '#5fd3e8', dark: '#06222c' },
    cave:       { halo: '#c8b07a', light: '#f4e6c4', mid: '#b09460', dark: '#1e160c' },
    nether:     { halo: '#b48aff', light: '#e2d0ff', mid: '#a06bff', dark: '#1a0b33' },
    stronghold: { halo: '#aab4a0', light: '#eef2e6', mid: '#98a48c', dark: '#1c1c18' },
    end:        { halo: '#c9e07a', light: '#f4ffd0', mid: '#8fbf4a', dark: '#0c1410' },
    gateway:    { halo: '#c9a6ff', light: '#f3e8ff', mid: '#b48aff', dark: '#120a1c' },
    ancient:    { halo: '#3fb8c8', light: '#d0fbff', mid: '#5ef0ff', dark: '#06161a' },
    aether:     { halo: '#ffd95a', light: '#fffbe6', mid: '#ffd95a', dark: '#3a2a06' },
    eye:        { halo: '#4fbf6a', light: '#d8ffd0', mid: '#7cff6a', dark: '#0a2010' },
    crystal:    { halo: '#ff7bd8', light: '#ffe0f6', mid: '#ff9ef0', dark: '#2a0a24' },
    elder:      { halo: '#5fb8a8', light: '#d8fff4', mid: '#7fd8c8', dark: '#0a2420' }
  };
  const SCULK = '#5ef0ff';
  const sculkImg = new Image();
  sculkImg.src = 'assets/mc/blocks/sculk_shrieker_top.png';

  /** Where you are: "Overworld · Desert", "Trial Chamber · Jungle". */
  function placeName() {
    if (G.Rift.inArena) return 'Trial Chamber · ' + G.World.biomeName();
    const d = G.Floors.def, b = G.BIOME_DEFS[G.Floors.biome];
    const biome = b ? b.name : G.World.biomeName();
    return biome === d.short ? d.short : d.short + ' · ' + biome;
  }

  /**
   * Arrow to a world point (feet at x, y): pulsing at the screen edge when off-screen, with
   * `label`; bouncing over it when on screen, with `near`.
   */
  function pointer(ctx, w, h, x, y, c, label, near) {
    const cam = G.Camera;
    const sx = (x - cam.left()) * cam.scale, sy = (y - 40 - cam.top()) * cam.scale;
    const now = performance.now() / 1000, beat = 0.5 + Math.sin(now * 7) * 0.5;
    const off = sx < 0 || sx > w || sy < 0 || sy > h;
    ctx.save();
    if (off) {
      const M = 52, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
      const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
      ctx.translate(ex, ey);
      // Halo que late.
      ctx.globalAlpha = 0.18 + beat * 0.22;
      ctx.fillStyle = c.halo;
      ctx.beginPath(); ctx.arc(0, 0, 30 + beat * 8, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      const tri = (k) => {
        ctx.beginPath();
        ctx.moveTo(ca * 40 * k, sa * 40 * k);
        ctx.lineTo(Math.cos(a + 2.45) * 20 * k, Math.sin(a + 2.45) * 20 * k);
        ctx.lineTo(Math.cos(a - 2.45) * 20 * k, Math.sin(a - 2.45) * 20 * k);
        ctx.closePath();
      };
      tri(1.12); ctx.fillStyle = c.dark; ctx.fill();
      tri(1); ctx.fillStyle = beat > 0.5 ? c.light : c.mid; ctx.fill();
      ctx.font = F(800, 12);
      ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
      const lx = -ca * 34, ly = -sa * 30 + 4;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(label, lx, ly);
      ctx.fillStyle = c.light;
      ctx.fillText(label, lx, ly);
    } else {
      // Encima: flecha hacia abajo que bota.
      const by = sy - 46 - Math.abs(Math.sin(now * 4)) * 10;
      ctx.translate(sx, by);
      ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(15, -12); ctx.lineTo(0, 8); ctx.closePath();
      ctx.lineWidth = 4; ctx.strokeStyle = c.dark; ctx.stroke();
      ctx.fillStyle = beat > 0.5 ? c.light : c.mid; ctx.fill();
      ctx.font = F(800, 11); ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(near, 0, -18); ctx.fillStyle = c.light; ctx.fillText(near, 0, -18);
    }
    ctx.restore();
  }

  /** The Eye of Ender icon riding the edge arrow toward the portal room. */
  function eyeBadge(ctx, w, h, room) {
    const img = G.Floors.eyeImg(), cam = G.Camera;
    if (!img) return;
    const sx = (room.x - cam.left()) * cam.scale, sy = (room.y - 40 - cam.top()) * cam.scale;
    if (sx >= 0 && sx <= w && sy >= 0 && sy <= h) return;
    const M = 52, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(ex - 16), Math.round(ey - 16 + Math.sin(performance.now() / 200) * 2), 32, 32);
    ctx.restore();
  }

  /** Stronghold: "ACTIVATING THE END PORTAL" bar over the hotbar (paused while you're out of the room). */
  function holdBar(ctx, w, h, room) {
    if (!room.inside && room.held <= 0) return;
    const k = G.U.clamp(room.held / room.hold, 0, 1), bw = Math.min(360, w - 80), x0 = Math.round((w - bw) / 2), y0 = h - 132;
    mcBox(ctx, x0 - 10, y0 - 22, bw + 20, 40, 'rgba(10,22,14,.85)');
    ctx.font = F(800, 11); ctx.textAlign = 'center';
    const txt = room.inside ? 'ACTIVATING THE END PORTAL · ' + Math.ceil(room.hold - room.held) + ' s' : 'PAUSED · return to the portal room';
    sText(ctx, txt, w / 2, y0 - 6, room.inside ? PAL.eye.light : '#c6c6c6', 1);
    bar(ctx, x0, y0 + 2, bw, 8, k, room.inside ? '#7cff6a' : '#5a7a56', '#0c1a10');
  }

  /** Ancient City: four sculk shriekers and "WARNING" (top right, under the weather). */
  function warning(ctx, w, wn, touch, below) {
    const S = 20, G2 = 4, label = 'WARNING';
    ctx.font = F(800, 11);
    const lw = ctx.measureText(label).width + 10, bw = lw + 4 * S + 3 * G2 + 16, bh = S + 22;
    const x0 = Math.round(w - bw - 18 - (touch ? 56 : 0)), y0 = below ? 50 : 16;
    const now = performance.now() / 1000, fresh = wn.last ? now - wn.last.t : 99;
    mcBox(ctx, x0, y0, bw, bh, fresh < 1.2 ? 'rgba(10,40,48,.92)' : 'rgba(10,18,22,.85)');
    ctx.textAlign = 'left';
    sText(ctx, label, x0 + 8, y0 + 17, wn.level >= 3 ? (Math.sin(now * 8) > 0 ? '#ff6b6b' : SCULK) : SCULK, 1);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 4; i++) {
      const x = x0 + 8 + lw + i * (S + G2), y = y0 + 4, on = i < wn.level;
      ctx.globalAlpha = on ? 1 : 0.3;
      if (sculkImg.complete && sculkImg.naturalWidth) ctx.drawImage(sculkImg, x, y, S, S);
      else { ctx.fillStyle = '#0d2b33'; ctx.fillRect(x, y, S, S); }
      if (on) {
        ctx.globalAlpha = 0.35 + Math.sin(now * 5 + i) * 0.15;
        ctx.fillStyle = SCULK; ctx.fillRect(x, y, S, S);
      }
    }
    ctx.restore();
    if (wn.level < 4 && wn.next > 0) {
      ctx.font = F(700, 9); ctx.textAlign = 'right';
      sText(ctx, 'next shriek ' + G.U.mmss(wn.next), x0 + bw - 8, y0 + bh - 5, '#8fb8c0', 1);
    } else if (wn.level >= 4) {
      ctx.font = F(700, 9); ctx.textAlign = 'right';
      sText(ctx, 'THE WARDEN IS HERE', x0 + bw - 8, y0 + bh - 5, '#ff8a8a', 1);
    }
  }

  /** The Ocean: "ELDER GUARDIANS: n/3 LEFT" with a pip per guardian (top right, under the weather). */
  function elderCount(ctx, w, el, touch, below) {
    const label = 'ELDER GUARDIANS: ' + el.left + '/' + el.n + ' LEFT', sub = el.awake ? 'THEY ARE AWAKE' : 'ASLEEP IN THE OCEAN MONUMENT';
    ctx.font = F(800, 11);
    const bw = Math.max(ctx.measureText(label).width, (ctx.font = F(700, 9), ctx.measureText(sub).width), el.n * 18) + 20, bh = 44;
    const x0 = Math.round(w - bw - 18 - (touch ? 56 : 0)), y0 = below ? 50 : 16;
    mcBox(ctx, x0, y0, bw, bh, 'rgba(8,30,30,.86)');
    ctx.textAlign = 'left';
    ctx.font = F(800, 11); sText(ctx, label, x0 + 10, y0 + 16, PAL.elder.light, 1);
    for (let i = 0; i < el.n; i++) {
      const x = x0 + 10 + i * 18, y = y0 + 22, on = i < el.left;
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, 14, 9);
      ctx.fillStyle = on ? (el.awake ? '#ff8a8a' : PAL.elder.mid) : '#2a3a38'; ctx.fillRect(x, y, 12, 7);
    }
    ctx.font = F(700, 9); ctx.textAlign = 'right';
    sText(ctx, sub, x0 + bw - 8, y0 + bh - 5, el.awake ? '#ff9a9a' : '#8fc8c0', 1);
  }

  function draw(ctx, w, h, pl, st) {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    G.Touch.clearButtons();
    const touch = G.Touch.active;

    // ---------- barra de experiencia (borde superior) ----------
    xpBar(ctx, w, pl.xp / pl.xpNext);

    // ---------- vida + nivel ----------
    const px = 16, py = 20;
    ctx.font = F(800, 13);
    ctx.textAlign = 'left';
    sText(ctx, pl.mon.name, px, py + 10, '#ffffff');

    // Nivel en el verde de la experiencia, con contorno negro como en Minecraft.
    ctx.font = F(800, 13);
    const lv = 'Lv. ' + pl.level;
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';
    ctx.strokeText(lv, px, py + 29);
    ctx.fillStyle = '#80ff20'; ctx.fillText(lv, px, py + 29);
    const hx = px + Math.max(48, ctx.measureText(lv).width + 10);

    const hw = hearts(ctx, hx, py + 15, pl.hp / pl.maxHp);
    ctx.font = F(700, 10);
    sText(ctx, Math.ceil(pl.hp) + '/' + Math.round(pl.maxHp), hx + hw + 6, py + 28, '#ffffff', 1);

    // buffs activos (efectos de poción)
    const COL = { atk: '#ff6b4d', spd: '#7fe0ff', def: '#c8c8d0', regen: '#ff7ad0' };
    const LBL = { atk: 'STR', spd: 'SPD', def: 'RES', regen: 'REGEN' };
    let bx = px;
    ctx.textAlign = 'left';
    for (const k in pl.buffs) {
      const b = pl.buffs[k];
      if (b.n <= 0) continue;
      ctx.font = F(800, 9);
      const txt = LBL[k] + ' ×' + b.n;
      const tw = ctx.measureText(txt).width + 12;
      mcBox(ctx, bx, py + 35, tw, 14);
      sText(ctx, txt, bx + 6, py + 45, COL[k], 1);
      bx += tw + 8;
    }

    // ---------- reloj / bioma / kills ----------
    ctx.textAlign = 'center';
    ctx.font = F(800, 26);
    sText(ctx, G.U.mmss(st.time), w / 2, 42, '#ffffff', 3);
    ctx.font = F(600, 10);
    {
      const t1 = placeName().toUpperCase() + '  ·  ' + pl.kills + ' DEFEATED  ·  ', t2 = pl.coins + ' EMERALDS';
      const w1 = ctx.measureText(t1).width, x0 = Math.round(w / 2 - (w1 + ctx.measureText(t2).width) / 2);
      ctx.textAlign = 'left';
      sText(ctx, t1, x0, 58, '#c6c6c6', 1);
      sText(ctx, t2, x0 + w1, 58, '#17dd62', 1);
      ctx.textAlign = 'center';
    }

    // ---------- clima (arriba a la derecha) ----------
    const wx = G.Weather.current;
    if (wx) {
      ctx.font = F(800, 11);
      ctx.textAlign = 'left';
      const txt = wx.name.toUpperCase() + ' · ' + Math.ceil(wx.left) + 's';
      const tw = ctx.measureText(txt).width + 40;
      const x0 = Math.round(w - tw - 18 - (touch ? 56 : 0)), y0 = 16;
      mcBox(ctx, x0, y0, tw, 26);
      G.Icons.draw(ctx, wx.icon, x0 + 6, y0 + 3, 20);
      sText(ctx, txt, x0 + 32, y0 + 17, wx.color, 1);
    }

    // ---------- barra del jefe ----------
    // (The nearest one when several fight at once: the Ocean's Elder Guardians. Dormant ones show no bar.)
    let boss = null;
    for (const e of G.EnemyMgr.all()) {
      if (!e.boss || e.dead || e.hidden || e.dormant) continue;
      if (!boss || G.U.dist2(pl.x, pl.y, e.x, e.y) < G.U.dist2(pl.x, pl.y, boss.x, boss.y)) boss = e;
    }
    const shielded = boss && G.EndFight && G.EndFight.shielded(boss);
    if (boss) {
      // Barra de jefe de Minecraft: el nombre encima y la barra con muescas.
      const bw = Math.min(420, w - 80), bx0 = Math.round((w - bw) / 2);
      bar(ctx, bx0, 72, bw, 8, boss.hp / boss.maxHp, shielded ? '#b9a0d8' : boss.ominous ? '#3ad6c6' : '#d83ad8', shielded ? '#2a2236' : '#3a0f3a');
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      for (let i = 1; i < 20; i++) ctx.fillRect(bx0 + Math.round(bw * i / 20), 72, 1, 8);
      if (shielded) {
        // The End Crystals' shield: a shimmer sweeping along the bar.
        const k = (performance.now() / 1400) % 1;
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.fillRect(bx0 + Math.round(bw * k), 72, Math.min(26, Math.round(bw * (1 - k))), 8);
      }
      ctx.font = F(800, 10);
      ctx.textAlign = 'center';
      sText(ctx, boss.name, w / 2, 69, '#ffffff', 1);
      if (shielded) {
        const n = G.EndFight.left;
        ctx.font = F(800, 10);
        sText(ctx, 'INVULNERABLE · Destroy the End Crystals (' + n + ' left)', w / 2, 93, PAL.crystal.light, 1);
      }
    }

    // ---------- aviso ----------
    // ---------- encantados (shinies) fuera de pantalla: destello en el borde ----------
    const cam = G.Camera, pulse = 0.6 + Math.sin(performance.now() / 160) * 0.4;
    for (const e of G.EnemyMgr.shinies()) {
      const sx = (e.x - cam.left()) * cam.scale, sy = (e.y - cam.top()) * cam.scale;
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const M = 34;
      const ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 60, h - M - 70);
      const a = Math.atan2(sy - ey, sx - ex);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.translate(ex, ey);
      ctx.fillStyle = '#c77dff';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
      ctx.lineTo(Math.cos(a + 2.5) * 12, Math.sin(a + 2.5) * 12);
      ctx.lineTo(Math.cos(a - 2.5) * 12, Math.sin(a - 2.5) * 12);
      ctx.fill();
      ctx.globalAlpha = 1;
      G.Icons.draw(ctx, 'shiny', -12, -12, 24);
      ctx.restore();
    }

    // Poder de altar activo.
    if (pl.power) {
      const pw = pl.power, txt = pw.def.name.toUpperCase() + ' ' + Math.ceil(pw.t) + 's';
      ctx.font = F(800, 9);
      ctx.textAlign = 'left';
      const tw = ctx.measureText(txt).width + 12;
      mcBox(ctx, bx, py + 35, tw, 14);
      sText(ctx, txt, bx + 6, py + 45, pw.def.color, 1);
      bx += tw + 8;
    }

    if (G.Coop.active) drawCoop(ctx, w, h, pl, px, py + (bx > px ? 56 : 40));

    // Trial Chamber entrance and dimension portal: a big pulsing arrow at the screen edge when
    // off-screen; a bouncing arrow over it when on screen. In the chamber, a countdown.
    const rift = G.Rift.rift;
    if (rift) {
      const m = Math.round(G.U.dist(pl.x, pl.y, rift.x, rift.y) / 32);
      pointer(ctx, w, h, rift.x, rift.y, PAL.trial, 'TRIAL CHAMBER · ' + m + ' m · ' + Math.ceil(rift.ttl) + ' s', 'TRIAL CHAMBER · ' + Math.ceil(rift.ttl) + ' s');
    }
    const portal = G.Floors.portal, outside = !G.Rift.inArena && !G.Judgment.active;
    const metres = (x, y) => Math.round(G.U.dist(pl.x, pl.y, x, y) / 32) + ' m';
    // (The Aether portal shows through Herobrine's fight too, once its glowstone frame stands: run for it.)
    if (portal && (outside || (portal.kind === 'aether' && portal.ready && !G.Rift.inArena))) {
      const name = G.Floors.PORTALS[portal.kind].name.toUpperCase();
      pointer(ctx, w, h, portal.x, portal.y, PAL[portal.kind] || PAL.end, name + ' · ' + metres(portal.x, portal.y), name);
    }
    // The End: an arrow to the nearest End Crystal while any stands.
    const crystal = outside && G.EndFight && G.EndFight.nearest(pl.x, pl.y);
    if (crystal) pointer(ctx, w, h, crystal.top.x, crystal.top.y + 10, PAL.crystal, 'END CRYSTAL · ' + metres(crystal.top.x, crystal.top.y), 'END CRYSTAL');
    // The Stronghold: the Eye of Ender points to the End Portal room, and holding it fills a bar.
    const room = outside && G.Floors.room;
    if (room && room.eye && !room.done) {
      if (!room.inside) {
        pointer(ctx, w, h, room.x, room.y, PAL.eye, 'END PORTAL ROOM · ' + metres(room.x, room.y), 'HOLD THE PORTAL ROOM');
        eyeBadge(ctx, w, h, room);
      }
      holdBar(ctx, w, h, room);
    }
    if (outside && G.Floors.warning) warning(ctx, w, G.Floors.warning, touch, !!wx);
    // The Ocean: how many Elder Guardians are left, and an arrow to the nearest (to the monument while they sleep).
    const el = outside && G.Floors.elders;
    if (el && (el.left > 0 || !portal)) {
      elderCount(ctx, w, el, touch, !!wx);
      let tgt = null;
      for (const e of el.list) if (!tgt || G.U.dist2(pl.x, pl.y, e.x, e.y) < G.U.dist2(pl.x, pl.y, tgt.x, tgt.y)) tgt = e;
      if (!el.awake && el.home) pointer(ctx, w, h, el.home.x, el.home.y, PAL.elder, 'OCEAN MONUMENT · ' + metres(el.home.x, el.home.y), 'OCEAN MONUMENT');
      else if (tgt) pointer(ctx, w, h, tgt.x, tgt.y, PAL.elder, 'ELDER GUARDIAN · ' + metres(tgt.x, tgt.y), 'ELDER GUARDIAN');
    }
    if (G.Rift.inArena) {
      ctx.textAlign = 'center';
      ctx.font = F(800, 12);
      sText(ctx, 'TRIAL CHAMBER · ' + G.U.mmss(G.Rift.timeLeft), w / 2, boss ? 98 : 76, PAL.trial.light, 1);
    }

    // Eventos: cuenta atrás, flecha al Pokémon perdido / a la marca y a los duendes.
    G.Events.drawHud(ctx, w, h, pl, F);

    // Aviso propio al abrirse una grieta (no lo tapan los otros avisos).
    if (rift && rift.t < 4.5) {
      const a = Math.min(1, rift.t * 4, (4.5 - rift.t) * 2), pop = 1 + Math.max(0, 0.25 - rift.t) * 1.6;
      const y0 = h * 0.2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(w / 2, y0); ctx.scale(pop, pop);
      ctx.font = F(800, 20);
      const t1 = 'A TRIAL CHAMBER HAS OPENED!', t2 = 'Follow the copper arrow: an elite mob waits inside';
      const bw = Math.round(Math.min(w - 24, Math.max(ctx.measureText(t1).width, (ctx.font = F(700, 11), ctx.measureText(t2).width)) + 36));
      mcBox(ctx, -bw / 2, -26, bw, 52, 'rgba(42,20,8,.9)');
      ctx.fillStyle = PAL.trial.mid; ctx.fillRect(Math.round(-bw / 2), 24, bw, 2);
      ctx.textAlign = 'center';
      ctx.font = F(800, 20); sText(ctx, t1, 0, -2, PAL.trial.light, 2);
      ctx.font = F(700, 11); sText(ctx, t2, 0, 16, PAL.trial.sub, 1);
      ctx.restore();
    }

    // Dimension, boss and portal titles (floors.js), Minecraft title style; biome entry below.
    const big = G.Floors.banner, small = G.Floors.biomeBanner;
    if (big) {
      const a = Math.min(1, big.t * 3, (big.dur - big.t) * 1.5), pop = 1 + Math.max(0, 0.2 - big.t) * 1.5;
      const y0 = Math.round(Math.max(h * 0.25, 170));      // below the achievement toast
      ctx.save();
      ctx.globalAlpha = a * 0.45;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, y0 - 36, w, big.sub ? 70 : 52);
      ctx.globalAlpha = a;
      ctx.translate(w / 2, y0); ctx.scale(pop, pop);
      ctx.textAlign = 'center';
      ctx.font = F(800, 32); sText(ctx, big.title, 0, 0, big.col, 3);
      if (big.sub) { ctx.font = F(700, 12); sText(ctx, big.sub, 0, 22, '#e0e0e0', 1); }
      ctx.restore();
    } else if (small) {
      const a = Math.min(1, small.t * 2.5, (small.dur - small.t) * 1.5);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = F(700, 16); sText(ctx, small.text, w / 2, Math.round(Math.max(h * 0.25, 170)), '#ffffff', 2);
      ctx.restore();
    }

    const ban = G.Spawner.banner();
    if (ban) {
      const a = Math.min(1, ban.t * 1.6);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = F(800, 22);
      ctx.fillStyle = '#ffcb3d';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4;
      ctx.strokeText(ban.text, w / 2, h * 0.3);
      ctx.fillText(ban.text, w / 2, h * 0.3);
      ctx.restore();
    }

    // ---------- ranura de movimientos ----------
    const S = 54, GAP = 9;
    const n = Math.max(1, pl.slots.length);
    const totalW = n * S + (n - 1) * GAP;
    let sx = (w - totalW) / 2;
    // Por encima de la barra de inicio del iPhone (allí los toques a veces no llegan).
    const sy = h - S - 18 - (touch ? Math.min(28, G.Touch.safeArea().bottom) : 0);
    const BOND = '#ff8ad8';
    const cdOf = m => m.kind === 'orbit' ? 0 : G.U.clamp(m.t / (m.cd * pl.cdMul), 0, 1);

    for (let i = 0; i < n; i++) {
      const g = pl.slots[i] || [];
      const m = g[0];
      const fused = g.length > 1;
      const on = i === pl.active;
      const x = sx + i * (S + GAP);
      const y = on ? sy - 6 : sy;
      // Tocar (o hacer clic en) un icono activa ese movimiento.
      if (m) G.Touch.addButton(x, y, S, S, () => { if (G.Game.state === 'playing' && pl.active !== i) { pl.setActive(i); G.Audio.sfx('click'); } }, GAP / 2 + 3);
      const col = m ? G.U.TYPE_COLOR[m.type] : '#4a5468';

      // Ranura de barra rápida. La elegida lleva el marco blanco de Minecraft;
      // Combo: marco rosa. Smithing: dorado. Enchanted at the Enchanting Table: purple (and a glint).
      const fc = fused ? BOND : m && m.evolved ? '#ffd23f' : on ? '#f0f0f0' : m && m.ench ? '#c77dff' : null;
      if (fc) frame(ctx, x, y, S, fc, on ? 3 : 2);
      slot(ctx, x, y, S, on ? 'rgba(52,52,56,.9)' : 'rgba(28,28,30,.78)');
      // Color del elemento: una franja abajo.
      if (m) { ctx.fillStyle = col; ctx.globalAlpha = on ? 0.9 : 0.5; ctx.fillRect(x + 2, y + S - 4, S - 4, 2); ctx.globalAlpha = 1; }

      if (!m) continue;

      if (fused) {
        // Vínculo: los movimientos en una cuadrícula de 2×2, cada uno con su recarga.
        const C = 22, P = (S - C * 2) / 3;
        g.forEach((gm, k) => {
          const cx = x + P + (k % 2) * (C + P), cy = y + P + Math.floor(k / 2) * (C + P);
          G.Icons.draw(ctx, 'move:' + gm.id, cx, cy, C);
          if (gm.ench) G.Enchanting.drawGlint(ctx, cx, cy, C);
          const f = cdOf(gm);
          if (f > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(cx, cy, C, C * f); }
          if (gm.evolved) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; ctx.strokeRect(cx + 0.5, cy + 0.5, C - 1, C - 1); }
          // Destello al lanzarse.
          const fl = 1 - (performance.now() - (gm.castAt || 0)) / 180;
          if (fl > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (fl * 0.55).toFixed(2) + ')'; ctx.fillRect(cx, cy, C, C); }
        });
      } else {
        // recarga: se vacía de abajo a arriba
        const cdFrac = cdOf(m);
        if (cdFrac > 0) {
          ctx.fillStyle = 'rgba(0,0,0,.6)';
          ctx.fillRect(x, y, S, Math.round(S * cdFrac));
        }

        // objeto de la habilidad en la ranura del elemento + insignia de la familia
        G.Icons.draw(ctx, 'move:' + m.id, x + (S - 32) / 2, y + (S - 32) / 2 - 3, 32);
        if (m.ench) G.Enchanting.drawGlint(ctx, x + 2, y + 2, S - 4);

        // nivel del movimiento (puntitos)
        const dots = m.def.maxLvl;
        const dw = 4, dgap = 2;
        const tw = dots * dw + (dots - 1) * dgap;
        for (let d = 0; d < dots; d++) {
          ctx.fillStyle = d < m.lvl ? col : 'rgba(255,255,255,.18)';
          ctx.fillRect(Math.round(x + (S - tw) / 2 + d * (dw + dgap)), y + S - 10, dw, 3);
        }
      }

      // tecla
      ctx.font = F(800, 9);
      ctx.textAlign = 'left';
      sText(ctx, String(i + 1), x + 4, y + 11, fused ? BOND : on ? '#ffffff' : '#9a9a9a', 1);

      // nombre encima del activo (con un vínculo: "Ascuas +2")
      if (on) {
        ctx.font = F(700, 10);
        ctx.textAlign = 'center';
        sText(ctx, fused ? m.name + ' +' + (g.length - 1) : m.name, x + S / 2, y - 9, fused ? BOND : col, 1);
      }
    }

    // ---------- vínculo guardado (aún no hay dos movimientos sueltos) ----------
    if (pl.bonds > 0) {
      const bx = sx + totalW + 12, by = sy + S / 2 - 12;
      G.Icons.draw(ctx, 'bond', bx, by, 24);
      if (pl.bonds > 1) {
        ctx.font = F(800, 10);
        ctx.textAlign = 'left';
        sText(ctx, '×' + pl.bonds, bx + 25, by + 20, BOND, 1);
      }
    }

    // ---------- objeto equipado (a la izquierda de los movimientos) ----------
    {
      const ix = sx - S - 18, iy = sy;
      if (pl.item) frame(ctx, ix, iy, S, '#ffd23f', 2);
      slot(ctx, ix, iy, S, pl.item ? 'rgba(48,40,20,.9)' : 'rgba(28,28,30,.82)');
      if (pl.item) {
        G.Icons.draw(ctx, pl.item, ix + (S - 32) / 2, iy + (S - 32) / 2, 32);
        ctx.font = F(700, 9);
        ctx.textAlign = 'center';
        sText(ctx, G.Items.BY[pl.item].name, ix + S / 2, iy - 9, '#ffd23f', 1);
      }
    }

    // ---------- botón de pausa (táctil) ----------
    if (touch) {
      const sa = G.Touch.safeArea();
      const bx = w - 52 - Math.min(44, sa.right), by = 12 + Math.min(20, sa.top), bs = 40;
      mcBox(ctx, bx, by, bs, bs, 'rgba(110,110,112,.85)');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx + 13, by + 11, 5, 18); ctx.fillRect(bx + 22, by + 11, 5, 18);
      G.Touch.addButton(bx, by, bs, bs, () => G.Game.togglePause(), 8);
    }

    // pista de controles
    if (st.time < 14) {
      ctx.font = F(600, 10);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(210,210,210,.6)';
      ctx.fillText(touch ? 'Drag your finger to move  ·  tap a skill to switch to it'
                         : 'WASD move  ·  1-4 / Q / E or click a skill to switch  ·  walk into or click a block to break it  ·  Esc pause', w / 2, h - 4);
    }

    ctx.restore();
  }

  // ---------------- cooperativo ----------------

  /**
   * - Vida de cada compañero debajo de la tuya.
   * - Flecha en el borde de la pantalla hacia los que no se ven, con su nombre
   *   y a cuántos metros están (roja y parpadeando si está caído).
   * - Si has caído tú: aviso y barra de "te están levantando".
   */
  function drawCoop(ctx, w, h, pl, px, top) {
    const cam = G.Camera;
    const t = performance.now() / 1000;
    let y = top;
    ctx.textAlign = 'left';
    for (const m of G.Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      ctx.font = F(800, 10);
      ctx.fillStyle = m.color;
      ctx.fillText(m.name, px, y + 9);
      const lx = px + 78;
      bar(ctx, lx, y + 1, 110, 8, o.dead ? 0 : o.hp / o.maxHp, o.dead ? '#ff5f6d' : '#5fe08a');
      if (o.dead) {
        ctx.font = F(800, 9);
        ctx.fillStyle = Math.sin(t * 8) > 0 ? '#ff8a96' : '#ffd0d5';
        ctx.fillText('DOWN', lx + 116, y + 9);
      }
      y += 15;
    }

    // Flechas hacia los compañeros fuera de la vista.
    for (const m of G.Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      const sx = (o.x - cam.left()) * cam.scale, sy = (o.y - o.bodyH * 0.5 - cam.top()) * cam.scale;
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const M = 42;
      const ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
      const a = Math.atan2(sy - ey, sx - ex);
      const metres = Math.round(G.U.dist(pl.x, pl.y, o.x, o.y) / 32);
      const col = o.dead ? (Math.sin(t * 8) > 0 ? '#ff5f6d' : '#ffd0d5') : m.color;
      ctx.save();
      ctx.translate(ex, ey);
      // Flecha
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.2832); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28);
      ctx.lineTo(Math.cos(a + 2.4) * 14, Math.sin(a + 2.4) * 14);
      ctx.lineTo(Math.cos(a - 2.4) * 14, Math.sin(a - 2.4) * 14);
      ctx.closePath(); ctx.fill();
      // Inicial del compañero dentro del círculo
      ctx.font = F(800, 14);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(m.name.charAt(0).toUpperCase(), 0, 5);
      // Nombre y distancia: al lado contrario de la flecha, para que no se salga
      const lx = -Math.cos(a) * 30, ly = -Math.sin(a) * 26 + 4;
      ctx.font = F(800, 12);
      const label = (o.dead ? m.name + ' needs help! ' : m.name + ' ') + '· ' + metres + ' m';
      ctx.textAlign = Math.cos(a) > 0.3 ? 'right' : Math.cos(a) < -0.3 ? 'left' : 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(label, lx, ly);
      ctx.fillStyle = col;
      ctx.fillText(label, lx, ly);
      ctx.restore();
    }

    // Tú, caído.
    if (pl.dead) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      const msg = G.Coop.players().every(p => p.dead) ? 'Everyone is down…' : 'You are down: a teammate can revive you';
      ctx.strokeText(msg, w / 2, h * 0.62);
      ctx.fillStyle = '#ffb0b8';
      ctx.fillText(msg, w / 2, h * 0.62);
      const f = (pl.reviveT || 0) / G.Player.REVIVE_TIME;
      if (f > 0) bar(ctx, w / 2 - 110, h * 0.62 + 12, 220, 10, f, '#5fe08a');
      ctx.restore();
    }
  }

  return { draw, roundRect, bar };
})();
