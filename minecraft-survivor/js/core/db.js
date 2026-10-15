/* ============ db.js — base de datos: Firebase (nube) o local ============
 * TODO el acceso a datos persistentes pasa por aquí. El resto del juego sólo
 * usa G.DB.*.
 *
 * Dos modos (se decide en ready()):
 *
 *   NUBE  (Firebase Authentication + Cloud Firestore)
 *     Si hay configuración en js/core/firebase-config.js (la escribe la versión
 *     online: tools/web/build-public.mjs, ver ONLINE.md) y el juego se abre
 *     desde una web (http/https, también localhost). La partida se guarda en
 *     saves/{uid} y se puede seguir en cualquier ordenador.
 *       - Usuario + contraseña: Firebase pide un email, así que el nombre se
 *         convierte en uno interno (nunca se le envía nada).
 *       - Cuenta de Google.
 *     Además se guarda una copia local para poder jugar sin conexión; al
 *     sincronizar se FUSIONA (ver merge): las colecciones se unen y nunca se
 *     pierde un Pokémon ni un shiny.
 *
 *   LOCAL (localStorage)
 *     Si no hay configuración o se abre con doble clic (file://). Igual que
 *     antes: cuentas y partidas sólo en este navegador.
 *       ps.accounts      { clave: { name, salt, hash, created } }
 *       ps.save.<clave>  partida de esa cuenta
 *       ps.session       última cuenta con sesión iniciada
 *
 * El modo invitado juega con una partida en memoria que no se guarda.
 */
G.DB = (() => {
  const K_ACC = 'ps.accounts', K_SES = 'ps.session', K_SAVE = 'ps.save.';
  const K_CLOUD = 'ps.cloud.', K_MIGRATED = 'ps.migrated.';
  const VERSION = 3;
  const START_COINS = 500;
  // Online settings: G.ONLINE, from js/online-config.js, which only the online site has (written by
  // tools/web/build-public.mjs before the bundle; see ONLINE.md). Its `firebase` is the Firebase web
  // config. The private build has no G.ONLINE and nulls G.FIREBASE_CONFIG: it stays offline.
  const OPT = () => G.ONLINE || {};
  const CFG = () => G.FIREBASE_CONFIG || OPT().firebase || null;
  // The Firebase web SDK: self-hosted by the public build (js/vendor/firebase/), else Google's CDN.
  const SDK = () => OPT().sdk || 'https://www.gstatic.com/firebasejs/13.0.0/';
  // Only to build the internal email of name + password accounts (nothing is ever sent there).
  // Never change it after launch: existing accounts log in with it.
  const NAME_DOMAIN = () => OPT().nameDomain || 'players.minecraft-survivor.invalid';
  /** Local Firebase emulators (tests): { host, auth, firestore, database } or true for the default ports. */
  function emulatorOf(cfg) {
    const e = cfg && cfg.emulator;
    if (!e) return null;
    return Object.assign({ host: '127.0.0.1', auth: 9099, firestore: 8080, database: 9000 }, e === true ? {} : e);
  }

  let mode = 'local';       // 'cloud' | 'local'
  let localReason = '';     // por qué no hay nube: 'file' | 'config' | 'error'
  let user = null;          // nombre visible
  let key = null;           // clave local (minúsculas) o uid de Firebase
  let guest = false;
  let save = null;
  let storageOk = true;

  // ---------------- almacenamiento local seguro ----------------

  function read(k) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
    catch (e) { storageOk = false; return null; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { storageOk = false; return false; }
  }
  function remove(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }

  // ---------------- partida ----------------

  function newSave(name) {
    return {
      v: VERSION,
      name,
      created: Date.now(),
      updated: Date.now(),    // última modificación (para fusionar)
      coins: START_COINS,
      owned: {},              // dex -> { at, from: 'starter'|'gacha'|'wild' }
      shiny: {},              // dex -> { at, from } — variantes shiny conseguidas
      partner: null,          // dex del Pokémon con el que juegas
      partnerShiny: false,    // jugar con su versión shiny (si la tienes)
      starter: null,          // dex que te tocó en el test
      personality: null,      // { trait, scores }
      upgrades: {},           // (antiguo) mejoras de la cuenta; ahora van por Pokémon
      pupg: {},               // dex -> { id -> nivel }: mejoras de cada Pokémon
      tickets: { t1: 0, t10: 0 },   // tickets del gacha (x1 y x10)
      pity: {},               // generación del banner -> tiradas sin ★5
      legends: {},            // dex -> fecha: legendarios vencidos en grietas
      arenas: {},             // tipo -> fecha: arenas de grieta ganadas
      itemsFound: {},         // id -> fecha: objetos equipables encontrados
      evoMoves: {},           // id -> fecha: movimientos evolucionados alguna vez
      ach: {},                // id -> fecha: logros conseguidos
      missions: {},           // misiones del día / semana (systems/progress.js)
      profile: { favs: [], title: '' },   // perfil público: 3 favoritos y título
      // Enchanting (systems/enchanting.js): Ender Dragon slayers, the book Library, enchanted weapons.
      slayer: {},             // dex -> date: killed the Ender Dragon with it (enchanting unlocked)
      books: {},              // enchId -> [count at I, II, III, IV, V]
      ench: {},               // dex -> { skillId -> [[enchId, lvl], …≤3] }
      ascended: {},           // dex -> date: reached the Aether with it (a halo in the Mobdex; systems/aether.js)
      stats: { runs: 0, bestTime: 0, bestLevel: 0, totalKills: 0, pulls: 0, coinsEarned: 0, shinies: 0,
               bossesTotal: 0, riftWins: 0, evolutions: 0, missionsDone: 0, groupRuns: 0, bestGroupTime: 0,
               enchants: 0, anvil: 0, books: 0, aether: 0, phygLove: 0 }
    };
  }

  /** Rellena campos que falten en partidas de versiones anteriores. */
  function migrate(s, name) {
    const base = newSave(name || s.name);
    for (const k in base) if (s[k] == null) s[k] = base[k];
    for (const k in base.stats) if (s.stats[k] == null) s.stats[k] = base.stats[k];
    // v1 -> v2: había un único banner (Kanto) con el pity como número.
    if (typeof s.pity === 'number') s.pity = { 1: s.pity };
    // v2 -> v3: las mejoras eran de la cuenta; pasan al compañero de entonces.
    if (!s.pupgDone) {
      if (s.partner && Object.values(s.upgrades || {}).some(v => v > 0)) {
        s.pupg[s.partner] = Object.assign({}, s.upgrades);
      }
      s.pupgDone = true;
    }
    s.tickets = Object.assign({ t1: 0, t10: 0 }, s.tickets);
    sanitize(s);
    if (G.Enchanting) G.Enchanting.sanitize(s);
    s.v = VERSION;
    return s;
  }

  /**
   * Quita lo imposible de una partida editada a mano (la copia del navegador
   * se puede tocar): números negativos o raros, mejoras por encima del
   * máximo y Pokémon que no existen. Lo que sí sea posible lo frena el
   * servidor (firestore.rules, saves).
   */
  function sanitize(s) {
    const n = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
    s.coins = n(s.coins);
    s.tickets.t1 = n(s.tickets.t1);
    s.tickets.t10 = n(s.tickets.t10);
    if (G.DEX_BY) for (const coll of ['owned', 'shiny']) {
      for (const d of Object.keys(s[coll] || {})) if (!G.DEX_BY[d]) delete s[coll][d];
    }
    // Atajos: 4 huecos con un movimiento que exista (o null), sin repetir.
    if (s.pbind && typeof s.pbind === 'object') {
      for (const d of Object.keys(s.pbind)) {
        const l = Array.isArray(s.pbind[d]) ? s.pbind[d].slice(0, 4) : [];
        const seen = new Set();
        s.pbind[d] = [0, 1, 2, 3].map(i => {
          const id = l[i];
          if (typeof id !== 'string' || (G.Moves && !G.Moves.BY_ID[id]) || seen.has(id)) return null;
          seen.add(id); return id;
        });
      }
    } else s.pbind = {};
    // Veto: listas de movimientos que existen, sin repetir, como mucho 3.
    if (s.pban && typeof s.pban === 'object') {
      for (const d of Object.keys(s.pban)) {
        const l = Array.isArray(s.pban[d]) ? s.pban[d] : [];
        s.pban[d] = [...new Set(l.filter(id => typeof id === 'string' && (!G.Moves || G.Moves.BY_ID[id])))].slice(0, 3);
      }
    } else s.pban = {};
    if (G.Upgrades) for (const d of Object.keys(s.pupg || {})) {
      const u = s.pupg[d];
      if (!u || typeof u !== 'object') { delete s.pupg[d]; continue; }
      for (const id of Object.keys(u)) {
        if (!G.Upgrades.BY[id]) delete u[id];
        else u[id] = Math.min(G.Upgrades.BY[id].max, n(u[id]));
      }
    }
  }

  /**
   * Fusiona dos versiones de la misma partida (p. ej. una jugada sin
   * conexión y la de la nube). Nunca se pierde nada conseguido:
   *   - colecciones (owned, shiny): unión
   *   - mejoras y estadísticas: el máximo de cada una
   *   - monedas, compañero, pity...: los de la versión más reciente
   * Es idempotente: fusionar dos veces da lo mismo.
   */
  function merge(a, b) {
    if (!a) return b;
    if (!b) return a;
    const newer = (a.updated || 0) >= (b.updated || 0) ? a : b;
    const older = newer === a ? b : a;
    const r = JSON.parse(JSON.stringify(newer));
    for (const coll of ['owned', 'shiny']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) {
        if (!r[coll][k] || (older[coll][k].at || 0) < (r[coll][k].at || 0)) r[coll][k] = older[coll][k];
      }
    }
    for (const k in older.upgrades || {}) r.upgrades[k] = Math.max(r.upgrades[k] || 0, older.upgrades[k]);
    r.pupg = r.pupg || {};
    for (const d in older.pupg || {}) {
      const mine = r.pupg[d] = r.pupg[d] || {};
      for (const k in older.pupg[d]) mine[k] = Math.max(mine[k] || 0, older.pupg[d][k]);
    }
    r.pupgDone = r.pupgDone || older.pupgDone;
    // Lo conseguido nunca se pierde: unión de legendarios, arenas, objetos, logros...
    for (const coll of ['legends', 'arenas', 'itemsFound', 'evoMoves', 'ach', 'slayer', 'ascended']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) if (!r[coll][k]) r[coll][k] = older[coll][k];
    }
    // Misiones del mismo día/semana: el mayor progreso y lo ya recogido.
    const mo = older.missions || {}, mr = r.missions = r.missions || {};
    for (const [per, list] of [['day', 'daily'], ['week', 'weekly']]) {
      if (mr[per] !== mo[per] || !mr[list] || !mo[list]) continue;
      mr[list].forEach((m, i) => {
        const o = mo[list][i];
        if (!o || o.id !== m.id) return;
        m.prog = Math.max(m.prog || 0, o.prog || 0);
        m.claimed = m.claimed || o.claimed;
        m.told = m.told || o.told;
      });
    }
    for (const k in older.stats || {}) r.stats[k] = Math.max(r.stats[k] || 0, older.stats[k] || 0);
    if (r.starter == null) r.starter = older.starter;
    if (r.personality == null) r.personality = older.personality;
    if (r.partner == null || !r.owned[r.partner]) { r.partner = older.partner; r.partnerShiny = older.partnerShiny; }
    r.created = Math.min(a.created || Date.now(), b.created || Date.now());
    r.updated = Math.max(a.updated || 0, b.updated || 0);
    return r;
  }

  /** Sustituye el contenido de `save` sin cambiar el objeto (otros módulos lo tienen). */
  // Copia `s` sobre la partida SIN cambiar los objetos de dentro (mejoras,
  // Pokémon...): las pantallas abiertas guardan referencias a ellos. Antes se
  // sustituían y una compra hecha justo después de subir la partida se
  // apuntaba en la copia vieja: se cobraban las monedas y la mejora se perdía.
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function assignDeep(dst, src) {
    for (const k of Object.keys(dst)) if (!(k in src)) delete dst[k];
    for (const k in src) {
      if (isObj(src[k]) && isObj(dst[k])) assignDeep(dst[k], src[k]);
      else dst[k] = src[k];
    }
  }
  function applyInPlace(s) { assignDeep(save, s); }

  const VALID = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]{3,16}$/;

  // =====================================================================
  //                               MODO LOCAL
  // =====================================================================

  async function hash(pass, salt) {
    const text = salt + ':' + pass;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    return 'f' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }

  function randomSalt() {
    const a = new Uint8Array(12);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.random() * 256;
    return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function loadLocal(k, name) {
    const s = read(K_SAVE + k);
    return s ? migrate(s, name) : newSave(name);
  }

  function beginLocal(k, name) {
    key = k; user = name; guest = false;
    save = loadLocal(k, name);
    write(K_SES, k);
  }

  async function registerLocal(name, pass) {
    const accs = read(K_ACC) || {};
    const k = name.toLowerCase();
    if (accs[k]) return { ok: false, error: 'That name is already taken.' };
    const salt = randomSalt();
    accs[k] = { name, salt, hash: await hash(pass, salt), created: Date.now() };
    if (!write(K_ACC, accs)) return { ok: false, error: 'The browser won\'t let the game save data (private mode?).' };
    beginLocal(k, name);
    write(K_SAVE + k, save);
    return { ok: true, isNew: true };
  }

  async function loginLocal(name, pass) {
    const accs = read(K_ACC) || {};
    const acc = accs[name.toLowerCase()];
    if (!acc || acc.hash !== await hash(pass || '', acc.salt)) {
      return { ok: false, error: 'Wrong name or password.' };
    }
    beginLocal(name.toLowerCase(), acc.name);
    return { ok: true, isNew: !save.partner };
  }

  function restoreLocal() {
    const k = read(K_SES);
    if (!k) return false;
    const accs = read(K_ACC) || {};
    if (!accs[k]) { remove(K_SES); return false; }
    beginLocal(k, accs[k].name);
    return true;
  }

  /** Partida de una cuenta local antigua, si el nombre y la contraseña coinciden. */
  async function legacySave(name, pass) {
    const k = (name || '').toLowerCase();
    const acc = (read(K_ACC) || {})[k];
    if (!acc || read(K_MIGRATED + k)) return null;
    if (acc.hash !== await hash(pass || '', acc.salt)) return null;
    const s = read(K_SAVE + k);
    return s ? { key: k, save: migrate(s, acc.name) } : null;
  }

  // =====================================================================
  //                               MODO NUBE
  // =====================================================================

  let auth = null, fs = null, rtdb = null, uid = null, unlisten = null;
  let pushT = 0, retryT = 0, pending = false, pushing = null, lastPush = 0;
  // Como mucho una subida cada 30 min (con miles de jugadores, cada 5 min
  // eran decenas de miles de escrituras por hora); lo que cuesta algo
  // (gacha, mejoras), a los 30 s. La copia local se guarda siempre al momento (y se fusiona con la
  // nube al volver a entrar), y al ocultar o cerrar la pestaña se sube lo pendiente.
  // Tras tiradas y compras se sube a los 3 min (era 30 s: quien hacía muchas tiradas
  // guardaba 2 veces por minuto y eran millones de escrituras al día). Lo hecho sigue
  // en la copia del navegador al momento, y se sube al salir de la pestaña.
  const PUSH_GAP = 30 * 60 * 1000, PUSH_GAP_URGENT = 3 * 60 * 1000, HIDE_GAP = 10 * 60 * 1000;
  let syncState = 'local';           // 'ok' | 'syncing' | 'pending' | 'offline' | 'local'
  const listeners = new Set();

  function setSync(s) { syncState = s; listeners.forEach(fn => { try { fn(s); } catch (e) { /* nada */ } }); }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const el = document.createElement('script');
      el.src = src; el.async = true;
      el.onload = res; el.onerror = () => rej(new Error('No se pudo cargar ' + src));
      document.head.appendChild(el);
    });
  }

  async function initCloud() {
    const cfg = CFG();
    if (!/^https?:$/.test(location.protocol)) { localReason = 'file'; return false; }
    if (!cfg || !cfg.apiKey || !cfg.projectId) { localReason = 'config'; return false; }
    const sdk = SDK();
    await loadScript(sdk + 'firebase-app-compat.js');
    await loadScript(sdk + 'firebase-auth-compat.js');
    await loadScript(sdk + 'firebase-firestore-compat.js');
    // Base de datos en tiempo real: amigos en línea, invitaciones y salas.
    if (cfg.databaseURL) await loadScript(sdk + 'firebase-database-compat.js');
    const app = Object.assign({}, cfg);
    delete app.emulator;
    firebase.initializeApp(app);
    auth = firebase.auth();
    fs = firebase.firestore();
    rtdb = cfg.databaseURL ? firebase.database() : null;
    // Sólo para pruebas: { ..., emulator: true | { host, auth, firestore, database } } usa los emuladores locales.
    const emu = emulatorOf(cfg);
    if (emu) {
      auth.useEmulator('http://' + emu.host + ':' + emu.auth, { disableWarnings: true });
      fs.useEmulator(emu.host, emu.firestore);
      if (rtdb) rtdb.useEmulator(emu.host, emu.database);
    }
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    auth.languageCode = 'en';
    addEventListener('online', () => { if (pending) pushNow(); });
    // Al salir de la pestaña o cerrarla se sube lo pendiente, pero no más de una
    // vez cada 10 min: la gente cambia de pestaña a menudo y cada partida se
    // subía cada ~9 min en vez de cada 30 (12-10-2026, el mayor gasto de
    // Firebase). Lo que no se sube sigue en la copia de este navegador y se
    // sube al volver a entrar.
    const hideFlush = () => { if (pending && Date.now() - lastPush > HIDE_GAP) pushNow(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hideFlush(); });
    addEventListener('pagehide', hideFlush);
    return true;
  }

  /** Firebase pide email: el nombre se codifica en uno interno, único y válido. */
  function nameToEmail(name) {
    const hex = [...new TextEncoder().encode(name.trim().toLowerCase())].map(b => b.toString(16).padStart(2, '0')).join('');
    return hex + '@' + NAME_DOMAIN();
  }

  function displayNameOf(u) {
    const n = ((u && u.displayName) || 'Player').trim().split(/\s+/)[0].replace(/[^A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]/g, '');
    return (n || 'Player').slice(0, 16);
  }

  const docRef = () => fs.collection('saves').doc(uid);
  const plain = s => JSON.parse(JSON.stringify(s));      // Firestore no admite undefined

  /** Abre la partida de la nube de un usuario recién autenticado. */
  async function openCloud(u, opts = {}) {
    uid = u.uid;
    const cached = read(K_CLOUD + uid);
    let remote = null, online = true;
    try {
      const snap = await docRef().get();
      remote = snap.exists ? snap.data().save : null;
    } catch (e) {
      if (!cached) throw e;                // sin conexión y sin copia: no hay nada que abrir
      online = false;
    }
    let s = merge(cached && migrate(cached), remote && migrate(remote));
    if (!s) s = newSave(opts.name || displayNameOf(u));
    if (opts.legacy) {
      s = merge(s, opts.legacy.save);
      write(K_MIGRATED + opts.legacy.key, uid);
    }
    save = migrate(s, s.name);
    key = uid; user = save.name; guest = false;
    write(K_CLOUD + uid, save);
    // Sólo se sube si hay algo que la nube no tenga (cuenta nueva, progreso de
    // este ordenador sin subir...), y SIN esperar: antes el menú no salía hasta
    // terminar la subida, y con Firebase lento se tardaba hasta 9 s en entrar.
    // (Comparar el texto entero daba "distinto" casi siempre y se subía en cada
    // entrada: ahora sólo si esta copia es más nueva que la de la nube.)
    const same = remote && !opts.legacy && (!cached || (cached.updated || 0) <= (remote.updated || 0));
    lastPush = Date.now();       // la primera compra o ticket no sube al momento: espera como las demás
    if (!online) { pending = true; setSync('offline'); scheduleRetry(); }
    else if (same) setSync('ok');
    else pushNow();
  }

  /*
   * Ya no se escucha el documento en vivo (cada cambio costaba una lectura).
   * Si juegas en dos ordenadores, las partidas se fusionan al entrar y en
   * cada subida (transacción con merge()).
   */
  function stopListening() { if (unlisten) { unlisten(); unlisten = null; } }

  /*
   * Anti-trampas (firestore.rules): el servidor nunca rechaza tu partida para
   * siempre. Si trae más monedas, tickets o Pokémon de los que se pueden ganar
   * en ese rato, la rechaza; el margen crece con el tiempo, así que se
   * reintenta igual a los 2 y a los 6 min (un caso justo, como las monedas de
   * una partida que acaba justo después de otro guardado, pasa solo). Si sigue
   * sin cuadrar, se sube igual pero con la marca sus = true (la cuenta queda
   * marcada y no puede subir marcas al ranking; nadie pierde nada). La marca
   * la pone o la quita sólo la nube: si el admin la quita, el siguiente
   * guardado ya va sin ella.
   *
   * Además, nunca se sube dos veces en menos de 65 s (el servidor da menos
   * margen a los guardados muy seguidos); mientras, todo está en el navegador.
   */
  let markNext = false, denials = 0;
  const K_OK = 'ps.cloudok.', MIN_GAP = 65000, DENY_WAIT = [120000, 360000];
  const sinceOk = () => Date.now() - (+read(K_OK + uid) || 0);

  /** Sube la partida fusionándola con lo que haya en la nube (transacción). */
  function pushNow() {
    if (mode !== 'cloud' || guest || !save || !uid) return Promise.resolve();
    // Si ya hay una subida en marcha, se hace otra justo después (para lo que haya cambiado mientras).
    if (pushing) { pending = true; return pushing.then(() => (pending ? pushNow() : undefined)); }
    clearTimeout(pushT); pushT = 0; pushDue = 0;
    if (navigator.onLine === false) {
      pending = true; setSync('offline'); scheduleRetry();
      return Promise.resolve();
    }
    if (sinceOk() < MIN_GAP) {
      pending = true; setSync('pending');
      schedulePush(MIN_GAP - sinceOk() + 500);
      return Promise.resolve();
    }
    pending = false;
    lastPush = Date.now();
    setSync('syncing');
    let merged = null;
    const tr = fs.runTransaction(async tx => {
      const ref = docRef();
      const snap = await tx.get(ref);
      const remote = snap.exists ? migrate(snap.data().save) : null;
      merged = remote ? merge(plain(save), remote) : plain(save);
      const doc = { save: merged, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), v: VERSION };
      if (markNext || (snap.exists && snap.data().sus === true)) doc.sus = true;
      tx.set(ref, doc);
    });
    // Si la red se cae a medias, Firestore puede quedarse esperando: tope de 12 s.
    const timeout = new Promise((_, rej) => setTimeout(() => rej({ code: 'unavailable' }), 12000));
    let failed = false, again = false;
    pushing = Promise.race([tr, timeout]).then(() => {
      fails = 0; markNext = false; denials = 0;
      write(K_OK + uid, Date.now());
      // Se FUSIONA con lo de ahora (no se sobrescribe): si has cambiado algo
      // mientras se subía (elegir compañero, una compra...), no se pierde.
      if (merged && save) { applyInPlace(merge(plain(save), merged)); write(K_CLOUD + uid, save); }
      setSync(pending ? 'pending' : 'ok');
      if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
    }).catch(e => {
      console.warn('[DB] no se pudo sincronizar:', e.code || e.message);
      // El servidor la ve imposible: se espera (el margen crece) y, si sigue, se sube con la marca.
      if (e.code === 'permission-denied' && !markNext) {
        pending = true;
        if (denials < DENY_WAIT.length) { setSync('pending'); schedulePush(DENY_WAIT[denials++]); failed = true; return; }
        markNext = true; again = true; return;
      }
      pending = true; failed = true;
      setSync(navigator.onLine === false || e.code === 'unavailable' ? 'offline' : 'pending');
      scheduleRetry();
    }).finally(() => {
      pushing = null;
      if (again) return pushNow();
      // (Si ha fallado, el reintento ya está programado con su espera creciente.)
      if (!failed && pending && syncState === 'pending') schedulePush(Math.max(1500, PUSH_GAP - (Date.now() - lastPush)));
    });
    return pushing;
  }

  // Si ya había una subida programada antes, se respeta (una compra no espera a la siguiente partida).
  let pushDue = 0;
  function schedulePush(ms) {
    const due = Date.now() + ms;
    if (pushT && pushDue && pushDue <= due) return;
    clearTimeout(pushT); pushDue = due;
    pushT = setTimeout(() => { pushT = 0; pushDue = 0; pushNow(); }, ms);
  }
  /**
   * Reintento con espera creciente: 15 s, 30 s, 1 min, 2 min... hasta 10 min.
   * Con muchos jugadores, reintentar siempre a los 15 s cuando Firebase falla
   * (cupo agotado, caída) multiplicaba las lecturas (pasó el 10-10-2026).
   */
  let fails = 0;
  function scheduleRetry() {
    const ms = Math.min(10 * 60e3, 15e3 * Math.pow(2, fails)) * (0.8 + Math.random() * 0.4);
    fails = Math.min(fails + 1, 8);
    clearTimeout(retryT);
    retryT = setTimeout(() => { if (pending) pushNow(); }, ms);
  }

  function authError(e) {
    const c = (e && e.code) || '';
    const M = {
      'auth/email-already-in-use': 'That name is already taken.',
      'auth/invalid-credential': 'Wrong name or password.',
      'auth/invalid-login-credentials': 'Wrong name or password.',
      'auth/wrong-password': 'Wrong name or password.',
      'auth/user-not-found': 'Wrong name or password.',
      'auth/weak-password': 'The password must be at least 6 characters long.',
      'auth/too-many-requests': 'Too many tries in a row. Wait a moment.',
      'auth/network-request-failed': 'No internet connection.',
      'auth/popup-blocked': 'The browser blocked the Google window. Allow pop-ups for this site.',
      'auth/unauthorized-domain': 'This domain isn\'t authorized in Firebase (Authentication → Settings → Authorized domains).',
      'auth/operation-not-allowed': 'That sign-in method isn\'t turned on in Firebase.',
      // New accounts turned off in Firebase (Authentication → Settings → User actions).
      'auth/admin-restricted-operation': 'New accounts can\'t be created right now. If you have an account, log in; if not, play as a guest.',
      'auth/requires-recent-login': 'For your safety, log in again and repeat that.',
      'permission-denied': 'The database refused access (check the Firestore rules).',
      'unavailable': 'No connection to the database.'
    };
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    return M[c] || ('Error: ' + (c || (e && e.message) || 'unknown'));
  }

  // =====================================================================
  //                           API PÚBLICA
  // =====================================================================

  let readyP = null;

  /** Arranca la base de datos y recupera la sesión anterior. → true si hay sesión. */
  function ready() {
    if (readyP) return readyP;
    readyP = (async () => {
      try { if (await initCloud()) mode = 'cloud'; }
      catch (e) { console.warn('[DB] sin nube:', e.message); localReason = 'error'; mode = 'local'; }
      if (mode === 'local') { setSync('local'); return restoreLocal(); }
      const u = await new Promise(res => { const off = auth.onAuthStateChanged(x => { off(); res(x); }); });
      if (!u) return false;
      try { await openCloud(u); return true; }
      catch (e) { console.warn('[DB] no se pudo abrir la partida:', e.code || e.message); return false; }
    })();
    return readyP;
  }

  async function register(name, pass) {
    name = (name || '').trim();
    if (!VALID.test(name)) return { ok: false, error: 'The name must be 3-16 letters, numbers or _.' };
    const min = mode === 'cloud' ? 6 : 4;
    if ((pass || '').length < min) return { ok: false, error: `The password must be at least ${min} characters long.` };
    if (mode === 'local') return registerLocal(name, pass);
    // (Sign-ups are always open: no monthly cap, no Cloud Functions; see net/signups.js.)
    try {
      const legacy = await legacySave(name, pass);
      const cred = await auth.createUserWithEmailAndPassword(nameToEmail(name), pass);
      await openCloud(cred.user, { name, legacy });
      return { ok: true, isNew: !save.partner, imported: !!legacy };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  async function login(name, pass) {
    name = (name || '').trim();
    if (mode === 'local') return loginLocal(name, pass);
    try {
      const legacy = await legacySave(name, pass);
      const cred = await auth.signInWithEmailAndPassword(nameToEmail(name), pass || '');
      await openCloud(cred.user, { name, legacy });
      return { ok: true, isNew: !save.partner, imported: !!legacy };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  async function loginWithGoogle() {
    if (mode !== 'cloud' || !googleOn()) return { ok: false, error: 'Google sign-in isn\'t available here.' };
    try {
      const cred = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      await openCloud(cred.user, { name: displayNameOf(cred.user) });
      return { ok: true, isNew: !save.partner };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  /** Cambia el nombre que se ve en la partida (al elegir apodo). */
  /** Google sign-in is behind the online config (allowGoogleSignIn). */
  function googleOn() { return mode === 'cloud' && !!OPT().allowGoogleSignIn; }

  function setName(n) {
    if (!save || guest) return;
    save.name = n; user = n;
    commit();
  }

  function playAsGuest() {
    user = 'Guest'; key = null; guest = true; uid = null;
    save = newSave('Guest');
    if (mode === 'local') remove(K_SES);
    return { ok: true, isNew: true };
  }

  /**
   * Guarda la partida actual (no hace nada en modo invitado).
   * @param urgent  lo que ha costado algo (tiradas del gacha, mejoras): se sube antes
   */
  function commit(urgent = false) {
    if (guest || !key || !save) return false;
    save.updated = Date.now();
    if (mode === 'local') return write(K_SAVE + key, save);
    write(K_CLOUD + uid, save);
    pending = true;
    setSync('pending');
    schedulePush(Math.max(1200, (urgent ? PUSH_GAP_URGENT : PUSH_GAP) - (Date.now() - lastPush)));
    return true;
  }

  /** Funciones que se ejecutan al cerrar sesión o borrar la cuenta (amigos, salas...). */
  const leaveHooks = [];

  async function logout() {
    for (const fn of leaveHooks) { try { await fn('logout'); } catch (e) { /* nada */ } }
    if (mode === 'cloud' && !guest && save) {
      if (pending) { try { await pushNow(); } catch (e) { /* queda la copia local */ } }
      stopListening();
      try { await auth.signOut(); } catch (e) { /* nada */ }
    } else if (mode === 'local' && !guest) {
      commit();
      remove(K_SES);
    }
    clearTimeout(pushT); clearTimeout(retryT);
    user = key = save = uid = null; guest = false; pending = false;
    setSync(mode === 'cloud' ? 'ok' : 'local');
  }

  function nameAccount() { return !!(auth && auth.currentUser && (auth.currentUser.email || '').endsWith('@' + NAME_DOMAIN())); }

  /**
   * Borra la cuenta y la partida (en la nube o en este navegador).
   * @param pass  contraseña (cuentas de nombre y contraseña)
   */
  async function deleteAccount(pass) {
    if (guest || !key) return { ok: false, error: 'There is no account to delete.' };
    if (mode === 'local') {
      const accs = read(K_ACC) || {};
      delete accs[key];
      write(K_ACC, accs);
      remove(K_SAVE + key); remove(K_SES);
      user = key = save = null;
      return { ok: true };
    }
    try {
      // Primero se confirma quién eres: Firebase sólo deja borrar la cuenta si
      // se ha entrado hace poco. Antes se borraban los datos y luego fallaba
      // ese último paso: la cuenta quedaba vacía pero existía y su nombre no
      // se podía volver a usar.
      const cu = auth.currentUser;
      if (nameAccount()) {
        if (!pass) return { ok: false, error: 'Type your password.' };
        await cu.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(cu.email, pass));
      } else {
        await cu.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
      }
      clearTimeout(pushT); clearTimeout(retryT); pending = false;
      stopListening();
      for (const fn of leaveHooks) await fn('delete');
      await docRef().delete();
      remove(K_CLOUD + uid);
      await auth.currentUser.delete();
      user = key = save = uid = null;
      return { ok: true };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  // ---------------- helpers de partida ----------------

  function owns(dex) { return !!(save && save.owned[dex]); }

  function grant(dex, from) {
    if (!save.owned[dex]) save.owned[dex] = { at: Date.now(), from };
  }

  function ownsShiny(dex) { return !!(save && save.shiny && save.shiny[dex]); }

  /** Mejoras compradas para un Pokémon: { id -> nivel }. */
  function upgradesOf(dex) {
    if (!save) return {};
    save.pupg = save.pupg || {};
    return save.pupg[dex] || (save.pupg[dex] = {});
  }

  /** Da la versión shiny (y la normal, si no la tenía). Devuelve true si es nueva. */
  function grantShiny(dex, from) {
    grant(dex, from);
    if (save.shiny[dex]) return false;
    save.shiny[dex] = { at: Date.now(), from };
    return true;
  }

  return {
    ready, register, login, loginWithGoogle, playAsGuest, logout, commit, deleteAccount, flush: pushNow,
    owns, grant, ownsShiny, grantShiny, merge, setName, upgradesOf,
    onSync(fn) { listeners.add(fn); },
    onLeave(fn) { leaveHooks.push(fn); },
    /** Acceso de bajo nivel para los módulos de red (sólo en modo nube). */
    get fb() { return mode === 'cloud' ? { auth, fs, rtdb, uid, emulator: emulatorOf(CFG()) } : null; },
    /** The Firebase web config in use (null offline). */
    get config() { return CFG(); },
    /** Is "Sign in with Google" offered? (online config allowGoogleSignIn) */
    get google() { return googleOn(); },
    /** ¿Está disponible lo online (amigos, ranking, multijugador)? */
    get online() { return mode === 'cloud' && !guest && !!uid && !!save; },
    /** ¿La cuenta es de usuario y contraseña (no de Google)? */
    get nameAccount() { return nameAccount(); },
    get mode() { return mode; },
    get localReason() { return localReason; },
    get syncState() { return syncState; },
    get user() { return user; },
    get guest() { return guest; },
    get save() { return save; },
    get loggedIn() { return !!save; },
    get storageOk() { return storageOk; },
    START_COINS
  };
})();
