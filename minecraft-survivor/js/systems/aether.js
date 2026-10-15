/* ============ aether.js — The Aether: the end of the climb ============
 *
 * Survive Herobrine's World and a glowstone portal takes you to the Aether (after the Aether mod, The
 * Aether I): sky islands in endless sunshine. It is presented as the ending, not a ninth floor
 * (data/dimensions.js: goal 'paradise', `peaceful`, `sunny`; systems/floors.js counts 8 floors).
 *
 *   - Nothing hurts you (Player.hurt returns on a peaceful floor) and nothing hostile spawns: no waves,
 *     events, Trial Chambers, bosses, weather or night. Your weapons don't fire (systems/combat.js).
 *   - Only the Aether's passive mobs live here, as CRITTERS owned by this module (not enemies: nothing can
 *     target or hit them). They come from the biome lists of the ground they appear on, wander, and do
 *     their mod things: the Sheepuff puffs up into a cloud and floats down, Phygs and Flying Cows glide on
 *     their wings, Aerbunnies hop and drift down, Moas strut and sprint, Aerwhales drift over the open sky
 *     (G.World.isOpenSky when the world has it). Walk next to one and it shows love-mode hearts; stay by a
 *     Phyg for PHYG_LOVE s and you befriend it ("When Phygs Fly!").
 *   - Atmosphere: always noon, a warm bright grade, a rainbow, white-gold edges, a few drifting hearts (screen
 *     space), the world's sky overlay (sun glow, rays, sparkles; game.js), the gentlest music (data/music.js 'aether').
 *   - Arriving (enter) grants, every time: ARRIVAL_COINS emeralds, ARRIVAL_KEYS Ominous Keys, one Enchanted
 *     Book at its highest level, save.ascended[partner] (a halo in the Mobdex), stats.aether++; the first
 *     time, every Aether mob (gen 8) joins your Mobdex (from: 'aether'). Achievements: data/achievements.js.
 *   - The ending: after ENDING_AT s (or the Rest button, from REST_AT s, or R) the screen softly brightens,
 *     a few original lines scroll up over C418's "Alpha", then YOU REACHED THE AETHER. After the automatic
 *     ending you choose to keep wandering (no time limit; Rest ends it) or rest: the run summary as a VICTORY.
 *   - Quicksoil and Blue Aercloud (world tiles): groundEffect() → 'quicksoil' (faster) | 'bounce' (a hop).
 */
G.Aether = (() => {
  const ARRIVAL_COINS = 1000, ARRIVAL_KEYS = 3;
  const REST_AT = 10, ENDING_AT = 45;
  const CRITTERS = 12, WHALES = 2;     // friendly mobs kept around you (Aerwhales on top)
  const LOVE_R = 92, PHYG_LOVE = 3;    // how close you stand for hearts; seconds by a Phyg to befriend it
  const QUICK = 1.5, HOP_T = 0.6, HOP_H = 28;
  const T_BRIGHT = 2.6, SCROLL = 44;   // ending: seconds to brighten, text scroll speed (px/s)
  const GOLD = '#ffd95a', CREAM = '#fff8e6';
  const AETHER_MOBS = ['sheepuff', 'phyg', 'flying_cow', 'aerbunny', 'moa', 'aerwhale'];
  const LINES = [
    ['You climbed through the dark.', 0], ['Past the sea, the caves, the fire and the void.', 0],
    ['And when the night itself came hunting, you did not stop.', 0], ['', 0],
    ['Look up. The sky is open now.', 1], ['The islands float, and the clouds will hold you.', 1],
    ['Nothing here wants to hurt you. Nothing ever will.', 1], ['', 1],
    ['The sheep drift like dandelion seeds.', 0], ['The whales sing low and slow beneath the sun.', 0],
    ['Every creature here already knows your name.', 0], ['', 0],
    ['Was it a game? Was it a dream?', 1], ['It was a long way up, and every step was yours.', 1], ['', 1],
    ['Rest now, little builder.', 0], ['Paradise is not the end of the story.', 0],
    ['It is the place where the story can breathe.', 0], ['', 0],
    ['Wake whenever you like. The sun will wait.', 1]
  ];

  let on = false, t = 0, critters = [], spawnT = 0, seeded = false;
  let screen = [];                 // drifting hearts and sparkles (screen space)
  let hearts = [];                 // love-mode hearts (world space)
  let ending = null;               // { t, auto, scrollEnd, done, choice }
  let seenEnding = false, rewards = null;

  // ---------------- arriving ----------------

  /** floors.js enter(): the Aether starts (rewards, sprites) or, on any other floor, everything is off. */
  function enter(d) {
    reset();
    if (!d || d.goal !== 'paradise') return;
    on = true;
    G.Sprites.preload([...dexes(), 'sheepuff_puff'], 12000);
    rewards = grantRewards();
    G.Weather.clear();
    G.Events.abort();
  }

  function reset() {
    on = false; t = 0; critters = []; spawnT = 0; seeded = false; screen = []; hearts = [];
    ending = null; seenEnding = false; rewards = null;
  }

  /** Every Aether mob in the Mobdex (gen 8: the six and the Moa variants). */
  function dexes() { return G.DEX.filter(p => p.gen === 8 && G.SPRITE_META[p.dex]).map(p => p.dex); }

  /**
   * The Aether's gifts, every arrival (each player on their own save): emeralds, Ominous Keys, a top-level
   * Enchanted Book, the partner's halo; the first time, every Aether mob befriends you. → what was given.
   */
  function grantRewards() {
    const s = G.DB.save, pl = G.Game.player;
    if (!s || !pl) return null;
    s.tickets = s.tickets || { t1: 0, t10: 0 };
    s.coins += ARRIVAL_COINS;
    s.tickets.t10 += ARRIVAL_KEYS;
    let book = G.Enchanting.rollBook('any', G.Floors.index);
    if (book) {
      book = { id: book.id, lvl: G.ENCHANT.BY[book.id].max };
      if (G.Enchanting.grantBook(book)) pl.books.push(book);
    }
    s.ascended = s.ascended || {};
    if (!s.ascended[pl.dex]) s.ascended[pl.dex] = Date.now();
    s.stats.aether = (s.stats.aether || 0) + 1;
    const befriended = [];
    for (const d of dexes()) if (!G.DB.owns(d)) { G.DB.grant(d, 'aether'); befriended.push(d); }
    G.DB.commit();
    G.Progress.checkAch();
    if (befriended.length) {
      setTimeout(() => {
        if (on) G.UI.toast('The creatures of the Aether befriend you: ' + befriended.map(d => G.DEX_BY[d].name).join(', ') + '!', 5200);
      }, 6500);
    }
    return { coins: ARRIVAL_COINS, keys: ARRIVAL_KEYS, book, befriended, partner: pl.dex };
  }

  // ---------------- every frame ----------------

  function update(dt, pl) {
    if (!on || !pl) return;
    t += dt;
    if (!seeded) { seeded = true; seed(pl); }
    if ((spawnT -= dt) <= 0) { spawnT = 1.4; keepUp(pl); }
    for (let i = critters.length - 1; i >= 0; i--) {
      const c = critters[i];
      critterTick(c, dt, pl);
      if (G.U.dist2(c.x, c.y, pl.x, pl.y) > (G.Camera.outerRadius() * 1.9) ** 2) critters.splice(i, 1);
    }
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      h.y -= 26 * dt; h.x += Math.sin((h.life + h.p) * 3) * 8 * dt; h.life -= dt;
      if (h.life <= 0) hearts.splice(i, 1);
    }
    drift(dt);
    if (ending) endingTick(dt);
    else if (t >= ENDING_AT && !seenEnding) play(true);
    if (!ending && canRest() && G.Input.tap('keyr')) rest();
  }

  /** Arrival: a little herd in view (a Sheepuff close by), so the first sight of the Aether is full of life. */
  function seed(pl) {
    const near = ['sheepuff', 'phyg', 'aerbunny', 'moa', 'sheepuff', 'flying_cow', 'aerbunny', 'phyg', 'moa'];
    near.forEach((k, i) => {
      const a = i / near.length * 6.2832 + 0.4, d = i === 0 ? 120 : G.U.rand(170, 380);
      const at = freeNear(pl.x + Math.cos(a) * d, pl.y + Math.sin(a) * d * 0.7, 16);
      if (at) add(k, at[0], at[1]);
    });
    for (let i = 0; i < WHALES; i++) spawnWhale(pl, true);
  }

  /** Keeps CRITTERS around you (and a couple of Aerwhales), appearing just out of view from the ground's biome. */
  function keepUp(pl) {
    const whales = critters.filter(c => c.key === 'aerwhale').length;
    if (whales < WHALES) { spawnWhale(pl, false); return; }
    if (critters.length - whales >= CRITTERS) return;
    const a = Math.random() * 6.2832, d = G.Camera.outerRadius() + G.U.rand(20, 120);
    const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.85;
    const key = pickFor(x, y);
    if (!key || key === 'aerwhale') return;
    const at = G.Sprites.hovers((G.Enemies.mob(key) || {}).dex) ? [x, y] : freeNear(x, y, 16);
    if (at) add(key, at[0], at[1]);
  }

  /** A friendly mob for the biome at (x, y): its own list, else the Aether's common list. */
  function pickFor(x, y) {
    const k = G.World.biomeKeyAt ? G.World.biomeKeyAt(x, y) : null, b = k && G.BIOME_DEFS[k];
    const list = ((b && b.dim === 'aether' && b.mobs) || G.Floors.def.common || AETHER_MOBS).filter(key => {
      const p = G.Enemies.mob(key);
      return p && G.SPRITE_META[p.dex];
    });
    return list.length ? G.U.pick(list) : null;
  }

  function freeNear(x, y, r) {
    for (let i = 0; i < 12; i++) {
      const px = x + (i ? G.U.rand(-60, 60) : 0), py = y + (i ? G.U.rand(-60, 60) : 0);
      if (G.World.isFree(px, py, r)) return [px, py];
    }
    return null;
  }

  const openSky = (x, y) => typeof G.World.isOpenSky !== 'function' || G.World.isOpenSky(x, y);

  /** An Aerwhale over the open sky (in view on arrival, else just out of it). */
  function spawnWhale(pl, inView) {
    // Over open sky (the gaps between the islands), as close as there is some; anywhere as a last resort.
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.2832, far = i / 40;
      const d = (inView ? G.U.rand(260, 520) : G.Camera.outerRadius() + G.U.rand(80, 220)) + far * 700;
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.8;
      if (!openSky(x, y) && i < 39) continue;
      const c = add('aerwhale', x, y);
      if (c) { const h = a + Math.PI + G.U.rand(-0.8, 0.8); c.vx = Math.cos(h) * 20; c.vy = Math.sin(h) * 14; }
      return;
    }
  }

  // ---------------- critters ----------------

  const SPEED = { sheepuff: 28, phyg: 34, flying_cow: 30, aerbunny: 40, moa: 52, aerwhale: 20 };

  function add(key, x, y) {
    const p = G.Enemies.mob(key);
    if (!p || !G.SPRITE_META[p.dex]) return null;
    const flyer = key === 'aerwhale' || G.Sprites.hovers(p.dex);
    const c = { key, dex: p.dex, x, y, vx: 0, vy: 0, r: G.Sprites.bodyRadius(p.dex) * 0.8, anim: new G.Sprites.Animator(p.dex, 1),
      puff: null, t: G.U.rand(0.3, 2.5), lift: key === 'aerwhale' ? G.U.rand(70, 100) : 0, vl: 0, air: 0, love: 0, heartT: 0,
      flyer, loved: false, hop: 0, nextTrick: G.U.rand(4, 11) };
    c.bodyH = G.Sprites.bodyHeight(p.dex);
    c.anim.dir = G.U.randInt ? G.U.randInt(0, 7) : 0;
    critters.push(c);
    return c;
  }

  function critterTick(c, dt, pl) {
    c.t -= dt; c.nextTrick -= dt;
    const fast = c.sprint > 0 ? (c.sprint -= dt, 2.3) : 1;
    if (c.key === 'aerwhale') whaleTick(c, dt);
    else if (c.flyer) flyerTick(c, dt, pl);
    else {
      if (c.t <= 0) {
        // Wander, pause, or turn toward you now and then.
        c.t = G.U.rand(1.2, 3.8);
        if (Math.random() < 0.6) { const a = Math.random() * 6.2832, s = SPEED[c.key] || 30; c.vx = Math.cos(a) * s; c.vy = Math.sin(a) * s * 0.8; }
        else c.vx = c.vy = 0;
      }
      if (c.nextTrick <= 0) trick(c);
      const ge = groundEffect(c.x, c.y);
      const k = (c.love > 0.3 ? 0.15 : 1) * fast * (ge === 'quicksoil' ? QUICK : 1);
      const ox = c.x, oy = c.y;
      c.x += c.vx * k * dt; c.y += c.vy * k * dt;
      if (c.air <= 0) {
        G.World.collide(c);
        if (!G.World.isFree(c.x, c.y, c.r * 0.6)) { c.x = ox; c.y = oy; c.vx = -c.vx; c.vy = -c.vy; }
        if (ge === 'bounce' && c.lift <= 0) { c.vl = 150; c.air = 1; cloudPuff(c.x, c.y); }
      }
      airTick(c, dt);
      const moving = Math.abs(c.vx) + Math.abs(c.vy) > 1;
      if (moving) c.anim.dir = G.Sprites.dirFromAngle(Math.atan2(c.vy, c.vx));
      // Wings beat faster while gliding; a puffed Sheepuff just floats.
      c.anim.loop(moving || c.lift > 2 ? 'Walk' : 'Idle', c.lift > 2 && (c.key === 'phyg' || c.key === 'flying_cow') ? 2.2 : 1);
    }
    c.anim.update(dt);
    if (c.puffAnim) c.puffAnim.update(dt);
    loveTick(c, dt, pl);
  }

  /** Each mob's Aether trick: the Sheepuff puffs, Phygs and Flying Cows glide, Aerbunnies bound, Moas sprint. */
  function trick(c) {
    c.nextTrick = G.U.rand(6, 13);
    if (c.key === 'sheepuff') puff(c);
    else if (c.key === 'phyg') { c.vl = 120; c.air = 1; c.fall = 14; }
    else if (c.key === 'flying_cow') { c.vl = 140; c.air = 1; c.fall = 12; c.vx *= 1.6; c.vy *= 1.6; }
    else if (c.key === 'aerbunny') { c.vl = 110; c.air = 1; c.fall = 12; }
    else if (c.key === 'moa') { c.sprint = 1.4; if (!c.vx && !c.vy) { const a = Math.random() * 6.2832; c.vx = Math.cos(a) * 52; c.vy = Math.sin(a) * 40; } }
  }

  /** The Sheepuff puffs: its wool swells into a cloud ball and it rises, then floats down and deflates. */
  function puff(c) {
    if (c.puff) return;
    c.puff = true;
    // The puffed sheet, drawn a little larger still: a round cloud of wool.
    c.puffAnim = c.puffAnim || new G.Sprites.Animator('sheepuff_puff', 1.25);
    c.vl = 170; c.air = 1; c.fall = 16;
    G.FX.burst(c.x, c.y - 14, '#ffffff', 16, 110);
    G.FX.ring(c.x, c.y - 10, 6, 46, '#ffffff', 0.4, 3);
  }

  /** Up with vl, then a slow float down (fall px/s) — or a quick drop for an ordinary hop. */
  function airTick(c, dt) {
    if (c.air <= 0 && c.lift <= 0) return;
    if (c.vl > 0) { c.lift += c.vl * dt; c.vl -= 260 * dt; if (c.vl < 0) c.vl = 0; }
    else {
      c.lift -= (c.fall || 60) * dt;
      if (c.lift <= 0) {
        c.lift = 0; c.air = 0; c.fall = 0;
        if (c.puff) { c.puff = false; G.FX.burst(c.x, c.y - 10, '#ffffff', 8, 60); }
      }
    }
  }

  /** Aerwhales: slow, gentle turns, a long bob; they keep over the open sky when the world says where that is. */
  function whaleTick(c, dt) {
    if (c.t <= 0) {
      c.t = G.U.rand(3, 7);
      const h = Math.atan2(c.vy, c.vx) + G.U.rand(-0.7, 0.7);
      c.tvx = Math.cos(h) * SPEED.aerwhale; c.tvy = Math.sin(h) * SPEED.aerwhale * 0.75;
    }
    if (c.tvx != null) { c.vx = G.U.damp(c.vx, c.tvx, 0.6, dt); c.vy = G.U.damp(c.vy, c.tvy, 0.6, dt); }
    // Leaving the open sky: turn back (over an island already, it just drifts on until it's clear).
    const ax = c.x + c.vx * 3, ay = c.y + c.vy * 3;
    if (openSky(c.x, c.y) && !openSky(ax, ay) && !(c.turned > 0)) { c.tvx = -c.vx; c.tvy = -c.vy; c.t = 3; c.turned = 3; }
    if (c.turned > 0) c.turned -= dt;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.lift = 120 + Math.sin(t * 0.6 + c.dex) * 12;
    c.anim.dir = G.Sprites.dirFromAngle(Math.atan2(c.vy, c.vx));
    c.anim.loop('Walk', 0.5);
  }

  /** Allays, bees, parrots: they flutter about, the Allay staying close to you. */
  function flyerTick(c, dt, pl) {
    if (c.t <= 0) {
      c.t = G.U.rand(1, 2.5);
      let a = Math.random() * 6.2832;
      if (c.key === 'allay' && G.U.dist2(c.x, c.y, pl.x, pl.y) > 140 * 140) a = Math.atan2(pl.y - c.y, pl.x - c.x) + G.U.rand(-0.5, 0.5);
      c.vx = Math.cos(a) * 46; c.vy = Math.sin(a) * 36;
    }
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.anim.dir = G.Sprites.dirFromAngle(Math.atan2(c.vy, c.vx));
    c.anim.loop('Walk');
  }

  /** Love-mode hearts while you stand close; a Phyg you stay by for PHYG_LOVE s is befriended. */
  function loveTick(c, dt, pl) {
    const near = !pl.dead && G.U.dist2(c.x, c.y, pl.x, pl.y) < (LOVE_R + (c.key === 'aerwhale' ? 60 : 0)) ** 2;
    c.love = near ? c.love + dt : Math.max(0, c.love - dt * 2);
    if (near && c.key !== 'aerwhale' && c.air <= 0) {
      // It stops and looks at you.
      c.anim.dir = G.Sprites.dirFromAngle(Math.atan2(pl.y - c.y, pl.x - c.x));
    }
    if (!near || c.love < 0.35) return;
    if ((c.heartT -= dt) <= 0) {
      c.heartT = G.U.rand(0.35, 0.7);
      hearts.push({ x: c.x + G.U.rand(-c.r, c.r), y: c.y - c.bodyH - c.lift - G.U.rand(0, 8), life: 1.4, p: Math.random() * 6 });
    }
    if (!c.loved && c.love >= 1.2) {
      c.loved = true;
      G.Audio.sfx('love');
      for (let i = 0; i < 5; i++) hearts.push({ x: c.x + G.U.rand(-16, 16), y: c.y - c.bodyH - c.lift - G.U.rand(0, 16), life: 1.6, p: i });
    }
    if (c.key === 'phyg' && c.love >= PHYG_LOVE && !c.phyg) {
      c.phyg = true;
      const s = G.DB.save;
      if (s && !(s.stats.phygLove > 0)) {
        s.stats.phygLove = 1;
        G.Spawner.say('The Phyg loves you! When Phygs fly…', 3, true);
        G.Progress.checkAch();
        G.DB.commit();
      }
    }
  }

  // ---------------- ground tiles: Quicksoil and Blue Aercloud ----------------

  /**
   * The Aether tile under (x, y): 'quicksoil' (you run faster) | 'bounce' (a Blue Aercloud: a hop) | null.
   * Reads the world's tile effects when it has them (G.World.tileEffect, else its liquid kinds).
   */
  function groundEffect(x, y) {
    if (!on) return null;
    let k = null;
    if (typeof G.World.tileEffect === 'function') k = G.World.tileEffect(x, y);
    else if (typeof G.World.liquidKind === 'function') k = G.World.liquidKind(x, y);
    if (k && typeof k === 'object') k = k.kind || k.id || k.name;
    if (k === 'quicksoil') return 'quicksoil';
    if (k === 'bounce' || k === 'blue_aercloud' || k === 'aercloud_blue') return 'bounce';
    return null;
  }

  /** A little cloud puff under a bounce. */
  function cloudPuff(x, y) {
    G.FX.burst(x, y - 4, '#e8f4ff', 8, 70);
    G.FX.ring(x, y, 4, 28, '#bfe3ff', 0.35, 2);
  }

  /**
   * The player on Aether tiles (Player.update, before moving): → speed multiplier. Quicksoil speeds you up
   * (golden dust); a Blue Aercloud bounces you (pl.hop, drawn as a lift).
   */
  function playerGround(pl, dt) {
    if (pl.hop > 0) pl.hop = Math.max(0, pl.hop - dt);
    const ge = groundEffect(pl.x, pl.y);
    if (ge === 'bounce' && !(pl.hop > 0)) { pl.hop = HOP_T; cloudPuff(pl.x, pl.y); G.Audio.sfx('grass'); }
    if (ge === 'quicksoil' && pl.walking && Math.random() < dt * 12) G.FX.px(pl.x + G.U.rand(-8, 8), pl.y - 2, '#f3dc8a', { vy: -20, life: 0.4 });
    return ge === 'quicksoil' ? QUICK : 1;
  }
  /** How high a bounce lifts the player now (px). */
  const hopLift = pl => (pl.hop > 0 ? Math.sin(Math.PI * (1 - pl.hop / HOP_T)) * HOP_H : 0);

  // ---------------- the ending ----------------

  const canRest = () => on && t >= REST_AT && (!ending || ending.choice);

  /** The Rest button (or R): the ending if you haven't seen it, then the victory. */
  function rest() {
    if (!on) return;
    if (ending && ending.choice) { finish(); return; }
    if (seenEnding) finish();
    else play(false);
  }

  /** Plays the ending (`auto`: the ENDING_AT clock, which ends on a choice instead of the summary). */
  function play(auto) {
    if (!on || (ending && !ending.choice)) return;
    ending = { t: 0, auto, choice: false, skipAt: 1.5 };
    seenEnding = true;
    G.Audio.sfx('chime');
  }

  function endingTick(dt) {
    const E = ending;
    if (E.choice) {
      if (G.Input.tap('keyk') || G.Input.tap('escape')) wander();
      else if (G.Input.tap('enter') || G.Input.tap('keyr') || G.Input.tap('space')) finish();
      return;
    }
    E.t += dt;
    if (E.t > E.skipAt && ['space', 'enter', 'escape'].some(k => G.Input.tap(k))) E.t = Math.max(E.t, scrollEnd());
    if (E.t >= scrollEnd() + 3.2) {
      if (E.auto) E.choice = true;
      else finish();
    }
  }
  /** When the last line has scrolled up past the title. */
  function scrollEnd() {
    const h = (document.getElementById('game') || {}).clientHeight || 720;
    return T_BRIGHT + (h * 0.55 + LINES.length * LH) / SCROLL;
  }
  const LH = 30;

  /** Back to the Aether after the ending: no time limit, the Rest button ends the run. */
  function wander() {
    ending = null;
    G.Spawner.say('Wander as long as you like. Rest when you are ready', 3.2, true);
  }

  /** The run ends as a victory (game.js shows YOU REACHED THE AETHER). */
  function finish() {
    if (!on) return;
    ending = null;
    G.Game.victory();
  }

  // ---------------- drawing ----------------

  // Minecraft's love-mode heart, 7×6 texels.
  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  let heartImg = null;
  function heartSprite() {
    if (heartImg) return heartImg;
    const c = document.createElement('canvas');
    c.width = 9; c.height = 8;
    const x = c.getContext('2d');
    HEART.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '#') return;
      x.fillStyle = '#5a0a1e'; x.fillRect(i + 1, j + 2, 1, 1);
    }));
    HEART.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '#') return;
      x.fillStyle = (j === 1 && (i === 1 || i === 2)) ? '#ffb8cc' : j >= 3 ? '#d81e48' : '#ff3d6a';
      x.fillRect(i + 1, j + 1, 1, 1);
    }));
    return (heartImg = c);
  }

  /** The critters, sorted by Y with the scene (game.js drawScene). */
  function drawables() {
    if (!on) return [];
    const cam = G.Camera, out = [];
    for (const c of critters) {
      if (c.key === 'aerwhale' || !cam.sees(c.x, c.y - c.lift, 120)) continue;
      out.push({ y: c.y, draw: ctx => drawCritter(ctx, c) });
    }
    return out;
  }

  function drawCritter(ctx, c) {
    // The shadow stays on the ground, smaller and fainter the higher it floats.
    const k = G.U.clamp(1 - c.lift / 160, 0.35, 1);
    ctx.save();
    ctx.globalAlpha = k;
    G.Sprites.drawShadow(ctx, c.dex, c.x, c.y, (c.key === 'aerwhale' ? 1.4 : 1) * k);
    ctx.restore();
    const a = c.puff && c.puffAnim ? c.puffAnim : c.anim;
    if (a !== c.anim) a.dir = c.anim.dir;
    a.draw(ctx, c.x, c.y - c.lift);
  }

  /**
   * Over everything (world space): the Aerwhales high in the sky (a faint shadow far below them, the whale
   * itself above the islands and everyone on them), then the love-mode hearts.
   */
  function drawAir(ctx) {
    if (!on) return;
    for (const c of critters) {
      if (c.key !== 'aerwhale' || !G.Camera.sees(c.x, c.y - c.lift, 220)) continue;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#2a3a5a';
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r * 2.4, c.r * 0.9, 0, 0, 6.2832); ctx.fill();
      ctx.restore();
      c.anim.draw(ctx, c.x, c.y - c.lift);
    }
    if (!hearts.length) return;
    const img = heartSprite(), S = 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const h of hearts) {
      ctx.globalAlpha = G.U.clamp(h.life / 0.5, 0, 1);
      ctx.drawImage(img, Math.round(h.x - 9), Math.round(h.y - 8), 9 * S, 8 * S);
    }
    ctx.restore();
  }

  /** Drifting hearts and sparkles across the screen (few, soft, slow). */
  function drift(dt) {
    const cv = document.getElementById('game');
    const w = cv ? cv.clientWidth : 800, h = cv ? cv.clientHeight : 600;
    if (screen.length < 10 && Math.random() < dt * 1.5) {
      const heart = true;
      screen.push({ x: Math.random() * w, y: h + 10, vy: G.U.rand(14, 30), life: G.U.rand(9, 16), p: Math.random() * 6, heart, s: heart ? 1 : G.U.randInt ? G.U.randInt(1, 2) : 1 });
    }
    for (let i = screen.length - 1; i >= 0; i--) {
      const s = screen[i];
      s.y -= s.vy * dt; s.p += dt; s.life -= dt;
      if (s.life <= 0 || s.y < -20) screen.splice(i, 1);
    }
  }

  /**
   * The Aether's light over the world (screen space, before the HUD): a warm bright grade, a rainbow, white-gold
   * edges and a few drifting hearts. (Sun, rays and sparkles: the world's sky overlay, game.js.)
   */
  function drawScreen(ctx, w, h) {
    if (!on) return;
    const now = performance.now() / 1000, cam = G.Camera;
    ctx.save();
    // Warm, bright grade.
    ctx.fillStyle = 'rgba(255,232,180,0.08)';
    ctx.fillRect(0, 0, w, h);
    // (The sun glow, god rays and sparkles over the islands are the world's sky overlay: G.World.drawSkyOverlay.)
    // The rainbow: an arc across the upper sky, drifting a little against the camera.
    const R = Math.max(w, h) * 0.75, cx = w * 0.72 - ((cam.x * 0.04) % (w * 0.1)), cy = h * 1.05;
    const BANDS = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#9775fa', '#e599f7'];
    ctx.lineWidth = Math.max(5, h * 0.014);
    ctx.globalAlpha = 0.16 + Math.sin(now * 0.3) * 0.03;
    BANDS.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath(); ctx.arc(cx, cy, R - i * ctx.lineWidth, Math.PI * 1.08, Math.PI * 1.62); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    // White-gold edges instead of a dark vignette.
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(255,248,225,0)');
    v.addColorStop(1, 'rgba(255,244,214,0.38)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    // Drifting hearts and sparkles.
    const img = heartSprite();
    ctx.imageSmoothingEnabled = false;
    for (const s of screen) {
      const x = s.x + Math.sin(s.p * 0.8) * 14, a = G.U.clamp(s.life / 2, 0, 1) * 0.75;
      ctx.globalAlpha = a;
      if (s.heart) ctx.drawImage(img, Math.round(x), Math.round(s.y), 14, 12);
      else {
        const tw = 0.5 + Math.sin(s.p * 4) * 0.5, k = s.s + 1;
        ctx.fillStyle = tw > 0.5 ? '#ffffff' : '#ffe58a';
        ctx.fillRect(Math.round(x), Math.round(s.y - k), 2, 2 * k + 2);
        ctx.fillRect(Math.round(x - k), Math.round(s.y), 2 * k + 2, 2);
      }
    }
    ctx.restore();
  }

  const F = (wt, s) => `${wt} ${s}px Pixelify,"Segoe UI",system-ui,sans-serif`;

  /** Over the HUD: the Rest button, and the ending (brightening, scrolling lines, the title, the choice). */
  function drawOverlay(ctx, w, h) {
    if (!on) return;
    if (!ending && canRest()) restButton(ctx, w, h);
    if (ending) drawEnding(ctx, w, h);
  }

  function button(ctx, x, y, bw, bh, label, fn, hot) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 2, y - 2, bw + 4, bh + 4);
    const g = ctx.createLinearGradient(0, y, 0, y + bh);
    g.addColorStop(0, hot ? '#fff1b0' : '#fff8e0'); g.addColorStop(1, hot ? '#f2c94c' : '#e8d6a8');
    ctx.fillStyle = g; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x, y, bw, 2);
    ctx.font = F(800, 13); ctx.textAlign = 'center';
    ctx.fillStyle = '#5a3d0a'; ctx.fillText(label, x + bw / 2, y + bh / 2 + 5);
    G.Touch.addButton(x, y, bw, bh, fn, 6);
  }

  function restButton(ctx, w, h) {
    const bw = 116, bh = 32, x = w - bw - 22, y = h - 120;
    const pulse = 0.5 + Math.sin(performance.now() / 500) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.25 * pulse;
    ctx.fillStyle = GOLD; ctx.fillRect(x - 6, y - 6, bw + 12, bh + 12);
    ctx.globalAlpha = 1;
    button(ctx, x, y, bw, bh, seenEnding ? 'Rest (R)' : '✦ Rest (R)', rest, true);
    ctx.font = F(700, 10); ctx.textAlign = 'right';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)';
    const tip = seenEnding ? 'end the run whenever you like' : 'nothing hurts you here';
    ctx.strokeText(tip, x + bw, y - 8); ctx.fillStyle = CREAM; ctx.fillText(tip, x + bw, y - 8);
    ctx.restore();
  }

  function drawEnding(ctx, w, h) {
    const E = ending;
    ctx.save();
    // The screen softly brightens to a warm white.
    const b = E.choice ? 1 : G.U.clamp(E.t / T_BRIGHT, 0, 1), ease = b * b * (3 - 2 * b);
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.8);
    g.addColorStop(0, `rgba(255,253,244,${(ease * 0.95).toFixed(3)})`);
    g.addColorStop(1, `rgba(255,236,190,${(ease * 0.93).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    G.Touch.clearButtons();
    const st = E.choice ? 9999 : E.t - T_BRIGHT;
    if (st > 0) {
      // The lines scroll up from the bottom, two voices in two colours.
      ctx.textAlign = 'center';
      const y0 = h + 10 - st * SCROLL;
      LINES.forEach(([txt, voice], i) => {
        const y = y0 + i * LH;
        if (!txt || y < -LH || y > h + LH) return;
        const fadeIn = G.U.clamp((h - y) / 80, 0, 1), fadeOut = G.U.clamp((y - h * 0.12) / 90, 0, 1);
        ctx.globalAlpha = fadeIn * fadeOut;
        ctx.font = F(700, Math.round(G.U.clamp(w / 48, 15, 20)));
        ctx.fillStyle = voice ? '#3f7fb8' : '#9a6a12';
        ctx.fillText(txt, w / 2, y);
      });
      // Then the title.
      const ty = Math.max(h * 0.4, y0 + LINES.length * LH + h * 0.25);
      const ta = E.choice ? 1 : G.U.clamp((h * 0.9 - ty) / 120, 0, 1);
      if (ta > 0) {
        ctx.globalAlpha = ta;
        ctx.font = F(800, Math.round(G.U.clamp(w / 22, 26, 46)));
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(120,80,10,.25)';
        ctx.strokeText('YOU REACHED THE AETHER', w / 2, ty);
        const tg = ctx.createLinearGradient(0, ty - 40, 0, ty);
        tg.addColorStop(0, '#ffe58a'); tg.addColorStop(1, '#c98a12');
        ctx.fillStyle = tg;
        ctx.fillText('YOU REACHED THE AETHER', w / 2, ty);
        ctx.font = F(700, 13); ctx.fillStyle = '#8a6a2a';
        ctx.fillText('Paradise above the clouds. The climb is over.', w / 2, ty + 28);
        if (E.choice) {
          ctx.globalAlpha = 1;
          const bw = 170, bh = 34, gap = 18, x0 = w / 2 - bw - gap / 2, by = ty + 58;
          button(ctx, x0, by, bw, bh, 'Keep wandering (K)', wander, false);
          button(ctx, x0 + bw + gap, by, bw, bh, 'Rest (Enter)', finish, true);
        }
      }
    }
    if (!E.choice && E.t > E.skipAt) {
      ctx.globalAlpha = 0.55;
      ctx.font = F(700, 11); ctx.textAlign = 'right'; ctx.fillStyle = '#8a6a2a';
      ctx.fillText(G.Touch.active ? 'Tap to skip' : 'Space to skip', w - 16, h - 14);
      G.Touch.addButton(0, 0, w, h, () => { E.t = Math.max(E.t, scrollEnd()); }, 0);
    }
    ctx.restore();
  }

  return {
    ARRIVAL_COINS, ARRIVAL_KEYS, REST_AT, ENDING_AT, AETHER_MOBS,
    enter, reset, update, rest, groundEffect, playerGround, hopLift, drawables, drawAir, drawScreen, drawOverlay,
    /** Herobrine's fight summary ({ time, bosses }), set by floors.js on the way in (for the victory summary). */
    herobrine: null,
    get active() { return on; },
    /** The ending covers the screen (game.js hides the HUD and stops your input). */
    get ending() { return !!ending; },
    get hideHud() { return !!ending && (ending.choice || ending.t > T_BRIGHT * 0.6); },
    /** What plays: C418's Alpha through the ending, the gentle Aether list otherwise; null off the Aether. */
    get music() { return !on ? null : ending ? 'aether_end' : 'aether'; },
    get rewards() { return rewards; },
    get time() { return t; },
    /** Tests: the friendly mobs around you ({ key, x, y, lift, puff }). */
    get critters() { return critters.map(c => ({ key: c.key, x: c.x, y: c.y, lift: c.lift, puff: !!c.puff, love: c.love })); },
    /** Dev panel: play the ending now (it ends on the choice). */
    debugEnding() { if (on) { ending = null; play(true); } return on; },
    /** Tests: skip to the end of the scrolling text. */
    debugSkipText() { if (ending && !ending.choice) ending.t = scrollEnd() + 3.3; },
    /** Tests: a Sheepuff next to you puffs now. */
    debugPuff() { const c = critters.find(x => x.key === 'sheepuff'); if (c) puff(c); return !!c; }
  };
})();
