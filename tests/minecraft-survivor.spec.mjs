import { test, expect } from '@playwright/test';
import { GAMES } from '../tools/games.mjs';

const BASE = process.env.MCS_BASE || `http://127.0.0.1:${GAMES['minecraft-survivor'].testPort}`;
// The page to open: '/' on the built game; MCS_PAGE=/dev.html against a `serve.mjs --src` server.
const PAGE = process.env.MCS_PAGE || '/';
const visible = id => `#${id}:not(.hidden)`;

/** Records requests that leave localhost and every console/page error. */
function watch(page) {
  const external = [], errors = [];
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:') && !/^(data|blob):/.test(r.url())) external.push(r.url()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return { external, errors };
}

/** Fresh local account through the personality test, up to the menu. */
async function signUp(page, name) {
  await page.goto(BASE + PAGE);
  await page.waitForFunction(() => window.G && G.DB && G.DB.mode === 'local');
  await page.mouse.click(640, 360);
  await page.locator(visible('scr-login')).waitFor();
  await page.locator('#scr-login .tab[data-tab=register]').click();
  await page.fill('#f-user', name);
  await page.fill('#f-pass', 'test1234');
  await page.click('#btn-auth');
  await page.locator(visible('scr-test')).waitFor();
  while (await page.locator(visible('scr-test')).count()) await page.locator('#test-a .answer').first().click();
  await page.locator(visible('scr-result')).waitFor();
  await page.click('#res-ok');
  await page.locator(visible('scr-menu')).waitFor();
}

test('Minecraft Survivor: sign up, pick a partner, play a run, keep the save', async ({ page }) => {
  const external = [], errors = [];
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:') && !/^(data|blob):/.test(r.url())) external.push(r.url()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

  await page.goto(BASE + PAGE);
  await page.waitForFunction(() => window.G && G.DB && G.DB.mode === 'local');
  await page.mouse.click(640, 360);
  await page.locator(visible('scr-login')).waitFor();
  await page.screenshot({ path: 'artifacts/mcs-login.png' });

  await page.locator('#scr-login .tab[data-tab=register]').click();
  await page.fill('#f-user', 'steve_e2e');
  await page.fill('#f-pass', 'test1234');
  await page.click('#btn-auth');
  await page.locator(visible('scr-test')).waitFor();
  await page.screenshot({ path: 'artifacts/mcs-test.png' });
  while (await page.locator(visible('scr-test')).count()) await page.locator('#test-a .answer').first().click();
  await page.locator(visible('scr-result')).waitFor();
  await page.screenshot({ path: 'artifacts/mcs-result.png' });
  await page.click('#res-ok');
  await page.locator(visible('scr-menu')).waitFor();
  const partner = await page.evaluate(() => G.DB.save.partner);
  expect(await page.evaluate(d => !!G.DEX_BY[d], partner)).toBe(true);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/mcs-menu.png' });

  await page.click('#scr-menu [data-go=play]');
  await page.waitForFunction(() => G.Game.state === 'playing', undefined, { timeout: 20_000 });
  const keys = ['w', 'd', 's', 'a'];
  // Play at least ~18 s, and keep going (up to ~45 s) until something dies: slow starters like the
  // Armor Stand Decoy can go a while without a kill.
  for (let i = 0; i < 50; i++) {
    if (i >= 20 && await page.evaluate(() => G.Game.player.kills > 0)) break;
    const state = await page.evaluate(() => G.Game.state);
    if (['levelup', 'choice'].includes(state)) {
      if (i === 4) await page.screenshot({ path: 'artifacts/mcs-levelup.png' });
      await page.keyboard.press('1');
      await page.waitForTimeout(200);
      continue;
    }
    await page.keyboard.down(keys[i % 4]);
    await page.waitForTimeout(900);
    await page.keyboard.up(keys[i % 4]);
  }
  const run = await page.evaluate(() => {
    const pl = G.Game.player;
    return { time: G.Game.st.time, level: pl.level, kills: pl.kills, hp: Math.round(pl.hp) };
  });
  console.log('run:', run);
  await page.screenshot({ path: 'artifacts/mcs-run.png' });
  expect(run.time).toBeGreaterThan(8);
  expect(run.kills).toBeGreaterThan(0);
  // Runs start in the Overworld, and its mobs come from Overworld biomes.
  expect(await page.evaluate(() => G.Floors.dim)).toBe('overworld');

  // Pause: answer any level-up / item cards first (Escape doesn't pause over them), then retry until paused.
  for (let i = 0; i < 20 && !(await page.locator(visible('scr-pause')).count()); i++) {
    const st = await page.evaluate(() => G.Game.state);
    await page.keyboard.press(['levelup', 'choice'].includes(st) ? '1' : 'Escape');
    await page.waitForTimeout(300);
  }
  await page.locator(visible('scr-pause')).waitFor();
  await page.click('#btn-quit');
  await page.locator(visible('scr-over')).waitFor({ timeout: 15_000 });
  await page.screenshot({ path: 'artifacts/mcs-over.png' });
  await page.click('#btn-again');
  await page.reload();
  await page.mouse.click(640, 360);
  await page.locator(visible('scr-menu')).waitFor({ timeout: 15_000 });
  const saved = await page.evaluate(() => ({ partner: G.DB.save.partner, runs: G.DB.save.stats.runs, name: G.DB.save.name }));
  expect(saved).toMatchObject({ partner, name: 'steve_e2e' });
  expect(saved.runs).toBeGreaterThanOrEqual(1);

  expect(external, 'requests left localhost').toEqual([]);
  expect(errors, 'console/page errors').toEqual([]);
});

test('Minecraft Survivor: the run climbs all eight floors, each with its own goal', async ({ page }) => {
  test.setTimeout(240_000);
  const { external, errors } = watch(page);
  await signUp(page, 'alex_e2e');
  await page.click('#scr-menu [data-go=play]');
  await page.waitForFunction(() => G.Game.state === 'playing', undefined, { timeout: 20_000 });
  // The partner can't be hurt, and the clock jumps to minute 3 so mobs spawn quickly.
  await page.evaluate(() => { G.Game.player.hurt = () => 0; G.Game.debugTime(180); });
  expect(await page.evaluate(() => [G.Floors.dim, G.Floors.index, G.DIMENSIONS.map(d => d.id)])).toEqual(
    ['overworld', 0, ['overworld', 'ocean', 'underworld', 'nether', 'stronghold', 'end', 'ancient_city', 'herobrine', 'aether']]);
  // Eight floors; the Aether (after Herobrine's World) is the ending, not a floor.
  expect(await page.evaluate(() => G.Floors.floors)).toBe(8);
  // The Overworld's exit is the dive into the Ocean.
  expect(await page.evaluate(() => G.DIM_BY.overworld.exit)).toBe('dive');

  /** Waits for fn() in the page, answering level-up / item cards on the way. */
  const until = async (fn, arg, ms = 20_000) => {
    const t0 = Date.now();
    for (;;) {
      if (await page.evaluate(fn, arg)) return;
      if (Date.now() - t0 > ms) {
        const st = await page.evaluate(() => {
          const pl = G.Game.player, P = G.Floors.portal;
          return { state: G.Game.state, dim: G.Floors.dim, screens: [...document.querySelectorAll('.screen:not(.hidden), [id^=scr-]:not(.hidden)')].map(e => e.id),
                   portal: P && { kind: P.kind, t: +P.t.toFixed(2), d: Math.round(Math.hypot(pl.x - P.x, pl.y - P.y)) }, dead: pl.dead };
        });
        throw new Error('timed out waiting for ' + fn.toString() + ' · ' + JSON.stringify(st));
      }
      if (['levelup', 'choice'].includes(await page.evaluate(() => G.Game.state))) await page.keyboard.press('1');
      await page.waitForTimeout(150);
    }
  };
  const killFloorBoss = () => page.evaluate(() => { const e = G.EnemyMgr.all().find(x => x.floorBoss); e.hidden = false; e.hp = 0; e.die(); });

  /** This floor's portal is open: check its kind, step in, land on the next floor and see its mobs. */
  async function through(kind, next) {
    await until(() => !!G.Floors.portal);
    const portal = await page.evaluate(() => ({ kind: G.Floors.portal.kind, world: (G.World.portals || []).map(p => p.kind) }));
    expect(portal.kind).toBe(kind);
    if (portal.world.length) expect(portal.world).toContain(kind);
    await page.screenshot({ path: `artifacts/mcs-portal-${kind}.png` });
    // Walk in (and back in, if a leftover blast knocks you off) until the portal takes you.
    await until(d => {
      const pl = G.Game.player, P = G.Floors.portal;
      if (P && !G.Floors.traveling) { pl.x = P.x; pl.y = P.y; }
      return G.Floors.dim === d && !G.Floors.traveling;
    }, next);
    expect(await page.evaluate(() => G.World.dimension)).toBe(next);
    if (next === 'herobrine') return;
    // Every mob that spawns now comes from this floor's biome pools.
    await until(() => G.EnemyMgr.all().filter(e => !e.boss && !e.crystal).length >= 5, null, 30_000);
    const seen = await page.evaluate(d => {
      const ok = new Set(G.DIMENSIONS.find(x => x.id === d).biomes.flatMap(k => G.Enemies.pool(k).map(p => p.key)));
      // (Armoured mobs and jockeys count as the mob they replaced, def.of.)
      const mobs = G.EnemyMgr.all().filter(e => !e.boss && !e.crystal && e.behavior !== 'thief' && !e.patrol).map(e => G.DEX_BY[e.def.of || e.dex].key);
      return { mobs, stray: mobs.filter(k => !ok.has(k)) };
    }, next);
    console.log(next + ' mobs:', seen.mobs.join(', '));
    expect(seen.stray).toEqual([]);
    await page.screenshot({ path: `artifacts/mcs-${next}.png` });
  }

  /** A 'boss' floor: the floor boss falls, drops an Ominous Key and opens the exit. */
  async function bossFloor(boss, kind, next, check) {
    const b = await page.evaluate(() => { const e = G.Game.debugBoss('floor'); return e && { key: G.DEX_BY[e.dex].key, floor: e.floorBoss, ominous: !!e.ominous }; });
    expect(b).toMatchObject({ key: boss, floor: true });
    if (check) await check(b);
    await page.waitForTimeout(400);
    await killFloorBoss();
    await until(() => !!G.Floors.portal);
    expect(await page.evaluate(() => G.Pickups.all().some(p => p.kind === 'ticket10'))).toBe(true);   // the Ominous Key
    await through(kind, next);
  }

  // 1. Overworld: the Raid (the Ravager and its illagers), then the dive into the Ocean.
  await bossFloor('ravager', 'dive', 'ocean', async () => {
    const band = await page.evaluate(() => G.EnemyMgr.all().filter(e => e.raider).map(e => G.DEX_BY[e.dex].key));
    expect(band).toEqual(expect.arrayContaining(['pillager', 'vindicator', 'evoker']));
  });

  // 2. The Ocean: underwater (no day/night, water slows nobody). The Drowned Captain fights with the
  //    drowned boss kit (normal drowned don't); three Elder Guardians sleep in the Ocean Monument and the
  //    cave entrance opens only when the third one falls.
  expect(await page.evaluate(() => [G.Floors.underwater, G.DayNight.hasCycle(), G.DayNight.isNight()])).toEqual([true, false, false]);
  const captain = await page.evaluate(() => {
    const e = G.Game.debugBoss('mid'), crew = G.EnemyMgr.all().filter(m => m.raider && !m.dead);
    const out = { name: e.name, key: G.DEX_BY[e.dex].key, kit: !!e.kit, crew: crew.length, crewKit: crew.some(m => G.BossKits.has(m)) };
    e.hp = 0; e.die();
    return out;
  });
  expect(captain).toEqual({ name: 'Drowned Captain', key: 'drowned', kit: true, crew: 4, crewKit: false });
  await until(() => G.Floors.elders && G.Floors.elders.list.length === 3);
  const sleeping = await page.evaluate(() => {
    const E = G.Floors.elders;
    return { n: E.n, left: E.left, keys: E.list.map(e => G.DEX_BY[e.dex].key), awake: E.awake, dormant: E.list.every(e => e.dormant),
             fighting: G.EnemyMgr.bossAlive() };
  });
  expect(sleeping).toMatchObject({ n: 3, left: 3, keys: ['elder_guardian', 'elder_guardian', 'elder_guardian'] });
  // Asleep (unless you landed next to the monument): they don't count as a boss fight yet.
  expect([sleeping.dormant, sleeping.fighting]).toEqual([!sleeping.awake, sleeping.awake]);
  // Each has ~60% of a floor boss's health.
  const hp = await page.evaluate(() => {
    G.Floors.debugElders();
    const t = G.Game.st.time, b = G.Enemies.bossDef(G.Enemies.mob('elder_guardian'), t, 'floor');
    return { each: G.Floors.elders.list.map(e => e.maxHp), floor: b.hp * G.Enemies.bossScale(t).hp, awake: G.Floors.elders.awake };
  });
  expect(hp.awake).toBe(true);
  for (const v of hp.each) expect(v / hp.floor).toBeCloseTo(0.6, 1);
  for (let i = 3; i >= 1; i--) {
    expect(await page.evaluate(() => [G.Floors.elders.left, !!G.Floors.portal])).toEqual([i, false]);
    await page.evaluate(() => { const e = G.Floors.elders.list[0]; e.hp = 0; e.die(); });
  }
  await until(() => !!G.Floors.portal);
  expect(await page.evaluate(() => [G.Floors.elders.left, G.Floors.portal.kind])).toEqual([0, 'cave']);
  expect(await page.evaluate(() => G.Pickups.all().some(p => p.kind === 'ticket10'))).toBe(true);   // the Ominous Key
  await through('cave', 'underworld');

  // 3. Underworld: the Ominous Trial (an ominous Breeze).
  await bossFloor('breeze', 'nether', 'nether', async b => expect(b.ominous).toBe(true));
  // 4. Nether: the Wither.
  await bossFloor('wither', 'stronghold', 'stronghold');

  // 5. Stronghold: the Eye of Ender points at the portal room after portalAt; holding it fills, leaving pauses it.
  expect(await page.evaluate(() => G.Floors.room && G.Floors.room.eye)).toBeFalsy();
  await page.evaluate(() => G.Floors.debugRoom());
  await until(() => G.Floors.room && G.Floors.room.eye && G.Floors.room.held > 1.2);
  const held = await page.evaluate(() => { const pl = G.Game.player, r = G.Floors.room; pl.x = r.x + r.r + 300; pl.y = r.y; return r.held; });
  await page.waitForTimeout(800);
  const paused = await page.evaluate(() => G.Floors.room.held);
  expect(paused).toBeLessThan(held + 0.5);
  expect(await page.evaluate(() => G.EnemyMgr.all().some(e => G.DEX_BY[e.dex].key === 'silverfish'))).toBe(true);
  await page.evaluate(() => G.Floors.debugRoom(true));
  await page.evaluate(() => { const pl = G.Game.player; pl.x += 300; });       // step off the room until the portal is lit
  await through('end', 'end');

  // 6. The End: the dragon is invincible while any End Crystal stands, and crystals don't count as kills.
  await until(() => G.EndFight.left > 0);
  await page.evaluate(() => G.Game.debugBoss('floor'));
  const shielded = await page.evaluate(() => { const d = G.EnemyMgr.all().find(e => e.floorBoss), hp = d.hp; d.hurt(d.maxHp * 0.3); return { key: G.DEX_BY[d.dex].key, hp, after: d.hp, shielded: G.EndFight.shielded(d) }; });
  expect(shielded).toMatchObject({ key: 'ender_dragon', shielded: true });
  expect(shielded.after).toBe(shielded.hp);
  const kills = await page.evaluate(() => G.Game.player.kills);
  await page.evaluate(() => G.EndFight.debugBreakAll());
  await until(() => G.EndFight.left === 0 && !G.EnemyMgr.all().some(e => e.crystal));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => G.Game.player.kills)).toBe(kills);
  const open = await page.evaluate(() => { const d = G.EnemyMgr.all().find(e => e.floorBoss), hp = d.hp; d.hurt(d.maxHp * 0.3); return { hp, after: d.hp, shielded: G.EndFight.shielded(d) }; });
  expect(open.shielded).toBe(false);
  expect(open.after).toBeLessThan(open.hp);
  await killFloorBoss();
  await through('gateway', 'ancient_city');

  // 7. Ancient City: shriekers raise the warning; at 4 the Warden digs up.
  for (let i = 1; i <= 3; i++) {
    expect(await page.evaluate(() => G.Floors.debugWarn())).toBe(i);
    expect(await page.evaluate(() => !!G.EnemyMgr.all().find(e => e.floorBoss))).toBe(false);
  }
  expect(await page.evaluate(() => !!G.Game.player.fx.darkness)).toBe(true);
  await page.evaluate(() => G.Floors.debugWarn());
  const warden = await page.evaluate(() => { const e = G.EnemyMgr.all().find(x => x.floorBoss); return e && { key: G.DEX_BY[e.dex].key, level: G.Floors.warning.level }; });
  expect(warden).toEqual({ key: 'warden', level: 4 });
  await until(() => !G.EnemyMgr.all().find(x => x.floorBoss).hidden);           // it has dug its way up
  await killFloorBoss();
  await through('ancient', 'herobrine');

  // 8. Herobrine's World: endless night, and Herobrine awakens on his own.
  expect(await page.evaluate(() => [G.DayNight.isNight(), G.DayNight.phaseFor('plains')])).toEqual([true, 'night']);
  await until(() => G.Judgment.active, null, 15_000);
  await page.keyboard.press('Space');
  await until(() => G.Judgment.active && !G.Judgment.cinematic, null, 20_000);
  expect(await page.evaluate(() => G.Floors.dim)).toBe('herobrine');

  const save = await page.evaluate(() => ({ dims: Object.keys(G.DB.save.dims || {}), ach: Object.keys(G.DB.save.ach || {}) }));
  for (const d of ['ocean', 'underworld', 'nether', 'stronghold', 'end', 'ancient_city', 'herobrine']) expect(save.dims).toContain(d);
  for (const a of ['raid', 'dimOcean', 'monument', 'dimUnder', 'ominous', 'dimNether', 'dimStronghold', 'dimEnd', 'freeEnd', 'dimAncient',
    'silence', 'judge']) expect(save.ach).toContain(a);
  const legs = await page.evaluate(() => ['elder_guardian', 'wither', 'ender_dragon', 'warden'].map(k => 'leg_' + G.Enemies.mob(k).dex));
  for (const a of legs) expect(save.ach).toContain(a);              // Defeat the Elder Guardian / the Wither / the Ender Dragon / the Warden

  expect(external, 'requests left localhost').toEqual([]);
  expect(errors, 'console/page errors').toEqual([]);
});

test('Minecraft Survivor: survive Herobrine, the glowstone portal, the Aether and its ending', async ({ page }) => {
  test.setTimeout(240_000);
  const { external, errors } = watch(page);
  await signUp(page, 'aether_e2e');
  await page.click('#scr-menu [data-go=play]');
  await page.waitForFunction(() => G.Game.state === 'playing', undefined, { timeout: 20_000 });
  const until = async (fn, arg, ms = 20_000) => {
    const t0 = Date.now();
    while (!(await page.evaluate(fn, arg))) {
      if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + fn.toString());
      if (['levelup', 'choice'].includes(await page.evaluate(() => G.Game.state))) await page.keyboard.press('1');
      await page.waitForTimeout(150);
    }
  };

  // Herobrine's World leads to the Aether after `surviveFor` seconds; the Aether mobs aren't owned yet.
  const table = await page.evaluate(() => ({ exit: G.DIM_BY.herobrine.exit, survive: G.DIM_BY.herobrine.surviveFor, goal: G.DIM_BY.aether.goal,
    gen8: G.DEX.filter(p => p.gen === 8).map(p => p.key), owned: G.DEX.filter(p => p.gen === 8 && G.DB.save.owned[p.dex]).length,
    banners: G.Gacha.BANNERS ? G.Gacha.BANNERS.map(b => b.gen) : [] }));
  expect(table).toMatchObject({ exit: 'aether', survive: 150, goal: 'paradise', owned: 0 });
  expect(table.gen8).toEqual(expect.arrayContaining(['sheepuff', 'phyg', 'flying_cow', 'aerbunny', 'moa', 'aerwhale', 'moa_white', 'moa_black']));
  expect(table.banners).not.toContain(8);

  // Herobrine's World: his hunt, and the countdown on the HUD. (Herobrine can't hurt the test player.)
  await page.evaluate(() => { G.Game.player.hurt = () => 0; G.Game.debugDimension('herobrine'); });
  await until(() => G.Judgment.active, null, 15_000);
  await page.keyboard.press('Space');
  await until(() => G.Judgment.active && !G.Judgment.cinematic, null, 20_000);
  const hunt = await page.evaluate(() => ({ a: G.Floors.aether, every: G.Judgment.BOSS_EVERY, max: G.Judgment.MAX_ALIVE }));
  expect(hunt.a.left).toBeGreaterThan(100);
  expect(hunt.a.building).toBe(false);
  expect([hunt.every, hunt.max]).toEqual([10, 4]);
  await page.screenshot({ path: 'artifacts/mcs-herobrine-countdown.png' });

  // The survival clock runs out (dev time skip to 150 s): the portal builds, and can't be entered until it stands.
  await page.evaluate(() => G.Floors.debugHeroClock(150));
  await until(() => G.Floors.aether.building);
  const building = await page.evaluate(() => {
    const pl = G.Game.player, P = G.Floors.portal; pl.x = P.x; pl.y = P.y;
    return { kind: P.kind, ready: G.Floors.aether.ready, d: Math.round(Math.hypot(P.x - pl.x, P.y - pl.y)) };
  });
  expect(building).toMatchObject({ kind: 'aether', ready: false });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => [G.Floors.dim, G.Floors.traveling])).toEqual(['herobrine', false]);
  await until(() => G.Floors.aether.ready, null, 10_000);
  await page.screenshot({ path: 'artifacts/mcs-aether-portal.png' });

  // Step in: white-gold flash, Herobrine and his boss mobs gone, the Aether.
  await until(() => {
    const pl = G.Game.player, P = G.Floors.portal;
    if (P && !G.Floors.traveling) { pl.x = P.x; pl.y = P.y; }
    return G.Floors.dim === 'aether' && !G.Floors.traveling;
  });
  const arrived = await page.evaluate(() => ({ judge: G.Judgment.active, bosses: G.EnemyMgr.all().filter(e => e.judge && !e.dead).length,
    banner: G.Floors.banner && [G.Floors.banner.title, G.Floors.banner.sub], peaceful: G.Floors.peaceful, aether: G.Aether.active }));
  expect(arrived).toEqual({ judge: false, bosses: 0, banner: ['WELCOME TO THE AETHER', 'You survived Herobrine.'], peaceful: true, aether: true });

  // Nothing hurts you here, from any source.
  const hurt = await page.evaluate(() => {
    const pl = G.Game.player;
    delete pl.hurt;
    const hp = pl.hp;
    pl.invuln = 0; pl.hurt(pl.maxHp * 5, 'fire');
    pl.invuln = 0; pl.hurt(pl.maxHp * 5, null, true);
    return { before: hp, after: pl.hp, dead: pl.dead };
  });
  expect(hurt.after).toBe(hurt.before);
  expect(hurt.dead).toBe(false);

  // ~20 s of game time at minute 30 (when spawns are thickest): no hostile mob, no event, no weather.
  const t0 = await page.evaluate(() => { G.Game.debugTime(1800); G.Game.debugSpeed(4); return G.Game.st.time; });
  await until(t => G.Game.st.time >= t + 20, t0, 30_000);
  const calm = await page.evaluate(() => {
    G.Game.debugSpeed(1);
    return { enemies: G.EnemyMgr.count, weather: !!G.Weather.current, event: !!(G.Events.current), trial: !!G.Rift.rift,
             critters: [...new Set(G.Aether.critters.map(c => c.key))] };
  });
  expect(calm).toMatchObject({ enemies: 0, weather: false, event: false, trial: false });
  expect(calm.critters).toContain('sheepuff');
  for (const k of calm.critters) expect(['sheepuff', 'phyg', 'flying_cow', 'aerbunny', 'moa', 'aerwhale', 'allay', 'bee']).toContain(k);

  // Arriving befriended every Aether mob and gave the rewards.
  const got = await page.evaluate(() => ({ owned: G.DEX.filter(p => p.gen === 8).map(p => (G.DB.save.owned[p.dex] || {}).from),
    asc: !!G.DB.save.ascended[G.Game.player.dex], aether: G.DB.save.stats.aether, r: G.Aether.rewards, ach: Object.keys(G.DB.save.ach) }));
  expect(new Set(got.owned)).toEqual(new Set(['aether']));
  expect(got).toMatchObject({ asc: true, aether: 1 });
  expect(got.r).toMatchObject({ coins: 1000, keys: 3 });
  expect(got.r.book.lvl).toBe(await page.evaluate(id => G.ENCHANT.BY[id].max, got.r.book.id));
  expect(got.ach).toContain('aether1');

  // Hearts by a friendly mob; a Phyg you stay by is befriended (When Phygs Fly!).
  await until(() => G.Aether.critters.some(c => c.key === 'phyg'), null, 20_000);
  await until(() => {
    const pl = G.Game.player, c = G.Aether.critters.find(x => x.key === 'phyg');
    if (c) { pl.x = c.x + 20; pl.y = c.y + 10; }
    return G.DB.save.stats.phygLove > 0;
  }, null, 20_000);
  expect(await page.evaluate(() => Object.keys(G.DB.save.ach))).toContain('phyg');

  // The ending: Rest (after 10 s) brightens the screen and scrolls the lines; then the victory summary.
  await until(() => G.Aether.time > G.Aether.REST_AT);
  await page.keyboard.press('r');
  await until(() => G.Aether.ending);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'artifacts/mcs-aether-ending.png' });
  await page.evaluate(() => G.Aether.debugSkipText());
  await page.locator(visible('scr-over')).waitFor({ timeout: 15_000 });
  expect(await page.locator('#over-title').textContent()).toBe('YOU REACHED THE AETHER');
  expect(await page.locator('#scr-over').getAttribute('class')).toContain('victory');
  await expect(page.locator('#over-stats')).toContainText('The Aether · the end of the climb');
  await expect(page.locator('#over-stats')).toContainText('Gifts of the Aether');
  await page.screenshot({ path: 'artifacts/mcs-aether-victory.png' });

  // The Mobdex: an Aether tab, the partner's halo.
  await page.click('#btn-again');
  await page.locator(visible('scr-menu')).waitFor();
  await page.click('#scr-menu [data-go=dex]');
  await page.locator('#dex-gens .gen-tab', { hasText: 'Aether' }).click();
  expect(await page.locator('#dex-grid .cell').count()).toBe(8);
  expect(await page.locator('#dex-grid .cell.locked').count()).toBe(0);
  await page.locator('#dex-gens .gen-tab').first().click();
  expect(await page.locator('#dex-grid .cell .halo').count()).toBeGreaterThanOrEqual(1);

  expect(external, 'requests left localhost').toEqual([]);
  expect(errors, 'console/page errors').toEqual([]);
});

test('Minecraft Survivor: day and night change the sky, the spawns and burn the undead', async ({ page }) => {
  const { external, errors } = watch(page);
  await signUp(page, 'night_e2e');
  await page.click('#scr-menu [data-go=play]');
  await page.waitForFunction(() => G.Game.state === 'playing', undefined, { timeout: 20_000 });
  await page.evaluate(() => { G.Game.player.hurt = () => 0; });

  const UNDEAD = ['zombie', 'skeleton', 'phantom', 'stray', 'bogged'];
  const state = () => page.evaluate(() => ({
    night: G.DayNight.isNight(), phase: G.DayNight.phase,
    plains: G.Enemies.pool('plains').map(p => p.key), snow: G.Enemies.pool('snowy_plains').map(p => p.key)
  }));

  // Morning: no undead that burn in the sun, plenty of daytime mobs.
  await page.evaluate(() => G.Game.debugTime(40));
  let s = await state();
  expect(s.night).toBe(false);
  expect(s.plains.some(k => UNDEAD.includes(k))).toBe(false);
  expect(s.plains).toContain('cow');

  // Night: the monsters come out, with each biome's own (strays only in the snow).
  await page.evaluate(() => G.Game.debugTime(200));
  s = await state();
  expect(s.night).toBe(true);
  expect(s.plains).toEqual(expect.arrayContaining(['zombie', 'skeleton', 'phantom']));
  expect(s.snow).toContain('stray');
  expect(s.plains).not.toContain('stray');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/mcs-night.png' });

  // Sunrise burns a zombie standing in the open.
  const id = await page.evaluate(() => {
    G.EnemyMgr.clear();
    const pl = G.Game.player, def = G.Enemies.castOf('plains', 0, 'night').find(d => G.DEX_BY[d.dex].key === 'zombie')
      || { dex: G.DEX.find(p => p.key === 'zombie').dex, name: 'Zombie', behavior: 'chase', hp: 40, spd: 50, dmg: 5, xp: 3 };
    const e = new G.Enemy({ ...def, spd: 1 }, pl.x + 160, pl.y, { hp: 1, dmg: 0, spd: 0.01 });
    G.EnemyMgr.add(e);
    G.Game.debugTime(296);
    return e.id;
  });
  await page.waitForFunction(i => !G.EnemyMgr.all().some(e => e.id === i && !e.dead), id, { timeout: 15_000 });

  // The Ocean, the Underworld and the Nether have no sky; Herobrine's World is an endless night.
  for (const d of ['ocean', 'underworld', 'nether']) {
    await page.evaluate(id => G.Game.debugDimension(id), d);
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => [G.DayNight.hasCycle(), G.DayNight.isNight()])).toEqual([false, false]);
  }
  await page.evaluate(() => G.Game.debugDimension('herobrine'));
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => [G.DayNight.hasCycle(), G.DayNight.isNight(), G.DayNight.phaseFor('forest')])).toEqual([false, true, 'night']);

  expect(external, 'requests left localhost').toEqual([]);
  expect(errors, 'console/page errors').toEqual([]);
});

test('Minecraft Survivor: only mobs with a real ranged attack shoot', async ({ page }) => {
  const { errors } = watch(page);
  await page.goto(BASE + PAGE);
  await page.waitForFunction(() => window.G && G.Enemies && G.DEX);
  const shooters = await page.evaluate(() => {
    const RANGED = ['ranged', 'beamer', 'fan', 'zoner'];
    return G.DEX.filter(p => !p.v && RANGED.includes(G.Enemies.behaviorOf(p))).map(p => p.key).sort();
  });
  // Minecraft's ranged mobs (bows/crossbows, spit, snowballs, tridents, fireballs, wind charges, lasers, skulls),
  // plus the axolotl's water-bubble fan (owner's call).
  const ALLOWED = ['axolotl', 'blaze', 'bogged', 'breeze', 'drowned', 'elder_guardian', 'ghast', 'guardian', 'llama', 'parched', 'piglin',
    'pillager', 'skeleton', 'snow_golem', 'spider_jockey', 'stray', 'trader_llama', 'wither'];
  expect(shooters.filter(k => !ALLOWED.includes(k)), 'melee mobs that shoot').toEqual([]);
  for (const k of ['zombie', 'zombie_villager', 'husk', 'zombified_piglin', 'spider', 'enderman']) expect(shooters).not.toContain(k);
  expect(errors).toEqual([]);
});

test('Minecraft Survivor: break rocks and chests by walking into them or clicking them', async ({ page }) => {
  const { errors } = watch(page);
  await signUp(page, 'miner_e2e');
  await page.click('#scr-menu [data-go=play]');
  await page.waitForFunction(() => G.Game.state === 'playing');
  // No weapons, no mobs: only digging can break the block.
  const setup = () => page.evaluate(() => {
    G.Dev.god = true; G.Dev.noSpawns = true; G.EnemyMgr.clear();
    const pl = G.Game.player;
    pl.moves.length = 0;
    const p = G.World.propsInCircle(pl.x, pl.y, 2000).filter(q => q.solid && q.destructible && q.hp === q.maxHp)
      .sort((a, b) => (a.x - pl.x) ** 2 + (a.y - pl.y) ** 2 - ((b.x - pl.x) ** 2 + (b.y - pl.y) ** 2))[0];
    pl.x = p.x - 70; pl.y = p.y;
    return { tx: p.tx, ty: p.ty, x: p.x, y: p.y, type: p.type };
  });
  const hpOf = b => page.evaluate(b => { const p = G.World.propsInCircle(b.x, b.y, 4).find(q => q.tx === b.tx && q.ty === b.ty); return p ? p.hp / p.maxHp : 0; }, b);

  // 1) Push against it: it cracks, then breaks within about a second (rock 1 s, chest 0.6 s).
  const a = await setup();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  const half = await hpOf(a);
  expect(half, a.type + ' cracks while you push').toBeLessThan(1);
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  expect(await hpOf(a), a.type + ' breaks').toBe(0);

  // 2) Click one from a distance: it's marked, you dig it once you walk up to it.
  const c = await setup();
  await page.evaluate(() => { const pl = G.Game.player; pl.x -= 120; });
  await page.waitForTimeout(1200);            // the camera eases after the jump
  const scr = await page.evaluate(c => { const cam = G.Camera, rc = document.getElementById('game').getBoundingClientRect();
    return { x: rc.left + (c.x - cam.left()) * cam.scale, y: rc.top + (c.y - 14 - cam.top()) * cam.scale }; }, c);
  await page.mouse.click(scr.x, scr.y);
  await page.waitForTimeout(100);
  expect(await page.evaluate(c => { const t = G.Game.player.mineTarget; return !!t && t.tx === c.tx && t.ty === c.ty && t.marked; }, c)).toBe(true);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2600);
  await page.keyboard.up('KeyD');
  expect(await hpOf(c), 'clicked ' + c.type + ' breaks').toBe(0);
  expect(await page.evaluate(() => G.Game.player.mineTarget)).toBeNull();
  await page.screenshot({ path: 'artifacts/mcs-mining.png' });
  expect(errors).toEqual([]);
});

test('Minecraft Survivor: breaking a sculk sensor in the Ancient City raises the warning level', async ({ page }) => {
  const { errors } = watch(page);
  await signUp(page, 'sculk_e2e');
  await page.click('#scr-menu [data-go=play]');
  await page.waitForFunction(() => G.Game.state === 'playing');
  await page.evaluate(() => { G.Dev.god = true; G.Dev.noSpawns = true; G.Game.debugDimension('ancient_city'); });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    G.EnemyMgr.clear();
    const pl = G.Game.player, before = G.Floors.warning.level;
    const s = G.World.propsInCircle(pl.x, pl.y, 6000).find(p => p.deco === 'sensor' && p.hp > 0);
    if (!s) return { found: false };
    G.World.damageProp(s, 9999, '#fff');
    return { found: true, before, after: G.Floors.warning.level };
  });
  expect(r.found, 'a sculk sensor near the start').toBe(true);
  expect(r.after).toBe(r.before + 1);
  expect(errors).toEqual([]);
});

test('Minecraft Survivor: dev mode panel (Settings toggle, every action works)', async ({ page }) => {
  const { external, errors } = watch(page);
  await signUp(page, 'dev_e2e');
  expect(await page.locator('#dev-btn').isVisible()).toBe(false);

  // Settings → Account → Dev mode on: the DEV button appears and is saved on the account.
  await page.click('#btn-settings');
  await page.locator('#set-tabs [data-t=acc]').click();
  await page.click('#set-dev');
  await page.click('#set-close');
  await page.locator('#dev-btn').waitFor({ state: 'visible' });
  expect(await page.evaluate(() => G.DB.save.dev)).toBe(true);

  // Account actions from the menu.
  await page.click('#dev-btn');
  const coins = await page.evaluate(() => G.DB.save.coins);
  for (const a of ['emeralds', 'keys', 'unlockAll', 'enchantAll', 'maxUpgrades', 'enchUnlock', 'enchBooks', 'enchRandom', 'enchMaster']) await page.click(`#dev-panel [data-a=${a}]`);
  const acct = await page.evaluate(() => ({ coins: G.DB.save.coins, owned: Object.keys(G.DB.save.owned).length, total: G.DEX.length }));
  expect(acct.coins).toBe(coins + 10000);
  expect(acct.owned).toBe(acct.total);
  // Enchanting: the partner unlocked and Mastered, one book of each enchantment plus 10 random ones.
  const ench = await page.evaluate(() => ({ st: G.Enchanting.mastery(G.DB.save.partner), books: G.Enchanting.bookCount(), kinds: G.ENCHANT.LIST.length }));
  expect(ench.st).toBe('mastered');
  expect(ench.books).toBe(ench.kinds + 10);
  await page.selectOption('#dv-partner', { label: 'Warden' });
  await page.click('#dev-panel [data-a=partner]');
  expect(await page.evaluate(() => G.DEX_BY[G.DB.save.partner].key)).toBe('warden');
  await page.screenshot({ path: 'artifacts/mcs-dev-menu.png' });

  // In a run: every action in the panel.
  await page.click('#dev-panel [data-a=close]');
  await page.click('#scr-menu [data-go=play]');
  await page.waitForFunction(() => G.Game.state === 'playing', undefined, { timeout: 20_000 });
  await page.keyboard.press('`');
  await page.locator('#dev-panel [data-t=god]').waitFor();
  await page.click('#dev-panel [data-t=god]');
  const settle = async () => { for (let i = 0; i < 10; i++) { const st = await page.evaluate(() => G.Game.state); if (st === 'playing' || st === 'ui') return; await page.keyboard.press('1'); await page.waitForTimeout(150); } };
  const actions = ['level1', 'level5', 'heal', 'skill', 'maxSkills', 'enchantSkills', 'item', 'speed2', 'speed1', 'min1', 'day', 'dusk',
    'night', 'dawn', 'biome', 'weather', 'siege', 'rush', 'pet', 'thief', 'spawn', 'midBoss', 'killAll', 'floorBoss', 'clear', 'portal',
    'ocean', 'midBoss', 'dolphins', 'guardians', 'elders', 'killAll', 'underworld', 'nether', 'stronghold', 'room', 'roomDone', 'end', 'floorBoss', 'crystals', 'ancient_city', 'warn', 'warn',
    'overworld', 'sp_iron', 'sp_diamond', 'sp_netherite', 'sp_chicken_jockey', 'sp_spider_jockey', 'killAll', 'trialPortal', 'trial', 'herobrine'];
  for (const a of actions) {
    await settle();
    await page.click(`#dev-panel [data-a=${a}]`);
    await page.waitForTimeout(250);
  }
  await settle();
  // God mode held, the skill landed, the sky moved without moving the run clock too far.
  const r = await page.evaluate(() => ({ hp: G.Game.player.hp, max: G.Game.player.maxHp, lvl: G.Game.player.level, moves: G.Game.player.moves.length }));
  expect(r.hp).toBeGreaterThan(0);
  expect(r.lvl).toBeGreaterThanOrEqual(6);
  expect(r.moves).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: 'artifacts/mcs-dev-run.png' });

  expect(external, 'requests left localhost').toEqual([]);
  expect(errors, 'console/page errors').toEqual([]);
});

test('Minecraft Survivor: every boss fights with its own Minecraft moves', async ({ page }) => {
  test.setTimeout(240_000);
  const { errors } = watch(page);
  await signUp(page, 'boss_e2e');
  await page.click('#scr-menu [data-go=play]');
  await page.waitForFunction(() => G.Game.state === 'playing', undefined, { timeout: 20_000 });
  await page.evaluate(() => {
    G.DB.save.dev = true;                // cheats only stay on while the account has dev mode
    G.Dev.god = true; G.Dev.noSpawns = true; G.Game.debugTime(300);
    window.__used = {};
    for (const [key, K] of Object.entries(G.BossKits.KITS)) for (const [id, m] of Object.entries(K.moves)) {
      const st = m.start; m.start = function (...a) { (window.__used[key] ||= new Set()).add(id); return st.apply(this, a); };
    }
  });
  // The floor bosses are among them, and each kit has its signature moves.
  const kits = await page.evaluate(() => Object.fromEntries(Object.entries(G.BossKits.KITS).map(([k, K]) => [k, Object.keys(K.moves)])));
  expect(kits.warden).toEqual(expect.arrayContaining(['sonic', 'darkness', 'burrow']));
  expect(kits.wither).toEqual(expect.arrayContaining(['skulls', 'blueSkull']));
  expect(kits.ender_dragon).toEqual(expect.arrayContaining(['fireball', 'breath', 'swoop']));
  expect(kits.drowned).toEqual(expect.arrayContaining(['trident', 'channel', 'riptide', 'crew']));     // the Drowned Captain
  for (const key of Object.keys(kits)) {
    await page.evaluate(k => {
      if (['levelup', 'choice'].includes(G.Game.state)) return;
      G.EnemyMgr.clear(); G.Hazards.clear(); G.Projectiles.clear();
      const pl = G.Game.player, t = G.Game.st.time;
      const e = G.Spawner.spawnBoss(G.Enemies.bossDef(G.Enemies.mob(k), t, 'mid'), t, [pl.x + 120, pl.y], true);
      e.maxHp *= 50; e.hp = e.maxHp;
      G.Game.debugSpeed(3);
    }, key);
    await page.waitForFunction(k => {
      if (['levelup', 'choice'].includes(G.Game.state)) document.querySelector('#cards > *, #item-cards > *')?.click();
      return window.__used[k] && window.__used[k].size > 0;
    }, key, { timeout: 15_000 });
  }
  await page.evaluate(() => G.Game.debugSpeed(1));
  expect(errors, 'console/page errors').toEqual([]);
});

test('Minecraft Survivor: enchanting (dragon unlock, books, anvil, table rules, run effects, mastery, screen)', async ({ page }) => {
  test.setTimeout(180_000);
  const { external, errors } = watch(page);
  await signUp(page, 'ench_e2e');
  // Steve (Iron Sword) as partner, plenty of emeralds.
  await page.evaluate(() => { const s = G.DB.save; G.DB.grant(1, 'test'); G.DB.grant(2, 'test'); G.DB.grant(4, 'test'); s.partner = 1; s.partnerShiny = false; s.coins = 200000; G.DB.commit(); });

  // Weapon types: by kind, plus the design's overrides; every skill has one.
  const types = await page.evaluate(() => {
    const W = G.Enchanting.weaponType;
    return { all: G.Moves.ALL.length, typed: G.Moves.ALL.filter(m => G.ENCHANT.TYPES[W(m.id)]).length,
      some: ['tackle', 'water-gun', 'quick-attack', 'aerial-ace', 'body-slam', 'rock-slide', 'swords-dance', 'ember', 'thunderbolt', 'psybeam'].map(W) };
  });
  expect(types.typed).toBe(types.all);
  expect(types.all).toBe(64);
  expect(types.some).toEqual(['sword', 'trident', 'trident', 'trident', 'mace', 'mace', 'armour', 'bow', 'bow', 'staff']);

  // Anvil: two Sharpness I make a Sharpness II, for emeralds.
  const anvil = await page.evaluate(() => {
    const s = G.DB.save, c0 = s.coins;
    G.Enchanting.grantBook({ id: 'sharpness', lvl: 1 }); G.Enchanting.grantBook({ id: 'sharpness', lvl: 1 });
    const r = G.Enchanting.combine('sharpness', 1);
    return { r, books: s.books.sharpness.slice(0, 2), paid: c0 - s.coins, again: G.Enchanting.combine('sharpness', 1), anvil: s.stats.anvil };
  });
  expect(anvil).toMatchObject({ r: true, books: [0, 1], again: 'You need two of the same book', anvil: 1 });
  expect(anvil.paid).toBe(await page.evaluate(() => G.ENCHANT.COST.combine(2)));
  // Locked until the dragon falls.
  expect(await page.evaluate(() => G.Enchanting.apply(1, 'tackle', 'sharpness', 2))).toBe('Locked');

  // In a run: a floor boss drops an Enchanted Book that is banked to the save at once.
  await page.click('#scr-menu [data-go=play]');
  await page.waitForFunction(() => G.Game.state === 'playing', undefined, { timeout: 20_000 });
  await page.evaluate(() => { G.Game.player.hurt = () => 0; });
  const until = async (fn, arg, ms = 15_000) => {
    const t0 = Date.now();
    while (!(await page.evaluate(fn, arg))) {
      if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + fn.toString());
      if (['levelup', 'choice'].includes(await page.evaluate(() => G.Game.state))) await page.keyboard.press('1');
      await page.waitForTimeout(150);
    }
  };
  const before = await page.evaluate(() => G.Enchanting.bookCount());
  const dropped = await page.evaluate(() => {
    const e = G.Game.debugBoss('floor'); e.hp = 0; e.die();
    const b = G.Pickups.all().find(p => p.kind === 'book'), pl = G.Game.player;
    if (b) { b.x = pl.x; b.y = pl.y; }
    return b && G.Enchanting.decode(b.value);
  });
  expect(dropped).toBeTruthy();
  await until(n => G.Enchanting.bookCount() > n, before);
  const banked = await page.evaluate(() => ({ run: G.Game.player.books, lib: (G.DB.save.books[G.Game.player.books[0].id] || [])[G.Game.player.books[0].lvl - 1],
    stored: JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('ps.save.')))).books }));
  expect(banked.run).toEqual([dropped]);
  expect(banked.lib).toBeGreaterThanOrEqual(1);
  expect(banked.stored[dropped.id][dropped.lvl - 1]).toBeGreaterThanOrEqual(1);       // committed to localStorage

  // Killing the Ender Dragon unlocks enchanting for the partner, with a banner and the achievement.
  await page.evaluate(() => G.Game.debugDimension('end'));
  await until(() => G.Floors.dim === 'end' && G.EndFight.left > 0);
  await page.evaluate(() => { G.Game.debugBoss('floor'); G.EndFight.debugBreakAll(); });
  await until(() => G.EndFight.left === 0 && !G.EnemyMgr.all().some(e => e.crystal));
  expect(await page.evaluate(() => G.Enchanting.unlocked(1))).toBe(false);
  await page.evaluate(() => { const d = G.EnemyMgr.all().find(e => e.floorBoss); d.hp = 0; d.die(); });
  const unlock = await page.evaluate(() => ({ slayer: !!G.DB.save.slayer[1], banner: G.Floors.banner && G.Floors.banner.title, ach: !!G.DB.save.ach.enchSlayer,
    book: G.Pickups.all().some(p => p.kind === 'book') }));
  expect(unlock).toEqual({ slayer: true, banner: 'ENCHANTING UNLOCKED FOR STEVE!', ach: true, book: true });
  await page.screenshot({ path: 'artifacts/mcs-ench-unlock.png' });

  // Smite: +20% per level against Undead mobs only (same hit, with and without the enchantment).
  const smite = await page.evaluate(() => {
    G.EnemyMgr.clear();
    const pl = G.Game.player, out = {};
    for (const [key, dex] of [['zombie', 30], ['pig', 4]]) {
      const e = new G.Enemy({ dex, name: key, hp: 1e9, spd: 0, dmg: 0, xp: 0, behavior: 'chase' }, pl.x + 30, pl.y, { hp: 1, spd: 1, dmg: 1 });
      G.EnemyMgr.add(e);
      const got = [];
      const h = e.hurt; e.hurt = function (a, ...r) { got.push(a); return h.call(this, a, ...r); };
      for (const ench of [true, false]) {
        G.DB.save.ench[1] = { tackle: [['smite', 5]] };
        const m = G.Enchanting.applyTo(G.Moves.instance('tackle', 1), 1);
        if (!ench) delete m.enc;
        const keep = pl.slots[pl.active];
        pl.slots[pl.active] = [m]; m.t = 0;
        e.x = pl.x + 30; e.y = pl.y; e.kx = e.ky = 0; pl.aim = 0; pl.target = e;
        G.EnemyMgr.rebuildGrid();
        G.Combat.tick(0.016, pl, G.Game.st.time);
        pl.slots[pl.active] = keep;
      }
      out[key] = got[0] / got[1];
      e.dead = true;
    }
    delete G.DB.save.ench[1];
    return out;
  });
  expect(smite.zombie).toBeCloseTo(2, 5);
  expect(smite.pig).toBeCloseTo(1, 5);
  // Breach: that share of a hit goes through a shield.
  expect(await page.evaluate(() => {
    const pl = G.Game.player, e = new G.Enemy({ dex: 4, name: 'pig', hp: 1000, spd: 0, dmg: 0, xp: 0, behavior: 'chase' }, pl.x + 200, pl.y, { hp: 1, spd: 1, dmg: 1 });
    e.shield = 1000; e.hurt(100, '#fff', 0, 0, 0, null, 0.5); return e.hp;
  })).toBe(950);
  await page.evaluate(() => G.Game.quit());
  await page.locator(visible('scr-over')).waitFor({ timeout: 10_000 });
  await page.click('#btn-again');
  await page.locator(visible('scr-menu')).waitFor();

  // The Table: weapon types, exclusive groups, 3 slots, emerald costs, upgrading a slot.
  const rules = await page.evaluate(() => {
    const X = G.Enchanting, s = G.DB.save;
    for (const [id, l] of [['sharpness', 5], ['sharpness', 3], ['smite', 1], ['power', 1], ['unbreaking', 3], ['mending', 1], ['knockback', 1],
      ['multishot', 1], ['piercing', 1], ['infinity', 1], ['mending', 1], ['protection', 1]]) X.grantBook({ id, lvl: l });
    const c0 = s.coins, r = {};
    r.power = X.apply(1, 'tackle', 'power', 1);                     // a bow enchantment on a sword
    r.sharp3 = X.apply(1, 'tackle', 'sharpness', 3);
    r.paid3 = c0 - s.coins;
    r.smite = X.apply(1, 'tackle', 'smite', 1);                     // Sharpness / Smite / Bane: one of the three
    r.sharp5 = X.apply(1, 'tackle', 'sharpness', 5);                // a higher level upgrades the slot
    r.unbreak = X.apply(1, 'tackle', 'unbreaking', 3);
    r.slots = X.listFor(1, 'tackle');
    r.protArmour = X.compatible(1, 'swords-dance', 'protection');
    r.protSword = X.compatible(1, 'tackle', 'protection');
    r.notMine = X.apply(1, 'ember', 'unbreaking', 3);                // not one of Steve's weapons
    // Alex's Bow: Multishot or Piercing; Infinity not with Mending.
    s.slayer[2] = Date.now();
    r.multi = X.apply(2, 'aura-sphere', 'multishot', 1);
    r.pierce = X.apply(2, 'aura-sphere', 'piercing', 1);
    r.inf = X.apply(2, 'aura-sphere', 'infinity', 1);
    r.mend = X.apply(2, 'aura-sphere', 'mending', 1);
    s.coins = 10;
    r.poor = X.apply(1, 'swords-dance', 'protection', 1);
    s.coins = 200000;
    return r;
  });
  expect(rules).toMatchObject({ power: 'Doesn\'t fit a sword', sharp3: true, smite: 'Can\'t go with Sharpness', sharp5: true, unbreak: true,
    slots: [['sharpness', 5], ['unbreaking', 3]], protArmour: true, protSword: false, notMine: 'Not one of its weapons',
    multi: true, pierce: 'Can\'t go with Multishot', inf: true, mend: 'Can\'t go with Infinity', poor: 'Not enough emeralds' });
  expect(rules.paid3).toBe(120 * 9);
  // The third slot fills; a fourth enchantment is refused.
  const third = await page.evaluate(() => [G.Enchanting.apply(1, 'tackle', 'mending', 1), G.Enchanting.apply(1, 'tackle', 'knockback', 1), G.Enchanting.listFor(1, 'tackle').length]);
  expect(third).toEqual([true, 'All 3 slots are full', 3]);

  // Mastery: the signature weapon has 3 enchantments, all at max level. Achievements follow.
  const mastery = await page.evaluate(() => {
    const X = G.Enchanting, s = G.DB.save;
    for (let i = 0; i < 20; i++) X.grantBook({ id: 'power', lvl: 1 });
    for (let i = 0; i < 10; i++) X.combine('power', 1);
    G.Progress.checkAch();
    const r = { steve: X.mastery(1), alex: X.mastery(2), locked: X.mastery(4), count: X.masteredCount(), starters: X.startersMastered(),
                ach: ['ench1', 'anvil10', 'master1'].filter(a => s.ach[a]) };
    // Variants count as their own characters, and toward their base species for the final goal.
    const sp0 = X.speciesMastered();
    X.debugMaster(200);                                // Tuxedo Cat (a cat variant)
    const sp1 = X.speciesMastered();
    X.debugMaster(8);                                  // the Cat itself
    Object.assign(r, { sp: [sp0, sp1, X.speciesMastered()], count2: X.masteredCount(), species: X.species().length,
      goal: G.AchDefs.BY.masterAll.goal });
    return r;
  });
  expect(mastery).toMatchObject({ steve: 'mastered', alex: 'unlocked', locked: 'locked', count: 1, starters: 1, ach: ['ench1', 'anvil10', 'master1'] });
  expect(mastery.sp).toEqual([1, 2, 2]);
  expect(mastery.count2).toBe(3);
  expect(mastery.goal).toBe(mastery.species);

  // In a run the enchantments are baked into the skill: Sharpness V alone is +40% damage.
  await page.evaluate(() => { G.DB.save.ench[1].tackle = [['sharpness', 5]]; G.DB.commit(); });
  await page.click('#scr-menu [data-go=play]');
  await page.waitForFunction(() => G.Game.state === 'playing', undefined, { timeout: 20_000 });
  const inst = await page.evaluate(() => { const m = G.Game.player.moves.find(x => x.id === 'tackle'); return { k: m.dmg / m.def.dmg, ench: m.ench, cd: m.cd / m.def.cd }; });
  expect(inst.k).toBeCloseTo(1.4, 5);
  expect(inst.ench).toEqual([['sharpness', 5]]);
  expect(inst.cd).toBe(1);
  // Smithing (the in-run skill upgrade) is no longer called "Enchant".
  const smith = await page.evaluate(() => {
    const pl = G.Game.player, m = pl.moves.find(x => x.id === 'tackle');
    while (G.Moves.levelUp(m)) { /* max */ }
    pl.statsTaken[G.Moves.EVO.tackle[1]] = 1;
    const c = G.LevelUp.offer(pl).find(x => x.type === 'evo');
    return { title: c.title, tag: c.tag, ench: c.ench };
  });
  expect(smith).toEqual({ title: 'Smithing: Netherite Sword', tag: 'SMITHING · Iron Sword', ench: [['sharpness', 5]] });
  await page.evaluate(() => G.Game.quit());
  await page.locator(visible('scr-over')).waitFor({ timeout: 10_000 });
  await page.click('#btn-again');
  await page.locator(visible('scr-menu')).waitFor();

  // The screen: every tab renders; a locked character shows the dragon requirement; apply from the Table.
  await page.click('#scr-menu [data-go=ench]');
  await page.locator(visible('scr-ench')).waitFor();
  expect(await page.locator('#ench-mastered').textContent()).toContain('Mastered 1 / ')   // the cat species (Steve now has Sharpness V only);
  await page.locator('#ench-body .ench-pick[data-dex="4"]').click();
  await expect(page.locator('#ench-body .ench-locked')).toContainText('Defeat the Ender Dragon with this character to unlock enchanting');
  await page.locator('#ench-body .ench-pick[data-dex="2"]').click();
  await page.locator('#ench-body .ench-weapon[data-sk="aura-sphere"]').click();
  await page.evaluate(() => G.Enchanting.grantBook({ id: 'power', lvl: 3 }));
  await page.evaluate(() => G.EnchantUI.render());
  const powerRow = page.locator('#ench-body .ench-book', { hasText: 'Power III' }).first();
  await powerRow.locator('button.gold').click();
  expect(await page.evaluate(() => G.Enchanting.listFor(2, 'aura-sphere'))).toEqual([['multishot', 1], ['infinity', 1], ['power', 3]]);
  await page.screenshot({ path: 'artifacts/mcs-ench-table.png' });
  for (const [t, sel] of [['anvil', '.panel'], ['grind', '[data-rm]'], ['library', '.ench-lib-row']]) {
    await page.click(`#ench-tabs [data-tab=${t}]`);
    await expect(page.locator(`#ench-body ${sel}`).first()).toBeVisible();
    await page.screenshot({ path: `artifacts/mcs-ench-${t}.png` });
  }
  expect(await page.locator('#ench-body .ench-lib-row').count()).toBe(await page.evaluate(() => G.ENCHANT.LIST.length));
  // Grindstone: two steps, the books are lost and some emeralds come back.
  await page.click('#ench-tabs [data-tab=grind]');
  const coins0 = await page.evaluate(() => G.DB.save.coins);
  const row = page.locator('#ench-body .ench-book', { hasText: 'Alex' });
  await row.locator('[data-rm]').click();
  await row.locator('[data-yes]').click();
  expect(await page.evaluate(() => G.Enchanting.listFor(2, 'aura-sphere'))).toEqual([]);
  expect(await page.evaluate(() => G.DB.save.coins)).toBeGreaterThan(coins0);

  expect(external, 'requests left localhost').toEqual([]);
  expect(errors, 'console/page errors').toEqual([]);
});

/** A seeded Math.random for the statistical checks (mulberry32), installed in the page (window.__rand keeps the real one). */
const SEED_RANDOM = seed => {
  let a = seed >>> 0;
  window.__rand = Math.random;
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

test('Minecraft Survivor: Spawner packs (Legendaries everywhere, Herobrine the rare Overworld lure)', async ({ page }) => {
  test.setTimeout(120_000);
  const { external, errors } = watch(page);
  await signUp(page, 'packs_e2e');

  // Herobrine moved to the Overworld pack at a low pull weight; every pack has Legendaries, and the six
  // realms with a full pool miss no rarity (The End is left as it was).
  const data = await page.evaluate(() => {
    const h = G.DEX.find(p => p.key === 'herobrine');
    const tiers = G.Gacha.BANNERS.map(b => [1, 2, 3, 4, 5].map(r => G.Gacha.pool(r, b.gen).length));
    return { gen: h.gen, pw: h.pw, leg5: tiers.map(t => t[4]), tiers, feat: G.Gacha.featured(1),
             odds: G.Gacha.odds(5, 1).find(o => o.name === 'Herobrine').pct };
  });
  expect(data.gen).toBe(1);
  expect(data.pw).toBeLessThan(0.5);
  for (const n of data.leg5) expect(n).toBeGreaterThan(0);
  for (const t of data.tiers.slice(0, 6)) for (const n of t) expect(n).toBeGreaterThan(0);
  expect(data.feat).toContain(45);
  expect(data.odds).toBeGreaterThan(0.03);
  expect(data.odds).toBeLessThan(0.1);

  // Many simulated pulls on a cloned save, with a seeded Math.random: Herobrine's share of the Legendaries
  // (forced Legendary pulls) and his share of every pull (normal pulls, pity included) stay near the weights.
  await page.evaluate(SEED_RANDOM, 20261014);
  const sim = await page.evaluate(() => {
    const fresh = () => ({ ...JSON.parse(JSON.stringify(G.DB.save)), tickets: { t1: 1e9, t10: 0 }, pity: {}, shiny: {}, owned: {}, coins: 0, stats: {} });
    const H = 45;
    let s = fresh(), leg = 0, hLeg = 0;
    G.Gacha.debugForceLegend(20000);
    for (let i = 0; i < 20000; i++) { const [r] = G.Gacha.pull(s, 1, 1); leg += r.rarity === 5; hLeg += r.dex === H; }
    s = fresh();
    let pulls = 0, h = 0, five = 0;
    for (let i = 0; i < 8000; i++) for (const r of G.Gacha.pull(s, 10, 1)) { pulls++; h += r.dex === H; five += r.rarity === 5; }
    Math.random = window.__rand;
    return { leg, hLeg, pulls, h, five, pity: s.pity[1] };
  });
  console.log('spawner sim:', sim);
  expect(sim.leg).toBe(20000);
  // 0.2 / 5.2 = 3.85% of the Overworld's Legendaries.
  expect(sim.hLeg / sim.leg).toBeGreaterThan(0.028);
  expect(sim.hLeg / sim.leg).toBeLessThan(0.05);
  // ~1 in 1,700 pulls from the listed odds; the pity and the ×10 guarantee lift it a little (~1 in 1,000).
  expect(sim.h / sim.pulls).toBeGreaterThan(1 / 2500);
  expect(sim.h / sim.pulls).toBeLessThan(1 / 600);

  // The screen: Herobrine's odds spelled out, every Legendary of the pack listed; the art shows them.
  await page.click('#scr-menu [data-go=gacha]');
  await page.locator(visible('scr-gacha')).waitFor();
  await page.click('#gacha-gens .gen-tab[data-gen="1"]');
  await expect(page.locator('#banner-desc')).toContainText('Herobrine lurks in this Spawner: about 0.06% per spawn');
  const rows = await page.locator('#gacha-rates .rate-mob').allTextContents();
  expect(rows.length).toBe(await page.evaluate(() => G.Gacha.pool(5, 1).length));
  expect(rows.join(' ')).toMatch(/Herobrine\s*0\.06% per spawn/);
  expect(rows.join(' ')).toContain('Chicken Jockey');
  expect(await page.locator('#gacha-feat canvas').count()).toBe(3);
  for (const [gen, name] of [[2, 'Spider Jockey'], [3, 'Netherite Drowned'], [4, 'Mending Librarian'], [6, 'Netherite Piglin']]) {
    await page.click(`#gacha-gens .gen-tab[data-gen="${gen}"]`);
    await expect(page.locator('#gacha-rates')).toContainText(name);
  }
  await page.screenshot({ path: 'artifacts/mcs-spawner-packs.png' });

  // Dev: a ×10 that is all Legendary.
  await page.click('#gacha-gens .gen-tab[data-gen="2"]');
  await page.evaluate(() => { G.DB.save.dev = true; G.DB.commit(); G.Dev.refresh(); G.Dev.toggle(true); });
  await page.click('#dev-panel [data-a=pullLegend]');
  await page.locator('#pull-close:not(.hidden)').waitFor({ timeout: 30_000 });
  expect(await page.locator('#pull-results .pcard.r5').count()).toBe(10);
  await page.click('#pull-close');

  expect(external, 'requests left localhost').toEqual([]);
  expect(errors, 'console/page errors').toEqual([]);
});

test('Minecraft Survivor: armoured mobs and jockeys (Mobdex, spawns, stats, drops)', async ({ page }) => {
  test.setTimeout(120_000);
  const { external, errors } = watch(page);
  await signUp(page, 'armour_e2e');

  // The Mobdex: iron / diamond / netherite variants of six humanoids, boosted over their base, at their tier's rarity.
  const dex = await page.evaluate(() => G.DEX.filter(p => p.arm).map(p => {
    const b = G.DEX.find(x => x.key === p.v);
    return { key: p.key, name: p.name, arm: p.arm, r: p.rarity, gen: p.gen, bgen: b.gen, hp: p.hp / b.hp, atk: p.atk / b.atk, spd: p.spd === b.spd,
             bst: p.bst > b.bst, sprite: !!G.SPRITE_META[p.dex] };
  }));
  expect(dex.length).toBe(18);
  const R = { iron: [3, 1.2, 1.1], diamond: [4, 1.45, 1.2], netherite: [5, 1.75, 1.3] };
  for (const d of dex) {
    const [r, hp, atk] = R[d.arm];
    expect(d, d.key).toMatchObject({ r, gen: d.bgen, spd: true, bst: true, sprite: true });
    expect(d.hp).toBeCloseTo(hp, 1);
    expect(d.atk).toBeCloseTo(atk, 1);
  }
  expect(dex.map(d => d.name)).toEqual(expect.arrayContaining(['Iron Zombie', 'Diamond Skeleton', 'Netherite Steve', 'Netherite Piglin', 'Diamond Drowned']));
  // The jockeys and the Mending Librarian: Legendaries with sprites; the librarian counts toward the villager species.
  const leg = await page.evaluate(() => ['chicken_jockey', 'spider_jockey', 'villager_mending'].map(k => {
    const p = G.DEX.find(x => x.key === k);
    return { k, dex: p.dex, r: p.rarity, gen: p.gen, v: p.v || null, meta: !!(G.SPRITE_META[p.dex] && G.SPRITE_META[p.dex].a.Walk) };
  }));
  expect(leg).toEqual([{ k: 'chicken_jockey', dex: 309, r: 5, gen: 1, v: null, meta: true }, { k: 'spider_jockey', dex: 310, r: 5, gen: 2, v: null, meta: true },
    { k: 'villager_mending', dex: 311, r: 5, gen: 4, v: 'villager', meta: true }]);

  await page.click('#scr-menu [data-go=play]');
  await page.waitForFunction(() => G.Game.state === 'playing', undefined, { timeout: 20_000 });
  await page.evaluate(() => { G.Dev.god = true; G.Dev.noSpawns = true; G.EnemyMgr.clear(); });
  // Natural spawns: a zombie may come armoured by day, as a Chicken Jockey at night; spiders as Spider Jockeys.
  const DRESS = () => {
    const P = G.Game.player, t = G.Game.st.time, ti = G.Enemies.tierAt(t);
    const def = k => G.Enemies.defFor(G.DEX.find(p => p.key === k && !p.v), G.Enemies.TIERS[ti], ti);
    window.__dress = (k, r) => { const keep = Math.random; if (r != null) Math.random = () => r; const d = G.Spawner.dress(def(k), t, P.x, P.y); Math.random = keep; return d; };
  };
  await page.evaluate(DRESS);
  const day = await page.evaluate(() => {
    G.DayNight.debugSet('day');
    const at = window.__dress;
    return { lucky: at('zombie', 0).armour, unlucky: at('zombie', 0.999).dex, cow: at('cow', 0).dex, steve: at('steve', 0).armour || null };
  });
  await page.evaluate(SEED_RANDOM, 7);
  const share = await page.evaluate(() => {
    const n = {}, N = 40000;
    for (let i = 0; i < N; i++) { const d = window.__dress('skeleton'); n[d.armour || 'none'] = (n[d.armour || 'none'] || 0) + 1; }
    Math.random = window.__rand;
    return { iron: n.iron / N, diamond: n.diamond / N, netherite: (n.netherite || 0) / N };
  });
  const night = await page.evaluate(() => { G.DayNight.debugSet('night'); return { zombie: window.__dress('zombie', 0).dex, spider: window.__dress('spider', 0).dex }; });
  const roll = { day, night, share };
  expect(roll.day).toEqual({ lucky: 'netherite', unlucky: 30, cow: 6, steve: null });
  expect(roll.night).toEqual({ zombie: 309, spider: 310 });
  expect(roll.share.iron).toBeGreaterThan(0.04);
  expect(roll.share.iron).toBeLessThan(0.06);
  expect(roll.share.diamond).toBeGreaterThan(0.01);
  expect(roll.share.diamond).toBeLessThan(0.02);
  expect(roll.share.netherite).toBeGreaterThan(0.001);
  expect(roll.share.netherite).toBeLessThan(0.006);

  // An armoured enemy: boosted health and damage over the same mob unarmoured, its armoured sprite, its emeralds.
  const fight = await page.evaluate(() => {
    const t = G.Game.st.time, ti = G.Enemies.tierAt(t), coins = () => G.Pickups.all().filter(p => p.kind === 'coin').reduce((a, p) => a + p.value, 0);
    const out = {};
    for (const tier of ['iron', 'diamond', 'netherite']) {
      const e = G.Spawner.debugSpecial(tier), base = G.Enemies.defFor(G.DEX_BY[e.def.of], G.Enemies.TIERS[ti], ti);
      e.kx = e.ky = 0;
      e.hurt(1, '#fff', 1, 0, 300);
      const kb = e.kx;
      const c0 = coins();
      e.hp = 0; e.die();
      out[tier] = { name: e.name, armour: e.armour, sheet: e.anim.dex === e.dex, hp: e.def.hp / base.hp, dmg: e.def.dmg / base.dmg,
                    kbImmune: e.kbImmune, kb, coins: coins() - c0 };
    }
    return out;
  });
  console.log('armoured:', fight);
  for (const [tier, [, hp, atk]] of Object.entries(R)) {
    const f = fight[tier];
    expect(f.armour).toBe(tier);
    expect(f.name.startsWith(tier[0].toUpperCase() + tier.slice(1) + ' ')).toBe(true);
    expect(f.hp).toBeCloseTo(hp, 1);
    expect(f.dmg).toBeCloseTo(atk, 2);
  }
  expect([fight.iron.coins, fight.diamond.coins, fight.netherite.coins]).toEqual([2, 5, 12]);
  expect(fight.netherite.kbImmune).toBe(true);
  expect(fight.netherite.kb).toBe(0);
  expect(fight.iron.kb).not.toBe(0);

  // The jockeys spawn from the dev panel and render with their own sprites.
  await page.evaluate(() => { G.DB.save.dev = true; G.Dev.refresh(); G.Dev.toggle(true); });
  await page.click('#dev-panel [data-a=sp_chicken_jockey]');
  await page.click('#dev-panel [data-a=sp_spider_jockey]');
  await page.click('#dev-panel [data-a=sp_netherite]');
  await page.evaluate(() => G.Dev.toggle(false));
  const live = await page.evaluate(() => G.EnemyMgr.all().filter(e => !e.dead).map(e => ({ key: G.DEX_BY[e.dex].key, beh: e.behavior })));
  expect(live).toEqual(expect.arrayContaining([{ key: 'chicken_jockey', beh: 'chase' }, { key: 'spider_jockey', beh: 'ranged' }]));
  expect(live.some(e => e.key.startsWith('netherite_'))).toBe(true);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'artifacts/mcs-armoured-jockeys.png' });

  expect(external, 'requests left localhost').toEqual([]);
  expect(errors, 'console/page errors').toEqual([]);
});

test('Minecraft Survivor: Support screen (tip jar: coffee link, Solana address, copy, QR)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const { external, errors } = watch(page);
  await signUp(page, 'tipper_e2e');

  const item = page.locator('#scr-menu [data-go=support]');
  await expect(item).toContainText('Support the game');
  await expect(item).toContainText('Buy me a coffee · Solana');
  await item.click();
  await page.locator(visible('scr-support')).waitFor();

  // The address, exactly as configured (js/data/support.js), and Copy puts it on the clipboard.
  const ADDR = '3SivNBoc62QvZsSEJxaJM9efjyeGV1NKpQMy4vUrnHWp';
  expect(await page.evaluate(() => G.SUPPORT.solana)).toBe(ADDR);
  await expect(page.locator('#sup-addr')).toHaveText(ADDR);
  await page.click('#sup-copy');
  await expect(page.locator('.toast')).toHaveText('Copied!');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ADDR);

  // The QR code: drawn offline (js/core/qr.js) as a PNG of solana:<address>, 33 modules + quiet zone at 5 px.
  const qr = page.locator('#sup-qr');
  await expect(qr).toBeVisible();
  const img = await qr.evaluate(el => ({ src: el.src.slice(0, 22), w: el.naturalWidth, h: el.naturalHeight }));
  expect(img).toEqual({ src: 'data:image/png;base64,', w: 205, h: 205 });
  expect(await page.evaluate(() => G.QR.matrix('solana:' + G.SUPPORT.solana).size)).toBe(33);

  // The owner's Buy Me a Coffee page is set.
  expect(await page.evaluate(() => G.SUPPORT.coffee)).toBe('https://buymeacoffee.com/nokiademon');
  // Without a coffee URL, the button hides and a "coming soon" note shows instead.
  await page.evaluate(() => { G.SUPPORT.coffee = ''; G.SupportUI.open(); });
  await expect(page.locator('#sup-coffee')).toBeHidden();
  await expect(page.locator('#sup-coffee-soon')).toBeVisible();
  // With one: a link that opens in a new tab (not followed here).
  await page.evaluate(() => { G.SUPPORT.coffee = 'https://buymeacoffee.com/example'; G.SupportUI.open(); });
  const coffee = page.locator('#sup-coffee');
  await expect(coffee).toBeVisible();
  await expect(coffee).toHaveAttribute('href', 'https://buymeacoffee.com/example');
  await expect(coffee).toHaveAttribute('target', '_blank');
  await expect(coffee).toHaveAttribute('rel', 'noopener');
  await expect(page.locator('#sup-coffee-soon')).toBeHidden();
  await page.screenshot({ path: 'artifacts/mcs-support.png' });

  await page.click('#scr-support [data-back]');
  await page.locator(visible('scr-menu')).waitFor();
  await expect(page.locator('#credits-line')).toContainText('Unofficial fan game. Not affiliated with Mojang or Microsoft. Minecraft assets © Mojang.');

  expect(external, 'requests left localhost').toEqual([]);
  expect(errors, 'console/page errors').toEqual([]);
});
