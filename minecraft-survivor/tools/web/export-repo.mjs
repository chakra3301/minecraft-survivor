// Copies Minecraft Survivor's open-source repo (github.com/chakra3301/minecraft-survivor) out of the workspace:
//   node minecraft-survivor/tools/web/export-repo.mjs [--out artifacts/github-export]
//
// What goes in: the game's tracked files (git ls-files minecraft-survivor), the shared build tools it needs
// (tools/build|serve|verify|local-policy.mjs, games.mjs trimmed to this game), its two test specs, and a
// package.json / playwright config / .gitignore / README / LICENSE of its own.
// What stays out: the other games, the workspace notes, and everything Mojang's (textures, models and music
// are generated or imported locally; the app icons and favicon are rendered from Mojang's grass block by
// tools/mc/make-icons.mjs, so they're regenerated too). The repo's own .git is kept between runs.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'artifacts/github-export';
const out = path.resolve(root, outArg);
if (!path.relative(root, out).startsWith('artifacts') && !args.includes('--force-out')) throw new Error('--out must be under artifacts/ (or pass --force-out)');

// Mojang-derived files that are tracked in the workspace but regenerated in the public repo.
const MOJANG = [/^minecraft-survivor\/assets\/icons\/.*\.png$/, /^minecraft-survivor\/favicon\.ico$/,
                /^minecraft-survivor\/deploy\/coming-soon\/favicon\.ico$/];

// Fresh copy, keeping the repo's history.
await mkdir(out, { recursive: true });
for (const f of await readdir(out)) if (f !== '.git') await rm(path.join(out, f), { recursive: true, force: true });

const tracked = execFileSync('git', ['ls-files', 'minecraft-survivor', 'tests/minecraft-survivor.spec.mjs',
  'tests/minecraft-survivor-online.spec.mjs', 'tools/build.mjs', 'tools/serve.mjs', 'tools/verify.mjs', 'tools/local-policy.mjs'],
  { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean).filter(f => !MOJANG.some(re => re.test(f)));
for (const f of tracked) {
  await mkdir(path.dirname(path.join(out, f)), { recursive: true });
  await cp(path.join(root, f), path.join(out, f));
}

// tools/games.mjs with only this game; serve.mjs defaults to it.
const games = await readFile(path.join(root, 'tools/games.mjs'), 'utf8');
const entry = games.match(/  'minecraft-survivor': \{[\s\S]*?\n  \}/)[0];
const tail = games.slice(games.indexOf('export function game('));
await writeFile(path.join(out, 'tools/games.mjs'),
  `// The game this repo builds: where its source lives, what gets copied, and its ports.\nexport const GAMES = {\n${entry}\n};\n\n${tail}`);
const serve = path.join(out, 'tools/serve.mjs');
await writeFile(serve, (await readFile(serve, 'utf8')).replace(/'pokesurvivor'\);/, "'minecraft-survivor');").replace('(default pokesurvivor;', '(default minecraft-survivor;'));

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const scripts = {
  build: 'node tools/build.mjs minecraft-survivor',
  start: 'node tools/serve.mjs minecraft-survivor',
  dev: 'node tools/serve.mjs minecraft-survivor --src',
  verify: 'node tools/verify.mjs minecraft-survivor',
  test: 'npm run build && npm run verify && playwright test',
  'mc:vendor': pkg.scripts['mc:vendor'],
  'mc:assets': pkg.scripts['mc:assets'] + ' && node minecraft-survivor/tools/mc/make-icons.mjs',
  'mc:music': 'node minecraft-survivor/tools/mc/import-music.mjs',
  'mc:check': pkg.scripts['mc:check'],
  'online:build': 'node minecraft-survivor/tools/web/build-public.mjs --config minecraft-survivor/online.config.json',
  'online:test': 'minecraft-survivor/server/test-online.sh'
};
await writeFile(path.join(out, 'package.json'), JSON.stringify({
  name: 'minecraft-survivor', version: '1.0.0', private: true, type: 'module',
  description: 'A free, open-source, fan-made survivor game in the browser. Unofficial: not affiliated with Mojang or Microsoft.',
  license: 'MIT', engines: pkg.engines, scripts, devDependencies: pkg.devDependencies
}, null, 2) + '\n');

await writeFile(path.join(out, 'playwright.config.mjs'), `import { defineConfig } from '@playwright/test';
import { GAMES } from './tools/games.mjs';

// A private test server on its own port (never the dev port, so tests don't touch your saves).
// The online spec skips itself unless run through minecraft-survivor/server/test-online.sh.
const g = GAMES['minecraft-survivor'];
export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  outputDir: 'test-results',
  use: { viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', baseURL: \`http://127.0.0.1:\${g.testPort}\` },
  webServer: { command: \`PORT=\${g.testPort} node tools/serve.mjs minecraft-survivor\`, url: \`http://127.0.0.1:\${g.testPort}/\`, reuseExistingServer: false }
});
`);

await writeFile(path.join(out, '.gitignore'), `node_modules/
test-results/
playwright-report/
artifacts/
.DS_Store
*.log
# Mojang's bedrock-samples (npm run mc:vendor)
vendor/
minecraft-survivor/dist/
# Generated from vendor/ or imported from your own Minecraft install (npm run mc:assets / mc:music): Mojang's, never committed
minecraft-survivor/assets/mobs/
minecraft-survivor/assets/mc/
minecraft-survivor/assets/music/
minecraft-survivor/assets/icons/*.png
minecraft-survivor/favicon.ico
minecraft-survivor/deploy/coming-soon/favicon.ico
`);

await cp(path.join(root, 'minecraft-survivor/tools/web/repo-README.md'), path.join(out, 'README.md'));
await cp(path.join(root, 'minecraft-survivor/tools/web/repo-LICENSE.txt'), path.join(out, 'LICENSE'));
console.log(`${tracked.length} tracked files + repo files → ${path.relative(root, out)}`);
