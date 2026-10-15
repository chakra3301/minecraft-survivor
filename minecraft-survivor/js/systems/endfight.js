/* ============ endfight.js — The End: End Crystals and the invincible Ender Dragon ============
 *
 * Like the real game, End Crystals stand on top of the obsidian towers (G.World.towers:
 * [{ x, y, top: { x, y } }]; a ring of fallback towers if the world has none). While any of
 * them stands:
 *   - the Ender Dragon takes no damage (bosskits.js asks shielded()), shows a shield shimmer and
 *     "INVULNERABLE · Destroy the End Crystals (n left)" on its boss bar (hud.js);
 *   - each crystal's beam heals it 1.5% of its max health per second.
 * A crystal is a G.Enemy that never moves or attacks, so your skills target and hit it like any
 * mob. Its feet sit on free ground at the foot of its tower; it is drawn on the tower top. It has
 * little health (about 1.6 s of your single-target damage, see judgment.js). Breaking one sets
 * off an explosion that hurts you if you stand close, and the mobs around it.
 *
 * Crystals never count as kills (missions, achievements, "defeated"): a broken crystal is taken
 * out of the enemy list before EnemyMgr.update would count it (preUpdate, from game.js). If the
 * straggler logic moves or drops one, update() puts it back on its tower.
 *
 * Co-op: the host runs the crystals. Guests get copies of them as crystals (addRemote, from the
 * 'ne' event with the tower top), so they see the crystals, the beams, the dragon's shield and the
 * count; their hits go to the host like any hit, and a broken copy only shows its explosion (the
 * host sends the blast itself as a hazard).
 */
G.EndFight = (() => {
  const HEAL = 0.015;                 // dragon health healed per crystal per second
  const BLAST_R = 120, BLAST_PCT = 0.25;
  const PINK = '#ff7bd8', GLASS = '#e9c6ff';
  let crystals = [];                  // every crystal of this visit, broken ones included
  let made = false, immuneT = 0, hitGlow = 0, announced = false;
  const bedrock = new Image();
  bedrock.src = 'assets/mc/blocks/bedrock.png';

  // ---------------- the crystal ----------------

  class Crystal extends G.Enemy {
    constructor(tower, hp) {
      const host = G.Enemies.mob('endermite') || G.Enemies.mob('enderman') || G.DEX[0];
      super({ dex: host.dex, name: 'End Crystal', hp, spd: 0, dmg: 0, xp: 0, behavior: 'crystal' }, tower.foot.x, tower.foot.y, { hp: 1, spd: 1, dmg: 1 });
      this.crystal = true;
      this.name = 'End Crystal';
      this.types = ['normal']; this.atkType = 'normal';
      this.flying = true;
      this.home = tower.foot; this.top = tower.top;
      this.r = 24;
      this.bodyH = Math.max(40, this.home.y - this.top.y + 34);
      this.spin = Math.random() * 6.28;
    }
    applyBurn() {} applyPoison() {} applySlow() {}
    /** A guest's copy (coop.js): it only spins and flashes; the host says when it breaks. */
    netUpdate(dt) {
      this.spin += dt;
      if (this.flash > 0) this.flash -= dt;
    }
    update(dt) {
      this.spin += dt;
      if (this.flash > 0) this.flash -= dt;
      this.x = this.home.x; this.y = this.home.y; this.kx = this.ky = 0;
      this.touchCd = 99; this.lagT = 0;           // never touches you, never wanders off as a straggler
    }
    strike() {}
    die() {
      if (this.dead) return;
      this.dead = true; this.broken = true;
      explode(this, !!this.remote);
    }
    draw(ctx) { if (!this.dead) drawCrystal(ctx, this); }
  }

  /** The towers: the world's, or a fallback ring around the central island. */
  function towers(def) {
    let list = (G.World.towers || []).filter(t => t && t.top);
    if (!list.length) {
      const n = def.crystals || 8;
      list = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.2832 + 0.3, R = i % 2 ? 560 : 760;
        const x = Math.cos(a) * R, y = Math.sin(a) * R * 0.8;
        list.push({ x, y, top: { x, y: y - 96 } });
      }
    }
    // The crystal's feet: free ground at the foot of the tower (just in front of it).
    return list.map(t => {
      let foot = { x: t.x, y: t.y + 20 };
      for (let i = 0; i < 40; i++) {
        const d = i * 9, a = Math.PI / 2 + (i % 2 ? 1 : -1) * Math.floor(i / 2) * 0.35;
        const x = t.x + Math.cos(a) * d, y = t.y + 20 + Math.sin(a) * d;
        if (G.World.isFree(x, y, 14)) { foot = { x, y }; break; }
      }
      return { foot, top: { x: t.top.x, y: t.top.y } };
    });
  }

  /** Places the crystals (once per visit; waits a moment for the world's towers). */
  function setup(def) {
    made = true;
    const hp = Math.round(Math.max(90, (G.Judgment.dps || 0) * 1.6));
    crystals = towers(def).map(t => G.EnemyMgr.add(new Crystal(t, hp)));
  }

  function reset() { crystals = []; made = false; immuneT = 0; hitGlow = 0; announced = false; }

  const alive = () => crystals.filter(c => !c.broken);
  const dragon = () => G.EnemyMgr.all().find(e => e.floorBoss && !e.dead && G.BossKits.keyOf(e) === 'ender_dragon');

  /** Before EnemyMgr.update: broken crystals leave the list before they could count as kills. */
  function preUpdate() {
    if (!crystals.length) return;
    const list = G.EnemyMgr.all();
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].crystal || !list[i].dead || list[i].remote) continue;
      // Co-op: the guests' copies break too (G.EnemyMgr.removeRemote never counts a crystal as a kill).
      if (G.Coop.isHost) G.Coop.enemyGone(list[i], true);
      list.splice(i, 1);
    }
  }

  /** Every frame in the End (floors.js). */
  function update(dt, pl, def) {
    if (immuneT > 0) immuneT -= dt;
    if (hitGlow > 0) hitGlow -= dt;
    if (!made) {
      if ((G.World.towers && G.World.towers.length) || G.Floors.dimTime > 1) setup(def);
      return;
    }
    preUpdate();
    const live = alive();
    // Put back any crystal the straggler logic dropped or moved.
    for (const c of live) {
      c.x = c.home.x; c.y = c.home.y;
      if (!G.EnemyMgr.get(c.id)) G.EnemyMgr.add(c);
    }
    const D = dragon();
    if (D && live.length) D.hp = Math.min(D.maxHp, D.hp + D.maxHp * HEAL * live.length * dt);
    if (!live.length && crystals.length && !announced) {
      announced = true;
      G.Spawner.say(D ? 'Every End Crystal is down: the dragon can be hurt!' : 'Every End Crystal is down!', 3.4);
      G.Audio.sfx('legend');
    }
  }

  /** The dragon can't be hurt while any crystal of this visit stands. */
  function shielded(e) {
    return !!e && crystals.length > 0 && !e.dead && G.BossKits.keyOf(e) === 'ender_dragon' && alive().length > 0;
  }

  /** A hit bounced off the dragon's shield (bosskits.js). */
  function blocked(e) {
    hitGlow = 0.25;
    if (immuneT > 0) return;
    immuneT = 0.5;
    G.FX.dmgText(e.x, e.y - e.bodyH - 6, 'IMMUNE', GLASS);
  }

  /** `look`: only the explosion (a guest's copy: the host sends the blast and the hurt mobs). */
  function explode(c, look = false) {
    const { x, y } = c.home, t = c.top;
    if (!look) {
      G.Hazards.add({ kind: 'zone', x, y, r: BLAST_R, delay: 0.3, dmg: 1, pct: BLAST_PCT, pure: true, color: PINK });
      for (const e of G.EnemyMgr.queryCircle(x, y, BLAST_R)) {
        if (e.dead || e.crystal || e.boss) continue;
        e.hurt(e.maxHp * 0.5 + 40, PINK, e.x - x, e.y - y, 200);
      }
    }
    G.FX.burst(t.x, t.y - 26, '#ffffff', 36, 320);
    G.FX.burst(t.x, t.y - 26, PINK, 30, 260);
    for (let i = 0; i < 3; i++) G.FX.ring(t.x, t.y - 20, 8 + i * 12, 90 + i * 50, i % 2 ? '#ffe0f6' : PINK, 0.4 + i * 0.15, 6 - i);
    G.FX.ring(x, y, 10, BLAST_R, '#ff9a4d', 0.5, 5);
    const pl = G.Game.player;
    if (pl && G.U.dist2(pl.x, pl.y, x, y) < 700 * 700) G.Camera.kick(1.0);
    G.Audio.sfx('break'); G.Audio.sfx('quake');
    const n = alive().length;
    if (n && !look) G.Spawner.say('End Crystal destroyed! ' + n + ' left', 2.2);
  }

  /** Guest: the host's crystal `o` ('ne'), standing at the foot of its tower with its top at `top` [x, y]. */
  function addRemote(o, top) {
    const T = { foot: { x: o.x, y: o.y }, top: top ? { x: top[0], y: top[1] } : { x: o.x, y: o.y - 96 } };
    const c = G.EnemyMgr.addRemote(o, () => new Crystal(T, o.hp));
    if (c && c.crystal && !crystals.includes(c)) crystals.push(c);
    return c;
  }

  // ---------------- drawing ----------------

  /** A cube of half-size s spinning around the vertical axis (angle a) and tilted (t), as projected edges. */
  function cube(ctx, cx, cy, s, a, t, stroke, fill) {
    const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(t), st = Math.sin(t);
    const V = [];
    for (let i = 0; i < 8; i++) {
      const X = (i & 1 ? 1 : -1) * s, Y = (i & 2 ? 1 : -1) * s, Z = (i & 4 ? 1 : -1) * s;
      const x1 = X * ca + Z * sa, z1 = -X * sa + Z * ca;
      V.push([cx + x1, cy + Y * ct - z1 * st]);
    }
    if (fill) {
      ctx.fillStyle = fill;
      for (const f of [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]) {
        ctx.beginPath(); f.forEach((k, j) => (j ? ctx.lineTo : ctx.moveTo).call(ctx, V[k][0], V[k][1])); ctx.closePath(); ctx.fill();
      }
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) for (const b of [1, 2, 4]) if (!(i & b)) { ctx.moveTo(V[i][0], V[i][1]); ctx.lineTo(V[i | b][0], V[i | b][1]); }
      ctx.stroke();
    }
  }

  /** Where the crystal floats (its beam starts there). */
  const coreOf = c => ({ x: c.top.x, y: c.top.y - 38 - Math.sin(c.spin * 2) * 4 });

  function drawCrystal(ctx, c) {
    const now = performance.now() / 1000, t = c.top, p = coreOf(c);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Bedrock block with a little fire on top of the tower.
    if (bedrock.complete && bedrock.naturalWidth) ctx.drawImage(bedrock, Math.round(t.x - 16), Math.round(t.y - 16), 32, 32);
    else { ctx.fillStyle = '#3a3a3a'; ctx.fillRect(Math.round(t.x - 16), Math.round(t.y - 16), 32, 32); }
    for (let i = 0; i < 5; i++) {
      const fh = 4 + ((Math.floor(now * 12) + i * 3) % 5) * 2;
      ctx.fillStyle = i % 2 ? '#ffb43a' : '#ff7a1a';
      ctx.fillRect(Math.round(t.x - 12 + i * 5), Math.round(t.y - 16 - fh), 4, fh);
    }
    // Glow.
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 44);
    g.addColorStop(0, 'rgba(255,170,240,0.75)'); g.addColorStop(1, 'rgba(200,100,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, 44, 0, 6.2832); ctx.fill();
    // Two glass cubes spinning around a pink core, like the real End Crystal.
    ctx.lineWidth = 2;
    cube(ctx, p.x, p.y, 18, c.spin * 1.6, 0.5, c.flash > 0 ? '#ffffff' : GLASS, 'rgba(200,120,255,0.10)');
    cube(ctx, p.x, p.y, 13, -c.spin * 2.2, -0.65, 'rgba(255,214,250,0.9)', 'rgba(255,140,230,0.12)');
    cube(ctx, p.x, p.y, 6.5, c.spin * 3, 0.8, '#ffffff', c.flash > 0 ? '#ffffff' : PINK);
    // Health, small, under the crystal.
    if (c.hp < c.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(Math.round(t.x - 18), Math.round(t.y + 20), 36, 4);
      ctx.fillStyle = PINK; ctx.fillRect(Math.round(t.x - 18), Math.round(t.y + 20), 36 * Math.max(0, c.hp / c.maxHp), 4);
    }
    ctx.restore();
    if (Math.random() < 0.15) G.FX.px(p.x + G.U.rand(-12, 12), p.y + G.U.rand(-12, 12), PINK, { vy: -20, life: 0.5 });
  }

  /** Over the scene (game.js): the healing beams and the dragon's shield. */
  function drawAir(ctx) {
    if (!crystals.length) return;
    const D = dragon();
    if (!D || D.hidden) return;
    const now = performance.now() / 1000;
    const tx = D.x, ty = D.y - D.bodyH * 0.55;
    const live = alive();
    ctx.save();
    ctx.lineCap = 'round';
    for (const c of live) {
      const p = coreOf(c);
      ctx.globalAlpha = 0.28 + Math.sin(now * 8 + c.id) * 0.08;
      ctx.strokeStyle = PINK; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -now * 120;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (live.length) {
      // Shield shimmer around the dragon (brighter for a moment when a hit bounces off).
      const rx = D.r * 1.8, ry = D.bodyH * 0.72, k = 1 + hitGlow * 2;
      ctx.globalAlpha = Math.min(1, (0.16 + Math.sin(now * 4) * 0.05) * k);
      const g = ctx.createRadialGradient(tx, ty, ry * 0.3, tx, ty, Math.max(rx, ry));
      g.addColorStop(0, 'rgba(255,140,230,0)'); g.addColorStop(1, 'rgba(230,180,255,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = Math.min(1, 0.7 * k);
      ctx.lineWidth = 2; ctx.strokeStyle = GLASS;
      for (let i = 0; i < 4; i++) {
        const a = now * (1.5 + i * 0.3) + i * 1.6;
        ctx.beginPath(); ctx.ellipse(tx, ty, rx * (0.9 + i * 0.04), ry * (0.9 + i * 0.04), 0, a, a + 0.9); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** The nearest standing crystal to (x, y), for the HUD arrow. */
  function nearest(x, y) {
    let best = null, bd = Infinity;
    for (const c of alive()) { const d = G.U.dist2(x, y, c.home.x, c.home.y); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  return {
    reset, preUpdate, update, shielded, blocked, drawAir, nearest, addRemote,
    get left() { return alive().length; }, get total() { return crystals.length; }, get crystals() { return crystals; },
    /** Tests / dev panel: breaks every crystal (each explodes as usual). */
    debugBreakAll() { for (const c of alive()) { c.hp = 0; c.die(); } return crystals.length; }
  };
})();
