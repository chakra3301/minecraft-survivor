/* ============ pickup.js — orbes de experiencia y objetos ============
 * Orbes de experiencia de Minecraft (verde lima, procedurales) y objetos con
 * su textura: esmeralda, manzana de oro, brújula, TNT y las llaves.
 * Los orbes se quedan quietos hasta que entras en el radio del imán; entonces
 * aceleran hacia ti. Para que no se acumulen miles, al pasar de MAX se fusionan
 * los más antiguos.
 *
 * Cooperativo: los objetos los crea el anfitrión (cada uno con su id) y los
 * demás reciben una copia. Todos vuelan hacia el jugador más cercano; quien
 * decide quién lo ha cogido es el anfitrión.
 */
G.Pickups = (() => {
  let list = [];
  const MAX = 420;
  let nextId = 1;

  const KIND = {
    xp:    { color: '#7ffc3f', glow: '#3fae1f', r: 4.5 },
    xpBig: { color: '#d8ff5a', glow: '#6fd01f', r: 7 },
    heal:  { color: '#ffd23f', glow: '#d89a10', r: 6.5 },
    magnet:{ color: '#ff5f5f', glow: '#b03030', r: 6.5 },
    bomb:  { color: '#ff5030', glow: '#b02010', r: 6.5 },
    coin:  { color: '#17dd62', glow: '#0f9a42', r: 5.5 },
    ticket:   { color: '#ffb347', glow: '#c07a20', r: 7 },
    ticket10: { color: '#5fe0c8', glow: '#1f8f80', r: 8 },
    item:     { color: '#ffd23f', glow: '#c08a10', r: 9 },      // value = id del objeto
    book:     { color: '#c77dff', glow: '#7a3fd0', r: 9 }       // Enchanted Book: value = 'enchId:lvl' (systems/enchanting.js)
  };
  /** Probabilidad de que un Pokémon normal suelte un ticket del gacha. */
  const BOSS_T10 = 1 / 3;               // ticket ×10 de un jefe normal
  const LEGEND_T10 = 1 / 2;             // ticket ×10 del legendario de la grieta
  const TICKET_RATE = 1 / 400;          // (antes 1/260; más raros desde 2026-10-10)

  function clear() { list = []; }
  function all() { return list; }

  function push(o) {
    // En cooperativo sólo el anfitrión crea objetos (las copias llegan por la red).
    if (G.Coop.active && !G.Coop.isHost) return;
    o.id = nextId++;
    list.push(o);
    if (G.Coop.isHost) G.Coop.pickupAdded(o);
    if (list.length > MAX) {
      // Fusiona los dos más antiguos de XP para no crecer sin límite.
      const i = list.findIndex(p => p.kind === 'xp' || p.kind === 'xpBig');
      if (i >= 0) {
        const a = list.splice(i, 1)[0];
        const j = list.findIndex(p => p.kind === 'xp' || p.kind === 'xpBig');
        if (j >= 0) { list[j].value += a.value; list[j].kind = 'xpBig'; }
        if (G.Coop.isHost) G.Coop.pickupGone(a.id);
      } else {
        const a = list.shift();
        if (G.Coop.isHost) G.Coop.pickupGone(a.id);
      }
    }
  }

  /** Copia de un objeto del anfitrión. */
  function addRemote(id, kind, x, y, value) {
    if (list.some(p => p.id === id)) return;
    const o = orb(kind, x, y, value);
    o.id = id;
    list.push(o);
  }

  function removeId(id) {
    const i = list.findIndex(p => p.id === id);
    if (i < 0) return null;
    return list.splice(i, 1)[0];
  }

  /** Imán: todo vuela hacia el jugador más cercano. */
  function pullAll() { for (const o of list) o.pulled = true; }

  /** @param plain  sólo la experiencia (los legendarios de la Sentencia de Arceus) */
  function dropXp(x, y, value, boss = false, legend = false, plain = false) {
    if (boss) {
      // Los jefes revientan en un montón de orbes grandes + recompensas.
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * 6.2832, d = G.U.rand(10, 70);
        push(orb('xpBig', x + Math.cos(a) * d, y + Math.sin(a) * d, Math.ceil(value / 14)));
      }
      if (plain) return;
      push(orb('heal', x + 24, y, 0));
      push(orb('magnet', x - 24, y, 0));
      // Ticket ×10: siempre el legendario de la grieta; un jefe normal, 1 de cada 3 veces.
      // (Hasta el 12-10-2026 el legendario de la grieta daba siempre 2: salían demasiados.)
      if (Math.random() < (legend ? LEGEND_T10 : BOSS_T10)) push(orb('ticket10', x, y - 20, 1));
      return;
    }
    push(orb(value >= 20 ? 'xpBig' : 'xp', x, y, value));
    if (Math.random() < TICKET_RATE) push(orb('ticket', x + G.U.rand(-6, 6), y, 1));

    // Drops ocasionales.
    const r = Math.random();
    if (r < 0.012) push(orb('heal', x + G.U.rand(-8, 8), y, 0));
    else if (r < 0.020) push(orb('magnet', x, y, 0));
    else if (r < 0.026) push(orb('bomb', x, y, 0));
  }

  /** Suelta un objeto suelto: 'heal' | 'magnet' | 'bomb' | 'coin'. */
  function drop(kind, x, y, value = 0) {
    push(orb(kind, x, y, value));
  }

  function orb(kind, x, y, value) {
    const a = Math.random() * 6.2832;
    return {
      kind, x, y, value,
      vx: Math.cos(a) * G.U.rand(10, 46), vy: Math.sin(a) * G.U.rand(10, 46),
      t: Math.random() * 6.28, pulled: false
    };
  }

  /**
   * @param players  un jugador o la lista de jugadores (los caídos no recogen)
   * @param onCollect(pickup, jugador)
   */
  function update(dt, players, onCollect) {
    if (!Array.isArray(players)) players = [players];
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t += dt * 4;

      // El jugador vivo más cercano (en solitario, siempre tú).
      let pl = null, d2 = Infinity;
      for (const o of players) {
        if (o.dead && players.length > 1) continue;
        const dd = G.U.dist2(o.x, o.y, p.x, p.y);
        if (dd < d2) { d2 = dd; pl = o; }
      }
      if (!pl) continue;
      const dx = pl.x - p.x, dy = pl.y - p.y;
      const mag2 = pl.magnet * pl.magnet;

      if (p.pulled || d2 < mag2) {
        p.pulled = true;
        const d = Math.sqrt(d2) || 1;
        const pull = 240 + 1400 / d;
        p.vx = G.U.damp(p.vx, (dx / d) * pull, 7, dt);
        p.vy = G.U.damp(p.vy, (dy / d) * pull, 7, dt);
      } else {
        p.vx *= Math.pow(0.02, dt);
        p.vy *= Math.pow(0.02, dt);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (d2 < 15 * 15) {
        list.splice(i, 1);
        onCollect(p, pl);
      }
    }
  }

  // Orbe de experiencia (7×7): borde verde oscuro y núcleo que va del lima
  // al amarillo, como en Minecraft.
  const ORB = ['..ooo..', '.olllo.', 'olwllyo', 'ollllyo', 'olllyyo', '.oyyyo.', '..ooo..'];
  const mix = (a, b, k) => '#' + [0, 2, 4].map(i => Math.round(parseInt(a.substr(1 + i, 2), 16) * (1 - k) + parseInt(b.substr(1 + i, 2), 16) * k).toString(16).padStart(2, '0')).join('');

  // Pintado una vez por fase de color (hay cientos de orbes en pantalla).
  const PHASES = 8, orbs = { false: [], true: [] };
  function orbCanvas(big, ph) {
    let cv = orbs[big][ph];
    if (cv) return cv;
    const k = 0.5 - Math.cos(ph / PHASES * 6.2832) * 0.5;
    const pal = { o: big ? '#4f8a10' : '#2f7a12', l: mix('#7ffc3f', '#d8ff5a', k), y: mix('#a8e020', '#c8f03a', k), w: '#f4ffd0' };
    cv = orbs[big][ph] = document.createElement('canvas');
    cv.width = cv.height = 7;
    const c = cv.getContext('2d');
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
      const ch = ORB[j][i];
      if (ch !== '.') { c.fillStyle = pal[ch]; c.fillRect(i, j, 1, 1); }
    }
    return cv;
  }

  function drawOrb(ctx, x, y, r, t, big) {
    const ph = Math.floor(((t * 1.6 / 6.2832) % 1) * PHASES);
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(orbCanvas(big, ph), x - r, y - r, r * 2, r * 2);
    ctx.imageSmoothingEnabled = prev;
  }

  // Textura de cada objeto (G.Icons) y su tamaño en el mundo.
  const ICON = { heal: 'berry', magnet: 'magnet', bomb: 'bomb', coin: 'coin', ticket: 'ticket', ticket10: 'ticket10', book: 'items/book_enchanted' };
  const SIZE = { coin: 12, heal: 16, magnet: 16, bomb: 15, ticket: 16, ticket10: 20, item: 20, book: 20 };

  function draw(ctx) {
    for (const p of list) {
      if (!G.Camera.sees(p.x, p.y, 30)) continue;
      const k = KIND[p.kind];
      const bounce = Math.abs(Math.sin(p.t * 0.8)) * 3;
      const r = k.r;
      const y = p.y - 6 - bounce;

      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.9, r * 0.35, 0, 0, 6.2832); ctx.fill();

      ctx.globalAlpha = 0.3;
      ctx.fillStyle = k.glow;
      ctx.beginPath(); ctx.arc(p.x, y, r * 2, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;

      if (p.kind === 'xp' || p.kind === 'xpBig') { drawOrb(ctx, p.x, y, r, p.t, p.kind === 'xpBig'); continue; }

      if (p.kind === 'item') {
        // Objeto: brillo dorado latiendo, para que se vea desde lejos.
        ctx.globalAlpha = 0.35 + Math.sin(p.t * 1.5) * 0.15;
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.arc(p.x, y, 18, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (p.kind === 'book') {
        // Enchanted Book: a purple glint and sparkles, to see it from afar.
        ctx.globalAlpha = 0.32 + Math.sin(p.t * 1.5) * 0.14;
        ctx.fillStyle = '#b06bff';
        ctx.beginPath(); ctx.arc(p.x, y, 19, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
        if (Math.random() < 0.08) G.FX.twinkle(p.x + G.U.rand(-12, 12), y + G.U.rand(-14, 10));
      }
      const sz = SIZE[p.kind] || 16, name = p.kind === 'item' ? p.value : ICON[p.kind];
      if (p.kind === 'coin') {
        // La esmeralda gira como un objeto soltado en Minecraft.
        const sx = Math.max(0.2, Math.abs(Math.cos(p.t * 0.9)));
        ctx.save();
        ctx.translate(p.x, y);
        ctx.scale(sx, 1);
        G.Icons.draw(ctx, name, -sz / 2, -sz / 2 - 1, sz, true);
        ctx.restore();
      } else {
        G.Icons.draw(ctx, name, p.x - sz / 2, y - sz / 2 - 1, sz, true);
      }
    }
    ctx.globalAlpha = 1;
  }

  return { clear, all, dropXp, drop, update, draw, addRemote, removeId, pullAll, KIND, get count() { return list.length; } };
})();
