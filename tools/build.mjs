// Builds a playable copy of a game into its dist/ folder:
//   - copies the game's public files,
//   - bundles dev.html's scripts (in order) into js/app.min.js with the cloud backend forced off,
//   - adds CSP + noindex to every HTML page.
//   node tools/build.mjs [game ...]     (no args = every game)
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { minify } from 'terser';
import { csp } from './local-policy.mjs';
import { GAMES, game } from './games.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const localConfig = '// Local workspace: never connect to the upstream production backend.\nG.FIREBASE_CONFIG = null;\n';
const BEGIN = '<!-- scripts:begin -->', END = '<!-- scripts:end -->';

async function build(g) {
  if (g.format === 'osrs-webgl') {
    execFileSync(process.execPath, [path.join(root, g.src, 'tools/build.mjs')], { stdio: 'inherit' });
    return;
  }
  const source = path.join(root, g.src), out = path.join(root, g.out);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const name of g.copy) await cp(path.join(source, name), path.join(out, name), { recursive: true });
  await rm(path.join(out, 'js/app.min.js'), { force: true });
  await writeFile(path.join(out, 'js/core/firebase-config.js'), localConfig);

  const dev = await readFile(path.join(source, 'dev.html'), 'utf8');
  const begin = dev.indexOf(BEGIN), end = dev.indexOf(END);
  if (begin < 0 || end < begin) throw new Error(`${g.name}: dev.html script-order markers missing`);
  const files = [...dev.slice(begin, end).matchAll(/<script[^>]*src="(js\/[^"?]+\.js)"/g)].map(m => m[1]);
  if (!files.includes('js/core/firebase-config.js')) throw new Error(`${g.name}: missing Firebase configuration override`);
  const joined = (await Promise.all(files.map(async file => `/* ${file} */\n` +
    (file === 'js/core/firebase-config.js' ? localConfig : await readFile(path.join(source, file), 'utf8'))))).join('\n;\n');
  const result = await minify(joined, { compress: { passes: 1 }, mangle: true, ecma: 2020, format: { comments: false } });
  if (!result.code) throw new Error(`${g.name}: empty game bundle`);
  const hash = createHash('sha1').update(result.code).digest('hex').slice(0, 10);
  await writeFile(path.join(out, 'js/app.min.js'), result.code);
  await writeFile(path.join(out, 'version.json'), JSON.stringify({ v: hash, at: new Date().toISOString() }) + '\n');

  // The service worker caches art forever under fixed names; stamp them per build so changed
  // sprites/textures (re-rendered mobs, etc.) replace the old copies and stale caches get deleted.
  const art = createHash('sha1');
  for (const dir of ['assets/mobs', 'assets/mc', 'assets/cod', 'assets/rs', 'assets/pokemon', 'assets/icons', 'assets/fonts']) {
    let files;
    try { files = await readdir(path.join(out, dir), { recursive: true }); } catch { continue; }
    for (const f of files.sort()) {
      const st = await stat(path.join(out, dir, f));
      if (st.isFile()) art.update(`${dir}/${f}:${st.size}:${st.mtimeMs}\n`);
    }
  }
  const artHash = art.digest('hex').slice(0, 10);
  const swFile = path.join(out, 'sw.js');
  const sw = await readFile(swFile, 'utf8');
  const stamped = sw.replace(/(['"])([a-z]+-code)-v\d+\1/, `$1$2-${hash}$1`).replace(/(['"])([a-z]+-art)-v\d+\1/, `$1$2-${artHash}$1`);
  if (stamped === sw) throw new Error(`${g.name}: sw.js cache names not found; can't version them`);
  await writeFile(swFile, stamped);

  if (g.generateIndex) {
    const html = dev.slice(0, begin) + `<script defer src="js/app.min.js?v=${hash}"></script>` + dev.slice(end + END.length);
    await writeFile(path.join(out, 'index.html'), html);
  }

  // Isolation on every page, including the unbundled dev.html entry.
  async function patchHtml(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { await patchHtml(file); continue; }
      if (!entry.name.endsWith('.html')) continue;
      let html = await readFile(file, 'utf8');
      html = html.replace(/<head>/i, `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<meta name="robots" content="noindex, nofollow">`)
        .replace(/<link[^>]+rel="preconnect"[^>]*>/gi, '')
        .replace(/<meta name="robots" content="(?!noindex, nofollow)[^"]*">/gi, '')
        .replace(/js\/app\.min\.js\?v=[a-z0-9]+/g, `js/app.min.js?v=${hash}`);
      await writeFile(file, html);
    }
  }
  await patchHtml(out);
  await writeFile(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  const info = { game: g.name, mode: 'local', scripts: files.length, hash };
  if (g.upstream) Object.assign(info, { upstream: g.upstream, revision: execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() });
  await writeFile(path.join(out, 'local-build.json'), JSON.stringify(info, null, 2) + '\n');
  console.log(`${g.name}: ${files.length} scripts → ${g.out} (local saves, no cloud backend)`);
}

const names = process.argv.slice(2);
for (const name of names.length ? names : Object.keys(GAMES)) await build(game(name));
