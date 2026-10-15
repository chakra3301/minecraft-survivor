/* ============ i18n.js — display text (English only) ============
 * Minecraft Survivor is English only. Much of the engine inherited from
 * PokéSurvivor still writes Spanish source strings, so every text that reaches
 * the screen is translated with the dictionary in js/data/lang-en.js (plus the
 * Minecraft overrides in js/data/lang-mc.js), without touching each screen:
 *   - the DOM (menus, cards, notices...) through a MutationObserver,
 *   - the canvas (HUD, notices, numbers) by wrapping fillText/strokeText,
 *   - confirm()/alert().
 *
 * Dictionary keys are the Spanish text. Three levels:
 *   1. exact phrase                    'Volver' -> 'Back'
 *   2. pattern with {x} holes          '¡{x} se une a ti!' -> '{x} joins you!'
 *                                      (what falls in a hole is translated too)
 *   3. fragments inside a longer text, whole words only
 * A later add() with the same key replaces the earlier entry (lang-mc.js
 * overrides lang-en.js). Text written by players (nicknames) is marked
 * translate="no".
 *
 * Finally every result goes through a small English pass (MC) that rewrites
 * any leftover Pokémon vocabulary into the Minecraft one.
 */
G.I18n = (() => {
  const lang = 'en';
  document.documentElement.lang = lang;

  const exact = new Map(), exactLow = new Map();
  const patterns = [], patIdx = new Map();
  let frag = null, fragMap = new Map();
  const cache = new Map();
  const L = '\\p{L}\\p{N}';
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** Adds translations { 'texto en español': 'English text' }. */
  function add(dict) {
    for (const [es, en] of Object.entries(dict)) {
      if (!en) continue;
      if (es.includes('{x}')) {
        const parts = es.split('{x}').map(reEsc);
        const p = { re: new RegExp('^' + parts.join('(.+?)') + '$', 'u'), reI: new RegExp('^' + parts.join('(.+?)') + '$', 'iu'), en };
        if (patIdx.has(es)) patterns[patIdx.get(es)] = p;
        else { patIdx.set(es, patterns.length); patterns.push(p); }
      } else {
        if (es === en && !exact.has(es)) continue;
        exact.set(es, en);
        exactLow.set(es.toLowerCase(), en);
        if (es.length >= 4 || /\s/.test(es)) fragMap.set(es.toLowerCase(), en);
      }
    }
    // One expression with every fragment (longest first), whole words only.
    const all = [...fragMap.keys()].sort((a, b) => b.length - a.length).map(reEsc).join('|');
    frag = all ? new RegExp(`(?<![${L}])(${all})(?![${L}])`, 'giu') : null;
    cache.clear();
  }

  function keepCase(src, en) {
    if (src === src.toUpperCase() && /\p{L}/u.test(src)) return en.toUpperCase();
    return en;
  }

  // ---------------- Minecraft vocabulary pass (English -> English) ----------------
  // Catches any Pokémon term that slipped through. Whole words; case is kept
  // (all caps stay all caps, a capital first letter stays capital).
  const MC = [
    [/PokéSurvivor/g, 'Minecraft Survivor'], [/Pok[ée]dex/gi, 'Mobdex'], [/Pok[ée] ?Coins?/gi, 'Emeralds'],
    [/Pok[ée]mon(?:edas)?/gi, 'mob'], [/Pok[ée] ?Balls?/gi, 'spawn egg'], [/Mystery Dungeon/gi, 'Survive the Night'],
    [/\bshinies\b/gi, 'Enchanted mobs'], [/\bshiny\b/gi, 'Enchanted'], [/\bgacha\b/gi, 'Spawner'],
    [/\bArceus\b/gi, 'Herobrine'], [/\bgolden hour\b/gi, 'Emerald Rush'], [/\brifts\b/gi, 'Nether Portals'], [/\brift\b/gi, 'Nether Portal'],
    [/\bbonded\b/gi, 'linked'], [/\bbond\b/gi, 'Combo'], [/\bhordes\b/gi, 'sieges'], [/\bhorde\b/gi, 'siege'],
    [/\bcoins\b/gi, 'emeralds'], [/\bcoin\b/gi, 'emerald'], [/\bTrainer\b/g, 'Player']
  ];
  const fixCase = (src, rep) => src === src.toUpperCase() && /\p{L}{2}/u.test(src) ? rep.toUpperCase()
    : /^\p{Lu}/u.test(src) ? rep[0].toUpperCase() + rep.slice(1) : rep;
  function mc(s) {
    if (!/pok|shin|gacha|arceus|golden|rift|bond|horde|coin|mystery|trainer/i.test(s)) return s;
    for (const [re, rep] of MC) s = s.replace(re, w => fixCase(w, rep));
    return s;
  }

  /** Translates a text into English (Spanish source -> English, then the Minecraft pass). */
  function t(s) {
    if (!s || typeof s !== 'string') return s;
    if (!/\p{L}/u.test(s)) return s;
    const c = cache.get(s);
    if (c !== undefined) return c;
    const r = mc(core(s));
    if (cache.size > 4000) cache.clear();
    cache.set(s, r);
    return r;
  }

  function core(s) {
    // Keeps the surrounding whitespace (DOM text nodes).
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    // HTML text can span several lines: it is compared with the whitespace collapsed.
    const lead = m[1], tail = m[3], body = m[2].replace(/\s+/g, ' ');
    if (!body) return s;
    const upper = body === body.toUpperCase() && /\p{L}/u.test(body);
    let r = exact.get(body);
    if (r === undefined && upper) { const e = exactLow.get(body.toLowerCase()); if (e !== undefined) r = keepCase(body, e); }
    if (r === undefined) {
      for (const p of patterns) {
        const mm = (upper ? p.reI : p.re).exec(body);
        if (!mm) continue;
        let i = 1;
        r = p.en.replace(/\{x\}/g, () => { const g = mm[i++]; return g === undefined ? '' : core(g); });
        r = keepCase(body, r);
        break;
      }
    }
    if (r === undefined && frag) {
      r = body.replace(frag, w => keepCase(w, fragMap.get(w.toLowerCase()) || w));
    }
    return lead + (r === undefined ? body : r) + tail;
  }

  /** Text with holes for code: f('Nivel {x}', 5). */
  function f(es, ...vals) { let i = 0; return t(es).replace(/\{x\}/g, () => vals[i++]); }

  // ---------------- DOM ----------------
  const ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
  const skipEl = el => !!(el && el.closest && el.closest('[translate="no"], script, style, code'));

  function doText(n) {
    const p = n.parentElement;
    if (!p || skipEl(p)) return;
    const v = n.nodeValue;
    if (n.__tr === v) return;
    const r = t(v);
    n.__tr = r;
    if (r !== v) n.nodeValue = r;
  }
  function doEl(el) {
    if (skipEl(el)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) { const r = t(v); if (r !== v) el.setAttribute(a, r); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || skipEl(root)) return;
    doEl(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }

  function startDom() {
    walk(document.body);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doEl(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.title = t(document.title);
  }

  // ---------------- canvas and browser dialogs ----------------
  {
    const P = CanvasRenderingContext2D.prototype;
    for (const k of ['fillText', 'strokeText', 'measureText']) {
      const orig = P[k];
      P[k] = function (s, ...a) { return orig.call(this, typeof s === 'string' ? t(s) : s, ...a); };
    }
    const oc = window.confirm, oa = window.alert;
    window.confirm = s => oc.call(window, t(s));
    window.alert = s => oa.call(window, t(s));
  }

  /** Kept for old callers: the game has one language, so it only reloads. */
  function set() { location.reload(); }

  return { lang, add, t, f, set, startDom, walk };
})();
G.T = G.I18n.t;
