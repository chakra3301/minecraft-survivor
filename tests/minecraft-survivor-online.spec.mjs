// Minecraft Survivor ONLINE (accounts, cloud saves, leaderboard, friends, co-op) against the Firebase
// emulators. Run it with minecraft-survivor/server/test-online.sh: it starts the emulators, builds the
// site in emulator mode (minecraft-survivor/dist-emulator) and serves it on 127.0.0.1:4385
// (config: minecraft-survivor/server/playwright.online.config.mjs). `npm test` skips it.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test.skip(!process.env.MCS_ONLINE, 'needs the Firebase emulators: run minecraft-survivor/server/test-online.sh');

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SITE = 'http://127.0.0.1:4385/';
const PROJECT = 'demo-minecraft-survivor';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };   // the emulators' admin token: bypasses the rules
const SHOTS = path.join(ROOT, 'artifacts/online');
const visible = id => `#${id}:not(.hidden)`;
const PASS = 'test1234';

// ---------------- emulator REST helpers ----------------

/** Wipes Firestore, Auth and the Realtime Database between tests. */
async function reset() {
  const r = await Promise.all([
    fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' }),
    fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' }),
    fetch(`http://127.0.0.1:9000/.json?ns=${PROJECT}-default-rtdb`, { method: 'PUT', headers: OWNER, body: 'null' })
  ]);
  for (const x of r) expect(x.ok, `reset ${x.url}`).toBe(true);
}

/** Firestore REST value → JS. */
function val(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return obj(v.mapValue.fields);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  return undefined;
}
const obj = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, val(v)]));

async function getDoc(p) {
  const r = await fetch(`${FS}/${p}`, { headers: OWNER });
  if (r.status === 404) return null;
  expect(r.ok, `GET ${p}`).toBe(true);
  return obj((await r.json()).fields);
}
async function listDocs(p) {
  const r = await fetch(`${FS}/${p}?pageSize=300`, { headers: OWNER });
  const j = await r.json();
  return (j.documents || []).map(d => ({ id: d.name.split('/').pop(), ...obj(d.fields) }));
}
/** Every leaderboard entry (lb/{board}/e/{id}) that includes `uid`. */
async function entriesOf(uid) {
  const r = await fetch(`${FS}:runQuery`, { method: 'POST', headers: OWNER, body: JSON.stringify({ structuredQuery: {
    from: [{ collectionId: 'e', allDescendants: true }],
    where: { fieldFilter: { field: { fieldPath: 'uids' }, op: 'ARRAY_CONTAINS', value: { stringValue: uid } } } } }) });
  return (await r.json()).filter(x => x.document).map(x => x.document.name);
}
/** Moves runs/{uid}.startedAt two hours back: the run "has lasted" long enough for any floor. */
async function backdate(uid) {
  await expect.poll(() => getDoc(`runs/${uid}`), { timeout: 15_000 }).not.toBeNull();
  const r = await fetch(`${FS}/runs/${uid}?updateMask.fieldPaths=startedAt`, { method: 'PATCH', headers: OWNER,
    body: JSON.stringify({ fields: { startedAt: { timestampValue: new Date(Date.now() - 2 * 3600e3).toISOString() } } }) });
  expect(r.ok).toBe(true);
}
async function authUsers() {
  const r = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, { method: 'POST', headers: OWNER, body: '{}' });
  return ((await r.json()).userInfo || []).map(u => u.localId);
}
/** Replaces the Firestore emulator's rules (moderation test: a moderator uid known only at runtime). */
async function setRules(content) {
  const r = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}:securityRules`, { method: 'PUT', headers: OWNER,
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }) });
  expect(r.ok, 'set rules').toBe(true);
}

// ---------------- players ----------------

/** Requests leaving this machine and page errors, per page. */
function watch(page, tag) {
  const w = { external: [], errors: [] };
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:') && !/^(data|blob):/.test(r.url())) w.external.push(r.url()); });
  page.on('pageerror', e => w.errors.push(`${tag}: ${e.message}`));
  return w;
}

async function open(page) {
  await page.goto(SITE);
  await page.waitForFunction(() => window.G && G.DB && G.DB.mode === 'cloud' && document.getElementById('boot').classList.contains('hidden'), null, { timeout: 30_000 });
  await page.mouse.click(640, 360);                    // "tap to start" (audio unlock)
}

/** A fresh browser (context) with a new online account, through the personality test, at the menu. */
async function newPlayer(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const w = watch(page, name);
  await open(page);
  await page.locator(visible('scr-login')).waitFor();
  await page.locator('#scr-login .tab[data-tab=register]').click();
  await page.fill('#f-user', name);
  await page.fill('#f-pass', PASS);
  await page.click('#btn-auth');
  await page.locator(visible('scr-test')).waitFor({ timeout: 20_000 });
  while (await page.locator(visible('scr-test')).count()) await page.locator('#test-a .answer').first().click();
  await page.locator(visible('scr-result')).waitFor();
  await page.click('#res-ok');
  await page.locator(visible('scr-menu')).waitFor();
  // Name accounts use their name as the nickname (friends and leaderboard).
  await page.waitForFunction(n => G.Social.me && G.Social.me.name === n, name, { timeout: 15_000 });
  const uid = await page.evaluate(() => G.DB.fb.uid);
  return { ctx, page, name, uid, w };
}

/** Logs `name` in from a brand-new browser (no local copy of the save). */
async function logIn(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const w = watch(page, name + '#2');
  await open(page);
  await page.locator(visible('scr-login')).waitFor();
  await page.fill('#f-user', name);
  await page.fill('#f-pass', PASS);
  await page.click('#btn-auth');
  await page.locator(visible('scr-menu')).waitFor({ timeout: 20_000 });
  return { ctx, page, name, uid: await page.evaluate(() => G.DB.fb.uid), w };
}

/**
 * Uploads the save now. The game waits up to 30 min and never uploads twice within 65 s; and the rules
 * give saves seconds apart almost no margin (anti-cheat). So, like real play, the cloud copy is first
 * aged 10 minutes (saves/{uid}.updatedAt), and the 65 s gap is cleared.
 */
async function flush(page) {
  const uid = await page.evaluate(() => G.DB.fb.uid);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => G.DB.flush());            // let any upload in flight finish
    const r = await fetch(`${FS}/saves/${uid}?updateMask.fieldPaths=updatedAt`, { method: 'PATCH', headers: OWNER,
      body: JSON.stringify({ fields: { updatedAt: { timestampValue: new Date(Date.now() - 600e3).toISOString() } } }) });
    expect(r.ok).toBe(true);
    const st = await page.evaluate(async () => {
      try { localStorage.removeItem('ps.cloudok.' + G.DB.fb.uid); } catch (e) { /* nada */ }
      await G.DB.flush();
      return G.DB.syncState;
    });
    if (st === 'ok') return st;
  }
  return page.evaluate(() => G.DB.syncState);
}

/**
 * A solo run that reaches floor `dim` with the run clock at `t` s, then ends (quit): the game posts it
 * to the leaderboard. The run's server-side start is moved 2 h back so the time is plausible.
 */
async function rankedRun(p, dim, t) {
  await p.page.click('#scr-menu [data-go=play]');
  await p.page.waitForFunction(() => G.Game.state === 'playing', null, { timeout: 20_000 });
  await backdate(p.uid);
  const f = await p.page.evaluate(([dim, t]) => {
    G.Game.player.hurt = () => 0;
    G.Game.debugTime(t);
    G.Game.debugDimension(dim);
    return G.Floors.index;
  }, [dim, t]);
  await p.page.waitForTimeout(400);
  await p.page.evaluate(() => G.Game.quit());
  await p.page.locator(visible('scr-over')).waitFor({ timeout: 15_000 });
  await expect.poll(async () => (await getDoc(`lb/s_all/e/${p.uid}`) || {}).f, { timeout: 20_000 }).toBe(f);
  await p.page.click('#btn-again');
  await p.page.locator(visible('scr-menu')).waitFor({ timeout: 15_000 });
  return f;
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name) });

test.beforeEach(async () => { await reset(); });

// ---------------- tests ----------------

test('two accounts register; a cloud save round-trips to a fresh browser', async ({ browser }) => {
  // The login screen of the online site (Google sign-in shows when the config allows it).
  {
    const page = await browser.newPage();
    await open(page);
    await page.locator(visible('scr-login')).waitFor();
    await page.locator('#scr-login .tab[data-tab=register]').click();
    await expect(page.locator('#login-mode')).toContainText('saved to your account');
    await shot(page, 'online-login.png');
    await page.close();
  }
  const A = await newPlayer(browser, 'SteveA');
  const B = await newPlayer(browser, 'AlexB');
  expect(A.uid).not.toBe(B.uid);
  expect(new Set(await authUsers())).toEqual(new Set([A.uid, B.uid]));
  // Both saves exist in the cloud from the start (saves/{uid}), with their nicknames reserved.
  expect((await getDoc(`saves/${A.uid}`)).save.name).toBe('SteveA');
  expect((await getDoc('names/alexb')).uid).toBe(B.uid);

  // Progress on A's device: emeralds and runs, uploaded.
  const before = await A.page.evaluate(() => ({ coins: G.DB.save.coins, partner: G.DB.save.partner }));
  await A.page.evaluate(() => { G.DB.save.coins += 250; G.DB.save.stats.runs += 2; G.DB.commit(); });
  expect(await flush(A.page)).toBe('ok');
  const doc = await getDoc(`saves/${A.uid}`);
  expect(doc.save.coins).toBe(before.coins + 250);
  expect(doc.sus).toBeUndefined();

  // A fresh browser: log in as A and find the same save.
  const A2 = await logIn(browser, 'SteveA');
  const got = await A2.page.evaluate(() => ({ coins: G.DB.save.coins, runs: G.DB.save.stats.runs, partner: G.DB.save.partner, sync: G.DB.syncState }));
  expect(got).toMatchObject({ coins: before.coins + 250, runs: 2, partner: before.partner });
  for (const p of [A, B, A2]) { expect(p.w.external, 'requests left this machine').toEqual([]); expect(p.w.errors).toEqual([]); }
});

test('leaderboard: solo runs post floor and time, sorted by floor then time, with sprites', async ({ browser }) => {
  test.setTimeout(300_000);
  const A = await newPlayer(browser, 'Aether_A');
  const B = await newPlayer(browser, 'Nether_B');
  const C = await newPlayer(browser, 'Ocean_C');
  const D = await newPlayer(browser, 'Nether_D');
  // A reaches the Aether at 21:40 · B dies in the Nether at 11:40 · D in the Nether at 15:50 · C in the Ocean at 33:20.
  expect(await rankedRun(A, 'aether', 1300)).toBe(8);
  expect(await rankedRun(B, 'nether', 700)).toBe(3);
  expect(await rankedRun(C, 'ocean', 2000)).toBe(1);
  expect(await rankedRun(D, 'nether', 950)).toBe(3);

  const a = await getDoc(`lb/s_all/e/${A.uid}`);
  expect(a).toMatchObject({ f: 8, t: 1300, uids: [A.uid], names: ['Aether_A'] });
  expect(a.s).toBe(8 * 100000 + 99999 - 1300);          // the Aether: the arrival time, faster is better
  const b = await getDoc(`lb/s_all/e/${B.uid}`);
  expect(b.f).toBe(3);
  expect(b.t).toBeGreaterThanOrEqual(700);
  expect(b.s).toBe(300000 + b.t);
  // The summary (what the screen reads) holds all four, and each solo board got them (today, week, month, all-time, per mob).
  const top = (await getDoc('lbs/s_all')).top;
  const order = Object.entries(top).sort((x, y) => y[1].s - x[1].s).map(([, v]) => v.names[0]);
  expect(order).toEqual(['Aether_A', 'Nether_D', 'Nether_B', 'Ocean_C']);
  const boards = (await listDocs('lbs')).map(d => d.id);
  expect(boards.filter(id => id.startsWith('s_d') || id.startsWith('s_w') || id.startsWith('s_m'))).toHaveLength(3);
  expect(boards.some(id => /^s_all_p\d+$/.test(id))).toBe(true);

  // The screen, from a player who hasn't cached it: deepest floor first, then time; a sprite per row.
  await D.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('ps.rk.c.')) localStorage.removeItem(k); });
  await D.page.click('#scr-menu [data-go=rank]');
  await D.page.locator(visible('scr-rank')).waitFor();
  await D.page.locator('#rk-period [data-k=a]').click();
  await expect(D.page.locator('#rk-list .rk-row')).toHaveCount(4, { timeout: 15_000 });
  const rows = await D.page.$$eval('#rk-list .rk-row', els => els.map(e => ({
    who: e.querySelector('.who b').textContent, floor: e.querySelector('.rk-floor').textContent, time: e.querySelector('.time small').textContent,
    sprites: e.querySelectorAll('.mons canvas').length })));
  expect(rows.map(r => r.who)).toEqual(['Aether_A', 'Nether_D', 'Nether_B', 'Ocean_C']);
  expect(rows.map(r => r.floor)).toEqual(['The Aether', 'Floor 4 · The Nether', 'Floor 4 · The Nether', 'Floor 2 · The Ocean']);
  expect(rows[0].time).toBe('in 21:40');
  for (const r of rows) expect(r.sprites).toBe(1);
  await expect(D.page.locator('#rk-me')).toContainText('#2');
  await D.page.waitForTimeout(800);                     // sprites drawn
  await shot(D.page, 'online-leaderboard.png');
  for (const p of [A, B, C, D]) { expect(p.w.external).toEqual([]); expect(p.w.errors).toEqual([]); }
});

test('the rules reject cheating leaderboard entries', async ({ browser }) => {
  const A = await newPlayer(browser, 'Cheater');
  await A.page.evaluate(() => G.Ranking.runStarted('s'));
  await expect.poll(() => getDoc(`runs/${A.uid}`), { timeout: 15_000 }).not.toBeNull();
  // Tries to write lb/s_test/e/{uid} with the client SDK, as the game would. → 'ok' | error code
  const attempt = (entry) => A.page.evaluate(async e => {
    const uid = G.DB.fb.uid;
    const d = Object.assign({ uids: [uid], names: [G.Social.me.name], dex: [G.DB.save.partner], shiny: [false], lv: 5, kills: 100,
      at: firebase.firestore.FieldValue.serverTimestamp() }, e);
    if (d.s == null) d.s = G.Ranking.score(d.f, d.t);
    try { await G.DB.fb.fs.collection('lb').doc('s_test').collection('e').doc(uid).set(d); return 'ok'; }
    catch (err) { return err.code; }
  }, entry);
  // The run started just now: 5 minutes can't have passed.
  expect(await attempt({ f: 0, t: 300 })).toBe('permission-denied');
  await backdate(A.uid);
  // An impossible floor for the time: The End (floor 6) after 6:40 (the Raid alone is at 6:00).
  expect(await attempt({ f: 5, t: 400 })).toBe('permission-denied');
  expect(await attempt({ f: 8, t: 600 })).toBe('permission-denied');
  // Too many mobs defeated, too high a level for the time.
  expect(await attempt({ f: 0, t: 300, kills: 99999 })).toBe('permission-denied');
  expect(await attempt({ f: 1, t: 400, lv: 500 })).toBe('permission-denied');
  // A forged score (floor 8 points for an Overworld run), and someone else's uid.
  expect(await attempt({ f: 0, t: 200, s: 800000 })).toBe('permission-denied');
  expect(await attempt({ f: 0, t: 200, uids: ['someone-else'] })).toBe('permission-denied');
  // A plausible run goes in; the same or a worse one can't replace it.
  expect(await attempt({ f: 1, t: 420, lv: 20, kills: 900 })).toBe('ok');
  expect(await attempt({ f: 1, t: 400, lv: 20, kills: 900 })).toBe('permission-denied');
  expect(await attempt({ f: 2, t: 700, lv: 30, kills: 2000 })).toBe('ok');
  // Saves: an honest one goes in; one with a million emeralds out of nowhere is refused (the game would
  // then retry and finally upload it flagged, sus = true: no more leaderboard).
  const writeSave = extra => A.page.evaluate(async x => {
    const s = JSON.parse(JSON.stringify(G.DB.save));
    Object.assign(s, x.top); Object.assign(s.stats, x.stats || {});
    try { await G.DB.fb.fs.collection('saves').doc(G.DB.fb.uid).set({ save: s, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), v: 3 }); return 'ok'; }
    catch (err) { return err.code; }
  }, extra);
  const coins = await A.page.evaluate(() => G.DB.save.coins);
  expect(await writeSave({ top: { coins: coins + 1000000 } })).toBe('permission-denied');
  expect(await writeSave({ top: {}, stats: { aether: 50 } })).toBe('permission-denied');
  expect(await writeSave({ top: { coins: coins + 300 } })).toBe('ok');
  // A flagged account (saves/{uid}.sus) can't post at all.
  await fetch(`${FS}/saves/${A.uid}?updateMask.fieldPaths=sus`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields: { sus: { booleanValue: true } } }) });
  expect(await attempt({ f: 3, t: 900, lv: 30, kills: 2000 })).toBe('permission-denied');
  expect(A.w.errors).toEqual([]);
});

test('friends: request, accept, both online; co-op invite, lobby and a 2-player run', async ({ browser }) => {
  test.setTimeout(300_000);
  const A = await newPlayer(browser, 'HostSteve');
  const B = await newPlayer(browser, 'GuestAlex');

  // A sends a friend request to B.
  await A.page.click('#scr-menu [data-go=friends]');
  await A.page.locator(visible('scr-friends')).waitFor();
  await A.page.fill('#fr-name', 'GuestAlex');
  await A.page.click('#fr-add button[type=submit]');
  await expect(A.page.locator('#fr-msg')).toContainText('Friend request sent to GuestAlex');
  await expect(A.page.locator('#fr-list .fr-row', { hasText: 'GuestAlex' })).toContainText('Request sent');

  // B accepts it.
  await B.page.click('#scr-menu [data-go=friends]');
  await B.page.locator(visible('scr-friends')).waitFor();
  const req = B.page.locator('#fr-list .fr-row', { hasText: 'HostSteve' });
  await expect(req).toContainText('Wants to be your friend', { timeout: 15_000 });
  await req.locator('button', { hasText: 'Accept' }).click();
  await expect(B.page.locator('#fr-msg')).toContainText('You and HostSteve are now friends');
  expect((await listDocs('friendships'))[0]).toMatchObject({ status: 'ok' });

  // Both see each other online (the presence heartbeat starts with the first friend).
  for (const [p, other] of [[A, 'GuestAlex'], [B, 'HostSteve']]) {
    await expect.poll(async () => {
      await p.page.evaluate(() => G.Social.refreshPresence(true));
      return p.page.locator('#fr-list .fr-row', { hasText: other }).locator('.dot.on').count();
    }, { timeout: 30_000 }).toBe(1);
    await expect(p.page.locator('#fr-list .fr-row', { hasText: other })).toContainText('Online');
  }
  await shot(A.page, 'online-friends-host.png');
  await shot(B.page, 'online-friends-guest.png');

  // A invites B into a co-op room.
  await A.page.locator('#fr-list .fr-row', { hasText: 'GuestAlex' }).locator('button', { hasText: 'Invite' }).click();
  await A.page.locator(visible('scr-lobby')).waitFor();
  expect((await listDocs('inv')).map(d => [d.to, d.from])).toEqual([[B.uid, A.uid]]);
  // B gets the invite and joins.
  await B.page.locator(visible('invite-pop')).waitFor({ timeout: 20_000 });
  await expect(B.page.locator('#inv-text')).toContainText('HostSteve invites you to their room');
  await B.page.click('#inv-yes');
  await B.page.locator(visible('scr-lobby')).waitFor();
  // The host's lobby: two players, connected peer to peer, ready to start.
  await expect(A.page.locator('#lobby-members .lob-card:not(.empty)')).toHaveCount(2, { timeout: 15_000 });
  await expect(A.page.locator('#lobby-members .conn', { hasText: 'Connected' })).toHaveCount(1, { timeout: 30_000 });
  await expect(A.page.locator('#lobby-start')).toBeEnabled();
  await expect(B.page.locator('#lobby-members .lob-card:not(.empty)')).toHaveCount(2);
  await A.page.waitForTimeout(600);
  await shot(A.page, 'online-lobby-host.png');
  await shot(B.page, 'online-lobby-guest.png');

  // Start: both enter the Overworld together.
  await A.page.click('#lobby-start');
  for (const p of [A, B]) await p.page.waitForFunction(() => G.Game.state === 'playing' && G.Coop.active, null, { timeout: 20_000 });
  for (const p of [A, B]) {
    expect(await p.page.evaluate(() => [G.Floors.dim, G.Coop.mates.length, G.Coop.members.length])).toEqual(['overworld', 1, 2]);
    await p.page.evaluate(() => { G.Game.player.hurt = () => 0; });
  }
  expect(await A.page.evaluate(() => G.Coop.isHost)).toBe(true);
  expect(await B.page.evaluate(() => G.Coop.isHost)).toBe(false);

  // Each sees the other move.
  const mateX = p => p.page.evaluate(() => G.Coop.mates[0].pl.x);
  const move = async (p, key) => { await p.page.keyboard.down(key); await p.page.waitForTimeout(1500); await p.page.keyboard.up(key); };
  const bOnA = await mateX(A);
  await move(B, 'd');
  await expect.poll(async () => (await mateX(A)) - bOnA, { timeout: 5_000 }).toBeGreaterThan(40);
  const aOnB = await mateX(B);
  await move(A, 'a');
  await expect.poll(async () => aOnB - (await mateX(B)), { timeout: 5_000 }).toBeGreaterThan(40);
  // Mobs come from the host to the guest.
  await expect.poll(() => B.page.evaluate(() => G.EnemyMgr.all().filter(e => e.remote).length), { timeout: 20_000 }).toBeGreaterThan(0);
  await A.page.waitForTimeout(500);
  await shot(A.page, 'online-coop-host.png');
  await shot(B.page, 'online-coop-guest.png');
  for (const p of [A, B]) { expect(p.w.external).toEqual([]); expect(p.w.errors).toEqual([]); }
});

test('moderation: a reported entry is removed by the moderator', async ({ browser }) => {
  test.setTimeout(300_000);
  const A = await newPlayer(browser, 'Suspect');
  const B = await newPlayer(browser, 'Reporter');
  const M = await newPlayer(browser, 'Moderator');
  await rankedRun(A, 'nether', 700);
  // B reports A's run from the leaderboard (this week's board).
  await B.page.click('#scr-menu [data-go=rank]');
  const row = B.page.locator('#rk-list .rk-row', { hasText: 'Suspect' });
  await row.waitFor({ timeout: 15_000 });
  B.page.once('dialog', d => d.accept());
  await row.locator('.rk-rep').click();
  await expect.poll(async () => (await listDocs('reports')).length, { timeout: 10_000 }).toBe(1);

  // M becomes the moderator: the online config's admins and the rules' admin() (make-rules.mjs).
  const testRules = readFileSync(path.join(ROOT, 'minecraft-survivor/server/.test/firestore.rules'), 'utf8');
  const modRules = path.join(ROOT, 'minecraft-survivor/server/.test/firestore.mod.rules');
  execFileSync(process.execPath, [path.join(ROOT, 'minecraft-survivor/server/make-rules.mjs'), '--admins', M.uid, '--out', modRules]);
  await setRules(readFileSync(modRules, 'utf8'));
  try {
    await M.page.evaluate(uid => { G.ONLINE.admins = [uid]; }, M.uid);
    await M.page.click('#scr-menu [data-go=rank]');
    await M.page.locator('#rk-mod:not(.hidden)').click();
    await M.page.locator(visible('scr-mod')).waitFor();
    const rep = M.page.locator('#mod-list .rk-row', { hasText: 'Suspect' });
    await expect(rep).toContainText('Floor 4 · The Nether');
    await rep.locator('button', { hasText: 'Delete entry' }).click();
    await expect(M.page.locator('#mod-list .rk-row', { hasText: 'Suspect' })).toHaveCount(0, { timeout: 15_000 });
    // Gone from this week's board (entry and summary row), and the report is dismissed.
    const week = (await listDocs('lbs')).find(d => d.id.startsWith('s_w'));
    expect(Object.values(week.top).some(v => v.uids.includes(A.uid))).toBe(false);
    expect(await getDoc(`lb/${week.id}/e/${A.uid}`)).toBeNull();
    expect(await listDocs('reports')).toEqual([]);
  } finally {
    await setRules(testRules);
  }
  for (const p of [A, B, M]) expect(p.w.errors).toEqual([]);
});

test('deleting an account removes its save, profile, friendships and leaderboard entries', async ({ browser }) => {
  test.setTimeout(300_000);
  const A = await newPlayer(browser, 'Leaver');
  const B = await newPlayer(browser, 'Stayer');
  // A has a friend, a public profile, a nickname and runs on every solo board.
  await A.page.evaluate(() => G.Social.request('Stayer'));
  await expect.poll(async () => (await listDocs('friendships')).length, { timeout: 10_000 }).toBe(1);
  await rankedRun(A, 'underworld', 500);
  await rankedRun(B, 'ocean', 450);
  expect((await entriesOf(A.uid)).length).toBeGreaterThanOrEqual(5);

  // Delete from the Legal notice (password confirmation), as a player would.
  await A.page.click('#credits-line [data-legal]');
  await A.page.click('#legal-delete');
  // The confirmation dialog (js/ui/ui.js confirmDelete) is the last section added to the page.
  const dlg = A.page.locator('section.scr:not([id])').last();
  await dlg.locator('input[type=password]').fill(PASS);
  await dlg.locator('[data-a=yes]').click();
  await A.page.locator(visible('scr-login')).waitFor({ timeout: 30_000 });

  expect(await authUsers()).toEqual([B.uid]);
  expect(await getDoc(`saves/${A.uid}`)).toBeNull();
  expect(await getDoc(`profiles/${A.uid}`)).toBeNull();
  expect(await getDoc('names/leaver')).toBeNull();
  expect(await getDoc(`runs/${A.uid}`)).toBeNull();
  expect(await getDoc(`pres/${A.uid}`)).toBeNull();
  expect(await listDocs('friendships')).toEqual([]);
  expect(await entriesOf(A.uid)).toEqual([]);
  for (const d of await listDocs('lbs')) expect(Object.values(d.top || {}).some(v => v.uids.includes(A.uid)), d.id).toBe(false);
  // B's entries stay.
  expect((await entriesOf(B.uid)).length).toBeGreaterThanOrEqual(5);
  expect(await getDoc(`lb/s_all/e/${B.uid}`)).not.toBeNull();
  for (const p of [A, B]) expect(p.w.errors).toEqual([]);
});

/**
 * Two friends in a co-op room, both in the Overworld: host `A` invited guest `B` (the same flow as the
 * friends test, through the game's API where the UI isn't the point).
 */
async function coopPair(browser, hostName, guestName) {
  const A = await newPlayer(browser, hostName);
  const B = await newPlayer(browser, guestName);
  await A.page.evaluate(n => G.Social.request(n), guestName);
  await B.page.click('#scr-menu [data-go=friends]');
  const req = B.page.locator('#fr-list .fr-row', { hasText: hostName });
  await expect(req).toContainText('Wants to be your friend', { timeout: 15_000 });
  await req.locator('button', { hasText: 'Accept' }).click();
  await expect(B.page.locator('#fr-msg')).toContainText('now friends');
  await A.page.click('#scr-menu [data-go=friends]');
  const row = A.page.locator('#fr-list .fr-row', { hasText: guestName });
  await expect.poll(async () => {
    await B.page.evaluate(() => G.Social.refreshPresence(true));
    await A.page.evaluate(() => G.Social.refreshPresence(true));
    return row.locator('.dot.on').count();
  }, { timeout: 30_000 }).toBe(1);
  await row.locator('button', { hasText: 'Invite' }).click();
  await A.page.locator(visible('scr-lobby')).waitFor();
  await B.page.locator(visible('invite-pop')).waitFor({ timeout: 20_000 });
  await B.page.click('#inv-yes');
  await B.page.locator(visible('scr-lobby')).waitFor();
  await expect(A.page.locator('#lobby-members .conn', { hasText: 'Connected' })).toHaveCount(1, { timeout: 30_000 });
  await A.page.click('#lobby-start');
  for (const p of [A, B]) await p.page.waitForFunction(() => G.Game.state === 'playing' && G.Coop.active, null, { timeout: 20_000 });
  return [A, B];
}

test('co-op climb: two players travel every floor together, goals and rewards synced', async ({ browser }) => {
  test.setTimeout(900_000);
  const [A, B] = await coopPair(browser, 'ClimbHost', 'ClimbGuest');
  const H = A.page, Gp = B.page;
  const both = (fn, arg) => Promise.all([H.evaluate(fn, arg), Gp.evaluate(fn, arg)]);
  // Nobody can be hurt; the clock at minute 3. Partners are whatever the personality test gave.
  await both(() => { G.Game.player.hurt = () => 0; });
  await H.evaluate(() => G.Game.debugTime(180));
  const partners = await both(() => G.Game.player.dex);

  /** Waits for fn() on `page`, answering level-up and item cards on both pages on the way. */
  const until = async (page, fn, arg, ms = 30_000) => {
    const t0 = Date.now();
    for (;;) {
      if (await page.evaluate(fn, arg)) return;
      if (Date.now() - t0 > ms) {
        const st = await Promise.all([H, Gp].map(p => p.evaluate(() => ({ state: G.Game.state, dim: G.Floors.dim, idx: G.Floors.index,
          portal: G.Floors.portal && G.Floors.portal.kind, travel: G.Floors.traveling, coop: G.Coop.active }))));
        throw new Error('timed out waiting for ' + fn.toString() + ' · ' + JSON.stringify(st));
      }
      for (const p of [H, Gp]) if (['levelup', 'choice'].includes(await p.evaluate(() => G.Game.state))) await p.keyboard.press('1');
      // A Combo offer (two skills to link) holds the whole team until it's answered: take the first card.
      for (const p of [H, Gp]) for (let k = 0; k < 3 && await p.locator('#scr-bond:not(.hidden) #bond-cards > *').count(); k++)
        await p.locator('#scr-bond:not(.hidden) #bond-cards > *').first().click();
      await H.waitForTimeout(150);
    }
  };
  const shots = async tag => {
    await H.waitForTimeout(700);
    await shot(H, `coop-${tag}-host.png`);
    await shot(Gp, `coop-${tag}-guest.png`);
  };
  const killFloorBoss = () => H.evaluate(() => { const e = G.EnemyMgr.all().find(x => x.floorBoss && !x.dead); e.hidden = false; e.hp = 0; e.die(); });
  /** The portal opens for both; `who` (H or Gp) walks in; both land on `next` (same floor index, same world). */
  async function travel(kind, next, who) {
    await until(Gp, k => !!G.Floors.portal && G.Floors.portal.kind === k, kind);
    await until(H, k => !!G.Floors.portal && G.Floors.portal.kind === k, kind);
    const [ph, pg] = await both(() => [Math.round(G.Floors.portal.x), Math.round(G.Floors.portal.y)]);
    expect(Math.hypot(ph[0] - pg[0], ph[1] - pg[1])).toBeLessThan(40);         // the same portal, the same place
    await until(who, d => {
      const pl = G.Game.player, P = G.Floors.portal;
      if (P && !G.Floors.traveling) { pl.x = P.x; pl.y = P.y; }
      return G.Floors.dim === d && !G.Floors.traveling;
    }, next);
    await until(H, d => G.Floors.dim === d && !G.Floors.traveling, next);
    await until(Gp, d => G.Floors.dim === d && !G.Floors.traveling, next);
    const at = await both(() => [G.Floors.index, G.World.dimension, Math.round(G.Game.player.x), Math.round(G.Game.player.y)]);
    expect(at[1][0]).toBe(at[0][0]);
    expect(at[1][1]).toBe(next);
    // Both land by the arrival point, side by side.
    expect(Math.hypot(at[0][2] - at[1][2], at[0][3] - at[1][3])).toBeLessThan(120);
  }

  // ---- A book the guest picks up goes to the guest's save, not the host's.
  const books0 = await both(() => G.DB.save.stats.books || 0);
  await H.evaluate(() => {
    const pl = G.Game.player, m = G.Coop.mates[0].pl;
    pl.x -= 600;                                         // the host walks off; the book lands at the guest's feet
    G.Pickups.drop('book', m.x, m.y, 'sharpness:2');
  });
  await until(Gp, n => (G.DB.save.stats.books || 0) > n, books0[1]);
  const lib = await both(() => [G.DB.save.stats.books || 0, ((G.DB.save.books || {}).sharpness || [])[1] || 0, G.Game.player.books.length]);
  expect(lib[1]).toEqual([books0[1] + 1, 1, 1]);
  expect(lib[0][0]).toBe(books0[0]);
  expect(lib[0][2]).toBe(0);
  await H.evaluate(() => { G.Game.player.x += 600; });

  // ---- 1. Overworld: the Raid. The guest sees the Ravager as the floor boss, and its band.
  await H.evaluate(() => G.Game.debugBoss('floor'));
  await until(Gp, () => G.EnemyMgr.all().some(e => e.floorBoss && G.DEX_BY[e.dex].key === 'ravager') &&
    G.EnemyMgr.all().filter(e => e.raider).length >= 5);
  await shots('overworld-raid');
  await killFloorBoss();
  await travel('dive', 'ocean', Gp);                        // the guest steps in first: the whole team goes

  // ---- 2. The Ocean: the guest's distance wakes the Elder Guardians; the guest sees them asleep, then awake, and the count.
  await until(Gp, () => G.Floors.elders && G.Floors.elders.n === 3 && G.Floors.elders.list.length === 3);
  const asleep = await Gp.evaluate(() => { const E = G.Floors.elders; return { left: E.left, awake: E.awake, dormant: E.list.every(e => e.dormant), home: E.home }; });
  expect(asleep).toMatchObject({ left: 3, awake: false, dormant: true });
  expect(asleep.home).toBeTruthy();
  await shots('ocean-asleep');
  await H.evaluate(() => { const pl = G.Game.player; pl.x = -3000; pl.y = -3000; });     // the host far from the monument
  await until(Gp, () => { const pl = G.Game.player, M = G.Floors.elders.home; pl.x = M.x; pl.y = M.y; return G.Floors.elders.awake; });
  expect(await H.evaluate(() => G.Floors.elders.awake)).toBe(true);
  await until(Gp, () => G.Floors.elders.list.every(e => !e.dormant));
  for (let i = 3; i >= 1; i--) {
    await until(Gp, n => G.Floors.elders.left === n, i);
    await H.evaluate(() => { const e = G.Floors.elders.list[0]; e.hp = 0; e.die(); });
  }
  await until(Gp, () => G.Floors.elders.left === 0);
  await H.evaluate(() => { const pl = G.Game.player; pl.x = 0; pl.y = 0; });
  await travel('cave', 'underworld', H);

  // ---- 3. Underworld: the Ominous Breeze hunts the guest when the guest is the one nearby, and the guest sees its attacks.
  await H.evaluate(() => G.Game.debugBoss('floor'));
  await until(Gp, () => G.EnemyMgr.all().some(e => e.floorBoss && e.ominous && e.name === 'Ominous Breeze'));
  await H.evaluate(() => { const pl = G.Game.player; pl.x += 2500; });
  await until(H, uid => {
    const e = G.EnemyMgr.all().find(x => x.floorBoss), m = G.Coop.mates[0].pl;
    e.x = m.x + 160; e.y = m.y;
    return e.kitTarget && e.kitTarget.uid === uid;
  }, B.uid);
  await until(Gp, () => G.Projectiles.all().some(p => !p.friendly) || G.Hazards.count > 0, null, 20_000);
  await killFloorBoss();
  await H.evaluate(() => { const pl = G.Game.player, m = G.Coop.mates[0].pl; pl.x = m.x; pl.y = m.y; });
  await travel('nether', 'nether', Gp);

  // ---- 4. Nether: the Wither.
  await H.evaluate(() => G.Game.debugBoss('floor'));
  await until(Gp, () => G.EnemyMgr.all().some(e => e.floorBoss && G.DEX_BY[e.dex].key === 'wither'));
  await killFloorBoss();
  await travel('stronghold', 'stronghold', H);

  // ---- 5. Stronghold: the guest alone in the portal room fills the bar; the guest sees it fill.
  await H.evaluate(() => { G.Floors.debugRoom(); const pl = G.Game.player; pl.x += 2000; });
  await until(Gp, () => G.Floors.room && G.Floors.room.eye);
  const held0 = await H.evaluate(() => G.Floors.room.held);
  await until(Gp, () => { const pl = G.Game.player, r = G.Floors.room; pl.x = r.x; pl.y = r.y; return r.inside && r.held > 1.5; });
  expect(await H.evaluate(() => G.Floors.room.held)).toBeGreaterThan(held0 + 1);
  await shots('stronghold-room');
  await H.evaluate(() => G.Floors.debugRoom(true));
  await Gp.evaluate(() => { G.Game.player.x += 300; });
  await H.evaluate(() => { const pl = G.Game.player, m = G.Coop.mates[0].pl; pl.x = m.x; pl.y = m.y; });
  await travel('end', 'end', H);

  // ---- 6. The End: crystals (not endermites) with the dragon's shield on the guest; a guest's hit breaks one.
  await until(H, () => G.EndFight.left > 0);
  await H.evaluate(() => G.Game.debugBoss('floor'));
  const n0 = await H.evaluate(() => G.EndFight.left);
  await until(Gp, n => G.EndFight.left === n && G.EnemyMgr.all().some(e => e.floorBoss && G.DEX_BY[e.dex].key === 'ender_dragon'), n0);
  const endG = await Gp.evaluate(() => {
    const d = G.EnemyMgr.all().find(e => e.floorBoss), c = G.EndFight.crystals;
    return { shielded: G.EndFight.shielded(d), crystals: c.every(x => x.crystal && x.remote && x.top), name: c[0].name };
  });
  expect(endG).toEqual({ shielded: true, crystals: true, name: 'End Crystal' });
  await Gp.evaluate(() => { const c = G.EndFight.crystals.find(x => !x.broken), pl = G.Game.player; pl.x = c.x; pl.y = c.y + 60; });
  await shots('end-crystals');
  await Gp.evaluate(() => { const c = G.EndFight.crystals.find(x => !x.broken); c.hurt(c.maxHp * 3); });
  await until(H, n => G.EndFight.left === n - 1, n0);
  await until(Gp, n => G.EndFight.left === n - 1, n0);
  await H.evaluate(() => G.EndFight.debugBreakAll());
  await until(Gp, () => G.EndFight.left === 0 && !G.EndFight.shielded(G.EnemyMgr.all().find(e => e.floorBoss)));
  const slay0 = await both(() => !!(G.DB.save.slayer || {})[G.Game.player.dex]);
  expect(slay0).toEqual([false, false]);
  await killFloorBoss();
  // The Ender Dragon unlocks enchanting for EVERY player's own partner.
  await until(Gp, () => !!(G.DB.save.slayer || {})[G.Game.player.dex]);
  expect(await H.evaluate(() => !!G.DB.save.slayer[G.Game.player.dex])).toBe(true);
  await H.evaluate(() => { const pl = G.Game.player, m = G.Coop.mates[0].pl; pl.x = m.x; pl.y = m.y; });
  await travel('gateway', 'ancient_city', Gp);

  // ---- 7. Ancient City: a guest breaking sculk counts; the warning level, its HUD and Darkness reach the guest.
  const sculk = await Gp.evaluate(() => {
    const pl = G.Game.player, re = /sculk|shriek|sensor/i;
    const isS = p => re.test([p.type, p.kind, p.name, p.key, p.tex, p.obj && p.obj.kind, p.obj && p.obj.top, p.obj && p.obj.side].filter(v => typeof v === 'string').join(' '));
    const p = G.World.propsInCircle(pl.x, pl.y, 900).find(o => isS(o) && o.destructible);
    if (p) { pl.x = p.x; pl.y = p.y + 30; G.World.damageProp(p, 1e9); return 'prop'; }
    G.Floors.sculkBroken(pl.x, pl.y);                     // (no sculk prop in reach: what the world's hook calls)
    return 'hook';
  });
  console.log('sculk broken by the guest via', sculk);
  await until(H, () => G.Floors.warning.level === 1);
  await until(Gp, () => G.Floors.warning.level === 1 && !!G.Game.player.fx.darkness);
  await H.evaluate(() => { G.Floors.debugWarn(); G.Floors.debugWarn(); });
  await until(Gp, () => G.Floors.warning.level === 3 && !!G.Game.player.fx.darkness);
  await shots('ancient-warning');
  await H.evaluate(() => G.Floors.debugWarn());
  await until(Gp, () => G.Floors.warning.level === 4 && G.EnemyMgr.all().some(e => e.floorBoss && G.DEX_BY[e.dex].key === 'warden'));
  await until(H, () => !G.EnemyMgr.all().find(x => x.floorBoss).hidden);
  await killFloorBoss();
  await H.evaluate(() => { const pl = G.Game.player, m = G.Coop.mates[0].pl; pl.x = m.x; pl.y = m.y; });
  await travel('ancient', 'herobrine', H);

  // ---- 8. Herobrine's World: the guest sees Herobrine, the countdown and the glowstone portal; the guest walks the team in.
  await backdate(A.uid);                                     // (the leaderboard: the run "has lasted" long enough)
  await H.evaluate(() => G.Game.debugTime(1300));
  await until(Gp, () => G.Judgment.active && !G.Judgment.cinematic && !!G.Judgment.herobrine, null, 40_000);
  const hero = await Gp.evaluate(() => ({ a: G.Floors.aether, dim: G.Floors.dim }));
  expect(hero.dim).toBe('herobrine');
  expect(hero.a.left).toBeGreaterThan(60);
  expect(hero.a.left).toBeLessThan(150);
  // (No stale banner from an earlier floor.)
  for (const p of [H, Gp]) expect(await p.evaluate(() => [G.Floors.banner, ...[]].filter(Boolean).map(b => b.title).join())).not.toContain('Gateway');
  await shots('herobrine');
  await H.evaluate(() => G.Floors.debugWinHerobrine());
  await until(Gp, () => G.Floors.aether.building);
  await until(Gp, () => G.Floors.aether.ready, null, 15_000);
  await shots('herobrine-portal');
  const before = await both(() => ({ coins: G.DB.save.coins, t10: (G.DB.save.tickets || {}).t10 || 0, books: G.DB.save.stats.books || 0 }));
  await travel('aether', 'aether', Gp);

  // ---- The Aether: peaceful for everyone, and every player gets the rewards on their own save.
  const ae = await both(() => {
    const s = G.DB.save, pl = G.Game.player;
    return { peaceful: G.Floors.peaceful, active: G.Aether.active, judge: G.Judgment.active, r: !!G.Aether.rewards,
             coins: s.coins, t10: s.tickets.t10, books: s.stats.books, asc: !!(s.ascended || {})[pl.dex], aether: s.stats.aether,
             mobs: G.DEX.filter(p => p.gen === 8 && G.SPRITE_META[p.dex]).every(p => s.owned[p.dex]), partner: pl.dex };
  });
  for (let i = 0; i < 2; i++) {
    expect(ae[i]).toMatchObject({ peaceful: true, active: true, judge: false, r: true, asc: true, aether: 1, mobs: true, partner: partners[i] });
    expect(ae[i].coins).toBeGreaterThanOrEqual(before[i].coins + 1000);
    expect(ae[i].t10).toBeGreaterThanOrEqual(before[i].t10 + 3);
    expect(ae[i].books).toBeGreaterThanOrEqual(before[i].books + 1);
  }
  await shots('aether');
  // The host rests: the victory for the whole team.
  await until(H, () => G.Aether.time > G.Aether.REST_AT);
  await H.keyboard.press('r');
  await until(H, () => G.Aether.ending);
  await H.evaluate(() => G.Aether.debugSkipText());
  for (const p of [H, Gp]) {
    await p.locator(visible('scr-over')).waitFor({ timeout: 20_000 });
    expect(await p.locator('#over-title').textContent()).toBe('YOU REACHED THE AETHER');
    expect(await p.locator('#scr-over').getAttribute('class')).toContain('victory');
    await expect(p.locator('#over-stats')).toContainText('The Aether · the end of the climb');
  }
  await shots('victory');
  // Floor-reached achievements on the guest too, and the co-op leaderboard entry with the team's floor.
  const ach = await Gp.evaluate(() => Object.keys(G.DB.save.ach || {}));
  for (const a of ['dimOcean', 'dimNether', 'dimEnd', 'dimAncient', 'freeEnd', 'aether1']) expect(ach).toContain(a);
  const id = [A.uid, B.uid].sort().join('_');
  await expect.poll(async () => (await getDoc(`lb/g_all/e/${id}`) || {}).f, { timeout: 20_000 }).toBe(8);
  for (const p of [A, B]) { expect(p.w.external).toEqual([]); expect(p.w.errors).toEqual([]); }
});
