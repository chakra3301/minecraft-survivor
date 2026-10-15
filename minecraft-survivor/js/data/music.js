/* ============ music.js — partituras de los temas del juego ============
 * Compuestas para este juego, al estilo tranquilo de la música de Minecraft
 * (piano suave, colchones, silencios largos), pero con melodías propias:
 * no copian ni transcriben ningún tema real. Las toca core/audio.js.
 *
 * bpm, swing (0-0,5), wet: eco de la reverb (0,3 si no se dice).
 * chords: un acorde por compás: "F", "Dm", "C/E", "Gmaj7", "Am7", "E7",
 *         "Dsus2", "Asus4", "Cadd9", "Amadd9", "Dm9", "Bm7b5", "Bdim7", "Cmmaj7"...
 * melody: compases como "A4:4 C5:2 -:2" — nota:duración en semicorcheas
 *         (16 por compás), "-" = silencio, "C4+E4:8" varias a la vez,
 *         "A4:4:0.6" volumen de esa nota. loop: true repite la melodía.
 * parts:  generadas desde `chords` con un patrón de 16 caracteres por compás
 *         (o una lista de patrones, uno por compás, que se repite):
 *           R raíz (bajo del acorde con useBass) · F quinta · O octava · T tercera
 *           0-9 notas del acorde hacia arriba (0 raíz, 1 tercera, 2 quinta,
 *             3 séptima si la hay o si no la octava...)
 *           C acorde entero · "-" alarga la nota anterior · "." silencio
 * drums:  X fuerte · x medio · o suave · . nada (texto o lista por compás)
 * Instrumentos: keys (piano de fieltro), warmpad, celesta, bell, flute, pluck,
 * bass, pad, lead, chip, drone. Percusión: kick, snare, hat, shaker, heart, drip, rumble.
 */
G.MUSIC = {
  // ---------------- Menú: una tarde en la aldea ----------------
  // Sol mayor, 64 bpm. Piano lento sobre acordes de séptima y novena; mucho aire.
  village: {
    bpm: 64, wet: 0.45,
    chords: ['Gmaj7', 'Cadd9', 'Em7', 'Cmaj7', 'Gmaj7', 'Dsus4', 'Em7', 'Cadd9',
             'Am7', 'D', 'Gmaj7', 'Em7', 'Cmaj7', 'Bm7', 'Am7', 'Dsus4',
             'Em7', 'Cmaj7', 'G', 'D/F#', 'Em7', 'Am7', 'Cmaj7', 'Dsus4',
             'Gmaj7', 'Cadd9', 'Em7', 'Cmaj7', 'Am7', 'Dsus4', 'Gmaj7', 'Gmaj7'],
    melody: [{ inst: 'keys', vel: 0.9, bars: [
      '-:8 D5:4 B4:4', 'D5:6 E5:2 G5:8', 'F#5:4 E5:4 B4:8', '-:16',
      '-:4 D5:4 G5:4 A5:4', 'B5:8 A5:4 G5:4', 'F#5:6 E5:2 D5:8', 'E5:12 -:4',
      '-:4 C5:4 E5:4 G5:4', 'F#5:8 E5:4 D5:4', 'B4:8 D5:8', 'G5:12 -:4',
      '-:4 E5:4 G5:4 B5:4', 'A5:8 F#5:4 D5:4', 'E5:8 C5:4 B4:4', 'A4:16',
      '-:16', '-:8 G5:4 E5:4', 'D5:8 B4:8', 'A4:6 B4:2 D5:8',
      '-:4 G5:4 F#5:4 E5:4', 'C5:8 E5:8', 'D5:4 E5:4 G5:8', 'A5:12 -:4',
      'B5:6 A5:2 G5:8', 'E5:4 D5:4 E5:8', '-:8 B4:4 D5:4', 'E5:16',
      '-:4 A4:4 C5:4 E5:4', 'D5:8 -:4 A4:4', 'B4:16', '-:16'] },
    { inst: 'celesta', vel: 0.35, bars: [
      '-:16', '-:16', '-:16', '-:8 B5:8', '-:16', '-:16', '-:16', '-:8 D6:4 G6:4',
      '-:16', '-:16', '-:16', '-:4 D6:12', '-:16', '-:16', '-:16', '-:16',
      '-:8 B6:8', '-:16', '-:16', '-:8 F#6:8', '-:16', '-:16', '-:16', '-:16',
      '-:16', '-:16', '-:16', '-:4 G6:4 B6:8', '-:16', '-:16', '-:8 D6:4 F#6:4', '-:4 A6:12'] }],
    parts: [
      { inst: 'keys', octave: 3, vel: 0.5, pattern: ['0-----2-----3---', '0-----2---1-----'] },
      { inst: 'warmpad', octave: 3, vel: 0.75, pattern: 'C---------------' }
    ]
  },

  // ---------------- Run: Llanuras ----------------
  // Fa mayor, 74 bpm. Más movimiento y una melodía que sube: esperanzada.
  forest: {
    bpm: 74, wet: 0.4,
    chords: ['Fmaj7', 'C', 'Dm7', 'Bbmaj7', 'F', 'Csus4', 'Bbadd9', 'C',
             'Dm7', 'Am7', 'Bbmaj7', 'F', 'Gm7', 'C', 'Fmaj7', 'Fmaj7',
             'Bbmaj7', 'C', 'Am7', 'Dm7', 'Bbmaj7', 'C', 'Fsus2', 'F',
             'Gm7', 'Am7', 'Bbmaj7', 'Csus4', 'Dm7', 'Bbmaj7', 'Csus4', 'F'],
    melody: [{ inst: 'keys', vel: 0.95, bars: [
      'C5:4 F5:4 A5:8', 'G5:6 E5:2 C5:8', 'D5:4 F5:4 A5:4 C6:4', 'A5:12 -:4',
      '-:4 A5:4 G5:4 F5:4', 'G5:8 F5:4 C5:4', 'D5:4 F5:4 C6:8', 'G5:12 -:4',
      'F5:4 A5:4 D6:6 C6:2', 'C6:4 A5:4 E5:8', 'F5:4 A5:4 D6:8', 'C6:12 -:4',
      'Bb5:4 A5:4 G5:4 F5:4', 'E5:8 G5:4 C6:4', 'A5:16', '-:16',
      '-:4 D5:4 F5:4 A5:4', 'G5:8 E5:8', 'C6:6 A5:2 E5:8', 'F5:4 E5:4 D5:8',
      '-:4 F5:4 Bb5:4 A5:4', 'G5:4 E5:4 G5:8', 'G5:4 A5:4 C6:8', 'A5:12 -:4',
      'D6:8 Bb5:4 G5:4', 'C6:8 A5:4 E5:4', 'F5:4 A5:4 D6:4 C6:4', 'F5:8 G5:8',
      'A5:6 G5:2 F5:8', 'D5:8 F5:4 A5:4', 'G5:16', '-:16'] }],
    parts: [
      { inst: 'keys', octave: 3, vel: 0.42, pattern: ['0...2...3...2...', '0...2...1...2...', '0...2...3...4...', '0.......2...1...'] },
      { inst: 'celesta', octave: 5, vel: 0.3, pattern: ['................', '........2.......', '................', '....1.......3...'] },
      { inst: 'warmpad', octave: 3, vel: 0.6, pattern: 'C---------------' }
    ],
    drums: { shaker: ['................', '................', '........o.......', '................'] }
  },

  // ---------------- Run: Cuevas de Amatista ----------------
  // La menor, 62 bpm. Piano grave y escaso, destellos de celesta y gotas de agua.
  cave: {
    bpm: 62, wet: 0.55,
    chords: ['Amadd9', 'Amadd9', 'Fmaj7', 'Fmaj7', 'Dm9', 'Dm9', 'Esus4', 'E',
             'Amadd9', 'Amadd9', 'Cmaj7', 'Cmaj7', 'Fmaj7', 'Fmaj7', 'Bm7b5', 'E7',
             'Dm9', 'Dm9', 'Amadd9', 'Amadd9', 'Fmaj7', 'Cmaj7', 'Esus4', 'E',
             'Fmaj7', 'Fmaj7', 'Dm9', 'Dm9', 'Esus4', 'Esus4', 'Amadd9', 'Amadd9'],
    melody: [{ inst: 'keys', vel: 0.8, bars: [
      '-:16', '-:8 E5:4 C5:4', 'A4:12 -:4', '-:16',
      '-:8 F5:4 E5:4', 'D5:8 C5:8', 'B4:12 -:4', 'G#4:8 -:8',
      '-:16', '-:4 E5:4 B5:8', 'G5:8 -:8', '-:8 B4:4 E5:4',
      'A5:12 -:4', '-:4 G5:4 F5:4 E5:4', 'D5:8 F5:8', 'G#5:12 -:4',
      '-:16', 'E5:4 F5:4 A5:8', '-:8 C6:8', 'B5:12 -:4',
      '-:16', 'E5:6 D5:2 B4:8', 'A4:16', '-:16',
      '-:8 C5:4 E5:4', 'A5:8 G5:4 E5:4', 'F5:12 -:4', '-:16',
      '-:4 B4:4 E5:4 A5:4', 'B5:16', '-:16', '-:16'] }],
    parts: [
      { inst: 'keys', octave: 2, vel: 0.5, pattern: ['0-------------..', '........2-------'] },
      { inst: 'celesta', octave: 4, vel: 0.4, pattern: ['....4.......3...', '..........5.....', '........4...6...', '................', '......3.........'] },
      { inst: 'warmpad', octave: 3, vel: 0.7, pattern: 'C---------------' }
    ],
    drums: { drip: ['..........o.....', '................', '...o............'] }
  },

  // ---------------- Run: Desierto del Nether ----------------
  // Do menor frigio, 60 bpm. Zumbido grave sobre Do, segundas menores y tritonos.
  volcano: {
    bpm: 60, wet: 0.5,
    chords: ['Cm', 'Cm', 'Dbmaj7/C', 'Dbmaj7/C', 'Cmmaj7', 'Cmmaj7', 'Ab/C', 'G',
             'Fm/C', 'Fm/C', 'Gb/C', 'Gb/C', 'Cm', 'Dbmaj7/C', 'Bbm/C', 'Cmmaj7',
             'Cm', 'Cm', 'Dbmaj7/C', 'Dbmaj7/C', 'Fm7/C', 'Fm7/C', 'Gdim', 'G',
             'Abmaj7/C', 'Gb/C', 'Fm/C', 'Dbmaj7/C', 'Cmmaj7', 'Cmmaj7', 'Cm', 'Cm'],
    melody: [{ inst: 'keys', vel: 0.75, bars: [
      '-:16', '-:8 G4:4 Ab4:4', 'G4:12 -:4', 'F4:4 Eb4:4 Db4:8',
      '-:16', '-:4 B4:4 C5:8', 'Eb5:8 C5:4 Ab4:4', 'B4:12 -:4',
      '-:16', '-:8 Ab4:4 C5:4', 'Db5:8 Bb4:8', 'C5:12 -:4',
      '-:4 Eb5:4 D5:4 C5:4', 'Db5:16', 'F4:8 Gb4:8', 'G4:12 -:4',
      '-:16', '-:16', 'C5:8 Ab4:8', 'F4:16',
      '-:8 Eb5:4 F5:4', 'Ab5:8 G5:8', 'Db5:8 Bb4:8', 'B4:16',
      '-:4 C5:4 Eb5:4 G5:4', 'F5:8 Db5:8', 'C5:16', '-:16',
      '-:8 B4:4 D5:4', 'Eb5:12 -:4', 'G4:8 F4:4 Eb4:4', 'C4:12 -:4'] }],
    parts: [
      { inst: 'drone', octave: 2, useBass: true, vel: 0.9, pattern: 'R---------------' },
      { inst: 'warmpad', octave: 3, vel: 0.5, pattern: 'C---------------' },
      { inst: 'bell', octave: 3, vel: 0.45, pattern: ['0...............', '................', '........1.......', '................'] }
    ],
    drums: { rumble: ['x...............', '................', '................', '................', '................', '........o.......'],
             kick: ['o...............', '................'] }
  },

  // ---------------- Combate contra jefe ----------------
  // Mi menor, 140 bpm. Cuadradas secas "de 8 bits", bajo a corcheas y batería.
  boss: {
    bpm: 140, wet: 0.25,
    chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B7',
             'Em', 'Em', 'C', 'D', 'Am', 'C', 'B7', 'B7',
             'C', 'D', 'Bm', 'Em', 'C', 'D', 'B7', 'B7',
             'Am', 'Am', 'Em', 'Em', 'C', 'D', 'B7', 'B7'],
    melody: [{ inst: 'chip', vel: 1, bars: [
      'E5:2 B4:2 E5:2 G5:2 B5:4 A5:2 G5:2', 'F#5:2 G5:2 F#5:2 E5:2 D5:4 E5:4',
      'C5:2 E5:2 G5:2 C6:2 B5:4 G5:4', 'A5:4 F#5:4 D5:4 F#5:4',
      'E5:2 B4:2 E5:2 G5:2 B5:4 D6:4', 'C6:2 B5:2 A5:2 G5:2 F#5:4 G5:4',
      'E5:4 G5:4 C6:4 E6:4', 'D#6:8 B5:4 F#5:4',
      'E5:2 B4:2 E5:2 G5:2 B5:4 A5:2 G5:2', 'F#5:2 G5:2 F#5:2 E5:2 D5:4 E5:4',
      'C5:2 E5:2 G5:2 C6:2 B5:4 G5:4', 'A5:4 F#5:4 D5:4 F#5:4',
      'A5:2 C6:2 E6:2 C6:2 A5:4 E5:4', 'G5:2 E5:2 C5:2 E5:2 G5:4 C6:4',
      'B5:4 A5:2 G5:2 F#5:4 D#5:4', 'B4:8 -:8',
      'G5:2 -:2 G5:2 -:2 E5:2 G5:2 C6:4', 'A5:2 -:2 A5:2 -:2 F#5:2 A5:2 D6:4',
      'B5:2 -:2 B5:2 -:2 F#5:2 B5:2 D6:4', 'E6:12 -:4',
      'C6:2 B5:2 G5:2 E5:2 C6:2 B5:2 G5:2 E5:2', 'D6:2 A5:2 F#5:2 D5:2 D6:2 A5:2 F#5:2 D5:2',
      'D#6:4 F#6:4 A6:4 F#6:4', 'B5:16',
      '-:16', 'A5:4 C6:4 E6:8', '-:16', 'B5:4 G5:4 E5:8',
      'C6:2 C6:2 B5:2 C6:2 E6:4 C6:4', 'D6:2 D6:2 C6:2 D6:2 F#6:4 D6:4',
      'D#6:4 B5:4 F#5:4 A5:4', 'B5:4 D#6:4 F#6:4 -:4'] }],
    parts: [
      { inst: 'bass', octave: 2, vel: 0.95, pattern: 'R.R.O.R.R.R.O.RF' },
      { inst: 'pluck', octave: 4, vel: 0.4, pattern: '0.1.2.1.3.2.1.2.' }
    ],
    drums: { kick: 'X...x...X...x...', snare: ['....X.......X...', '....X.......X...', '....X.......X...', '....X.......X.xx'],
             hat: 'x.o.x.o.x.o.x.o.' }
  }
};

/* ---------------- Portal del Nether: la arena del jefe ----------------
 * Re menor con el Mi bemol frigio, 156 bpm. Urgente: bajo galopando,
 * arpegio a semicorcheas, y destellos de celesta que suenan "de otro mundo".
 * A mitad de tema, cuatro compases casi vacíos antes de volver con fuerza. */
G.MUSIC.rift = {
  bpm: 156, wet: 0.32,
  chords: ['Dm', 'Eb', 'Dm', 'C', 'Dm', 'Eb', 'Bb', 'A7',
           'Gm', 'A', 'Dm', 'Bb', 'Gm', 'Eb', 'A7', 'A7',
           'Bbmaj7', 'C', 'Dm', 'Dm', 'Bbmaj7', 'C', 'Eb', 'A7',
           'Dm', 'Eb', 'Dm', 'Eb', 'Gm', 'A', 'Dm', 'A7'],
  melody: [{ inst: 'lead', vel: 0.95, bars: [
    'D5:2 F5:2 A5:2 D6:2 C6:2 A5:2 F5:4', 'G5:2 Bb5:2 Eb6:4 D6:4 Bb5:4',
    'A5:2 F5:2 D5:2 F5:2 A5:4 D6:4', 'E6:4 C6:4 G5:4 E5:4',
    'D6:2 C6:2 A5:2 F5:2 D6:2 C6:2 A5:2 F5:2', 'Eb6:2 D6:2 Bb5:2 G5:2 Eb6:4 G6:4',
    'F6:4 D6:4 Bb5:4 D6:4', 'C#6:8 E6:4 A5:4',
    'G5:4 Bb5:2 D6:2 G6:4 F6:2 D6:2', 'E6:4 C#6:4 A5:4 E5:4',
    'F5:2 A5:2 D6:4 F6:4 E6:2 D6:2', 'D6:8 F6:8',
    'Bb6:4 A6:2 G6:2 D6:4 Bb5:4', 'G6:4 Eb6:4 Bb5:4 G5:4',
    'A5:2 C#6:2 E6:2 G6:2 A6:4 G6:4', 'E6:4 C#6:4 A5:4 -:4',
    '-:16', '-:16', 'A5:16', '-:8 F5:4 E5:4',
    'D5:8 F5:8', 'E5:8 G5:8', 'Bb5:8 G5:4 Eb5:4', 'C#6:4 E6:4 G6:4 A6:4',
    'D5:2 F5:2 A5:2 D6:2 C6:2 A5:2 F5:4', 'G5:2 Bb5:2 Eb6:4 D6:4 Bb5:4',
    'A5:2 F5:2 D5:2 F5:2 A5:4 D6:4', 'G6:4 Eb6:4 Bb5:4 G5:4',
    'D6:2 Bb5:2 G5:2 Bb5:2 D6:4 G6:4', 'E6:2 C#6:2 A5:2 C#6:2 E6:4 A6:4',
    'F6:4 E6:2 D6:2 A5:4 F5:4', 'E5:4 G5:4 C#6:4 E6:4'] },
  { inst: 'celesta', vel: 0.4, bars: [
    '-:16', '-:16', '-:16', '-:16', '-:16', '-:16', '-:16', '-:16',
    '-:16', '-:16', '-:16', '-:16', '-:16', '-:16', '-:16', '-:16',
    'D6:4 A6:4 F6:4 Eb7:4', 'E6:4 G6:4 C7:8', 'A6:4 F6:4 D6:4 A5:4', 'F6:4 E6:4 D6:8',
    'D6:4 A6:4 F6:4 C7:4', 'G6:4 E6:4 C6:8', 'Bb6:4 G6:4 Eb6:4 D7:4', 'C#7:8 -:8',
    '-:16', '-:16', '-:16', '-:16', '-:16', '-:16', '-:16', '-:16'] }],
  parts: [
    { inst: 'bass', octave: 2, vel: 0.95, pattern: 'R.RRR.RRR.RRF.OR' },
    { inst: 'pluck', octave: 4, vel: 0.32, pattern: '0213021302130213' },
    { inst: 'warmpad', octave: 3, vel: 0.55, pattern: 'C---------------' },
    { inst: 'celesta', octave: 5, vel: 0.28, pattern: ['..........2.....', '......1.......0.'] }
  ],
  drums: { kick: 'X..xX..xX..xX.x.', snare: ['....X.......X...', '....X.......X..X'], hat: 'xoxoxoxoxoxoxoxo' }
};

/* ---------------- Herobrine despierta (minuto 30) ----------------
 * La menor con acordes disminuidos y el Fa menor prestado, 92 bpm.
 * Un latido lento que de vez en cuando se acelera, un reloj, zumbido grave,
 * piano en el registro bajo y una caja de música (celesta) inquietante. */
G.MUSIC.judgment = {
  bpm: 92, wet: 0.45,
  chords: ['Am', 'Am', 'Bdim7', 'Am', 'Fm', 'Fm', 'E7', 'E7',
           'Am', 'Am', 'Dm', 'Dm', 'Bm7b5', 'Bm7b5', 'E', 'E7',
           'Fmaj7', 'Fm', 'Am', 'Am', 'G#dim7', 'Am', 'Fm', 'E7',
           'Am', 'Bbmaj7', 'Am', 'G#dim7', 'Fm', 'Fm', 'E7', 'E7'],
  melody: [{ inst: 'keys', vel: 0.85, bars: [
    '-:16', 'E4:8 F4:8', 'D4:12 -:4', 'C4:4 B3:4 A3:8',
    '-:16', 'Ab4:8 G4:8', 'G#4:16', '-:16',
    '-:8 A4:4 C5:4', 'E5:8 Eb5:8', 'D5:8 F5:4 A4:4', '-:16',
    'F5:8 D5:4 B4:4', '-:4 A4:4 C5:4 D5:4', 'B4:8 G#4:8', 'D5:12 -:4',
    '-:16', 'C5:4 Ab4:4 F4:8', 'E4:16', '-:16',
    'F5:4 D5:4 B4:4 G#4:4', 'A4:16', 'Ab4:8 C5:8', 'B4:8 G#4:8',
    '-:16', 'Bb4:8 A4:8', 'C5:8 E5:8', 'D5:8 B4:8',
    'C5:4 Ab4:4 C5:4 Eb5:4', 'F5:12 -:4', 'E5:4 D5:4 B4:4 G#4:4', 'E4:16'] },
  { inst: 'celesta', vel: 0.42, bars: [
    'A5:4 C6:4 B5:4 E5:4', '-:16', 'D6:4 F6:4 Ab5:8', '-:16',
    'Ab5:4 C6:4 F5:8', '-:16', 'G#5:4 B5:4 D6:4 G#5:4', 'E5:12 -:4',
    '-:16', '-:16', '-:8 A6:4 F6:4', '-:16', '-:16', '-:16', '-:8 G#6:8', '-:16',
    'A5:4 C6:4 E6:4 C6:4', '-:16', 'A5:4 C6:4 B5:4 E5:4', '-:16',
    'F6:4 D6:4 B5:4 G#5:4', '-:16', 'Ab5:4 C6:4 F5:8', '-:16',
    'A5:4 C6:4 B5:4 E5:4', 'D6:8 -:8', '-:16', 'B5:4 D6:4 F6:8',
    '-:16', 'Ab5:4 C6:4 F6:8', 'G#5:4 B5:4 D6:4 E6:4', '-:16'] }],
  parts: [
    { inst: 'drone', octave: 2, useBass: true, vel: 0.85, pattern: 'R---------------' },
    { inst: 'keys', octave: 2, vel: 0.45, pattern: ['0.......2.......', '0...............'] },
    { inst: 'warmpad', octave: 3, vel: 0.55, pattern: 'C---------------' }
  ],
  drums: { heart: ['Xo......Xo......', 'Xo......Xo......', 'Xo......Xo......', 'Xo..Xo..Xo..Xo..'],
           hat: '....o.......o...' }
};

/** Tema de cada bioma durante la run. */
G.BIOME_MUSIC = ['forest', 'cave', 'volcano'];

/* ============ Real Minecraft soundtrack: playlists by context ============
 * When js/data/music-files.js exists (tools/mc/import-music.mjs copies the owner's own
 * Minecraft Java install), core/audio.js streams these tracks instead of the synth songs.
 * Key = what the game passes to G.Audio.music(key): 'menu' | 'boss' | 'trial' | 'herobrine' |
 * any G.BIOME_DEFS key. Biomes of the same dimension share a class: switching between them
 * doesn't cut the track, the next one is drawn from the new list. Other changes crossfade.
 * tracks: ids under assets/music (no ".ogg"); "id*3" = weight 3 (default 1), as in Minecraft's
 * sounds.json. Missing files are skipped. synth: the G.MUSIC song used when no file can play.
 * Based on vanilla sounds.json (music.overworld.*, music.nether.*, music.end ...).
 */
(() => {
  const CLASSIC = ['game/minecraft', 'game/clark', 'game/sweden', 'game/subwoofer_lullaby', 'game/living_mice',
    'game/haggstrom', 'game/danny', 'game/key', 'game/oxygene', 'game/dry_hands', 'game/wet_hands', 'game/mice_on_venus'];
  // music.game: the calm Overworld pool (C418 + the newer composers).
  const CALM = [...CLASSIC, 'game/a_familiar_room', 'game/below_and_above', 'game/broken_clocks',
    'game/comforting_memories', 'game/ebb*2', 'game/featherfall', 'game/fireflies', 'game/floating_dream', 'game/home*2',
    'game/komorebi', 'game/left_to_bloom', 'game/lilypad', 'game/memories*2', 'game/nightly*2', 'game/one_more_day',
    'game/os_piano', 'game/puzzlebox', 'game/shores*2', 'game/watcher', 'game/yakusoku'];
  const CAVES = ['game/infinite_amethyst*2', 'game/echo_in_the_wind', 'game/left_to_bloom', 'game/deeper'];
  const NETHER = ['game/nether/ballad_of_the_cats', 'game/nether/concrete_halls', 'game/nether/dead_voxel', 'game/nether/warmth'];
  const END = ['game/end/the_end*2', 'game/end/alpha'];
  // The Aether: the gentlest pieces in the game (C418's lullabies and the softest of the rest).
  const AETHER = ['game/sweden*2', 'game/wet_hands*2', 'game/subwoofer_lullaby*2', 'game/living_mice', 'game/haggstrom', 'game/clark',
    'game/mice_on_venus', 'game/creative/aria_math', 'menu/moog_city_2', 'game/floating_dream', 'game/featherfall', 'game/komorebi'];
  // The Aquatic update's underwater tracks (the Ocean Shore and every biome of The Ocean).
  const WATER = ['game/water/axolotl', 'game/water/dragon_fish', 'game/water/shuniji'];

  G.MUSIC_PLAYLISTS = {
    menu:      { synth: 'village', tracks: ['menu/beginning_2', 'menu/floating_trees', 'menu/moog_city_2', 'menu/mutation'] },
    boss:      { synth: 'boss', tracks: ['game/end/boss'] },
    trial:     { synth: 'rift', tracks: ['game/creative/taswell', 'game/creative/haunt_muskie', 'game/creative/dreiton',
                 'game/creative/aria_math', 'game/creative/biome_fest', 'game/creative/blind_spots'] },
    // Herobrine: Ancestry (the Deep Dark's theme, the most menacing piece in the game) and
    // Eld Unknown (uneasy, unresolved). Nothing calm or familiar for the end of a run.
    herobrine: { synth: 'judgment', tracks: ['game/ancestry*2', 'game/eld_unknown'] },
    // The Aether (systems/aether.js): the gentle list while you wander; C418's "Alpha" (the credits) for the ending.
    aether:     { synth: 'village', tracks: AETHER },
    aether_end: { synth: 'village', tracks: ['game/end/alpha'] },
    // ---- Overworld ----
    plains:         { synth: 'forest', tracks: CLASSIC },
    forest:         { synth: 'forest', tracks: CLASSIC },
    dark_forest:    { synth: 'forest', tracks: [...CLASSIC, 'game/broken_clocks', 'game/comforting_memories', 'game/floating_dream',
                      'game/swamp/aerie', 'game/swamp/firebugs', 'game/swamp/labyrinthine'] },  // vanilla music.overworld.forest
    cherry_grove:   { synth: 'forest', tracks: ['game/bromeliad', 'game/featherfall', 'game/echo_in_the_wind'] },
    savanna:        { synth: 'forest', tracks: CALM },
    desert:         { synth: 'forest', tracks: ['game/crescent_dunes', 'game/echo_in_the_wind'] },
    badlands:       { synth: 'forest', tracks: ['game/crescent_dunes', 'game/echo_in_the_wind'] },
    snowy_plains:   { synth: 'forest', tracks: ['game/stand_tall', 'game/wending', 'game/an_ordinary_day'] },
    swamp:          { synth: 'forest', tracks: ['game/swamp/aerie', 'game/swamp/firebugs', 'game/swamp/labyrinthine'] },
    jungle:         { synth: 'forest', tracks: ['game/left_to_bloom', 'game/bromeliad'] },
    ocean_shore:    { synth: 'forest', tracks: WATER },
    // ---- The Ocean (underwater; the Elder Guardians awake switch it to `boss`) ----
    kelp_forest:    { synth: 'forest', tracks: WATER },
    coral_reef:     { synth: 'forest', tracks: WATER },
    ocean_ruins:    { synth: 'forest', tracks: WATER },
    deep_ocean:     { synth: 'cave', tracks: WATER },
    ocean_monument: { synth: 'cave', tracks: WATER },
    // ---- The Underworld (caves) ----
    dripstone_caves: { synth: 'cave', tracks: [...CAVES, 'game/os_piano', 'game/pokopoko', 'game/endless'] },
    lush_caves:     { synth: 'cave', tracks: [...CAVES, 'game/floating_dream', 'game/os_piano'] },
    amethyst_caves: { synth: 'cave', tracks: [...CAVES, 'game/endless', 'game/pokopoko'] },
    mineshaft:      { synth: 'cave', tracks: ['game/deeper*2', 'game/echo_in_the_wind', 'game/infinite_amethyst', 'game/endless'] },
    // ---- The Stronghold: uneasy, half-familiar ----
    stronghold_halls:   { synth: 'cave', tracks: ['game/eld_unknown*2', 'game/deeper', 'game/a_familiar_room', 'game/broken_clocks'] },
    stronghold_library: { synth: 'cave', tracks: ['game/eld_unknown*2', 'game/a_familiar_room*2', 'game/broken_clocks', 'game/deeper'] },
    // ---- The Ancient City ----
    ancient_city:   { synth: 'cave', tracks: ['game/ancestry*3', 'game/deeper'] },
    deep_dark:      { synth: 'cave', tracks: ['game/ancestry*3', 'game/deeper'] },
    // ---- Nether (biome track weighted like vanilla: 6-7 to 1 against each general one) ----
    nether_wastes:    { synth: 'volcano', tracks: ['game/nether/nether_wastes/rubedo*6', ...NETHER] },
    crimson_forest:   { synth: 'volcano', tracks: ['game/nether/crimson_forest/chrysopoeia*7', ...NETHER] },
    soul_sand_valley: { synth: 'volcano', tracks: ['game/nether/soulsand_valley/so_below*7', ...NETHER] },
    warped_forest:    { synth: 'volcano', tracks: NETHER },
    basalt_deltas:    { synth: 'volcano', tracks: NETHER },
    nether_fortress:  { synth: 'volcano', tracks: NETHER },
    // ---- The End (alpha is the credits music: it fits the last dimension) ----
    the_end:       { synth: 'cave', tracks: END },
    end_highlands: { synth: 'cave', tracks: END },
    end_city:      { synth: 'cave', tracks: END },
    // ---- The Aether (game.js plays 'aether' there; these keep any biome lookup gentle too) ----
    aether_meadow:  { synth: 'village', tracks: AETHER },
    skyroot_forest: { synth: 'village', tracks: AETHER },
    golden_grove:   { synth: 'village', tracks: AETHER },
    cloud_sea:      { synth: 'village', tracks: AETHER },
    rainbow_falls:  { synth: 'village', tracks: AETHER }
  };
})();

/** Old ids from before biomes existed; still accepted by G.Audio.music(). ('forest' and 'boss' are keys.) */
G.MUSIC_ALIASES = { village: 'menu', cave: 'amethyst_caves', volcano: 'nether_wastes', rift: 'trial', judgment: 'herobrine' };
