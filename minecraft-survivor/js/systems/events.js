/* ============ events.js — mid-run events and treasure thieves ============
 *
 * Every 4-5 minutes (never with a boss alive or inside a Nether Portal) one of these happens:
 *
 *   horde   Mob Siege: 30 s in which every mob that spawns has the same
 *           element, drawn from the biome you are in (if yours beats it, it's your moment)
 *   gold    Emerald Rush: 30 s of golden mobs that give double experience
 *           and sometimes drop emeralds
 *   lost    Lost Pet (a mob of the biome you are in): touch it, it follows you, and you lead it to the marker.
 *           Mobs hurt it; if it falls (or you take over 2 min), it leaves.
 *           Reward: heals half your health, emeralds, a Trial Key and, 1 time
 *           in 5, it joins your collection.
 *
 * Treasure thieves (1-2 per run, see Enemy behavior 'thief'): a Fox that stole
 * emeralds (or, 1 time in 4, a Piglin carrying an Ominous Key) that flees and
 * escapes after 15 s if you don't catch it.
 *
 * Pillager Patrols (Overworld, by DAY, every 2-3 minutes; on their own clock): a Pillager
 * Captain with an Ominous Banner over its head (elite stats) marches in from one side with
 * 3-5 pillagers and 1-2 vindicators. The captain drops an Ominous Bottle.
 *
 * Sea battles (The Ocean, or any `underwater` floor; every ~2 minutes on their own clock, alternating):
 *   dolphins  a Dolphin Pod: friendly dolphins swim up and circle you for SEA_POD s; swimming
 *             near one gives Dolphin's Grace (pl.addEffect('grace'): faster swimming, entities/player.js)
 *   guardians a Guardian Patrol: 3-5 guardians arrive together from one side; beat them all for emeralds
 *
 * Co-op: the host decides and announces it with 'ev' (see coop.js). Everyone
 * sees the same and the reward is for everyone. The Pillager Captain and the guardians of a patrol
 * reach the guests flagged (captain, seaPatrol: coop.js 'ef'), the dolphins of a pod as 'ev' 'pd'
 * (positions, 10 a second) and 'px' (gone); Dolphin's Grace on a mate's copy goes to that mate.
 */
G.Events = (() => {
  const EVERY = [240, 300], DUR = 30, LOST_TIME = 120;
  const THIEF_FIRST = [120, 240], THIEF_NEXT = [240, 360], THIEF_LIFE = 15;
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const An = w => (/^[AEIOU]/i.test(w) ? 'An ' : 'A ') + w;

  const PATROL_FIRST = [70, 110], PATROL_NEXT = [120, 180];
  const PILLAGER = 73, VINDICATOR = 77, BOTTLE = 'lifeorb';     // lifeorb = Ominous Bottle (data/items.js)
  let nextT = 0, cur = null, last = null, thiefT = 0, thieves = 0;
  let patrolT = 0, patrol = null;     // patrol: { cap, at, ang, anchor } (at > 0: still on its way)
  let lost = null;      // { dex, name, x, y, hp, maxHp, state, follow, tx, ty, t, anim, r, hitCd, netT, grant }

  const SEA_FIRST = [90, 120], SEA_NEXT = [105, 135];      // seconds between sea battles (The Ocean)
  const SEA_POD = 24, GRACE_R = 90, GRACE_T = 8;            // pod lifetime; how close gives Dolphin's Grace, and for how long
  const POD_COL = '#7fe8ff', GUARD_COL = '#ffb35e';
  let seaT = 0, lastSea = null;
  let pod = null;       // { dex, list: [{ x, y, ox, oy, ph, anim, r }], cx, cy, a, t, graced }
  let guards = null;    // { list: [Enemy], n, x, y }

  function reset() {
    nextT = G.U.rand(EVERY[0], EVERY[1]);
    cur = null; last = null; lost = null;
    thiefT = G.U.rand(THIEF_FIRST[0], THIEF_FIRST[1]); thieves = 0;
    patrolT = G.U.rand(PATROL_FIRST[0], PATROL_FIRST[1]); patrol = null;
    seaT = G.U.rand(SEA_FIRST[0], SEA_FIRST[1]); lastSea = null; pod = null; guards = null;
  }

  // ---------------- ciclo ----------------

  function update(dt, players, time) {
    if (pod && pod.net) netPodTick(dt);
    if (cur) {
      cur.t += dt;
      if (cur.id !== 'lost' && cur.t >= cur.dur && authority()) end();
    }
    if (lost) lostTick(dt, players);
    // (The Aether is peaceful: no events at all.)
    if (!authority() || G.Rift.inArena || G.Judgment.active || G.Floors.peaceful) return;

    patrolTick(dt, players, time);
    seaTick(dt, players, time);

    if (thieves < 2) {
      thiefT -= dt;
      if (thiefT <= 0) {
        if (G.EnemyMgr.bossAlive()) thiefT = 8;
        else { spawnThief(players, time); thieves++; thiefT = G.U.rand(THIEF_NEXT[0], THIEF_NEXT[1]); }
      }
    }

    if (cur) return;
    nextT -= dt;
    if (nextT > 0) return;
    if (G.EnemyMgr.bossAlive()) { nextT = 10; return; }
    nextT = G.U.rand(EVERY[0], EVERY[1]);
    const ids = ['horde', 'gold', 'lost'].filter(id => id !== last);
    start(G.U.pick(ids), time, players);
  }

  function start(id, time, players) {
    last = id;
    if (id === 'horde') {
      const at = players.find(p => !p.dead) || players[0];
      const types = G.Enemies.hordeTypes(time, at.x, at.y);
      if (!types.length) return start('gold', time, players);
      const type = G.U.pick(types);
      const defs = G.Enemies.hordeDefs(type, time, at.x, at.y);
      G.Sprites.preload(defs.map(d => d.dex));
      cur = { id, t: 0, dur: DUR, type, defs };
      G.Spawner.burst(Math.round(6 * G.Coop.scaleRate(players.length)));
    } else if (id === 'gold') {
      cur = { id, t: 0, dur: DUR };
      for (const e of G.EnemyMgr.all()) if (!e.remote) e.makeGolden();
    } else {
      if (!spawnLost(players)) return;
      cur = { id, t: 0, dur: Infinity };
    }
    announce();
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 's', id, cur.type || '']);
  }

  function announce() {
    if (!cur) return;
    if (cur.id === 'horde') say('A siege of ' + G.U.TYPE_NAME[cur.type] + ' mobs!', 3, G.U.TYPE_COLOR[cur.type]);
    else if (cur.id === 'gold') say('Emerald Rush! Double experience', 3, '#ffd23f');
    else if (lost) say('Lost Pet! ' + An(lost.name) + ' is lost: find it and lead it home', 3.4, '#7dffb0');
    G.Audio.sfx(cur.id === 'gold' ? 'shiny' : 'surge');
  }

  function say(text, secs) { G.Spawner.say(text, secs, true); }

  function end() {
    if (!cur) return;
    cur = null;
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'e']);
  }

  /** Lo que sale durante una horda (lo usa G.Enemies.bagAt). */
  function bag() { return cur && cur.id === 'horde' && cur.defs.length ? cur.defs : null; }

  // ---------------- duende del tesoro ----------------

  function spawnThief(players, time) {
    const gold = Math.random() < 0.25;
    const dex = gold ? 113 : 15;        // a Piglin carries the gold, a Fox steals emeralds
    const mon = G.DEX_BY[dex];
    if (!mon || !G.SPRITE_META[dex]) return;
    const pl = G.U.pick(players.filter(p => !p.dead).length ? players.filter(p => !p.dead) : players);
    G.Sprites.preload([dex]);
    const def = { dex, name: mon.name, behavior: 'thief', hp: Math.round(60 * (1 + time / 95) * (gold ? 1.5 : 1)),
                  spd: 92, dmg: 0, xp: 10, loot: gold ? 'ticket10' : 'coins' };
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(230, 300);
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.8;
      if (!G.World.isFree(x, y, 14)) continue;
      const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 });
      e.life = THIEF_LIFE;
      G.EnemyMgr.add(e);
      G.FX.ring(x, y, 4, 40, '#ffd23f', 0.5, 3);
      G.Spawner.say(gold ? An(mon.name) + ' is carrying an Ominous Key! Catch it before it runs away!'
                         : An(mon.name) + ' stole a pile of emeralds! Catch it before it runs away!', 3.2);
      G.Audio.sfx('shiny');
      return;
    }
  }

  // ---------------- Pillager Patrol ----------------

  /** Patrols march in daylight on the Overworld surface. */
  function patrolWeather() {
    const dim = (G.Floors && G.Floors.dim) || G.World.dimension;
    return dim === 'overworld' && G.DayNight && G.DayNight.hasCycle() && !G.DayNight.isNight();
  }

  function patrolTick(dt, players, time) {
    if (patrol) {
      if (patrol.at > 0) { if ((patrol.at -= dt) <= 0) arrive(patrol, time); return; }
      const c = patrol.cap;
      if (c.dead && c.hp <= 0) {
        // The captain's loot: an Ominous Bottle and a few emeralds.
        G.Pickups.drop('item', c.x, c.y - 12, BOTTLE);
        for (let i = 0; i < 6; i++) G.Pickups.drop('coin', c.x + G.U.rand(-30, 30), c.y + G.U.rand(-20, 20), 5);
        G.Enchanting.dropBook('captain', c.x + 16, c.y + 8);          // sometimes an Enchanted Book (10%, level I)
        G.FX.ring(c.x, c.y, c.r, c.r * 6, '#9d9d97', 0.6, 4);
        say('The Pillager Captain fell! It dropped an Ominous Bottle', 3);
        patrol = null;
      } else if (c.dead || !G.EnemyMgr.all().includes(c)) patrol = null;
      return;
    }
    if ((patrolT -= dt) > 0) return;
    if (!patrolWeather() || G.EnemyMgr.bossAlive()) { patrolT = 10; return; }
    patrolT = G.U.rand(PATROL_NEXT[0], PATROL_NEXT[1]);
    startPatrol(players);
  }

  /** Announces a patrol; it arrives from one side 1.5 s later (time to load its sprites). */
  function startPatrol(players) {
    const alive = players.filter(p => !p.dead);
    patrol = { cap: null, at: 1.5, ang: Math.random() * 6.2832, anchor: G.U.pick(alive.length ? alive : players) };
    G.Sprites.preload([PILLAGER, VINDICATOR]);
    say('A Pillager Patrol approaches!', 3.2);
    G.Audio.sfx('surge');
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'pt']);
  }

  function arrive(P, time) {
    const pl = P.anchor && !P.anchor.dead ? P.anchor : G.Game.player;
    const ti = G.Enemies.tierAt(time), tier = G.Enemies.TIERS[ti];
    const def = dex => G.Enemies.defFor(G.DEX_BY[dex], tier, ti);
    // The captain: a pillager with the banner, elite health, damage and experience.
    const capDef = Object.assign(def(PILLAGER), { name: 'Pillager Captain' });
    capDef.hp = Math.round(capDef.hp * 4); capDef.dmg = Math.round(capDef.dmg * 1.3); capDef.xp = Math.round(capDef.xp * 5);
    if (capDef.shotDmg) capDef.shotDmg = Math.round(capDef.shotDmg * 1.3);
    const [cx, cy] = G.Spawner.ringPoint(pl, P.ang);
    const free = (x, y) => G.World.isFree(x, y, 14);
    const spot = (x, y, r) => {
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * 6.2832, d = i ? G.U.rand(18, r) : 0;
        if (free(x + Math.cos(a) * d, y + Math.sin(a) * d)) return [x + Math.cos(a) * d, y + Math.sin(a) * d];
      }
      return null;
    };
    const at = spot(cx, cy, 90) || [cx, cy];
    const cap = G.Spawner.spawnDef(capDef, at[0], at[1], time);
    cap.patrol = cap.captain = true;
    cap.name = 'Pillager Captain';
    G.Coop.enemyFlags(cap);
    P.cap = cap; P.at = 0;
    const crew = [];
    for (let i = G.U.randInt(3, 5); i > 0; i--) crew.push(PILLAGER);
    for (let i = Math.random() < 0.5 ? 1 : 2; i > 0; i--) crew.push(VINDICATOR);
    for (const dex of crew) {
      const p = spot(at[0], at[1], 80);
      if (!p) continue;
      const m = G.Spawner.spawnDef(def(dex), p[0], p[1], time);
      m.patrol = true;
      G.Coop.enemyFlags(m);
    }
    G.FX.ring(at[0], at[1], 6, 60, '#9d9d97', 0.6, 3);
  }

  // Ominous Banner (procedural, 10×20 texels): white field, grey and black illager face, cyan rhombus.
  const BANNER = [
    'LLLLLLLLLL', 'LLLLLLLLLL', 'LGLLLLLLGL', 'LLLLLLLLLL', 'KKKKKKKKKK',
    'WKKWWWWKKW', 'WWWWCCWWWW', 'WWWCCCCWWW', 'WWCCGGCCWW', 'WCCGGGGCCW',
    'WWCCGGCCWW', 'WWWCCCCWWW', 'WWWWCCWWWW', 'WWWWWWWWWW', 'WLLLLLLLLW',
    'WLKKKKKKLW', 'WLLLLLLLLW', 'WWWWWWWWWW', 'KKKKKKKKKK', 'KK.KKKK.KK'];
  const BANNER_COL = { W: '#f9fffe', L: '#9d9d97', G: '#474f52', K: '#1d1d21', C: '#169c9c' };

  function drawBanner(ctx, e) {
    const now = performance.now() / 1000, T = 1.5;            // world units per banner texel
    // Carried on a pole above the head (above the health bar once it shows).
    const bottom = e.y - e.bodyH - (e.hp < e.maxHp ? 13 : 2), top = Math.round(bottom - BANNER.length * T), x0 = Math.round(e.x - 5 * T);
    ctx.save();
    ctx.fillStyle = '#5c3f1e';                                   // oak pole and crossbar
    ctx.fillRect(Math.round(e.x - 1), top - 3, 2, e.y - e.bodyH + 8 - top);
    ctx.fillRect(x0 - 2, top - 3, 10 * T + 4, 2);
    for (let c = 0; c < 10; c++) {
      const sway = Math.sin(now * 3 + c * 0.5) * 0.8;
      for (let r = 0; r < BANNER.length; r++) {
        const k = BANNER[r][c];
        if (k === '.') continue;
        ctx.fillStyle = BANNER_COL[k];
        ctx.fillRect(x0 + c * T, top + r * T + (r > 4 ? sway : 0), T + 0.05, T + 0.05);
      }
    }
    ctx.restore();
  }

  // ---------------- Sea battles (The Ocean) ----------------

  function seaTick(dt, players, time) {
    if (pod) podTick(dt, players);
    if (guards) guardsTick();
    if (!G.Floors || !G.Floors.underwater) return;
    if ((seaT -= dt) > 0) return;
    if (pod || guards || cur || G.EnemyMgr.bossAlive()) { seaT = 10; return; }
    seaT = G.U.rand(SEA_NEXT[0], SEA_NEXT[1]);
    startSea(lastSea === 'dolphins' ? 'guardians' : lastSea === 'guardians' ? 'dolphins' : G.U.pick(['dolphins', 'guardians']), players, time);
  }

  function startSea(kind, players, time) {
    const alive = players.filter(p => !p.dead), pl = G.U.pick(alive.length ? alive : players);
    if (kind === 'dolphins' ? !startPod(pl) : !startGuards(pl, time)) return false;
    lastSea = kind;
    if (kind === 'dolphins') {
      G.Floors.announce('A DOLPHIN POD!', 'Swim with the dolphins for Dolphin\'s Grace: you swim faster', POD_COL, 4);
      G.Audio.sfx('biome');
    } else {
      G.Floors.announce('GUARDIAN PATROL', 'A school of ' + guards.n + ' guardians closes in: dodge their lasers', GUARD_COL, 4);
      G.Audio.sfx('surge');
    }
    return true;
  }

  /** A pod of 4-6 friendly dolphins, off-screen on one side, swimming to you. */
  function startPod(pl) {
    const p = G.Enemies.mob('dolphin');
    if (!p || !G.SPRITE_META[p.dex]) return false;
    const a = Math.random() * 6.2832, d = G.Camera.outerRadius() + 60;
    const cx = pl.x + Math.cos(a) * d, cy = pl.y + Math.sin(a) * d * 0.85;
    const list = [];
    for (let i = G.U.randInt(4, 6); i > 0; i--) {
      list.push({ x: cx + G.U.rand(-60, 60), y: cy + G.U.rand(-45, 45), ox: G.U.rand(-70, 70), oy: G.U.rand(-50, 50),
                  ph: Math.random() * 6.28, anim: new G.Sprites.Animator(p.dex, 1), r: G.Sprites.bodyRadius(p.dex) });
    }
    pod = { dex: p.dex, list, cx, cy, a: a + Math.PI, t: 0, graced: false, anchor: pl };
    G.Sprites.preload([p.dex]);
    return true;
  }

  function podTick(dt, players) {
    const P = pod, pl = P.anchor && !P.anchor.dead ? P.anchor : G.Game.player;
    P.t += dt;
    // The pod circles you (a slow orbit at ~120 px); when its time is up it swims off and leaves.
    let tx, ty, sp;
    if (P.t < SEA_POD) { P.a += dt * 0.55; tx = pl.x + Math.cos(P.a) * 120; ty = pl.y + Math.sin(P.a) * 90; sp = 230; }
    else { const [nx, ny] = G.U.norm(P.cx - pl.x || 1, P.cy - pl.y); tx = P.cx + nx * 400; ty = P.cy + ny * 400; sp = 260; }
    const d = G.U.dist(P.cx, P.cy, tx, ty);
    if (d > 1) { const k = Math.min(1, sp * dt / d); P.cx += (tx - P.cx) * k; P.cy += (ty - P.cy) * k; }
    for (const D of P.list) {
      D.ph += dt * 3;
      const gx = P.cx + D.ox + Math.sin(D.ph) * 18, gy = P.cy + D.oy + Math.cos(D.ph * 0.7) * 12;
      const vx = (gx - D.x) * Math.min(1, dt * 4), vy = (gy - D.y) * Math.min(1, dt * 4);
      D.x += vx; D.y += vy;
      if (Math.abs(vx) + Math.abs(vy) > 0.2) D.anim.dir = G.Sprites.dirFromAngle(Math.atan2(vy, vx));
      D.anim.update(dt); D.anim.loop('Walk');
    }
    if (G.Coop.isHost && (P.netT = (P.netT || 0) - dt) <= 0) {
      P.netT = 0.1;
      G.Coop.broadcast(['ev', 'pd', P.dex, Math.round(P.t * 10) / 10, P.list.map(D => [Math.round(D.x), Math.round(D.y), D.anim.dir])]);
    }
    if (P.t >= SEA_POD + 2 && !G.Camera.sees(P.cx, P.cy, 120)) { pod = null; if (G.Coop.isHost) G.Coop.broadcast(['ev', 'px']); return; }
    // Swimming next to a dolphin gives Dolphin's Grace.
    if (P.t >= SEA_POD) return;
    for (const p of players) {
      if (p.dead || !P.list.some(D => G.U.dist2(p.x, p.y, D.x, D.y) < GRACE_R * GRACE_R)) continue;
      const had = p.fx && p.fx.grace;
      p.addEffect('grace', GRACE_T);
      if (!had && p === G.Game.player) {
        G.FX.ring(p.x, p.y, 6, 60, POD_COL, 0.5, 3);
        if (!P.graced && !G.Floors.banner) say('Dolphin\'s Grace! You swim faster', 2.4);
        G.Audio.sfx('confirm');
      }
      P.graced = true;
    }
  }

  /** A Guardian Patrol: 3-5 guardians together, coming in from one side. */
  function startGuards(pl, time) {
    const p = G.Enemies.mob('guardian');
    if (!p || !G.SPRITE_META[p.dex]) return false;
    const ti = G.Enemies.tierAt(time), def = () => G.Enemies.defFor(p, G.Enemies.TIERS[ti], ti);
    const [cx, cy] = G.Spawner.ringPoint(pl, Math.random() * 6.2832);
    const list = [], n = G.U.randInt(3, 5);
    for (let i = 0; i < n; i++) {
      let at = [cx, cy];
      for (let k = 0; k < 10; k++) {
        const x = cx + G.U.rand(-90, 90), y = cy + G.U.rand(-70, 70);
        if (G.Spawner.fits(x, y)) { at = [x, y]; break; }
      }
      const e = G.Spawner.spawnDef(def(), at[0], at[1], time);
      e.patrol = e.seaPatrol = true;
      G.Coop.enemyFlags(e);
      list.push(e);
    }
    G.Sprites.preload([p.dex]);
    guards = { list, n: list.length, x: cx, y: cy };
    return true;
  }

  function guardsTick() {
    const live = guards.list.filter(e => !e.dead && G.EnemyMgr.get(e.id));
    const last = guards.list.find(e => e.dead) || guards.list[0];
    if (live.length) { guards.x = live[0].x; guards.y = live[0].y; return; }
    // All of them fell: a few emeralds where the last one went down.
    if (guards.list.every(e => e.dead && e.hp <= 0)) {
      for (let i = 0; i < 8; i++) G.Pickups.drop('coin', last.x + G.U.rand(-34, 34), last.y + G.U.rand(-24, 24), 5);
      say('The Guardian Patrol is beaten!', 2.6);
    }
    guards = null;
  }

  /** Guest: the host's pod (positions from 'pd'); the dolphins glide to them. */
  function netPod(dex, t, list) {
    if (!pod || !pod.net || pod.dex !== dex) {
      pod = { dex, list: [], cx: 0, cy: 0, a: 0, t, graced: false, net: true };
      G.Sprites.preload([dex]);
    }
    pod.t = t;
    list.forEach(([x, y, dir], i) => {
      let D = pod.list[i];
      if (!D) D = pod.list[i] = { x, y, ph: Math.random() * 6.28, anim: new G.Sprites.Animator(dex, 1), r: G.Sprites.bodyRadius(dex) };
      D.nx = x; D.ny = y; D.anim.dir = dir;
    });
    pod.list.length = list.length;
    if (list.length) { pod.cx = list[0][0]; pod.cy = list[0][1]; }
  }
  function netPodTick(dt) {
    pod.t += dt;
    for (const D of pod.list) {
      D.ph += dt * 3;
      D.x = G.U.damp(D.x, D.nx, 8, dt); D.y = G.U.damp(D.y, D.ny, 8, dt);
      D.anim.update(dt); D.anim.loop('Walk');
    }
  }

  // ---------------- Pokémon perdido ----------------

  function spawnLost(players) {
    const alive = players.filter(p => !p.dead);
    const pl = G.U.pick(alive.length ? alive : players);
    // (Never an Aether mob: those are befriended in the Aether, gen 8.)
    const ok = p => p.rarity <= 3 && !p.leg && p.gen !== 8 && G.SPRITE_META[p.dex] && !G.Sprites.hovers(p.dex);
    // A mob of the biome you are in when it has any that fit; any mob otherwise.
    const local = G.Enemies.pool(G.Enemies.biomeAt(pl.x, pl.y)).filter(ok);
    const mon = G.U.pick(local.length ? local : G.DEX.filter(ok));
    let at = null, to = null;
    for (let i = 0; i < 20 && !at; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(220, 300);
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.8;
      if (G.World.isFree(x, y, 16)) at = [x, y];
    }
    for (let i = 0; i < 30 && at && !to; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(700, 850);
      const x = at[0] + Math.cos(a) * d, y = at[1] + Math.sin(a) * d * 0.85;
      if (G.World.isFree(x, y, 30)) to = [x, y];
    }
    if (!at || !to) return false;
    makeLost({ dex: mon.dex, x: at[0], y: at[1], tx: to[0], ty: to[1], state: 'wait', hp: 100, grant: Math.random() < 0.2 });
    G.Sprites.preload([mon.dex]);
    return true;
  }

  function makeLost(o) {
    const mon = G.DEX_BY[o.dex];
    lost = Object.assign({ name: mon ? mon.name : '', maxHp: 100, t: 0, hitCd: 0, netT: 0, follow: null,
                           anim: new G.Sprites.Animator(o.dex, 1), r: G.Sprites.bodyRadius(o.dex) }, o);
  }

  function lostTick(dt, players) {
    const L = lost;
    L.t += dt;
    L.anim.update(dt);
    if (!authority()) { L.anim.loop(L.moving ? 'Walk' : 'Idle'); return; }

    if (L.state === 'wait') {
      const p = players.find(o => !o.dead && G.U.dist2(o.x, o.y, L.x, L.y) < (o.r + L.r + 18) ** 2);
      if (p) { L.state = 'follow'; L.follow = p; say('The ' + L.name + ' is following you! Lead it to the green marker', 3, '#7dffb0'); G.Audio.sfx('confirm'); }
      L.moving = false;
    } else {
      const p = L.follow && !L.follow.dead ? L.follow : players.find(o => !o.dead) || L.follow;
      const d = G.U.dist(L.x, L.y, p.x, p.y), keep = p.r + L.r + 14;
      L.moving = d > keep;
      if (L.moving) {
        const sp = Math.min(d - keep, Math.max(120, p.spd * 1.15) * dt);
        const [nx, ny] = G.U.norm(p.x - L.x, p.y - L.y);
        L.x += nx * sp; L.y += ny * sp;
        G.World.collide(L);
        L.anim.dir = G.Sprites.dirFromAngle(Math.atan2(ny, nx));
      }
      if (G.U.dist2(L.x, L.y, L.tx, L.ty) < 56 * 56) return rescued();
    }
    L.anim.loop(L.moving ? 'Walk' : 'Idle');

    // Los enemigos que lo tocan le hacen daño.
    if ((L.hitCd -= dt) <= 0) {
      const hits = G.EnemyMgr.queryCircle(L.x, L.y, L.r).filter(e => !e.dead && e.behavior !== 'thief');
      if (hits.length) {
        L.hitCd = 0.5;
        L.hp -= Math.min(30, hits.reduce((a, e) => a + 4 + e.dmg * 0.12, 0));
        L.flash = 0.1;
        G.FX.burst(L.x, L.y - 10, '#ff5f6d', 4, 60);
        if (L.hp <= 0) return gone('The ' + L.name + ' got scared and ran away…');
      }
    }
    if (L.flash > 0) L.flash -= dt;
    if (L.t > LOST_TIME) return gone('The ' + L.name + ' got tired of waiting and wandered off…');

    if (G.Coop.isHost && (L.netT -= dt) <= 0) {
      L.netT = 0.1;
      G.Coop.broadcast(['ev', 'lp', L.dex, Math.round(L.x), Math.round(L.y), Math.round(L.hp), L.state === 'follow' ? 1 : 0,
                        Math.round(L.tx), Math.round(L.ty), L.anim.dir, L.moving ? 1 : 0]);
    }
  }

  function rescued() {
    const L = lost;
    for (let i = 0; i < 12; i++) G.Pickups.drop('coin', L.tx + G.U.rand(-40, 40), L.ty + G.U.rand(-30, 30), 5);
    G.Pickups.drop('ticket', L.tx, L.ty - 12, 1);
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'rw', L.dex, L.grant ? 1 : 0]);
    reward(L.dex, L.grant);
    lost = null;
    end();
  }

  /** On every computer: heals and, if it rolled so, the mob joins your collection. */
  function reward(dex, grant) {
    const pl = G.Game.player;
    if (pl && !pl.dead) { pl.heal(pl.maxHp * 0.5); G.FX.ring(pl.x, pl.y, 6, 70, '#5fe08a', 0.5, 3); }
    const name = (G.DEX_BY[dex] || {}).name || '';
    G.FX.burst(lost ? lost.tx : pl.x, lost ? lost.ty - 10 : pl.y, '#7dffb0', 24, 180);
    G.Audio.sfx('legend');
    if (grant && G.onRescue) G.onRescue(dex, name);
    else say('You brought the ' + name + ' home! It thanks you', 3.2, '#7dffb0');
  }

  function gone(msg) {
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'lx', msg]);
    say(msg, 3);
    lost = null;
    end();
  }

  // ---------------- red ----------------

  function onNet(ev) {
    switch (ev[1]) {
      case 's': cur = { id: ev[2], t: 0, dur: ev[2] === 'lost' ? Infinity : DUR, type: ev[3] || null }; break;
      case 'e': cur = null; break;
      case 'pt': say('A Pillager Patrol approaches!', 3.2); G.Audio.sfx('surge'); break;
      case 'lp': {
        const [, , dex, x, y, hp, follow, tx, ty, dir, moving] = ev;
        if (!lost || lost.dex !== dex) makeLost({ dex, x, y, tx, ty, hp, state: follow ? 'follow' : 'wait' });
        Object.assign(lost, { x, y, hp, tx, ty, moving: !!moving, state: follow ? 'follow' : 'wait' });
        lost.anim.dir = dir;
        break;
      }
      case 'rw': reward(ev[2], !!ev[3]); lost = null; break;
      case 'pd': netPod(ev[2], ev[3], ev[4]); break;
      case 'px': pod = null; break;
      case 'lx': say(ev[2], 3); lost = null; break;
    }
  }

  // ---------------- dibujo ----------------

  /** El Pokémon perdido y la marca, para ordenarlos por Y con el resto. */
  function drawables() {
    const out = [];
    const c = captain();
    if (c && !c.dead) out.push({ y: c.y + 0.5, draw(ctx) { drawBanner(ctx, c); } });
    if (pod) for (const D of pod.list) {
      if (!G.Camera.sees(D.x, D.y, 80)) continue;
      out.push({ y: D.y, draw(ctx) {
        G.Sprites.drawShadow(ctx, pod.dex, D.x, D.y, 1);
        D.anim.draw(ctx, D.x, D.y - 4 - Math.sin(D.ph) * 3);
        if (Math.random() < 0.08) G.FX.px(D.x + G.U.rand(-D.r, D.r), D.y - G.U.rand(6, 20), '#d8f6ff', { vy: -45, life: 0.8 });
      } });
    }
    if (!lost) return out;
    const L = lost;
    const now = performance.now() / 1000;
    const goal = {
      y: L.ty - 4000,          // en el suelo, debajo de todo
      draw(ctx) {
        const k = 0.5 + Math.sin(now * 4) * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.25 + k * 0.15;
        ctx.fillStyle = '#5fe08a';
        ctx.beginPath(); ctx.ellipse(L.tx, L.ty, 56, 40, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.ellipse(L.tx, L.ty, 56, 40, 0, 0, 6.2832); ctx.stroke();
        ctx.restore();
        G.Icons.draw(ctx, 'heart', Math.round(L.tx - 8), Math.round(L.ty - 30 - k * 6), 16);
      }
    };
    const mon = {
      y: L.y,
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#7dffb0';
        ctx.beginPath(); ctx.ellipse(L.x, L.y, L.r * 1.5, L.r * 0.6, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
        G.Sprites.drawShadow(ctx, L.dex, L.x, L.y, 1);
        L.anim.draw(ctx, L.x, L.y, { flash: L.flash > 0 });
        const h = G.Sprites.bodyHeight(L.dex, 1);
        if (L.state === 'wait') {
          // "!" que bota encima: está esperando a que lo toques.
          const by = L.y - h - 14 - Math.abs(Math.sin(now * 5)) * 6;
          ctx.save();
          ctx.font = '700 16px Pixelify, monospace'; ctx.textAlign = 'center';
          ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText('!', L.x, by);
          ctx.fillStyle = '#7dffb0'; ctx.fillText('!', L.x, by);
          ctx.restore();
        }
        const w = 30, y = L.y - h - 6;
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(L.x - w / 2, y, w, 3.4);
        ctx.fillStyle = '#5fe08a'; ctx.fillRect(L.x - w / 2, y, w * Math.max(0, L.hp / L.maxHp), 3.4);
      }
    };
    return out.concat(goal, mon);
  }

  /** Edge arrow towards the Lost Pet (or towards its home marker once it follows you). */
  function drawHud(ctx, w, h, pl, F) {
    const cam = G.Camera;
    if (lost) {
      const L = lost, to = L.state === 'wait' ? [L.x, L.y - 10] : [L.tx, L.ty];
      edgeArrow(ctx, w, h, cam, to[0], to[1], '#7dffb0', (L.state === 'wait' ? L.name : 'Home') + ' · ' +
                Math.round(G.U.dist(pl.x, pl.y, to[0], to[1]) / 32) + ' m', F);
    }
    for (const e of G.EnemyMgr.all()) {
      if (e.behavior === 'thief' && !e.dead) edgeArrow(ctx, w, h, cam, e.x, e.y - 10, '#ffd23f', e.name, F);
    }
    const cap = captain();
    if (cap && !cap.dead) edgeArrow(ctx, w, h, cam, cap.x, cap.y - 10, '#c9cdd1', cap.name, F);
    // Sea battles: an arrow to the dolphins or the guardians, and what's going on under the clock.
    let sea = null;
    if (pod && pod.t < SEA_POD) {
      edgeArrow(ctx, w, h, cam, pod.cx, pod.cy - 10, POD_COL, 'Dolphins', F);
      sea = ['DOLPHIN POD · ' + Math.ceil(SEA_POD - pod.t) + ' s', POD_COL];
    }
    // (A guest: the host's guardians, flagged seaPatrol.)
    const gl = guards ? guards.list : authority() ? null : G.EnemyMgr.all().filter(e => e.seaPatrol);
    if (gl && gl.length) {
      const live = gl.filter(e => !e.dead);
      if (live.length) edgeArrow(ctx, w, h, cam, live[0].x, live[0].y - 10, GUARD_COL, 'Guardian Patrol', F);
      sea = ['GUARDIAN PATROL · ' + live.length + ' left', GUARD_COL];
    }
    if (sea) {
      ctx.save();
      ctx.font = F(800, 12); ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      const y = cur && cur.id !== 'lost' ? 128 : 112;
      ctx.strokeText(sea[0], w / 2, y); ctx.fillStyle = sea[1]; ctx.fillText(sea[0], w / 2, y);
      ctx.restore();
    }
    if (cur && cur.id !== 'lost') {
      const left = Math.max(0, Math.ceil(cur.dur - cur.t));
      const txt = (cur.id === 'gold' ? 'EMERALD RUSH' : G.U.TYPE_NAME[cur.type].toUpperCase() + ' MOB SIEGE') + ' · ' + left + ' s';
      ctx.save();
      ctx.font = F(800, 12); ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(txt, w / 2, 112);
      ctx.fillStyle = cur.id === 'gold' ? '#ffd23f' : G.U.TYPE_COLOR[cur.type] || '#fff';
      ctx.fillText(txt, w / 2, 112);
      ctx.restore();
    }
  }

  /** The Pillager Captain (a guest: the host's, flagged captain). */
  function captain() {
    if (patrol) return patrol.cap;
    return authority() ? null : G.EnemyMgr.all().find(e => e.captain && !e.dead) || null;
  }

  function edgeArrow(ctx, w, h, cam, x, y, col, label, F) {
    const sx = (x - cam.left()) * cam.scale, sy = (y - cam.top()) * cam.scale;
    if (sx > 0 && sx < w && sy > 0 && sy < h) return;
    const M = 44, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
    const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
    const pulse = 0.65 + Math.sin(performance.now() / 160) * 0.35;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.moveTo(ca * 30, sa * 30);
    ctx.lineTo(Math.cos(a + 2.45) * 15, Math.sin(a + 2.45) * 15);
    ctx.lineTo(Math.cos(a - 2.45) * 15, Math.sin(a - 2.45) * 15);
    ctx.closePath();
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = F(800, 11);
    ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText(label, -ca * 26, -sa * 24 + 4);
    ctx.fillStyle = col; ctx.fillText(label, -ca * 26, -sa * 24 + 4);
    ctx.restore();
  }

  /** Ends the current event, the Lost Pet and any patrol without touching the schedule (dimension travel). */
  function abort() { cur = null; lost = null; patrol = null; pod = null; guards = null; }

  return {
    reset, abort, update, bag, onNet, drawables, drawHud,
    get golden() { return !!cur && cur.id === 'gold'; },
    get current() { return cur ? cur.id : null; },
    get patrol() { return patrol && { captain: patrol.cap, arriving: patrol.at > 0 }; },
    /** The Ocean's sea battle now: { kind: 'dolphins', left, dolphins } | { kind: 'guardians', n, left } | null. */
    get sea() {
      if (pod) return { kind: 'dolphins', left: Math.max(0, SEA_POD - pod.t), dolphins: pod.list.map(D => ({ x: D.x, y: D.y })) };
      if (guards) return { kind: 'guardians', n: guards.n, left: guards.list.filter(e => !e.dead).length, list: guards.list };
      return null;
    },
    /**
     * Para pruebas. 'patrol' = a Pillager Patrol right now (any time of day); 'dolphins' / 'guardians' =
     * that sea battle now; 'sea' = the next sea battle in turn.
     */
    debugStart(id) {
      if (id === 'patrol') { patrol = null; startPatrol(G.Game.everyone()); return; }
      if (id === 'sea' || id === 'dolphins' || id === 'guardians') {
        pod = null; guards = null;
        const k = id !== 'sea' ? id : lastSea === 'dolphins' ? 'guardians' : 'dolphins';
        return startSea(k, G.Game.everyone(), G.Game.st.time);
      }
      start(id, G.Game.st.time, G.Game.everyone());
    },
    debugThief() { spawnThief(G.Game.everyone(), G.Game.st.time); },
    _dbg() { return lost && { x: lost.x, y: lost.y, tx: lost.tx, ty: lost.ty, state: lost.state, hp: lost.hp }; }
  };
})();
