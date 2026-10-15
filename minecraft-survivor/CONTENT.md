# Minecraft Survivor — content bible

Minecraft Survivor is PokéSurvivor's engine with every Pokémon concept replaced by Minecraft. **Gameplay numbers stay identical**: only names, text, art, icons and music change. Private, offline, English only.

Internal ids stay PokéSurvivor's: move ids (`ember`, `tackle`…), item ids (`leftovers`…), type ids (`fire`…), `G.DEX`, `dex`, save fields. Never rename an id. Only change what the player sees.

## Where things live

| What | Where |
|---|---|
| Mobdex (202 mobs: 94 base + 108 variants) | `tools/mc/roster.mjs`, which generates `js/data/mobdex.js` and `js/data/sprites-meta.js` (`node tools/mc/gen-data.mjs`) |
| Mob sprites | `assets/mobs/{key}/{Anim}.png`; Enchanted (shiny) copies in `assets/mobs/{key}/s/` |
| Minecraft textures (16×16) | `assets/mc/blocks/*.png`, `assets/mc/items/*.png`, `assets/mc/particle/*.png`, `assets/mc/environment/*.png`. Some files are vertical animation strips (16×16·N, e.g. `blocks/water_still.png`, `blocks/lava_still.png`, `blocks/portal.png`, `items/compass_item.png`, `items/clock_item.png`): use frame 0 unless you animate. Grass, leaves and water textures are **grey and need tinting** (`grass_top` ≈ #79c05a plains, `leaves_*` ≈ #59ae30, water ≈ #3f76e4). |
| Source of every texture | `../vendor/bedrock-samples/resource_pack/textures/` (`npm run mc:vendor`; armour textures in `textures/models/armor/`) |

Load images same-origin, from relative paths `assets/mc/...` (CSP blocks everything else). Canvas drawing is synchronous, so preload images and fall back to the existing procedural art until each is loaded. Keep pixel art crisp: integer scales, `imageSmoothingEnabled = false`.

## Vocabulary (player-facing)

| PokéSurvivor | Minecraft Survivor |
|---|---|
| PokéSurvivor / Mystery Dungeon (logo `.t1` / `.t2`) | **Minecraft Survivor** / **Survive the Night** |
| Pokémon (a creature) | **mob** (plural **mobs**) |
| Pokédex / collection | **Mobdex** |
| partner | partner |
| PokéCoins (Pokémonedas) | **Emeralds** (icon `items/emerald`) |
| ticket ×1 / ticket ×10 | **Trial Key** (`items/trial_key`) / **Ominous Key** (`items/ominous_trial_key`) |
| shiny | **Enchanted** (the sprite has an enchantment glint). "¡Shiny!" becomes "Enchanted!" |
| gacha | **Spawner** (menu: "Spawner — 7 realms · mobs and enchanted mobs"); the slot machine is a **Mob Spawner** |
| gacha banner (region) | **realm**: Overworld, Nightfall, Ocean, Village, Caves, Nether, The End (`G.Gacha.BANNERS`, already done) |
| move | **skill** (swords, bows, potions, spells…) |
| type | **element**: Overworld, Fire, Aquatic, Nature, Redstone, Frost, Brute, Poison, Earth, Wind, Ender, Arthropod, Stone, Undead, Dragon, Shadow, Iron, Magic (`G.U.TYPE_NAME`, already done) |
| bond (fusing moves after a legendary) | **Combo** ("Combo! Linked skills fire together and take one slot") |
| move evolution | **Smithing** (golden card "Smithing: Netherite Sword", like Minecraft's netherite upgrade). "Enchant" only means the Enchanting Table (see *Enchanting*) |
| rift + legendary | a **Trial Chamber** opens; inside, an **elite mob** of the current floor (see *The eight floors*) |
| boss slots (random strong mobs) | each floor's **mid-boss** and **floor boss** (Ravager, the three Elder Guardians, Breeze, Wither, Ender Dragon, Warden); see *The eight floors* |
| minute-30 Judgment of Arceus | **Herobrine Awakens** on the last floor, Herobrine's World (dex 45 `herobrine`, invincible chaser; the growing boss queue = the other legendaries). Survive 2:30 and a glowstone portal opens to **the Aether** |
| wild horde event | **Mob Siege** ("A siege of Undead mobs!") |
| gold hour | **Emerald Rush** |
| lost Pokémon escort | **Lost Pet** (escort a lost mob home) |
| Meowth thief (coins) / Gholdengo (t10) | **Fox** steals emeralds (dex 15) / **Piglin** carries the Ominous Key (dex 113). Already wired in `events.js`. |
| Sitrus Berry heal card | **Golden Apple** |
| healer / shielder / summoner / bomber | keep the behaviours. Text: "heals nearby mobs", "shields its allies", "calls its pack", "explodes" |

Rarity: 1 Common, 2 Uncommon, 3 Rare, 4 Epic, 5 Legendary (done). Rarity icons, replacing the Poké Balls: 1 `items/coal`, 2 `items/iron_ingot`, 3 `items/gold_ingot`, 4 `items/diamond`, 5 `items/nether_star`.

## The Spawner: packs, Legendaries and odds (`systems/gacha.js`, `ui/gacha-ui.js`)

One pack per realm (`gen` in `tools/mc/roster.mjs`). Odds per spawn: Common 45%, Uncommon 30%, Rare 17%, Epic 6.5%, Legendary 1.5%; a ×10 holds an Epic or better; 70 spawns without a Legendary in a realm make the next one Legendary. Inside a rarity each mob weighs its **pull weight** `pw` (default 1; every pick is weighted: normal spawns, the pity and the Enchanted-duplicate fallback). The pack art shows its 3 strongest Legendaries (a rare lure always among them); the odds panel lists every Legendary of the pack with its chance per spawn (from the listed rates; the pity only raises them).

| Pack | 1★ | 2★ | 3★ | 4★ | 5★ (Legendaries) |
|---|---|---|---|---|---|
| Overworld | 13 | 33 | 28 | 6 | 6: **Herobrine** (`pw` 0.2), Chicken Jockey, Jellie, Toast, Netherite Steve, Netherite Alex |
| Nightfall | 4 | 6 | 5 | 5 | 4: Giant, Spider Jockey, Netherite Zombie, Netherite Skeleton |
| Ocean | 4 | 4 | 4 | 1 (Diamond Drowned) | 2: Elder Guardian, Netherite Drowned |
| Village | 1 | 12 | 10 | 5 | 1: Mending Librarian |
| Caves | 2 | 4 | 3 | 1 | 2: Warden, Blue Axolotl |
| Nether | 1 (Strider) | 3 | 6 | 3 | 2: Wither, Netherite Piglin |
| The End | 1 | **0** | 17 (+Phantom, moved from Nightfall) | 2 | 1: Ender Dragon (its Uncommons fall back to the nearest tier) |

- **Herobrine** is in the Overworld pack and extremely rare: 0.2 against 5 other Legendaries, 1 in 26 Legendaries, about **0.06% per spawn (1 in 1,700)** at the listed odds (about 1 in 900 counting the pity and the ×10 guarantee). The pack names his odds in red ("Herobrine lurks in this Spawner: …"). He stays the final floor's hunter; only his pack moved.
- Adding a mob to a pack is a roster line (`BASE`, `VARIANTS` or `ARMOURED` in `tools/mc/roster.mjs`), then `render-mobs.mjs <key>` and `gen-data.mjs`.

## The Aether (`data/dimensions.js` `aether`, `systems/aether.js`; after the Aether mod, The Aether I)

The ending, not a floor (goal `paradise`; "WELCOME TO THE AETHER / You survived Herobrine." instead of "Floor 9 of 9"). Sky islands of Aether Grass and Holystone over an open sky, Aerclouds, Quicksoil and Skyroot (world worker: `world/world.js`, `world/tiles.js`).

- **Peaceful** (`peaceful: true`): `Player.hurt` returns at once (nothing hurts you, from any source); no hostile spawns, waves, swarms, events, Trial Chambers, bosses or weather; your weapons rest (`G.Combat.tick` skips). **Sunny** (`sunny: true`): no day/night ("NOON ∞" by the clock).
- **Friendly mobs only**: the Aether mod's passive mobs, from the biome lists (Aether Meadow, Skyroot Forest, Golden Grove, Cloud Sea, Rainbow Falls). They are critters of `systems/aether.js`, not enemies (nothing targets or hits them), ~12 around you plus 2 Aerwhales. Walk within ~90 px and they stop, look at you and show Minecraft's love-mode hearts. Each does its mod trick now and then: the **Sheepuff puffs** (its wool swells into a cloud ball, the `sheepuff_puff` sprite, it rises and floats slowly down), **Phygs** and **Flying Cows** glide on flapping wings, **Aerbunnies** bound and drift down, **Moas** sprint, **Aerwhales** drift high over the open sky (`G.World.isOpenSky` when present; drawn above everything with a faint shadow far below).
- **Tiles**: **Quicksoil** ×1.5 speed (golden dust at your feet), **Blue Aercloud** bounces you (a 0.6 s hop and a cloud puff), from the world's tile effect (`G.World.tileEffect`, `'quicksoil'` / `'bounce'`). Critters use them too.
- **Atmosphere**: the world's sky overlay (`G.World.drawSkyOverlay`, called from `game.js` like the sea's: a warm sun glow, soft god rays, drifting sparkles), and over it (`G.Aether.drawScreen`, screen space) a warm bright grade, a faint rainbow arc, white-gold edges instead of a dark vignette and a few slow drifting hearts.
- **Music** `aether`: Sweden, Wet Hands, Subwoofer Lullaby (×2 each), Living Mice, Haggstrom, Clark, Mice on Venus, Aria Math, Moog City 2, Floating Dream, Featherfall, Komorebi. The ending and the victory: **Alpha**.
- **Arrival rewards** (every time): **1,000 emeralds**, **3 Ominous Keys**, one **Enchanted Book at its maximum level** (`G.Enchanting.rollBook` then the enchantment's `max`), `save.ascended[partner]` (a golden **halo** over it in the Mobdex, "Ascended"), `stats.aether++`. The first time, every Aether mob joins your Mobdex (`from: 'aether'`) with a toast.
- **The ending**: after 45 s (or the **Rest** button / <kbd>R</kbd>, from 10 s) the screen softly brightens to warm white and original lines scroll up in two voices (gold and sky blue), then **YOU REACHED THE AETHER** / "Paradise above the clouds. The climb is over." After the automatic ending you choose **Keep wandering** (no time limit; Rest ends the run whenever you like) or **Rest**. Resting shows the run summary as a **victory**: gold title and frame, "The Aether · the end of the climb", the Aether's gifts, the Ascended partner and the mobs befriended.
- **Achievements**: **Hostile Paradise** (the mod's: "Ascend to the Aether through a glowstone portal"), **Halo** (with 5 different characters), **Seventh Heaven** (7 times), **When Phygs Fly!** (the mod's name: stay by a Phyg for 3 s until the hearts come).
- **Debug**: `G.Floors.debugWinHerobrine()` (the clock runs out: the portal builds), `G.Floors.debugHeroClock(t)`, `G.Floors.aether` (`{ left, building, ready, x, y }`), `G.Aether.debugEnding()`, `G.Aether.debugSkipText()`, `G.Aether.debugPuff()`, `G.Aether.critters`, `G.Aether.rewards`.

### The Aether's mobs (ids 330-337, `gen: 8`, `passive`)

No Spawner banner uses gen 8: reaching the Aether befriends them all. The Mobdex has an **Aether** tab ("Reach the Aether to befriend it"). No Mojang models exist, so `tools/mc/aether-art.mjs` writes their Bedrock geometry (`tools/mc/aether/aether.geo.json`) and paints their textures (`aether:` textures in the roster); `render-mobs.mjs` renders them like any other mob. Re-run: `node tools/mc/aether-art.mjs && node tools/mc/render-mobs.mjs sheepuff phyg flying_cow aerbunny moa moa_white moa_black aerwhale sheepuff_puff && node tools/mc/gen-data.mjs`.

| id | Mob | Look | Rarity |
|---|---|---|---|
| 330 | **Sheepuff** | Mojang's sheared sheep under a fitted cloud of white-and-blue-grey Aether wool, a cream face; skin `sheepuff_puff` = puffed up (fatter wool, floats) | 3 |
| 331 | **Phyg** | Mojang's pig with two white feathered wings (swept back, scalloped tips) that flap | 3 |
| 332 | **Flying Cow** | Mojang's cow with bigger feathered wings | 3 |
| 333 | **Aerbunny** | a small round white puff of fur, pink ears and nose, hops | 3 |
| 334 | **Moa** (Blue) | a tall flightless bird: long legs and neck, gold beak, folded wings, tail | 4 |
| 336 | **White Moa** (variant) | white plumage, stronger | 4 |
| 337 | **Black Moa** (variant) | black plumage, the strongest | 5 |
| 335 | **Aerwhale** | a big blue-and-white sky whale (rounded back, white belly, fins and flukes), hovers | 5 |

## New Legendaries (ids 309-311)

- **Chicken Jockey** (309, Overworld, Overworld/Undead): Bedrock's baby zombie (`geometry.zombie.baby`, `zombie_baby`) seated on a chicken (roster `ride`). Fast melee chaser.
- **Spider Jockey** (310, Nightfall, Arthropod/Undead): a skeleton with its bow seated on a spider; shoots arrows (`ranged`, `bowArrow`), fast.
- **Mending Librarian** (311, Village, a villager variant: counts toward the villager species): the librarian with folded arms (Mojang's villager arm pose) holding an Enchanted Book with a glint. Healer. Legendary stats (the other variants keep their base's).

## Armoured mobs (`ARMOUR` / `ARMOURED` in `tools/mc/roster.mjs`, ids 312-329)

Mojang's armour on humanoids: the player armour layers (`textures/models/armor/{tier}_1` helmet, chestplate, boots; `_2` leggings), fitted to each mob's own bones (`armorLayers` in `tools/mc/geo.mjs`), with a weapon of the tier. Variants of their base (`v`), so they count toward its species. Names: "Iron Zombie", "Diamond Skeleton", "Netherite Steve"…

| Tier | Rarity | Health | Damage | Extra |
|---|---|---|---|---|
| Iron | Rare | ×1.2 | ×1.1 | |
| Diamond | Epic | ×1.45 | ×1.2 | |
| Netherite | Legendary | ×1.75 | ×1.3 | knockback immune; enchantment glint on the armour and weapon |

Speed unchanged; `bst` ×(health + damage)/2. Weapons: the tier's sword (melee), a bow for skeletons, a trident for drowned.

| Pack | Mobs (×3 tiers) |
|---|---|
| Overworld | Steve, Alex |
| Nightfall | Zombie, Skeleton |
| Ocean | Drowned |
| Nether | Piglin (the helmet clears its wide head; the snout shows through the visor, the ears tuck in) |

## Level-up stat cards and Smithing conditions (shared names)

`LevelUp.STATS` titles **must equal** `Moves.NEED_NAME`:

| id | title | icon (texture) |
|---|---|---|
| hp | Health Boost | `items/apple` → heart icon is fine |
| atk | Strength | `items/potion_bottle_damageBoost` |
| spd | Speed | `items/potion_bottle_moveSpeed` |
| cd | Haste | `items/gold_pickaxe` |
| def | Resistance | `items/iron_chestplate` |
| rgn | Regeneration | `items/potion_bottle_regeneration` |
| mag | Magnetism | `items/compass_item` (frame 0) |
| xp | Wisdom | `items/experience_bottle` |
| heal | Golden Apple | `items/apple_golden` |

## Permanent upgrades (`data/upgrades.js`, same ids and numbers)

hp **Health Boost** · atk **Sharpness** · spd **Swift Sneak**, shown as "Speed" · cd **Efficiency** · def **Protection** · regen **Regeneration** · magnet **Looting Reach** · xp **Wisdom** · coins **Fortune** ("+8% emeralds") · moves **Hotbar** ("Start with 2 skills") · crit **Critical Hit** · reroll **Reroll** · ban **Blacklist** ("Block 1 skill from the level-up cards")

## Held items (`data/items.js`, same ids and effects)

| id | name | icon |
|---|---|---|
| leftovers | Potion of Regeneration | `items/potion_bottle_regeneration` |
| choiceband | Mace | `items/mace` |
| quickclaw | Redstone Repeater | `items/repeater` |
| focussash | Totem of Undying | `items/totem` |
| shellbell | Glistering Melon | `items/melon_speckled` |
| amuletcoin | Rabbit's Foot | `items/rabbit_foot` |
| luckyegg | Bottle o' Enchanting | `items/experience_bottle` |
| lifeorb | Ominous Bottle | `items/ominous_bottle` |
| choicescarf | Potion of Swiftness | `items/potion_bottle_moveSpeed` |
| rockyhelmet | Turtle Shell | `items/turtle_helmet` |
| assaultvest | Netherite Chestplate | `items/netherite_chestplate` |

## Pickups

| Pickup | Becomes |
|---|---|
| xp gem | green Minecraft **experience orb**: procedural, lime `#7ffc3f`/`#d8ff5a` core, darker rim |
| coin | `items/emerald` |
| heal | `items/apple_golden` |
| magnet | `items/compass_item` (frame 0) |
| bomb | TNT (`blocks/tnt_side`) |
| ticket / ticket10 | the two keys |
| item | its item icon |

## Enchanting (`data/enchantments.js`, `systems/enchanting.js`, `ui/enchant-ui.js`; design in `ENCHANTING.md`)

A prestige system **outside runs**: real Minecraft enchantments on each character's weapons, from Enchanted Books that bosses drop. New gameplay (not from PokéSurvivor).

- **Weapons = skills.** A character's weapons are its skill pool (`G.Enchanting.weapons(dex)`: its signature, starting skill first). Each **character + skill** pair has **3 slots**. Steve's Iron Sword and Alex's Iron Sword are different weapons.
- **Unlock:** kill the **Ender Dragon** with that partner (`save.slayer[dex]`; in co-op, every player's own partner). Banner "ENCHANTING UNLOCKED FOR STEVE!" and the Knowledge Unlocked achievement. Variants are their own characters.
- **Weapon types** (`G.Enchanting.weaponType`): by kind (melee → Sword; projectile, cone, boomerang, chain → Bow; dash → Trident; meteor → Mace; beam, nova, aura, orbit, mine, trail, turret → Staff; buff → Armour). Overrides: Trident (`water-gun`), Spear Lunge and Elytra Dash are Tridents, Mace Smash is a Mace.
- **Enchantments** (30, Minecraft's max levels): Sword: Sharpness, Smite, Bane of Arthropods, Fire Aspect, Knockback, Looting, Sweeping Edge. Bow: Power, Punch, Flame, Infinity, Multishot, Piercing, Quick Charge. Trident: Impaling, Loyalty, Riptide, Channeling. Mace: Density, Breach, Wind Burst (+ Smite, Bane). Staff: Efficiency, Fortune, Frost Walker (+ Fire Aspect, Looting). Armour: Protection, Thorns, Swift Sneak, Feather Falling. Any: Unbreaking, Mending. Exclusive: Sharpness/Smite/Bane · Multishot/Piercing · Loyalty/Riptide · Riptide/Channeling · Density/Breach · Infinity/Mending. Numbers per level in `ENCHANTING.md` §3.
- **Element words:** Smite = Undead (`ghost`), Bane of Arthropods = Arthropod (`bug`), Impaling = Aquatic (`water`).
- **Costs:** apply 120 × level² emeralds; anvil (two equal books → next level) 80 × (new level)²; grindstone refund 30 × level² per enchantment (the books are lost).
- **Books** (`save.books[id][lvl-1]`, the account-wide **Library**): an **Enchanted Book** pickup (`book`, `items/book_enchanted` with a purple glint), banked to the save the moment you pick it up, with the toast "Enchanted Book: Sharpness III!". Books still on the ground at the end of a run are banked too; the run summary lists them. Drops: floor boss 100% (each Elder Guardian 35%), mid-boss 30%, Trial Chamber elite 40%, Pillager Captain 10% (level I), each Herobrine-mode boss mob 25% (IV–V). Levels by floor: Overworld I, Ocean I–II, Underworld II, Nether II–III, Stronghold II–III, End III–IV, Ancient City IV–V.
- **In a run:** learning a skill applies that character's enchantments to it (`Player.addMove` → `G.Enchanting.applyTo`). Enchanted skills have a purple frame and glint on their hotbar slot, and their level-up cards list the enchantments.
- **Mastered:** the signature weapon has 3 enchantments, all at max level (gold frame in the Mobdex and menu; unlocked characters get a purple one). The Mobdex counts "Mastered n / N" by species (variants count toward their base species).
- **Screen** (menu "Enchanting · Enchant your weapons · books from bosses", between Upgrades and Spawner): **Table** (characters; weapons with their 3 slots; the Library's books that fit, with costs) · **Anvil** · **Grindstone** (two-step confirm) · **Library** (every enchantment, its levels and the books you hold).
- **Achievements** (category Enchanting): Knowledge Unlocked, First Enchantment, Anvil Apprentice (10 combines), Master Enchanter (1), Enchanting Guild (5), Legendary Arsenal (all 16 starters), **Max Enchant Everyone** (every playable species).
- **No confusion with Smithing:** the in-run golden card is **Smithing**; its names no longer reuse enchantment names (Heavy Smash, Prismarine Trident, Bramble Lash, Thunderstorm, Gale Blast, Hunter's Bow, Grand Spellbook), and the Magic aura skill once called "Enchanted Book" is now the **Spellbook**. Achievements: First Smithing, Arcane Smith, Master Smith (Smithing); Glint Collector (5 Enchanted mobs, was "Enchanter").
- Save: `slayer`, `books`, `ench` (`{ dex: { skillId: [[enchId, lvl], …] } }`), `stats.enchants / anvil / books`; migrated with defaults (`G.Enchanting.sanitize`, called from `G.DB.migrate`).

## Weather (`systems/weather.js`, same ids and multipliers)

- sun → **Heatwave** (Fire boosted, Aquatic weakened)
- rain → **Rain** (Aquatic and Redstone boosted, Fire weakened)
- sand → **Sandstorm** (Stone, Earth and Iron boosted; the rest suffer)
- snow → **Blizzard** (Frost boosted; the rest suffer and slow down)
- fog → **Eerie Fog** (Undead, Magic and Ender boosted)

## The eight floors (`data/dimensions.js`, `systems/floors.js`, `systems/endfight.js`)

A run climbs eight floors, in order, and those who outlast Herobrine reach **the Aether**, the ending (see *The Aether* below). Each floor is a map of biome regions you walk between (`world/world.js` lays them out; `G.BIOME_DEFS` lists them). Entering a new biome shows a small "— Desert —" banner; arriving on a floor shows its title and "Floor n of 8" (`G.Floors.floors`: every dimension except the Aether, goal `paradise`). Clearing a floor's **goal** opens its **exit**.

| # | Floor | Goal | How it is cleared | Exit |
|---|---|---|---|---|
| 1 | **The Overworld** | boss | mid-boss at 3:00 (Iron Golem or Evoker); at 6:00 **THE RAID BEGINS**: the **Ravager** arrives with 3 pillagers, 2 vindicators and an evoker, and the village bell rings | **Ocean Dive** (`dive`) |
| 2 | **The Ocean** (underwater) | elders | mid-boss at 2:30: the **Drowned Captain** with 3 drowned and a zombie nautilus. Three **Elder Guardians** sleep in the **Ocean Monument** (`G.World.monument`); they wake when you come within 420 px of it (or hit one), or at 5:30: **THE ELDER GUARDIANS AWAKEN**. All three down opens the exit where the last one fell. See *The Ocean* | **Cave Entrance** |
| 3 | **The Underworld** (caves) | boss | mid-boss at 2:30 (Giant or Creaking); at 5:00 **THE OMINOUS TRIAL**: an **Ominous Breeze** (teal omen aura and boss bar; 5 wind charges per volley, gust rings, ominous item drops, deflects 30% of hits, recovers faster) | **Nether Portal** |
| 4 | **The Nether** | boss | mid-boss at 3:00 (Piglin Brute, Ghast or Hoglin); at 6:00 **THE WITHER RISES** | **Stronghold Gate** |
| 5 | **The Stronghold** | portal | mid-boss at 2:00 (Iron Golem or Evoker). At 1:00 an **Eye of Ender** arrow points to the **End Portal room** (`G.World.portalRoom`). Stand in it for **20 s** (leaving pauses the bar) while silverfish burst out of the walls every 3.5 s (3 to 7 per wave); then the End Portal activates | **End Portal** |
| 6 | **The End** | crystals | **End Crystals** stand on the obsidian towers (`G.World.towers`). The **Ender Dragon** arrives 20 s after you and is **invulnerable** while any crystal stands ("INVULNERABLE · Destroy the End Crystals (n left)" on its bar, a shield shimmer); each crystal's beam heals it 1.5% max health/s. A crystal has about 1.6 s of your single-target damage; breaking it explodes (25% of your max health if you stand within 120 px). An arrow points to the nearest crystal | **End Gateway** |
| 7 | **The Ancient City** | shriek | sculk shriekers raise the **warning level** (four shrieker icons and WARNING on the HUD) every 40 s and when you break sculk (at most every 8 s). Each shriek: Darkness for 6 s, a screen shake, "Warning level n!". At 4: **THE WARDEN EMERGES**, digging up next to you | **Ancient Portal** (at `G.World.ancientFrame`) |
| 8 | **Herobrine's World** | herobrine | the Overworld in an endless night. "HEROBRINE AWAKENS", then his cinematic and the hunt (`systems/judgment.js`). **Survive 2:30** (`surviveFor` 150 s from your arrival; the cinematic doesn't count): the HUD counts "SURVIVE 1:47 · THE AETHER AWAITS". Then a glowstone **Aether Portal** builds itself ~7 tiles from you, away from Herobrine (`G.World.buildAetherPortal`, block by block over 2.5 s; it can't be entered until it's `ready`), "A GLOWSTONE PORTAL OPENS" and a warm chime, and the HUD reads "THE AETHER PORTAL IS OPEN · n m" with an arrow. He keeps hunting until you step in: a white-gold flash, he roars and fades, his boss mobs vanish | **Aether Portal** (`aether`) |

- **Spawning** (`data/enemies.js`, `systems/spawner.js`): every mob comes from the biome where it spawns (`BIOME_DEFS[key].mobs`, or `day` / `night` on the surface, padded with the floor's `common` list when a biome has fewer than 8). Strength still follows the run clock. Never spawned as normal mobs: legendaries, floor bosses (the Elder Guardian included), Steve/Alex, variants. Exceptions, as rare versions of a normal spawn (`G.Spawner.dress`):
  - **Armoured**: each zombie, skeleton, drowned or piglin spawn is iron 5%, diamond 1.5% or netherite 0.3% (×1.15 more per floor down: ×2 on Herobrine's World), with the tier's health and damage over the mob it replaced and its armoured sprite (a piglin with a sword fights in melee). Bonus emeralds when killed: iron 2, diamond 5, netherite 12; netherite also drops an Enchanted Book 5% of the time (the floor's levels).
  - **Jockeys**: a Chicken Jockey replaces 1% of zombie spawns at night (Overworld surface); a Spider Jockey 2% of spider spawns at night or in dark biomes (Dark Forest, caves). They use their own Mobdex stats for the tier.
  - Their sprites preload with the casts around you. On an underwater floor mobs also spawn in open water.
- **Bosses** run on a clock that starts when you arrive (it waits inside Trial Chambers); an empty `midBoss` list means no mid-boss. Boss health and damage follow the old boss curve at the current run time; floor bosses have ×1.5 health and drop an **Ominous Key**. A timed floor boss waits up to a minute for a live mid-boss to fall.
- **Portals**: an edge arrow points at an open portal; a new portal takes 1.2 s to light before it accepts anyone. Stepping in banks the pickups on the ground, clears the map and starts the next floor at its origin.
- **End Crystals** are `G.Enemy` objects that never move or attack (`systems/endfight.js`), so skills target them. They never count as kills, for missions or anything else.
- **Trial Chambers** (the old rifts, `systems/rift.js`): same timings, arenas and rewards. The elite comes from the current floor's `trial` list (never that floor's own boss, a great floor boss or Herobrine). An empty list means no Trial Chambers; Herobrine's World has none.
- **Weather** follows the biome under you (`BIOME_DEFS[key].weather` weights).
- **Achievements**: one per floor reached (Into the Deep, Into the Depths, Enter the Nether, Into the Stronghold, Enter the End, Deeper and Darker, Herobrine Awakens), one per floor cleared (The Raid, Monument Raider, Ominous Trial, Free the End, Silence the Deep), Floor Sweeper (5 floor bosses; the Ocean counts once), Staring Contest / Still Standing (1 and 5 minutes against Herobrine), one "Defeat the …" per great boss, and the Trial Chamber ones.
- **Music**: the biome key under you, `boss` while a boss lives (sleeping Elder Guardians don't count), `trial` in a Trial Chamber, `herobrine` on the last floor, `aether` in the Aether (`aether_end`, C418's "Alpha", for its ending and the victory summary).
- **Herobrine's boss mobs** (`systems/judgment.js`): one every **10 s**, each **×1.25** the health and **×1.15** the damage of the one before, at most **4** hunting at once (the next waits for one to fall). The first has ~3 s of your single-target damage. Over a full 2:30 that is ~15 of them; the 15th has ~23× the first's health and ~7× its damage. Herobrine's touch (40% of your health) and his telegraphed lightning, cross beams and shockwave are unchanged. Before: one every 5 s, each double the last, no cap (you always died).
- **Debug** (tests and `tools/mc/shot.mjs`): `G.Game.debugDimension(id)`, `G.Game.debugBoss('mid'|'floor')` (Ancient City: shrieks up to the Warden; the Ocean: wakes the Elder Guardians), `G.Game.debugPortal()` (Stronghold: activates the room), `G.Floors.debugElders()`, `G.Floors.debugRoom(fill)`, `G.Floors.debugWarn()`, `G.EndFight.debugBreakAll()`, `G.Events.debugStart('dolphins'|'guardians'|'sea')`. State: `G.Floors.elders` (`{ n, left, awake, home, list }`), `G.Floors.underwater`, `G.Events.sea`.

## The Ocean (floor 2: `data/dimensions.js` `ocean`, `systems/floors.js`, `systems/events.js`)

You dive in from the Overworld (the **Ocean Dive** portal) and swim through five biomes: **Kelp Forest** (the start), **Coral Reef**, **Ocean Ruins**, **Deep Ocean** and the **Ocean Monument** (the last two are `dark`).

- **Underwater** (`underwater: true`): water slows nobody (deep water is open trench, everyone swims), mobs spawn in open water too, bubbles rise from you as you swim, and the screen gets the sea: a blue-green tint, light rays and rippling caustics from the surface, drifting specks, darker edges (`systems/daynight.js`; dimmer in the dark biomes). No day/night cycle, no weather. `G.World.drawWaterOverlay(ctx, cam)`, when the world has it, draws in world space under that tint.
- **Mobs:** cod, salmon, squid, glow squid, pufferfish, turtles, dolphins, tropical fish, axolotls, nautiluses, drowned, zombie nautiluses and guardians (lasers), by biome. Trial Chamber elites: Guardian or Zombie Nautilus.
- **Mid-boss, 2:30: the Drowned Captain** (`midName`): a boss drowned with its crew (`midEscort`: 3 drowned and a zombie nautilus). It fights with the drowned boss kit (see *Boss attacks*). Normal drowned keep their plain trident shots.
- **The Elder Guardians:** three, asleep in the monument's wings and penthouse (`G.World.monument.elders`; without a monument, in a ring 640 px around you). Asleep they don't move, attack or count as a boss fight. They wake when you come within 420 px of the monument (or of one of them), when one is hit, or at 5:30 on the floor clock: "THE ELDER GUARDIANS AWAKEN", the boss music and their kit (tracking laser, Mining Fatigue, thorn spikes). Each has **60%** of a floor boss's health at the moment they wake. The HUD shows **ELDER GUARDIANS: n/3 LEFT** (top right) and an arrow to the monument while they sleep, then to the nearest one. The last to fall is the floor boss: Ominous Key, "THE MONUMENT IS SILENT" and the **Cave Entrance** down to the Underworld.
- **Sea battles** (every ~2 minutes, 1:30-2:00 for the first, alternating, never with a boss fighting):
  - **A DOLPHIN POD!** 4-6 friendly dolphins swim up and circle you for 24 s. Swimming within 90 px of one gives **Dolphin's Grace** for 8 s (×1.35 speed, shown under your hearts).
  - **GUARDIAN PATROL**: 3-5 guardians arrive together from one side. Beat them all for 8 emeralds.
- **Achievements:** Into the Deep (reach the Ocean), Monument Raider (all three Elder Guardians). Daily mission: Reach the Ocean.
- **Music:** the water tracks (Axolotl, Dragon Fish, Shuniji) in every Ocean biome; `boss` while the Elder Guardians or the Drowned Captain fight.

## World (`world/tiles.js`, `world/world.js`)

Trial Chamber arenas, one per element:
- Overworld: **Village**
- Fire: **Nether Fortress**
- Aquatic: **Ocean Monument**
- Nature: **Jungle**
- Redstone: **Redstone Lab**
- Frost: **Frozen Peaks**
- Brute: **Pillager Outpost**
- Poison: **Swamp**
- Earth: **Badlands**
- Wind: **Windswept Hills**
- Ender: **End City**
- Arthropod: **Mineshaft**
- Stone: **Stronghold**
- Undead: **Soul Sand Valley**
- Dragon: **The End**
- Shadow: **Deep Dark**
- Iron: **Trial Chambers**
- Magic: **Cherry Grove**
- Judgment arena: **The Void** (unused: Herobrine now hunts you in Herobrine's World)

Props:
- tree: oak tree (log + leaves)
- crystal: amethyst cluster
- dead tree: crimson fungus
- rock: cobblestone or stone
- grass: short grass or fern
- chest: chest
- big locked chest: ender chest (or vault)
- altar: enchanting table
- spring: water cauldron
- traps: pressure plates (poison, sticky/cobweb, explosive/TNT)
- Trial Chamber entrance (the old rift): currently drawn as an animated portal (`blocks/portal` strip)
- dimension portals: **Nether Portal** (obsidian frame) and **End Portal**

**Breaking blocks** (`Player.mine` in `entities/player.js`):
- **Walk into a rock or chest** (also dripstone, sculk sensors) and you dig at it, like holding left-click: Minecraft's crack stages (`environment/destroy_stage_0..9`) spread over it and it breaks in about 1 s (chest 0.6 s, dripstone 1.2 s; ×1.5 faster while the Pickaxe is your active skill).
- **Click one** within 340 px to make it your target: white corner brackets mark it, your attacks aim at it even with mobs around, and you dig it once you walk up to it.
- Attacks that sweep over blocks still chip them as before.

## Style

The UI is a dark Minecraft GUI:
- **Panels:** dark stone panels with a 1-texel bevel (light top-left, dark bottom-right). An optional stone or deepslate texture can sit underneath at 4× with a dark overlay.
- **Buttons:** grey stone buttons with white text and a dark text shadow. The primary (gold) button becomes Bedrock's green `#3c8527` with a `#1d4d13` bevel.
- **Font:** Pixelify Sans stays.
- **Accent colours:** gold `#ffd23f` stays for rewards and Legendary; emerald `#17dd62` for currency.

## Music (synthesised, `data/music.js` + `core/audio.js`)

Original tracks in the spirit of Minecraft's calm piano ambience. Write new melodies; never copy C418's or Lena Raine's actual tunes.
- Menu (`village`): slow, sparse, soft keys, airy pad.
- Plains (`forest`): gentle and hopeful.
- Caves (`cave`): sparse, low, mysterious.
- Nether (`volcano`): low drones and dissonance.
- `boss`, `rift`, `judgment`: tense. Herobrine's track is the most ominous.
- Game flow asks for: `menu` in menus, the biome key under the player (any `G.BIOME_DEFS` key), `boss` while a mid or floor boss lives, `trial` in a Trial Chamber, `herobrine` during the finale.

## Day and night (`js/systems/daynight.js`)

The Overworld only (the Ocean, the Underworld, the Nether, the Stronghold, the End, the Ancient City and Trial Chambers have no sky; Herobrine's World is an endless night: always dark, the night spawn lists, the moon and "NIGHT ∞"; the Aether is an endless noon, "NOON ∞"). One day lasts 5 minutes of run time:
- day 0:00–2:30
- dusk 2:30–2:55
- night 2:55–4:35
- dawn 4:35–5:00

Runs start in the morning. The Raid (6:00) arrives at night.

- **Spawns:** Overworld surface biomes have a `day` and a `night` list in `js/data/dimensions.js`.
  - Day brings animals, illager patrols and sun-proof monsters (husks, spiders, slimes, drowned in the water).
  - Night brings the classic undead plus each biome's own night mobs: strays in the snow, bogged in the swamp, phantoms everywhere.
  - Caves (`dark: true`) use one list at all hours.
  - Mobs spawn ×1.3 faster at night.
- **Sunrise:** zombies, skeletons, zombie villagers, strays, bogged and phantoms catch fire and die within ~4 s. Drowned in water and anything in caves or the Dark Forest (`shade: true`) is safe.
- **Look:** night darkens the screen except a torch-lit circle around the player, and sunset and sunrise get an orange cast. Cave biomes are dim at any hour. The HUD shows the sun or the moon (the real moon phases, one per night) and "DAY n" / "NIGHT n".

## Dev mode (`js/ui/dev-ui.js`)

Per account: Settings → Account → **Dev mode** (saved as `save.dev`). Or add `?dev` to the address for one session. A red **DEV** button (bottom-left) or the <kbd>`</kbd> key opens the panel.

- **Account:** +10k emeralds, +keys, unlock every mob / every Enchanted mob, max upgrades for the partner, set any mob (bosses too) as partner.
- **Account, enchanting:** unlock enchanting for the partner, master the partner, +books (one of each enchantment, level I), +10 random books.
- **Account, Spawner:** Pull ×10 guaranteed Legendary (in the open realm; opens the Spawner, gives the keys).
- **Run, cheats:** god mode, one-hit kills, no spawns, game speed ×1/×2/×4.
- **Run, you:** +1 / +5 levels, heal, give any skill (the last slot makes room when full), max or max + Smithing all skills, hold any item.
- **Run, time:** +1 / +5 min, set the clock, jump the sky to day/dusk/night/dawn (doesn't move the run clock).
- **Run, floors:** a button per floor (1 Overworld … 8 Herobrine, ✦ Aether), **Herobrine mode** (jump to the last floor), **Win Herobrine's World (open Aether portal)**, **Go to the Aether**, **Play the ending**, **Wake the Elder Guardians** and **Sea battle: dolphins / guardian patrol** (the Ocean), go to the portal room / activate the End portal (Stronghold), **Destroy crystals** (The End), **Warden warning +1** (Ancient City).
- **Run, world:** teleport to any biome of the floor, weather.
- **Run, fights:** mid-boss, floor boss, open portal, Trial Chamber (enter, or spawn its entrance), Mob Siege / Emerald Rush / Lost Pet / Thief, spawn any mob (×1–10, Enchanted, as boss), spawn an armoured mob (iron / diamond / netherite) or a Chicken / Spider Jockey (`G.Spawner.debugSpecial`), kill all, remove all.

## Boss attacks (`js/systems/bosskits.js`)

Each boss fights with its real Minecraft attacks. Every hit is telegraphed on the ground or is a dodgeable projectile, and below half health every boss enrages.

| Boss | Attacks |
|---|---|
| **Warden** (floor, Ancient City) | **Emerges** from the ground next to you · Smash (knockback) · **Sonic Boom** (charges 1.7 s, tracks you, goes through walls and armour) · **Darkness** (your vision pulses for 8 s) · **digs underground** and bursts up under you |
| **Wither** (floor, Nether) | Spawn explosion · black **wither skulls** from its three heads (Wither effect) · slow homing **blue skulls** that explode · below half health: **Wither Armour** (−30% damage), charge, summons Wither Skeletons |
| **Ender Dragon** (floor, The End) | Invulnerable while End Crystals stand · swoops · **dragon fireballs** that leave lingering **Dragon's Breath** clouds · perched breath cone · wing buffet knockback |
| **Elder Guardian** (×3, floor, the Ocean) | Locking **laser** that follows you · **Mining Fatigue** curse (skills recharge 60% slower for 14 s) · thorn spikes |
| **Drowned Captain** (mid, the Ocean: kit `drowned`, bosses only) | **Trident** volleys (3, 5 enraged) · **Channeling**: a telegraphed strike under you, then white lightning (3 strikes enraged) · **Riptide** dash at you (knockback) · calls 2-3 drowned of its crew |
| **Ravager** (floor, Overworld: the Raid) | Bite · ram (huge knockback) · roar shockwave |
| Giant | Slam · quake rings · calls zombies |
| Piglin Brute | Golden-axe cleave · leap · rallies piglins |
| Ghast | Explosive fireballs (a barrage when enraged) · shriek (Slowness) |
| Hoglin | Head-toss (flings you) · charge · stomp |
| Shulker | Homing **bullets that make you levitate** (fall damage when it ends) · closes its shell (−80% damage) · teleports |
| Enderman | **Teleports behind you** to strike · throws blocks · often teleports away instead of taking a hit |
| Evoker | **Fang lines** and fang rings · summons Vexes |
| Iron Golem | Fling (launches you) · ground slam |
| **Breeze** (floor, Underworld: the Ominous Trial) | **Wind charges** (knockback blasts) · hops around · deflects some hits · when ominous: 5-charge volleys, **gust rings**, **ominous item drops** (Slowness), deflects more, recovers faster |
| Creaking | **Freezes while you walk toward it**, creeps up otherwise · heavy swing · pale oak roots (Slowness) |
| Wither Skeleton | Stone-sword slash (Wither) · lunge |
| Blaze | Bursts of three fireballs · fire ring |

Status effects show under your hearts with their time left: Wither (damage over time, no regeneration), Levitation, Mining Fatigue, Darkness, Slowness, and the Ocean's Dolphin's Grace (a buff). Other mobs spawned as bosses (dev panel) use the generic boss AI. Herobrine keeps his own attacks.
