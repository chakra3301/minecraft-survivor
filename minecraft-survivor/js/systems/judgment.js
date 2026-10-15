/* ============ judgment.js — Herobrine Awakens (the eighth floor) ============
 *
 * Herobrine's World is the last floor of the climb (data/dimensions.js, goal 'herobrine'): the
 * Overworld in an endless night. A few seconds after you arrive, floors.js calls awaken():
 *
 *   1. Cinematic: the screen goes black, "HEROBRINE / HAS AWAKENED" appears
 *      over an obsidian Nether-portal ring with his dark silhouette and glowing
 *      white eyes, lightning flashes, and Herobrine comes down a lightning strike
 *      right where you stand and lands with a shockwave. The first time it plays
 *      in full; afterwards it can be skipped (in co-op only by the host).
 *   2. Fight: Herobrine is INVINCIBLE (not an enemy: attacks don't target him).
 *      He chases you faster and faster; touching him takes 40% of your health,
 *      and he casts lightning strikes, cross beams and shockwaves, all
 *      telegraphed on the ground. That damage ignores elements and defense.
 *   3. Every BOSS_EVERY (10) s a random boss mob joins, each with HP_GROWTH (×1.25) the health and
 *      DMG_GROWTH (×1.15) the damage of the previous one; at most MAX_ALIVE (4) hunt at once (the next
 *      one waits for a free place). The first one is sized from the damage you dealt to ONE enemy before
 *      he awoke (about 3 s), so it doesn't fall instantly. They give experience but nothing else.
 *   4. Survive: `surviveFor` (150) seconds after you arrive on the floor, a glowstone Aether portal
 *      builds itself near you (systems/floors.js). Herobrine and his bosses keep coming until you step
 *      in; then he roars and fades (ascend()) and the run goes on to the Aether (systems/aether.js).
 *      The 15th boss of a full 150 s has ~23× the first one's health and ~7× its damage: a strong
 *      late-game build that kites can make it; a weak one falls well before.
 *
 * Nothing else spawns meanwhile (no waves, events or Trial Chambers). There is no
 * arena: the fight happens in Herobrine's World itself, and the run ends when you fall.
 *
 * Co-op: the host decides. Messages (see coop.js):
 *   'jd' cfg (start) · 'jk' (skip the cinematic)
 *   and in every host packet, ja: [x, y, animation, direction] of Herobrine.
 */
G.Judgment = (() => {
  // Boss mobs: one every BOSS_EVERY s, each ×HP_GROWTH health and ×DMG_GROWTH damage of the previous one,
  // at most MAX_ALIVE at once (the next waits). Tuned so `surviveFor` (150 s) is hard but possible.
  const BOSS_EVERY = 10, HP_GROWTH = 1.25, DMG_GROWTH = 1.15, MAX_ALIVE = 4;
  const TOUCH = 0.4;                  // health lost when Herobrine touches you
  const HEROBRINE = 45, SCALE = 1.5;  // dex 45 'herobrine'
  // Cinematic timeline (seconds).
  const T_TITLE = 1.3, T_FLASH = 4.7, T_PORT = 5.1, T_DESC = 5.7, T_LAND = 7.9, T_BACK = 9.1, T_END = 10.1;
  // Palette: white lightning, glowing eyes, dark smoke and portal purple.
  const BOLT = '#cfeaff', EYE = '#ffffff', SMOKE = '#1c1822', PORTAL = '#a24bff', GOLD = '#ffd95a';
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const TS = () => G.Tiles.T * G.Sprites.PX;

  let phase = null;                   // null | 'cine' | 'fight'
  let ct = 0;                         // reloj de la animación
  let cfg = null;                     // { q: [dex of the boss mobs] }
  let ported = false, landed = false, canSkip = false, cues = {};
  let A = null;                       // Herobrine
  let arenaT = 0, bossT = 0, bossN = 0, base = 0, downs = 0;
  // Daño a un solo enemigo por segundo (el que más recibe en cada segundo; con
  // ataques en área, sumar todo daría una vida enorme). Se guardan los últimos
  // 30 s y vale la media de los 6 mejores.
  let hits = new Map(), hitT = 0, samples = [];
  let embers = [];                    // falling ash and sparks (screen space)
  let cineAnim = null;

  function reset() {
    phase = null; ct = 0; cfg = null; ported = landed = canSkip = false; cues = {};
    A = null; arenaT = bossT = 0; bossN = 0; base = 0; downs = 0; fade = null;
    hits = new Map(); hitT = 0; samples = []; embers = []; cam = null;
  }

  /** Daño hecho a un enemigo (lo llama Enemy.hurt en quien manda). */
  function noteDmg(d, e) { if (!phase) hits.set(e.id, (hits.get(e.id) || 0) + d); }

  function sampleDps(dt) {
    hitT += dt;
    if (hitT < 1) return;
    let best = 0;
    for (const v of hits.values()) if (v > best) best = v;
    samples.push(best / hitT);
    if (samples.length > 30) samples.shift();
    hits.clear(); hitT = 0;
  }
  function singleDps() {
    const top = samples.slice().sort((a, b) => b - a).slice(0, 6);
    return top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0;
  }

  // ---------------- arranque ----------------

  /** Authority: picks the boss mobs (never Herobrine himself) and tells everyone. */
  function start() {
    const pool = G.DEX.filter(p => p.leg && p.dex !== HEROBRINE && G.SPRITE_META[p.dex]);
    const q = [];
    for (let i = 0; i < 40; i++) q.push(G.U.pick(pool).dex);
    const c = { q };
    if (G.Coop.isHost) G.Coop.broadcast(['jd', c]);
    begin(c);
  }

  /** En cada ordenador: empieza la animación. */
  function begin(c) {
    if (phase) return;
    cfg = c;
    phase = 'cine'; ct = 0; cues = {};
    const s = G.DB.save;
    // La primera vez se ve entera; en grupo la salta el anfitrión.
    canSkip = !!(s && s.stats && s.stats.judged > 0) && authority();
    G.Sprites.preload([HEROBRINE, ...new Set(c.q.slice(0, 12))], 12000);
    cineAnim = new G.Sprites.Animator(HEROBRINE, 1);
    G.Touch.reset();
    G.Audio.music(null);
  }

  /** Salta la animación (tecla o toque; en grupo, el anfitrión). */
  function skip() {
    if (phase !== 'cine' || !canSkip || ct >= T_BACK) return;
    if (G.Coop.isHost) G.Coop.broadcast(['jk']);
    doSkip();
  }
  function doSkip() {
    if (phase !== 'cine') return;
    if (!ported) port();
    land(true);
    ct = T_BACK;
  }

  /** Mid-cinematic, under the flash: the field clears and Herobrine appears above you. */
  function port() {
    ported = true;
    const pl = G.Game.player, ts = TS();
    G.Rift.reset();
    if (authority()) G.EnemyMgr.stash(); else G.EnemyMgr.clearRemote();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();
    G.Events.reset();
    G.Weather.clear();
    // He lands on free ground a few blocks north of you.
    let ax = pl.x, ay = pl.y - ts * 5;
    for (let i = 0; i < 24; i++) {
      const a = -Math.PI / 2 + (i % 2 ? 1 : -1) * Math.floor((i + 1) / 2) * 0.4, d = ts * (5 + (i % 3));
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d;
      if (!G.World.isFree || G.World.isFree(x, y, 24)) { ax = x; ay = y; break; }
    }
    const anim = new G.Sprites.Animator(HEROBRINE, SCALE);
    A = { x: ax, y: ay, lift: 900, anim, r: G.Sprites.bodyRadius(HEROBRINE, SCALE) * 0.9,
          bodyH: G.Sprites.bodyHeight(HEROBRINE, SCALE), cd: 2.2, cast: null, touchCd: 0, spin: 0,
          net: null, glow: 0 };
    anim.dir = 0;
  }

  /** Herobrine hits the ground. */
  function land(quiet = false) {
    if (landed || !A) return;
    landed = true;
    A.lift = 0;
    A.anim.play('Attack', { speed: 0.8 });
    if (quiet) return;
    G.Camera.kick(1.2);
    G.Game.flash('#e8f6ff', 0.7);
    G.Audio.sfx('land');
    for (let i = 0; i < 4; i++) G.FX.ring(A.x, A.y, 10 + i * 20, 260 + i * 140, i % 2 ? PORTAL : BOLT, 0.5 + i * 0.25, 8 - i);
    G.FX.burst(A.x, A.y - 20, SMOKE, 60, 360);
    G.FX.burst(A.x, A.y - 10, '#ffffff', 30, 240);
  }

  /** Fin de la animación: empieza la pelea. */
  function fight() {
    phase = 'fight';
    if (!ported) port();
    land(true);
    arenaT = 0; bossT = 1.2; bossN = 0; downs = 0;
    G.Progress.event('judge');
    // First boss mob's health: about 3 s of your damage to one enemy (with a floor).
    const n = G.Game.everyone().length, t = G.Game.st.time;
    const floor = (3200 + t * 9) * 0.35 * G.Coop.scaleHp(n);
    base = Math.max(floor, singleDps() * 3);
    G.Spawner.say('Run from Herobrine! Survive and a way out will open', 3, true);
  }

  // ---------------- cada fotograma ----------------

  /** Durante la animación (el resto del juego está parado). */
  function cineTick(dt) {
    const prev = ct;
    ct += dt;
    const at = x => prev < x && ct >= x;
    const pl = G.Game.player;
    if (cineAnim) cineAnim.update(dt);
    if (at(0.01)) { G.Audio.sfx('quake'); G.Camera.kick(0.9); }
    if (ct < T_FLASH && Math.random() < dt * 3) G.Camera.kick(0.15);
    if (at(T_TITLE)) G.Audio.sfx('toll');
    if (at(T_TITLE + 1.7)) G.Audio.sfx('toll');
    if (at(T_FLASH)) G.Game.flash('#ffffff', 0.9);
    if (at(T_PORT) && !ported) port();
    if (at(T_DESC)) G.Audio.sfx('descend');
    if (A && !landed) {
      // Descent: slow at first, braking at the end (as if settling down).
      const k = G.U.clamp((ct - T_DESC) / (T_LAND - T_DESC), 0, 1);
      A.lift = 900 * Math.pow(1 - k, 2.2);
      A.anim.loop('Idle');
      if (ct > T_DESC && Math.random() < dt * 30) G.FX.px(A.x + G.U.rand(-60, 60), A.y - A.lift - G.U.rand(0, 200), Math.random() < 0.6 ? SMOKE : BOLT, { vy: G.U.rand(60, 160), life: 0.9 });
      if (at(T_LAND)) land();
    }
    if (A) { A.anim.update(dt); A.spin += dt; }
    // Camera: your mob; slowly pans up to Herobrine while he comes down, then back.
    let tx = pl.x, ty = pl.y;
    if (ported && A && ct < T_BACK) { tx = A.x; ty = A.y - 60; }
    if (!cam || at(T_PORT) || (ported && !cam.ported)) cam = { x: G.Camera.x, y: G.Camera.y, ported };
    cam.x = G.U.damp(cam.x, tx, 2.2, dt); cam.y = G.U.damp(cam.y, ty, 2.2, dt);
    G.Camera.follow(cam.x, cam.y, dt);
    if (ct >= T_END) { cam = null; fight(); }
  }
  let cam = null;

  /** En la pelea (lo llama game.js en cada fotograma de juego). */
  function update(dt, pl, time) {
    if (!phase) {
      sampleDps(dt);                        // (for the first boss mob's health, and End Crystals)
      return;
    }
    if (phase !== 'fight' || fade) return;
    arenaT += dt;
    A.touchCd -= dt; A.spin += dt;
    if (authority()) {
      chaseTick(dt);
      bossT -= dt;
      if (bossT <= 0) {
        // A full hunt: the next boss waits (the clock holds at 0) until one falls.
        if (alive() < MAX_ALIVE) { bossT = BOSS_EVERY; spawnBoss(); } else bossT = 0;
      }
    } else netTick(dt);
    A.anim.update(dt);
    touch(pl);
    ember(dt);
  }

  // ---------------- Herobrine ----------------

  function target() {
    let best = null, bd = Infinity;
    for (const p of G.Game.everyone()) {
      if (p.dead) continue;
      const d = G.U.dist2(p.x, p.y, A.x, A.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function chaseTick(dt) {
    const tg = target();
    if (A.cast) { castTick(dt, tg); return; }
    if (!tg) { A.anim.loop('Idle'); return; }
    // Slower than you at first; after ~35 s he catches up.
    const k = Math.min(1.22, 0.74 + arenaT * 0.013);
    const spd = Math.max(70, (tg.spd || 100) * k);
    const [dx, dy] = G.U.norm(tg.x - A.x, tg.y - A.y);
    A.x += dx * spd * dt; A.y += dy * spd * dt;
    A.anim.dir = G.Sprites.dirFromAngle(Math.atan2(dy, dx));
    A.anim.loop('Walk', Math.max(0.8, spd / 90));
    // Dark smoke trailing behind him, with the odd spark.
    if (Math.random() < dt * 14) G.FX.px(A.x + G.U.rand(-20, 20), A.y - G.U.rand(0, A.bodyH), Math.random() < 0.8 ? SMOKE : BOLT, { vy: -30, life: 0.6 });
    A.cd -= dt;
    if (A.cd <= 0) {
      const d = G.U.dist(A.x, A.y, tg.x, tg.y);
      const id = d < 210 && Math.random() < 0.6 ? 'nova' : (A.last === 'rain' ? 'cross' : 'rain');
      cast(id, tg);
    }
  }

  /** Herobrine's attacks: all telegraphed on the ground, each takes a % of your health. */
  function cast(id, tg) {
    A.last = id;
    const c = A.cast = { id, t: 0, wind: 0.7 };
    const H = (o) => G.Hazards.add(Object.assign({ type: null, pure: true, dmg: 1, color: BOLT }, o));
    if (id === 'rain') {
      // Lightning strikes on everyone (more the longer it lasts).
      const n = 4 + Math.min(6, Math.floor(arenaT / 10));
      for (const p of G.Game.everyone()) {
        if (p.dead) continue;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * 6.2832, d = i ? G.U.rand(40, 150) : 0;
          H({ kind: 'zone', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.8, r: 44, delay: 1.25 + i * 0.09, pct: 0.3, vis: 'pillar' });
        }
      }
      A.anim.play('Shoot', { speed: 0.9 });
    } else if (id === 'cross') {
      // Cross beams that sweep the arena.
      const a0 = Math.atan2(tg.y - A.y, tg.x - A.x) + (Math.random() < 0.5 ? 0 : Math.PI / 4);
      const n = arenaT > 30 ? 8 : 4;
      for (let i = 0; i < n; i++) H({ kind: 'beam', x: A.x, y: A.y, angle: a0 + i * 6.2832 / n, len: 1700, w: 34, delay: 1.1, pct: 0.35, color: '#e9f4ff' });
      c.wind = 1.1;
      A.anim.play('Charge', { speed: 0.9 });
    } else {
      // Shockwave around him (if you get too close).
      H({ kind: 'zone', x: A.x, y: A.y, r: 170, delay: 0.85, pct: 0.4, color: PORTAL });
      c.wind = 0.85;
      A.anim.play('Charge', { speed: 1.2 });
    }
    G.FX.ring(A.x, A.y, A.r, A.r * 3, id === 'nova' ? PORTAL : BOLT, c.wind, 3);
  }

  function castTick(dt, tg) {
    const c = A.cast;
    c.t += dt;
    if (tg) A.anim.dir = G.Sprites.dirFromAngle(Math.atan2(tg.y - A.y, tg.x - A.x));
    if (c.t >= c.wind && !c.done) {
      c.done = true;
      A.anim.play(c.id === 'nova' ? 'Attack' : 'Shoot', { speed: 1.2 });
    }
    if (c.t >= c.wind + 0.35) {
      A.cast = null;
      A.cd = Math.max(1.4, 3.2 - arenaT * 0.025);
    }
  }

  /** Guest: Herobrine goes where the host says. */
  function netTick(dt) {
    const n = A.net;
    if (!n) return;
    const ox = A.x, oy = A.y;
    if (G.U.dist2(A.x, A.y, n.x, n.y) > 300 * 300) { A.x = n.x; A.y = n.y; }
    else { A.x = G.U.damp(A.x, n.x, 10, dt); A.y = G.U.damp(A.y, n.y, 10, dt); }
    A.anim.dir = n.dir;
    if (n.anim !== A.lastNetAnim) {
      A.lastNetAnim = n.anim;
      const a = G.Coop.ANIMS[n.anim];
      if (a === 'Charge' || a === 'Shoot' || a === 'Attack') A.anim.play(a);
    }
    A.anim.loop(Math.abs(A.x - ox) + Math.abs(A.y - oy) > 0.5 ? 'Walk' : 'Idle');
  }

  /** Touching Herobrine (each computer checks its own player). */
  function touch(pl) {
    if (!pl || pl.dead || A.touchCd > 0) return;
    const rr = A.r + pl.r;
    if (G.U.dist2(A.x, A.y, pl.x, pl.y) > rr * rr) return;
    A.touchCd = 0.9;
    pl.invuln = 0;
    pl.hurt(pl.maxHp * TOUCH, null, true);
    G.Camera.kick(0.6);
    G.FX.ring(pl.x, pl.y, 6, 70, BOLT, 0.4, 4);
    if (authority()) A.anim.play('Attack', { speed: 1.4 });
  }

  // ---------------- boss mobs ----------------

  function spawnBoss() {
    const dex = cfg.q[bossN % cfg.q.length];
    const mon = G.DEX_BY[dex];
    if (!mon) return;
    const t = G.Game.st.time, pl = target() || G.Game.player;
    // On free ground around the hunted player, just out of reach.
    let x = pl.x + 480, y = pl.y;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(440, 600);
      x = pl.x + Math.cos(a) * d; y = pl.y + Math.sin(a) * d * 0.8;
      if (G.World.isFree(x, y, 30) && G.Game.everyone().every(p => G.U.dist2(p.x, p.y, x, y) > 280 * 280)) break;
    }
    const k = Math.pow(HP_GROWTH, bossN), kd = Math.pow(DMG_GROWTH, bossN);
    const def = {
      dex, name: mon.name,
      hp: Math.round(base * k),
      spd: Math.round(G.U.clamp(48 + (mon.spd - 78) * 0.6, 48, 105)),
      dmg: Math.round((36 + t / 20) * kd), xp: Math.round(500 + t * 1.2),
      behavior: mon.types.some(x => ['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon'].includes(x)) ? 'ranged' : 'charger',
      shotDmg: Math.round((18 + t / 40) * kd), shotCd: 0.9, range: 300
    };
    const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 }, true);
    e.judge = true;
    e.flying = false;
    G.EnemyMgr.add(e);
    bossN++;
    G.Sprites.preload([cfg.q[(bossN + 4) % cfg.q.length]], 8000);
    G.FX.ring(x, y, 8, 120, PORTAL, 0.6, 5);
    G.FX.burst(x, y - 30, '#e9d2ff', 24, 200);
    G.Spawner.say('The ' + e.name + ' joins the hunt!', 1.8);
    G.Audio.sfx('rift');
  }

  /** Boss mobs hunting right now. */
  function alive() { let n = 0; for (const e of G.EnemyMgr.all()) if (e.judge && !e.dead) n++; return n; }

  // ---------------- the Aether portal: Herobrine fades ----------------

  let fade = null;                    // { t } while he roars and fades (you stepped into the Aether portal)
  /**
   * You stepped into the Aether portal (floors.js, under the white-gold flash): Herobrine roars and fades,
   * his boss mobs vanish in light. → the fight's summary ({ time, bosses }) for the run summary.
   */
  function ascend() {
    const sum = phase === 'fight' ? { time: arenaT, bosses: downs } : null;
    if (A && !fade) {
      fade = { t: 0 };
      G.Audio.sfx('roar');
      G.FX.ring(A.x, A.y, 10, 260, '#fff4c8', 0.9, 6);
    }
    for (const e of G.EnemyMgr.all()) if (e.judge && !e.dead) {
      G.FX.burst(e.x, e.y - 20, '#fff4c8', 24, 200);
      e.dead = true; e.hidden = true;
    }
    G.Hazards.clear();
    return sum;
  }

  /** A boss mob in the arena fell (on every computer). */
  function bossDown() { if (phase === 'fight') downs++; }

  // ---------------- drawing ----------------

  /** Herobrine, sorted by Y with the rest of the scene. */
  function drawable() {
    if (!A || !ported) return null;
    return { y: A.y, draw: drawHerobrine };
  }

  function drawHerobrine(ctx) {
    const lift = A.lift;
    const now = performance.now() / 1000;
    if (fade) {
      // Fading into white-gold light as you step into the Aether portal.
      fade.t += 1 / 60;
      ctx.save();
      ctx.globalAlpha = G.U.clamp(1 - fade.t / 0.8, 0, 1);
      A.anim.draw(ctx, A.x, A.y - fade.t * 30);
      ctx.restore();
      return;
    }
    // Shadow that grows as he comes down.
    const near = G.U.clamp(1 - lift / 900, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.15 + near * 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(A.x, A.y, 44 * (0.4 + near * 0.6), 16 * (0.4 + near * 0.6), 0, 0, 6.2832); ctx.fill();
    // Dark pool of smoke on the ground, with a purple portal glow at its rim.
    if (lift < 40) {
      ctx.globalAlpha = 0.5 + Math.sin(now * 3) * 0.08;
      const g = ctx.createRadialGradient(A.x, A.y, 0, A.x, A.y, A.r * 2.4);
      g.addColorStop(0, 'rgba(10,6,16,0.9)'); g.addColorStop(0.7, 'rgba(40,14,70,0.45)'); g.addColorStop(1, 'rgba(162,75,255,0)');
      ctx.translate(A.x, A.y); ctx.scale(1, 0.36);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, A.r * 2.4, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
    // The obsidian portal ring behind him.
    portalRing(ctx, A.x, A.y - lift - A.bodyH * 0.55, A.bodyH * 0.62, A.spin * 0.6, 0.6, now);
    A.anim.draw(ctx, A.x, A.y - lift);
    eyes(ctx, A.anim, A.x, A.y - lift, now);
  }

  /** Glowing white eyes over the sprite (only when he faces the camera). */
  function eyes(ctx, anim, x, feetY, now, alpha = 1) {
    const d = anim.dir;
    if (d !== 0 && d !== 1 && d !== 7) return;
    const k = G.Sprites.PX * anim.scale;
    // Herobrine's sheets: eyes 19 texels above the feet, 2 texels either side of the centre.
    const ey = feetY - 19 * k, shift = d === 1 ? 1 : d === 7 ? -1 : 0;
    const pulse = 0.75 + Math.sin(now * 5) * 0.25;
    ctx.save();
    ctx.globalAlpha = alpha * pulse;
    ctx.shadowColor = '#bfe6ff'; ctx.shadowBlur = 6 * k;
    ctx.fillStyle = EYE;
    for (const ex of [-2, 2]) ctx.fillRect(Math.round(x + (ex + shift - 0.5) * k), Math.round(ey - 0.5 * k), Math.ceil(1.6 * k), Math.ceil(k));
    ctx.restore();
  }

  /** Obsidian Nether-portal ring: 16 obsidian blocks around a swirling purple portal, with sparks. */
  function portalRing(ctx, x, y, R, rot, alpha, now = performance.now() / 1000) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    // Portal surface: a purple disk that swirls.
    const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 0.92);
    g.addColorStop(0, 'rgba(40,6,70,0.2)'); g.addColorStop(0.6, 'rgba(120,40,220,0.45)'); g.addColorStop(1, 'rgba(190,110,255,0.75)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.92, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(224,180,255,0.55)';
    ctx.lineWidth = Math.max(1, R * 0.03);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(0, 0, R * (0.3 + i * 0.2), rot * (1.6 - i * 0.4) + i * 2.1, rot * (1.6 - i * 0.4) + i * 2.1 + 2.4); ctx.stroke();
    }
    // Obsidian blocks (kept axis-aligned so they read as pixel blocks).
    const N = 16, B = R * 0.24;
    for (let i = 0; i < N; i++) {
      const a = rot * 0.35 + i * 6.2832 / N;
      const bx = Math.round(Math.cos(a) * R - B / 2), by = Math.round(Math.sin(a) * R - B / 2);
      ctx.fillStyle = '#140c1e'; ctx.fillRect(bx, by, B, B);
      ctx.fillStyle = '#3b2457'; ctx.fillRect(bx, by, B, Math.max(1, B * 0.18)); ctx.fillRect(bx, by, Math.max(1, B * 0.18), B);
      ctx.fillStyle = '#5b3a86'; ctx.fillRect(bx + B * 0.55, by + B * 0.4, B * 0.2, B * 0.2);
    }
    // Lightning crackling between blocks.
    ctx.strokeStyle = BOLT; ctx.lineWidth = Math.max(1, R * 0.025);
    ctx.shadowColor = '#bfe6ff'; ctx.shadowBlur = R * 0.15;
    const seed = Math.floor(now * 12);
    for (let j = 0; j < 2; j++) {
      const i0 = (seed * 7 + j * 5) % N, a0 = rot * 0.35 + i0 * 6.2832 / N, a1 = a0 + 6.2832 / N * 2;
      ctx.beginPath();
      for (let s2 = 0; s2 <= 5; s2++) {
        const aa = a0 + (a1 - a0) * s2 / 5, rr = R * (1 + (s2 % 2 ? 0.12 : -0.05) * (((seed + s2 + j) % 3) - 1));
        if (s2) ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); else ctx.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A jagged lightning bolt from (x, y0) down to (x, y1). */
  function bolt(ctx, x, y0, y1, spread, seed) {
    const n = 12;
    let h = seed * 9301 + 49297;
    const rnd = () => { h = (h * 9301 + 49297) % 233280; return h / 233280 - 0.5; };
    ctx.beginPath(); ctx.moveTo(x + rnd() * spread, y0);
    for (let i = 1; i <= n; i++) ctx.lineTo(x + (i === n ? 0 : rnd() * spread), y0 + (y1 - y0) * i / n);
    ctx.stroke();
  }

  /** Above everything (in the world): the lightning strike he comes down through. */
  function drawAir(ctx) {
    if (!A || !ported) return;
    const cam = G.Camera;
    let a = 0;
    if (phase === 'cine') a = G.U.clamp((ct - T_PORT) / 0.6, 0, 1) * G.U.clamp((T_LAND + 0.6 - ct) / 0.6, 0, 1);
    if (a <= 0) return;
    const top = cam.top() - 40, bot = A.y + 6;
    const near = G.U.clamp(1 - A.lift / 900, 0, 1);
    const w = 40 + near * 40 + Math.sin(ct * 9) * 6;
    ctx.save();
    // Dark column of storm light behind the bolts.
    const g = ctx.createLinearGradient(A.x - w, 0, A.x + w, 0);
    g.addColorStop(0, 'rgba(60,30,110,0)');
    g.addColorStop(0.5, 'rgba(150,190,255,0.35)');
    g.addColorStop(1, 'rgba(60,30,110,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(A.x - w, top, w * 2, Math.max(0, bot - top));
    // Flickering bolts (they change shape a few times a second).
    const seed = Math.floor(ct * 14);
    ctx.lineJoin = 'miter';
    ctx.shadowColor = '#bfe6ff'; ctx.shadowBlur = 18;
    ctx.globalAlpha = a * (seed % 3 ? 0.95 : 0.6);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
    bolt(ctx, A.x, top, bot, w * 0.9, seed);
    ctx.strokeStyle = BOLT; ctx.lineWidth = 2;
    bolt(ctx, A.x, top, bot, w * 1.3, seed + 17);
    ctx.shadowBlur = 0;
    // Glow on the ground where he will land.
    ctx.globalAlpha = a * (0.35 + near * 0.55);
    ctx.translate(A.x, A.y); ctx.scale(1, 0.36);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.5);
    rg.addColorStop(0, 'rgba(230,244,255,0.9)'); rg.addColorStop(0.5, 'rgba(162,75,255,0.35)'); rg.addColorStop(1, 'rgba(162,75,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, w * 1.5, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  const F = (wt, s) => `${wt} ${s}px Pixelify,"Segoe UI",system-ui,sans-serif`;

  /** En pantalla: la animación, o el aviso de la pelea. */
  function drawOverlay(ctx, w, h) {
    if (phase === 'cine') drawCine(ctx, w, h);
    else if (phase === 'fight') drawFight(ctx, w, h);
  }

  function drawCine(ctx, w, h) {
    const t = ct;
    G.Touch.clearButtons();             // (the HUD is not drawn during the cinematic)
    ctx.save();
    // Everything goes dark (until the travel).
    if (t < T_PORT + 0.1) {
      ctx.fillStyle = `rgba(4,2,8,${(G.U.clamp(t / 1.1, 0, 1) * 0.9).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
    // "HEROBRINE / HAS AWAKENED"
    const a = G.U.clamp((t - T_TITLE + 0.3) / 0.5, 0, 1) * G.U.clamp((T_FLASH + 0.2 - t) / 0.35, 0, 1);
    if (a > 0) {
      const cx = w / 2, cy = h * 0.34, R = Math.min(w, h) * 0.24;
      // Lightning flashes now and then (a quick white sheet and a bolt across the sky).
      const seed = Math.floor(t * 9);
      if (seed % 7 === 0 || seed % 11 === 3) {
        ctx.save();
        ctx.globalAlpha = a * 0.12;
        ctx.fillStyle = '#dfeeff'; ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
        ctx.shadowColor = '#bfe6ff'; ctx.shadowBlur = 20;
        bolt(ctx, (seed * 97) % w, 0, h * 0.6, 90, seed);
        ctx.restore();
      }
      // Dark smoke curling around the ring.
      ctx.save();
      for (let i = 0; i < 14; i++) {
        const ang = t * 0.25 + i * 0.45, rr = R * (1.25 + 0.15 * Math.sin(t * 1.3 + i));
        ctx.globalAlpha = a * 0.35;
        ctx.fillStyle = i % 3 ? '#0b0910' : '#21162e';
        ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.8, R * (0.22 + 0.06 * Math.sin(t * 2 + i)), 0, 6.2832); ctx.fill();
      }
      ctx.restore();
      // Herobrine as a dark silhouette with glowing eyes, inside the portal ring.
      portalRing(ctx, cx, cy - R * 0.05, R, t * 0.35, a * 0.95, t);
      const idle = G.Sprites.sheet(HEROBRINE, 'Idle');
      if (cineAnim && idle && idle.ready) {
        // The silhouette fills the ring (in steps of 0.5: whole pixels).
        const body = (G.Sprites.animMeta(HEROBRINE, 'Idle').ay || 30) * G.Sprites.PX;
        cineAnim.scale = Math.max(1, Math.round(R * 1.7 / body * 2) / 2);
        const rise = (1 - G.U.clamp((t - T_TITLE + 0.3) / 0.8, 0, 1)) * R * 0.3;
        const feet = cy + body * cineAnim.scale * 0.5 + rise;
        ctx.save();
        ctx.globalAlpha = a * 0.92;
        ctx.filter = 'brightness(0.08)';
        ctx.shadowColor = PORTAL; ctx.shadowBlur = 30;
        cineAnim.draw(ctx, cx, feet);
        ctx.restore();
        eyes(ctx, cineAnim, cx, feet, t, a);
      }
      // The title, letter by letter, under the ring.
      const size = Math.round(G.U.clamp(Math.min(w / 13, h / 9), 24, 64));
      const ty = cy + R + size * 1.15;
      title(ctx, 'HEROBRINE', cx, ty, size, T_TITLE, a);
      title(ctx, 'HAS AWAKENED', cx, ty + size * 0.95, Math.round(size * 0.8), T_TITLE + 0.75, a);
      ctx.globalAlpha = a * G.U.clamp((t - T_TITLE - 1.6) / 0.6, 0, 1);
      ctx.font = F(700, Math.round(size * 0.32));
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c9d6e6';
      ctx.fillText('Your time is up…', cx, ty + size * 1.7);
    }
    // Black cinema bars during the descent.
    if (t > T_PORT) {
      const k = G.U.clamp((t - T_PORT) / 0.5, 0, 1) * G.U.clamp((T_END - t) / 0.6, 0, 1);
      const bh = Math.round(h * 0.11 * k);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh);
    }
    // He is here!
    const b = G.U.clamp((t - T_LAND - 0.15) / 0.3, 0, 1) * G.U.clamp((T_END - t) / 0.5, 0, 1);
    if (b > 0) {
      const size = Math.round(G.U.clamp(w / 20, 20, 40));
      const pop = 1 + (1 - G.U.clamp((t - T_LAND - 0.15) / 0.25, 0, 1)) * 0.6;
      ctx.save();
      ctx.globalAlpha = b;
      ctx.translate(w / 2, h * 0.24);
      ctx.scale(pop, pop);
      glowText(ctx, 'HEROBRINE AWAKENS', 0, 0, size);
      ctx.restore();
      ctx.globalAlpha = b;
      ctx.font = F(700, Math.round(size * 0.45));
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      const sub = 'He cannot be beaten: survive ' + G.U.mmss((G.Floors.def && G.Floors.def.surviveFor) || 150) + ' and the Aether opens';
      ctx.strokeText(sub, w / 2, h * 0.24 + size * 1.1);
      ctx.fillStyle = '#dbe9f7';
      ctx.fillText(sub, w / 2, h * 0.24 + size * 1.1);
    }
    if (canSkip && t < T_BACK) {
      ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.2;
      ctx.font = F(700, 11);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#c9d6e6';
      ctx.fillText(G.Touch.active ? 'Tap the screen to skip' : 'Press Space to skip', w - 16, h - 14);
      // The whole screen is a button (touch and mouse).
      G.Touch.addButton(0, 0, w, h, skip, 0);
    }
    ctx.restore();
  }

  /** White text with a dark outline and a cold lightning glow. */
  function glowText(ctx, s, x, y, size) {
    ctx.font = F(800, size);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * 0.16);
    ctx.strokeStyle = '#07040c';
    ctx.strokeText(s, x, y);
    const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.1);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#d7ecff'); g.addColorStop(1, '#8f7bd6');
    ctx.shadowColor = '#bfe6ff'; ctx.shadowBlur = size * 0.4;
    ctx.fillStyle = g;
    ctx.fillText(s, x, y);
    ctx.shadowBlur = 0;
  }

  /** Title that appears letter by letter (each one drops and settles). */
  function title(ctx, raw, cx, y, size, t0, alpha) {
    const s = G.I18n ? G.I18n.t(raw) : raw;
    ctx.save();
    ctx.font = F(800, size);
    const total = ctx.measureText(s).width;
    let x = cx - total / 2;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const cw = ctx.measureText(ch).width;
      const p = G.U.clamp((ct - t0 - i * 0.055) / 0.28, 0, 1);
      if (p > 0 && ch !== ' ') {
        const k = 1 + (1 - p) * 1.8;
        ctx.save();
        ctx.globalAlpha = alpha * p;
        ctx.translate(x + cw / 2, y);
        ctx.scale(k, k);
        glowText(ctx, ch, 0, 0, size);
        ctx.restore();
      }
      ctx.font = F(800, size);
      x += cw;
    }
    ctx.restore();
  }

  /** Fight: dark storm vignette, ash, an arrow to Herobrine and the counter. */
  function drawFight(ctx, w, h) {
    ctx.save();
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(20,8,40,0)');
    g.addColorStop(1, 'rgba(20,8,40,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (const e of embers) {
      ctx.globalAlpha = Math.min(1, e.life) * e.a;
      ctx.fillStyle = e.c;
      ctx.fillRect(Math.round(e.x), Math.round(e.y), e.s, e.s);
    }
    ctx.globalAlpha = 1;
    // Counter under the clock: the countdown to the Aether portal (floors.js), then where it is.
    const boss = G.EnemyMgr.all().some(e => e.boss && !e.dead);
    const ae = G.Floors.aether, y0 = boss ? 98 : 76;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)';
    let txt, col = GOLD;
    if (!ae || ae.left > 0) txt = 'SURVIVE ' + G.U.mmss(ae ? ae.left : 0) + ' · THE AETHER AWAITS';
    else if (!ae.ready) txt = 'A GLOWSTONE PORTAL IS RISING…';
    else {
      const pl = G.Game.player;
      txt = 'THE AETHER PORTAL IS OPEN · ' + Math.round(G.U.dist(pl.x, pl.y, ae.x, ae.y) / 32) + ' m';
      col = Math.sin(performance.now() / 160) > 0 ? '#fffbe6' : GOLD;
    }
    ctx.font = F(800, 14);
    ctx.strokeText(txt, w / 2, y0);
    ctx.fillStyle = col;
    ctx.fillText(txt, w / 2, y0);
    ctx.font = F(700, 10);
    const sub = 'HEROBRINE · ' + G.U.mmss(arenaT) + ' · BOSSES ' + downs;
    ctx.strokeText(sub, w / 2, y0 + 15);
    ctx.fillStyle = BOLT;
    ctx.fillText(sub, w / 2, y0 + 15);
    // Arrow towards Herobrine when he is off screen.
    const cam = G.Camera;
    const sx = (A.x - cam.left()) * cam.scale, sy = (A.y - A.bodyH * 0.5 - cam.top()) * cam.scale;
    if (sx < 0 || sx > w || sy < 0 || sy > h) {
      const M = 46, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
      const an = Math.atan2(sy - ey, sx - ex);
      const pl = G.Game.player;
      const beat = 0.5 + Math.sin(performance.now() / 120) * 0.5;
      ctx.translate(ex, ey);
      ctx.globalAlpha = 0.2 + beat * 0.25;
      ctx.fillStyle = PORTAL;
      ctx.beginPath(); ctx.arc(0, 0, 26 + beat * 6, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = beat > 0.5 ? EYE : BOLT;
      ctx.beginPath();
      ctx.moveTo(Math.cos(an) * 34, Math.sin(an) * 34);
      ctx.lineTo(Math.cos(an + 2.45) * 17, Math.sin(an + 2.45) * 17);
      ctx.lineTo(Math.cos(an - 2.45) * 17, Math.sin(an - 2.45) * 17);
      ctx.closePath(); ctx.fill();
      ctx.font = F(800, 11);
      ctx.textAlign = Math.cos(an) > 0.3 ? 'right' : Math.cos(an) < -0.3 ? 'left' : 'center';
      const lbl = 'HEROBRINE · ' + Math.round(G.U.dist(pl.x, pl.y, A.x, A.y) / 32) + ' m';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(lbl, -Math.cos(an) * 30, -Math.sin(an) * 26 + 4);
      ctx.fillStyle = BOLT;
      ctx.fillText(lbl, -Math.cos(an) * 30, -Math.sin(an) * 26 + 4);
    }
    ctx.restore();
  }

  /** Falling ash and lightning sparks (on screen). */
  function ember(dt) {
    const cv = document.getElementById('game');
    const w = cv ? cv.clientWidth : 800, h = cv ? cv.clientHeight : 600;
    if (embers.length < 70 && Math.random() < dt * 40) {
      const spark = Math.random() < 0.3;
      embers.push({ x: Math.random() * w, y: -6, vx: G.U.rand(-25, 10), vy: G.U.rand(20, 55), life: G.U.rand(5, 10),
                    s: spark ? 2 : 3, a: spark ? 0.9 : 0.5, c: spark ? '#cfeaff' : '#4a4352' });
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt;
      if (e.life <= 0 || e.y > h + 10) embers.splice(i, 1);
    }
  }

  // ---------------- network ----------------

  function onEvent(ev) {
    if (ev[0] === 'jd') begin(ev[1]);
    else if (ev[0] === 'jk') doSkip();
  }

  /** Host: where Herobrine is (sent in every packet). */
  function netState() {
    if (phase !== 'fight' || !A) return null;
    const a = G.Coop.ANIMS.indexOf(A.anim.cur);
    return [Math.round(A.x), Math.round(A.y), a < 0 ? 0 : a, A.anim.dir];
  }
  function netApply(a) {
    if (!A || phase !== 'fight') return;
    A.net = { x: a[0], y: a[1], anim: a[2], dir: a[3] };
  }

  return {
    HEROBRINE, BOSS_EVERY, HP_GROWTH, DMG_GROWTH, MAX_ALIVE,
    reset, noteDmg, update, cineTick, skip, bossDown, ascend, drawable, drawAir, drawOverlay, onEvent, netState, netApply,
    /** Where Herobrine stands ({ x, y }), or null (floors.js builds the Aether portal away from him). */
    get herobrine() { return A && !fade ? { x: A.x, y: A.y } : null; },
    /** Boss mobs hunting right now (at most MAX_ALIVE). */
    get bossesAlive() { return phase ? alive() : 0; },
    get active() { return !!phase; },
    get cinematic() { return phase === 'cine'; },
    /** What plays: silence in the cinematic until he lands. */
    get music() { return phase === 'cine' && ct < T_LAND ? null : 'herobrine'; },
    /** For the run summary: { time, bosses } or null. */
    summary() { return phase === 'fight' ? { time: arenaT, bosses: downs } : null; },
    /** Your single-target damage per second (best seconds of the last 30 s). */
    get dps() { return singleDps(); },
    /** For tests: first boss mob's health and the measured damage. */
    get debug() { return { base, single: singleDps(), samples: samples.length }; },
    /** Herobrine's World (floors.js): Herobrine awakens now. */
    awaken() { if (!phase && authority()) start(); },
    debugStart() { if (!phase && authority()) start(); }
  };
})();
