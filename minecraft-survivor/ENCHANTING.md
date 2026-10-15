# Enchanting: design (built 2026-10-14)

A prestige system **outside runs**: enchant each character's weapons with real Minecraft enchantments, from Enchanted Books earned as rare boss drops. Unlocked per character by beating the Ender Dragon with that character. Final goal: max-enchant every character.

## 1. Rules at a glance

- **Weapons = skills.** Every skill a character can learn (its `G.Moves.poolFor` pool) is a weapon that character can enchant. The enchantments belong to that **character + skill** pair: Steve's Iron Sword and Alex's Iron Sword are different weapons.
- **3 enchantment slots per weapon.** Each slot holds one enchantment at a level.
- **Unlock = prestige.** Enchanting a character needs that character to have **killed the Ender Dragon** (saved as `save.slayer[dex]`). Locked characters show "Defeat the Ender Dragon with this character to unlock enchanting". Unlocking gives the character an enchantment-glint frame in the Mobdex and menu.
- **Books** are collected into an account-wide **Library**, even before any character is unlocked, so you're ready when you unlock one. A book is `{enchantment, level}`.
- **In a run,** when you learn a skill that this character has enchanted, the enchantments apply to it right away. Enchanted skills show a purple glint in the HUD and on level-up cards.

## 2. Weapon types → which enchantments fit (like Minecraft's item restrictions)

| Type | Skills | Enchantments |
|---|---|---|
| **Sword / Axe / Tool** | melee skills (Iron Sword, Iron Axe, Iron Pickaxe, Vine Lash, Spider Bite, Evoker Fangs, Zombie Grasp, Wind Charge) | Sharpness · Smite · Bane of Arthropods (one of the three) · Fire Aspect · Knockback · Looting · Sweeping Edge |
| **Bow / Crossbow** | projectile, cone, boomerang, chain skills (Bow, Poison Arrow, Fire Charge, Wither Skull…) | Power · Punch · Flame · Infinity · Multishot or Piercing (not both) · Quick Charge |
| **Trident** | Trident, Spear Lunge, Elytra Dash | Impaling · Loyalty or Riptide (not both) · Channeling (not with Riptide) |
| **Mace** | Mace Smash, Anvil Drop, Dripstone Rain, Snowball Rain | Density or Breach (not both) · Wind Burst · Smite · Bane of Arthropods |
| **Staff (magic)** | beam, nova, aura, orbit, mine, trail, turret skills | Efficiency · Fortune · Frost Walker · Fire Aspect · Looting |
| **Armour (potions)** | buff skills (Strength/Swiftness/Resistance Potion, Conduit Power, Dragon's Might) | Protection · Thorns · Swift Sneak · Feather Falling |
| **Any** | all | Unbreaking · Mending (not with Infinity) |

## 3. Effects (real max levels; numbers per level)

| Enchantment | Max | Effect in game |
|---|---|---|
| Sharpness | V | +8% damage |
| Smite | V | +20% damage to Undead mobs |
| Bane of Arthropods | V | +20% damage to Arthropods, and slows them |
| Impaling | V | +20% damage to Aquatic mobs |
| Power | V | +8% damage |
| Density | V | +8% damage, +6% impact radius |
| Breach | IV | 25% of the damage ignores shields (shielders, Shulker shell, Wither armour) |
| Fire Aspect / Flame | II / I | sets targets on fire (+1 burn stack per level) |
| Knockback / Punch | II | +45 knockback |
| Wind Burst | III | hits release a knockback gust (radius 40 + 20 per level; at most every 0.3 s; bosses aren't pushed) |
| Sweeping Edge | III | +12% arc and reach |
| Multishot | I | +2 projectiles, spread out (boomerangs +2, fans +2 shots) |
| Piercing | IV | +1 pierce (chains: +1 jump) |
| Quick Charge / Efficiency | III / V | −6% / −5% cooldown |
| Infinity | I | −15% cooldown |
| Loyalty | III | thrown weapons fly 15% faster and get +1 pierce (rehit); dashes recover 5% faster |
| Riptide | III | dashes go 15% further, and you're immune during the dash (0.55 s instead of 0.3 s); the Trident throw flies 15% further |
| Channeling | I | 15% of hits strike lightning (60% of the hit) that chains to 2 more mobs |
| Frost Walker | II | hits slow by 15% |
| Looting | III | kills have a +10% chance to drop an emerald |
| Fortune | III | +8% emeralds at the end of the run |
| Protection | IV | −4% damage taken while the weapon is the active skill (at most −60% from all of them) |
| Thorns | III | 15% of contact damage is reflected (while active) |
| Swift Sneak | III | +4% move speed while the potion is active |
| Feather Falling | IV | −15% fall/knock damage (Levitation fall, Iron Golem fling…) |
| Unbreaking | III | +10% duration of skills that have one (mines, sentries, trails, potions); +5% damage on the rest |
| Mending | I | heals 1% of damage dealt (capped at 4 HP/s) |

## 4. Where books come from (rare boss drops)

Books drop as an **Enchanted Book** pickup. They're banked to the account immediately, like keys, so dying doesn't lose them.

| Source | Chance | Level |
|---|---|---|
| Floor boss (Raid Ravager, 3 Elder Guardians, Ominous Breeze, Wither, Ender Dragon, Warden) | **100%** (each Elder Guardian 35%) | depends on the floor: Overworld I, Ocean I–II, Underworld II, Nether II–III, Stronghold II–III, End III–IV, Ancient City IV–V |
| Mid-boss | 30% | same table as its floor |
| Trial Chamber boss | 40% | same table |
| Pillager Captain | 10% | I |
| Herobrine mode: each legendary in the queue | 25% | IV–V |

The enchantment is random among those that exist, weighted: common ones (Sharpness, Power, Protection, Unbreaking) about 8% each, rare ones (Mending, Channeling, Multishot, Infinity) about 5% together (1.2% each), the rest about 2.9% each. The level is capped at the enchantment's max.

## 5. Enchanting Table (new menu item, between Upgrades and Spawner)

- **Table:** pick a character (your partner by default) and one of its weapons. Its 3 slots, its type and the compatible books from your library are shown. Apply a book for an **emerald cost** (`120 × level²`, like Minecraft's level costs). Putting a higher level of an enchantment the weapon already has upgrades that slot.
- **Anvil:** two books of the same enchantment and level make one book of the next level (up to the max), for `80 × (new level)²` emeralds. This is Minecraft's book combining, and it turns duplicate drops into progress.
- **Grindstone:** removes a weapon's enchantments (after a confirm step). The books are lost, and `30 × level²` emeralds per enchantment come back (a quarter of the apply cost).
- Locked characters show the dragon requirement and how many books are waiting in the library.

## 6. Mastery and achievements

- A character is **Mastered** when its **signature weapon** (its starting skill) has **3 enchantments, all at max level**.
- **Achievements:**
  - Knowledge Unlocked: unlock enchanting on a character
  - First Enchantment
  - Anvil Apprentice: combine 10 books
  - Master Enchanter: master 1 character
  - Enchanting Guild: master 5 characters
  - Legendary Arsenal: master all 16 starters
  - **Max Enchant Everyone** (final): master every playable species. Variants count toward their base species.
- The Mobdex shows each character's state: locked / unlocked / Mastered (gold glint), plus a count "Mastered n / N".

## 7. Naming changes to avoid confusion

- The in-run golden card that turns a maxed skill into its upgraded form ("Enchant: Netherite Sword") becomes **Smithing** ("Smithing: Netherite Sword"), like Minecraft's smithing table netherite upgrade. "Enchant" then only means this new system.
- Rare "Enchanted" mobs (the old shinies) keep their name; they have the glint.

## 8. Implementation outline

- `js/data/enchantments.js`: the table above (id, name, max, types, exclusive groups, effect params, drop weight).
- `js/systems/enchanting.js`: weapon types of skills, apply/combine/remove, costs, mastery, book drops, and applying enchantments to a skill instance when a player learns it. Combat hooks: type bonus, burn, slow, knockback, procs, Breach, Mending, Looting; player hooks: Protection, Thorns, Feather Falling, Swift Sneak.
- `js/ui/enchant-ui.js` plus a menu item: Table / Anvil / Grindstone / Library.
- **Save:** `slayer: {dex: date}`, `books: {id: [count at I, II, III, IV, V]}`, `ench: {dex: {skillId: [[id, lvl] × ≤3]}}` (migrated with defaults).
- **Dev panel:** unlock enchanting for the partner, +books (all / random), master partner.
- **Tests:** a dragon kill unlocks the partner; books drop and bank; combining works; apply and incompatibility rules work; enchant effects change the skill instance in a run; mastery and achievements.

## 9. As built (2026-10-14)

- **Files:** `js/data/enchantments.js` (`G.ENCHANT`: the 30 enchantments with `per` numbers and `text(l)`, weapon types, exclusive groups, drop table, costs), `js/systems/enchanting.js` (`G.Enchanting`), `js/ui/enchant-ui.js` (`G.EnchantUI`, section `#scr-ench` in `dev.html`), CSS under "Enchanting" in `css/style.css`.
- **API:** `unlocked(dex)`, `weaponType(skill)`, `weapons(dex)`, `listFor(dex, skill)`, `compatible(dex, skill, ench)`, `whyNot(...)` (the reason shown on the Table), `apply(dex, skill, ench, lvl)` → `true` or a reason, `combine(ench, lvl)`, `removeAll(dex, skill)` → refund, `mastery(dex)` → `locked | unlocked | mastered`, `masteredCount()`, `startersMastered()`, `speciesMastered()`, `rollBook(source, floorIdx)`, `grantBook(book)` (banks and commits), `slay(dex)`.
- **Run hooks:** `Player.addMove` → `applyTo(m, dex)` bakes multipliers into the instance (later ladder levels multiply on top) and leaves procs in `m.enc`; shots carry `enc`. `combat.hit` and projectile hits apply Smite/Bane/Impaling (`vsMul`), Breach (`Enemy.hurt(..., breach)`: through shields, the Shulker shell and Wither Armour; never a dodge or the dragon's crystal shield) and `afterHit` (Bane's slow, Mending, Looting, Channeling, Wind Burst). `pl.encAct` (refreshed on skill switch) holds Protection, Thorns, Swift Sneak and Feather Falling of the active slot. Fortune multiplies the end-of-run emeralds. Nothing runs per frame except one multiply in `Player.spd` and the Mending heal tick.
- **Unlock:** `Floors.bossDown` on The End (in co-op, every player's partner: the host in `bossDown`, each guest on the host's `'fd'`): `slay(partner)`, the banner, then the End Gateway banner queued after it. Achievement `enchSlayer`.
- **Books:** `Enemy.die` → `bossDrop(e)` (floor, `elder`, `midBoss`, `legend` = Trial Chamber, `judge` = Herobrine's queue); `events.js` Pillager Captain. Pickup kind `book` (value `"id:lvl"`); collected → `grantBook`, toast, `pl.books`; leftovers are banked in `endRun`.
- **Achievements** (`cat: 'encantar'`): `enchSlayer` Knowledge Unlocked, `ench1` First Enchantment, `anvil10` Anvil Apprentice, `master1` Master Enchanter, `master5` Enchanting Guild, `masterStarters` Legendary Arsenal, `masterAll` Max Enchant Everyone (goal = playable species, those with sprites and no `v`).
- **Renames (§7):** Smithing everywhere for the move evolution; the Smithing names that reused enchantment names changed (Density Smash → Heavy Smash, Impaling Trident → Prismarine Trident, Thorns Lash → Bramble Lash, Channeling → Thunderstorm, Wind Burst → Gale Blast, Power Bow → Hunter's Bow, Book of Mending → Grand Spellbook); the skill "Enchanted Book" became the **Spellbook**; achievements First Smithing / Arcane Smith / Master Smith, and Glint Collector (was "Enchanter", 5 Enchanted mobs).
- **Dev panel:** Unlock enchanting (partner), Master partner (best fitting enchantments at max on its signature weapon), +books (one of each, level I), +random books ×10.

