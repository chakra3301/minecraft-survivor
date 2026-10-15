// The online site's settings: ONE file the owner fills in (see ../../ONLINE.md).
//   minecraft-survivor/online.config.json   (template: server/online.config.example.json)
// Read by build-public.mjs (the site) and ../../server/make-rules.mjs (the moderators in the rules).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gameDir } from './game-data.mjs';

export const DEFAULT_CONFIG = path.join(gameDir, 'online.config.json');

// The local Firebase emulators' project: "demo-" projects never touch a real Firebase project.
export const EMULATOR_PROJECT = 'demo-minecraft-survivor';
export const EMULATOR_FIREBASE = {
  apiKey: 'demo-api-key', authDomain: `${EMULATOR_PROJECT}.firebaseapp.com`, projectId: EMULATOR_PROJECT,
  storageBucket: `${EMULATOR_PROJECT}.appspot.com`, messagingSenderId: '0', appId: '1:0:web:0',
  databaseURL: `https://${EMULATOR_PROJECT}-default-rtdb.firebaseio.com`
};

const NEEDED = ['apiKey', 'authDomain', 'projectId', 'appId', 'databaseURL'];
const UID = /^[A-Za-z0-9_-]{6,128}$/;

/**
 * Reads and checks the config. `file` may be missing when `emulator` is set (the emulators need
 * no real project). Returns { firebase, online } where `online` is what the game gets as G.ONLINE.
 */
export async function readConfig(file, { emulator = false } = {}) {
  let raw = {};
  if (file) {
    try { raw = JSON.parse(await readFile(file, 'utf8')); }
    catch (e) {
      if (e.code === 'ENOENT' && emulator) raw = {};
      else throw new Error(`${file}: ${e.code === 'ENOENT' ? 'not found' : e.message} (format: see ONLINE.md)`);
    }
  }
  // The Firebase console's web config can be pasted as-is under "firebase" (or at the top level).
  const fb = Object.assign({}, raw.firebase || (raw.apiKey ? raw : {}));
  const admins = [].concat(raw.admins || []);
  for (const u of admins) if (typeof u !== 'string' || !UID.test(u)) throw new Error(`admins: "${u}" isn't a Firebase uid`);
  const online = {
    admins,
    allowGoogleSignIn: !!raw.allowGoogleSignIn,
    turnUrl: typeof raw.turnUrl === 'string' ? raw.turnUrl.trim() : '',
    timeZone: raw.timeZone || 'UTC',
    nameDomain: raw.nameDomain || 'players.minecraft-survivor.invalid'
  };
  if (online.turnUrl && !/^https:\/\/[^/]+\//.test(online.turnUrl)) throw new Error('turnUrl must be an https:// URL ending in / (or empty: off)');
  try { new Intl.DateTimeFormat('en', { timeZone: online.timeZone }); } catch { throw new Error(`timeZone: "${online.timeZone}" isn't a valid IANA time zone`); }
  if (/pokesurvivor/i.test(JSON.stringify(raw))) throw new Error('the config points at PokéSurvivor: use your own Firebase project');
  if (emulator) return { firebase: Object.assign({}, EMULATOR_FIREBASE, { emulator: true }), online, emulator: true };
  const missing = NEEDED.filter(k => !fb[k] || /PASTE|YOUR_/i.test(String(fb[k])));
  if (missing.length) throw new Error(`${file}: firebase.${missing.join(', firebase.')} missing (paste the web app config from the Firebase console; see ONLINE.md)`);
  if (!/^https:\/\/[a-z0-9-]+\.(firebaseio\.com|[a-z0-9-]+\.firebasedatabase\.app)\/?$/.test(fb.databaseURL)) {
    throw new Error(`firebase.databaseURL "${fb.databaseURL}" doesn't look like a Realtime Database URL`);
  }
  delete fb.measurementId;            // no Analytics
  return { firebase: fb, online, emulator: false };
}
