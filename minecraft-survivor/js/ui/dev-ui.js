/* ============ dev-ui.js — dev mode: a cheat panel for trying things out ============
 * Turned on per account (Settings → Account → Dev mode, stored as save.dev) or for the session
 * with ?dev in the address. When on, a DEV button shows in the corner; it (or the ` key) opens
 * the panel. Everything here uses the game's own debug hooks; nothing is hidden or locked.
 * On the online site (G.DB.mode 'cloud') only moderators (the online config's admins) and the
 * local emulators get it, and a run where the panel was used never reaches the leaderboard.
 */
G.Dev = (() => {
  const S = { god: false, oneHit: false, noSpawns: false };
  let panel = null, btn = null, open = false;
  let cheats = 0;                // panel actions used (game.js keeps such runs off the leaderboard)
  const $ = s => panel.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function allowed() {
    if (!G.DB || G.DB.mode !== 'cloud') return true;
    return !!((G.DB.config || {}).emulator || (G.Ranking && G.Ranking.isAdmin()));
  }
  function enabled() {
    if (!allowed()) return false;
    return /[?&]dev\b/.test(location.search) || !!(G.DB && G.DB.save && G.DB.save.dev && !G.DB.guest);
  }
  function setEnabled(on) {
    if (!G.DB.save || G.DB.guest) return;
    G.DB.save.dev = !!on;
    G.DB.commit();
    refresh();
  }

  const inRun = () => G.Game && G.Game.state !== 'ui' && G.Game.player;
  const pl = () => G.Game.player;
  function say(msg) { G.UI.toast(msg, 1600); }

  // ---------------- cheats that patch the engine ----------------
  function patch() {
    const ph = G.Player.prototype.hurt;
    G.Player.prototype.hurt = function (...a) { return S.god ? 0 : ph.apply(this, a); };
    const eh = G.Enemy.prototype.hurt;
    G.Enemy.prototype.hurt = function (amount, ...a) {
      if (S.oneHit && !this.judge && amount > 0) amount = Math.max(amount, this.hp + (this.shield || 0) + 1);
      return eh.call(this, amount, ...a);
    };
  }

  // ---------------- actions ----------------
  function account(fn, msg) {
    const s = G.DB.save;
    if (!s) return;
    fn(s);
    G.DB.commit();
    G.UI.refreshCoins();
    if (!inRun() && G.UI.isOpen && G.UI.isOpen('scr-ench')) G.EnchantUI.render();
    else if (!inRun() && G.UI.isOpen && G.UI.isOpen('scr-menu')) G.MenuUI.open();
    say(msg);
  }

  function spawnMob(dex, n, shiny, boss) {
    const p = G.DEX_BY[dex], P = pl();
    if (!p || !P) return;
    const t = G.Game.st.time, ti = G.Enemies.tierAt(t);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, d = 170 + Math.random() * 90;
      const x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d * 0.8;
      if (boss) { const e = G.Spawner.spawnBoss(G.Enemies.bossDef(p, t, 'mid'), t, [x, y]); if (shiny && e && !e.shiny) e.makeShiny(); continue; }
      const def = G.Enemies.defFor(p, G.Enemies.TIERS[ti], ti);
      const sc = G.Enemies.scale(t);
      const e = new G.Enemy(def, x, y, { hp: sc.hp, dmg: sc.dmg, spd: sc.spd });
      if (shiny) e.makeShiny();
      G.EnemyMgr.add(e);
    }
  }

  /** Nearest point of a biome in the current dimension (spiral search). */
  function findBiome(key) {
    const P = pl();
    for (let r = 0; r < 60000; r += 250) {
      const n = Math.max(1, Math.round(r / 120));
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.2832, x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
        if (G.World.biomeKeyAt(x, y) === key && G.World.isFree(x, y, 14)) return [x, y];
      }
    }
    return null;
  }
  function teleport(x, y) {
    const P = pl();
    P.x = x; P.y = y; G.Camera.x = x; G.Camera.y = y;
    G.EnemyMgr.clear();
  }

  function giveSkill(id) {
    const P = pl();
    if (P.hasMove(id)) { say('Already have it'); return; }
    if (P.slots.length >= P.maxMoves) {
      // Full: the last slot makes room.
      const gone = P.slots.pop();
      P.moves = P.moves.filter(m => !gone.includes(m));
      P.active = Math.min(P.active, P.slots.length - 1);
    }
    P.addMove(id);
    say('Skill: ' + G.Moves.BY_ID[id].name);
  }
  function maxSkills(smith) {
    const P = pl();
    for (const m of P.moves) {
      while (G.Moves.levelUp(m)) { /* to max */ }
      if (smith && G.Moves.EVO[m.id] && !m.evolved && G.Moves.evolve(m)) G.Progress && G.Progress.event('evolve', { id: m.id });
    }
    say(smith ? 'All skills maxed and upgraded at Smithing' : 'All skills maxed');
  }

  const ACTIONS = {
    // account
    emeralds: () => account(s => { s.coins += 10000; }, '+10,000 emeralds'),
    keys: () => account(s => { s.tickets = s.tickets || { t1: 0, t10: 0 }; s.tickets.t1 += 50; s.tickets.t10 += 10; }, '+50 Trial Keys, +10 Ominous Keys'),
    unlockAll: () => account(s => { for (const p of G.DEX) G.DB.grant(p.dex, 'dev'); }, 'Every mob unlocked'),
    enchantAll: () => account(s => { for (const p of G.DEX) if (G.Sprites.hasShiny(p.dex)) G.DB.grantShiny(p.dex, 'dev'); }, 'Every Enchanted mob unlocked'),
    maxUpgrades: () => account(s => {
      const u = G.DB.upgradesOf(s.partner);
      for (const it of G.Upgrades.LIST) u[it.id] = it.max;
    }, 'Upgrades maxed for ' + ((G.DEX_BY[(G.DB.save || {}).partner] || {}).name || 'your partner')),
    // enchanting (systems/enchanting.js)
    enchUnlock: () => account(s => { G.Enchanting.slay(s.partner); }, 'Enchanting unlocked for ' + G.DEX_BY[(G.DB.save || {}).partner].name),
    enchBooks: () => account(() => { for (const e of G.ENCHANT.LIST) G.Enchanting.grantBook({ id: e.id, lvl: 1 }); }, 'One book of each enchantment (level I)'),
    enchRandom: () => account(() => {
      for (let i = 0; i < 10; i++) G.Enchanting.grantBook(G.Enchanting.rollBook('any', G.U.randInt(0, G.DIMENSIONS.length - 1)));
    }, '+10 random books'),
    enchMaster: () => account(s => { G.Enchanting.debugMaster(s.partner); }, G.DEX_BY[(G.DB.save || {}).partner].name + ' Mastered'),
    // Spawner: a ×10 of Legendaries in the open realm (opens the Spawner if needed; the keys are given).
    pullLegend: () => {
      if (inRun()) { say('Leave the run first'); return; }
      const s = G.DB.save;
      s.tickets = s.tickets || { t1: 0, t10: 0 };
      s.tickets.t1 += 10;
      G.Gacha.debugForceLegend(10);
      toggle(false);
      if (!(G.UI.isOpen && G.UI.isOpen('scr-gacha'))) G.GachaUI.open();
      G.GachaUI.pull(10, 't1');
    },
    partner: () => {
      const dex = +$('#dv-partner').value;
      account(s => { G.DB.grant(dex, 'dev'); s.partner = dex; s.partnerShiny = false; }, 'Partner: ' + G.DEX_BY[dex].name);
    },
    // run: player
    level1: () => { G.Game.debugLevelUp(); },
    level5: () => { for (let i = 0; i < 5; i++) G.Game.debugLevelUp(); },
    heal: () => { const P = pl(); P.hp = P.maxHp; say('Healed'); },
    skill: () => giveSkill($('#dv-skill').value),
    maxSkills: () => maxSkills(false),
    enchantSkills: () => maxSkills(true),
    item: () => { const id = $('#dv-item').value; pl().equip(id); say('Holding: ' + G.Items.BY[id].name); },
    speed1: () => G.Game.debugSpeed(1), speed2: () => G.Game.debugSpeed(2), speed4: () => G.Game.debugSpeed(4),
    // run: time & world
    min1: () => G.Game.debugTime(G.Game.st.time + 60),
    min5: () => G.Game.debugTime(G.Game.st.time + 300),
    setTime: () => { const m = parseFloat($('#dv-time').value); if (!isNaN(m)) G.Game.debugTime(m * 60); },
    day: () => G.DayNight.debugSet('day'), dusk: () => G.DayNight.debugSet('dusk'),
    night: () => G.DayNight.debugSet('night'), dawn: () => G.DayNight.debugSet('dawn'),
    // One button per floor (data-a = the floor's id), plus Herobrine mode = jump to the last floor.
    ...Object.fromEntries(G.DIMENSIONS.map(d => [d.id, () => G.Game.debugDimension(d.id)])),
    herobrine: () => G.Game.debugDimension('herobrine'),
    // The Aether (systems/aether.js): win Herobrine's World (its portal builds next to you), go there, the ending.
    aetherWin: () => {
      if (G.Floors.def.goal !== 'herobrine') G.Game.debugDimension('herobrine');
      G.Floors.debugWinHerobrine();
      say('The Aether portal is rising');
    },
    aetherGo: () => G.Game.debugDimension('aether'),
    aetherEnd: () => { if (!G.Aether.active) G.Game.debugDimension('aether'); G.Aether.debugEnding(); },
    biome: () => {
      const key = $('#dv-biome').value, pt = findBiome(key);
      if (!pt) { say('Not found nearby'); return; }
      teleport(pt[0], pt[1]);
      say('→ ' + G.BIOME_DEFS[key].name);
    },
    weather: () => G.Weather.debugStart($('#dv-weather').value, 60),
    // run: fights
    midBoss: () => G.Game.debugBoss('mid'),
    floorBoss: () => G.Game.debugBoss('floor'),
    portal: () => G.Game.debugPortal(),
    crystals: () => { if (!G.EndFight.left) { say('No End Crystals here (The End only)'); return; } G.EndFight.debugBreakAll(); },
    warn: () => { if (G.Floors.def.goal !== 'shriek') { say('Only in the Ancient City'); return; } G.Floors.debugWarn(); },
    room: () => { if (!G.Floors.debugRoom()) say('Only in the Stronghold'); },
    roomDone: () => { if (G.Floors.def.goal !== 'portal') { say('Only in the Stronghold'); return; } G.Floors.debugRoom(true); },
    elders: () => { if (!G.Floors.debugElders()) say('Only in the Ocean'); },
    dolphins: () => { if (!G.Floors.underwater) { say('Only in the Ocean'); return; } G.Events.debugStart('dolphins'); },
    guardians: () => { if (!G.Floors.underwater) { say('Only in the Ocean'); return; } G.Events.debugStart('guardians'); },
    trial: () => G.Rift.debugArena(),
    trialPortal: () => G.Rift.debugOpen(),
    siege: () => G.Events.debugStart('horde'), rush: () => G.Events.debugStart('gold'),
    pet: () => G.Events.debugStart('lost'), thief: () => G.Events.debugThief(),
    spawn: () => spawnMob(+$('#dv-mob').value, +$('#dv-count').value, $('#dv-shiny').checked, $('#dv-boss').checked),
    // Armoured mobs and jockeys (systems/spawner.js), next to you.
    ...Object.fromEntries(['iron', 'diamond', 'netherite', 'chicken_jockey', 'spider_jockey'].map(k => ['sp_' + k, () => {
      const e = G.Spawner.debugSpecial(k);
      say(e ? e.name : 'Nothing to spawn');
    }])),
    killAll: () => { for (const e of [...G.EnemyMgr.all()]) if (!e.judge && !e.dead) { e.hp = 0; e.die && e.die(); } },
    clear: () => G.EnemyMgr.clear()
  };

  // ---------------- UI ----------------
  const CSS = `
    #dev-btn { position: fixed; left: 10px; bottom: 10px; z-index: 60; font: 700 12px Pixelify, monospace; padding: 6px 10px;
      background: #8b1a1a; color: #fff; border: 2px solid #ff6b6b; box-shadow: 0 2px 0 #000; cursor: pointer; }
    #dev-panel { position: fixed; left: 10px; top: 60px; max-height: calc(100vh - 110px); width: 330px; z-index: 61; overflow-y: auto;
      background: rgba(18,18,22,.94); border: 2px solid #ff6b6b; color: #ddd; font: 12px Pixelify, monospace; padding: 10px; }
    #dev-panel h3 { margin: 10px 0 4px; font-size: 13px; color: #ff9b9b; }
    #dev-panel h3:first-child { margin-top: 0; }
    #dev-panel .r { display: flex; flex-wrap: wrap; gap: 4px; margin: 3px 0; align-items: center; }
    #dev-panel button { font: 11px Pixelify, monospace; padding: 3px 7px; background: #3a3a40; color: #fff;
      border: 1px solid #77777f; cursor: pointer; }
    #dev-panel button:hover { background: #55555c; }
    #dev-panel button.on { background: #2f7a2a; border-color: #6fd36a; }
    #dev-panel select, #dev-panel input[type=number], #dev-panel input[type=text] { font: 11px Pixelify, monospace;
      background: #222; color: #fff; border: 1px solid #666; padding: 2px; max-width: 190px; }
    #dev-panel .note { color: #999; font-size: 10px; margin: 2px 0; }
    #dev-panel .x { float: right; }`;

  const b = (act, label) => `<button data-a="${act}">${esc(label)}</button>`;
  const tg = (k, label) => `<button data-t="${k}" class="${S[k] ? 'on' : ''}">${esc(label)}</button>`;

  function html() {
    const run = inRun();
    const mobs = G.DEX.filter(p => !p.v).slice().sort((a, b2) => a.name.localeCompare(b2.name));
    const all = G.DEX.slice().sort((a, b2) => a.name.localeCompare(b2.name));
    const skills = G.Moves.ALL.slice().sort((a, b2) => a.name.localeCompare(b2.name));
    const dim = run ? ((G.Floors && G.Floors.def) || G.DIMENSIONS[0]) : null;
    const opt = (v, l, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(l)}</option>`;
    let h = `<button class="x" data-a="close">✕</button><h3>DEV MODE</h3>
      <p class="note">\` toggles this panel. Turn dev mode off in Settings → Account.</p>
      <h3>Account</h3>
      <div class="r">${b('emeralds', '+10k emeralds')}${b('keys', '+keys')}</div>
      <div class="r">${b('unlockAll', 'Unlock all mobs')}${b('enchantAll', 'All Enchanted')}</div>
      <div class="r">${b('maxUpgrades', 'Max upgrades (partner)')}</div>
      <div class="r">${b('enchUnlock', 'Unlock enchanting (partner)')}${b('enchMaster', 'Master partner')}</div>
      <div class="r">${b('enchBooks', '+books (one of each, level I)')}${b('enchRandom', '+random books ×10')}</div>
      <div class="r">${b('pullLegend', 'Pull ×10 guaranteed Legendary')}</div>
      <div class="r"><select id="dv-partner">${all.map(p => opt(p.dex, p.name, G.DB.save && p.dex === G.DB.save.partner)).join('')}</select>${b('partner', 'Set partner')}</div>`;
    if (!run) return h + `<p class="note">Start a run for the in-game cheats.</p>`;
    h += `<h3>Cheats</h3>
      <div class="r">${tg('god', 'God mode')}${tg('oneHit', 'One-hit kills')}${tg('noSpawns', 'No spawns')}</div>
      <div class="r">${b('speed1', '×1')}${b('speed2', '×2')}${b('speed4', '×4')} <span class="note">game speed</span></div>
      <h3>You</h3>
      <div class="r">${b('level1', '+1 level')}${b('level5', '+5 levels')}${b('heal', 'Heal')}</div>
      <div class="r"><select id="dv-skill">${skills.map(m => opt(m.id, m.name + ' (' + G.U.TYPE_NAME[m.type] + ')')).join('')}</select>${b('skill', 'Give skill')}</div>
      <div class="r">${b('maxSkills', 'Max skills')}${b('enchantSkills', 'Max + Smithing skills')}</div>
      <div class="r"><select id="dv-item">${G.Items.LIST.map(it => opt(it.id, it.name)).join('')}</select>${b('item', 'Hold item')}</div>
      <h3>Time</h3>
      <div class="r">${b('min1', '+1 min')}${b('min5', '+5 min')}<input id="dv-time" type="number" min="0" max="35" step="0.5" style="width:52px" placeholder="min">${b('setTime', 'Set clock')}</div>
      <div class="r">${b('day', 'Day')}${b('dusk', 'Dusk')}${b('night', 'Night')}${b('dawn', 'Dawn')}</div>
      <h3>Floors</h3>
      <div class="r">${G.DIMENSIONS.map((d, i) => b(d.id, (d.goal === 'paradise' ? '✦' : i + 1) + ' ' + d.short)).join('')}</div>
      <div class="r">${b('herobrine', 'Herobrine mode')}</div>
      <div class="r">${b('aetherWin', "Win Herobrine's World (open Aether portal)")}</div>
      <div class="r">${b('aetherGo', 'Go to the Aether')}${b('aetherEnd', 'Play the ending')}</div>
      <div class="r">${b('elders', 'Wake the Elder Guardians')}</div>
      <div class="r">${b('dolphins', 'Sea battle: dolphins')}${b('guardians', 'Sea battle: guardian patrol')}</div>
      <div class="r">${b('room', 'Go to portal room')}${b('roomDone', 'Activate End portal')}</div>
      <div class="r">${b('crystals', 'Destroy crystals')}${b('warn', 'Warden warning +1')}</div>
      <h3>World</h3>
      <div class="r"><select id="dv-biome">${dim.biomes.map(k => opt(k, G.BIOME_DEFS[k].name)).join('')}</select>${b('biome', 'Go to biome')}</div>
      <div class="r"><select id="dv-weather">${['sun', 'rain', 'sand', 'snow', 'fog'].map(k => opt(k, k)).join('')}</select>${b('weather', 'Weather')}</div>
      <h3>Fights</h3>
      <div class="r">${b('midBoss', 'Mid-boss')}${b('floorBoss', 'Floor boss')}${b('portal', 'Open portal')}</div>
      <div class="r">${b('trial', 'Enter Trial Chamber')}${b('trialPortal', 'Spawn Trial entrance')}</div>
      <div class="r">${b('siege', 'Mob Siege')}${b('rush', 'Emerald Rush')}${b('pet', 'Lost Pet')}${b('thief', 'Thief')}</div>
      <div class="r"><select id="dv-mob">${mobs.map(p => opt(p.dex, p.name)).join('')}</select>
        <select id="dv-count">${[1, 3, 5, 10].map(n => opt(n, '×' + n)).join('')}</select></div>
      <div class="r"><label><input id="dv-shiny" type="checkbox"> Enchanted</label><label><input id="dv-boss" type="checkbox"> As boss</label>${b('spawn', 'Spawn')}</div>
      <div class="r"><span class="note">Spawn armoured mob:</span>${b('sp_iron', 'Iron')}${b('sp_diamond', 'Diamond')}${b('sp_netherite', 'Netherite')}</div>
      <div class="r">${b('sp_chicken_jockey', 'Spawn Chicken Jockey')}${b('sp_spider_jockey', 'Spawn Spider Jockey')}</div>
      <div class="r">${b('killAll', 'Kill all')}${b('clear', 'Remove all')}</div>`;
    return h;
  }

  function render() {
    if (!panel) return;
    // Keep the dropdown choices across re-renders.
    const keep = {};
    panel.querySelectorAll('select, input').forEach(el => { keep[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
    panel.innerHTML = html();
    panel.querySelectorAll('select, input').forEach(el => { if (el.id in keep && el.id !== 'dv-partner' && el.id !== 'dv-biome') { if (el.type === 'checkbox') el.checked = keep[el.id]; else el.value = keep[el.id]; } });
    panel.querySelectorAll('[data-a]').forEach(el => el.onclick = e => {
      e.stopPropagation();
      const a = el.dataset.a;
      if (a === 'close') { toggle(false); return; }
      cheats++;
      try { ACTIONS[a](); } catch (err) { console.warn('[dev]', a, err); say('Failed: ' + err.message); }
      el.blur();
    });
    panel.querySelectorAll('[data-t]').forEach(el => el.onclick = e => {
      e.stopPropagation();
      S[el.dataset.t] = !S[el.dataset.t];
      cheats++;
      el.classList.toggle('on', S[el.dataset.t]);
      el.blur();
    });
  }

  function toggle(on = !open) {
    if (!enabled()) on = false;
    open = on;
    panel.style.display = open ? 'block' : 'none';
    if (open) render();
  }

  /** Show/hide the DEV button (account change, setting change). */
  function refresh() {
    if (!btn) return;
    const on = enabled() && !!G.DB.save;
    btn.style.display = on ? 'block' : 'none';
    if (!on) { toggle(false); for (const k in S) S[k] = false; }
  }

  function init() {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    btn = document.createElement('button');
    btn.id = 'dev-btn'; btn.textContent = 'DEV'; btn.style.display = 'none';
    btn.onclick = e => { e.stopPropagation(); toggle(); };
    panel = document.createElement('div');
    panel.id = 'dev-panel'; panel.style.display = 'none';
    panel.setAttribute('translate', 'no');
    // Clicks and keys inside the panel stay out of the game.
    panel.addEventListener('mousedown', e => e.stopPropagation());
    panel.addEventListener('keydown', e => e.stopPropagation());
    document.body.append(btn, panel);
    addEventListener('keydown', e => {
      if (e.key !== '`' || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName)) return;
      if (enabled() && G.DB.save) toggle();
    });
    patch();
    // The button follows the session; the panel's run section follows run start/end.
    setInterval(() => {
      refresh();
      if (open) {
        // Re-render when a run starts/ends or the floor changes (the biome list follows the floor).
        const r = String(!!inRun()) + (inRun() ? G.Floors.dim : '');
        if (r !== panel.dataset.run) { panel.dataset.run = r; render(); }
      }
    }, 700);
  }

  init();

  return {
    get enabled() { return enabled(); }, get allowed() { return allowed(); }, get cheats() { return cheats; }, setEnabled, toggle, refresh,
    get god() { return S.god; }, get oneHit() { return S.oneHit; }, get noSpawns() { return S.noSpawns; },
    set god(v) { S.god = !!v; }, set oneHit(v) { S.oneHit = !!v; }, set noSpawns(v) { S.noSpawns = !!v; },
    actions: ACTIONS
  };
})();
