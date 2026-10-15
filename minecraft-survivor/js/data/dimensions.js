/* ============ dimensions.js — the eight floors, their biomes, spawns and bosses ============
 * A run climbs eight floors (systems/floors.js), plus the Aether for those who outlast Herobrine. You walk between biome regions inside a floor
 * (world/world.js decides where each biome lies); mobs spawn from the biome of the tile they appear on.
 * Clearing a floor's goal opens its exit portal to the next one. Herobrine's World is the last fight; survive it for `surviveFor`
 * seconds and a glowstone Aether portal builds itself: the Aether is the peaceful end of the game.
 *
 * Mob lists use roster keys (G.DEX_BY[dex].key). Overworld surface biomes have a DAY list and a NIGHT
 * list (systems/daynight.js decides which applies; Herobrine's World is always night); cave biomes
 * (`dark: true`), the Ocean, the Nether and the End have a single `mobs` list because the sun never
 * reaches them. The Ocean is `underwater`: water slows nobody, mobs spawn in open water too, and the
 * screen gets the sea overlay (systems/daynight.js).
 * Thin pools are padded with the dimension's `common` (or `commonDay` / `commonNight`) list.
 * weather: weights for systems/weather.js kinds (missing = never). Read by: world, spawner/enemies,
 * game flow, weather, music, HUD.
 *
 * Per floor (systems/floors.js): `bossAt` = seconds after arriving when the mid-boss (`mid`, optional)
 * and the floor boss (`floor`, optional) arrive; an empty `midBoss` list means no mid-boss.
 * `trial` = elite mini-bosses in its Trial Chambers (systems/rift.js; empty = no Trial Chambers).
 * `short` = the HUD name; `col` = its title colour; `banner` = the line announcing its floor boss;
 * `escort` = mobs that arrive with the floor boss (the Raid); `ominous` = the floor boss is an
 * ominous elite (tinted aura, tougher kit: systems/bosskits.js). `midEscort` = mobs that arrive with
 * the mid-boss; `midName` = its name (the Ocean's Drowned Captain); `elders` = how many Elder Guardians
 * guard the Ocean Monument (goal 'elders').
 */
G.DIMENSIONS = [
  // A run climbs eight floors. `exit` = the portal kind that leads to the next floor (G.World.addPortal kinds:
  // 'dive' | 'cave' | 'nether' | 'stronghold' | 'end' | 'gateway' | 'ancient'). `goal` = how the floor is cleared:
  //   'boss'      floor boss down -> exit portal (bossAt.floor seconds after arriving; mid-boss at bossAt.mid)
  //   'elders'    The Ocean: the Ocean Monument holds `elders` Elder Guardians (G.World.monument.elders spots);
  //               they wake when you get close (or at bossAt.floor); all of them down -> exit portal
  //   'portal'    Stronghold: an Eye of Ender points to the End Portal room; hold it while silverfish swarm
  //   'crystals'  The End: the Ender Dragon is invincible until every End Crystal tower is destroyed
  //   'shriek'    Ancient City: sculk shriekers raise the warning level; at 4 the Warden emerges
  //   'herobrine' Herobrine hunts you (systems/judgment.js); survive `surviveFor` seconds -> the 'aether' portal
  //   'paradise'  The Aether: the end of the game. Nothing hurts you, nothing hostile spawns, always sunny
  { id: 'overworld', name: 'The Overworld', short: 'Overworld', col: '#ffffff', start: 'plains', goal: 'boss', exit: 'dive',
    common: ['zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch', 'zombie_villager', 'cave_spider'],
    commonDay: ['spider', 'wolf', 'bee', 'llama', 'goat', 'pillager', 'vindicator', 'iron_golem'],
    commonNight: ['zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch', 'phantom', 'zombie_villager'],
    midBoss: ['iron_golem', 'evoker'], floorBoss: 'ravager',
    // The Raid: the Ravager arrives with a band of illagers.
    bossAt: { mid: 180, floor: 360 }, banner: 'THE RAID BEGINS',
    escort: ['pillager', 'pillager', 'pillager', 'vindicator', 'vindicator', 'evoker'],
    trial: ['giant', 'evoker', 'iron_golem', 'creaking'],
    biomes: ['plains', 'forest', 'dark_forest', 'cherry_grove', 'savanna', 'desert', 'badlands', 'snowy_plains',
             'swamp', 'jungle', 'ocean_shore'] },
  { id: 'ocean', name: 'The Ocean', short: 'Ocean', col: '#5fd3e8', start: 'kelp_forest', goal: 'elders', exit: 'cave',
    // Under the sea: everyone swims (water doesn't slow anyone here), a blue tint and bubbles over the screen.
    underwater: true,
    common: ['drowned', 'cod', 'salmon', 'squid', 'pufferfish', 'guardian', 'zombie_nautilus', 'tropical_fish'],
    // Mid-boss: the Drowned Captain (an elite drowned with a trident) and its crew.
    midBoss: ['drowned'], midEscort: ['drowned', 'drowned', 'drowned', 'zombie_nautilus'], midName: 'Drowned Captain',
    floorBoss: 'elder_guardian', elders: 3,
    bossAt: { mid: 150, floor: 330 }, banner: 'THE ELDER GUARDIANS AWAKEN',
    trial: ['guardian', 'zombie_nautilus'],
    biomes: ['kelp_forest', 'coral_reef', 'ocean_ruins', 'deep_ocean', 'ocean_monument'] },
  { id: 'underworld', name: 'The Underworld', short: 'Underworld', col: '#e0c896', start: 'dripstone_caves', goal: 'boss', exit: 'nether',
    common: ['zombie', 'skeleton', 'spider', 'creeper', 'cave_spider', 'bat', 'slime', 'drowned'],
    midBoss: ['giant', 'creaking'], floorBoss: 'breeze',
    bossAt: { mid: 150, floor: 300 }, banner: 'THE OMINOUS TRIAL', ominous: true,
    trial: ['breeze', 'giant', 'iron_golem', 'creaking'],
    biomes: ['dripstone_caves', 'lush_caves', 'amethyst_caves', 'mineshaft'] },
  { id: 'nether', name: 'The Nether', short: 'Nether', col: '#ff8a5c', start: 'nether_wastes', goal: 'boss', exit: 'stronghold',
    common: ['zombified_piglin', 'magma_cube', 'ghast', 'piglin', 'blaze', 'wither_skeleton', 'strider', 'enderman'],
    midBoss: ['piglin_brute', 'ghast', 'hoglin'], floorBoss: 'wither',
    bossAt: { mid: 180, floor: 360 }, banner: 'THE WITHER RISES',
    trial: ['piglin_brute', 'ghast', 'hoglin', 'wither_skeleton', 'blaze'],
    biomes: ['nether_wastes', 'crimson_forest', 'warped_forest', 'soul_sand_valley', 'basalt_deltas', 'nether_fortress'] },
  { id: 'stronghold', name: 'The Stronghold', short: 'Stronghold', col: '#cfd6c4', start: 'stronghold_halls', goal: 'portal', exit: 'end',
    common: ['silverfish', 'zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'cave_spider', 'witch'],
    midBoss: ['iron_golem', 'evoker'], floorBoss: null,
    // portalAt: when the Eye of Ender starts pointing at the portal room; hold: seconds to activate it.
    bossAt: { mid: 120 }, portalAt: 60, hold: 20, banner: 'FIND THE END PORTAL',
    trial: ['iron_golem', 'evoker', 'creaking'],
    biomes: ['stronghold_halls', 'stronghold_library'] },
  { id: 'end', name: 'The End', short: 'The End', col: '#d9b8ff', start: 'the_end', goal: 'crystals', exit: 'gateway',
    common: ['enderman', 'endermite', 'shulker', 'phantom'],
    midBoss: [], floorBoss: 'ender_dragon',
    // The dragon arrives `bossAt.floor` seconds after you do; `crystals` towers stand around the central island
    // (G.World.towers; this count is only the fallback when the world has none).
    bossAt: { floor: 20 }, crystals: 8, banner: 'THE ENDER DRAGON',
    trial: ['shulker', 'enderman'],
    biomes: ['the_end', 'end_highlands', 'end_city'] },
  { id: 'ancient_city', name: 'The Ancient City', short: 'Ancient City', col: '#5ef0ff', start: 'ancient_city', goal: 'shriek', exit: 'ancient',
    common: ['skeleton', 'zombie', 'silverfish', 'bat', 'cave_spider', 'creeper', 'spider'],
    midBoss: [], floorBoss: 'warden',
    // A shrieker sounds every `shriekEvery` s (and when you break sculk); the Warden emerges at warning 4.
    shriekEvery: 40, banner: 'THE WARDEN EMERGES',
    trial: ['creaking', 'giant'],
    biomes: ['ancient_city', 'deep_dark'] },
  { id: 'herobrine', name: 'Herobrine\'s World', short: 'Herobrine', col: '#ff5a5a', start: 'plains', goal: 'herobrine', exit: 'aether',
    surviveFor: 150,
    // The Overworld again, in an endless night. Uses the Overworld surface biomes (night lists).
    common: ['zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch', 'phantom', 'zombie_villager'],
    commonNight: ['zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch', 'phantom', 'zombie_villager'],
    midBoss: [], floorBoss: null, night: true, banner: 'HEROBRINE AWAKENS',
    trial: [],
    biomes: ['plains', 'forest', 'dark_forest', 'cherry_grove', 'savanna', 'desert', 'badlands', 'snowy_plains',
             'swamp', 'jungle', 'ocean_shore'] },
  { id: 'aether', name: 'The Aether', short: 'Aether', col: '#fff3a8', start: 'aether_meadow', goal: 'paradise', exit: null,
    // Heaven, after the Aether mod (The Aether I): floating islands of Aether Grass and Holystone in endless
    // sunshine, Aerclouds you can walk on, rainbows, and only the Aether's passive mobs (no Cockatrices, Zephyrs...).
    // `peaceful`: nothing hurts you (no damage from any source), no hostile mobs, events, bosses or
    // Trial Chambers. `sunny`: no day/night or weather; always bright.
    peaceful: true, sunny: true,
    common: ['sheepuff', 'phyg', 'flying_cow', 'aerbunny', 'moa', 'aerwhale'],
    midBoss: [], floorBoss: null, banner: 'WELCOME TO THE AETHER',
    trial: [],
    biomes: ['aether_meadow', 'skyroot_forest', 'golden_grove', 'cloud_sea', 'rainbow_falls'] }
];

G.BIOME_DEFS = {
  // ---------------- Overworld ----------------
  // day: what roams in daylight (animals turned hostile, illager patrols, sun-proof monsters);
  // night: the classic monsters plus the biome's own night mobs. Undead that burn in the sun
  // (zombies, skeletons, strays, bogged, phantoms...) only come at night.
  plains:        { name: 'Plains', dim: 'overworld', weather: { rain: 3, sun: 1.5, fog: 1 },
                   day: ['cow', 'sheep', 'pig', 'chicken', 'horse', 'donkey', 'villager', 'llama', 'iron_golem', 'pillager',
                         'vindicator', 'wandering_trader', 'evoker', 'ravager', 'mule', 'trader_llama'],
                   night: ['zombie', 'skeleton', 'spider', 'creeper', 'zombie_villager', 'enderman', 'witch', 'phantom',
                           'zombie_horse', 'skeleton_horse', 'vex', 'charged_creeper'] },
  forest:        { name: 'Forest', dim: 'overworld', weather: { rain: 3, fog: 2, sun: 1 },
                   day: ['rabbit', 'chicken', 'pig', 'cow', 'sheep', 'fox', 'bee', 'wolf', 'spider', 'iron_golem', 'pillager'],
                   night: ['zombie', 'skeleton', 'spider', 'creeper', 'witch', 'enderman', 'phantom', 'zombie_horse',
                           'skeleton_horse', 'charged_creeper'] },
  dark_forest:   { name: 'Dark Forest', dim: 'overworld', shade: true, weather: { fog: 4, rain: 2 },
                   // The canopy keeps it dark: monsters roam even by day.
                   day: ['spider', 'zombie', 'skeleton', 'creeper', 'witch', 'vindicator', 'evoker', 'vex'],
                   night: ['zombie', 'skeleton', 'spider', 'creeper', 'witch', 'creaking', 'enderman', 'phantom',
                           'vindicator', 'evoker', 'vex'] },
  cherry_grove:  { name: 'Cherry Grove', dim: 'overworld', weather: { sun: 2, rain: 1, fog: 1 },
                   day: ['rabbit', 'pig', 'sheep', 'bee', 'fox', 'goat', 'allay', 'wolf', 'pillager'],
                   night: ['zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'phantom', 'witch', 'fox'] },
  savanna:       { name: 'Savanna', dim: 'overworld', weather: { sun: 4, sand: 1 },
                   day: ['cow', 'sheep', 'armadillo', 'horse', 'donkey', 'llama', 'villager', 'pillager', 'vindicator', 'ravager',
                         'wolf', 'wandering_trader', 'trader_llama'],
                   night: ['zombie', 'skeleton', 'spider', 'creeper', 'zombie_villager', 'enderman', 'phantom', 'skeleton_horse',
                           'witch'] },
  desert:        { name: 'Desert', dim: 'overworld', weather: { sun: 4, sand: 4 },
                   // Husks don't burn: they own the desert day and night.
                   day: ['rabbit', 'camel', 'husk', 'spider', 'villager', 'pillager', 'camel_husk', 'vindicator', 'wandering_trader',
                         'trader_llama'],
                   night: ['husk', 'camel_husk', 'skeleton', 'spider', 'creeper', 'zombie_villager', 'witch', 'enderman',
                           'phantom', 'parched'] },
  badlands:      { name: 'Badlands', dim: 'overworld', weather: { sun: 3, sand: 3 },
                   day: ['armadillo', 'rabbit', 'husk', 'silverfish', 'cave_spider', 'spider', 'camel_husk', 'wolf'],
                   night: ['husk', 'skeleton', 'spider', 'cave_spider', 'creeper', 'enderman', 'skeleton_horse', 'phantom',
                           'silverfish', 'parched'] },
  snowy_plains:  { name: 'Snowy Plains', dim: 'overworld', weather: { snow: 5, fog: 1 },
                   day: ['rabbit', 'fox', 'wolf', 'goat', 'snow_golem', 'polar_bear', 'spider', 'pillager', 'villager'],
                   night: ['stray', 'zombie', 'spider', 'creeper', 'enderman', 'phantom', 'polar_bear', 'skeleton', 'witch'] },
  swamp:         { name: 'Swamp', dim: 'overworld', weather: { rain: 4, fog: 3 },
                   day: ['frog', 'slime', 'witch', 'bee', 'spider', 'bat', 'cow', 'drowned'],
                   night: ['bogged', 'slime', 'witch', 'drowned', 'zombie', 'spider', 'creeper', 'phantom', 'frog'] },
  jungle:        { name: 'Jungle', dim: 'overworld', weather: { rain: 4, fog: 1, sun: 1 },
                   day: ['chicken', 'parrot', 'ocelot', 'panda', 'bee', 'cave_spider', 'spider', 'sniffer'],
                   night: ['zombie', 'skeleton', 'spider', 'cave_spider', 'creeper', 'witch', 'enderman', 'phantom', 'ocelot'] },
  ocean_shore:   { name: 'Ocean Shore', dim: 'overworld', weather: { rain: 3, fog: 2, sun: 1 },
                   // Drowned stay in the water by day; at night they wade ashore with the rest.
                   day: ['cod', 'salmon', 'squid', 'turtle', 'pufferfish', 'dolphin', 'nautilus', 'drowned', 'guardian', 'tropical_fish'],
                   night: ['drowned', 'pufferfish', 'guardian', 'zombie', 'skeleton', 'creeper', 'spider', 'phantom', 'squid',
                           'zombie_nautilus'] },
  // ---------------- The Ocean (underwater floor) ----------------
  kelp_forest:     { name: 'Kelp Forest', dim: 'ocean', weather: {},
                     mobs: ['cod', 'salmon', 'drowned', 'squid', 'pufferfish', 'turtle', 'dolphin', 'zombie_nautilus'] },
  coral_reef:      { name: 'Coral Reef', dim: 'ocean', weather: {},
                     mobs: ['tropical_fish', 'pufferfish', 'turtle', 'dolphin', 'cod', 'drowned', 'axolotl', 'nautilus'] },
  ocean_ruins:     { name: 'Ocean Ruins', dim: 'ocean', weather: {},
                     mobs: ['drowned', 'zombie_nautilus', 'pufferfish', 'squid', 'salmon', 'nautilus', 'guardian'] },
  deep_ocean:      { name: 'Deep Ocean', dim: 'ocean', dark: true, weather: {},
                     mobs: ['squid', 'glow_squid', 'guardian', 'drowned', 'zombie_nautilus', 'pufferfish', 'cod'] },
  ocean_monument:  { name: 'Ocean Monument', dim: 'ocean', dark: true, weather: {},
                     mobs: ['guardian', 'guardian', 'pufferfish', 'squid', 'drowned', 'glow_squid'] },
  // ---------------- Underworld (caves: dark at every hour) ----------------
  dripstone_caves: { name: 'Dripstone Caves', dim: 'underworld', dark: true, weather: { fog: 2 },
                     mobs: ['zombie', 'skeleton', 'creeper', 'spider', 'drowned', 'bat', 'cave_spider', 'witch', 'enderman',
                            'slime', 'sulfur_cube', 'zombie_villager'] },
  lush_caves:    { name: 'Lush Caves', dim: 'underworld', dark: true, weather: { fog: 2 },
                   mobs: ['axolotl', 'glow_squid', 'bat', 'cave_spider', 'slime', 'copper_golem', 'zombie', 'skeleton', 'creeper', 'spider',
                          'tropical_fish', 'drowned'] },
  amethyst_caves:{ name: 'Amethyst Geode', dim: 'underworld', dark: true, weather: { fog: 2 },
                   mobs: ['bat', 'silverfish', 'cave_spider', 'glow_squid', 'breeze', 'bogged', 'copper_golem', 'zombie', 'skeleton', 'creeper', 'spider',
                          'stray', 'enderman'] },
  mineshaft:     { name: 'Mineshaft', dim: 'underworld', dark: true, weather: { fog: 2 },
                   mobs: ['cave_spider', 'silverfish', 'zombie', 'skeleton', 'spider', 'creeper', 'bat', 'slime', 'zombie_villager',
                          'sulfur_cube', 'witch'] },
  // ---------------- Nether ----------------
  nether_wastes:   { name: 'Nether Wastes', dim: 'nether', weather: { sun: 3 },
                     mobs: ['zombified_piglin', 'ghast', 'magma_cube', 'piglin', 'enderman', 'strider'] },
  crimson_forest:  { name: 'Crimson Forest', dim: 'nether', weather: { sun: 2, fog: 1 },
                     mobs: ['piglin', 'hoglin', 'zombified_piglin', 'piglin_brute', 'strider', 'zoglin'] },
  warped_forest:   { name: 'Warped Forest', dim: 'nether', weather: { fog: 3 },
                     mobs: ['enderman', 'strider', 'endermite', 'zombified_piglin'] },
  soul_sand_valley:{ name: 'Soul Sand Valley', dim: 'nether', weather: { fog: 3 },
                     mobs: ['skeleton', 'ghast', 'enderman', 'strider', 'wither_skeleton'] },
  basalt_deltas:   { name: 'Basalt Deltas', dim: 'nether', weather: { sand: 3, sun: 1 },
                     mobs: ['magma_cube', 'ghast', 'strider', 'blaze'] },
  nether_fortress: { name: 'Nether Fortress', dim: 'nether', weather: { sun: 2 },
                     mobs: ['blaze', 'wither_skeleton', 'magma_cube', 'skeleton', 'zombified_piglin', 'piglin_brute'] },
  // ---------------- Stronghold ----------------
  stronghold_halls:   { name: 'Stronghold Halls', dim: 'stronghold', dark: true, weather: {},
                        mobs: ['silverfish', 'zombie', 'skeleton', 'spider', 'creeper', 'cave_spider', 'enderman', 'endermite',
                               'zombie_villager', 'witch'] },
  stronghold_library: { name: 'Stronghold Library', dim: 'stronghold', dark: true, weather: {},
                        mobs: ['silverfish', 'skeleton', 'zombie', 'witch', 'enderman', 'cave_spider', 'creeper', 'vex',
                               'stray', 'evoker'] },
  // ---------------- The End ----------------
  the_end:         { name: 'The End', dim: 'end', weather: { fog: 1 },
                     mobs: ['enderman', 'endermite'] },
  end_highlands:   { name: 'End Highlands', dim: 'end', weather: { fog: 1 },
                     mobs: ['enderman', 'endermite', 'shulker', 'phantom'] },
  end_city:        { name: 'End City', dim: 'end', weather: { fog: 2 },
                     mobs: ['shulker', 'enderman', 'endermite', 'phantom', 'vex'] },
  // ---------------- Ancient City ----------------
  ancient_city:    { name: 'Ancient City', dim: 'ancient_city', dark: true, weather: { fog: 2 },
                     mobs: ['skeleton', 'zombie', 'silverfish', 'bat', 'cave_spider', 'creeper', 'stray', 'spider', 'enderman'] },
  deep_dark:       { name: 'Deep Dark', dim: 'ancient_city', dark: true, weather: { fog: 4 },
                     mobs: ['bat', 'silverfish', 'cave_spider', 'skeleton', 'zombie', 'creeper', 'enderman', 'spider'] },
  // ---------------- The Aether (sky islands; always sunny, peaceful: only friendly mobs) ----------------
  aether_meadow:   { name: 'Aether Meadow', dim: 'aether', weather: {},
                     mobs: ['sheepuff', 'sheepuff', 'phyg', 'flying_cow', 'aerbunny', 'moa'] },
  skyroot_forest:  { name: 'Skyroot Forest', dim: 'aether', weather: {},
                     mobs: ['aerbunny', 'aerbunny', 'moa', 'phyg', 'sheepuff', 'allay'] },
  golden_grove:    { name: 'Golden Grove', dim: 'aether', weather: {},
                     mobs: ['moa', 'moa', 'aerbunny', 'sheepuff', 'phyg', 'bee'] },
  cloud_sea:       { name: 'Cloud Sea', dim: 'aether', weather: {},
                     mobs: ['aerwhale', 'aerwhale', 'flying_cow', 'phyg', 'moa'] },
  rainbow_falls:   { name: 'Rainbow Falls', dim: 'aether', weather: {},
                     mobs: ['aerwhale', 'sheepuff', 'aerbunny', 'moa', 'flying_cow'] }
};

G.DIM_BY = {};
for (const d of G.DIMENSIONS) G.DIM_BY[d.id] = d;
