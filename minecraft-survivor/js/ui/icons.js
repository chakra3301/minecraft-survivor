/* ============ icons.js — iconos de Minecraft (sustituyen a los emojis) ============
 * Los que tienen equivalente en Minecraft usan su textura (TEX, 16×16, de
 * assets/mc/); el resto se dibuja desde mapas de caracteres, con la misma
 * paleta sobria. Mientras una textura carga se ve su pixel art de reserva.
 *
 *   G.Icons.html('coin', 18)     <img> para el DOM
 *   G.Icons.draw(ctx, 'coin', x, y, 18)   en el canvas
 *   G.Icons.url('star')          data URL (para CSS)
 *   'items/<nombre>', 'blocks/…'  cualquier textura de assets/mc/
 *   'move:<id>'                  objeto de la habilidad (G.Moves.BY_ID[id].item) en la
 *                                ranura del color del elemento + insignia de la familia
 *   'type:<tipo>'                sólo el emblema
 */
G.Icons = (() => {
  const K = '#141416';          // contorno

  // ---------------- iconos de interfaz (12×12) ----------------
  const MEDAL = ['.kkk....kkk.', '.krk....kqk.', '..krk..kqk..', '...krkkqk...', '....kkkk....', '...kmmmmk...',
                 '..kmwmmmnk..', '.kmwmsmmmnk.', '.kmmsssmmnk.', '.kmmmsmmmnk.', '..kmmmmmnk..', '...kkkkkk...'];

  const UI = {
    gear: { pal: { g: '#d8d8d8', d: '#8a8a8a' }, rows: [
      '....kkkk....', '.kk.kggk.kk.', '.kgkkggkkgk.', '..kggggggk..', 'kkggkkkkggkk', 'kgggk..kgddk',
      'kgggk..kgddk', 'kkggkkkkddkk', '..kggddddk..', '.kgkkddkkdk.', '.kk.kddk.kk.', '....kkkk....'] },
    full: { pal: { w: '#f4f8ff' }, rows: [
      'kkkkk..kkkkk', 'kwwwk..kwwwk', 'kwkk....kkwk', 'kwk......kwk', 'kkk......kkk', '............',
      '............', 'kkk......kkk', 'kwk......kwk', 'kwkk....kkwk', 'kwwwk..kwwwk', 'kkkkk..kkkkk'] },
    phone: { pal: { b: '#2c519f', s: '#9fd8ff', w: '#e6f4ff' }, rows: [
      '...kkkkkk...', '...kbbbbk...', '...kssssk...', '...kswssk...', '...kssssk...', '...kssssk...',
      '...kssssk...', '...kssssk...', '...kssssk...', '...kbbbbk...', '...kbwwbk...', '...kkkkkk...'] },
    // Banderita: reportar una marca del ranking.
    flag: { pal: { r: '#ff5f6d', w: '#c9cfdc' }, rows: [
      '.kk.........', '.kwkkkkkk...', '.kwkrrrrrk..', '.kwkrrrrrrk.', '.kwkrrrrrk..', '.kwkrrrrk...',
      '.kwkkkkk....', '.kwk........', '.kwk........', '.kwk........', 'kkwkk.......', 'kkkkk.......'] },
    // Prohibido (Veto: movimiento bloqueado).
    ban: { pal: { r: '#ff5f6d' }, rows: [
      '...kkkkkk...', '..krrrrrrk..', '.krrkkkkrrk.', 'krrk..krrrrk', 'krk..krrkkrk', 'krk.krrk.krk',
      'krkkrrk..krk', 'krrrrk..krrk', '.krrkkkkrrk.', '..krrrrrrk..', '...kkkkkk...', '............'] },
    // Corazón de la barra de vida de Minecraft.
    heart: { pal: { r: '#e8191e', s: '#9c0d0f', w: '#ffc2c2' }, rows: [
      '............', '..kkk..kkk..', '.kwwrkkrrrk.', 'kwwrrrrrrrsk', 'kwrrrrrrrrsk', 'krrrrrrrrrsk',
      '.krrrrrrrsk.', '..krrrrrsk..', '...krrrsk...', '....krsk....', '.....kk.....', '............'] },
    fist: { pal: { r: '#ff5f6d', s: '#c23a4b', w: '#ffd3d8', c: '#e8e8f0' }, rows: [
      '............', '..kkkkkk....', '.krrrrrrk...', 'krwwrrrrrkk.', 'krwrrrrrrrrk', 'krrrrrrrkrsk',
      'krrrrrrrkrsk', '.krrrrrrskk.', '..kssssssk..', '..kcccccck..', '..kkkkkkkk..', '............'] },
    up: { pal: { g: '#80ff20', d: '#3f9c10', w: '#e0ffb0' }, rows: [
      '.....kk.....', '....kwgk....', '...kwgggk...', '..kwgggggk..', '.kwgggggggk.', 'kkkkggggkkkk',
      '...kggggk...', '...kggggk...', '...kggddk...', '...kgdddk...', '...kddddk...', '...kkkkkk...'] },
    boot: { pal: { b: '#4fb4ff', d: '#2a6fb0', w: '#e6f4ff', g: '#e8e8f0' }, rows: [
      '............', '....kkkk....', '....kbbk....', '....kbbk....', '....kbbk....', '....kbbbkk..',
      '...kbwbbbbk.', '..kbbbbbbbbk', '..kdddddddbk', '..kgggggggk.', '...kkkkkkk..', '............'] },
    // Vínculo (premio de los legendarios): dos eslabones enlazados.
    bond: { pal: { y: '#ffd23f', w: '#fff3b0', p: '#ff8ad8', q: '#ffd3f1' }, rows: [
      '.kkkkk......', 'kwyyyyk.....', 'kykkkyk.....', 'kyk.kyk.....', 'kykkkyk.....', 'kyyyyykkkkk.',
      '.kkkkkqppppk', '.....kpkkkpk', '.....kpk.kpk', '.....kpkkkpk', '.....kpppppk', '......kkkkk.'] },
    clock: { pal: { w: '#f4f4ff', y: '#ffd23f', o: '#c9c9e0' }, rows: [
      '....kkkk....', '..kkyyyykk..', '.kyywwwwyyk.', '.kywwwkwwyk.', 'kywwwwkwwwyk', 'kywwwwkwwwyk',
      'kywwwwkkkwyk', 'kywwwwwwwwyk', '.kywwwwwwyk.', '.kyyowwwyyk.', '..kkyyyykk..', '....kkkk....'] },
    shield: { pal: { s: '#9fb1c9', d: '#5d6f8c', w: '#e6eef8', r: '#4fb4ff' }, rows: [
      '............', '.kkkkkkkkkk.', '.kwwsssssdk.', '.kwssrrssdk.', '.kwssrrssdk.', '.kssrrrrsdk.',
      '.kssrrrrsdk.', '..kssrrsdk..', '..kssssddk..', '...ksssdk...', '....kddk....', '.....kk.....'] },
    sprout: { pal: { g: '#5fe08a', d: '#2f9a52', b: '#8a5a2b' }, rows: [
      '............', '..kkk..kkk..', '.kgggk.kgggk', '.kggggkgggdk', '..kdggkggdk.', '...kkdgdkk..',
      '.....kgk....', '.....kgk....', '...kkkdkkk..', '..kbbbbbbbk.', '..kbbbbbbbk.', '...kkkkkkk..'] },
    magnet: { pal: { r: '#ff5f6d', s: '#c23a4b', w: '#e8e8f0' }, rows: [
      '............', '..kkkkkkkk..', '.krrrrrrrrk.', 'krrsskkssrrk', 'krrk....krrk', 'krrk....krrk',
      'krrk....krrk', 'kwwk....kwwk', 'kwwk....kwwk', 'kkkk....kkkk', '............', '............'] },
    book: { pal: { c: '#4fb4ff', d: '#2a6fb0', p: '#f4f4ff', y: '#ffd23f' }, rows: [
      '............', '.kkkkkkkkkk.', '.kcccccccck.', '.kcyyyyyyck.', '.kcccccccck.', '.kccyyyyyck.',
      '.kcccccccck.', '.kcccccccck.', '.kddddddddk.', '.kppppppppk.', '.kkkkkkkkkk.', '............'] },
    coin: { pal: { y: '#ffd23f', o: '#c08a10', w: '#fff4b0' }, rows: [
      '....kkkk....', '..kkyyyykk..', '.kyywwyyyyk.', '.kywyyyyyok.', 'kyyyyooyyyok', 'kywyoyyoyyok',
      'kyyyoyyoyyok', 'kyyyyooyyyok', '.kyyyyyyyok.', '.kooyyyyook.', '..kkooookk..', '....kkkk....'] },
    // Barra rápida (Hotbar): dos ranuras con espada y arco, la primera elegida.
    cards: { pal: { w: '#f4f4f4', g: '#8b8b8b', d: '#4a4a4a', s: '#5fe0d8', b: '#a0703a', t: '#d8d8d8' }, rows: [
      '............', '............', 'wwwwwwkkkkkk', 'w....wd....g', 'w..s.wd.bt.g', 'w.s..wdb..tg',
      'wb...wdb..tg', 'w....wd.bt.g', 'w....wd....g', 'wwwwwwkkkkkk', '............', '............'] },
    berry: { pal: { r: '#ff7a9e', s: '#c23a6b', w: '#ffd3e0', g: '#5fe08a', d: '#2f9a52' }, rows: [
      '............', '.....kkk....', '....kgggk...', '..kkkgdkkk..', '.krrrkkrrrk.', 'krwwrrrrrrsk',
      'krwrrrrrrrsk', 'krrrrrrrrrsk', 'krrrrrrrrssk', '.krrrrrrssk.', '..kkssssskk.', '....kkkkk...'] },
    bomb: { pal: { b: '#3a3a4a', w: '#8a8aa0', f: '#ffd23f', r: '#ff7b3d' }, rows: [
      '........r...', '.......rfr..', '......kfr...', '.....kfk....', '...kkkkkk...', '..kbbbbbbk..',
      '.kbwwbbbbbk.', '.kbwbbbbbbk.', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kbbbbbbk..', '...kkkkkk...'] },
    star: { pal: { y: '#ffd23f', o: '#c08a10', w: '#fff4b0' }, rows: [
      '.....kk.....', '.....kk.....', '....kwyk....', '....kyyk....', 'kkkkwyyykkkk', 'kwyyyyyyyyok',
      '.kyyyyyyyok.', '..kyyyyyyk..', '..kyyyoyyk..', '.kyok..koyk.', '.kok....kok.', '.kk......kk.'] },
    // Marca de Encantado (shiny): estrella violeta del brillo de encantamiento, con un destello.
    shiny: { pal: { y: '#c77dff', w: '#f3dcff', o: '#7a3fd0', x: '#ffffff' }, rows: [
      '.....kk...x.', '.....kk..xxx', '....kwyk..x.', '....kyyk....', 'kkkkwyyykkkk', 'kwyyyyyyyyok',
      '.kyyyyyyyok.', '..kyyyyyyk..', '..kyyyoyyk..', '.kyok..koyk.', '.kok....kok.', '.kk......kk.'] },
    crown: { pal: { y: '#ffd23f', o: '#c08a10', r: '#ff5f6d' }, rows: [
      '............', '............', 'k....k....k.', 'kk..kyk..kk.', 'kyk.kyk.kyk.', 'kyykyyykyyk.',
      'kyyyyyyyyyk.', 'kyyryyyryyk.', 'kyyyyyyyyyk.', 'koooooooook.', 'kkkkkkkkkkk.', '............'] },
    // Cabeza de Steve.
    user: { pal: { h: '#2f1f0f', j: '#4a3018', s: '#c8906a', t: '#a8704e', w: '#ffffff', b: '#4a52b0', m: '#7a4a33' }, rows: [
      'hhhhhhhh', 'hjhhhhjh', 'hsssssth', 'ssssssss', 'swbsbwss', 'tsssssst', 'ssmmmmss', 'ssmssmss'] },
    cursor: { pal: { y: '#ffffff' }, rows: [
      'k.......', 'kk......', 'kyk.....', 'kyyk....', 'kyyyk...', 'kyyyyk..',
      'kyyyk...', 'kyyk....', 'kyk.....', 'kk......', 'k.......', '........'] },
    sound: { pal: { w: '#e8eef8' }, rows: [
      '............', '.....kk.....', '....kwk..k..', '...kwwk...k.', 'kkkwwwk.k..k', 'kwwwwwk..k.k',
      'kwwwwwk..k.k', 'kkkwwwk.k..k', '...kwwk...k.', '....kwk..k..', '.....kk.....', '............'] },
    mute: { pal: { w: '#e8eef8', r: '#ff5f6d' }, rows: [
      '............', '.....kk.....', '....kwk.....', '...kwwk.....', 'kkkwwwk.r..r', 'kwwwwwk..rr.',
      'kwwwwwk..rr.', 'kkkwwwk.r..r', '...kwwk.....', '....kwk.....', '.....kk.....', '............'] },
    ticket: { pal: { y: '#ffd23f', d: '#c08a10', w: '#fff3b0', r: '#ff5f6d' }, rows: [
      '............', '............', 'kkkkkkkkkkkk', 'kwyyydyyyyyk', 'kyyyyyyrryyk', '.kyyydyrryk.',
      '.kyyyyyrryk.', 'kyyyydyyyyyk', 'kddddddddddk', 'kkkkkkkkkkkk', '............', '............'] },
    ticket10: { pal: { p: '#c47bff', q: '#8a3fd0', w: '#f0d8ff', y: '#ffd23f' }, rows: [
      '............', '............', 'kkkkkkkkkkkk', 'kwpppqppyypk', 'kppppqpyyypk', '.kpppqpyyyk.',
      '.kpppqppyyk.', 'kppppqpppppk', 'kqqqqqqqqqqk', 'kkkkkkkkkkkk', '............', '............'] },
    // Sol cuadrado de Minecraft con su halo.
    wsun: { pal: { w: '#fffbe0', y: '#ffd23f', o: '#f0a31e', r: '#ffe98a' }, rows: [
      '.....rr.....', '.r........r.', '..kkkkkkkk..', '..kwwwyyyk..', '..kwwyyyyk..', 'r.kwyyyyok.r',
      'r.kyyyyyok.r', '..kyyyyook..', '..kyyooook..', '..kkkkkkkk..', '.r........r.', '.....rr.....'] },
    // Nube cuadrada y gotas en raya, como la lluvia de Minecraft.
    wrain: { pal: { w: '#f4f4f4', g: '#b8b8c0', b: '#5b8cff', c: '#9ab8ff' }, rows: [
      '............', '...kkkkk....', '..kwwwwwkkk.', '.kkwwwwwwwwk', 'kwwwwwwwwwgk', 'kggggggggggk',
      '.kkkkkkkkkk.', '..c..b..c...', '..b..b..b...', '.b..c..b....', '.b..b..b....', '............'] },
    wsand: { pal: { s: '#e3d6a3', d: '#b8a26a' }, rows: [
      '............', '..ssssss....', '........ss..', 'ssssssss..s.', '.........s..', '..dddddd....',
      '........dd..', 'dddddd....d.', '.........d..', '...sssss....', '............', '............'] },
    wsnow: { pal: { w: '#ffffff', c: '#9fe0ff' }, rows: [
      '.....w......', '...w.w.w....', '....www.....', '.w..cwc..w..', '..w.cwc.w...', 'wwwwwwwwwww.',
      '..w.cwc.w...', '.w..cwc..w..', '....www.....', '...w.w.w....', '.....w......', '............'] },
    wfog: { pal: { g: '#cfcfd6', d: '#8a8a94' }, rows: [
      '............', '............', '..gggggg....', '.g......gg..', '............', '....gggggg..',
      '..dd......d.', '............', '.ggggggg....', 'g.......gg..', '............', '............'] },
    // Bolas del tragaperras del gacha (una por rareza).
    ball2: { pal: { r: '#3d7bff', s: '#2a56b8', w: '#cfe0ff', b: '#f4f4f4' }, rows: [
      '....kkkk....', '..kkrrrrkk..', '.krwrrrrrrk.', '.krwrrrrrsk.', 'krrrrkkrrssk', 'kkkkkbbkkkkk', 'kbbbkbbkbbbk', 'kbbbbkkbbbbk', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kkbbbbkk..', '....kkkk....'] },
    ball3: { pal: { r: '#3a3a46', s: '#1d1d26', w: '#ffd23f', b: '#f4f4f4' }, rows: [
      '....kkkk....', '..kkrrrrkk..', '.krwrrrrrrk.', '.krwrrrrrsk.', 'krrrrkkrrssk', 'kkkkkbbkkkkk', 'kbbbkbbkbbbk', 'kbbbbkkbbbbk', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kkbbbbkk..', '....kkkk....'] },
    ball4: { pal: { r: '#8a3fd0', s: '#5e2a96', w: '#ff8ad8', b: '#f4f4f4' }, rows: [
      '....kkkk....', '..kkrrrrkk..', '.krwrrrrrrk.', '.krwrrrrrsk.', 'krrrrkkrrssk', 'kkkkkbbkkkkk', 'kbbbkbbkbbbk', 'kbbbbkkbbbbk', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kkbbbbkk..', '....kkkk....'] },
    ballLux: { pal: { r: '#30303a', s: '#18181e', w: '#ff5f6d', b: '#ffd23f' }, rows: [
      '....kkkk....', '..kkrrrrkk..', '.krwrrrrrrk.', '.krwrrrrrsk.', 'krrrrkkrrssk', 'kkkkkbbkkkkk', 'kbbbkbbkbbbk', 'kbbbbkkbbbbk', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kkbbbbkk..', '....kkkk....'] },
    // ---------- objetos equipables (data/items.js) ----------
    leftovers: { pal: { r: '#ff5f6d', d: '#b8283a', w: '#ffd8d8', g: '#5fe08a' }, rows: [
      '.....kgk....', '....kggk....', '..kkkkkkkk..', '.krwrrrrrrk.', 'krwrrrrrrrdk', 'krrrrrrrrrdk',
      'krrrrrrrrrdk', 'krrrrrrrrddk', '.krrrrrrrdk.', '..kdrrrrdk..', '...kkkkkk...', '............'] },
    choiceband: { pal: { p: '#ff8ad8', q: '#c04a98', w: '#ffe0f4' }, rows: [
      '............', '............', '...kkkkkk...', '.kkppwwppkk.', 'kpp......ppk', 'kq........qk',
      'kq........qk', 'kpp......ppk', '.kkppppppkk.', '...kkkkkk...', '............', '............'] },
    quickclaw: { pal: { y: '#ffd23f', o: '#c08a10', b: '#8a5a2b' }, rows: [
      '........kk..', '.......kyk..', '......kyok..', '..kk..kyok..', '.kyk.kyok...', '.kyokyok....',
      '.kyyyok..kk.', '.kbbbbk.kyk.', 'kbbbbbbkyok.', 'kbbbbbbyok..', '.kkkkkkkk...', '............'] },
    focussash: { pal: { o: '#ff9a3d', d: '#c0601a', w: '#ffd0a0' }, rows: [
      '.kk.........', 'kook........', 'kwook.......', '.kwook......', '..kwook.....', '...kwook....',
      '....kwook...', '.....kwook..', '......kwook.', '.......koodk', '........kddk', '.........kk.'] },
    shellbell: { pal: { p: '#ff9ec4', q: '#c05a88', w: '#ffe0ee', y: '#ffd23f' }, rows: [
      '.....kk.....', '....kyyk....', '...kkkkkk...', '..kwppppqk..', '.kwppppppqk.', '.kpppppppqk.',
      'kpppppppppqk', 'kppqpqpqppqk', 'kkkkkkkkkkkk', '....kyyk....', '.....kk.....', '............'] },
    amuletcoin: { pal: { y: '#ffd23f', o: '#c08a10', w: '#fff3b0', r: '#ff5f6d' }, rows: [
      '..kk....kk..', '..krk..krk..', '...krkkrk...', '....kkkk....', '...kyyyyk...', '..kywyyyok..',
      '..kyyooyok..', '..kyyooyok..', '..kyyyyyok..', '...kooook...', '....kkkk....', '............'] },
    luckyegg: { pal: { w: '#fffaf0', s: '#e0d6c8', r: '#ff5f6d' }, rows: [
      '....kkkk....', '...kwwwwk...', '..kwwrwwwk..', '..kwwwwwwk..', '.kwrwwwwrwk.', '.kwwwwwwwwk.',
      '.kwwwrwwwsk.', '.kwwwwwwwsk.', '.kwrwwwwssk.', '..kwwwwssk..', '...kkkkkk...', '............'] },
    lifeorb: { pal: { p: '#c04a98', d: '#7a1f5a', w: '#ffb0e0', r: '#ff3048' }, rows: [
      '....kkkk....', '..kkpppdkk..', '.kwwpppppdk.', '.kwpprrpppk.', 'kppprrrrppdk', 'kpprrrrrrpdk',
      'kpprrrrrrpdk', 'kppprrrrppdk', '.kpppprppdk.', '.kdpppppddk.', '..kkddddkk..', '....kkkk....'] },
    choicescarf: { pal: { b: '#4fb4ff', d: '#2a6fb0', w: '#cfe8ff' }, rows: [
      '............', '............', 'kkkkkkkkkk..', 'kwbbbbbbbbk.', 'kbbbbbbbbdk.', 'kkkkkkkbbdk.',
      '......kbbdk.', '......kbbdk.', '.....kbbbdk.', '.....kbbddk.', '.....kkkkkk.', '............'] },
    rockyhelmet: { pal: { g: '#9aa6b5', d: '#5d6773', w: '#e0e6ee' }, rows: [
      '............', '.k...k...k..', 'kgk.kgk.kgk.', '.kkkkkkkkk..', 'kwggggggggk.', 'kwgggggggdk.',
      'kggggggggdk.', 'kgggkkkkgdk.', 'kggk....kdk.', 'kkk......kk.', '............', '............'] },
    assaultvest: { pal: { g: '#4f8a3a', d: '#2f5a22', y: '#ffd23f' }, rows: [
      '............', '.kkk....kkk.', 'kggk....kggk', 'kgggkkkkgggk', 'kgggyggygggk', 'kgggggggggdk',
      'kggyggggygdk', 'kgggggggggdk', 'kgggggggggdk', 'kddddddddddk', 'kkkkkkkkkkkk', '............'] },
    // ---------- medallas de logros (bronce, plata, oro) ----------
    medal1: { pal: { r: '#ff5f6d', q: '#b8283a', m: '#d08a4a', n: '#8a5226', w: '#ffd0a0', s: '#ffe8c8' }, rows: MEDAL },
    medal2: { pal: { r: '#4fb4ff', q: '#2a6fb0', m: '#c9d2de', n: '#7d8899', w: '#ffffff', s: '#ffffff' }, rows: MEDAL },
    medal3: { pal: { r: '#c47bff', q: '#7a3fb0', m: '#ffd23f', n: '#c08a10', w: '#fff3b0', s: '#fffbe0' }, rows: MEDAL },
    medalOff: { pal: { r: '#3c3c40', q: '#2a2a2e', m: '#3c3c40', n: '#2a2a2e', w: '#505056', s: '#505056' }, rows: MEDAL },
    trophy: { pal: { y: '#ffd23f', d: '#c08a10', w: '#fff3b0' }, rows: [
      '............', '..kkkkkkkk..', 'kkkwyyyydkkk', 'k.kwyyyydk.k', 'k.kwyyyydk.k', '.kkwyyyydkk.',
      '...kyyyyk...', '....kyyk....', '....kyyk....', '...kddddk...', '..kyyyyyyk..', '..kkkkkkkk..'] },
    friends: { pal: { b: '#2fb8b8', d: '#1d7878', g: '#5fa83a', h: '#3a6e22' }, rows: [
      '............', '..kkk..kkk..', '.kbbbkkgggk.', '.kbbbkkgggk.', '..kkk..kkk..', '............',
      '.kkkkkkkkkk.', 'kbbbbkkggggk', 'kbbbbkkggggk', 'kddddkkhhhhk', 'kkkkkkkkkkkk', '............'] },
    ball: { pal: { r: '#ff4d4d', w: '#f4f4f4', s: '#c23a3a' }, rows: [
      '....kkkk....', '..kkrrrrkk..', '.krwrrrrrrk.', '.krwrrrrrsk.', 'krrrrkkrrssk', 'kkkkkwwkkkkk',
      'kwwwkwwkwwwk', 'kwwwwkkwwwwk', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '..kkwwwwkk..', '....kkkk....'] }
  };
  // Variantes de paleta.
  UI.starDim = { rows: UI.star.rows, pal: { y: '#3c3c40', o: '#2a2a2e', w: '#505056' } };
  UI.blank = { pal: {}, rows: Array(16).fill('.'.repeat(16)) };

  // ---------------- glifos de tipo (8×8, blancos sobre el emblema) ----------------
  const TYPE_GLYPH = {
    normal:   ['..####..', '.#....#.', '#......#', '#..##..#', '#..##..#', '#......#', '.#....#.', '..####..'],
    fire:     ['...#....', '...##...', '..###.#.', '.#####..', '.######.', '##.####.', '##..###.', '.######.'],
    water:    ['...##...', '...##...', '..####..', '.######.', '.##.###.', '.#.####.', '.######.', '..####..'],
    grass:    ['.....###', '...#####', '..######', '.####.##', '.###.###', '.##.####', '.#.####.', '#.......'],
    electric: ['....###.', '...###..', '..###...', '.######.', '...###..', '..###...', '.##.....', '#.......'],
    psychic:  ['.######.', '#......#', '#.####.#', '#.#..#.#', '#.#.##.#', '#.#....#', '#.######', '#.......'],
    ice:      ['...#....', '.#.#.#..', '..###...', '#######.', '..###...', '.#.#.#..', '...#....', '........'],
    fighting: ['.######.', '########', '########', '#.#.#.##', '########', '.#######', '..#####.', '..####..'],
    poison:   ['.....##.', '....####', '.....##.', '.###....', '#####...', '#####.##', '.###.###', '.....##.'],
    ground:   ['........', '...##...', '..####..', '.##..##.', '.######.', '##.##.##', '########', '........'],
    flying:   ['#.......', '##......', '###.....', '####....', '######..', '########', '.#######', '...####.'],
    bug:      ['.#....#.', '..#..#..', '..####..', '.##.###.', '########', '###.####', '.######.', '..####..'],
    rock:     ['...###..', '..#####.', '.###.###', '######.#', '##.#####', '#######.', '.#####..', '........'],
    ghost:    ['..####..', '.######.', '##.##.##', '##.##.##', '########', '########', '########', '#.#..#.#'],
    dragon:   ['#.......', '##....#.', '.##..##.', '.######.', '..####..', '.######.', '##.##.##', '#..##..#'],
    dark:     ['..####..', '.###....', '###.....', '###.....', '###.....', '###.....', '.###....', '..####..'],
    steel:    ['..####..', '.######.', '###..###', '##....##', '##....##', '###..###', '.######.', '..####..'],
    fairy:    ['...#....', '...#....', '..###...', '#######.', '..###...', '..#.#...', '.#...#..', '........']
  };

  // Insignia de la familia de movimiento (5×5).
  const KIND_GLYPH = {
    projectile: ['..#..', '...#.', '#####', '...#.', '..#..'],
    melee:      ['....#', '...#.', '..#..', '.#...', '#....'],
    beam:       ['.....', '#####', '.....', '#####', '.....'],
    orbit:      ['.###.', '#...#', '#...#', '#...#', '.###.'],
    nova:       ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
    aura:       ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
    buff:       ['..#..', '.###.', '#####', '..#..', '..#..'],
    boomerang:  ['####.', '#....', '#....', '#....', '#....'],
    chain:      ['##...', '..#..', '...##', '..#..', '##...'],
    mine:       ['..#..', '.###.', '##.##', '.###.', '..#..'],
    meteor:     ['....#', '...#.', '.##..', '####.', '.##..'],
    turret:     ['.###.', '.#.#.', '.###.', '..#..', '#####'],
    dash:       ['#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..'],
    trail:      ['#....', '.....', '..#..', '.....', '....#'],
    cone:       ['....#', '..###', '#####', '..###', '....#']
  };

  // ---------------- texturas de Minecraft ----------------
  /*
   * Iconos con textura (assets/mc/<grupo>/<nombre>.png, 16×16). Hasta que la
   * imagen carga se pinta el pixel art de UI[name] (si lo hay). Cualquier
   * nombre 'items/…' o 'blocks/…' es también un icono válido.
   * Las tiras de animación (alto > ancho) usan su primer fotograma.
   */
  const TEX = {
    coin: 'items/emerald', ticket: 'items/trial_key', ticket10: 'items/ominous_trial_key',
    berry: 'items/apple_golden', bomb: 'blocks/tnt_side', magnet: 'items/compass_item',
    book: 'items/book_enchanted', star: 'items/nether_star', ban: 'blocks/barrier', bond: 'items/lead', cards: 'items/bundle',
    // rarezas (G.Icons.rarity, tragaperras)
    ball: 'items/coal', ball2: 'items/iron_ingot', ball3: 'items/gold_ingot', ballLux: 'items/diamond', ball4: 'items/nether_star',
    // cartas de nivel y mejoras permanentes
    fist: 'items/potion_bottle_damageBoost', boot: 'items/potion_bottle_moveSpeed', clock: 'items/gold_pickaxe',
    shield: 'items/iron_chestplate', sprout: 'items/potion_bottle_regeneration', wsnow: 'items/snowball',
    // objetos equipables (data/items.js)
    leftovers: 'items/potion_bottle_regeneration', choiceband: 'items/mace', quickclaw: 'items/repeater',
    focussash: 'items/totem', shellbell: 'items/melon_speckled', amuletcoin: 'items/rabbit_foot',
    luckyegg: 'items/experience_bottle', lifeorb: 'items/ominous_bottle', choicescarf: 'items/potion_bottle_moveSpeed',
    rockyhelmet: 'items/turtle_helmet', assaultvest: 'items/netherite_chestplate'
  };
  const TPX = 16;               // lado de una textura (un fotograma)
  const imgs = new Map();       // ruta -> Image
  const deps = new Map();       // ruta -> nombres de icono que la usan

  const texOf = name => TEX[name] || (/^(items|blocks)\//.test(name) ? name : null);
  const moveTex = name => { const m = G.Moves && G.Moves.BY_ID[name.slice(5)]; return m && m.item ? m.item : null; };
  const href = path => new URL('assets/mc/' + path + '.png', document.baseURI).href;

  function image(path, user) {
    if (user) { let s = deps.get(path); if (!s) deps.set(path, s = new Set()); s.add(user); }
    let im = imgs.get(path);
    if (!im) {
      im = new Image();
      im.decoding = 'async';
      im.onload = () => texLoaded(path);
      im.src = href(path);
      imgs.set(path, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  }

  // Al cargar una textura: fuera de la caché lo que dependía de ella y se
  // refrescan los <img> que ya estaban en la página.
  const stale = new Set();
  let refreshT = 0;
  function texLoaded(path) {
    for (const n of deps.get(path) || []) { cache.delete(n); urls.delete(n); stale.add(n); }
    if (!refreshT) refreshT = setTimeout(() => {
      refreshT = 0;
      for (const el of document.querySelectorAll('img.pix[data-ico]')) if (stale.has(el.dataset.ico)) el.src = url(el.dataset.ico);
      stale.clear();
    }, 60);
  }

  /** Precarga las texturas de la tabla y las de los movimientos. */
  function preload() {
    for (const n in TEX) image(TEX[n], n);
    if (G.Moves) for (const id in G.Moves.BY_ID) { const it = G.Moves.BY_ID[id].item; if (it) image(it, 'move:' + id); }
  }

  /** Primer fotograma (16×16) de una textura cargada. */
  function frame0(im) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = TPX;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingEnabled = false;
    const s = im.naturalWidth;
    c.drawImage(im, 0, 0, s, s, 0, 0, TPX, TPX);
    return cv;
  }

  /** Lado nativo del icono (para ajustar el tamaño a múltiplos enteros). */
  function native(name) {
    if (name.startsWith('move:')) return moveTex(name) ? 20 : 16;
    if (name.startsWith('type:')) return 16;
    if (texOf(name)) return TPX;
    const d = UI[name] || UI.star;
    return Math.max(...d.rows.map(r => r.length)) + (d.outline ? 2 : 0);
  }

  // ---------------- render ----------------

  const cache = new Map();      // clave -> canvas a 1×
  const urls = new Map();

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.max(0, Math.min(255, Math.round(c * k)));
    return '#' + [f(n >> 16 & 255), f(n >> 8 & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function fromRows(def) {
    const h = def.rows.length, w = Math.max(...def.rows.map(r => r.length));
    const pad = def.outline ? 1 : 0;
    const cv = document.createElement('canvas');
    cv.width = w + pad * 2; cv.height = h + pad * 2;
    const c = cv.getContext('2d', { willReadFrequently: true });   // se lee en svgOf()
    const pal = Object.assign({ k: K }, def.pal);
    if (def.outline) {
      c.fillStyle = K;
      def.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.' || ch === ' ') return;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.fillRect(x + pad + dx, y + pad + dy, 1, 1);
      }));
    }
    def.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.' || ch === ' ' || !pal[ch]) return;
      c.fillStyle = pal[ch];
      c.fillRect(x + pad, y + pad, 1, 1);
    }));
    return cv;
  }

  /** Insignia de familia de movimiento (7×7) en la esquina inferior derecha. */
  function kindBadge(c, kind, at) {
    if (!kind || !KIND_GLYPH[kind]) return;
    c.fillStyle = K; c.fillRect(at, at, 7, 7);
    c.fillStyle = '#3a3a3e'; c.fillRect(at + 1, at + 1, 5, 5);
    c.fillStyle = '#ffd23f';
    KIND_GLYPH[kind].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') c.fillRect(x + at + 1, y + at + 1, 1, 1); }));
  }

  /** Emblema circular de un tipo (16×16), con insignia de familia opcional. */
  function emblem(type, kind) {
    const S = 16;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d', { willReadFrequently: true });   // se lee en svgOf()
    const col = G.U.TYPE_COLOR[type] || '#b0a99f';
    const dark = shade(col, 0.55), lite = shade(col, 1.3);
    // Disco con contorno, sombra abajo-derecha y brillo arriba-izquierda.
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 7.6) continue;
      let f = col;
      if (d > 6.6) f = K;
      else if ((x - 7.5) + (y - 7.5) > 6) f = dark;
      else if ((x - 7.5) + (y - 7.5) < -6.5) f = lite;
      c.fillStyle = f; c.fillRect(x, y, 1, 1);
    }
    const g = TYPE_GLYPH[type] || TYPE_GLYPH.normal;
    // Sombra del glifo y glifo.
    c.fillStyle = dark;
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') c.fillRect(x + 5, y + 5, 1, 1); }));
    c.fillStyle = '#ffffff';
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') c.fillRect(x + 4, y + 4, 1, 1); }));
    if (kind) { c.fillStyle = K; c.fillRect(9, 9, 7, 7); kindBadge(c, kind, 9); }
    return cv;
  }

  /**
   * Habilidad con textura (20×20): ranura del color del elemento con bisel
   * (claro arriba-izquierda, oscuro abajo-derecha), el objeto encima con su
   * sombra y la insignia de la familia.
   */
  function itemBadge(type, kind, im) {
    const S = 20;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingEnabled = false;
    const col = G.U.TYPE_COLOR[type] || '#b0a99f';
    c.fillStyle = K; c.fillRect(1, 0, S - 2, S); c.fillRect(0, 1, S, S - 2);
    c.fillStyle = shade(col, 0.62); c.fillRect(1, 1, S - 2, S - 2);
    c.fillStyle = shade(col, 1.18); c.fillRect(1, 1, S - 2, 1); c.fillRect(1, 1, 1, S - 2);
    c.fillStyle = shade(col, 0.38); c.fillRect(1, S - 2, S - 2, 1); c.fillRect(S - 2, 1, 1, S - 2);
    c.fillStyle = shade(col, 0.82); c.fillRect(2, 2, S - 4, S - 4);
    // Sombra del objeto (su silueta, un píxel abajo a la derecha).
    const f = frame0(im), sh = document.createElement('canvas');
    sh.width = sh.height = TPX;
    const sc = sh.getContext('2d');
    sc.drawImage(f, 0, 0);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = 'rgba(0,0,0,.55)'; sc.fillRect(0, 0, TPX, TPX);
    c.drawImage(sh, 3, 3);
    c.drawImage(f, 2, 2);
    kindBadge(c, kind, 13);
    return cv;
  }

  function canvas(name) {
    let cv = cache.get(name);
    if (cv) return cv;
    if (name.startsWith('move:')) {
      const m = G.Moves.BY_ID[name.slice(5)];
      const im = m && m.item ? image(m.item, name) : null;
      cv = im ? itemBadge(m.type, m.kind, im) : emblem(m ? m.type : 'normal', m ? m.kind : null);
    } else if (name.startsWith('type:')) {
      cv = emblem(name.slice(5));
    } else {
      const t = texOf(name), im = t ? image(t, name) : null;
      if (im) cv = frame0(im);
      else if (t && !UI[name]) return fromRows(UI.blank);      // aún cargando, sin dibujo de reserva
      else cv = fromRows(UI[name] || UI.star);
    }
    cache.set(name, cv);
    return cv;
  }

  function url(name) {
    let u = urls.get(name);
    if (!u) {
      const t = !name.startsWith('move:') && !name.startsWith('type:') && texOf(name);
      if (t) {
        // La textura tal cual (el navegador la carga). Las tiras, recortadas cuando estén cargadas.
        const im = image(t, name);
        u = im && im.naturalHeight > im.naturalWidth ? svgOf(frame0(im)) : href(t);
      } else {
        // Los de interfaz, directamente de su dibujo; los emblemas (tipos, movimientos), del canvas.
        const plain = !name.startsWith('move:') && !name.startsWith('type:');
        u = plain ? svgOfRows(UI[name] || UI.star) : svgOf(canvas(name));
      }
      urls.set(name, u);
    }
    return u;
  }

  /**
   * El icono como SVG de texto (un rectángulo por tramo de píxeles iguales).
   * toDataURL() hacía lo mismo en PNG, pero la primera vez el navegador tarda
   * ~175 ms en prepararlo y eso bloqueaba la carga de la página (Lighthouse).
   */
  function svgDoc(W, H, rects) {
    return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${rects}</svg>`);
  }

  /** Igual que fromRows() pero sin canvas (ni lectura de píxeles). */
  function svgOfRows(def) {
    const h = def.rows.length, w = Math.max(...def.rows.map(r => r.length));
    const pad = def.outline ? 1 : 0;
    const pal = Object.assign({ k: K }, def.pal);
    const px = new Map();
    if (def.outline) def.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) px.set((x + pad + dx) + ',' + (y + pad + dy), K);
    }));
    def.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.' || ch === ' ' || !pal[ch]) return;
      px.set((x + pad) + ',' + (y + pad), pal[ch]);
    }));
    let out = '';
    for (const [k, c] of px) { const [x, y] = k.split(','); out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`; }
    return svgDoc(w + pad * 2, h + pad * 2, out);
  }

  function svgOf(cv) {
    const W = cv.width, H = cv.height;
    const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    let out = '';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W;) {
        const i = (y * W + x) * 4, a = d[i + 3];
        if (!a) { x++; continue; }
        let n = 1;
        while (x + n < W && d[i + n * 4] === d[i] && d[i + n * 4 + 1] === d[i + 1] && d[i + n * 4 + 2] === d[i + 2] && d[i + n * 4 + 3] === a) n++;
        const hex = '#' + ((1 << 24) | (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).slice(1);
        out += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${hex}"${a < 255 ? ` fill-opacity="${(a / 255).toFixed(3)}"` : ''}/>`;
        x += n;
      }
    }
    return svgDoc(W, H, out);
  }

  /**
   * Ajusta el tamaño a un múltiplo entero de la resolución del icono: un
   * icono de 16 px pintado a 24 duplicaría unos píxeles sí y otros no.
   */
  function snap(name, size) {
    const w = native(name);
    return w * Math.max(1, Math.round(size / w));
  }

  /** <img> pixelado para el DOM. */
  function html(name, size = 20, cls = '') {
    const w = snap(name, size);
    // object-fit/position: de una tira de animación sólo se ve el primer fotograma.
    const tex = !name.startsWith('move:') && !name.startsWith('type:') && texOf(name);
    const h = tex ? w : w * canvas(name).height / canvas(name).width;
    return `<img class="pix ${cls}" src="${url(name)}" width="${w}" height="${h}" alt="" draggable="false" data-ico="${name}"${tex ? ' style="object-fit:cover;object-position:50% 0"' : ''}>`;
  }

  /** @param exact  sin ajustar a múltiplos enteros (objetos del mundo, que ya va escalado) */
  function draw(ctx, name, x, y, size, exact = false) {
    const cv = canvas(name);
    const s2 = exact ? size : snap(name, size);
    x += (size - s2) / 2; y += (size - s2) / 2; size = s2;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (exact) ctx.drawImage(cv, x, y, size, size * cv.height / cv.width);
    else ctx.drawImage(cv, Math.round(x), Math.round(y), size, size * cv.height / cv.width);
    ctx.imageSmoothingEnabled = prev;
  }

  /**
   * Destello encantado, dibujado píxel a píxel (no es un icono): una cruz que
   * nace, crece, echa puntas en diagonal y se apaga, en el violeta del brillo
   * de encantamiento. phase 0..1 · px = tamaño de píxel en pantalla.
   */
  function twinkle(ctx, x, y, phase, px = 2) {
    const st = phase < 0.15 ? 0 : phase < 0.32 ? 1 : phase < 0.62 ? 2 : phase < 0.82 ? 1 : 0;
    const X = Math.round(x / px) * px, Y = Math.round(y / px) * px;
    const dot = (dx, dy, c) => { ctx.fillStyle = c; ctx.fillRect(X + dx * px, Y + dy * px, px, px); };
    const ARM = '#f0d2ff', TIP = '#b06cff';
    dot(0, 0, '#ffffff');
    if (st >= 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(dx, dy, ARM);
    if (st >= 2) {
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) dot(dx, dy, ARM);
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) dot(dx, dy, TIP);
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) dot(dx, dy, TIP);
    }
  }

  /**
   * Rareza como material: carbón (Común), hierro (Poco común), oro (Rara),
   * diamante (Épica) y estrella del Nether (Legendaria).
   */
  const RARITY_BALL = { 1: 'ball', 2: 'ball2', 3: 'ball3', 4: 'ballLux', 5: 'ball4' };
  function rarity(n, size = 12) {
    return `<span class="rarity-ball" title="${(G.Gacha && G.Gacha.RARITY_NAME[n]) || ''}">${html(RARITY_BALL[n] || 'ball', size)}</span>`;
  }

  /** Publica en CSS los iconos que usan las hojas de estilo. */
  function installCss() {
    const r = document.documentElement.style;
    r.setProperty('--ico-coin', `url("${url('coin')}")`);
    r.setProperty('--ico-cursor', `url("${url('cursor')}")`);
  }

  preload();

  return { canvas, url, html, draw, twinkle, rarity, RARITY_BALL, installCss, preload, UI, TEX, TYPE_GLYPH };
})();
