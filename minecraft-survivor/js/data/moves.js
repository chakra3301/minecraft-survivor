/* ============ moves.js — skill catalogue ============
 *
 * Skills keep PokéSurvivor's move ids, types and numbers; only what the
 * player sees (name, desc, upgrade texts, Smithing names) is Minecraft.
 *
 * kind (behaviour, implemented in systems/combat.js):
 *   projectile  fires `count` projectiles at the nearest enemy
 *   melee       arc strike around the mob
 *   beam        straight ray that pierces everything it touches
 *   orbit       orbs that circle you while the skill is active
 *   nova        radial burst in every direction
 *   aura        constant damage circle around you
 *   buff        powers up your own mob (stacks, expires)
 *   ---- since 2026-10-10 (same graphics, different play) ----
 *   boomerang   flies at the enemy and comes back, hitting both ways
 *   chain       hits one enemy and jumps to the `count` nearest ones
 *   mine        mines on the ground that blow up when stepped on
 *   meteor      `count` meteors fall on nearby enemies (the shadow warns)
 *   turret      leaves something that shoots on its own for `dur` seconds
 *   dash        you rush at the enemy hitting everything on the way (no damage taken)
 *   trail       you leave puddles that hurt whatever steps on them
 *   cone        many short shots in a fan (breath, spray...)
 *
 * Only the ACTIVE skill runs. Switch with 1-4 / Q / E.
 *
 * `item` is the Minecraft texture (assets/mc/<item>.png) that G.Icons draws
 * as the skill icon (see ui/icons.js).
 *
 * Upgrades (lvl 1 -> 5) come from a ladder shared by `kind`:
 *   multiplicative mods -> dmg, cd, speed, radius, dur, amount, arc
 *   additive mods       -> count, pierce, stacks
 */
(() => {
  const LADDERS = {
    projectile: [
      { t: '+1 projectile',                  m: { count: 1, spread: 1.4 } },
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: '+1 projectile and +1 pierce',   m: { count: 1, pierce: 1, spread: 1.2 } }
    ],
    melee: [
      { t: '+40% damage',                     m: { dmg: 1.40 } },
      { t: '+25% reach',                  m: { radius: 1.25 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: 'Hits all around (360°) and +50% damage',    m: { arc: 9, dmg: 1.50 } }
    ],
    beam: [
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: '+30% reach and width',         m: { radius: 1.30, width: 1.30 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: '+50% damage',                     m: { dmg: 1.50 } }
    ],
    orbit: [
      { t: '+1 orb',                       m: { count: 1 } },
      { t: '+55% damage',                     m: { dmg: 1.55 } },
      { t: '+25% radius and spins faster',  m: { radius: 1.25, speed: 1.35 } },
      { t: '+1 orb and +55% damage',           m: { count: 1, dmg: 1.55 } }
    ],
    nova: [
      { t: '+4 projectiles',                m: { count: 4 } },
      { t: '+40% damage',                     m: { dmg: 1.40 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: '+4 projectiles and +1 pierce', m: { count: 4, pierce: 1 } }
    ],
    aura: [
      { t: '+30% radius',                    m: { radius: 1.30 } },
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: 'Hits 40% more often',    m: { cd: 0.70 } },
      { t: '+30% radius and +50% damage',        m: { radius: 1.30, dmg: 1.50 } }
    ],
    boomerang: [
      { t: '+1 boomerang',                    m: { count: 1 } },
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: '+30% reach',                  m: { radius: 1.30 } },
      { t: '+1 boomerang and +40% damage',        m: { count: 1, dmg: 1.40 } }
    ],
    chain: [
      { t: '+2 jumps',                     m: { count: 2 } },
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: '+2 jumps and +40% damage',         m: { count: 2, dmg: 1.40 } }
    ],
    mine: [
      { t: '+1 mine',                       m: { count: 1 } },
      { t: '+50% damage',                     m: { dmg: 1.50 } },
      { t: '+30% blast radius',       m: { radius: 1.30 } },
      { t: '+1 mine and -25% cooldown',        m: { count: 1, cd: 0.75 } }
    ],
    meteor: [
      { t: '+1 meteor',                    m: { count: 1 } },
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: '+30% radius',                    m: { radius: 1.30 } },
      { t: '+2 meteors and -20% cooldown',    m: { count: 2, cd: 0.80 } }
    ],
    turret: [
      { t: '+50% damage',                     m: { dmg: 1.50 } },
      { t: 'Shoots 35% faster',     m: { rate: 0.74 } },
      { t: '+1 at a time',                   m: { count: 1 } },
      { t: '+50% duration and +40% damage',     m: { dur: 1.50, dmg: 1.40 } }
    ],
    dash: [
      { t: '+40% damage',                     m: { dmg: 1.40 } },
      { t: '+30% distance',                m: { radius: 1.30 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: '+60% damage and wider',         m: { dmg: 1.60, width: 1.40 } }
    ],
    trail: [
      { t: '+40% damage',                     m: { dmg: 1.40 } },
      { t: '+40% duration',                 m: { dur: 1.40 } },
      { t: 'Puddles 30% bigger',    m: { radius: 1.30 } },
      { t: '+50% damage and +30% radius',        m: { dmg: 1.50, radius: 1.30 } }
    ],
    cone: [
      { t: '+3 shots',                   m: { count: 3 } },
      { t: '+40% damage',                     m: { dmg: 1.40 } },
      { t: '+30% reach',                  m: { life: 1.30 } },
      { t: '+3 shots and +1 pierce',  m: { count: 3, pierce: 1 } }
    ],
    buff: [
      { t: '+1 max stack',         m: { stacks: 1 } },
      { t: '+40% potency',                 m: { amount: 1.40 } },
      { t: '+50% duration',                 m: { dur: 1.50 } },
      { t: '+1 stack and +40% potency', m: { stacks: 1, amount: 1.40 } }
    ]
  };

  const RAW = [
    // ---------------- OVERWORLD (normal: everyone's shared pool) ----------------
    { id: 'tackle', name: 'Iron Sword', type: 'normal', kind: 'melee', item: 'items/iron_sword',
      desc: 'Sweeps your sword in an arc through everything in front of you.',
      cd: 0.50, dmg: 13, radius: 48, arc: 1.7, knock: 90 },

    { id: 'quick-attack', name: 'Spear Lunge', type: 'normal', kind: 'dash', item: 'items/spear/iron_spear',
      desc: 'You lunge at the enemy and hit everything on the way.',
      cd: 0.75, dmg: 20, radius: 110, width: 34, knock: 40 },

    { id: 'swords-dance', name: 'Strength Potion', type: 'normal', kind: 'buff', item: 'items/potion_bottle_splash_damageBoost',
      desc: 'No damage: stacks ATTACK while it is active.',
      cd: 0.85, stat: 'atk', amount: 0.13, dur: 7, stacks: 5 },

    { id: 'agility', name: 'Swiftness Potion', type: 'normal', kind: 'buff', item: 'items/potion_bottle_splash_moveSpeed',
      desc: 'No damage: stacks SPEED while it is active.',
      cd: 0.85, stat: 'spd', amount: 0.10, dur: 7, stacks: 5 },

    { id: 'harden', name: 'Resistance Potion', type: 'normal', kind: 'buff', item: 'items/potion_bottle_splash_turtleMaster',
      desc: 'No damage: stacks DEFENSE while it is active.',
      cd: 0.85, stat: 'def', amount: 0.07, dur: 7, stacks: 5 },

    // ---------------- FIRE ----------------
    { id: 'ember', name: 'Fire Charge', type: 'fire', kind: 'projectile', item: 'items/fireball',
      desc: 'A fireball at the nearest enemy.',
      cd: 0.52, dmg: 18, speed: 310, count: 1, spread: 0.12, pierce: 0, life: 1.6, size: 7, burn: 1 },

    { id: 'flamethrower', name: 'Flint and Steel', type: 'fire', kind: 'cone', item: 'items/flint_and_steel',
      desc: 'A short fan of flames that sets enemies on fire.',
      cd: 0.70, dmg: 7, count: 7, arc: 0.9, speed: 380, life: 0.42, size: 6, pierce: 1, burn: 1 },

    { id: 'fire-spin', name: 'Blaze Rods', type: 'fire', kind: 'orbit', item: 'items/blaze_rod',
      desc: 'Blaze rods spin around you. Constant defense.',
      cd: 0.30, dmg: 14, count: 3, radius: 62, speed: 2.4, size: 9, burn: 1 },

    { id: 'heat-wave', name: 'Magma Burst', type: 'fire', kind: 'nova', item: 'items/magma_cream',
      desc: 'Bursts into flames in every direction.',
      cd: 1.25, dmg: 13, speed: 250, count: 10, pierce: 1, life: 1.1, size: 7, burn: 1 },

    // ---------------- AQUATIC (water) ----------------
    { id: 'water-gun', name: 'Trident', type: 'water', kind: 'projectile', item: 'items/trident',
      desc: 'A piercing trident throw. Reliable at any range.',
      cd: 0.44, dmg: 14, speed: 350, count: 1, spread: 0.10, pierce: 1, life: 1.5, size: 6 },

    { id: 'bubble', name: 'Bubble Splash', type: 'water', kind: 'nova', item: 'items/potion_bottle_splash_waterBreathing',
      desc: 'A ring of bubbles that slows whatever it touches.',
      cd: 1.00, dmg: 9, speed: 210, count: 8, pierce: 0, life: 1.3, size: 8, slow: 0.45 },

    { id: 'hydro-pump', name: 'Guardian Beam', type: 'water', kind: 'beam', item: 'items/spawn_eggs/spawn_egg_guardian',
      desc: 'A slow but devastating guardian laser.',
      cd: 1.50, dmg: 29, radius: 250, width: 30 },

    { id: 'aqua-ring', name: 'Conduit Power', type: 'water', kind: 'buff', item: 'items/heartofthesea_closed',
      desc: 'No damage: stacks health REGENERATION.',
      cd: 0.90, stat: 'regen', amount: 1.6, dur: 8, stacks: 4 },

    // ---------------- NATURE (grass) ----------------
    { id: 'vine-whip', name: 'Vine Lash', type: 'grass', kind: 'melee', item: 'blocks/cave_vines_head_berries',
      desc: 'Long-reaching vines that lash in a wide arc.',
      cd: 0.62, dmg: 16, radius: 68, arc: 1.3, knock: 60 },

    { id: 'razor-leaf', name: 'Leaf Blades', type: 'grass', kind: 'boomerang', item: 'blocks/azalea_leaves_flowers',
      desc: 'Two leaves that fly out and back, cutting both ways.',
      cd: 0.90, dmg: 10, speed: 330, count: 2, spread: 0.5, radius: 210, size: 6 },

    { id: 'leaf-storm', name: 'Leaf Whirl', type: 'grass', kind: 'orbit', item: 'blocks/leaves_oak_carried',
      desc: 'A wide cyclone of leaves spins around you.',
      cd: 0.26, dmg: 14, count: 4, radius: 74, speed: 2.6, size: 8 },

    // (Was Giga Drain: it healed on every hit and was broken. Same id so saves keep working.)
    { id: 'giga-drain', name: 'Sweet Berry Bush', type: 'grass', kind: 'aura', item: 'items/sweet_berries',
      desc: 'Thorny bushes that snag and crush everything close to you.',
      cd: 0.55, dmg: 9, radius: 76 },

    // ---------------- REDSTONE (electric) ----------------
    { id: 'thunder-shock', name: 'Redstone Bolt', type: 'electric', kind: 'projectile', item: 'items/redstone_dust',
      desc: 'A lightning-fast charge that pierces several enemies.',
      cd: 0.40, dmg: 13, speed: 480, count: 1, spread: 0.08, pierce: 2, life: 1.1, size: 5 },

    { id: 'discharge', name: 'Redstone Pulse', type: 'electric', kind: 'aura', item: 'blocks/redstone_lamp_on',
      desc: 'A permanent redstone field around you.',
      cd: 0.45, dmg: 8, radius: 70 },

    { id: 'thunderbolt', name: 'Lightning Rod', type: 'electric', kind: 'chain', item: 'blocks/lightning_rod',
      desc: 'A lightning strike that jumps from enemy to enemy.',
      cd: 0.95, dmg: 21, count: 4, radius: 140 },

    // ---------------- ENDER (psychic) ----------------
    // (11-10-2026: -22/-30 % damage and weaker homing; they were flooding the ranking.)
    { id: 'confusion', name: 'Shulker Bullet', type: 'psychic', kind: 'projectile', item: 'items/shulker_shell',
      desc: 'A bullet that chases its target on its own.',
      cd: 0.58, dmg: 13, speed: 280, count: 1, spread: 0.1, pierce: 0, life: 2.2, size: 8, homing: 2.0 },

    { id: 'psybeam', name: 'Crystal Beam', type: 'psychic', kind: 'beam', item: 'items/end_crystal',
      desc: 'A wide, heavy End Crystal beam.',
      cd: 1.15, dmg: 17, radius: 215, width: 40 },

    { id: 'psychic', name: 'Pearl Burst', type: 'psychic', kind: 'nova', item: 'items/ender_pearl',
      desc: 'A radial burst of ender pearls that seek enemies.',
      cd: 1.35, dmg: 10, speed: 230, count: 12, pierce: 1, life: 1.6, size: 7, homing: 1.0 },

    // ---------------- SECONDARY ELEMENTS ----------------
    { id: 'sludge', name: 'Poison Potion', type: 'poison', kind: 'projectile', item: 'items/potion_bottle_splash_poison',
      desc: 'A splash potion that poisons on impact.',
      cd: 0.60, dmg: 17, speed: 290, count: 1, spread: 0.12, pierce: 0, life: 1.5, size: 8, poison: 1 },

    { id: 'mud-shot', name: 'Mud Splash', type: 'ground', kind: 'nova', item: 'blocks/mud',
      desc: 'Splashes mud all around and slows.',
      cd: 1.10, dmg: 11, speed: 200, count: 7, pierce: 0, life: 1.0, size: 9, slow: 0.4 },

    { id: 'gust', name: 'Breeze Whirl', type: 'flying', kind: 'orbit', item: 'items/breeze_rod',
      desc: 'Whirls of wind that escort you.',
      cd: 0.26, dmg: 13, count: 3, radius: 72, speed: 2.8, size: 8, knock: 40 },

    { id: 'wing-attack', name: 'Wind Charge', type: 'flying', kind: 'melee', item: 'items/wind_charge',
      desc: 'A wide gust that blows enemies back.',
      cd: 0.55, dmg: 14, radius: 58, arc: 1.9, knock: 70 },

    // ---------------- OVERWORLD (extra) ----------------
    { id: 'body-slam', name: 'Mace Smash', type: 'normal', kind: 'melee', item: 'items/mace',
      desc: 'A full-weight mace smash: slow, short and brutal.',
      cd: 0.95, dmg: 30, radius: 46, arc: 2.2, knock: 140 },

    { id: 'hyper-voice', name: 'Goat Horn', type: 'normal', kind: 'nova', item: 'items/goat_horn',
      desc: 'A horn blast that rings out in every direction.',
      cd: 1.15, dmg: 12, speed: 260, count: 9, pierce: 1, life: 0.9, size: 7 },

    // ---------------- POISON (extra) ----------------
    { id: 'poison-sting', name: 'Poison Arrow', type: 'poison', kind: 'projectile', item: 'items/tipped_arrow_poison',
      desc: 'A fast tipped arrow that poisons.',
      cd: 0.34, dmg: 8, speed: 420, count: 1, spread: 0.08, pierce: 0, life: 1.0, size: 4, poison: 1 },

    { id: 'toxic', name: 'Lingering Poison', type: 'poison', kind: 'trail', item: 'items/potion_bottle_lingering_poison',
      desc: 'You leave poison clouds that hurt whatever steps in them.',
      cd: 0.3, dmg: 6, radius: 26, dur: 3, poison: 1 },

    // ---------------- EARTH (ground, extra) ----------------
    { id: 'bulldoze', name: 'Tremor', type: 'ground', kind: 'aura', item: 'items/iron_shovel',
      desc: 'Shakes the ground: hurts and slows what is close.',
      cd: 0.7, dmg: 11, radius: 80, slow: 0.35 },

    // ---------------- ARTHROPOD (bug) ----------------
    { id: 'bug-bite', name: 'Spider Bite', type: 'bug', kind: 'melee', item: 'items/spider_eye',
      desc: 'A quick bite in a short arc.',
      cd: 0.42, dmg: 11, radius: 44, arc: 1.6, knock: 40 },

    { id: 'string-shot', name: 'Cobweb Trap', type: 'bug', kind: 'mine', item: 'blocks/web',
      desc: 'Leaves cobwebs on the ground that catch and badly slow whoever steps on them.',
      cd: 1.1, dmg: 14, count: 2, radius: 56, dur: 7, slow: 0.6 },

    { id: 'bug-buzz', name: 'Bee Swarm', type: 'bug', kind: 'aura', item: 'items/spawn_eggs/spawn_egg_bee',
      desc: 'A buzzing swarm that keeps stinging what is close.',
      cd: 0.45, dmg: 8, radius: 66 },

    // ---------------- STONE (rock) ----------------
    { id: 'rock-throw', name: 'Cobble Toss', type: 'rock', kind: 'projectile', item: 'blocks/cobblestone',
      desc: 'A heavy cobblestone that knocks enemies back.',
      cd: 0.7, dmg: 24, speed: 260, count: 1, spread: 0.12, pierce: 0, life: 1.4, size: 9, knock: 90 },

    { id: 'rock-slide', name: 'Dripstone Rain', type: 'rock', kind: 'meteor', item: 'blocks/pointed_dripstone_down_frustum',
      desc: 'Pointed dripstone falls from the ceiling on nearby enemies.',
      cd: 1.3, dmg: 21, count: 3, radius: 46, knock: 50 },     // (12-10-2026: was 26; it killed twice the average)

    // ---------------- FROST (ice) ----------------
    { id: 'ice-beam', name: 'Frost Ray', type: 'ice', kind: 'beam', item: 'blocks/ice_packed',
      desc: 'A freezing ray that nearly stops enemies cold.',
      cd: 1.1, dmg: 20, radius: 220, width: 30, slow: 0.7 },

    { id: 'powder-snow', name: 'Powder Snow', type: 'ice', kind: 'aura', item: 'items/bucket_powder_snow',
      desc: 'Freezing snow around you that slows.',
      cd: 0.55, dmg: 8, radius: 76, slow: 0.45 },

    // ---------------- BRUTE (fighting) ----------------
    { id: 'karate-chop', name: 'Iron Axe', type: 'fighting', kind: 'melee', item: 'items/iron_axe',
      desc: 'A sharp, heavy chop straight ahead.',
      cd: 0.5, dmg: 18, radius: 50, arc: 1.2, knock: 110 },

    { id: 'aura-sphere', name: 'Bow', type: 'fighting', kind: 'projectile', item: 'items/bow_standby',
      desc: 'A homing arrow that never misses.',
      cd: 0.62, dmg: 17, speed: 300, count: 1, spread: 0.1, pierce: 0, life: 2.0, size: 8, homing: 4 },

    // ---------------- UNDEAD (ghost) ----------------
    { id: 'lick', name: 'Zombie Grasp', type: 'ghost', kind: 'melee', item: 'items/rotten_flesh',
      desc: 'A rotten swipe that slows a little.',
      cd: 0.48, dmg: 12, radius: 48, arc: 1.8, slow: 0.4 },

    { id: 'shadow-ball', name: 'Wither Skull', type: 'ghost', kind: 'projectile', item: 'items/skull_banner_pattern',
      desc: 'A dark skull that flies through several enemies.',
      cd: 0.66, dmg: 19, speed: 280, count: 1, spread: 0.1, pierce: 2, life: 1.6, size: 9 },

    // ---------------- DRAGON ----------------
    { id: 'dragon-rage', name: "Dragon's Breath", type: 'dragon', kind: 'beam', item: 'items/dragons_breath',
      desc: 'A blast of dragon fire in a straight line.',
      cd: 1.0, dmg: 24, radius: 230, width: 34 },

    { id: 'dragon-dance', name: "Dragon's Might", type: 'dragon', kind: 'buff', item: 'items/spawn_eggs/spawn_egg_ender_dragon',
      desc: 'No damage: stacks ATTACK faster than Strength Potion.',
      cd: 0.7, stat: 'atk', amount: 0.11, dur: 7, stacks: 5 },

    // ---------------- MAGIC (fairy) ----------------
    { id: 'fairy-wind', name: 'Allay Breeze', type: 'fairy', kind: 'nova', item: 'items/spawn_eggs/spawn_egg_allay',
      desc: 'A magic breeze in every direction.',
      cd: 1.0, dmg: 11, speed: 230, count: 10, pierce: 0, life: 1.2, size: 7 },

    { id: 'dazzling-gleam', name: 'Spellbook', type: 'fairy', kind: 'aura', item: 'items/book_enchanted',
      desc: 'A magic glow all around you.',
      cd: 0.5, dmg: 9, radius: 72 },

    // ---------------- IRON (steel) ----------------
    { id: 'metal-claw', name: 'Iron Pickaxe', type: 'steel', kind: 'melee', item: 'items/iron_pickaxe',
      desc: 'A pickaxe swing in an arc.',
      cd: 0.5, dmg: 15, radius: 50, arc: 1.6, knock: 60 },

    { id: 'flash-cannon', name: 'Beacon Beam', type: 'steel', kind: 'beam', item: 'blocks/beacon',
      desc: 'A piercing ray of beacon light.',
      cd: 1.05, dmg: 23, radius: 220, width: 30 },

    // ---------------- SHADOW (dark) ----------------
    { id: 'bite', name: 'Evoker Fangs', type: 'dark', kind: 'melee', item: 'items/spawn_eggs/spawn_egg_evoker',
      desc: 'Snapping fangs that knock enemies back.',
      cd: 0.45, dmg: 14, radius: 46, arc: 1.5, knock: 70 },

    { id: 'dark-pulse', name: 'Sculk Shriek', type: 'dark', kind: 'nova', item: 'items/echo_shard',
      desc: 'A sculk shriek that rings out in every direction.',
      cd: 1.15, dmg: 14, speed: 240, count: 10, pierce: 1, life: 1.1, size: 8 },

    { id: 'night-shade', name: 'Sculk Spread', type: 'dark', kind: 'aura', item: 'blocks/sculk_catalyst_top',
      desc: 'Sculk surrounds you and consumes what is close.',
      cd: 0.5, dmg: 9, radius: 72 },

    // ---------------- NEW (2026-10-10): same shapes, other mechanics ----------------
    { id: 'bonemerang', name: 'Bone Boomerang', type: 'ground', kind: 'boomerang', item: 'items/bone',
      desc: 'A bone that flies out and back, hitting hard.',
      cd: 0.95, dmg: 16, speed: 300, count: 1, radius: 230, size: 8, knock: 40 },

    { id: 'psycho-cut', name: 'Chorus Blades', type: 'psychic', kind: 'boomerang', item: 'items/chorus_fruit',
      desc: 'Ender blades that come back to you.',
      cd: 0.8, dmg: 9, speed: 360, count: 2, spread: 0.6, radius: 200, size: 7 },

    { id: 'spikes', name: 'Cactus Spikes', type: 'ground', kind: 'mine', item: 'blocks/cactus_side',
      desc: 'Plants cactus spikes that burst when stepped on.',
      cd: 1.2, dmg: 18, count: 2, radius: 60, dur: 8 },

    { id: 'toxic-spikes', name: 'Pufferfish Trap', type: 'poison', kind: 'mine', item: 'items/fish_pufferfish_raw',
      desc: 'Pufferfish that badly poison when they pop.',
      cd: 1.1, dmg: 11, count: 2, radius: 56, dur: 8, poison: 2 },

    { id: 'hail', name: 'Snowball Rain', type: 'ice', kind: 'meteor', item: 'items/snowball',
      desc: 'Snowballs fall on enemies and slow them.',
      cd: 1.2, dmg: 18, count: 4, radius: 40, slow: 0.4 },

    { id: 'meteor-mash', name: 'Anvil Drop', type: 'steel', kind: 'meteor', item: 'blocks/anvil_top_damaged_0',
      desc: 'Two anvils that crush whatever they land on.',
      cd: 1.4, dmg: 34, count: 2, radius: 54, knock: 80 },

    { id: 'will-o-wisp', name: 'Blaze Sentry', type: 'fire', kind: 'turret', item: 'items/spawn_eggs/spawn_egg_blaze',
      desc: 'Leaves a floating blaze that shoots fireballs and burns.',
      cd: 3.5, dmg: 15, rate: 0.55, dur: 6, count: 1, range: 300, speed: 300, size: 7, burn: 1 },

    { id: 'substitute', name: 'Armor Stand Decoy', type: 'normal', kind: 'turret', item: 'items/armor_stand',
      desc: 'An armor stand that stays behind shooting arrows for you.',
      cd: 4.0, dmg: 14, rate: 0.4, dur: 6, count: 1, range: 280, speed: 320, size: 6 },

    { id: 'aerial-ace', name: 'Elytra Dash', type: 'flying', kind: 'dash', item: 'items/elytra',
      desc: 'You glide in and cut through everything you cross.',
      cd: 0.75, dmg: 18, radius: 120, width: 40, knock: 60 },

    { id: 'flame-wheel', name: 'Fire Walker', type: 'fire', kind: 'trail', item: 'items/blaze_powder',
      desc: 'You run wrapped in fire, leaving a trail of flames.',
      cd: 0.28, dmg: 10, radius: 28, dur: 2.6, burn: 1 },

    { id: 'bubble-beam', name: 'Water Splash', type: 'water', kind: 'cone', item: 'items/bucket_water',
      desc: 'A short fan of water that slows.',
      cd: 0.65, dmg: 6, count: 7, arc: 1.0, speed: 340, life: 0.45, size: 6, slow: 0.3 },

    { id: 'hex', name: 'Soul Chain', type: 'ghost', kind: 'chain', item: 'items/soul_lantern',
      desc: 'A curse that jumps between enemies. Much more damage if they burn, are poisoned or slowed.',
      cd: 0.9, dmg: 17, count: 4, radius: 150, hex: 1.7 }
  ];

  // Melee (12-10-2026): +20 % damage and +25 % reach and arc
  // (and -25 % damage taken while it is your active attack, in player.js).
  // They hit well, but you had to risk much more than with ranged skills.
  for (const m of RAW) {
    if (m.kind !== 'melee') continue;
    m.dmg = Math.round(m.dmg * 1.2);
    m.radius = Math.round(m.radius * 1.25);
    if (m.arc) m.arc = Math.min(3, +(m.arc * 1.25).toFixed(2));
  }

  // Skill pool per element. Everyone has the `normal` (Overworld) pool.
  const POOL = {};
  for (const m of RAW) (POOL[m.type] = POOL[m.type] || []).push(m.id);

  const BY_ID = {};
  for (const m of RAW) {
    m.ups = LADDERS[m.kind];
    m.maxLvl = m.ups.length + 1;
    BY_ID[m.id] = m;
  }

  /** Skills this mob can learn (its elements + Overworld). */
  function poolFor(mon) {
    const ids = new Set(POOL.normal);
    for (const t of mon.types) for (const id of (POOL[t] || [])) ids.add(id);
    return [...ids];
  }

  /**
   * A skill instance in a run: the base numbers of `def` with every
   * ladder upgrade up to `lvl` already applied.
   */
  function instance(id, lvl = 1) {
    const def = BY_ID[id];
    const s = Object.assign({}, def, { id, def, lvl, t: 0 });
    delete s.ups;
    for (let i = 0; i < lvl - 1; i++) applyMods(s, def.ups[i].m);
    return s;
  }

  const MULT = ['dmg', 'cd', 'speed', 'radius', 'dur', 'amount', 'arc', 'width', 'spread', 'life', 'size', 'rate'];
  const ADD = ['count', 'pierce', 'stacks'];

  function applyMods(s, m) {
    for (const k in m) {
      if (MULT.includes(k) && s[k] != null) s[k] *= m[k];
      else if (ADD.includes(k)) s[k] = (s[k] || 0) + m[k];
      else s[k] = m[k];
    }
  }

  /** Levels up an existing instance. */
  function levelUp(s) {
    if (s.lvl >= s.def.maxLvl) return false;
    applyMods(s, s.def.ups[s.lvl - 1].m);
    s.lvl++;
    return true;
  }

  /** Text of the next upgrade, for the level-up card. */
  function nextUpText(s) {
    return s.lvl >= s.def.maxLvl ? null : s.def.ups[s.lvl - 1].t;
  }

  /** Starting skill from the main element (if the mob doesn't bring one). */
  const START = {
    fire: 'ember', water: 'water-gun', grass: 'vine-whip', electric: 'thunder-shock',
    psychic: 'confusion', poison: 'sludge', ground: 'mud-shot', flying: 'gust',
    bug: 'bug-bite', rock: 'rock-throw', ice: 'ice-beam', fighting: 'karate-chop',
    ghost: 'shadow-ball', dragon: 'dragon-rage', fairy: 'fairy-wind', steel: 'metal-claw',
    dark: 'bite', normal: 'tackle'
  };
  function startFor(mon) {
    if (mon.start && BY_ID[mon.start]) return mon.start;
    for (const t of mon.types) if (START[t]) return START[t];
    return 'tackle';
  }

  // ---------------- Smithing (move evolution) ----------------
  /*
   * A skill at MAX LEVEL can be upgraded at Smithing (like Minecraft's netherite upgrade) if,
   * during that run, you have ever taken the stat card of its condition (`needs`, a
   * LevelUp.STATS id). A golden card shows up ("Smithing: ..."). Buffs (potions) never are.
   * (Not the Enchanting Table: that is systems/enchanting.js, outside runs.)
   */
  const NEED_NAME = { hp: 'Health Boost', atk: 'Strength', spd: 'Speed', cd: 'Haste', def: 'Resistance',
                      rgn: 'Regeneration', mag: 'Magnetism', xp: 'Wisdom' };
  const EVO = {
    'tackle': ['Netherite Sword', 'hp'],         'quick-attack': ['Netherite Lunge', 'spd'],
    'body-slam': ['Heavy Smash', 'atk'],       'hyper-voice': ['Raid Horn', 'cd'],
    'ember': ['Ghast Fireball', 'atk'],          'flamethrower': ['Soul Flame', 'cd'],
    'fire-spin': ['Blazing Halo', 'rgn'],        'heat-wave': ['Nether Eruption', 'hp'],
    'water-gun': ['Prismarine Trident', 'atk'],    'bubble': ['Bubble Column', 'spd'],
    'hydro-pump': ['Elder Beam', 'atk'], 'vine-whip': ['Bramble Lash', 'atk'],
    'razor-leaf': ['Azalea Blades', 'cd'],       'leaf-storm': ['Jungle Tempest', 'rgn'],
    'giga-drain': ['Thorny Thicket', 'hp'],      'thunder-shock': ['Overcharged Bolt', 'atk'],
    'discharge': ['Redstone Overload', 'def'],   'thunderbolt': ['Thunderstorm', 'cd'],
    'confusion': ['Shulker Barrage', 'cd'],      'psybeam': ['Gateway Beam', 'atk'],
    'psychic': ['Eyes of Ender', 'mag'],         'sludge': ["Witch's Brew", 'atk'],
    'poison-sting': ['Toxic Volley', 'spd'],     'toxic': ['Noxious Cloud', 'rgn'],
    'mud-shot': ['Mudslide', 'atk'],             'bulldoze': ['Earthquake', 'atk'],
    'gust': ['Breeze Storm', 'spd'],             'wing-attack': ['Gale Blast', 'atk'],
    'bug-bite': ['Cave Spider Fangs', 'atk'],    'string-shot': ["Spider's Lair", 'cd'],
    'bug-buzz': ['Angry Hive', 'rgn'],           'rock-throw': ['Boulder Toss', 'atk'],
    'rock-slide': ['Stalactite Storm', 'cd'],    'ice-beam': ['Blue Ice Ray', 'atk'],
    'powder-snow': ['Deep Freeze', 'spd'],       'karate-chop': ['Cleaving Axe', 'atk'],
    'aura-sphere': ['Hunter\'s Bow', 'cd'],          'lick': ["Husk's Hunger", 'atk'],
    'shadow-ball': ['Blue Wither Skull', 'cd'],  'dragon-rage': ["Dragon's Wrath", 'atk'],
    'fairy-wind': ['Allay Chorus', 'atk'],       'dazzling-gleam': ['Grand Spellbook', 'rgn'],
    'metal-claw': ['Diamond Pickaxe', 'atk'],    'flash-cannon': ['Radiant Beacon', 'def'],
    'bite': ["Evoker's Wrath", 'atk'],          'dark-pulse': ['Sonic Shriek', 'spd'],
    'night-shade': ['Sculk Bloom', 'rgn'],
    'bonemerang': ['Bone Cyclone', 'atk'],       'psycho-cut': ['Void Blades', 'cd'],
    'spikes': ['Cactus Field', 'atk'],           'toxic-spikes': ['Puffer Minefield', 'rgn'],
    'hail': ['Ice Spike Rain', 'cd'],            'meteor-mash': ['Anvil Storm', 'atk'],
    'will-o-wisp': ['Blaze Spawner', 'cd'],      'substitute': ['Armored Decoy', 'def'],
    'aerial-ace': ['Rocket Glide', 'spd'],       'flame-wheel': ['Soul Fire Walker', 'spd'],
    'bubble-beam': ['Tidal Wave', 'atk'],        'hex': ['Curse of Binding', 'mag']
  };
  // What it gains at Smithing, by how it works.
  const EVO_MODS = {
    projectile: { t: '×1.8 damage, +2 projectiles, +2 pierce and bigger', m: { dmg: 1.8, count: 2, pierce: 2, size: 1.3, spread: 1.1 } },
    melee:      { t: '×1.9 damage, more reach and hits all around (360°)', m: { dmg: 1.9, radius: 1.3, arc: 9 } },
    beam:       { t: '×1.8 damage, a 50% wider and longer beam', m: { dmg: 1.8, width: 1.5, radius: 1.2, cd: 0.85 } },
    orbit:      { t: '+2 orbs, ×1.7 damage and more radius', m: { count: 2, dmg: 1.7, radius: 1.15 } },
    nova:       { t: '+6 projectiles, ×1.6 damage and +1 pierce', m: { count: 6, dmg: 1.6, pierce: 1 } },
    aura:       { t: '×1.8 damage and 35% more radius', m: { dmg: 1.8, radius: 1.35 } },
    boomerang:  { t: '×1.8 damage, +1 boomerang and more reach', m: { dmg: 1.8, count: 1, radius: 1.2, size: 1.2 } },
    chain:      { t: '×1.7 damage and +3 jumps', m: { dmg: 1.7, count: 3, radius: 1.2 } },
    mine:       { t: '×1.8 damage, +2 mines and a bigger blast', m: { dmg: 1.8, count: 2, radius: 1.25 } },
    meteor:     { t: '×1.7 damage, +2 meteors and more radius', m: { dmg: 1.7, count: 2, radius: 1.2 } },
    turret:     { t: '×1.8 damage, +1 at a time and shoots faster', m: { dmg: 1.8, count: 1, rate: 0.8 } },
    dash:       { t: '×1.9 damage, more distance and less cooldown', m: { dmg: 1.9, radius: 1.25, cd: 0.8 } },
    trail:      { t: '×1.8 damage, bigger and longer-lasting puddles', m: { dmg: 1.8, radius: 1.25, dur: 1.3 } },
    cone:       { t: '×1.7 damage, +4 shots and +1 pierce', m: { dmg: 1.7, count: 4, pierce: 1 } }
  };

  /** Can it go to Smithing yet? → { name, needs, needName, text, ready } or null */
  function evoInfo(m, statsTaken) {
    const e = EVO[m.id];
    if (!e || m.evolved || m.lvl < m.def.maxLvl || !EVO_MODS[m.kind]) return null;
    const [name, needs] = e;
    return { name, needs, needName: NEED_NAME[needs], text: EVO_MODS[m.kind].t,
             ready: !!(statsTaken && statsTaken[needs]) };
  }

  /** Smithing: upgrades an instance (new name and power; same element). */
  function evolve(m) {
    const e = EVO[m.id];
    if (!e || m.evolved) return false;
    applyMods(m, EVO_MODS[m.kind].m);
    m.baseName = m.name;
    m.name = e[0];
    m.evolved = true;
    return true;
  }

  G.Moves = { ALL: RAW, BY_ID, POOL, poolFor, instance, levelUp, nextUpText, startFor,
              EVO, NEED_NAME, evoInfo, evolve };
})();
