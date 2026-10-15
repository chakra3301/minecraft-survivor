// The Mobdex: every collectible mob, its stats and how to render it from Mojang's bedrock-samples.
// IDs are permanent (saves store them): never renumber, only append. Bases 1-199, variants 200-308;
// everything added after that (bases and variants alike) takes the next free id from 309 on.
//
// Stats use PokéSurvivor's scales so all engine balance carries over:
//   s: [baseHp, baseAtk, baseSpd]  ->  hp = 70 + baseHp*0.45, atk = 0.7 + baseAtk/100*0.55, spd = 78 + baseSpd*0.42
//   bst = overall power; picks the enemy tier (180-620) and boss slot (490-700). Rarity r 1-5.
// Internal type ids (keys of G.U.TYPE_NAME): normal=Overworld fire=Fire water=Aquatic grass=Nature
//   electric=Redstone ice=Frost fighting=Brute poison=Poison ground=Earth flying=Wind psychic=Ender
//   bug=Arthropod rock=Stone ghost=Undead dragon=Dragon dark=Shadow steel=Iron fairy=Magic
// gen = gacha banner: 1 Overworld 2 Nightfall 3 Ocean 4 Village 5 Caves 6 Nether 7 The End;
//   8 = the Aether (no Spawner banner: reaching the Aether befriends them all, js/systems/aether.js)
// beh = fixed enemy behaviour: healer shielder bomber summon:<key> ranged beamer zoner fan jumper charger tank chase
// Render: geo/tex into the pack; scale; hover (flies: crosses water/rocks); rig; tint; layers [{geo,tex,tint,glow,see,texSize}]; patch [[x,y,'#rgb']];
//   ride {geo,tex,at,rig} a rider seated on this mob (jockeys); armor 'iron'|'diamond'|'netherite' (Mojang's armour layers);
//   held item in hand, heldAt {bone,at,rot,size} where it sits, heldEnch (1 light, 'full') / armour `glint` = enchantment glint on the gear.
// pw = Spawner pull weight inside its rarity (default 1; Herobrine is the rare lure).
// jockey {on, p, dark} = spawns in place of `p` of the `on` mob's night spawns (and in dark biomes with `dark`).

export const ANIMS = {
  Idle: { n: 4, d: [30, 12, 30, 12] },
  Walk: { n: 8, d: [4, 4, 4, 4, 4, 4, 4, 4] },
  Attack: { n: 8, d: [4, 3, 3, 3, 2, 2, 3, 4] },
  Shoot: { n: 6, d: [10, 4, 4, 4, 2, 2] },
  Charge: { n: 8, d: [2, 2, 2, 2, 2, 2, 2, 2] },
  Hurt: { n: 2, d: [2, 8] },
  Faint: { n: 4, d: [6, 6, 6, 12] }
};

const E = 'textures/entity/';
// The Sheepuff's face: soft cream skin, dark eyes and a pink nose over the vanilla sheep's pale face (its sheared
// head's front is texels 8-13 × 8-13), so it reads under all that wool.
const PUFF_FACE = [];
for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
  const eye = y === 2 && (x === 1 || x === 4), white = y === 2 && (x === 0 || x === 5), nose = y === 4 && (x === 2 || x === 3);
  PUFF_FACE.push([8 + x, 8 + y, eye ? '#2a2230' : white ? '#ffffff' : nose ? '#f0a0b4' : y === 5 ? '#e4cdb6' : '#f2e2d0']);
}
// [id, key, name, types, r, gen, [hp,atk,spd], bst, extra]
const BASE = [
  // ---- Overworld: plains & forests ----
  [1, 'steve', 'Steve', ['normal'], 3, 1, [70, 70, 70], 330, { geo: 'geometry.humanoid.custom', tex: E + 'steve', noEnemy: 1 }],
  [2, 'alex', 'Alex', ['normal'], 3, 1, [65, 72, 78], 330, { geo: 'geometry.humanoid.customSlim', tex: E + 'alex', noEnemy: 1 }],
  [3, 'chicken', 'Chicken', ['normal', 'flying'], 1, 1, [40, 30, 56], 210, { geo: 'geometry.chicken.v1.12', tex: E + 'chicken/chicken' }],
  [4, 'pig', 'Pig', ['normal'], 1, 1, [55, 35, 42], 230, { geo: 'geometry.pig.v3', tex: E + 'pig/pig_v3' }],
  [5, 'sheep', 'Sheep', ['normal'], 1, 1, [60, 35, 40], 245, { geo: 'geometry.sheep.sheared.v1.8', tex: E + 'sheep/sheep',
    texSize: [64, 64], layers: [{ geo: 'geometry.sheep.v1.8', tex: E + 'sheep/sheep' }] }],
  [6, 'cow', 'Cow', ['normal'], 1, 1, [68, 42, 36], 255, { geo: 'geometry.cow.v2', tex: E + 'cow/cow_v2' }],
  [7, 'rabbit', 'Rabbit', ['normal'], 1, 1, [35, 35, 95], 260, { geo: 'geometry.rabbit.v2', tex: E + 'rabbit/rabbit_brown', beh: 'jumper' }],
  [8, 'cat', 'Cat', ['normal'], 2, 1, [50, 60, 92], 320, { geo: 'geometry.cat', tex: E + 'cat/tabby' }],
  [9, 'parrot', 'Parrot', ['flying', 'grass'], 2, 1, [45, 48, 88], 300, { geo: 'geometry.parrot', tex: E + 'parrot/parrot_red_blue', hover: 1 }],
  [10, 'bee', 'Bee', ['bug', 'flying'], 2, 1, [42, 62, 82], 310, { geo: 'geometry.bee', tex: E + 'bee/bee', hover: 1, beh: 'summon:bee' }],
  [11, 'frog', 'Frog', ['water', 'grass'], 2, 1, [50, 58, 80], 310, { geo: 'geometry.frog', tex: E + 'frog/temperate_frog', beh: 'jumper' }],
  [12, 'donkey', 'Donkey', ['normal'], 2, 1, [75, 55, 62], 320, { geo: 'geometry.horse.v3', tex: E + 'horse2/donkey' }],
  [13, 'llama', 'Llama', ['normal'], 2, 1, [75, 55, 55], 330, { geo: 'geometry.llama.v1.8', tex: E + 'llama/llama_creamy', beh: 'ranged' }],
  [14, 'armadillo', 'Armadillo', ['ground', 'steel'], 2, 1, [70, 42, 40], 320, { geo: 'geometry.armadillo', tex: E + 'armadillo', beh: 'shielder' }],
  [15, 'fox', 'Fox', ['normal'], 2, 1, [52, 66, 92], 345, { geo: 'geometry.fox', tex: E + 'fox/fox' }],
  [16, 'ocelot', 'Ocelot', ['grass', 'normal'], 2, 1, [50, 66, 100], 350, { geo: 'geometry.ocelot.v1.8', tex: E + 'cat/ocelot' }],
  [17, 'wolf', 'Wolf', ['normal', 'fighting'], 2, 1, [65, 80, 82], 380, { geo: 'geometry.wolf', tex: E + 'wolf/wolf', beh: 'charger' }],
  [18, 'goat', 'Goat', ['normal', 'rock'], 3, 1, [70, 90, 70], 400, { geo: 'geometry.goat', tex: E + 'goat/goat', beh: 'jumper' }],
  [19, 'mooshroom', 'Mooshroom', ['grass', 'normal'], 3, 1, [80, 50, 40], 400, { geo: 'geometry.mooshroom.v2', tex: E + 'cow/mooshroom_v2', beh: 'healer' }],
  [20, 'camel', 'Camel', ['ground', 'normal'], 3, 1, [95, 60, 55], 410, { geo: 'geometry.camel', tex: E + 'camel/camel', scale: 0.85, beh: 'tank' }],
  [21, 'panda', 'Panda', ['normal', 'fighting'], 3, 1, [100, 82, 40], 420, { geo: 'geometry.panda', tex: E + 'panda/panda', scale: 0.85 }],
  [22, 'horse', 'Horse', ['normal'], 3, 1, [80, 75, 110], 430, { geo: 'geometry.horse.v3', tex: E + 'horse2/horse_brown', scale: 0.9 }],
  [23, 'polar_bear', 'Polar Bear', ['ice', 'fighting'], 3, 1, [95, 96, 60], 450, { geo: 'geometry.polarbear', tex: E + 'polar_bear', scale: 0.85, beh: 'charger' }],
  [24, 'sniffer', 'Sniffer', ['grass', 'ground'], 4, 1, [130, 72, 35], 510, { geo: 'geometry.sniffer', tex: E + 'sniffer/sniffer', scale: 0.7, beh: 'tank' }],
  // ---- Nightfall: overworld hostiles ----
  [30, 'zombie', 'Zombie', ['ghost'], 1, 2, [60, 56, 40], 290, { geo: 'geometry.zombie.v1.8', tex: E + 'zombie/zombie', rig: 'zombie' }],
  [31, 'skeleton', 'Skeleton', ['ghost'], 1, 2, [45, 60, 56], 300, { geo: 'geometry.skeleton.v1.8', tex: E + 'skeleton/skeleton', beh: 'ranged' }],
  [32, 'spider', 'Spider', ['bug'], 1, 2, [50, 56, 82], 300, { geo: 'geometry.spider.v1.8', tex: E + 'spider/spider', rig: 'spider', beh: 'jumper' }],
  [33, 'slime', 'Slime', ['poison'], 1, 2, [70, 40, 42], 290, { geo: 'geometry.slime', tex: E + 'slime/slime', beh: 'summon:slime', rig: 'hop' }],
  [34, 'husk', 'Husk', ['ghost', 'ground'], 2, 2, [66, 60, 40], 330, { geo: 'geometry.zombie.husk.v1.8', tex: E + 'zombie/husk', rig: 'zombie' }],
  [35, 'zombie_villager', 'Zombie Villager', ['ghost', 'normal'], 2, 2, [62, 56, 40], 330, { geo: 'geometry.zombie.villager.v1.8', tex: E + 'zombie_villager/zombie_farmer', rig: 'zombie' }],
  [36, 'creeper', 'Creeper', ['grass', 'fire'], 2, 2, [50, 95, 52], 340, { geo: 'geometry.creeper.v1.8', tex: E + 'creeper/creeper', beh: 'bomber' }],
  [37, 'stray', 'Stray', ['ghost', 'ice'], 2, 2, [50, 66, 56], 350, { geo: 'geometry.skeleton.stray.v1.8', tex: E + 'skeleton/stray', beh: 'ranged',
    layers: [{ geo: 'geometry.stray.armor.v1.8', tex: E + 'skeleton/stray_overlay' }] }],
  [38, 'bogged', 'Bogged', ['ghost', 'poison'], 2, 2, [46, 62, 52], 350, { geo: 'geometry.skeleton.bogged', tex: E + 'skeleton/bogged', beh: 'ranged',
    layers: [{ geo: 'geometry.bogged.armor', tex: E + 'skeleton/bogged_clothes' }] }],
  [39, 'witch', 'Witch', ['poison', 'fairy'], 3, 2, [65, 72, 50], 420, { geo: 'geometry.villager.witch.v1.8', tex: E + 'witch', beh: 'healer' }],
  [40, 'zombie_horse', 'Zombie Horse', ['ghost', 'normal'], 3, 2, [82, 72, 100], 430, { geo: 'geometry.horse.v3', tex: E + 'horse2/horse_zombie', scale: 0.9 }],
  [41, 'skeleton_horse', 'Skeleton Horse', ['ghost', 'normal'], 3, 2, [70, 76, 112], 440, { geo: 'geometry.horse.v3', tex: E + 'horse2/horse_skeleton', scale: 0.9 }],
  [42, 'phantom', 'Phantom', ['ghost', 'flying'], 3, 7, [55, 78, 100], 450, { geo: 'geometry.phantom', tex: E + 'phantom', hover: 1, beh: 'jumper' }],
  [43, 'creaking', 'Creaking', ['grass', 'ghost'], 4, 2, [120, 112, 62], 580, { geo: 'geometry.creaking', tex: E + 'creaking/creaking', scale: 0.85, beh: 'tank' }],
  [44, 'charged_creeper', 'Charged Creeper', ['electric', 'grass'], 4, 2, [70, 140, 60], 585, { geo: 'geometry.creeper.v1.8', tex: E + 'creeper/creeper', beh: 'bomber',
    layers: [{ geo: 'geometry.creeper.charged.v1.8', tex: E + 'creeper/creeper_armor', tint: '#7fd0ff', glow: 1 }] }],
  // In the Overworld Spawner, at a fifth of a normal legendary's weight (about 1 spawn in 1,700).
  [45, 'herobrine', 'Herobrine', ['ghost', 'psychic'], 5, 1, [130, 135, 120], 680, { leg: 1, pw: 0.2, geo: 'geometry.humanoid.custom', tex: E + 'steve',
    patch: [[9, 12, '#ffffff'], [10, 12, '#ffffff'], [13, 12, '#ffffff'], [14, 12, '#ffffff']], glowEyes: 1 }],
  [46, 'giant', 'Giant', ['ghost', 'fighting'], 5, 2, [160, 140, 40], 650, { leg: 1, geo: 'geometry.zombie.v1.8', tex: E + 'zombie/zombie', rig: 'zombie', scale: 1.9 }],
  // ---- Ocean ----
  [50, 'cod', 'Cod', ['water'], 1, 3, [35, 30, 60], 200, { geo: 'geometry.cod', tex: E + 'fish/cod', hover: 1, rig: 'fish' }],
  [51, 'salmon', 'Salmon', ['water'], 1, 3, [40, 35, 70], 215, { geo: 'geometry.salmon', tex: E + 'fish/salmon', hover: 1, rig: 'fish' }],
  [52, 'squid', 'Squid', ['water'], 1, 3, [55, 36, 50], 250, { geo: 'geometry.squid', tex: E + 'squid', hover: 1, scale: 0.8, rig: 'squid' }],
  [53, 'pufferfish', 'Pufferfish', ['water', 'poison'], 2, 3, [50, 60, 45], 310, { geo: 'geometry.pufferfish.large.v1.8', tex: E + 'fish/pufferfish', hover: 1, beh: 'bomber', rig: 'fish' }],
  [54, 'nautilus', 'Nautilus', ['water', 'rock'], 2, 3, [62, 52, 60], 340, { geo: 'geometry.nautilus', tex: E + 'nautilus/nautilus', hover: 1 }],
  [55, 'turtle', 'Turtle', ['water', 'rock'], 2, 3, [92, 42, 25], 350, { geo: 'geometry.turtle', tex: E + 'sea_turtle', scale: 0.8, beh: 'tank' }],
  [56, 'drowned', 'Drowned', ['ghost', 'water'], 2, 3, [62, 66, 50], 370, { geo: 'geometry.zombie.drowned.v1.16', tex: E + 'zombie/drowned', rig: 'zombie', beh: 'ranged' }],
  [57, 'dolphin', 'Dolphin', ['water'], 3, 3, [72, 76, 118], 430, { geo: 'geometry.dolphin', tex: E + 'dolphin', hover: 1, rig: 'fish' }],
  [58, 'guardian', 'Guardian', ['water', 'psychic'], 3, 3, [72, 82, 60], 465, { geo: 'geometry.guardian.v1.8', tex: E + 'guardian', hover: 1, beh: 'beamer' }],
  [59, 'elder_guardian', 'Elder Guardian', ['water', 'psychic'], 5, 3, [150, 115, 50], 640, { leg: 1, geo: 'geometry.guardian.v1.8', tex: E + 'guardian_elder', hover: 1, scale: 1.7, beh: 'beamer' }],
  // ---- Village & raid ----
  [70, 'villager', 'Villager', ['normal'], 1, 4, [55, 32, 45], 250, { geo: 'geometry.villager_v2', tex: E + 'villager2/villager', hide: ['brim'],
    layers: [{ geo: 'geometry.villager_v2', tex: E + 'villager2/professions/farmer' }] }],
  [71, 'snow_golem', 'Snow Golem', ['ice'], 2, 4, [50, 56, 45], 310, { geo: 'geometry.snowgolem.v1.8', tex: E + 'snow_golem', beh: 'ranged' }],
  [72, 'vex', 'Vex', ['fairy', 'flying'], 2, 4, [30, 72, 112], 360, { geo: 'geometry.vex.v1.8', tex: E + 'vex/vex', hover: 1, beh: 'charger' }],
  [73, 'pillager', 'Pillager', ['dark'], 2, 4, [56, 72, 60], 370, { geo: 'geometry.pillager', tex: E + 'pillager', beh: 'ranged' }],
  [74, 'allay', 'Allay', ['fairy', 'flying'], 3, 4, [50, 40, 92], 370, { geo: 'geometry.allay', tex: E + 'allay/allay', hover: 1, beh: 'healer' }],
  [75, 'wandering_trader', 'Wandering Trader', ['normal', 'psychic'], 3, 4, [60, 46, 56], 380, { geo: 'geometry.villager_v2', tex: E + 'wandering_trader', beh: 'summon:trader_llama' }],
  [76, 'copper_golem', 'Copper Golem', ['steel', 'electric'], 3, 4, [72, 60, 72], 410, { geo: 'geometry.copper_golem', tex: E + 'copper_golem/copper_golem', beh: 'shielder' }],
  [77, 'vindicator', 'Vindicator', ['dark', 'fighting'], 3, 4, [66, 106, 76], 465, { geo: 'geometry.vindicator.v1.8', tex: E + 'vindicator', beh: 'charger' }],
  [78, 'evoker', 'Evoker', ['dark', 'fairy'], 4, 4, [78, 102, 66], 545, { geo: 'geometry.evoker.v1.8', tex: E + 'illager/evoker', beh: 'summon:vex' }],
  [79, 'iron_golem', 'Iron Golem', ['steel', 'fighting'], 4, 4, [140, 125, 40], 590, { geo: 'geometry.irongolem', tex: E + 'iron_golem', scale: 0.8, beh: 'shielder' }],
  [80, 'ravager', 'Ravager', ['dark', 'rock'], 4, 4, [150, 130, 62], 620, { geo: 'geometry.ravager', tex: E + 'illager/ravager', scale: 0.7, beh: 'charger' }],
  // ---- Caves & deep dark ----
  [90, 'bat', 'Bat', ['flying', 'dark'], 1, 5, [35, 36, 90], 230, { geo: 'geometry.bat_v2', tex: E + 'bat_v2', hover: 1 }],
  [91, 'silverfish', 'Silverfish', ['bug', 'rock'], 1, 5, [30, 42, 70], 220, { geo: 'geometry.silverfish', tex: E + 'silverfish', beh: 'summon:silverfish' }],
  [92, 'glow_squid', 'Glow Squid', ['water', 'fairy'], 2, 5, [60, 42, 55], 340, { geo: 'geometry.squid', tex: E + 'glow_squid/glow_squid', hover: 1, scale: 0.8, rig: 'squid' }],
  [93, 'cave_spider', 'Cave Spider', ['bug', 'poison'], 2, 5, [40, 62, 86], 330, { geo: 'geometry.spider.v1.8', tex: E + 'spider/cave_spider', rig: 'spider', scale: 0.75, beh: 'jumper' }],
  [94, 'axolotl', 'Axolotl', ['water', 'fairy'], 2, 5, [56, 62, 66], 350, { geo: 'geometry.axolotl', tex: E + 'axolotl/axolotl_lucy', beh: 'fan' }],
  [95, 'breeze', 'Breeze', ['flying', 'psychic'], 4, 5, [72, 96, 102], 530, { geo: 'geometry.breeze', tex: E + 'breeze/breeze', hover: 1, beh: 'fan',
    layers: [{ geo: 'geometry.breeze_wind_top', tex: E + 'breeze/breeze_wind' }, { geo: 'geometry.breeze_wind_mid', tex: E + 'breeze/breeze_wind' }, { geo: 'geometry.breeze_wind_bottom', tex: E + 'breeze/breeze_wind' }] }],
  [96, 'warden', 'Warden', ['dark'], 5, 5, [170, 145, 50], 700, { leg: 1, geo: 'geometry.warden', tex: E + 'warden/warden', scale: 0.8 }],
  // ---- Nether ----
  // Common since 2026-10-14 so the Nether Spawner has a Common tier (it fell back to Uncommon).
  [110, 'strider', 'Strider', ['fire'], 1, 6, [72, 40, 40], 320, { geo: 'geometry.strider', tex: E + 'strider/strider', scale: 0.8, beh: 'tank' }],
  [111, 'magma_cube', 'Magma Cube', ['fire', 'rock'], 2, 6, [70, 70, 50], 360, { geo: 'geometry.magma_cube_v2', tex: E + 'slime/magmacube_v2', rig: 'hop', beh: 'summon:magma_cube' }],
  [112, 'zombified_piglin', 'Zombified Piglin', ['ghost', 'fire'], 2, 6, [62, 68, 55], 360, { geo: 'geometry.piglin', tex: E + 'piglin/zombie_piglin', rig: 'zombie' }],
  [113, 'piglin', 'Piglin', ['fire'], 2, 6, [56, 72, 66], 380, { geo: 'geometry.piglin', tex: E + 'piglin/piglin', beh: 'ranged' }],
  [114, 'ghast', 'Ghast', ['fire', 'ghost'], 3, 6, [72, 92, 45], 470, { geo: 'geometry.ghast', tex: E + 'ghast/ghast', hover: 1, scale: 0.24, beh: 'zoner', rig: 'ghast' }],
  [115, 'blaze', 'Blaze', ['fire'], 3, 6, [62, 92, 60], 460, { geo: 'geometry.blaze', tex: E + 'blaze', hover: 1, beh: 'fan', rig: 'blaze' }],
  [116, 'hoglin', 'Hoglin', ['normal', 'fire'], 3, 6, [102, 96, 60], 490, { geo: 'geometry.hoglin', tex: E + 'hoglin/hoglin', scale: 0.8, beh: 'summon:hoglin' }],
  [117, 'wither_skeleton', 'Wither Skeleton', ['ghost', 'dark'], 3, 6, [72, 112, 66], 500, { geo: 'geometry.skeleton.wither.v1.8', tex: E + 'skeleton/wither_skeleton', scale: 1.15 }],
  [118, 'zoglin', 'Zoglin', ['ghost', 'fighting'], 3, 6, [96, 102, 66], 500, { geo: 'geometry.hoglin', tex: E + 'zoglin/zoglin', scale: 0.8, beh: 'charger' }],
  [119, 'happy_ghast', 'Happy Ghast', ['flying', 'water'], 4, 6, [120, 40, 46], 520, { geo: 'geometry.happy_ghast', tex: E + 'happy_ghast/happy_ghast', hover: 1, scale: 0.27, beh: 'healer', rig: 'ghast' }],
  [120, 'piglin_brute', 'Piglin Brute', ['fire', 'fighting'], 4, 6, [110, 125, 76], 600, { geo: 'geometry.piglin', tex: E + 'piglin/piglin_brute', beh: 'charger' }],
  [121, 'wither', 'Wither', ['ghost', 'dark'], 5, 6, [160, 145, 92], 700, { leg: 1, geo: 'geometry.witherBoss', tex: E + 'wither_boss/wither', hover: 1, scale: 0.85, beh: 'ranged' }],
  // ---- The End ----
  [130, 'endermite', 'Endermite', ['bug', 'psychic'], 1, 7, [30, 42, 82], 230, { geo: 'geometry.endermite', tex: E + 'endermite' }],
  [131, 'enderman', 'Enderman', ['psychic'], 3, 7, [82, 102, 92], 480, { geo: 'geometry.enderman.v1.8', tex: E + 'enderman/enderman', beh: 'jumper' }],
  [132, 'shulker', 'Shulker', ['psychic', 'steel'], 3, 7, [88, 70, 20], 490, { geo: 'geometry.shulker.v1.8', tex: E + 'shulker/shulker_undyed', beh: 'shielder', rig: 'shulker' }],
  [133, 'ender_dragon', 'Ender Dragon', ['dragon', 'psychic'], 5, 7, [175, 150, 110], 720, { leg: 1, geo: 'geometry.dragon', tex: E + 'dragon/dragon', hover: 1, scale: 0.32, rig: 'dragon', bossScale: 1 }],
  // ---- additions after launch go below; keep ids < 200 ----
  [140, 'camel_husk', 'Camel Husk', ['ground', 'ghost'], 4, 2, [105, 80, 55], 520, { geo: 'geometry.camel_husk', tex: E + 'camel_husk/camel_husk', scale: 0.85, beh: 'tank' }],
  [141, 'mule', 'Mule', ['normal'], 2, 1, [78, 58, 64], 325, { geo: 'geometry.horse.v3', tex: E + 'horse2/mule' }],
  // Spits like a llama; the Wandering Trader calls these.
  [142, 'trader_llama', 'Trader Llama', ['normal', 'psychic'], 3, 4, [78, 60, 58], 345, { geo: 'geometry.llama.v1.8', tex: E + 'llama/llama_creamy', beh: 'ranged',
    layers: [{ geo: 'geometry.llama.v1.8', tex: E + 'llama/decor/trader_llama_decor' }] }],
  // The desert's skeleton: shoots arrows.
  [143, 'parched', 'Parched', ['ghost', 'ground'], 2, 2, [50, 64, 56], 345, { geo: 'geometry.parched', tex: E + 'parched/parched', beh: 'ranged' }],
  [144, 'zombie_nautilus', 'Zombie Nautilus', ['ghost', 'water'], 3, 3, [72, 72, 64], 400, { geo: 'geometry.nautilus', tex: E + 'nautilus/zombie_nautilus', hover: 1, beh: 'charger',
    layers: [{ geo: 'geometry.zombie_nautilus_coral', tex: E + 'nautilus/zombie_nautilus_coral' }] }],
  // The base and pattern textures are white; Minecraft tints them per variant (this one: orange with white stripes).
  [145, 'tropical_fish', 'Tropical Fish', ['water'], 1, 3, [36, 30, 66], 205, { geo: 'geometry.tropicalfish_a', tex: E + 'fish/tropical_a', tint: '#f9801d', hover: 1, rig: 'fish',
    layers: [{ geo: 'geometry.tropicalfish_a', tex: E + 'fish/tropical_a_pattern_1', tint: '#f9fffe' }] }],
  // Swallows TNT and blows up.
  [146, 'sulfur_cube', 'Sulfur Cube', ['poison', 'ground'], 3, 5, [72, 82, 45], 370, { geo: 'geometry.sulfur_cube', tex: E + 'sulfur_cube/sulfur_cube_inner', rig: 'hop', beh: 'bomber',
    layers: [{ geo: 'geometry.sulfur_cube', tex: E + 'sulfur_cube/sulfur_cube_outer', see: 1 }] }],
  // ---- legendaries added 2026-10-14 (ids from 309) ----
  // Jockeys: Bedrock's baby zombie seated on a chicken; a skeleton with its bow on a spider. They replace a few
  // night spawns of their mount's rider (js/systems/spawner.js).
  [309, 'chicken_jockey', 'Chicken Jockey', ['normal', 'ghost'], 5, 1, [100, 125, 130], 610, { geo: 'geometry.chicken.v1.12', tex: E + 'chicken/chicken',
    scale: 1.35, beh: 'chase', ride: { geo: 'geometry.zombie.baby', tex: E + 'zombie/zombie_baby', at: [0, 7.4, 1.2], rig: 'zombie' },
    jockey: { on: 'zombie', p: 0.01 } }],
  [310, 'spider_jockey', 'Spider Jockey', ['bug', 'ghost'], 5, 2, [105, 120, 120], 605, { geo: 'geometry.spider.v1.8', tex: E + 'spider/spider', rig: 'spider',
    beh: 'ranged', held: 'items/bow_standby', shot: 'bowArrow', ride: { geo: 'geometry.skeleton.v1.8', tex: E + 'skeleton/skeleton', at: [0, 1, 4] },
    jockey: { on: 'spider', p: 0.02, dark: 1 } }],
  // ---- The Aether (the Aether mod, The Aether I): its passive mobs, added 2026-10-14 ----
  // No Mojang models: tools/mc/aether-art.mjs writes their geometry and textures ('aether:' textures).
  // Sheepuff: Mojang's sheep under a cloud of Aether wool; it puffs up and floats (the 'sheepuff_puff' skin below).
  [330, 'sheepuff', 'Sheepuff', ['normal', 'flying'], 3, 8, [80, 55, 50], 430, { geo: 'geometry.sheep.sheared.v1.8', tex: E + 'sheep/sheep',
    texSize: [64, 64], patch: PUFF_FACE, layers: [{ geo: 'geometry.sheepuff.wool', tex: 'aether:sheepuff_wool' }] }],
  // Phyg and Flying Cow: Mojang's pig and cow with feathered wings (a layer fitted to them; they flap).
  [331, 'phyg', 'Phyg', ['normal', 'flying'], 3, 8, [70, 62, 72], 440, { geo: 'geometry.pig.v3', tex: E + 'pig/pig_v3',
    layers: [{ geo: 'geometry.phyg.wings', tex: 'aether:phyg_wings' }] }],
  [332, 'flying_cow', 'Flying Cow', ['normal', 'flying'], 3, 8, [90, 60, 62], 450, { geo: 'geometry.cow.v2', tex: E + 'cow/cow_v2',
    layers: [{ geo: 'geometry.flying_cow.wings', tex: 'aether:flying_cow_wings' }] }],
  [333, 'aerbunny', 'Aerbunny', ['normal', 'fairy'], 3, 8, [55, 60, 105], 440, { geo: 'geometry.aerbunny', tex: 'aether:aerbunny', rig: 'hop', scale: 1.3 }],
  // Moa: the Blue Moa; the White and Black Moas are its variants (below), Aether I's three tiers.
  [334, 'moa', 'Moa', ['flying', 'normal'], 4, 8, [95, 92, 112], 520, { geo: 'geometry.moa', tex: 'aether:moa' }],
  [335, 'aerwhale', 'Aerwhale', ['flying', 'water'], 5, 8, [150, 90, 60], 580, { geo: 'geometry.aerwhale', tex: 'aether:aerwhale', hover: 1,
    rig: 'fish', scale: 1.5 }]
];

// Variants share their base's stats, types and banner; they are collectible but never spawn as enemies.
// [id, base key, key, name, tex (under textures/entity/), rarity, extra]
const VARIANTS = [
  [200, 'cat', 'cat_tuxedo', 'Tuxedo Cat', 'cat/tuxedo', 2], [201, 'cat', 'cat_red', 'Ginger Cat', 'cat/redtabby', 2],
  [202, 'cat', 'cat_siamese', 'Siamese Cat', 'cat/siamesecat', 2], [203, 'cat', 'cat_british', 'British Shorthair', 'cat/britishshorthair', 2],
  [204, 'cat', 'cat_calico', 'Calico Cat', 'cat/calico', 2], [205, 'cat', 'cat_persian', 'Persian Cat', 'cat/persian', 3],
  [206, 'cat', 'cat_ragdoll', 'Ragdoll Cat', 'cat/ragdoll', 3], [207, 'cat', 'cat_white', 'White Cat', 'cat/white', 2],
  [208, 'cat', 'cat_jellie', 'Jellie', 'cat/jellie', 5], [209, 'cat', 'cat_black', 'Black Cat', 'cat/allblackcat', 3],
  [210, 'wolf', 'wolf_ashen', 'Ashen Wolf', 'wolf/wolf_ashen', 2], [211, 'wolf', 'wolf_black', 'Black Wolf', 'wolf/wolf_black', 3],
  [212, 'wolf', 'wolf_chestnut', 'Chestnut Wolf', 'wolf/wolf_chestnut', 2], [213, 'wolf', 'wolf_rusty', 'Rusty Wolf', 'wolf/wolf_rusty', 2],
  [214, 'wolf', 'wolf_snowy', 'Snowy Wolf', 'wolf/wolf_snowy', 3], [215, 'wolf', 'wolf_spotted', 'Spotted Wolf', 'wolf/wolf_spotted', 2],
  [216, 'wolf', 'wolf_striped', 'Striped Wolf', 'wolf/wolf_striped', 3], [217, 'wolf', 'wolf_woods', 'Woods Wolf', 'wolf/wolf_woods', 2],
  [220, 'axolotl', 'axolotl_wild', 'Wild Axolotl', 'axolotl/axolotl_wild', 2], [221, 'axolotl', 'axolotl_gold', 'Gold Axolotl', 'axolotl/axolotl_gold', 3],
  [222, 'axolotl', 'axolotl_cyan', 'Cyan Axolotl', 'axolotl/axolotl_cyan', 3], [223, 'axolotl', 'axolotl_blue', 'Blue Axolotl', 'axolotl/axolotl_blue', 5],
  [225, 'frog', 'frog_cold', 'Cold Frog', 'frog/cold_frog', 2], [226, 'frog', 'frog_warm', 'Warm Frog', 'frog/warm_frog', 2],
  [228, 'fox', 'fox_arctic', 'Arctic Fox', 'fox/arctic_fox', 3],
  [230, 'parrot', 'parrot_blue', 'Blue Parrot', 'parrot/parrot_blue', 2], [231, 'parrot', 'parrot_green', 'Green Parrot', 'parrot/parrot_green', 2],
  [232, 'parrot', 'parrot_yellow', 'Yellow Parrot', 'parrot/parrot_yellow_blue', 2], [233, 'parrot', 'parrot_grey', 'Grey Parrot', 'parrot/parrot_grey', 3],
  [235, 'rabbit', 'rabbit_white', 'White Rabbit', 'rabbit/rabbit_white', 1], [236, 'rabbit', 'rabbit_black', 'Black Rabbit', 'rabbit/rabbit_black', 1],
  [237, 'rabbit', 'rabbit_splotched', 'Splotched Rabbit', 'rabbit/rabbit_white_splotched', 2], [238, 'rabbit', 'rabbit_gold', 'Gold Rabbit', 'rabbit/rabbit_gold', 2],
  [239, 'rabbit', 'rabbit_salt', 'Salt & Pepper Rabbit', 'rabbit/rabbit_salt', 2], [240, 'rabbit', 'rabbit_toast', 'Toast', 'rabbit/rabbit_toast', 5],
  [242, 'horse', 'horse_white', 'White Horse', 'horse2/horse_white', 3], [243, 'horse', 'horse_creamy', 'Creamy Horse', 'horse2/horse_creamy', 3],
  [244, 'horse', 'horse_chestnut', 'Chestnut Horse', 'horse2/horse_chestnut', 3], [245, 'horse', 'horse_black', 'Black Horse', 'horse2/horse_black', 4],
  [246, 'horse', 'horse_gray', 'Gray Horse', 'horse2/horse_gray', 3], [247, 'horse', 'horse_darkbrown', 'Dark Brown Horse', 'horse2/horse_darkbrown', 3],
  [250, 'llama', 'llama_white', 'White Llama', 'llama/llama_white', 2], [251, 'llama', 'llama_brown', 'Brown Llama', 'llama/llama_brown', 2],
  [252, 'llama', 'llama_gray', 'Gray Llama', 'llama/llama_gray', 2],
  [254, 'mooshroom', 'mooshroom_brown', 'Brown Mooshroom', 'cow/brown_mooshroom_v2', 4],
  [256, 'panda', 'panda_lazy', 'Lazy Panda', 'panda/panda_lazy', 3], [257, 'panda', 'panda_worried', 'Worried Panda', 'panda/panda_worried', 3],
  [258, 'panda', 'panda_playful', 'Playful Panda', 'panda/panda_playful', 3], [259, 'panda', 'panda_brown', 'Brown Panda', 'panda/panda_brown', 4],
  [260, 'panda', 'panda_weak', 'Weak Panda', 'panda/panda_sneezy', 3], [261, 'panda', 'panda_aggressive', 'Aggressive Panda', 'panda/panda_aggressive', 3],
  [263, 'cow', 'cow_warm', 'Warm Cow', 'cow/cow_warm', 1, { geo: 'geometry.cow.warm' }], [264, 'cow', 'cow_cold', 'Cold Cow', 'cow/cow_cold', 1, { geo: 'geometry.cow.cold' }],
  [266, 'pig', 'pig_warm', 'Warm Pig', 'pig/pig_warm', 1], [267, 'pig', 'pig_cold', 'Cold Pig', 'pig/pig_cold', 1],
  [269, 'chicken', 'chicken_warm', 'Warm Chicken', 'chicken/chicken_warm', 1], [270, 'chicken', 'chicken_cold', 'Cold Chicken', 'chicken/chicken_cold', 1, { geo: 'geometry.chicken.cold' }],
  [277, 'copper_golem', 'copper_golem_exposed', 'Exposed Copper Golem', 'copper_golem/copper_golem_exposed', 3],
  [278, 'copper_golem', 'copper_golem_weathered', 'Weathered Copper Golem', 'copper_golem/copper_golem_weathered', 3],
  [279, 'copper_golem', 'copper_golem_oxidized', 'Oxidized Copper Golem', 'copper_golem/copper_golem_oxidized', 4],
  ...['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'silver', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']
    .map((c, i) => [281 + i, 'shulker', 'shulker_' + c, (c === 'silver' ? 'Light Gray' : c.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')) + ' Shulker',
      'shulker/shulker_' + c, c === 'black' || c === 'white' ? 4 : 3]),
  // Villager professions (ids 272-275 were the old Librarian/Cleric/Blacksmith/Butcher; kept for saves).
  ...[[272, 'librarian', 'Librarian', 2], [273, 'cleric', 'Cleric', 2], [274, 'weaponsmith', 'Weaponsmith', 3], [275, 'butcher', 'Butcher', 2],
      [300, 'armorer', 'Armorer', 3], [301, 'cartographer', 'Cartographer', 2], [302, 'fisherman', 'Fisherman', 2],
      [303, 'fletcher', 'Fletcher', 2], [304, 'leatherworker', 'Leatherworker', 2], [305, 'shepherd', 'Shepherd', 2],
      [306, 'stonemason', 'Mason', 2], [307, 'toolsmith', 'Toolsmith', 3], [308, 'nitwit', 'Nitwit', 4]]
    .map(([id, prof, name, r]) => [id, 'villager', 'villager_' + prof, name, 'villager2/villager', r,
      { layers: [{ geo: 'geometry.villager_v2', tex: E + 'villager2/professions/' + prof }] }]),
  // The Aether's White and Black Moas (Aether I's faster and higher-flying tiers): stronger than the Blue one.
  [336, 'moa', 'moa_white', 'White Moa', '', 4, { tex: 'aether:moa_white', bst: 545, hp: 120, atk: 1.25, spd: 130 }],
  [337, 'moa', 'moa_black', 'Black Moa', '', 5, { tex: 'aether:moa_black', bst: 575, hp: 128, atk: 1.32, spd: 134 }],
  // The Village's legendary: a librarian holding a Mending book (glint). Heals like the Witch; legendary stats
  // (base [92, 95, 68] on the scale above), unlike the other variants, which keep their base's.
  [311, 'villager', 'villager_mending', 'Mending Librarian', 'villager2/villager', 5,
    { layers: [{ geo: 'geometry.villager_v2', tex: E + 'villager2/professions/librarian' }], beh: 'healer', bst: 560, hp: 111, atk: 1.22, spd: 107,
      // Folded arms as Mojang poses them (animation.villager.general), the book held in front of them.
      rot: { arms: [-43, 0, 0] }, held: 'items/book_enchanted', heldEnch: 'full', heldAt: { bone: 'arms', at: [0, 19, -3], rot: [0.09, Math.PI, 0], size: 12 } }]
];

// Armour tiers: Mojang's armour (textures/models/armor/{tier}_1 helmet/chestplate/boots, _2 leggings) on a
// humanoid, a weapon of the same tier and boosted stats. In runs (js/systems/spawner.js) `chance` of each
// eligible spawn wears it (a little more on deeper floors), and it drops `coins` bonus emeralds and an
// Enchanted Book `book` of the time. kb = knockback immune; glint = enchantment glint on its gear.
export const ARMOUR = {
  iron:      { name: 'Iron',      r: 3, hp: 1.2,  atk: 1.1, sword: 'items/iron_sword',      chance: 0.05,  coins: 2 },
  diamond:   { name: 'Diamond',   r: 4, hp: 1.45, atk: 1.2, sword: 'items/diamond_sword',   chance: 0.015, coins: 5 },
  netherite: { name: 'Netherite', r: 5, hp: 1.75, atk: 1.3, sword: 'items/netherite_sword', chance: 0.003, coins: 12, book: 0.05, kb: 1, glint: 1 }
};
// One row per armoured mob: [iron id (diamond +1, netherite +2), base key, weapon]. weapon 'sword' = the tier's
// sword (fights in melee); anything else is an item texture kept at every tier (bows and tridents have no tiers).
// Variants of their base (they count toward its species). Adding a mob (the End's, later) is one row here.
const ARMOURED = [
  [312, 'steve', 'sword'], [315, 'alex', 'sword'],                         // Overworld (player armour)
  [318, 'zombie', 'sword'], [321, 'skeleton', 'items/bow_standby'],        // Nightfall
  [324, 'drowned', 'items/trident'],                                       // Ocean
  [327, 'piglin', 'sword']                                                 // Nether
];

// Render tweaks applied after the tables (variants inherit their base's).
const TACK = ['Saddle', 'Bag', 'Rein', 'Bridle', 'Bit'];
const OVERRIDES = {
  horse: { hide: [...TACK, 'MuleEar'] }, zombie_horse: { hide: [...TACK, 'MuleEar'] }, skeleton_horse: { hide: [...TACK, 'MuleEar'] },
  donkey: { hide: [...TACK, '^Ear[LR]$'] }, mule: { hide: [...TACK, '^Ear[LR]$'] },
  slime: { scale: 2.4 }, magma_cube: { scale: 2.4 }, cod: { scale: 1.5 }, salmon: { scale: 1.4 }, pufferfish: { scale: 1.3 },
  wither: { scale: 1.25 }, bat: { scale: 1.3 }, silverfish: { scale: 1.6 }, endermite: { scale: 1.6 }, bee: { scale: 1.5 },
  parrot: { scale: 1.4 }, allay: { scale: 1.4 }, vex: { scale: 1.3 }, frog: { scale: 1.3 }, rabbit: { scale: 1.3 },
  chicken: { scale: 1.2 }, axolotl: { scale: 1.3 }, tropical_fish: { scale: 2 },
  // Rotations Mojang only applies from animation scripts. bind = turn a bone's cubes, not its children.
  polar_bear: { scale: 0.85, bind: { body: [90, 0, 0] } },
  cat: { scale: 1.2, bind: { body: [90, 0, 0] }, rot: { tail1: [-50, 0, 0], tail2: [-15, 0, 0] } },
  ocelot: { bind: { body: [90, 0, 0] }, rot: { tail1: [-50, 0, 0], tail2: [-15, 0, 0] } },
  camel: { scale: 0.85, hide: ['saddle', 'bridle', 'reins'] }, camel_husk: { scale: 0.85, hide: ['saddle', 'bridle', 'reins'] }
};

// Passive mobs (they don't attack in Minecraft). A spawn cast holds at most half of these, so daytime
// pools still bring fighters (js/data/enemies.js). Variants inherit their base's.
const PASSIVE = ['chicken', 'pig', 'sheep', 'cow', 'rabbit', 'cat', 'parrot', 'frog', 'donkey', 'mule', 'armadillo', 'fox', 'ocelot',
  'mooshroom', 'camel', 'horse', 'sniffer', 'cod', 'salmon', 'tropical_fish', 'squid', 'glow_squid', 'turtle', 'axolotl', 'villager',
  'wandering_trader', 'allay', 'copper_golem', 'bat', 'strider', 'happy_ghast',
  'sheepuff', 'phyg', 'flying_cow', 'aerbunny', 'moa', 'aerwhale'];

// Weapons in hand (rendered on the model's rightItem bone) and what the mob fires (G.VFX shape),
// when its element's default shot would be wrong (a piglin's Fire element would throw fireballs).
const ARMS = {
  skeleton: { held: 'items/bow_standby', shot: 'bowArrow' }, stray: { held: 'items/bow_standby', shot: 'bowArrow' },
  bogged: { held: 'items/bow_standby', shot: 'bowArrow' }, parched: { held: 'items/bow_standby', shot: 'bowArrow' },
  pillager: { held: 'items/crossbow_standby', shot: 'bowArrow' },
  piglin: { held: 'items/crossbow_standby', shot: 'bowArrow', skins: ['piglin_sword'] },
  zombified_piglin: { held: 'items/gold_sword' },
  piglin_brute: { held: 'items/gold_axe' },
  vindicator: { held: 'items/iron_axe', hide: ['^arms$'] },
  wither_skeleton: { held: 'items/stone_sword' },
  drowned: { held: 'items/trident', shot: 'trident' },
  axolotl: { shot: 'bubble' }             // a water ball, not its element's trident
};
// Skins: extra sprite sets of a mob that some spawns use (not collectible; same stats and Mobdex entry).
// Piglins carry a golden sword (melee) or a crossbow (ranged), like in Minecraft.
// The Sheepuff puffed up: its wool swells into a cloud ball and it floats (js/systems/aether.js swaps to it).
const SKINS = [{ key: 'piglin_sword', base: 'piglin', held: 'items/gold_sword' },
  { key: 'sheepuff_puff', base: 'sheepuff', hover: 1, layers: [{ geo: 'geometry.sheepuff.puff', tex: 'aether:sheepuff_puff', texSize: [64, 128] }] }];

const stat = ([h, a, s]) => ({ hp: Math.round(70 + h * 0.45), atk: +(0.7 + a / 100 * 0.55).toFixed(2), spd: Math.round(78 + s * 0.42) });

export const ROSTER = [];
const byKey = new Map();
for (const [dex, key, name, types, rarity, gen, s, bst, x] of BASE) {
  const m = { dex, key, name, types, rarity, gen, bst, ...stat(s), base: s, ...x, ...OVERRIDES[key], ...ARMS[key] };
  if (PASSIVE.includes(key)) m.passive = 1;
  ROSTER.push(m); byKey.set(key, m);
}
for (const [dex, baseKey, key, name, tex, rarity, x] of VARIANTS) {
  const b = byKey.get(baseKey);
  if (!b) throw new Error('variant of unknown base ' + baseKey);
  const m = { ...b, dex, key, name, rarity, v: baseKey, tex: E + tex, leg: 0, beh: undefined, pw: undefined, ...x };
  ROSTER.push(m); byKey.set(key, m);
}
for (const [id, baseKey, weapon] of ARMOURED) {
  const b = byKey.get(baseKey);
  if (!b) throw new Error('armour on unknown base ' + baseKey);
  Object.entries(ARMOUR).forEach(([tier, T], i) => {
    const sword = weapon === 'sword';
    const m = { ...b, dex: id + i, key: tier + '_' + baseKey, name: T.name + ' ' + b.name, rarity: T.r, v: baseKey, leg: 0, beh: undefined,
      pw: undefined, skins: undefined, armor: tier, held: sword ? T.sword : weapon, shot: sword ? undefined : b.shot, heldEnch: T.glint,
      hp: Math.round(b.hp * T.hp), atk: +(b.atk * T.atk).toFixed(2), bst: Math.round(b.bst * (T.hp + T.atk) / 2) };
    ROSTER.push(m); byKey.set(m.key, m);
  });
}
const ids = new Set();
for (const k of PASSIVE) if (!byKey.has(k)) throw new Error('passive: unknown ' + k);
for (const m of ROSTER) {
  if (ids.has(m.dex)) throw new Error('duplicate dex ' + m.dex);
  ids.add(m.dex);
  const sk = (m.beh || '').startsWith('summon:') && m.beh.slice(7);
  if (sk && !byKey.has(sk)) throw new Error(`${m.key}: summons unknown ${sk}`);
  if (m.jockey && !byKey.has(m.jockey.on)) throw new Error(`${m.key}: jockey of unknown ${m.jockey.on}`);
}
export const BY_KEY = byKey;
/** Renderable skin entries (assets/mobs/{key}, sprite meta under the key string). */
export const SKIN_MOBS = SKINS.map(k => ({ ...byKey.get(k.base), ...k, skinOf: k.base, skins: undefined }));

/** The game-side record (js/data/mobdex.js): only what the engine reads. */
export function dexRecord(m) {
  const r = { dex: m.dex, key: m.key, name: m.name, types: m.types, hp: m.hp, spd: m.spd, atk: m.atk,
    rarity: m.rarity, bst: m.bst, gen: m.gen };
  if (m.leg) r.leg = true;
  if (m.v) r.v = m.v;
  if (m.shot) r.shot = m.shot;
  if (m.bossScale) r.bossScale = m.bossScale;
  if (m.skins) r.skins = m.skins;
  if (m.noEnemy) r.ne = true;           // playable heroes never spawn as enemies
  if (m.passive) r.passive = true;
  if (m.beh) r.beh = m.beh.startsWith('summon:') ? 'summoner' : m.beh;
  if (m.beh && m.beh.startsWith('summon:')) r.minion = byKey.get(m.beh.slice(7)).dex;
  if (m.pw != null && m.pw !== 1) r.pw = m.pw;
  if (m.armor) r.arm = m.armor;
  if (m.jockey) r.jk = { on: byKey.get(m.jockey.on).dex, p: m.jockey.p, ...(m.jockey.dark ? { dark: 1 } : {}) };
  return r;
}

/** The armour tiers as the game reads them (js/data/mobdex.js: G.ARMOUR). */
export const ARMOUR_GAME = Object.fromEntries(Object.entries(ARMOUR).map(([k, T]) =>
  [k, { name: T.name, hp: T.hp, atk: T.atk, chance: T.chance, coins: T.coins, book: T.book || 0, kb: !!T.kb }]));
