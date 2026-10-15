// Loads Minecraft Survivor's data modules headlessly (like tools/mc/check-i18n.mjs) and returns `G`:
// the Mobdex, moves, achievements… Used by ../../server/make-rules.mjs.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

export const gameDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function loadGame(files = ['js/core/util.js', 'js/core/i18n.js', 'js/data/lang-en.js', 'js/data/lang-mc.js',
  'js/data/mobdex.js', 'js/data/sprites-meta.js', 'js/data/moves.js', 'js/data/types.js', 'js/data/starters.js', 'js/data/enemies.js',
  'js/data/upgrades.js', 'js/data/items.js', 'js/data/missions.js', 'js/data/achievements.js']) {
  const noop = () => {};
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, appendChild: noop,
    setAttribute: noop, getAttribute: () => null, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [],
    getContext: () => new Proxy({}, { get: () => noop }), insertAdjacentHTML: noop, dataset: {} });
  const ctx = {
    console, Math, JSON, Date, Map, Set, WeakMap, Promise, Object, Array, String, Number, RegExp, Symbol, Error, Intl,
    setTimeout: noop, clearTimeout: noop, setInterval: noop, requestAnimationFrame: noop, performance: { now: () => 0 },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { language: 'en', languages: ['en'] }, location: { pathname: '/', search: '', protocol: 'http:' },
    document: { documentElement: {}, createElement: el, getElementById: el, querySelector: () => null, querySelectorAll: () => [],
      addEventListener: noop, body: el(), fonts: { load: () => Promise.resolve() } },
    addEventListener: noop, Image: function () {}, CanvasRenderingContext2D: function () {},
    confirm: () => true, alert: noop, OffscreenCanvas: function () { return el(); }
  };
  ctx.CanvasRenderingContext2D.prototype = {};
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext('var G = {};', ctx);
  for (const f of files) vm.runInContext(await readFile(path.join(gameDir, f), 'utf8'), ctx, { filename: f });
  return ctx.G;
}
