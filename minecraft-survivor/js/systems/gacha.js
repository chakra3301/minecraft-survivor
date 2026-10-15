/* ============ gacha.js — un banner por generación ============
 * Lógica pura: no toca la interfaz. La pantalla está en ui/gacha-ui.js.
 *
 * 9 banners (Kanto ... Paldea). Cada uno con su propio pity.
 * Probabilidades por tirada:  1★ 45% · 2★ 30% · 3★ 17% · 4★ 6.5% · 5★ 1.5%
 * Garantías:
 *   - la tirada ×10 trae al menos un 4★ o superior
 *   - a las 70 tiradas sin 5★ en ese banner, el siguiente es 5★ seguro
 * Shiny: 1 de cada 100 tiradas sale en su versión shiny.
 * Within a rarity each mob weighs its `pw` (Mobdex pull weight, default 1): Herobrine (0.2) is the
 * Overworld's rare lure. Every pick is weighted: normal pulls, the pity and the Enchanted fallback.
 * Repetidos: se convierten en Pokémonedas (los shiny repetidos, el triple).
 *
 * Se tira con TICKETS (se consiguen jugando):
 *   ×1   1 ticket
 *   ×10  10 tickets normales, o 1 ticket ×10 (eliges con qué)
 */
G.Gacha = (() => {
  /** ¿Qué gasta una tirada de n? → { t1, t10 } o null si no te llega. */
  /** @param use  't1' (tickets normales) o 't10' (un ticket ×10, sólo para la ×10) */
  function costOf(save, n, use = 't1') {
    const t = save.tickets || { t1: 0, t10: 0 };
    if (n === 10 && use === 't10') return t.t10 >= 1 ? { t1: 0, t10: 1 } : null;
    return t.t1 >= n ? { t1: n, t10: 0 } : null;
  }
  const RATES = [[1, 45], [2, 30], [3, 17], [4, 6.5], [5, 1.5]];
  const PITY_5 = 70;
  const SHINY_RATE = 1 / 100;
  const REFUND = { 1: 15, 2: 30, 3: 60, 4: 120, 5: 300 };
  let forceShiny = 0;           // para pruebas y vídeos: las N próximas salen shiny
  let forceLegend = 0;          // dev panel and tests: the next N pulls are Legendary

  const RARITY_NAME = { 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Epic', 5: 'Legendary' };
  const RARITY_COLOR = { 1: '#9fb1c9', 2: '#5fe08a', 3: '#4fb4ff', 4: '#c47bff', 5: '#ffcb3d' };

  // One banner per Minecraft realm (`gen` in the Mobdex).
  const BANNERS = [
    { gen: 1, name: 'Overworld', color: ['#1f5a1c', '#3a7a2a', '#2a5a8a'] },
    { gen: 2, name: 'Nightfall', color: ['#101830', '#2a2a5a', '#1f3a2a'] },
    { gen: 3, name: 'Ocean',     color: ['#0f3a6e', '#1b6a8a', '#123a5a'] },
    { gen: 4, name: 'Village',   color: ['#6a4a1a', '#3a5a2a', '#5a2a1a'] },
    { gen: 5, name: 'Caves',     color: ['#1a1f24', '#2a3a3a', '#0f4a4a'] },
    { gen: 6, name: 'Nether',    color: ['#4a0f0f', '#7a1f1a', '#3a1a2a'] },
    { gen: 7, name: 'The End',   color: ['#1a1030', '#3a2a5a', '#14142a'] }
  ];

  function inBanner(p, gen) { return p.gen === gen && !!G.SPRITE_META[p.dex]; }

  /** Pokémon de una rareza en un banner. */
  function pool(rarity, gen) { return G.DEX.filter(p => inBanner(p, gen) && p.rarity === rarity); }

  /** Pool no vacío más cercano (algunas generaciones tienen rarezas casi vacías). */
  function poolNear(rarity, gen) {
    for (const d of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
      const r = rarity + d;
      if (r < 1 || r > 5) continue;
      const p = pool(r, gen);
      if (p.length) return { rarity: r, list: p };
    }
    return { rarity, list: G.DEX.filter(p => inBanner(p, gen)) };
  }

  /** Pull weight of a mob inside its rarity (Mobdex `pw`, default 1). */
  const weight = p => p.pw ?? 1;
  /** A mob from a list, by pull weight. */
  function pickWeighted(list) {
    const total = list.reduce((a, p) => a + weight(p), 0);
    let x = Math.random() * total;
    for (const p of list) { x -= weight(p); if (x < 0) return p; }
    return list[list.length - 1];
  }

  /**
   * Per-pull odds of each mob of a rarity in a banner, from the listed rates (before the pity and the ×10
   * guarantee, which only add to them): [{ dex, name, pct }], most likely first.
   */
  function odds(rarity, gen) {
    const list = pool(rarity, gen), total = list.reduce((a, p) => a + weight(p), 0);
    const rate = (RATES.find(([r]) => r === rarity) || [0, 0])[1];
    return list.map(p => ({ dex: p.dex, name: p.name, pw: weight(p), pct: rate * weight(p) / total }))
      .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
  }

  function rollRarity(min = 1) {
    const rates = RATES.filter(([r]) => r >= min);
    const total = rates.reduce((a, [, w]) => a + w, 0);
    let x = Math.random() * total;
    for (const [r, w] of rates) { x -= w; if (x <= 0) return r; }
    return rates[rates.length - 1][0];
  }

  /**
   * The banner's art: its 3 strongest Legendaries. A rare lure (pw < 1, Herobrine) always stands among them.
   */
  function featured(gen) {
    const leg = G.DEX.filter(p => inBanner(p, gen) && p.rarity === 5).sort((a, b) => b.bst - a.bst);
    const lure = leg.filter(p => weight(p) < 1);
    return [...lure, ...leg.filter(p => !lure.includes(p))].slice(0, 3).map(p => p.dex);
  }

  /**
   * Hace `n` tiradas en el banner `gen` sobre el guardado `save` (lo modifica).
   * Devuelve null si no hay monedas, o la lista de resultados:
   *   { dex, rarity, shiny, isNew, refund }
   */
  function pull(save, n, gen = 1, use = 't1') {
    const cost = costOf(save, n, use);
    if (!cost) return null;
    save.tickets.t1 -= cost.t1;
    save.tickets.t10 -= cost.t10;
    save.pity = save.pity || {};
    save.shiny = save.shiny || {};
    save.pity[gen] = save.pity[gen] || 0;

    const out = [];
    for (let i = 0; i < n; i++) {
      save.pity[gen]++;
      let want;
      if (forceLegend > 0) { forceLegend--; want = 5; }
      else if (save.pity[gen] >= PITY_5) want = 5;
      else if (n === 10 && i === n - 1 && !out.some(r => r.rarity >= 4)) want = rollRarity(4);
      else want = rollRarity();

      const { rarity, list } = poolNear(want, gen);
      if (rarity === 5) save.pity[gen] = 0;
      let mon = pickWeighted(list);
      let shiny = G.Sprites.hasShiny(mon.dex) && (forceShiny > 0 ? (forceShiny--, true) : Math.random() < SHINY_RATE);
      // Los shiny no se repiten: si ya tienes ese, sale otro de la misma rareza
      // cuyo shiny te falte; si los tienes todos, sale normal.
      if (shiny && save.shiny[mon.dex]) {
        const missing = list.filter(p => G.Sprites.hasShiny(p.dex) && !save.shiny[p.dex]);
        if (missing.length) mon = pickWeighted(missing);
        else shiny = false;
      }

      let isNew = false, refund = 0;
      if (shiny) {
        isNew = !save.shiny[mon.dex];
        if (isNew) save.shiny[mon.dex] = { at: Date.now(), from: 'gacha' };
        else refund = REFUND[rarity] * 3;
        if (!save.owned[mon.dex]) save.owned[mon.dex] = { at: Date.now(), from: 'gacha' };
      } else {
        isNew = !save.owned[mon.dex];
        if (isNew) save.owned[mon.dex] = { at: Date.now(), from: 'gacha' };
        else refund = REFUND[rarity];
      }
      save.coins += refund;
      out.push({ dex: mon.dex, rarity, shiny, isNew, refund });
    }
    save.stats.pulls = (save.stats.pulls || 0) + n;
    return out;
  }

  return { debugForceShiny(n = 1) { forceShiny = n; }, debugForceLegend(n = 10) { forceLegend = n; },
           costOf, RATES, PITY_5, SHINY_RATE, REFUND, RARITY_NAME, RARITY_COLOR, BANNERS,
           pool, featured, pull, weight, odds };
})();
