/* ============ ranking-ui.js — the leaderboard screen ============
 * Solo / Co-op tabs, period (today … all-time), everyone or friends only, a
 * filter by mob (all-time only) and your own rank at the bottom even when
 * you're not in the top 50. Rows are sorted by deepest floor, then time
 * (net/ranking.js); each shows the characters' sprites, the floor and the time.
 * What's read is cached 30 min (see ranking.js).
 */
G.RankingUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let mode = 's', period = 'w', scope = 'all', dex = null;
  let token = 0;

  function init() {
    const dl = $('rk-dl');
    dl.innerHTML = G.DEX.map(p => `<option value="${esc(p.name)}">`).join('');
    $('rk-poke').onchange = () => {
      const v = $('rk-poke').value.trim().toLowerCase();
      const p = G.DEX.find(x => x.name.toLowerCase() === v);
      if (!v) { setDex(null); return; }
      if (!p) { G.UI.toast('No mob has that name'); return; }
      setDex(p.dex);
    };
    $('rk-clear').onclick = () => { $('rk-poke').value = ''; setDex(null); };
    $('rk-mod').onclick = () => G.ModUI.open();
  }

  /** The per-mob filter exists only all-time: picking one switches to that tab. */
  function setDex(d) {
    dex = d;
    if (d && period !== 'a') period = 'a';
    $('rk-clear').classList.toggle('hidden', !d);
    tabs(); load();
  }

  function open() {
    if (!G.SocialUI.needOnline()) return;
    G.UI.show('scr-rank', true);
    if (!G.Social.started) G.Social.start();
    $('rk-mod').classList.toggle('hidden', !G.Ranking.isAdmin());
    tabs();
    load();
  }

  function tabs() {
    const mk = (box, items, cur, set, cls) => {
      box.innerHTML = '';
      for (const [k, label] of items) {
        const b = document.createElement('button');
        b.className = cls + (k === cur ? ' on' : '');
        b.dataset.k = k;
        b.innerHTML = label;
        b.onclick = () => { set(k); tabs(); load(); };
        box.appendChild(b);
      }
    };
    mk($('rk-mode'), [['s', `<b>${G.Icons.html('user', 16)} Solo</b>`], ['g', `<b>${G.Icons.html('friends', 16)} Co-op</b>`]],
       mode, k => { mode = k; }, 'gen-tab');
    mk($('rk-period'), G.Ranking.PERIODS, period, k => {
      period = k;
      if (k !== 'a' && dex) { dex = null; $('rk-poke').value = ''; $('rk-clear').classList.add('hidden'); }
    }, 'chip');
    mk($('rk-scope'), [['all', 'Everyone'], ['friends', 'Friends only']], scope, k => { scope = k; }, 'chip');
  }

  const fmt = t => t >= 3600 ? Math.floor(t / 3600) + ':' + G.U.mmss(t % 3600).padStart(5, '0') : G.U.mmss(t);

  /** "Floor 4 · The Nether", or "The Aether" for a finished climb (f = floor index 0-8). */
  function floorText(f) {
    const d = G.DIMENSIONS[f | 0] || G.DIMENSIONS[0];
    return (f | 0) === G.Ranking.AETHER ? d.name : 'Floor ' + ((f | 0) + 1) + ' · ' + d.name;
  }
  /** The time of a row: survived (floors 1-8) or how fast the Aether was reached. */
  const timeText = r => ((r.f | 0) === G.Ranking.AETHER ? 'in ' : '') + fmt(r.t || 0);

  async function load() {
    const my = ++token;
    const list = $('rk-list');
    list.innerHTML = '<p class="sub">Loading…</p>';
    $('rk-me').innerHTML = '';
    let rows = [], me = null;
    try {
      [rows, me] = await Promise.all([
        G.Ranking.top(mode, period, dex, scope === 'friends'),
        G.Social.me ? G.Ranking.myRank(mode, period, dex) : Promise.resolve(null)
      ]);
    } catch (e) {
      if (my !== token) return;
      list.innerHTML = '<p class="sub">Couldn\'t load the leaderboard (' + esc(e.code || e.message) + ').</p>';
      return;
    }
    if (my !== token) return;
    list.innerHTML = '';
    if (!rows.length) list.innerHTML = '<p class="sub">No runs here yet. Be the first!</p>';
    const uid = G.Social.uid;
    const b = G.Ranking.board(mode, period, dex), done = G.Ranking.reported();
    rows.forEach((r, i) => list.appendChild(rowEl(r, i + 1, r.uids.includes(uid), b, done)));

    const pn = { d: 'today', w: 'this week', m: 'this month', y: 'this year', a: 'of all time' }[period];
    const where = (mode === 's' ? 'solo' : 'co-op') + (dex ? ' with ' + G.DEX_BY[dex].name : '');
    $('rk-me').innerHTML = !G.Social.me ? 'Choose a nickname (in Friends) to appear on the leaderboard.'
      : me && me.out ? `<span translate="no">You're not in the top 50 ${esc(where)} ${pn} yet. Your exact rank is in All-time.</span>`
      : me ? `<span translate="no">Your best ${esc(where)} rank ${pn}: <b class="gold">#${me.pos}</b> · ${esc(floorText(me.f))} · ${timeText(me)}</span>`
      : `<span translate="no">You don't have a ${esc(where)} run ${pn} yet.</span>`;
  }

  function rowEl(r, pos, mine, b, done) {
    const el = document.createElement('div');
    el.className = 'rk-row' + (mine ? ' mine' : '') + (pos <= 3 ? ' top' + pos : '');
    el.dataset.f = r.f | 0;
    el.insertAdjacentHTML('beforeend', `<span class="pos">${pos <= 3 ? G.Icons.html('trophy', 20) : ''}${pos}</span>`);
    const mons = document.createElement('span');
    mons.className = 'mons';
    r.dex.forEach((d, i) => { if (G.DEX_BY[d]) mons.appendChild(G.UI.spriteCanvas(d, 44, 40, { scale: 1, shiny: !!r.shiny[i] })); });
    el.appendChild(mons);
    const d = G.DIMENSIONS[r.f | 0] || G.DIMENSIONS[0];
    el.insertAdjacentHTML('beforeend',
      `<span class="who"><b translate="no">${r.names.map((n, i) => `<a href="#" class="plink" data-u="${esc(r.uids[i] || '')}">${esc(n)}</a>`).join(' · ')}</b><small translate="no">${r.dex.map(x => esc((G.DEX_BY[x] || {}).name || '?')).join(' · ')} · Lv. ${r.lv || 1} · ${(r.kills || 0).toLocaleString('en')} defeated</small></span>
       <span class="time"><b class="rk-floor" style="color:${esc(d.col || '#fff')}" translate="no">${esc(floorText(r.f))}</b><small>${timeText(r)}</small></span>`);
    el.querySelectorAll('.plink').forEach(a => { a.onclick = e => { e.preventDefault(); G.ProfileUI.show(a.dataset.u); }; });
    // Report a suspicious entry (not yours). The moderator reviews it (mod-ui.js).
    if (!mine && G.Social.me) {
      const rep = document.createElement('button');
      const sent = done.has(b + '__' + r.id);
      rep.className = 'rk-rep' + (sent ? ' sent' : '');
      rep.title = sent ? 'Already reported' : 'Report a suspicious run';
      rep.innerHTML = G.Icons.html('flag', 16);
      rep.onclick = async () => {
        if (rep.classList.contains('sent')) { G.UI.toast('You already reported this run'); return; }
        if (!confirm('Report ' + r.names.join(', ') + '\'s run as cheating?')) return;
        rep.classList.add('sent'); rep.title = 'Already reported';
        await G.Ranking.report(b, r);
        G.UI.toast('Thanks: we\'ll review it');
      };
      el.appendChild(rep);
    } else el.appendChild(document.createElement('span'));
    return el;
  }

  return { init, open, floorText };
})();
