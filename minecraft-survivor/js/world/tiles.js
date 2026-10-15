/* ============ tiles.js — pixel art del mundo: bloques de Minecraft ============
 * Todo se pinta a resolución de ARTE (16 px por tile) escribiendo en un
 * ImageData, y luego se dibuja escalado ×G.Sprites.PX sin suavizado. Un tile
 * es un bloque: se copian los píxeles de las texturas de assets/mc/ (ver
 * "texturas de Minecraft"). Mientras no han cargado, se pinta el arte
 * procedural de PokéSurvivor (paintChunk / PAINT), que sigue aquí de reserva.
 *
 * Autotiling: cada tile mira a sus vecinos al pintarse (cara frontal de las
 * paredes, sombras, orilla de los charcos...).
 */
G.Tiles = (() => {
  const T = 16;                       // píxeles de arte por tile

  /*
   * Cada bioma tiene una paleta (para el pintado procedural de reserva y los
   * efectos: B.grass[1], B.rock[1], B.foam...) y `mc`: los bloques de Minecraft
   * con que se pinta de verdad (ver "texturas de Minecraft" más abajo).
   * Especificación de textura: 'nombre[#tinte][*brillo]' y capas con '+'
   * ('dirt+grass_side#79c05a' = tierra con la franja de hierba teñida encima).
   *   floor  suelo · patch  bloques donde el original pintaba manchas de tierra
   *   spots  [[bloque, prob]] tiles sueltos · decal  plantas sobre el suelo
   *   wall   [{ top, side, w }] cara superior / frontal de las paredes
   *   bank   lado del bloque de suelo que se ve sobre el agua
   *   liq    { strip, alpha, bed, ... } (se mezcla con LIQ_STYLE del tipo de charco)
   *   obj    lo que se dibuja en la casilla de árbol (tree · fungus · pillar · cluster)
   *   rock   bloque de las rocas · grass  [hierba, helecho]
   */
  const BIOMES = [
    { name: 'Plains', liquid: 'water',
      floor: ['#6fae52', '#79c05a', '#66a14b'], dirt: ['#8a6a46', '#7c5e3d', '#94744d'],
      speck: '#4d7d38', light: '#9bd47a', flowers: ['#e8352a', '#f8d43a', '#eef2ff'],
      wallTop: ['#7f7f7f', '#888888', '#747474'], wallLight: '#a6a6a6', wallEdge: '#353535',
      wallFace: ['#575757', '#4f4f4f'], wallFaceDark: '#333333',
      liq: '#3f76e4', liqDeep: '#2f5cb8', foam: '#b9d0ff', shore: '#5a4630',
      prop: 'tree', leaf: ['#2f6a1c', '#3f8a26', '#59ae30', '#7cc650'], trunk: ['#4f3a22', '#6b5132'],
      rock: ['#5a5a5a', '#7b7b7b', '#a2a2a2'], grass: ['#4f8a35', '#79c05a', '#a2dc80'],
      mc: {
        floor: 'grass_top#79c05a', patch: ['gravel', 'coarse_dirt', 'grass_path_top', 'coarse_dirt'],
        decal: ['flower_rose', 'flower_dandelion', 'flower_rose', 'flower_dandelion', 'flower_houstonia'], decalP: 0.07,
        wall: [{ top: 'stone', side: 'stone' }, { top: 'stone_andesite', side: 'stone_andesite', w: 0.3 }],
        bank: 'dirt+grass_side#79c05a', liq: { bed: 'dirt' },
        obj: { kind: 'tree', log: 'log_oak', leaves: 'leaves_oak_opaque#59ae30' },
        rock: 'cobblestone', grass: ['tallgrass#79c05a', 'fern#79c05a']
      } },
    { name: 'Amethyst Caves', liquid: 'water',
      floor: ['#7a7a7a', '#838383', '#707070'], dirt: ['#4d4d55', '#55555c', '#46464d'],
      speck: '#5a5a5a', light: '#a0a0a0', flowers: ['#8fe3c0', '#c9a6ff', '#7ef0d0'],
      wallTop: ['#6b6d64', '#74766c', '#62645b'], wallLight: '#9a9c90', wallEdge: '#1f1f22',
      wallFace: ['#45454b', '#3d3d43'], wallFaceDark: '#252529',
      liq: '#3f76e4', liqDeep: '#2f5cb8', foam: '#b9d0ff', shore: '#3a3a40',
      prop: 'crystal', leaf: ['#5a3a9a', '#8a5cd0', '#b88cf0', '#e8d0ff'], trunk: ['#3c2a66', '#6a4aa8'],
      rock: ['#3a3a40', '#55555c', '#7a7a82'], grass: ['#3d6a3a', '#5f9d5a', '#8ac884'],
      mc: {
        floor: 'stone*0.9', patch: ['deepslate/deepslate_top', 'tuff', 'gravel'],
        decal: ['glow_lichen'], decalP: 0.035,
        wall: [{ top: 'tuff', side: 'tuff' }, { top: 'deepslate/cobbled_deepslate', side: 'deepslate/cobbled_deepslate' }],
        bank: 'stone', liq: { bed: 'gravel' },
        obj: { kind: 'cluster', base: 'budding_amethyst', plants: ['medium_amethyst_bud', 'large_amethyst_bud', 'amethyst_cluster'] },
        rock: 'deepslate/cobbled_deepslate', grass: ['small_amethyst_bud', 'medium_amethyst_bud'], deep: 0.45, topK: 0.72
      } },
    { name: 'Nether Wastes', liquid: 'lava',
      floor: ['#6f3333', '#7a3a3a', '#642e2e'], dirt: ['#4f3a30', '#57402f', '#46332a'],
      speck: '#4a2222', light: '#9a5050', flowers: ['#ff8d3d', '#ffc45e', '#e06a4a'],
      wallTop: ['#2c2830', '#34303a', '#26222a'], wallLight: '#4e4a56', wallEdge: '#0f0d12',
      wallFace: ['#1f1c24', '#1a171e'], wallFaceDark: '#0f0d12',
      liq: '#e45a1f', liqDeep: '#b9401a', foam: '#ffd46a', shore: '#3a1a1a',
      prop: 'dead', leaf: ['#5a0a0a', '#7a1414', '#9a2222', '#c84040'], trunk: ['#5a1a2a', '#8a2a3a'],
      rock: ['#1e1b22', '#2e2a33', '#4a4652'], grass: ['#7a1414', '#b02a2a', '#e05050'],
      mc: {
        floor: 'netherrack', patch: ['soul_sand', 'soul_sand*0.92'], spots: [['magma', 0.03]],
        wall: [{ top: 'blackstone_top', side: 'blackstone' }, { top: 'basalt_top', side: 'basalt_side' }],
        bank: 'netherrack',
        obj: { kind: 'fungus', stem: 'huge_fungus/crimson_log_side', cap: 'nether_wart_block', light: 'shroomlight' },
        rock: 'blackstone', grass: ['crimson_roots', 'nether_sprouts']
      } },
  ];
  const NORMAL = 3;                   // biomas que se van turnando en una run
  const ARENA = 3;                    // a partir de aquí, las arenas de la grieta (una por tipo)

  // ---------------- arenas de la grieta ----------------
  /*
   * Cada tipo tiene su arena: paleta, terreno y clima.
   *   liquid   charcos: water (frena) · swamp (frena más) · lava (quema) ·
   *            poison (envenena) · spark (descarga) · ice (resbala)
   *   pools    cuánto terreno es charco (0 = ninguno)
   *   pillars  probabilidad de una columna 2×2 (cobertura) por bloque
   *   props    densidad de árboles / rocas / hierba
   *   weather  clima que trae (ver systems/weather.js) o null
   */
  const ARENA_THEMES = {
    normal:   { name: 'Village', floor: '#79c05a', wall: '#7a7a7a', liquid: 'water', liq: '#3f76e4', prop: 'tree',
                leaf: '#59ae30', trunk: '#6b5132', flowers: ['#e8352a', '#ffffff', '#f8d43a'], grass: '#79c05a', rock: '#7b7b7b',
                pools: 0, pillars: 0.035, props: { tree: 0.025, grass: 0.05 }, weather: null,
                mc: { floor: 'grass_top#79c05a', patch: ['grass_path_top', 'grass_path_top', 'gravel'],
                      decal: ['flower_tulip_red', 'flower_oxeye_daisy', 'flower_dandelion'], decalP: 0.05,
                      wall: [{ top: 'cobblestone', side: 'cobblestone' }, { top: 'planks_oak', side: 'log_oak' }],
                      bank: 'dirt+grass_side#79c05a', liq: { bed: 'dirt' },
                      obj: { kind: 'tree', log: 'log_oak', leaves: 'leaves_oak_opaque#59ae30' },
                      rock: 'cobblestone', grass: ['tallgrass#79c05a', 'fern#79c05a'] } },
    fire:     { name: 'Nether Fortress', floor: '#6f3333', wall: '#2c1519', liquid: 'lava', liq: '#e45a1f', foam: '#ffd46a', prop: 'dead',
                leaf: '#9a2222', trunk: '#5a1a2a', flowers: ['#ff8d3d', '#ffc45e', '#e06a4a'], grass: '#8a1a1a', rock: '#3a2a2a',
                pools: 0.31, pillars: 0.03, props: { tree: 0.01 }, weather: 'sun',
                mc: { floor: 'netherrack', patch: ['nether_brick*1.15', 'soul_sand'], spots: [['magma', 0.02]],
                      wall: [{ top: 'red_nether_brick', side: 'nether_brick' }, { top: 'nether_brick*1.2', side: 'nether_brick' }],
                      bank: 'netherrack',
                      obj: { kind: 'fungus', stem: 'huge_fungus/crimson_log_side', cap: 'nether_wart_block', light: 'shroomlight' },
                      rock: 'nether_brick*1.2', grass: ['nether_wart_stage_2', 'crimson_roots'] } },
    water:    { name: 'Ocean Monument', floor: '#63a796', wall: '#3a6a5e', liquid: 'water', liq: '#3f76e4', foam: '#bfeaff', prop: 'crystal',
                leaf: '#f07ab0', trunk: '#2a5a50', flowers: ['#ff9ec4', '#7ef0d0', '#ffffff'], grass: '#3f8a4a', rock: '#5d9a8a',
                pools: 0.33, pillars: 0.02, props: { tree: 0.015 }, weather: 'rain',
                mc: { floor: 'prismarine_rough', patch: ['sand', 'prismarine_bricks'], spots: [['sea_lantern', 0.015]],
                      wall: [{ top: 'prismarine_dark', side: 'prismarine_dark' }, { top: 'prismarine_bricks*0.7', side: 'prismarine_dark', w: 0.4 }],
                      bank: 'prismarine_bricks', liq: { bed: 'sand' },
                      obj: { kind: 'cluster', base: 'prismarine_dark', plants: ['coral_fan_blue', 'coral_plant_yellow', 'coral_fan_pink'] },
                      rock: 'prismarine_rough', grass: ['seagrass', 'coral_plant_pink'] } },
    grass:    { name: 'Jungle', floor: '#59c93c', wall: '#5a6a4a', liquid: 'swamp', liq: '#617b64', foam: '#9ac29a', prop: 'tree',
                leaf: '#30bb0b', trunk: '#5a4a2a', flowers: ['#f4d65c', '#ff8ad8', '#ffffff'], grass: '#59c93c', rock: '#6a7a5a',
                pools: 0.22, pillars: 0, props: { tree: 0.05, grass: 0.12 }, weather: null,
                mc: { floor: 'grass_top#59c93c', patch: ['moss_block', 'dirt_podzol_top', 'coarse_dirt'],
                      decal: ['flower_blue_orchid', 'flower_tulip_orange'], decalP: 0.03,
                      wall: [{ top: 'cobblestone_mossy', side: 'cobblestone_mossy' }, { top: 'stonebrick_mossy', side: 'stonebrick_mossy' }],
                      bank: 'dirt+grass_side#59c93c', liq: { bed: 'mud' },
                      obj: { kind: 'tree', log: 'log_jungle', leaves: 'leaves_jungle_opaque#30bb0b', vine: 'vine#30bb0b' },
                      rock: 'cobblestone_mossy', grass: ['tallgrass#59c93c', 'fern#59c93c'] } },
    electric: { name: 'Redstone Lab', floor: '#9e9e9e', wall: '#7a7a7a', liquid: 'spark', liq: '#d8261a', foam: '#ff9a8a', prop: 'crystal',
                leaf: '#ff3020', trunk: '#8a1a10', flowers: ['#ff3020', '#ffffff', '#ffd23f'], grass: '#8a8a8a', rock: '#8a8a8a',
                pools: 0.28, pillars: 0.04, props: { tree: 0.01 }, weather: 'rain',
                mc: { floor: 'stone_slab_top', patch: ['stone_andesite_smooth', 'stone_slab_top*0.88'],
                      decal: ['redstone_dust_cross#e2251b', 'redstone_dust_line#e2251b'], decalP: 0.06,
                      wall: [{ top: 'stonebrick', side: 'stonebrick' }, { top: 'redstone_lamp_on', side: 'redstone_lamp_on', w: 0.25 }],
                      bank: 'stone_slab_top',
                      obj: { kind: 'pillar', top: 'redstone_block', side: 'redstone_block', crown: 'redstone_torch_on' },
                      rock: 'stone', grass: ['tallgrass#79c05a', 'fern#79c05a'] } },
    ice:      { name: 'Frozen Peaks', floor: '#f0fbfb', wall: '#8eb4fa', liquid: 'ice', liq: '#9fc0f8', foam: '#ffffff', prop: 'tree',
                leaf: '#619961', trunk: '#4a3420', flowers: ['#ffffff', '#9fe0ff', '#d8f1ff'], grass: '#80b497', rock: '#8fa8c0',
                pools: 0.36, pillars: 0.02, props: { tree: 0.02 }, weather: 'snow',
                mc: { floor: 'snow*0.94', patch: ['gravel', 'powder_snow*0.86', 'stone'],
                      wall: [{ top: 'ice_packed', side: 'ice_packed' }, { top: 'stone', side: 'stone', w: 0.6 }],
                      bank: 'snow',
                      obj: { kind: 'tree', log: 'log_spruce', leaves: 'leaves_spruce_opaque#619961', snow: true },
                      rock: 'stone', grass: ['tallgrass#80b497', 'fern#80b497'] } },
    fighting: { name: 'Pillager Outpost', floor: '#86b783', wall: '#4a3420', liquid: 'water', liq: '#3f76e4', prop: 'tree',
                leaf: '#59ae30', trunk: '#3e2a16', flowers: ['#ff5f6d', '#f4d65c', '#ffffff'], grass: '#86b783', rock: '#7b7b7b',
                pools: 0, pillars: 0.075, props: { tree: 0.008 }, weather: null,
                mc: { floor: 'grass_top#86b783', patch: ['coarse_dirt', 'dirt_podzol_top', 'grass_path_top'],
                      decal: ['flower_dandelion', 'flower_rose'], decalP: 0.03,
                      wall: [{ top: 'planks_big_oak', side: 'log_big_oak' }, { top: 'cobblestone', side: 'cobblestone', w: 0.5 }],
                      bank: 'dirt+grass_side#86b783', liq: { bed: 'dirt' },
                      obj: { kind: 'tree', log: 'log_big_oak', leaves: 'leaves_big_oak_opaque#59ae30' },
                      rock: 'cobblestone', grass: ['tallgrass#86b783', 'fern#86b783'] } },
    poison:   { name: 'Swamp', floor: '#6a7039', wall: '#4a4a3a', liquid: 'poison', liq: '#5bc23a', foam: '#c8ff9a', prop: 'tree',
                leaf: '#6a7039', trunk: '#4f3a22', flowers: ['#3fa0e0', '#8bd94a', '#e8352a'], grass: '#6a7039', rock: '#5a6a4a',
                pools: 0.31, pillars: 0.015, props: { tree: 0.02 }, weather: null,
                mc: { floor: 'grass_top#6a7039', patch: ['mud', 'clay*0.85', 'dirt'],
                      decal: ['flower_blue_orchid', 'mushroom_brown', 'mushroom_red'], decalP: 0.04,
                      wall: [{ top: 'cobblestone_mossy', side: 'cobblestone_mossy' }, { top: 'mud_bricks', side: 'mud_bricks' }],
                      bank: 'dirt+grass_side#6a7039', liq: { bed: 'mud' },
                      obj: { kind: 'tree', log: 'log_oak', leaves: 'leaves_oak_opaque#6a7039', vine: 'vine#6a7039' },
                      rock: 'cobblestone_mossy', grass: ['fern#6a7039', 'tallgrass#6a7039'] } },
    ground:   { name: 'Badlands', floor: '#bf6a2c', wall: '#9a5a3a', liquid: 'swamp', liq: '#8b6a3e', foam: '#d6b98a', prop: 'dead',
                leaf: '#7a5a2a', trunk: '#5a8a2a', flowers: ['#e06a4a', '#f4d65c', '#ffffff'], grass: '#9a7a3a', rock: '#9a5a3a',
                pools: 0.25, pillars: 0.04, props: { tree: 0.01, rock: 0.015 }, weather: 'sand',
                mc: { floor: 'red_sand', patch: ['hardened_clay', 'hardened_clay_stained_orange', 'hardened_clay_stained_yellow'],
                      wall: [{ top: 'hardened_clay_stained_white', side: 'hardened_clay_stained_orange' }, { top: 'hardened_clay', side: 'hardened_clay_stained_red' },
                             { top: 'hardened_clay_stained_brown', side: 'hardened_clay_stained_yellow', w: 0.6 }],
                      bank: 'red_sand', liq: { strip: 'water_still_grey#8b6a3e', bed: 'red_sand' },
                      obj: { kind: 'pillar', top: 'cactus_top', side: 'cactus_side', w: 14 },
                      rock: 'hardened_clay_stained_orange', grass: ['deadbush', 'deadbush'] } },
    flying:   { name: 'Windswept Hills', floor: '#8ab689', wall: '#7f7f7f', liquid: 'water', liq: '#3f76e4', prop: 'tree',
                leaf: '#6da36b', trunk: '#4a3420', flowers: ['#ffffff', '#ffe14d', '#bfe0ff'], grass: '#8ab689', rock: '#888888',
                pools: 0, pillars: 0.02, props: { tree: 0.025 }, weather: null,
                mc: { floor: 'grass_top#8ab689', patch: ['gravel', 'stone', 'coarse_dirt'],
                      decal: ['flower_oxeye_daisy', 'flower_houstonia'], decalP: 0.03,
                      wall: [{ top: 'stone', side: 'stone' }, { top: 'stone_andesite', side: 'stone_andesite' }],
                      bank: 'dirt+grass_side#8ab689', liq: { bed: 'gravel' },
                      obj: { kind: 'tree', log: 'log_spruce', leaves: 'leaves_spruce_opaque#6da36b' },
                      rock: 'stone', grass: ['tallgrass#8ab689', 'fern#8ab689'] } },
    psychic:  { name: 'End City', floor: '#dbde9e', wall: '#a77aa7', liquid: 'water', liq: '#7a5ad0', prop: 'crystal',
                leaf: '#a77aa7', trunk: '#7a527a', flowers: ['#c9a6ff', '#ffffff', '#a77aa7'], grass: '#8a5a9a', rock: '#cfd29a',
                pools: 0, pillars: 0.045, props: { tree: 0.02 }, weather: null,
                mc: { floor: 'end_stone', patch: ['end_bricks', 'purpur_block'],
                      wall: [{ top: 'purpur_block', side: 'purpur_block' }, { top: 'purpur_pillar_top', side: 'purpur_pillar' }],
                      bank: 'end_stone', liq: { strip: 'water_still_grey#7a5ad0', bed: 'end_stone' },
                      obj: { kind: 'pillar', top: 'purpur_pillar_top', side: 'purpur_pillar', crown: 'end_rod' },
                      rock: 'end_stone', grass: ['chorus_flower', 'chorus_flower'] } },
    bug:      { name: 'Mineshaft', floor: '#7a7a7a', wall: '#a07c4a', liquid: 'swamp', liq: '#4a6a5a', foam: '#9ab5a0', prop: 'tree',
                leaf: '#e8e8e8', trunk: '#6b5132', flowers: ['#e8e8e8', '#ffffff', '#c4d65a'], grass: '#e0e0e0', rock: '#7b7b7b',
                pools: 0.2, pillars: 0, props: { tree: 0.04, grass: 0.12 }, weather: null,
                mc: { floor: 'stone', patch: ['gravel', 'dirt', 'planks_oak'],
                      wall: [{ top: 'stone', side: 'stone' }, { top: 'coal_ore', side: 'coal_ore', w: 0.35 },
                             { top: 'iron_ore', side: 'iron_ore', w: 0.25 }, { top: 'planks_oak', side: 'planks_oak', w: 0.5 }],
                      bank: 'stone', liq: { strip: 'water_still_grey#4a6a5a', bed: 'gravel' },
                      obj: { kind: 'pillar', top: 'log_oak_top', side: 'log_oak', w: 12, crown: 'web' },
                      rock: 'stone', grass: ['web', 'web'] } },
    rock:     { name: 'Stronghold', floor: '#7a7a7a', wall: '#6a6a6a', liquid: 'water', liq: '#3f76e4', prop: 'dead',
                leaf: '#6a6a6a', trunk: '#4a4a4a', flowers: ['#c9b28a', '#ffffff', '#a89070'], grass: '#5a7a40', rock: '#7b7b7b',
                pools: 0, pillars: 0.08, props: { rock: 0.03 }, weather: 'sand',
                mc: { floor: 'stonebrick*0.72', patch: ['stonebrick_mossy*0.72', 'stonebrick_cracked*0.72'],
                      wall: [{ top: 'stonebrick_carved', side: 'stonebrick' }, { top: 'stonebrick', side: 'stonebrick_mossy' }],
                      bank: 'stonebrick',
                      obj: { kind: 'pillar', top: 'stonebrick_carved', side: 'stonebrick' },
                      rock: 'cobblestone', grass: ['tallgrass#79c05a', 'fern#79c05a'] } },
    ghost:    { name: 'Soul Sand Valley', floor: '#4a382c', wall: '#4a4a52', liquid: 'water', liq: '#3a4a7a', prop: 'dead',
                leaf: '#dcd8c0', trunk: '#4a4a52', flowers: ['#5fe0e8', '#9a8ad0', '#c9cfdc'], grass: '#5fe0e8', rock: '#2e2a33',
                pools: 0, pillars: 0.03, props: { tree: 0.03 }, weather: 'fog',
                mc: { floor: 'soul_soil', patch: ['soul_sand', 'soul_sand*0.9'],
                      wall: [{ top: 'basalt_top', side: 'basalt_side' }, { top: 'bone_block_top', side: 'bone_block_side', w: 0.4 }],
                      bank: 'soul_soil', liq: { strip: 'water_still_grey#3a4a7a', bed: 'soul_soil' },
                      obj: { kind: 'pillar', top: 'bone_block_top', side: 'bone_block_side', w: 14, crown: 'soul_torch' },
                      rock: 'blackstone', grass: ['nether_sprouts', 'nether_sprouts'] } },
    dragon:   { name: 'The End', floor: '#dbde9e', wall: '#1a1028', liquid: 'lava', liq: '#9a6cff', foam: '#e0c8ff', prop: 'crystal',
                leaf: '#9a6cff', trunk: '#1a1028', flowers: ['#9a6cff', '#ffd23f', '#ffffff'], grass: '#4a4a8a', rock: '#cfd29a',
                pools: 0.22, pillars: 0.04, props: { tree: 0.015 }, weather: null,
                mc: { floor: 'end_stone', patch: ['end_stone*0.88', 'end_bricks*0.95'],
                      wall: [{ top: 'obsidian*1.3', side: 'obsidian' }, { top: 'crying_obsidian', side: 'obsidian', w: 0.25 }],
                      bank: 'end_stone', liq: { strip: 'lava_still!#b07cff', foam: '#e0c8ff' },
                      obj: { kind: 'pillar', top: 'obsidian*1.3', side: 'obsidian', crown: 'end_rod' },
                      rock: 'end_stone', grass: ['chorus_flower', 'chorus_flower'] } },
    dark:     { name: 'Deep Dark', floor: '#3e3e44', wall: '#2a2a30', liquid: 'water', liq: '#25406a', prop: 'dead',
                leaf: '#0f5a6a', trunk: '#1a2a30', flowers: ['#2ad0e0', '#0f5a6a', '#9a8a9a'], grass: '#0f5a6a', rock: '#3a3a40',
                pools: 0, pillars: 0.05, props: { tree: 0.02 }, weather: null,
                mc: { floor: 'deepslate/deepslate_top*1.2', patch: ['deepslate/cobbled_deepslate*1.25', 'deepslate/deepslate_top*1.05', 'deepslate/cobbled_deepslate*1.25'],
                      spots: [['sculk*1.3', 0.06]], decal: ['sculk_vein'], decalP: 0.1,
                      wall: [{ top: 'deepslate/deepslate_tiles*1.15', side: 'deepslate/deepslate_tiles' },
                             { top: 'reinforced_deepslate_top', side: 'reinforced_deepslate_side', w: 0.3 }],
                      bank: 'deepslate/deepslate_top', liq: { strip: 'water_still_grey#25406a', bed: 'deepslate/deepslate_top' },
                      obj: { kind: 'pillar', top: 'sculk_catalyst_top', side: 'sculk_catalyst_side' },
                      rock: 'deepslate/cobbled_deepslate', grass: ['sculk_vein', 'sculk_vein'] } },
    steel:    { name: 'Trial Chambers', floor: '#6a6a60', wall: '#5a5a52', liquid: 'water', liq: '#3f76e4', prop: 'crystal',
                leaf: '#c46a4a', trunk: '#3a3a3a', flowers: ['#c46a4a', '#4fa08a', '#ffffff'], grass: '#4fa08a', rock: '#6a6a60',
                pools: 0, pillars: 0.08, props: { tree: 0.01 }, weather: null,
                mc: { floor: 'polished_tuff', patch: ['cut_copper', 'oxidized_cut_copper', 'chiseled_tuff'],
                      wall: [{ top: 'tuff_bricks', side: 'tuff_bricks' }, { top: 'chiseled_copper', side: 'cut_copper', w: 0.35 },
                             { top: 'oxidized_cut_copper', side: 'oxidized_cut_copper', w: 0.25 }],
                      bank: 'polished_tuff', liq: { bed: 'tuff' },
                      obj: { kind: 'pillar', top: 'trial_spawner_top', side: 'trial_spawner_side_active' },
                      rock: 'tuff', grass: ['tallgrass#79c05a', 'fern#79c05a'] } },
    fairy:    { name: 'Cherry Grove', floor: '#b6db61', wall: '#7f7f7f', liquid: 'water', liq: '#3f76e4', foam: '#ffe0f4', prop: 'tree',
                leaf: '#f0a8c8', trunk: '#3a1a2a', flowers: ['#ff8ad8', '#ffffff', '#c9a6ff'], grass: '#b6db61', rock: '#888888',
                pools: 0.16, pillars: 0, props: { tree: 0.05, grass: 0.1 }, weather: null,
                mc: { floor: 'grass_top#b6db61', patch: ['grass_top#b6db61+pink_petals', 'grass_top#b6db61+pink_petals', 'grass_path_top'],
                      decal: ['flower_allium', 'flower_tulip_pink', 'flower_lily_of_the_valley'], decalP: 0.05,
                      wall: [{ top: 'stone', side: 'stone' }, { top: 'stone_andesite', side: 'stone_andesite', w: 0.5 }],
                      bank: 'dirt+grass_side#b6db61', liq: { bed: 'dirt' },
                      obj: { kind: 'tree', log: 'cherry_log_side', leaves: 'cherry_leaves_opaque' },
                      rock: 'stone', grass: ['tallgrass#b6db61', 'fern#b6db61'] } },
    // El minuto 30, Herobrine (systems/judgment.js): el Vacío, con un claro
    // donde aterriza (clear). No es de ninguna grieta.
    judgment: { name: 'The Void', floor: '#4a4a4a', wall: '#1a1028', liquid: 'lava', liq: '#e8a82a', foam: '#fff1b8', prop: 'dead',
                leaf: '#2a1a3a', trunk: '#1a1028', flowers: ['#8a7f76', '#e8a82a', '#5a514c'], grass: '#5e544c', rock: '#5a5a5a',
                pools: 0, pillars: 0.03, props: { tree: 0.012, rock: 0.02 }, weather: null, clear: 4.5,
                mc: { floor: 'blackstone_top*0.8', patch: ['bedrock*0.5', 'blackstone*0.7'], spots: [['crying_obsidian', 0.012]],
                      wall: [{ top: 'obsidian*1.3', side: 'obsidian' }, { top: 'crying_obsidian', side: 'crying_obsidian', w: 0.35 }],
                      bank: 'bedrock',
                      obj: { kind: 'pillar', top: 'bedrock', side: 'bedrock', crown: 'soul_torch' },
                      rock: 'bedrock', grass: ['deadbush', 'deadbush'] } }
  };
  const ARENA_TYPES = Object.keys(ARENA_THEMES);

  /** Aclara (k>0) u oscurece (k<0) un color. */
  function shade(hex, k) {
    const c = rgb(hex).map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /** Paleta completa de bioma a partir de los pocos colores de una arena. */
  function arenaBiome(th) {
    const f = th.floor, w = th.wall, L = th.liq;
    return {
      name: th.name, liquid: th.liquid, mc: Object.assign({}, th.mc),
      floor: [f, shade(f, 0.05), shade(f, -0.06)], dirt: [shade(f, -0.16), shade(f, -0.12), shade(f, -0.2)],
      speck: shade(f, -0.25), light: shade(f, 0.22), flowers: th.flowers,
      wallTop: [w, shade(w, 0.07), shade(w, -0.07)], wallLight: shade(w, 0.32), wallEdge: shade(w, -0.7),
      wallFace: [shade(w, -0.3), shade(w, -0.38)], wallFaceDark: shade(w, -0.55),
      liq: L, liqDeep: shade(L, -0.22), foam: th.foam || shade(L, 0.55), shore: shade(f, -0.32),
      prop: th.prop, leaf: [shade(th.leaf, -0.35), shade(th.leaf, -0.15), th.leaf, shade(th.leaf, 0.3)],
      trunk: [shade(th.trunk, -0.2), th.trunk],
      rock: [shade(th.rock, -0.2), th.rock, shade(th.rock, 0.22)],
      grass: [shade(th.grass, -0.28), th.grass, shade(th.grass, 0.28)]
    };
  }
  for (const t of ARENA_TYPES) BIOMES.push(arenaBiome(ARENA_THEMES[t]));

  // ---------------- biomas de las dimensiones ----------------
  /*
   * Un tema por clave de G.BIOME_DEFS (data/dimensions.js). world.js pinta cada
   * tile con el bioma que le toca en el mapa de la dimensión. Plains, Amethyst
   * Caves y Nether Wastes son los biomas 0-2 de siempre; el resto se añade
   * detrás de las arenas (así G.Tiles.ARENA no cambia). `obj` puede ser una
   * lista: cada árbol elige una de las variantes (world.js, p.kind).
   */
  const OAK = { kind: 'tree', log: 'log_oak', leaves: 'leaves_oak_opaque#59ae30' };
  const BIRCH = { kind: 'tree', log: 'log_birch', leaves: 'leaves_birch_opaque#80a755', slim: true };
  const DARK_OAK = { kind: 'tree', shape: 'wide', log: 'log_big_oak', leaves: 'leaves_big_oak_opaque#43702a' };
  const SPRUCE = { kind: 'tree', shape: 'spruce', log: 'log_spruce', leaves: 'leaves_spruce_opaque#619961' };
  const ACACIA = { kind: 'tree', shape: 'acacia', log: 'log_acacia', leaves: 'leaves_acacia_opaque#aea42a' };
  const JUNGLE = { kind: 'tree', shape: 'tall', log: 'log_jungle', leaves: 'leaves_jungle_opaque#30bb0b', vine: 'vine#30bb0b' };
  const SWAMP_OAK = { kind: 'tree', log: 'log_oak', leaves: 'leaves_oak_opaque#6a7039', vine: 'vine#6a7039' };
  const AZALEA = { kind: 'tree', shape: 'bush', log: 'log_oak', leaves: 'azalea_leaves_flowers_opaque' };
  const AZALEA2 = { kind: 'tree', shape: 'bush', log: 'log_oak', leaves: 'azalea_leaves_opaque' };
  const RED_MUSH = { kind: 'mushroom', cap: 'mushroom_block_skin_red', stem: 'mushroom_block_skin_stem' };
  const BROWN_MUSH = { kind: 'mushroom', cap: 'mushroom_block_skin_brown', stem: 'mushroom_block_skin_stem', flat: true };
  const CACTUS = { kind: 'pillar', top: 'cactus_top', side: 'cactus_side', w: 14 };
  const SUGAR_CANE = { kind: 'stack', plant: 'reeds', n: 3 };
  const CRIMSON = { kind: 'fungus', stem: 'huge_fungus/crimson_log_side', cap: 'nether_wart_block', light: 'shroomlight' };
  const WARPED = { kind: 'fungus', stem: 'huge_fungus/warped_stem_side', cap: 'warped_wart_block', light: 'shroomlight', vines: ['#0f6a64', '#16a394'] };
  const CHORUS = { kind: 'chorus', plant: 'chorus_plant', flower: 'chorus_flower' };
  const END_SPIKE = { kind: 'tower', top: 'obsidian*1.3', side: 'obsidian' };
  const STALAGMITE = { kind: 'dripstone', n: 3 };
  const STALAGMITE2 = { kind: 'dripstone', n: 2 };
  const MINE_POST = { kind: 'pillar', top: 'log_oak_top', side: 'log_oak', w: 12, crown: 'web' };
  const LANTERN_POST = { kind: 'pillar', top: 'deepslate/polished_deepslate', side: 'deepslate/deepslate_bricks', w: 12, lantern: 'soul_lantern' };
  const CATALYST = { kind: 'pillar', top: 'sculk_catalyst_top', side: 'sculk_catalyst_side', w: 14 };
  const BERRIES = { kind: 'cluster', base: 'moss_block', plants: ['big_dripleaf_top', 'cave_vines_body_berries', 'cave_vines_head_berries'] };
  // The Ocean: kelp clumps (n segments tall) and coral heads (a coral block with its plant and two fans on top).
  const KELP = { kind: 'kelp', n: 3 };
  const KELP_SHORT = { kind: 'kelp', n: 2 };
  const CORAL = (c, f1, f2) => ({ kind: 'cluster', base: 'coral_' + c, plants: ['coral_fan_' + f1, 'coral_fan_' + f2, 'coral_plant_' + c] });
  const DEAD_CORAL = (c, f) => ({ kind: 'cluster', base: 'coral_' + c + '_dead', plants: ['coral_fan_' + f + '_dead', 'coral_fan_' + c + '_dead', 'coral_plant_' + c + '_dead'] });
  const RUIN_PILLAR = { kind: 'pillar', top: 'stonebrick_mossy', side: 'stonebrick_cracked', w: 12 };
  const SAND_PILLAR = { kind: 'pillar', top: 'sandstone_top', side: 'sandstone_carved', w: 12 };
  const PRIS_PILLAR = { kind: 'pillar', top: 'prismarine_bricks', side: 'prismarine_rough', w: 12, crown: 'sea_pickle' };
  // The Aether (Aether I mod): every 'ae_*' texture is painted procedurally (see AE_TEX). fx = falling-leaf colour (world.js).
  const SKYROOT = { kind: 'tree', log: 'ae_skyroot_log', leaves: 'ae_skyroot_leaves' };
  const SKYROOT_WIDE = { kind: 'tree', shape: 'wide', log: 'ae_skyroot_log', leaves: 'ae_skyroot_leaves' };
  const GOLDEN_OAK = { kind: 'tree', log: 'ae_golden_log', leaves: 'ae_golden_leaves', fx: '#ffd84a' };
  const GOLDEN_OAK_WIDE = { kind: 'tree', shape: 'wide', log: 'ae_golden_log', leaves: 'ae_golden_leaves', fx: '#ffe880' };
  const CRYSTAL_TREE = { kind: 'tree', shape: 'spruce', log: 'ae_skyroot_log', leaves: 'ae_crystal_fruit_leaves', fx: '#e8fcff' };
  const BERRY_BUSH = { kind: 'tree', shape: 'bush', log: 'ae_skyroot_log', leaves: 'ae_berry_leaves' };
  const AE_WALL = [{ top: 'ae_holystone', side: 'ae_holystone' }, { top: 'ae_holystone_mossy', side: 'ae_holystone_mossy', w: 0.6 },
                   { top: 'ae_ambrosium_ore', side: 'ae_ambrosium_ore', w: 0.18 }, { top: 'ae_zanite_ore', side: 'ae_zanite_ore', w: 0.12 },
                   { top: 'ae_icestone', side: 'ae_icestone', w: 0.06 }, { top: 'ae_gravitite_ore', side: 'ae_gravitite_ore', w: 0.04 }];
  /** An Aether biome theme: Aether Grass over Aether Dirt, Holystone, the sky (sky: true, see skyMC). */
  const aeTheme = (leaf, mc) => ({ floor: '#9cedb6', wall: '#cfd0cb', liquid: 'clear', liq: '#8fe0ff', foam: '#ffffff', prop: 'tree', leaf, trunk: '#8a7a5e',
    flowers: ['#ffffff', '#c088ff', '#ffe060'], grass: '#9cedb6', rock: '#cfd0cb',
    mc: Object.assign({ floor: 'ae_grass_top', patch: ['ae_grass_top', 'ae_holystone', 'ae_holystone_mossy', 'ae_grass_top'],
      decal: ['ae_white_flower', 'ae_purple_flower', 'flower_dandelion', 'flower_cornflower'], decalP: 0.08,
      wall: AE_WALL, bank: 'ae_grass_side', liq: { bed: 'ae_holystone' }, rock: 'ae_holystone', grass: ['ae_tallgrass', 'ae_purple_flower'], sky: true }, mc) });
  BIOMES[0].mc.obj = [OAK, OAK, OAK, BIRCH];

  const DIM_THEMES = {
    forest: { floor: '#79c05a', wall: '#7f7f7f', liquid: 'water', liq: '#3f76e4', prop: 'tree', leaf: '#59ae30', trunk: '#6b5132',
              flowers: ['#e8352a', '#ffffff', '#f8d43a'], grass: '#79c05a', rock: '#6a7a5a',
              mc: { floor: 'grass_top#79c05a', patch: ['dirt_podzol_top', 'coarse_dirt', 'grass_path_top'],
                    decal: ['flower_tulip_white', 'flower_rose', 'flower_dandelion', 'flower_allium', 'flower_cornflower'], decalP: 0.05,
                    wall: [{ top: 'stone', side: 'stone' }, { top: 'cobblestone_mossy', side: 'cobblestone_mossy', w: 0.4 }],
                    bank: 'dirt+grass_side#79c05a', liq: { bed: 'dirt' },
                    obj: [OAK, BIRCH, OAK, BIRCH, BIRCH], rock: 'cobblestone_mossy', grass: ['tallgrass#79c05a', 'fern#79c05a'] } },
    dark_forest: { floor: '#507a32', wall: '#6a6a6a', liquid: 'water', liq: '#3a5ac0', prop: 'tree', leaf: '#43702a', trunk: '#3e2a16',
              flowers: ['#e8352a', '#a07850', '#ffffff'], grass: '#507a32', rock: '#5a6a4a',
              mc: { floor: 'grass_top#507a32', patch: ['dirt_podzol_top', 'moss_block*0.8', 'coarse_dirt'],
                    decal: ['mushroom_red', 'mushroom_brown', 'mushroom_brown'], decalP: 0.05,
                    wall: [{ top: 'cobblestone_mossy', side: 'cobblestone_mossy' }, { top: 'stone*0.85', side: 'stone*0.85' }],
                    bank: 'dirt+grass_side#507a32', liq: { bed: 'dirt_podzol_top' },
                    obj: [DARK_OAK, DARK_OAK, DARK_OAK, DARK_OAK, RED_MUSH, BROWN_MUSH], rock: 'cobblestone_mossy',
                    grass: ['fern#507a32', 'tallgrass#507a32'] } },
    cherry_grove: ARENA_THEMES.fairy,
    savanna: { floor: '#bfb755', wall: '#8a7a6a', liquid: 'water', liq: '#3f76e4', prop: 'tree', leaf: '#aea42a', trunk: '#6a5040',
              flowers: ['#f8d43a', '#ffffff', '#e8a82a'], grass: '#bfb755', rock: '#8a7a6a',
              mc: { floor: 'grass_top#bfb755', patch: ['coarse_dirt', 'grass_path_top', 'dirt'],
                    decal: ['flower_dandelion', 'short_dry_grass'], decalP: 0.035,
                    wall: [{ top: 'stone_granite', side: 'stone_granite' }, { top: 'stone', side: 'stone', w: 0.6 }],
                    bank: 'dirt+grass_side#bfb755', liq: { bed: 'dirt' },
                    obj: [ACACIA, ACACIA, OAK], rock: 'cobblestone', grass: ['tallgrass#bfb755', 'tall_dry_grass'] } },
    desert: { floor: '#dbd3a0', wall: '#c8b27a', liquid: 'water', liq: '#3f76e4', prop: 'tree', leaf: '#5a8a2a', trunk: '#3e6a1e',
              flowers: ['#e8c87a', '#ffffff', '#c8a050'], grass: '#a07840', rock: '#c8b27a',
              mc: { floor: 'sand', patch: ['sandstone_top', 'sand*0.93', 'suspicious_sand_0'],
                    wall: [{ top: 'sandstone_top', side: 'sandstone_smooth' }, { top: 'sandstone_top*0.95', side: 'sandstone_carved', w: 0.25 }],
                    bank: 'sand', liq: { bed: 'sand' },
                    obj: CACTUS, rock: 'sandstone_top', grass: ['deadbush', 'short_dry_grass'] } },
    badlands: ARENA_THEMES.ground,
    snowy_plains: { floor: '#f0fbfb', wall: '#8a8a8a', liquid: 'ice', liq: '#9fc0f8', foam: '#ffffff', prop: 'tree', leaf: '#619961', trunk: '#4a3420',
              flowers: ['#ffffff', '#9fe0ff', '#d8f1ff'], grass: '#80b497', rock: '#8fa8c0',
              mc: { floor: 'snow', patch: ['powder_snow*0.9', 'grass_top#80b497', 'ice_packed*1.1'],
                    wall: [{ top: 'snow', side: 'grass_side_snowed' }, { top: 'stone', side: 'stone', w: 0.45 }, { top: 'ice_packed', side: 'ice_packed', w: 0.3 }],
                    bank: 'snow',
                    obj: [Object.assign({ snow: true }, SPRUCE), Object.assign({ snow: true }, SPRUCE), Object.assign({ snow: true }, OAK)],
                    rock: 'stone', grass: ['tallgrass#80b497', 'fern#80b497'] } },
    swamp: { floor: '#6a7039', wall: '#4a4a3a', liquid: 'swamp', liq: '#617b64', foam: '#9ac29a', prop: 'tree', leaf: '#6a7039', trunk: '#4f3a22',
              flowers: ['#3fa0e0', '#8bd94a', '#e8352a'], grass: '#6a7039', rock: '#5a6a4a',
              mc: { floor: 'grass_top#6a7039', patch: ['mud', 'clay*0.85', 'dirt'],
                    decal: ['flower_blue_orchid', 'mushroom_brown', 'mushroom_red'], decalP: 0.04,
                    wall: [{ top: 'cobblestone_mossy', side: 'cobblestone_mossy' }, { top: 'mud_bricks', side: 'mud_bricks', w: 0.5 }],
                    bank: 'dirt+grass_side#6a7039', liq: { bed: 'mud', pad: 'waterlily#208030' },
                    obj: SWAMP_OAK, rock: 'cobblestone_mossy', grass: ['fern#6a7039', 'tallgrass#6a7039'] } },
    jungle: { floor: '#59c93c', wall: '#5a6a4a', liquid: 'water', liq: '#3f76e4', prop: 'tree', leaf: '#30bb0b', trunk: '#5a4a2a',
              flowers: ['#f4d65c', '#ff8ad8', '#ffffff'], grass: '#59c93c', rock: '#6a7a5a',
              mc: { floor: 'grass_top#59c93c', patch: ['moss_block', 'dirt_podzol_top', 'coarse_dirt'],
                    decal: ['flower_blue_orchid', 'flower_tulip_orange'], decalP: 0.03,
                    wall: [{ top: 'cobblestone_mossy', side: 'cobblestone_mossy' }, { top: 'stonebrick_mossy', side: 'stonebrick_mossy', w: 0.4 }],
                    bank: 'dirt+grass_side#59c93c', liq: { bed: 'mud' },
                    obj: [JUNGLE, JUNGLE, Object.assign({ shape: 'bush' }, JUNGLE)], rock: 'cobblestone_mossy', grass: ['tallgrass#59c93c', 'fern#59c93c'] } },
    ocean_shore: { floor: '#dbd3a0', wall: '#5d9a8a', liquid: 'water', liq: '#3f76e4', foam: '#d8f4ff', prop: 'tree', leaf: '#59ae30', trunk: '#6b5132',
              flowers: ['#ff9ec4', '#7ef0d0', '#ffffff'], grass: '#3f8a4a', rock: '#5d9a8a',
              mc: { floor: 'sand', patch: ['gravel', 'clay', 'sand*0.92'],
                    wall: [{ top: 'prismarine_rough', side: 'prismarine_rough' }, { top: 'prismarine_bricks', side: 'prismarine_dark', w: 0.5 },
                           { top: 'sandstone_top', side: 'sandstone_smooth', w: 0.6 }],
                    bank: 'sand', liq: { strip: 'water_still_grey#3f8ee4*1.3', bed: 'sand', alpha: 0.7 },
                    obj: [SUGAR_CANE, SUGAR_CANE, ARENA_THEMES.water.mc.obj, OAK], rock: 'prismarine_rough', grass: ['seagrass', 'tallgrass#91bd59'] } },
    lush_caves: { floor: '#6a8a3a', wall: '#7a7a7a', liquid: 'water', liq: '#3f76e4', prop: 'tree', leaf: '#6a9a2a', trunk: '#6b5132',
              flowers: ['#d870c8', '#f0a040', '#ffffff'], grass: '#5f9d5a', rock: '#7b7b7b',
              mc: { floor: 'moss_block*0.78', patch: ['dirt_with_roots*0.85', 'stone*0.85', 'clay*0.85', 'moss_block*0.62'],
                    decal: ['spore_blossom', 'small_dripleaf_top', 'flower_allium'], decalP: 0.04,
                    wall: [{ top: 'moss_block*0.85', side: 'stone' }, { top: 'stone', side: 'stone', w: 0.7 }, { top: 'deepslate/cobbled_deepslate', side: 'deepslate/cobbled_deepslate', w: 0.3 }],
                    bank: 'moss_block', liq: { bed: 'clay' },
                    obj: [AZALEA, AZALEA2, AZALEA, BERRIES, BERRIES],
                    rock: 'stone', grass: ['tallgrass#5f9d5a', 'fern#5f9d5a'], deep: 0.45, topK: 0.72 } },
    // ---------------- Underworld ----------------
    dripstone_caves: { floor: '#7a7a7a', wall: '#8a6a50', liquid: 'water', liq: '#3f76e4', prop: 'crystal', leaf: '#a07858', trunk: '#6a5040',
              flowers: ['#a07858', '#c8a882', '#7a7a7a'], grass: '#8a6a50', rock: '#8a6a50',
              mc: { floor: 'stone*0.88', patch: ['dripstone_block*0.92', 'tuff', 'dripstone_block*0.82'], spots: [['gravel', 0.04], ['deepslate/deepslate_top', 0.03]],
                    wall: [{ top: 'dripstone_block', side: 'dripstone_block' }, { top: 'stone', side: 'stone', w: 0.7 }, { top: 'tuff', side: 'tuff', w: 0.4 }],
                    bank: 'stone', liq: { bed: 'gravel' }, obj: [STALAGMITE, STALAGMITE, STALAGMITE2],
                    rock: 'dripstone_block', grass: ['pointed_dripstone_up_tip', 'pointed_dripstone_up_frustum'], deep: 0.42, topK: 0.7 } },
    mineshaft: { floor: '#7a7a7a', wall: '#7a7a7a', liquid: 'water', liq: '#3f76e4', prop: 'tree', leaf: '#e8e8e8', trunk: '#6b5132',
              flowers: ['#e8e8e8', '#ffffff', '#c4d65a'], grass: '#e0e0e0', rock: '#7b7b7b',
              mc: { floor: 'stone*0.88', patch: ['gravel*0.9', 'cobblestone*0.88', 'dirt*0.9'], spots: [['coal_ore', 0.02], ['iron_ore', 0.012]],
                    wall: [{ top: 'stone', side: 'stone' }, { top: 'stone_andesite', side: 'stone_andesite', w: 0.5 }, { top: 'coal_ore', side: 'coal_ore', w: 0.25 },
                           { top: 'iron_ore', side: 'iron_ore', w: 0.15 }, { top: 'cobblestone', side: 'cobblestone', w: 0.3 }],
                    bank: 'stone', liq: { bed: 'gravel' }, obj: MINE_POST, rock: 'cobblestone', grass: ['web', 'web'], deep: 0.42, topK: 0.7 } },
    // ---------------- Stronghold ----------------
    stronghold_halls: { floor: '#6a6a6a', wall: '#7a7a7a', liquid: 'water', liq: '#3f76e4', prop: 'dead', leaf: '#6a6a6a', trunk: '#4a4a4a',
              flowers: ['#c9b28a', '#ffffff', '#a89070'], grass: '#d0d0d0', rock: '#7b7b7b',
              mc: { floor: 'stonebrick*0.78', patch: ['stonebrick_mossy*0.78', 'stonebrick_cracked*0.78', 'cobblestone*0.8'], spots: [['stonebrick_cracked*0.78', 0.06]],
                    wall: [{ top: 'stonebrick', side: 'stonebrick' }, { top: 'stonebrick_mossy', side: 'stonebrick_mossy', w: 0.6 }, { top: 'stonebrick_cracked', side: 'stonebrick_cracked', w: 0.5 }],
                    bank: 'stonebrick', liq: { bed: 'stonebrick*0.7' }, obj: ARENA_THEMES.rock.mc.obj,
                    rock: 'stonebrick_cracked', grass: ['web', 'web'], deep: 0.36, topK: 0.58 } },
    stronghold_library: { floor: '#8a6a40', wall: '#6b5132', liquid: 'water', liq: '#3f76e4', prop: 'dead', leaf: '#6b5132', trunk: '#4a3420',
              flowers: ['#c9b28a', '#ffffff', '#a89070'], grass: '#d0d0d0', rock: '#8a6a40',
              mc: { floor: 'planks_oak*0.82', patch: ['planks_big_oak*0.9', 'planks_oak*0.72'],
                    wall: [{ top: 'planks_oak', side: 'bookshelf' }, { top: 'planks_big_oak', side: 'bookshelf', w: 0.5 }],
                    bank: 'planks_oak', obj: { kind: 'pillar', top: 'planks_oak', side: 'bookshelf' },
                    rock: 'bookshelf', grass: ['web', 'web'], deep: 0.3, topK: 0.7 } },
    // ---------------- Ancient City ----------------
    ancient_city: { floor: '#3a3a44', wall: '#2a2a30', liquid: 'water', liq: '#25406a', prop: 'dead', leaf: '#0f5a6a', trunk: '#1a2a30',
              flowers: ['#2ad0e0', '#0f5a6a', '#9a8a9a'], grass: '#0f5a6a', rock: '#3a3a40',
              mc: { floor: 'deepslate/deepslate_tiles*1.1', patch: ['deepslate/polished_deepslate*1.15', 'sculk*1.25', 'deepslate/cracked_deepslate_tiles*1.1'],
                    spots: [['deepslate/chiseled_deepslate*1.1', 0.02]], decal: ['sculk_vein'], decalP: 0.06,
                    wall: [{ top: 'deepslate/deepslate_bricks*1.2', side: 'deepslate/deepslate_bricks' }, { top: 'deepslate/deepslate_tiles*1.2', side: 'deepslate/deepslate_tiles', w: 0.6 },
                           { top: 'deepslate/cracked_deepslate_bricks*1.2', side: 'deepslate/cracked_deepslate_bricks', w: 0.4 }],
                    bank: 'deepslate/polished_deepslate', liq: { strip: 'water_still_grey#25406a', bed: 'deepslate/deepslate_top' },
                    obj: LANTERN_POST, rock: 'deepslate/cobbled_deepslate', grass: ['sculk_vein', 'sculk_vein'], deep: 0.4, topK: 0.62 } },
    deep_dark: { floor: '#3e3e44', wall: '#2a2a30', liquid: 'water', liq: '#25406a', prop: 'dead', leaf: '#0f5a6a', trunk: '#1a2a30',
              flowers: ['#2ad0e0', '#0f5a6a', '#9a8a9a'], grass: '#0f5a6a', rock: '#3a3a40',
              mc: { floor: 'deepslate/deepslate_top*1.2', patch: ['sculk*1.3', 'sculk*1.15', 'deepslate/cobbled_deepslate*1.25'], spots: [['sculk*1.3', 0.07]],
                    decal: ['sculk_vein'], decalP: 0.12,
                    wall: [{ top: 'sculk*1.25', side: 'deepslate/deepslate' }, { top: 'deepslate/deepslate_top*1.2', side: 'deepslate/deepslate', w: 0.8 },
                           { top: 'deepslate/cobbled_deepslate*1.2', side: 'deepslate/cobbled_deepslate', w: 0.6 }],
                    bank: 'deepslate/deepslate_top', liq: { strip: 'water_still_grey#25406a', bed: 'deepslate/deepslate_top' },
                    obj: [CATALYST, CATALYST, ARENA_THEMES.dark.mc.obj], rock: 'deepslate/cobbled_deepslate', grass: ['sculk_vein', 'sculk_vein'], deep: 0.42, topK: 0.72 } },
    // ---------------- Nether ----------------
    crimson_forest: { floor: '#8a1e1e', wall: '#6f3333', liquid: 'lava', liq: '#e45a1f', foam: '#ffd46a', prop: 'dead', leaf: '#9a2222', trunk: '#5a1a2a',
              flowers: ['#ff5a3a', '#c83030', '#ffc45e'], grass: '#b02a2a', rock: '#6f3333',
              mc: { floor: 'crimson_nylium_top', patch: ['netherrack', 'nether_wart_block', 'netherrack*0.9'],
                    decal: ['crimson_roots', 'crimson_fungus', 'crimson_roots'], decalP: 0.08,
                    wall: [{ top: 'crimson_nylium_top', side: 'crimson_nylium_side' }, { top: 'nether_wart_block', side: 'nether_wart_block', w: 0.35 }],
                    bank: 'netherrack', obj: CRIMSON, rock: 'netherrack', grass: ['crimson_roots', 'crimson_fungus'] } },
    warped_forest: { floor: '#167e86', wall: '#3a3a4a', liquid: 'lava', liq: '#e45a1f', foam: '#ffd46a', prop: 'dead', leaf: '#16a394', trunk: '#3a2a5a',
              flowers: ['#16a394', '#5fe0e8', '#ff8a3d'], grass: '#16a394', rock: '#4a3a4a',
              mc: { floor: 'warped_nylium_top', patch: ['netherrack', 'warped_wart_block', 'netherrack*0.9'],
                    decal: ['warped_roots', 'warped_fungus', 'nether_sprouts'], decalP: 0.08,
                    wall: [{ top: 'warped_nylium_top', side: 'warped_nylium_side' }, { top: 'warped_wart_block', side: 'warped_wart_block', w: 0.35 }],
                    bank: 'netherrack', obj: WARPED, rock: 'netherrack', grass: ['warped_roots', 'nether_sprouts'] } },
    soul_sand_valley: { floor: '#4a382c', wall: '#4a4a52', liquid: 'lava', liq: '#e45a1f', foam: '#ffd46a', prop: 'dead', leaf: '#dcd8c0', trunk: '#4a4a52',
              flowers: ['#5fe0e8', '#9a8ad0', '#c9cfdc'], grass: '#5fe0e8', rock: '#2e2a33',
              mc: { floor: 'soul_soil', patch: ['soul_sand', 'soul_sand*0.9'], spots: [['bone_block_top', 0.006]],
                    wall: [{ top: 'basalt_top', side: 'basalt_side' }, { top: 'bone_block_top', side: 'bone_block_side', w: 0.35 }],
                    bank: 'soul_soil', obj: ARENA_THEMES.ghost.mc.obj, rock: 'blackstone', grass: ['nether_sprouts', 'nether_sprouts'] } },
    basalt_deltas: { floor: '#4a4a52', wall: '#2e2a33', liquid: 'lava', liq: '#e45a1f', foam: '#ffd46a', prop: 'dead', leaf: '#4a4652', trunk: '#2e2a33',
              flowers: ['#ff8d3d', '#ffc45e', '#e06a4a'], grass: '#5a5a62', rock: '#2e2a33',
              mc: { floor: 'basalt_top', patch: ['blackstone_top', 'smooth_basalt', 'blackstone_top*0.9'], spots: [['magma', 0.035]],
                    wall: [{ top: 'basalt_top*1.1', side: 'basalt_side' }, { top: 'polished_basalt_top', side: 'polished_basalt_side', w: 0.4 },
                           { top: 'blackstone_top', side: 'blackstone', w: 0.4 }],
                    bank: 'basalt_side', obj: { kind: 'pillar', top: 'basalt_top', side: 'basalt_side', w: 12 },
                    rock: 'blackstone', grass: ['nether_sprouts', 'nether_sprouts'] } },
    nether_fortress: { floor: '#2c1519', wall: '#2c1519', liquid: 'lava', liq: '#e45a1f', foam: '#ffd46a', prop: 'dead', leaf: '#9a2222', trunk: '#2c1519',
              flowers: ['#ff8d3d', '#ffc45e', '#e06a4a'], grass: '#8a1a1a', rock: '#3a2a2a',
              mc: { floor: 'nether_brick', patch: ['soul_sand', 'cracked_nether_bricks', 'red_nether_brick'], spots: [['chiseled_nether_bricks', 0.02]],
                    wall: [{ top: 'nether_brick*1.25', side: 'nether_brick' }, { top: 'red_nether_brick', side: 'red_nether_brick', w: 0.25 }],
                    bank: 'nether_brick',
                    obj: [{ kind: 'pillar', top: 'nether_brick*1.25', side: 'nether_brick', crown: 'mob_spawner' },
                          { kind: 'pillar', top: 'nether_brick*1.25', side: 'chiseled_nether_bricks', crown: 'soul_lantern' }],
                    rock: 'nether_brick*1.2', grass: ['nether_wart_stage_2', 'nether_wart_stage_1'] } },
    // ---------------- The End ----------------
    the_end: { floor: '#dbde9e', wall: '#1a1028', liquid: 'water', liq: '#7a5ad0', prop: 'crystal', leaf: '#9a6cff', trunk: '#1a1028',
              flowers: ['#9a6cff', '#ffd23f', '#ffffff'], grass: '#8a5a9a', rock: '#cfd29a',
              mc: { floor: 'end_stone', patch: ['end_stone*0.9', 'end_stone*0.84'], spots: [['end_stone*1.06', 0.08]],
                    wall: [{ top: 'obsidian*1.3', side: 'obsidian' }, { top: 'end_stone', side: 'end_stone', w: 0.7 }, { top: 'crying_obsidian', side: 'obsidian', w: 0.15 }],
                    bank: 'end_stone', obj: END_SPIKE, rock: 'end_stone', grass: ['chorus_flower', 'chorus_flower'] } },
    end_highlands: { floor: '#dbde9e', wall: '#cfd29a', liquid: 'water', liq: '#7a5ad0', prop: 'tree', leaf: '#a77aa7', trunk: '#7a527a',
              flowers: ['#c9a6ff', '#ffffff', '#a77aa7'], grass: '#8a5a9a', rock: '#cfd29a',
              mc: { floor: 'end_stone', patch: ['end_stone*0.88', 'end_stone*0.94'],
                    wall: [{ top: 'end_stone*1.05', side: 'end_stone' }, { top: 'obsidian*1.3', side: 'obsidian', w: 0.25 }],
                    bank: 'end_stone', obj: CHORUS, rock: 'end_stone', grass: ['chorus_flower', 'chorus_flower_dead'] } },
    end_city: { floor: '#dbde9e', wall: '#a77aa7', liquid: 'water', liq: '#7a5ad0', prop: 'crystal', leaf: '#a77aa7', trunk: '#7a527a',
              flowers: ['#c9a6ff', '#ffffff', '#a77aa7'], grass: '#8a5a9a', rock: '#cfd29a',
              mc: { floor: 'end_stone', patch: ['purpur_block', 'end_bricks', 'purpur_pillar_top'],
                    wall: [{ top: 'purpur_block', side: 'purpur_block' }, { top: 'purpur_pillar_top', side: 'purpur_pillar' }, { top: 'end_bricks', side: 'end_bricks', w: 0.5 }],
                    bank: 'end_stone',
                    obj: [ARENA_THEMES.psychic.mc.obj, CHORUS, ARENA_THEMES.psychic.mc.obj], rock: 'end_stone', grass: ['chorus_flower', 'chorus_flower'] } },
    // ---------------- The Ocean (the seabed, under water) ----------------
    // tint: [colour, amount, brightness]: every pixel of the tile (and of its props) is darkened and mixed with
    // the water colour, so the seabed reads as seen through water. Pools are 'deep' water (trenches, holes).
    kelp_forest: { floor: '#c8bf8a', wall: '#7a7a7a', liquid: 'deep', liq: '#2a5f9e', foam: '#6ab4c8', prop: 'tree', leaf: '#5a8a2a', trunk: '#3e6a1e',
              flowers: ['#7ef0d0', '#5a8a2a', '#c8ff8a'], grass: '#3f8a4a', rock: '#7a7a7a',
              mc: { floor: 'sand', patch: ['gravel', 'clay', 'dirt', 'mud*0.9'], spots: [['gravel', 0.04], ['clay', 0.02]],
                    decal: ['seagrass', 'seagrass', 'coral_fan_yellow'], decalP: 0.07,
                    wall: [{ top: 'stone', side: 'stone' }, { top: 'gravel', side: 'gravel', w: 0.6 }, { top: 'stone_andesite', side: 'stone_andesite', w: 0.4 }],
                    bank: 'sand', liq: { bed: 'gravel*0.55' },
                    obj: [KELP, KELP, KELP_SHORT], rock: 'cobblestone_mossy', grass: ['seagrass', 'seagrass_doubletall_top_a'],
                    tint: ['#1f7f95', 0.2, 0.94] } },
    coral_reef: { floor: '#dbd3a0', wall: '#c84a8a', liquid: 'deep', liq: '#2a6fae', foam: '#7fd0e0', prop: 'crystal', leaf: '#e05aa0', trunk: '#3a5ad0',
              flowers: ['#ff6ab0', '#ffd23f', '#5a8aff'], grass: '#3f8a4a', rock: '#d0c040',
              mc: { floor: 'sand', patch: ['sand*0.9', 'gravel', 'sand*1.06'], spots: [['coral_blue_dead*0.9', 0.008], ['coral_yellow_dead*0.9', 0.006]],
                    decal: ['coral_fan_blue', 'coral_fan_pink', 'coral_fan_red', 'coral_fan_yellow', 'coral_fan_purple', 'coral_plant_pink',
                            'coral_plant_yellow', 'seagrass'], decalP: 0.16,
                    wall: [{ top: 'coral_blue', side: 'coral_blue' }, { top: 'coral_pink', side: 'coral_pink' }, { top: 'coral_purple', side: 'coral_purple' },
                           { top: 'coral_red', side: 'coral_red' }, { top: 'coral_yellow', side: 'coral_yellow' },
                           { top: 'coral_purple_dead', side: 'coral_purple_dead', w: 0.15 }],
                    bank: 'sand', liq: { bed: 'sand*0.6' },
                    obj: [CORAL('pink', 'yellow', 'blue'), CORAL('blue', 'red', 'pink'), CORAL('purple', 'yellow', 'pink'),
                          CORAL('red', 'blue', 'yellow'), CORAL('yellow', 'purple', 'red'), DEAD_CORAL('blue', 'pink')],
                    rock: 'coral_yellow', grass: ['seagrass', 'coral_plant_red'], tint: ['#2a8aa8', 0.13, 1] } },
    ocean_ruins: { floor: '#c8bf8a', wall: '#7a7a7a', liquid: 'deep', liq: '#2a5f9e', foam: '#6ab4c8', prop: 'dead', leaf: '#5a8a2a', trunk: '#7a7a7a',
              flowers: ['#7ef0d0', '#5a8a2a', '#c8ff8a'], grass: '#3f8a4a', rock: '#7a7a7a',
              mc: { floor: 'sand', patch: ['gravel', 'suspicious_sand_0', 'clay', 'sand*0.9'], spots: [['gravel', 0.05]],
                    decal: ['seagrass', 'seagrass', 'coral_fan_blue_dead'], decalP: 0.05,
                    wall: [{ top: 'stone', side: 'stone' }, { top: 'gravel', side: 'gravel', w: 0.5 }, { top: 'cobblestone_mossy', side: 'cobblestone_mossy', w: 0.4 }],
                    bank: 'sand', liq: { bed: 'gravel*0.55' },
                    obj: [RUIN_PILLAR, SAND_PILLAR, KELP_SHORT, KELP], rock: 'stonebrick_mossy', grass: ['seagrass', 'seagrass_doubletall_top_a'],
                    tint: ['#1d7088', 0.2, 0.92] } },
    deep_ocean: { floor: '#5a5a5a', wall: '#3a3a40', liquid: 'deep', liq: '#14365e', foam: '#3a7a9a', prop: 'dead', leaf: '#3a5a3a', trunk: '#3a3a40',
              flowers: ['#3a7a9a', '#5a8a7a', '#9effa0'], grass: '#2f5a4a', rock: '#3a3a40',
              mc: { floor: 'gravel*0.85', patch: ['deepslate/deepslate_top', 'prismarine_dark*0.9', 'clay*0.75', 'gravel*0.7'], spots: [['deepslate/cobbled_deepslate', 0.03]],
                    decal: ['seagrass*0.8', 'glow_lichen'], decalP: 0.03,
                    wall: [{ top: 'deepslate/cobbled_deepslate', side: 'deepslate/deepslate' }, { top: 'prismarine_dark', side: 'prismarine_dark', w: 0.4 },
                           { top: 'stone*0.8', side: 'stone*0.8', w: 0.5 }],
                    bank: 'gravel', liq: { strip: 'water_still_grey#1c4a86', alpha: 0.82, bed: 'deepslate/deepslate_top*0.4' },
                    obj: [KELP_SHORT, DEAD_CORAL('blue', 'purple'), DEAD_CORAL('red', 'yellow')], rock: 'deepslate/cobbled_deepslate',
                    grass: ['seagrass*0.8', 'seagrass_doubletall_top_a*0.8'], tint: ['#0e3a5c', 0.3, 0.74], deep: 0.6, topK: 0.9 } },
    ocean_monument: { floor: '#c8bf8a', wall: '#3a6a5e', liquid: 'deep', liq: '#1f4f86', foam: '#6ab4c8', prop: 'crystal', leaf: '#63a796', trunk: '#2a5a50',
              flowers: ['#7ef0d0', '#bfeaff', '#ffffff'], grass: '#3f8a4a', rock: '#5d9a8a',
              mc: { floor: 'sand*0.95', patch: ['gravel', 'clay*0.9', 'sand*0.86'], spots: [['gravel', 0.04]],
                    decal: ['seagrass'], decalP: 0.04,
                    wall: [{ top: 'prismarine_rough', side: 'prismarine_rough' }, { top: 'stone*0.85', side: 'stone*0.85', w: 0.6 }],
                    bank: 'sand', liq: { bed: 'gravel*0.5' },
                    obj: [PRIS_PILLAR, KELP_SHORT, KELP], rock: 'prismarine_rough', grass: ['seagrass', 'seagrass'],
                    tint: ['#16607a', 0.22, 0.86], deep: 0.55, topK: 1 } },
    // ---------------- The Aether (sky islands; the sky between them is the 'void': see skyMC) ----------------
    aether_meadow: aeTheme('#8ee86e', { obj: [SKYROOT, SKYROOT, BERRY_BUSH, SKYROOT_WIDE, SKYROOT],
      decal: ['ae_white_flower', 'ae_purple_flower', 'flower_dandelion', 'flower_cornflower', 'ae_white_flower', 'ae_purple_flower'], decalP: 0.11 }),
    skyroot_forest: aeTheme('#72d25a', { obj: [SKYROOT, SKYROOT_WIDE, SKYROOT, CRYSTAL_TREE, BERRY_BUSH, SKYROOT],
      patch: ['ae_holystone_mossy', 'ae_grass_top', 'ae_holystone', 'ae_holystone_mossy'], decalP: 0.06 }),
    golden_grove: aeTheme('#ffdc5a', { obj: [GOLDEN_OAK, GOLDEN_OAK_WIDE, GOLDEN_OAK, SKYROOT],
      patch: ['ae_grass_top+ae_golden_petals', 'ae_holystone', 'ae_grass_top+ae_golden_petals'], decal: ['ae_golden_petals', 'ae_golden_petals', 'flower_dandelion', 'ae_white_flower'],
      decalP: 0.16, grass: ['ae_tallgrass', 'flower_dandelion'] }),
    cloud_sea: aeTheme('#8ee86e', { obj: [BERRY_BUSH, SKYROOT, BERRY_BUSH], patch: ['ae_grass_top', 'ae_holystone', 'ae_grass_top'], decalP: 0.06 }),
    rainbow_falls: aeTheme('#9edcf2', { obj: [CRYSTAL_TREE, SKYROOT, CRYSTAL_TREE, BERRY_BUSH],
      patch: ['ae_holystone', 'ae_icestone', 'ae_holystone_mossy', 'ae_grass_top'], decalP: 0.1,
      decal: ['ae_white_flower', 'ae_purple_flower', 'flower_cornflower', 'flower_blue_orchid', 'ae_white_flower'] })
  };
  // Clave de bioma -> índice en BIOMES. Los tres de siempre se reutilizan.
  const KEY_INDEX = { plains: 0, amethyst_caves: 1, nether_wastes: 2 };
  const BIOME_DEFS = G.BIOME_DEFS || {};
  for (const key of Object.keys(BIOME_DEFS)) {
    if (KEY_INDEX[key] != null) continue;
    const th = DIM_THEMES[key] || DIM_THEMES.forest;
    KEY_INDEX[key] = BIOMES.length;
    BIOMES.push(arenaBiome(th));
  }
  for (const key in KEY_INDEX) {
    const B = BIOMES[KEY_INDEX[key]];
    B.key = key;
    if (BIOME_DEFS[key]) B.name = BIOME_DEFS[key].name;
    B.dim = BIOME_DEFS[key] ? BIOME_DEFS[key].dim : 'overworld';
  }
  // Las arenas también llevan su clave (p. ej. 'arena:fire'), para depurar.
  ARENA_TYPES.forEach((t, i) => { BIOMES[ARENA + i].key = 'arena:' + t; });

  // ---------------- variantes de bioma ----------------
  /*
   * Misma clave (biomeKeyAt, spawns, música no cambian), otro aspecto. world.js
   * pinta con ellas tiles sueltos o una dimensión entera (biomeIndex(key, tag)):
   *   lava       los charcos de ese tile son lava (cuevas, sala del portal)
   *   herobrine  la superficie del último piso: hierba gris y oscura, sin flores,
   *              árboles muertos y robles pálidos
   */
  const VARIANT = {};
  function addVariant(key, tag, fn) {
    const base = BIOMES[KEY_INDEX[key]];
    if (!base) return;
    const B = Object.assign({}, base, { mc: Object.assign({}, base.mc) });
    fn(B);
    VARIANT[key + '/' + tag] = BIOMES.length;
    BIOMES.push(B);
  }
  for (const k of ['dripstone_caves', 'mineshaft', 'amethyst_caves', 'lush_caves', 'stronghold_halls', 'stronghold_library', 'deep_dark', 'ancient_city'])
    addVariant(k, 'lava', B => { B.liquid = 'lava'; B.liq = '#e45a1f'; B.liqDeep = '#b9401a'; B.foam = '#ffd46a'; B.mc.liq = null; });
  // Under the sea the "lava" pools are magma vents (magma blocks under a bubble column: they burn).
  for (const k of ['kelp_forest', 'coral_reef', 'ocean_ruins', 'deep_ocean', 'ocean_monument'])
    addVariant(k, 'lava', B => { B.liquid = 'magma'; B.liq = '#c8501a'; B.liqDeep = '#8a3010'; B.foam = '#bfe8ff'; B.mc.liq = null; });

  /** Tinte gris y oscuro (y brillo más bajo) para cada capa de una especificación. */
  function creepSpec(spec) {
    return spec.split('+').map(s => {
      const m = /^([^#*!]+)(!)?(?:#([0-9a-fA-F]{6}))?(?:\*([\d.]+))?$/.exec(s);
      if (!m) return s;
      let out = m[1] + (m[2] || '');
      if (m[3]) {
        const [r, g, b] = rgb('#' + m[3]), l = r * 0.3 + g * 0.59 + b * 0.11;
        const c = [r, g, b].map(v => Math.round((v + (l - v) * 0.62) * 0.74));
        out += '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
      }
      return out + '*' + ((m[4] ? +m[4] : 1) * (m[3] ? 1 : 0.8)).toFixed(2);
    }).join('+');
  }
  const DEAD_TREE = log => ({ kind: 'dead', log });
  const PALE_OAK = { kind: 'tree', shape: 'wide', log: 'pale_oak_log_side', leaves: 'pale_oak_leaves_opaque' };
  function creepObj(o) {
    if (o.kind === 'mushroom') return Object.assign({}, o, { cap: creepSpec(o.cap) });
    if (o.kind !== 'tree') return o;
    const c = Object.assign({}, o, { leaves: creepSpec(o.leaves) });
    if (o.vine) c.vine = creepSpec(o.vine);
    return c;
  }
  const SURFACE = ['plains', 'forest', 'dark_forest', 'cherry_grove', 'savanna', 'desert', 'badlands', 'snowy_plains', 'swamp', 'jungle', 'ocean_shore'];
  for (const k of SURFACE) addVariant(k, 'herobrine', B => {
    const M = B.mc, objs = [].concat(M.obj).map(creepObj), tree = objs.find(o => o.kind === 'tree');
    const log = tree ? tree.log : 'log_oak';
    M.floor = creepSpec(M.floor); M.bank = creepSpec(M.bank); M.rock = creepSpec(M.rock);
    M.patch = M.patch.map(creepSpec).concat(['coarse_dirt*0.7']);
    M.wall = M.wall.map(w => Object.assign({}, w, { top: creepSpec(w.top), side: creepSpec(w.side) }));
    M.decal = ['deadbush', 'deadbush', 'short_dry_grass*0.7']; M.decalP = 0.03;
    M.spots = [['soul_soil*0.8', 0.012]];
    M.grass = ['deadbush', creepSpec(M.grass[0])];
    // Árboles muertos entre los de siempre (sin hojas vivas) y robles pálidos en los bosques.
    M.obj = objs.concat([DEAD_TREE(log), DEAD_TREE(log)], k === 'dark_forest' || k === 'forest' ? [PALE_OAK, PALE_OAK] : []);
    if (B.liquid === 'water' || B.liquid === 'swamp')
      M.liq = Object.assign({}, M.liq, { strip: 'water_still_grey#2c3c5a*1.1', alpha: 0.85, pad: null });
  });

  // ---------------- bloques de estructura ----------------
  /*
   * world.js puede pedir, tile a tile, otro bloque que el del bioma (estructuras:
   * fortaleza, ciudad antigua, mina, geodas, torres del End...). Cada entrada:
   *   floor  suelo (con spots [[bloque, prob]]) · over  capa encima (raíles), ori su orientación
   *   stairs escalones (bandas de luz y sombra) · wall  lista de paredes como mc.wall
   * Los índices (BLOCK[nombre]) empiezan en 1; 0 = el bloque normal del bioma.
   */
  const BLOCK_LIST = [
    ['planks', { floor: 'planks_oak*0.9', spots: [['planks_big_oak*0.9', 0.12]] }],
    ['rail_ns', { floor: 'planks_oak*0.9', over: 'rail', ori: 0 }],
    ['rail_ew', { floor: 'planks_oak*0.9', over: 'rail', ori: 4 }],
    ['basalt_w', { topK: 0.95, wall: [{ top: 'smooth_basalt', side: 'smooth_basalt' }] }],
    ['calcite_w', { topK: 1, wall: [{ top: 'calcite', side: 'calcite' }] }],
    ['amethyst_w', { topK: 1.05, wall: [{ top: 'amethyst_block', side: 'amethyst_block' }, { top: 'budding_amethyst', side: 'budding_amethyst', w: 0.6 }] }],
    ['amethyst_f', { floor: 'amethyst_block*0.8', spots: [['budding_amethyst*0.8', 0.14]] }],
    ['tuff_f', { floor: 'tuff' }],
    ['obsidian_w', { wall: [{ top: 'obsidian*1.3', side: 'obsidian' }] }],
    ['sb_floor', { floor: 'stonebrick*0.86', spots: [['stonebrick_mossy*0.86', 0.18], ['stonebrick_cracked*0.86', 0.14]] }],
    ['sb_raised', { floor: 'stonebrick*1.02', spots: [['stonebrick_mossy*1.02', 0.15]] }],
    ['sb_pillar', { topK: 0.85, wall: [{ top: 'stonebrick_carved*1.05', side: 'stonebrick_carved' }] }],
    ['stairs', { floor: 'stonebrick', stairs: true }],
    ['frame', { floor: 'endframe_top' }],
    ['frame_corner', { floor: 'stonebrick*1.02' }],
    ['pit', { floor: 'end_portal*0.18' }],
    ['deep_path', { floor: 'deepslate/polished_deepslate*1.2' }],
    ['deep_tiles', { floor: 'deepslate/deepslate_tiles*1.08', spots: [['deepslate/cracked_deepslate_tiles*1.08', 0.14], ['deepslate/chiseled_deepslate*1.08', 0.03]] }],
    ['sculk_f', { floor: 'sculk*1.25', spots: [['sculk_catalyst_top*1.1', 0.01]] }],
    ['deep_bricks_w', { wall: [{ top: 'deepslate/deepslate_bricks*1.2', side: 'deepslate/deepslate_bricks' },
                               { top: 'deepslate/cracked_deepslate_bricks*1.2', side: 'deepslate/cracked_deepslate_bricks', w: 0.4 }] }],
    ['deep_tiles_w', { wall: [{ top: 'deepslate/deepslate_tiles*1.2', side: 'deepslate/deepslate_tiles' }] }],
    ['reinforced_w', { topK: 0.95, wall: [{ top: 'reinforced_deepslate_top', side: 'reinforced_deepslate_side' }] }],
    ['bookshelf_w', { wall: [{ top: 'planks_oak', side: 'bookshelf' }] }],
    ['netherrack', { floor: 'netherrack*0.75', spots: [['magma*0.8', 0.04]] }],
    ['soul_sand', { floor: 'soul_sand*0.8' }],
    ['soul_soil', { floor: 'soul_soil*0.8' }],
    ['water_rim', { floor: 'stonebrick_carved*0.95' }],
    ['end_floor', { floor: 'end_stone', spots: [['end_stone*0.92', 0.3]] }],
    // The Ocean: the Ocean Monument, ocean ruins, shipwrecks and magma vents.
    ['pris_f', { floor: 'prismarine_dark*0.95', spots: [['prismarine_dark*0.8', 0.12]] }],
    ['pris_band_f', { floor: 'prismarine_bricks*0.62', spots: [['prismarine_rough*0.6', 0.12]] }],
    ['wing_f', { floor: 'prismarine_dark*0.9', spots: [['sponge_wet*0.62', 0.07], ['prismarine_dark*0.75', 0.12]] }],
    ['lantern_f', { floor: 'sea_lantern' }],
    ['gold_f', { floor: 'gold_block' }],
    ['pris_w', { topK: 1.2, wall: [{ top: 'prismarine_bricks', side: 'prismarine_bricks' }, { top: 'prismarine_rough', side: 'prismarine_rough', w: 0.35 }] }],
    ['pris_dark_w', { topK: 1.05, wall: [{ top: 'prismarine_rough', side: 'prismarine_dark' }] }],
    ['pris_lamp_w', { topK: 1, wall: [{ top: 'sea_lantern', side: 'prismarine_dark' }] }],
    ['sponge_w', { topK: 1.1, wall: [{ top: 'sponge_wet', side: 'sponge_wet' }] }],
    ['ruin_sb_w', { topK: 1.18, wall: [{ top: 'stonebrick', side: 'stonebrick' }, { top: 'stonebrick_mossy', side: 'stonebrick_mossy' },
                           { top: 'stonebrick_cracked', side: 'stonebrick_cracked', w: 0.7 }] }],
    ['ruin_ss_w', { topK: 1.12, wall: [{ top: 'sandstone_top', side: 'sandstone_smooth' }, { top: 'sandstone_top', side: 'sandstone_carved', w: 0.4 }] }],
    ['ruin_sb_f', { floor: 'stonebrick*0.6', spots: [['stonebrick_mossy*0.6', 0.2], ['stonebrick_cracked*0.6', 0.15], ['gravel*0.8', 0.1], ['suspicious_gravel_0*0.8', 0.06]] }],
    ['ruin_ss_f', { floor: 'sandstone_top*0.66', spots: [['sand*0.8', 0.2], ['suspicious_sand_0*0.8', 0.08], ['sandstone_carved*0.66', 0.04]] }],
    ['hull_oak_w', { topK: 1.15, wall: [{ top: 'planks_oak', side: 'planks_oak' }, { top: 'log_oak_top', side: 'log_oak', w: 0.3 }] }],
    ['hull_spruce_w', { topK: 1.2, wall: [{ top: 'planks_spruce', side: 'planks_spruce' }, { top: 'log_spruce_top', side: 'log_spruce', w: 0.3 }] }],
    ['deck_oak', { floor: 'planks_oak*0.58', spots: [['planks_oak*0.48', 0.14]] }],
    ['deck_spruce', { floor: 'planks_spruce*0.62', spots: [['planks_spruce*0.5', 0.14]] }],
    ['mast', { floor: 'log_spruce_top' }],
    ['vent_rim', { floor: 'deepslate/cobbled_deepslate*0.9', spots: [['obsidian*1.2', 0.25], ['magma', 0.12]] }],
    // The Aether: Aerclouds (cloud: 1 cold, 2 blue = bounce pad, 3 gold), Quicksoil coasts, Icestone, the dungeons' stone.
    ['ae_cloud', { floor: 'ae_aercloud', cloud: 1 }],
    ['ae_cloud_blue', { floor: 'ae_aercloud_blue', cloud: 2 }],
    ['ae_cloud_gold', { floor: 'ae_aercloud_gold', cloud: 3 }],
    ['ae_quicksoil', { floor: 'ae_quicksoil' }],
    ['ae_icestone_f', { floor: 'ae_icestone' }],
    ['ae_brick_f', { floor: 'ae_holystone_brick', spots: [['ae_holystone_mossy', 0.05]] }],
    ['ae_trim_f', { floor: 'ae_angelic_trim' }],
    ['ae_angelic_f', { floor: 'ae_angelic_stone' }],
    ['ae_carved_f', { floor: 'ae_carved_stone', spots: [['ae_holystone_mossy', 0.22], ['ae_holystone', 0.1]] }],
    ['ae_gold_grass', { floor: 'ae_grass_top+ae_golden_petals', spots: [['ae_grass_top', 0.3]] }],
    ['ae_hellfire_f', { floor: 'ae_hellfire_stone' }],
    ['ae_silver_w', { topK: 1, wall: [{ top: 'ae_angelic_stone', side: 'ae_angelic_trim' }] }],
    ['ae_bronze_w', { topK: 1, wall: [{ top: 'ae_holystone_mossy', side: 'ae_carved_stone' }] }],
    ['ae_gold_w', { topK: 1, wall: [{ top: 'ae_hellfire_stone', side: 'ae_hellfire_stone' }] }]
  ];
  const BLOCKS = [null], BLOCK = {};
  for (const [k, d] of BLOCK_LIST) { BLOCK[k] = BLOCKS.length; BLOCKS.push(d); }

  // ---------------- utilidades de color / píxel ----------------

  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // Empaquetado ABGR (little-endian) para escribir de golpe en un Uint32Array.
  function pack(hex, a = 255) {
    const [r, g, b] = rgb(hex);
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  /** Mezcla dos colores hex y devuelve el empaquetado. */
  function mixPack(h1, h2, t) {
    const a = rgb(h1), b = rgb(h2);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
  }

  /** Lienzo de píxeles: set(x,y,color) y canvas() al final. */
  function Pix(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    const img = c.createImageData(w, h);
    const buf = new Uint32Array(img.data.buffer);
    return {
      w, h, buf,
      set(x, y, col) { if (x >= 0 && y >= 0 && x < w && y < h) buf[y * w + x] = col; },
      get(x, y) { return buf[y * w + x]; },
      canvas() { c.putImageData(img, 0, 0); return cv; }
    };
  }

  const H = (x, y, s) => G.U.hash(x, y, s);

  // ---------------- texturas de Minecraft ----------------
  /*
   * Las texturas (16×16, assets/mc/) se cargan una vez como imágenes y se leen
   * sus píxeles (getImageData) a un Uint32Array: hornear un chunk es copiar
   * píxeles, igual de síncrono que el pintado procedural. Hasta que han llegado
   * todas se pinta lo procedural de siempre; al estar listas se avisa
   * (onReady) para que world.js vuelva a hornear los chunks.
   */
  const texData = new Map();          // nombre -> { w, h, px } | null (falló)
  const texCache = new Map();         // "spec@frame" -> Uint32Array(256)
  const stripCache = new Map();       // spec -> canvas con todos los fotogramas
  const readyFns = [];
  let texPending = 0, texReady = false;

  // Lisas o de ruido: se pueden girar; las demás (ladrillos...) sólo se espejan.
  const ROT = new Set(['grass_top', 'dirt', 'coarse_dirt', 'gravel', 'stone', 'netherrack', 'soul_sand', 'soul_soil',
    'sand', 'red_sand', 'snow', 'powder_snow', 'end_stone', 'moss_block', 'mud', 'clay', 'magma', 'bedrock', 'obsidian',
    'crying_obsidian', 'blackstone_top', 'basalt_top', 'deepslate/deepslate_top', 'tuff', 'sculk', 'ice', 'ice_packed',
    'dirt_podzol_top', 'grass_path_top', 'cobblestone', 'cobblestone_mossy', 'deepslate/cobbled_deepslate', 'stone_andesite',
    'stone_andesite_smooth', 'polished_tuff', 'stone_slab_top', 'prismarine_rough', 'hardened_clay', 'nether_wart_block',
    'hardened_clay_stained_orange', 'hardened_clay_stained_yellow', 'red_sandstone_top', 'sea_lantern', 'crimson_nylium_top',
    'warped_nylium_top', 'smooth_basalt', 'dirt_with_roots', 'warped_wart_block', 'sandstone_top', 'suspicious_sand_0', 'end_portal',
    'coral_blue', 'coral_pink', 'coral_purple', 'coral_red', 'coral_yellow', 'coral_blue_dead', 'coral_purple_dead', 'coral_yellow_dead',
    'sponge_wet', 'suspicious_gravel_0', 'ae_grass_top', 'ae_dirt', 'ae_holystone', 'ae_holystone_mossy', 'ae_quicksoil', 'ae_icestone',
    'ae_aercloud', 'ae_aercloud_blue', 'ae_aercloud_gold', 'ae_ambrosium_ore', 'ae_zanite_ore', 'ae_gravitite_ore', 'ae_hellfire_stone']);

  const SPEC_RE = /^([^#*!]+)(!)?(?:#([0-9a-fA-F]{6}))?(?:\*([\d.]+))?$/;
  function parseSpec(spec) {
    return spec.split('+').map(s => {
      const m = SPEC_RE.exec(s) || [s, s];
      return { name: m[1], desat: !!m[2], tint: m[3] ? rgb('#' + m[3]) : null, k: m[4] ? +m[4] : 1 };
    });
  }
  const baseName = spec => parseSpec(spec)[0].name;

  function loadTex(name) {
    if (texData.has(name)) return;
    texData.set(name, undefined);
    texPending++;
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        const c = cv.getContext('2d');
        c.drawImage(img, 0, 0);
        const d = c.getImageData(0, 0, img.width, img.height);
        texData.set(name, { w: img.width, h: img.height, px: new Uint32Array(d.data.buffer) });
      } catch (e) { texData.set(name, null); }
      texDone();
    };
    img.onerror = () => { texData.set(name, null); console.warn('[tiles] missing texture', name); texDone(); };
    img.src = 'assets/mc/' + (name.startsWith('environment/') || name.startsWith('items/') ? '' : 'blocks/') + name + '.png';
  }
  function texDone() {
    if (--texPending > 0 || texReady) return;
    texReady = true;
    texCache.clear(); stripCache.clear(); propCache.clear();
    for (const f of readyFns) f();
  }

  // Empaquetado ABGR: multiplicar el brillo y componer con alfa.
  function mul(s, k) {
    if (k === 1) return s;
    const r = Math.min(255, (s & 255) * k) | 0, g = Math.min(255, ((s >>> 8) & 255) * k) | 0, b = Math.min(255, ((s >>> 16) & 255) * k) | 0;
    return ((s & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0;
  }
  function over(d, s) {
    const a = s >>> 24;
    if (a === 255 || (d >>> 24) === 0) return a ? s : d;
    if (a === 0) return d;
    const t = a / 255, u = 1 - t;
    const r = ((s & 255) * t + (d & 255) * u) | 0, g = (((s >>> 8) & 255) * t + ((d >>> 8) & 255) * u) | 0,
          b = (((s >>> 16) & 255) * t + ((d >>> 16) & 255) * u) | 0;
    return ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  function blendCol(d, col, t) {
    const u = 1 - t;
    const r = ((col & 255) * t + (d & 255) * u) | 0, g = (((col >>> 8) & 255) * t + ((d >>> 8) & 255) * u) | 0,
          b = (((col >>> 16) & 255) * t + ((d >>> 16) & 255) * u) | 0;
    return ((d & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0;
  }

  /** Fotograma f (16×16) de una especificación, ya teñido y compuesto. null si aún no hay texturas. */
  function texFrame(spec, f = 0) {
    if (!texReady) return null;
    const key = spec + '@' + f;
    let out = texCache.get(key);
    if (out) return out;
    if (spec === 'rail') return railTex();
    out = new Uint32Array(256);
    for (const L of parseSpec(spec)) {
      const td = texData.get(L.name);
      for (let i = 0; i < 256; i++) {
        let s;
        if (!td) s = 0xff808080;
        else {
          const frames = Math.max(1, (td.h / 16) | 0), y = ((f % frames) * 16) + (i >> 4);
          s = td.px[y * td.w + (i & 15)];
        }
        if (!(s >>> 24)) continue;
        let r = s & 255, g = (s >>> 8) & 255, b = (s >>> 16) & 255;
        if (L.desat) r = g = b = (r * 0.3 + g * 0.59 + b * 0.11);
        if (L.tint) { r = r * L.tint[0] / 255; g = g * L.tint[1] / 255; b = b * L.tint[2] / 255; }
        r = Math.min(255, r * L.k) | 0; g = Math.min(255, g * L.k) | 0; b = Math.min(255, b * L.k) | 0;
        out[i] = over(out[i], ((s & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0);
      }
    }
    texCache.set(key, out);
    return out;
  }

  /**
   * Raíl normal (Bedrock sólo trae el girado): el propulsor sin energía con los
   * carriles de oro en gris hierro y sin la línea de redstone.
   */
  function railTex() {
    const src = texFrame('rail_golden'), out = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const s = src[i];
      if (!(s >>> 24)) continue;
      const r = s & 255, g = (s >>> 8) & 255, b = (s >>> 16) & 255;
      if (r > 45 && r > g * 1.6 && r > b * 1.6) continue;                         // redstone
      if (r > 120 && g > 90 && b < g * 0.75) {                                    // oro -> hierro
        const l = Math.min(255, (r * 0.3 + g * 0.59 + b * 0.11) * 0.92) | 0;
        out[i] = ((0xff << 24) | (l << 16) | (l << 8) | l) >>> 0;
      } else out[i] = s;
    }
    texCache.set('rail@0', out);
    return out;
  }

  /** Lienzo 16×(16·n) con todos los fotogramas de una tira animada (agua, lava, portal). */
  function stripCanvas(spec) {
    if (!texReady) return null;
    let cv = stripCache.get(spec);
    if (cv) return cv;
    const td = texData.get(baseName(spec));
    const frames = td ? Math.max(1, (td.h / 16) | 0) : 1;
    const P = Pix(16, 16 * frames);
    for (let f = 0; f < frames; f++) {
      const src = texFrame(spec, f);
      for (let i = 0; i < 256; i++) P.set(i & 15, f * 16 + (i >> 4), src[i]);
    }
    cv = P.canvas();
    cv.frames = frames;
    stripCache.set(spec, cv);
    return cv;
  }

  // Orientaciones: bit 4 traspone, bit 1 espeja en X, bit 2 en Y.
  const ORI = [];
  for (let o = 0; o < 8; o++) {
    const m = new Uint16Array(256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let sx = x, sy = y;
      if (o & 4) { const q = sx; sx = sy; sy = q; }
      if (o & 1) sx = 15 - sx;
      if (o & 2) sy = 15 - sy;
      m[y * 16 + x] = sy * 16 + sx;
    }
    ORI.push(m);
  }
  function orient(spec, tx, ty, salt = 0) {
    const h = H(tx, ty, 61 + salt);
    return ROT.has(baseName(spec)) ? (h * 8) | 0 : (h < 0.5 ? 0 : 1);
  }

  /**
   * Copia las filas [sy0, sy1) de una textura (orientada) al tile en (ox, oy + fila - sy0 + dy).
   * Respeta el alfa (las flores se componen sobre el suelo).
   */
  function put(P, src, o, ox, oy, k = 1, sy0 = 0, sy1 = 16, dy = 0) {
    if (!src) return;
    const map = ORI[o], buf = P.buf, W = P.w;
    for (let y = sy0; y < sy1; y++) {
      const row = (oy + dy + y - sy0) * W + ox;
      for (let x = 0; x < 16; x++) {
        let s = src[map[y * 16 + x]];
        if (!(s >>> 24)) continue;
        if (k !== 1) s = mul(s, k);
        buf[row + x] = over(buf[row + x], s);
      }
    }
  }
  /** Oscurece / aclara un rectángulo ya pintado. */
  function shadeRect(P, x0, y0, w, h, k) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const i = y * P.w + x;
      if (P.buf[i] >>> 24) P.buf[i] = mul(P.buf[i], k);
    }
  }

  /** Ruido de valor suave (para elegir qué bloque de mancha toca en cada zona). */
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = H(xi, yi, s), b = H(xi + 1, yi, s), c = H(xi, yi + 1, s), d = H(xi + 1, yi + 1, s);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  const pickBand = (list, v) => list[Math.max(0, Math.min(list.length - 1, Math.floor((v - 0.22) / 0.56 * list.length)))];
  function pickWall(M, tx, ty) {
    const list = M.wall, tot = list.reduce((a, w) => a + (w.w || 1), 0);
    let r = vnoise(tx / 4.5, ty / 4.5, 53);
    r = Math.max(0, Math.min(0.999, (r - 0.2) / 0.6)) * tot;
    for (const w of list) if ((r -= (w.w || 1)) < 0) return w;
    return list[0];
  }

  /*
   * Cómo se ve cada tipo de charco. strip = tira animada (la anima world.js
   * con drawLiquid, encima del lecho `bed` horneado); tile = bloque quieto.
   */
  const LIQ_STYLE = {
    water:  { strip: 'water_still_grey#3f76e4*1.3', alpha: 0.75, bed: 'dirt', fps: 8 },
    swamp:  { strip: 'water_still_grey#617b64', alpha: 0.88, bed: 'mud', fps: 6 },
    lava:   { strip: 'lava_still', alpha: 1, fps: 5 },
    poison: { strip: 'water_still_grey#46d04a', alpha: 0.7, bed: 'mud', fps: 7, bubbles: true },
    spark:  { strip: 'water_still_grey!#ff3a20', alpha: 0.6, bed: 'redstone_block', fps: 12, bubbles: true, flicker: true },
    ice:    { tile: 'water_still_grey#3f76e4+ice', alpha: 1 },
    // The Ocean: deep water (trenches and holes in the seabed: slow) and magma vents (burn, with a bubble column).
    deep:   { strip: 'water_still_grey#2a5f9e', alpha: 0.72, bed: 'gravel*0.55', fps: 6 },
    magma:  { strip: 'magma', alpha: 1, fps: 3, bubbles: true },
    // The Aether: crystal-clear shallow pools (they slow nobody), the Holystone bed shows through.
    clear:  { strip: 'water_still_grey#4ec8f4*1.45', alpha: 0.78, bed: 'ae_icestone', fps: 6 }
  };

  /*
   * The Aether (Aether I mod): its blocks have no Mojang texture, so they are painted here, 16×16, in the mod's
   * palette, and registered in the texture table under 'ae_*' names (preload): the floor / wall / tree / prop
   * painters use them like any other texture (tints, '*k' brightness and '+' layers work too).
   */
  const AE_TEX = (() => {
    const P = list => list.map(h => pack(h));
    const n2 = (x, y, s) => H(x, y, s) * 0.3 + H(x >> 1, y >> 1, s + 1) * 0.3 + vnoise(x / 3, y / 3, s + 2) * 0.4;   // clustered pixel noise
    const pick = (pal, v) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)))];
    const tex = fn => { const o = new Uint32Array(256); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = fn(x, y); if (c) o[y * 16 + x] = c; } return o; };
    const GRASS = P(['#4caa72', '#5cbc80', '#6aca8c', '#78d698', '#8ee2a8']), DIRT = P(['#8c7a5c', '#9f8c6a', '#b19e7b', '#c3b08c']);
    const HOLY = P(['#a9aaa6', '#bdbeb9', '#cfd0cb', '#dedfda', '#ecede8']), MOSS = P(['#4f9c6a', '#68b882', '#86d29a']);
    const QS = P(['#d4b86a', '#e2c87c', '#eed892', '#f6e6aa']), ICE = P(['#8cc8ec', '#a8dcf6', '#c4ecff', '#e0f8ff', '#ffffff']);
    const LOG = P(['#5e5240', '#73654d', '#8a7a5e', '#a39374', '#b9aa8a']), GOLD = P(['#c89a2a', '#e8bc40', '#ffd860', '#fff0a0']);
    const ANG = P(['#cfd0d8', '#e0e1e8', '#eeeff4', '#fafbff']), CARV = P(['#6f706c', '#80817c', '#92938e', '#a5a6a0']);
    const HELL = P(['#7a2a1a', '#9a3a20', '#b84c28', '#d06a38']);
    const grassTop = (x, y) => { const r = H(x, y, 3); return r > 0.975 ? pack('#a8f0c0') : pick(GRASS, 0.15 + n2(x, y, 4) * 0.75); };
    const holy = (x, y, s = 0) => {
      // Light grey-white stone with darker pebbles, each with a lit pixel above-left.
      const r = H(x, y, 11 + s);
      if (r < 0.05) return HOLY[1];
      if (H(x + 1, y + 1, 11 + s) < 0.05) return HOLY[4];
      return pick(HOLY, 0.3 + n2(x, y, 12 + s) * 0.5);
    };
    /** Soft cloud: bilinear noise, low contrast. */
    const cloud = pal => tex((x, y) => pick(pal, 0.45 + vnoise(x / 5, y / 5, 21) * 0.45 + (H(x, y, 22) - 0.5) * 0.06));
    /** Ore in Holystone: clusters of gem pixels (pal dark -> bright). */
    const ore = (pal, s) => {
      const pts = [[3, 4], [10, 3], [6, 10], [12, 11]].map(([a, b], k) => [a + H(k, s, 31) * 2, b + H(k, s, 32) * 2]);
      return tex((x, y) => {
        let d = 9;
        for (const [a, b] of pts) d = Math.min(d, Math.hypot(x - a, y - b));
        if (d < 0.8) return pal[pal.length - 1];
        if (d < 1.6 && H(x, y, s) < 0.85) return pal[pal.length - 2];
        if (d < 2.2 && H(x, y, s + 1) < 0.5) return pal[0];
        return holy(x, y);
      });
    };
    /** Bark of a log (vertical stripes); `amber`: Golden Oak's amber knots. */
    const bark = amber => tex((x, y) => {
      if (amber && H(x, y, 41) < 0.06) return H(x, y, 42) < 0.5 ? pack('#e0a030') : pack('#f6c850');
      const col = H(x, 0, 43), v = col * 0.6 + H(x, y >> 2, 44) * 0.25 + H(x, y, 45) * 0.15;
      return col < 0.16 ? LOG[0] : pick(LOG, v * 0.95);
    });
    /** Opaque leaves with darker holes (pal dark -> bright). */
    const leaves = (pal, hole, extra) => tex((x, y) => {
      if (extra) { const c = extra(x, y); if (c) return c; }
      if (H(x, y, 51) < 0.13) return hole;
      return pick(pal, n2(x, y, 52) * 0.85 + (H(x - 1, y - 1, 51) < 0.13 ? 0.15 : 0));
    });
    /** Fruit on leaves: 2×2 berries / apples at a few spots, with a highlight. */
    const fruit = (spots, c0, c1, hi) => (x, y) => {
      for (const [a, b] of spots) {
        const dx = x - a, dy = y - b;
        if (dx >= 0 && dx < 2 && dy >= 0 && dy < 2) return dx + dy === 0 ? hi : dy ? c0 : c1;
      }
      return 0;
    };
    /** A small flower plant (transparent): stem, two leaves, petals in a plus around (7.5, 5). */
    const flower = (petal, petal2, mid) => tex((x, y) => {
      const stem = pack('#4fa84a'), leaf = pack('#6cc85e');
      if ((x === 7 || x === 8) && y >= 8) return x === 7 ? stem : leaf;
      if ((y === 11 && (x === 5 || x === 6)) || (y === 12 && (x === 9 || x === 10))) return leaf;
      const dx = x - 7.5, dy = y - 5, d = Math.abs(dx) + Math.abs(dy);
      if (d < 1.2) return pack(mid);
      if (d < 3.3 && (Math.abs(dx) < 1.2 || Math.abs(dy) < 1.2 || d < 2.4)) return pack(dy < 0 || dx < 0 ? petal : petal2);
      return 0;
    });
    return {
      ae_grass_top: () => tex(grassTop),
      ae_dirt: () => tex((x, y) => pick(DIRT, n2(x, y, 6))),
      ae_grass_side: () => tex((x, y) => {
        const g = 2 + (H(x, 0, 7) < 0.55 ? 1 : 0) + (H(x, 1, 7) < 0.25 ? 1 : 0);
        return y < g ? pick(GRASS, 0.35 + n2(x, y, 8) * 0.6 - y * 0.08) : y === g && H(x, 2, 7) < 0.4 ? GRASS[0] : pick(DIRT, n2(x, y, 6));
      }),
      ae_holystone: () => tex((x, y) => holy(x, y)),
      ae_holystone_mossy: () => tex((x, y) => {
        const m = vnoise(x / 3.5, y / 3.5, 61) + (H(x, y, 62) - 0.5) * 0.2;
        return m > 0.56 ? pick(MOSS, (m - 0.56) * 4 + H(x, y, 63) * 0.3) : holy(x, y, 2);
      }),
      ae_holystone_brick: () => tex((x, y) => {
        const by = y >> 2, off = (by & 1) * 4, bx = (x + off) >> 3;
        if ((y & 3) === 3 || ((x + off) & 7) === 7) return pack('#9d9e99');
        if ((y & 3) === 0 || ((x + off) & 7) === 0) return pack('#f6f7f2');
        return pick(HOLY, 0.45 + H(bx, by, 71) * 0.3 + (H(x, y, 72) - 0.5) * 0.25);
      }),
      ae_carved_stone: () => tex((x, y) => {
        const e = Math.min(x, y, 15 - x, 15 - y);
        if (e === 0) return CARV[0];
        if (e === 1) return x < 8 && y < 8 ? CARV[3] : CARV[2];
        const m = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (m > 3 && m < 4.2) return CARV[0];
        if (m <= 3 && Math.abs(x - 7.5) + Math.abs(y - 7.5) < 3.2) return CARV[3];
        return pick(CARV, 0.3 + n2(x, y, 81) * 0.5);
      }),
      ae_angelic_stone: () => tex((x, y) => {
        const e = Math.min(x, y, 15 - x, 15 - y);
        if (e === 0) return pack('#b8bac6');
        if (e === 1) return ANG[3];
        if ((x === 7 || x === 8) && (y === 7 || y === 8)) return GOLD[2];
        return pick(ANG, 0.35 + n2(x, y, 91) * 0.5);
      }),
      ae_angelic_trim: () => tex((x, y) => {
        if (y >= 6 && y <= 9) return y === 6 ? GOLD[3] : y === 9 ? GOLD[0] : pick(GOLD, 0.4 + H(x, y, 92) * 0.5);
        return y === 0 || y === 15 ? pack('#b8bac6') : pick(ANG, 0.35 + n2(x, y, 93) * 0.5);
      }),
      ae_hellfire_stone: () => tex((x, y) => {
        const e = Math.min(x, y, 15 - x, 15 - y);
        if (e === 0) return HELL[0];
        if (e === 1) return x < 8 && y < 8 ? GOLD[1] : HELL[3];
        return pick(HELL, 0.25 + n2(x, y, 95) * 0.6);
      }),
      ae_quicksoil: () => tex((x, y) => {
        // Pale gold sand with a glossy sheen: short diagonal glints.
        if ((x + y + Math.floor(H(x - y, 0, 101) * 3)) % 7 === 0 && H(x, y, 102) < 0.55) return pack('#fffbe6');
        return pick(QS, 0.1 + n2(x, y, 103) * 0.8);
      }),
      ae_icestone: () => tex((x, y) => {
        const v = n2(x, y, 111), r = H(x, y, 112);
        if (r > 0.94) return ICE[4];
        return pick(ICE, 0.1 + v * 0.75 + (x + y < 9 ? 0.1 : 0));
      }),
      ae_aercloud: () => cloud(P(['#cbd9ea', '#dfe9f5', '#eef4fb', '#f8fbff', '#ffffff'])),
      ae_aercloud_blue: () => cloud(P(['#6fb4ea', '#86c4f2', '#9fd4fa', '#b8e2ff', '#d4efff'])),
      ae_aercloud_gold: () => cloud(P(['#e2b440', '#ecc654', '#f6d878', '#fce8a4', '#fff6d0'])),
      ae_ambrosium_ore: () => ore(P(['#c89a2a', '#ffd84a', '#fff7a8']), 121),
      ae_zanite_ore: () => ore(P(['#5a3aa8', '#8a5ae0', '#c9a6ff']), 122),
      ae_gravitite_ore: () => ore(P(['#a0308c', '#e05ac0', '#ffc0f0']), 123),
      ae_skyroot_log: () => bark(false),
      ae_golden_log: () => bark(true),
      ae_skyroot_log_top: () => tex((x, y) => {
        const d = Math.hypot(x - 7.5, y - 7.5);
        return d > 6.6 ? LOG[1] : pick(P(['#a8977a', '#c9b68f', '#b8a682']), (Math.floor(d) % 2 ? 0.1 : 0.6) + H(x, y, 131) * 0.3);
      }),
      ae_skyroot_leaves: () => leaves(P(['#3f9c3c', '#58b84a', '#72d25a', '#8ee86e', '#aaf48a']), pack('#2e7a32')),
      ae_golden_leaves: () => leaves(P(['#c8901a', '#e2ac2c', '#f6c83e', '#ffde5a', '#fff09a']), pack('#9a6a14')),
      ae_crystal_leaves: () => leaves(P(['#5fb4d4', '#7ccbe6', '#9edcf2', '#bfeafa', '#e0f8ff']), pack('#3f8aaa')),
      ae_crystal_fruit_leaves: () => leaves(P(['#5fb4d4', '#7ccbe6', '#9edcf2', '#bfeafa', '#e0f8ff']), pack('#3f8aaa'),
        fruit([[3, 3], [11, 6], [5, 11]], pack('#d8e4e8'), pack('#f4fbff'), pack('#ffffff'))),
      ae_berry_leaves: () => leaves(P(['#2c6a34', '#3a8242', '#4c9a52', '#62b062']), pack('#1f4f28'),
        fruit([[2, 3], [9, 2], [12, 9], [4, 10], [8, 12]], pack('#2a3ad0'), pack('#4a64f0'), pack('#b8c8ff'))),
      ae_white_flower: () => flower('#ffffff', '#e2e8f4', '#ffe060'),
      ae_purple_flower: () => flower('#c088ff', '#9a5ae0', '#ffe0ff'),
      ae_tallgrass: () => tex((x, y) => {
        const GB = P(['#5cbc80', '#78d698', '#9ae8b4', '#b8f6cc']);
        // Five pale blades leaning outwards.
        for (const [x0, top, lean] of [[3, 7, -2], [6, 3, -1], [8, 1, 0], [10, 4, 1], [13, 8, 2]]) {
          if (y < top) continue;
          const k = (15 - y) / (15 - top), bx = Math.round(x0 + lean * k * k);
          if (x === bx) return pick(GB, 0.1 + k * 0.85);
        }
        return 0;
      }),
      ae_golden_petals: () => tex((x, y) => {
        for (const [a, b] of [[2, 3], [9, 1], [12, 7], [5, 9], [10, 13], [1, 13]]) if (y === b && (x === a || x === a + 1)) return x === a ? pack('#ffd84a') : pack('#f2b830');
        return 0;
      })
    };
  })();
  const liqStyle = B => Object.assign({ foam: B.foam }, LIQ_STYLE[B.liquid] || LIQ_STYLE.water, B.mc && B.mc.liq);

  function preload() {
    for (const n in AE_TEX) texData.set(n, { w: 16, h: 16, px: AE_TEX[n]() });
    const specs = ['glowstone'];
    for (const B of BIOMES) {
      const M = B.mc, L = liqStyle(B);
      specs.push(M.floor, M.bank, M.rock, ...M.patch, ...(M.decal || []), ...(M.grass || []),
        ...(M.spots || []).map(s => s[0]), ...M.wall.flatMap(w => [w.top, w.side]), L.strip, L.bed, L.tile, L.pad);
      // Todas las texturas de los objetos (las claves kind / shape no lo son).
      for (const o of [].concat(M.obj || []))
        for (const k in o) if (k !== 'kind' && k !== 'shape') specs.push(...[].concat(o[k]).filter(v => typeof v === 'string' && v[0] !== '#'));
    }
    specs.push('chest_top', 'chest_front', 'ender_chest_top', 'ender_chest_front', 'enchanting_table_top', 'enchanting_table_side',
      'cauldron_side', 'cauldron_inner', 'water_still_grey', 'web', 'tnt_top', 'tnt_side', 'stone', 'slime', 'obsidian', 'portal',
      'environment/destroy_stage_6', 'end_portal', 'endframe_top', 'endframe_side', 'endframe_eye', 'bedrock', 'glass',
      'trial_spawner_top_active', 'trial_spawner_side_active', 'trial_spawner_top_active_ominous', 'trial_spawner_side_active_ominous',
      'tuff_bricks', 'chiseled_tuff', 'chiseled_tuff_top', 'polished_tuff', 'chiseled_copper', 'oxidized_cut_copper', 'copper_bulb_lit',
      'cut_copper', 'rail_golden', 'end_gateway', 'reinforced_deepslate_top', 'reinforced_deepslate_side', 'cobblestone_mossy', 'ladder',
      'stonebrick', 'stonebrick_mossy', 'stone_slab_top', 'items/ender_eye', 'iron_bars', 'sculk', 'sculk_vein',
      'sand', 'gravel', 'prismarine_rough', 'prismarine_dark', 'bubble_column_up_top_a', 'kelp_a', 'kelp_top');
    for (const d of BLOCKS) if (d) {
      specs.push(d.floor, d.over, ...(d.spots || []).map(s => s[0]));
      for (const w of d.wall || []) specs.push(w.top, w.side);
    }
    for (const k in DECO_TEX) specs.push(...DECO_TEX[k]);
    const names = new Set();
    for (const s of specs) if (s && s !== 'rail') for (const L of parseSpec(s)) names.add(L.name);
    for (const n of names) loadTex(n);
  }

  // ---------------- chunk de suelo ----------------

  /**
   * Pinta un chunk de n×n tiles. `at(tx,ty)` devuelve el tipo de terreno
   * global ('floor' | 'wall' | 'liquid'), así el autotiling ve más allá del
   * borde del chunk.
   */
  /**
   * Máscara de tierra del chunk a resolución de píxel (más una fila por
   * arriba para detectar bordes). El ruido se evalúa cada 4 px y se interpola:
   * ~30 veces menos llamadas que evaluarlo píxel a píxel.
   */
  function dirtMask(gx0, gy0, W, field, seed) {
    const S = 4, gw = W / S + 3;
    const grid = new Float32Array(gw * gw);
    for (let j = 0; j < gw; j++) for (let i = 0; i < gw; i++)
      grid[j * gw + i] = field(gx0 + (i - 1) * S, gy0 + (j - 1) * S);
    const mask = new Uint8Array(W * (W + 1));
    for (let y = -1; y < W; y++) {
      const fy = (y + S) / S, j = Math.floor(fy), v = fy - j;
      for (let x = 0; x < W; x++) {
        const fx = (x + S) / S, i = Math.floor(fx), u = fx - i;
        const a = grid[j * gw + i], b = grid[j * gw + i + 1];
        const c = grid[(j + 1) * gw + i], d = grid[(j + 1) * gw + i + 1];
        let val = (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
        val += (H((gx0 + x) >> 1, (gy0 + y) >> 1, seed + 9) - 0.5) * 0.05;
        mask[(y + 1) * W + x] = val > 0.64 ? 1 : 0;
      }
    }
    // dirtAt(x, y) en coordenadas locales del chunk (y puede ser -1).
    return (x, y) => mask[(y + 1) * W + x] === 1;
  }

  /**
   * `bi`: índice de bioma para todo el chunk, o función (tx, ty) -> índice
   * (el mapa de biomas de la dimensión: cada tile con el suyo).
   */
  function paintChunk(cx, cy, n, at, dirtField, bi, seed = 0, blk = null) {
    if (texReady) return paintChunkMC(cx, cy, n, at, dirtField, bi, blk);
    const B = BIOMES[typeof bi === 'function' ? bi(cx * n + (n >> 1), cy * n + (n >> 1)) : bi];
    const P = Pix(n * T, n * T);
    const C = {};
    for (const k of ['floor', 'dirt', 'wallTop', 'wallFace', 'flowers', 'grass'])
      C[k] = B[k].map(h => pack(h));
    for (const k of ['speck', 'light', 'wallLight', 'wallEdge', 'wallFaceDark', 'liq', 'liqDeep', 'foam', 'shore'])
      C[k] = pack(B[k]);
    C.liqLight = mixPack(B.liq, B.foam, 0.28);

    const tx0 = cx * n, ty0 = cy * n;
    const dirtAt = dirtMask(tx0 * T, ty0 * T, n * T, dirtField, seed);

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const tx = tx0 + i, ty = ty0 + j;
        const ox = i * T, oy = j * T;
        const kind = at(tx, ty);

        // 1) Suelo bajo todo (las esquinas redondeadas de las paredes lo dejan ver).
        paintFloor(P, C, ox, oy, tx, ty, dirtAt, at);

        if (kind === 'wall') paintWall(P, C, ox, oy, tx, ty, at);
        else if (kind === 'liquid') paintLiquid(P, C, ox, oy, tx, ty, at);
        else if (kind === 'void') for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) P.set(ox + x, oy + y, C.wallEdge);
      }
    }
    return P.canvas();
  }

  function paintFloor(P, C, ox, oy, tx, ty, dirtAt, at) {
    let dirtCount = 0;
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const gx = tx * T + x, gy = ty * T + y;
        const lx = ox + x, ly = oy + y;           // coordenadas locales del chunk
        const dirt = dirtAt(lx, ly);
        if (dirt) dirtCount++;
        const pal = dirt ? C.dirt : C.floor;
        // Tono por ruido suave + tramado por píxel.
        const band = H(gx >> 3, gy >> 3, 11) * 0.7 + H(gx, gy, 12) * 0.5;
        let col = pal[Math.min(pal.length - 1, Math.floor(band * pal.length / 1.2))];
        const r = H(gx, gy, 13);
        if (r < 0.035) col = C.speck;
        else if (r > 0.985) col = C.light;
        // Borde de la tierra: labio oscuro arriba, hierba que la invade abajo.
        if (dirt && !dirtAt(lx, ly - 1)) col = C.speck;
        else if (!dirt && dirtAt(lx, ly - 1) && r < 0.5) col = C.light;
        P.set(ox + x, oy + y, col);
      }
    }
    const dirt = dirtCount > T * T / 2;
    // Sombra de contacto bajo las paredes que hay justo al norte.
    if (at(tx, ty - 1) === 'wall') {
      for (let x = 0; x < T; x++) { P.set(ox + x, oy, C.wallFaceDark); if ((x + ty) % 2) P.set(ox + x, oy + 1, C.speck); }
    }

    // Detalles: matojo, piedrecita o flor.
    const d = H(tx, ty, 14);
    const dx = ox + 3 + Math.floor(H(tx, ty, 15) * 10), dy = oy + 4 + Math.floor(H(tx, ty, 16) * 9);
    if (dirt) {
      if (d < 0.22) { P.set(dx, dy, C.light); P.set(dx + 1, dy, C.light); P.set(dx, dy + 1, C.speck); P.set(dx + 1, dy + 1, C.speck); }
      return;
    }
    if (d < 0.18) {                         // matojo
      P.set(dx, dy, C.light); P.set(dx - 1, dy - 1, C.light); P.set(dx + 1, dy - 1, C.light);
      P.set(dx, dy - 2, C.light); P.set(dx, dy + 1, C.speck);
    } else if (d < 0.26) {                  // flor
      const fc = C.flowers[Math.floor(H(tx, ty, 17) * C.flowers.length)];
      P.set(dx, dy - 1, fc); P.set(dx - 1, dy, fc); P.set(dx + 1, dy, fc); P.set(dx, dy + 1, fc);
      P.set(dx, dy, C.light);
    } else if (d < 0.32) {                  // piedrecita
      P.set(dx, dy, C.light); P.set(dx + 1, dy, C.light); P.set(dx, dy + 1, C.speck); P.set(dx + 1, dy + 1, C.speck);
    }
  }

  function paintWall(P, C, ox, oy, tx, ty, at) {
    const W = (x, y) => at(x, y) === 'wall';
    const n = W(tx, ty - 1), s = W(tx, ty + 1), w = W(tx - 1, ty), e = W(tx + 1, ty);
    const FACE = s ? 0 : 6;                 // filas de cara frontal visibles

    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        // Esquinas redondeadas exteriores: dejan ver el suelo.
        if (!n && !w && x + y < 3) continue;
        if (!n && !e && (T - 1 - x) + y < 3) continue;
        if (!s && !w && x + (T - 1 - y) < 2) continue;
        if (!s && !e && (T - 1 - x) + (T - 1 - y) < 2) continue;

        const gx = tx * T + x, gy = ty * T + y;
        let col;
        if (y >= T - FACE) {
          // Cara frontal: vetas verticales y base oscura.
          const fy = y - (T - FACE);
          col = C.wallFace[(x + (H(gx, 0, 21) < 0.5 ? 0 : 1)) % 3 === 0 ? 1 : 0];
          if (fy === 0) col = C.wallEdge;
          else if (y === T - 1) col = C.wallFaceDark;
          else if (H(gx, gy, 22) < 0.08) col = C.wallFaceDark;
        } else {
          // Cara superior con tramado.
          col = C.wallTop[Math.floor(H(gx >> 1, gy >> 1, 23) * 2.2 + H(gx, gy, 24) * 0.8) % C.wallTop.length];
          if (H(gx, gy, 25) < 0.05) col = C.wallLight;
          // Bordes: luz al norte, contorno oscuro a los lados.
          if (!n && y === 0) col = C.wallEdge;
          else if (!n && y === 1) col = C.wallLight;
          if (!w && x === 0) col = C.wallEdge;
          if (!e && x === T - 1) col = C.wallEdge;
        }
        P.set(ox + x, oy + y, col);
      }
    }
  }

  function paintLiquid(P, C, ox, oy, tx, ty, at) {
    const L = (x, y) => at(x, y) === 'liquid';
    const n = L(tx, ty - 1), s = L(tx, ty + 1), w = L(tx - 1, ty), e = L(tx + 1, ty);
    const nw = L(tx - 1, ty - 1), ne = L(tx + 1, ty - 1), sw = L(tx - 1, ty + 1), se = L(tx + 1, ty + 1);
    const BIG = 99;

    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        // Esquinas exteriores redondeadas: dejan ver el suelo de debajo.
        if (!n && !w && x + y < 3) continue;
        if (!n && !e && (T - 1 - x) + y < 3) continue;
        if (!s && !w && x + (T - 1 - y) < 3) continue;
        if (!s && !e && (T - 1 - x) + (T - 1 - y) < 3) continue;

        // Distancia a la orilla dentro del tile (incluye esquinas interiores).
        let d = Math.min(n ? BIG : y, s ? BIG : T - 1 - y, w ? BIG : x, e ? BIG : T - 1 - x);
        if (n && w && !nw) d = Math.min(d, Math.hypot(x, y) - 0.5);
        if (n && e && !ne) d = Math.min(d, Math.hypot(T - 1 - x, y) - 0.5);
        if (s && w && !sw) d = Math.min(d, Math.hypot(x, T - 1 - y) - 0.5);
        if (s && e && !se) d = Math.min(d, Math.hypot(T - 1 - x, T - 1 - y) - 0.5);

        const gx = tx * T + x, gy = ty * T + y;
        const r = H(gx, gy, 31);
        let col;
        if (d < 1) col = C.shore;                       // labio de tierra
        else if (d < 2) col = C.foam;                   // espuma
        else if (d < 4) col = C.liqLight;               // agua somera
        else if (d < 6) col = r < 0.5 ? C.liq : C.liqLight;
        else col = d < 8 && r < 0.5 ? C.liq : C.liqDeep;
        if (d >= 6 && d < BIG && r < 0.08) col = C.liq;

        // Olas sueltas: rayitas horizontales de 3 px, pocas.
        if (d >= 3 && H(gx >> 2, gy, 33) < 0.045 && (gx & 3) !== 3) col = C.liqLight;
        if (d >= 3 && H(gx, gy, 34) < 0.004) col = C.foam;
        P.set(ox + x, oy + y, col);
      }
    }
  }

  // ---------------- chunk de suelo con texturas de Minecraft ----------------

  /**
   * Un tile = un bloque. Las manchas de tierra del original son aquí bloques
   * enteros (camino, tierra gruesa, grava...), elegidos con el mismo campo
   * continuo muestreado en el centro de cada tile.
   */
  function paintChunkMC(cx, cy, n, at0, dirtField, bi, blk) {
    const bio = typeof bi === 'function' ? bi : () => bi;
    const P = Pix(n * T, n * T);
    const tx0 = cx * n, ty0 = cy * n, pw = n + 2;
    const patch = new Uint8Array(pw * pw), bm = new Uint16Array(pw * pw), K = new Array(pw * pw);
    for (let j = 0; j < pw; j++) for (let i = 0; i < pw; i++) {
      patch[j * pw + i] = dirtField((tx0 + i - 1) * T + 8, (ty0 + j - 1) * T + 8) > 0.64 ? 1 : 0;
      bm[j * pw + i] = bio(tx0 + i - 1, ty0 + j - 1);
      K[j * pw + i] = at0(tx0 + i - 1, ty0 + j - 1);
    }
    // Tipos de terreno del chunk y su borde ya leídos (el autotiling pregunta mucho).
    const at = (x, y) => {
      const i = x - tx0 + 1, j = y - ty0 + 1;
      return i >= 0 && j >= 0 && i < pw && j < pw ? K[j * pw + i] : at0(x, y);
    };
    const isPatch = (i, j) => patch[(j + 1) * pw + i + 1] === 1;
    const bAt = (i, j) => bm[(j + 1) * pw + i + 1];
    const LS = [];

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const tx = tx0 + i, ty = ty0 + j, ox = i * T, oy = j * T;
        const b = bAt(i, j), B = BIOMES[b], M = B.mc;
        const kind = at(tx, ty);
        const D = blk ? BLOCKS[blk(tx, ty)] : null;
        if (kind === 'wall') wallMC(P, D && D.wall ? { wall: D.wall, deep: M.deep, topK: D.topK || M.topK } : M, ox, oy, tx, ty, at);
        else if (kind === 'liquid') liquidMC(P, D && D.floor ? { bank: D.floor } : M, LS[b] || (LS[b] = liqStyle(B)), ox, oy, tx, ty, at);
        else if (kind === 'void') {
          if (M.sky) skyMC(P, BIOMES[bAt(i, j - 1)].mc, ox, oy, tx, ty, at, blk);
          else voidMC(P, M, ox, oy, tx, ty, at);
        }
        else if (D && D.floor) blockFloorMC(P, D, ox, oy, tx, ty, at);
        else {
          // Vecinos de otro bioma: el borde se mezcla con su suelo, tramado.
          let mix = null;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nb = bAt(i + dx, j + dy);
            if (nb !== b && (dx || dy) && BIOMES[nb].mc.floor !== M.floor) (mix || (mix = [])).push(dx, dy, nb);
          }
          floorMC(P, M, ox, oy, tx, ty, isPatch(i, j), isPatch(i, j - 1), at, mix);
        }
        if (M.sky && kind !== 'void' && kind !== 'wall') skyRim(P, ox, oy, tx, ty, at, !!(D && D.cloud));
      }
    }
    let tinted = false;
    for (let q = 0; q < pw * pw && !tinted; q++) if (BIOMES[bm[q]].mc.tint) tinted = true;
    if (tinted) tintChunk(P, n, pw, bm);
    return P.canvas();
  }

  /*
   * Under the sea (mc.tint = [colour, amount, brightness]): every pixel is darkened and mixed with the water
   * colour. Each tile corner takes the mean of the four tiles around it and the pixels interpolate between
   * corners, so the tint changes smoothly across biome edges (a tile without tint counts as amount 0).
   */
  const tintOf = M => M.tintP || (M.tint ? (M.tintP = [...rgb(M.tint[0]), M.tint[1], Math.min(1, M.tint[2])]) : null);
  const NO_TINT = [0, 0, 0, 0, 1];
  // brightness k <= 1, so a channel never passes 255: c·k·(1 - a) + w·a.
  function tintPx(s, r, g, b, a, k) {
    const u = k * (1 - a);
    return ((s & 0xff000000) | ((((s >>> 16) & 255) * u + b * a) << 16) | ((((s >>> 8) & 255) * u + g * a) << 8) | ((s & 255) * u + r * a)) >>> 0;
  }
  function tintChunk(P, n, pw, bm) {
    const n1 = n + 1, C = new Float32Array(n1 * n1 * 5), buf = P.buf, W = P.w;
    for (let cj = 0; cj < n1; cj++) for (let ci = 0; ci < n1; ci++) {
      let r = 0, g = 0, b = 0, a = 0, k = 0;
      for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
        const t = tintOf(BIOMES[bm[(cj + dj) * pw + ci + di]].mc) || NO_TINT;
        r += t[0] * t[3]; g += t[1] * t[3]; b += t[2] * t[3]; a += t[3]; k += t[4];
      }
      const o = (cj * n1 + ci) * 5;
      C[o] = a ? r / a : 0; C[o + 1] = a ? g / a : 0; C[o + 2] = a ? b / a : 0; C[o + 3] = a / 4; C[o + 4] = k / 4;
    }
    const L = new Float32Array(5), R = new Float32Array(5);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const o00 = (j * n1 + i) * 5, o10 = o00 + 5, o01 = o00 + n1 * 5, o11 = o01 + 5, ox = i * T, oy = j * T;
      let same = true;
      for (let c = 0; c < 5 && same; c++) same = C[o00 + c] === C[o10 + c] && C[o00 + c] === C[o01 + c] && C[o00 + c] === C[o11 + c];
      if (same) {
        const a = C[o00 + 3], u = C[o00 + 4] * (1 - a);
        if (!a && u === 1) continue;
        const ra = C[o00] * a, ga = C[o00 + 1] * a, ba = C[o00 + 2] * a;
        for (let y = 0; y < T; y++) for (let x = 0, p = (oy + y) * W + ox; x < T; x++, p++) {
          const s = buf[p];
          buf[p] = ((s & 0xff000000) | ((((s >>> 16) & 255) * u + ba) << 16) | ((((s >>> 8) & 255) * u + ga) << 8) | ((s & 255) * u + ra)) >>> 0;
        }
        continue;
      }
      // Across a biome edge: interpolate the corners down the left and right sides, then along each row.
      for (let y = 0; y < T; y++) {
        const v = (y + 0.5) / T;
        for (let c = 0; c < 5; c++) { L[c] = C[o00 + c] + (C[o01 + c] - C[o00 + c]) * v; R[c] = C[o10 + c] + (C[o11 + c] - C[o10 + c]) * v; }
        for (let x = 0, p = (oy + y) * W + ox; x < T; x++, p++) {
          const q = (x + 0.5) / T;
          buf[p] = tintPx(buf[p], L[0] + (R[0] - L[0]) * q, L[1] + (R[1] - L[1]) * q, L[2] + (R[2] - L[2]) * q,
                          L[3] + (R[3] - L[3]) * q, L[4] + (R[4] - L[4]) * q);
        }
      }
    }
  }
  /** Tints a prop sprite like the seabed under it (its biome's mc.tint). */
  function tintCanvas(cv, t) {
    const c = cv.getContext('2d'), d = c.getImageData(0, 0, cv.width, cv.height), px = new Uint32Array(d.data.buffer);
    // Props stand a bit closer to the eye than the seabed: a lighter tint keeps them readable.
    const a = t[3] * 0.7, k = 1 - (1 - t[4]) * 0.6;
    for (let i = 0; i < px.length; i++) if (px[i] >>> 24) px[i] = tintPx(px[i], t[0], t[1], t[2], a, k);
    c.putImageData(d, 0, 0);
    return cv;
  }

  const CLOUD_COL = new Float32Array(T + 4);
  /** Suelo de un bloque de estructura (sin manchas ni flores), con sus sombras de contacto. */
  function blockFloorMC(P, D, ox, oy, tx, ty, at) {
    let spec = D.floor;
    if (D.spots) for (const [s, p] of D.spots) if (H(tx, ty, 44) < p) { spec = s; break; }
    put(P, texFrame(spec), orient(spec, tx, ty), ox, oy);
    if (D.cloud) {
      // Aerclouds: soft puffs across the tiles, lit from above (highlight on top of each bump, shade below).
      for (let x = 0; x < T; x++) {
        const gx = tx * T + x;
        for (let q = 0; q < T + 4; q++) { const gy = ty * T + q - 2; CLOUD_COL[q] = vnoise(gx / 14, gy / 14, 181) * 0.75 + vnoise(gx / 6, gy / 6, 182) * 0.25; }
        for (let y = 0; y < T; y++) {
          const i = (oy + y) * P.w + ox + x;
          P.buf[i] = mul(P.buf[i], 0.985 + (CLOUD_COL[y] - CLOUD_COL[y + 4]) * 0.32 + (CLOUD_COL[y + 2] - 0.5) * 0.05);
        }
      }
      return;
    }
    if (D.over) put(P, texFrame(D.over), D.ori || 0, ox, oy);
    if (D.stairs) {
      // Dos escalones por bloque: arista clara arriba, sombra debajo.
      for (const y of [0, 8]) { shadeRect(P, ox, oy + y, T, 1, 1.3); shadeRect(P, ox, oy + y + 6, T, 2, 0.62); }
    }
    floorShade(P, ox, oy, tx, ty, at);
  }

  /**
   * Mezcla de bioma: hasta ~1 tile dentro de este, píxeles del suelo del
   * vecino, cada vez menos (tramado a bloques de 1-2 px). Como el vecino hace
   * lo mismo, la transición ocupa unos 2 tiles.
   */
  function blendEdge(P, ox, oy, tx, ty, mix) {
    const src = [];
    for (let k = 0; k < mix.length; k += 3) {
      const spec = BIOMES[mix[k + 2]].mc.floor;
      src.push(texFrame(spec), ORI[orient(spec, tx, ty)]);
    }
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let best = 0, bk = -1;
      for (let k = 0; k < mix.length; k += 3) {
        const dx = mix[k], dy = mix[k + 1];
        const ax = dx < 0 ? x + 0.5 : dx > 0 ? T - 0.5 - x : 0, ay = dy < 0 ? y + 0.5 : dy > 0 ? T - 0.5 - y : 0;
        const d = dx && dy ? Math.hypot(ax, ay) : ax + ay;
        const p = 0.55 * (1 - d / 15);
        if (p > best) { best = p; bk = k / 3; }
      }
      if (bk < 0) continue;
      const gx = tx * T + x, gy = ty * T + y;
      if (H(gx >> 1, gy >> 1, 71) * 0.6 + H(gx, gy, 72) * 0.4 >= best) continue;
      const s = src[bk * 2], m = src[bk * 2 + 1];
      if (!s) continue;
      const c = s[m[y * 16 + x]];
      if (c >>> 24) P.buf[(oy + y) * P.w + ox + x] = c;
    }
  }

  /**
   * El Vacío del End: fondo estrellado (end_portal muy oscuro) y, si arriba
   * hay suelo, la cara del bloque de la isla que cae hacia el vacío.
   */
  function voidMC(P, M, ox, oy, tx, ty, at) {
    const V = (x, y) => at(x, y) === 'void';
    const n = V(tx, ty - 1), s = V(tx, ty + 1), w = V(tx - 1, ty), e = V(tx + 1, ty);
    const star = texFrame('end_portal'), m = ORI[(H(tx, ty, 64) * 8) | 0], base = pack('#06030c');
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const c = star ? star[m[y * 16 + x]] : 0;
      P.buf[(oy + y) * P.w + ox + x] = (c >>> 24) ? mul(c, 0.55) : base;
    }
    const side = texFrame(M.bank);
    if (!n) {
      const K = [0.78, 0.64, 0.52, 0.42, 0.33, 0.25, 0.18, 0.12];
      for (let r = 0; r < K.length; r++) put(P, side, 0, ox, oy, K[r], r, r + 1);
      // Sombra que se pierde en el vacío.
      shadeRect(P, ox, oy + K.length, T, 2, 0.6);
    }
    const lip = (x, y) => { const i = (oy + y) * P.w + ox + x; P.buf[i] = mul(side ? side[y * 16 + x] | 0xff000000 : P.buf[i], 0.38); };
    for (let q = 0; q < T; q++) {
      if (!w && (n || q >= 8)) lip(0, q);
      if (!e && (n || q >= 8)) lip(T - 1, q);
      if (!s) lip(q, T - 1);
    }
  }

  /*
   * The Aether's open sky (a 'void' tile of a biome with mc.sky): left transparent, so world.js's sky shows
   * through. Under an island's south edge hangs its cliff (the side of the block above: Aether Grass over
   * Aether Dirt, Quicksoil, a structure's stone...) and then a ragged Holystone underside fading into the sky;
   * under a cloud, its puffy side. The second sky tile below land gets the tips of the underside.
   */
  const SKY_HAZE = pack('#a8cce8');
  const alphaOf = (c, a) => ((Math.max(0, Math.min(255, a | 0)) << 24) | (c & 0xffffff)) >>> 0;
  function skyMC(P, Mn, ox, oy, tx, ty, at, blk) {
    const W = P.w, nk = at(tx, ty - 1), holy = texFrame('ae_holystone');
    // Ragged underside length (px) of each column: smooth along x, so it hangs like rock.
    const under = x => 5 + vnoise((tx * T + x) / 7, ty * 0.37, 141) * 14 + (H(tx * T + x, ty, 142) - 0.5) * 2;
    if (nk !== 'void') {
      const Dn = blk ? BLOCKS[blk(tx, ty - 1)] : null;
      const wEnd = at(tx - 1, ty - 1) === 'void', eEnd = at(tx + 1, ty - 1) === 'void';
      if (Dn && Dn.cloud) {
        // Cloud: a puffy rounded side, then a soft blue shadow.
        const src = texFrame(Dn.floor), sh = pack('#9fb8d4');
        for (let x = 0; x < T; x++) {
          const gx = tx * T + x, len = 3 + Math.round((Math.sin(gx * 0.55) + 1) * 1.3 + H(gx, ty, 143) * 0.8);
          const cut = (wEnd ? Math.max(0, 3 - x) : 0) + (eEnd ? Math.max(0, x - 12) : 0);
          for (let y = 0; y < len - cut; y++) P.buf[(oy + y) * W + ox + x] = mul(src[((y + 6) & 15) * 16 + x] | 0xff000000, 0.9 - y * 0.05);
          for (let y = Math.max(0, len - cut); y < len - cut + 3; y++) P.buf[(oy + y) * W + ox + x] = alphaOf(sh, 70 - (y - len + cut) * 22);
        }
        return;
      }
      // The face of the block above (a wall shows its own face: then straight to stone).
      const face = nk === 'wall' ? null : texFrame(nk === 'liquid' ? 'ae_holystone' : Dn && Dn.floor ? Dn.floor : Mn.bank || 'ae_grass_side');
      const FR = face ? 8 : 0, K = [1, 0.93, 0.87, 0.81, 0.75, 0.69, 0.63, 0.58];
      for (let x = 0; x < T; x++) {
        const L = FR + under(x), endCut = (wEnd ? Math.max(0, 4 - x) : 0) + (eEnd ? Math.max(0, x - 11) : 0);
        for (let y = 0; y < Math.min(T, L - endCut * 2); y++) {
          let c;
          if (y < FR) c = mul(face[y * 16 + x] | 0xff000000, K[y]);
          else {
            const k = (y - FR) / Math.max(1, L - FR);
            c = alphaOf(blendCol(mul(holy[(y & 15) * 16 + x] | 0xff000000, 0.62 - k * 0.08), SKY_HAZE, k * 0.55), 255 - k * 150);
          }
          if (y < endCut) continue;
          P.buf[(oy + y) * W + ox + x] = c;
        }
      }
      if (face) shadeRect(P, ox, oy + FR - 1, T, 1, 0.8);
      return;
    }
    if (at(tx, ty - 2) === 'void' || at(tx, ty - 2) === 'wall') return;
    const D2 = blk ? BLOCKS[blk(tx, ty - 2)] : null;
    if (D2 && D2.cloud) return;
    // The tips of the underside, fading out.
    const wEnd = at(tx - 1, ty - 2) === 'void', eEnd = at(tx + 1, ty - 2) === 'void';
    for (let x = 0; x < T; x++) {
      const L = 8 + under(x) - T - (wEnd ? Math.max(0, 6 - x) * 2 : 0) - (eEnd ? Math.max(0, x - 9) * 2 : 0);
      for (let y = 0; y < L && y < T; y++) {
        const k = Math.min(1, (y + 8) / under(x));
        P.buf[(oy + y) * W + ox + x] = alphaOf(blendCol(mul(holy[(y & 15) * 16 + x] | 0xff000000, 0.62 - k * 0.08), SKY_HAZE, k * 0.55), 255 - k * 150);
      }
    }
  }
  /** Edge of an Aether floor tile on the sky: rounded outer corners (rounder, scalloped on clouds), a lit lip, ledges. */
  function skyRim(P, ox, oy, tx, ty, at, cloud) {
    const V = (x, y) => at(x, y) === 'void';
    const n = V(tx, ty - 1), s = V(tx, ty + 1), w = V(tx - 1, ty), e = V(tx + 1, ty);
    if (!n && !s && !w && !e) return;
    const R = cloud ? 5 : 3, W = P.w;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const gx = tx * T + x, gy = ty * T + y;
      let cut = (n && w && x + y < R) || (n && e && T - 1 - x + y < R) || (s && w && x + T - 1 - y < R) || (s && e && 2 * T - 2 - x - y < R);
      if (cloud && !cut) {
        // Scalloped puffs along the open sides.
        const bump = q => (Math.sin(q * 0.55) + Math.sin(q * 0.21 + 2)) > 1.15 ? 1 : 0;
        cut = (n && y < bump(gx)) || (s && T - 1 - y < bump(gx + 7)) || (w && x < bump(gy)) || (e && T - 1 - x < bump(gy + 5));
      }
      if (cut) P.buf[(oy + y) * W + ox + x] = 0;
    }
    if (n) shadeRect(P, ox, oy, T, 1, cloud ? 1.04 : 1.2);
    if (w) shadeRect(P, ox, oy, 1, T, cloud ? 0.94 : 0.84);
    if (e) shadeRect(P, ox + T - 1, oy, 1, T, cloud ? 0.9 : 0.78);
    if (s && !cloud) shadeRect(P, ox, oy + T - 1, T, 1, 0.9);
  }

  function floorMC(P, M, ox, oy, tx, ty, patched, patchedN, at, mix) {
    let spec = M.floor;
    if (patched) spec = pickBand(M.patch, vnoise(tx / 6, ty / 6, 47));
    else if (M.spots) for (const [s, p] of M.spots) if (H(tx, ty, 43) < p) { spec = s; break; }
    put(P, texFrame(spec), orient(spec, tx, ty), ox, oy);
    if (mix) blendEdge(P, ox, oy, tx, ty, mix);
    // El camino / la tierra quedan un poco hundidos: sombra en su borde norte.
    if (patched && spec !== M.floor && !patchedN && at(tx, ty - 1) === 'floor') shadeRect(P, ox, oy, T, 1, 0.72);
    // Flores y plantitas sueltas (no en las manchas).
    if (!patched && M.decal && H(tx, ty, 14) < M.decalP) {
      const d = M.decal[Math.floor(H(tx, ty, 17) * M.decal.length)];
      put(P, texFrame(d), H(tx, ty, 18) < 0.5 ? 0 : 1, ox, oy);
    }
    floorShade(P, ox, oy, tx, ty, at);
  }

  function floorShade(P, ox, oy, tx, ty, at) {
    // Sombra de contacto de la pared que hay justo al norte.
    // (y sombra más suave de las que tiene al oeste y al este).
    if (at(tx, ty - 1) === 'wall') {
      shadeRect(P, ox, oy, T, 1, 0.42); shadeRect(P, ox, oy + 1, T, 1, 0.56); shadeRect(P, ox, oy + 2, T, 1, 0.72); shadeRect(P, ox, oy + 3, T, 1, 0.88);
    }
    if (at(tx - 1, ty) === 'wall') { shadeRect(P, ox, oy, 1, T, 0.7); shadeRect(P, ox + 1, oy, 1, T, 0.86); }
    if (at(tx + 1, ty) === 'wall') shadeRect(P, ox + T - 1, oy, 1, T, 0.8);
    // Borde de una isla del End (vacío al sur, al oeste o al este).
    if (at(tx, ty + 1) === 'void') shadeRect(P, ox, oy + T - 1, T, 1, 1.18);
    if (at(tx - 1, ty) === 'void') shadeRect(P, ox, oy, 1, T, 1.12);
    if (at(tx + 1, ty) === 'void') shadeRect(P, ox + T - 1, oy, 1, T, 0.85);
  }

  function wallMC(P, M, ox, oy, tx, ty, at) {
    const W = (x, y) => at(x, y) === 'wall';
    const n = W(tx, ty - 1), s = W(tx, ty + 1), w = W(tx - 1, ty), e = W(tx + 1, ty);
    const wl = pickWall(M, tx, ty);
    const FACE = s ? 0 : 6;                 // filas de cara frontal visibles
    // Cara de arriba: el bloque visto desde arriba.
    const TOP = T - FACE;
    put(P, texFrame(wl.top), orient(wl.top, tx, ty, 3), ox, oy, M.topK || 1.06, 0, TOP);
    // Bisel de la cara de arriba: contorno oscuro y luz por dentro (norte y
    // oeste), sombra por dentro al este.
    if (!n) { shadeRect(P, ox, oy, T, 1, 0.45); shadeRect(P, ox + (w ? 0 : 1), oy + 1, T - (w ? 0 : 1) - (e ? 0 : 1), 1, 1.22); }
    if (!w) { shadeRect(P, ox, oy + (n ? 0 : 1), 1, TOP - (n ? 0 : 1), 0.45); shadeRect(P, ox + 1, oy + (n ? 0 : 2), 1, TOP - (n ? 0 : 2), 1.12); }
    if (!e) { shadeRect(P, ox + T - 1, oy + (n ? 0 : 1), 1, TOP - (n ? 0 : 1), 0.45); shadeRect(P, ox + T - 2, oy + (n ? 0 : 2), 1, TOP - (n ? 0 : 2), 0.86); }
    if (FACE) {
      // Cara frontal: las filas de arriba de su textura lateral (la franja de
      // hierba de grass_side, por ejemplo), en sombra y más oscura abajo.
      const side = texFrame(wl.side), o = H(tx, 0, 62) < 0.5 ? 0 : 1;
      const K = [0.5, 0.8, 0.76, 0.72, 0.67, 0.58];
      for (let fy = 0; fy < FACE; fy++) put(P, side, o, ox, oy, K[fy], fy, fy + 1, TOP);
      if (!w) shadeRect(P, ox, oy + TOP, 1, FACE, 0.6);
      if (!e) shadeRect(P, ox + T - 1, oy + TOP, 1, FACE, 0.6);
    }
    // Dentro de una masa de roca (cuevas, fortaleza): más oscuro, así se leen
    // los pasillos y las salas. Media sombra en el primer anillo.
    if (M.deep && n && s && w && e) {
      const diag = W(tx - 1, ty - 1) && W(tx + 1, ty - 1) && W(tx - 1, ty + 1) && W(tx + 1, ty + 1);
      const far = diag && W(tx, ty - 2) && W(tx, ty + 2) && W(tx - 2, ty) && W(tx + 2, ty);
      shadeRect(P, ox, oy, T, T, far ? M.deep : diag ? (1 + M.deep) / 2 : 0.85);
    }
  }

  /** Alto (px de arte) de la orilla norte de un charco, para que world.js no la tape al animar. */
  const bankRows = L => (L.tile ? 1 : 3);

  function liquidMC(P, M, L, ox, oy, tx, ty, at) {
    const Lq = (x, y) => at(x, y) === 'liquid';
    const n = Lq(tx, ty - 1), s = Lq(tx, ty + 1), w = Lq(tx - 1, ty), e = Lq(tx + 1, ty);
    if (L.tile) put(P, texFrame(L.tile), orient(L.tile, tx, ty), ox, oy);
    else if (L.alpha >= 1 || !L.bed) put(P, texFrame(L.strip), 0, ox, oy);
    else put(P, texFrame(L.bed), orient(L.bed, tx, ty), ox, oy, 0.62);
    const foam = pack(L.foam || '#ffffff');
    const bank = texFrame(M.bank), BH = bankRows(L);
    // Orilla: el lado del bloque de suelo, que baja hasta el agua (norte), y
    // un labio oscuro en los otros lados; luego una línea de espuma.
    if (!n) for (let r = 0; r < BH; r++) put(P, bank, 0, ox, oy, [0.86, 0.68, 0.5][r], r, r + 1);
    const lip = (x, y) => { const i = (oy + y) * P.w + ox + x; P.buf[i] = mul(bank ? bank[y * 16 + x] | 0xff000000 : P.buf[i], 0.42); };
    for (let q = 0; q < T; q++) {
      if (!w) lip(0, q);
      if (!e) lip(T - 1, q);
      if (!s) lip(q, T - 1);
    }
    const fo = (x, y) => { const i = (oy + y) * P.w + ox + x; P.buf[i] = blendCol(P.buf[i], foam, 0.45); };
    for (let q = 0; q < T; q++) {
      if (!n && q >= (w ? 0 : 1) && q < T - (e ? 0 : 1)) fo(q, BH);
      if (!w && q > (n ? 0 : BH) && q < T - (s ? 0 : 1)) fo(1, q);
      if (!e && q > (n ? 0 : BH) && q < T - (s ? 0 : 1)) fo(T - 2, q);
      if (!s && q > (w ? 0 : 1) && q < T - (e ? 1 : 2)) fo(q, T - 2);
    }
  }

  /**
   * Datos para animar los charcos del bioma (world.js drawLiquid):
   * { cv, frames, fps, alpha, bank, bubbles, flicker } o null si no se anima.
   */
  function liquidStrip(bi) {
    if (!texReady) return null;
    const L = liqStyle(BIOMES[bi]);
    if (L.tile || !L.strip) return { cv: null, bank: bankRows(L) };
    const cv = stripCanvas(L.strip);
    return { cv, frames: cv.frames, fps: L.fps || 8, alpha: L.alpha, bank: bankRows(L), bubbles: !!L.bubbles, flicker: !!L.flicker,
             pad: L.pad ? padCanvas(L.pad) : null };
  }
  /** Nenúfar (u otra planta flotante): lienzo 16×16 para dibujarlo encima del agua animada. */
  function padCanvas(spec) {
    let cv = stripCache.get('pad:' + spec);
    if (cv) return cv;
    const P = Pix(16, 16), src = texFrame(spec);
    for (let i = 0; i < 256; i++) P.buf[i] = src[i];
    cv = P.canvas();
    stripCache.set('pad:' + spec, cv);
    return cv;
  }

  // ---------------- sprites de objetos del escenario ----------------

  const propCache = new Map();          // "bioma/tipo/variante" -> canvas

  function propSprite(bi, type, variant = 0) {
    const k = bi + '/' + type + '/' + variant;
    let cv = propCache.get(k);
    if (!cv) {
      // Sin texturas todavía: el sprite procedural (sólo conoce 2 fases de la hierba y 4 de la grieta).
      if (texReady) {
        cv = MCP[type](BIOMES[bi], variant);
        // Lights (sea lanterns, sea pickles) keep their own colours.
        const tt = BIOMES[bi] && tintOf(BIOMES[bi].mc), lit = type === 'deco' && /^sea_/.test(DECO[variant & 63]);
        if (tt && !lit) tintCanvas(cv, tt);
      } else cv = PAINT[type](BIOMES[bi], type === 'grass' ? variant & 1 : type === 'rift' ? variant & 3 : variant);
      propCache.set(k, cv);
    }
    return cv;
  }

  function disc(P, cx, cy, r, colFn) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) { const c = colFn(x, y, d / r); if (c != null) P.set(x, y, c); }
      }
  }

  function outline(P, col) {
    // Contorno de 1 px alrededor de todo lo opaco.
    const marks = [];
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
      if (P.get(x, y) >>> 24) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
        const xx = x + a, yy = y + b;
        return xx >= 0 && yy >= 0 && xx < P.w && yy < P.h && (P.get(xx, yy) >>> 24);
      });
      if (near) marks.push([x, y]);
    }
    for (const [x, y] of marks) P.set(x, y, col);
  }

  const PAINT = {
    tree(B) {
      const P = Pix(30, 40);
      const L = B.leaf.map(h => pack(h)), Tr = B.trunk.map(h => pack(h));
      const edge = pack('#14200f');
      if (B.prop === 'crystal') return PAINT.crystal(B);
      if (B.prop === 'dead') return PAINT.deadtree(B);
      for (let y = 26; y < 38; y++) for (let x = 13; x < 18; x++) P.set(x, y, Tr[x === 13 || x === 17 ? 0 : 1]);
      P.set(12, 37, Tr[0]); P.set(18, 37, Tr[0]); P.set(11, 38, Tr[0]); P.set(19, 38, Tr[0]);
      const blobs = [[15, 20, 10], [9, 16, 7], [21, 16, 7], [15, 10, 8], [10, 23, 6], [20, 23, 6]];
      for (const [bx, by, br] of blobs) {
        disc(P, bx, by, br, (x, y, d) => {
          // Luz desde arriba a la izquierda.
          const lit = ((x - bx) * -0.6 + (y - by) * -0.8) / br;
          const idx = lit > 0.45 ? 3 : lit > 0.05 ? 2 : lit > -0.45 ? 1 : 0;
          return (H(x, y, 41) < 0.12 && idx > 0) ? L[idx - 1] : L[idx];
        });
      }
      outline(P, edge);
      return P.canvas();
    },

    crystal(B) {
      const P = Pix(26, 40);
      const L = B.leaf.map(h => pack(h)), D = B.trunk.map(h => pack(h));
      const spires = [[13, 2, 5, 38], [7, 14, 4, 38], [19, 12, 4, 38]];
      for (const [cx, top, half, bot] of spires) {
        for (let y = top; y <= bot; y++) {
          const t = Math.min(1, (y - top) / 8);
          const hw = Math.round(half * t);
          for (let x = cx - hw; x <= cx + hw; x++) {
            const side = x < cx ? (x === cx - hw ? 3 : 2) : x === cx ? 1 : 0;
            P.set(x, y, side >= 2 ? L[side] : y > bot - 4 ? D[1] : L[side]);
          }
        }
      }
      outline(P, D[0]);
      return P.canvas();
    },

    deadtree(B) {
      const P = Pix(28, 40);
      const Tr = B.trunk.map(h => pack(h)), L = B.leaf.map(h => pack(h));
      for (let y = 12; y < 38; y++) for (let x = 12; x < 16; x++) P.set(x, y, Tr[x < 14 ? 0 : 1]);
      const branch = (x0, y0, dx, len) => {
        for (let i = 0; i < len; i++) { P.set(x0 + dx * i, y0 - i, L[1]); P.set(x0 + dx * i, y0 - i + 1, L[0]); }
      };
      branch(12, 20, -1, 9); branch(15, 17, 1, 10); branch(13, 13, -1, 7); branch(14, 12, 1, 6);
      outline(P, pack('#0f0b09'));
      return P.canvas();
    },

    rock(B, variant) {
      const P = Pix(22, 17);
      const R = B.rock.map(h => pack(h));
      const shine = pack('#ffffff');
      // Peñasco achatado: elipse más ancha que alta, base plana.
      for (let y = 2; y <= 15; y++) for (let x = 1; x <= 20; x++) {
        const nx = (x - 10.5) / 9.5, ny = (y - 9.5) / 7;
        const d = nx * nx + ny * ny + (H(x, y, 61) - 0.5) * 0.08;
        if (d > 1) continue;
        const lit = -nx * 0.55 - ny * 0.85 + (H(x, y, 62) - 0.5) * 0.25;
        let c = R[lit > 0.4 ? 2 : lit > -0.15 ? 1 : 0];
        if (y >= 14) c = R[0];
        P.set(x, y, c);
      }
      // Brillo y textura.
      [[6, 5], [7, 5], [6, 6], [8, 4]].forEach(([x, y]) => P.set(x, y, shine));
      [[13, 8], [14, 9], [9, 11], [16, 11], [11, 7]].forEach(([x, y]) => P.set(x, y, R[0]));
      // Grietas en la variante dañada.
      if (variant === 1) {
        const dark = pack('#1b1d22');
        [[9, 4], [10, 5], [10, 6], [11, 7], [10, 8], [12, 8], [13, 9], [8, 9], [7, 10]].forEach(([x, y]) => P.set(x, y, dark));
      }
      outline(P, pack('#17191d'));
      return P.canvas();
    },

    grass(B, variant) {
      // Matojo de hojas en abanico: cada hoja es una curva que se inclina
      // hacia fuera, con la base oscura y la punta clara. La variante 1 es el
      // fotograma "mecido por el viento".
      const P = Pix(20, 17);
      const Gc = B.grass.map(h => pack(h));
      const dark = pack(B.speck);
      const sway = variant === 1 ? 1.2 : 0;
      const blades = 11;
      // Primero las de atrás (más oscuras), luego las de delante.
      for (let pass = 0; pass < 2; pass++) {
        for (let b = pass; b < blades; b += 2) {
          const t = b / (blades - 1);                     // 0 izquierda .. 1 derecha
          const x0 = 3 + t * 13 + (H(b, 7, 52) - 0.5) * 2;
          const hgt = 8 + Math.floor(H(b, 3, 51) * 6) + (Math.abs(t - 0.5) < 0.25 ? 3 : 0);
          const lean = (t - 0.5) * 7 + sway * (0.6 + H(b, 1, 53));
          for (let i = 0; i <= hgt; i++) {
            const k = i / hgt;
            const x = Math.round(x0 + lean * k * k);
            const y = 16 - i;
            let c = k > 0.78 ? Gc[2] : k > 0.25 ? Gc[1] : Gc[0];
            if (pass === 0 && k <= 0.78) c = Gc[0];
            P.set(x, y, c);
            if (i < hgt * 0.45) P.set(x + 1, y, k < 0.15 ? dark : Gc[0]);
          }
        }
      }
      outline(P, pack('#0e1d0c'));
      return P.canvas();
    },

    // ---------- objetos interactivos ----------

    /** Altar de poder. variante = efecto*2 + (usado ? 1 : 0). */
    altar(B, variant) {
      const P = Pix(18, 27);
      const R = B.rock.map(h => pack(h));
      const eff = variant >> 1, used = variant & 1;
      const ORB = [['#ff5f6d', '#c23a4b', '#ffd3d8'], ['#5fd4ff', '#2a8fd0', '#d8f6ff'],
                   ['#ff8ad8', '#b03d84', '#ffe0f4'], ['#ffd23f', '#c08a10', '#fff3b0']][eff];
      const O = (used ? ['#6b7380', '#4a505c', '#9aa2ae'] : ORB).map(h => pack(h));
      // Escalones, columna y losa.
      for (let y = 21; y <= 25; y++) for (let x = 1; x <= 16; x++) P.set(x, y, R[y === 21 ? 2 : y >= 24 ? 0 : 1]);
      for (let y = 12; y <= 20; y++) for (let x = 5; x <= 12; x++) P.set(x, y, R[x === 5 ? 2 : x >= 11 ? 0 : 1]);
      for (let y = 10; y <= 11; y++) for (let x = 3; x <= 14; x++) P.set(x, y, R[y === 10 ? 2 : 1]);
      // Runas de su color en la columna.
      [[7, 14], [8, 15], [10, 14], [9, 17], [7, 18], [10, 18]].forEach(([x, y]) => P.set(x, y, O[1]));
      // Orbe.
      disc(P, 8.5, 5.5, 4.2, (x, y, d) => {
        const lit = (8.5 - x) * 0.5 + (5.5 - y) * 0.7;
        return lit > 1.6 ? O[2] : d > 0.75 ? O[1] : O[0];
      });
      outline(P, pack('#120e1a'));
      return P.canvas();
    },

    /** Manantial curativo. variante 1 = agotado. */
    spring(B, variant) {
      const P = Pix(34, 16);
      const R = B.rock.map(h => pack(h));
      const W = (variant ? ['#2f5f68', '#3a6f7a', '#4f8a92'] : ['#2ba8b8', '#5fe8d8', '#b8fff4']).map(h => pack(h));
      for (let y = 0; y < 16; y++) for (let x = 0; x < 34; x++) {
        const nx = (x - 16.5) / 16.5, ny = (y - 8) / 7.5;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        if (d > 0.62) { P.set(x, y, R[(H(x, y, 71) < 0.5 ? 1 : 0) + (ny < -0.2 ? 1 : 0)]); continue; }
        const wave = Math.sin(x * 0.7 + y * 1.3) > 0.6;
        P.set(x, y, d < 0.18 ? W[2] : wave ? W[2] : d < 0.4 ? W[1] : W[0]);
      }
      if (!variant) [[10, 6], [11, 5], [22, 9], [23, 8], [16, 11]].forEach(([x, y]) => P.set(x, y, pack('#ffffff')));
      outline(P, pack('#14161c'));
      return P.canvas();
    },

    /** Cofre grande con candado. */
    bigchest() {
      const P = Pix(24, 20);
      const wood = pack('#6b3a1e'), woodL = pack('#8e5329'), woodD = pack('#432210');
      const iron = pack('#9aa6b5'), ironD = pack('#5d6773'), gold = pack('#f2c443'), goldD = pack('#b5832a');
      for (let y = 2; y < 19; y++) for (let x = 1; x < 23; x++) {
        let c = y < 8 ? woodL : wood;
        if (y === 8 || y === 9) c = ironD;
        if (x === 1 || x === 22 || y === 18) c = woodD;
        if (x === 5 || x === 6 || x === 17 || x === 18) c = (x === 5 || x === 17) ? iron : ironD;
        if (y === 2 && x > 1 && x < 22) c = iron;
        P.set(x, y, c);
      }
      // Candado.
      for (let x = 10; x <= 13; x++) { P.set(x, 5, iron); }
      P.set(9, 6, iron); P.set(14, 6, iron); P.set(9, 7, iron); P.set(14, 7, iron);
      for (let y = 8; y <= 13; y++) for (let x = 8; x <= 15; x++) P.set(x, y, (x + y) % 4 ? gold : goldD);
      P.set(11, 10, woodD); P.set(12, 10, woodD); P.set(11, 11, woodD); P.set(11, 12, woodD);
      outline(P, pack('#1e0f06'));
      return P.canvas();
    },

    /** Trampa de Mundo Misterioso. variante: 0 veneno · 1 pegajosa · 2 explosiva. */
    trap(B, variant) {
      const P = Pix(14, 14);
      const COL = [['#b45ec4', '#e6a3f0'], ['#8bd94a', '#d2ff9a'], ['#ff7b3d', '#ffd08a']][variant];
      const c = pack(COL[0]), l = pack(COL[1]);
      const base = pack('#2a2238'), baseL = pack('#3b3150');
      for (let y = 1; y < 13; y++) for (let x = 1; x < 13; x++) {
        const edge = x === 1 || y === 1 || x === 12 || y === 12;
        P.set(x, y, edge ? c : (x + y) % 2 ? base : baseL);
      }
      const sym = [
        // veneno: calavera de puntos
        [[5, 4], [6, 4], [7, 4], [8, 4], [4, 5], [9, 5], [4, 6], [6, 6], [7, 6], [9, 6], [5, 7], [8, 7], [5, 8], [6, 8], [7, 8], [8, 8], [5, 9], [8, 9]],
        // pegajosa: gotas
        [[4, 4], [4, 5], [3, 6], [5, 6], [4, 7], [8, 5], [8, 6], [7, 7], [9, 7], [8, 8], [6, 9], [5, 10], [7, 10], [6, 11]],
        // explosiva: mina
        [[6, 3], [7, 3], [5, 4], [8, 4], [4, 5], [9, 5], [4, 6], [6, 6], [7, 6], [9, 6], [4, 7], [6, 7], [7, 7], [9, 7], [4, 8], [9, 8], [5, 9], [8, 9], [6, 10], [7, 10]]
      ][variant];
      for (const [x, y] of sym) P.set(x, y, l);
      outline(P, pack('#0c0812'));
      return P.canvas();
    },

    deco(B) { return PAINT.rock(B, 0); },

    /** Grieta hacia la arena del legendario. variante = fotograma 0..3. */
    rift(B, variant) {
      const P = Pix(30, 46);
      const glow = pack('#7b3cff'), mid = pack('#b48aff'), core = pack('#140a26'), white = pack('#f2e6ff');
      for (let y = 2; y < 44; y++) {
        const t = (y - 2) / 42;
        const w = Math.sin(t * Math.PI) * 9 + 1;
        const off = Math.round(Math.sin(t * 9 + variant * 1.6) * 2.2 + (H(y, variant, 91) - 0.5) * 2);
        for (let x = -Math.ceil(w) - 2; x <= Math.ceil(w) + 2; x++) {
          const ax = Math.abs(x) / w;
          const px = 15 + x + off;
          if (ax <= 0.45) P.set(px, y, core);
          else if (ax <= 0.75) P.set(px, y, H(px, y, 92 + variant) < 0.15 ? white : mid);
          else if (ax <= 1.15 || H(px, y, 93 + variant) < 0.3) P.set(px, y, glow);
        }
      }
      // Chispas en el centro.
      for (let i = 0; i < 6; i++) P.set(13 + Math.floor(H(i, variant, 94) * 5), 8 + Math.floor(H(i, variant, 95) * 30), white);
      return P.canvas();
    },

    chest() {
      const P = Pix(16, 14);
      const gold = pack('#f2c443'), goldD = pack('#b5832a'), wood = pack('#8a4f2a'), woodD = pack('#5e3418');
      const lid = pack('#c4662e');
      for (let y = 2; y < 13; y++) for (let x = 1; x < 15; x++) {
        let c = y < 6 ? lid : wood;
        if (y === 6) c = goldD;
        if (x === 1 || x === 14) c = woodD;
        if ((x === 4 || x === 11) && y > 1) c = y < 6 ? gold : goldD;
        if (y === 12) c = woodD;
        P.set(x, y, c);
      }
      for (let x = 6; x < 10; x++) for (let y = 5; y < 9; y++) P.set(x, y, (x + y) % 3 ? gold : goldD);
      outline(P, pack('#2a160a'));
      return P.canvas();
    }
  };

  // ---------------- objetos con texturas de Minecraft ----------------
  /*
   * Bloques vistos desde la cámara 3/4: cara de arriba (textura aplastada en
   * vertical) y cara frontal más oscura. Mismo tamaño y ancla abajo-centro que
   * los sprites procedurales, para que los radios de choque sigan cuadrando.
   */

  /** Copia (sx,sy,sw,sh) de una textura a (dx,dy,dw,dh) por vecino más cercano; sw > 16 repite. */
  function blitTex(P, src, sx, sy, sw, sh, dx, dy, dw, dh, k = 1, flip = false) {
    if (!src) return;
    for (let y = 0; y < dh; y++) {
      const ty = (sy + Math.floor(y * sh / dh)) & 15;
      for (let x = 0; x < dw; x++) {
        const xx = flip ? dw - 1 - x : x;
        const tx = (sx + Math.floor(xx * sw / dw)) & 15;
        let s = src[ty * 16 + tx];
        if (!(s >>> 24)) continue;
        if (k !== 1) s = mul(s, k);
        const px = dx + x, py = dy + y;
        if (px < 0 || py < 0 || px >= P.w || py >= P.h) continue;
        P.buf[py * P.w + px] = over(P.buf[py * P.w + px], s);
      }
    }
  }
  /** Cubo: cara superior (top, aplastada a th filas) + cara frontal (side, fh filas). */
  function cube(P, top, side, x, y, w, th, fh, o = {}) {
    blitTex(P, texFrame(top), 0, 0, o.wrap ? w : 16, 16, x, y, w, th, o.kTop || 1);
    blitTex(P, texFrame(side), 0, o.sideY || 0, o.wrap ? w : 16, o.wrapY ? fh : (o.sideH || 16), x, y + th, w, fh, o.kFace || 0.72);
    shadeRect(P, x, y + th, w, 1, 0.8);                    // arista entre las dos caras
    if (o.rim !== false) shadeRect(P, x, y, w, 1, 1.15);  // luz en la arista de atrás
  }
  /** Una planta / objeto de 16×16 con transparencia, tal cual. */
  const plant = (P, spec, x, y, k = 1, flip = false) => blitTex(P, texFrame(spec), 0, 0, 16, 16, x, y, 16, 16, k, flip);
  /** Color medio (opaco) de una textura, oscurecido: para el contorno. */
  function darkOf(spec, k = 0.28) {
    const s = texFrame(spec);
    let r = 0, g = 0, b = 0, n = 0;
    if (s) for (const c of s) if (c >>> 24) { r += c & 255; g += (c >>> 8) & 255; b += (c >>> 16) & 255; n++; }
    if (!n) return pack('#141414');
    return ((0xff << 24) | (((b / n) * k) << 16) | (((g / n) * k) << 8) | ((r / n) * k)) >>> 0;
  }

  /** Tronco de log_* (w px de ancho) con su sombreado. */
  function trunk(P, log, x, y, w, h) {
    blitTex(P, texFrame(log), 8 - (w >> 1), 0, w, 16, x, y, w, h);
    shadeRect(P, x, y, 1, h, 1.12); shadeRect(P, x + w - 2, y, 2, h, 0.72);
    shadeRect(P, x, y, w, 3, 0.55);                        // sombra de la copa en el tronco
  }
  /** Copa de roble: piso de abajo (ancho wl) y de arriba (wu), cara superior + frontal. */
  function canopy(P, leaves, ox, oy, wl = 28, wu = 16) {
    const xu = ox + ((wl - wu) >> 1);
    blitTex(P, leaves, 0, 0, wl, 10, ox, oy + 8, wl, 10, 1);
    blitTex(P, leaves, 3, 5, wl, 10, ox, oy + 18, wl, 10, 0.66);
    blitTex(P, leaves, 7, 2, wu, 7, xu, oy + 1, wu, 7, 1.1);
    blitTex(P, leaves, 2, 9, wu, 5, xu, oy + 8, wu, 5, 0.8);
    shadeRect(P, ox, oy + 18, wl, 1, 0.75); shadeRect(P, xu, oy + 8, wu, 1, 0.8);
  }
  /** Nieve sobre las caras de arriba: [y0, y1, x0, x1]. */
  function snowOn(P, rects) {
    const white = pack('#f4fbff');
    for (const [y0, y1, x0, x1] of rects)
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
        if ((P.get(x, y) >>> 24) && H(x, y, 81) < 0.75 - (y - y0) * 0.12) P.set(x, y, white);
  }
  function vines(P, o, xs, y0) {
    if (!o.vine) return;
    const v = texFrame(o.vine);
    for (const vx of xs) blitTex(P, v, vx & 15, 0, 3, 16, vx, y0, 3, 8 + ((vx * 7) % 7), 0.8);
  }
  /** Bloque pequeño (8×8) con la cara derecha en sombra: planta del coro. */
  function miniBlock(P, spec, x, y, k = 1) {
    blitTex(P, texFrame(spec), 0, 0, 16, 16, x, y, 8, 8, k);
    shadeRect(P, x + 6, y, 2, 8, 0.72); shadeRect(P, x, y + 7, 8, 1, 0.7); shadeRect(P, x, y, 8, 1, 1.15);
  }

  const TREE = {
    /** Roble / abedul / cerezo: tronco y copa de dos pisos. */
    oak(o) {
      const P = Pix(30, 40);
      trunk(P, o.log, 12, 26, 6, 14);
      canopy(P, texFrame(o.leaves), 1, 0);
      if (o.snow) snowOn(P, [[8, 13, 1, 29], [1, 5, 7, 23]]);
      vines(P, o, [3, 9, 20, 25], 18);
      return P;
    },
    /** Roble oscuro: copa más ancha y tronco grueso. */
    wide(o) {
      const P = Pix(36, 40);
      trunk(P, o.log, 13, 25, 10, 15);
      canopy(P, texFrame(o.leaves), 1, 0, 34, 22);
      return P;
    },
    /** Abeto: pisos de hojas cada vez más estrechos. */
    spruce(o) {
      const P = Pix(30, 50), lv = texFrame(o.leaves);
      trunk(P, o.log, 12, 38, 6, 12);
      const tiers = [[28, 29], [22, 21], [16, 13], [10, 6], [4, 1]];
      for (const [w, y] of tiers) {
        const x = (30 - w) >> 1;
        blitTex(P, lv, (y * 3) & 15, 0, w, 6, x, y, w, 5, 1.05);
        blitTex(P, lv, 3, 6, w, 5, x, y + 5, w, Math.min(5, w >> 2) + 1, 0.64);
        shadeRect(P, x, y + 5, w, 1, 0.75);
      }
      if (o.snow) snowOn(P, tiers.map(([w, y]) => [y, y + 4, (30 - w) >> 1, ((30 - w) >> 1) + w]));
      return P;
    },
    /** Acacia: tronco inclinado y copa plana. */
    acacia(o) {
      const P = Pix(34, 40), lg = texFrame(o.log), lv = texFrame(o.leaves);
      for (let k = 0; k < 24; k++) {
        const y = 39 - k, x = 13 + Math.round(Math.max(0, k - 6) * 0.4);
        blitTex(P, lg, 6, k & 15, 5, 1, x, y, 5, 1, k < 3 ? 0.55 : 1);
        P.buf[y * P.w + x + 4] = mul(P.buf[y * P.w + x + 4], 0.7);
      }
      for (let k = 0; k < 9; k++) blitTex(P, lg, 6, k & 15, 4, 1, 13 - Math.round(k * 0.7), 27 - k, 4, 1, 0.9);
      blitTex(P, lv, 0, 0, 30, 7, 3, 9, 30, 6, 1.05);
      blitTex(P, lv, 3, 7, 30, 4, 3, 15, 30, 3, 0.64);
      blitTex(P, lv, 5, 3, 14, 5, 1, 14, 14, 4, 1.05);
      blitTex(P, lv, 2, 8, 14, 3, 1, 18, 14, 2, 0.64);
      shadeRect(P, 3, 15, 30, 1, 0.75); shadeRect(P, 1, 18, 14, 1, 0.75);
      return P;
    },
    /** Jungla: tronco alto y grueso, copa arriba y lianas. */
    tall(o) {
      const P = Pix(30, 56);
      trunk(P, o.log, 11, 26, 8, 30);
      canopy(P, texFrame(o.leaves), 1, 0);
      vines(P, o, [3, 8, 21, 25], 18);
      return P;
    },
    /** Arbusto (azalea): un solo piso de hojas sobre un tronco corto. */
    bush(o) {
      const P = Pix(30, 30), lv = texFrame(o.leaves);
      trunk(P, o.log, 12, 22, 6, 8);
      blitTex(P, lv, 0, 0, 28, 10, 1, 3, 28, 10, 1.05);
      blitTex(P, lv, 3, 6, 28, 10, 1, 13, 28, 10, 0.66);
      shadeRect(P, 1, 13, 28, 1, 0.75);
      vines(P, o, [4, 22], 18);
      return P;
    }
  };

  const OBJ = {
    /** Árbol de Minecraft; o.shape elige la forma (oak por defecto). */
    tree(o) {
      const P = (TREE[o.shape] || TREE.oak)(o);
      outline(P, darkOf(o.leaves, 0.3));
      return P.canvas();
    },

    /** Champiñón gigante: rojo (cúpula) o marrón (plano). */
    mushroom(o) {
      const P = Pix(30, 40);
      blitTex(P, texFrame(o.stem), 4, 0, 8, 16, 11, 20, 8, 20);
      shadeRect(P, 17, 20, 2, 20, 0.72); shadeRect(P, 11, 20, 8, 3, 0.5);
      if (o.flat) cube(P, o.cap, o.cap, 0, 10, 30, 10, 5, { wrap: true, wrapY: true, kFace: 0.72 });
      else {
        cube(P, o.cap, o.cap, 2, 9, 26, 7, 9, { wrap: true, wrapY: true, kFace: 0.72 });
        cube(P, o.cap, o.cap, 6, 3, 18, 6, 4, { wrap: true, wrapY: true, kFace: 0.8 });
      }
      outline(P, darkOf(o.cap, 0.3));
      return P.canvas();
    },

    /** Planta del coro: columna y ramas de bloques pequeños, con flores arriba. */
    chorus(o) {
      const P = Pix(30, 50);
      for (let y = 42; y >= 10; y -= 8) miniBlock(P, o.plant, 11, y);
      miniBlock(P, o.plant, 3, 26); miniBlock(P, o.plant, 3, 18);
      miniBlock(P, o.plant, 19, 34); miniBlock(P, o.plant, 19, 26);
      miniBlock(P, o.flower, 11, 2, 1.1); miniBlock(P, o.flower, 3, 10, 1.1); miniBlock(P, o.flower, 19, 18, 1.1);
      outline(P, pack('#1e0f24'));
      return P.canvas();
    },

    /** Pilar de obsidiana pequeño (decoración del End; las torres de verdad son de world.js). */
    tower(o) {
      const P = Pix(24, 56);
      blitTex(P, texFrame(o.side), 0, 0, 20, 42, 2, 14, 20, 42, 0.8);
      shadeRect(P, 2, 14, 1, 42, 1.25); shadeRect(P, 20, 14, 2, 42, 0.7);
      blitTex(P, texFrame(o.top), 0, 0, 16, 16, 2, 8, 20, 6, 1.05);
      shadeRect(P, 2, 14, 20, 1, 0.7);
      cube(P, 'bedrock', 'bedrock', 8, 3, 8, 3, 3, { kFace: 0.7 });
      outline(P, pack('#0a0612'));
      return P.canvas();
    },

    /** Pila de plantas recortadas (caña de azúcar): n de alto. */
    stack(o) {
      const n = o.n || 3, P = Pix(18, 16 + (n - 1) * 13);
      for (let k = 0; k < n; k++) plant(P, o.plant, 1, P.h - 16 - k * 13, 1 - k * 0.04, k & 1);
      outline(P, darkOf(o.plant, 0.35));
      return P.canvas();
    },

    /** Hongo carmesí gigante: tallo y sombrero de bloque de verruga con luces. */
    fungus(o) {
      const P = Pix(28, 40);
      blitTex(P, texFrame(o.stem), 4, 0, 6, 16, 11, 22, 6, 18);
      shadeRect(P, 15, 22, 2, 18, 0.7); shadeRect(P, 11, 22, 6, 2, 0.5);
      cube(P, o.cap, o.cap, 1, 8, 26, 8, 9, { wrap: true, wrapY: true, kFace: 0.7 });
      cube(P, o.cap, o.cap, 6, 2, 16, 5, 4, { wrap: true, wrapY: true, kFace: 0.78 });
      const L = texFrame(o.light);
      for (const [x, y] of [[4, 18], [19, 19], [11, 21], [9, 4], [17, 12], [3, 10]]) blitTex(P, L, x & 15, y & 15, 2, 2, x, y, 2, 2);
      // Enredaderas colgando del sombrero.
      const vc = o.vines || ['#7a1414', '#a82020'], vine = pack(vc[0]), vine2 = pack(vc[1]);
      for (const vx of [2, 7, 22, 24]) for (let y = 25; y < 25 + 3 + (vx % 5); y++) P.set(vx, y, y % 2 ? vine : vine2);
      outline(P, pack('#1a0606'));
      return P.canvas();
    },

    /** Columna de un bloque de ancho y dos de alto (cactus, hueso, púrpura...), con algo encima. */
    pillar(o) {
      const w = o.w || 16, P = Pix(w + 2, 42);
      const top = o.crown ? 10 : 2;
      // Cara frontal a escala 1:1 en vertical: dos bloques apilados.
      blitTex(P, texFrame(o.side), 0, 0, 16, 34 - top, 1, top + 8, w, 34 - top, 0.78);
      shadeRect(P, 1, 25, w, 1, 0.8);
      for (let y = top + 8; y < 41; y++) { P.buf[y * P.w + 1] = mul(P.buf[y * P.w + 1], 1.25); P.buf[y * P.w + w] = mul(P.buf[y * P.w + w], 0.75); }
      blitTex(P, texFrame(o.top), 0, 0, 16, 16, 1, top, w, 8, 1.05);
      shadeRect(P, 1, top + 8, w, 1, 0.75);
      if (o.crown) plant(P, o.crown, (w + 2 - 16) >> 1, top - 11);
      if (o.lantern) lantern(P, o.lantern, (w + 2) >> 1, top + 3);
      outline(P, darkOf(o.side, 0.25));
      return P.canvas();
    },

    /** Árbol muerto: tronco y ramas peladas del mismo tronco. */
    dead(o) {
      const P = Pix(30, 40), lg = texFrame(o.log);
      trunk(P, o.log, 12, 16, 6, 24);
      const branch = (x0, y0, dx, len, wd) => {
        for (let k = 0; k < len; k++) blitTex(P, lg, 5, (k * 3) & 15, wd, 2, x0 + Math.round(dx * k), y0 - k * 2, wd, 2, k ? 0.9 : 0.7);
      };
      branch(12, 26, -1.1, 6, 3); branch(16, 22, 1.2, 6, 3); branch(13, 17, -0.6, 7, 2); branch(15, 16, 0.7, 6, 2);
      branch(5, 15, -0.4, 3, 2); branch(23, 11, 0.5, 3, 2);
      outline(P, darkOf(o.log, 0.3));
      return P.canvas();
    },

    /** Estalagmita: punta, tronco y base de espeleotema puntiagudo, apilados. */
    dripstone(o) {
      const n = o.n || 3, P = Pix(18, 14 + n * 12);
      const parts = n >= 3 ? ['pointed_dripstone_up_tip', 'pointed_dripstone_up_frustum', 'pointed_dripstone_up_middle', 'pointed_dripstone_up_base']
                           : ['pointed_dripstone_up_tip', 'pointed_dripstone_up_frustum', 'pointed_dripstone_up_base'];
      parts.forEach((p, k) => plant(P, p, 1, k * 12 - 2 + (n >= 3 ? 0 : 0), 1 - k * 0.06));
      outline(P, pack('#2a1e16'));
      return P.canvas();
    },

    /** Racimo: plantas de 16×16 (amatista, coral...) sobre un bloque. */
    cluster(o) {
      const P = Pix(26, 40);
      const base = o.base ? 28 : 40;
      if (o.base) cube(P, o.base, o.base, 3, 28, 20, 5, 7, { kFace: 0.68 });
      const [a, b, c] = o.plants;
      plant(P, a, -2, base - 18, 0.8, true);
      plant(P, b, 11, base - 17, 0.9);
      plant(P, c, 5, base - 15);
      // Un segundo piso del racimo principal, para que tenga la altura de un árbol.
      plant(P, c, 5, base - 26, 1.08, true);
      outline(P, darkOf(o.plants[2], 0.3));
      return P.canvas();
    },

    /** Kelp clump: three strands of kelp_a segments (o.n tall) topped with kelp_top, rooted in a gravel mound. */
    kelp(o) {
      const n = o.n || 3, P = Pix(30, 20 + n * 11);
      for (const [x, m, k, s] of [[0, Math.max(1, n - 1), 0.8, 1], [13, n, 1, 0], [6, Math.max(1, n - 2), 0.9, 2]]) kelpStrand(P, x, P.h - 4, m, k, s, 0);
      cube(P, 'gravel', 'gravel', 5, P.h - 6, 20, 3, 3, { wrap: true, wrapY: true, kFace: 0.6 });
      outline(P, darkOf('kelp_a', 0.35));
      return P.canvas();
    }
  };
  /**
   * One kelp strand from its root (x, y = bottom) up: m segments of kelp_a, 11 px apart, and kelp_top.
   * sway: the top bends sideways (0 straight; the deco kelp animates it), s = texture frame salt.
   */
  function kelpStrand(P, x, y, m, k, s, sway) {
    for (let i = 0; i <= m; i++) {
      const dx = Math.round(Math.sin(sway + i * 0.9) * i * 0.6 * (sway ? 1 : 0));
      const f = (i * 7 + s * 5) % 20;
      blitTex(P, texFrame(i === m ? 'kelp_top' : 'kelp_a', f), 0, 0, 16, 16, x + dx, y - 16 - i * 11, 16, 16, k * (0.8 + 0.2 * i / Math.max(1, m)), (i + s) & 1);
    }
  }

  /** Farol (lantern / soul_lantern): el cuerpo de su textura de modelo (6×9), centrado en x con la base en y. */
  function lantern(P, spec, x, y) {
    const src = texFrame(spec);
    blitTex(P, src, 0, 0, 6, 9, x - 3, y - 9, 6, 9, 1.1);
    blitTex(P, src, 11, 0, 3, 5, x - 1, y - 14, 3, 5);              // cadena
  }

  // ---------------- props de decoración (world.js: tipo 'deco', p.kind = índice en DECO) ----------------
  const DECO = ['post', 'web', 'dripstone', 'amethyst', 'berries', 'torch', 'soul_torch', 'lantern', 'sensor', 'shrieker', 'bars',
                'spawner', 'candle', 'catalyst', 'chain_lantern', 'kelp', 'sea_lantern', 'sea_pickle',
                'ambrosium', 'zanite', 'gravitite', 'icestone', 'ae_pillar'];
  const DECO_TEX = {
    post: ['log_oak', 'log_oak_top', 'planks_oak'], web: ['web'], amethyst: ['amethyst_cluster', 'small_amethyst_bud', 'budding_amethyst'],
    dripstone: ['pointed_dripstone_up_tip', 'pointed_dripstone_up_frustum', 'pointed_dripstone_up_middle', 'pointed_dripstone_up_base'],
    berries: ['cave_vines_head_berries', 'cave_vines_body_berries', 'moss_block'], torch: ['torch_on'], soul_torch: ['soul_torch'],
    lantern: ['soul_lantern', 'deepslate/polished_deepslate', 'deepslate/deepslate_bricks'],
    sensor: ['sculk_sensor_top', 'sculk_sensor_side', 'sculk_sensor_tendril_inactive'], shrieker: ['sculk_shrieker_top', 'sculk_shrieker_side'],
    bars: ['iron_bars'], spawner: ['mob_spawner'], candle: ['candles/candle_lit', 'candles/black_candle_lit'],
    catalyst: ['sculk_catalyst_top', 'sculk_catalyst_side'], chain_lantern: ['lantern', 'chain1', 'cobblestone'],
    kelp: ['kelp_a', 'kelp_top'], sea_lantern: ['sea_lantern', 'prismarine_dark'], sea_pickle: ['sea_pickle'],
    ambrosium: ['ae_ambrosium_ore', 'ae_holystone'], zanite: ['ae_zanite_ore', 'ae_holystone'], gravitite: ['ae_gravitite_ore'],
    icestone: ['ae_icestone'], ae_pillar: ['ae_angelic_stone', 'ae_angelic_trim']
  };
  /** A gem shard standing on (cx, yb): h tall, half-width `half`, lit from the left (pal: dark, mid, light). */
  function shard(P, cx, yb, half, h, pal) {
    const C = pal.map(c => pack(c));
    for (let y = yb - h; y <= yb; y++) {
      const hw = Math.min(half, (y - (yb - h)) * 0.6);
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) P.set(x, y, x < cx - 0.3 ? C[2] : x > cx + 0.3 ? C[0] : C[1]);
    }
    P.set(Math.round(cx), yb - h, C[2]);
  }
  const DECO_DRAW = {
    /** Puntal de mina: poste de roble con su viga de tablones. */
    post() {
      const P = Pix(22, 44);
      blitTex(P, texFrame('log_oak'), 4, 0, 8, 16, 7, 10, 8, 34, 0.85);
      shadeRect(P, 7, 10, 1, 34, 1.2); shadeRect(P, 13, 10, 2, 34, 0.7);
      cube(P, 'planks_oak', 'planks_oak', 1, 2, 20, 5, 5, { wrap: true, kFace: 0.7 });
      return P;
    },
    web() { const P = Pix(20, 18); plant(P, 'web', 2, 1); return P; },
    dripstone() { return null; },
    amethyst() {
      const P = Pix(22, 20);
      plant(P, 'small_amethyst_bud', -3, 3, 0.85, true); plant(P, 'amethyst_cluster', 3, 2); plant(P, 'small_amethyst_bud', 9, 4, 0.9);
      return P;
    },
    berries() { const P = Pix(20, 20); plant(P, 'cave_vines_body_berries', 2, 2); plant(P, 'cave_vines_head_berries', 2, -6, 1.05); return P; },
    torch() { const P = Pix(18, 18); plant(P, 'torch_on', 1, 2); return P; },
    soul_torch() { const P = Pix(18, 18); plant(P, 'soul_torch', 1, 2); return P; },
    /** Farol de alma sobre un pilar de pizarra profunda. */
    lantern() {
      const P = Pix(14, 40);
      blitTex(P, texFrame('deepslate/deepslate_bricks'), 0, 0, 12, 16, 1, 22, 12, 18, 0.78);
      blitTex(P, texFrame('deepslate/polished_deepslate'), 0, 0, 16, 16, 1, 17, 12, 5, 1.1);
      shadeRect(P, 1, 22, 12, 1, 0.7);
      lantern(P, 'soul_lantern', 7, 19);
      return P;
    },
    /** Sensor de sculk: losa con sus antenas. */
    sensor() {
      const P = Pix(18, 22);
      cube(P, 'sculk_sensor_top', 'sculk_sensor_side', 1, 11, 16, 6, 5, { sideY: 8, sideH: 8, kFace: 0.8 });
      const t = texFrame('sculk_sensor_tendril_inactive');
      blitTex(P, t, 0, 0, 16, 16, 1, 0, 16, 14);
      return P;
    },
    /** Chillador de sculk: losa con la boca de hueso. */
    shrieker() {
      const P = Pix(20, 18);
      cube(P, 'sculk_shrieker_top', 'sculk_shrieker_side', 1, 2, 18, 9, 6, { sideY: 8, sideH: 8, kFace: 0.8 });
      return P;
    },
    bars() {
      const P = Pix(18, 30), b = texFrame('iron_bars');
      blitTex(P, b, 0, 0, 16, 16, 1, 0, 16, 15); blitTex(P, b, 0, 0, 16, 16, 1, 14, 16, 16, 0.85);
      return P;
    },
    spawner() { const P = Pix(20, 20); cube(P, 'mob_spawner', 'mob_spawner', 1, 1, 18, 7, 11, { kFace: 0.85 }); return P; },
    candle() {
      const P = Pix(16, 16);
      plant(P, 'candles/candle_lit', -4, 0); plant(P, 'candles/black_candle_lit', 2, 2, 0.9); plant(P, 'candles/candle_lit', 0, 3);
      return P;
    },
    catalyst() { const P = Pix(20, 20); cube(P, 'sculk_catalyst_top', 'sculk_catalyst_side', 1, 1, 18, 7, 11, { kFace: 0.85 }); return P; },
    /** A single kelp strand (not solid). f: bit 3 = taller, bits 0-2 = sway phase (world.js animates it). */
    kelp(f = 0) {
      const m = f & 8 ? 3 : 2, P = Pix(26, 22 + m * 11);
      kelpStrand(P, 5, P.h - 1, m, 1, f >> 3, 0.4 + (f & 7) * 0.7854);
      return P;
    },
    /** Sea lantern on a dark prismarine slab (monument lights). */
    sea_lantern() {
      const P = Pix(20, 24);
      cube(P, 'prismarine_dark', 'prismarine_dark', 1, 15, 18, 4, 4, { kFace: 0.7 });
      cube(P, 'sea_lantern', 'sea_lantern', 2, 1, 16, 6, 9, { kFace: 0.95, kTop: 1.1 });
      return P;
    },
    /** A cluster of three glowing sea pickles. */
    sea_pickle() {
      const P = Pix(14, 12), body = [pack('#4a5a1e'), pack('#6f8a30'), pack('#8aa83a')], glow = pack('#d8ff9a'), tip = pack('#f4ffd8');
      for (const [x, y, h] of [[2, 4, 6], [6, 2, 8], [10, 5, 5]]) {
        for (let j = 0; j < h; j++) for (let i = 0; i < 3; i++) P.set(x + i, y + j, body[i === 0 ? 2 : i === 1 ? 1 : 0]);
        P.set(x, y - 1, glow); P.set(x + 2, y - 1, glow); P.set(x + 1, y - 2, tip);
      }
      return P;
    },
    /** Ambrosium shards: glowing yellow crystals on a Holystone pebble. */
    ambrosium() {
      const P = Pix(18, 18), pal = ['#c89a2a', '#ffd84a', '#fff7a8'];
      cube(P, 'ae_holystone', 'ae_holystone', 3, 11, 12, 3, 3, { kFace: 0.72 });
      shard(P, 5, 13, 1.5, 6, pal); shard(P, 12, 13, 1.5, 7, pal); shard(P, 8.5, 13, 2, 11, pal);
      return P;
    },
    /** Zanite gemstones: a cluster of purple crystals. */
    zanite() {
      const P = Pix(18, 18), pal = ['#5a3aa8', '#8a5ae0', '#d4b8ff'];
      cube(P, 'ae_holystone', 'ae_holystone', 3, 11, 12, 3, 3, { kFace: 0.72 });
      shard(P, 4.5, 13, 1.5, 7, pal); shard(P, 12.5, 13, 2, 9, pal); shard(P, 8.5, 13, 2.5, 12, pal);
      return P;
    },
    /** A Gravitite ore block (it floats: world.js bobs it). */
    gravitite() { const P = Pix(16, 16); cube(P, 'ae_gravitite_ore', 'ae_gravitite_ore', 2, 2, 12, 4, 9, { kFace: 0.8, kTop: 1.1 }); return P; },
    /** A glowing Icestone block, half sunk in the grass. */
    icestone() { const P = Pix(16, 14); cube(P, 'ae_icestone', 'ae_icestone', 2, 3, 12, 4, 6, { kFace: 0.85, kTop: 1.12 }); return P; },
    /** Silver Dungeon column: white angelic stone, fluted, gold capital and base. */
    ae_pillar() {
      const P = Pix(18, 48), st = texFrame('ae_angelic_stone'), gold = [pack('#c89a2a'), pack('#e8bc40'), pack('#ffd860'), pack('#fff0a0')];
      blitTex(P, st, 2, 0, 12, 34, 3, 9, 12, 34, 1.05);
      for (const fx of [5, 8, 11]) shadeRect(P, 3 + fx - 2, 9, 1, 34, 0.86);
      shadeRect(P, 3, 9, 1, 34, 1.15); shadeRect(P, 13, 9, 2, 34, 0.72);
      for (let y = 3; y < 9; y++) for (let x = 1; x < 17; x++) P.set(x, y, y < 5 ? gold[3] : y === 8 ? gold[0] : x < 3 ? gold[1] : gold[2]);
      blitTex(P, st, 0, 0, 16, 16, 1, 1, 16, 3, 1.15);
      for (let y = 43; y < 47; y++) for (let x = 1; x < 17; x++) P.set(x, y, y === 43 ? gold[2] : y === 46 ? gold[0] : gold[1]);
      return P;
    },
    /** Farol normal colgando de una cadena sobre un poste de adoquín (fortaleza). */
    chain_lantern() {
      const P = Pix(14, 34);
      blitTex(P, texFrame('cobblestone'), 0, 0, 10, 16, 2, 18, 10, 16, 0.8);
      blitTex(P, texFrame('cobblestone'), 0, 0, 16, 16, 2, 14, 10, 4, 1.1);
      lantern(P, 'lantern', 7, 15);
      return P;
    }
  };
  /** Sprite of a deco prop; f = animation frame / variant for the decos that have them (kelp). */
  function decoSprite(kind, f = 0) {
    const name = DECO[kind] || 'web';
    const P = name === 'dripstone' ? null : DECO_DRAW[name](f);
    if (!P) return OBJ.dripstone({ n: 2 });
    outline(P, name === 'web' ? pack('#3a3a3a') : name === 'torch' || name === 'soul_torch' || name === 'candle' ? pack('#1a120a')
             : name === 'sea_pickle' ? pack('#1e260a') : name === 'ae_pillar' ? pack('#6a6a7e') : darkOf(DECO_TEX[name][0], 0.3));
    return P.canvas();
  }

  /** Variante v del objeto del bioma (obj puede ser una lista). */
  const objOf = (B, v) => { const o = B.mc.obj; return Array.isArray(o) ? o[(v | 0) % o.length] : o; };
  const objSprite = (B, v) => { const o = objOf(B, v); return OBJ[o.kind](o); };

  const MCP = {
    tree: objSprite,
    crystal: objSprite,
    deadtree: objSprite,
    deco: (B, v) => decoSprite(v & 63, v >> 6),

    /** Bloque suelto (adoquín...). Variante 1: agrietado (destroy_stage). */
    rock(B, variant) {
      const P = Pix(20, 18);
      cube(P, B.mc.rock, B.mc.rock, 1, 1, 18, 7, 9, { kFace: 0.7 });
      if (variant === 1) {
        const cr = texFrame('environment/destroy_stage_6');
        const crack = (dx, dy, dh) => {
          for (let y = 0; y < dh; y++) for (let x = 0; x < 18; x++) {
            const s = cr[(Math.floor(y * 16 / dh) & 15) * 16 + (Math.floor(x * 16 / 18) & 15)];
            if ((s >>> 24) > 128) { const i = (dy + y) * P.w + dx + x; P.buf[i] = mul(P.buf[i], 0.3 + 0.7 * (s & 255) / 255); }
          }
        };
        if (cr) { crack(1, 1, 7); crack(1, 8, 9); }
      }
      outline(P, darkOf(B.mc.rock, 0.25));
      return P.canvas();
    },

    /** Hierba / helecho de Minecraft. variante: bit 1 = mecida por el viento, bit 2 = helecho. */
    grass(B, variant) {
      const P = Pix(20, 17);
      const spec = B.mc.grass[(variant >> 1) & 1] || B.mc.grass[0];
      plant(P, spec, 2, 1);
      if (variant & 1) {
        // Las seis filas de arriba, un píxel hacia el lado.
        for (let y = 1; y < 7; y++) for (let x = 18; x >= 1; x--) P.buf[y * 20 + x + 1] = P.buf[y * 20 + x];
        for (let y = 1; y < 7; y++) P.buf[y * 20 + 1] = 0;
      }
      outline(P, darkOf(spec, 0.4));
      return P.canvas();
    },

    /** Mesa de encantamientos con un libro flotando. variante = efecto*2 + (usado ? 1 : 0). */
    altar(B, variant) {
      const P = Pix(18, 27);
      const eff = variant >> 1, used = variant & 1;
      const ORB = ['#ff5f6d', '#5fd4ff', '#ff8ad8', '#ffd23f'][eff];
      cube(P, 'enchanting_table_top', 'enchanting_table_side', 1, 11, 16, 7, 9, { sideY: 2, sideH: 14, kFace: used ? 0.45 : 0.8, kTop: used ? 0.55 : 0.95 });
      // Libro abierto flotando: tapas de cuero, páginas en V y runas del color de su poder.
      const cover = pack(used ? '#3e322c' : '#6b3a1e'), coverL = pack(used ? '#4a3e36' : '#8e5329');
      const page = pack(used ? '#7a766c' : '#f4ecd2'), pageD = pack(used ? '#5e5a52' : '#c9b98e');
      const glyph = pack(used ? '#5a606a' : ORB);
      for (let x = 2; x <= 15; x++) { P.set(x, 8, cover); P.set(x, 9, x < 9 ? coverL : cover); }
      for (let x = 3; x <= 14; x++) {
        const dip = x === 8 || x === 9 ? 1 : 0;            // lomo en el centro
        for (let y = 3 + dip; y <= 7; y++) P.set(x, y, x === 8 || x === 9 || y === 7 ? pageD : page);
      }
      [[4, 4], [5, 5], [6, 4], [4, 6], [11, 4], [12, 5], [13, 4], [12, 6]].forEach(([x, y]) => P.set(x, y, glyph));
      outline(P, pack('#120e1a'));
      return P.canvas();
    },

    /** Caldero con agua (variante 1 = vacío). Plano, centrado en su casilla. */
    spring(B, variant) {
      const P = Pix(28, 22);
      const side = texFrame('cauldron_side');
      blitTex(P, side, 0, 0, 26, 14, 1, 1, 26, 14, 1.1);          // borde visto desde arriba
      blitTex(P, side, 0, 4, 26, 6, 1, 15, 26, 6, 0.68);          // cara frontal
      for (const [x0, x1] of [[6, 11], [17, 22]]) for (let x = x0; x < x1; x++) { P.buf[20 * P.w + x] = 0; if (x > x0 && x < x1 - 1) P.buf[19 * P.w + x] = 0; }
      const inner = variant ? texFrame('cauldron_inner') : texFrame('water_still_grey#3f76e4');
      blitTex(P, inner, 0, 0, 20, 9, 4, 4, 20, 9, variant ? 0.55 : 1.15);
      shadeRect(P, 4, 4, 20, 1, 0.6);                              // sombra del borde
      if (!variant) [[8, 7], [9, 7], [17, 10], [18, 10], [13, 6]].forEach(([x, y]) => P.set(x, y, pack('#d8ecff')));
      outline(P, pack('#14161c'));
      return P.canvas();
    },

    /** Cofre del Fin (el cofre grande con candado). */
    bigchest() {
      const P = Pix(20, 20);
      cube(P, 'ender_chest_top', 'ender_chest_front', 1, 1, 18, 6, 12, { kFace: 0.95 });
      outline(P, pack('#050a0a'));
      return P.canvas();
    },

    /** Trampa. variante: 0 placa de presión envenenada · 1 telaraña · 2 TNT. */
    trap(B, variant) {
      const P = Pix(14, 15);
      if (variant === 0) {
        cube(P, 'stone', 'stone', 1, 1, 12, 10, 2, { wrap: true, wrapY: true, kTop: 1.12, kFace: 0.6 });
        const sl = texFrame('slime');
        blitTex(P, sl, 4, 4, 3, 2, 4, 4, 3, 2); blitTex(P, sl, 8, 9, 2, 2, 8, 7, 2, 2); blitTex(P, sl, 2, 2, 2, 1, 5, 8, 2, 1);
      } else if (variant === 1) {
        blitTex(P, texFrame('web'), 1, 1, 14, 14, 0, 0, 14, 14);
      } else {
        cube(P, 'tnt_top', 'tnt_side', 1, 1, 12, 7, 6, { kFace: 0.9, sideY: 4, sideH: 8 });
      }
      outline(P, pack(variant === 1 ? '#3a3a3a' : '#0c0812'));
      return P.canvas();
    },

    /**
     * Entrada a una Cámara de Pruebas (la grieta): puerta de toba con un
     * generador de pruebas encendido dentro. variante = fotograma 0..3 (brillo).
     */
    rift(B, variant) {
      const f = variant & 3, glowK = [1, 1.12, 1.24, 1.1][f];
      const P = Pix(36, 50);
      // Losa de toba pulida delante de la puerta.
      cube(P, 'polished_tuff', 'polished_tuff', 0, 40, 36, 6, 4, { wrap: true, wrapY: true, kFace: 0.6 });
      // Jambas de ladrillo de toba y dintel de toba cincelada.
      for (const x of [1, 27]) {
        blitTex(P, texFrame('tuff_bricks'), 0, 0, 8, 30, x, 12, 8, 30, 0.86);
        shadeRect(P, x + 6, 12, 2, 30, 0.7);
      }
      blitTex(P, texFrame('chiseled_tuff_top'), 0, 0, 16, 16, 0, 0, 36, 4, 1.05);
      blitTex(P, texFrame('chiseled_tuff'), 0, 0, 36, 10, 0, 4, 36, 10, 0.85);
      shadeRect(P, 0, 4, 36, 1, 0.7); shadeRect(P, 0, 13, 36, 1, 0.6);
      // Bombilla de cobre en el dintel, latiendo.
      blitTex(P, texFrame('copper_bulb_lit'), 0, 0, 16, 16, 14, 5, 8, 8, glowK);
      // Interior oscuro, iluminado desde el generador.
      const dark = pack('#14110e'), warm = pack('#ff9a3c');
      for (let y = 14; y < 41; y++) for (let x = 9; x < 27; x++)
        P.buf[y * P.w + x] = blendCol(dark, warm, Math.max(0, (y - 18) / 24) * 0.32 * glowK);
      // El generador de pruebas, activo.
      cube(P, 'trial_spawner_top_active', 'trial_spawner_side_active', 10, 24, 16, 5, 13, { kFace: 0.95 * glowK, kTop: glowK });
      // Llamas dentro de la jaula.
      const fl = [pack('#ffd76a'), pack('#ff9a3c'), pack('#fff3b0')];
      for (let i = 0; i < 9; i++) {
        const x = 13 + Math.floor(H(i, f, 97) * 10), y = 31 + Math.floor(H(i, f, 98) * 5);
        P.set(x, y, fl[i % 3]); if (H(i, f, 99) < 0.5) P.set(x, y - 1, fl[0]);
      }
      outline(P, pack('#121212'));
      return P.canvas();
    },

    /** Portal del Nether: marco de obsidiana y la tira animada de blocks/portal. variante = fotograma. */
    nether_portal(B, variant) {
      const P = Pix(30, 46);
      const obs = texFrame('obsidian');
      blitTex(P, obs, 0, 0, 30, 4, 0, 0, 30, 4, 1.5);           // cara de arriba del marco
      blitTex(P, obs, 0, 4, 30, 42, 0, 4, 30, 42, 1.05);        // marco
      shadeRect(P, 0, 4, 30, 1, 0.6);
      const portal = texFrame('portal', variant), back = pack('#2a0a52');
      for (let y = 8; y < 42; y++) for (let x = 4; x < 26; x++)
        P.buf[y * 30 + x] = over(back, portal[((y - 8) & 15) * 16 + ((x - 4) & 15)]);
      shadeRect(P, 4, 8, 22, 1, 0.55); shadeRect(P, 4, 8, 1, 34, 0.7);
      return P.canvas();
    },

    /** Cofre normal. */
    chest() {
      const P = Pix(18, 16);
      cube(P, 'chest_top', 'chest_front', 1, 1, 16, 5, 9, { kFace: 0.92 });
      outline(P, pack('#2a160a'));
      return P.canvas();
    }
  };

  /**
   * Portal del End, plano en el suelo (5×5 bloques): 12 marcos con su ojo y
   * el cielo estrellado de end_portal en medio, que se mueve. variante = fotograma.
   */
  MCP.end_portal = (B, variant) => {
    const P = Pix(80, 86);
    const top = texFrame('endframe_top'), side = texFrame('endframe_side'), eye = texFrame('endframe_eye'), sky = texFrame('end_portal');
    // Fondo del pozo y el cielo, en dos capas que se desplazan a distinta velocidad.
    const f = variant | 0, base = pack('#050a10');
    for (let y = 16; y < 64; y++) for (let x = 16; x < 64; x++) {
      const a = sky[(((y + f) & 15) << 4) | ((x + (f >> 1)) & 15)], b = sky[(((y * 2 + 5 - f) >> 1 & 15) << 4) | ((x + 7 + f) & 15)];
      let c = base;
      if (a >>> 24) c = mul(a, 1.15);
      if ((b >>> 24) && (b & 0xff00) > 0x6000) c = blendCol(c, mul(b, 1.6), 0.5);
      P.buf[y * P.w + x] = c;
    }
    shadeRect(P, 16, 16, 48, 3, 0.45); shadeRect(P, 16, 16, 3, 48, 0.6);  // sombra del marco
    // Ojo: su recuadro opaco, centrado en el hueco del marco.
    let x0 = 16, y0 = 16, x1 = -1, y1 = -1;
    for (let i = 0; i < 256; i++) if (eye[i] >>> 24) { const x = i & 15, y = i >> 4; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const ring = i === 0 || j === 0 || i === 4 || j === 4, corner = (i === 0 || i === 4) && (j === 0 || j === 4);
      if (!ring || corner) continue;
      const ox = i * 16, oy = j * 16;
      put(P, top, 0, ox, oy, 1.05);
      if (x1 >= 0) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const c = eye[y * 16 + x];
        if (c >>> 24) P.set(ox + 8 - ((x1 - x0 + 1) >> 1) + (x - x0), oy + 8 - ((y1 - y0 + 1) >> 1) + (y - y0), c);
      }
      if (j === 4) for (let r = 0; r < 6; r++) put(P, side, 0, ox, oy + 16 + r, [0.72, 0.68, 0.64, 0.6, 0.55, 0.5][r], r + 3, r + 4);
    }
    return P.canvas();
  };

  /** Bajada a las cuevas: agujero de 3×3 bloques con borde de adoquín, paredes que se hunden y una escalera de mano. Plano. */
  MCP.cave_portal = () => {
    const P = Pix(48, 50);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const spec = H(i, j, 5) < 0.4 ? 'cobblestone_mossy' : 'cobblestone';
      put(P, texFrame(spec), (H(i, j, 6) * 8) | 0, i * 16, j * 16, 1.05);
    }
    // Hueco: las caras de piedra bajan hacia la oscuridad.
    const st = texFrame('stone'), dark = pack('#07080a');
    for (let y = 7; y < 43; y++) for (let x = 7; x < 41; x++) {
      const d = y - 7, k = Math.max(0, 0.78 - d * 0.045);
      const c = st[((y & 15) << 4) | (x & 15)];
      P.buf[y * P.w + x] = k > 0.05 ? mul(c | 0xff000000, k) : dark;
    }
    shadeRect(P, 7, 7, 34, 2, 0.5); shadeRect(P, 7, 7, 2, 36, 0.7); shadeRect(P, 39, 7, 2, 36, 0.55);
    // Escalera de mano en la pared norte, perdiéndose en lo oscuro.
    const lad = texFrame('ladder');
    for (let y = 0; y < 22; y++) blitTex(P, lad, 0, y & 15, 16, 1, 16, 8 + y, 16, 1, Math.max(0.15, 1 - y * 0.042));
    // Cara frontal del borde sur.
    for (let r = 0; r < 2; r++) blitTex(P, texFrame('cobblestone'), 0, r, 48, 1, 0, 48 + r, 48, 1, 0.6 - r * 0.1);
    outline(P, pack('#121212'));
    return P.canvas();
  };

  /** Escalera de ladrillo de piedra que baja (portal a la fortaleza). Plano. */
  MCP.stronghold_portal = () => {
    const P = Pix(48, 52);
    const sb = texFrame('stonebrick'), mo = texFrame('stonebrick_mossy');
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) put(P, H(i, j, 7) < 0.35 ? mo : sb, H(i, j, 8) < 0.5 ? 0 : 1, i * 16, j * 16, 1.05);
    // Seis peldaños que se hunden: cada uno más oscuro y con su arista.
    const sl = texFrame('stone_slab_top');
    for (let s = 0; s < 6; s++) {
      const y0 = 6 + s * 6, k = 0.95 - s * 0.15;
      for (let y = y0; y < y0 + 6; y++) for (let x = 12; x < 36; x++) {
        const c = sl[((y & 15) << 4) | (x & 15)];
        P.buf[y * P.w + x] = k > 0.08 ? mul(c | 0xff000000, k) : pack('#050506');
      }
      if (k > 0.08) shadeRect(P, 12, y0, 24, 1, 1.35);
    }
    shadeRect(P, 12, 6, 2, 36, 0.6); shadeRect(P, 34, 6, 2, 36, 0.6);
    for (let r = 0; r < 3; r++) blitTex(P, sb, 0, r * 3, 48, 1, 0, 48 + r, 48, 1, 0.62 - r * 0.08);
    outline(P, pack('#141414'));
    return P.canvas();
  };

  /** Ojo de Ender flotante (encima del portal de la fortaleza). */
  MCP.ender_eye = () => {
    const P = Pix(16, 16);
    blitTex(P, texFrame('items/ender_eye'), 0, 0, 16, 16, 0, 0, 16, 16);
    return P.canvas();
  };

  /**
   * Portal de Salida del End: bloque de lecho de roca con el portal dentro y un
   * haz estrellado que sube. variante = fotograma (el haz se desplaza).
   */
  MCP.gateway_portal = (B, f) => {
    const P = Pix(22, 96), sky = texFrame('end_portal');
    // Haz: estrellas del portal que suben, cada vez más transparentes.
    for (let y = 0; y < 74; y++) for (let x = 6; x < 16; x++) {
      const c = sky[((((y + f * 2) >> 1) & 15) << 4) | ((x * 3 + (y >> 4)) & 15)];
      const a = Math.min(1, (y + 6) / 70) * (x === 6 || x === 15 ? 0.5 : 0.9);
      const base = blendCol(pack('#1a0830'), pack('#c890ff'), 0.25 + 0.2 * Math.sin((y + f * 3) * 0.3));
      const col = (c >>> 24) && ((c >>> 8) & 255) > 70 ? mul(c, 1.8) : base;
      P.buf[y * P.w + x] = ((Math.round(a * 255) << 24) | (col & 0xffffff)) >>> 0;
    }
    cube(P, 'bedrock', 'bedrock', 1, 72, 20, 8, 14, { kFace: 0.8 });
    const g = texFrame('end_gateway');
    blitTex(P, g, 0, 0, 16, 16, 6, 73, 10, 6, 1.3);
    blitTex(P, sky, f & 15, 0, 16, 16, 6, 83, 10, 9, 1.2);
    outline(P, pack('#0a0612'));
    return P.canvas();
  };

  /**
   * Marco antiguo de la Ciudad Antigua: 11 bloques de ancho y 8 de alto de
   * pizarra profunda reforzada. variante 0..7 = encendido (fotograma del brillo
   * de sculk); -1 = apagado (el hueco deja ver el suelo de detrás).
   */
  MCP.ancient_frame = (B, f) => {
    const W = 176, Hh = 128, P = Pix(W + 2, Hh + 2);
    const side = texFrame('reinforced_deepslate_side'), top = texFrame('reinforced_deepslate_top'), tiles = texFrame('deepslate/deepslate_tiles');
    const ox = 1, oy = 1;
    if (f >= 0) {
      // Hueco lleno de un brillo azul de sculk que se mueve.
      const sk = texFrame('sculk', f & 3);
      for (let y = 32; y < Hh; y++) for (let x = 32; x < W - 32; x++) {
        const w1 = Math.sin(x * 0.11 + f * 0.8 + Math.sin(y * 0.07) * 2) + Math.sin(y * 0.09 - f * 0.6);
        let c = blendCol(pack('#04121c'), pack('#0e5a78'), Math.max(0, Math.min(1, 0.35 + w1 * 0.22)));
        const s = sk[(((y + f) & 15) << 4) | ((x - f) & 15)];
        if ((s >>> 24) && ((s >>> 8) & 255) > 150) c = blendCol(c, pack('#5ff3ff'), 0.7);
        P.buf[(oy + y) * P.w + ox + x] = c;
      }
    }
    // Pilares (2 bloques de ancho) y dintel (2 de alto), con cara de arriba.
    const block = (bx, by, spec, k) => blitTex(P, spec, 0, 0, 16, 16, ox + bx * 16, oy + by * 16, 16, 16, k);
    for (let by = 1; by < 8; by++) for (const bx of [0, 1, 9, 10]) block(bx, by, side, bx === 1 || bx === 10 ? 0.72 : 0.86);
    for (let bx = 0; bx < 11; bx++) { block(bx, 1, side, 0.8); blitTex(P, top, 0, 0, 16, 16, ox + bx * 16, oy, 16, 16, 1.08); }
    // Peldaños de baldosa a los pies del hueco y bordes de sombra.
    for (let bx = 2; bx < 9; bx++) blitTex(P, tiles, 0, 10, 16, 6, ox + bx * 16, oy + Hh - 6, 16, 6, 0.75);
    shadeRect(P, ox, oy + 16, W, 1, 0.55); shadeRect(P, ox + 32, oy + 32, W - 64, 2, 0.5);
    shadeRect(P, ox + 31, oy + 32, 1, Hh - 32, 0.5); shadeRect(P, ox + W - 32, oy + 32, 1, Hh - 32, 0.6);
    // Lámparas de alma en los pilares.
    lantern(P, 'soul_lantern', ox + 16, oy + 60); lantern(P, 'soul_lantern', ox + W - 16, oy + 60);
    outline(P, pack('#05080a'));
    return P.canvas();
  };

  /**
   * Torre de obsidiana del End (3×3 bloques de base): cara frontal alta, cara de
   * arriba con su lecho de roca. Con `caged`, jaula de barrotes de hierro arriba.
   * El cristal lo pone el juego (G.World.towers[i].top); este sprite deja hueco.
   */
  const TOWER = { W: 48, FACE: 72, TOP: 30 };
  MCP.tower = (B, caged) => {
    const { W, FACE, TOP } = TOWER, cage = caged ? 22 : 0, P = Pix(W + 2, FACE + TOP + cage + 2);
    const obs = texFrame('obsidian'), cry = texFrame('crying_obsidian');
    const y0 = 1 + cage;
    // Cara de arriba (3 bloques aplastados) y cara frontal (bloques de 16 a escala real).
    for (let i = 0; i < 3; i++) blitTex(P, obs, 0, 0, 16, 16, 1 + i * 16, y0, 16, TOP, 1.25);
    for (let by = 0; by * 16 < FACE; by++) for (let i = 0; i < 3; i++) {
      const src = H(i, by, 91) < 0.12 ? cry : obs;
      blitTex(P, src, 0, 0, 16, 16, 1 + i * 16, y0 + TOP + by * 16, 16, Math.min(16, FACE - by * 16), 0.78);
    }
    shadeRect(P, 1, y0 + TOP, W, 1, 0.6); shadeRect(P, 1, y0, W, 1, 1.3);
    shadeRect(P, 1, y0 + TOP, 2, FACE, 1.2); shadeRect(P, W - 3, y0 + TOP, 4, FACE, 0.65);
    // Lecho de roca donde se apoya el cristal.
    cube(P, 'bedrock', 'bedrock', 1 + W / 2 - 6, y0 + TOP / 2 - 5, 12, 5, 5, { kFace: 0.7 });
    if (caged) {
      // Barrotes: panel trasero, laterales y techo (el delantero lo dibuja drawTowerFront).
      const bars = texFrame('iron_bars');
      for (let i = 0; i < 2; i++) blitTex(P, bars, 0, 0, 16, 16, 9 + i * 16, y0 - cage + 2, 16, cage + 4, 0.75);
      for (const x of [5, W - 11]) blitTex(P, bars, 4, 0, 8, 16, x, y0 - cage + 6, 8, cage + 10, 0.9);
      blitTex(P, bars, 0, 0, 16, 16, 7, y0 - cage, 36, 3, 1.05);
    }
    outline(P, pack('#06040c'));
    return P.canvas();
  };
  /** Barrotes delanteros de la jaula de una torre (se dibujan después del cristal). */
  MCP.tower_front = () => {
    const P = Pix(TOWER.W + 2, 40), bars = texFrame('iron_bars');
    for (let i = 0; i < 2; i++) blitTex(P, bars, 0, 0, 16, 16, 9 + i * 16, 8, 16, 26);
    blitTex(P, bars, 0, 0, 16, 16, 7, 34, 36, 3, 0.9);
    return P.canvas();
  };

  /**
   * Sprite de un portal. Planos: 'end' (16 fotogramas), 'cave', 'stronghold'.
   * De pie: 'nether' (32), 'gateway' (16), 'ancient' (8; 'ancient_off' = apagado).
   * Otros: 'eye' (Ojo de Ender), 'tower' / 'tower_caged', 'tower_front'.
   */
  /**
   * Dive spot (the Overworld's way down to the Ocean): a round pool on a sand rim with a whirlpool that
   * turns (variant = frame 0..15), a dark eye in the middle and bubble rings. Flat; centred on its pool.
   */
  const DIVE = { R: 30, F: 16 };
  MCP.dive_portal = (B, f) => {
    const R = DIVE.R, S = R * 2 + 4, P = Pix(S, S), c = S / 2;
    const sand = texFrame('sand'), water = texFrame('water_still_grey', f & 31), ring = texFrame('bubble_column_up_top_a', f % 12);
    const deep = rgb('#071a3c'), mid = rgb('#2a6fd0'), foam = rgb('#d8f4ff');
    const ph = f / DIVE.F * 6.2832;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - c, dy = (y + 0.5 - c) * 1.08, d = Math.hypot(dx, dy);
      if (d > R + 1.5) continue;
      const i = y * S + x;
      if (d > R - 3.5) {
        // Sand rim, a bit darker where it slopes into the water.
        const s = sand[((y & 15) << 4) | (x & 15)];
        P.buf[i] = mul(s | 0xff000000, d > R ? 0.8 : 1.02 - (R - d) * 0.06);
        continue;
      }
      // Spiral arms: bright where the swirl's phase peaks, darker towards the eye.
      const q = d / (R - 3.5), a = Math.atan2(dy, dx);
      const arm = Math.sin(a * 3 + (1 - q) * 9 - ph * 3);
      const w = water[((Math.floor(y + f * 0.5) & 15) << 4) | (x & 15)];
      const lw = ((w & 255) + ((w >>> 8) & 255) + ((w >>> 16) & 255)) / 765;
      let t = Math.max(0, Math.min(1, q * 1.25 - 0.1));
      let r = deep[0] + (mid[0] - deep[0]) * t, g = deep[1] + (mid[1] - deep[1]) * t, b = deep[2] + (mid[2] - deep[2]) * t;
      const k = 0.75 + lw * 0.55;
      r *= k; g *= k; b *= k;
      if (arm > 0.55 && q > 0.18) { const m = (arm - 0.55) * 1.6 * Math.min(1, q * 2); r += (foam[0] - r) * m; g += (foam[1] - g) * m; b += (foam[2] - b) * m; }
      if (q > 0.88) { const m = (q - 0.88) * 4; r += (foam[0] - r) * m * 0.6; g += (foam[1] - g) * m * 0.6; b += (foam[2] - b) * m * 0.6; }
      P.buf[i] = ((0xff << 24) | (Math.min(255, b) << 16) | (Math.min(255, g) << 8) | Math.min(255, r)) >>> 0;
    }
    // Bubble rings rising from the eye of the whirlpool.
    for (let k = 0; k < 3; k++) blitTex(P, ring, 0, 0, 16, 16, c - 8 + [-9, 6, -2][k], c - 8 + [-5, -9, 4][k], 16, 16, 1.1);
    shadeRect(P, c - R + 4, c - R + 3, 2 * R - 8, 2, 0.7);
    return P.canvas();
  };
  /** The Ocean's cave mouth: a crevice in the seabed (gravel and prismarine rim), falling into dark water. Flat. */
  MCP.cave_ocean_portal = () => {
    const P = Pix(48, 50);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const spec = H(i, j, 15) < 0.3 ? 'prismarine_rough' : H(i, j, 16) < 0.6 ? 'gravel' : 'stone';
      put(P, texFrame(spec), (H(i, j, 6) * 8) | 0, i * 16, j * 16, 0.95);
    }
    const st = texFrame('deepslate/deepslate_top'), deepCol = pack('#020a18');
    for (let y = 6; y < 44; y++) for (let x = 6; x < 42; x++) {
      // A ragged crevice: its sides wobble a little.
      const wob = Math.round(Math.sin(y * 0.7) * 1.5 + Math.sin(y * 0.23 + 1) * 1.2);
      if (x < 7 + wob || x > 40 + wob) continue;
      const d = y - 6, k = Math.max(0, 0.7 - d * 0.05);
      const c = st[((y & 15) << 4) | (x & 15)];
      P.buf[y * P.w + x] = k > 0.06 ? blendCol(mul(c | 0xff000000, k), pack('#14467a'), 0.35) : deepCol;
    }
    shadeRect(P, 6, 6, 36, 2, 0.5);
    const ring = texFrame('bubble_column_up_top_a', 3);
    blitTex(P, ring, 0, 0, 16, 16, 12, 20, 16, 16, 0.9); blitTex(P, ring, 0, 0, 16, 16, 22, 28, 12, 12, 0.7);
    for (let r = 0; r < 2; r++) blitTex(P, texFrame('gravel'), 0, r, 48, 1, 0, 48 + r, 48, 1, 0.55 - r * 0.1);
    outline(P, pack('#06121c'));
    return P.canvas();
  };

  /** One frame (0..11) of the bubble rings of a bubble column (16×16), as a canvas. */
  function bubbleSprite(f = 0) {
    const k = 'bubble/' + (f % 12);
    let cv = propCache.get(k);
    if (!cv) {
      const P = Pix(16, 16), src = texFrame('bubble_column_up_top_a', f % 12);
      if (src) for (let i = 0; i < 256; i++) P.buf[i] = src[i];
      cv = P.canvas();
      propCache.set(k, cv);
    }
    return cv;
  }

  /*
   * Caustics: the light rippling over the seabed. CAUSTIC_FRAMES frames of a 64×64 tile that repeats
   * seamlessly: the ridges of a cellular noise (where two moving feature points are equally far), whose
   * points loop on small circles so the animation loops too. Light cyan pixels, alpha = brightness.
   */
  const CAUSTIC_FRAMES = 24, CS = 64, CPTS = 7;
  const causticCache = [];
  function caustic(f) {
    f = ((f % CAUSTIC_FRAMES) + CAUSTIC_FRAMES) % CAUSTIC_FRAMES;
    if (causticCache[f]) return causticCache[f];
    const P = Pix(CS, CS), px = [], py = [];
    for (let i = 0; i < CPTS; i++) {
      const a = f / CAUSTIC_FRAMES * 6.2832 * (H(i, 3, 551) < 0.5 ? 1 : -1) + H(i, 4, 552) * 6.2832, r = 3 + H(i, 5, 553) * 5;
      px.push(H(i, 1, 549) * CS + Math.cos(a) * r); py.push(H(i, 2, 550) * CS + Math.sin(a) * r);
    }
    const L = [pack('#9fe8f0', 46), pack('#c8fbff', 92), pack('#f0ffff', 150)];
    for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) {
      let d1 = 1e9, d2 = 1e9;
      for (let i = 0; i < CPTS; i++) for (let oy = -CS; oy <= CS; oy += CS) for (let ox = -CS; ox <= CS; ox += CS) {
        const d = Math.hypot(x + 0.5 - px[i] - ox, (y + 0.5 - py[i] - oy) * 1.15);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      const e = d2 - d1;
      const lv = e < 1.1 ? 2 : e < 2.4 ? 1 : e < 3.6 && H(x, y + f * 64, 557) < 0.5 ? 0 : -1;
      if (lv >= 0) P.buf[y * CS + x] = L[lv];
    }
    return (causticCache[f] = P.canvas());
  }

  /*
   * The Aether Portal (Aether I): an upright frame of Glowstone, W×H blocks of B art px (the four corners
   * included), with a shimmering light-blue, water-like surface inside (W-2)×(H-2) blocks. world.js draws the
   * frame whole once it is built, or block by block ('aether_block', ORDER) while it builds, and the
   * surface ('aether_fill', 16 frames) rising from the bottom.
   */
  const AEPORTAL = { B: 12, W: 4, H: 5, TOP: 3,
    ORDER: [[0, 4], [1, 4], [2, 4], [3, 4], [0, 3], [3, 3], [0, 2], [3, 2], [0, 1], [3, 1], [0, 0], [3, 0], [1, 0], [2, 0]] };
  function glowBlock(P, x, y) {
    const B = AEPORTAL.B, g = texFrame('glowstone');
    blitTex(P, g, 0, 0, 16, 16, x, y, B, AEPORTAL.TOP, 1.3);                  // top face
    blitTex(P, g, 0, 0, 16, 16, x, y + AEPORTAL.TOP, B, B, 1.08);
    shadeRect(P, x, y + AEPORTAL.TOP, B, 1, 0.7); shadeRect(P, x, y + AEPORTAL.TOP + 1, 1, B - 1, 1.15);
    shadeRect(P, x + B - 1, y + AEPORTAL.TOP + 1, 1, B - 1, 0.78); shadeRect(P, x, y + AEPORTAL.TOP + B - 1, B, 1, 0.8);
  }
  MCP.aether_block = () => { const P = Pix(AEPORTAL.B, AEPORTAL.B + AEPORTAL.TOP); glowBlock(P, 0, 0); return P.canvas(); };
  MCP.aether_frame = () => {
    const { B, W, H: Hh, TOP } = AEPORTAL, P = Pix(W * B, Hh * B + TOP);
    for (const [i, j] of AEPORTAL.ORDER) glowBlock(P, i * B, j * B);
    return P.canvas();
  };
  MCP.aether_fill = (Bi, f) => {
    const { B, W, H: Hh } = AEPORTAL, w = (W - 2) * B, h = (Hh - 2) * B, P = Pix(w, h);
    const water = texFrame('water_still_grey', (f * 2) & 31), deep = rgb('#2a78d8'), hi = rgb('#c8f0ff');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - w / 2, dy = (y + 0.5 - h / 2) * 0.75, d = Math.hypot(dx, dy);
      const sw = 0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 2 + d * 0.5 - f * 0.39);
      const s = water ? water[(((y + f) & 15) << 4) | (x & 15)] : 0x808080;
      const l = ((s & 255) + ((s >>> 8) & 255) + ((s >>> 16) & 255)) / 765;
      let t = Math.max(0, Math.min(1, l * 0.75 + sw * 0.45 - 0.12 + (y < 2 || y >= h - 2 ? -0.15 : 0)));
      if (H(x, y + f * 64, 151) > 0.985) t = 1;
      P.buf[y * w + x] = ((0xff << 24) | ((deep[2] + (hi[2] - deep[2]) * t) << 16) | ((deep[1] + (hi[1] - deep[1]) * t) << 8) | (deep[0] + (hi[0] - deep[0]) * t)) >>> 0;
    }
    return P.canvas();
  };

  /*
   * Aether dungeon exteriors (decorative landmarks; world.js stands them on a footprint of wall tiles):
   * LANDMARK[kind] = [footprint width, depth] in tiles. Sprites are footprint-wide, bottom = south edge.
   *   silver  the Silver Dungeon: a white Holystone temple, columns, gold frieze, a silver dome with gold ribs
   *   bronze  the Bronze Dungeon: a stepped mound of Carved Stone, mossy, with a bronze-framed door
   *   gold    the Gold Dungeon: a Hellfire Stone shrine with a golden dome (on its golden island)
   */
  const LANDMARK = { silver: [9, 5], bronze: [6, 4], gold: [5, 4] };
  /** Upper half of a dome (ellipse rx × ry) centred on (cx, cy), lit from the upper left; ribs every `ribs` of longitude. */
  function dome(P, cx, cy, rx, ry, pal, rib) {
    const C = pal.map(c => pack(c)), R = rib ? rib.map(c => pack(c)) : null;
    for (let y = Math.floor(cy - ry); y <= cy; y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, q = nx * nx + ny * ny;
      if (q > 1) continue;
      const z = Math.sqrt(1 - q), lit = -0.55 * nx - 0.55 * ny + 0.62 * z;
      let c = C[Math.max(0, Math.min(C.length - 1, Math.floor((lit + 0.25) * C.length / 1.15)))];
      if (R) {
        const lon = nx / Math.max(0.2, Math.sqrt(1 - ny * ny));
        if ([-0.87, -0.5, 0, 0.5, 0.87].some(v => Math.abs(lon - v) < 0.045) || ny > -0.1) c = R[lit > 0.45 ? 2 : lit > 0.1 ? 1 : 0];
      }
      P.set(x, y, c);
    }
  }
  const GOLDS = ['#a87818', '#d8a830', '#ffd860', '#fff4b8'];
  MCP.ae_silver = () => {
    const W = 146, Hs = 156, P = Pix(W, Hs), cx = 73;
    const ang = texFrame('ae_angelic_stone'), trim = texFrame('ae_angelic_trim');
    const F1 = Hs - 14, F0 = F1 - 50, R0 = F0 - 30;
    // Corner towers (behind the facade's front), roof, dome.
    for (const tx0 of [3, W - 21]) {
      blitTex(P, ang, 0, 0, 18, 70, tx0, F1 - 82, 18, 82, 0.92);
      shadeRect(P, tx0, F1 - 82, 1, 82, 1.15); shadeRect(P, tx0 + 16, F1 - 82, 2, 82, 0.72);
      blitTex(P, trim, 0, 6, 18, 4, tx0, F1 - 86, 18, 4, 1.1);
      dome(P, tx0 + 9, F1 - 86, 9, 9, ['#8c90a2', '#b8bccc', '#dfe2ee', '#ffffff'], GOLDS.slice(0, 3));
    }
    blitTex(P, ang, 0, 0, 120, 26, 13, R0, 120, 26, 1.14);
    shadeRect(P, 13, R0, 120, 1, 1.2);
    dome(P, cx, R0 + 6, 30, 8, ['#c8ccd8', '#e0e3ee', '#ffffff']);                       // the drum's top
    for (let y = R0 - 2; y < R0 + 14; y++) for (let x = cx - 30; x <= cx + 30; x++) {
      const k = 1.15 - Math.abs((x - cx + 10) / 40) * 0.5;
      P.set(x, y, mul(trim[((y - R0 + 4) & 15) * 16 + (x & 15)] | 0xff000000, Math.max(0.6, k)));
    }
    dome(P, cx, R0 - 2, 31, 34, ['#7a7e92', '#9ea2b6', '#c4c8da', '#e6eaf6', '#ffffff'], GOLDS.slice(0, 3));
    for (let y = R0 - 50; y < R0 - 35; y++) for (let x = cx - 1; x <= cx + 1; x++) P.set(x, y, pack(x === cx - 1 ? GOLDS[3] : GOLDS[1]));
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) P.set(cx + x, R0 - 52 + y, pack(x + y < -1 ? GOLDS[3] : GOLDS[2]));
    // Frieze, facade, columns, door.
    blitTex(P, trim, 0, 4, 128, 8, 9, F0 - 8, 128, 8, 1.05);
    blitTex(P, ang, 0, 0, 120, 50, 13, F0, 120, 50, 0.84);
    for (const x0 of [16, 36, 56, 84, 104, 124]) {
      blitTex(P, ang, 3, 0, 8, 50, x0, F0, 8, 50, 1.12);
      shadeRect(P, x0, F0, 1, 50, 1.12); shadeRect(P, x0 + 6, F0, 2, 50, 0.7);
      for (let x = x0 - 2; x < x0 + 10; x++) for (let y = F0; y < F0 + 4; y++) P.set(x, y, pack(y === F0 ? GOLDS[3] : GOLDS[x < x0 + 2 ? 1 : 2]));
      for (let x = x0 - 1; x < x0 + 9; x++) for (let y = F1 - 3; y < F1; y++) P.set(x, y, pack(y === F1 - 3 ? GOLDS[2] : GOLDS[1]));
    }
    const dw = 11, dTop = F1 - 36;
    for (let y = dTop - dw; y < F1; y++) for (let x = cx - dw - 2; x <= cx + dw + 2; x++) {
      const ay = y < dTop ? Math.sqrt(Math.max(0, (dw + 2) ** 2 - (dTop - y) ** 2)) : dw + 2;
      const ax = Math.abs(x - cx);
      if (ax > ay) continue;
      if (ax > ay - 2.2 || (y < dTop && ax > Math.sqrt(Math.max(0, dw ** 2 - (dTop - y) ** 2)))) { P.set(x, y, pack(ax < ay - 1.1 ? GOLDS[2] : GOLDS[0])); continue; }
      const k = (y - dTop + dw) / (F1 - dTop + dw);
      P.set(x, y, mixPack('#241e40', '#5a6ab0', Math.max(0, k * k * 0.9)));
    }
    // Steps.
    cube(P, 'ae_holystone_brick', 'ae_holystone_brick', 0, Hs - 8, W, 3, 5, { wrap: true, wrapY: true, kFace: 0.7 });
    cube(P, 'ae_holystone_brick', 'ae_holystone_brick', 6, F1 - 3, W - 12, 3, 6, { wrap: true, wrapY: true, kFace: 0.74, kTop: 1.12 });
    outline(P, pack('#4a4a62'));
    return P.canvas();
  };
  MCP.ae_bronze = () => {
    const W = 98, Hs = 80, P = Pix(W, Hs), cx = 49, o = { wrap: true, wrapY: true, kFace: 0.74, kTop: 1.05 };
    cube(P, 'ae_holystone_mossy', 'ae_carved_stone', 1, Hs - 34, 96, 12, 22, o);
    cube(P, 'ae_holystone_mossy', 'ae_carved_stone', 15, Hs - 54, 68, 10, 14, o);
    cube(P, 'ae_holystone_mossy', 'ae_carved_stone', 31, Hs - 70, 36, 8, 10, o);
    // Moss creeping down the faces.
    const moss = [pack('#4f9c6a'), pack('#68b882'), pack('#86d29a')];
    for (let x = 1; x < 97; x++) {
      const len = Math.floor(vnoise(x / 5, 3, 161) * 7) - 1;
      for (const yf of [Hs - 22, Hs - 40, Hs - 60]) for (let y = 0; y < len; y++) if (P.get(x, yf + y) >>> 24) P.set(x, yf + y, moss[(y + x) % 3]);
    }
    // The door: dark, framed in bronze, with two Ambrosium lamps.
    const bz = [pack('#7a4420'), pack('#c87a3a'), pack('#f0aa60')];
    for (let y = Hs - 21; y < Hs; y++) for (let x = cx - 12; x <= cx + 12; x++) {
      const ax = Math.abs(x - cx);
      P.set(x, y, ax > 9 || y < Hs - 18 ? bz[ax > 11 || y === Hs - 21 ? 0 : y < Hs - 19 || ax === 10 ? 2 : 1] : mixPack('#0e0a08', '#3a2a1a', (y - Hs + 18) / 18));
    }
    for (const lx of [cx - 20, cx + 18]) for (let y = Hs - 30; y < Hs - 24; y++) for (let x = lx; x < lx + 3; x++) P.set(x, y, pack(y < Hs - 28 ? '#fff7a8' : '#ffd84a'));
    outline(P, pack('#2a2a24'));
    return P.canvas();
  };
  MCP.ae_gold = () => {
    const W = 82, Hs = 96, P = Pix(W, Hs), cx = 41;
    cube(P, 'ae_hellfire_stone', 'ae_hellfire_stone', 1, Hs - 44, 80, 16, 28, { wrap: true, wrapY: true, kFace: 0.78, kTop: 1.08 });
    const gd = texFrame('ae_angelic_trim');
    blitTex(P, gd, 0, 6, 80, 4, 1, Hs - 28, 80, 4, 1.05);
    dome(P, cx, Hs - 34, 26, 30, ['#8a5a10', '#b8841c', '#e0ac30', '#ffd860', '#fff0a0'], ['#8a3420', '#b84c28', '#d06a38']);
    for (let y = Hs - 66; y < Hs - 58; y++) P.set(cx, y, pack(GOLDS[2]));
    for (let y = Hs - 22; y < Hs; y++) for (let x = cx - 9; x <= cx + 9; x++) {
      const ax = Math.abs(x - cx);
      P.set(x, y, ax > 7 || y < Hs - 20 ? pack(ax > 8 ? GOLDS[0] : GOLDS[2]) : mixPack('#2a0c06', '#ff8a3a', Math.max(0, (y - Hs + 20) / 20) * 0.7));
    }
    outline(P, pack('#3a1408'));
    return P.canvas();
  };

  /*
   * The Aether's sky (world.js draws it under the islands, in parallax): soft clouds ('cloud', 6 variants) and
   * distant islands far below ('isle', 4 variants), already hazed toward the sky colour. Painted without
   * textures, so they exist before the textures load.
   */
  function skySprite(kind, v = 0) {
    const k = 'sky/' + kind + '/' + v;
    let cv = propCache.get(k);
    if (cv) return cv;
    if (kind === 'cloud') {
      const P = Pix(76, 30), top = pack('#ffffff'), mid = pack('#f3f8fd'), low = pack('#dce8f5'), base = 24;
      const n = 4 + (v % 3);
      for (let b = 0; b < n; b++) {
        const bx = 10 + (b + 0.5) * 56 / n + (H(b, v, 171) - 0.5) * 8, r = 7 + H(b, v, 172) * 7 * (1 - Math.abs(b - (n - 1) / 2) / n);
        const by = base - r * 0.55;
        disc(P, bx, by, r, (x, y) => (y > base ? null : y > by + r * 0.3 ? low : y < by - r * 0.45 ? top : mid));
      }
      cv = P.canvas();
    } else {
      const P = Pix(56, 54), cx = 28, rx = 20 + (v % 2) * 4, ry = 7, haze = rgb('#b6dcf6');
      const g = [pack('#7fd39a'), pack('#9cedb6'), pack('#b4f6c8')], st = [pack('#8a8b88'), pack('#a9aaa6'), pack('#c4c5c0')];
      for (let x = cx - rx; x <= cx + rx; x++) {
        const nx = (x - cx) / rx, depth = Math.round((1 - nx * nx) * (26 + (v % 3) * 6) * (0.8 + H(x >> 2, v, 173) * 0.3));
        for (let y = 0; y < depth; y++) P.set(x, 14 + y, st[y < 3 ? 2 : (x + y) % 5 ? 1 : 0]);
      }
      for (let y = 14 - ry; y <= 14 + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
        const q = ((x - cx) / rx) ** 2 + ((y - 14) / ry) ** 2;
        if (q <= 1) P.set(x, y, g[q > 0.75 ? 0 : H(x, y, 174) < 0.5 ? 1 : 2]);
      }
      for (let t = 0; t < 1 + (v & 1); t++) {
        const x0 = cx - 8 + t * 14 + v;
        for (let y = 6; y < 12; y++) P.set(x0, y, pack('#73654d'));
        disc(P, x0, 4, 4, () => pack(t ? '#ffd84a' : '#72d25a'));
      }
      for (let i = 0; i < P.buf.length; i++) {
        const c = P.buf[i];
        if (c >>> 24) P.buf[i] = blendCol(c, ((0xff << 24) | (haze[2] << 16) | (haze[1] << 8) | haze[0]) >>> 0, 0.45);
      }
      cv = P.canvas();
    }
    propCache.set(k, cv);
    return cv;
  }

  const PORTAL_MCP = { end: 'end_portal', nether: 'nether_portal', cave: 'cave_portal', stronghold: 'stronghold_portal', eye: 'ender_eye',
                       gateway: 'gateway_portal', ancient: 'ancient_frame', ancient_off: 'ancient_frame', tower: 'tower', tower_caged: 'tower',
                       tower_front: 'tower_front', dive: 'dive_portal', cave_ocean: 'cave_ocean_portal',
                       aether: 'aether_frame', aether_block: 'aether_block', aether_fill: 'aether_fill',
                       ae_silver: 'ae_silver', ae_bronze: 'ae_bronze', ae_gold: 'ae_gold' };
  function portalSprite(kind, frame = 0) {
    const k = 'portal/' + kind + '/' + frame;
    let cv = propCache.get(k);
    if (!cv) {
      const v = kind === 'ancient_off' ? -1 : kind === 'tower_caged' ? 1 : kind === 'tower' ? 0 : frame;
      cv = texReady ? MCP[PORTAL_MCP[kind] || 'nether_portal'](BIOMES[0], v) : PAINT.rift(BIOMES[0], frame & 3);
      propCache.set(k, cv);
    }
    return cv;
  }

  function clearProps() { propCache.clear(); }

  try { preload(); } catch (e) { /* sin DOM (herramientas): se queda lo procedural */ }

  return { T, BIOMES, NORMAL, ARENA, ARENA_THEMES, ARENA_TYPES, paintChunk, propSprite, portalSprite, clearProps, liquidStrip,
           BLOCK, DECO, TOWER, DIVE, bubbleSprite, caustic, CAUSTIC_FRAMES, AEPORTAL, LANDMARK, skySprite,
           /** Falling-leaf colour of a tree variant (Golden Oak, Crystal tree) or null. */
           objFx: (bi, v) => { const o = objOf(BIOMES[bi], v); return (o && o.fx) || null; },
           /**
            * Índice en BIOMES de una clave de G.BIOME_DEFS (o -1). Con `tag` ('lava',
            * 'herobrine'), el de esa variante si existe (si no, el normal).
            */
           biomeIndex: (key, tag) => (tag && VARIANT[key + '/' + tag] != null ? VARIANT[key + '/' + tag]
                                      : KEY_INDEX[key] != null ? KEY_INDEX[key] : -1),
           /** ¿Tiene ese bioma una variante `tag`? */
           hasVariant: (key, tag) => VARIANT[key + '/' + tag] != null,
           /** Cuántas variantes de árbol / objeto tiene un bioma. */
           objCount: bi => { const o = BIOMES[bi].mc.obj; return Array.isArray(o) ? o.length : 1; },
           /** Llama a fn cuando ya están todas las texturas (para volver a hornear). */
           onReady(fn) { readyFns.push(fn); if (texReady) fn(); },
           get ready() { return texReady; },
           /** Índice de bioma de la arena de un tipo. */
           arenaBiome: type => ARENA + Math.max(0, ARENA_TYPES.indexOf(type)) };
})();
