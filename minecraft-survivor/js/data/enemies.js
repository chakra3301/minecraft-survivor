/* ============ enemies.js — wild mobs: biome pools, time tiers and bosses ============
 *
 * Mobs come from the BIOME they spawn in and the TIME OF DAY: surface biomes of the Overworld have a
 * `day` and a `night` list (systems/daynight.js picks which), caves, the Nether and the End a single
 * `mobs` list. Thin pools are padded with the dimension's `commonDay` / `commonNight` / `common` list.
 * Every pool, cast and bag below is cached per biome AND phase ('day' | 'night' | 'all').
 * Difficulty comes from the RUN CLOCK, as before:
 *
 *   - Each time tier (TIERS) gives the combat stats (hp, speed, damage, xp), so a zombie at
 *     minute 12 is as tough as tier 5 demands.
 *   - Which mobs a tier uses is RELATIVE to the pool: the biome's mobs are ranked by strength
 *     (BST) and each tier takes a band of that ranking (`band`, 0 = weakest, 1 = strongest).
 *     Early tiers bring the biome's weak mobs, later tiers its strong ones. (The old absolute
 *     BST windows broke with small pools: the Nether has no weak mobs at all.)
 *   - Fighters and passive animals (`passive` in the Mobdex: cows, sheep, villagers, fish...) are
 *     ranked SEPARATELY, and a cast holds at most half passive mobs (FIGHT_MIN fighters when the
 *     pool has them). So a daytime plains cast at minute 0 brings pillagers, llamas and
 *     vindicators next to the cows, instead of only the weakest animals of the list.
 *   - A cast is rolled per biome and tier the first time it is needed in a run, so every run
 *     brings a different mix, without loading hundreds of sprites at once.
 *
 * Combat stats come from the tier template, adjusted by each mob's own health and speed.
 *
 * behavior:
 *   chase    walks straight at you
 *   charger  stops, aims and charges
 *   ranged   keeps its distance and shoots
 *   tank     slow, lots of health
 *   ---- with personality ----
 *   healer   heals nearby mobs (Witch, Mooshroom, Allay...)
 *   shielder shields its allies (Armadillo, Iron Golem, Shulker...)
 *   summoner calls its pack (Bee, Slime, Magma Cube...)
 *   bomber   walks up and explodes (Creeper, Pufferfish...)
 *   beamer   telegraphed beam (Guardian)
 *   zoner    damage zones under your feet that burst after a moment (Ghast)
 *   fan      shoots in a fan (Blaze, Breeze)
 *   jumper   jumps and lands on you (the landing shows on the ground first)
 *   runner   very fast and fragile, heads to where you will be. One per cast: the fastest.
 * The telegraphed attacks live in systems/hazards.js.
 *
 * Bosses (mid-boss and floor boss of each dimension) are built by bossDef() and scheduled by
 * systems/floors.js; Trial Chamber bosses by systems/rift.js. None of them spawn as normal mobs.
 */
G.Enemies = (() => {
  // band: slice of the biome pool's strength ranking each tier draws from (0 weakest .. 1 strongest).
  const TIERS = [
    { from: 0,   band: [0, 0.5],     hp: 17,  spd: 56, dmg: 6,  xp: 3.5, cast: 7 },
    { from: 70,  band: [0.15, 0.65], hp: 32,  spd: 62, dmg: 8.5, xp: 5,  cast: 7 },
    { from: 160, band: [0.3, 0.8],   hp: 52,  spd: 60, dmg: 11, xp: 8,  cast: 7 },
    { from: 260, band: [0.45, 0.9],  hp: 88,  spd: 70, dmg: 14, xp: 13, cast: 7 },
    { from: 380, band: [0.55, 1],    hp: 150, spd: 66, dmg: 22, xp: 24, cast: 7 },
    { from: 500, band: [0.65, 1],    hp: 250, spd: 72, dmg: 28, xp: 38, cast: 7 }
  ];
  // A biome with fewer mobs than this is padded from its dimension's `common` list (up to this many).
  const MIN_POOL = 8;
  // A pool with fewer fighters (non-passive mobs) than this gets fighters from the dimension's list.
  const MIN_FIGHT = 4;
  // Fewest fighters in a cast (when the pool has them); the rest may be passive animals.
  const FIGHT_MIN = 4;
  // Fewest mobs a tier draws from (the band widens around its centre when the pool is small).
  const MIN_BAND = 4;

  // Boss health/damage curve by RUN time (the old boss slots). bossDef() interpolates it at the
  // moment a boss spawns; past the last slot it stays flat and only bossScale() keeps growing.
  const BOSS_SLOTS = [
    { at: 180, hp: 1400,  dmg: 34, xp: 220 },
    { at: 360, hp: 3200,  dmg: 42, xp: 420 },
    { at: 540, hp: 5600,  dmg: 48, xp: 680 },
    { at: 720, hp: 9000,  dmg: 56, xp: 1000 },
    { at: 900, hp: 16000, dmg: 68, xp: 1800 }
  ];
  const FLOOR_HP = 1.5;      // floor bosses (Warden, Wither, Ender Dragon) are tougher

  // Approximate base stats from the game ones (inverse of fetch_pokedex).
  const baseHp = p => (p.hp - 70) / 0.45;
  const baseSpd = p => (p.spd - 78) / 0.42;

  const H = (d, s) => G.U.hash(d, 7, s);

  // Behaviour: Minecraft-accurate ones are fixed in the Mobdex (`beh`, set in tools/mc/roster.mjs:
  // skeletons shoot, creepers explode, guardians fire lasers...). Everything else fights in MELEE,
  // like it does in Minecraft: only mobs with a real ranged attack get one, so the fallback below
  // never hands out shots, beams, fans or zones (a zombie hits you with its hands).
  function behaviorOf(p) {
    const t = p.types, h = H(p.dex, 11);
    const has = (...xs) => xs.some(x => t.includes(x));
    if (p.beh === 'summoner') return G.SPRITE_META[p.minion] ? 'summoner' : 'chase';
    if (p.beh) return p.beh;
    if (has('fighting', 'ground', 'normal', 'rock') && h >= 0.42 && h < 0.56) return 'jumper';
    if (has('fighting', 'normal', 'ground', 'rock', 'dragon', 'steel', 'dark') && h < 0.4) return 'charger';
    if (baseHp(p) > 95 && baseSpd(p) < 50) return 'tank';
    return 'chase';
  }

  /** Enemy definition of a mob for a time tier. */
  function defFor(p, tier, ti) {
    const hpK = G.U.clamp(baseHp(p) / 65, 0.7, 1.6);
    const spdK = G.U.clamp(0.75 + baseSpd(p) / 260, 0.75, 1.3);
    const behavior = behaviorOf(p);
    const d = {
      dex: p.dex, name: p.name, behavior,
      hp: Math.round(tier.hp * hpK * (behavior === 'tank' ? 1.5 : 1)),
      spd: Math.round(tier.spd * spdK * (behavior === 'tank' ? 0.7 : 1)),
      dmg: Math.round(tier.dmg * (behavior === 'tank' ? 1.2 : 1)),
      xp: Math.max(3, Math.round(tier.xp * (behavior === 'tank' ? 1.3 : 1)))
    };
    // Ranged fighters: shot damage, cooldown and distance.
    const CD = { ranged: 2.2 - ti * 0.15, fan: 3.2 - ti * 0.15, beamer: 4.4 - ti * 0.2, zoner: 4.6 - ti * 0.2,
                 healer: 3.5, summoner: 7 };
    if (CD[behavior]) {
      d.shotDmg = Math.round(tier.dmg * (behavior === 'fan' ? 0.7 : 0.8));
      d.shotCd = +CD[behavior].toFixed(2);
      d.range = (behavior === 'beamer' ? 260 : behavior === 'healer' || behavior === 'summoner' ? 230 : 190) + ti * 6;
    }
    if (behavior === 'summoner') d.minion = p.minion || p.dex;
    if (behavior === 'fan') d.fanN = ti < 2 ? 3 : 5;             // wider fan later on
    if (behavior === 'zoner') d.zones = ti < 2 ? 1 : ti < 4 ? 2 : 3;   // more zones later on
    if (behavior === 'bomber') { d.spd = Math.round(d.spd * 1.25); d.hp = Math.round(d.hp * 0.8); }
    return d;
  }

  // ---------------- biome pools ----------------

  let byKey = null;
  /**
   * Mobs that never spawn as normal mobs: variants, heroes, legendaries (giant, warden, wither, dragon,
   * herobrine...), every dimension's floor boss, and legendary mid-bosses.
   */
  function spawnable(p) {
    if (!p || p.v || p.ne || p.leg || !G.SPRITE_META[p.dex]) return false;
    return !G.DIMENSIONS.some(d => d.floorBoss === p.key || (p.leg && (d.midBoss || []).includes(p.key)));
  }
  const passive = p => !!p.passive;
  function mob(key) {
    if (!byKey) { byKey = {}; for (const p of G.DEX) if (!p.v) byKey[p.key] = p; }
    return byKey[key];
  }

  /** Current dimension (floors.js; the world's as a fallback). */
  function dimId() { return (G.Floors && G.Floors.dim) || G.World.dimension || 'overworld'; }

  /** Biome key at a world point (world units). Falls back to the dimension's start biome. */
  function biomeAt(x, y) {
    const k = G.World.biomeKeyAt && x != null ? G.World.biomeKeyAt(x, y) : null;
    if (k && G.BIOME_DEFS[k]) return k;
    const d = G.DIM_BY[dimId()] || G.DIMENSIONS[0];
    return d.start;
  }

  /** Spawn phase of a biome now: 'day' | 'night' for Overworld surface biomes, else 'all'. */
  function phaseOf(key) { return G.DayNight ? G.DayNight.phaseFor(key) : 'all'; }

  /**
   * Dimension whose lists pad a biome's pool: the biome's own, except when the current dimension
   * borrows another's biomes and has its own lists (Herobrine's World walks the Overworld biomes).
   */
  function padDim(b) {
    const cur = G.DIM_BY[dimId()];
    if (cur && b && cur.id !== b.dim && (cur.commonNight || cur.common)) return cur;
    return b && G.DIM_BY[b.dim];
  }
  /** Cache key of a biome's pool: biome, phase and the dimension padding it. */
  function ctx(key, ph) { const d = padDim(G.BIOME_DEFS[key]); return key + '|' + ph + '|' + (d ? d.id : ''); }

  const pools = {};
  /**
   * The biome's spawnable mobs for a phase, weakest first (BST, then health), padded with the
   * dimension's list for that phase when thin (or when it has too few fighters).
   */
  function pool(key, ph = phaseOf(key)) {
    const pk = ctx(key, ph);
    if (pools[pk]) return pools[pk];
    const b = G.BIOME_DEFS[key];
    const dim = padDim(b);
    const own = b ? (ph === 'day' ? b.day : ph === 'night' ? b.night : null) || b.mobs || b.night || [] : [];
    const pad = dim ? (ph === 'day' ? dim.commonDay : ph === 'night' ? dim.commonNight : null) || dim.common || [] : [];
    const keys = [...new Set(own)];
    const ok = k => spawnable(mob(k));
    // Thin pools take the dimension's list in order, up to MIN_POOL (not all of it: the desert stays the desert).
    for (const k of pad) { if (keys.filter(ok).length >= MIN_POOL) break; if (!keys.includes(k)) keys.push(k); }
    // Too few fighters (a meadow of cows): add the dimension's fighters, one at a time.
    for (const k of pad) {
      if (keys.filter(k2 => ok(k2) && !passive(mob(k2))).length >= MIN_FIGHT) break;
      if (!keys.includes(k) && ok(k) && !passive(mob(k))) keys.push(k);
    }
    const list = keys.map(mob).filter(spawnable).sort((a, b2) => a.bst - b2.bst || a.hp - b2.hp);
    return (pools[pk] = list.length ? list : G.DEX.filter(p => spawnable(p) && p.dex === 30));
  }

  const members = {};
  /** Does this mob spawn in the biome at (x, y) at this time of day? */
  function livesIn(dex, x, y) {
    const key = biomeAt(x, y), pk = ctx(key, phaseOf(key));
    return (members[pk] || (members[pk] = new Set(pool(key).map(p => p.dex)))).has(dex);
  }

  /** Strength rank of each pool entry, 0 (weakest) .. 1 (strongest). */
  function rank(list, i) { return list.length > 1 ? i / (list.length - 1) : 0.5; }

  /**
   * Mobs of a biome for tier `ti`: its band of the ranking, widened to at least MIN_BAND mobs.
   * @param which  'fight' | 'calm': rank only the fighters or only the passive mobs (default: all)
   */
  function candidates(key, ti, ph = phaseOf(key), which) {
    const all = pool(key, ph);
    const list = which ? all.filter(p => passive(p) === (which === 'calm')) : all;
    const [lo, hi] = TIERS[ti].band, mid = (lo + hi) / 2;
    const scored = list.map((p, i) => { const r = rank(list, i); return { p, off: r < lo ? lo - r : r > hi ? r - hi : 0, d: Math.abs(r - mid) }; });
    const inBand = scored.filter(s => s.off === 0).map(s => s.p);
    if (inBand.length >= Math.min(MIN_BAND, list.length)) return inBand;
    return scored.sort((a, b) => a.off - b.off || a.d - b.d).slice(0, Math.min(MIN_BAND, list.length)).map(s => s.p);
  }

  // ---------------- run casts ----------------

  const PLAIN = ['chase', 'charger', 'ranged', 'tank'];
  const SUPPORT = ['healer', 'shielder', 'summoner'];

  /**
   * Cast of a biome for a tier: always a "support" (healer, shielder or summoner) when the band
   * has one and, from the second tier on, one of the telegraphed attackers. The first tier keeps
   * to plain fighters when it can (so you learn the ropes). Fighters and passive mobs are drawn
   * from their own bands: at least FIGHT_MIN fighters (when the pool has them), at most half passive.
   */
  function rollCast(key, ti, ph) {
    const tier = TIERS[ti], n = tier.cast;
    const fight = candidates(key, ti, ph, 'fight'), calm = candidates(key, ti, ph, 'calm'), all = fight.concat(calm);
    const kind = p => behaviorOf(p);
    const kinds = SUPPORT.filter(k => all.some(p => kind(p) === k));
    const sk = kinds.length ? G.U.pick(kinds) : null;
    const pick = sk ? G.U.pickN(all.filter(p => kind(p) === sk), 1) : [];
    if (ti > 0) pick.push(...G.U.pickN(fight.filter(p => !pick.includes(p) && !PLAIN.includes(kind(p)) && !SUPPORT.includes(kind(p))), 1));
    const left = list => list.filter(p => !pick.includes(p));
    const plainFirst = list => ti === 0 && list.filter(p => PLAIN.includes(kind(p))).length >= 3 ? list.filter(p => PLAIN.includes(kind(p))) : list;
    // Fighters up to their quota, passive mobs up to half the cast, then whatever is left.
    const calmMax = Math.floor(n / 2), fightN = Math.max(FIGHT_MIN, n - calmMax);
    const nFight = () => pick.filter(p => !passive(p)).length, nCalm = () => pick.filter(passive).length;
    pick.push(...G.U.pickN(plainFirst(left(fight)), Math.max(0, fightN - nFight())));
    pick.push(...G.U.pickN(left(calm), Math.max(0, Math.min(calmMax - nCalm(), n - pick.length))));
    if (pick.length < n) pick.push(...G.U.pickN(left(fight), n - pick.length));
    if (pick.length < n) pick.push(...G.U.pickN(left(calm), n - pick.length));
    // Bands too thin to fill the cast: the rest of the tier's band over the whole pool.
    if (pick.length < n) pick.push(...G.U.pickN(left(candidates(key, ti, ph)), n - pick.length));
    const list = pick.slice(0, n).map(p => defFor(p, tier, ti));
    // The runner: the fastest plain fighter of the cast.
    if (list.length >= 3) {
      const r = list.filter(d => d.behavior === 'chase' || d.behavior === 'charger' || d.behavior === 'tank').sort((a, b) => b.spd - a.spd)[0];
      if (r) { r.behavior = 'runner'; r.spd = Math.round(r.spd * 1.6); r.hp = Math.round(r.hp * 0.7); }
    }
    return list;
  }

  let casts = new Map();      // 'biome|phase|dim|tier' -> [def]   (rolled lazily, once per run)
  let bags = new Map();       // 'biome|phase|dim|tier|old' -> weighted [def]

  function castOf(key, ti, ph = phaseOf(key)) {
    const k = ctx(key, ph) + '|' + ti;
    let c = casts.get(k);
    if (!c) casts.set(k, c = rollCast(key, ti, ph));
    return c;
  }

  /** A new run: forget every cast (they are rolled again as biomes are reached). */
  function rollRun() { casts = new Map(); bags = new Map(); }

  // (The minute-60 "extra time" was removed when Herobrine arrived: every run ends at
  //  minute 30, see systems/judgment.js.)
  function scale(t) {
    return { hp: 1 + t / 95, dmg: 1 + t / 420, spd: 1 + Math.min(0.35, t / 1400) };
  }

  /** Bosses already carry a growing base health, so they scale much more gently. */
  function bossScale(t) { return { hp: 1 + t / 600, dmg: 1 + t / 600, spd: 1 }; }

  /** Time tier at second `t`. */
  function tierAt(t) { let ti = 0; TIERS.forEach((tr, i) => { if (t >= tr.from) ti = i; }); return ti; }

  /**
   * Weighted mobs that can spawn at second `t` at world point (x, y): the casts of the biome
   * there, for every tier reached so far (older tiers lose weight).
   */
  function bagAt(t, x, y) {
    // During a Mob Siege only that element spawns (systems/events.js).
    const horde = G.Events && G.Events.bag();
    if (horde) return horde;
    const key = biomeAt(x, y), ti = tierAt(t), ph = phaseOf(key);
    let old = 0;
    for (let i = 0; i <= ti; i++) if (t - TIERS[i].from > 260) old++;
    const bk = ctx(key, ph) + '|' + ti + '|' + old;
    let bag = bags.get(bk);
    if (bag) return bag;
    bag = [];
    for (let i = 0; i <= ti; i++) {
      const w = t - TIERS[i].from > 260 ? 3 : 10;
      for (const e of castOf(key, i, ph)) for (let j = 0; j < w; j++) bag.push(e);
    }
    if (!bag.length) bag = castOf(key, 0, ph);
    bags.set(bk, bag);
    return bag;
  }

  /**
   * Dex of the cast of these biomes that will show up within `ahead` seconds (to preload sprites):
   * the current phase, plus the next one when the light changes within `ahead`.
   */
  function upcomingDex(t, keys, ahead = 60) {
    const out = new Set();
    const DN = G.DayNight, flip = DN && DN.hasCycle() && DN.phaseAt(t + ahead) !== DN.phaseAt(t);
    for (const key of keys) {
      const b = G.BIOME_DEFS[key];
      if (!b) continue;
      const phs = new Set([phaseOf(key)]);
      if (flip && b.day && b.night) { phs.add('day'); phs.add('night'); }
      for (const ph of phs) TIERS.forEach((tr, i) => { if (tr.from <= t + ahead) for (const e of castOf(key, i, ph)) out.add(e.dex); });
    }
    return [...out];
  }

  const NO_HORDE = new Set(['bomber', 'healer', 'shielder', 'summoner']);
  /**
   * Mobs of the biome at (x, y) that may join a Mob Siege at second `t` (no stronger than its tier).
   * Fighters only, when they can field a siege of their own.
   */
  function hordePool(t, x, y, calm = false) {
    const list = pool(biomeAt(x, y)), hi = TIERS[tierAt(t)].band[1];
    return list.filter((p, i) => rank(list, i) <= hi && !NO_HORDE.has(behaviorOf(p)) && (calm || !passive(p)));
  }
  function siegeTypes(all) {
    const n = {};
    for (const p of all) for (const ty of p.types) n[ty] = (n[ty] || 0) + 1;
    const ok = k => Object.keys(G.U.TYPE_COLOR).filter(ty => (n[ty] || 0) >= k);
    return ok(3).length ? ok(3) : ok(2);
  }
  /** Elements with enough mobs in the biome at (x, y) for a Mob Siege (events.js). */
  function hordeTypes(t, x, y) {
    const types = siegeTypes(hordePool(t, x, y));
    return types.length ? types : siegeTypes(hordePool(t, x, y, true));
  }
  /** Up to 4 mobs of an element from the biome at (x, y), with the current tier's stats. */
  function hordeDefs(type, t, x, y) {
    const ti = tierAt(t), fit = calm => hordePool(t, x, y, calm).filter(p => p.types.includes(type));
    const list = fit(false).length >= 2 ? fit(false) : fit(true);
    return G.U.pickN(list, 4).map(p => defFor(p, TIERS[ti], ti));
  }

  /** Boss health/damage/xp of the slot curve at run second `t` (linear between slots). */
  function slotAt(t) {
    const S = BOSS_SLOTS;
    if (t <= S[0].at) return S[0];
    for (let i = 1; i < S.length; i++) {
      if (t > S[i].at) continue;
      const a = S[i - 1], b = S[i], k = (t - a.at) / (b.at - a.at);
      return { hp: a.hp + (b.hp - a.hp) * k, dmg: a.dmg + (b.dmg - a.dmg) * k, xp: a.xp + (b.xp - a.xp) * k };
    }
    return S[S.length - 1];
  }

  /**
   * Boss definition of a mob spawning at run second `t` (spawn it with bossScale(t)).
   * @param kind  'mid' | 'floor' (floor bosses: ×1.5 health and xp)
   */
  function bossDef(p, t, kind = 'mid') {
    const s = slotAt(t), k = kind === 'floor' ? FLOOR_HP : 1;
    return {
      dex: p.dex, name: p.name,
      // (Tougher since 2026-10-10: ×1.35 health and ×1.2 damage.)
      hp: Math.round(s.hp * 1.35 * k), spd: Math.round(G.U.clamp(40 + baseSpd(p) * 0.5, 40, 100)),
      dmg: Math.round(s.dmg * 1.2), xp: Math.round(s.xp * k),
      behavior: behaviorOf(p) === 'ranged' ? 'ranged' : (baseSpd(p) > 90 ? 'charger' : 'chase'),
      shotDmg: Math.round(s.dmg * 0.55), shotCd: 1.1, range: 260
    };
  }

  return {
    TIERS, BOSS_SLOTS, FLOOR_HP, rollRun, scale, bossScale, tierAt, bagAt, upcomingDex, candidates, pool, biomeAt, mob, livesIn,
    hordeTypes, hordeDefs, bossDef, slotAt, castOf, phaseOf, behaviorOf, defFor, spawnable
  };
})();
