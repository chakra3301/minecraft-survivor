/* ============ audio.js — sintetizador, secuenciador y efectos de sonido ============
 * Los efectos y la música de reserva se generan en el momento con Web Audio.
 * Si existe data/music-files.js (tools/mc/import-music.mjs), la música es la
 * banda sonora real de Minecraft, en streaming (ver "música grabada" abajo).
 *
 *   G.Audio.music('plains')    contexto: 'menu' | 'boss' | 'trial' | 'herobrine' | bioma | null
 *   G.Audio.sfx('coin')        efecto de sonido (con límite de repetición)
 *   G.Audio.setVolume('music' | 'sfx', 0..1) · toggleMute()
 *
 * Los navegadores no dejan sonar nada hasta el primer clic o tecla, así que
 * el contexto se crea entonces y arranca la música que estuviera pedida.
 * El volumen se guarda en localStorage (es del navegador, no de la cuenta).
 */
G.Audio = (() => {
  const KEY = 'ps.audio';
  let ctx = null, master, outNode, musicBus, sfxBus, reverb, wet;
  let settings = { music: 0.55, sfx: 0.7, muted: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* nada */ }
  let noiseBuf = null;

  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* nada */ } }

  // ---------------- arranque ----------------

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    build(false);
    applyVolumes();
    return true;
  }

  /** Monta la cadena (compresor, buses, reverb, ruido) sobre `ctx`. now: reverb al momento. */
  function build(now) {
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -14; master.ratio.value = 4;
    const out = outNode = ctx.createGain(); out.gain.value = 0.9;
    master.connect(out).connect(ctx.destination);

    musicBus = ctx.createGain(); sfxBus = ctx.createGain();
    musicBus.connect(master); sfxBus.connect(master);

    // Reverb: respuesta al impulso generada (ruido que se apaga en 1,8 s).
    // Se rellena un momento después, a trozos: hacerlo de golpe bloqueaba la
    // carga de la página (~75 ms). Hasta entonces la música suena sin eco.
    const rv = reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    let ch = 0;
    const fill = () => {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) { const g = 1 - i / len; d[i] = (Math.random() * 2 - 1) * g * g * Math.sqrt(g); }
      if (++ch < 2) { if (!now) setTimeout(fill, 30); } else rv.buffer = ir;
    };
    if (now) { fill(); fill(); } else setTimeout(fill, 300);
    wet = ctx.createGain(); wet.gain.value = 0.3;
    reverb.connect(wet).connect(musicBus);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  function unlock() {
    if (!init()) return;
    // 'suspended' o 'interrupted' (iPhone al volver de otra app): se reanuda.
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (wanted && !current && !stream && !gapTimer) apply();
    else if (stream && stream.el.paused && !document.hidden) stream.el.play().catch(() => {});
  }
  // En móvil, tocar la pantalla (pointerdown) no cuenta como gesto para el
  // sonido: sí levantar el dedo (pointerup / touchend). Se escuchan todos.
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) addEventListener(ev, unlock, { capture: true });

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(settings.muted ? 0 : settings.music * 0.7, t, 0.05);
    // Los efectos se generan bajitos: ×2,4 los pone a la par de la música (medido).
    sfxBus.gain.setTargetAtTime(settings.muted ? 0 : settings.sfx * 2.4, t, 0.05);
  }

  function setVolume(which, v) { settings[which] = G.U.clamp(v, 0, 1); save(); applyVolumes(); }
  function toggleMute() { settings.muted = !settings.muted; save(); applyVolumes(); return settings.muted; }

  // ---------------- piezas básicas ----------------

  const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);

  function osc(type, f, t, end, dest) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.connect(dest); o.start(t); o.stop(end + 0.05);
    return o;
  }

  function gainEnv(dest, t, a, peak, dur, rel, sus = 0.7) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, Math.max(0.02, dur * 0.4));
    g.gain.setTargetAtTime(0.0001, t + dur, rel / 3);
    g.connect(dest);
    return g;
  }

  function noise(t, dur, dest) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    return s;
  }

  function filt(type, f, q, dest) {
    const b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q;
    b.connect(dest);
    return b;
  }

  function send(node, amount) {
    const s = ctx.createGain(); s.gain.value = amount;
    node.connect(s).connect(reverb);
  }

  // ---------------- instrumentos ----------------

  const INST = {
    flute(t, f, d, v, bus) {
      const lp = filt('lowpass', 3600, 0.5, bus);
      const g = gainEnv(lp, t, 0.045, 0.2 * v, d, 0.14, 0.82);
      send(g, 0.35);
      const o1 = osc('triangle', f, t, t + d + 0.3, g);
      const g2 = ctx.createGain(); g2.gain.value = 0.18; g2.connect(g);
      const o2 = osc('sine', f * 2, t, t + d + 0.3, g2);
      // Vibrato que entra poco a poco, como un flautista.
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.3;
      const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.35, d));
      lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      lfo.start(t); lfo.stop(t + d + 0.35);
      // Soplo al atacar la nota.
      const bp = filt('bandpass', f * 2.2, 2, g);
      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.25, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      ng.connect(bp); noise(t, 0.09, ng);
    },
    bell(t, f, d, v, bus) {
      const g = ctx.createGain(); g.connect(bus); send(g, 0.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22 * v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(d, 0.45) + 0.45);
      osc('sine', f, t, t + 1, g);
      const g2 = ctx.createGain(); g2.connect(g);
      g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc('sine', f * 4, t, t + 0.12, g2);
    },
    pluck(t, f, d, v, bus) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.8), t + 0.22);
      const g = ctx.createGain(); g.connect(bus); send(g, 0.2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11 * v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(d, 0.35) + 0.25);
      lp.connect(g);
      osc('sawtooth', f, t, t + 0.7, lp);
    },
    bass(t, f, d, v, bus) {
      const lp = filt('lowpass', 900, 0.7, bus);
      const g = gainEnv(lp, t, 0.008, 0.34 * v, d * 0.9, 0.08, 0.65);
      osc('triangle', f, t, t + d + 0.2, g);
      const g2 = ctx.createGain(); g2.gain.value = 0.25; g2.connect(g);
      osc('square', f, t, t + d + 0.2, g2);
    },
    pad(t, f, d, v, bus) {
      const lp = filt('lowpass', 1100, 0.6, bus);
      const g = gainEnv(lp, t, 0.35, 0.05 * v, d, 0.7, 0.9);
      send(g, 0.5);
      osc('sawtooth', f * 1.004, t, t + d + 1, g);
      osc('sawtooth', f * 0.996, t, t + d + 1, g);
    },
    /** Piano de fieltro: golpe suave que se apaga, parciales algo desafinados, filtro que se cierra. */
    keys(t, f, d, v, bus) {
      const vv = v * (0.92 + Math.random() * 0.12);          // cada pulsación un poco distinta
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
      lp.frequency.setValueAtTime(Math.min(5200, f * 7), t);
      lp.frequency.exponentialRampToValueAtTime(Math.min(2400, f * 2.6), t + 0.6);
      lp.connect(bus);
      const g = ctx.createGain(); g.connect(lp); send(g, 0.45);
      const peak = 0.27 * vv, rel = Math.max(d, 0.4);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.006);
      g.gain.setTargetAtTime(peak * 0.35, t + 0.006, 0.14);  // caída rápida del golpe
      g.gain.setTargetAtTime(0.0001, t + 0.35, 1.5);         // y la cola, lenta
      g.gain.setTargetAtTime(0.0001, t + rel, 0.28);         // al soltar la tecla
      const end = t + rel + 1.2;
      osc('triangle', f, t, end, g);
      const det = ctx.createGain(); det.gain.value = 0.35; det.connect(g);
      osc('sine', f * 1.0018, t, end, det);
      // Armónicos que se apagan antes que la fundamental.
      [[2.003, 0.22, 0.5], [3.011, 0.08, 0.25]].forEach(([k, a, dk]) => {
        const h = ctx.createGain(); h.connect(g);
        h.gain.setValueAtTime(a, t); h.gain.exponentialRampToValueAtTime(0.001, t + dk);
        osc('sine', f * k, t, t + dk + 0.05, h);
      });
      // Martillo de fieltro.
      const hb = filt('lowpass', Math.min(2000, f * 3), 0.7, g);
      const hg = ctx.createGain(); hg.gain.setValueAtTime(0.18, t); hg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      hg.connect(hb); noise(t, 0.04, hg);
    },
    /** Colchón cálido de ataque lento, para los temas tranquilos. */
    warmpad(t, f, d, v, bus) {
      const lp = filt('lowpass', 850, 0.5, bus);
      const a = Math.min(1.4, Math.max(0.3, d * 0.4));
      const g = gainEnv(lp, t, a, 0.085 * v, d, 1.6, 0.85);
      send(g, 0.6);
      osc('triangle', f * 1.003, t, t + d + 1.8, g);
      osc('triangle', f * 0.997, t, t + d + 1.8, g);
      const s = ctx.createGain(); s.gain.value = 0.5; s.connect(g);
      osc('sine', f * 0.5, t, t + d + 1.8, s);
    },
    /** Celesta apagada: campanita suave con cola corta. */
    celesta(t, f, d, v, bus) {
      const g = ctx.createGain(); g.connect(bus); send(g, 0.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.17 * v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(d, 0.6) + 0.9);
      osc('sine', f, t, t + 1.6, g);
      const g2 = ctx.createGain(); g2.connect(g);
      g2.gain.setValueAtTime(0.18, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc('sine', f * 2, t, t + 0.35, g2);
      const g3 = ctx.createGain(); g3.connect(g);
      g3.gain.setValueAtTime(0.12, t); g3.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc('sine', f * 3.98, t, t + 0.08, g3);
    },
    /** Zumbido grave con el filtro respirando despacio (Nether, Herobrine). */
    drone(t, f, d, v, bus) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.value = 340;
      lp.connect(bus);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12 + Math.random() * 0.08;
      const lg = ctx.createGain(); lg.gain.value = 140;
      lfo.connect(lg).connect(lp.frequency);
      lfo.start(t); lfo.stop(t + d + 2);
      const g = gainEnv(lp, t, Math.min(1.2, d * 0.4), 0.11 * v, d, 1.5, 0.9);
      send(g, 0.4);
      osc('sawtooth', f * 1.005, t, t + d + 2, g);
      osc('sawtooth', f * 0.995, t, t + d + 2, g);
    },
    /** Cuadrada seca, sin vibrato: la melodía "de 8 bits" del jefe. */
    chip(t, f, d, v, bus) {
      const lp = filt('lowpass', 3000, 0.7, bus);
      const g = gainEnv(lp, t, 0.004, 0.06 * v, d * 0.92, 0.05, 0.6);
      send(g, 0.15);
      osc('square', f, t, t + d + 0.15, g);
      const g2 = ctx.createGain(); g2.gain.value = 0.3; g2.connect(g);
      osc('triangle', f * 0.5, t, t + d + 0.15, g2);
    },
    lead(t, f, d, v, bus) {
      const lp = filt('lowpass', 2600, 1, bus);
      const g = gainEnv(lp, t, 0.01, 0.075 * v, d, 0.08, 0.75);
      send(g, 0.2);
      const o1 = osc('square', f, t, t + d + 0.2, g);
      const o2 = osc('square', f * 1.006, t, t + d + 0.2, g);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
      const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.2);
      lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      lfo.start(t); lfo.stop(t + d + 0.25);
    },
    kick(t, v, bus) {
      const g = ctx.createGain(); g.connect(bus);
      g.gain.setValueAtTime(0.55 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      const o = osc('sine', 150, t, t + 0.25, g);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    },
    snare(t, v, bus) {
      const hp = filt('highpass', 1300, 0.7, bus);
      const g = ctx.createGain(); g.connect(hp); send(g, 0.15);
      g.gain.setValueAtTime(0.22 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      noise(t, 0.15, g);
      const g2 = ctx.createGain(); g2.connect(bus);
      g2.gain.setValueAtTime(0.12 * v, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc('triangle', 190, t, t + 0.1, g2);
    },
    hat(t, v, bus) {
      const hp = filt('highpass', 7500, 0.7, bus);
      const g = ctx.createGain(); g.connect(hp);
      g.gain.setValueAtTime(0.08 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      noise(t, 0.05, g);
    },
    shaker(t, v, bus) {
      const bp = filt('bandpass', 5200, 1.2, bus);
      const g = ctx.createGain(); g.connect(bp);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07 * v, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      noise(t, 0.08, g);
    },
    /** Latido: golpe grave y blando, sin clic. */
    heart(t, v, bus) {
      const lp = filt('lowpass', 220, 0.7, bus);
      const g = ctx.createGain(); g.connect(lp);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.6 * v, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      const o = osc('sine', 85, t, t + 0.3, g);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    },
    /** Gota de agua en la cueva. */
    drip(t, v, bus) {
      const g = ctx.createGain(); g.connect(bus); send(g, 0.7);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06 * v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
      const f = 1300 + Math.random() * 500;
      const o = osc('sine', f, t, t + 0.14, g);
      o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.08);
    },
    /** Retumbo lejano (ruido grave que crece y se apaga). */
    rumble(t, v, bus) {
      const lp = filt('lowpass', 160, 0.8, bus);
      const g = ctx.createGain(); g.connect(lp); send(g, 0.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.5 * v, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
      const s = ctx.createBufferSource();            // el búfer de ruido dura 1 s: en bucle
      s.buffer = noiseBuf; s.loop = true;
      s.connect(g); s.start(t, Math.random() * 0.5); s.stop(t + 2.7);
    }
  };

  // ---------------- secuenciador ----------------

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midiOf(name) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    if (!m) return null;
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }

  /** Notas de cada tipo de acorde, en semitonos desde la raíz. */
  const CHORD = {
    '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
    '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], mmaj7: [0, 3, 7, 11],
    m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9],
    sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10],
    add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14]
  };

  /**
   * Acorde "F", "Dm", "C/E", "F#m", "Gmaj7", "Am7", "Dsus4", "Cadd9", "Bm7b5", "Ddim7/C"...
   * -> { root (0-11), minor, bass (0-11), tones (semitonos desde la raíz) }
   */
  function parseChord(c) {
    const m = /^([A-G])(#|b)?([a-z0-9]*)(?:\/([A-G])(#|b)?)?$/.exec(c);
    if (!m || !CHORD[m[3]]) throw new Error(`Bad chord "${c}"`);
    const pc = (l, a) => (NOTE[l] + (a === '#' ? 1 : a === 'b' ? -1 : 0) + 12) % 12;
    const root = pc(m[1], m[2]), tones = CHORD[m[3]];
    return { root, minor: tones[1] === 3, bass: m[4] ? pc(m[4], m[5]) : root, tones };
  }

  /**
   * Compila una canción de data/music.js a una lista de eventos por paso
   * (semicorchea). Melodías: "A4:4 C5:2 -:2" (nota:duración en semicorcheas,
   * con ":0.6" opcional de volumen y "C4+E4:8" para tocar varias a la vez).
   * Bajo y arpegios salen de los acordes con patrones de 16 caracteres
   * (un texto, o una lista que se recorre compás a compás; igual en drums).
   */
  function compile(song) {
    const bars = song.bars || song.chords.length;
    const steps = bars * 16;
    const ev = Array.from({ length: steps }, () => []);
    const need = inst => { if (!INST[inst]) throw new Error(`Unknown instrument "${inst}"`); };
    const cyc = (p, b) => Array.isArray(p) ? p[b % p.length] : p;

    for (const tr of song.melody || []) {
      need(tr.inst);
      // loop: la melodía se repite hasta llenar la canción.
      const reps = tr.loop ? Math.ceil(bars / tr.bars.length) : 1;
      for (let r = 0; r < reps; r++) tr.bars.forEach((bar, bi0) => {
        const bi = r * tr.bars.length + bi0;
        if (bi >= bars && r > 0) return;
        let s = 0;
        for (const tok of bar.trim().split(/\s+/)) {
          const [n, len, vel] = tok.split(':');
          const L = +len || 1;
          if (n !== '-') {
            for (const nn of n.split('+')) {
              const m0 = midiOf(nn);
              if (m0 === null) throw new Error(`Bad note "${nn}" in "${bar}"`);
              ev[(bi * 16 + s) % steps].push({ inst: tr.inst, f: midiFreq(m0 + (tr.shift || 0)), len: L, v: (tr.vel || 1) * (vel ? +vel : 1) });
            }
          }
          s += L;
        }
      });
    }

    const chords = song.chords.map(parseChord);
    // Notas del acorde hacia arriba: 0 raíz, 1 tercera, 2 quinta, luego la
    // séptima/novena si las hay y, al acabarse, otra vez desde la octava.
    const chordTone = (ch, i, base) => {
      const n = ch.tones.length;
      return base + ch.root + ch.tones[i % n] + 12 * Math.floor(i / n);
    };
    for (const tr of song.parts || []) need(tr.inst);
    for (let b = 0; b < bars; b++) {
      const ch = chords[b % chords.length];
      for (const tr of song.parts || []) {
        const pat = cyc(tr.pattern, b);
        const base = 12 * (tr.octave + 1);
        for (let s = 0; s < 16; s++) {
          const c = pat[s];
          if (!c || c === '.' || c === '-') continue;
          let len = 1;
          while (s + len < 16 && pat[s + len] === '-') len++;
          let midi;
          if (c === 'R') midi = base + (tr.useBass ? ch.bass : ch.root);
          else if (c === 'F') midi = base + ch.root + ch.tones[2];
          else if (c === 'O') midi = base + ch.root + 12;
          else if (c === 'T') midi = base + ch.root + ch.tones[1];
          else if (c === 'C') {           // acorde entero (pad)
            for (let i = 0; i < ch.tones.length; i++) ev[b * 16 + s].push({ inst: tr.inst, f: midiFreq(chordTone(ch, i, base)), len, v: tr.vel || 1 });
            continue;
          } else if (c >= '0' && c <= '9') midi = chordTone(ch, +c, base);
          else throw new Error(`Bad pattern char "${c}" in "${pat}"`);
          ev[b * 16 + s].push({ inst: tr.inst, f: midiFreq(midi), len, v: tr.vel || 1 });
        }
      }
      for (const [inst, p] of Object.entries(song.drums || {})) {
        need(inst);
        const pat = cyc(p, b);
        for (let s = 0; s < 16; s++) {
          const c = pat[s];
          if (c && c !== '.') ev[b * 16 + s].push({ inst, drum: true, v: c === 'X' ? 1 : c === 'x' ? 0.75 : 0.45 });
        }
      }
    }
    return { steps, ev, bpm: song.bpm, swing: song.swing || 0, wet: song.wet == null ? 0.3 : song.wet };
  }

  let wanted = null, current = null;
  const compiled = {};

  function startSong(name) {
    if (!ctx || !G.MUSIC[name]) return;
    const song = compiled[name] || (compiled[name] = compile(G.MUSIC[name]));
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);
    bus.connect(musicBus);
    wet.gain.setTargetAtTime(song.wet, ctx.currentTime, 0.4);   // cada tema con su eco
    current = { name, song, bus, step: 0, next: ctx.currentTime + 0.1 };
  }

  function stopCurrent() {
    if (!current) return;
    const b = current.bus;
    b.gain.cancelScheduledValues(ctx.currentTime);
    b.gain.setValueAtTime(b.gain.value, ctx.currentTime);
    b.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    setTimeout(() => b.disconnect(), 900);
    current = null;
  }

  /** Synth fallback for a context: only restarts if the song changes. */
  function synthFor(name) {
    if (current && current.name === name) return;
    stopCurrent();
    if (name) startSong(name);
  }

  // Planificador: programa con 150 ms de antelación.
  setInterval(() => {
    if (!ctx || !current || ctx.state !== 'running') return;
    const c = current, sd = 60 / c.song.bpm / 4;
    while (c.next < ctx.currentTime + 0.15) {
      const i = c.step % c.song.steps;
      // Swing: retrasa las corcheas a contratiempo.
      const t = c.next + (i % 4 === 2 ? c.song.swing * sd : 0);
      for (const e of c.song.ev[i]) {
        if (e.drum) INST[e.inst](t, e.v, c.bus);
        else INST[e.inst](t, e.f, e.len * sd, e.v, c.bus);
      }
      c.next += sd;
      c.step++;
    }
  }, 25);

  // ---------------- música grabada (banda sonora de Minecraft) ----------------
  // One HTMLAudioElement per track, streamed through createMediaElementSource →
  // its own gain (fades) → musicBus, so volume and mute apply as for the synth.
  // Only the current track is loaded (plus one fading out during a crossfade).

  const MUSIC_DIR = 'assets/music/';
  const XFADE = 2;                 // s: crossfade when the context class changes
  const GAP = [2, 8];              // s of silence between tracks, like Minecraft (but short)
  const FILE_GAIN = 1.2;           // × the track's levelling gain (manifest): about the synth songs' loudness
  let route = null;                // resolved context: { key, cls, tracks: [[id, weight]], synth }
  let stream = null;               // { id, el, src, gain, key }
  let gapTimer = 0, lastId = null, fails = 0, ogg = null, pendingNext = false;
  let routes = {}, routesFiles = null;
  const failed = {};

  /** Files usable at all? Needs the manifest and Ogg Vorbis support; off after 3 failures in a row (and on the online site, which doesn't publish them). */
  function canStream() {
    if (ogg === null) ogg = !!new Audio().canPlayType('audio/ogg; codecs="vorbis"');
    return ogg && !(G.ONLINE && G.ONLINE.music === false) && !!G.MUSIC_FILES && !!G.MUSIC_PLAYLISTS && fails < 3;
  }

  /** Context key (or old id) -> { key, cls, tracks, synth }; null = silence. Cached (per manifest). */
  function resolve(name) {
    if (routesFiles !== G.MUSIC_FILES) { routes = {}; routesFiles = G.MUSIC_FILES; }
    if (name in routes) return routes[name];
    const lists = G.MUSIC_PLAYLISTS || {};
    const key = lists[name] ? name : (G.MUSIC_ALIASES || {})[name] || name;
    const pl = lists[key], biome = G.BIOME_DEFS && G.BIOME_DEFS[key];
    let r = null;
    if (pl) {
      const tracks = pl.tracks.map(t => { const [id, w] = t.split('*'); return [id, +w || 1]; })
        .filter(([id]) => G.MUSIC_FILES && G.MUSIC_FILES[id]);
      r = { key, cls: biome ? 'dim:' + biome.dim : key, tracks, synth: pl.synth };
    } else if (G.MUSIC[name]) r = { key: name, cls: 'synth:' + name, tracks: [], synth: name };
    return (routes[name] = r);
  }

  /** Weighted random track from the route, never the one that just played (unless it's the only one). */
  function pick(r) {
    let c = r.tracks.filter(([id]) => !failed[id]);
    if (c.length > 1) c = c.filter(([id]) => id !== lastId);
    let w = c.reduce((s, t) => s + t[1], 0) * Math.random();
    for (const t of c) if ((w -= t[1]) <= 0) return t[0];
    return c.length ? c[c.length - 1][0] : null;
  }

  /** Starts the next track of the current route (fading in over `fade` s), or its synth song. */
  function startNext(fade) {
    clearTimeout(gapTimer); gapTimer = 0; pendingNext = false;
    if (!route) return;
    if (document.hidden) { pendingNext = true; return; }     // resumes when the page is visible
    const id = canStream() && pick(route);
    if (!id) { synthFor(route.synth); return; }
    stopCurrent();
    playFile(id, fade);
  }

  function playFile(id, fade) {
    const el = new Audio();
    el.preload = 'auto';
    el.src = MUSIC_DIR + id + '.ogg';
    const src = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(FILE_GAIN * (G.MUSIC_FILES[id].gain || 1), t + Math.max(0.05, fade));
    src.connect(gain).connect(musicBus);
    const s = stream = { id, el, src, gain, key: route.key };
    lastId = id;
    el.addEventListener('playing', () => { fails = 0; });
    el.addEventListener('ended', () => {
      if (s !== stream) return;
      release(s); stream = null;
      const gap = GAP[0] + Math.random() * (GAP[1] - GAP[0]);
      gapTimer = setTimeout(() => startNext(0.05), gap * 1000);
    });
    el.addEventListener('error', () => fileFailed(s));
    el.play().catch(e => {
      // Blocked autoplay waits for the next click (unlock); a pause/abort is not a failure.
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') fileFailed(s);
    });
  }

  /** A file wouldn't load or decode: skip it, try another; 3 in a row = synth only. */
  function fileFailed(s) {
    if (s.dead) return;
    failed[s.id] = true; fails++;
    console.warn('[audio] music file failed:', s.id);
    release(s);
    if (s === stream) { stream = null; startNext(0.3); }
  }

  function release(s) {
    if (s.dead) return;
    s.dead = true;
    s.el.pause();
    s.el.removeAttribute('src'); s.el.load();       // frees the decoder and buffered data
    s.src.disconnect(); s.gain.disconnect();
  }

  function fadeOutStream(secs) {
    clearTimeout(gapTimer); gapTimer = 0; pendingNext = false;
    const s = stream;
    if (!s) return;
    stream = null;
    const g = s.gain.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.0001, t + secs);
    setTimeout(() => release(s), secs * 1000 + 100);
  }

  /** Applies `wanted`: same class keeps the track, anything else crossfades. */
  function apply() {
    const r = wanted ? resolve(wanted) : null, prev = route;
    route = r;
    if (!r) { stopCurrent(); fadeOutStream(XFADE); return; }
    if (prev && prev.cls === r.cls && (stream || gapTimer || pendingNext)) return;   // next track comes from r
    fadeOutStream(XFADE);
    startNext(XFADE);
  }

  /** Sets the music context. Cheap and idempotent: the game calls it every frame. */
  function music(name) {
    if (name === undefined) name = null;
    if (wanted === name) return;
    wanted = name;
    if (ctx) apply();                    // otherwise it starts on the first click
  }

  // The game pauses in a hidden tab; the music does too (the synth's scheduler stalls there anyway).
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { if (stream) stream.el.pause(); }
    else if (stream) { if (stream.el.paused) stream.el.play().catch(() => {}); }
    else if (pendingNext) startNext(0.3);
  });

  // ---------------- efectos de sonido ----------------

  const last = {};
  let xpCombo = 0, xpT = 0, voices = 0;

  const SHOT_PITCH = {
    fire: 520, water: 700, electric: 1100, psychic: 800, grass: 640, ice: 900, poison: 400,
    ghost: 350, dragon: 300, fairy: 1200, normal: 600, fighting: 450, rock: 260, ground: 240,
    steel: 750, bug: 980, dark: 330, flying: 820
  };

  function tone(type, f0, f1, dur, vol, at = 0, bus = sfxBus) {
    const t = ctx.currentTime + at;
    const g = ctx.createGain(); g.connect(bus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    const o = osc(type, f0, t, t + dur, g);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  }

  function hiss(dur, vol, type, f0, f1, at = 0, q = 1) {
    const t = ctx.currentTime + at;
    const b = ctx.createBiquadFilter(); b.type = type; b.Q.value = q;
    b.frequency.setValueAtTime(f0, t);
    if (f1) b.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); b.connect(g); g.connect(sfxBus);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    noise(t, dur, b);
  }

  function arp(type, freqs, gap, dur, vol) { freqs.forEach((f, i) => tone(type, f, f, dur, vol, i * gap)); }

  const SFX = {
    hover:   () => tone('square', 1400, 1400, 0.025, 0.025),
    click:   () => { tone('square', 660, 990, 0.05, 0.06); },
    back:    () => tone('square', 880, 520, 0.07, 0.05),
    confirm: () => arp('triangle', [784, 988, 1319], 0.05, 0.12, 0.09),
    select:  () => tone('square', 990, 1180, 0.04, 0.045),
    error:   () => arp('square', [330, 262], 0.08, 0.09, 0.05),
    shot(o) {
      const f = SHOT_PITCH[o.type] || 600;
      if (o.kind === 'melee') hiss(0.12, 0.13, 'bandpass', 600, 2800, 0, 1.4);
      else if (o.kind === 'beam') { tone('sawtooth', f * 0.6, f * 0.35, 0.3, 0.05); hiss(0.25, 0.04, 'bandpass', f * 2, f, 0, 3); }
      else if (o.kind === 'nova') { hiss(0.2, 0.1, 'lowpass', 2400, 300); tone('sine', 140, 60, 0.16, 0.12); }
      else if (o.kind === 'aura') { tone('sine', f * 0.5, f * 0.55, 0.25, 0.04); tone('sine', f * 0.75, f * 0.8, 0.25, 0.03); }
      else if (o.kind === 'buff') arp('sine', [f, f * 1.25, f * 1.5], 0.05, 0.12, 0.05);
      else if (o.kind === 'orbit') tone('triangle', f, f * 1.5, 0.15, 0.04);
      else { tone('triangle', f * 1.5, f * 0.5, 0.09, 0.05); if (o.type === 'fire' || o.type === 'electric') hiss(0.06, 0.03, 'highpass', 3000); }
    },
    hit:     () => tone('triangle', 230, 90, 0.045, 0.045),
    faint:   () => tone('sine', 720, 240, 0.08, 0.04),
    bossDown() { hiss(0.7, 0.18, 'lowpass', 1500, 100); arp('triangle', [262, 330, 392, 523], 0.09, 0.4, 0.08); },
    // Orbe de experiencia: "ding" brillante que sube, con tono al azar (y algo más agudo en racha).
    xp() {
      const now = ctx.currentTime;
      xpCombo = now - xpT < 0.45 ? Math.min(xpCombo + 1, 24) : 0; xpT = now;
      const f = 1050 * Math.pow(2, (Math.random() * 8 - 2 + xpCombo * 0.25) / 12);
      tone('sine', f * 0.92, f * 1.08, 0.11, 0.032);
      tone('sine', f * 2, f * 2.12, 0.05, 0.008);
    },
    // Esmeralda: dos notas de campanita.
    coin() { tone('sine', 1976, 1976, 0.16, 0.032); tone('sine', 2637, 2637, 0.26, 0.028, 0.055); tone('triangle', 5274, 5274, 0.05, 0.004, 0.055); },
    heal:    () => arp('triangle', [523, 659, 784, 1047], 0.06, 0.18, 0.06),
    // Subida de nivel: arpegio brillante que acaba en un acorde que suena un poco.
    levelup() {
      arp('triangle', [523, 659, 784, 1047, 1319], 0.055, 0.2, 0.045);
      [1047, 1319, 1568].forEach(f => tone('sine', f, f, 0.7, 0.022, 0.28));
    },
    // "Uf": golpe grave con una vocal "u" (filtro de banda) que cae.
    hurt() {
      const t = ctx.currentTime;
      const bp = filt('bandpass', 420, 2.5, sfxBus);
      const g = ctx.createGain(); g.connect(bp);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
      const o = osc('sawtooth', 190, t, t + 0.17, g); o.frequency.exponentialRampToValueAtTime(115, t + 0.15);
      tone('sine', 110, 55, 0.12, 0.09);
    },
    boss:    () => { [82, 123, 165].forEach(f => tone('sawtooth', f, f * 0.98, 1.3, 0.05)); INST.kick(ctx.currentTime, 1, sfxBus); },
    surge:   () => hiss(0.7, 0.12, 'lowpass', 500, 120),
    shiny:   () => [2093, 2637, 3136, 2349, 3520, 4186].forEach((f, i) => INST.bell(ctx.currentTime + i * 0.07, f, 0.3, 0.8, sfxBus)),
    shinyGet() { SFX.shiny(); arp('square', [784, 988, 1175, 1568], 0.1, 0.35, 0.05); },
    // Bloque roto: unos crujidos de grava seguidos y un golpe sordo.
    break() {
      for (let i = 0; i < 4; i++) {
        const f = 900 + Math.random() * 1600;
        hiss(0.045, 0.09 - i * 0.015, 'bandpass', f, f * 0.6, i * 0.028 + Math.random() * 0.008, 1.6);
      }
      hiss(0.12, 0.06, 'lowpass', 900, 200);
      tone('triangle', 130, 65, 0.1, 0.07);
    },
    // Cofre: bisagra que cruje, golpe de madera y un brillo de premio.
    chest() {
      const t = ctx.currentTime;
      const bp = filt('bandpass', 1100, 5, sfxBus);
      const g = ctx.createGain(); g.connect(bp);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1, t + 0.04);
      g.gain.setValueAtTime(0.1, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3);
      // Golpecitos irregulares (el volumen va y viene entre 0 y 1): el crujido.
      const am = ctx.createGain(); am.gain.value = 0.5; am.connect(g);
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.setValueAtTime(28, t);
      lfo.frequency.linearRampToValueAtTime(17, t + 0.3);
      const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
      lfo.start(t); lfo.stop(t + 0.32);
      const o = osc('sawtooth', 55, t, t + 0.3, am); o.frequency.linearRampToValueAtTime(95, t + 0.28);
      tone('triangle', 170, 85, 0.1, 0.08, 0.27);
      hiss(0.08, 0.05, 'lowpass', 1200, 300, 0.27);
      [1047, 1319, 1568, 2093].forEach((f, i) => tone('sine', f, f, 0.18, 0.03, 0.32 + i * 0.06));
    },
    grass:   () => hiss(0.06, 0.03, 'highpass', 2600),
    // A pickaxe tick on stone or wood while you break a block.
    dig:     () => { hiss(0.05, 0.05, 'bandpass', 1400, 600); tone('square', 190, 150, 0.03, 0.025); },
    ball:    () => { tone('triangle', 220, 70, 0.12, 0.12); hiss(0.08, 0.06, 'lowpass', 800); },
    shake:   () => tone('square', 420, 380, 0.04, 0.05),
    burst(o) {
      hiss(0.5, 0.14, 'bandpass', 400, 4000, 0, 0.8);
      const r = (o && o.rarity) || 1;
      const chord = [[523, 659, 784], [587, 740, 880], [659, 831, 988], [698, 880, 1047], [784, 988, 1175, 1568]][r - 1];
      chord.forEach(f => tone('triangle', f, f, 0.6 + r * 0.15, 0.04));
    },
    reveal(o) { INST.bell(ctx.currentTime, [523, 659, 784, 988, 1319][((o && o.rarity) || 1) - 1], 0.3, 0.8, sfxBus); },
    rift:    () => { [196, 233, 277, 330].forEach((f, i) => INST.pad(ctx.currentTime + i * 0.08, f, 1.4, 1.2, sfxBus)); hiss(0.9, 0.08, 'bandpass', 900, 300); },
    legend:  () => { arp('square', [523, 659, 784, 1047, 1319, 1568], 0.08, 0.3, 0.05); SFX.shiny(); },
    gameover: () => arp('triangle', [523, 440, 349, 262], 0.2, 0.35, 0.08),
    biome:   () => [392, 494, 587, 784].forEach(f => INST.pad(ctx.currentTime, f, 1.2, 1.4, sfxBus)),
    // La Sentencia de Arceus (systems/judgment.js).
    quake:   () => { hiss(2.4, 0.18, 'lowpass', 320, 50); tone('sine', 52, 30, 2.2, 0.22); },
    toll() {
      const t = ctx.currentTime;
      [110, 165, 220, 330].forEach((f, i) => INST.bell(t, f, 1.4, 1.5 - i * 0.3, sfxBus));
      INST.pad(t, 55, 2.4, 2.6, sfxBus); INST.pad(t, 82.4, 2.4, 2, sfxBus);
      tone('sine', 55, 52, 2.4, 0.16);
    },
    descend() {
      hiss(2.4, 0.07, 'bandpass', 300, 3200, 0, 0.7);
      [262, 330, 392, 523, 659].forEach((f, i) => INST.pad(ctx.currentTime + i * 0.3, f, 2.2, 1.6, sfxBus));
    },
    land() {
      hiss(1.6, 0.32, 'lowpass', 2400, 50); tone('sine', 95, 26, 1.4, 0.36);
      INST.kick(ctx.currentTime, 1.6, sfxBus); INST.kick(ctx.currentTime + 0.12, 1.1, sfxBus);
      arp('square', [523, 659, 784, 1047, 1319], 0.07, 0.6, 0.045);
    },
    // The Aether: a warm chime (the glowstone portal stands, the ending), Herobrine's last roar, a soft love note.
    chime() {
      const t = ctx.currentTime;
      [523, 659, 784, 1047, 1319].forEach((f, i) => INST.bell(t + i * 0.11, f, 0.22, 1.8, sfxBus));
      [262, 392, 523].forEach(f => INST.pad(t, f, 2.4, 1.2, sfxBus));
    },
    roar() {
      hiss(1.8, 0.2, 'lowpass', 900, 80);
      const t = ctx.currentTime;
      const bp = filt('bandpass', 300, 1.5, sfxBus);
      const g = ctx.createGain(); g.connect(bp);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.6);
      const o = osc('sawtooth', 120, t, t + 1.6, g); o.frequency.exponentialRampToValueAtTime(38, t + 1.5);
    },
    love:    () => { tone('sine', 1319, 1319, 0.25, 0.018); tone('sine', 1760, 1760, 0.35, 0.014, 0.09); },
    judge:   () => { tone('sine', 1760, 700, 0.45, 0.04); hiss(0.35, 0.07, 'highpass', 1800, 6000); tone('triangle', 120, 50, 0.3, 0.1); },
    pause:   () => arp('square', [784, 523], 0.06, 0.07, 0.04),
    buy:     () => { SFX.coin(); arp('triangle', [659, 784, 1047], 0.05, 0.12, 0.06); }
  };

  // Separación mínima entre repeticiones del mismo efecto (ms).
  const MIN_GAP = { hit: 45, faint: 60, xp: 35, coin: 50, grass: 70, shot: 70, hover: 40, break: 60, dig: 90, judge: 80 };

  function sfx(name, opts) {
    if (!ctx || settings.muted || settings.sfx <= 0 || ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const now = performance.now();
    const key = name === 'shot' && opts ? 'shot' + opts.kind : name;
    if (now - (last[key] || 0) < (MIN_GAP[name] || 0)) return;
    if (voices > 24) return;                    // tope de voces simultáneas
    last[key] = now;
    voices++; setTimeout(() => voices--, 150);
    try { fn(opts); } catch (e) { /* un efecto nunca debe romper el juego */ }
  }

  /** Para pruebas: mide pico y RMS de la salida durante `ms` milisegundos. */
  function debugMeter(ms = 2000) {
    if (!ctx) return Promise.resolve(null);
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    master.connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = 0, sum = 0, n = 0;
    return new Promise(res => {
      const t0 = performance.now();
      const id = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        for (const v of buf) { const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; n++; }
        if (performance.now() - t0 > ms) {
          clearInterval(id); master.disconnect(an);
          res({ peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4) });
        }
      }, 40);
    });
  }

  /**
   * Para pruebas: toca `secs` segundos de un tema (desde el compás `fromBar`)
   * o una lista de efectos en un OfflineAudioContext, con la misma cadena y
   * volúmenes por defecto, y devuelve el pico y el RMS de la salida.
   *   debugRender({ song: 'cave', secs: 10 }) · debugRender({ sfx: ['xp', 'coin'] })
   */
  async function debugRender({ song: name, sfx: fx, secs = 8, fromBar = 0 } = {}) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return null;
    const saved = [ctx, master, outNode, musicBus, sfxBus, reverb, wet, noiseBuf];
    const sr = 44100, off = new OAC(2, Math.ceil(sr * secs), sr);
    try {
      ctx = off; build(true);
      musicBus.gain.value = 0.55 * 0.7; sfxBus.gain.value = 0.7 * 2.4;
      if (name) {
        const song = compile(G.MUSIC[name]), sd = 60 / song.bpm / 4;
        wet.gain.value = song.wet;
        for (let step = fromBar * 16, t = 0.02; t < secs - 0.05; step++, t += sd) {
          const i = step % song.steps, tt = t + (i % 4 === 2 ? song.swing * sd : 0);
          for (const e of song.ev[i]) {
            if (e.drum) INST[e.inst](tt, e.v, musicBus);
            else INST[e.inst](tt, e.f, e.len * sd, e.v, musicBus);
          }
        }
      }
      for (const n of fx || []) SFX[n]({ kind: 'proj', type: 'fire', rarity: 3 });
    } finally {
      [ctx, master, outNode, musicBus, sfxBus, reverb, wet, noiseBuf] = saved;
    }
    const buf = await off.startRendering();
    let peak = 0, sum = 0, clip = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      for (const v of buf.getChannelData(c)) {
        const a = Math.abs(v);
        if (!Number.isFinite(v)) return { error: 'NaN in output' };
        if (a > peak) peak = a;
        if (a >= 1) clip++;
        sum += v * v;
      }
    }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / (buf.length * buf.numberOfChannels)).toFixed(4), clip };
  }

  /** Para grabar vídeos: la salida final como MediaStream (MediaRecorder). */
  /**
   * Para grabar vídeos: el sonido del juego como MediaStream.
   * @param solo  sólo a la grabación (deja de sonar por los altavoces)
   */
  function debugStream(solo = false) {
    if (!ctx) return null;
    const d = ctx.createMediaStreamDestination();
    outNode.connect(d);
    if (solo) { try { outNode.disconnect(ctx.destination); } catch (e) { /* ya estaba */ } }
    return d.stream;
  }

  return {
    music, sfx, setVolume, toggleMute, unlock, debugMeter, debugRender, debugStream,
    /** Para pruebas: compila un tema de G.MUSIC sin tocarlo (lanza error si está mal escrito). */
    compile,
    /** ¿Ya puede sonar? (el navegador sólo deja tras tocar algo, salvo excepciones) */
    canPlay() { return !!ctx && ctx.state === 'running'; },
    get settings() { return settings; },
    get running() { return !!ctx && ctx.state === 'running'; },
    get track() { return stream ? stream.id : current && current.name; },
    /** For tests: jumps the current music file to `left` seconds before its end. */
    debugSeekEnd(left = 1) {
      const d = stream && (Number.isFinite(stream.el.duration) ? stream.el.duration : (G.MUSIC_FILES[stream.id] || {}).dur);
      if (d) stream.el.currentTime = Math.max(0, d - left);
    },
    /** For tests: what the music is doing right now. */
    get musicState() {
      return {
        wanted, context: route && route.key, cls: route && route.cls,
        mode: stream ? 'file' : current ? 'synth' : gapTimer || pendingNext ? 'gap' : 'idle',
        track: stream ? stream.id : current ? current.name : null,
        time: stream ? stream.el.currentTime : 0, paused: stream ? stream.el.paused : null,
        streaming: canStream(), failed: Object.keys(failed)
      };
    }
  };
})();
