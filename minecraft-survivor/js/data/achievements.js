/* ============ achievements.js — achievements, medals and titles ============
 * Each achievement: a medal (bronze 1, silver 2, gold 3), a reward when it
 * unlocks and sometimes a profile title. Checked in systems/progress.js.
 *
 *   value(save) -> current progress (number) · goal -> what it must reach
 *
 * There is also one achievement per great boss mob (Giant, Elder Guardian, Warden, Wither,
 * Ender Dragon), awarded when it falls as a mid-boss or floor boss (systems/floors.js), plus the
 * floor ones (one per floor reached, from save.dims) and one per floor cleared: The Raid,
 * Ominous Trial, Free the End, Silence the Deep (save.floors). The Aether (systems/aether.js): Hostile Paradise
 * (the Aether mod's own name), Halo, Seventh Heaven and When Phygs Fly! (also the mod's).
 */
G.AchDefs = (() => {
  const own = s => Object.keys(s.owned || {}).filter(d => G.DEX_BY[d]).length;
  const shinies = s => Object.keys(s.shiny || {}).length;
  const legends = s => Object.keys(s.legends || {}).length;
  const st = k => s => (s.stats && s.stats[k]) || 0;
  const count = k => s => Object.keys(s[k] || {}).length;
  const ench = fn => s => (G.Enchanting ? G.Enchanting[fn](s) : 0);

  const CATS = [['coleccion', 'Collection'], ['supervivencia', 'Survival'], ['combate', 'Combat'], ['dimensiones', 'Dimensions'],
                ['grietas', 'Trial Chambers'], ['legendarios', 'Boss Mobs'], ['encantar', 'Enchanting'], ['otros', 'Missions & more']];
  const dim = id => s => (s.dims && s.dims[id] ? 1 : 0);
  const floor = id => s => (s.floors && s.floors[id] ? 1 : 0);

  const LIST = [
    // ---------- collection ----------
    { id: 'own1', cat: 'coleccion', tier: 1, name: 'First Partner', desc: 'Own 1 mob.', value: own, goal: 1, reward: { coins: 100 } },
    { id: 'own10', cat: 'coleccion', tier: 1, name: 'Small Herd', desc: 'Own 10 mobs.', value: own, goal: 10, reward: { t1: 2 } },
    { id: 'own50', cat: 'coleccion', tier: 2, name: 'Collector', desc: 'Own 50 mobs.', value: own, goal: 50, reward: { t1: 5 }, title: 'Collector' },
    { id: 'own100', cat: 'coleccion', tier: 2, name: 'A Hundred Friends', desc: 'Own 100 mobs.', value: own, goal: 100, reward: { t10: 1 } },
    // The Mobdex has 166 mobs (PokéSurvivor had 966): the two big goals are scaled to it.
    { id: 'own250', cat: 'coleccion', tier: 3, name: 'Mob Master', desc: 'Own 130 mobs.', value: own, goal: 130, reward: { t10: 2 }, title: 'Mob Master' },
    { id: 'own500', cat: 'coleccion', tier: 3, name: 'Encyclopedia', desc: 'Own 150 mobs.', value: own, goal: 150, reward: { t10: 3 } },
    { id: 'ownAll', cat: 'coleccion', tier: 3, name: 'Complete Mobdex', desc: 'Own every mob in the game.', value: own, goal: 966, reward: { t10: 10 }, title: 'Mobdex Professor' },
    { id: 'shiny1', cat: 'coleccion', tier: 1, name: 'Something Glints', desc: 'Collect your first Enchanted mob.', value: shinies, goal: 1, reward: { t1: 3 }, title: 'Glinting' },
    { id: 'shiny5', cat: 'coleccion', tier: 2, name: 'Glint Collector', desc: 'Collect 5 Enchanted mobs.', value: shinies, goal: 5, reward: { t10: 1 } },
    { id: 'shiny20', cat: 'coleccion', tier: 3, name: 'Glint Hunter', desc: 'Collect 20 Enchanted mobs.', value: shinies, goal: 20, reward: { t10: 2 }, title: 'Glint Hunter' },
    { id: 'pulls100', cat: 'coleccion', tier: 2, name: 'Mob Farmer', desc: 'Use the Spawner 100 times.', value: st('pulls'), goal: 100, reward: { t10: 1 }, title: 'Lucky' },

    // ---------- survival ----------
    { id: 'time5', cat: 'supervivencia', tier: 1, name: 'Warming Up', desc: 'Survive 5 minutes.', value: s => Math.floor(st('bestTime')(s) / 60), goal: 5, reward: { coins: 200 } },
    { id: 'time10', cat: 'supervivencia', tier: 2, name: 'Tough Cookie', desc: 'Survive 10 minutes.', value: s => Math.floor(st('bestTime')(s) / 60), goal: 10, reward: { t1: 4 } },
    { id: 'time15', cat: 'supervivencia', tier: 2, name: 'Resilient', desc: 'Survive 15 minutes.', value: s => Math.floor(st('bestTime')(s) / 60), goal: 15, reward: { t10: 1 } },
    { id: 'time20', cat: 'supervivencia', tier: 3, name: 'Survivor', desc: 'Survive 20 minutes.', value: s => Math.floor(st('bestTime')(s) / 60), goal: 20, reward: { t10: 2 }, title: 'Survivor' },
    { id: 'lvl20', cat: 'supervivencia', tier: 1, name: 'Growing Up', desc: 'Reach level 15 in a run.', value: st('bestLevel'), goal: 15, reward: { t1: 2 } },
    { id: 'lvl40', cat: 'supervivencia', tier: 3, name: 'Unstoppable', desc: 'Reach level 30 in a run.', value: st('bestLevel'), goal: 30, reward: { t10: 1 }, title: 'Unstoppable' },
    // Herobrine Awakens on the last floor (systems/judgment.js).
    { id: 'judge60', cat: 'supervivencia', tier: 3, name: 'Staring Contest', desc: 'Survive 1 minute against Herobrine.', value: st('judgeTime'), goal: 60, reward: { t10: 2 }, title: 'Herobrine\'s Rival' },
    { id: 'judge300', cat: 'supervivencia', tier: 3, name: 'Still Standing', desc: 'Survive 5 minutes against Herobrine.', value: st('judgeTime'), goal: 300, reward: { t10: 4 }, title: 'Unbroken' },
    { id: 'judgeBoss', cat: 'supervivencia', tier: 3, name: 'Boss Rush', desc: 'Defeat 3 boss mobs while Herobrine hunts you, in a single run.', value: st('judgeBosses'), goal: 3, reward: { t10: 2 } },
    { id: 'runs50', cat: 'supervivencia', tier: 2, name: 'Explorer', desc: 'Play 50 runs.', value: st('runs'), goal: 50, reward: { t10: 1 }, title: 'Explorer' },

    // ---------- combat ----------
    { id: 'kills1k', cat: 'combate', tier: 1, name: 'First Fights', desc: 'Defeat 1,000 mobs.', value: st('totalKills'), goal: 1000, reward: { t1: 2 } },
    { id: 'kills10k', cat: 'combate', tier: 2, name: 'Veteran', desc: 'Defeat 10,000 mobs.', value: st('totalKills'), goal: 10000, reward: { t10: 1 }, title: 'Veteran' },
    { id: 'kills100k', cat: 'combate', tier: 3, name: 'Living Legend', desc: 'Defeat 100,000 mobs.', value: st('totalKills'), goal: 100000, reward: { t10: 3 }, title: 'Living Legend' },
    { id: 'boss1', cat: 'combate', tier: 1, name: 'Giant Slayer', desc: 'Defeat a boss.', value: st('bossesTotal'), goal: 1, reward: { t1: 2 } },
    { id: 'boss25', cat: 'combate', tier: 2, name: 'Boss Hunter', desc: 'Defeat 25 bosses.', value: st('bossesTotal'), goal: 25, reward: { t10: 1 }, title: 'Boss Hunter' },
    { id: 'boss100', cat: 'combate', tier: 3, name: 'Terror of Bosses', desc: 'Defeat 100 bosses.', value: st('bossesTotal'), goal: 100, reward: { t10: 2 } },
    { id: 'evo1', cat: 'combate', tier: 1, name: 'First Smithing', desc: 'Upgrade a maxed skill with a Smithing card.', value: st('evolutions'), goal: 1, reward: { t1: 3 } },
    { id: 'evo25', cat: 'combate', tier: 2, name: 'Arcane Smith', desc: 'Use 25 Smithing cards.', value: st('evolutions'), goal: 25, reward: { t10: 1 }, title: 'Arcane Smith' },
    { id: 'evoAll', cat: 'combate', tier: 3, name: 'Master Smith', desc: 'Use Smithing on every different skill.', value: count('evoMoves'), goal: 47, reward: { t10: 3 }, title: 'Master Smith' },
    { id: 'items5', cat: 'combate', tier: 1, name: 'Full Inventory', desc: 'Find 5 different items.', value: count('itemsFound'), goal: 5, reward: { t1: 3 } },
    { id: 'itemsAll', cat: 'combate', tier: 2, name: 'Item Collector', desc: 'Find all 11 items.', value: count('itemsFound'), goal: 11, reward: { t10: 1 }, title: 'Hoarder' },

    // ---------- the floors (systems/floors.js): one per floor reached, one per floor cleared ----------
    { id: 'raid', cat: 'dimensiones', tier: 1, name: 'The Raid', desc: 'Defeat the Ravager and its raiders on the Overworld.', value: floor('overworld'), goal: 1, reward: { t1: 3 }, title: 'Hero of the Village' },
    { id: 'dimOcean', cat: 'dimensiones', tier: 1, name: 'Into the Deep', desc: 'Dive into the Ocean.', value: dim('ocean'), goal: 1, reward: { t1: 3 } },
    { id: 'monument', cat: 'dimensiones', tier: 2, name: 'Monument Raider', desc: 'Defeat all three Elder Guardians of the Ocean Monument.', value: floor('ocean'), goal: 1, reward: { t10: 1 }, title: 'Monument Raider' },
    { id: 'dimUnder', cat: 'dimensiones', tier: 1, name: 'Into the Depths', desc: 'Step through the cave entrance into the Underworld.', value: dim('underworld'), goal: 1, reward: { t1: 3 } },
    { id: 'ominous', cat: 'dimensiones', tier: 2, name: 'Ominous Trial', desc: 'Defeat the Ominous Breeze, floor boss of the Underworld.', value: floor('underworld'), goal: 1, reward: { t10: 1 }, title: 'Trial Breaker' },
    { id: 'dimNether', cat: 'dimensiones', tier: 2, name: 'Enter the Nether', desc: 'Step through the Nether Portal.', value: dim('nether'), goal: 1, reward: { t10: 1 }, title: 'Nether Explorer' },
    { id: 'dimStronghold', cat: 'dimensiones', tier: 2, name: 'Into the Stronghold', desc: 'Defeat the Wither and find the Stronghold.', value: dim('stronghold'), goal: 1, reward: { t10: 1 } },
    { id: 'dimEnd', cat: 'dimensiones', tier: 3, name: 'Enter the End', desc: 'Activate the End Portal in the Stronghold and step through it.', value: dim('end'), goal: 1, reward: { t10: 2 }, title: 'End Walker' },
    { id: 'freeEnd', cat: 'dimensiones', tier: 3, name: 'Free the End', desc: 'Destroy the End Crystals and defeat the Ender Dragon.', value: floor('end'), goal: 1, reward: { t10: 3 }, title: 'Dragon Slayer' },
    { id: 'dimAncient', cat: 'dimensiones', tier: 3, name: 'Deeper and Darker', desc: 'Step through the End Gateway into the Ancient City.', value: dim('ancient_city'), goal: 1, reward: { t10: 2 } },
    { id: 'silence', cat: 'dimensiones', tier: 3, name: 'Silence the Deep', desc: 'Defeat the Warden, floor boss of the Ancient City.', value: floor('ancient_city'), goal: 1, reward: { t10: 3 }, title: 'Warden\'s Bane' },
    { id: 'judge', cat: 'dimensiones', tier: 3, name: 'Herobrine Awakens', desc: 'Climb to Herobrine\'s World, the last floor.', value: s => (dim('herobrine')(s) || st('judged')(s) ? 1 : 0), goal: 1, reward: { t10: 2 }, title: 'Haunted' },
    // ---------- the Aether: the end of the climb (systems/aether.js) ----------
    { id: 'aether1', cat: 'dimensiones', tier: 3, name: 'Hostile Paradise', desc: 'Ascend to the Aether through a glowstone portal.', value: st('aether'), goal: 1, reward: { t10: 2 }, title: 'Ascended' },
    { id: 'aetherHalo', cat: 'dimensiones', tier: 3, name: 'Halo', desc: 'Reach the Aether with 5 different characters.', value: count('ascended'), goal: 5, reward: { t10: 3 }, title: 'Haloed' },
    { id: 'aether7', cat: 'dimensiones', tier: 3, name: 'Seventh Heaven', desc: 'Reach the Aether 7 times.', value: st('aether'), goal: 7, reward: { t10: 5 }, title: 'Seventh Heaven' },
    { id: 'phyg', cat: 'dimensiones', tier: 2, name: 'When Phygs Fly!', desc: 'Befriend a Phyg in the Aether: stay by one until the hearts come.', value: st('phygLove'), goal: 1, reward: { t1: 5 } },
    { id: 'floors5', cat: 'dimensiones', tier: 2, name: 'Floor Sweeper', desc: 'Defeat 5 floor bosses.', value: st('floorBosses'), goal: 5, reward: { t10: 1 } },

    // ---------- Trial Chambers (ids kept from the old portal arenas) ----------
    { id: 'rift1', cat: 'grietas', tier: 1, name: 'Trial Run', desc: 'Win your first Trial Chamber battle.', value: st('riftWins'), goal: 1, reward: { t1: 3 }, title: 'Brave' },
    { id: 'rift10', cat: 'grietas', tier: 2, name: 'Trial Veteran', desc: 'Win 10 Trial Chamber battles.', value: st('riftWins'), goal: 10, reward: { t10: 1 } },
    { id: 'arenas', cat: 'grietas', tier: 3, name: 'Chamber Master', desc: 'Win in all 18 Trial Chamber arenas (one per element).', value: count('arenas'), goal: 18, reward: { t10: 2 }, title: 'Dimension Traveler' },

    // ---------- boss mobs (counters; one per boss is added below) ----------
    // Only 5 great boss mobs (PokéSurvivor had 87 legendaries): goals scaled to them.
    { id: 'leg10', cat: 'legendarios', tier: 2, name: 'Legend Hunter', desc: 'Defeat 2 different boss mobs.', value: legends, goal: 2, reward: { t10: 1 }, title: 'Legend Hunter' },
    { id: 'leg30', cat: 'legendarios', tier: 3, name: 'Myth Tamer', desc: 'Defeat 4 different boss mobs.', value: legends, goal: 4, reward: { t10: 2 } },
    { id: 'legAll', cat: 'legendarios', tier: 3, name: 'Legend', desc: 'Defeat every boss mob.', value: legends, goal: 87, reward: { t10: 5 }, title: 'Legend' },

    // ---------- the Enchanting Table (systems/enchanting.js; ENCHANTING.md) ----------
    { id: 'enchSlayer', cat: 'encantar', tier: 2, name: 'Knowledge Unlocked', desc: 'Unlock enchanting on a character: defeat the Ender Dragon with it.', value: count('slayer'), goal: 1, reward: { t10: 1 } },
    { id: 'ench1', cat: 'encantar', tier: 1, name: 'First Enchantment', desc: 'Apply an Enchanted Book at the Enchanting Table.', value: st('enchants'), goal: 1, reward: { t1: 3 } },
    { id: 'anvil10', cat: 'encantar', tier: 2, name: 'Anvil Apprentice', desc: 'Combine 10 books at the anvil.', value: st('anvil'), goal: 10, reward: { t10: 1 } },
    { id: 'master1', cat: 'encantar', tier: 2, name: 'Master Enchanter', desc: 'Master a character: 3 enchantments, all at max level, on its signature weapon.', value: ench('masteredCount'), goal: 1, reward: { t10: 2 }, title: 'Master Enchanter' },
    { id: 'master5', cat: 'encantar', tier: 3, name: 'Enchanting Guild', desc: 'Master 5 characters.', value: ench('masteredCount'), goal: 5, reward: { t10: 3 }, title: 'Guild Enchanter' },
    { id: 'masterStarters', cat: 'encantar', tier: 3, name: 'Legendary Arsenal', desc: 'Master all 16 starting partners.', value: ench('startersMastered'), goal: 16, reward: { t10: 5 }, title: 'Legendary Arsenal' },
    { id: 'masterAll', cat: 'encantar', tier: 3, name: 'Max Enchant Everyone', desc: 'Master every playable species (variants count toward their species).', value: ench('speciesMastered'), goal: 92, reward: { t10: 10 }, title: 'Grand Enchanter' },

    // ---------- missions and more ----------
    { id: 'mis10', cat: 'otros', tier: 1, name: 'Reliable', desc: 'Complete 10 missions.', value: st('missionsDone'), goal: 10, reward: { t1: 3 } },
    { id: 'mis50', cat: 'otros', tier: 2, name: 'Steady', desc: 'Complete 50 missions.', value: st('missionsDone'), goal: 50, reward: { t10: 1 }, title: 'Steady' },
    { id: 'mis200', cat: 'otros', tier: 3, name: 'Tireless', desc: 'Complete 200 missions.', value: st('missionsDone'), goal: 200, reward: { t10: 3 } },
    { id: 'group1', cat: 'otros', tier: 1, name: 'In Good Company', desc: 'Play a group game.', value: st('groupRuns'), goal: 1, reward: { t1: 2 } },
    { id: 'group10', cat: 'otros', tier: 2, name: 'Loyal Partner', desc: 'Play 10 group games.', value: st('groupRuns'), goal: 10, reward: { t10: 1 }, title: 'Loyal Partner' }
  ];

  // One achievement per great boss mob: "Defeat the Warden"... (ids leg_<dex> kept). The floor
  // bosses get theirs on a floor-boss kill (each Elder Guardian of the Ocean counts); the Giant as a mid-boss.
  // Herobrine can't be beaten (he hunts you on the last floor, see systems/judgment.js), so he gets none.
  const the = n => (/^(Herobrine|Steve|Alex)$/.test(n) ? n : 'the ' + n);
  for (const p of G.DEX.filter(p => p.leg && p.key !== 'herobrine' && G.SPRITE_META[p.dex])) {
    const fl = (G.DIMENSIONS || []).find(d => d.floorBoss === p.key);
    const mid = (G.DIMENSIONS || []).find(d => d.midBoss.includes(p.key));
    const where = fl ? ', floor boss of ' + fl.name + '.' : mid ? ' when it guards ' + mid.name + '.' : '.';
    LIST.push({ id: 'leg_' + p.dex, cat: 'legendarios', tier: fl ? 3 : 2, dex: p.dex, name: 'Defeat ' + the(p.name),
                desc: 'Defeat ' + the(p.name) + where, value: s => (s.legends && s.legends[p.dex] ? 1 : 0), goal: 1, reward: fl ? { t10: 1 } : { t1: 2 } });
  }
  const totalLegends = LIST.filter(a => a.dex).length;
  for (const a of LIST) if (a.id === 'legAll') { a.goal = totalLegends; a.desc = `Defeat all ${totalLegends} boss mobs.`; }
  // Goals that depend on the game data.
  for (const a of LIST) if (a.id === 'ownAll') { a.goal = G.DEX.length; a.desc = `Own all ${G.DEX.length} mobs in the game.`; }
  for (const a of LIST) if (a.id === 'masterAll' && G.SPRITE_META) { a.goal = G.DEX.filter(p => !p.v && G.SPRITE_META[p.dex]).length; a.desc = `Master all ${a.goal} playable species (variants count toward their species).`; }
  const evoTotal = Object.keys(G.Moves.EVO).length;
  for (const a of LIST) if (a.id === 'evoAll') { a.goal = evoTotal; a.desc = `Use Smithing on all ${evoTotal} different skills.`; }

  const BY = {};
  for (const a of LIST) BY[a.id] = a;

  return { CATS, LIST, BY };
})();
