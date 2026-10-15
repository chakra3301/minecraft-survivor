/* ============ daynight.js — the Overworld's day and night ============
 * Like Minecraft, only the Overworld has a sun: the Underworld, the Nether, the Stronghold, the End,
 * the Ancient City and Trial Chambers have no cycle. Herobrine's World (a floor with `night: true`)
 * is stuck in an endless night: always dark, always the night spawn lists, the moon and "NIGHT ∞".
 * One day lasts CYCLE seconds of run time; a run starts in the morning. At night:
 *   - each surface biome spawns from its `night` list instead of its `day` list (data/dimensions.js,
 *     read by data/enemies.js through phaseFor), and mobs spawn a bit faster (spawnMul);
 *   - the screen darkens except for a torch-lit circle around the player.
 * At sunrise the undead that burn in daylight (zombies, skeletons, strays...) catch fire, unless
 * they stand in a cave biome or in water. Cave biomes (`dark: true`) are dark at any hour.
 * The Aether (`sunny: true`) has no cycle either: an endless noon ("NOON ∞" by the clock).
 * Underwater floors (The Ocean, `underwater: true`) have no sky either: draw() lays a blue-green tint,
 * swaying light rays and caustics from the surface, drifting specks and darker edges over them
 * (dimmer in its `dark` biomes: the Deep Ocean and the Ocean Monument).
 */
G.DayNight = (() => {
  const CYCLE = 300;                         // seconds per full day
  const DUSK = 150, NIGHT = 175, DAWN = 275;  // day 0-150, dusk 150-175, night 175-275, dawn 275-300
  const NIGHT_SPAWN = 1.3;                   // spawn rate multiplier at night
  // Mobs that burn in sunlight (roster keys). Drowned only burn out of the water.
  const BURNS = new Set(['zombie', 'skeleton', 'zombie_villager', 'stray', 'bogged', 'phantom', 'drowned']);

  let phase = 'day', burnT = 0, dark = 0;
  let offset = 0;                            // dev panel: shifts the clock of the sky only
  const sun = new Image(), moon = new Image();
  sun.src = 'assets/mc/environment/sun.png';
  moon.src = 'assets/mc/environment/moon_phases.png';

  /** Is there a sky that turns right now? (Overworld, not in a Trial Chamber) */
  function hasCycle() {
    const dim = (G.Floors && G.Floors.dim) || G.World.dimension || 'overworld';
    return dim === 'overworld' && !(G.Rift && G.Rift.inArena);
  }
  /** A floor stuck in night (Herobrine's World), outside Trial Chambers. */
  function endless() {
    return !!(G.Floors && G.Floors.def && G.Floors.def.night) && !(G.Rift && G.Rift.inArena);
  }
  const runTime = () => (G.Game && G.Game.st ? G.Game.st.time : 0);
  const cyc = (t = runTime()) => (((t + offset) % CYCLE) + CYCLE) % CYCLE;

  /** Daylight 0 (night) .. 1 (noon) at run second t, ignoring dimension. */
  function lightAt(t) {
    const c = cyc(t);
    if (c < DUSK) return 1;
    if (c < NIGHT) return 1 - (c - DUSK) / (NIGHT - DUSK);
    if (c < DAWN) return 0;
    return (c - DAWN) / (CYCLE - DAWN);
  }
  function phaseAt(t) {
    const c = cyc(t);
    return c < DUSK ? 'day' : c < NIGHT ? 'dusk' : c < DAWN ? 'night' : 'dawn';
  }
  /** Daylight now: 1 where there is no sky, 0 in an endless night. */
  function light() { return endless() ? 0 : hasCycle() ? lightAt(runTime()) : 1; }
  /** Night (or dusk past halfway) in the Overworld, or an endless night. */
  function isNight() { return endless() || (hasCycle() && lightAt(runTime()) < 0.5); }

  /**
   * Spawn phase of a biome right now: 'all' for biomes with a single list (caves, Nether, End),
   * otherwise 'day' or 'night'.
   */
  function phaseFor(key) {
    const b = G.BIOME_DEFS[key];
    if (!b || !b.day || !b.night) return 'all';
    return isNight() ? 'night' : 'day';
  }

  const biomeDef = (x, y) => { const k = G.World.biomeKeyAt ? G.World.biomeKeyAt(x, y) : null; return (k && G.BIOME_DEFS[k]) || null; };
  /** Caves: dark at any hour. */
  function inDarkBiome(x, y) { const b = biomeDef(x, y); return !!(b && b.dark); }
  /** Caves and shaded biomes (Dark Forest canopy): the sun can't burn anyone there. */
  function inShade(x, y) { const b = biomeDef(x, y); return !!(b && (b.dark || b.shade)); }

  /** Spawn-rate multiplier: busier at night. */
  function spawnMul() { return isNight() ? NIGHT_SPAWN : 1; }

  function reset() { offset = 0; phase = phaseAt(0); burnT = 0; dark = 0; }

  /** Dev panel: jump the sky to 'day' | 'dusk' | 'night' | 'dawn' without touching the run clock. */
  function debugSet(ph) {
    const want = { day: 20, dusk: DUSK + 2, night: NIGHT + 5, dawn: DAWN + 5 }[ph];
    if (want == null) return;
    offset = want - (runTime() % CYCLE);
  }

  function update(dt, pl, t) {
    if (!pl) return;
    const now = hasCycle() ? phaseAt(t) : null;
    if (now && now !== phase) {
      if (now === 'dusk') { G.Spawner.say('The sun is setting… monsters are coming out', 3.4); G.Audio.sfx('biome'); }
      if (now === 'dawn') { G.Spawner.say('The sun rises: the undead burn!', 3.4); G.Audio.sfx('biome'); }
    }
    if (now) phase = now;
    // Sunlight sets the undead on fire (once a second).
    burnT -= dt;
    if (burnT <= 0 && hasCycle() && lightAt(t) > 0.6) {
      burnT = 1;
      for (const e of G.EnemyMgr.all()) {
        // (Co-op: a guest's copies burn on the host, not twice.)
        if (e.dead || e.boss || e.judge || e.legend || e.remote) continue;
        const p = G.DEX_BY[e.dex];
        if (!p || !BURNS.has(p.key) || inShade(e.x, e.y)) continue;
        if (p.key === 'drowned' && G.World.isLiquid(e.x, e.y)) continue;
        e.burn = Math.max(e.burn || 0, 2); e.burnT = Math.max(e.burnT || 0, 1.5);
        e.hurt(e.maxHp * 0.22 + 2, '#ff9a4d');      // gone in ~4 s, like a mob catching fire at dawn
      }
    }
  }

  // ---------------- underwater ----------------
  let deepK = 0;                             // eased 0..1: how far into a dark sea biome you are
  const specks = [];                         // drifting marine snow, in screen space

  /** The sea over an underwater floor: tint, light rays and caustics from above, specks, dark edges. */
  function drawWater(ctx, w, h, pl) {
    const now = performance.now() / 1000;
    deepK += ((inDarkBiome(pl.x, pl.y) ? 1 : 0) - deepK) * 0.05;
    const lit = 1 - deepK * 0.7;
    ctx.save();
    // Blue-green water, deeper toward the bottom of the screen.
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(24,120,150,${(0.2 + deepK * 0.05).toFixed(3)})`);
    g.addColorStop(1, `rgba(8,48,100,${(0.32 + deepK * 0.12).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Light rays from the surface: slanted shafts that sway and breathe.
    ctx.globalCompositeOperation = 'lighter';
    const RAYS = 6, L = h * 0.9;
    for (let i = 0; i < RAYS; i++) {
      const x0 = w * (i + 0.5) / RAYS + Math.sin(now * 0.27 + i * 1.7) * w * 0.05;
      const xb = x0 + h * 0.32, tw = w * (0.035 + 0.02 * ((i * 37) % 5) / 5), bw = tw * 2.6;
      const a = (0.055 + 0.03 * Math.sin(now * 0.6 + i * 2.3)) * lit;
      if (a <= 0.005) continue;
      const rg = ctx.createLinearGradient(0, 0, 0, L);
      rg.addColorStop(0, `rgba(170,240,255,${a.toFixed(3)})`);
      rg.addColorStop(1, 'rgba(170,240,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(x0 - tw / 2, 0); ctx.lineTo(x0 + tw / 2, 0);
      ctx.lineTo(xb + bw / 2, L); ctx.lineTo(xb - bw / 2, L);
      ctx.closePath(); ctx.fill();
    }
    // Caustics: rippling bands of light near the surface.
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const y0 = 14 + k * h * 0.06, amp = 4 + k * 2, a = (0.09 - k * 0.018) * lit;
      ctx.strokeStyle = `rgba(200,250,255,${a.toFixed(3)})`;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const y = y0 + Math.sin(x * 0.018 + now * (1.1 + k * 0.3) + k) * amp + Math.sin(x * 0.041 - now * 0.8) * amp * 0.5;
        if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // Marine snow drifting up through the light.
    while (specks.length < 36) specks.push({ x: Math.random() * w, y: Math.random() * h, v: 8 + Math.random() * 16, s: Math.random() < 0.3 ? 3 : 2, p: Math.random() * 6.28 });
    ctx.fillStyle = `rgba(220,250,255,${(0.32 * lit + 0.08).toFixed(3)})`;
    for (const s of specks) {
      s.y -= s.v / 60; s.p += 0.02;
      if (s.y < -4 || s.x > w + 4) { s.y = h + 4; s.x = Math.random() * w; }
      ctx.fillRect(Math.round(s.x + Math.sin(s.p) * 6), Math.round(s.y), s.s, s.s);
    }
    // Darker toward the edges, like looking through deep water.
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
    v.addColorStop(0, 'rgba(2,20,38,0)');
    v.addColorStop(1, `rgba(2,20,38,${(0.5 + deepK * 0.2).toFixed(3)})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** Screen-space darkness with a torch-lit circle around the player (after the world, before the HUD). */
  function draw(ctx, w, h, pl) {
    if (!pl) return;
    if (G.Floors && G.Floors.underwater) drawWater(ctx, w, h, pl);
    let target = 0;
    if (endless()) target = 0.8;
    else if (hasCycle()) target = (1 - lightAt(runTime())) * 0.8;
    if (inDarkBiome(pl.x, pl.y)) target = Math.max(target, 0.38);
    // The Warden's Darkness effect: vision pulses in and out.
    if (pl.fx && pl.fx.darkness) target = Math.max(target, 0.78 + Math.sin(performance.now() / 260) * 0.12);
    dark += (target - dark) * 0.06;            // eased, so biome borders don't pop
    if (dark < 0.01) return;
    const cam = G.Camera, k = cam.scale;
    const sx = (pl.x - cam.left()) * k, sy = (pl.y - 18 - cam.top()) * k;
    const flick = 1 + Math.sin(performance.now() / 90) * 0.02 + Math.sin(performance.now() / 37) * 0.012;
    const r0 = 64 * k * flick, r1 = 260 * k * flick;
    const g = ctx.createRadialGradient(sx, sy, r0, sx, sy, r1);
    g.addColorStop(0, 'rgba(8,10,30,0)');
    g.addColorStop(0.55, `rgba(8,10,30,${(dark * 0.6).toFixed(3)})`);
    g.addColorStop(1, `rgba(8,10,30,${dark.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Warm torch glow at the centre.
    const t = ctx.createRadialGradient(sx, sy, 0, sx, sy, r0 * 1.6);
    t.addColorStop(0, `rgba(255,170,80,${(dark * 0.16).toFixed(3)})`);
    t.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = t;
    ctx.fillRect(0, 0, w, h);
    // The Aether portal (Herobrine's World) shines through the night: it's the way out, so it must be seen.
    const po = G.Floors && G.Floors.portal;
    if (po && po.kind === 'aether') {
      const grow = po.ready || (po.ref && po.ref.ready) ? 1 : Math.min(1, (po.t || 0) / 2.5);
      const px = (po.x - cam.left()) * k, py = (po.y - 40 - cam.top()) * k, pr = (110 + 70 * grow) * k * flick;
      const glow = ctx.createRadialGradient(px, py, 0, px, py, pr);
      glow.addColorStop(0, `rgba(255,236,150,${(dark * 0.75 * (0.35 + 0.65 * grow)).toFixed(3)})`);
      glow.addColorStop(0.45, `rgba(255,214,110,${(dark * 0.32 * grow).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(255,214,110,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glow;
      ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      ctx.restore();
    }
    // Sunset / sunrise: an orange cast while the light changes.
    const l = hasCycle() ? lightAt(runTime()) : 1;
    if (l > 0 && l < 1) {
      ctx.fillStyle = `rgba(255,110,40,${(Math.sin(l * Math.PI) * 0.13).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /** Sun or moon left of the clock, with "DAY n" / "NIGHT n" (an endless night: the full moon, "NIGHT ∞"). */
  function drawHud(ctx, w) {
    const forever = endless(), noon = !!(G.Floors && G.Floors.def && G.Floors.def.sunny) && !(G.Rift && G.Rift.inArena);
    if (!hasCycle() && !forever && !noon) return;
    const t = runTime(), night = !noon && (forever || lightAt(t) < 0.5), n = forever ? 1 : Math.floor(t / CYCLE) + 1;
    const S = 32, x = Math.round(w / 2 - 82), y = 13;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Both textures hold the disc in the middle 16x16 of each 32x32 frame: crop it and draw at 2x.
    if (night && moon.complete && moon.naturalWidth) {
      const f = (n - 1) % 8, fw = moon.naturalWidth / 4, fh = moon.naturalHeight / 2;
      ctx.drawImage(moon, (f % 4) * fw + fw / 4, Math.floor(f / 4) * fh + fh / 4, fw / 2, fh / 2, x, y, S, S);
    } else if (!night && sun.complete && sun.naturalWidth) {
      const q = sun.naturalWidth / 4;
      ctx.drawImage(sun, q, q, q * 2, q * 2, x, y, S, S);
    }
    ctx.font = '700 10px Pixelify, monospace';
    ctx.textAlign = 'right';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)';
    const label = noon ? 'NOON ∞' : forever ? 'NIGHT ∞' : (night ? 'NIGHT ' : 'DAY ') + n;
    ctx.strokeText(label, x - 4, y + S / 2 + 4);
    ctx.fillStyle = night ? '#a9b8ff' : '#ffe27a';
    ctx.fillText(label, x - 4, y + S / 2 + 4);
    ctx.restore();
  }

  return {
    CYCLE, reset, update, draw, drawHud, spawnMul, debugSet, light, lightAt, phaseAt, isNight, phaseFor, hasCycle, endless,
    get phase() { return endless() ? 'night' : hasCycle() ? phase : null; }
  };
})();
