/* ============ world.js — arena abierta infinita con obstáculos ============
 *
 * Terreno por tile, determinista (ruido de valor con semilla):
 *   floor   suelo (con manchas de tierra)
 *   wall    formaciones rocosas: bloquean a quien camina y a los proyectiles
 *   liquid  agua (ralentiza) o lava en el volcán (quema)
 *
 * Objetos del escenario (props), dibujados ordenados por Y con las entidades:
 *   tree    bloquea, indestructible (cobertura)
 *   rock    bloquea, se rompe; puede soltar experiencia, monedas o bayas
 *   chest   bloquea, se rompe; suelta un buen botín
 *   grass   hierba alta, no bloquea; se corta con cualquier ataque
 *   altar   altar de poder: al tocarlo da un poder temporal (una vez)
 *   spring  manantial: cura mientras estás encima; se agota y se recarga
 *   bigchest cofre con candado: se abre quedándote al lado unos segundos
 *   trap    trampa (veneno, pegajosa, explosiva): salta al pisarla, también
 *           con los enemigos
 *   (la lógica de los interactivos está en systems/interact.js)
 *
 * Grieta: setArena() convierte una zona lejana del mapa en una arena redonda
 * cerrada por paredes, donde se lucha contra un legendario (systems/rift.js).
 *
 * Ocho dimensiones (setDimension): cada una con su mapa de biomas y, encima
 * del ruido, sus estructuras (ver "estructuras"): el Monumento Oceánico, ruinas,
 * naufragios y chimeneas de magma en The Ocean, pasillos de mina y geodas en
 * el Underworld, salas y pasillos de la fortaleza (y la sala del Portal del
 * End), torres de obsidiana del End, calles y casas de la Ciudad Antigua (y su
 * marco), manchas de corrupción en el mundo de Herobrine. Una estructura pinta
 * con bloques propios (G.Tiles.BLOCK) y pone props de decoración (tipo 'deco').
 *
 * Los Pokémon voladores, los fantasma y los jefes ignoran el terreno.
 *
 * Coordenadas: (x, y) de una entidad = sus PIES, en el plano del suelo.
 * Los chunks se separan en DATOS (baratos, siempre) e IMAGEN (horneada a
 * resolución de arte y sólo para los visibles).
 */
G.World = (() => {
  const T = G.Tiles.T;                     // px de arte por tile
  const N = 16;                            // tiles por chunk
  const TS = T * G.Sprites.PX;             // tamaño de tile en mundo (32)
  const CW = N * TS;                       // tamaño de chunk en mundo (512)
  const FLOOR = 0, WALL = 1, LIQUID = 2, VOID = 3;
  const KIND = ['floor', 'wall', 'liquid', 'void'];

  let seed = 1, dim = 'overworld';
  let over = -1;                           // bioma que tapa a todos (arenas), o -1
  let arena = null;                        // { tx, ty, r } en tiles
  const data = new Map();                  // "cx,cy" -> datos del chunk
  const images = new Map();                // "cx,cy" -> canvas horneado (mapa de biomas)
  const overImages = new Map();            // ídem con el bioma de la arena
  const MAX_IMAGES = 48, MAX_DATA = 400;
  const broken = new Set();                // props destruidos: "tx,ty"
  const portals = [];                      // { x, y, kind }
  const carves = [];                       // claros de los portales: { tx, ty, r }
  let nextPropId = 1;
  let towers = [];                         // The End: { i, tx, ty, x, y (pie), top: { x, y }, caged }
  let portalRoom = null, roomActive = false;     // Fortaleza: sala del Portal del End { x, y, tx, ty }
  let ancientFrame = null, frameLit = false;     // Ciudad Antigua: marco antiguo { x, y (pie), tx, ty }
  let monument = null;                     // The Ocean: { x, y, r, tx, ty, entrance: { x, y }, elders: [{ x, y } ×3] }
  let onPropBroken = null;                 // gancho opcional del juego: fn(prop) al romperse uno

  // ---------------- ruido ----------------

  const H = (x, y, s) => G.U.hash(x, y, s);

  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = H(xi, yi, s), b = H(xi + 1, yi, s), c = H(xi, yi + 1, s), d = H(xi + 1, yi + 1, s);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.65 + vnoise(x * 2.13 + 17, y * 2.13 - 9, s + 1) * 0.35;
  /** fbm se amontona en 0.5: lo estira a algo parecido a un reparto uniforme 0..1. */
  const stretch = v => Math.max(0, Math.min(1, (v - 0.5) * 1.9 + 0.5));

  // ---------------- mapa de biomas ----------------
  /*
   * Como Minecraft: cada dimensión se divide en celdas (Voronoi con los centros
   * algo desplazados, ~72 tiles) y cada celda toma el bioma que mejor encaja con
   * su clima (temperatura y humedad de un ruido muy suave), así los vecinos
   * tienen sentido: la nieve lejos del desierto, la jungla junto al pantano.
   * La costa sale donde la "continentalidad" es baja y las cuevas son manchas
   * raras al azar. Los bordes se deforman con ruido (domain warp) hasta el
   * nivel de tile. La celda del origen es siempre el bioma inicial, y al crear
   * la dimensión se comprueba que todos sus biomas estén a menos de REACH celdas.
   *
   * pts: [temperatura, humedad] ideales de cada bioma (0..1).
   */
  const SURFACE_PTS = { plains: [0.5, 0.42], forest: [0.46, 0.62], dark_forest: [0.36, 0.84], cherry_grove: [0.3, 0.56],
                        savanna: [0.74, 0.3], desert: [0.94, 0.1], badlands: [0.88, 0.38], snowy_plains: [0.06, 0.45],
                        swamp: [0.62, 0.95], jungle: [0.86, 0.8] };
  /*
   * Ganchos opcionales de cada dimensión (ver "estructuras" más abajo):
   *   locate(tx, ty)          bioma por otra regla (la fortaleza: el de su celda)
   *   struct(tx, ty, b1)      terreno de una estructura o -1 (y SB / SP / SV)
   *   post(tx, ty, t, b1, d)  retoca el terreno normal (la corrupción de Herobrine)
   *   liqVar(tx, ty, b1)      ¿este charco es lava?
   *   variant                 variante de bioma con que se pinta toda la dimensión
   *   ws                      escala del ruido de paredes (más grande = masas de roca mayores)
   *   fixed                   biomas que sólo pone una estructura (no ocupan celdas: el monumento)
   *   land(tx, ty, b1, b2, gap) the Aether: island / cloud / sky of a tile (VOID, FLOOR, LIQUID) or -1 = the usual noise
   *   sky                     the void is open sky, limed like rock by widen (narrow gaps over it fill in)
   */
  const GEN = {
    overworld: {
      cell: 72, reach: 4.6, salt: 0, ws: 12, pts: SURFACE_PTS,
      pick(t, h, c) { return c < 0.17 ? 'ocean_shore' : null; }
    },
    herobrine: {
      cell: 72, reach: 4.6, salt: 4441, ws: 12, pts: SURFACE_PTS, variant: 'herobrine',
      pick(t, h, c) { return c < 0.17 ? 'ocean_shore' : null; },
      post: (tx, ty, t, b1, d) => herobrinePost(tx, ty, t, d)
    },
    underworld: {
      cell: 60, reach: 4.2, salt: 3301, ws: 14,
      pts: { dripstone_caves: [0.5, 0.32], lush_caves: [0.3, 0.82], amethyst_caves: [0.8, 0.62] },
      pick(t, h, c, r) { return r < 0.2 ? 'mineshaft' : null; },
      struct: (tx, ty, b1) => underStruct(tx, ty, b1),
      liqVar: (tx, ty, b1) => LAVA_CAVE.has(keys[b1]) && vnoise(tx / 34, ty / 34, seed + 1601) > 0.6
    },
    nether: {
      cell: 66, reach: 4, salt: 7001, ws: 12,
      pts: { nether_wastes: [0.5, 0.5], soul_sand_valley: [0.5, 0.1], crimson_forest: [0.88, 0.5],
             warped_forest: [0.5, 0.9], basalt_deltas: [0.12, 0.5] },
      pick(t, h, c, r) { return r < 0.09 ? 'nether_fortress' : null; }
    },
    stronghold: {
      cell: 64, reach: 4, salt: 5501,
      pts: { stronghold_halls: [0.5, 0.5] },
      pick(t, h, c, r) { return r < 0.3 ? 'stronghold_library' : null; },
      locate: (tx, ty) => strongLocate(tx, ty),
      struct: (tx, ty) => strongTile(tx, ty)
    },
    end: {
      cell: 64, reach: 4, salt: 9103, ws: 12,
      pts: { end_highlands: [0.5, 0.5] },
      pick(t, h, c, r, i, j) {
        if (Math.abs(i) + Math.abs(j) <= 1) return 'the_end';    // la isla principal
        return r < 0.26 ? 'end_city' : null;
      },
      struct: (tx, ty) => endStruct(tx, ty)
    },
    // The Ocean: the seabed. Kelp forest at the origin, warm coral reefs, ruins, cold deep ocean with trenches;
    // the Ocean Monument is a structure with its own region (locate), not a Voronoi cell.
    ocean: {
      cell: 60, reach: 2.6, salt: 8807, ws: 12, fixed: ['ocean_monument'],
      pts: { kelp_forest: [0.5, 0.55], coral_reef: [0.88, 0.42], ocean_ruins: [0.42, 0.12], deep_ocean: [0.1, 0.72] },
      pick() { return null; },
      locate: (tx, ty) => oceanLocate(tx, ty),
      struct: (tx, ty, b1) => oceanStruct(tx, ty, b1)
    },
    // The Aether: sky islands (see "The Aether" below). The sky is the void; nothing hurts, no traps.
    aether: {
      cell: 70, reach: 3.2, salt: 9901, ws: 12, sky: true,
      pts: { aether_meadow: [0.5, 0.5], skyroot_forest: [0.3, 0.78], golden_grove: [0.85, 0.3], cloud_sea: [0.15, 0.2], rainbow_falls: [0.75, 0.85] },
      pick() { return null; },
      locate: (tx, ty) => aetherLocate(tx, ty),
      struct: (tx, ty) => aetherStruct(tx, ty),
      land: (tx, ty, b1, b2, gap) => aetherLand(tx, ty, b1, b2, gap)
    },
    ancient_city: {
      cell: 70, reach: 3.6, salt: 6607, ws: 13,
      pts: { deep_dark: [0.5, 0.5] },
      pick(t, h, c, r, i, j) { return (!i && !j) || r < 0.12 ? 'ancient_city' : null; },
      struct: (tx, ty, b1) => cityTile(tx, ty, b1)
    }
  };
  const LAVA_CAVE = new Set(['dripstone_caves', 'mineshaft', 'amethyst_caves']);

  /*
   * Terreno de cada bioma (umbrales del mismo ruido de siempre):
   *   liq    charcos (fbm < liq; en el End son vacío)    wall  paredes (fbm > 1 - wall)
   *   pil    columnas de 4×4 (probabilidad por celda de PC×PC; ver pillars)
   *   lake   la costa: agua grande en el centro
   *   ls     escala del ruido de charcos
   * Props: tree / grove (densidad de árboles fuera / dentro de una arboleda),
   *   rock, grass (multiplicador de la hierba alta).
   */
  const TERRAIN = {
    plains:         { liq: 0.27, wall: 0.25, tree: 0.006, grove: 0.06, grass: 1 },
    forest:         { liq: 0.24, wall: 0.22, tree: 0.04, grove: 0.13, grass: 1 },
    dark_forest:    { liq: 0.22, wall: 0.24, tree: 0.08, grove: 0.17, grass: 0.8 },
    cherry_grove:   { liq: 0.24, wall: 0.27, tree: 0.025, grove: 0.1, grass: 1 },
    savanna:        { liq: 0.18, wall: 0.25, tree: 0.012, grove: 0.035, grass: 1.2 },
    desert:         { liq: 0.09, wall: 0.2, tree: 0.012, grove: 0.012, grass: 0.35 },
    badlands:       { liq: 0.12, wall: 0.42, pil: 0.2, tree: 0.008, grove: 0.008, rock: 0.016, grass: 0.4 },
    snowy_plains:   { liq: 0.25, wall: 0.23, tree: 0.01, grove: 0.07, grass: 0.4 },
    swamp:          { liq: 0.4, wall: 0.14, tree: 0.02, grove: 0.07, grass: 1.1 },
    jungle:         { liq: 0.26, wall: 0.2, tree: 0.05, grove: 0.15, grass: 1.3 },
    ocean_shore:    { liq: 0.24, wall: 0.16, lake: 1, tree: 0.008, grove: 0.03, grass: 0.6 },
    dripstone_caves:{ liq: 0.22, wall: 0.48, tree: 0.03, grove: 0.08, rock: 0.012, grass: 0.5 },
    lush_caves:     { liq: 0.27, wall: 0.45, tree: 0.03, grove: 0.08, grass: 1, deco: [['berries', 0.012]] },
    amethyst_caves: { liq: 0.2, wall: 0.46, tree: 0.012, grove: 0.03, rock: 0.012, grass: 0.4, deco: [['amethyst', 0.008]] },
    mineshaft:      { liq: 0.16, wall: 0.6, tree: 0.004, grove: 0.006, rock: 0.014, grass: 0.25 },
    stronghold_halls:   { liq: 0, wall: 0, tree: 0, grove: 0, rock: 0.006, grass: 0.18 },
    stronghold_library: { liq: 0, wall: 0, tree: 0, grove: 0, rock: 0.004, grass: 0.3 },
    ancient_city:   { liq: 0.06, wall: 0.2, tree: 0.004, grove: 0.01, rock: 0.006, grass: 0.4, deco: [['candle', 0.004], ['sensor', 0.003]] },
    deep_dark:      { liq: 0.1, wall: 0.42, tree: 0.012, grove: 0.03, rock: 0.012, grass: 0.6, deco: [['sensor', 0.006], ['shrieker', 0.0012]] },
    nether_wastes:  { liq: 0.27, wall: 0.27, tree: 0.004, grove: 0.012, grass: 0.6 },
    crimson_forest: { liq: 0.15, wall: 0.2, tree: 0.035, grove: 0.11, grass: 1.2 },
    warped_forest:  { liq: 0.13, wall: 0.2, tree: 0.035, grove: 0.11, grass: 1.2 },
    soul_sand_valley: { liq: 0.06, wall: 0.24, tree: 0.012, grove: 0.03, grass: 0.4 },
    basalt_deltas:  { liq: 0.23, wall: 0.16, pil: 0.5, tree: 0.012, grove: 0.03, grass: 0.15 },
    nether_fortress:{ liq: 0.12, wall: 0.3, pil: 0.4, tree: 0.012, grove: 0.012, grass: 0.5 },
    the_end:        { liq: 0.24, wall: 0.14, ls: 17, tree: 0, grove: 0, grass: 0.15 },
    end_highlands:  { liq: 0.31, wall: 0.1, ls: 17, tree: 0.012, grove: 0.04, grass: 0.3 },
    end_city:       { liq: 0.16, wall: 0.27, pil: 0.25, ls: 17, tree: 0.012, grove: 0.03, grass: 0.2 },
    // The Ocean. trench: winding bands of deep water (ridges of a slow noise) that cut through everything.
    kelp_forest:    { liq: 0.1, wall: 0.18, tree: 0.03, grove: 0.1, grass: 1.5, deco: [['kelp', 0.035], ['sea_pickle', 0.004]] },
    coral_reef:     { liq: 0.12, wall: 0.34, tree: 0.028, grove: 0.07, rock: 0.006, grass: 0.45, deco: [['sea_pickle', 0.008], ['kelp', 0.006]] },
    ocean_ruins:    { liq: 0.06, wall: 0.16, tree: 0.01, grove: 0.03, rock: 0.012, grass: 0.9, deco: [['kelp', 0.014], ['sea_pickle', 0.002]] },
    deep_ocean:     { liq: 0.03, trench: 0.05, wall: 0.2, tree: 0.006, grove: 0.02, rock: 0.008, grass: 0.4, deco: [['sea_pickle', 0.003]] },
    ocean_monument: { liq: 0, wall: 0.1, tree: 0.008, grove: 0.02, grass: 0.3, deco: [['kelp', 0.008]] },
    // The Aether: Holystone outcrops (with Ambrosium / Zanite / Gravitite ore and Icestone), clear pools in Rainbow Falls.
    aether_meadow:  { liq: 0.07, wall: 0.14, tree: 0.012, grove: 0.06, rock: 0.004, grass: 0.45,
                      deco: [['ambrosium', 0.003], ['zanite', 0.0015], ['gravitite', 0.0005], ['icestone', 0.0008]] },
    skyroot_forest: { liq: 0.05, wall: 0.15, tree: 0.04, grove: 0.13, rock: 0.005, grass: 0.6,
                      deco: [['ambrosium', 0.0025], ['zanite', 0.002], ['gravitite', 0.0008]] },
    golden_grove:   { liq: 0.05, wall: 0.12, tree: 0.03, grove: 0.1, rock: 0.003, grass: 0.45,
                      deco: [['ambrosium', 0.004], ['gravitite', 0.0006]] },
    cloud_sea:      { liq: 0.03, wall: 0.06, tree: 0.008, grove: 0.03, grass: 0.35, deco: [['ambrosium', 0.002], ['icestone', 0.001]] },
    rainbow_falls:  { liq: 0.3, wall: 0.1, tree: 0.02, grove: 0.07, grass: 0.5,
                      deco: [['icestone', 0.002], ['ambrosium', 0.002], ['zanite', 0.002]] }
  };
  const TERRAIN_DEF = TERRAIN.plains;

  // Biomas de la dimensión actual: índice local -> clave / índice en G.Tiles.BIOMES / terreno.
  let keys = [], tileIdx = [], liqVarIdx = [], terr = [], startB = 0, gen = GEN.overworld, isVoid = false;
  let cells = new Map();                   // celda -> { sx, sy, b }
  const cellKey = (i, j) => (i + 32768) * 65536 + (j + 32768);

  function cellClimate(i, j) {
    const C = gen.cell, s = seed + gen.salt;
    const jx = i || j ? (H(i, j, s + 11) - 0.5) * 0.7 : 0, jy = i || j ? (H(i, j, s + 12) - 0.5) * 0.7 : 0;
    const sx = (i + jx) * C, sy = (j + jy) * C, cs = C * 2.6;
    return { sx, sy, t: stretch(fbm(sx / cs, sy / cs, s + 21)), h: stretch(fbm(sx / cs + 40, sy / cs - 40, s + 23)),
             c: stretch(fbm(sx / (C * 3.4) - 90, sy / (C * 3.4) + 50, s + 25)), r: H(i, j, s + 27), i, j };
  }
  function climateDist(k, cl) {
    const p = gen.pts[k];
    return p ? Math.hypot(p[0] - cl.t, p[1] - cl.h) : Infinity;
  }
  function naturalBiome(cl) {
    const k = gen.pick(cl.t, cl.h, cl.c, cl.r, cl.i, cl.j);
    if (k && keys.includes(k)) return keys.indexOf(k);
    let best = startB, bd = Infinity;
    for (const pk in gen.pts) { const d = climateDist(pk, cl); if (d < bd && keys.includes(pk)) { bd = d; best = keys.indexOf(pk); } }
    return best;
  }
  function cellAt(i, j) {
    const k = cellKey(i, j);
    let c = cells.get(k);
    if (!c) {
      const cl = cellClimate(i, j);
      c = { sx: cl.sx, sy: cl.sy, b: naturalBiome(cl) };
      cells.set(k, c);
    }
    return c;
  }

  /**
   * Al crear la dimensión: el origen es el bioma inicial y cada bioma de la
   * lista aparece al menos una vez cerca. Si falta, ocupa la celda cercana que
   * mejor le encaja (por clima; la costa donde la continentalidad es más baja)
   * sin quitarle a otro bioma su única celda.
   */
  function planCells() {
    cells = new Map();
    const R = gen.reach, near = [];
    for (let j = -Math.ceil(R); j <= Math.ceil(R); j++) for (let i = -Math.ceil(R); i <= Math.ceil(R); i++) {
      if (Math.hypot(i, j) > R) continue;
      const cl = cellClimate(i, j);
      const c = { sx: cl.sx, sy: cl.sy, b: i || j ? naturalBiome(cl) : startB, cl, d: Math.hypot(i, j) };
      cells.set(cellKey(i, j), c);
      near.push(c);
    }
    const count = new Array(keys.length).fill(0);
    for (const c of near) count[c.b]++;
    const score = (k, c) => {
      if (k === 'ocean_shore') return c.cl.c;
      if (gen.pts[k]) return climateDist(k, c.cl);
      return c.cl.r;                                     // cuevas, fortaleza, ciudad del End: al azar
    };
    for (let b = 0; b < keys.length; b++) {
      if (count[b] || (gen.fixed && gen.fixed.includes(keys[b]))) continue;
      let best = null, bs = Infinity;
      for (const c of near) {
        if (c.d < 1 || count[c.b] < 2) continue;
        if (keys[startB] === 'the_end' && c.d < 1.5) continue;    // no se come la isla principal
        const s = score(keys[b], c) + c.d * 0.03;
        if (s < bs) { bs = s; best = c; }
      }
      if (best) { count[best.b]--; best.b = b; count[b]++; }
    }
  }

  // Resultado de locate(): bioma (índice local) más cercano, el más cercano de
  // otro bioma, y cuánto más lejos está ese (en tiles; 0 en el borde).
  let L1 = 0, L2 = 0, LGAP = 0;
  const ds = new Float64Array(9), bs = new Int32Array(9);
  function locate(tx, ty) { return gen.locate ? gen.locate(tx, ty) : locateVoronoi(tx, ty); }
  function locateVoronoi(tx, ty) {
    const s = seed + gen.salt, C = gen.cell;
    const wx = tx + (vnoise(tx / 38, ty / 38, s + 31) - 0.5) * 34 + (vnoise(tx / 7, ty / 7, s + 33) - 0.5) * 7;
    const wy = ty + (vnoise(tx / 38 + 9, ty / 38 - 9, s + 32) - 0.5) * 34 + (vnoise(tx / 7 - 5, ty / 7 + 5, s + 34) - 0.5) * 7;
    const ci = Math.round(wx / C), cj = Math.round(wy / C);
    let d1 = Infinity, b1 = startB, n = 0;
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      const c = cellAt(i, j), d = (wx - c.sx) ** 2 + (wy - c.sy) ** 2;
      ds[n] = d; bs[n++] = c.b;
      if (d < d1) { d1 = d; b1 = c.b; }
    }
    let d2 = Infinity, b2 = b1;
    for (let k = 0; k < 9; k++) if (bs[k] !== b1 && ds[k] < d2) { d2 = ds[k]; b2 = bs[k]; }
    L1 = b1; L2 = b2;
    // Cuánto más cerca está el centro propio que el del otro bioma (≈ 2× la distancia al borde).
    LGAP = d2 === Infinity ? 99 : Math.sqrt(d2) - Math.sqrt(d1);
    return b1;
  }

  /**
   * Terreno de un tile dado su bioma (b1, el vecino b2 y la distancia al borde gap).
   * Deja en SB / SP / SV el bloque de estructura, el prop pedido y si el charco es lava.
   */
  function terrainOf(tx, ty, b1, b2, gap) {
    SB = 0; SP = 0; SV = 0; NAT = 0;
    const ad = arenaDist(tx, ty);
    if (ad < arena_outer()) {
      if (ad >= arena.r) return WALL;
      if (arenaSafe(tx, ty)) return FLOOR;
      const th = arena.th;
      // Columnas de 2×2 (cobertura) y charcos según el tipo de la arena. Una columna por celda de 7×7
      // como mucho (entre dos caben 4), cerca del centro, lejos de los charcos y fuera del pasillo libre.
      if (th.pillars && ad < arena.r - 2) {
        const lx = tx - arena.tx, ly = ty - arena.ty, ci = Math.floor(lx / 7), cj = Math.floor(ly / 7);
        const px = ci * 7 + 2 + Math.floor(H(ci, cj, seed + 34 + arena.tx) * 2), py = cj * 7 + 2 + Math.floor(H(ci, cj, seed + 35 + arena.tx) * 2);
        if (lx >= px && lx <= px + 1 && ly >= py && ly <= py + 1 && H(ci, cj, seed + 31 + arena.tx) < Math.min(0.9, th.pillars * 10) &&
            Math.hypot(px + 1, py + 1) < arena.r - 5 &&
            ![0, 1, 2, 3].some(k => arenaSafe(arena.tx + px + (k & 1), arena.ty + py + (k >> 1))) &&
            !(th.pools && fbm((arena.tx + px + 1) / 3.2, (arena.ty + py + 1) / 3.2, seed + 37 + arena.tx) < th.pools + 0.15)) return WALL;
      }
      if (th.pools && ad < arena.r - 1.5 && fbm(tx / 3.2, ty / 3.2, seed + 37 + arena.tx) < th.pools) return LIQUID;
      return FLOOR;
    }
    if (carved(tx, ty, 0)) return FLOOR;
    if (gen.struct) { const st = gen.struct(tx, ty, b1); if (st >= 0) return st; }
    const t = naturalTerrain(tx, ty, b1, b2, gap);
    NAT = t === WALL || (t === VOID && gen.sky) ? 1 : 2;   // terreno del ruido: la roca (y el cielo del Aether) se puede limar (ver widen)
    return gen.post ? gen.post(tx, ty, t, b1, Math.hypot(tx, ty)) : t;
  }

  function naturalTerrain(tx, ty, b1, b2, gap) {
    const d = Math.hypot(tx, ty);
    if (d < 9) return FLOOR;                          // claro inicial
    const ramp = G.U.clamp((d - 9) / 8, 0, 1);       // aparición suave
    if (gen.land) { const l = gen.land(tx, ty, b1, b2, gap); if (l >= 0) return l; }
    // Cerca del borde los umbrales se funden con los del vecino (sin cortes rectos).
    const A = terr[b1], B = terr[b2], w = 0.5 + 0.5 * Math.min(1, gap / 12);
    const mix = k => (A[k] || 0) * w + (B[k] || 0) * (1 - w);
    let liq = mix('liq');
    if (A.lake) liq += 0.55 * G.U.clamp((gap - 7) / 20, 0, 1);    // la costa: mar por dentro
    const ls = A.ls || 13, ws = gen.ws || 8;
    const tr = mix('trench');
    if (tr && Math.abs(vnoise(tx / 30, ty / 30, seed + 2801) - 0.5 + (vnoise(tx / 6, ty / 6, seed + 2802) - 0.5) * 0.04) < tr * ramp) return LIQUID;
    if (fbm(tx / ls, ty / ls, seed + 101) < (0.04 + (liq - 0.04) * ramp)) {
      if (isVoid) return VOID;
      if (gen.liqVar && gen.liqVar(tx, ty, b1)) SV = 1;
      return LIQUID;
    }
    if (fbm(tx / ws, ty / ws, seed + 202) > 1 - mix('wall') * ramp) return WALL;
    return FLOOR;
  }

  // ---------------- estructuras ----------------
  /*
   * Cada dimensión puede construir encima del ruido: devuelven el terreno del
   * tile y dejan en SB el bloque (G.Tiles.BLOCK) con que se pinta, en SP un
   * prop pedido (índice en G.Tiles.DECO + 1, o SP_CHEST) y en SV = 1 si el
   * charco es de lava. Todo es determinista (semilla + coordenadas) y barato:
   * lo que se repite por celda se guarda en mapas.
   */
  const BK = G.Tiles.BLOCK;
  const DK = {};
  G.Tiles.DECO.forEach((n, i) => { DK[n] = i + 1; });
  const SP_CHEST = 255;
  let SB = 0, SP = 0, SV = 0, NAT = 0;
  const mod = (a, m) => ((a % m) + m) % m;

  // --- Herobrine: la superficie con manchas de corrupción y antorchas de almas.
  function herobrinePost(tx, ty, t, d) {
    if (t !== FLOOR || d < 11) return t;
    if (fbm(tx / 10, ty / 10, seed + 1901) > 0.7) {
      const v = vnoise(tx / 3.5, ty / 3.5, seed + 1902);
      SB = v < 0.42 ? BK.netherrack : v < 0.62 ? BK.soul_sand : BK.soul_soil;
    } else if (H(tx, ty, seed + 1911) < 0.0035) SP = DK.soul_torch;
    return t;
  }

  // --- Underworld: pasillos de mina y geodas de amatista.
  /** Mina: pasillos de MW de ancho cada MS tiles, tablones, raíl en medio, puntales (pegados a la roca) y telarañas. */
  const MS = 22, MW = 7;
  function mineshaftAt(tx, ty) {
    const rx = Math.floor(tx / MS), ry = Math.floor(ty / MS), ox = tx - rx * MS, oy = ty - ry * MS;
    const inH = oy < MW && H(rx, ry, seed + 1501) < 0.8, inV = ox < MW && H(rx, ry, seed + 1502) < 0.62;
    if (!inH && !inV) return -1;
    const mid = MW >> 1;
    if (inH && inV) SB = BK.planks;
    else if (inH) {
      SB = oy === mid ? BK.rail_ew : BK.planks;
      if ((oy === 0 || oy === MW - 1) && mod(tx, 5) === 2 && ox >= MW) SP = DK.post;
    } else {
      SB = ox === mid ? BK.rail_ns : BK.planks;
      if ((ox === 0 || ox === MW - 1) && mod(ty, 5) === 2 && oy >= MW) SP = DK.post;
    }
    if (!SP && SB === BK.planks && H(tx, ty, seed + 1503) < 0.03) SP = DK.web;
    return FLOOR;
  }
  /** Geoda: anillos de basalto liso, calcita y amatista (con brotes), hueca, con una grieta ancha para entrar. */
  const GS = 30;
  function geodeAt(tx, ty) {
    const gi = Math.floor(tx / GS), gj = Math.floor(ty / GS);
    if (H(gi, gj, seed + 1511) > 0.42) return -1;
    const cx = gi * GS + 15 + Math.round((H(gi, gj, seed + 1512) - 0.5) * 6), cy = gj * GS + 15 + Math.round((H(gi, gj, seed + 1513) - 0.5) * 6);
    if (cx * cx + cy * cy < 576) return -1;
    // Hueco de radio R - 3 (7 tiles de ancho como mínimo) dentro de 3 anillos de roca.
    const R = 6.6 + H(gi, gj, seed + 1514) * 2, dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy);
    if (d > R + 4) return -1;
    // La grieta: un sector de unos 5 tiles de ancho que llega hasta fuera.
    const a0 = H(gi, gj, seed + 1515) * 6.2832;
    let da = Math.abs(Math.atan2(dy, dx) - a0);
    if (da > Math.PI) da = 6.2832 - da;
    const gapHalf = 2.5 / Math.max(2, d);
    if (d > R + 0.5) return FLOOR;                                    // un pasillo alrededor (3 de ancho)
    if (da < gapHalf && d > R - 3.2) { SB = BK.tuff_f; return FLOOR; }
    if (d > R - 1) { SB = BK.basalt_w; return WALL; }
    if (d > R - 2) { SB = BK.calcite_w; return WALL; }
    if (d > R - 3) { SB = BK.amethyst_w; return WALL; }
    SB = BK.amethyst_f;
    if (H(tx, ty, seed + 1516) < 0.16) SP = DK.amethyst;
    return FLOOR;
  }
  function underStruct(tx, ty, b1) {
    if (tx * tx + ty * ty < 144) return -1;
    const k = keys[b1];
    if (k === 'mineshaft') return mineshaftAt(tx, ty);
    if (k === 'amethyst_caves') return geodeAt(tx, ty);
    return -1;
  }

  // --- Fortaleza: salas en una rejilla de SG tiles unidas por pasillos de 2·CH + 1 de ancho.
  /*
   * Cada celda (i, j) tiene una sala (o un cruce del ancho del pasillo) alrededor de (i·SG, j·SG).
   * Los pasillos van por las líneas de la rejilla. Cada celda se une a la vecina
   * que la acerca al origen (un árbol: todo queda conectado) y a veces a otras.
   * El bioma de un tile es el de su celda (las bibliotecas son salas enteras).
   */
  const SG = 32, CH = 3;
  let sCells = new Map(), sPortal = null;
  const towardX = (i, j) => (j === 0 ? true : i === 0 ? false : H(i, j, seed + 1712) < 0.5);
  function sEdgeE(i, j) {                 // (i, j) <-> (i + 1, j)
    if (sPortal && sPortal.j === j && (sPortal.i === i || sPortal.i === i + 1)) return true;
    return (i < 0 && towardX(i, j)) || (i + 1 > 0 && towardX(i + 1, j)) || H(i, j, seed + 1713) < 0.3;
  }
  function sEdgeS(i, j) {                 // (i, j) <-> (i, j + 1)
    if (sPortal && sPortal.i === i && (sPortal.j === j || sPortal.j === j + 1)) return true;
    return (j < 0 && !towardX(i, j)) || (j + 1 > 0 && !towardX(i, j + 1)) || H(i, j, seed + 1714) < 0.3;
  }
  function sCell(i, j) {
    const k = cellKey(i, j);
    let c = sCells.get(k);
    if (c) return c;
    const cx = i * SG, cy = j * SG;
    const portal = !!sPortal && sPortal.i === i && sPortal.j === j, start = !i && !j;
    const b = portal || start ? startB : locateVoronoi(cx, cy);
    const lib = keys[b] === 'stronghold_library';
    c = { b, type: 'junction', rx: cx, ry: cy, hw: CH, hh: CH };
    if (start) Object.assign(c, { type: 'start', hw: 10, hh: 10 });
    else if (portal) Object.assign(c, { type: 'portal', hw: 10, hh: 10 });
    else if (H(i, j, seed + 1701) < (lib ? 0.95 : 0.78)) {
      const t = H(i, j, seed + 1706);
      c.type = lib ? 'library' : t < 0.1 ? 'fountain' : t < 0.32 ? 'pillars' : t < 0.47 ? 'prison' : t < 0.62 ? 'store' : 'hall';
      // Salas de 13-19 tiles (bibliotecas de 19-25): entre dos salas vecinas quedan 3 de pared como mínimo.
      c.hw = (lib ? 9 : 6) + Math.floor(H(i, j, seed + 1702) * 4);
      c.hh = (lib ? 9 : 6) + Math.floor(H(i, j, seed + 1703) * 4);
      c.rx = cx + Math.round((H(i, j, seed + 1704) - 0.5) * 4);
      c.ry = cy + Math.round((H(i, j, seed + 1705) - 0.5) * 4);
      if (c.type === 'pillars' && (c.hw < 8 || c.hh < 8)) c.type = 'hall';
    }
    sCells.set(k, c);
    return c;
  }
  function strongLocate(tx, ty) {
    const c = sCell(Math.round(tx / SG), Math.round(ty / SG));
    L1 = L2 = c.b; LGAP = 99;
    return c.b;
  }
  function strongTile(tx, ty) {
    const i = Math.round(tx / SG), j = Math.round(ty / SG), c = sCell(i, j);
    const lx = tx - c.rx, ly = ty - c.ry;
    if (Math.abs(lx) <= c.hw && Math.abs(ly) <= c.hh) return roomTile(c, lx, ly, tx, ty);
    const dx = tx - i * SG, dy = ty - j * SG;
    const hor = Math.abs(dy) <= CH && (dx > 0 ? sEdgeE(i, j) : sEdgeE(i - 1, j));
    const ver = Math.abs(dx) <= CH && (dy > 0 ? sEdgeS(i, j) : sEdgeS(i, j - 1));
    if (!hor && !ver) return WALL;
    // Antorchas a los lados del pasillo, cada 9 tiles.
    if (hor && Math.abs(dy) === CH && mod(dx, 9) === 4 && !ver) SP = DK.torch;
    else if (ver && Math.abs(dx) === CH && mod(dy, 9) === 4 && !hor) SP = DK.torch;
    return FLOOR;
  }
  function roomTile(c, lx, ly, tx, ty) {
    const ax = Math.abs(lx), ay = Math.abs(ly), hw = c.hw, hh = c.hh;
    // Lo sólido va pegado a la pared (en la esquina), sin dejar un hueco de 1 detrás.
    const corner = ax === hw && ay === hh;
    switch (c.type) {
      case 'portal': return portalRoomTile(lx, ly);
      case 'start': if (corner) SP = DK.chain_lantern; return FLOOR;
      case 'pillars':
        // Cuatro columnas de 2×2 a 4 tiles de las paredes.
        if (ax >= hw - 5 && ax <= hw - 4 && ay >= hh - 5 && ay <= hh - 4) { SB = BK.sb_pillar; return WALL; }
        if (!lx && !ly) SP = DK.chain_lantern;
        return FLOOR;
      case 'fountain': {
        const d = Math.hypot(lx, ly);
        if (d < 2.3) return LIQUID;
        if (d < 3.4) SB = BK.water_rim;
        else if (corner) SP = DK.torch;
        return FLOOR;
      }
      case 'prison': {
        // Celdas de 5 al norte: tabiques cada 6 (las de los extremos, más anchas) y un frente de
        // barrotes junto a cada tabique y a la pared: puertas de 3 como mínimo.
        const front = -(hh - 3), cut = v => mod(v, 6) === 0 && Math.abs(v) <= hw - 5;
        if (ly < front && cut(lx)) { SB = BK.sb_pillar; return WALL; }
        if (ly === front && (cut(lx) || cut(lx - 1) || cut(lx + 1) || ax === hw)) SP = DK.bars;
        else if (ly < front && H(tx, ty, seed + 1721) < 0.12) SP = DK.web;
        return FLOOR;
      }
      case 'store':
        if (ax === hw && H(tx, ty, seed + 1722) < 0.16) SP = SP_CHEST;
        else if (H(tx, ty, seed + 1723) < 0.1) SP = DK.web;
        return FLOOR;
      case 'library':
        // Estanterías en filas cada 5 (pasillos de 4), con un pasillo central de 5 y de 4 a los lados.
        if (mod(ly, 5) === 0 && ay <= hh - 5 && ax <= hw - 4 && ax > 2) { SB = BK.bookshelf_w; return WALL; }
        if (!lx && !ly) SP = DK.chain_lantern;
        else if (H(tx, ty, seed + 1724) < 0.03) SP = DK.web;
        else if (H(tx, ty, seed + 1725) < 0.025) SP = DK.candle;
        else if (ax === hw && H(tx, ty, seed + 1726) < 0.05) SP = SP_CHEST;
        return FLOOR;
      case 'hall': if (corner) SP = DK.torch; return FLOOR;
      default: return FLOOR;
    }
  }
  /**
   * Sala del Portal del End (21×21): marco de 12 bloques sobre una plataforma,
   * escalera al sur con lava a los dos lados, generador de lepépismas y barrotes
   * y faroles pegados a las paredes.
   */
  function portalRoomTile(lx, ly) {
    const fx = lx, fy = ly + 2, m = Math.max(Math.abs(fx), Math.abs(fy));
    if (m <= 1) { SB = BK.pit; return FLOOR; }
    if (m === 2) { SB = Math.abs(fx) === 2 && Math.abs(fy) === 2 ? BK.frame_corner : BK.frame; return FLOOR; }
    if (m === 3) { SB = BK.sb_raised; return FLOOR; }
    if (ly >= 2 && ly <= 4 && Math.abs(lx) <= 4) {
      if (Math.abs(lx) <= 1) { SB = BK.stairs; return FLOOR; }
      SV = 1; SB = BK.sb_raised; return LIQUID;
    }
    SB = BK.sb_floor;
    if (!lx && ly === 6) SP = DK.spawner;
    else if (Math.abs(lx) === 10 && (ly === -5 || ly === -4 || ly === 4 || ly === 5)) SP = DK.bars;
    else if (Math.abs(lx) === 10 && Math.abs(ly) === 10) SP = DK.chain_lantern;
    return FLOOR;
  }
  /** Elige la celda de la sala del portal: a 60-120 tiles del origen, en una dirección al azar (por semilla). */
  function planStronghold() {
    const a = H(seed, 1, 1801) * 6.2832, D = 66 + H(seed, 2, 1802) * 46;
    let best = null, bd = Infinity;
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      const dist = Math.hypot(i, j) * SG;
      if (dist < 62 || dist > 118) continue;
      const e = Math.hypot(i * SG - Math.cos(a) * D, j * SG - Math.sin(a) * D);
      if (e < bd) { bd = e; best = { i, j }; }
    }
    sPortal = best;
    // r: radio (px) del marco y su plataforma, para la zona donde aguantar.
    portalRoom = { x: best.i * SG * TS + TS / 2, y: (best.j * SG - 2) * TS + TS / 2, tx: best.i * SG, ty: best.j * SG - 2, r: 3.5 * TS };
  }

  // --- The End: torres de obsidiana alrededor de la isla principal.
  function planTowers() {
    const n = (G.DIM_BY && G.DIM_BY.end && G.DIM_BY.end.crystals) || 8, a0 = H(seed, 3, 2101) * 6.2832;
    const TW = G.Tiles.TOWER, P = G.Sprites.PX;
    for (let k = 0; k < n; k++) {
      const a = a0 + k * 6.2832 / n, r = 14 + H(k, seed, 2102) * 4;
      const tx = Math.round(Math.cos(a) * r), ty = Math.round(Math.sin(a) * r), foot = (ty + 2) * TS;
      towers.push({ i: k, tx, ty, x: tx * TS + TS / 2, y: foot, top: { x: tx * TS + TS / 2, y: foot - (TW.FACE + TW.TOP / 2) * P },
                    caged: H(k, seed, 2103) < 0.35 });
    }
  }
  function endStruct(tx, ty) {
    const d2 = tx * tx + ty * ty;
    if (d2 >= 676) return -1;                         // la isla central: 26 tiles de radio
    if (d2 > 100) for (const t of towers) if (Math.abs(tx - t.tx) <= 1 && Math.abs(ty - t.ty) <= 1) { SB = BK.obsidian_w; return WALL; }
    return FLOOR;                                    // la isla central, sin agujeros al vacío
  }

  // --- Ciudad Antigua: manzanas de CS tiles (12 de solar) con calles de CST de pizarra pulida, y el marco antiguo.
  const CS = 17, CST = 5;
  let frameT = null;
  function planCity() {
    const a = Math.floor(H(seed, 5, 2201) * 8) * Math.PI / 4, d = 24;
    const tx = Math.round(Math.cos(a) * d), ty = Math.round(Math.sin(a) * d);
    frameT = { tx, ty };
    ancientFrame = { x: tx * TS + TS / 2, y: ty * TS + TS - 4, tx, ty };
  }
  function cityTile(tx, ty, b1) {
    if (frameT) {
      // Plaza del marco: pilares de pizarra reforzada (2×2) y el hueco de 7 en medio.
      const fx = tx - frameT.tx, fy = ty - frameT.ty, afx = Math.abs(fx);
      if (afx <= 9 && fy >= -8 && fy <= 4) {
        if ((fy === -1 || fy === 0) && (afx === 4 || afx === 5)) { SB = BK.reinforced_w; return WALL; }
        SB = fy >= 1 && afx <= 3 ? BK.deep_path : BK.deep_tiles;
        if (fy === 2 && afx === 7) SP = DK.lantern;
        return FLOOR;
      }
    }
    if (keys[b1] !== 'ancient_city') return -1;
    if (tx * tx + ty * ty < 81) { SB = BK.deep_tiles; return FLOOR; }
    const ox = mod(tx, CS), oy = mod(ty, CS);
    if (ox < CST || oy < CST) { SB = BK.deep_path; return FLOOR; }
    const bi = Math.floor(tx / CS), bj = Math.floor(ty / CS), r = H(bi, bj, seed + 2211);
    const lx = ox - CST, ly = oy - CST;              // 0..11 dentro de la manzana
    const sculk = fbm(tx / 6, ty / 6, seed + 2212) > 0.6;
    const floorB = sculk ? BK.sculk_f : BK.deep_tiles;
    if ((lx === 0 || lx === 11) && (ly === 0 || ly === 11)) {
      SB = BK.deep_tiles;
      if (H(bi, bj, seed + 2213) < 0.6) SP = DK.lantern;
      return FLOOR;
    }
    // Muro de 10×10 (de 1 a 10), dentro 8×8.
    const ring = lx >= 1 && lx <= 10 && ly >= 1 && ly <= 10 && (lx === 1 || lx === 10 || ly === 1 || ly === 10);
    const inside = lx > 1 && lx < 10 && ly > 1 && ly < 10;
    const wallIn = inside && (lx === 2 || lx === 9 || ly === 2 || ly === 9);
    if (r < 0.45) {
      // Casa: muros de ladrillo / baldosa de pizarra con una puerta de 4.
      const s = Math.floor(H(bi, bj, seed + 2214) * 4), mid = v => v >= 4 && v <= 7;
      const door = (s === 0 && ly === 1 || s === 1 && ly === 10) && mid(lx) ||
                   (s === 2 && lx === 1 || s === 3 && lx === 10) && mid(ly);
      if (ring && !door) {
        SB = r < 0.08 ? BK.reinforced_w : H(bi, bj, seed + 2215) < 0.5 ? BK.deep_bricks_w : BK.deep_tiles_w;
        return WALL;
      }
      SB = floorB;
      if (inside && lx === 5 && ly === 5 && r < 0.3) SP = DK.shrieker;
      else if (inside && H(tx, ty, seed + 2216) < 0.03) SP = DK.candle;
      else if (wallIn && H(tx, ty, seed + 2217) < 0.03) SP = SP_CHEST;
      return FLOOR;
    }
    if (r < 0.7) {
      // Plaza: sculk, un chillador en medio y sensores.
      SB = floorB;
      if (lx === 5 && ly === 5) SP = DK.shrieker;
      else if (H(tx, ty, seed + 2218) < 0.025) SP = DK.sensor;
      return FLOOR;
    }
    if (r < 0.85) {
      // Torre de pizarra reforzada (4×4) con faroles alrededor.
      if (lx >= 4 && lx <= 7 && ly >= 4 && ly <= 7) { SB = BK.reinforced_w; return WALL; }
      SB = floorB;
      if ((lx === 3 || lx === 8) && (ly === 3 || ly === 8)) SP = DK.lantern;
      return FLOOR;
    }
    // Ruinas: esquinas del muro en L (alguna se ha caído); por en medio de cada lado se pasa (4 de ancho).
    if (ring && !(lx >= 4 && lx <= 7) && !(ly >= 4 && ly <= 7) && H(bi * 2 + (lx > 5), bj * 2 + (ly > 5), seed + 2219) < 0.7) { SB = BK.deep_bricks_w; return WALL; }
    SB = sculk ? BK.sculk_f : 0;
    if (H(tx, ty, seed + 2220) < 0.02) SP = DK.sensor;
    return FLOOR;
  }

  // --- The Ocean: the Ocean Monument, ocean ruins, shipwrecks and magma vents.
  /*
   * The monument is a square block of prismarine (2·MHS + 1 tiles a side) whose front faces the origin, in local
   * coordinates u (across) and v (depth: -MHS at the front wall, +MHS at the back):
   *   gate        |u| ≤ 3, front corridor into the great hall (7 wide)
   *   great hall  |u| ≤ 10, v -14..4, four 2×2 sea-lantern pillars
   *   wings       |u| 13..22, v -14..4 (wet sponge walls), each with its own corridor from the front (6 wide)
   *               and a 5-wide door from the great hall
   *   penthouse   |u| ≤ 8, v 8..21, behind the hall (5-wide door), gold in the middle
   * The two wings and the penthouse hold the Elder Guardians (monument.elders). Everything else inside is solid
   * prismarine (dark prismarine corner towers); an apron of MAP tiles of clear seabed surrounds it, and the
   * ocean_monument biome is the rounded square of half-size MON_R around it.
   */
  const MHS = 24, MAP = 5, MON_R = 35;
  let mon = null, monB = -1;
  /** Places the monument 76-92 tiles from the origin in a direction from the seed, its gate facing the origin. */
  function planMonument() {
    monB = keys.indexOf('ocean_monument');
    const a = H(seed, 7, 2501) * 6.2832, D = 76 + H(seed, 8, 2502) * 16;
    const tx = Math.round(Math.cos(a) * D), ty = Math.round(Math.sin(a) * D);
    const c = Math.cos(a), s = Math.sin(a);
    const nx = Math.abs(c) >= Math.abs(s) ? -Math.sign(c) : 0, ny = nx ? 0 : -Math.sign(s);
    mon = { tx, ty, nx, ny };
    // Local (u, v) -> world px of that tile's centre (u, v may be fractional).
    const at = (u, v) => ({ x: (tx - v * nx + u * ny + 0.5) * TS, y: (ty - v * ny - u * nx + 0.5) * TS });
    mon.lamps = [];
    for (const [pu, pv] of [[-5, -10], [4, -10], [-5, -2], [4, -2]]) mon.lamps.push(at(pu + 0.5, pv + 0.5));
    for (const su of [-1, 1]) for (const sv of [-1, 1]) mon.lamps.push(at(su * (MHS - 2.5), sv * (MHS - 2.5)));
    monument = { x: at(0, 0).x, y: at(0, 0).y, r: (MHS + 0.5) * TS, tx, ty,
                 entrance: at(0, -MHS - 2), elders: [at(-17.5, -5), at(17.5, -5), at(0, 14.5)] };
  }
  function oceanLocate(tx, ty) {
    const b = locateVoronoi(tx, ty);
    if (!mon || monB < 0) return b;
    const dx = Math.abs(tx - mon.tx), dy = Math.abs(ty - mon.ty);
    if (dx > MON_R + 4 || dy > MON_R + 4) return b;
    const d = Math.max(dx, dy) * 0.8 + Math.hypot(dx, dy) * 0.2 + (vnoise(tx / 9, ty / 9, seed + 2601) - 0.5) * 6;
    if (d >= MON_R) return b;
    L2 = b; L1 = monB; LGAP = Math.min(99, (MON_R - d) * 2);
    return monB;
  }
  function oceanStruct(tx, ty, b1) {
    if (mon) {
      const lx = tx - mon.tx, ly = ty - mon.ty;
      if (Math.abs(lx) <= MHS + MAP && Math.abs(ly) <= MHS + MAP)
        return monumentTile(lx * mon.ny - ly * mon.nx, -(lx * mon.nx + ly * mon.ny), tx, ty);
    }
    if (tx * tx + ty * ty < 225) return -1;
    const rc = ruinCell(Math.floor(tx / RS), Math.floor(ty / RS));
    if (rc) { const r = ruinTile(tx, ty, rc); if (r >= 0) return r; }
    if (ventCell(Math.floor(tx / VG), Math.floor(ty / VG))) return ventTile(tx, ty);
    return -1;
  }
  /*
   * Ruins, wrecks and vents are chosen per cell from the biome at the cell's centre (so a structure is never
   * cut by a biome edge), never near the origin or the monument. Cached per cell (oCells).
   */
  let oCells = new Map();
  const nearMonument = (x, y, m) => mon && Math.abs(x - mon.tx) <= MHS + MAP + m && Math.abs(y - mon.ty) <= MHS + MAP + m;
  /** Biome key at a tile without touching the locate() results of the tile being generated. */
  function keyAt(tx, ty) { const a = L1, b = L2, g = LGAP, k = keys[locate(tx, ty)]; L1 = a; L2 = b; LGAP = g; return k; }
  function ruinCell(i, j) {
    const k = cellKey(i, j) * 2;
    let c = oCells.get(k);
    if (c !== undefined) return c;
    const cx = i * RS + 11, cy = j * RS + 11, b = keyAt(cx, cy), r = H(i, j, seed + 2701);
    const pr = b === 'ocean_ruins' ? 0.34 : b === 'kelp_forest' ? 0.05 : b === 'coral_reef' ? 0.03 : 0;
    const pw = b === 'ocean_ruins' ? 0.12 : b === 'kelp_forest' ? 0.07 : b === 'deep_ocean' ? 0.05 : 0;
    c = cx * cx + cy * cy < 576 || nearMonument(cx, cy, 12) ? 0 : r < pr ? 1 : r < pr + pw ? 2 : 0;
    oCells.set(k, c);
    return c;
  }
  function ventCell(i, j) {
    const k = cellKey(i, j) * 2 + 1;
    let c = oCells.get(k);
    if (c !== undefined) return c;
    const cx = i * VG + 13, cy = j * VG + 13;
    c = H(i, j, seed + 2751) < 0.22 && cx * cx + cy * cy > 900 && !nearMonument(cx, cy, 16) && keyAt(cx, cy) === 'deep_ocean' ? 1 : 0;
    oCells.set(k, c);
    return c;
  }
  function monumentTile(u, v, tx, ty) {
    const au = Math.abs(u), av = Math.abs(v);
    if (au > MHS || av > MHS) {                                              // the apron: clear seabed
      if (v === -MHS - 2 && au === 6) SP = DK.sea_lantern;                   // two lanterns flank the main gate
      return FLOOR;
    }
    const wall = b => { SB = b; return WALL; };
    const room = (b, corner) => { SB = b; if (corner) SP = DK.sea_lantern; return FLOOR; };
    // Corridors from the front (main gate and the two wing gates), through the 2-thick front wall.
    if (v <= -15 && (au <= 3 || (au >= 15 && au <= 20))) return room(au === 0 || au === 17 || au === 18 ? BK.pris_band_f : BK.pris_f, false);
    if (au >= MHS - 1 || av >= MHS - 1) return wall(au >= MHS - 5 && av >= MHS - 5 ? BK.pris_dark_w : BK.pris_w);
    // Great hall, with four 2×2 sea-lantern pillars.
    if (au <= 10 && v >= -14 && v <= 4) {
      if ((u === -5 || u === -4 || u === 4 || u === 5) && (v === -10 || v === -9 || v === -2 || v === -1)) return wall(BK.pris_lamp_w);
      return room(au <= 1 || v === -6 ? BK.pris_band_f : BK.pris_f, au === 10 && (v === -14 || v === 4));
    }
    // Doors: hall <-> wings (v -7..-3), hall <-> penthouse (|u| <= 2).
    if (au >= 11 && au <= 12 && v >= -7 && v <= -3) return room(BK.pris_band_f, false);
    if (au <= 2 && v >= 5 && v <= 7) return room(BK.pris_band_f, false);
    // Wings: wet sponge rooms.
    if (au >= 13 && au <= 22 && v >= -14 && v <= 4) return room(BK.wing_f, (au === 13 || au === 22) && (v === -14 || v === 4));
    // Penthouse: dark prismarine with a gold core where its Elder Guardian waits.
    if (au <= 8 && v >= 8 && v <= 21) {
      if (au <= 1 && (v === 14 || v === 15)) return room(BK.gold_f, false);
      return room(au <= 3 && v >= 11 && v <= 18 ? BK.pris_f : BK.pris_band_f, au === 8 && (v === 8 || v === 21));
    }
    // Solid prismarine; the walls around the wings are wet sponge, the corner towers dark prismarine.
    if (au >= MHS - 5 && av >= MHS - 5) return wall(BK.pris_dark_w);
    if (au >= 11 && au <= 23 && v >= -15 && v <= 5 && (au === 12 || v === -15 || v === 5)) return wall(BK.sponge_w);
    return wall((au + av) % 6 === 0 ? BK.pris_dark_w : BK.pris_w);
  }

  /*
   * Ruins and wrecks, one per RS×RS cell at most (type 1 ruin, 2 shipwreck: see ruinCell). A ruin is a
   * walled room (7-11 inside) of stone bricks (cold) or sandstone (warm), with crumbled stretches and one
   * or two 5-wide doorways, a chest in a corner sometimes. A shipwreck is an oak or spruce hull lying
   * along x or y with its stern broken open, a deck, a mast stump and a chest by the bow. Around each, a
   * margin of clear seabed (3 tiles): nothing seals them in.
   */
  const RS = 22;
  function ruinTile(tx, ty, type) {
    const i = Math.floor(tx / RS), j = Math.floor(ty / RS);
    const cx = i * RS + 11, cy = j * RS + 11;
    if (type === 1) {
      const hw = 3 + Math.floor(H(i, j, seed + 2702) * 3), hh = 3 + Math.floor(H(i, j, seed + 2703) * 3);
      const sh = 8 - Math.max(hw, hh);                                                 // room to shift it in its cell
      const rx = cx + Math.round((H(i, j, seed + 2704) - 0.5) * 2 * sh), ry = cy + Math.round((H(i, j, seed + 2705) - 0.5) * 2 * sh);
      const lx = tx - rx, ly = ty - ry, ax = Math.abs(lx), ay = Math.abs(ly);
      if (ax > hw + 3 || ay > hh + 3) return -1;
      if (ax > hw || ay > hh) return FLOOR;                                         // margin
      const warm = H(i, j, seed + 2706) < 0.45;
      if (ax === hw || ay === hh) {
        // Side 0 N, 1 S, 2 W, 3 E: a 5-wide doorway on one side (two sometimes), a side fallen now and then.
        const side = ay === hh && ax < hw ? (ly < 0 ? 0 : 1) : ax === hw && ay < hh ? (lx < 0 ? 2 : 3) : -1;
        const along = side < 2 ? lx : ly, d1 = Math.floor(H(i, j, seed + 2707) * 4), d2 = H(i, j, seed + 2708) < 0.5 ? (d1 + 2) % 4 : -1;
        if (side >= 0 && (side === d1 || side === d2) && Math.abs(along) <= 2) { SB = warm ? BK.ruin_ss_f : BK.ruin_sb_f; return FLOOR; }
        if (side >= 0 && H(i * 4 + side, j, seed + 2709) < 0.22) return FLOOR;     // fallen
        if (H(tx, ty, seed + 2710) < 0.12 && side >= 0) return FLOOR;              // a missing block
        SB = warm ? BK.ruin_ss_w : BK.ruin_sb_w;
        return WALL;
      }
      SB = warm ? BK.ruin_ss_f : BK.ruin_sb_f;
      if (lx === -hw + 1 && ly === -hh + 1 && H(i, j, seed + 2711) < 0.5) SP = SP_CHEST;
      return FLOOR;
    }
    // Shipwreck: along x or y, bow at +a; the hull is 7 wide (5 inside), the last 3 tiles taper into a solid bow.
    const alongX = H(i, j, seed + 2712) < 0.5, flip = H(i, j, seed + 2713) < 0.5 ? 1 : -1, La = 7 + Math.floor(H(i, j, seed + 2714) * 2);
    const sx = cx, sy = cy + Math.round((H(i, j, seed + 2715) - 0.5) * 4);
    const a = (alongX ? tx - sx : ty - sy) * flip, c = alongX ? ty - sy : tx - sx, ac = Math.abs(c);
    if (Math.abs(a) > La + 3 || ac > 6) return -1;
    if (Math.abs(a) > La || ac > 3) return FLOOR;                                   // margin
    const spruce = H(i, j, seed + 2716) < 0.5;
    const hullW = a > La - 3 ? 3 - (a - (La - 3)) : 3;                               // half-width, tapering at the bow
    if (ac > hullW) return FLOOR;
    if (a === -La) return FLOOR;                                                     // the stern broke away: the way in
    // A breach in one side (4 long), the rest of the hull walls; the tapered bow is solid.
    const br = Math.floor(H(i, j, seed + 2717) * (La - 4)) - 2, bs = H(i, j, seed + 2718) < 0.5 ? 1 : -1;
    if (ac === 3 && Math.sign(c) === bs && a >= br && a < br + 4) return FLOOR;
    if (ac === hullW || hullW < 3 && a > La - 3) { SB = spruce ? BK.hull_spruce_w : BK.hull_oak_w; return WALL; }
    SB = a === 0 && c === 0 ? BK.mast : spruce ? BK.deck_spruce : BK.deck_oak;
    if (a === La - 4 && c === (bs > 0 ? -2 : 2)) SP = SP_CHEST;
    return FLOOR;
  }

  /** Magma vents in the deep ocean: a small pool of magma (burns) under a bubble column, on a rim of deepslate. */
  const VG = 26;
  function ventTile(tx, ty) {
    const i = Math.floor(tx / VG), j = Math.floor(ty / VG);
    const cx = i * VG + 6 + Math.floor(H(i, j, seed + 2752) * 14), cy = j * VG + 6 + Math.floor(H(i, j, seed + 2753) * 14);
    const d = Math.hypot(tx - cx, ty - cy), rv = 1.3 + H(i, j, seed + 2754) * 0.7;
    if (d > rv + 2.2) return -1;
    if (d < rv) { SV = 1; SB = BK.vent_rim; return LIQUID; }
    SB = BK.vent_rim;
    return FLOOR;
  }

  // --- The Aether: sky islands over an open sky, linked by Aercloud bridges, and the three dungeon exteriors.
  /*
   * Islands sit on a lattice of IG tiles (centre jittered; radius from the biome at the centre; some cells are
   * only a small cloud junction). Every cell is linked by a bridge to its neighbour toward the origin (a tree:
   * every island is reachable) and sometimes to the others. A tile is:
   *   land   inside an island's noisy edge: Aether Grass (the usual noise adds Holystone outcrops and pools),
   *          Quicksoil on stretches of the rim, streams in Rainbow Falls, gold-strewn grass on the golden island
   *   cloud  within W of the network (island cores and bridge lines). W is a smooth noise, wide in the Cloud Sea,
   *          that changes slower than 1 tile per tile, so every cloud field touches the network
   *   sky    everything else: VOID (blocks walkers like the End's void, hurts nobody). Its SB is what it would
   *          be if widen turns it into floor (cloud near clouds, grass near islands)
   * Landmarks (decorative dungeon exteriors on a footprint of wall tiles, G.Tiles.LANDMARK) take over a cell:
   * the Silver Dungeon temple and the Gold Dungeon's golden island are planned from the seed (planAether);
   * Bronze Dungeon mounds sit on some forest / meadow islands.
   */
  const IG = 32, AE_WMAX = 17;
  // Per biome: [island radius, + random, chance of an island in a cell, cloud width].
  const ISLE = { aether_meadow: [12, 5, 0.92, 2.5], skyroot_forest: [12, 5, 0.92, 2], golden_grove: [11, 5, 0.88, 2.5],
                 rainbow_falls: [12, 5, 0.9, 3], cloud_sea: [5, 4, 0.65, 15] };
  let aCells = new Map(), aNear = new Map(), aeOver = new Map(), goldIsle = null, temple = null, goldB = -1, aeSpawn = null;
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  };
  /** Footprint of a landmark centred on tile (cx, cy): world px (x, y) = middle of its south edge (sprite foot). */
  function landmark(kind, cx, cy, px = cx, py = cy) {
    const [w, h] = G.Tiles.LANDMARK[kind], x0 = cx - (w >> 1), y0 = cy - (h >> 1);
    return { kind, tx: px, ty: py, x0, y0, w, h, x: (x0 + w / 2) * TS, y: (y0 + h) * TS };
  }
  function aeCell(i, j) {
    const k = cellKey(i, j);
    let c = aCells.get(k);
    if (c) return c;
    const o = aeOver.get(k), origin = !i && !j;
    const x = i * IG + (o || origin ? 0 : Math.round((H(i, j, seed + 3011) - 0.5) * 10));
    const y = j * IG + (o || origin ? 0 : Math.round((H(i, j, seed + 3012) - 0.5) * 10));
    const key = keyAt(x, y), I = ISLE[key] || ISLE.aether_meadow;
    const has = !!o || origin || H(i, j, seed + 3013) < I[2];
    const r = o ? o.r : origin ? 19 : I[0] + H(i, j, seed + 3014) * I[1];
    c = { i, j, x, y, r, rc: has ? r - 4.5 : 3, has, key, lm: null, rainbow: null, gold: !!(o && o.kind === 'gold') };
    // The temple stands in the north half of its platform (centred on the cell).
    if (o) c.lm = o.kind === 'silver' ? landmark('silver', x, y - 6, x, y) : landmark(o.kind, x, y);
    else if (has && r >= 13 && (key === 'skyroot_forest' || key === 'aether_meadow') && Math.hypot(x, y) > 48 && H(i, j, seed + 3015) < 0.1 &&
             (!temple || Math.hypot(x - temple.tx, y - temple.ty) > 60) && (!goldIsle || Math.hypot(x - goldIsle.tx, y - goldIsle.ty) > 50))
      c.lm = landmark('bronze', x, y - 1);
    if (has && !o && key === 'rainbow_falls') c.rainbow = { x: (x + 0.5) * TS, y: (y + r * 0.3) * TS, r: r * 0.62 * TS, ph: H(i, j, seed + 3017) * 6.28 };
    aCells.set(k, c);
    return c;
  }
  const aeTowardX = (i, j) => (j === 0 ? true : i === 0 ? false : H(i, j, seed + 3021) < 0.5);
  const aeEdgeE = (i, j) => (i < 0 && aeTowardX(i, j)) || (i + 1 > 0 && aeTowardX(i + 1, j)) || H(i, j, seed + 3022) < 0.3;
  const aeEdgeS = (i, j) => (j < 0 && !aeTowardX(i, j)) || (j + 1 > 0 && !aeTowardX(i, j + 1)) || H(i, j, seed + 3023) < 0.3;
  /** Islands and bridges that can reach the tiles of lattice cell (ci, cj), cached. */
  function aeNearOf(ci, cj) {
    const k = cellKey(ci, cj);
    let n = aNear.get(k);
    if (n) return n;
    n = { isl: [], seg: [] };
    const X = ci * IG, Y = cj * IG, h = IG / 2;
    const boxD = (x, y) => Math.hypot(Math.max(X - h - x, 0, x - X - h), Math.max(Y - h - y, 0, y - Y - h));
    const seg = (a, b) => {
      if (segDist(X, Y, a.x, a.y, b.x, b.y) - h * 1.42 > 4.5 + AE_WMAX) return;
      n.seg.push([a.x, a.y, b.x, b.y, 3 + H(a.i * 7 + b.i, a.j * 7 + b.j, seed + 3031) * 0.9]);
    };
    for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 2; i <= ci + 2; i++) {
      const c = aeCell(i, j);
      if (boxD(c.x, c.y) < Math.max(c.r + 6, c.rc + AE_WMAX) + 1) n.isl.push(c);
      if (aeEdgeE(i, j)) seg(c, aeCell(i + 1, j));
      if (aeEdgeS(i, j)) seg(c, aeCell(i, j + 1));
    }
    if (aNear.size > 4000) aNear.clear();
    aNear.set(k, n);
    return n;
  }
  /** Cloud width around the network at a tile, blended across biome edges (slope stays under 1). */
  function aeCloudW(tx, ty, b1, b2, gap) {
    const A = (ISLE[keys[b1]] || ISLE.aether_meadow)[3], B = (ISLE[keys[b2]] || ISLE.aether_meadow)[3], w = 0.5 + 0.5 * Math.min(1, gap / 24);
    return (A * w + B * (1 - w)) * (0.3 + 0.7 * stretch(vnoise(tx / 56, ty / 56, seed + 3131)));
  }
  /** Which Aercloud: blue bounce pads (2×2, 3×3 in the Cloud Sea, one per 9×9 cell at most), rare gold drifts, cold white. */
  function cloudBlock(tx, ty, b1) {
    const sea = keys[b1] === 'cloud_sea', pi = Math.floor(tx / 9), pj = Math.floor(ty / 9);
    if (H(pi, pj, seed + 3141) < (sea ? 0.55 : 0.22)) {
      const sz = sea ? 3 : 2, px = pi * 9 + 2 + Math.floor(H(pi, pj, seed + 3142) * 4), py = pj * 9 + 2 + Math.floor(H(pi, pj, seed + 3143) * 4);
      if (tx >= px && tx < px + sz && ty >= py && ty < py + sz) return BK.ae_cloud_blue;
    }
    if (vnoise(tx / 6, ty / 6, seed + 3144) > (sea || keys[b1] === 'golden_grove' ? 0.8 : 0.86)) return BK.ae_cloud_gold;
    return BK.ae_cloud;
  }
  function aetherLand(tx, ty, b1, b2, gap) {
    const nr = aeNearOf(Math.round(tx / IG), Math.round(ty / IG));
    const wob = (fbm(tx / 10, ty / 10, seed + 3101) - 0.5) * 9;
    let inside = -99, dn = 99, gold = false;
    for (const c of nr.isl) {
      const dx = tx - c.x, dy = ty - c.y;
      if (dx * dx + dy * dy > 1849) continue;           // 43+ tiles: beyond any island (r ≤ 28.5) or its clouds (rc + AE_WMAX ≤ 36.5)
      const d = Math.sqrt(dx * dx + dy * dy);
      if (c.has && c.r + wob - d > inside) { inside = c.r + wob - d; gold = c.gold; }
      if (d - c.rc < dn) dn = d - c.rc;
    }
    if (inside <= 0) for (const g of nr.seg) { const d = segDist(tx, ty, g[0], g[1], g[2], g[3]) - g[4]; if (d < dn) dn = d; }
    if (inside > 0) {
      // Quicksoil: stretches of the rim (the mod's coasts), 1-2 tiles deep.
      if (inside < 0.9 + vnoise(tx / 5, ty / 5, seed + 3111) * 1.3 && vnoise(tx / 13, ty / 13, seed + 3112) > 0.52) SB = BK.ae_quicksoil;
      else if (gold) SB = BK.ae_gold_grass;
      // Rainbow Falls: streams wind across the islands and pour off their edges.
      if (keys[b1] === 'rainbow_falls' && inside > 0.6 && Math.abs(vnoise(tx / 15, ty / 15, seed + 3121) - 0.5) < 0.05) { SB = 0; return LIQUID; }
      return -1;
    }
    const W = aeCloudW(tx, ty, b1, b2, gap);
    // Cloud reaching an island's very edge: the island takes it (no stray cloud squares in its notches).
    if (dn < W && inside > -2.5) return -1;
    if (dn < W) { SB = cloudBlock(tx, ty, b1); return FLOOR; }
    // If widen fills this sky (a notch, a thin gap), it becomes cloud out in the open, grass by an island.
    SB = inside > -3 ? 0 : dn < W + 3 ? BK.ae_cloud : 0;
    return VOID;
  }
  /** The golden island is golden grove all round, whatever the biome map says. */
  function aetherLocate(tx, ty) {
    const b = locateVoronoi(tx, ty);
    if (!goldIsle || goldB < 0 || b === goldB) return b;
    const d = Math.hypot(tx - goldIsle.tx, ty - goldIsle.ty);
    if (d >= 26) return b;
    L2 = b; L1 = goldB; LGAP = Math.min(99, (26 - d) * 2);
    return goldB;
  }
  function aetherStruct(tx, ty) {
    const ci = Math.round(tx / IG), cj = Math.round(ty / IG);
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      const c = aeCell(i, j);
      if (!c.lm) continue;
      const r = landmarkTile(c.lm, tx, ty);
      if (r >= 0) return r;
    }
    return -1;
  }
  /*
   * Landmark grounds (lx, ly from the centre):
   *   silver  a 27×21 platform of Holystone Brick with a gold-trimmed border, the temple (9×5 footprint) in its
   *           north half, columns 4+ tiles apart around it, an angelic-stone aisle from the south, two
   *           reflecting pools and Ambrosium lamps; 3 tiles of grass around it
   *   bronze  a ring of mossy Carved Stone (2 tiles) round the mound, lamps by the door; grass beyond
   *   gold    a ring of Hellfire Stone round the shrine; the rest of the island is gold-strewn grass (aetherLand)
   */
  function landmarkTile(lm, tx, ty) {
    const lx = tx - lm.tx, ly = ty - lm.ty, ax = Math.abs(lx), ay = Math.abs(ly);
    const fx = tx - lm.x0, fy = ty - lm.y0, foot = fx >= 0 && fx < lm.w && fy >= 0 && fy < lm.h;
    if (lm.kind === 'silver') {
      if (ax > 16 || ay > 13) return -1;
      if (ax > 13 || ay > 10) return FLOOR;
      if (foot) { SB = BK.ae_silver_w; return WALL; }
      if ((ax === 11 && (ly === -8 || ly === -3 || ly === 2)) || (ly === 8 && (ax === 11 || ax === 6))) { SB = BK.ae_brick_f; SP = DK.ae_pillar; return FLOOR; }
      if (ax >= 5 && ax <= 8 && ly >= 0 && ly <= 4) { SB = BK.ae_angelic_f; return ax >= 6 && ax <= 7 && ly >= 1 && ly <= 3 ? LIQUID : FLOOR; }
      if (ax === 5 && ly === -3) { SB = BK.ae_angelic_f; SP = DK.ambrosium; return FLOOR; }
      SB = ax === 13 || ay === 10 ? BK.ae_trim_f : ax <= 2 && ly >= -3 ? BK.ae_angelic_f : BK.ae_brick_f;
      return FLOOR;
    }
    const R = lm.kind === 'bronze' ? 8 : 7;
    if (ax > R || ay > R) return -1;
    if (foot) { SB = lm.kind === 'bronze' ? BK.ae_bronze_w : BK.ae_gold_w; return WALL; }
    if (fx >= -2 && fx < lm.w + 2 && fy >= -2 && fy < lm.h + 2) {
      SB = lm.kind === 'bronze' ? BK.ae_carved_f : BK.ae_hellfire_f;
      if (fy === lm.h && (fx === -1 || fx === lm.w)) SP = DK.ambrosium;
    }
    return FLOOR;
  }
  /** Places the Silver temple (~80 tiles out) and the golden island (~66, roughly opposite); the arrival portal and spawn. */
  function planAether() {
    goldB = keys.indexOf('golden_grove');
    const pickCell = (a, D) => {
      let best = null, bd = Infinity;
      for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
        if (Math.abs(i) + Math.abs(j) < 2 || aeOver.has(cellKey(i, j))) continue;
        const e = Math.hypot(i * IG - Math.cos(a) * D, j * IG - Math.sin(a) * D);
        if (e < bd) { bd = e; best = { i, j }; }
      }
      return best;
    };
    const a = H(seed, 11, 3201) * 6.2832, t = pickCell(a, 80);
    aeOver.set(cellKey(t.i, t.j), { r: 24, kind: 'silver' });
    temple = { tx: t.i * IG, ty: t.j * IG };
    const g = pickCell(a + Math.PI + (H(seed, 12, 3202) - 0.5) * 1.4, 66);
    aeOver.set(cellKey(g.i, g.j), { r: 18, kind: 'gold' });
    goldIsle = { tx: g.i * IG, ty: g.j * IG };
    // You arrive through an Aether Portal (already built, decorative) at the heart of the start island.
    aeSpawn = { x: TS / 2, y: TS * 1.5 };
    portals.push({ x: TS / 2, y: -3 * TS + TS - 4, kind: 'aether', ready: true, build: null, arrival: true });
  }

  /** Terreno "puro" de un tile (sin caché). */
  function terrainRaw(tx, ty) {
    locate(tx, ty);
    return terrainOf(tx, ty, L1, L2, LGAP);
  }

  /** ¿Dentro del claro de algún portal (más un margen)? */
  function carved(tx, ty, pad) {
    for (const c of carves) if ((tx - c.tx) ** 2 + (ty - c.ty) ** 2 <= (c.r + pad) ** 2) return true;
    return false;
  }

  function arenaDist(tx, ty) { return arena ? Math.hypot(tx - arena.tx, ty - arena.ty) : Infinity; }

  /**
   * Pasillo libre de la arena: donde aparecéis (sur) y el legendario (norte).
   * Con `clear` en el tema, además un claro donde aterriza Arceus (5 al norte).
   */
  function arenaSafe(tx, ty) {
    const lx = tx - arena.tx, ly = ty - arena.ty;
    return (Math.abs(lx) <= 2 && ly >= -6 && ly <= 5) || Math.hypot(lx, ly) < 2.5 ||
           (arena.th.clear > 0 && Math.hypot(lx, ly + 5) < arena.th.clear);
  }

  // ---------------- datos de chunk ----------------

  /*
   * El terreno sale en dos pasos:
   *  1) Bloques "crudos" de N×N (rawBlock, cacheados): lo que dicen el ruido y
   *     las estructuras, tile a tile, sin mirar a los vecinos.
   *  2) Superbloques de SBN×SBN chunks: se junta el crudo de alrededor en una
   *     ventana con FM tiles de margen y se ensancha (widen): abre los pasos
   *     estrechos entre rocas, quita las paredes finas y rellena los huecos
   *     cerrados. El resultado de un tile sólo depende del crudo a menos de FM
   *     tiles, así que dos superbloques vecinos coinciden en su borde. Se guarda
   *     el superbloque con PM tiles de margen (lo que miran los props).
   *  3) Cada chunk copia su trozo y pone sus props.
   */
  const raws = new Map(), MAX_RAW = 1200;
  function rawBlock(bx, by) {
    const k = bx + ',' + by;
    let r = raws.get(k);
    if (r) return r;
    const NN = N * N;
    r = { t: new Uint8Array(NN), nat: new Uint8Array(NN), sb: new Uint8Array(NN), sp: new Uint8Array(NN),
          bio: new Uint16Array(NN), b1: new Uint8Array(NN) };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const tx = bx * N + i, ty = by * N + j, q = j * N + i;
      locate(tx, ty);
      r.t[q] = terrainOf(tx, ty, L1, L2, LGAP);
      r.sb[q] = SB; r.sp[q] = SP; r.b1[q] = L1; r.nat[q] = NAT;
      r.bio[q] = SV && liqVarIdx[L1] >= 0 ? liqVarIdx[L1] : tileIdx[L1];
    }
    if (raws.size > MAX_RAW) raws.delete(raws.keys().next().value);
    raws.set(k, r);
    return r;
  }

  /*
   * Ensanchado (sobre la ventana):
   *   - Paso estrecho: un tile libre que el cierre morfológico (radio RHO) de lo
   *     que bloquea (paredes, vacío, lava...) taparía, o sea, un hueco de menos
   *     de ~2·RHO + 1 tiles. La roca del ruido a menos de KR de un paso estrecho
   *     se quita: el hueco crece unos 2·KR.
   *   - Apertura (3×3) de las paredes: la roca de menos de 3 de grueso
   *     (líneas, picos, columnas sueltas) desaparece.
   * Sólo se lima la roca del ruido (NAT); estructuras y arenas no se tocan.
   */
  /*
   * Margen FM: lo que cada paso mira alrededor, sumado. Ensanchado: 2·RHO + KR + 2 (apertura) + 2 (motas)
   * + 2 (muescas) = 14; columnas: 3 + 4 → 21; huecos: PE + 1 → 38; props: PCLEAR + PGAP → 43.
   */
  const FM = 44, RHO = 3, KR = 2, PC = 12, PE = 16;
  const SBN = 4, SBT = SBN * N, PM = 5, VS = SBT + 2 * PM;
  const WS = SBT + 2 * FM, WA = WS * WS;
  const wT = new Uint8Array(WA), wNat = new Uint8Array(WA), wSb = new Uint8Array(WA), wB1 = new Uint8Array(WA),
        wBl = new Uint8Array(WA), wM = new Uint8Array(WA), dA = new Uint16Array(WA), dB = new Uint16Array(WA),
        wQ = new Int32Array(WA);
  let hurtBio = [];                        // índice de G.Tiles.BIOMES -> su charco hace daño (lava, veneno...)
  const isHurt = b => {
    let v = hurtBio[b];
    if (v === undefined) { const B = G.Tiles.BIOMES[b]; v = hurtBio[b] = !!(B && (LIQ[B.liquid] || {}).dmg); }
    return v;
  };

  /** Distancia de chamfer (3 recto, 4 en diagonal) de cada tile de la ventana al más cercano con mask = 1. */
  function chamfer(mask, out) {
    const BIG = 60000;
    for (let y = 0; y < WS; y++) for (let x = 0; x < WS; x++) {
      const i = y * WS + x;
      let d = mask[i] ? 0 : BIG;
      if (d) {
        if (x > 0 && out[i - 1] + 3 < d) d = out[i - 1] + 3;
        if (y > 0) {
          if (out[i - WS] + 3 < d) d = out[i - WS] + 3;
          if (x > 0 && out[i - WS - 1] + 4 < d) d = out[i - WS - 1] + 4;
          if (x < WS - 1 && out[i - WS + 1] + 4 < d) d = out[i - WS + 1] + 4;
        }
      }
      out[i] = d;
    }
    for (let y = WS - 1; y >= 0; y--) for (let x = WS - 1; x >= 0; x--) {
      const i = y * WS + x;
      let d = out[i];
      if (!d) continue;
      if (x < WS - 1 && out[i + 1] + 3 < d) d = out[i + 1] + 3;
      if (y < WS - 1) {
        if (out[i + WS] + 3 < d) d = out[i + WS] + 3;
        if (x < WS - 1 && out[i + WS + 1] + 4 < d) d = out[i + WS + 1] + 4;
        if (x > 0 && out[i + WS - 1] + 4 < d) d = out[i + WS - 1] + 4;
      }
      out[i] = d;
    }
  }

  let wX0 = 0, wY0 = 0;                    // tile de la esquina de la ventana
  function widen() {
    let any = false;
    for (let i = 0; i < WA; i++) if (wNat[i] === 1 && (wT[i] === WALL || wT[i] === VOID)) { any = true; break; }
    if (any) narrowPass();
    if (hasPil) pillars();
    if (any || isVoid || gen.sky) pockets();
  }
  // RK: the kind being limed (WALL; on the Aether also VOID, its open sky: thin strips of sky between clouds go, notches fill with sky).
  let RK = WALL;
  const rock = i => wT[i] === RK && wNat[i] === 1;
  function narrowPass() {
    // 1) Pasos estrechos: cierre (dilatar RHO y erosionar RHO) de lo que bloquea.
    chamfer(wBl, dA);
    for (let i = 0; i < WA; i++) wM[i] = dA[i] > 3 * RHO ? 1 : 0;
    chamfer(wM, dB);
    for (let i = 0; i < WA; i++) wM[i] = dB[i] > 3 * RHO && !wBl[i] ? 1 : 0;
    chamfer(wM, dA);
    for (let i = 0; i < WA; i++) if (wNat[i] === 1 && (wT[i] === WALL || wT[i] === VOID) && dA[i] <= 3 * KR) { wT[i] = FLOOR; wBl[i] = 0; }
    for (const K of gen.sky ? [WALL, VOID] : [WALL]) { RK = K; limeRock(); }
    RK = WALL;
  }
  function limeRock() {
    const K = RK;
    // 2) Apertura 3×3: queda la roca con sus 8 vecinos de roca y lo que la toca (bloques de 3×3 como mínimo).
    for (let y = 1; y < WS - 1; y++) for (let x = 1; x < WS - 1; x++) {
      const i = y * WS + x;
      let k = wT[i] === K;
      for (let b = -WS; b <= WS && k; b += WS) for (let a = -1; a <= 1; a++) if (wT[i + b + a] !== K) { k = false; break; }
      wM[i] = k ? 1 : 0;
    }
    for (let y = 1; y < WS - 1; y++) for (let x = 1; x < WS - 1; x++) {
      const i = y * WS + x;
      if (wNat[i] !== 1 || wT[i] !== K) continue;
      let k = false;
      for (let b = -WS; b <= WS && !k; b += WS) for (let a = -1; a <= 1; a++) if (wM[i + b + a]) { k = true; break; }
      if (!k) { wT[i] = FLOOR; wBl[i] = 0; }
    }
    // 3) Motas: la roca del ruido con menos de 5 de roca en su 3×3 (restos en cruz, puntas) se quita (dos pasadas).
    for (let it = 0; it < 2; it++) {
      for (let y = 1; y < WS - 1; y++) for (let x = 1; x < WS - 1; x++) {
        const i = y * WS + x;
        if (!rock(i)) { wM[i] = 0; continue; }
        let n = 0;
        for (let b = -WS; b <= WS; b += WS) for (let a = -1; a <= 1; a++) if (wT[i + b + a] === K) n++;
        wM[i] = n < 5 ? 1 : 0;
      }
      for (let i = 0; i < WA; i++) if (wM[i]) { wT[i] = FLOOR; wBl[i] = 0; }
    }
    // 4) Muescas: el suelo del ruido cerrado por 3 de sus 4 lados (con algo de roca del ruido) se rellena (dos pasadas).
    for (let it = 0; it < 2; it++) {
      for (let y = 1; y < WS - 1; y++) for (let x = 1; x < WS - 1; x++) {
        const i = y * WS + x;
        wM[i] = wT[i] === FLOOR && wNat[i] && wBl[i - 1] + wBl[i + 1] + wBl[i - WS] + wBl[i + WS] >= 3 &&
                (rock(i - 1) || rock(i + 1) || rock(i - WS) || rock(i + WS)) ? 1 : 0;
      }
      for (let i = 0; i < WA; i++) if (wM[i]) { wT[i] = K; wBl[i] = 1; wNat[i] = 1; }
    }
  }

  /*
   * Huecos: un trozo de suelo del ruido encerrado (por roca, vacío o lava) de
   * hasta PE×PE se vuelve roca: ahí aparecerían bichos que nunca te alcanzan.
   * Se mira dentro de la zona de la ventana ya resuelta (21 tiles de margen):
   * un hueco que toque un tile del chunk o su borde de props cabe entero en
   * ella, así que todos los chunks deciden lo mismo.
   */
  function pockets() {
    const lo = 21, hi = WS - 21;
    wM.fill(0);
    for (let y = lo; y < hi; y++) for (let x = lo; x < hi; x++) {
      const s0 = y * WS + x;
      if (wBl[s0] || wM[s0]) continue;
      let h = 0, t = 0, x0 = x, x1 = x, y0 = y, y1 = y, open = false, nat = true;
      wQ[t++] = s0; wM[s0] = 1;
      while (h < t) {
        const i = wQ[h++], qx = i % WS, qy = (i / WS) | 0;
        if (!wNat[i]) nat = false;
        if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
        if (qx <= lo || qy <= lo || qx >= hi - 1 || qy >= hi - 1) { open = true; continue; }
        if (!wBl[i - 1] && !wM[i - 1]) { wM[i - 1] = 1; wQ[t++] = i - 1; }
        if (!wBl[i + 1] && !wM[i + 1]) { wM[i + 1] = 1; wQ[t++] = i + 1; }
        if (!wBl[i - WS] && !wM[i - WS]) { wM[i - WS] = 1; wQ[t++] = i - WS; }
        if (!wBl[i + WS] && !wM[i + WS]) { wM[i + WS] = 1; wQ[t++] = i + WS; }
      }
      if (open || !nat || x1 - x0 >= PE || y1 - y0 >= PE) continue;
      // (On the Aether a cut-off scrap of cloud or island drifts away: it becomes sky.)
      for (let k = 0; k < t; k++) { const i = wQ[k]; wT[i] = gen.sky ? VOID : WALL; wBl[i] = 1; wNat[i] = 1; }
    }
  }

  /*
   * Columnas (basalto, fortaleza, End City, badlands): una por celda de PC×PC
   * como mucho, de 4×4, y sólo donde quedan a 4 tiles o más de
   * cualquier cosa que bloquee: entre dos columnas siempre caben 4.
   */
  let hasPil = false;
  const pilQ = [];
  function pillars() {
    pilQ.length = 0;
    for (let pj = Math.floor((wY0 + 4) / PC); pj * PC < wY0 + WS - 4; pj++) for (let pi = Math.floor((wX0 + 4) / PC); pi * PC < wX0 + WS - 4; pi++) {
      // Esquina de la columna en 2..6 dentro de su celda: entre dos celdas quedan 4 tiles como mínimo.
      const px = pi * PC + 2 + Math.floor(H(pi, pj, seed + 32) * 5), py = pj * PC + 2 + Math.floor(H(pi, pj, seed + 33) * 5);
      const lx = px - wX0, ly = py - wY0;
      if (lx < 4 || ly < 4 || lx + 8 > WS || ly + 8 > WS) continue;
      if (Math.hypot(px + 1.5, py + 1.5) < 16) continue;
      const tp = terr[wB1[(ly + 2) * WS + lx + 2]];
      if (!tp || !tp.pil || H(pi, pj, seed + 31) >= tp.pil) continue;
      let ok = true;
      for (let b = -4; b < 8 && ok; b++) for (let a = -4; a < 8; a++) {
        const i = (ly + b) * WS + lx + a;
        if (wBl[i] || wSb[i] || !wNat[i] || (a >= 0 && a < 4 && b >= 0 && b < 4 && wT[i] !== FLOOR)) { ok = false; break; }
      }
      if (ok && (arenaDist(px, py) < arena_outer() + 6 || (carves.length && carved(px + 1, py + 1, 6)))) ok = false;
      if (ok) pilQ.push(ly * WS + lx);
    }
    for (const i0 of pilQ) for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) {
      const i = i0 + b * WS + a;
      wT[i] = WALL; wBl[i] = 1; wNat[i] = 0;
    }
  }

  /** Llena la ventana del superbloque (sx, sy) con el crudo de alrededor y la ensancha. */
  function fillWindow(sx, sy) {
    const x0 = wX0 = sx * SBT - FM, y0 = wY0 = sy * SBT - FM;
    for (let by = Math.floor(y0 / N); by * N < y0 + WS; by++) for (let bx = Math.floor(x0 / N); bx * N < x0 + WS; bx++) {
      const r = rawBlock(bx, by);
      const i0 = Math.max(0, x0 - bx * N), i1 = Math.min(N, x0 + WS - bx * N);
      const j0 = Math.max(0, y0 - by * N), j1 = Math.min(N, y0 + WS - by * N);
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
        const q = j * N + i, w = (by * N + j - y0) * WS + bx * N + i - x0, t = r.t[q];
        wT[w] = t; wNat[w] = r.nat[q]; wSb[w] = r.sb[q]; wB1[w] = r.b1[q];
        wBl[w] = t === WALL || t === VOID || (t === LIQUID && isHurt(r.bio[q])) ? 1 : 0;
      }
    }
    widen();
  }

  /** Superbloque ensanchado: terreno, bloqueo, bloque de estructura y bioma de VS×VS tiles (con PM de margen). */
  const sblocks = new Map(), MAX_SB = 48;
  function superBlock(sx, sy) {
    const k = sx + ',' + sy;
    let b = sblocks.get(k);
    if (b) return b;
    fillWindow(sx, sy);
    b = { t: new Uint8Array(VS * VS), bl: new Uint8Array(VS * VS), sb: new Uint8Array(VS * VS), b1: new Uint8Array(VS * VS) };
    for (let j = 0; j < VS; j++) {
      const w0 = (j + FM - PM) * WS + FM - PM, v0 = j * VS;
      b.t.set(wT.subarray(w0, w0 + VS), v0); b.bl.set(wBl.subarray(w0, w0 + VS), v0);
      b.sb.set(wSb.subarray(w0, w0 + VS), v0); b.b1.set(wB1.subarray(w0, w0 + VS), v0);
    }
    if (sblocks.size > MAX_SB) sblocks.delete(sblocks.keys().next().value);
    sblocks.set(k, b);
    return b;
  }
  // Vista del superbloque con que se ponen los props del chunk (índices con paso VS).
  let vT = null, vBl = null, vSb = null, vB1 = null;

  function chunkData(cx, cy) {
    const k = cx + ',' + cy;
    let c = data.get(k);
    if (c) return c;

    c = { cx, cy, terr: new Uint8Array(N * N), bio: new Uint16Array(N * N), blk: new Uint8Array(N * N),
          props: [], propAt: new Map(), liquids: [], liqBio: [] };
    const sx = Math.floor(cx / SBN), sy = Math.floor(cy / SBN), S = superBlock(sx, sy);
    vT = S.t; vBl = S.bl; vSb = S.sb; vB1 = S.b1;
    const ox = (cx - sx * SBN) * N + PM, oy = (cy - sy * SBN) * N + PM;
    const r = rawBlock(cx, cy), req = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      // Tile propio: bloque de estructura, prop pedido y bioma con que se pinta.
      const q = j * N + i, t = vT[(j + oy) * VS + i + ox];
      c.terr[q] = t;
      c.blk[q] = r.sb[q]; req[q] = t === r.t[q] ? r.sp[q] : 0;
      c.bio[q] = r.bio[q];
      if (t === LIQUID) { c.liquids.push(c.cx * N + i, c.cy * N + j); c.liqBio.push(c.bio[q]); }
    }
    if (data.size > MAX_DATA) data.delete(data.keys().next().value);
    data.set(k, c);
    placeProps(c, req, ox, oy);
    return c;
  }

  function chunkOf(tx, ty) {
    const cx = Math.floor(tx / N), cy = Math.floor(ty / N);
    return data.get(cx + ',' + cy) || chunkData(cx, cy);
  }
  function terrainAt(tx, ty) {
    const c = chunkOf(tx, ty);
    return c.terr[(ty - c.cy * N) * N + (tx - c.cx * N)];
  }
  /** Índice de G.Tiles.BIOMES del tile según el mapa (sin la arena). */
  function bioAt(tx, ty) {
    const c = chunkOf(tx, ty);
    return c.bio[(ty - c.cy * N) * N + (tx - c.cx * N)];
  }

  const arena_outer = () => (arena ? arena.r + 7 : 0);

  /*
   * Props naturales sólidos (árboles, rocas, cofres, altares...): no se ponen a
   * menos de PCLEAR tiles de una pared / vacío / lava (dejarían un paso de 1-2),
   * y entre dos candidatos a menos de PGAP gana el de mayor prioridad (hash), así
   * los árboles de una arboleda dejan sitio para pasar. Todo con la ventana:
   * igual en los dos lados de un borde de chunk.
   */
  // TREE_K: el espaciado quita ~4 de cada 10 árboles de una arboleda; se piden más para que se vea igual de densa.
  const PCLEAR = 3, PGAP = 2, TREE_K = 1.6;
  /** ¿Suelo alrededor del tile w de la vista, a radio r (Chebyshev)? clearAround: ¿nada que bloquee? */
  function floorAround(w, r) {
    for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (vT[w + b * VS + a] !== FLOOR) return false;
    return true;
  }
  function clearAround(w, r) {
    for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (vBl[w + b * VS + a]) return false;
    return true;
  }
  /** Prop natural del tile (sin mirar a sus vecinos props): [tipo, kind] o null. PT / PK de salida. */
  let PT = null, PK = 0;
  function naturalProp(w, tx, ty) {
    PT = null; PK = 0;
    if (vT[w] !== FLOOR) return false;
    const open = floorAround(w, 1), inStruct = vSb[w] !== 0;
    const tp = terr[vB1[w]] || TERRAIN_DEF;
    const h = H(tx, ty, seed + 404);
    const grove = fbm(tx / 10, ty / 10, seed + 505) > 0.6;
    // Interactivos (raros), lejos del claro del principio.
    const hs = H(tx, ty, seed + 909);
    if (open && Math.hypot(tx, ty) > 12 && hs < 0.0032) {
      PT = hs < 0.0004 ? 'altar' : hs < 0.0008 ? 'spring' : hs < 0.0011 ? 'bigchest' : gen.sky ? 'chest' : 'trap';
      PK = Math.floor(H(tx, ty, seed + 910) * (PT === 'altar' ? 4 : 3));
    }
    else if (open && !inStruct && h < (grove ? tp.grove : tp.tree) * TREE_K) { PT = 'tree'; PK = Math.floor(H(tx, ty, seed + 415) * 64); }
    else if (open && !inStruct && h > 1 - (tp.rock || 0.008) * TREE_K) PT = 'rock';
    else if (open && H(tx, ty, seed + 606) < 0.0005) PT = 'chest';
    else if (fbm(tx / 5, ty / 5, seed + 707) > 0.66 && H(tx, ty, seed + 808) < 0.75 * (tp.grass == null ? 1 : tp.grass) && !(gen.sky && inStruct)) PT = 'grass';
    else if (tp.deco && !inStruct) {
      // Decoración propia del bioma (sensores de sculk, bayas luminosas...).
      let r = H(tx, ty, seed + 1001);
      for (const [name, pr] of tp.deco) {
        if ((r -= pr) >= 0) continue;
        if (open || !DECO_PHYS[name].solid) { PT = 'deco'; PK = DK[name] - 1; }
        break;
      }
    }
    if (PT && solidType(PT, PK) && !clearAround(w, PCLEAR)) PT = null;
    return !!PT;
  }
  const solidType = (type, kind) => (type === 'deco' ? DECO_PHYS[G.Tiles.DECO[kind]].solid : PROP[type].solid);
  /** ¿Gana el prop sólido del tile w a los candidatos sólidos de alrededor (a menos de PGAP)? */
  function winsSpace(w, tx, ty) {
    const pr = H(tx, ty, seed + 4242);
    for (let b = -PGAP; b <= PGAP; b++) for (let a = -PGAP; a <= PGAP; a++) {
      if (!a && !b) continue;
      const v = w + b * VS + a;
      if (vT[v] !== FLOOR) continue;
      const ox = tx + a, oy = ty + b;
      if (Math.hypot(ox, oy) < 7 || (carves.length && carved(ox, oy, 1)) || arenaDist(ox, oy) < arena_outer() + 2) continue;
      if (H(ox, oy, seed + 4242) <= pr) continue;
      if (naturalProp(v, ox, oy) && solidType(PT, PK)) return false;
    }
    return true;
  }

  function placeProps(c, req, ox, oy) {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (c.terr[j * N + i] !== FLOOR) continue;
      const tx = c.cx * N + i, ty = c.cy * N + j, w = (j + oy) * VS + i + ox;
      if (Math.hypot(tx, ty) < 7) continue;
      if (broken.has(tx + ',' + ty)) continue;
      if (carves.length && carved(tx, ty, 1)) continue;
      // Inside the Ocean Monument only what it asks for (its sea lanterns): the halls stay clear for the fights.
      if (mon && Math.abs(tx - mon.tx) <= MHS && Math.abs(ty - mon.ty) <= MHS && !req[j * N + i]) continue;
      // Lo que pide una estructura (puntales, faroles, barrotes, cofres...).
      const rq = req[j * N + i];
      // Los puntales de la mina, sólo apoyados en la roca (sueltos dejarían un paso de 1).
      if (rq === DK.post && !(vBl[w - 1] || vBl[w + 1] || vBl[w - VS] || vBl[w + VS])) continue;
      if (rq) {
        const p = rq === SP_CHEST ? makeProp('chest', tx, ty, 0, c.bio[j * N + i]) : makeProp('deco', tx, ty, rq - 1, c.bio[j * N + i]);
        c.props.push(p);
        if (p.solid) c.propAt.set(tx + ',' + ty, p);
        continue;
      }

      const bi = c.bio[j * N + i];
      // Dentro de la arena: la decoración de su tipo (y nada en el pasillo).
      const ad = arenaDist(tx, ty);
      if (ad < arena_outer() + 2) {
        if (!arena || ad >= arena.r - 1.2 || arenaSafe(tx, ty)) continue;
        const open = floorAround(w, 1);
        const pr = arena.th.props, hh = H(tx, ty, seed + 777);
        let at = null;
        if (open && hh < (pr.tree || 0)) at = 'tree';
        else if (open && hh < (pr.tree || 0) + (pr.rock || 0)) at = 'rock';
        else if (hh > 1 - (pr.grass || 0)) at = 'grass';
        if (at) { const p = makeProp(at, tx, ty, 0, bi); c.props.push(p); if (p.solid) c.propAt.set(tx + ',' + ty, p); }
        continue;
      }

      if (!naturalProp(w, tx, ty)) continue;
      const type = PT, kind = PK;
      if (solidType(type, kind) && !winsSpace(w, tx, ty)) continue;
      const p = makeProp(type, tx, ty, kind, bi);
      c.props.push(p);
      if (p.solid) c.propAt.set(tx + ',' + ty, p);
    }
  }

  const PROP = {
    tree:  { solid: true,  hp: Infinity, r: 13 },
    rock:  { solid: true,  hp: 34,       r: 12 },
    chest: { solid: true,  hp: 22,       r: 12 },
    grass: { solid: false, hp: 1,        r: 14 },
    altar:    { solid: true,  hp: Infinity, r: 9 },
    spring:   { solid: false, hp: Infinity, r: 22, flat: true },
    bigchest: { solid: true,  hp: Infinity, r: 14 },
    trap:     { solid: false, hp: Infinity, r: 9, flat: true },
    deco:     { solid: false, hp: 1,        r: 10 }
  };
  /*
   * Props de decoración (tipo 'deco', p.deco = nombre, p.kind = índice en
   * G.Tiles.DECO). Los sólidos bloquean como un árbol; los de hp finita se rompen.
   */
  const DECO_PHYS = {
    post:      { solid: true,  hp: Infinity, r: 9 },
    web:       { solid: false, hp: 1,        r: 12 },
    dripstone: { solid: true,  hp: 40,       r: 9 },
    amethyst:  { solid: false, hp: 6,        r: 10 },
    berries:   { solid: false, hp: 1,        r: 10 },
    torch:     { solid: false, hp: Infinity, r: 6 },
    soul_torch:{ solid: false, hp: Infinity, r: 6 },
    lantern:   { solid: true,  hp: Infinity, r: 9 },
    chain_lantern: { solid: true, hp: Infinity, r: 9 },
    sensor:    { solid: true,  hp: 24,       r: 10 },
    shrieker:  { solid: true,  hp: Infinity, r: 12 },
    bars:      { solid: true,  hp: Infinity, r: 12 },
    spawner:   { solid: true,  hp: Infinity, r: 12 },
    candle:    { solid: false, hp: 1,        r: 7 },
    catalyst:  { solid: true,  hp: Infinity, r: 12 },
    kelp:      { solid: false, hp: 1,        r: 10 },
    sea_lantern: { solid: true, hp: Infinity, r: 11 },
    sea_pickle:{ solid: false, hp: 1,        r: 7 },
    // The Aether: ore shards (break for a little xp), floating Gravitite, Icestone, the Silver Dungeon's columns.
    ambrosium: { solid: false, hp: 6,        r: 9 },
    zanite:    { solid: false, hp: 8,        r: 9 },
    gravitite: { solid: false, hp: 10,       r: 8 },
    icestone:  { solid: false, hp: 12,       r: 9 },
    ae_pillar: { solid: true,  hp: Infinity, r: 11 }
  };
  /** Luz que dan (para la oscuridad): radio en px de mundo y color. */
  const DECO_LIGHT = { torch: [150, '#ffb347'], soul_torch: [130, '#5fe0e8'], lantern: [170, '#5fe0e8'], chain_lantern: [170, '#ffb347'],
                       candle: [90, '#ffcf7a'], berries: [80, '#ffb347'], sensor: [60, '#2ad0e0'], amethyst: [50, '#c9a6ff'],
                       sea_lantern: [200, '#c8fff4'], sea_pickle: [90, '#b8ff9a'],
                       ambrosium: [90, '#ffe680'], zanite: [70, '#c9a6ff'], gravitite: [70, '#ff9ae0'], icestone: [90, '#bfeaff'] };
  const SPECIAL = new Set(['altar', 'spring', 'bigchest', 'trap']);
  const AE_ORE = new Set(['ambrosium', 'zanite', 'gravitite', 'icestone']);

  function makeProp(type, tx, ty, kind = 0, bi = 0) {
    const name = type === 'deco' ? G.Tiles.DECO[kind] : null;
    const d = name ? Object.assign({}, PROP.deco, DECO_PHYS[name]) : PROP[type];
    return {
      id: nextPropId++, type, tx, ty, kind, bi, deco: name,
      x: tx * TS + TS / 2, y: ty * TS + TS - 4,
      r: d.r, hp: d.hp, maxHp: d.hp, solid: d.solid, flat: !!d.flat,
      destructible: d.hp !== Infinity, flash: 0,
      wiggle: H(tx, ty, 9) * 6.28,
      used: false, charge: 1, open: 0          // altar / manantial / cofre con candado
    };
  }

  // ---------------- consultas ----------------

  const tileOf = v => Math.floor(v / TS);

  function kindAt(x, y) { return KIND[terrainAt(tileOf(x), tileOf(y))]; }
  function isWall(x, y) { return terrainAt(tileOf(x), tileOf(y)) === WALL; }
  function isLiquid(x, y) { return terrainAt(tileOf(x), tileOf(y)) === LIQUID; }
  /** Bioma (índice de G.Tiles.BIOMES) con que se ve y se comporta un tile: la arena, si la hay. */
  const shownBio = (tx, ty) => (over >= 0 ? over : bioAt(tx, ty));
  /** Dónde se mira por defecto: el jugador o, sin él, el centro de la cámara. */
  function focus() {
    const pl = G.Game && G.Game.player;
    return pl ? pl : G.Camera;
  }
  /** Líquido del tile (water, swamp, lava, ice...). */
  const liquidAt = (tx, ty) => G.Tiles.BIOMES[shownBio(tx, ty)].liquid;
  /** Líquido del bioma bajo el jugador (o en x, y). */
  function liquidKind(x, y) {
    if (x == null) { const f = focus(); x = f.x || 0; y = f.y || 0; }
    return liquidAt(tileOf(x), tileOf(y));
  }

  /**
   * Efecto del charco actual sobre un Pokémon de estos tipos:
   *   { slow, dmg, every, color, slide }  (dmg en % de vida máxima)
   * Los de su tipo no sufren el suyo (Fuego en lava, Veneno en veneno...).
   */
  const LIQ = {
    water: { slow: 0.6, immune: ['water'] },     // los de tipo agua nadan sin frenarse
    swamp: { slow: 0.45, immune: ['water'] },
    lava:   { dmg: 0.06, flat: 5, every: 0.5, color: '#ff8a3d', immune: ['fire'] },
    poison: { dmg: 0.035, flat: 3, every: 0.5, color: '#c86bdc', immune: ['poison', 'steel'] },
    spark:  { dmg: 0.045, flat: 4, every: 0.7, color: '#ffe14d', immune: ['electric', 'ground'] },
    ice:    { slide: true, immune: ['ice'] },
    // The Ocean: deep water (trenches, holes: slow, never hurts) and magma vents (burn like a weaker lava).
    deep:   { slow: 0.55, immune: ['water'] },
    magma:  { dmg: 0.04, flat: 4, every: 0.5, color: '#ff7a2a', immune: ['fire'] },
    // The Aether: crystal-clear shallow pools and streams (nothing slows, nothing hurts).
    clear:  {}
  };
  function liquidEffect(types, x, y) {
    const e = LIQ[liquidKind(x, y)] || LIQ.water;
    if (e.immune && types && types.some(t => e.immune.includes(t))) return {};
    return e;
  }

  function propAtTile(tx, ty) {
    return chunkOf(tx, ty).propAt.get(tx + ',' + ty) || null;
  }

  /** ¿Se puede pasar por esta casilla andando? (pathing.js) */
  function walkable(tx, ty) {
    const t = terrainAt(tx, ty);
    if (t === WALL || t === VOID) return false;
    if (t === LIQUID && (LIQ[liquidAt(tx, ty)] || {}).dmg) return false;   // lava, veneno, descarga
    const p = propAtTile(tx, ty);
    return !(p && p.solid);
  }

  /** ¿Hay sitio para que algo de radio r esté aquí? */
  function isFree(x, y, r = 12, allowLiquid = false) {
    const t0x = tileOf(x - r), t1x = tileOf(x + r), t0y = tileOf(y - r), t1y = tileOf(y + r);
    for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
      const t = terrainAt(tx, ty);
      if (t === WALL || t === VOID || (!allowLiquid && t === LIQUID)) return false;
      const p = propAtTile(tx, ty);
      if (p && G.U.dist2(x, y, p.x, p.y) < (r + p.r) ** 2) return false;
    }
    return true;
  }

  /** Objetos destructibles (incluida la hierba) que tocan un círculo. */
  function propsInCircle(x, y, r) {
    const out = [];
    const c0x = Math.floor((x - r) / CW), c1x = Math.floor((x + r) / CW);
    const c0y = Math.floor((y - r) / CW), c1y = Math.floor((y + r) / CW);
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      const c = chunkData(cx, cy);
      for (const p of c.props) {
        if (!p.destructible || p.hp <= 0) continue;
        if (G.U.dist2(x, y, p.x, p.y) <= (r + p.r) ** 2) out.push(p);
      }
    }
    return out;
  }

  /** Objetos interactivos (altares, manantiales, cofres con candado, trampas) cerca. */
  function specialsNear(x, y, r) {
    const out = [];
    const c0x = Math.floor((x - r) / CW), c1x = Math.floor((x + r) / CW);
    const c0y = Math.floor((y - r) / CW), c1y = Math.floor((y + r) / CW);
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      for (const p of chunkData(cx, cy).props) {
        if (SPECIAL.has(p.type) && G.U.dist2(x, y, p.x, p.y) <= (r + p.r) ** 2) out.push(p);
      }
    }
    return out;
  }

  /** Roca o cofre más cercano (para apuntar cuando no hay enemigos). */
  function nearestBreakable(x, y, r) {
    let best = null, bd = r * r;
    for (const p of propsInCircle(x, y, r)) {
      if (!p.solid) continue;
      const d = G.U.dist2(x, y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /**
   * Empuja un círculo fuera de paredes y objetos sólidos (deslizando).
   * Devuelve true si ha chocado con algo.
   */
  function collide(e) {
    const r = e.r;
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const t0x = tileOf(e.x - r), t1x = tileOf(e.x + r), t0y = tileOf(e.y - r), t1y = tileOf(e.y + r);
      for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
        const tt = terrainAt(tx, ty);
        if (tt === WALL || tt === VOID) {
          // Punto más cercano de la caja del tile al centro del círculo.
          const bx0 = tx * TS, by0 = ty * TS, bx1 = bx0 + TS, by1 = by0 + TS;
          const qx = G.U.clamp(e.x, bx0, bx1), qy = G.U.clamp(e.y, by0, by1);
          let dx = e.x - qx, dy = e.y - qy;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          hit = true;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            e.x += dx / d * (r - d); e.y += dy / d * (r - d);
          } else {
            // Centro dentro de la caja: sal por el lado más cercano.
            const l = e.x - bx0, rr = bx1 - e.x, u = e.y - by0, b = by1 - e.y;
            const m = Math.min(l, rr, u, b);
            if (m === l) e.x = bx0 - r; else if (m === rr) e.x = bx1 + r;
            else if (m === u) e.y = by0 - r; else e.y = by1 + r;
          }
        }
        const p = propAtTile(tx, ty);
        if (p && p.solid) {
          const dx = e.x - p.x, dy = e.y - p.y;
          const min = r + p.r, d2 = dx * dx + dy * dy;
          if (d2 < min * min) {
            hit = true;
            const d = Math.sqrt(d2) || 0.01;
            e.x = p.x + dx / d * min; e.y = p.y + dy / d * min;
          }
        }
      }
    }
    return hit;
  }

  /** ¿Choca un proyectil aquí? Devuelve 'wall', el prop sólido, o null. */
  function projectileBlock(x, y, r) {
    const tx = tileOf(x), ty = tileOf(y);
    if (terrainAt(tx, ty) === WALL) return 'wall';
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const p = propAtTile(tx + a, ty + b);
      if (p && p.solid && G.U.dist2(x, y, p.x, p.y) < (r + p.r) ** 2) return p;
    }
    return null;
  }

  // ---------------- daño a objetos ----------------

  function damageProp(p, amount, color = '#fff') {
    if (!p.destructible || p.hp <= 0) return false;
    p.hp -= amount;
    p.flash = 0.08;
    if (p.type !== 'grass') G.FX.spark(p.x, p.y - 10, color, 0, -1, 3);
    if (p.hp <= 0) { destroyProp(p); return true; }
    return false;
  }

  /** Rompe el objeto de esa casilla (llega por la red en cooperativo). */
  function breakAt(tx, ty) {
    const k = tx + ',' + ty;
    if (broken.has(k)) return;
    const c = data.get(Math.floor(tx / N) + ',' + Math.floor(ty / N));
    const p = c && c.props.find(o => o.tx === tx && o.ty === ty);
    if (p) destroyProp(p, true); else broken.add(k);
  }

  function destroyProp(p, fromNet = false) {
    broken.add(p.tx + ',' + p.ty);
    if (G.Coop.active && !fromNet) G.Coop.propBroken(p);
    const cx = Math.floor(p.tx / N), cy = Math.floor(p.ty / N);
    const c = data.get(cx + ',' + cy);
    if (c) {
      c.props.splice(c.props.indexOf(p), 1);
      c.propAt.delete(p.tx + ',' + p.ty);
    }
    const B = G.Tiles.BIOMES[over >= 0 ? over : p.bi];
    G.Audio.sfx(p.type === 'grass' ? 'grass' : p.type === 'chest' ? 'chest' : 'break');
    if (p.type === 'grass') {
      G.FX.burst(p.x, p.y - 6, B.grass[1], 6, 70);
      const r = Math.random();
      if (r < 0.05) G.Pickups.drop('heal', p.x, p.y);
      else if (r < 0.11) G.Pickups.drop('coin', p.x, p.y, 1);
      return;
    }
    if (p.type === 'rock') {
      G.FX.burst(p.x, p.y - 10, B.rock[1], 14, 140);
      G.FX.ring(p.x, p.y - 8, 4, 26, B.rock[2], 0.3, 3);
      const r = Math.random();
      if (r < 0.40) G.Pickups.dropXp(p.x, p.y, 6);
      if (r > 0.75) G.Pickups.drop('coin', p.x, p.y, 2);
      if (r > 0.94) G.Pickups.drop('heal', p.x + 8, p.y);
      return;
    }
    if (p.type === 'chest') {
      G.FX.burst(p.x, p.y - 10, '#f2c443', 22, 180);
      G.FX.ring(p.x, p.y - 8, 6, 46, '#f2c443', 0.45, 4);
      G.Camera.kick(0.25);
      const n = G.U.randInt(4, 7);
      for (let i = 0; i < n; i++) G.Pickups.drop('coin', p.x + G.U.rand(-14, 14), p.y + G.U.rand(-10, 10), 3);
      G.Pickups.drop(Math.random() < 0.5 ? 'heal' : 'magnet', p.x, p.y);
      G.Pickups.dropXp(p.x, p.y, 20);
      if (Math.random() < 0.08) G.Pickups.drop('item', p.x, p.y - 12, G.Items.roll());
      return;
    }
    if (p.type === 'bigchest') {
      // Botín grande: monedas, tickets y experiencia para subir un nivel.
      G.FX.burst(p.x, p.y - 12, '#f2c443', 34, 220);
      G.FX.ring(p.x, p.y - 8, 6, 80, '#f2c443', 0.6, 5);
      G.Camera.kick(0.4);
      for (let i = 0; i < 9; i++) G.Pickups.drop('coin', p.x + G.U.rand(-22, 22), p.y + G.U.rand(-14, 14), 4);
      const tk = G.U.randInt(1, 3);
      for (let i = 0; i < tk; i++) G.Pickups.drop('ticket', p.x + G.U.rand(-16, 16), p.y + G.U.rand(-10, 10), 1);
      if (Math.random() < 0.15) G.Pickups.drop('ticket10', p.x, p.y - 10, 1);
      if (Math.random() < 0.5) G.Pickups.drop('item', p.x + 14, p.y - 14, G.Items.roll());
      G.Pickups.dropXp(p.x, p.y, G.Game.levelXp());
      G.Progress.event('chest');
      return;
    }
    if (p.type === 'trap') G.Interact.trapEffect(p);
    if (p.type === 'deco') {
      G.FX.burst(p.x, p.y - 8, p.deco === 'sensor' ? '#2ad0e0' : p.deco === 'amethyst' ? '#c9a6ff' : p.deco === 'dripstone' ? '#a07858'
                 : p.deco === 'kelp' ? '#5a9a2a' : p.deco === 'sea_pickle' ? '#b8ff9a' : p.deco === 'ambrosium' ? '#ffd84a'
                 : p.deco === 'zanite' ? '#a07aff' : p.deco === 'gravitite' ? '#ff8ad8' : p.deco === 'icestone' ? '#bfeaff' : '#e8e8e8', 10, 110);
      if ((p.deco === 'sensor' || p.deco === 'dripstone' || p.deco === 'amethyst' || AE_ORE.has(p.deco)) && Math.random() < 0.35) G.Pickups.dropXp(p.x, p.y, 4);
    }
    if (onPropBroken) try { onPropBroken(p); } catch (e) { console.error(e); }
  }

  // ---------------- dibujo ----------------

  function chunkImage(cx, cy) {
    const cache = over >= 0 ? overImages : images;
    const k = cx + ',' + cy;
    let img = cache.get(k);
    if (img) return img;
    const at = (tx, ty) => KIND[terrainAt(tx, ty)];
    // Campo continuo de "tierra"; tiles.js lo muestrea en rejilla y lo
    // interpola por píxel para que las manchas tengan bordes orgánicos.
    const S = 6 * G.Tiles.T;
    const dirtField = (gx, gy) => fbm(gx / S, gy / S, seed + 303);
    const c = chunkData(cx, cy), x0 = cx * N, y0 = cy * N;
    const blk = over >= 0 ? null : (tx, ty) => c.blk[(ty - y0) * N + (tx - x0)];
    img = G.Tiles.paintChunk(cx, cy, N, at, dirtField, over >= 0 ? over : bioAt, seed, blk);
    if (cache.size > MAX_IMAGES) cache.delete(cache.keys().next().value);
    cache.set(k, img);
    return img;
  }

  function visibleChunks(cam, pad = 0) {
    const out = [];
    const x0 = Math.floor((cam.left() - pad) / CW), x1 = Math.floor((cam.left() + cam.w + pad) / CW);
    const y0 = Math.floor((cam.top() - pad) / CW), y1 = Math.floor((cam.top() + cam.h + pad) / CW);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) out.push([cx, cy]);
    return out;
  }

  function drawGround(ctx, cam) {
    ctx.imageSmoothingEnabled = false;
    if (gen.sky && over < 0) drawSky(ctx, cam, performance.now() / 1000);
    // +1 de solape: con escalas no enteras evita juntas entre chunks.
    for (const [cx, cy] of visibleChunks(cam)) ctx.drawImage(chunkImage(cx, cy), cx * CW, cy * CW, CW + 1, CW + 1);
  }

  /** Bordes de cada charco del chunk (bit 1 N, 2 S, 4 O, 8 E = hay charco al lado). */
  function liquidEdges(c) {
    if (c.liqEdge) return c.liqEdge;
    const m = new Uint8Array(c.liquids.length >> 1);
    for (let i = 0; i < c.liquids.length; i += 2) {
      const tx = c.liquids[i], ty = c.liquids[i + 1];
      m[i >> 1] = (terrainAt(tx, ty - 1) === LIQUID ? 1 : 0) | (terrainAt(tx, ty + 1) === LIQUID ? 2 : 0) |
                  (terrainAt(tx - 1, ty) === LIQUID ? 4 : 0) | (terrainAt(tx + 1, ty) === LIQUID ? 8 : 0);
    }
    return (c.liqEdge = m);
  }

  /**
   * Charcos animados: la tira de fotogramas de Minecraft (water_still,
   * lava_still...) del bioma de cada tile, encima del lecho horneado, sin
   * tapar la orilla. Después, brillos / burbujas de la lava, el veneno y la
   * electricidad (y de todo, mientras no han cargado las texturas).
   */
  function drawLiquid(ctx, cam, t) {
    const P = G.Sprites.PX;
    const strips = new Map();
    const stripOf = b => { let S = strips.get(b); if (S === undefined) { S = G.Tiles.liquidStrip(b); strips.set(b, S); } return S; };
    const sparks = [];
    for (const [cx, cy] of visibleChunks(cam)) {
      const c = chunkData(cx, cy);
      if (!c.liquids.length) continue;
      const m = liquidEdges(c);
      for (let i = 0; i < c.liquids.length; i += 2) {
        const tx = c.liquids[i], ty = c.liquids[i + 1];
        const x = tx * TS, y = ty * TS;
        if (!cam.sees(x + TS / 2, y + TS / 2, TS)) continue;
        const b = over >= 0 ? over : c.liqBio[i >> 1], S = stripOf(b);
        if (!S || !S.cv) { sparks.push(tx, ty, b); continue; }
        const fy = (Math.floor(t * S.fps) % S.frames) * T;
        ctx.globalAlpha = S.alpha * (S.flicker ? 0.8 + 0.2 * Math.sin(t * 11) * Math.sin(t * 3.7) : 1);
        const e = m[i >> 1];
        const top = e & 1 ? 0 : S.bank + 1, bot = e & 2 ? 0 : 2, l = e & 4 ? 0 : 2, r = e & 8 ? 0 : 2;
        const w = T - l - r, h = T - top - bot;
        ctx.drawImage(S.cv, l, fy + top, w, h, x + l * P, y + top * P, w * P, h * P);
        if (S.pad && H(tx, ty, 83) < 0.13) {
          // Nenúfar flotando (se mece un poco).
          ctx.globalAlpha = 1;
          const o = Math.round(Math.sin(t * 0.8 + H(tx, ty, 84) * 6.28)) * P;
          ctx.drawImage(S.pad, x + o, y + P, TS, TS);
        }
        if (S.bubbles) sparks.push(tx, ty, b);
      }
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < sparks.length; i += 3) {
      const tx = sparks[i], ty = sparks[i + 1], B = G.Tiles.BIOMES[sparks[i + 2]];
      if (B.liquid === 'magma' && G.Tiles.ready) {
        // Bubble column over a magma vent: rings of bubbles rising a tile and a half, then popping.
        for (let k = 0; k < 2; k++) {
          const ph = (t * 0.9 + H(tx, ty, 85 + k)) % 1;
          ctx.globalAlpha = Math.min(1, (1 - ph) * 2.2);
          ctx.drawImage(G.Tiles.bubbleSprite(Math.floor(t * 9 + k * 5 + tx) % 12), tx * TS + (k ? 6 : -4), ty * TS - ph * TS * 1.6, TS, TS);
        }
        ctx.globalAlpha = 1;
        continue;
      }
      const lava = B.liquid === 'lava' || B.liquid === 'poison' || B.liquid === 'spark';
      const x = tx * TS, y = ty * TS;
      const ph = H(tx, ty, 77) * 6.28;
      const k = (Math.sin(t * (lava ? 2.2 : 1.6) + ph) + 1) / 2;
      ctx.fillStyle = B.foam;
      ctx.globalAlpha = lava ? 0.35 + k * 0.5 : k * 0.7;
      const sx = x + Math.floor(H(tx, ty, 78) * 12 + 2) * P;
      const sy = y + Math.floor(H(tx, ty, 79) * 12 + 2) * P;
      ctx.fillRect(sx + Math.round(k * 2) * P, sy, P * (lava ? 2 : 3), P);
      if (lava && k > 0.8) ctx.fillRect(sx, sy - P * 2, P, P);
    }
    ctx.globalAlpha = 1;
    if (dim === 'ocean' && waterAuto) drawWaterOverlay(ctx, cam, t);
    if (gen.sky && over < 0) {
      drawAetherWater(ctx, cam, t);
      if (skyAuto) drawSkyOverlay(ctx, cam, t);
    }
  }

  /*
   * Under the sea: sunlight rippling over the seabed (caustics). Drawn in world coordinates over the ground
   * and the pools, under props and mobs (drawLiquid calls it by itself on The Ocean while waterOverlayAuto
   * is true). One pattern fill per frame. k scales it (dimmer in the dark biomes).
   */
  let waterAuto = true;
  const causticPats = new WeakMap();
  function drawWaterOverlay(ctx, cam, t = performance.now() / 1000, k = 1) {
    if (!G.Tiles.ready || !cam) return;
    const NF = G.Tiles.CAUSTIC_FRAMES, f = Math.floor(t * 8) % NF;
    let pats = causticPats.get(ctx);
    if (!pats) causticPats.set(ctx, pats = []);
    const pat = pats[f] || (pats[f] = ctx.createPattern(G.Tiles.caustic(f), 'repeat'));
    if (!pat) return;
    const P = G.Sprites.PX, S = 64 * P;
    // The pattern drifts slowly; whole art pixels only, so it stays crisp.
    const ox = Math.round(((t * 7) % S) / P) * P, oy = Math.round(((t * 4) % S) / P) * P;
    if (pat.setTransform) pat.setTransform(new DOMMatrix([P, 0, 0, P, ox, oy]));
    const B = over >= 0 ? null : G.BIOME_DEFS && G.BIOME_DEFS[biomeKeyAt(cam.x || 0, cam.y || 0)];
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = Math.min(1, 0.85 * k * (B && B.dark ? 0.55 : 1));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = pat;
    ctx.fillRect(cam.left(), cam.top(), cam.w, cam.h);
    ctx.restore();
  }

  // ---------------- the Aether's sky ----------------
  /*
   * Under the islands (drawGround): a bright gradient, distant islands far below and two layers of soft clouds
   * drifting in parallax (slower than the ground). The chunk images leave the sky transparent.
   */
  const SKY_LAYERS = [
    { kind: 'isle', f: 0.16, S: 820, p: 0.42, n: 4, sc: 1, drift: 1.5, a: 0.9 },
    { kind: 'cloud', f: 0.32, S: 360, p: 0.5, n: 6, sc: 1.5, drift: 5, a: 0.55 },
    { kind: 'cloud', f: 0.58, S: 300, p: 0.42, n: 6, sc: 2.2, drift: 11, a: 0.85 }
  ];
  function drawSky(ctx, cam, t) {
    const L = cam.left(), T0 = cam.top(), w = cam.w, h = cam.h, cx = L + w / 2, cy = T0 + h / 2, P = G.Sprites.PX;
    const g = ctx.createLinearGradient(0, T0, 0, T0 + h);
    g.addColorStop(0, '#86c8f2'); g.addColorStop(0.6, '#acdcf8'); g.addColorStop(1, '#d6f0fd');
    ctx.fillStyle = g;
    ctx.fillRect(L - 2, T0 - 2, w + 4, h + 4);
    for (let li = 0; li < SKY_LAYERS.length; li++) {
      const Ly = SKY_LAYERS[li], S = Ly.S, qx = cx * Ly.f + t * Ly.drift, qy = cy * Ly.f;
      ctx.globalAlpha = Ly.a;
      for (let j = Math.floor((qy - h / 2 - S) / S); j * S < qy + h / 2 + S; j++)
        for (let i = Math.floor((qx - w / 2 - S) / S); i * S < qx + w / 2 + S; i++) {
          if (H(i, j, 3301 + li) > Ly.p) continue;
          const img = G.Tiles.skySprite(Ly.kind, Math.floor(H(i, j, 3311 + li) * Ly.n)), k = Ly.sc * P;
          const px = i * S + H(i, j, 3321 + li) * S * 0.7, py = j * S + H(i, j, 3331 + li) * S * 0.7;
          ctx.drawImage(img, Math.round(cx + px - qx), Math.round(cy + py - qy), img.width * k, img.height * k);
        }
    }
    ctx.globalAlpha = 1;
  }

  /** Lattice cells (G.World's Aether islands) that touch the view (pad px). */
  function aeCellsInView(cam, pad) {
    const out = [];
    const i0 = Math.round((cam.left() - pad) / TS / IG) - 1, i1 = Math.round((cam.left() + cam.w + pad) / TS / IG) + 1;
    const j0 = Math.round((cam.top() - pad) / TS / IG) - 1, j1 = Math.round((cam.top() + cam.h + pad) / TS / IG) + 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push(aeCell(i, j));
    return out;
  }

  /** Rainbow Falls: water pouring off the island edges into the sky, and rainbows arching over the islands. */
  const RAINBOW = ['#ff6a6a', '#ffb05a', '#ffe66a', '#7fe08a', '#6ab8ff', '#a88aff'];
  function drawAetherWater(ctx, cam, t) {
    const P = G.Sprites.PX;
    for (const [cx, cy] of visibleChunks(cam, 80)) {
      const c = chunkData(cx, cy);
      for (let i = 0; i < c.liquids.length; i += 2) {
        const tx = c.liquids[i], ty = c.liquids[i + 1];
        if (terrainAt(tx, ty + 1) !== VOID || !cam.sees(tx * TS + 16, (ty + 2) * TS, 90)) continue;
        // A falling sheet (bands of blue and white sliding down), foam at the lip, mist where it fades into the sky.
        const x = tx * TS, y = (ty + 1) * TS - 2 * P, L = TS * 3, wl = terrainAt(tx - 1, ty) === LIQUID, wr = terrainAt(tx + 1, ty) === LIQUID;
        const x0 = x + (wl ? 0 : P), x1 = x + TS - (wr ? 0 : P);
        for (let q = 0; q < (x1 - x0) / P; q++) {
          const sx = x0 + q * P, h = L * (0.75 + 0.25 * H(tx * 16 + q, 0, 3403));
          const fg = ctx.createLinearGradient(0, y, 0, y + h);
          const band = Math.sin((tx * 16 + q) * 0.9 + H(tx * 16 + q, 1, 3404) * 3) > 0.2;
          fg.addColorStop(0, band ? 'rgba(235,250,255,.95)' : 'rgba(120,205,250,.95)');
          fg.addColorStop(0.55, band ? 'rgba(220,245,255,.7)' : 'rgba(140,215,250,.6)');
          fg.addColorStop(1, 'rgba(230,250,255,0)');
          ctx.fillStyle = fg;
          ctx.fillRect(sx, y, P, h);
        }
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 6; k++) {
          const sx = x0 + P * Math.floor(H(tx, k, 3401) * (x1 - x0) / P), ph = (t * 1.4 + H(tx, ty + k, 3402)) % 1;
          ctx.globalAlpha = (1 - ph) * 0.9;
          ctx.fillRect(sx, Math.round(y + ph * L * 0.8), P, P * 4);
        }
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x0, y, x1 - x0, P);
        ctx.globalAlpha = 1;
        if (Math.random() < 0.08) G.FX.px(x + G.U.rand(4, TS - 4), y + L * G.U.rand(0.55, 0.85), '#f0fbff', { vy: 12, vx: G.U.rand(-16, 16), life: 0.8, size: 2 });
      }
    }
    if (!gen.sky) return;
    ctx.save();
    ctx.lineWidth = 3 * P;
    for (const c of aeCellsInView(cam, 400)) {
      const r = c.rainbow;
      if (!r || !cam.sees(r.x, r.y - r.r * 0.6, r.r + 40)) continue;
      const sh = 0.2 + 0.06 * Math.sin(t * 1.3 + r.ph);
      RAINBOW.forEach((col, k) => {
        ctx.globalAlpha = sh * (1 - Math.abs(k - 2.5) * 0.06);
        ctx.strokeStyle = col;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r - k * 3 * P, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
      });
      // Shimmer: a glint running along the arc.
      const a = Math.PI * (1.08 + ((t * 0.18 + r.ph) % 1) * 0.84);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(r.x + Math.cos(a) * (r.r - 7 * P)), Math.round(r.y + Math.sin(a) * (r.r - 7 * P)), 2 * P, 2 * P);
    }
    ctx.restore();
  }

  /*
   * The Aether's light (world coordinates over the ground and pools, under props and mobs; drawLiquid calls it
   * by itself while skyOverlayAuto is true): a warm sun glow from the top-right corner of the view, soft god
   * rays, slowly drifting sparkles and a faint rainbow tint at the edges. k scales it.
   */
  let skyAuto = true;
  function drawSkyOverlay(ctx, cam, t = performance.now() / 1000, k = 1) {
    if (!cam) return;
    const L = cam.left(), T0 = cam.top(), w = cam.w, h = cam.h, P = G.Sprites.PX;
    const sx = L + w * 0.94, sy = T0 - h * 0.12, R = Math.max(w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.8);
    g.addColorStop(0, `rgba(255,244,196,${(0.16 * k).toFixed(3)})`);
    g.addColorStop(0.3, `rgba(255,236,170,${(0.05 * k).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(L, T0, w, h);
    for (let i = 0; i < 5; i++) {
      const a = 1.95 + i * 0.19 + Math.sin(t * 0.11 + i * 1.9) * 0.025, sp = 0.035 + 0.02 * ((i * 3) % 4) / 4;
      const al = (0.03 + 0.018 * Math.sin(t * 0.5 + i * 2.1)) * k;
      if (al <= 0.004) continue;
      const D = R * 1.3, rg = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * D, sy + Math.sin(a) * D);
      rg.addColorStop(0, `rgba(255,250,215,${al.toFixed(3)})`); rg.addColorStop(1, 'rgba(255,250,215,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - sp) * D, sy + Math.sin(a - sp) * D); ctx.lineTo(sx + Math.cos(a + sp) * D, sy + Math.sin(a + sp) * D);
      ctx.closePath(); ctx.fill();
    }
    // Sparkles: anchored to the world (a little parallax), drifting up and twinkling.
    const mod = (a, m) => ((a % m) + m) % m;
    for (let i = 0; i < 34; i++) {
      const x = L + mod(H(i, 1, 3501) * 2000 + t * (6 + H(i, 2, 3502) * 8) - L * 0.15, w);
      const y = T0 + mod(H(i, 3, 3503) * 2000 - t * (10 + H(i, 4, 3504) * 12) - T0 * 0.15, h);
      const tw = Math.sin(t * (1.5 + H(i, 5, 3505) * 2) + i);
      if (tw < 0) continue;
      ctx.globalAlpha = tw * 0.75 * k;
      ctx.fillStyle = i % 3 ? '#fff8d8' : '#e8f6ff';
      const xs = Math.round(x / P) * P, ys = Math.round(y / P) * P;
      ctx.fillRect(xs, ys, P, P);
      if (tw > 0.7) { ctx.fillRect(xs - P, ys, P, P); ctx.fillRect(xs + P, ys, P, P); ctx.fillRect(xs, ys - P, P, P); ctx.fillRect(xs, ys + P, P, P); }
    }
    ctx.globalAlpha = 1;
    // Faint rainbow tint along the left and bottom edges.
    const e1 = ctx.createLinearGradient(L, 0, L + w * 0.14, 0);
    e1.addColorStop(0, `rgba(255,150,210,${(0.07 * k).toFixed(3)})`); e1.addColorStop(1, 'rgba(255,150,210,0)');
    ctx.fillStyle = e1; ctx.fillRect(L, T0, w * 0.14, h);
    const e2 = ctx.createLinearGradient(0, T0 + h, 0, T0 + h * 0.84);
    e2.addColorStop(0, `rgba(150,210,255,${(0.07 * k).toFixed(3)})`); e2.addColorStop(1, 'rgba(150,210,255,0)');
    ctx.fillStyle = e2; ctx.fillRect(L, T0 + h * 0.84, w, h * 0.16);
    ctx.restore();
  }

  /** Props visibles (y portales), para mezclarlos en el orden por Y con las entidades. */
  function visibleProps(cam) {
    const out = [];
    for (const [cx, cy] of visibleChunks(cam, 60)) {
      for (const p of chunkData(cx, cy).props) if (cam.sees(p.x, p.y, 70)) out.push(p);
    }
    for (const po of portals) {
      if (po.frame || !cam.sees(po.x, po.y, 140)) continue;
      // Los planos (End, cueva, escalera) van bajo todo; los de pie se ordenan por sus pies.
      out.push({ type: 'portal', portal: po, x: po.x, y: po.y, flat: FLAT_PORTALS.has(po.kind) });
    }
    for (const tw of towers) if (cam.sees(tw.x, tw.y - 110, 200)) out.push({ type: 'tower', tower: tw, x: tw.x, y: tw.y });
    if (ancientFrame && cam.sees(ancientFrame.x, ancientFrame.y - 120, 300)) out.push({ type: 'frame', x: ancientFrame.x, y: ancientFrame.y });
    if (gen.sky && over < 0) for (const c of aeCellsInView(cam, 320)) {
      const lm = c.lm;
      if (lm && cam.sees(lm.x, lm.y - 150, 320)) out.push({ type: 'landmark', lm, x: lm.x, y: lm.y });
    }
    return out;
  }
  const FLAT_PORTALS = new Set(['end', 'cave', 'stronghold', 'dive']);
  const PORTAL_KINDS = ['nether', 'end', 'cave', 'stronghold', 'gateway', 'ancient', 'dive', 'aether'];

  /** An Aether dungeon exterior (decorative), its sprite standing on the south edge of its footprint. */
  function drawLandmark(ctx, lm) {
    const P = G.Sprites.PX, img = G.Tiles.portalSprite('ae_' + lm.kind), w = img.width * P, h = img.height * P;
    ctx.fillStyle = 'rgba(40,60,90,.22)';
    ctx.beginPath(); ctx.ellipse(lm.x, lm.y - 6, w * 0.52, 18, 0, 0, 6.2832); ctx.fill();
    ctx.drawImage(img, Math.round(lm.x - w / 2), Math.round(lm.y + P - h), w, h);
    if (lm.kind === 'silver' && Math.random() < 0.12) G.FX.px(lm.x + G.U.rand(-60, 60), lm.y - G.U.rand(160, 300), '#fff4b8', { vy: -12, life: 1.2 });
  }

  /*
   * The Aether Portal (Aether I): an upright Glowstone frame (G.Tiles.AEPORTAL, 4×5 blocks) with a shimmering
   * light-blue surface, feet at (po.x, po.y). While it builds (po.build.t 0..AE_BUILD s) the blocks appear one by
   * one, bottom to top (AE_BLOCKS s), then the surface rises from the bottom with a splash.
   */
  const AE_BUILD = 2.5, AE_BLOCKS = 1.9;
  function drawAetherPortal(ctx, po, t) {
    const P = G.Sprites.PX, A = G.Tiles.AEPORTAL, B = A.B * P, W = A.W * B, Ht = A.H * B + A.TOP * P;
    const x0 = Math.round(po.x - W / 2), y0 = Math.round(po.y + P - Ht);
    const bt = po.ready || !po.build ? AE_BUILD : po.build.t, k = Math.min(1, bt / AE_BUILD);
    const nb = po.ready ? A.ORDER.length : Math.min(A.ORDER.length, Math.floor(bt / AE_BLOCKS * A.ORDER.length));
    const fill = po.ready ? 1 : G.U.clamp((bt - AE_BLOCKS) / (AE_BUILD - AE_BLOCKS), 0, 1);
    // A warm halo (it lights up the night of Herobrine's World).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hy = po.y - Ht * 0.45, hr = 70 + 90 * k, g = ctx.createRadialGradient(po.x, hy, 0, po.x, hy, hr);
    g.addColorStop(0, `rgba(255,236,150,${(0.12 + 0.3 * k + 0.04 * Math.sin(t * 3)).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(255,220,120,${(0.1 * k).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(po.x - hr, hy - hr, hr * 2, hr * 2);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(po.x, po.y - 2, W * 0.55, 9, 0, 0, 6.2832); ctx.fill();
    // The surface, rising from the bottom of the opening.
    if (fill > 0) {
      const img = G.Tiles.portalSprite('aether_fill', Math.floor(t * 10) % 16), fw = img.width, fh = img.height, sh = Math.max(1, Math.round(fh * fill));
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, 0, fh - sh, fw, sh, x0 + B, y0 + A.TOP * P + B + (fh - sh) * P, fw * P, sh * P);
      ctx.globalAlpha = 1;
    }
    if (nb >= A.ORDER.length) ctx.drawImage(G.Tiles.portalSprite('aether'), x0, y0, W, Ht);
    else {
      const blk = G.Tiles.portalSprite('aether_block');
      for (let q = 0; q < nb; q++) {
        const [i, j] = A.ORDER[q], age = bt - (q + 1) * AE_BLOCKS / A.ORDER.length;
        const s = age < 0.12 ? 0.6 + age / 0.12 * 0.4 : 1, bw = blk.width * P * s, bh = blk.height * P * s;
        ctx.drawImage(blk, Math.round(x0 + i * B + (B - bw) / 2), Math.round(y0 + j * B + (blk.height * P - bh) / 2), bw, bh);
        if (age < 0.12) { ctx.globalAlpha = 0.6 * (1 - age / 0.12); ctx.drawImage(G.Sprites.white(blk), Math.round(x0 + i * B), y0 + j * B, B, blk.height * P); ctx.globalAlpha = 1; }
      }
    }
    if (fill > 0 && Math.random() < 0.35)
      G.FX.px(x0 + B + G.U.rand(0, 2 * B), y0 + A.TOP * P + B + G.U.rand(0, 3 * B), Math.random() < 0.5 ? '#e8f8ff' : '#fff4b8', { vy: -24, life: 0.8 });
  }
  /** Building portals: the time runs on, each block pops, then the splash; `ready` once it stands. */
  function updatePortals(dt) {
    const A = G.Tiles.AEPORTAL, P = G.Sprites.PX, B = A.B * P;
    for (const po of portals) {
      if (po.kind !== 'aether' || po.ready || !po.build) continue;
      const b = po.build;
      b.t += dt;
      const n = Math.min(A.ORDER.length, Math.floor(b.t / AE_BLOCKS * A.ORDER.length));
      for (; b.n < n; b.n++) {
        const [i, j] = A.ORDER[b.n], x = po.x - 2 * B + (i + 0.5) * B, y = po.y - A.H * B + (j + 0.5) * B;
        G.FX.burst(x, y, '#ffe58a', 6, 70);
        if (G.Audio && G.Audio.sfx && b.n % 3 === 0) G.Audio.sfx('break');
      }
      if (b.t >= AE_BUILD) {
        po.ready = true;
        G.FX.burst(po.x, po.y - 2.5 * B, '#bfe8ff', 26, 170);
        G.FX.ring(po.x, po.y - 2.5 * B, 8, 90, '#bfe8ff', 0.6, 4);
      }
    }
  }

  /** Marco antiguo (encendido o no) con el pie del hueco en (x, y). */
  function drawFrame(ctx, x, y, lit, t) {
    const P = G.Sprites.PX;
    const img = G.Tiles.portalSprite(lit ? 'ancient' : 'ancient_off', lit ? Math.floor(t * 6) % 8 : 0);
    const w = img.width * P, h = img.height * P;
    ctx.drawImage(img, Math.round(x - w / 2), Math.round(y + 4 + P - h), w, h);
    if (lit && Math.random() < 0.5) G.FX.px(x + G.U.rand(-110, 110), y - G.U.rand(10, 190), Math.random() < 0.6 ? '#5ff3ff' : '#0e8aa8', { vy: -26, life: 0.9 });
  }

  /** Torre de obsidiana del End (el cristal lo dibuja el juego en tw.top). */
  function drawTower(ctx, tw) {
    const P = G.Sprites.PX, img = G.Tiles.portalSprite(tw.caged ? 'tower_caged' : 'tower');
    const w = img.width * P, h = img.height * P;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(tw.x, tw.y - 4, 56, 14, 0, 0, 6.2832); ctx.fill();
    ctx.drawImage(img, Math.round(tw.x - w / 2), Math.round(tw.y + P - h), w, h);
  }
  /** Barrotes delanteros de la jaula de la torre i: para dibujar después del cristal (si está enjaulada). */
  function drawTowerFront(ctx, i) {
    const tw = towers[i];
    if (!tw || !tw.caged) return;
    const P = G.Sprites.PX, img = G.Tiles.portalSprite('tower_front'), w = img.width * P;
    const top = tw.y + P - G.Tiles.portalSprite('tower_caged').height * P;
    ctx.drawImage(img, Math.round(tw.x - w / 2), Math.round(top + (G.Tiles.TOWER.TOP - 11) * P), w, img.height * P);
  }

  /** Portal animado (y sus chispas). */
  function drawPortal(ctx, po, t) {
    const P = G.Sprites.PX;
    if (po.kind === 'aether') { drawAetherPortal(ctx, po, t); return; }
    if (po.kind === 'end') {
      const img = G.Tiles.portalSprite('end', Math.floor(t * 6) % 16);
      const w = img.width * P, h = img.height * P;
      ctx.drawImage(img, Math.round(po.x - w / 2), Math.round(po.y - 80 * P / 2), w, h);
      if (Math.random() < 0.25) G.FX.px(po.x + G.U.rand(-44, 44), po.y + G.U.rand(-44, 44), Math.random() < 0.5 ? '#b8fff0' : '#e0c8ff', { vy: -30, life: 0.8 });
      return;
    }
    if (po.kind === 'dive') {
      // A whirlpool: the pool turns, bubbles rise from its eye.
      const img = G.Tiles.portalSprite('dive', Math.floor(t * 10) % G.Tiles.DIVE.F), w = img.width * P, h = img.height * P;
      ctx.drawImage(img, Math.round(po.x - w / 2), Math.round(po.y - h / 2), w, h);
      if (Math.random() < 0.35) G.FX.px(po.x + G.U.rand(-26, 26), po.y + G.U.rand(-20, 20), Math.random() < 0.6 ? '#d8f4ff' : '#7fc8ff', { vy: -36, life: 0.9 });
      return;
    }
    if (po.kind === 'cave' && dim === 'ocean') {
      // The Ocean's way out: a crevice in the seabed, with bubbles streaming up out of it.
      const img = G.Tiles.portalSprite('cave_ocean', 0), w = img.width * P, h = img.height * P;
      ctx.drawImage(img, Math.round(po.x - w / 2), Math.round(po.y - 24 * P), w, h);
      if (Math.random() < 0.3) G.FX.px(po.x + G.U.rand(-22, 22), po.y + G.U.rand(-18, 18), Math.random() < 0.6 ? '#bfe8ff' : '#5fb8d8', { vy: -40, life: 1 });
      return;
    }
    if (po.kind === 'cave' || po.kind === 'stronghold') {
      const img = G.Tiles.portalSprite(po.kind, 0), w = img.width * P, h = img.height * P;
      ctx.drawImage(img, Math.round(po.x - w / 2), Math.round(po.y - 24 * P), w, h);
      if (po.kind === 'stronghold') {
        // Ojo de Ender flotando sobre la escalera, con su haz verde.
        const by = po.y - 74 + Math.sin(t * 2.4) * 6;
        const g = ctx.createLinearGradient(0, by, 0, po.y);
        g.addColorStop(0, 'rgba(90,255,190,.35)'); g.addColorStop(1, 'rgba(90,255,190,0)');
        ctx.fillStyle = g; ctx.fillRect(po.x - 4, by, 8, po.y - by);
        const e = G.Tiles.portalSprite('eye');
        ctx.drawImage(e, Math.round(po.x - 16), Math.round(by - 16), 32, 32);
        if (Math.random() < 0.3) G.FX.px(po.x + G.U.rand(-10, 10), by + G.U.rand(-6, 10), Math.random() < 0.5 ? '#7affc4' : '#2a9a7a', { vy: 20, life: 0.7 });
      } else if (Math.random() < 0.12) G.FX.px(po.x + G.U.rand(-24, 24), po.y + G.U.rand(-20, 20), '#6a6a6a', { vy: 18, life: 0.9 });
      return;
    }
    if (po.kind === 'gateway') {
      const img = G.Tiles.portalSprite('gateway', Math.floor(t * 10) % 16), w = img.width * P, h = img.height * P;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(po.x, po.y, 24, 8, 0, 0, 6.2832); ctx.fill();
      ctx.drawImage(img, Math.round(po.x - w / 2), Math.round(po.y + 4 + P - h), w, h);
      if (Math.random() < 0.4) G.FX.px(po.x + G.U.rand(-8, 8), po.y - G.U.rand(40, 170), Math.random() < 0.5 ? '#e0c8ff' : '#b8fff0', { vy: -50, life: 0.7 });
      return;
    }
    if (po.kind === 'ancient') { drawFrame(ctx, po.x, po.y, true, t); return; }
    const img = G.Tiles.portalSprite('nether', Math.floor(t * 12) % 32);
    const w = img.width * P, h = img.height * P;
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(t * 3) * 0.06;
    ctx.fillStyle = '#7b3cff';
    ctx.beginPath(); ctx.ellipse(po.x, po.y, 40, 13, 0, 0, 6.2832); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(po.x, po.y, 32, 9, 0, 0, 6.2832); ctx.fill();
    ctx.drawImage(img, Math.round(po.x - w / 2), Math.round(po.y - h + 4), w, h);
    if (Math.random() < 0.35) G.FX.px(po.x + G.U.rand(-18, 18), po.y - G.U.rand(10, 80), '#d9c2ff', { vy: -40, life: 0.6 });
  }

  function drawProp(ctx, p, t) {
    if (p.type === 'portal') { drawPortal(ctx, p.portal, t); return; }
    if (p.type === 'tower') { drawTower(ctx, p.tower); return; }
    if (p.type === 'frame') { drawFrame(ctx, p.x, p.y, frameLit, t); return; }
    if (p.type === 'landmark') { drawLandmark(ctx, p.lm); return; }
    const P = G.Sprites.PX;
    const bi = over >= 0 ? over : p.bi;
    const variant = p.type === 'grass' ? (Math.sin(t * 2.4 + p.wiggle) > 0.55 ? 1 : 0) + (H(p.tx, p.ty, 5) < 0.3 ? 2 : 0)
                  : p.type === 'deco' ? (p.deco === 'kelp' ? p.kind + 64 * ((H(p.tx, p.ty, 7) < 0.5 ? 0 : 8) + (Math.floor(t * 4 + p.wiggle * 1.27) & 7)) : p.kind)
                  : p.type === 'rock' ? (p.hp < p.maxHp * 0.5 ? 1 : 0)
                  : p.type === 'altar' ? p.kind * 2 + (p.used ? 1 : 0)
                  : p.type === 'spring' ? (p.charge < 0.15 ? 1 : 0)
                  : p.type === 'trap' ? p.kind
                  : p.type === 'tree' ? p.kind % G.Tiles.objCount(bi) : 0;
    const img = G.Tiles.propSprite(bi, p.type, variant);
    const w = img.width * P, h = img.height * P;
    if (p.flat) {
      // Planos (manantial, trampa): pegados al suelo, centrados en su casilla.
      ctx.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - 8 - h / 2), w, h);
      if (p.type === 'spring' && p.charge >= 0.15 && Math.sin(t * 3 + p.wiggle) > 0.92) {
        G.FX.twinkle(p.x + G.U.rand(-20, 20), p.y - 8 + G.U.rand(-6, 6));
      }
      return;
    }
    if (p.type === 'altar' && !p.used) {
      // Halo del orbe, latiendo.
      const col = ['#ff5f6d', '#5fd4ff', '#ff8ad8', '#ffd23f'][p.kind];
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(t * 3 + p.wiggle) * 0.1;
      ctx.fillStyle = col;
      // Centro del orbe (procedural) o del libro de la mesa de encantamientos.
      ctx.beginPath(); ctx.arc(p.x, p.y - h + 2 + (G.Tiles.ready ? 5 : 9) * P, 13, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    if (p.type === 'bigchest' && p.open > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y - h / 2, 26, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, p.open / G.Interact.CHEST_TIME));
      ctx.stroke();
      ctx.restore();
    }
    if (p.type !== 'grass' && (p.type !== 'deco' || p.solid)) {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.1, p.r * 0.38, 0, 0, 6.2832); ctx.fill();
    }
    // Gravitite ore floats (it falls up, in the mod): it bobs above its shadow.
    const bob = p.deco === 'gravitite' ? 8 + Math.round(Math.sin(t * 1.8 + p.wiggle) * 3) : 0;
    if (bob) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 8, 3, 0, 0, 6.2832); ctx.fill(); }
    ctx.save();
    const x = Math.round(p.x - w / 2), y = Math.round(p.y - h + (p.type === 'grass' || (p.type === 'deco' && !p.solid) ? 4 : 2)) - bob;
    // A damaged rock or chest shows Minecraft's breaking cracks (destroy_stage_0..9).
    const stage = p.solid && p.destructible && p.hp < p.maxHp ? Math.min(9, Math.floor((1 - p.hp / p.maxHp) * 10)) : -1;
    ctx.drawImage(stage >= 0 && cracked(img, stage) || img, x, y, w, h);
    if (p.flash > 0) { ctx.globalAlpha = 0.6; ctx.drawImage(G.Sprites.white(img), x, y, w, h); }
    ctx.restore();
    if (p.marked) drawMark(ctx, x, y, w, h, t);
  }

  const crackImgs = [], crackCache = new WeakMap();
  /** The sprite with crack stage `i` laid over its opaque pixels (cached per sprite), or null until the texture loads. */
  function cracked(img, i) {
    let im = crackImgs[i];
    if (!im) { im = crackImgs[i] = new Image(); im.src = 'assets/mc/environment/destroy_stage_' + i + '.png'; }
    if (!im.complete || !im.naturalWidth) return null;
    let m = crackCache.get(img);
    if (!m) crackCache.set(img, m = []);
    if (!m[i]) {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(img, 0, 0);
      x.globalCompositeOperation = 'source-atop';
      for (let yy = c.height - 16; yy > -16; yy -= 16) for (let xx = 0; xx < c.width; xx += 16) x.drawImage(im, xx, yy, 16, 16);
      m[i] = c;
    }
    return m[i];
  }

  /** White corner brackets round the block you clicked to break, gently pulsing. */
  function drawMark(ctx, x, y, w, h, t) {
    const g = 3 + Math.sin(t * 6) * 1.5, L = 7;
    const x0 = x - g, y0 = y - g, x1 = x + w + g, y1 = y + h + g;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L);
    }
    ctx.stroke();
    ctx.restore();
  }

  function update(dt, cam) {
    const leaves = gen.sky && over < 0 && G.FX;
    for (const [cx, cy] of visibleChunks(cam, 60)) {
      for (const p of chunkData(cx, cy).props) {
        if (p.flash > 0) p.flash -= dt;
        // Golden Oaks shed golden leaves, Crystal trees glint.
        if (leaves && p.type === 'tree') {
          if (p.fx === undefined) p.fx = G.Tiles.objFx(p.bi, p.kind % G.Tiles.objCount(p.bi));
          if (p.fx && Math.random() < dt * 0.9 && cam.sees(p.x, p.y, 40))
            G.FX.px(p.x + G.U.rand(-24, 24), p.y - G.U.rand(30, 64), p.fx, { vx: G.U.rand(-14, 14), vy: G.U.rand(14, 22), life: G.U.rand(1.6, 2.6), drag: 0.998, size: Math.random() < 0.3 ? 2 : 1 });
        }
      }
    }
    updatePortals(dt);
    prefetch(cam);
  }

  /*
   * Un superbloque nuevo necesita el crudo de toda su ventana (unos 40 bloques
   * que aún no existían al cruzar su borde): hecho de golpe sería un tirón de
   * varios ms. Aquí se va calentando ese crudo para los superbloques de
   * alrededor de la cámara, con ~1 ms por fotograma como mucho.
   */
  const warmed = new Set();
  function prefetch(cam) {
    if (cam == null || !isFinite(cam.x) || !isFinite(cam.y)) return;
    const t0 = performance.now(), S = SBT * TS;
    const csx = Math.floor(cam.x / S), csy = Math.floor(cam.y / S);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const sx = csx + dx, sy = csy + dy, k = sx + ',' + sy;
      if (warmed.has(k) || sblocks.has(k)) continue;
      const bx0 = Math.floor((sx * SBT - FM) / N), bx1 = Math.floor((sx * SBT + SBT + FM - 1) / N);
      const by0 = Math.floor((sy * SBT - FM) / N), by1 = Math.floor((sy * SBT + SBT + FM - 1) / N);
      for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
        if (raws.has(bx + ',' + by)) continue;
        rawBlock(bx, by);
        if (performance.now() - t0 > 1) return;
      }
      warmed.add(k);
    }
  }

  // ---------------- control ----------------

  /** Olvida los chunks (datos e imágenes) que tocan un círculo de radio R tiles. */
  function forgetChunks(tx, ty, R) {
    // El crudo cambia dentro de R; el ensanchado lo arrastra FM tiles más allá (y los props, PM más).
    warmed.clear();
    for (const m of [raws, data, images, overImages, sblocks]) for (const k of [...m.keys()]) {
      const [cx, cy] = k.split(',').map(Number), side = m === sblocks ? SBT : N;
      const M = R + side / 2 + (m === raws ? 0 : FM + PM);
      if (Math.abs(cx * side + side / 2 - tx) < M && Math.abs(cy * side + side / 2 - ty) < M) m.delete(k);
    }
  }

  /**
   * Cambia de dimensión: 'overworld' | 'ocean' | 'underworld' | 'nether' | 'stronghold' |
   * 'end' | 'ancient_city' | 'herobrine' | 'aether' (las de G.DIMENSIONS; otra = overworld).
   * Terreno, props, chunks y props rotos nuevos, sin portales ni arena, con el
   * claro en el origen (en el bioma `start`), y sus estructuras fijas: torres
   * del End, sala del portal de la fortaleza, marco de la Ciudad Antigua.
   */
  function setDimension(id, s) {
    const D = (G.DIM_BY && G.DIM_BY[id]) || null;
    dim = D ? id : 'overworld';
    if (s != null) seed = (s | 0) || 1;
    gen = GEN[dim] || GEN.overworld;
    keys = D ? D.biomes.filter(k => G.Tiles.biomeIndex(k) >= 0) : ['plains'];
    if (!keys.length) keys = ['plains'];
    tileIdx = keys.map(k => G.Tiles.biomeIndex(k, gen.variant));
    liqVarIdx = keys.map(k => (G.Tiles.hasVariant(k, 'lava') ? G.Tiles.biomeIndex(k, 'lava') : -1));
    terr = keys.map(k => TERRAIN[k] || TERRAIN_DEF);
    startB = Math.max(0, keys.indexOf(D ? D.start : 'plains'));
    isVoid = dim === 'end';
    hasPil = terr.some(t => t.pil);
    raws.clear(); sblocks.clear(); warmed.clear(); data.clear(); images.clear(); overImages.clear(); broken.clear();
    portals.length = 0; carves.length = 0;
    arena = null; over = -1;
    towers = []; portalRoom = null; roomActive = false; ancientFrame = null; frameLit = false;
    sCells = new Map(); sPortal = null; frameT = null; mon = null; monument = null; monB = -1; oCells = new Map();
    aCells = new Map(); aNear = new Map(); aeOver = new Map(); goldIsle = null; temple = null; goldB = -1; aeSpawn = null;
    planCells();
    if (dim === 'end') planTowers();
    if (dim === 'stronghold') planStronghold();
    if (dim === 'ancient_city') planCity();
    if (dim === 'ocean') planMonument();
    if (dim === 'aether') planAether();
  }

  function reset(s) { setDimension('overworld', s); }

  /**
   * Bioma que tapa todo el mapa (las arenas de la grieta y la del juicio):
   * i = índice de G.Tiles.BIOMES desde G.Tiles.ARENA. Con -1 / null (o uno de
   * los biomas normales, 0..ARENA-1) vuelve el mapa de biomas.
   * `instant` se acepta por compatibilidad: el cambio siempre es inmediato.
   */
  function setBiome(i, instant = true) {
    const n = G.Tiles.BIOMES.length;
    const b = i == null || i < G.Tiles.ARENA || i >= n ? -1 : i | 0;
    if (b === over) return;
    over = b;
    overImages.clear();
  }

  /** Clave de bioma del mapa en (x, y) en unidades de mundo (ignora la arena). */
  function biomeKeyAt(x, y) {
    const tx = tileOf(x), ty = tileOf(y);
    const c = data.get(Math.floor(tx / N) + ',' + Math.floor(ty / N));
    if (c) return G.Tiles.BIOMES[c.bio[(ty - c.cy * N) * N + (tx - c.cx * N)]].key;
    return keys[locate(tx, ty)];
  }

  function biomeName() {
    if (over >= 0) return G.Tiles.BIOMES[over].name;
    const f = focus(), k = biomeKeyAt(f.x || 0, f.y || 0);
    return (G.BIOME_DEFS && G.BIOME_DEFS[k] && G.BIOME_DEFS[k].name) || G.Tiles.BIOMES[G.Tiles.biomeIndex(k)].name;
  }

  /**
   * Abre un portal en el suelo libre más cercano a (x, y): despeja paredes,
   * charcos y props alrededor. Devuelve { x, y, kind }: donde hay que pisar
   * para cruzarlo (centro de los planos, pie de los de pie). Tipos:
   *   'cave'        agujero con escalera de mano (plano)
   *   'nether'      portal de obsidiana (de pie; también el de cualquier tipo desconocido)
   *   'stronghold'  escalera de ladrillo que baja, con un Ojo de Ender encima (plano)
   *   'end'         portal del End (plano). En la fortaleza activa la sala del portal
   *                 (activatePortalRoom) esté donde esté (x, y).
   *   'gateway'     Portal de Salida del End: lecho de roca con haz estrellado (de pie)
   *   'ancient'     en la Ciudad Antigua enciende el marco antiguo esté donde esté
   *                 (x, y); en otra dimensión pone un marco encendido suelto.
   *   'dive'        the Overworld's way down to the Ocean: a whirlpool in a round pool (flat, centred)
   *   'aether'      the Aether Portal: an upright Glowstone frame with a light-blue surface (standing; `ready` at
   *                 once: buildAetherPortal builds it in 2.5 s instead)
   *   ('cave' on The Ocean is drawn as an underwater crevice with bubbles.)
   */
  function addPortal(x, y, kind) {
    kind = PORTAL_KINDS.includes(kind) ? kind : 'nether';
    if (kind === 'end' && portalRoom) return activatePortalRoom();
    if (kind === 'ancient' && ancientFrame) return lightFrame();
    const R = kind === 'end' ? 4 : kind === 'ancient' ? 6 : kind === 'dive' ? 3.2 : kind === 'aether' ? 3.5 : 2.6;
    const t0x = tileOf(x), t0y = tileOf(y);
    let bx = t0x, by = t0y, bd = Infinity;
    for (let r = 0; r <= 30 && bd === Infinity; r++) {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const tx = t0x + i, ty = t0y + j;
        if (terrainAt(tx, ty) !== FLOOR || arenaDist(tx, ty) < arena_outer() + R) continue;
        const d = i * i + j * j;
        if (d < bd) { bd = d; bx = tx; by = ty; }
      }
    }
    carves.push({ tx: bx, ty: by, r: R });
    forgetChunks(bx, by, R + 2);
    const po = { x: bx * TS + TS / 2, y: by * TS + (FLAT_PORTALS.has(kind) ? TS / 2 : TS - 4), kind };
    if (kind === 'aether') { po.ready = true; po.build = null; }
    portals.push(po);
    return po;
  }

  /**
   * The Aether Portal builds itself near (x, y) (Herobrine's World, survived): addPortal(x, y, 'aether') with a
   * 2.5 s animation (G.World.update runs it). Returns the portal { x, y (feet: where to step), kind: 'aether',
   * ready, build: { t } }; `ready` turns true when the frame stands and the surface has filled: only then may it
   * take anyone.
   */
  function buildAetherPortal(x, y) {
    const po = addPortal(x, y, 'aether');
    po.ready = false; po.build = { t: 0, n: 0 };
    return po;
  }

  /**
   * Fortaleza: llena el marco de la sala con ojos y el cielo estrellado (el
   * portal del End de siempre, encajado en sus 5×5 bloques) y lo registra en
   * portals. Devuelve ese { x, y, kind: 'end' } (= portalRoom); otra llamada
   * devuelve el mismo. null si esta dimensión no tiene sala.
   */
  function activatePortalRoom() {
    if (!portalRoom) return null;
    let po = portals.find(p => p.room);
    if (!po) {
      po = { x: portalRoom.x, y: portalRoom.y, kind: 'end', room: true };
      portals.push(po);
    }
    roomActive = true;
    return po;
  }
  /** Ciudad Antigua: enciende el marco antiguo. Devuelve { x, y, kind: 'ancient' } (= ancientFrame, el pie del hueco). */
  function lightFrame() {
    let po = portals.find(p => p.frame);
    if (!po) {
      po = { x: ancientFrame.x, y: ancientFrame.y, kind: 'ancient', frame: true };
      portals.push(po);
    }
    frameLit = true;
    return po;
  }

  /** Punto libre (andando) más cercano al cristal de la torre i, junto a su base. { x, y } o null. */
  function towerFree(i) {
    const tw = towers[i];
    if (!tw) return null;
    for (let r = 2; r <= 6; r++) {
      let best = null, bd = Infinity;
      for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        if (Math.max(Math.abs(j), Math.abs(k)) !== r) continue;
        const tx = tw.tx + k, ty = tw.ty + j, x = tx * TS + TS / 2, y = ty * TS + TS / 2;
        if (!walkable(tx, ty) || !isFree(x, y, 13)) continue;
        const d = G.U.dist2(x, y, tw.top.x, tw.top.y);
        if (d < bd) { bd = d; best = { x, y }; }
      }
      if (best) return best;
    }
    return null;
  }

  /** Props de decoración de un tipo (p. ej. 'shrieker', 'sensor') cerca de (x, y). */
  function decosNear(x, y, r, name) {
    const out = [];
    const c0x = Math.floor((x - r) / CW), c1x = Math.floor((x + r) / CW);
    const c0y = Math.floor((y - r) / CW), c1y = Math.floor((y + r) / CW);
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      for (const p of chunkData(cx, cy).props)
        if (p.type === 'deco' && (!name || p.deco === name) && G.U.dist2(x, y, p.x, p.y) <= r * r) out.push(p);
    }
    return out;
  }

  /**
   * Luces visibles (antorchas, faroles, velas, sensores, portales) para la capa
   * de oscuridad: [{ x, y, r, color }] en px de mundo.
   */
  function lights(cam) {
    const out = [];
    for (const [cx, cy] of visibleChunks(cam, 200)) {
      for (const p of chunkData(cx, cy).props) {
        const L = p.type === 'deco' && DECO_LIGHT[p.deco];
        if (L) out.push({ x: p.x, y: p.y - 14, r: L[0], color: L[1] });
      }
    }
    const PL = { end: [180, '#b8fff0'], nether: [160, '#b06cff'], cave: [90, '#a0a0a0'], stronghold: [150, '#7affc4'], gateway: [170, '#e0c8ff'],
                 ancient: [240, '#5ff3ff'], dive: [150, '#7fd8ff'], aether: [240, '#fff0a0'] };
    for (const po of portals) {
      const L = po.kind === 'cave' && dim === 'ocean' ? [120, '#5fb8d8'] : PL[po.kind] || PL.nether;
      out.push({ x: po.x, y: po.y - 20, r: L[0], color: L[1] });
    }
    if (ancientFrame) out.push({ x: ancientFrame.x - 160, y: ancientFrame.y - 120, r: 110, color: '#5fe0e8' },
                               { x: ancientFrame.x + 160, y: ancientFrame.y - 120, r: 110, color: '#5fe0e8' });
    if (monument) {
      // The monument's sea-lantern pillars and corner towers, and a soft glow over each Elder Guardian's chamber.
      const sees = (x, y, m) => !cam.sees || cam.sees(x, y, m);
      for (const L of mon.lamps) if (sees(L.x, L.y, 260)) out.push({ x: L.x, y: L.y - 10, r: 170, color: '#c8fff4' });
      for (const e of monument.elders) if (sees(e.x, e.y, 320)) out.push({ x: e.x, y: e.y, r: 230, color: '#7fe8d8' });
    }
    return out;
  }

  // Al llegar las texturas de Minecraft, se vuelven a hornear los chunks.
  G.Tiles.onReady(() => { images.clear(); overImages.clear(); });

  /** Viñeta en coordenadas de pantalla. */
  function drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  reset(1);

  return {
    TS, CW, reset, setDimension, setBiome, biomeName, biomeKeyAt, liquidKind, liquidEffect, walkable,
    kindAt, isWall, isLiquid, isFree, collide, projectileBlock, propsInCircle, nearestBreakable,
    damageProp, breakAt, specialsNear, update, addPortal, activatePortalRoom, towerFree, drawTowerFront, decosNear, lights,
    buildAetherPortal, drawSkyOverlay,
    /** true (default): drawLiquid draws the Aether's light by itself. Set false to call drawSkyOverlay yourself. */
    get skyOverlayAuto() { return skyAuto; },
    set skyOverlayAuto(v) { skyAuto = !!v; },
    /**
     * The Aether ground effect of the tile under (x, y) (world px): 'quicksoil' (the mod's fast sand: speed it up),
     * 'bounce' (a Blue Aercloud pad: a hop) or null. Works on any floor (null where there are no such tiles).
     */
    tileEffect(x, y) {
      const tx = tileOf(x), ty = tileOf(y);
      if (over >= 0 || terrainAt(tx, ty) !== FLOOR) return null;
      const c = chunkOf(tx, ty), b = c.blk[(ty - c.cy * N) * N + (tx - c.cx * N)];
      return b === BK.ae_quicksoil ? 'quicksoil' : b === BK.ae_cloud_blue ? 'bounce' : null;
    },
    /** The Aether: is (x, y) open sky (between the islands: no ground, only flyers; Aerwhales swim here)? */
    isOpenSky(x, y) { return !!gen.sky && over < 0 && terrainAt(tileOf(x), tileOf(y)) === VOID; },
    /** The Aether: where you arrive (world px), on the start island in front of the arrival portal; null elsewhere. */
    get aetherSpawn() { return aeSpawn; },
    /** The Aether: the dungeon exteriors planned so far [{ kind: 'silver' | 'bronze' | 'gold', x, y (sprite foot), tx, ty }]. */
    get aetherLandmarks() {
      const out = [];
      for (const c of aCells.values()) if (c.lm) out.push({ kind: c.lm.kind, x: c.lm.x, y: c.lm.y, tx: c.lm.tx, ty: c.lm.ty });
      return out;
    },
    breakProp(p) { if (!broken.has(p.tx + ',' + p.ty)) destroyProp(p); },
    /** Arena de la grieta: { tx, ty, r } (en tiles) o null. */
    setArena(a) {
      arena = a;
      if (!a) return;
      a.th = G.Tiles.ARENA_THEMES[a.type] || G.Tiles.ARENA_THEMES.normal;
      // Olvida los chunks de esa zona (si se hubieran generado antes).
      forgetChunks(a.tx, a.ty, a.r + 9);
    },
    clearPortals() {
      for (const c of carves) forgetChunks(c.tx, c.ty, c.r + 2);
      portals.length = 0; carves.length = 0;
      roomActive = false; frameLit = false;
    },
    get portals() { return portals; },
    get dimension() { return dim; },
    /** The End: torres de los cristales [{ i, tx, ty, x, y (pie de la torre), top: { x, y } (donde va el cristal), caged }]. */
    get towers() { return towers; },
    /** Fortaleza: centro del marco del portal (suelo, se puede pisar) { x, y, tx, ty, r } o null. */
    get portalRoom() { return portalRoom; },
    get portalRoomActive() { return roomActive; },
    /** Ciudad Antigua: pie del hueco del marco antiguo { x, y, tx, ty } o null. */
    get ancientFrame() { return ancientFrame; },
    /**
     * The Ocean: the Ocean Monument, or null on other floors. World px: { x, y } its centre, r its half-size,
     * tx / ty its centre tile, entrance { x, y } (on the seabed just outside the main gate, which faces the
     * origin), elders [{ x, y } ×3]: the centres of the two wing chambers and the penthouse (walkable floor,
     * reachable from the gate), where the Elder Guardians wait.
     */
    get monument() { return monument; },
    drawWaterOverlay,
    /** true (default): drawLiquid draws the caustics by itself on The Ocean. Set false to call drawWaterOverlay yourself. */
    get waterOverlayAuto() { return waterAuto; },
    set waterOverlayAuto(v) { waterAuto = !!v; },
    get ancientFrameLit() { return frameLit; },
    /** Gancho opcional: fn(prop) cuando se rompe un prop (p.type, p.deco: 'sensor', 'web'...). */
    get onPropBroken() { return onPropBroken; },
    set onPropBroken(fn) { onPropBroken = typeof fn === 'function' ? fn : null; },
    get arena() { return arena; }, drawGround, drawLiquid, visibleProps, drawProp, drawVignette,
    /** Bioma de arena que tapa el mapa (índice de G.Tiles.BIOMES) o -1. */
    get biome() { return over; },
    /** Pruebas / minimapa: clave del bioma en el tile (tx, ty), sin generar chunks. */
    debugBiomeTile(tx, ty) { return keys[locate(tx, ty)]; },
    /** Pruebas / minimapa: terreno del tile ('floor' | 'wall' | 'liquid' | 'void'). */
    debugTerrainTile(tx, ty) { return KIND[terrainAt(tx, ty)]; },
    /** Pruebas / minimapa: bloque de estructura del tile (índice de G.Tiles.BLOCK, 0 = ninguno). */
    debugBlockTile(tx, ty) { const c = chunkOf(tx, ty); return c.blk[(ty - c.cy * N) * N + (tx - c.cx * N)]; }
  };
})();
