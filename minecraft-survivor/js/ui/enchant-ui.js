/* ============ enchant-ui.js — the Enchanting screen (main menu → Enchanting) ============
 * Four tabs over G.Enchanting (systems/enchanting.js; design in ENCHANTING.md):
 *   Table       pick a character (partner first) and one of its weapons; apply books from the Library
 *   Anvil       two equal books make one of the next level
 *   Grindstone  clear a weapon (the books are lost, some emeralds come back), with a confirm step
 *   Library     every enchantment: levels owned, what it does, what it fits
 */
G.EnchantUI = (() => {
  const $ = G.UI.$;
  const EN = () => G.ENCHANT;
  const X = () => G.Enchanting;
  let tab = 'table', dex = null, skill = null, sure = null, wired = false;

  const roman = l => G.Enchanting.roman(l);
  const coin = n => `<span class="coin"></span> ${n.toLocaleString('en')}`;
  const book = (id, l) => `${EN().BY[id].name} ${roman(l)}`;
  const STATE = { locked: 'Locked', unlocked: 'Unlocked', mastered: 'Mastered' };
  /** Skill icon, with the purple glint when it carries enchantments. */
  const skillIco = (id, size, glint) => `<span class="ench-ico${glint ? ' glint' : ''}">${G.Icons.html('move:' + id, size)}</span>`;

  function open(t = null) {
    if (t) tab = t;
    if (!wired) {
      wired = true;
      $('ench-ico').innerHTML = G.Icons.html('blocks/enchanting_table_side', 26);
      document.querySelectorAll('#ench-tabs .tab').forEach(el => {
        el.onclick = () => { tab = el.dataset.tab; sure = null; render(); };
      });
    }
    const s = G.DB.save;
    if (dex == null || !s.owned[dex]) { dex = s.partner; skill = null; }
    G.UI.show('scr-ench', true);
    render();
  }

  function render() {
    document.querySelectorAll('#ench-tabs .tab').forEach(el => el.classList.toggle('on', el.dataset.tab === tab));
    $('ench-mastered').textContent = `· Mastered ${X().speciesMastered()} / ${X().species().length} · ${X().bookCount()} books in your Library`;
    const box = $('ench-body');
    box.innerHTML = '';
    box.dataset.tab = tab;
    if (tab === 'table') table(box);
    else if (tab === 'anvil') anvil(box);
    else if (tab === 'grind') grind(box);
    else library(box);
    G.UI.refreshCoins();
  }

  // ---------------- Table ----------------

  function table(box) {
    const s = G.DB.save;
    const rank = d => (d === s.partner ? 0 : { mastered: 1, unlocked: 2, locked: 3 }[X().mastery(d)]);
    const mons = Object.keys(s.owned).map(Number).filter(d => G.DEX_BY[d]).sort((a, b) => rank(a) - rank(b) || a - b);
    const wrap = document.createElement('div');
    wrap.className = 'ench-table';
    const list = document.createElement('div');
    list.className = 'panel ench-list';
    list.innerHTML = `<b class="ench-h">Characters</b>` + mons.map(d => {
      const st = X().mastery(d);
      return `<button class="ench-pick ${st}${d === dex ? ' on' : ''}" data-dex="${d}">
        <span>${G.DEX_BY[d].name}${d === s.partner ? ' ' + G.Icons.html('crown', 12) : ''}</span>
        <small class="st-${st}">${st === 'locked' ? G.Icons.html('ban', 10) + ' ' : ''}${STATE[st]}</small></button>`;
    }).join('');
    list.querySelectorAll('[data-dex]').forEach(b => {
      b.onclick = () => { dex = +b.dataset.dex; skill = null; G.Audio.sfx('select'); render(); };
    });
    wrap.appendChild(list);
    wrap.appendChild(detail());
    box.appendChild(wrap);
    // Keep the selected character in view.
    const on = list.querySelector('.ench-pick.on');
    if (on) list.scrollTop = Math.max(0, on.offsetTop - list.clientHeight / 2);
  }

  function detail() {
    const s = G.DB.save, mon = G.DEX_BY[dex], st = X().mastery(dex);
    const el = document.createElement('div');
    el.className = 'ench-detail';
    const sig = G.startMoveOf(dex);
    const head = document.createElement('div');
    head.className = 'ench-head';
    head.innerHTML = `<canvas class="stage ench-stage ${st === 'mastered' ? 'ench-master' : st === 'unlocked' ? 'ench-on' : ''}" width="110" height="92"></canvas>
      <div class="grow"><h3>${mon.name}</h3>
        <div>${G.UI.typeChips(mon.types)} <b class="st-${st}">${STATE[st]}</b></div>
        <p class="sub" style="margin:4px 0 0">Signature weapon: <b class="gold">${G.Moves.BY_ID[sig].name}</b>.
          ${st === 'mastered' ? 'Three max-level enchantments: this character is Mastered!' : 'Three max-level enchantments on it master this character.'}</p></div>`;
    el.appendChild(head);
    G.UI.sprite(head.querySelector('canvas'), dex, { lively: true, scale: 2, hero: true });

    if (st === 'locked') {
      const n = X().bookCount();
      el.insertAdjacentHTML('beforeend', `<div class="panel ench-locked">
        ${G.Icons.html('blocks/enchanting_table_side', 32)}
        <div><b>Defeat the Ender Dragon with this character to unlock enchanting</b>
        <p class="sub" style="margin:4px 0 0">${n ? `${n} ${n === 1 ? 'book is' : 'books are'} waiting in your Library.` : 'Enchanted Books drop from bosses: they wait in your Library until you unlock a character.'}</p></div></div>
        <p class="sub" style="margin:10px 0 4px">Its weapons</p>
        <p class="move-icons">${X().weapons(dex).map(id => `<span title="${G.Moves.BY_ID[id].name}">${G.Icons.html('move:' + id, 22)}</span>`).join('')}</p>`);
      return el;
    }

    const ws = X().weapons(dex);
    if (!skill || !ws.includes(skill)) skill = sig;
    const rows = document.createElement('div');
    rows.className = 'ench-weapons';
    for (const id of ws) {
      const d = G.Moves.BY_ID[id], list = X().listFor(dex, id), t = X().weaponType(id);
      const r = document.createElement('button');
      r.className = 'ench-weapon' + (id === skill ? ' on' : '') + (id === sig ? ' sig' : '');
      r.dataset.sk = id;
      r.innerHTML = `${skillIco(id, 40, list.length)}
        <span class="nm">${d.name}${id === sig ? ' <span class="tag-chip" style="background:var(--gold)">Signature</span>' : ''}
          <small>${EN().TYPES[t].name}</small>
          <span class="ench-slots">${[0, 1, 2].map(i => slot(list[i])).join('')}</span></span>`;
      r.onclick = () => { skill = id; G.Audio.sfx('select'); render(); };
      rows.appendChild(r);
    }
    const work = document.createElement('div');
    work.className = 'ench-work';
    work.append(rows, books(s));
    el.appendChild(work);
    // Keep the selected weapon in view.
    requestAnimationFrame(() => { const on = rows.querySelector('.on'); if (on) rows.scrollTop = Math.max(0, on.offsetTop - rows.offsetTop - 40); });
    return el;
  }

  function slot(x) {
    if (!x) return '<span class="ench-slot empty">Empty slot</span>';
    const [id, l] = x, max = l >= EN().BY[id].max;
    return `<span class="ench-slot${max ? ' max' : ''}">${book(id, l)}</span>`;
  }

  /** The books from the Library that fit the selected weapon, each with its cost. */
  function books(s) {
    const t = X().weaponType(skill), d = G.Moves.BY_ID[skill];
    const fits = EN().LIST.filter(e => e.types.includes(t) || e.types.includes('any'));
    const p = document.createElement('div');
    p.className = 'panel ench-books';
    const items = [];
    for (const e of fits) for (let l = e.max; l >= 1; l--) {
      const n = (s.books[e.id] || [])[l - 1] || 0;
      if (n) items.push({ e, l, n, why: X().whyNot(dex, skill, e.id, l) });
    }
    // The ones you can apply first (a missing emerald still counts as "can").
    const can = it => !it.why || it.why === 'Not enough emeralds';
    items.sort((a, b) => can(b) - can(a));
    p.innerHTML = `<b class="ench-h">${skillIco(skill, 20, X().listFor(dex, skill).length)} ${d.name} · ${EN().TYPES[t].name}: books that fit</b>
      <p class="sub ench-fits">Fits: ${fits.map(e => e.name).join(', ')}. Applying costs 120 × level² emeralds; a higher level of an enchantment it already has upgrades that slot.</p>`;
    if (!items.length) p.insertAdjacentHTML('beforeend', '<p class="note" style="margin:0">No books for this weapon in your Library yet. Defeat bosses to find them.</p>');
    for (const { e, l, n, why } of items) {
      const row = document.createElement('div');
      row.className = 'ench-book';
      row.innerHTML = `<span class="ench-ico glint">${G.Icons.html('book', 24)}</span>
        <div class="grow"><b class="ench-txt">${book(e.id, l)}</b> <small>×${n}</small><div class="ds">${e.text(l)}</div>
          ${why && why !== 'Not enough emeralds' ? `<div class="why">${why}</div>` : ''}</div>
        <button class="btn small ${why ? '' : 'gold'}" data-sfx="none" ${why ? 'disabled' : ''}>Apply · ${coin(EN().COST.apply(l))}</button>`;
      row.querySelector('button').onclick = () => {
        const r = X().apply(dex, skill, e.id, l);
        if (r !== true) { G.UI.toast(r); render(); return; }
        G.Audio.sfx('legend');
        G.UI.toast(`${G.DEX_BY[dex].name} · ${G.Moves.BY_ID[skill].name}: ${book(e.id, l)}!`);
        if (X().mastery(dex) === 'mastered') G.UI.toast(G.DEX_BY[dex].name + ' is Mastered!', 3200);
        render();
      };
      p.appendChild(row);
    }
    return p;
  }

  // ---------------- Anvil ----------------

  function anvil(box) {
    const s = G.DB.save;
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = `<b class="ench-h">${G.Icons.html('blocks/anvil_top_damaged_0', 18)} Anvil</b>
      <p class="sub" style="margin:2px 0 10px">Two books of the same enchantment and level make one book of the next level, up to its max.</p>`;
    let any = false;
    for (const e of EN().LIST) for (let l = 1; l < e.max; l++) {
      const n = (s.books[e.id] || [])[l - 1] || 0;
      if (n < 2) continue;
      any = true;
      const cost = EN().COST.combine(l + 1);
      const row = document.createElement('div');
      row.className = 'ench-book';
      row.innerHTML = `<span class="ench-ico glint">${G.Icons.html('book', 24)}</span><span class="ench-ico glint">${G.Icons.html('book', 24)}</span>
        <div class="grow"><b>${book(e.id, l)} + ${book(e.id, l)}</b> <small>(you have ${n})</small>
          <div class="ds">→ <b class="ench-txt">${book(e.id, l + 1)}</b>: ${e.text(l + 1)}</div></div>
        <button class="btn small ${s.coins >= cost ? 'gold' : ''}" data-sfx="none" ${s.coins >= cost ? '' : 'disabled'}>Combine · ${coin(cost)}</button>`;
      row.querySelector('button').onclick = () => {
        const r = X().combine(e.id, l);
        if (r !== true) { G.UI.toast(r); render(); return; }
        G.Audio.sfx('buy');
        G.UI.toast('Anvil: ' + book(e.id, l + 1) + '!');
        render();
      };
      p.appendChild(row);
    }
    if (!any) p.insertAdjacentHTML('beforeend', '<p class="note" style="margin:0">No pairs yet: you need two books of the same enchantment and level (below its max).</p>');
    box.appendChild(p);
  }

  // ---------------- Grindstone ----------------

  function grind(box) {
    const s = G.DB.save;
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = `<b class="ench-h">${G.Icons.html('blocks/grindstone_side', 18)} Grindstone</b>
      <p class="sub" style="margin:2px 0 10px">Removes every enchantment from a weapon. The books are lost, and some emeralds come back.</p>`;
    let any = false;
    for (const d of Object.keys(s.ench).map(Number).filter(d => G.DEX_BY[d]).sort((a, b) => a - b)) {
      for (const id of Object.keys(s.ench[d])) {
        const list = X().listFor(d, id);
        if (!list.length) continue;
        any = true;
        const key = d + '/' + id, back = X().refundOf(d, id);
        const row = document.createElement('div');
        row.className = 'ench-book';
        row.innerHTML = `${skillIco(id, 40, true)}
          <div class="grow"><b>${G.DEX_BY[d].name} · ${G.Moves.BY_ID[id].name}</b><div class="ds ench-txt">${X().listText(list)}</div></div>
          ${sure === key
            ? `<span class="why">Lose ${list.length} ${list.length === 1 ? 'enchantment' : 'enchantments'}?</span>
               <button class="btn small gold" data-yes data-sfx="none">Remove · +${coin(back)}</button><button class="btn small ghost" data-no>Cancel</button>`
            : `<button class="btn small" data-rm>Remove…</button>`}`;
        const rm = row.querySelector('[data-rm]'), yes = row.querySelector('[data-yes]'), no = row.querySelector('[data-no]');
        if (rm) rm.onclick = () => { sure = key; render(); };
        if (no) no.onclick = () => { sure = null; render(); };
        if (yes) yes.onclick = () => {
          const got = X().removeAll(d, id);
          sure = null;
          if (got !== false) { G.Audio.sfx('break'); G.UI.toast(`${G.Moves.BY_ID[id].name} is clean again · +${got} emeralds`); }
          render();
        };
        p.appendChild(row);
      }
    }
    if (!any) p.insertAdjacentHTML('beforeend', '<p class="note" style="margin:0">No enchanted weapons yet.</p>');
    box.appendChild(p);
  }

  // ---------------- Library ----------------

  function library(box) {
    const s = G.DB.save;
    const p = document.createElement('div');
    p.className = 'ench-lib';
    for (const t of [...Object.keys(EN().TYPES), 'any']) {
      const list = EN().LIST.filter(e => e.types[0] === t);
      if (!list.length) continue;
      const T = EN().TYPES[t];
      p.insertAdjacentHTML('beforeend', `<h3 class="ench-lib-h">${G.Icons.html(T ? T.icon : 'book', 18)} ${T ? T.name : 'Any weapon'}
        <small class="sub">${T ? T.desc : 'Every weapon'}</small></h3>`);
      for (const e of list) {
        const have = s.books[e.id] || [];
        const total = have.reduce((a, b) => a + b, 0);
        const fits = e.types.includes('any') ? 'Any weapon' : e.types.map(x => EN().TYPES[x].name).join(', ');
        p.insertAdjacentHTML('beforeend', `<div class="panel ench-lib-row${total ? '' : ' none'}">
          <span class="ench-ico${total ? ' glint' : ''}">${G.Icons.html('book', 28)}</span>
          <div class="grow"><b class="${total ? 'ench-txt' : ''}">${e.name}</b> <small class="sub">max ${roman(e.max)} · ${fits}${e.excl.length ? ' · not with ' + e.excl.map(x => EN().BY[x].name).join(', ') : ''}</small>
            <div class="ds">${e.text(1)}${e.max > 1 ? ` (at ${roman(e.max)}: ${e.text(e.max)})` : ''}</div></div>
          <div class="ench-lvls">${Array.from({ length: e.max }, (_, i) => `<span class="${have[i] ? 'on' : ''}">${roman(i + 1)}<b>×${have[i] || 0}</b></span>`).join('')}</div>
        </div>`);
      }
    }
    box.appendChild(p);
  }

  return { open, render, get dex() { return dex; }, get skill() { return skill; }, get tab() { return tab; } };
})();
