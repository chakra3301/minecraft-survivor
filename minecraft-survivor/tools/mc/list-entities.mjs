// Lists every Bedrock client entity with its texture and geometry keys (for building the roster).
//   node tools/mc/list-entities.mjs [filter]
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rp = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../vendor/bedrock-samples/resource_pack');
const filter = process.argv[2] ? new RegExp(process.argv[2]) : null;
for (const f of (await readdir(path.join(rp, 'entity'))).sort()) {
  let d;
  try { d = JSON.parse(await readFile(path.join(rp, 'entity', f), 'utf8')); } catch { continue; }
  const desc = (d['minecraft:client_entity'] || {}).description;
  if (!desc) continue;
  const id = desc.identifier.replace('minecraft:', '');
  if (filter && !filter.test(id)) continue;
  const tex = Object.entries(desc.textures || {}).map(([k, v]) => `${k}=${v.replace('textures/entity/', '')}`).join(' ');
  const geo = Object.entries(desc.geometry || {}).map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(`${id} | ${geo} | ${tex}`);
}
