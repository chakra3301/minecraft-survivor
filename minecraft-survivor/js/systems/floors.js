/* ============ floors.js — the floors of a run, their goals, bosses and portals ============
 *
 * A run climbs every floor of G.DIMENSIONS, in order: Overworld → Ocean → Underworld → Nether →
 * Stronghold → The End → Ancient City → Herobrine's World. Each floor's `goal` decides how it
 * is cleared; clearing it opens the floor's `exit` portal (G.World.addPortal kinds 'dive' | 'cave' |
 * 'nether' | 'stronghold' | 'end' | 'gateway' | 'ancient'). Stepping in banks the pickups on the
 * ground, clears the map and starts the next floor at the origin (G.World.setDimension).
 *
 *   boss       a mid-boss at bossAt.mid (rolled from `midBoss`; none if the list is empty) and the
 *              floor boss at bossAt.floor (it waits up to a minute for a live mid-boss to fall).
 *              Overworld: the Raid (the Ravager comes with its `escort` of illagers and a bell).
 *              Underworld: the Ominous Trial (an ominous Breeze: tinted aura, tougher kit).
 *   elders     The Ocean (an `underwater` floor): `elders` Elder Guardians sit dormant in the Ocean
 *              Monument (G.World.monument.elders; a ring around you without one). They wake when you
 *              come within WAKE_R of it, when one is hit, or at bossAt.floor; each has ELDER_HP of a
 *              floor boss's health. The last one to fall is the floor boss (Ominous Key, exit portal).
 *              Its mid-boss is the Drowned Captain (`midName`), with its `midEscort` crew.
 *   portal     Stronghold: after `portalAt` s an Eye of Ender points to the End Portal room
 *              (G.World.portalRoom). Standing in it fills a bar over `hold` s (leaving pauses it)
 *              while silverfish burst out of the walls; then the End Portal activates.
 *   crystals   The End: the Ender Dragon arrives at bossAt.floor and can't be hurt while any End
 *              Crystal stands on the obsidian towers (systems/endfight.js). Its death opens an End Gateway.
 *   shriek     Ancient City: the warning level (0-4) rises every `shriekEvery` s and when you break
 *              sculk. Each shriek pulses Darkness. At 4 the Warden digs up next to you; its death
 *              lights the Ancient Portal (at G.World.ancientFrame).
 *   herobrine  Herobrine's World: always night (systems/daynight.js); a few seconds after you
 *              arrive Herobrine awakens (systems/judgment.js) and hunts you. Survive `surviveFor` s
 *              (counted from your arrival; the cinematic doesn't count) and a glowstone Aether portal
 *              builds itself AETHER_DIST tiles from you (G.World.buildAetherPortal: block by block over
 *              BUILD_T s; it can't be entered until it's `ready`). Herobrine keeps hunting until you
 *              step in: a white-gold flash, he fades (G.Judgment.ascend) and you reach...
 *   paradise   The Aether (systems/aether.js): the end of the game, not a floor (the floor counters
 *              say "of 8"). Nothing hurts you and nothing hostile spawns; the run ends as a victory.
 *
 * Boss health and damage follow the old boss curve at the current RUN time (G.Enemies.bossDef);
 * floor bosses have ×1.5 health and also drop an Ominous Key. The boss clocks wait inside a Trial
 * Chamber. Walking into another biome shows a small "— Desert —" banner (with a cooldown).
 *
 * Co-op (net/coop.js; ONLINE.md, "Co-op across floors"): the host runs every floor system and decides
 * travel. Any living player stepping into an open portal takes the whole team ('tv', then 'fl' i: each
 * computer runs the same go(i) on the same seed; downed players stand up on arrival). Portals ('po'),
 * floor banners ('bn'), floor bosses ('fd'), the Elder Guardians waking ('ew') and shrieks ('sk') are
 * sent as they happen, and every host frame carries netState() (floor, clock, warning level, Elder
 * Guardians, the portal room) for the guests' HUD. Goals count every player: any player's distance
 * wakes the Elder Guardians, anyone standing in the portal room fills its bar, a guest breaking sculk
 * makes the shriekers answer ('sc'), and the Ender Dragon unlocks enchanting for every player's partner.
 */
G.Floors = (() => {
  const PORTALS = {
    dive:       { name: 'Ocean Dive', opened: 'The sea opens: dive into the Ocean!', col: '#5fd3e8', dark: '#06222c', flash: '#0a3a52' },
    cave:       { name: 'Cave Entrance', opened: 'A cave entrance has opened!', col: '#e0c896', dark: '#1e160c', flash: '#000000' },
    nether:     { name: 'Nether Portal', opened: 'A Nether Portal has opened!', col: '#b48aff', dark: '#1a0b33', flash: '#c35bff' },
    stronghold: { name: 'Stronghold Gate', opened: 'The way to the Stronghold is open!', col: '#cfd6c4', dark: '#1c1c18', flash: '#101012' },
    end:        { name: 'End Portal', opened: 'The End Portal is open!', col: '#d6f08a', dark: '#0c1410', flash: '#0c0a1c' },
    gateway:    { name: 'End Gateway', opened: 'An End Gateway has opened!', col: '#e9d2ff', dark: '#120a1c', flash: '#05040a' },
    ancient:    { name: 'Ancient Portal', opened: 'The Ancient Portal is lit!', col: '#5ef0ff', dark: '#06161a', flash: '#020a0c' },
    // The way out of Herobrine's World: a glowstone frame of blue swirls (the Aether mod's portal). Slower travel.
    aether:     { name: 'Aether Portal', opened: 'A GLOWSTONE PORTAL OPENS', col: '#ffd95a', dark: '#2a2208', flash: '#fff4d6', tin: 1.6, tout: 2.4 }
  };
  const ENTER_R = 36;            // px from the portal's foot point that takes you through
  const ARM_T = 1.2;             // a new portal needs this long to light up before it takes anyone
  const T_IN = 0.6, T_OUT = 1;   // travel: fade to the portal colour, then flash back in
  const BIOME_HOLD = 0.8, BIOME_CD = 6;
  const ROOM_R = 120;            // Stronghold: portal room radius when the world doesn't say
  const WAVE_EVERY = 3.5;        // Stronghold: seconds between silverfish waves while you hold the room
  const SCULK_CD = 8;            // Ancient City: breaking sculk can't shriek more often than this
  const HERO_DELAY = 3.4;        // Herobrine's World: seconds between the banner and his cinematic
  const WAKE_R = 420;            // The Ocean: how close to the monument wakes the Elder Guardians
  const ELDER_HP = 0.6;          // ...each with this share of a floor boss's health
  const ELDER_RING = 640;        // ...placed this far around you when the world has no monument
  const AETHER_DIST = 7;         // Herobrine's World: the Aether portal builds this many tiles from you
  const BUILD_T = 2.5;           // ...glowstone block by glowstone block, over this long
  const SCULK = '#5ef0ff', OMEN = '#3ad6c6', PRISMARINE = '#7fd8c8';
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const r1 = v => Math.round(v);
  /** The living players (solo: just you). */
  const living = () => G.Game.everyone().filter(p => !p.dead);
  /** Solo: you. Co-op: a random living player (the host when everyone is down). */
  const someone = () => {
    if (!G.Coop.active) return G.Game.player;
    const ps = living();
    return ps.length ? G.U.pick(ps) : G.Game.player;
  };

  let seed = 1, idx = 0, dimT = 0, midKey = null;
  let arrivedAt = 0;             // run clock when you arrived on this floor (the leaderboard's Aether time)
  let midDone = false, floorSpawned = false, floorDead = false;
  let portal = null;             // { x, y, kind, t }
  let travel = null;             // { t, kind, done }
  let big = null;                // { title, sub, col, t, dur }
  let small = null;              // { text, t, dur }
  let biomeKey = null, shownKey = null, cand = null, candT = 0, biomeCd = 0;
  let room = null;               // Stronghold: { x, y, r, eye, held, inside, waveT, done }
  let warn = 0, shriekT = 0, shriekCd = 0, warden = false, lastShriek = null;   // Ancient City
  let heroT = -1;                // Herobrine's World: countdown to his awakening
  let elders = null;             // The Ocean: { list, n, awake, home: { x, y, r } }

  /** Floors of the climb: the Aether (goal 'paradise') is the ending, not a floor. */
  const FLOORS = () => G.DIMENSIONS.filter(d => d.goal !== 'paradise').length;

  const dimDef = () => G.DIMENSIONS[idx];
  const timedFloor = d => d.goal !== 'elders' && !!(d.floorBoss && d.bossAt && d.bossAt.floor != null);

  /** A new run: the Overworld, fresh terrain. */
  function reset(s) {
    seed = s | 0;
    travel = null; big = null; small = null; bigNext = [];
    enter(0);
  }

  /** Puts the world and the floor state in floor `i` (index in G.DIMENSIONS). */
  function enter(i) {
    idx = i; dimT = 0;
    // (Co-op: the team travels at once, before a queued banner of the last floor could show: drop it.)
    if (G.Coop.active) bigNext = [];
    arrivedAt = G.Game && G.Game.st ? G.Game.st.time : 0;
    const d = dimDef();
    floorSpawned = floorDead = false;
    portal = null; room = null; elders = null;
    warn = 0; shriekT = d.shriekEvery || 40; shriekCd = 0; warden = false; lastShriek = null;
    heroT = d.goal === 'herobrine' ? HERO_DELAY : -1;
    const mids = (d.midBoss || []).filter(k => G.Enemies.mob(k) && G.SPRITE_META[G.Enemies.mob(k).dex]);
    midKey = mids.length && d.bossAt && d.bossAt.mid != null ? G.U.pick(mids) : null;
    midDone = !midKey;
    if (G.World.clearPortals) G.World.clearPortals();
    if (G.World.setDimension) {
      G.World.setDimension(d.id, seed + i * 7919);
      G.World.setBiome(-1, true);
    } else G.World.setBiome(i === 0 ? 0 : d.id === 'nether' ? 2 : 1, true);      // (old 3-biome world)
    if (G.EndFight) G.EndFight.reset();
    biomeKey = shownKey = G.Enemies.biomeAt(0, 0); cand = null; biomeCd = BIOME_CD;
    // Sprites: this floor's bosses, its escort, and the mobs around the origin.
    const keys = [midKey, d.floorBoss, ...(d.escort || []), ...(d.midEscort || []), d.goal === 'portal' ? 'silverfish' : null];
    G.Sprites.preload(keys.map(k => k && (G.Enemies.mob(k) || {}).dex).filter(Boolean), 12000);
    G.Spawner.preloadAround(0, 0, G.Game.st.time, 80);
    const sub = 'Floor ' + (i + 1) + ' of ' + FLOORS();
    if (d.goal === 'herobrine') banner(d.banner, d.name + ' · ' + sub, d.col, HERO_DELAY);
    else if (d.goal === 'paradise') banner(d.banner, 'You survived Herobrine.', d.col, 6);
    else banner(d.name.toUpperCase(), sub, d.col || '#ffffff', 4);
    if (G.Aether) G.Aether.enter(d);
  }

  // ---------------- banners ----------------

  // `queue`: wait for the banner on screen to finish (the Enchanting unlock, then the portal).
  let bigNext = [];
  function banner(title, sub, col, dur = 4.2, queue = false) {
    const b = { title, sub, col, t: 0, dur };
    if (queue && big) bigNext.push(b); else big = b;
  }
  /** A banner the whole team sees (co-op: the host sends it as 'bn'). */
  function shout(title, sub, col, dur = 4.2, queue = false) {
    banner(title, sub, col, dur, queue);
    if (G.Coop.isHost) G.Coop.broadcast(['bn', title, sub, col, dur, queue ? 1 : 0]);
  }
  function biomeBanner(key) {
    const b = G.BIOME_DEFS[key];
    if (!b) return;
    small = { text: '— ' + b.name + ' —', t: 0, dur: 2.8 };
    shownKey = key; biomeCd = BIOME_CD;
    G.Audio.sfx('biome');
  }

  // ---------------- every frame ----------------

  function update(dt, pl, time) {
    if (big && (big.t += dt) >= big.dur) big = bigNext.shift() || null;
    if (small && (small.t += dt) >= small.dur) small = null;
    if (travel) { travelTick(dt); return; }
    if (portal) portal.t += dt;
    const d = dimDef();
    // Herobrine's World: the survival clock and the Aether portal keep going through his fight.
    if (d.goal === 'herobrine') { heroTick(dt, pl); return; }
    if (G.Rift.inArena || G.Judgment.active) return;

    trackBiome(dt, pl);
    if (d.goal === 'paradise') { dimT += dt; if (G.Aether) G.Aether.update(dt, pl); return; }

    // (Co-op: the host takes the team through when any living player steps in.)
    if (portal && portal.t >= ARM_T && authority() && steppedIn(portal)) { startTravel(); return; }

    dimT += dt;
    if (!authority()) return;              // guests: only the clock (the rest arrives from the host)
    if (!midDone && dimT >= d.bossAt.mid) spawnBoss('mid');
    if (!floorSpawned && timedFloor(d) && dimT >= d.bossAt.floor && (!G.EnemyMgr.bossAlive() || dimT >= d.bossAt.floor + 60)) spawnBoss('floor');
    if (d.goal === 'portal') roomTick(dt, pl);
    else if (d.goal === 'crystals' && G.EndFight) G.EndFight.update(dt, pl, d);
    else if (d.goal === 'shriek') shriekTick(dt);
    else if (d.goal === 'elders') eldersTick(pl);
  }

  // ---------------- Herobrine's World: survive, and the Aether portal ----------------

  /**
   * Every frame on Herobrine's World: his awakening, the survival clock (dimT, from your arrival) and the
   * Aether portal: built once dimT reaches `surviveFor`, ready once its glowstone frame stands.
   */
  function heroTick(dt, pl) {
    const d = dimDef();
    if (!G.Rift.inArena && !G.Judgment.active) trackBiome(dt, pl);
    if (portal && portal.kind === 'aether') {
      const was = portal.ready;
      portal.ready = portalReady(portal);
      if (portal.ready && !was) aetherOpen();
      if (portal.ready && portal.t - portal.readyAt >= ARM_T && authority() && steppedIn(portal)) { startTravel(); return; }
    }
    dimT += dt;
    if (!authority()) return;
    if (heroT >= 0 && (heroT -= dt) <= 0) { heroT = -1; G.Judgment.awaken(); }
    // (Co-op: built by a living player, the host first, when the host is down.)
    const by = !pl.dead ? pl : G.Coop.active ? living()[0] : null;
    if (!portal && dimT >= (d.surviveFor || 150) && by) buildAether(by);
  }

  /** A living player stands in the portal (solo: you; co-op, on the host: anyone). */
  function steppedIn(P) {
    return living().some(p => G.U.dist2(p.x, p.y, P.x, P.y) < ENTER_R * ENTER_R);
  }

  /** Free ground AETHER_DIST tiles from you, away from Herobrine when possible. → [x, y] */
  function aetherSpot(pl) {
    const ts = G.World.TS || G.Tiles.T * G.Sprites.PX, A = G.Judgment.herobrine;
    const away = A ? Math.atan2(pl.y - A.y, pl.x - A.x) : Math.random() * 6.2832;
    for (let i = 0; i < 64; i++) {
      // Fan out from "away from him", then widen the distance a little.
      const a = away + (i % 2 ? 1 : -1) * Math.floor((i + 1) / 2) * 0.35, r = ts * (AETHER_DIST + Math.floor(i / 18) * 0.7 - (i % 3) * 0.6);
      // Not straight below you, where the hotbar would hide it (unless nothing else is free).
      if (i < 48 && Math.sin(a) > 0.72) continue;
      const x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r;
      if (G.World.isFree(x, y, 34) && (!G.World.walkable || G.World.walkable(Math.floor(x / ts), Math.floor(y / ts)))) return [x, y];
    }
    return [pl.x + ts * AETHER_DIST, pl.y];
  }

  /**
   * The Aether portal starts building (the survival clock ran out, or the dev panel). The world builds its
   * glowstone frame block by block (G.World.buildAetherPortal); without that, addPortal after BUILD_T.
   */
  function buildAether(pl, at = null) {
    if (portal) return portal;
    const [x, y] = at || aetherSpot(pl);
    const ref = typeof G.World.buildAetherPortal === 'function' ? G.World.buildAetherPortal(x, y) : null;
    portal = { x: ref ? ref.x : x, y: ref ? ref.y : y, kind: 'aether', t: 0, ref, built: 0, ready: false, at: performance.now() / 1000 };
    G.Spawner.say('Glowstone rises from the ground…', 2.4, true);
    G.Audio.sfx('reveal', { rarity: 5 });
    if (G.Coop.isHost) G.Coop.broadcast(['po', 'aether', r1(x), r1(y), 2]);
    return portal;
  }

  /** Ready to enter: the world's `ready` flag when it reports one, else once BUILD_T has passed (then addPortal). */
  function portalReady(P) {
    if (P.ready) return true;
    if (P.ref && typeof P.ref.ready === 'boolean') return P.ref.ready;
    if (P.t < BUILD_T) return false;
    if (!P.ref && !P.added && typeof G.World.addPortal === 'function') {
      P.added = G.World.addPortal(P.x, P.y, 'aether');
      if (P.added) { P.x = P.added.x; P.y = P.added.y; }
    }
    return true;
  }

  /** The glowstone frame stands: banner, a warm chime, and a little time before it takes anyone. */
  function aetherOpen() {
    portal.readyAt = portal.t;
    banner(PORTALS.aether.opened, 'Reach it! Herobrine is still hunting you', PORTALS.aether.col, 4.4);
    G.Audio.sfx('chime');
    G.FX.ring(portal.x, portal.y, 8, 160, PORTALS.aether.col, 0.9, 6);
    G.FX.burst(portal.x, portal.y - 40, '#fff4c8', 30, 220);
  }

  /** Biome under the player: it must hold for a moment, and banners keep a cooldown. */
  function trackBiome(dt, pl) {
    biomeCd -= dt;
    const k = G.World.biomeKeyAt ? G.World.biomeKeyAt(pl.x, pl.y) : null;
    if (k && G.BIOME_DEFS[k] && k !== biomeKey) {
      if (k !== cand) { cand = k; candT = 0; }
      if ((candT += dt) >= BIOME_HOLD) { biomeKey = k; cand = null; }
    } else cand = null;
    if (biomeKey !== shownKey && biomeCd <= 0) biomeBanner(biomeKey);
  }

  // ---------------- bosses ----------------

  /** Spawns this floor's 'mid' or 'floor' boss (at [x, y], or just off-screen); `setup(e)` runs before its kit starts. */
  function spawnBoss(kind, at = null, setup = null) {
    const d = dimDef();
    const p = G.Enemies.mob(kind === 'floor' ? d.floorBoss : midKey);
    if (kind === 'mid') midDone = true;
    else { floorSpawned = true; midDone = true; }
    if (!p || !G.SPRITE_META[p.dex]) return null;
    const t = G.Game.st.time;
    const e = G.Spawner.spawnBoss(G.Enemies.bossDef(p, t, kind), t, at, true);
    if (kind === 'mid') {
      e.midBoss = true;
      if (d.midName) e.name = d.midName;
      G.Coop.enemyFlags(e);
      G.BossKits.ensure(e);
      if (d.midEscort && d.midEscort.length) raid(e, d.midEscort, false);
      shout('THE ' + e.name.toUpperCase() + ' APPROACHES', 'Mid-floor boss of ' + d.name, '#ffcb3d', 3.6);
      return e;
    }
    e.floorBoss = true;
    if (setup) setup(e);
    const next = d.exit && PORTALS[d.exit];
    let sub = next ? 'Floor boss · defeat it to open the ' + next.name : 'Floor boss';
    if (d.ominous) {
      e.ominous = true;
      e.name = 'Ominous ' + e.name;
    }
    G.Coop.enemyFlags(e);
    G.BossKits.ensure(e);
    if (d.escort && d.escort.length) raid(e, d.escort);
    if (d.goal === 'crystals' && G.EndFight && G.EndFight.left > 0) sub = 'Invulnerable while the End Crystals stand: destroy them!';
    shout(d.banner, sub, d.ominous ? OMEN : '#ff6b6b', 4.6);
    return e;
  }

  /** The Raid: the floor boss brings its band (normal mobs of the current tier) and the bell rings (`bell`). */
  function raid(boss, keys, bell = true) {
    const t = G.Game.st.time, ti = G.Enemies.tierAt(t), sc = G.Enemies.scale(t);
    keys.forEach((k, i) => {
      const p = G.Enemies.mob(k);
      if (!p || !G.SPRITE_META[p.dex]) return;
      const a = i / keys.length * 6.2832, x = boss.x + Math.cos(a) * 70, y = boss.y + Math.sin(a) * 52;
      const m = new G.Enemy(G.Enemies.defFor(p, G.Enemies.TIERS[ti], ti), x, y, sc);
      m.raider = true;
      G.EnemyMgr.add(m);
      G.FX.burst(x, y - 12, bell ? '#9a8a6a' : '#8fd0ff', 8, 90);
    });
    if (!bell) return;
    G.Audio.sfx('toll');
    setTimeout(() => G.Audio.sfx('reveal', { rarity: 4 }), 450);
    setTimeout(() => G.Audio.sfx('reveal', { rarity: 4 }), 900);
  }

  /** The floor boss fell (Enemy.die, on whoever runs the enemies). */
  function bossDown(e) {
    if (floorDead) return;
    floorDead = true;
    const d = dimDef();
    G.Progress.event('floorBoss', { dim: d.id, dex: e.dex });
    // Co-op: every guest counts it too (achievements, missions) and, on The End, unlocks its own partner.
    if (G.Coop.isHost) G.Coop.broadcast(['fd', d.id, e.dex]);
    // The Ender Dragon unlocks the Enchanting Table for the partner that beat it (systems/enchanting.js);
    // in co-op, for every player's partner (each on their own save).
    const ench = d.id === 'end' && slayed();
    if (!d.exit) return;
    const frame = d.exit === 'ancient' && G.World.ancientFrame;
    openPortal(frame ? frame.x : e.x, frame ? frame.y : e.y, d.exit, !!frame);
    if (d.goal === 'elders') shout('THE MONUMENT IS SILENT', PORTALS[d.exit].opened + ' Follow the arrow and step inside', PORTALS[d.exit].col, 5);
    else shout(PORTALS[d.exit].opened, 'Follow the arrow and step inside', PORTALS[d.exit].col, 5, !!ench || (G.Coop.active && d.id === 'end'));
    G.Audio.sfx('rift');
  }

  /** The Ender Dragon fell: enchanting unlocks for your partner (the banner, if it's new). → unlocked now */
  function slayed() {
    const pl = G.Game.player;
    const ench = !!pl && G.Enchanting.slay(pl.dex);
    if (ench) {
      banner('ENCHANTING UNLOCKED FOR ' + pl.mon.name.toUpperCase() + '!', 'Enchant its weapons at the Enchanting Table, in the main menu', '#c77dff', 5);
      G.Audio.sfx('legend');
    }
    return ench;
  }

  // ---------------- The Ocean: the Elder Guardians of the Ocean Monument ----------------

  /** The monument (or, without one, the point the fallback ring circles). */
  function monument() {
    const M = G.World.monument;
    return M && M.x != null ? M : null;
  }

  /** Puts the floor's Elder Guardians, dormant, on the monument's spots (or in a ring around you). */
  function setupElders(pl) {
    const d = dimDef(), p = G.Enemies.mob(d.floorBoss), n = d.elders || 3, M = monument();
    elders = { list: [], n, awake: false, home: null };
    if (!p || !G.SPRITE_META[p.dex]) return;
    let spots = M && M.elders && M.elders.length ? M.elders.slice(0, n).map(s => [s.x, s.y]) : null;
    if (!spots || spots.length < n) {
      const a0 = (seed % 628) / 100;
      spots = Array.from({ length: n }, (_, i) => [pl.x + Math.cos(a0 + i * 6.2832 / n) * ELDER_RING, pl.y + Math.sin(a0 + i * 6.2832 / n) * ELDER_RING * 0.8]);
    }
    elders.home = M ? { x: M.x, y: M.y, r: M.r || 0 } : null;      // (the fallback ring has no monument to wake them)
    const t = G.Game.st.time;
    for (const [x, y] of spots) {
      const e = new G.Enemy(G.Enemies.bossDef(p, t, 'floor'), x, y, G.Enemies.bossScale(t), true);
      e.elder = true; e.dormant = true;
      G.EnemyMgr.add(e);
      elders.list.push(e);
    }
    G.Sprites.preload([p.dex], 12000);
  }

  function eldersTick(pl) {
    if (!elders) setupElders(pl);
    if (elders.awake || !elders.list.length) return;
    const H = elders.home, d = dimDef();
    // Any living player's distance wakes them (co-op: the guests' copies on the host).
    const near = living().some(p => (H && G.U.dist2(p.x, p.y, H.x, H.y) < (WAKE_R + H.r) ** 2) ||
      elders.list.some(e => !e.dead && G.U.dist2(p.x, p.y, e.x, e.y) < WAKE_R * WAKE_R));
    const clock = dimT >= d.bossAt.floor && (!G.EnemyMgr.bossAlive() || dimT >= d.bossAt.floor + 60);
    if (near || clock) wakeElders();
  }

  /**
   * The Elder Guardians wake (you came close, one was hit, or the floor clock ran out): their
   * health and damage follow the run clock now, each with ELDER_HP of a floor boss's health.
   */
  function wakeElders() {
    // (A guest hitting a sleeping copy: the hit goes to the host, who wakes them and says so: 'ew'.)
    if (!elders || elders.awake || !authority()) return;
    elders.awake = true; floorSpawned = true; midDone = true;
    const d = dimDef(), p = G.Enemies.mob(d.floorBoss), t = G.Game.st.time;
    const b = G.Enemies.bossDef(p, t, 'floor'), sc = G.Enemies.bossScale(t);
    for (const e of elders.list) {
      if (e.dead) continue;
      const k = e.hp / e.maxHp, max = Math.max(1, Math.round(b.hp * sc.hp * ELDER_HP));
      e.def = Object.assign({}, e.def, b);
      e.maxHp = max; e.hp = Math.max(1, Math.round(max * k));
      e.dmg = b.dmg * sc.dmg; e.xp = Math.round(b.xp * ELDER_HP);
      e.dormant = false;
      G.Coop.enemyFlags(e);
      G.BossKits.ensure(e);
      G.FX.ring(e.x, e.y, e.r, e.r * 6, PRISMARINE, 0.7, 5);
      G.FX.burst(e.x, e.y - e.bodyH * 0.5, '#d8fff4', 18, 160);
    }
    const left = elders.list.filter(e => !e.dead).length;
    const next = PORTALS[d.exit];
    if (G.Coop.isHost) G.Coop.broadcast(['ew']);
    shout(d.banner, 'Defeat all ' + left + (next ? ' to open the ' + next.name : ''), '#ff6b6b', 4.6);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
  }

  /** Guest: the host's Elder Guardians wake (their copies stop sleeping; the banner comes as 'bn'). */
  function netWake() {
    if (elders) elders.awake = true;
    for (const e of G.EnemyMgr.all()) {
      if (!e.elder || e.dead) continue;
      e.dormant = false;
      G.FX.ring(e.x, e.y, e.r, e.r * 6, PRISMARINE, 0.7, 5);
      G.FX.burst(e.x, e.y - e.bodyH * 0.5, '#d8fff4', 18, 160);
    }
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
  }

  /**
   * An Elder Guardian fell (Enemy.die, before its floor-boss loot): the last one becomes the floor
   * boss, so it drops the Ominous Key, counts once as a floor boss and opens the exit (bossDown).
   */
  function elderDown(e) {
    if (!elders) return;
    if (!elders.awake) wakeElders();
    const left = elders.list.filter(o => !o.dead).length;
    if (left > 0) {
      G.Spawner.say('An Elder Guardian falls! ' + left + ' left', 2.6);
      return;
    }
    e.floorBoss = true;
  }

  /** Opens a portal on free ground near (x, y) (`exact`: right there, the world built a frame for it). */
  function openPortal(x, y, kind, exact = false) {
    let at = [x, y];
    for (let i = 0; i < 48 && !exact; i++) {
      const d = i ? 24 + i * 7 : 0, a = i * 2.39;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (G.World.isFree(px, py, 30)) { at = [px, py]; break; }
    }
    const ref = G.World.addPortal ? G.World.addPortal(at[0], at[1], kind) : null;
    portal = { x: ref ? ref.x : at[0], y: ref ? ref.y : at[1], kind, t: 0 };
    G.FX.ring(portal.x, portal.y, 8, 120, PORTALS[kind].col, 0.8, 6);
    // Co-op: the guests open the same portal (the world is the same: addPortal lands on the same tile).
    if (G.Coop.isHost) G.Coop.broadcast(['po', kind, r1(at[0]), r1(at[1]), 0]);
    return portal;
  }

  // ---------------- Stronghold: the End Portal room ----------------

  /** Where the portal room is: the world's, or a fallback point a fair walk from the origin. */
  function roomAt() {
    const pr = G.World.portalRoom;
    if (pr) return { x: pr.x, y: pr.y, r: pr.r || ROOM_R };
    if (room && room.x != null) return room;
    const a = (seed % 628) / 100;
    for (let i = 0; i < 40; i++) {
      const x = Math.cos(a + i * 0.4) * 1500, y = Math.sin(a + i * 0.4) * 1100;
      if (G.World.isFree(x, y, 40)) return { x, y, r: ROOM_R };
    }
    return { x: 1500, y: 0, r: ROOM_R };
  }

  function roomTick(dt, pl) {
    const d = dimDef();
    if (!room) room = { eye: false, held: 0, inside: false, waveT: 1.2, done: false };
    if (room.done) return;
    Object.assign(room, roomAt());
    if (!room.eye) {
      if (dimT < (d.portalAt || 0)) return;
      room.eye = true;
      G.Spawner.say('An Eye of Ender floats toward the End Portal room…', 3.4);
      G.Audio.sfx('reveal', { rarity: 5 });
    }
    // Anyone standing in it holds it (co-op: any living player).
    const inside = living().some(p => G.U.dist2(p.x, p.y, room.x, room.y) < room.r * room.r);
    if (inside && !room.inside) G.Spawner.say(room.held ? 'Back in the portal room: keep holding it!' : 'Hold the portal room! Silverfish pour out of the walls', 2.8);
    room.inside = inside;
    if (!inside) return;
    room.held += dt;
    if ((room.waveT -= dt) <= 0) { room.waveT = WAVE_EVERY; silverfish(); }
    if (room.held >= (d.hold || 20)) roomDone();
  }

  /** A wave of silverfish bursting out of the walls around the portal room. */
  function silverfish() {
    const p = G.Enemies.mob('silverfish');
    if (!p || G.EnemyMgr.count > G.Spawner.CAP + 20) return;
    const t = G.Game.st.time, ti = G.Enemies.tierAt(t), sc = G.Enemies.scale(t);
    const n = 3 + Math.round(4 * room.held / (dimDef().hold || 20));
    for (let i = 0; i < n; i++) {
      // Out of the nearest wall along a random ray (or from the edge of the room).
      const a = Math.random() * 6.2832, ca = Math.cos(a), sa = Math.sin(a);
      let x = room.x + ca * (room.r + 110), y = room.y + sa * (room.r + 110);
      for (let r = room.r * 0.6; r < room.r + 420; r += 16) {
        if (G.World.isWall(room.x + ca * r, room.y + sa * r)) { x = room.x + ca * (r - 18); y = room.y + sa * (r - 18); break; }
      }
      const m = new G.Enemy(G.Enemies.defFor(p, G.Enemies.TIERS[ti], ti), x, y, sc);
      G.EnemyMgr.add(m);
      G.FX.burst(x, y - 8, '#8c8c8c', 10, 120);
      G.FX.ring(x, y, 4, 26, '#b8b8b0', 0.3, 2);
    }
    G.Audio.sfx('break');
  }

  function roomDone() {
    if (!room || room.done) return;
    room.done = true;
    const ref = G.World.activatePortalRoom ? G.World.activatePortalRoom() : null;
    if (ref && ref.x != null) {
      portal = { x: ref.x, y: ref.y, kind: 'end', t: 0 };
      G.FX.ring(portal.x, portal.y, 8, 160, PORTALS.end.col, 0.9, 6);
    } else openPortal(room.x, room.y, 'end', true);
    if (G.Coop.isHost && ref && ref.x != null) G.Coop.broadcast(['po', 'end', r1(room.x), r1(room.y), 1]);
    shout(PORTALS.end.opened, 'Step into the End Portal', PORTALS.end.col, 5);
    G.Game.flash('#d6f08a', 0.5);
    G.Audio.sfx('legend');
  }

  // ---------------- Ancient City: shriekers and the Warden ----------------

  function shriekTick(dt) {
    if (warden) return;
    shriekCd -= dt;
    if ((shriekT -= dt) <= 0) shriek();
  }

  /** A sculk shrieker sounds (at x, y; by default somewhere near you): the warning level rises. */
  function shriek(x, y) {
    if (warden || warn >= 4) return;
    const pl = someone();
    if (x == null) { const a = Math.random() * 6.2832; x = pl.x + Math.cos(a) * 170; y = pl.y + Math.sin(a) * 130; }
    warn++;
    shriekT = dimDef().shriekEvery || 40; shriekCd = SCULK_CD;
    // (Co-op: Darkness reaches the guests through their copies, Player.addEffect.)
    for (const p of G.Game.everyone()) if (!p.dead) p.addEffect('darkness', 6);
    if (G.Coop.isHost) G.Coop.broadcast(['sk', r1(x), r1(y), warn]);
    shriekFx(x, y);
    G.Spawner.say('Warning level ' + warn + '!', 2.6);
    if (warn >= 4) emerge();
  }

  /** What a shriek looks and sounds like (on every computer). */
  function shriekFx(x, y) {
    lastShriek = { x, y, t: performance.now() / 1000 };
    for (let i = 0; i < 3; i++) G.FX.ring(x, y - 10, 6 + i * 14, 180 + i * 90, i % 2 ? '#0d2b33' : SCULK, 0.7 + i * 0.25, 5 - i);
    G.FX.burst(x, y - 14, SCULK, 18, 160);
    G.Camera.kick(0.7);
    G.Audio.sfx('judge');
  }

  /** Warning level 4: the Warden digs up next to you (bosskits.js plays the emergence). */
  function emerge() {
    warden = true;
    const pl = someone();
    let at = [pl.x + 150, pl.y];
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 6.2832, x = pl.x + Math.cos(a) * 160, y = pl.y + Math.sin(a) * 120;
      if (G.World.isFree(x, y, 30)) { at = [x, y]; break; }
    }
    spawnBoss('floor', at, e => { e.emerge = true; e.hidden = true; });
    G.Audio.sfx('quake');
  }

  /** The world (or a broken prop) reports sculk breaking at (x, y): shriekers answer. */
  function sculkBroken(x, y) {
    if (dimDef().goal !== 'shriek' || warden || G.Rift.inArena) return;
    // Co-op: a guest's sculk counts on the host.
    if (G.Coop.active && !G.Coop.isHost) { G.Coop.toHost(['sc', r1(x), r1(y)]); return; }
    if (shriekCd > 0) return;
    shriek(x, y);
  }

  // Breaking a sculk prop (sensor, shrieker, catalyst…) wakes the shriekers. The world may also call
  // G.Floors.sculkBroken itself; each prop only counts once.
  const seenProps = new WeakSet();
  const isSculk = p => /sculk|shriek|sensor|catalyst/i.test([p.type, p.deco, p.name, p.key, p.tex, p.obj && p.obj.kind,
    p.obj && p.obj.top, p.obj && p.obj.side].filter(v => typeof v === 'string').join(' '));
  if (G.World.damageProp) {
    const dp = G.World.damageProp;
    G.World.damageProp = function (p, ...a) {
      const gone = dp.call(this, p, ...a);
      if (gone && p && !seenProps.has(p)) { seenProps.add(p); if (isSculk(p)) sculkBroken(p.x, p.y); }
      return gone;
    };
  }

  // ---------------- travel ----------------

  /** `net`: a guest following the host through (it waits for the host's 'fl' to land). */
  function startTravel(kind = portal.kind, net = false) {
    travel = { t: 0, kind, done: false, net };
    if (G.Coop.isHost) G.Coop.broadcast(['tv', kind]);
    if (kind === 'aether') {
      // Into the light: Herobrine roars and fades, his boss mobs vanish.
      travel.judge = G.Judgment.ascend();
      G.Audio.sfx('chime');
    } else G.Audio.sfx('rift');
  }

  function travelTick(dt) {
    travel.t += dt;
    const P = PORTALS[travel.kind];
    // (A guest waits under the fade for the host's 'fl'; if it never comes, the fade lifts.)
    if (travel.net) { if (travel.t > (P.tin || T_IN) + 6) travel = null; return; }
    if (travel.done || travel.t < (P.tin || T_IN)) return;
    travel.done = true;
    arrive(travel);
    go(idx + 1);
    G.Game.flash(P.flash, P.tout || T_OUT);
    travel = null;
  }

  /** Through the portal, before the next floor: the pickups on the ground are banked; out of Herobrine's World, his fight ends. */
  function arrive(T) {
    if (G.Game.bankPickups) G.Game.bankPickups();
    if (T.kind === 'aether') {
      // How long you lasted against Herobrine counts (stats.judgeTime) and shows in the victory summary.
      if (T.judge) G.Progress.event('judgeEnd', T.judge);
      if (G.Aether) G.Aether.herobrine = T.judge;
      G.Judgment.reset();
    }
  }

  /** Clears the map and moves everyone to the origin of floor `i`. */
  function go(i) {
    if (i < 0 || i >= G.DIMENSIONS.length) return;
    // Co-op: the host takes the team along; each guest runs this same go(i) ('fl').
    if (G.Coop.isHost) G.Coop.broadcast(['fl', i]);
    G.EnemyMgr.clear();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();
    G.Pickups.clear();
    G.Path.clear();
    G.Rift.reset();
    G.Events.abort();
    G.Weather.clear();
    enter(i);
    // Everyone lands at the origin (the Aether: the world's arrival point by its portal, when it gives one).
    const sp = dimDef().goal === 'paradise' && G.World.aetherSpawn, o = sp && sp.x != null ? sp : { x: 0, y: 0 };
    const ps = G.Game.everyone(), coop = G.Coop.active, n = coop ? G.Coop.members.length : ps.length;
    // (Co-op: each in their team slot, the same on every computer.)
    ps.forEach((p, k) => {
      const s = coop ? G.Coop.slot(p) : k;
      p.x = o.x + (s - (n - 1) / 2) * 34; p.y = o.y;
      if (p.net) { p.net.x = p.x; p.net.y = p.y; }      // (a mate's copy: don't slide back before their next frame)
    });
    const pl = G.Game.player;
    // Co-op: nobody is left behind; a downed player stands up on the new floor.
    if (coop && pl.dead) pl.revive(0.5);
    G.Camera.x = pl.x; G.Camera.y = pl.y;
    G.Progress.event('dimension', { id: dimDef().id, floor: i + 1 });
    G.Audio.sfx('legend');
  }

  // ---------------- co-op ----------------

  /**
   * Host: what the guests' HUD needs, in every frame: [floor, floor clock, warning level, seconds to the
   * next shriek, Elder Guardians [n, left, awake] | 0, portal room [held, eye, inside, done] | 0].
   */
  function netState() {
    const E = elders && dimDef().goal === 'elders' ? [elders.n, elders.list.filter(e => !e.dead).length, elders.awake ? 1 : 0] : 0;
    const R = room && room.x != null ? [Math.round(room.held * 10) / 10, room.eye ? 1 : 0, room.inside ? 1 : 0, room.done ? 1 : 0] : 0;
    return [idx, Math.round(dimT * 10) / 10, warn, Math.round(shriekT * 10) / 10, E, R];
  }

  /** Guest: the host's floor state (every frame). */
  function netApply(s) {
    if (!Array.isArray(s)) return;
    // A missed travel (never on an ordered channel, but cheap to mend): follow the host.
    if (s[0] !== idx && s[0] >= 0 && s[0] < G.DIMENSIONS.length) { netGo(s[0]); return; }
    if (Math.abs(s[1] - dimT) > 0.5) dimT = s[1];
    const d = dimDef();
    if (d.goal === 'shriek') { warn = s[2]; shriekT = s[3]; warden = warn >= 4; }
    if (d.goal === 'elders' && s[4]) {
      if (!elders) { const M = monument(); elders = { list: [], net: true, home: M ? { x: M.x, y: M.y, r: M.r || 0 } : null }; }
      elders.n = s[4][0]; elders.left = s[4][1]; elders.awake = !!s[4][2];
    }
    if (d.goal === 'portal' && s[5]) {
      room = Object.assign(room || { waveT: 0 }, roomAt(), { held: s[5][0], eye: !!s[5][1], inside: !!s[5][2], done: !!s[5][3] });
    }
  }

  /** Guest: the host's floor events ('fl' 'tv' 'po' 'bn' 'fd' 'ew' 'sk', see coop.js). */
  function onNet(ev) {
    switch (ev[0]) {
      case 'fl': netGo(ev[1]); break;
      case 'tv': if (!travel) startTravel(ev[1], true); break;
      case 'po': netPortal(ev[1], ev[2], ev[3], ev[4]); break;
      case 'bn': banner(ev[1], ev[2], ev[3], ev[4], !!ev[5]); break;
      case 'fd':
        G.Progress.event('floorBoss', { dim: ev[1], dex: ev[2] });
        if (ev[1] === 'end') slayed();
        break;
      case 'ew': netWake(); break;
      case 'sk': warn = Math.max(warn, ev[3]); warden = warn >= 4; shriekFx(ev[1], ev[2]); break;
    }
  }

  /** Guest: the team lands on floor `i` (after the portal fade, if one was playing). */
  function netGo(i) {
    const T = travel;
    travel = null;
    if (T && T.net && !T.done) arrive(T);
    go(i);
    if (T) G.Game.flash(PORTALS[T.kind].flash, PORTALS[T.kind].tout || T_OUT);
  }

  /** Guest: the host's portal opened at (x, y) (mode 0 a portal there, 1 the Stronghold's room, 2 the Aether portal builds). */
  function netPortal(kind, x, y, mode) {
    if (!PORTALS[kind]) return;
    if (mode === 2) { portal = null; buildAether(G.Game.player, [x, y]); return; }
    if (mode === 1) {
      room = Object.assign(room || { waveT: 0, held: 0, inside: false }, roomAt(), { eye: true, done: true });
      const ref = G.World.activatePortalRoom ? G.World.activatePortalRoom() : null;
      if (ref && ref.x != null) {
        portal = { x: ref.x, y: ref.y, kind: 'end', t: 0 };
        G.FX.ring(portal.x, portal.y, 8, 160, PORTALS.end.col, 0.9, 6);
      } else openPortal(x, y, 'end', true);
      G.Game.flash('#d6f08a', 0.5);
      G.Audio.sfx('legend');
      return;
    }
    openPortal(x, y, kind, true);
    G.Audio.sfx('rift');
  }

  // ---------------- drawing ----------------

  /** World-space extras sorted by Y with the scene: the ominous aura, the portal room, the fallback portal. */
  function drawables() {
    const out = [];
    const now = performance.now() / 1000;
    // The Aether portal when the world can't build one itself: a glowstone frame rising block by block.
    if (portal && portal.kind === 'aether' && !portal.ref) out.push({ y: portal.y, draw: ctx => drawGlowstone(ctx, portal, now) });
    if (portal && !G.World.addPortal) {
      const P = portal;
      out.push({ y: P.y, draw(ctx) {
        const img = G.Tiles.propSprite(0, 'rift', Math.floor(P.t * 12) % 32);
        const S = G.Sprites.PX, w = img.width * S, h = img.height * S;
        ctx.drawImage(img, Math.round(P.x - w / 2), Math.round(P.y - h + 4), w, h);
      } });
    }
    // The Ominous Trial: a teal omen aura under the boss, with rising sparks.
    for (const e of G.EnemyMgr.all()) {
      if (!e.ominous || e.dead || e.hidden) continue;
      out.push({ y: e.y - 0.5, draw(ctx) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.scale(1, 0.38);
        const R = e.r * 2.3 + Math.sin(now * 3) * 4;
        const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
        g.addColorStop(0, 'rgba(10,40,48,0.55)'); g.addColorStop(0.7, 'rgba(58,214,198,0.28)'); g.addColorStop(1, 'rgba(58,214,198,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(120,255,236,0.55)'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { const a = now * (1.2 + i * 0.4) + i * 2.1; ctx.beginPath(); ctx.arc(0, 0, R * (0.55 + i * 0.15), a, a + 1.6); ctx.stroke(); }
        ctx.restore();
        if (Math.random() < 0.35) G.FX.px(e.x + G.U.rand(-e.r, e.r), e.y - G.U.rand(0, e.bodyH), Math.random() < 0.7 ? OMEN : '#0d2b33', { vy: -50, life: 0.7 });
      } });
    }
    // The End Portal room: a ring on the floor while the Eye of Ender points at it, filling as you hold it.
    if (room && room.eye && !room.done && room.x != null) {
      const R = room, d = dimDef();
      out.push({ y: R.y - 4000, draw(ctx) {
        const k = G.U.clamp(R.held / (d.hold || 20), 0, 1);
        ctx.save();
        ctx.translate(R.x, R.y);
        ctx.scale(1, 0.55);
        ctx.globalAlpha = 0.18 + (R.inside ? 0.12 : 0) + Math.sin(now * 3) * 0.05;
        ctx.fillStyle = '#2c5a3c';
        ctx.beginPath(); ctx.arc(0, 0, R.r, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.beginPath(); ctx.arc(0, 0, R.r, 0, 6.2832); ctx.stroke();
        ctx.strokeStyle = '#d6f08a';
        ctx.setLineDash([14, 10]); ctx.lineDashOffset = -now * 30;
        ctx.beginPath(); ctx.arc(0, 0, R.r, 0, 6.2832); ctx.stroke();
        ctx.setLineDash([]);
        if (k > 0) { ctx.strokeStyle = '#7cff6a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, R.r - 8, -Math.PI / 2, -Math.PI / 2 + k * 6.2832); ctx.stroke(); }
        ctx.restore();
      } });
      out.push({ y: R.y, draw(ctx) {
        // The Eye of Ender hovers over the room.
        const img = eyeImg();
        if (!img) return;
        const by = R.y - 70 - Math.sin(now * 2.4) * 6;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.35; ctx.fillStyle = '#7cff6a';
        ctx.beginPath(); ctx.arc(R.x, by, 20, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.drawImage(img, Math.round(R.x - 16), Math.round(by - 16), 32, 32);
        ctx.restore();
        if (Math.random() < 0.2) G.FX.px(R.x + G.U.rand(-10, 10), by + G.U.rand(-8, 8), '#b06bff', { vy: 20, life: 0.6 });
      } });
    }
    return out;
  }

  const glow = new Image();
  glow.src = 'assets/mc/blocks/glowstone.png';
  /**
   * A standing glowstone frame (the Aether mod's portal: 4 wide, 5 tall, blue swirls inside) at P's foot point.
   * Blocks appear one by one over BUILD_T, bottom to top; the swirl fills once it stands.
   */
  function drawGlowstone(ctx, P, now) {
    const B = 16 * G.Sprites.PX, x0 = Math.round(P.x - B * 2), y0 = Math.round(P.y - B * 5);
    const ring = [];
    for (let i = 0; i < 4; i++) ring.push([i, 4]);
    for (let j = 3; j >= 1; j--) ring.push([0, j], [3, j]);
    for (let i = 0; i < 4; i++) ring.push([i, 0]);
    const k = G.U.clamp(P.t / BUILD_T, 0, 1), n = P.ready ? ring.length : Math.floor(k * ring.length);
    ctx.save();
    if (P.ready) {
      // The blue swirl of the Aether portal, with a soft golden halo.
      const sw = ctx.createLinearGradient(0, y0 + B, 0, y0 + B * 4);
      sw.addColorStop(0, 'rgba(150,215,255,0.85)'); sw.addColorStop(1, 'rgba(80,150,240,0.85)');
      ctx.fillStyle = sw;
      ctx.fillRect(x0 + B, y0 + B, B * 2, B * 3);
      ctx.strokeStyle = 'rgba(230,248,255,0.7)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = now * (1.4 + i * 0.5) + i * 2;
        ctx.beginPath(); ctx.ellipse(x0 + B * 2, y0 + B * 2.5, B * (0.3 + i * 0.25), B * (0.5 + i * 0.35), 0, a, a + 2.2); ctx.stroke();
      }
    }
    ctx.imageSmoothingEnabled = false;
    for (let q = 0; q < n; q++) {
      const [i, j] = ring[q], x = x0 + i * B, y = y0 + j * B;
      if (glow.complete && glow.naturalWidth) ctx.drawImage(glow, x, y, B, B);
      else { ctx.fillStyle = '#e8c060'; ctx.fillRect(x, y, B, B); }
    }
    ctx.restore();
    if (!P.ready && Math.random() < 0.5) G.FX.px(x0 + G.U.rand(0, B * 4), P.y - G.U.rand(0, B * 5), '#ffe58a', { vy: -40, life: 0.6 });
  }

  let eye = null;
  /** The Eye of Ender texture (null until loaded). */
  function eyeImg() {
    if (!eye) { eye = new Image(); eye.src = 'assets/mc/items/ender_eye.png'; }
    return eye.complete && eye.naturalWidth ? eye : null;
  }

  /** The travel fade, over everything (game.js, after the HUD). */
  function drawOverlay(ctx, w, h) {
    if (!travel) return;
    const P = PORTALS[travel.kind], k = Math.min(1, travel.t / (P.tin || T_IN));
    ctx.save();
    if (travel.kind === 'aether') {
      // White-gold light swelling from the centre until it fills the screen.
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * (0.2 + k * 0.9));
      g.addColorStop(0, `rgba(255,255,250,${Math.min(1, k * 1.6).toFixed(3)})`);
      g.addColorStop(0.6, `rgba(255,236,170,${k.toFixed(3)})`);
      g.addColorStop(1, `rgba(255,214,110,${(k * k).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.globalAlpha = k;
      ctx.fillStyle = P.flash;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  // ---------------- debug ----------------

  function debugElders() {
    if (dimDef().goal !== 'elders' || !G.Game.player) return null;
    if (!elders) setupElders(G.Game.player);
    wakeElders();
    return elders.list.filter(e => !e.dead);
  }

  return {
    PORTALS, reset, update, bossDown, elderDown, wakeElders, sculkBroken, drawables, drawOverlay, eyeImg,
    netState, netApply, onNet,
    /** A big title like the floor banners (events.js: the sea battles; co-op: the whole team sees it). */
    announce(title, sub, col = '#ffffff', dur = 4, queue = false) { shout(title, sub, col, dur, queue); },
    /** An underwater floor (The Ocean), outside Trial Chambers: everyone swims, nobody is slowed by water. */
    get underwater() { return !!dimDef().underwater && !(G.Rift && G.Rift.inArena); },
    /**
     * The Ocean: { n, left, awake, home: { x, y, r } (the monument, or null), list } once the Elder
     * Guardians are placed (the first frame on the floor), else null.
     */
    get elders() {
      if (!elders || dimDef().goal !== 'elders') return null;
      // (A guest: the host's count, and the copies of the Elder Guardians.)
      const alive = elders.net ? G.EnemyMgr.all().filter(e => e.elder && !e.dead) : elders.list.filter(e => !e.dead);
      return { n: elders.n, left: elders.net ? elders.left : alive.length, awake: elders.awake, home: elders.home, list: alive };
    },
    get dim() { return dimDef().id; }, get def() { return dimDef(); }, get index() { return idx; },
    get dimTime() { return dimT; }, get arrivedAt() { return arrivedAt; }, get portal() { return portal; }, get traveling() { return !!travel; },
    /** Number of floors in the climb (the Aether is the ending, not a floor). */
    get floors() { return FLOORS(); },
    /** A peaceful floor (the Aether): nothing hurts you, nothing hostile spawns (systems/aether.js). */
    get peaceful() { return !!dimDef().peaceful; },
    /**
     * Herobrine's World: { left: seconds until the Aether portal builds, ready, x, y } (x, y once it builds);
     * null on other floors.
     */
    get aether() {
      const d = dimDef();
      if (d.goal !== 'herobrine') return null;
      const P = portal && portal.kind === 'aether' ? portal : null;
      return { left: Math.max(0, (d.surviveFor || 150) - dimT), building: !!P, ready: !!(P && P.ready), x: P ? P.x : null, y: P ? P.y : null };
    },
    /** Dev panel and tests: Herobrine's World is won now (the clock runs out; the Aether portal builds). */
    debugWinHerobrine() {
      const d = dimDef();
      if (d.goal !== 'herobrine' || !G.Game.player) return null;
      dimT = Math.max(dimT, d.surviveFor || 150);
      if (heroT >= 0) { heroT = -1; if (authority()) G.Judgment.awaken(); }
      return buildAether(G.Game.player);
    },
    /** Tests: run the survival clock to `t` seconds on Herobrine's World. */
    debugHeroClock(t) { if (dimDef().goal === 'herobrine') dimT = t; return dimT; },
    get biome() { return biomeKey; }, get banner() { return big; }, get biomeBanner() { return small; },
    /** Stronghold: { x, y, r, eye, held, hold, inside, done } once the room is known, else null. */
    get room() { return room && room.x != null ? Object.assign({ hold: dimDef().hold || 20 }, room) : null; },
    /** Ancient City: warning level 0-4, seconds to the next shriek, and the last shriek ({x, y, t}). */
    get warning() { return dimDef().goal === 'shriek' ? { level: warn, next: warden ? 0 : Math.max(0, shriekT), last: lastShriek } : null; },
    /** Seconds until the next boss of this floor ({ kind, left }) or null. */
    get nextBoss() {
      const d = dimDef();
      if (!midDone) return { kind: 'mid', left: Math.max(0, d.bossAt.mid - dimT) };
      if (!floorSpawned && (timedFloor(d) || d.goal === 'elders')) return { kind: 'floor', left: Math.max(0, d.bossAt.floor - dimT) };
      return null;
    },
    debugDimension(id) { const i = G.DIMENSIONS.findIndex(d => d.id === id); if (i >= 0) { travel = null; go(i); } },
    debugBoss(kind = 'floor') {
      const d = dimDef();
      if (kind === 'floor' && d.goal === 'shriek') { while (!warden) shriek(); return G.EnemyMgr.all().find(e => e.floorBoss) || null; }
      if (kind === 'floor' && d.goal === 'elders') { debugElders(); return (elders && elders.list.find(e => !e.dead)) || null; }
      return spawnBoss(kind === 'mid' ? 'mid' : 'floor');
    },
    /** Opens this floor's exit portal next to the player (the Stronghold: activates the room). */
    debugPortal() {
      const d = dimDef(), pl = G.Game.player;
      if (d.goal === 'portal') { if (!room) roomTick(0, pl); room.eye = true; roomDone(); return portal; }
      if (d.goal === 'herobrine') return this.debugWinHerobrine();
      return d.exit && pl ? openPortal(pl.x + 90, pl.y, d.exit) : null;
    },
    /** The Ocean: places the Elder Guardians if needed and wakes them now. */
    debugElders,
    /** Ancient City: one more shriek (warning +1). */
    debugWarn() { if (dimDef().goal === 'shriek') shriek(); return warn; },
    /** Stronghold: the eye now, and the player in the room (`fill`: also finish holding it). */
    debugRoom(fill = false) {
      const d = dimDef(), pl = G.Game.player;
      if (d.goal !== 'portal' || !pl) return null;
      dimT = Math.max(dimT, d.portalAt || 0);
      roomTick(0, pl);
      if (!room.done) { pl.x = room.x; pl.y = room.y; G.Camera.x = pl.x; G.Camera.y = pl.y; }
      if (fill) roomDone();
      return room;
    }
  };
})();
