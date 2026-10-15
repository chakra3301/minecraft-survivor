/* ============ util.js — helpers compartidos ============ */
window.G = window.G || {};

/** Altura a la que vuelan proyectiles y efectos sobre el plano del suelo. */
G.LIFT = 18;

G.U = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  /** Elige n elementos distintos al azar. */
  pickN(arr, n) {
    const c = arr.slice();
    const out = [];
    while (out.length < n && c.length) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
    return out;
  },

  dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); },
  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },

  /** Normaliza un vector; devuelve [0,0] si es nulo. */
  norm(x, y) { const m = Math.hypot(x, y); return m > 1e-6 ? [x / m, y / m] : [0, 0]; },

  /** Interpolación independiente del framerate. */
  damp(a, b, rate, dt) { return b + (a - b) * Math.exp(-rate * dt); },

  /** Hash determinista 2D -> [0,1). Para generar el mapa siempre igual. */
  hash(x, y, seed = 0) {
    // Todo en enteros de 32 bits con Math.imul: es la función más llamada
    // al hornear el mapa, y así V8 no sale nunca de la ruta rápida.
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },

  /** "3:07" a partir de segundos. */
  mmss(s) {
    const m = Math.floor(s / 60);
    return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  },

  /** Element colours (projectiles, chips, effects). The ids are PokéSurvivor's 18 type ids;
   *  TYPE_NAME gives each its Minecraft element. */
  TYPE_COLOR: {
    normal: '#d2c4a0', fire: '#ff8a2b', water: '#3f76e4', grass: '#3f9e2f',
    electric: '#ff3b30', ice: '#9fe8ff', fighting: '#c0703a', poison: '#9ad13a',
    ground: '#b5844d', flying: '#d4ecff', psychic: '#2fd0b5', bug: '#c7a92a',
    rock: '#8f8578', ghost: '#7e9c78', dragon: '#e04fd0', dark: '#3c4468',
    steel: '#c4ced8', fairy: '#b48cff'
  },

  TYPE_NAME: {
    normal: 'Overworld', fire: 'Fire', water: 'Aquatic', grass: 'Nature',
    electric: 'Redstone', ice: 'Frost', fighting: 'Brute', poison: 'Poison',
    ground: 'Earth', flying: 'Wind', psychic: 'Ender', bug: 'Arthropod',
    rock: 'Stone', ghost: 'Undead', dragon: 'Dragon', dark: 'Shadow',
    steel: 'Iron', fairy: 'Magic'
  }
};
