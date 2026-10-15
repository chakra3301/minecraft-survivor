/* ============ missions.js — daily and weekly mission templates ============
 * Every day brings 3 dailies and every week 2 weeklies (Spain time), with
 * random goals and elements. They complete while playing and the reward is
 * claimed in the Missions screen. The logic is in systems/progress.js.
 *
 *   ev      event that advances it (see G.Progress.event)
 *   match   (data, param) -> does this event count?
 *   value   data -> how much it is worth; mode 'max' keeps the highest,
 *           'add' (default) adds up (1 if there is no value)
 *   param   'type': draws an element for the mission
 */
G.MissionDefs = (() => {
  const T = t => G.U.TYPE_NAME[t];
  const an = w => (/^[AEIOU]/.test(w) ? 'an ' : 'a ') + w;
  const min = d => Math.floor(d.time / 60);

  const daily = [
    { id: 'kill', ev: 'kill', goals: [300, 500, 800], reward: { t1: 2, coins: 150 },
      text: n => `Defeat ${n} mobs` },
    { id: 'killType', ev: 'kill', param: 'type', goals: [30, 50, 80], reward: { t1: 2, coins: 200 },
      match: (d, t) => d.types.includes(t), text: (n, t) => `Defeat ${n} ${T(t)} mobs` },
    { id: 'survive', ev: 'runEnd', mode: 'max', value: min, goals: [5, 7, 9], reward: { t1: 3, coins: 200 },
      text: n => `Survive ${n} minutes in a run` },
    { id: 'level', ev: 'runEnd', mode: 'max', value: d => d.level, goals: [8, 12, 15], reward: { t1: 2, coins: 200 },
      text: n => `Reach level ${n} in a run` },
    { id: 'boss', ev: 'kill', match: d => d.boss, goals: [1, 2], reward: { t1: 3, coins: 250 },
      text: n => (n === 1 ? 'Defeat a boss' : `Defeat ${n} bosses`) },
    { id: 'chest', ev: 'chest', goals: [1, 2], reward: { t1: 2, coins: 200 },
      text: n => (n === 1 ? 'Open a locked chest' : `Open ${n} locked chests`) },
    { id: 'coins', ev: 'runEnd', value: d => d.coins, goals: [100, 200, 300], reward: { t1: 2, coins: 150 },
      text: n => `Collect ${n} emeralds in your runs` },
    { id: 'playType', ev: 'runEnd', param: 'type', mode: 'max', value: min, goals: [3], reward: { t1: 3, coins: 200 },
      match: (d, t) => d.types.includes(t), text: (n, t) => `Survive ${n} minutes playing as ${an(T(t))} mob` },
    { id: 'item', ev: 'item', goals: [1], reward: { t1: 2, coins: 150 },
      text: () => 'Find a held item' },
    { id: 'evolve', ev: 'evolve', goals: [1], reward: { t1: 3, coins: 250 },
      text: () => 'Use a Smithing card' },
    { id: 'ocean', ev: 'dimension', match: d => d.id === 'ocean', goals: [1], reward: { t1: 3, coins: 200 },
      text: () => 'Reach the Ocean' },
    { id: 'under', ev: 'dimension', match: d => d.id === 'underworld', goals: [1], reward: { t1: 3, coins: 250 },
      text: () => 'Reach the Underworld' },
    { id: 'nether', ev: 'dimension', match: d => d.id === 'nether', goals: [1], reward: { t1: 4, coins: 300 },
      text: () => 'Reach the Nether' }
  ];

  const weekly = [
    { id: 'wkill', ev: 'kill', goals: [4000, 6000], reward: { t10: 1, coins: 800 },
      text: n => `Defeat ${n.toLocaleString('en')} mobs` },
    { id: 'wrift', ev: 'rift', goals: [1, 2], reward: { t10: 1, coins: 1000 },
      text: n => (n === 1 ? 'Win a Trial Chamber battle' : `Win ${n} Trial Chamber battles`) },
    { id: 'wfloor', ev: 'kill', match: d => d.floor, goals: [1, 2], reward: { t10: 1, coins: 1000 },
      text: n => (n === 1 ? 'Defeat a floor boss' : `Defeat ${n} floor bosses`) },
    { id: 'wend', ev: 'dimension', match: d => d.id === 'end', goals: [1], reward: { t10: 2, coins: 1200 },
      text: () => 'Reach the End' },
    { id: 'wcity', ev: 'dimension', match: d => d.id === 'ancient_city', goals: [1], reward: { t10: 2, coins: 1500 },
      text: () => 'Reach the Ancient City' },
    { id: 'wboss', ev: 'kill', match: d => d.boss, goals: [4, 6], reward: { t10: 1, coins: 900 },
      text: n => `Defeat ${n} bosses` },
    { id: 'wsurvive', ev: 'runEnd', mode: 'max', value: min, goals: [12, 15], reward: { t10: 1, coins: 1000 },
      text: n => `Survive ${n} minutes in a run` },
    { id: 'wevolve', ev: 'evolve', goals: [3, 5], reward: { t10: 1, coins: 900 },
      text: n => `Use ${n} Smithing cards` },
    { id: 'wdaily', ev: 'missionDone', match: d => d.daily, goals: [8, 12], reward: { t10: 1, coins: 800 },
      text: n => `Complete ${n} daily missions` }
  ];

  const BY = {};
  for (const m of daily.concat(weekly)) BY[m.id] = m;

  return { daily, weekly, BY };
})();
