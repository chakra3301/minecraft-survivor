/* ============ hazards.js — ataques con aviso de los enemigos ============
 * Un peligro se dibuja primero en el suelo como AVISO (se va llenando) y, al
 * cumplirse el tiempo, golpea a quien esté dentro:
 *
 *   zone  círculo (zonas de Tierra/Fuego/Veneno, explosiones, caídas de salto)
 *   beam  rayo recto desde el enemigo (Eléctrico, Psíquico, Dragón, Hielo)
 *
 * Cada ordenador dibuja los peligros y comprueba sólo SU Pokémon. En
 * cooperativo los crea el anfitrión y los manda con 'hz'.
 *
 * Los de Arceus (systems/judgment.js) quitan un % de la vida (pct) sin mirar
 * tipos ni defensa (pure), y la Sentencia cae como un pilar de luz (vis).
 *
 * Co-op: 'hz' also carries a lingering cloud (linger) and what the hit does (onHit.net, see
 * bosskits.js); a `track` telegraph (Sonic Boom, the Elder Guardian's laser) is re-sent while it
 * follows its target ('hzu').
 */
G.Hazards = (() => {
  let list = [];
  let netId = 0;

  /** h: { kind, x, y, r | angle, len, w, delay, dmg, type, color, pct?, pure?, vis?, linger?, onHit?, track? } */
  function add(h, fromNet = false) {
    const o = Object.assign({ t: 0, hit: false, end: 0.3 }, h);
    list.push(o);
    if (!fromNet && G.Coop.isHost) {
      o.nid = ++netId;
      G.Coop.broadcast(['hz', { kind: o.kind, x: Math.round(o.x), y: Math.round(o.y), r: o.r, angle: o.angle, len: o.len, w: o.w,
                                delay: o.delay, dmg: Math.round(o.dmg), type: o.type, color: o.color, pct: o.pct, pure: o.pure, vis: o.vis,
                                linger: o.linger, on: o.onHit && o.onHit.net, nid: o.nid }]);
    }
    return o;
  }

  /** Guest: a tracking telegraph moved on the host. */
  function netUpdate(nid, x, y, angle) {
    const h = list.find(o => o.nid === nid && !o.hit);
    if (h) { h.x = x; h.y = y; if (angle != null) h.angle = angle; }
  }

  function clear() { list = []; }

  function inside(h, x, y, r) {
    if (h.kind === 'zone') return G.U.dist2(x, y, h.x, h.y) < (h.r + r * 0.6) ** 2;
    const ca = Math.cos(h.angle), sa = Math.sin(h.angle);
    const px = x - h.x, py = y - h.y;
    const along = px * ca + py * sa;
    if (along < -r || along > h.len + r) return false;
    return Math.abs(-px * sa + py * ca) <= h.w / 2 + r * 0.6;
  }

  function update(dt) {
    const pl = G.Game.player;
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i];
      h.t += dt;
      if (h.track && h.nid && !h.hit && G.Coop.isHost && (h.syncT = (h.syncT || 0) - dt) <= 0) {
        h.syncT = 0.1;
        G.Coop.broadcast(['hzu', h.nid, Math.round(h.x), Math.round(h.y), h.angle != null ? Math.round(h.angle * 1000) / 1000 : null]);
      }
      if (!h.hit && h.t >= h.delay) {
        h.hit = true;
        detonate(h);
        if (pl && !pl.dead && inside(h, pl.x, pl.y, pl.r)) {
          pl.invuln = 0;
          pl.hurt(h.pct ? Math.max(h.dmg, pl.maxHp * h.pct) : h.dmg, h.type, !!h.pure);
          if (h.onHit) h.onHit(pl, h);
        }
      }
      // Lingering cloud (Dragon's Breath): after landing it keeps hurting whoever stands in it.
      if (h.hit && h.linger && pl && !pl.dead) {
        h.tick = (h.tick || 0) - dt;
        if (h.tick <= 0 && inside(h, pl.x, pl.y, pl.r)) { h.tick = 0.5; pl.invuln = 0; pl.hurt(h.dmg * 0.3, h.type, !!h.pure); }
      }
      if (h.hit && h.t >= h.delay + (h.linger || h.end)) list.splice(i, 1);
    }
  }

  function detonate(h) {
    const near = G.Camera.sees(h.x, h.y, 120);
    if (h.vis === 'pillar') {
      // Pilar de luz que cae del cielo.
      G.FX.beam(h.x, h.y, -Math.PI / 2, 420, h.r * 1.1, h.color, G.VFX.forType('electric'));
      G.FX.ring(h.x, h.y, 4, h.r * 1.3, '#fff3c8', 0.4, 5);
      G.FX.burst(h.x, h.y - 6, h.color, 10, 180);
      if (near) { G.Audio.sfx('judge'); G.Camera.kick(0.2); }
    } else if (h.kind === 'zone') {
      G.FX.ring(h.x, h.y, 4, h.r, h.color, 0.35, 5);
      G.FX.burst(h.x, h.y - 6, h.color, Math.round(h.r / 3), 160);
      if (near) { G.Audio.sfx('break'); if (h.r > 60) G.Camera.kick(0.35); }
    } else {
      G.FX.beam(h.x, h.y - G.LIFT, h.angle, h.len, h.w, h.color, G.VFX.forType(h.type || (h.pure ? 'electric' : 'normal')));
      if (near) G.Audio.sfx('shot', { kind: 'beam', type: h.type });
    }
  }

  /** Avisos en el suelo (debajo de los Pokémon). */
  function draw(ctx) {
    const blink = Math.sin(performance.now() / 60) > 0;
    for (const h of list) {
      if (h.hit && h.linger && h.kind === 'zone') {
        // A swirling cloud while it lingers.
        const left = 1 - (h.t - h.delay) / h.linger;
        ctx.save();
        ctx.globalAlpha = 0.28 * Math.min(1, left * 3);
        ctx.fillStyle = h.color;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.5 * Math.min(1, left * 3);
        for (let q = 0; q < 6; q++) {
          const a = q * 1.05 + h.t * 1.3, d = h.r * (0.3 + 0.5 * ((q * 37) % 10) / 10);
          ctx.beginPath(); ctx.ellipse(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * 0.75, 6, 4, 0, 0, 6.2832); ctx.fill();
        }
        ctx.restore();
        continue;
      }
      if (h.hit) continue;
      const k = Math.min(1, h.t / h.delay);
      ctx.save();
      if (h.kind === 'zone') {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = h.color;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.32;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * k, h.r * 0.75 * k, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = k > 0.75 && blink ? 0.95 : 0.6;
        ctx.strokeStyle = h.color; ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, 6.2832); ctx.stroke();
      } else {
        ctx.translate(h.x, h.y);
        ctx.rotate(h.angle);
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = h.color;
        ctx.fillRect(0, -h.w / 2, h.len, h.w);
        ctx.globalAlpha = 0.34;
        ctx.fillRect(0, -h.w / 2 * k, h.len, h.w * k);
        ctx.globalAlpha = k > 0.75 && blink ? 0.95 : 0.55;
        ctx.strokeStyle = h.color; ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(0, -h.w / 2, h.len, h.w);
      }
      ctx.restore();
    }
  }

  return { add, clear, update, draw, inside, netUpdate, get all() { return list; }, get count() { return list.length; } };
})();
