/* ============ enchantments.js — enchantments, weapon types and book drops ============
 *
 * The Enchanting Table (systems/enchanting.js, ui/enchant-ui.js; design in ENCHANTING.md).
 * Every skill is a weapon; its weapon type decides which enchantments fit (like Minecraft's item
 * restrictions). Each character + skill pair has 3 slots.
 *
 *   id      save id (permanent: saves store it)        max   Minecraft's max level
 *   types   weapon types it fits ('any' = all)         excl  enchantments it can't share a weapon with
 *   w       drop weight (common 8, rare 1.25: Mending, Channeling, Multishot, Infinity ≈ 5% together)
 *   per     its numbers per level (read by G.Enchanting.applyTo)
 *   text(l) what it does at level l, for the screens
 *
 * Exclusive groups: Sharpness / Smite / Bane of Arthropods · Multishot / Piercing · Loyalty / Riptide ·
 * Riptide / Channeling · Density / Breach · Infinity / Mending.
 */
(() => {
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

  const TYPES = {
    sword:   { name: 'Sword',   icon: 'items/iron_sword',      desc: 'Swords, axes and tools: melee skills' },
    bow:     { name: 'Bow',     icon: 'items/bow_standby',     desc: 'Bows and throws: projectile, fan, boomerang and chain skills' },
    trident: { name: 'Trident', icon: 'items/trident',         desc: 'Trident, Spear Lunge and Elytra Dash' },
    mace:    { name: 'Mace',    icon: 'items/mace',            desc: 'Mace Smash and the skills that drop from above' },
    staff:   { name: 'Staff',   icon: 'items/amethyst_shard',  desc: 'Magic: beam, burst, aura, orbit, mine, trail and sentry skills' },
    armour:  { name: 'Armour',  icon: 'items/iron_chestplate', desc: 'Potions and powers (buff skills)' }
  };

  // Weapon type of each skill: by its kind, with the design's overrides.
  const BY_KIND = {
    melee: 'sword', projectile: 'bow', cone: 'bow', boomerang: 'bow', chain: 'bow', meteor: 'mace', dash: 'trident',
    beam: 'staff', nova: 'staff', aura: 'staff', orbit: 'staff', mine: 'staff', trail: 'staff', turret: 'staff', buff: 'armour'
  };
  const OVERRIDE = { 'water-gun': 'trident', 'quick-attack': 'trident', 'aerial-ace': 'trident', 'body-slam': 'mace' };

  const pct = v => Math.round(v * 100) + '%';
  const LIST = [
    // ---------- swords, axes and tools ----------
    { id: 'sharpness', name: 'Sharpness', max: 5, types: ['sword'], w: 8, per: { dmg: 0.08 },
      text: l => `+${pct(0.08 * l)} damage` },
    { id: 'smite', name: 'Smite', max: 5, types: ['sword', 'mace'], w: 2.9, per: { vs: 0.20 },
      text: l => `+${pct(0.2 * l)} damage to Undead mobs` },
    { id: 'bane', name: 'Bane of Arthropods', max: 5, types: ['sword', 'mace'], w: 2.9, per: { vs: 0.20 },
      text: l => `+${pct(0.2 * l)} damage to Arthropod mobs, and slows them` },
    { id: 'fire_aspect', name: 'Fire Aspect', max: 2, types: ['sword', 'staff'], w: 2.9, per: { burn: 1 },
      text: l => `Sets targets on fire (+${l} burn ${l === 1 ? 'stack' : 'stacks'})` },
    { id: 'knockback', name: 'Knockback', max: 2, types: ['sword'], w: 2.9, per: { knock: 45 },
      text: l => `+${45 * l} knockback` },
    { id: 'looting', name: 'Looting', max: 3, types: ['sword', 'staff'], w: 2.9, per: { loot: 0.10 },
      text: l => `Kills have a ${pct(0.1 * l)} chance to drop an emerald` },
    { id: 'sweeping', name: 'Sweeping Edge', max: 3, types: ['sword'], w: 2.9, per: { sweep: 0.12 },
      text: l => `+${pct(0.12 * l)} arc and reach` },
    // ---------- bows and crossbows ----------
    { id: 'power', name: 'Power', max: 5, types: ['bow'], w: 8, per: { dmg: 0.08 },
      text: l => `+${pct(0.08 * l)} damage` },
    { id: 'punch', name: 'Punch', max: 2, types: ['bow'], w: 2.9, per: { knock: 45 },
      text: l => `+${45 * l} knockback` },
    { id: 'flame', name: 'Flame', max: 1, types: ['bow'], w: 2.9, per: { burn: 1 },
      text: () => 'Sets targets on fire (+1 burn stack)' },
    { id: 'infinity', name: 'Infinity', max: 1, types: ['bow'], w: 1.25, per: { cd: 0.15 },
      text: () => '-15% cooldown' },
    { id: 'multishot', name: 'Multishot', max: 1, types: ['bow'], w: 1.25, per: { count: 2 },
      text: () => '+2 projectiles, spread out' },
    { id: 'piercing', name: 'Piercing', max: 4, types: ['bow'], w: 2.9, per: { pierce: 1 },
      text: l => `+${l} pierce (chains: +${l} ${l === 1 ? 'jump' : 'jumps'})` },
    { id: 'quick_charge', name: 'Quick Charge', max: 3, types: ['bow'], w: 2.9, per: { cd: 0.06 },
      text: l => `-${pct(0.06 * l)} cooldown` },
    // ---------- tridents ----------
    { id: 'impaling', name: 'Impaling', max: 5, types: ['trident'], w: 2.9, per: { vs: 0.20 },
      text: l => `+${pct(0.2 * l)} damage to Aquatic mobs` },
    { id: 'loyalty', name: 'Loyalty', max: 3, types: ['trident'], w: 2.9, per: { speed: 0.15, cd: 0.05 },
      text: l => `Throws fly back faster (+${pct(0.15 * l)} speed and +1 pierce); dashes recover ${pct(0.05 * l)} faster` },
    { id: 'riptide', name: 'Riptide', max: 3, types: ['trident'], w: 2.9, per: { reach: 0.15 },
      text: l => `Dashes go ${pct(0.15 * l)} further and you're immune during the dash (throws: +${pct(0.15 * l)} range)` },
    { id: 'channeling', name: 'Channeling', max: 1, types: ['trident'], w: 1.25, per: { chan: 0.15 },
      text: () => '15% of hits strike lightning that chains to 2 more mobs' },
    // ---------- maces ----------
    { id: 'density', name: 'Density', max: 5, types: ['mace'], w: 2.9, per: { dmg: 0.08, radius: 0.06 },
      text: l => `+${pct(0.08 * l)} damage and +${pct(0.06 * l)} impact radius` },
    { id: 'breach', name: 'Breach', max: 4, types: ['mace'], w: 2.9, per: { breach: 0.25 },
      text: l => `${pct(0.25 * l)} of the damage ignores shields (shielders, Shulker shell, Wither Armour)` },
    { id: 'wind_burst', name: 'Wind Burst', max: 3, types: ['mace'], w: 2.9, per: { gust: 20 },
      text: l => `Hits release a knockback gust (radius ${40 + 20 * l})` },
    // ---------- staffs (magic) ----------
    { id: 'efficiency', name: 'Efficiency', max: 5, types: ['staff'], w: 2.9, per: { cd: 0.05 },
      text: l => `-${pct(0.05 * l)} cooldown` },
    { id: 'fortune', name: 'Fortune', max: 3, types: ['staff'], w: 2.9, per: { fortune: 0.08 },
      text: l => `+${pct(0.08 * l)} emeralds at the end of the run` },
    { id: 'frost_walker', name: 'Frost Walker', max: 2, types: ['staff'], w: 2.9, per: { slow: 0.15 },
      text: l => `Hits slow by ${pct(0.15 * l)}` },
    // ---------- armour (potions) ----------
    { id: 'protection', name: 'Protection', max: 4, types: ['armour'], w: 8, per: { prot: 0.04 },
      text: l => `-${pct(0.04 * l)} damage taken while it is your active skill` },
    { id: 'thorns', name: 'Thorns', max: 3, types: ['armour'], w: 2.9, per: { thorns: 0.15 },
      text: l => `Reflects ${pct(0.15 * l)} of contact damage while it is your active skill` },
    { id: 'swift_sneak', name: 'Swift Sneak', max: 3, types: ['armour'], w: 2.9, per: { sneak: 0.04 },
      text: l => `+${pct(0.04 * l)} move speed while it is your active skill` },
    { id: 'feather_falling', name: 'Feather Falling', max: 4, types: ['armour'], w: 2.9, per: { feather: 0.15 },
      text: l => `-${pct(0.15 * l)} fall and knockback damage (Levitation falls, flings) while it is your active skill` },
    // ---------- any weapon ----------
    { id: 'unbreaking', name: 'Unbreaking', max: 3, types: ['any'], w: 8, per: { dur: 0.10, dmg: 0.05 },
      text: l => `+${pct(0.1 * l)} duration of mines, sentries, trails and potions (other skills: +${pct(0.05 * l)} damage)` },
    { id: 'mending', name: 'Mending', max: 1, types: ['any'], w: 1.25, per: { mend: 0.01 },
      text: () => 'Heals 1% of the damage dealt (at most 4 health per second)' }
  ];

  const EXCL_GROUPS = [['sharpness', 'smite', 'bane'], ['multishot', 'piercing'], ['loyalty', 'riptide'],
                       ['riptide', 'channeling'], ['density', 'breach'], ['infinity', 'mending']];
  const BY = {};
  for (const e of LIST) { e.excl = []; BY[e.id] = e; }
  for (const g of EXCL_GROUPS) for (const a of g) for (const b of g) if (a !== b && !BY[a].excl.includes(b)) BY[a].excl.push(b);
  // Element each "vs" enchantment is strong against (Undead, Arthropod, Aquatic are type ids ghost, bug, water).
  BY.smite.vsType = 'ghost'; BY.bane.vsType = 'bug'; BY.impaling.vsType = 'water';

  // ---------- book drops (rare boss drops, banked at once) ----------
  // Chance per source; level range per floor (G.DIMENSIONS order).
  const DROP = { floor: 1, elder: 0.35, mid: 0.30, trial: 0.40, captain: 0.10, herobrine: 0.25 };
  const FLOOR_LVL = { overworld: [1, 1], ocean: [1, 2], underworld: [2, 2], nether: [2, 3], stronghold: [2, 3],
                      end: [3, 4], ancient_city: [4, 5], herobrine: [4, 5] };
  const SOURCE_LVL = { captain: [1, 1], herobrine: [4, 5] };

  // Costs in emeralds: applying a book (Minecraft's level costs), combining two at the anvil, and the
  // grindstone's refund (a quarter of what the books cost to apply).
  const COST = { apply: l => 120 * l * l, combine: l => 80 * l * l, refund: l => 30 * l * l };

  G.ENCHANT = { LIST, BY, TYPES, BY_KIND, OVERRIDE, ROMAN, DROP, FLOOR_LVL, SOURCE_LVL, COST, SLOTS: 3 };
})();
