/* ============ gacha-ui.js — the Spawner: one banner per realm and the spawn animation ============
 * The logic (odds, pity, Enchanted, duplicates) is in systems/gacha.js.
 */
G.GachaUI = (() => {
  const $ = G.UI.$;
  let busy = false;
  let gen = 1;

  function init() {
    $('pull-1').onclick = () => pull(1);
    $('pull-10').onclick = () => pull(10, 't1');
    $('pull-10b').onclick = () => pull(10, 't10');
    $('pull-close').onclick = close;

    const tabs = $('gacha-gens');
    G.Gacha.BANNERS.forEach(b => {
      const t = document.createElement('button');
      t.className = 'gen-tab';
      t.dataset.gen = b.gen;
      t.innerHTML = `<b>${b.name}</b><small>Realm ${b.gen}</small>`;
      t.onclick = () => { gen = b.gen; refresh(); };
      tabs.appendChild(t);
    });
  }

  function open() {
    G.UI.show('scr-gacha', true);
    refresh();
  }

  function refresh() {
    const s = G.DB.save;
    const banner = G.Gacha.BANNERS[gen - 1];
    document.querySelectorAll('#gacha-gens .gen-tab').forEach(t => t.classList.toggle('on', +t.dataset.gen === gen));

    const all = G.DEX.filter(p => p.gen === gen);
    const owned = all.filter(p => s.owned[p.dex]).length;
    const shinies = all.filter(p => s.shiny && s.shiny[p.dex]).length;
    const [c1, c2, c3] = banner.color;
    $('banner').style.background =
      `radial-gradient(circle at 80% 30%, rgba(255,210,63,.3), transparent 45%),
       radial-gradient(circle at 15% 80%, rgba(196,123,255,.3), transparent 50%),
       linear-gradient(135deg, ${c1}, ${c2} 55%, ${c3})`;
    $('banner-title').textContent = banner.name + ' Spawner';
    const realm = /^The /.test(banner.name) ? banner.name : 'the ' + banner.name;
    // A rare lure (Herobrine, pull weight < 1) gets its own line with its odds.
    const legs = G.Gacha.odds(5, gen), lure = legs.filter(o => o.pw < 1);
    $('banner-desc').innerHTML = `The ${all.length} mobs of ${realm} realm. Legendary mobs await!` +
      lure.map(o => `<br><b class="lure">${o.name} lurks in this Spawner: about ${pct(o.pct)} per spawn (1 in ${oneIn(o.pct)}).</b>`).join('');
    $('gacha-owned').innerHTML = `You have ${owned} of ${all.length}` +
      (shinies ? ` · ${G.Icons.html('shiny', 12)} ${shinies} Enchanted` : '');

    const feat = $('gacha-feat');
    feat.innerHTML = '';
    for (const dex of G.Gacha.featured(gen)) {
      feat.appendChild(G.UI.spriteCanvas(dex, 170, 190, { lively: true, scale: 2, dir: 1 }));
    }

    const pity = (s.pity && s.pity[gen]) || 0;
    $('gacha-pity').textContent = `Spawns without a Legendary in ${banner.name}: ${pity} / ${G.Gacha.PITY_5}`;

    $('gacha-rates').innerHTML = '<h3>Odds</h3>' + G.Gacha.RATES.slice().reverse().map(([r, w]) => `
      <div><span style="color:${G.Gacha.RARITY_COLOR[r]}">${G.UI.stars(r, 10)} ${G.Gacha.RARITY_NAME[r]}</span>
      <span>${w}% · ${G.Gacha.pool(r, gen).length}</span></div>`).join('') +
      `<div><span>${G.Icons.html('shiny', 12)} Enchanted</span><span>1%</span></div>
       <h3 class="rates-leg">Legendaries here</h3>` +
      legs.map(o => `<div class="rate-mob${o.pw < 1 ? ' lure' : ''}"><span style="color:${G.Gacha.RARITY_COLOR[5]}">${o.name}</span>
        <span>${pct(o.pct)} per spawn</span></div>`).join('') +
      `<p class="note">· Legendary odds per spawn before the pity, which only raises them.</p>
       <p class="note">· A ×10 spawn always includes at least one Epic.<br>
       · After ${G.Gacha.PITY_5} spawns without a Legendary in a realm, the next one is.<br>
       · Duplicates give emeralds. Enchanted mobs never repeat.<br>
       · Keys are earned by playing: some mobs drop a Trial Key when defeated, and
         bosses and Nether Portal boss mobs sometimes drop an Ominous Key.</p>`;

    const t = s.tickets;
    $('cost-1').innerHTML = `${G.Icons.html('ticket', 18)} 1`;
    $('cost-10').innerHTML = `${G.Icons.html('ticket', 18)} 10`;
    $('cost-10b').innerHTML = `${G.Icons.html('ticket10', 18)} 1`;
    $('gacha-tickets').innerHTML = `You have ${G.Icons.html('ticket', 18)} <b>${t.t1}</b> Trial Keys and ${G.Icons.html('ticket10', 18)} <b>${t.t10}</b> Ominous Keys`;
    $('pull-1').disabled = !G.Gacha.costOf(s, 1);
    $('pull-10').disabled = !G.Gacha.costOf(s, 10, 't1');
    $('pull-10b').disabled = !G.Gacha.costOf(s, 10, 't10');
    G.UI.refreshCoins();
  }

  /** A per-spawn chance (in %) with two significant figures: 0.3%, 0.06%. */
  const pct = x => (x >= 1 ? x.toFixed(2).replace(/\.?0+$/, '') : x.toPrecision(1 + (x >= 0.1)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')) + '%';

  /** "1 in N" for a chance in %, N to two significant figures (1,700). (Pixelify draws "~" like a minus.) */
  const oneIn = x => { const n = 100 / x, k = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return (Math.round(n / k) * k).toLocaleString('en-US'); };

  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function pull(n, use = 't1') {
    if (busy) return;
    const res = G.Gacha.pull(G.DB.save, n, gen, use);
    if (!res) { G.Audio.sfx('error'); G.UI.toast('Not enough keys: earn them by playing'); return; }
    G.Progress.checkAch();
    G.DB.commit(true);
    busy = true;

    const best = Math.max(...res.map(r => r.rarity));
    const fx = $('pull-fx'), slot = $('slot'), out = $('pull-results');
    out.innerHTML = '';
    $('pull-close').classList.add('hidden');
    slot.style.display = '';
    fx.classList.remove('hidden');

    // The Mob Spawner animation (ui/slots.js), then the cards.
    await G.Slots.play(slot, res);
    G.Audio.sfx('burst', { rarity: best });
    slot.style.display = 'none';

    for (const r of res) {
      const mon = G.DEX_BY[r.dex];
      const c = document.createElement('div');
      c.className = 'pcard r' + r.rarity + (r.shiny ? ' shiny' : '');
      c.style.setProperty('--rc', r.shiny ? '#c77dff' : G.Gacha.RARITY_COLOR[r.rarity]);
      c.innerHTML = `<div class="stars">${G.UI.stars(r.rarity, 24)}</div>`;
      c.appendChild(G.UI.spriteCanvas(r.dex, 132, 120, { lively: r.rarity >= 4 || r.shiny, scale: 2, shiny: r.shiny }));
      const tag = r.isNew
        ? `<span class="new">${r.shiny ? 'NEW ENCHANTED!' : 'NEW!'}</span>`
        : `Duplicate · <span class="coin"></span> +${r.refund}`;
      c.insertAdjacentHTML('beforeend', `<b>${r.shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${mon.name}</b><div class="tag">${tag}</div>`);
      out.appendChild(c);
      G.Audio.sfx('reveal', { rarity: r.rarity });
      await wait(n === 10 ? 150 : 0);
    }
    $('pull-close').classList.remove('hidden');
    busy = false;
  }

  function close() {
    $('pull-fx').classList.add('hidden');
    refresh();
  }

  return { init, open, pull, get gen() { return gen; }, get open_() { return !$('pull-fx').classList.contains('hidden'); } };
})();
