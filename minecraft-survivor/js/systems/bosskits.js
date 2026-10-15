/* ============ bosskits.js — each boss fights with its real Minecraft attacks ============
 * A kit replaces the generic boss AI (entities/enemy.js bossMove) for one mob: how it moves (keep:
 * the distance it likes, 0 = in your face), its moves, and optional passives / damage rules.
 * Floor bosses, mid-bosses and Trial Chamber bosses all use them; any other mob spawned as a boss
 * (dev panel) keeps the generic kit. Herobrine has his own system (judgment.js).
 * Kits are keyed by mob key but only ever apply to a BOSS (e.boss): a normal drowned keeps its
 * trident shots, only the Ocean's mid-boss (the Drowned Captain) fights with the drowned kit.
 *
 * A move: { range: [min, max] distance, cd: [a, b] cooldown after it, w weight, fury: only when
 * enraged, omen: only for an ominous boss (e.ominous, the Ominous Trial), once: seconds before it
 * can repeat, start(e, pl, c, s), tick(e, dt, pl, c, s) }. Ominous bosses also recover faster.
 * tick returns [vx, vy, anim] while it runs, or true when done; without tick a move lasts `c.dur`.
 * Everything that hurts is telegraphed on the ground (G.Hazards) or is a dodgeable projectile.
 *
 * Status effects land on the player through pl.addEffect (entities/player.js):
 *   wither, levitation, fatigue (Mining Fatigue), darkness, slow; knockback through pl.pushBy.
 *
 * Co-op (on the host): a kit fights the living player nearest to the boss (EnemyMgr.update passes it as
 * `pl`; e.kitTarget remembers it). Telegraphs reach the guests as 'hz' (tracking ones are re-sent while
 * they aim: `track`), shots as 'es', and effects applied to a guest's copy are forwarded to that guest
 * (Player.addEffect / pushBy). An onHit wrapped in net() also runs on the guests' copies.
 */
G.BossKits = (() => {
  const keyOf = e => (G.DEX_BY[e.dex] || {}).key;
  const rand = (a, b) => a + Math.random() * (b - a);
  const angTo = (e, pl) => Math.atan2(pl.y - e.y, pl.x - e.x);
  const near = (x, y) => G.Camera.sees(x, y, 120);
  /**
   * Co-op: an onHit that the host can send to the guests (their copy of the telegraph or shot runs it on
   * their own player: G.Coop.hitFx). ops: ['k', x, y, power] a shove away from (x, y) · ['e', name, dur, o].
   * The local onHit stays exactly as written.
   */
  const net = (fn, ...ops) => { fn.net = ops.map(o => (o[0] === 'k' ? ['k', Math.round(o[1]), Math.round(o[2]), o[3]] : o)); return fn; };
  const kb = (x, y, power) => ['k', x, y, power];
  const ef = (name, dur, o) => (o ? ['e', name, dur, o] : ['e', name, dur]);
  const effect = (name, dur, o) => net(p => p.addEffect(name, dur, o), ef(name, dur, o));

  // ---------------- helpers ----------------
  function zone(e, x, y, r, delay, dmg, color, o = {}) {
    return G.Hazards.add(Object.assign({ kind: 'zone', x, y, r, delay, dmg, type: e.atkType, color }, o));
  }
  function beam(e, ang, len, w, delay, dmg, color, o = {}) {
    return G.Hazards.add(Object.assign({ kind: 'beam', x: e.x, y: e.y, angle: ang, len, w, delay, dmg, type: e.atkType, color }, o));
  }
  /** Enemy projectile with a Minecraft look. o: sp, dmg, r, life, shape, pal, homing, scale, onHit, onEnd, from[x,y] */
  function shot(e, ang, o) {
    const sp = o.sp || 220, [x, y] = o.from || [e.x, e.y];
    const p = G.Projectiles.spawn({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, dmg: o.dmg, r: o.r || 8, life: o.life || 3,
      friendly: false, color: o.color || '#ff7a9e', mtype: e.atkType, homing: o.homing || 0, scale: o.scale,
      vis: { proj: o.shape || 'ball', pal: o.pal || 'normal', trail: o.trail }, onHit: o.onHit, onEnd: o.onEnd
    });
    // Co-op: homing shots hunt the boss's target, and the guests get a copy of every shot.
    if (G.Coop.isHost) {
      if (p.homing && e.kitTarget) p.target = e.kitTarget;
      G.Coop.enemyShot(p, e.atkType);
    }
    return p;
  }
  function knock(pl, fx, fy, power) {
    const [nx, ny] = G.U.norm(pl.x - fx, pl.y - fy);
    pl.pushBy(nx * power, ny * power);
  }
  function blink(e, x, y, col = '#c070ff') {
    G.FX.burst(e.x, e.y - e.bodyH * 0.5, col, 16, 140);
    e.x = x; e.y = y;
    G.FX.burst(e.x, e.y - e.bodyH * 0.5, col, 16, 140);
    if (near(e.x, e.y)) G.Audio.sfx('rift');
  }
  /** Minions of a mob key around the boss (capped per boss). */
  function summon(e, key, n, s, max = 6) {
    s.minions = (s.minions || []).filter(m => !m.dead && G.EnemyMgr.get(m.id));
    const p = G.Enemies.mob(key);
    if (!p || G.EnemyMgr.count > G.Spawner.CAP + 15) return;
    const t = G.Game.st.time, ti = G.Enemies.tierAt(t);
    for (let i = 0; i < n && s.minions.length < max; i++) {
      const a = Math.random() * 6.2832;
      const m = new G.Enemy(G.Enemies.defFor(p, G.Enemies.TIERS[ti], ti), e.x + Math.cos(a) * 46, e.y + Math.sin(a) * 34,
        e.sc || G.Enemies.scale(t));
      G.EnemyMgr.add(m);
      s.minions.push(m);
      G.FX.burst(m.x, m.y - 10, '#c47bff', 10, 100);
    }
  }
  /** Telegraphed charge along a line, then the dash itself. */
  function dashStart(e, pl, c, len, wind, dmg, col, onHit) {
    c.ang = angTo(e, pl); c.wind = wind; c.len = len; c.dash = 0.32;
    beam(e, c.ang, len + e.r, e.r * 2 + 18, wind + c.dash, dmg, col, { onHit });
    e.anim.play('Charge', { speed: 1.3 });
  }
  function dashTick(e, dt, pl, c) {
    if (c.t < c.wind) return [0, 0, 'Idle'];
    if (!c.go) { c.go = true; e.anim.play('Attack', { speed: 1.6 }); }
    if (c.t >= c.wind + c.dash) return true;
    const sp = c.len / c.dash;
    return [Math.cos(c.ang) * sp, Math.sin(c.ang) * sp, 'Walk'];
  }
  /** A hit in front of the boss (sweep / bite / slash). */
  function front(e, pl, dist, r, delay, dmg, col, o) {
    const a = angTo(e, pl), d = Math.min(dist, e.r + r * 0.6);
    return zone(e, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, r, delay, dmg, col, o);
  }
  const M = e => e.dmg, R = e => e.shotDmg();

  // ---------------- kits ----------------
  const KITS = {
    // ===== The Warden (floor boss, Ancient City): smash, Sonic Boom, Darkness, digs under you =====
    warden: {
      keep: 0, cd: [1.1, 1.7], fury: 'The Warden is enraged!',
      hurtMod(e, a) { return e.hidden ? 0 : a; },          // underground: nothing reaches it
      init(e, pl, s) {
        // Summoned by the shriekers (floors.js): it digs its way up first.
        if (!e.emerge) return;
        e.emerge = false;
        const m = KITS.warden.moves.emerge, c = s.cast = { id: 'emerge', m, t: 0, dur: 0.6 };
        m.start(e, pl, c, s);
      },
      moves: {
        emerge: { range: [-2, -1], w: 0, start(e, pl, c) {
          // Never picked at random (no distance fits): only as the Warden's entrance.
          c.dur = 2.6; e.hidden = true;
          zone(e, e.x, e.y, 96, 1.9, M(e) * 1.2, '#1fb6c4', { onHit: net(p => knock(p, e.x, e.y, 460), kb(e.x, e.y, 460)) });
        }, tick(e, dt, pl, c) {
          if (e.hidden && Math.random() < dt * 30) G.FX.burst(e.x + rand(-30, 30), e.y, Math.random() < 0.5 ? '#0d2b33' : '#3a3a34', 3, 90);
          if (c.t >= 1.9 && e.hidden) {
            e.hidden = false;
            e.anim.play('Attack', { speed: 0.8 });
            G.Camera.kick(1.0);
            G.FX.burst(e.x, e.y - 10, '#2a2a26', 40, 260);
            for (let i = 0; i < 3; i++) G.FX.ring(e.x, e.y, 10 + i * 16, 140 + i * 70, i % 2 ? '#0d2b33' : '#5ef0ff', 0.5 + i * 0.2, 6 - i);
            G.Audio.sfx('land');
          }
          return c.t >= c.dur ? true : [0, 0, 'Idle'];
        } },
        smash: { range: [0, 120], w: 4, start(e, pl, c) {
          c.dur = 0.95; e.anim.play('Charge', { speed: 1.2 });
          zone(e, e.x, e.y, 70 + e.r, 0.75, M(e) * 1.7, '#1fb6c4', { onHit: net(p => knock(p, e.x, e.y, 420), kb(e.x, e.y, 420)) });
        } },
        sonic: { range: [110, 560], w: 3, once: 6, start(e, pl, c) {
          // Charges for 1.7 s, tracking you, then a boom that goes through walls and armour.
          c.dur = 1.95; c.h = beam(e, angTo(e, pl), 620, 30, 1.7, R(e) * 1.9, '#5ef0ff', { pure: true, track: true });
          e.anim.play('Charge', { speed: 0.7 });
          if (near(e.x, e.y)) G.Spawner.say('The Warden charges a Sonic Boom!', 1.6);
        }, tick(e, dt, pl, c) {
          if (c.t < 1.35) { c.h.x = e.x; c.h.y = e.y; c.h.angle = angTo(e, pl); }
          if (c.t >= 1.7 && !c.boom) { c.boom = true; e.anim.play('Shoot'); G.FX.ring(e.x, e.y, 6, 60, '#5ef0ff', 0.4, 4); G.Camera.kick(0.4); }
          return c.t >= c.dur ? true : [0, 0, 'Idle'];
        } },
        darkness: { range: [0, 900], w: 2, once: 16, start(e, pl, c) {
          c.dur = 0.8; e.anim.play('Charge', { speed: 0.9 });
          G.FX.ring(e.x, e.y, e.r, 520, '#0d2b33', 1.2, 6);
          pl.addEffect('darkness', 8);
          G.Spawner.say('Darkness…', 1.8);
        } },
        burrow: { range: [260, 2000], w: 3, once: 9, start(e, pl, c) {
          c.dur = 2.6; e.anim.play('Faint', { hold: true });
        }, tick(e, dt, pl, c) {
          if (c.t > 0.5 && !c.hid) { c.hid = true; e.hidden = true; }
          if (c.t > 1.3 && !c.mark) {
            c.mark = [pl.x, pl.y];
            zone(e, pl.x, pl.y, 78, 0.85, M(e) * 1.5, '#1fb6c4', { onHit: net(p => knock(p, c.mark[0], c.mark[1], 380), kb(pl.x, pl.y, 380)) });
          }
          if (c.t > 2.15 && c.hid) { c.hid = false; e.hidden = false; e.x = c.mark[0]; e.y = c.mark[1]; e.anim.play('Attack'); G.Camera.kick(0.5); }
          return c.t >= c.dur ? true : [0, 0, 'Idle'];
        } }
      }
    },

    // ===== The Wither (floor boss, Nether): wither skulls, blue skulls, charge, skeletons, armour =====
    wither: {
      keep: 230, cd: [0.9, 1.5], fury: 'The Wither\'s armour hardens!',
      init(e, pl, s) {
        // It spawns charging up and then explodes, like in Minecraft.
        zone(e, e.x, e.y, 170, 2.2, M(e) * 1.4, '#7fb0ff', { onHit: net(p => knock(p, e.x, e.y, 500), kb(e.x, e.y, 500)) });
        s.cd = 2.6;
        G.Spawner.say('The Wither is charging up…', 2);
      },
      hurtMod(e, a, s) { return s.fury ? a * 0.7 : a; },            // Wither Armour below half health
      moves: {
        skulls: { range: [0, 650], w: 4, start(e, pl, c) {
          c.dur = 0.6; c.n = 0; e.anim.play('Shoot');
        }, tick(e, dt, pl, c, s) {
          // The three heads fire in turn.
          while (c.n < 3 && c.t >= c.n * 0.15) {
            const off = [-16, 0, 16][c.n], a = angTo(e, pl) + (c.n - 1) * 0.08;
            shot(e, a, { from: [e.x + off, e.y - 6], sp: 300, dmg: R(e) * 0.75, shape: 'skull', pal: 'wither', r: 8,
              onHit: effect('wither', 6) });
            c.n++;
          }
          return c.t >= c.dur ? true : [0, 0, 'Idle'];
        } },
        blueSkull: { range: [0, 650], w: 2, start(e, pl, c, s) {
          c.dur = 0.5; e.anim.play('Shoot');
          const boom = p => { zone(e, p.x, p.y, 62, 0.02, R(e) * 1.1, '#2f5fb8', { onHit: effect('wither', 8) }); };
          for (let i = 0; i < (s.fury ? 2 : 1); i++) {
            shot(e, angTo(e, pl) + (i ? 0.5 : 0), { sp: 120, homing: 1.4, life: 4.5, dmg: R(e) * 1.2, shape: 'skull', pal: 'witherBlue',
              scale: 2, r: 12, onEnd: boom, onHit: effect('wither', 8) });
          }
        } },
        charge: { range: [100, 500], w: 3, fury: true, start(e, pl, c) {
          dashStart(e, pl, c, 380, 0.8, M(e) * 1.4, '#2f5fb8', net(p => knock(p, e.x, e.y, 500), kb(e.x, e.y, 500)));
        }, tick(e, dt, pl, c) {
          const r = dashTick(e, dt, pl, c);
          if (r === true) zone(e, e.x, e.y, 90, 0.02, M(e), '#2f5fb8');
          return r;
        } },
        skeletons: { range: [0, 900], w: 2, fury: true, once: 14, start(e, pl, c, s) {
          c.dur = 0.7; e.anim.play('Charge'); summon(e, 'wither_skeleton', 2, s, 4);
          G.Spawner.say('Wither Skeletons rise!', 1.8);
        } }
      }
    },

    // ===== The Ender Dragon (floor boss, The End): swoops, fireballs, Dragon's Breath, wing buffet =====
    ender_dragon: {
      keep: 260, cd: [1.0, 1.6], fury: 'The Ender Dragon roars!',
      // Invincible while any End Crystal stands (systems/endfight.js).
      hurtMod(e, a) {
        if (G.EndFight && G.EndFight.shielded(e)) { G.EndFight.blocked(e); return 0; }
        return a;
      },
      moves: {
        swoop: { range: [140, 700], w: 4, start(e, pl, c) {
          dashStart(e, pl, c, 440, 0.85, M(e) * 1.3, '#d64bff', net(p => knock(p, e.x, e.y, 480), kb(e.x, e.y, 480)));
        }, tick: dashTick },
        fireball: { range: [0, 750], w: 4, start(e, pl, c, s) {
          c.dur = 0.5; e.anim.play('Shoot');
          const cloud = p => zone(e, p.x, p.y, 72, 0.05, R(e) * 0.9, '#b84fe0', { linger: 6 });
          const n = s.fury ? 3 : 1;
          for (let i = 0; i < n; i++) shot(e, angTo(e, pl) + (i - (n - 1) / 2) * 0.35,
            { sp: 210, life: 3.2, dmg: R(e), shape: 'dragonFireball', pal: 'dragon', scale: 2, r: 11, onEnd: cloud });
        } },
        breath: { range: [0, 280], w: 3, start(e, pl, c) {
          // Perched: breathes a cone of lingering Dragon's Breath in front of it.
          c.dur = 1.1; e.anim.play('Charge', { speed: 1.1 });
          const a = angTo(e, pl);
          for (let i = 0; i < 4; i++) {
            const d = 60 + i * 55, sp = (i - 1.5) * 0.12;
            zone(e, e.x + Math.cos(a + sp) * d, e.y + Math.sin(a + sp) * d, 46 + i * 6, 0.7 + i * 0.12, R(e) * 0.8, '#b84fe0', { linger: 4.5 });
          }
        } },
        buffet: { range: [0, 150], w: 3, start(e, pl, c) {
          c.dur = 0.7; e.anim.play('Attack');
          zone(e, e.x, e.y, 120, 0.5, M(e) * 0.9, '#d64bff', { onHit: net(p => knock(p, e.x, e.y, 650), kb(e.x, e.y, 650)) });
        } }
      }
    },

    // ===== Elder Guardian: tracking laser, Mining Fatigue curse, thorn spikes =====
    elder_guardian: {
      keep: 220, cd: [1.3, 2.0],
      moves: {
        laser: { range: [0, 540], w: 4, start(e, pl, c) {
          c.dur = 2.4; c.h = beam(e, angTo(e, pl), 540, 18, 2.2, R(e) * 2.0, '#ffb35e', { track: true });
          e.anim.play('Charge', { speed: 0.6 });
        }, tick(e, dt, pl, c) {
          // Locks on like a real guardian: the beam follows you until it fires.
          if (c.t < 1.85) { c.h.x = e.x; c.h.y = e.y; c.h.angle = angTo(e, pl); }
          return c.t >= c.dur ? true : [0, 0, 'Idle'];
        } },
        curse: { range: [0, 1000], w: 2, once: 20, start(e, pl, c) {
          c.dur = 0.6;
          // Not while it still holds (a mate's copy on the host has no effects of its own: the stamp covers it).
          const now = performance.now();
          if (pl.fx.fatigue || pl.fatigueUntil > now) { c.dur = 0; return; }
          pl.fatigueUntil = now + 14000;
          pl.addEffect('fatigue', 14);
          G.FX.ring(pl.x, pl.y - 20, 10, 140, '#7fd8c8', 0.9, 5);
          // A mate's computer shows the message when the effect arrives (coop.js 'pfx').
          if (pl === G.Game.player) G.Spawner.say('Mining Fatigue! Your skills recharge slower', 2.2);
          if (near(e.x, e.y)) G.Audio.sfx('rift');
        } },
        thorns: { range: [0, 170], w: 3, start(e, pl, c) {
          c.dur = 0.6; e.anim.play('Attack');
          for (let i = 0; i < 14; i++) shot(e, i / 14 * 6.2832, { sp: 260, life: 0.7, dmg: R(e) * 0.6, shape: 'needle', pal: 'water', r: 6 });
        } }
      }
    },

    // ===== Drowned Captain (mid-boss, The Ocean): trident volleys, Channeling lightning, Riptide, its crew =====
    drowned: {
      keep: 210, cd: [1.0, 1.6], fury: 'The Drowned Captain calls down the storm!',
      moves: {
        trident: { range: [0, 620], w: 4, start(e, pl, c, s) {
          c.dur = 0.6; e.anim.play('Shoot');
          const n = s.fury ? 5 : 3;
          for (let i = 0; i < n; i++) shot(e, angTo(e, pl) + (i - (n - 1) / 2) * 0.2,
            { sp: 330, life: 2.2, dmg: R(e) * 0.85, shape: 'trident', pal: 'water', r: 8, trail: 'drip' });
        } },
        channel: { range: [0, 700], w: 3, once: 5, start(e, pl, c, s) {
          // Channeling: lightning strikes where you stand (and, enraged, twice more around you).
          c.dur = 1.35; c.n = 0; e.anim.play('Charge', { speed: 0.8 });
          c.bolts = [[pl.x, pl.y, 1.05]];
          if (s.fury) for (let i = 0; i < 2; i++) { const a = rand(0, 6.2832); c.bolts.push([pl.x + Math.cos(a) * 90, pl.y + Math.sin(a) * 70, 1.25]); }
          for (const [x, y, t] of c.bolts) zone(e, x, y, 58, t, R(e) * 1.5, '#e8f4ff');
          if (near(e.x, e.y)) G.Spawner.say('The Drowned Captain raises its trident: lightning!', 1.6);
        }, tick(e, dt, pl, c) {
          while (c.n < c.bolts.length && c.t >= c.bolts[c.n][2]) {
            const [x, y] = c.bolts[c.n++];
            G.FX.ring(x, y, 6, 70, '#ffffff', 0.35, 5);
            G.FX.burst(x, y - 8, '#dfe6ff', 14, 200);
            if (near(x, y)) { G.Game.flash('rgba(255,255,255,.35)', 0.15); G.Camera.kick(0.35); G.Audio.sfx('judge'); }
          }
          // The bolt flickers: it strikes three times over a quarter of a second (each FX.beam lasts 0.2 s).
          for (const b of c.bolts) {
            while ((b[3] || 0) < 3 && c.t >= b[2] + (b[3] || 0) * 0.12) {
              b[3] = (b[3] || 0) + 1;
              G.FX.beam(b[0] + rand(-4, 4), b[1] - 460, Math.PI / 2, 460, 30 - b[3] * 6, '#ffffff', { pal: 'lightning', beam: 'lightning' });
            }
          }
          return c.t >= c.dur ? true : [0, 0, 'Idle'];
        } },
        riptide: { range: [140, 480], w: 3, start(e, pl, c) {
          // Riptide: it spins along its trident straight at you in a rush of water.
          dashStart(e, pl, c, 380, 0.6, M(e) * 1.3, '#3f76e4', net(p => knock(p, e.x, e.y, 520), kb(e.x, e.y, 520)));
        }, tick(e, dt, pl, c) {
          if (c.t >= c.wind && Math.random() < dt * 40) G.FX.px(e.x + rand(-12, 12), e.y - rand(4, 30), '#bfe6ff', { vy: -40, life: 0.6, size: 1.5 });
          return dashTick(e, dt, pl, c);
        } },
        crew: { range: [0, 900], w: 2, once: 14, start(e, pl, c, s) {
          c.dur = 0.8; e.anim.play('Charge'); summon(e, 'drowned', s.fury ? 3 : 2, s, 5);
          G.Spawner.say('The Drowned Captain calls its crew!', 1.6);
        } }
      }
    },

    // ===== Ravager: bite, ram with huge knockback, roar =====
    ravager: {
      keep: 0, cd: [1.1, 1.8],
      moves: {
        bite: { range: [0, 110], w: 4, start(e, pl, c, s, dist) { c.dur = 0.6; e.anim.play('Attack'); front(e, pl, dist, 58, 0.45, M(e) * 1.3, '#9a4a3a'); } },
        ram: { range: [120, 480], w: 4, start(e, pl, c) {
          dashStart(e, pl, c, 400, 0.7, M(e) * 1.4, '#9a4a3a', net(p => knock(p, e.x, e.y, 700), kb(e.x, e.y, 700)));
        }, tick: dashTick },
        roar: { range: [0, 240], w: 2, once: 8, start(e, pl, c) {
          c.dur = 1.1; e.anim.play('Charge', { speed: 0.8 });
          zone(e, e.x, e.y, 160, 0.9, M(e) * 0.9, '#d8c08a', { onHit: net(p => knock(p, e.x, e.y, 720), kb(e.x, e.y, 720)) });
          if (near(e.x, e.y)) G.Spawner.say('The Ravager roars!', 1.4);
        } }
      }
    },

    // ===== Giant: earth-shaking slams, quake rings, calls zombies =====
    giant: {
      keep: 0, cd: [1.3, 2.0],
      moves: {
        slam: { range: [0, 140], w: 4, start(e, pl, c) {
          c.dur = 1.2; e.anim.play('Charge', { speed: 0.9 });
          zone(e, e.x, e.y, 120, 1.0, M(e) * 1.8, '#7aa05a', { onHit: net(p => knock(p, e.x, e.y, 450), kb(e.x, e.y, 450)) });
        } },
        quake: { range: [0, 360], w: 3, start(e, pl, c) {
          c.dur = 1.6; e.anim.play('Attack');
          [80, 160, 240].forEach((r, i) => zone(e, e.x, e.y, r, 0.6 + i * 0.3, M(e) * 0.55, '#7aa05a'));
        } },
        horde: { range: [0, 900], w: 2, once: 14, start(e, pl, c, s) { c.dur = 0.8; e.anim.play('Charge'); summon(e, 'zombie', 3, s, 6); } }
      }
    },

    // ===== Piglin Brute: golden axe cleave, leap, rallies piglins =====
    piglin_brute: {
      keep: 0, cd: [1.0, 1.6],
      moves: {
        cleave: { range: [0, 130], w: 4, start(e, pl, c) {
          c.dur = 0.75; e.anim.play('Attack');
          beam(e, angTo(e, pl), 130, 110, 0.5, M(e) * 1.6, '#ffcb3d');
        } },
        leap: { range: [140, 360], w: 3, start(e, pl, c) {
          c.dur = 0.1; e.jump = { sx: e.x, sy: e.y, tx: pl.x, ty: pl.y, t: -0.4, dur: 0.6 };
          zone(e, pl.x, pl.y, 80, 1.0, M(e) * 1.3, '#ffcb3d');
          e.anim.play('Charge', { speed: 1.4 });
        } },
        rally: { range: [0, 900], w: 2, once: 15, start(e, pl, c, s) {
          c.dur = 0.7; e.anim.play('Charge'); summon(e, 'piglin', 2, s, 4);
          G.Spawner.say('The Piglin Brute calls for help!', 1.6);
        } }
      }
    },

    // ===== Ghast: big explosive fireballs from afar, barrages, a shriek =====
    ghast: {
      keep: 320, cd: [1.4, 2.1],
      moves: {
        fireball: { range: [0, 800], w: 4, start(e, pl, c, s) {
          c.dur = 0.7; e.anim.play('Shoot');
          const boom = p => zone(e, p.x, p.y, 72, 0.02, R(e) * 1.4, '#ff8a2b');
          const n = s.fury ? 3 : 1;
          for (let i = 0; i < n; i++) shot(e, angTo(e, pl) + (i - (n - 1) / 2) * 0.3,
            { sp: 175, life: 4, dmg: R(e) * 1.2, shape: 'fireball', pal: 'fire', scale: 2.2, r: 12, onEnd: boom, trail: 'ember' });
        } },
        shriek: { range: [0, 600], w: 1, once: 10, start(e, pl, c) {
          c.dur = 0.8; e.anim.play('Charge');
          G.FX.ring(e.x, e.y, e.r, 300, '#ffffff', 0.7, 4);
          pl.addEffect('slow', 3, { k: 0.65 });
          G.Spawner.say('The Ghast shrieks!', 1.4);
        } }
      }
    },

    // ===== Hoglin: head-toss, charge, stomp =====
    hoglin: {
      keep: 0, cd: [1.0, 1.6],
      moves: {
        toss: { range: [0, 110], w: 4, start(e, pl, c, s, dist) {
          c.dur = 0.6; e.anim.play('Attack');
          front(e, pl, dist, 60, 0.45, M(e) * 1.3, '#c07a5a', { onHit: net(p => { knock(p, e.x, e.y, 760); p.addEffect('levitation', 0.6); }, kb(e.x, e.y, 760), ef('levitation', 0.6)) });
        } },
        charge: { range: [120, 420], w: 3, start(e, pl, c) { dashStart(e, pl, c, 360, 0.65, M(e) * 1.2, '#c07a5a', net(p => knock(p, e.x, e.y, 500), kb(e.x, e.y, 500))); }, tick: dashTick },
        stomp: { range: [0, 140], w: 2, start(e, pl, c) { c.dur = 0.9; e.anim.play('Charge'); zone(e, e.x, e.y, 100, 0.75, M(e) * 1.1, '#c07a5a'); } }
      }
    },

    // ===== Shulker: homing bullets that make you levitate, closes its shell, teleports =====
    shulker: {
      keep: 230, cd: [0.9, 1.5], slow: 0.25,
      hurtMod(e, a, s) { return s.shell > 0 ? a * 0.2 : a; },
      passive(e, dt, pl, s) { if (s.shell > 0) s.shell -= dt; },
      moves: {
        bullets: { range: [0, 750], w: 4, start(e, pl, c, s) {
          c.dur = 0.6; e.anim.play('Shoot');
          const n = s.fury ? 3 : 2;
          for (let i = 0; i < n; i++) shot(e, angTo(e, pl) + (i - (n - 1) / 2) * 0.9,
            { sp: 150, homing: 2.2, life: 5, dmg: R(e) * 0.8, shape: 'bullet', pal: 'shulker', r: 8, onHit: effect('levitation', 3) });
        } },
        shell: { range: [0, 2000], w: 2, once: 9, start(e, pl, c, s) {
          c.dur = 0.3; s.shell = 3.5; e.anim.play('Hurt');
          G.FX.ring(e.x, e.y, e.r, e.r * 2.5, '#d9c7e8', 0.4, 3);
        } },
        teleport: { range: [0, 130], w: 3, once: 4, start(e, pl, c) {
          c.dur = 0.3; const a = Math.random() * 6.2832;
          blink(e, pl.x + Math.cos(a) * 230, pl.y + Math.sin(a) * 180, '#b98fe0');
        } }
      }
    },

    // ===== Enderman: teleport strikes, block throws, dodges by teleporting =====
    enderman: {
      keep: 0, cd: [0.9, 1.5],
      hurtMod(e, a, s) {
        // Like in Minecraft, it often teleports away instead of taking the hit.
        if (!s.cast && Math.random() < 0.18 && (s.dodge = (s.dodge || 0)) <= 0) {
          s.dodge = 1.2;
          const a2 = Math.random() * 6.2832, pl = e.kitTarget || G.Game.player;
          blink(e, pl.x + Math.cos(a2) * 200, pl.y + Math.sin(a2) * 150);
          return 0;
        }
        return a;
      },
      passive(e, dt, pl, s) { if (s.dodge > 0) s.dodge -= dt; },
      moves: {
        strike: { range: [0, 600], w: 4, start(e, pl, c) {
          c.dur = 0.75;
          const a = pl.moveAngle + Math.PI + rand(-0.6, 0.6);      // appears behind you
          blink(e, pl.x + Math.cos(a) * 48, pl.y + Math.sin(a) * 38);
          zone(e, e.x, e.y, 64, 0.4, M(e) * 1.4, '#c070ff');
          e.anim.play('Attack');
        } },
        block: { range: [120, 600], w: 3, start(e, pl, c) {
          c.dur = 0.6; e.anim.play('Shoot');
          shot(e, angTo(e, pl), { sp: 270, dmg: R(e) * 1.2, shape: 'rock', pal: 'rock', scale: 1.8, r: 10 });
        } }
      }
    },

    // ===== Evoker: fang lines and rings, summons vexes =====
    evoker: {
      keep: 220, cd: [1.2, 1.8],
      moves: {
        fangLine: { range: [0, 520], w: 4, start(e, pl, c) {
          c.dur = 1.0; e.anim.play('Charge');
          const a = angTo(e, pl);
          for (let i = 0; i < 10; i++) zone(e, e.x + Math.cos(a) * (40 + i * 34), e.y + Math.sin(a) * (40 + i * 34) * 0.85, 24, 0.55 + i * 0.06, R(e) * 0.9, '#c9a24a');
        } },
        fangRing: { range: [0, 160], w: 3, start(e, pl, c) {
          c.dur = 1.0; e.anim.play('Charge');
          for (const [rr, n] of [[60, 6], [110, 10]]) for (let i = 0; i < n; i++) {
            const a = i / n * 6.2832;
            zone(e, e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr * 0.8, 26, 0.65 + rr / 600, R(e) * 0.9, '#c9a24a');
          }
        } },
        vexes: { range: [0, 900], w: 2, once: 12, start(e, pl, c, s) {
          c.dur = 0.9; e.anim.play('Charge'); summon(e, 'vex', 3, s, 6);
          G.Spawner.say('The Evoker summons Vexes!', 1.6);
        } }
      }
    },

    // ===== Iron Golem: flings you into the air, ground slam =====
    iron_golem: {
      keep: 0, cd: [1.1, 1.7],
      moves: {
        fling: { range: [0, 115], w: 4, start(e, pl, c, s, dist) {
          c.dur = 0.7; e.anim.play('Attack');
          front(e, pl, dist, 62, 0.5, M(e) * 1.5, '#d0d0d0', { onHit: net(p => { knock(p, e.x, e.y, 650); p.addEffect('levitation', 0.8); }, kb(e.x, e.y, 650), ef('levitation', 0.8)) });
        } },
        slam: { range: [0, 150], w: 3, start(e, pl, c) { c.dur = 1.0; e.anim.play('Charge'); zone(e, e.x, e.y, 105, 0.85, M(e) * 1.2, '#d0d0d0'); } }
      }
    },

    // ===== Breeze: wind charges that blast you back, hops around, deflects shots =====
    // As the Ominous Trial (Underworld floor boss, e.ominous): more charges, gust rings and ominous item drops.
    breeze: {
      keep: 220, cd: [1.0, 1.6],
      hurtMod(e, a) { if (Math.random() < (e.ominous ? 0.3 : 0.2)) { G.FX.burst(e.x, e.y - 20, e.ominous ? '#3ad6c6' : '#dff3ff', 6, 90); return 0; } return a; },
      moves: {
        wind: { range: [0, 600], w: 4, start(e, pl, c, s) {
          c.dur = 0.6; e.anim.play('Shoot');
          const blast = p => zone(e, p.x, p.y, 56, 0.02, R(e) * 0.8, '#bfe6ff', { onHit: net(q => knock(q, p.x, p.y, 520), kb(p.x, p.y, 520)) });
          const n = (s.fury ? 3 : 1) + (e.ominous ? 2 : 0);
          for (let i = 0; i < n; i++) shot(e, angTo(e, pl) + (i - (n - 1) / 2) * 0.35,
            { sp: 260, life: 2.2, dmg: R(e) * 0.6, shape: 'windCharge', pal: 'flying', scale: 1.6, r: 9, onEnd: blast });
        } },
        hop: { range: [0, 2000], w: 2, once: 3, start(e, pl, c) {
          c.dur = 0.1; const a = Math.random() * 6.2832;
          e.jump = { sx: e.x, sy: e.y, tx: pl.x + Math.cos(a) * 220, ty: pl.y + Math.sin(a) * 170, t: -0.2, dur: 0.7 };
          e.anim.play('Charge');
        } },
        gust: { range: [0, 280], w: 3, omen: true, once: 5, start(e, pl, c) {
          // A ring of wind charges bursting outward, and a shove if you stand next to it.
          c.dur = 0.8; e.anim.play('Charge', { speed: 1.3 });
          zone(e, e.x, e.y, 110, 0.6, M(e), '#3ad6c6', { onHit: net(p => knock(p, e.x, e.y, 620), kb(e.x, e.y, 620)) });
          for (let i = 0; i < 10; i++) shot(e, i / 10 * 6.2832, { sp: 230, life: 1.6, dmg: R(e) * 0.5, shape: 'windCharge', pal: 'flying', r: 8 });
        } },
        omen: { range: [0, 900], w: 2, omen: true, once: 9, start(e, pl, c) {
          // Ominous item spawners: telegraphed drops around you that slow and hurt.
          c.dur = 0.9; e.anim.play('Charge');
          for (let i = 0; i < 5; i++) zone(e, pl.x + (i ? rand(-90, 90) : 0), pl.y + (i ? rand(-70, 70) : 0), 44, 1.1 + i * 0.12, R(e) * 0.9, '#3ad6c6',
            { onHit: effect('slow', 2.5, { k: 0.55 }) });
          if (near(e.x, e.y)) G.Spawner.say('Ominous items rain down!', 1.6);
        } }
      }
    },

    // ===== Creaking: only moves when you're not facing it; heavy swings and pale oak roots =====
    creaking: {
      keep: 0, cd: [1.2, 1.8],
      // "Looking at it" = walking toward it (auto-aim always faces enemies, so aim can't count).
      passive(e, dt, pl, s) {
        const [dx, dy] = G.U.norm(e.x - pl.x, e.y - pl.y);
        s.watched = pl.walking && Math.cos(pl.moveAngle) * dx + Math.sin(pl.moveAngle) * dy > 0.55 && G.U.dist(e.x, e.y, pl.x, pl.y) < 520;
        if (s.watched && Math.random() < dt * 3) G.FX.burst(e.x, e.y - e.bodyH * 0.7, '#ff9a3c', 1, 20);   // its eyes glow
      },
      frozen: s => s.watched,
      moves: {
        swing: { range: [0, 115], w: 4, start(e, pl, c, s, dist) { c.dur = 0.7; e.anim.play('Attack'); front(e, pl, dist, 62, 0.45, M(e) * 1.6, '#c8b090'); } },
        roots: { range: [0, 500], w: 2, start(e, pl, c) {
          c.dur = 0.9; e.anim.play('Charge');
          for (let i = 0; i < 3; i++) zone(e, pl.x + (i ? rand(-60, 60) : 0), pl.y + (i ? rand(-45, 45) : 0), 40, 0.95 + i * 0.12, R(e) * 0.8, '#8a7a5a',
            { onHit: effect('slow', 2.5, { k: 0.5 }) });
        } }
      }
    },

    // ===== Wither Skeleton: stone sword slashes that inflict Wither, lunges =====
    wither_skeleton: {
      keep: 0, cd: [0.9, 1.4],
      moves: {
        slash: { range: [0, 120], w: 4, start(e, pl, c) {
          c.dur = 0.6; e.anim.play('Attack');
          beam(e, angTo(e, pl), 120, 90, 0.42, M(e) * 1.3, '#4a4a4a', { onHit: effect('wither', 5) });
        } },
        lunge: { range: [120, 340], w: 3, start(e, pl, c) {
          dashStart(e, pl, c, 260, 0.55, M(e) * 1.1, '#4a4a4a', effect('wither', 4));
        }, tick: dashTick }
      }
    },

    // ===== Blaze: bursts of three fireballs, a ring of fire =====
    blaze: {
      keep: 240, cd: [1.1, 1.7],
      moves: {
        burst: { range: [0, 600], w: 4, start(e, pl, c) { c.dur = 1.1; c.n = 0; e.anim.play('Charge'); },
          tick(e, dt, pl, c) {
            while (c.n < 3 && c.t >= 0.3 + c.n * 0.25) {
              shot(e, angTo(e, pl) + rand(-0.08, 0.08), { sp: 280, dmg: R(e) * 0.7, shape: 'fireball', pal: 'fire', r: 7, trail: 'ember' });
              e.anim.play('Shoot'); c.n++;
            }
            return c.t >= c.dur ? true : [0, 0, 'Idle'];
          } },
        flames: { range: [0, 170], w: 2, start(e, pl, c) {
          c.dur = 1.0; e.anim.play('Charge');
          zone(e, e.x, e.y, 120, 0.85, M(e) * 1.1, '#ff8a2b');
        } }
      }
    }
  };

  // ---------------- engine ----------------
  function has(e) { return !!e.boss && !!KITS[keyOf(e)]; }
  /** Gives a boss its kit now (floors.js, at spawn: shields and entrances work before its first move). */
  function ensure(e, pl) { if (has(e) && !e.kit) init(e, pl || target(e)); return e.kit || null; }

  /** Solo: you. Co-op: the living player nearest to the boss (the host when everyone is down). */
  function target(e) {
    if (!G.Coop.active) return G.Game.player;
    return G.EnemyMgr.nearestPlayer(G.Game.everyone(), e.x, e.y) || G.Game.player;
  }

  function init(e, pl) {
    const K = KITS[keyOf(e)];
    const s = e.kit = { K, cd: 1.4, cast: null, fury: false, side: Math.random() < 0.5 ? -1 : 1, last: {}, minions: [] };
    if (K.init) K.init(e, pl, s);
    return s;
  }

  function move(e, dt, pl, dist, dx, dy, spd) {
    const s = e.kit || init(e, pl), K = s.K;
    if (G.Coop.active) e.kitTarget = pl;
    if (!s.fury && e.hp < e.maxHp * 0.5) {
      s.fury = true; e.spd *= 1.15;
      G.Spawner.say(K.fury || ('The ' + e.name + ' is enraged!'), 2.4);
      G.FX.ring(e.x, e.y, e.r, e.r * 5, '#ff4a4a', 0.6, 5);
      G.Camera.kick(0.5); G.Audio.sfx('boss');
    }
    if (K.passive) K.passive(e, dt, pl, s);
    for (const k in s.last) s.last[k] -= dt;

    // A move in progress.
    if (s.cast) {
      const c = s.cast;
      c.t += dt;
      const r = c.m.tick ? c.m.tick(e, dt, pl, c, s) : (c.t >= (c.dur || 0.6) ? true : [0, 0, 'Idle']);
      if (r === true) { s.cast = null; s.cd = rand(...(c.m.cd || K.cd)) * (s.fury ? 0.8 : 1) * (e.ominous ? 0.8 : 1); return [0, 0, 'Idle']; }
      return r;
    }
    // Frozen while watched (Creaking).
    if (K.frozen && K.frozen(s)) return [0, 0, 'Idle'];

    s.cd -= dt * (s.fury ? 1.25 : 1);
    // Movement: chase, or hold its favourite distance and circle you.
    const k = (s.fury ? 1.2 : 1) * (K.slow || 1);
    let vx = dx * spd * k * 1.1, vy = dy * spd * k * 1.1;
    if (K.keep > 0) {
      if (dist < K.keep * 0.7) { vx = -dx * spd * k; vy = -dy * spd * k; }
      else if (dist < K.keep * 1.35) { vx = -dy * spd * 0.6 * k * s.side; vy = dx * spd * 0.6 * k * s.side; }
      if (Math.random() < dt * 0.15) s.side = -s.side;
    }
    if (s.cd <= 0) {
      const ok = Object.entries(K.moves).filter(([id, m]) =>
        dist >= m.range[0] && dist <= m.range[1] && (!m.fury || s.fury) && (!m.omen || e.ominous) && !(s.last[id] > 0));
      if (ok.length) {
        let x = Math.random() * ok.reduce((a, [, m]) => a + (m.w || 1), 0), pick = ok[0];
        for (const o of ok) { x -= o[1].w || 1; if (x <= 0) { pick = o; break; } }
        const [id, m] = pick;
        const c = s.cast = { id, m, t: 0, dur: 0.6 };
        if (m.once) s.last[id] = m.once;
        m.start(e, pl, c, s, dist);
        e.anim.dir = G.Sprites.dirFromAngle(angTo(e, pl));
        return [0, 0, 'Idle'];
      }
      s.cd = 0.3;
    }
    return [vx, vy, 'Walk'];
  }

  function hurtMod(e, amount, eff) {
    const s = e.kit;
    return s && s.K.hurtMod ? s.K.hurtMod(e, amount, s, eff) : amount;
  }

  /** Status effects on the player, under the hearts (called after the HUD). */
  function drawEffects(ctx, pl) {
    if (!pl || !pl.fx) return;
    const L = { wither: ['WITHER', '#9a8aa0'], levitation: ['LEVITATION', '#d9b8ff'], fatigue: ['MINING FATIGUE', '#7fd8c8'],
                darkness: ['DARKNESS', '#5ef0ff'], slow: ['SLOWNESS', '#9fb4c8'], grace: ['DOLPHIN\'S GRACE', '#7fe8ff'] };
    let y = 92;
    ctx.save();
    ctx.font = '700 10px Pixelify, monospace'; ctx.textAlign = 'left';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)';
    for (const k in L) {
      const f = pl.fx[k];
      if (!f) continue;
      const txt = L[k][0] + ' ' + Math.ceil(f.t) + 's';
      ctx.strokeText(txt, 16, y); ctx.fillStyle = L[k][1]; ctx.fillText(txt, 16, y);
      y += 13;
    }
    ctx.restore();
  }

  return { KITS, has, ensure, move, hurtMod, drawEffects, keyOf };
})();
