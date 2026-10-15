/* ============ spawner.js — oleadas y shinies ============
 * Los enemigos aparecen en un anillo justo fuera de la vista, así que nunca
 * se materializan en pantalla. Cada ~45 s hay una "marea": una avalancha
 * concentrada desde un lado concreto, para romper el ritmo.
 *
 * Each mob comes from the biome of the point where it appears (G.Enemies.bagAt);
 * the run clock still sets how strong it is. Bosses are scheduled by
 * systems/floors.js, which spawns them through spawnBoss().
 *
 * Cada enemigo tiene 1/4096 de salir shiny (como en los juegos clásicos).
 * Una run mata 1.500–4.000, así que sale uno cada 1–3 partidas.
 *
 * Cooperativo (sólo en el anfitrión): aparecen alrededor de un jugador vivo
 * al azar, fuera de la vista de TODOS, y hay más y más fuertes según cuántos
 * jugáis (ver G.Coop.scaleRate / scaleHp).
 */
G.Spawner = (() => {
  // Tope de enemigos a la vez (antes 420: con tantos se ralentizaba). Cuando
  // se llega al tope, los que siguen saliendo son "élite" (más vida, daño y
  // experiencia), así la dificultad no baja.
  const CAP = 64, ELITE_FROM = 0.85;
  // Menos Pokémon pero más fuertes (la pantalla no se satura): salen ~24% de
  // los de antes, cada uno con más vida, daño y experiencia.
  const DENSITY = 0.24, DMG_K = 2.4, XP_K = 5.6;
  // La resistencia extra crece con la run: al principio ×3,3 y hasta ×5
  // hacia el minuto 6, cuando ya tienes ataques para tumbarlos.
  const hpK = t => 3.3 + Math.min(1.7, t / 210);
  const SHINY_RATE = 1 / 4096;
  let acc = 0, surgeT = 32, announce = null, announceT = 0, preloadT = 0;
  let forceShiny = 0;           // para pruebas: los N próximos salen shiny

  function reset() {
    acc = 0; surgeT = 32; announce = null; announceT = 0; preloadT = 0;
    G.Enemies.rollRun();
  }

  /**
   * Preloads the casts of the biomes around a point (out to ~1700 px), so a mob never pops in
   * grey when you walk into a new biome. Called every few seconds and on entering a dimension.
   */
  function preloadAround(x, y, t, ahead = 60) {
    const keys = new Set([G.Enemies.biomeAt(x, y)]);
    if (G.World.biomeKeyAt) {
      for (const d of [500, 1000, 1700]) {
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * 6.2832;
          keys.add(G.Enemies.biomeAt(x + Math.cos(a) * d, y + Math.sin(a) * d));
        }
      }
    }
    const up = G.Enemies.upcomingDex(t, [...keys], ahead);
    G.Sprites.preload(up.concat(specialDex(up)));
  }

  /** Enemigos por segundo según el minuto de la run. */
  function rate(t) {
    return (1.6 + t * 0.028 + Math.pow(t / 60, 1.6) * 0.5) * DENSITY * (G.DayNight ? G.DayNight.spawnMul() : 1);
  }

  function ringPoint(pl, angle) {
    const d = G.Camera.outerRadius() + G.U.rand(10, 70);
    return [pl.x + Math.cos(angle) * d, pl.y + Math.sin(angle) * d * 0.9];
  }

  let players = [];

  /** ¿Lo vería algún jugador? (para no aparecer delante de nadie) */
  function seenByAnyone(x, y) {
    const r = G.Camera.outerRadius() - 30;
    return players.some(o => G.U.dist2(o.x, o.y, x, y) < r * r);
  }

  /** Sprite already loaded? (prefer those, so nothing pops in grey) */
  function ready(def) { const s = G.Sprites.sheet(def.dex, 'Walk') || G.Sprites.sheet(def.dex, 'Idle'); return !s || s.ready; }

  /** Picks a mob from a bag, preferring ones whose sprite is loaded. */
  function pickDef(bag) {
    let d = G.U.pick(bag);
    for (let i = 0; i < 4 && !ready(d); i++) d = G.U.pick(bag);
    return d;
  }

  /**
   * Room for a mob of radius r at (x, y): no walls, no water (underwater floors: any open water,
   * everyone swims there).
   */
  function fits(x, y, r = 14) { return G.World.isFree(x, y, r, !!(G.Floors && G.Floors.underwater)); }

  /** Punto del anillo donde quepa: no dentro de paredes ni en el agua. */
  function freePoint(pl, angle, flying) {
    for (let i = 0; i < 8; i++) {
      const a = angle + (i === 0 ? 0 : G.U.rand(-0.9, 0.9));
      const [x, y] = ringPoint(pl, a);
      if (players.length > 1 && seenByAnyone(x, y)) continue;
      if (flying || fits(x, y)) return [x, y];
    }
    return null;
  }

  /** Jugador alrededor del que sale el siguiente enemigo. */
  function anchor() {
    const alive = players.filter(o => !o.dead);
    return alive.length ? G.U.pick(alive) : players[0];
  }

  function scaled(sc, k) { return k === 1 ? sc : Object.assign({}, sc, { hp: sc.hp * k }); }

  function isFlyer(def) { return G.Sprites.hovers(def.dex); }

  function rollShiny(dex) {
    if (!G.Sprites.hasShiny(dex)) return false;
    if (forceShiny > 0) { forceShiny--; return true; }
    return Math.random() < SHINY_RATE;
  }

  /** A spawn point on the ring and the mob of the biome there (or null if nothing fits). */
  function placeOne(pl, t, angle) {
    const a0 = angle == null ? Math.random() * 6.2832 : angle;
    for (let i = 0; i < 8; i++) {
      const [x, y] = ringPoint(pl, a0 + (i === 0 ? 0 : G.U.rand(-0.9, 0.9)));
      if (players.length > 1 && seenByAnyone(x, y)) continue;
      const def = pickDef(G.Enemies.bagAt(t, x, y));
      if (isFlyer(def) || fits(x, y)) return { def, pt: [x, y] };
    }
    return null;
  }

  function spawnOne(pl, t, angle) {
    if (G.Dev && G.Dev.noSpawns) return null;          // dev panel: spawns off
    const got = placeOne(pl, t, angle);
    if (!got) return null;
    return spawnDef(dress(got.def, t, got.pt[0], got.pt[1]), got.pt[0], got.pt[1], t);
  }

  // ---------------- armoured mobs and jockeys: rare versions of a normal spawn ----------------

  let special = null;
  /** Base dex -> { arm: { iron: dex, diamond: dex, netherite: dex }, jockeys: [mob] }, from the Mobdex (`arm`, `jk`). */
  function specials() {
    if (special) return special;
    special = {};
    const of = d => special[d] || (special[d] = { arm: {}, jockeys: [] });
    for (const p of G.DEX) {
      if (!G.SPRITE_META[p.dex]) continue;
      const b = p.arm && p.v && G.Enemies.mob(p.v);
      if (b && !b.ne) of(b.dex).arm[p.arm] = p.dex;           // Steve and Alex never spawn
      if (p.jk) of(p.jk.on).jockeys.push(p);
    }
    return special;
  }
  /** Sprites of the armoured and jockey versions of these mobs (preloaded with their casts). */
  function specialDex(dexes) {
    const sp = specials(), out = [];
    for (const d of dexes) if (sp[d]) out.push(...Object.values(sp[d].arm), ...sp[d].jockeys.map(p => p.dex));
    return out;
  }

  /**
   * Armour on a normal mob's definition (G.ARMOUR: health and damage multipliers): a copy with the armoured
   * variant's dex and name. A tier with a sword (a piglin's) fights in melee.
   */
  function armourDef(def, tier, dex = specials()[def.dex] && specials()[def.dex].arm[tier]) {
    const A = G.ARMOUR[tier], p = dex && G.DEX_BY[dex];
    if (!p) return def;
    const d = { ...def, dex, of: def.dex, name: p.name, armour: tier, hp: Math.round(def.hp * A.hp), dmg: def.dmg * A.atk };
    if (d.shotDmg) d.shotDmg = def.shotDmg * A.atk;
    if (d.behavior === 'ranged' && !p.shot) d.behavior = 'chase';
    return d;
  }

  /**
   * A normal spawn, maybe dressed up: a jockey in place of its rider (the jockey's `jk.p` of the rider's
   * night spawns; also in dark biomes with `jk.dark`), or armour on zombies, skeletons, drowned and piglins
   * (G.ARMOUR chances: iron 5%, diamond 1.5%, netherite 0.3%, ×1.15 more per floor down).
   */
  function dress(def, t, x, y) {
    const sp = specials()[def.dex];
    if (!sp || def.armour) return def;
    if (sp.jockeys.length) {
      const key = G.Enemies.biomeAt(x, y), b = G.BIOME_DEFS[key], night = G.Enemies.phaseOf(key) === 'night';
      for (const j of sp.jockeys) {
        if (!(night || (j.jk.dark && b && (b.dark || b.shade))) || Math.random() >= j.jk.p) continue;
        const ti = G.Enemies.tierAt(t);
        return { ...G.Enemies.defFor(j, G.Enemies.TIERS[ti], ti), of: def.dex };
      }
    }
    const deep = 1 + 0.15 * ((G.Floors && G.Floors.index) || 0);
    let r = Math.random();
    for (const tier of ['netherite', 'diamond', 'iron']) {
      if (!sp.arm[tier]) continue;
      if ((r -= G.ARMOUR[tier].chance * deep) < 0) return armourDef(def, tier);
    }
    return def;
  }

  /** Dev panel and tests: a mob of the current cast near the player, armoured (`tier`) or as a jockey (`key`). */
  function debugSpecial(kind) {
    const P = G.Game.player, t = G.Game.st.time, ti = G.Enemies.tierAt(t);
    const a = Math.random() * 6.2832, x = P.x + Math.cos(a) * 200, y = P.y + Math.sin(a) * 160;
    let def;
    if (G.ARMOUR[kind]) {
      const bases = Object.keys(specials()).filter(d => specials()[d].arm[kind]).map(d => G.DEX_BY[d]);
      const here = bases.filter(p => G.Enemies.livesIn(p.dex, x, y));
      const p = G.U.pick(here.length ? here : bases);
      def = armourDef(G.Enemies.defFor(p, G.Enemies.TIERS[ti], ti), kind);
    } else {
      const j = G.DEX.find(p => p.key === kind && p.jk);
      if (!j) return null;
      def = { ...G.Enemies.defFor(j, G.Enemies.TIERS[ti], ti), of: j.jk.on };
    }
    return spawnDef(def, x, y, t);
  }

  /**
   * A normal mob of definition `def` at (x, y), with the run's scaling (also used by the
   * Pillager Patrol in systems/events.js).
   */
  function spawnDef(def, x, y, t) {
    if (!players.length) players = G.Game.everyone();
    const shiny = rollShiny(def.dex);
    const e = new G.Enemy(def, x, y, scaled(G.Enemies.scale(t), G.Coop.scaleHp(players.length) * hpK(t)));
    e.dmg *= DMG_K; e.xp = Math.round(e.xp * XP_K);
    if (G.EnemyMgr.count >= CAP * ELITE_FROM) { e.maxHp = e.hp = Math.round(e.maxHp * 1.6); e.dmg *= 1.25; e.xp = Math.round(e.xp * 1.6); }
    if (shiny) e.makeShiny();
    if (G.Events.golden) e.makeGolden();
    G.EnemyMgr.add(e);
    if (shiny) {
      say('An Enchanted ' + e.name + ' is nearby!', 3.4);
      G.Audio.sfx('shiny');
    }
    return e;
  }

  /**
   * A boss just off-screen (systems/floors.js schedules them).
   * @param b      boss definition (G.Enemies.bossDef)
   * @param at     [x, y] to spawn at (default: on the ring around a player)
   * @param quiet  no "A wild ... appeared!" banner (floors.js shows its own)
   */
  function spawnBoss(b, t, at = null, quiet = false) {
    if (!players.length) players = G.Game.everyone();
    const [x, y] = at || ringPoint(anchor() || G.Game.player, Math.random() * 6.2832);
    const e = new G.Enemy(b, x, y, scaled(G.Enemies.bossScale(t), G.Coop.scaleHp(players.length) * (players.length > 1 ? 1.4 : 1)), true);
    if (rollShiny(b.dex)) e.makeShiny();
    G.EnemyMgr.add(e);
    if (!quiet) say((e.shiny ? 'An Enchanted ' : 'A wild ') + e.name + ' appeared!', 3.2);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
    return e;
  }

  /** @param who  el jugador o la lista de jugadores (cooperativo) */
  function update(dt, who, t) {
    players = Array.isArray(who) ? who : [who];
    if (announceT > 0) announceT -= dt;
    // En la arena de la grieta no sale nada más (y el reloj de jefes espera).
    // En la Sentencia de Arceus, sólo sus legendarios (systems/judgment.js). The Aether: nothing hostile, ever.
    if (G.Rift.inArena || G.Judgment.active || G.Floors.peaceful) return;

    // Preloads what the biomes around you will spawn in the next minute.
    preloadT -= dt;
    if (preloadT <= 0) { preloadT = 4; const a = anchor(); preloadAround(a.x, a.y, t); }

    // Combate de jefe: las oleadas bajan al 25% y no hay mareas, para que el
    // jefe sea un momento propio y se le pueda apuntar entre la multitud.
    const bossFight = G.EnemyMgr.bossAlive();

    // --- goteo normal ---
    if (G.EnemyMgr.count < CAP) {
      acc += rate(t) * G.Coop.scaleRate(players.length) * (bossFight ? 0.25 : 1) * dt;
      let n = Math.floor(acc);
      acc -= n;
      while (n-- > 0 && G.EnemyMgr.count < CAP) spawnOne(anchor(), t);
    }

    // --- marea ---
    if (!bossFight) surgeT -= dt;
    if (surgeT <= 0) {
      surgeT = G.U.rand(38, 56);
      const base = Math.random() * 6.2832;
      const target = anchor();
      const n = Math.min(CAP - G.EnemyMgr.count, Math.round((14 + Math.floor(t / 22)) * G.Coop.scaleRate(players.length) * 0.4));
      for (let i = 0; i < n; i++) spawnOne(target, t, base + G.U.rand(-0.55, 0.55));
      say('Mob swarm incoming!', 2.2);
      G.Audio.sfx('surge');
    }
  }

  /** Unos cuantos de golpe desde un lado (al empezar una horda). */
  function burst(n) {
    const base = Math.random() * 6.2832, target = anchor() || G.Game.player, t = G.Game.st.time;
    for (let i = 0; i < n && G.EnemyMgr.count < CAP + 10; i++) spawnOne(target, t, base + G.U.rand(-0.6, 0.6));
  }

  /**
   * Un rezagado vuelve a salir por delante del jugador (hacia donde corre),
   * fuera de la vista. Devuelve false si no hay sitio (entonces se quita).
   */
  function ahead(e, pl) {
    if (!players.length) players = [pl];
    const sp = Math.hypot(pl._vx || 0, pl._vy || 0);
    const a0 = sp > 20 ? Math.atan2(pl._vy, pl._vx) : Math.random() * 6.2832;
    const a = a0 + G.U.rand(-0.9, 0.9);
    const pt = freePoint(pl, a, e.flying);
    if (!pt) return false;
    // A mob that doesn't live in the biome ahead is swapped for one that does (patrols stay whole).
    // (Armoured mobs and jockeys count as the mob they replaced: `def.of`.)
    if (!G.Events.bag() && !e.golden && !e.patrol && !G.Enemies.livesIn(e.def.of || e.dex, pt[0], pt[1])) {
      spawnOne(pl, G.Game.st.time, a);
      return false;
    }
    e.x = pt[0]; e.y = pt[1]; e.kx = e.ky = 0;
    e.phase = 'walk'; e.pt = 0; e.jump = null; e.jumpLift = 0;
    return true;
  }

  /** Aviso grande en pantalla (también lo usan el bioma y los shinies). */
  /** @param local  sólo en este ordenador (no se manda a los compañeros) */
  function say(text, secs = 2.6, local = false) {
    announce = text; announceT = secs;
    if (G.Coop.isHost && !local) G.Coop.say(text, secs);
  }

  function banner() { return announceT > 0 ? { text: announce, t: announceT } : null; }

  /** Invitado en cooperativo: sólo corre el reloj del aviso. */
  function tickBanner(dt) { if (announceT > 0) announceT -= dt; }

  return { reset, update, ahead, burst, tickBanner, banner, say, rate, spawnBoss, spawnDef, preloadAround, ringPoint, fits, SHINY_RATE, CAP,
           dress, armourDef, debugSpecial, debugForceShiny(n = 1) { forceShiny = n; } };
})();
