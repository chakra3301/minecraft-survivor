/* ============ items.js — held items (one per run) ============
 * Found in chests (sometimes in normal ones, often in locked ones) and
 * dropped by bosses. You can only hold ONE; if you find another, you choose
 * which to keep. They last for the run. Ids are PokéSurvivor's; names are
 * Minecraft's (see CONTENT.md).
 *
 *   on(pl)   equip it (what it does while held)
 *   off(pl)  unequip it (undoes on)
 * Reactive ones (lethal hit, damage dealt...) are checked by the player
 * with pl.hasItem(id).
 */
G.Items = (() => {
  const LIST = [
    { id: 'leftovers', name: 'Potion of Regeneration', desc: 'Regenerate 1.5% of your health every second.',
      on: p => { p.regenFlat += p.maxHp * 0.015; p._itemRegen = p.maxHp * 0.015; },
      off: p => { p.regenFlat -= p._itemRegen || 0; } },
    { id: 'choiceband', name: 'Mace', desc: '+40% damage, but you can\'t switch skills.',
      on: p => { p.atkMul *= 1.4; }, off: p => { p.atkMul /= 1.4; } },
    { id: 'quickclaw', name: 'Redstone Repeater', desc: '-20% cooldown on all your skills.',
      on: p => { p.cdMul *= 0.8; }, off: p => { p.cdMul /= 0.8; } },
    { id: 'focussash', name: 'Totem of Undying', desc: 'A hit that would kill you leaves you at 1 health instead (every 60 s).',
      on: () => {}, off: () => {} },
    { id: 'shellbell', name: 'Glistering Melon', desc: 'You heal from the damage you deal.',
      on: () => {}, off: () => {} },
    { id: 'amuletcoin', name: 'Rabbit\'s Foot', desc: '+50% emeralds at the end of the run.',
      on: p => { p.coinMul *= 1.5; }, off: p => { p.coinMul /= 1.5; } },
    { id: 'luckyegg', name: 'Bottle o\' Enchanting', desc: '+30% experience.',
      on: p => { p.xpMul *= 1.3; }, off: p => { p.xpMul /= 1.3; } },
    { id: 'lifeorb', name: 'Ominous Bottle', desc: '+30% damage, but every attack costs a little health.',
      on: p => { p.atkMul *= 1.3; }, off: p => { p.atkMul /= 1.3; } },
    { id: 'choicescarf', name: 'Potion of Swiftness', desc: '+35% speed.',
      on: p => { p.spdMul *= 1.35; }, off: p => { p.spdMul /= 1.35; } },
    { id: 'rockyhelmet', name: 'Turtle Shell', desc: 'Mobs that hit you in melee take damage.',
      on: () => {}, off: () => {} },
    { id: 'assaultvest', name: 'Netherite Chestplate', desc: '+20% damage reduction.',
      on: p => { p.dmgReduce += 0.2; }, off: p => { p.dmgReduce -= 0.2; } }
  ];
  const BY = {};
  for (const it of LIST) BY[it.id] = it;

  /** A random one, different from the one you hold. */
  function roll(except) {
    const pool = LIST.filter(i => i.id !== except);
    return G.U.pick(pool).id;
  }

  return { LIST, BY, roll };
})();
