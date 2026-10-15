/* ============ enchanting.js — the Enchanting Table (outside runs) and its effects in runs ============
 * Data in js/data/enchantments.js; screen in js/ui/enchant-ui.js; design in ENCHANTING.md.
 *
 * Save (migrated with defaults in core/db.js):
 *   slayer { dex: date }                      characters that killed the Ender Dragon (enchanting unlocked)
 *   books  { enchId: [count at I, II, III, IV, V] }   the account-wide Library
 *   ench   { dex: { skillId: [[enchId, lvl], …≤3] } } each character's enchanted weapons
 *   stats.enchants (books applied) · stats.anvil (books combined) · stats.books (books found)
 *
 * In a run: Player.addMove calls applyTo(), which bakes the numbers into the skill instance
 * (m.dmg, m.cd, m.count…) and leaves the conditional/proc effects in m.enc. combat.js reads m.enc
 * on each hit (vsMul, afterHit, Breach through Enemy.hurt); player.js reads pl.encAct (Protection,
 * Thorns, Swift Sneak, Feather Falling of the active skill), refreshed by refreshActive().
 */
G.Enchanting = (() => {
  const E = () => G.ENCHANT;
  const save = () => G.DB.save;
  const roman = l => G.ENCHANT.ROMAN[l] || String(l);

  // ---------------- save ----------------

  /** Fills and cleans the enchanting fields of a save (called from G.DB.migrate). */
  function sanitize(s) {
    const n = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
    if (!s.slayer || typeof s.slayer !== 'object') s.slayer = {};
    if (!s.books || typeof s.books !== 'object') s.books = {};
    if (!s.ench || typeof s.ench !== 'object') s.ench = {};
    for (const id of Object.keys(s.books)) {
      const e = E().BY[id], l = s.books[id];
      if (!e || !Array.isArray(l)) { delete s.books[id]; continue; }
      s.books[id] = [0, 1, 2, 3, 4].map(i => (i < e.max ? n(l[i]) : 0));
    }
    for (const d of Object.keys(s.ench)) {
      const w = s.ench[d];
      if (!w || typeof w !== 'object' || (G.DEX_BY && !G.DEX_BY[d])) { delete s.ench[d]; continue; }
      for (const sk of Object.keys(w)) {
        const seen = new Set();
        const l = Array.isArray(w[sk]) ? w[sk] : [];
        w[sk] = l.filter(x => Array.isArray(x) && E().BY[x[0]] && !seen.has(x[0]) && seen.add(x[0]))
          .map(([id, lv]) => [id, Math.max(1, Math.min(E().BY[id].max, n(lv)))]).slice(0, E().SLOTS);
        if (!w[sk].length || (G.Moves && !G.Moves.BY_ID[sk])) delete w[sk];
      }
    }
  }

  // ---------------- rules ----------------

  /** Has this character killed the Ender Dragon? (Variants count as their own characters.) */
  function unlocked(dex, s = save()) { return !!(s && s.slayer && s.slayer[dex]); }

  /** 'sword' | 'bow' | 'trident' | 'mace' | 'staff' | 'armour' */
  function weaponType(skillId) {
    const d = G.Moves.BY_ID[skillId];
    return d ? E().OVERRIDE[skillId] || E().BY_KIND[d.kind] || 'staff' : null;
  }

  /** The character's weapons: its signature (starting) skill first, then its skill pool. */
  function weapons(dex) {
    const mon = G.DEX_BY[dex];
    if (!mon) return [];
    const sig = G.startMoveOf(dex);
    return [sig, ...G.Moves.poolFor(mon).filter(id => id !== sig)];
  }

  /** [[enchId, lvl], …] on that character's weapon (a copy). */
  function listFor(dex, skillId, s = save()) {
    const w = s && s.ench && s.ench[dex] && s.ench[dex][skillId];
    return w ? w.map(x => x.slice()) : [];
  }

  /** Does the enchantment fit this weapon type, and not clash with what is already on it? */
  function compatible(dex, skillId, enchId, s = save()) { return !whyNot(dex, skillId, enchId, 0, s, true); }

  /**
   * Why the book can't go on the weapon (null = it can). `lvl` 0 skips level checks;
   * `rulesOnly` skips the unlock, book, slot and cost checks.
   */
  function whyNot(dex, skillId, enchId, lvl = 0, s = save(), rulesOnly = false) {
    const e = E().BY[enchId], t = weaponType(skillId);
    if (!e || !t) return 'Unknown';
    if (!weapons(dex).includes(skillId)) return 'Not one of its weapons';
    if (!e.types.includes('any') && !e.types.includes(t)) return 'Doesn\'t fit a ' + E().TYPES[t].name.toLowerCase();
    const cur = listFor(dex, skillId, s);
    const clash = cur.find(([id]) => e.excl.includes(id));
    if (clash) return 'Can\'t go with ' + E().BY[clash[0]].name;
    if (rulesOnly) return null;
    if (!unlocked(dex, s)) return 'Locked';
    const same = cur.find(([id]) => id === enchId);
    if (lvl) {
      if (lvl > e.max) return 'Above its max level';
      if (same && same[1] >= lvl) return 'Already ' + e.name + ' ' + roman(same[1]);
      if (!(s.books[enchId] && s.books[enchId][lvl - 1] > 0)) return 'No book';
      if (s.coins < E().COST.apply(lvl)) return 'Not enough emeralds';
    }
    if (!same && cur.length >= E().SLOTS) return 'All 3 slots are full';
    return null;
  }

  /** Puts book enchId lvl on the character's weapon (a higher level upgrades that slot). → true or a reason. */
  function apply(dex, skillId, enchId, lvl) {
    const s = save();
    const why = whyNot(dex, skillId, enchId, lvl, s);
    if (why) return why;
    s.coins -= E().COST.apply(lvl);
    s.books[enchId][lvl - 1]--;
    const w = (s.ench[dex] = s.ench[dex] || {});
    const list = (w[skillId] = w[skillId] || []);
    const same = list.find(x => x[0] === enchId);
    if (same) same[1] = lvl; else list.push([enchId, lvl]);
    s.stats.enchants = (s.stats.enchants || 0) + 1;
    G.DB.commit(true);
    G.Progress.checkAch();
    return true;
  }

  /** Anvil: two books of enchId lvl make one of lvl + 1. → true or a reason. */
  function combine(enchId, lvl) {
    const s = save(), e = E().BY[enchId];
    if (!e) return 'Unknown';
    if (lvl >= e.max) return 'Already at its max level';
    const have = (s.books[enchId] || [])[lvl - 1] || 0;
    if (have < 2) return 'You need two of the same book';
    const cost = E().COST.combine(lvl + 1);
    if (s.coins < cost) return 'Not enough emeralds';
    s.coins -= cost;
    s.books[enchId][lvl - 1] -= 2;
    s.books[enchId][lvl]++;
    s.stats.anvil = (s.stats.anvil || 0) + 1;
    G.DB.commit(true);
    G.Progress.checkAch();
    return true;
  }

  /** Emeralds the grindstone gives back for a weapon. */
  function refundOf(dex, skillId) { return listFor(dex, skillId).reduce((a, [, l]) => a + E().COST.refund(l), 0); }

  /** Grindstone: removes every enchantment from the weapon (the books are lost, some emeralds come back). → refund or false. */
  function removeAll(dex, skillId) {
    const s = save(), list = listFor(dex, skillId, s);
    if (!list.length) return false;
    const back = refundOf(dex, skillId);
    delete s.ench[dex][skillId];
    if (!Object.keys(s.ench[dex]).length) delete s.ench[dex];
    s.coins += back;
    G.DB.commit(true);
    return back;
  }

  /** 'locked' | 'unlocked' | 'mastered' (signature weapon with 3 enchantments, all at max level). */
  function mastery(dex, s = save()) {
    if (!unlocked(dex, s)) return 'locked';
    const l = listFor(dex, G.startMoveOf(dex), s);
    return l.length >= E().SLOTS && l.every(([id, lv]) => lv >= E().BY[id].max) ? 'mastered' : 'unlocked';
  }

  /** Characters mastered (variants count on their own). */
  function masteredCount(s = save()) {
    return s ? Object.keys(s.slayer || {}).filter(d => G.DEX_BY[d] && mastery(+d, s) === 'mastered').length : 0;
  }
  /** Of the 16 starters. */
  function startersMastered(s = save()) { return s ? G.STARTERS.filter(p => mastery(p.dex, s) === 'mastered').length : 0; }
  /** Playable species (variants count toward their base species): the final goal. */
  function species() { return G.DEX.filter(p => !p.v && G.SPRITE_META[p.dex]); }
  function speciesMastered(s = save()) {
    if (!s) return 0;
    const done = new Set();
    for (const d of Object.keys(s.slayer || {})) {
      const p = G.DEX_BY[d];
      if (p && mastery(p.dex, s) === 'mastered') done.add(p.v || p.key);
    }
    return species().filter(p => done.has(p.key)).length;
  }

  /** Books in the library: total, or those of one enchantment. */
  function bookCount(enchId = null, s = save()) {
    const b = (s && s.books) || {};
    return (enchId ? [enchId] : Object.keys(b)).reduce((a, id) => a + (b[id] || []).reduce((x, y) => x + y, 0), 0);
  }

  // ---------------- unlock (the Ender Dragon) ----------------

  /** The Ender Dragon fell with partner `dex`: unlocks enchanting for it. → true the first time. */
  function slay(dex) {
    const s = save();
    if (!s || !G.DEX_BY[dex] || unlocked(dex, s)) return false;
    s.slayer[dex] = Date.now();
    G.DB.commit();
    G.Progress.checkAch();
    return true;
  }

  // ---------------- books ----------------

  function pickWeighted() {
    const L = E().LIST, total = L.reduce((a, e) => a + e.w, 0);
    let r = Math.random() * total;
    for (const e of L) if ((r -= e.w) <= 0) return e;
    return L[0];
  }

  /**
   * A book from a boss drop, or null when the roll fails.
   * @param source  'floor' | 'elder' | 'mid' | 'trial' | 'captain' | 'herobrine' (or 'any': no chance roll)
   * @param floorIdx  index in G.DIMENSIONS (sets the level range)
   */
  function rollBook(source, floorIdx = 0) {
    const chance = source === 'any' ? 1 : E().DROP[source] || 0;
    if (Math.random() >= chance) return null;
    const dim = G.DIMENSIONS[G.U.clamp(floorIdx | 0, 0, G.DIMENSIONS.length - 1)];
    const [lo, hi] = E().SOURCE_LVL[source] || E().FLOOR_LVL[dim.id] || [1, 1];
    const e = pickWeighted();
    const lvl = Math.min(e.max, lo + Math.floor(Math.random() * (hi - lo + 1)));
    return { id: e.id, lvl };
  }

  /** Banks a book into the library right away (dying never loses it). */
  function grantBook(book) {
    const s = save();
    if (!s || !book || !E().BY[book.id]) return false;
    const l = (s.books[book.id] = s.books[book.id] || [0, 0, 0, 0, 0]);
    l[book.lvl - 1] = (l[book.lvl - 1] || 0) + 1;
    s.stats.books = (s.stats.books || 0) + 1;
    G.DB.commit();
    return true;
  }

  const bookName = b => E().BY[b.id].name + ' ' + roman(b.lvl);
  const encode = b => b.id + ':' + b.lvl;
  function decode(v) { const [id, l] = String(v).split(':'); return E().BY[id] ? { id, lvl: Math.max(1, Math.min(E().BY[id].max, +l || 1)) } : null; }

  /** Drops a book pickup at (x, y) if the source's roll succeeds. */
  function dropBook(source, x, y, floorIdx = G.Floors ? G.Floors.index : 0) {
    const b = rollBook(source, floorIdx);
    if (b) G.Pickups.drop('book', x, y, encode(b));
    return b;
  }

  /** A boss fell (Enemy.die): floor bosses, each Elder Guardian, mid-bosses, Trial Chamber elites, Herobrine's queue. */
  function bossDrop(e) {
    const src = e.judge ? 'herobrine' : e.legend ? 'trial' : e.elder ? 'elder' : e.floorBoss ? 'floor' : e.midBoss ? 'mid' : null;
    if (src) dropBook(src, e.x, e.y + 14);
  }

  // ---------------- in a run ----------------

  /**
   * Bakes the partner's enchantments for this skill into a fresh instance `m` (Moves.instance).
   * Multipliers go on the numbers (later ladder levels multiply on top); procs go in m.enc.
   */
  function applyTo(m, dex) {
    const list = listFor(dex, m.id);
    if (!list.length) return m;
    const B = E().BY;
    let dmg = 0, cd = 1;
    const enc = { list, vs: null, breach: 0, chan: 0, mend: 0, loot: 0, gust: 0, fortune: 0, riptide: false,
                  armour: false, prot: 0, thorns: 0, sneak: 0, feather: 0, bane: false, t: 0, chanT: 0, gustT: 0 };
    const vs = (type, k) => { enc.vs = enc.vs || {}; enc.vs[type] = (enc.vs[type] || 0) + k; };
    for (const [id, l] of list) {
      const p = B[id].per;
      switch (id) {
        case 'sharpness': case 'power': dmg += p.dmg * l; break;
        case 'density': dmg += p.dmg * l; if (m.radius) m.radius *= 1 + p.radius * l; break;
        case 'smite': case 'bane': case 'impaling': vs(B[id].vsType, p.vs * l); if (id === 'bane') enc.bane = true; break;
        case 'fire_aspect': case 'flame': m.burn = (m.burn || 0) + p.burn * l; break;
        case 'knockback': case 'punch': m.knock = (m.knock || 0) + p.knock * l; break;
        case 'sweeping': if (m.arc) m.arc *= 1 + p.sweep * l; if (m.radius) m.radius *= 1 + p.sweep * l; break;
        case 'multishot':
          if (m.kind === 'cone') { m.count = (m.count || 0) + p.count; m.arc = (m.arc || 0.9) * 1.2; }
          else { m.count = (m.count || 1) + p.count; m.spread = Math.max(m.spread || 0, 0.2); }
          break;
        case 'piercing': if (m.kind === 'chain') m.count = (m.count || 1) + p.pierce * l; else m.pierce = (m.pierce || 0) + p.pierce * l; break;
        case 'quick_charge': case 'efficiency': case 'infinity': cd *= 1 - p.cd * l; break;
        case 'loyalty':
          if (m.speed && m.kind !== 'dash') { m.speed *= 1 + p.speed * l; m.pierce = (m.pierce || 0) + 1; }
          else cd *= 1 - p.cd * l;
          break;
        case 'riptide':
          if (m.kind === 'dash') { m.radius *= 1 + p.reach * l; enc.riptide = true; }
          else if (m.life) m.life *= 1 + p.reach * l;
          break;
        case 'channeling': enc.chan = p.chan; break;
        case 'breach': enc.breach = Math.min(1, p.breach * l); break;
        case 'wind_burst': enc.gust = 40 + p.gust * l; break;
        case 'frost_walker': m.slow = Math.min(0.85, (m.slow || 0) + p.slow * l); break;
        case 'looting': enc.loot = p.loot * l; break;
        case 'fortune': enc.fortune = p.fortune * l; break;
        case 'protection': enc.armour = true; enc.prot = p.prot * l; break;
        case 'thorns': enc.armour = true; enc.thorns = p.thorns * l; break;
        case 'swift_sneak': enc.armour = true; enc.sneak = p.sneak * l; break;
        case 'feather_falling': enc.armour = true; enc.feather = p.feather * l; break;
        case 'unbreaking': if (m.dur != null) m.dur *= 1 + p.dur * l; else dmg += p.dmg * l; break;
        case 'mending': enc.mend = p.mend; break;
      }
    }
    if (dmg && m.dmg != null) m.dmg *= 1 + dmg;
    if (cd < 1) m.cd *= cd;
    m.ench = list;
    m.enc = enc;
    return m;
  }

  /** Protection, Thorns, Swift Sneak and Feather Falling of the skills in the active slot → pl.encAct (or null). */
  function refreshActive(pl) {
    let a = null;
    for (const m of pl.activeGroup()) {
      const e = m.enc;
      if (!e || !e.armour) continue;
      a = a || { prot: 0, thorns: 0, sneak: 0, feather: 0 };
      a.prot += e.prot; a.thorns += e.thorns; a.sneak += e.sneak; a.feather += e.feather;
    }
    if (a) a.prot = Math.min(0.6, a.prot);
    pl.encAct = a;
  }

  /** Smite / Bane of Arthropods / Impaling: damage multiplier against this mob. */
  function vsMul(enc, e) {
    if (!enc.vs) return 1;
    let k = 1;
    for (const t of e.types) if (enc.vs[t]) k += enc.vs[t];
    return k;
  }

  let chainVis = null;
  /** Procs after a hit with an enchanted skill: Bane's slow, Mending, Looting, Channeling, Wind Burst. */
  function afterHit(pl, e, dmg, enc, wasAlive) {
    if (enc.bane && !e.dead && e.types.includes('bug')) e.applySlow(0.3);
    if (enc.mend) pl.mendHeal = Math.min(4, (pl.mendHeal || 0) + dmg * enc.mend);
    if (enc.loot && wasAlive && e.dead && !e.crystal && Math.random() < enc.loot) G.Pickups.drop('coin', e.x, e.y, 1);
    // Co-op guest: the host's mob only dies over there; it rolls Looting if this hit kills it.
    else if (enc.loot && e.remote && !e.crystal) G.Coop.loot(e, enc.loot);
    const now = performance.now();
    if (enc.chan && now - enc.chanT > 150 && Math.random() < enc.chan) { enc.chanT = now; lightning(e, dmg * 0.6); }
    if (enc.gust && now - enc.gustT > 300) { enc.gustT = now; gust(e.x, e.y, enc.gust); }
  }

  /** Channeling: lightning on the mob, chaining to the 2 nearest others. */
  function lightning(e, dmg) {
    chainVis = chainVis || G.VFX.forMove(G.Moves.BY_ID.thunderbolt);
    let cur = e, fx = e.x, fy = e.y - 170;
    const done = new Set();
    for (let i = 0; i < 3 && cur; i++) {
      done.add(cur.id);
      const tx = cur.x, ty = cur.y - cur.bodyH * 0.5;
      G.FX.beam(fx, fy, Math.atan2(ty - fy, tx - fx), Math.hypot(tx - fx, ty - fy), 8, '#e8f4ff', chainVis);
      if (!cur.dead) cur.hurt(dmg, '#cfe8ff', 0, 0, 0);
      fx = tx; fy = ty;
      let best = null, bd = 150 * 150;
      for (const o of G.EnemyMgr.queryCircle(cur.x, cur.y, 150)) {
        if (done.has(o.id)) continue;
        const d = G.U.dist2(cur.x, cur.y, o.x, o.y);
        if (d < bd) { bd = d; best = o; }
      }
      cur = best;
    }
    if (G.Camera.sees(e.x, e.y, 40)) G.Audio.sfx('hit');
  }

  /** Wind Burst: a gust that blows nearby mobs away from the impact. */
  function gust(x, y, r) {
    G.FX.ring(x, y, 6, r, '#dff3ff', 0.3, 3);
    for (const o of G.EnemyMgr.queryCircle(x, y, r)) {
      if (o.boss) continue;
      const [nx, ny] = G.U.norm(o.x - x, o.y - y);
      o.kx += nx * 160; o.ky += ny * 160;
    }
  }

  /** Fortune of the skills learned this run (+ to the end-of-run emerald multiplier). */
  function fortuneOf(pl) { return pl.moves.reduce((a, m) => a + (m.enc ? m.enc.fortune : 0), 0); }

  // ---------------- looks ----------------

  /** Purple enchantment glint sweeping over a square (HUD slots). */
  function drawGlint(ctx, x, y, s, t = performance.now() / 1000) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#8a3dff';
    ctx.fillRect(x, y, s, s);
    const p = ((t * 0.45) % 1) * s * 3 - s;
    const g = ctx.createLinearGradient(x + p, y, x + p + s * 0.7, y + s * 0.7);
    g.addColorStop(0, 'rgba(160,90,255,0)');
    g.addColorStop(0.5, 'rgba(205,150,255,0.55)');
    g.addColorStop(1, 'rgba(160,90,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s);
    ctx.restore();
  }

  /** "Sharpness III · Smite II" */
  const listText = list => list.map(([id, l]) => E().BY[id].name + ' ' + roman(l)).join(' · ');

  // ---------------- dev ----------------

  /** Dev panel: the best enchantments that fit the partner's signature weapon, all at max level. */
  function debugMaster(dex) {
    const s = save(), sk = G.startMoveOf(dex);
    s.slayer[dex] = s.slayer[dex] || Date.now();
    (s.ench[dex] = s.ench[dex] || {})[sk] = [];
    const t = weaponType(sk);
    const fits = E().LIST.filter(e => e.types.includes(t)).concat(E().LIST.filter(e => e.types.includes('any')));
    for (const e of fits) {
      if (s.ench[dex][sk].length >= E().SLOTS) break;
      if (s.ench[dex][sk].some(([id]) => e.excl.includes(id))) continue;
      s.ench[dex][sk].push([e.id, e.max]);
    }
    G.DB.commit();
    G.Progress.checkAch();
  }

  return { sanitize, unlocked, weaponType, weapons, listFor, compatible, whyNot, apply, combine, removeAll, refundOf,
           mastery, masteredCount, startersMastered, species, speciesMastered, bookCount, slay, rollBook, grantBook,
           dropBook, bossDrop, bookName, encode, decode, applyTo, refreshActive, vsMul, afterHit, fortuneOf,
           drawGlint, listText, roman, debugMaster };
})();
