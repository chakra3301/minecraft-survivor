// Screenshots of Minecraft Survivor screens for visual checks (serves the source folder itself).
//   node tools/mc/shot.mjs --port 4331 --out ../artifacts/shots login menu dex gacha run levelup rift judgment
// Scenarios: login test result menu dex upgrades gacha pull goals settings run levelup biomes weather rift floorboss portal
//            nether end floors raid ominous ocean stronghold endfight ancient judgment over
//   biomes: teleports to a few Overworld biomes (desert, snowy plains, swamp...) and shoots each with its mobs.
//   floorboss: the Raid's banner (the Ravager and its illagers); portal: kills it and shows the cave entrance and its arrow;
//   nether / end: jump to that floor (G.Game.debugDimension) and play a bit.
//   floors: every floor's arrival banner (floor-1 … floor-8). raid / ominous: the Overworld and Underworld floor bosses.
//   ocean: the dive portal, the Ocean's arrival, each of its biomes (the underwater overlay), the Drowned Captain,
//   both sea battles, the Elder Guardians asleep (counter and arrow) and waking, then the cave exit opening.
//   stronghold: the Eye of Ender arrow, then holding the End Portal room. endfight: the dragon shielded by the End
//   Crystals, a crystal exploding, the dragon open. ancient: the WARNING shriekers and the Warden digging up.
//   judgment: Herobrine's World (the last floor): his cinematic, then the hunt.
//   --eval "<js run in the page after the menu is reached>" adds a 'custom' shot.
// Each run signs up a fresh local account. Prints console errors and failed requests it saw.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ws = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const port = +opt('--port', 4331), out = path.resolve(opt('--out', path.join(ws, 'artifacts/shots'))), evalJs = opt('--eval', null);
const want = args.length ? args : ['menu', 'run'];
await mkdir(out, { recursive: true });

const server = spawn('node', ['tools/serve.mjs', 'minecraft-survivor', '--src'], { cwd: ws, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', e => problems.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
page.on('response', r => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
const vis = id => `#${id}:not(.hidden)`;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', path.join(out, name + '.png')); };
const has = s => want.includes(s);

try {
  await page.goto(`http://127.0.0.1:${port}/dev.html`);
  await page.waitForFunction(() => window.G && G.DB && G.Flow, undefined, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.mouse.click(640, 360);
  await page.locator(vis('scr-login')).waitFor();
  if (has('login')) await shot('login');
  await page.locator('#scr-login .tab[data-tab=register]').click();
  await page.fill('#f-user', 'shot' + Math.floor(Math.random() * 1e6));
  await page.fill('#f-pass', 'test1234');
  await page.click('#btn-auth');
  await page.locator(vis('scr-test')).waitFor();
  if (has('test')) await shot('test');
  while (await page.locator(vis('scr-test')).count()) await page.locator('#test-a .answer').first().click();
  await page.locator(vis('scr-result')).waitFor();
  await page.waitForTimeout(600);
  if (has('result')) await shot('result');
  await page.click('#res-ok');
  await page.locator(vis('scr-menu')).waitFor();
  // Rich save so collection/gacha screens have content.
  await page.evaluate(() => {
    const s = G.DB.save;
    s.coins = 99999; s.tickets = { t1: 30, t10: 3 };
    for (const p of G.DEX) if (p.dex % 3 === 0 || p.rarity >= 4) G.DB.grant(p.dex, 'test');
    for (const p of G.DEX.slice(0, 12)) s.shiny[p.dex] = 1;
    G.DB.commit();
  });
  await page.waitForTimeout(1500);
  if (has('menu')) await shot('menu');
  const menuGo = async (go, name, after) => {
    await page.click(`#scr-menu [data-go=${go}]`);
    await page.waitForTimeout(900);
    if (after) await after();
    await shot(name);
    // Settings is an overlay and the spawn animation has its own layer: close both before returning.
    await page.evaluate(() => {
      if (G.SettingsUI && G.SettingsUI.isOpen) G.SettingsUI.close();
      const pc = document.getElementById('pull-close');
      if (pc && !pc.classList.contains('hidden')) pc.click();
      G.Flow.goMenu();
    });
    await page.waitForTimeout(400);
  };
  if (has('dex')) await menuGo('dex', 'dex');
  if (has('upgrades')) await menuGo('upgrades', 'upgrades');
  if (has('gacha')) await menuGo('gacha', 'gacha');
  if (has('pull')) await menuGo('gacha', 'pull', async () => { await page.click('#pull-10'); await page.waitForSelector('#pull-close:not(.hidden)', { timeout: 30000 }); await page.waitForTimeout(500); });
  if (has('goals')) await menuGo('goals', 'goals');
  if (has('settings')) await menuGo('settings', 'settings');
  if (evalJs) { await page.evaluate(evalJs); await page.waitForTimeout(1200); await shot('custom'); }

  const inRun = ['run', 'levelup', 'biomes', 'weather', 'rift', 'floorboss', 'portal', 'nether', 'end', 'floors', 'raid', 'ominous', 'ocean',
    'stronghold', 'endfight', 'ancient', 'judgment', 'over'].some(has);
  if (inRun) {
    await page.click('#scr-menu [data-go=play]');
    await page.waitForFunction(() => G.Game.state === 'playing', undefined, { timeout: 20000 });
    const walk = async ms => { for (const k of ['d', 's', 'a', 'w']) { await page.keyboard.down(k); await page.waitForTimeout(ms / 4); await page.keyboard.up(k); } };
    const settle = async () => { for (let i = 0; i < 6; i++) { const st = await page.evaluate(() => G.Game.state); if (st === 'playing') return; await page.keyboard.press('1'); await page.waitForTimeout(300); } };
    await walk(4000); await settle();
    if (has('run')) await shot('run');
    if (has('levelup')) { await page.evaluate(() => G.Game.debugLevelUp()); await page.waitForTimeout(1200); await shot('levelup'); await settle(); }
    if (has('weather')) { await page.evaluate(() => G.Weather.debugStart('rain', 60)); await page.waitForTimeout(1500); await shot('weather'); }
    // Tests and shots: the player can't be hurt (a weak starter would die before the late scenarios).
    await page.evaluate(() => { G.Game.player.hurt = () => 0; });
    if (has('biomes')) {
      for (const key of ['desert', 'snowy_plains', 'swamp', 'dark_forest', 'ocean_shore']) {
        const ok = await page.evaluate(k => {
          if (!G.World.biomeKeyAt) return false;
          const pl = G.Game.player;
          for (let r = 0; r < 60000; r += 400) for (let a = 0; a < 6.28; a += 0.5) {
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            if (G.World.biomeKeyAt(x, y) === k && G.World.biomeKeyAt(x + 600, y) === k && G.World.biomeKeyAt(x - 600, y) === k && G.World.isFree(x, y, 16)) {
              G.EnemyMgr.clear(); pl.x = x; pl.y = y; G.Camera.x = x; G.Camera.y = y; return true;
            }
          }
          return false;
        }, key);
        if (!ok) { console.log('biome not found:', key); continue; }
        await page.evaluate(() => G.Game.debugTime(Math.max(G.Game.st.time, 200)));
        await page.waitForTimeout(7000); await settle();
        await shot('biome-' + key);
      }
    }
    if (has('rift')) { await page.evaluate(() => G.Rift.debugArena()); await page.waitForTimeout(4000); await settle(); await shot('rift'); }
    const nearBoss = () => page.evaluate(() => {
      const pl = G.Game.player, e = G.EnemyMgr.all().find(e => e.floorBoss);
      if (e) { e.x = pl.x + 170; e.y = pl.y - 30; }
    });
    if (has('floorboss') || has('portal')) {
      await page.evaluate(() => G.Game.debugBoss('floor')); await nearBoss(); await page.waitForTimeout(900); await nearBoss();
      await page.waitForTimeout(300);
      if (has('floorboss')) await shot('floorboss');
    }
    if (has('portal')) {
      await page.evaluate(() => { const e = G.EnemyMgr.all().find(e => e.floorBoss); if (e) { e.hp = 1; e.hurt(99, '#fff', 0, 0, 0); } });
      await page.waitForTimeout(1500); await settle();
      await shot('portal');
      // Walk away so the portal is off-screen and the arrow shows.
      await page.evaluate(() => { const pl = G.Game.player, P = G.Floors.portal; pl.x = P.x - 900; pl.y = P.y + 300; G.Camera.x = pl.x; G.Camera.y = pl.y; });
      await page.waitForTimeout(800); await settle();
      await shot('portal-arrow');
      await page.evaluate(() => { const pl = G.Game.player, P = G.Floors.portal; pl.x = P.x; pl.y = P.y; });
      await page.waitForTimeout(400); await shot('portal-travel');
      await page.waitForTimeout(1200); await settle(); await shot('portal-arrived');
    }
    if (has('nether')) { await page.evaluate(() => G.Game.debugDimension('nether')); await page.waitForTimeout(1200); await shot('nether-banner'); await walk(5000); await settle(); await shot('nether'); }
    if (has('end')) { await page.evaluate(() => G.Game.debugDimension('end')); await page.waitForTimeout(1200); await shot('end-banner'); await walk(5000); await settle(); await shot('end'); }
    const floor = async id => { await page.evaluate(d => G.Game.debugDimension(d), id); await page.waitForTimeout(900); await settle(); };
    const bossNear = async (dx = 170, dy = -30) => page.evaluate(([x, y]) => {
      const pl = G.Game.player, e = G.EnemyMgr.all().find(e => e.floorBoss);
      if (e) { e.x = pl.x + x; e.y = pl.y + y; }
      for (const m of G.EnemyMgr.all()) if (m.raider) { m.x = pl.x + 110 + Math.random() * 160; m.y = pl.y - 90 + Math.random() * 170; }
    }, [dx, dy]);
    if (has('floors')) for (const [i, d] of (await page.evaluate(() => G.DIMENSIONS.map(d => d.id))).entries()) {
      if (d === 'herobrine') continue;
      await floor(d); await shot('floor-' + (i + 1));
    }
    if (has('raid')) { await floor('overworld'); await page.evaluate(() => G.Game.debugBoss('floor')); await bossNear(); await page.waitForTimeout(800); await bossNear(); await shot('raid'); }
    if (has('ominous')) { await floor('underworld'); await page.evaluate(() => G.Game.debugBoss('floor')); await bossNear(); await page.waitForTimeout(2500); await settle(); await shot('ominous'); }
    if (has('ocean')) {
      // The dive: the Overworld's exit portal, then through it.
      await floor('overworld');
      await page.evaluate(() => { const pl = G.Game.player, P = G.Game.debugPortal(); if (P) { pl.x = P.x - 160; pl.y = P.y + 40; } });
      await page.waitForTimeout(1500); await settle(); await shot('ocean-dive');
      await page.evaluate(() => { const pl = G.Game.player, P = G.Floors.portal; pl.x = P.x; pl.y = P.y; });
      await page.waitForFunction(() => G.Floors.dim === 'ocean' && !G.Floors.traveling, undefined, { timeout: 10000 });
      await page.waitForTimeout(700); await shot('ocean-arrival');
      await page.evaluate(() => { G.Dev.noSpawns = false; G.Game.debugTime(Math.max(G.Game.st.time, 200)); });
      // Each biome, with its mobs (the underwater overlay over each).
      for (const key of await page.evaluate(() => G.Floors.def.biomes)) {
        const ok = await page.evaluate(k => {
          const pl = G.Game.player, M = G.World.monument;
          if (k === 'ocean_monument' && M) { pl.x = M.x + M.r + 520; pl.y = M.y; G.Camera.x = pl.x; G.Camera.y = pl.y; return true; }
          for (let r = 0; r < 9000; r += 160) for (let a = 0; a < 6.28; a += 0.4) {
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            if (G.World.biomeKeyAt(x, y) === k && G.World.biomeKeyAt(x + 300, y) === k && G.World.biomeKeyAt(x - 300, y) === k && G.World.isFree(x, y, 16, true)) {
              pl.x = x; pl.y = y; G.Camera.x = x; G.Camera.y = y; return true;
            }
          }
          return false;
        }, key);
        if (!ok) { console.log('biome not found:', key); continue; }
        await walk(3000); await settle(); await shot('ocean-' + key);
      }
      // The Elder Guardians asleep: the counter and the arrow to the monument.
      await page.evaluate(() => { const pl = G.Game.player, H = G.Floors.elders && G.Floors.elders.home; if (H) { pl.x = H.x + H.r + 1100; pl.y = H.y + 300; G.Camera.x = pl.x; G.Camera.y = pl.y; } });
      await page.waitForTimeout(1200); await settle(); await shot('ocean-elders-asleep');
      // The Drowned Captain and its crew.
      await page.evaluate(() => { const e = G.Game.debugBoss('mid'), pl = G.Game.player; if (e) { e.x = pl.x + 200; e.y = pl.y - 20; } });
      await page.waitForTimeout(2600); await settle(); await shot('ocean-captain');
      await page.waitForTimeout(2600); await settle(); await shot('ocean-captain2');
      await page.evaluate(() => { for (const e of G.EnemyMgr.all()) if (e.midBoss || e.raider) { e.hp = 0; e.die(); } });
      // The sea battles.
      await page.evaluate(() => G.Events.debugStart('dolphins'));
      await page.waitForTimeout(3200); await settle(); await shot('ocean-dolphins');
      await page.evaluate(() => G.Events.debugStart('guardians'));
      await page.waitForTimeout(800); await shot('ocean-guardians-banner');
      await page.evaluate(() => { const pl = G.Game.player, s = G.Events.sea; if (s && s.list) s.list.forEach((e, i) => { e.x = pl.x + 180 + i * 30; e.y = pl.y - 60 + i * 40; }); });
      await page.waitForTimeout(3000); await settle(); await shot('ocean-guardians');
      await page.evaluate(() => { const s = G.Events.sea; if (s && s.list) s.list.forEach(e => { e.hp = 0; e.die(); }); });
      // Swim to the monument: they wake.
      await page.evaluate(() => { const pl = G.Game.player, H = G.Floors.elders.home; if (H) { pl.x = H.x + H.r + 300; pl.y = H.y; G.Camera.x = pl.x; G.Camera.y = pl.y; } else G.Floors.debugElders(); });
      await page.waitForTimeout(1000); await shot('ocean-elders-wake');
      await page.waitForTimeout(3000); await settle(); await shot('ocean-elders-fight');
      await page.evaluate(() => { const e = G.Floors.elders.list[0]; e.hp = 0; e.die(); });
      await page.waitForTimeout(1200); await settle(); await shot('ocean-elders-counter');
      await page.evaluate(() => { for (const e of G.Floors.elders.list) { e.hp = 0; e.die(); } });
      await page.waitForTimeout(1500); await settle(); await shot('ocean-cave');
      await page.evaluate(() => { const pl = G.Game.player, P = G.Floors.portal; pl.x = P.x - 900; pl.y = P.y + 300; G.Camera.x = pl.x; G.Camera.y = pl.y; });
      await page.waitForTimeout(900); await settle(); await shot('ocean-cave-arrow');
    }
    if (has('stronghold')) {
      await floor('stronghold');
      await page.evaluate(() => { G.Floors.debugRoom(); const pl = G.Game.player, r = G.Floors.room; pl.x = r.x - 900; pl.y = r.y + 300; G.Camera.x = pl.x; G.Camera.y = pl.y; });
      await page.waitForTimeout(1500); await settle(); await shot('stronghold-eye');
      await page.evaluate(() => { const pl = G.Game.player, r = G.Floors.room; pl.x = r.x; pl.y = r.y; });
      await page.waitForTimeout(7000); await settle(); await shot('stronghold-hold');
    }
    if (has('endfight')) {
      await floor('end');
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        const pl = G.Game.player, c = G.EndFight.crystals[0];
        pl.x = c.top.x + 140; pl.y = c.top.y + 40; G.Camera.x = pl.x; G.Camera.y = pl.y;
        const e = G.Game.debugBoss('floor'); e.x = pl.x + 200; e.y = pl.y + 140;
      });
      await page.waitForTimeout(5000); await settle(); await shot('endfight-shielded');
      await page.evaluate(() => { const c = G.EndFight.crystals[0]; c.hurt(c.maxHp + 10); });
      await page.waitForTimeout(150); await shot('endfight-explosion');
      await page.evaluate(() => G.EndFight.debugBreakAll());
      await page.waitForTimeout(1500); await settle(); await bossNear(220, 0); await shot('endfight-open');
    }
    if (has('ancient')) {
      await floor('ancient_city');
      await page.evaluate(() => { G.Floors.debugWarn(); G.Floors.debugWarn(); });
      await page.waitForTimeout(5000); await settle(); await shot('ancient-warning');
      await page.evaluate(() => { G.Floors.debugWarn(); G.Floors.debugWarn(); });
      await page.waitForTimeout(1000); await shot('ancient-emerge');
      await page.waitForTimeout(2500); await settle(); await shot('ancient-warden');
    }
    if (has('judgment')) {
      await floor('herobrine'); await shot('judgment-banner');
      await page.waitForTimeout(8000); await shot('judgment'); await page.waitForTimeout(7000); await settle(); await shot('judgment2');
    }
    if (has('over')) { await page.keyboard.press('Escape'); await page.click('#btn-quit'); await page.locator(vis('scr-over')).waitFor({ timeout: 15000 }); await shot('over'); }
  }
} catch (e) {
  problems.push('script: ' + e.message.split('\n')[0]);
  await shot('error').catch(() => {});
} finally {
  await browser.close();
  server.kill();
  console.log(problems.length ? 'PROBLEMS:\n  ' + [...new Set(problems)].join('\n  ') : 'no console errors');
}
