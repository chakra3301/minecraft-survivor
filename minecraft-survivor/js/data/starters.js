/* ============ starters.js — starting partners and the personality test ============
 * As in PokéSurvivor: a few questions decide your personality, and your personality
 * decides your partner. You can turn it down and pick another.
 *
 * Stats come from G.DEX; this file only holds traits and the starting move.
 * Each of the 16 traits is the main trait of exactly one starter.
 */
G.STARTERS = [
  { dex: 1,  start: 'tackle',          traits: ['brave', 'loyal'] },        // Steve: Iron Sword
  { dex: 2,  start: 'aura-sphere',     traits: ['clever', 'brave'] },       // Alex: Power Bow
  { dex: 17, start: 'bite',            traits: ['loyal', 'stubborn'] },     // Wolf
  { dex: 8,  start: 'quick-attack',    traits: ['lone', 'mischievous'] },   // Cat
  { dex: 15, start: 'bite',            traits: ['mischievous', 'clever'] }, // Fox
  { dex: 94, start: 'bubble',          traits: ['cheerful', 'kind'] },      // Axolotl
  { dex: 74, start: 'dazzling-gleam',  traits: ['kind', 'calm'] },          // Allay
  { dex: 10, start: 'bug-buzz',        traits: ['stubborn', 'cheerful'] },  // Bee
  { dex: 11, start: 'vine-whip',       traits: ['relaxed', 'patient'] },    // Frog
  { dex: 9,  start: 'gust',            traits: ['chaotic', 'cheerful'] },   // Parrot
  { dex: 71, start: 'hail',            traits: ['calm', 'shy'] },           // Snow Golem
  { dex: 55, start: 'water-gun',       traits: ['patient', 'relaxed'] },    // Turtle
  { dex: 7,  start: 'quick-attack',    traits: ['impulsive', 'shy'] },      // Rabbit
  { dex: 70, start: 'substitute',      traits: ['careful', 'clever'] },     // Villager
  { dex: 13, start: 'water-gun',       traits: ['proud', 'lone'] },         // Llama
  { dex: 14, start: 'metal-claw',      traits: ['shy', 'careful'] }         // Armadillo
];

G.STARTER_BY = {};
for (const s of G.STARTERS) G.STARTER_BY[s.dex] = s;

/** Starting move of any mob (starter or from the gacha). */
G.startMoveOf = dex => {
  const s = G.STARTER_BY[dex];
  return s ? s.start : G.Moves.startFor(G.DEX_BY[dex]);
};

/** Short description of each trait, for the result screen. */
G.TRAIT_TEXT = {
  brave:       'You jump in first when someone needs help.',
  impulsive:   'You act first and think later. Sometimes it works!',
  careful:     'You check every block before you step on it.',
  loyal:       'Your friends know they can always count on you.',
  patient:     'You know how to wait for the right moment.',
  kind:        'Your kindness puts everyone around you at ease.',
  shy:         'The first step is hard for you, but you feel deeply.',
  mischievous: 'You always have a prank ready.',
  calm:        'You stay calm when everything goes wrong.',
  clever:      'You see redstone solutions where others see problems.',
  cheerful:    'Your energy is contagious.',
  stubborn:    'Giving up is not part of the plan.',
  proud:       'You expect to be the best, and you usually are.',
  lone:        'You go your own way and you like it.',
  relaxed:     'Nothing bothers you. Nothing.',
  chaotic:     'Even you don\'t know what you\'ll do next.'
};

G.PERSONALITY_TEST = [
  { q: 'A creeper is hissing right behind your friend! What do you do?', a: [
    { t: 'Charge in and knock it back.',              p: { brave: 2, impulsive: 1 } },
    { t: 'Pull my friend to safety first.',           p: { careful: 2, loyal: 1 } },
    { t: 'Watch from a safe distance.',               p: { calm: 1, shy: 1, lone: 1 } },
    { t: 'Laugh and let it blow.',                    p: { mischievous: 2, chaotic: 1 } } ] },
  { q: 'You find a diamond lying on someone else\'s land.', a: [
    { t: 'Leave it with a sign for its owner.',       p: { loyal: 2, kind: 1 } },
    { t: 'Search everywhere until I find the owner.', p: { stubborn: 2, patient: 1 } },
    { t: 'Check what else is in their chests…',       p: { clever: 2, mischievous: 1 } },
    { t: 'Don\'t touch it. Could be a trap.',         p: { careful: 1, shy: 2 } } ] },
  { q: 'Your perfect day in the game is…', a: [
    { t: 'Exploring with no plan at all.',            p: { impulsive: 2, cheerful: 1 } },
    { t: 'Building something quietly for hours.',     p: { calm: 2, relaxed: 1 } },
    { t: 'Playing with all my friends.',              p: { cheerful: 2, loyal: 1 } },
    { t: 'Training to beat the Ender Dragon.',        p: { stubborn: 2, proud: 1 } } ] },
  { q: 'Night is falling and your shelter isn\'t finished.', a: [
    { t: 'Keep building by torchlight.',              p: { stubborn: 2, careful: 1 } },
    { t: 'I\'ll be fine. I always am.',               p: { proud: 2, calm: 1 } },
    { t: 'Panic and dig straight down.',              p: { shy: 2, kind: 1 } },
    { t: 'Night? Time to go monster hunting.',        p: { chaotic: 2, relaxed: 1 } } ] },
  { q: 'What do your friends say about you?', a: [
    { t: 'That I\'m the funniest one in the group.',  p: { cheerful: 2, mischievous: 1 } },
    { t: 'That they can always count on me.',         p: { loyal: 2, kind: 1 } },
    { t: 'That I\'m a bit mysterious.',               p: { lone: 2, clever: 1 } },
    { t: 'That I never give up.',                     p: { brave: 1, stubborn: 2 } } ] },
  { q: 'The path splits: a dark cave or a long sunny road.', a: [
    { t: 'The cave. More loot!',                      p: { brave: 2, impulsive: 1 } },
    { t: 'The long road, no rush.',                   p: { patient: 2, careful: 1 } },
    { t: 'I sit down and think about it.',            p: { relaxed: 2, calm: 1 } },
    { t: 'Neither. I dig my own tunnel.',             p: { clever: 2, chaotic: 1 } } ] },
  { q: 'Someone wrecks your house while you\'re away.', a: [
    { t: 'Track them down right now.',                p: { proud: 2, impulsive: 1 } },
    { t: 'Ignore it and build again.',                p: { calm: 2, lone: 1 } },
    { t: 'It hurts, even if I say nothing.',          p: { shy: 2, kind: 1 } },
    { t: 'Prank their base right back.',              p: { mischievous: 2, clever: 1 } } ] },
  { q: 'What matters most to you?', a: [
    { t: 'Friendship.',                               p: { loyal: 2, cheerful: 1 } },
    { t: 'Freedom.',                                  p: { lone: 2, impulsive: 1 } },
    { t: 'Peace and quiet.',                          p: { relaxed: 2, patient: 1 } },
    { t: 'Being the best.',                           p: { proud: 2, stubborn: 1 } } ] }
];

/** Trait scores -> { trait, dex } with the partner that fits best. */
G.personalityResult = scores => {
  const trait = Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];
  let best = [], bestScore = -1;
  for (const s of G.STARTERS) {
    // The main trait counts double.
    const v = (scores[s.traits[0]] || 0) * 2 + (scores[s.traits[1]] || 0);
    if (v > bestScore) { bestScore = v; best = [s]; }
    else if (v === bestScore) best.push(s);
  }
  return { trait, dex: G.U.pick(best).dex };
};
