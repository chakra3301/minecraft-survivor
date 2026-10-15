// The game still runs PokéSurvivor's Spanish->English translator (js/core/i18n.js + js/data/lang-en.js,
// with the Minecraft overrides in js/data/lang-mc.js) over every DOM text and canvas fillText. New Minecraft content is written in English, so it must pass
// through untouched. This loads the data modules headlessly and reports any English string the
// translator would change (a Spanish dictionary word of 4+ letters inside it, e.g. "Once" -> "Eleven").
//   node tools/mc/check-i18n.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const game = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const noop = () => {};
const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, appendChild: noop,
  setAttribute: noop, getAttribute: () => null, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [],
  getContext: () => new Proxy({}, { get: () => noop }), insertAdjacentHTML: noop, dataset: {} });
const ctx = {
  console, Math, JSON, Date, Map, Set, WeakMap, Promise, Object, Array, String, Number, RegExp, Symbol, Error, Intl,
  setTimeout: noop, clearTimeout: noop, setInterval: noop, requestAnimationFrame: noop, performance: { now: () => 0 },
  localStorage: { getItem: k => (k === 'ps.lang' ? 'en' : null), setItem: noop, removeItem: noop },
  navigator: { language: 'en', languages: ['en'] }, location: { pathname: '/', search: '', protocol: 'http:' },
  document: { documentElement: {}, createElement: el, getElementById: el, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: noop, body: el(), fonts: { load: () => Promise.resolve() } },
  window: {}, addEventListener: noop, Image: function () {}, CanvasRenderingContext2D: function () {},
  confirm: () => true, alert: noop, OffscreenCanvas: function () { return el(); }
};
ctx.CanvasRenderingContext2D.prototype = {};
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
const load = async f => {
  try { vm.runInContext(await readFile(path.join(game, f), 'utf8'), ctx, { filename: f }); return true; }
  catch (e) { console.warn(`(skipped ${f}: ${e.message})`); return false; }
};
vm.runInContext('var G = {};', ctx);
for (const f of ['js/core/util.js', 'js/core/i18n.js', 'js/data/lang-en.js', 'js/data/lang-mc.js', 'js/data/mobdex.js', 'js/data/sprites-meta.js',
  'js/data/moves.js', 'js/data/types.js', 'js/data/starters.js', 'js/data/enemies.js', 'js/data/upgrades.js', 'js/data/items.js',
  'js/data/missions.js', 'js/data/achievements.js', 'js/data/enchantments.js', 'js/world/tiles.js', 'js/systems/weather.js', 'js/systems/levelup.js',
  'js/systems/gacha.js', 'js/systems/interact.js', 'js/data/changelog.js']) await load(f);

const G = ctx.G, strs = new Set();
const add = s => { if (typeof s === 'string' && /\p{L}/u.test(s)) strs.add(s.trim()); };
for (const p of G.DEX || []) add(p.name);
for (const v of Object.values(G.U.TYPE_NAME || {})) add(v);
if (G.Moves) {
  for (const m of G.Moves.ALL) { add(m.name); add(m.desc); for (const u of m.ups || []) add(u.t); }
  for (const [n] of Object.values(G.Moves.EVO || {})) add(n);
  for (const v of Object.values(G.Moves.NEED_NAME || {})) add(v);
}
for (const s of Object.values(G.TRAIT_TEXT || {})) add(s);
for (const q of G.PERSONALITY_TEST || []) { add(q.q); for (const a of q.a) add(a.t); }
for (const it of (G.Items && (G.Items.LIST || G.Items.ALL)) || []) { add(it.name); add(it.desc); }
for (const u of (G.Upgrades && G.Upgrades.LIST) || []) { add(u.name); add(u.unit); }
for (const s of (G.LevelUp && G.LevelUp.STATS) || []) { add(s.title); add(s.desc); }
for (const b of (G.Gacha && G.Gacha.BANNERS) || []) {
  add(b.name);
  // The Spawner's odds panel (js/ui/gacha-ui.js): its Legendaries and the rare lure's line.
  for (const o of G.Gacha.odds ? G.Gacha.odds(5, b.gen) : []) { add(o.name); add(o.name + ' lurks in this Spawner: about 0.06% per spawn (1 in 1,700).'); }
}
for (const s of ['Legendaries here', '0.29% per spawn', '0.06% per spawn', 'Legendary odds per spawn before the pity, which only raises them.',
  'Pull ×10 guaranteed Legendary', 'Spawn armoured mob:', 'Spawn Chicken Jockey', 'Spawn Spider Jockey', 'Leave the run first', 'Nothing to spawn']) add(s);
for (const b of (G.Tiles && G.Tiles.BIOMES) || []) add(b.name);
for (const t of Object.values((G.Tiles && G.Tiles.ARENA_THEMES) || {})) add(t.name);
for (const k of Object.values((G.Weather && G.Weather.KINDS) || {})) { add(k.name); add(k.hint); }
for (const a of (G.Achievements && G.Achievements.LIST) || []) { add(a.name); add(a.desc); add(a.title); }
for (const list of Object.values(G.Missions || {})) if (Array.isArray(list)) for (const m of list) {
  try { add(m.text(m.goals ? m.goals[0] : 1, 'fire')); } catch {}
}

for (const p of (G.Interact && G.Interact.POWERS) || []) { add(p.name); add(p.desc); }
for (const v of G.CHANGELOG || []) { add(v.title); for (const k of ['new', 'chg', 'fix']) for (const t of v[k] || []) add(t); }
for (const list of [G.MissionDefs && G.MissionDefs.daily, G.MissionDefs && G.MissionDefs.weekly]) for (const m of list || []) {
  for (const n of m.goals || [1]) try { add(m.text(n, 'water')); add(m.text(n, 'electric')); } catch {}
}
for (const c of (G.AchDefs && G.AchDefs.CATS) || []) add(c[1]);
// Enchanting (js/data/enchantments.js): names, what each level does, weapon types; the book names and run texts.
for (const e of (G.ENCHANT && G.ENCHANT.LIST) || []) {
  add(e.name);
  for (let l = 1; l <= e.max; l++) { add(e.text(l)); add(e.name + ' ' + G.ENCHANT.ROMAN[l]); add('Enchanted Book: ' + e.name + ' ' + G.ENCHANT.ROMAN[l] + '!'); }
}
for (const t of Object.values((G.ENCHANT && G.ENCHANT.TYPES) || {})) { add(t.name); add(t.desc); }
for (const s of ['Enchanting', 'Enchant your weapons · books from bosses', 'Table', 'Anvil', 'Grindstone', 'Library', 'Characters',
  'Locked', 'Unlocked', 'Mastered', 'Signature', 'Empty slot', 'Defeat the Ender Dragon with this character to unlock enchanting',
  'Enchant its weapons at the Enchanting Table, in the main menu', 'Enchanted Books found · in your Library', 'Any weapon', 'Every weapon',
  'Smithing: Netherite Sword', 'SMITHING · Iron Sword', 'Smithing for Iron Sword', 'Not enough emeralds', 'All 3 slots are full',
  'You need two of the same book', 'Already at its max level', 'Combine', 'Apply', 'Remove…', 'Cancel']) add(s);
for (const a of (G.AchDefs && G.AchDefs.LIST) || []) { add(a.name); add(a.desc); add(a.title); }
// Support screen (js/ui/support-ui.js), the fan-game notice (dev.html footer, login, legal notice, Settings → About).
for (const s of ['Support the game', 'Buy me a coffee · Solana', 'Back', 'Minecraft Survivor is free and open source, made by a fan in their spare time:',
  'no ads, no purchases, nothing locked.', 'free', 'open source',
  'If you enjoy it, a small tip helps pay for hosting and keeps the game online. Tipping gives nothing in the game: everyone plays the same.',
  'Buy me a coffee', 'Buy me a coffee: link coming soon.', 'Tip with Solana', 'QR code of the Solana address',
  'Scan the code with your wallet app, or copy the address. Send on the Solana network only.', 'Copy address', 'Copied!',
  'Address selected: copy it from there', 'You can also help for free: share the game with your friends and report bugs.',
  'Unofficial fan game. Not affiliated with Mojang or Microsoft. Minecraft assets © Mojang.', 'Legal notice',
  'Unofficial fan game. Not affiliated with Mojang or Microsoft. Minecraft assets © Mojang. ·',
  "Unofficial fan game. Not affiliated with Mojang or Microsoft. Minecraft assets © Mojang (from Mojang's bedrock-samples).",
  'Survive the night with your partner mob']) add(s);

const bad = [];
for (const s of strs) { const r = G.I18n.t(s); if (r !== s) bad.push([s, r]); }
console.log(`${strs.size} English strings checked`);
for (const [s, r] of bad) console.log(`  CHANGED: ${JSON.stringify(s)}\n      -> ${JSON.stringify(r)}`);
if (bad.length) { console.log(`${bad.length} strings would be mistranslated: reword them or add an identity entry.`); process.exit(1); }
