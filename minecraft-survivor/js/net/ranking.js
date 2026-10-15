/* ============ ranking.js — the leaderboard: deepest floor, then time ============
 * A run is ranked by the deepest floor it reached (f: 0 = the Overworld … 7 =
 * Herobrine's World, 8 = the Aether), then by time:
 *   - on floors 0-7, the longer you survived the better (t = the run clock when it ended);
 *   - in the Aether, the faster the better (t = the run clock when you arrived; the
 *     Aether is peaceful, so wandering there afterwards doesn't count).
 * Both fold into one sortable score (higher is better), checked by the rules:
 *   s = f * 100000 + (f == 8 ? 99999 - t : t)
 *
 * Firestore (built to spend as little of the free Spark plan as possible):
 *
 *   lbs/{board}        SUMMARY: the board's top 50 in ONE document
 *                      { top: { id: { f, s, t, uids, names, dex, shiny, lv, kills } }, me, ev }
 *                      Viewing a tab = 1 read.
 *   lb/{board}/e/{id}  each player's (or team's) best entry, validated by the rules
 *                      (firestore.rules, validEntry: anti-cheat)
 *
 *   board = mode + period:
 *     s_d20261014   solo, today             g_...   co-op (2-4 players)
 *     s_w2026-42    ISO week                s_m202610  month
 *     s_all         all-time
 *     s_all_p25     all-time with mob 25 only (the per-mob filter exists only all-time)
 *   id = your uid (solo) or the team's uids, sorted and joined with "_".
 *
 * Savings (kept from PokéSurvivor):
 *   - what's read is cached 30 min in the browser;
 *   - your best entries are remembered in the browser, so ending a run reads nothing
 *     and only writes where you improve;
 *   - the summary is only touched when you enter the top 50;
 *   - daily, weekly, monthly and per-mob boards keep only top-50 entries.
 *
 * Periods follow the online config's `timeZone` (default UTC).
 */
G.Ranking = (() => {
  const TZ = () => (G.ONLINE && G.ONLINE.timeZone) || 'UTC';
  const PERIODS = [['d', 'Today'], ['w', 'This week'], ['m', 'This month'], ['a', 'All-time']];
  const AETHER = 8;                       // floor index of the Aether (the end of the climb)
  /** The sortable score of a run (see above). */
  const score = (f, t) => f * 100000 + (f === AETHER ? 99999 - t : t);
  // Periodos en los que sólo se guarda el top 50 (ver arriba).
  // ('p' = histórico de un Pokémon: casi cada partida entraba en el de su
  //  Pokémon y escribía; ahora también sólo el top 50.)
  const TOP_ONLY = new Set(['d', 'w', 'm', 'p']);
  const TOP = 50;
  // Las runs de menos de 1 minuto no se suben (casi nunca entran en una tabla
  // y eran muchas lecturas y escrituras para nada).
  const MIN_T = 60;
  const TTL = 30 * 60 * 1000;            // caché de lo leído (30 min: menos lecturas de Firestore)

  const fbx = () => G.DB.online ? G.DB.fb : null;

  // ---------------- periodos ----------------

  function madridDate(date) {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: TZ(), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)) p[x.type] = x.value;
    return { y: +p.year, m: +p.month, d: +p.day };
  }

  /** Semana ISO (lunes a domingo) de una fecha y-m-d. */
  function isoWeek(y, m, d) {
    const t = new Date(Date.UTC(y, m - 1, d));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
  }

  const ALL = 'all';                      // all-time (see above)
  function periodIds(date = new Date()) {
    const { y, m, d } = madridDate(date);
    const w = isoWeek(y, m, d);
    const p2 = n => String(n).padStart(2, '0');
    return { d: 'd' + y + p2(m) + p2(d), w: 'w' + w.year + '-' + p2(w.week), m: 'm' + y + p2(m), y: 'y' + y, a: ALL };
  }

  /** El filtro por Pokémon sólo existe en el histórico. */
  function board(mode, period, dex) {
    return mode + '_' + periodIds()[period] + (dex && period === 'a' ? '_p' + dex : '');
  }

  const col = b => fbx().fs.collection('lb').doc(b).collection('e');
  const sumRef = b => fbx().fs.collection('lbs').doc(b);

  // ---------------- caché en el navegador ----------------

  const mem = new Map();                 // clave -> { at, v }
  function cacheGet(k) {
    let c = mem.get(k);
    if (!c) { try { c = JSON.parse(localStorage.getItem('ps.rk.c.' + k) || 'null'); } catch (e) { c = null; } if (c) mem.set(k, c); }
    return c && Date.now() - c.at < TTL ? c.v : undefined;
  }
  function cacheSet(k, v) {
    const c = { at: Date.now(), v };
    mem.set(k, c);
    try { localStorage.setItem('ps.rk.c.' + k, JSON.stringify(c)); } catch (e) { /* lleno */ }
  }
  /** Borra lo caducado (la caché del navegador no crece sin límite). */
  function cachePrune() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('ps.rk.c.')) continue;
        const c = JSON.parse(localStorage.getItem(k) || 'null');
        if (!c || Date.now() - c.at > TTL) localStorage.removeItem(k);
      }
    } catch (e) { /* nada */ }
  }
  cachePrune();

  // Tus mejores marcas por tabla (para no leer antes de escribir).
  // (best2 desde 2026-10-12: se quitaron del ranking las marcas rotas; así quien
  //  tenía una vuelve a mirar su marca real y puede volver a entrar.)
  const bestKey = () => 'ps.rk.best2.' + (fbx() ? fbx().uid : '');
  function bests() { try { return JSON.parse(localStorage.getItem(bestKey()) || '{}'); } catch (e) { return {}; } }
  function saveBests(b) {
    // Sólo se conservan las tablas de los periodos actuales y las históricas.
    const cur = Object.values(periodIds());
    for (const k of Object.keys(b)) if (!cur.some(p => k.split(':')[0].split('_')[1] === p)) delete b[k];
    try { localStorage.setItem(bestKey(), JSON.stringify(b)); } catch (e) { /* lleno */ }
  }

  // ---------------- guardar ----------------

  const rowOf = (id, v) => ({ id, f: v.f | 0, s: v.s || 0, t: v.t, uids: v.uids || [], names: v.names || [], dex: v.dex || [], shiny: v.shiny || [], lv: v.lv, kills: v.kills });
  // Deepest floor first, then time (the score folds both; see above).
  const sorted = top => Object.entries(top || {}).map(([id, v]) => rowOf(id, v)).sort((a, b) => b.s - a.s);
  const now = () => firebase.firestore.FieldValue.serverTimestamp();

  // ---------------- anti-trampas ----------------

  /**
   * Al empezar cada partida (en grupo, el anfitrión) el servidor apunta la
   * hora: ninguna marca puede durar más que el tiempo real desde entonces
   * (firestore.rules, validEntry). Antes se espera a que acabe de subirse la
   * marca de la partida anterior, para no cambiarle la hora a mitad.
   */
  let busy = Promise.resolve();
  function runStarted(mode) {
    const fb = fbx();
    if (!fb) return;
    const go = n => fb.fs.collection('runs').doc(fb.uid).set({ startedAt: now(), mode })
      .catch(e => { console.warn('[Ranking] run start:', e.code || e.message); if (n < 2) setTimeout(() => go(n + 1), 15000); });
    busy.then(() => go(0));
  }
  /** La subida de una marca (para que la partida siguiente espere a que acabe). */
  function track(p) { busy = p.catch(() => {}); return p; }

  /** Guarda la entrada en cada tabla donde mejore. → periodos mejorados */
  async function store(boards, id, entry) {
    const fb = fbx();
    const better = [];
    const known = bests();
    await Promise.all(boards.map(async ([b, period]) => {
      const key = b + ':' + id;
      try {
        // ¿Ya tenías una marca mejor? Si este navegador no lo sabe, se mira una vez.
        if (known[key] === undefined) {
          if (TOP_ONLY.has(period)) {
            // En estas tablas sólo hay marcas en el top 50: basta con el resumen
            // (que además se guarda 30 min y es el mismo que se lee al mirar el ranking).
            const top = await summary(b);
            known[key] = top[id] ? top[id].s || 0 : 0;
          } else {
            const old = await col(b).doc(id).get();
            known[key] = old.exists ? old.data().s || 0 : 0;
          }
        }
        if (known[key] >= entry.s) return;
        const data = Object.assign({}, entry, { at: firebase.firestore.FieldValue.serverTimestamp() });
        // Si la tabla ya está llena y no llegas al top 50, no hace falta tocar el resumen
        // (y en diario, semanal y mensual, ni siquiera se guarda la marca).
        const topOnly = TOP_ONLY.has(period);
        const cached = cacheGet('s:' + b);
        const full = cached && Object.keys(cached).length >= TOP;
        const minS = full ? Math.min(...Object.values(cached).map(v => v.s || 0)) : 0;
        if (full && entry.s <= minS && !(id in cached)) {
          if (!topOnly) await col(b).doc(id).set(data);
          else { known[key] = entry.s; return; }
        } else {
          let entered = true;
          let newTop = null;
          await fb.fs.runTransaction(async tx => {
            const s = await tx.get(sumRef(b));
            const top = Object.assign({}, s.exists ? s.data().top : {});
            const mine = { f: entry.f, s: entry.s, t: entry.t, uids: entry.uids, names: entry.names, dex: entry.dex, shiny: entry.shiny, lv: entry.lv, kills: entry.kills };
            let ev = '';
            // Ya estabas con una marca mejor (otro ordenador): nada que escribir.
            if (id in top && (top[id].s || 0) >= entry.s) { entered = false; newTop = top; return; }
            if (!(id in top) && Object.keys(top).length >= TOP) {
              const low = sorted(top).pop();
              if (low.s >= entry.s) {                                // no entra en el top
                if (!topOnly) tx.set(col(b).doc(id), data);
                entered = false; newTop = top; return;
              }
              ev = low.id; delete top[ev];
            }
            tx.set(col(b).doc(id), data);
            top[id] = mine;
            tx.set(sumRef(b), { top, me: id, ev });
            newTop = top;
          });
          if (newTop) cacheSet('s:' + b, newTop);
          if (topOnly && !entered) { known[key] = entry.s; return; }
        }
        known[key] = entry.s;
        if (b.startsWith('g_')) known[b + ':*'] = Math.max(known[b + ':*'] || 0, entry.s);
        mem.delete('r:' + b); try { localStorage.removeItem('ps.rk.c.r:' + b); } catch (e) { /* nada */ }
        if (period && period !== 'p' && !better.includes(period)) better.push(period);
      } catch (e) { console.warn('[Ranking] could not save to', b, e.code || e.message); }
    }));
    saveBests(known);
    return better;
  }

  function announce(better) {
    if (!better.length) return;
    const names = { d: 'today\'s', w: 'this week\'s', m: 'this month\'s', a: 'the all-time' };
    const best = PERIODS.map(p => p[0]).filter(p => better.includes(p)).pop();
    G.UI.toast('New best on ' + names[best] + ' leaderboard!', 3400);
  }

  /**
   * The entry of a run: r = { f (floor index 0-8), t (seconds; in the Aether, when you arrived), lv, kills, ... }.
   * Runs shorter than a minute on the first floor aren't uploaded.
   */
  const base = r => {
    const f = Math.max(0, Math.min(AETHER, r.f | 0)), t = Math.max(0, Math.floor(r.t));
    return { f, s: score(f, t), t, lv: Math.max(1, r.lv | 0), kills: Math.max(0, r.kills | 0) };
  };
  const worth = r => r.t >= MIN_T || (r.f | 0) > 0;

  function submitSolo(r) { return track(submitSoloNow(r)); }
  async function submitSoloNow(r) {
    const fb = fbx();
    if (!fb || !G.Social.me || !worth(r)) return [];
    const ids = periodIds();
    const entry = Object.assign(base(r), { uids: [fb.uid], names: [G.Social.me.name], dex: [r.dex], shiny: [!!r.shiny] });
    const boards = PERIODS.map(([p]) => ['s_' + ids[p], p]);
    boards.push(['s_' + ALL + '_p' + r.dex, 'p']);
    const better = await store(boards, fb.uid, entry);
    announce(better);
    return better;
  }

  /** La sube el anfitrión, con todo el equipo. */
  function submitGroup(r) { return track(submitGroupNow(r)); }
  async function submitGroupNow(r) {
    const fb = fbx();
    if (!fb || !worth(r) || !r.members || r.members.length < 2) return [];
    const ms = r.members.slice().sort((a, b) => (a.uid < b.uid ? -1 : 1));
    const id = ms.map(m => m.uid).join('_');
    const entry = Object.assign(base(r), { uids: ms.map(m => m.uid), names: ms.map(m => m.name), dex: ms.map(m => m.dex),
                    shiny: ms.map(m => !!m.shiny) });
    const ids = periodIds();
    const boards = PERIODS.map(([p]) => ['g_' + ids[p], p]);
    for (const d of new Set(entry.dex)) boards.push(['g_' + ALL + '_p' + d, 'p']);
    const better = await store(boards, id, entry);
    announce(better);
    return better;
  }

  // ---------------- leer ----------------

  /** El top 50 de una tabla (1 lectura, o 0 si se leyó hace menos de 30 min). */
  const inflight = new Map();             // tabla -> lectura en curso (la lista y tu puesto la comparten)
  async function summary(b) {
    const c = cacheGet('s:' + b);
    if (c !== undefined) return c;
    if (!inflight.has(b)) {
      inflight.set(b, sumRef(b).get().then(s => {
        const top = s.exists ? (s.data().top || {}) : {};
        cacheSet('s:' + b, top);
        return top;
      }).finally(() => inflight.delete(b)));
    }
    return inflight.get(b);
  }

  /**
   * Mejores marcas de una tabla.
   * @param friendsOnly  sólo tú y tus amigos
   */
  async function top(mode, period, dex, friendsOnly) {
    const fb = fbx();
    if (!fb) return [];
    const b = board(mode, period, dex);
    const rows = sorted(await summary(b));
    if (!friendsOnly) return rows.slice(0, TOP);
    const circle = [fb.uid, ...G.Social.friends.filter(f => f.status === 'ok').map(f => f.uid)].slice(0, 30);
    const inTop = rows.filter(r => r.uids.some(u => circle.includes(u)));
    // En diario, semanal, mensual y por Pokémon no hay marcas fuera del top 50.
    if (TOP_ONLY.has(period) || dex) return inTop;
    // Los amigos que no están en el top 50: se buscan aparte (y se guardan 30 min).
    const ck = 'f:' + b + ':' + circle.slice().sort().join(',');
    let extra = cacheGet(ck);
    if (extra === undefined) {
      if (mode === 's') {
        const missing = circle.filter(u => !inTop.some(r => r.id === u));
        const docs = await Promise.all(missing.map(u => col(b).doc(u).get().catch(() => null)));
        extra = docs.filter(d => d && d.exists).map(d => rowOf(d.id, d.data()));
      } else {
        const s = await col(b).where('uids', 'array-contains-any', circle).get();
        extra = s.docs.map(d => rowOf(d.id, d.data()));
      }
      cacheSet(ck, extra);
    }
    const all = new Map();
    for (const r of [...inTop, ...extra]) all.set(r.id, r);
    return [...all.values()].sort((a, c) => c.s - a.s).slice(0, TOP);
  }

  /** Tu puesto en la tabla (aunque no salgas en el top). → { pos, f, t, row } | null */
  async function myRank(mode, period, dex) {
    const fb = fbx();
    if (!fb) return null;
    const b = board(mode, period, dex);
    // ¿Estás en el top 50? Entonces el puesto sale del resumen, sin gastar nada.
    const rows = sorted(await summary(b));
    const i = rows.findIndex(r => r.uids.includes(fb.uid));
    if (i >= 0) return { pos: i + 1, f: rows[i].f, t: rows[i].t, row: rows[i] };
    if (TOP_ONLY.has(period) || dex) return { out: true };
    const ck = 'r:' + b;
    const c = cacheGet(ck);
    if (c !== undefined) return c;
    // Si este navegador ya sabe que no tienes marca en esta tabla, no se mira.
    const kb = bests(), mk = b + ':' + (mode === 's' ? fb.uid : '*');
    if (kb[mk] === 0) { cacheSet(ck, null); return null; }
    let mine = null;
    if (mode === 's') {
      const d = await col(b).doc(fb.uid).get();
      if (d.exists) mine = rowOf(d.id, d.data());
    } else {
      const s = await col(b).where('uids', 'array-contains', fb.uid).get();
      for (const d of s.docs) { const r = rowOf(d.id, d.data()); if (!mine || r.s > mine.s) mine = r; }
    }
    kb[mk] = mine ? mine.s : 0;
    saveBests(kb);
    let res = null;
    if (mine) res = { pos: (await countAbove(b, mine.s)) + 1, f: mine.f, t: mine.t, row: mine };
    cacheSet(ck, res);
    return res;
  }

  /**
   * Cuántas entradas tienen más puntuación (score s). La versión "compat" del SDK no trae
   * count(), así que se usa la API REST de agregación (1 lectura por cada
   * 1.000 entradas, en vez de leerlas todas). Sólo se usa si no estás en el top 50.
   */
  async function countAbove(b, sc) {
    const fb = fbx();
    const cfg = G.DB.config;
    const api = fb.emulator ? `http://${fb.emulator.host}:${fb.emulator.firestore}/v1` : 'https://firestore.googleapis.com/v1';
    const url = `${api}/projects/${cfg.projectId}/databases/(default)/documents/lb/${encodeURIComponent(b)}:runAggregationQuery`;
    const token = await fb.auth.currentUser.getIdToken();
    const body = { structuredAggregationQuery: {
      structuredQuery: { from: [{ collectionId: 'e' }],
        where: { fieldFilter: { field: { fieldPath: 's' }, op: 'GREATER_THAN', value: { integerValue: String(sc) } } } },
      aggregations: [{ alias: 'n', count: {} }] } };
    try {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      const n = j && j[0] && j[0].result && j[0].result.aggregateFields && j[0].result.aggregateFields.n;
      return n ? +n.integerValue : 0;
    } catch (e) {
      console.warn('[Ranking] rank:', e.message);
      return 0;
    }
  }

  /** Al borrar la cuenta: quita tus filas de los resúmenes que conoce este navegador. */
  async function removeMine() {
    const fb = fbx();
    if (!fb) return;
    const ids = periodIds();
    const boards = new Set();
    for (const m of ['s', 'g']) for (const [p] of PERIODS) boards.add(m + '_' + ids[p]);
    for (const k of Object.keys(bests())) boards.add(k.split(':')[0]);
    await Promise.all([...boards].map(b => fb.fs.runTransaction(async tx => {
      const s = await tx.get(sumRef(b));
      if (!s.exists) return;
      const top = s.data().top || {};
      for (const [id, v] of Object.entries(top)) {
        if (!(v.uids || []).includes(fb.uid)) continue;
        // Una fila por escritura (las reglas sólo dejan quitar una cada vez).
        const next = Object.assign({}, top); delete next[id];
        tx.set(sumRef(b), { top: next, me: '', ev: id });
        return;
      }
    }).catch(() => {})));
    try { localStorage.removeItem(bestKey()); } catch (e) { /* nada */ }
  }

  // ---------------- reportes y moderación ----------------

  /** Reporta una marca sospechosa (una vez por marca y jugador). → true si se ha enviado */
  const repKey = () => 'ps.rk.rep.' + (fbx() ? fbx().uid : '');
  function reported() { try { return new Set(JSON.parse(localStorage.getItem(repKey()) || '[]')); } catch (e) { return new Set(); } }
  async function report(b, row) {
    const fb = fbx();
    if (!fb) return false;
    const key = b + '__' + row.id;
    const done = reported();
    if (!done.has(key)) {
      // (Si ya lo habías reportado desde otro ordenador, el servidor no deja repetirlo: da igual.)
      await fb.fs.collection('reports').doc(key + '__' + fb.uid)
        .set({ board: b, e: row.id, names: row.names.slice(0, 4), f: row.f | 0, t: row.t | 0, by: fb.uid, at: now() }).catch(() => {});
      done.add(key);
      try { localStorage.setItem(repKey(), JSON.stringify([...done].slice(-300))); } catch (e) { /* lleno */ }
    }
    return true;
  }

  // Moderators (the online config's `admins`; the same uids go into firestore.rules admin() via
  // server/make-rules.mjs): the hidden screen in js/ui/mod-ui.js.
  const ADMINS = () => (G.ONLINE && Array.isArray(G.ONLINE.admins) ? G.ONLINE.admins : []);
  const isAdmin = () => !!fbx() && ADMINS().includes(fbx().uid);

  /** Admin: los reportes, juntos por marca (los más reportados primero). */
  async function reports() {
    const s = await fbx().fs.collection('reports').orderBy('at', 'desc').limit(400).get();
    const by = new Map();
    for (const d of s.docs) {
      const v = d.data(), k = v.board + '__' + v.e;
      if (!by.has(k)) by.set(k, { board: v.board, e: v.e, names: v.names || [], f: v.f | 0, t: v.t, n: 0, ids: [], at: v.at && v.at.toMillis ? v.at.toMillis() : 0 });
      const g = by.get(k); g.n++; g.ids.push(d.id);
    }
    return [...by.values()].sort((a, b) => b.n - a.n || b.at - a.at);
  }

  /** Admin: quita una marca de una tabla (la marca y su fila del top 50). */
  async function removeEntry(b, e) {
    const fb = fbx();
    await col(b).doc(e).delete().catch(() => {});
    await fb.fs.runTransaction(async tx => {
      const s = await tx.get(sumRef(b));
      const top = Object.assign({}, s.exists ? s.data().top : {});
      if (!(e in top)) return;
      delete top[e];
      tx.set(sumRef(b), { top, me: '', ev: e });
    }).catch(err => console.warn('[Ranking] remove', b, err.code || err.message));
    cacheSet('s:' + b, undefined);
  }

  /** Admin: quita la marca de un jugador o equipo de todas las tablas de ahora (y de `also`). */
  async function removeEverywhere(e, mode, dexes = [], also = null) {
    const ids = periodIds();
    const boards = new Set(PERIODS.map(([p]) => mode + '_' + ids[p]));
    for (const d of dexes) boards.add(mode + '_' + ALL + '_p' + d);
    if (also) boards.add(also);
    await Promise.all([...boards].map(b => removeEntry(b, e)));
  }

  /** Admin: marca o desmarca una cuenta (marcada = no puede subir marcas). */
  function setMarked(uid, on) { return fbx().fs.collection('saves').doc(uid).update({ sus: !!on }); }
  /** Admin: borra reportes ya vistos. */
  function dismiss(ids) { return Promise.all(ids.map(id => fbx().fs.collection('reports').doc(id).delete().catch(() => {}))); }
  /** Admin: cuentas marcadas. */
  async function markedAccounts() {
    const s = await fbx().fs.collection('saves').where('sus', '==', true).limit(100).get();
    return s.docs.map(d => { const v = d.data().save || {}; return { uid: d.id, name: v.name || '?', coins: v.coins || 0,
      t1: (v.tickets || {}).t1 || 0, t10: (v.tickets || {}).t10 || 0, owned: Object.keys(v.owned || {}).length }; });
  }

  return { PERIODS, AETHER, score, periodIds, board, runStarted, submitSolo, submitGroup, top, myRank, removeMine,
           report, reported, isAdmin, reports, removeEntry, removeEverywhere, setMarked, dismiss, markedAccounts };
})();
