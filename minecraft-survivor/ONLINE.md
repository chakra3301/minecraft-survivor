# Minecraft Survivor online

The online site (planned at **minersurvivor.com**, on Cloudflare Pages) adds accounts and cloud saves, a leaderboard, friends and co-op invites. It runs on the owner's own Firebase project **`minecraft-survivor`** on the free Spark plan: no Cloud Functions, no Firebase Hosting, no Storage.

The private build doesn't change. `node tools/build.mjs minecraft-survivor` still produces the offline game, with `G.FIREBASE_CONFIG = null` and the CSP limited to `'self'`. Everything online comes from one extra file, `js/online-config.js`, which only the online build writes.

**Never** point anything at PokéSurvivor's servers: not its Firebase project, its TURN Worker (`turn.pokesurvivor.com`) or its domains. The build refuses a config that mentions them, and checks that the output doesn't name their URLs.

## Files

| Path | What |
|---|---|
| `online.config.json` | **The config.** The Firebase web config and the online settings (below). Not a secret: the security rules protect the data. |
| `server/online.config.example.json` | Template for it. |
| `server/firestore.rules` | Firestore rules: saves, nicknames, profiles, friends, presence, invites, leaderboard, reports. The blocks `<admins>` and `<achievements>` are generated. |
| `server/database.rules.json` | Realtime Database rules: co-op rooms and WebRTC signalling (`rooms/{id}`). |
| `server/firestore.indexes.json` | The `uids` array index on the leaderboard entries (`e`), also as a collection group (account deletion). |
| `server/firebase.json` | Rules files and the emulators (auth 9099, firestore 8080, database 9000; hub 4387, logging 4388). |
| `server/make-rules.mjs` | Writes the moderator uids and the achievements' rewards into `firestore.rules`. |
| `server/package.json` | `firebase-tools` (CLI and emulators) and `firebase` 13.0.0 (the web SDK the site self-hosts). Run `npm install` here once. |
| `server/test-online.sh` | One command for the online tests. |
| `server/playwright.online.config.mjs` | Their Playwright config. The site is served on 127.0.0.1:4385. |
| `tools/web/build-public.mjs` | Builds the online site. |
| `tools/web/serve-public.mjs` | Serves a built site locally, with its CSP. |
| `tools/web/online-config.mjs`, `tools/web/game-data.mjs` | Read and check the config; load the game data headlessly. |
| `../tests/minecraft-survivor-online.spec.mjs` | The online tests. `npm test` skips them; they need the emulators. |

## The config: `minecraft-survivor/online.config.json`

```json
{
  "firebase": {
    "apiKey": "…", "authDomain": "minecraft-survivor.firebaseapp.com",
    "databaseURL": "https://minecraft-survivor-default-rtdb.firebaseio.com",
    "projectId": "minecraft-survivor", "storageBucket": "minecraft-survivor.firebasestorage.app",
    "messagingSenderId": "…", "appId": "…"
  },
  "admins": [],
  "allowGoogleSignIn": true,
  "turnUrl": "",
  "timeZone": "UTC"
}
```

- **`firebase`**: paste the web app config from the Firebase console (Project settings → General → Your apps → SDK setup and configuration → Config) as it is. `databaseURL` is required, because co-op rooms use the Realtime Database. A bare config object with `apiKey` at the top level also works, so `--config artifacts/online/firebase-web-config.json` builds too, with the defaults below.
- **`admins`**: moderator uids. They see the **Moderation** button on the leaderboard (reports, delete entries, ban/unflag accounts) and may use the dev panel online. The same list goes into the rules (`make-rules.mjs`). After changing it, **deploy the rules and rebuild the site**.
- **`allowGoogleSignIn`**: shows "Sign in with Google" and opens the CSP for it. The default is `false`.
- **`turnUrl`**: optional TURN Worker of our own (`https://…/`, answering `{ iceServers, ttl }` to a Firebase ID token), for players whose networks block direct WebRTC. Empty means off: co-op uses public STUN only, and the few players behind strict NATs can't connect.
- **`timeZone`**: when daily, weekly and monthly boards roll over (IANA name). The default is `UTC`.
- `nameDomain` (optional, leave the default): the fake email domain used for name + password accounts (`<hex of name>@players.minecraft-survivor.invalid`). **Never change it after launch.** Existing accounts log in with it.

## Build the public site

```sh
cd minecraft-survivor/server && npm install && cd ../..          # once
node minecraft-survivor/tools/web/build-public.mjs --config minecraft-survivor/online.config.json
#   → minecraft-survivor/dist-public   (gitignored; ~100 MB, ~5,500 files)
node minecraft-survivor/tools/web/serve-public.mjs minecraft-survivor/dist-public --port 4385   # look at it locally
```

Opening the real build at `127.0.0.1:4385` talks to the real Firebase project, so use the emulator build for local testing. The real build is for deploying.

What the build does:
1. Runs the private build (`tools/build.mjs minecraft-survivor`).
2. Copies it without `dev.html`. The Minecraft soundtrack in `assets/music/` (imported from the owner's install) is published too, by the owner's decision; it streams one track at a time and the service worker never caches it. `--no-music` leaves it out and the site plays the synthesized music.
3. Self-hosts the Firebase SDK in `js/vendor/firebase/` (compat 13.0.0, Apache-2.0), so there are no gstatic requests.
4. Writes `js/online-config.js` (`G.ONLINE`, with `firebase` in it), loaded before the bundle.
5. Writes the CSP into every page and into `_headers` (Cloudflare Pages). It's opened only for `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firestore.googleapis.com` and your RTDB host (`https`/`wss`, plus `*.firebaseio.com` shards). With Google sign-in it adds `apis.google.com`, `www.googleapis.com`, `accounts.google.com` and the `authDomain` frame; with `turnUrl`, its origin.
6. Gives the service worker its own caches (`mcsweb-code-…`, `mcsweb-art-…`).
7. Makes the site indexable (`robots.txt` Allow). Pass `--noindex` to keep it hidden.

Other flags:
- `--out <dir>` (inside `minecraft-survivor/`)
- `--admins uid,uid` (overrides the config)
- `--google` (turns Google sign-in on)
- `--emulator` (below)

## Test locally against the Firebase emulators

```sh
minecraft-survivor/server/test-online.sh            # everything (~4 min)
minecraft-survivor/server/test-online.sh -g friends # one test
```

It needs Java (`/opt/homebrew/opt/openjdk/bin` is put on PATH) and Node. It:
- writes the rules with the moderator `test-moderator` into `server/.test/`;
- builds `dist-emulator` (`--emulator`: project `demo-minecraft-survivor`, which never touches a real project; no STUN servers; Google sign-in shown);
- starts the emulators;
- runs the spec against the site on `127.0.0.1:4385`.

Each test wipes the emulators through their REST APIs. Screenshots go to `artifacts/online/`. Apart from the one-time download of the emulator jars, nothing leaves the machine; the spec fails if a page makes any request outside `127.0.0.1`.

To play with it by hand:

```sh
cd minecraft-survivor/server && PATH="/opt/homebrew/opt/openjdk/bin:$PATH" npx firebase emulators:start --project demo-minecraft-survivor
node minecraft-survivor/tools/web/build-public.mjs --emulator && node minecraft-survivor/tools/web/serve-public.mjs minecraft-survivor/dist-emulator --port 4385
```

## Going live (the owner)

Already done: project `minecraft-survivor`; Authentication with Email/Password and Google; Firestore (`nam5`); Realtime Database (`us-central1`, `https://minecraft-survivor-default-rtdb.firebaseio.com`); the web app config (now in `online.config.json`). Both databases are still locked, and nothing is deployed.

### 1. Firebase console

1. **Authentication → Settings → Authorized domains → Add domain**:
   - `minersurvivor.com`
   - `www.minersurvivor.com`
   - your Pages preview domain (e.g. `minecraft-survivor.pages.dev`)

   `localhost` is there by default. Google sign-in fails with `auth/unauthorized-domain` until the site's domain is listed.
2. **Authentication → Settings → User actions**: keep **Enable create (sign-up)** on. There is no monthly cap and no blocking function.
3. **Authentication → Sign-in method → Google**: set the project support email if it asks.
4. **Authentication → Sign-in method → Email/Password**: leave **Email link (passwordless)** off. Names are turned into internal emails that receive nothing.
5. Don't enable Functions, Storage, Hosting or App Check. Stay on **Spark**.
6. Optional hardening, in **Google Cloud console → APIs & Services → Credentials → Browser key (auto created by Firebase) → Application restrictions → Websites**: add `https://minersurvivor.com/*`, `https://*.minersurvivor.com/*` and `https://minecraft-survivor.pages.dev/*`. Keep `http://localhost/*` and `http://127.0.0.1/*` if you'll test the real build locally.

### 2. Deploy the rules (once, and after every change to rules or admins)

```sh
cd minecraft-survivor/server
npm install                       # once
npx firebase login                # once, with the owner's Google account
node make-rules.mjs               # moderators from ../online.config.json + achievement rewards
npx firebase deploy --only firestore:rules,firestore:indexes,database --project minecraft-survivor
```

This unlocks exactly what the game needs. Check it in **Firestore → Rules** and **Realtime Database → Rules**. Re-run `make-rules.mjs` and deploy again whenever achievements change.

### 3. Moderator

1. Sign up on the live site.
2. Copy your **User UID** from **Authentication → Users**.
3. Put it in `admins` in `online.config.json`.
4. Run `node make-rules.mjs`, deploy the rules (step 2) and rebuild and redeploy the site (step 4).

### 4. Cloudflare (minersurvivor.com)

Assets are generated locally from `vendor/` (gitignored), so deploy the built folder, not from Git.

**Workers static assets (already set up):** `deploy/wrangler.jsonc` (Worker `minecraft-survivor`, custom domains minersurvivor.com and www) serves `deploy/coming-soon/` today. To go live:
1. Build the site.
2. Set `"assets": { "directory": "../dist-public", … }`.
3. Run `cd minecraft-survivor/deploy && npx wrangler@latest deploy`.

Workers static assets read the same `_headers` file (the CSP) and have the same limits: 20,000 files and 25 MiB per file on the free plan.

**Or Cloudflare Pages, by Direct Upload:**

```sh
node minecraft-survivor/tools/web/build-public.mjs --config minecraft-survivor/online.config.json
npx wrangler pages deploy minecraft-survivor/dist-public --project-name minecraft-survivor   # or drag dist-public into Workers & Pages → Create → Pages → Upload assets
```

With Pages, go to **Workers & Pages → <project> → Custom domains** and add `minersurvivor.com` (and `www.minersurvivor.com`). The custom domains can sit on only one of the two (Worker or Pages). Either way, the `_headers` file carries the CSP. Rebuild and redeploy after every game change. `version.json` makes open tabs offer the update.

**Google sign-in on a custom domain:** the popup runs on `minecraft-survivor.firebaseapp.com`, a different site from minersurvivor.com. That works in Chrome, Edge and Firefox, but browsers that block third-party storage (Safari) can fail it. The fix is to serve `/__/auth/*` from your own domain (a small Cloudflare Worker proxying to `minecraft-survivor.firebaseapp.com/__/auth/`) and set `authDomain` to `minersurvivor.com`. Name + password accounts aren't affected.

## What's online, and how it's protected

- **Accounts:** a name + password (6+ characters), or Google when `allowGoogleSignIn` is on. A name is also the player's unique nickname. Sign-ups are always open (`js/net/signups.js` contacts nothing).
- **Cloud saves** (`saves/{uid}`, `js/core/db.js`): a copy is kept in the browser and merged with the cloud copy (collections are unioned, nothing is lost). Uploads happen at most every 30 min, after 3 min for purchases, and when the tab is hidden. The rules accept a save only if what it gained since the last one could be earned in that time. That covers mobs, Enchanted mobs, emeralds, Trial and Ominous Keys, achievements (each achievement's reward comes from `js/data/achievements.js`), missions, and Aether arrivals (at most one per 15 minutes of account age, each worth 3 Ominous Keys + 1,000 emeralds). `slayer`, `ascended` and `ach` can only grow; `books`, `ench` and `ascended` are bounded. An impossible save isn't lost. It's retried after 2 and 6 minutes, then uploaded flagged (`sus`), which keeps the account off the leaderboard until a moderator unflags it.
- **Leaderboard** (`js/net/ranking.js`, `js/ui/ranking-ui.js`):
  - **Boards:** Solo and Co-op (2–4 players; the host posts), each for Today, This week, This month and All-time, plus all-time per mob.
  - **Ranking:** by the **deepest floor** (0 Overworld … 7 Herobrine's World, 8 the Aether), then time. On floors 1–8, longer survival is better. In the Aether, the time is when you arrived, and faster is better. Both fold into one score: `s = f × 100000 + (f = 8 ? 99999 − t : t)`.
  - **Rows:** each shows the characters' sprites, names, mob, level, mobs defeated, the floor (in its colour) and the time.
  - **Anti-cheat** (`validEntry`):
    - the time can't exceed the server-measured time since the run started (+30 s), and at most 3 h;
    - the floor must be reachable in that time: at least 320 s for the Ocean and the Underworld, 590 the Nether, 920 the Stronghold, 990 The End, 1005 the Ancient City, 1025 Herobrine's World and 1160 the Aether. These are the earliest boss and goal times in `js/data/dimensions.js` minus about 10%;
    - level ≤ 10 + t/4, mobs defeated ≤ 100 + 12·t;
    - the score must match the floor and time;
    - the account must not be flagged;
    - an entry can only improve.
  - **Dev panel:** runs where the dev panel was used never post. Online, the panel exists only for moderators and on the emulators.
- **Reports and moderation:** any player can flag an entry. Moderators review reports, delete entries everywhere, ban (flag) accounts and unflag them.
- **Friends:**
  - **Requests and accepting:** by exact nickname.
  - **Presence:** a Firestore heartbeat every 15 min, written only once you have a friend.
  - **Invites:** invites go only to confirmed friends and expire after 3 min. Co-op rooms live in the Realtime Database only while you're in one; the free plan allows 100 simultaneous connections.
- **Co-op:**
  - **Connection:** WebRTC data channels, signalled through `rooms/{id}/q`. Up to 4 players; the host runs the mobs.
  - **Relay:** no database relay (it's costly). Without a direct path or TURN, a pair can't play together.
- **Account deletion** (Settings → Account, or Legal notice): it asks for the password, then deletes:
  - friendships, invites, presence;
  - every leaderboard entry and top-50 row;
  - the run marker, the nickname and profile, the save;
  - the Firebase user.

## Co-op across floors

PokéSurvivor's co-op knew one map. Minecraft Survivor's floor systems run on the **host** (`authority()`), and since 2026-10-14 the host tells the guests about every one of them, so a 2–4 player run climbs all 8 floors and the Aether together. Tested end to end by the online spec's **co-op climb** test (below).

### How it works

- **Travel** (`js/systems/floors.js`): the host decides. When **any living player** stands in an open, armed portal (`steppedIn`), the host plays the portal fade and sends `'tv'`, then runs `go(i)`, which sends `'fl' i` first. Each guest runs the same `go(i)`: the world is deterministic (`setDimension(seed + i*7919)` with the shared `coop.seed`), so terrain, portals, the monument, towers and the Ancient City frame match. Everyone lands in their **team slot** by the arrival point (`G.Coop.slot`, the same on every computer). A **downed player stands up** on arrival (half health). If a `'fl'` were ever missed, the floor index in every host frame (`fs[0]`) makes the guest follow.
- **Portals**: `openPortal`, the Stronghold's room and the Aether portal send `'po' kind x y mode`; the guest opens the same portal on the same tile, so it sees it and its HUD arrow.
- **Banners**: every floor title the team should see (boss arrivals, "THE MONUMENT IS SILENT", portals opening, sea battles) goes out as `'bn'` (`shout()` instead of `banner()`).
- **Floor state in every host frame** (`f.fs = G.Floors.netState()`): `[floor, floor clock, warning level, next shriek, Elder Guardians [n, left, awake] | 0, portal room [held, eye, inside, done] | 0]`. The guests' HUD (warning icons, elders counter, hold bar, Herobrine countdown, next-boss timers) reads it.
- **Enemy roles**: `'ne'` now carries flags (`dormant, elder, floorBoss, midBoss, crystal, judge, legend, ominous, captain, raider, patrol, seaPatrol`), the mob's own name (Drowned Captain, Ominous Breeze, Pillager Captain) and, for an End Crystal, its tower top. `'ef'` updates them (and the max health) when they change after spawning. Frames carry `hidden` (a burrowed Warden) and `dormant` (sleeping Elder Guardians) bits.
- **Bosses target any player** (`js/systems/bosskits.js`): `EnemyMgr.update` already hands each enemy its nearest living player; kits now keep it (`e.kitTarget`) instead of locking onto the host at spawn (`ensure` → `target(e)`). Effects a kit puts on a guest's copy (`Player.addEffect` / `pushBy` on a `remote` player: Darkness, Mining Fatigue, Slowness, Dolphin's Grace…) are forwarded to that guest (`'pfx'` / `'ppb'`, at most once a second per effect). Telegraphs reach guests as `'hz'` with their linger cloud and what the hit does (`onHit.net`: knockback away from a point, an effect); tracking ones (Sonic Boom, the Elder Guardian's laser) are re-sent while they aim (`'hzu'`). Every kit shot goes out as `'es'` with its look, homing, size, on-hit ops and whom it hunts. On the host, an enemy shot that reaches a mate bursts there (its explosion included).

### Floor goals

- **Raid** (Overworld): the Ravager arrives flagged as the floor boss, with its band; the guests see the boss bar, banner and music.
- **The Ocean**: any living player within 420 px of the monument wakes the Elder Guardians. Guests see them asleep (no bar, no boss music) and awake (`'ew'`), with the counter and the arrow. A guest hitting a sleeping copy sends the hit; the host wakes them.
- **Stronghold**: anyone standing in the portal room fills the bar; guests see the Eye of Ender arrow, the ring and the bar.
- **The End**: guests get the crystals as crystals (`G.EndFight.addRemote`): on their towers, with the healing beams, the dragon's shield shimmer, "INVULNERABLE · … (n left)", the arrow and the count. A guest's hit on a crystal goes to the host; the host's broken crystals break on the guests (no kill counted); the blast hurts guests through its hazard. A guest's hit on the shielded dragon bounces off locally too.
- **Ancient City**: shrieks (`'sk'`) give guests the warning level, the shriek effects and Darkness (forwarded on their copy). A guest breaking sculk sends `'sc'` and the shriekers answer. The Warden digs up next to a random living player.
- **Herobrine's World**: unchanged sync of Herobrine (`'jd'`, `'jk'`, `ja`) now that guests get there; the countdown comes from the floor clock in `fs`; the glowstone portal builds at the same spot for everyone (`'po' … 2`); anyone stepping in takes the team to the Aether.
- **The Aether**: each computer runs `G.Aether.enter`, so each player gets the rewards **on their own save**: 1,000 emeralds, 3 Ominous Keys, the max-level book, the Ascended halo on **their own partner**, `stats.aether`, and the Aether mobs. Nothing hurts anyone. When the **host rests**, the run ends as a **victory for everyone** (`'ov'` with `vic`); a guest who rests leaves with their own victory summary while the others stay.

### Rewards per player

- **Enchanted Books** a guest picks up go to the guest's save (`'bk'`; `game.js` `gotBook`). Books left on the ground at a portal or at the end are banked by the host, as before.
- **Floor-reached achievements and missions** fire on guests too (they run `go()`); floor bosses count on guests through `'fd'`. Each summary shows the team's floor.
- **Enchanting unlock**: the Ender Dragon unlocks enchanting for **every** player's own partner (host in `bossDown`, guests on `'fd' end`). Solo is unchanged.
- **Co-op leaderboard**: the host posts the team's floor and time (unchanged code, now correct because travel is synced).
- **Breach** on guests' hits: `'h'` carries the Breach share and the host applies it. **Looting** for guests: `'h'` carries the Looting chance on the hit; the host rolls it if that hit kills the mob.

### Same class, also fixed

- Pillager Patrols: the captain's Ominous Banner and arrow show on guests (flag `captain`). Sea battles: the banner, the Dolphin Pod (`'ev' 'pd'` positions, `'px'` gone) and Dolphin's Grace (forwarded), the Guardian Patrol counter (flag `seaPatrol`).
- Day/night: a guest's sunrise no longer burns the host's mobs a second time.
- Weather, Trial Chambers, block breaking and Lost Pets were already synced; they reset with the floor on every computer.

### Message types added (see the header of `js/net/coop.js`)

| Message | Direction | Meaning |
|---|---|---|
| `f.fs` | host → guests, every frame | floor state (above) |
| `'fl' i` | host → guests | travel to floor `i` |
| `'tv' kind` | host → guests | the portal fade starts |
| `'po' kind x y mode` | host → guests | a portal opens (0 a portal there, 1 the Stronghold room, 2 the Aether portal builds) |
| `'bn' title sub col dur queue` | host → guests | a floor banner |
| `'fd' dim dex` | host → guests | a floor boss fell (achievements; on The End, the enchanting unlock) |
| `'ew'` | host → guests | the Elder Guardians wake |
| `'sk' x y level` | host → guests | a shrieker sounds |
| `'ef' id flags name maxHp` | host → guests | an enemy's role changed |
| `'hzu' nid x y angle` | host → guests | a tracking telegraph moved |
| `'pfx' name dur o`, `'ppb' vx vy dur` | host → one guest | a boss effect / a shove on your player |
| `'bk' value` | host → one guest | an Enchanted Book you picked up |
| `'ev' 'pd' dex t list`, `'ev' 'px'` | host → guests | Dolphin Pod positions / gone |
| `'sc' x y` | guest → host | you broke sculk |
| `'h'` + `[7]` breach, `[8]` looting | guest → host | extra fields on a hit |
| `'ne'` + `[10]` flags, `[11]` name, `[12]` crystal top; `'es'` + look, homing, scale, on-hit ops, target; `'hz'` + `linger`, `on`, `nid`; `'ov'` + `vic` | host → guests | extra fields |

### Known limits

Fixed since (2026-10-14):
- An enemy shot that hits a guest on their screen bursts on the host's too: 'es' carries the host's shot id, and the guest answers 'shx' id.
- The Elder Guardian's Mining Fatigue curse waits until the last one wears off, for guests too (a time stamp on the target, `fatigueUntil`).
- Effect messages ("Mining Fatigue!", "Dolphin's Grace!") show on the computer of the player who got the effect ('pfx').
- Breaking a sculk sensor, shrieker or catalyst raises the Ancient City's warning level (solo and co-op): `isSculk` reads the deco's name.

