// Loads Bedrock entity geometry (formats 1.8 and 1.12+) into one normalized shape:
//   { id, texW, texH, bones: [{ name, parent, pivot, rotation, mirror, neverRender, cubes: [...] }] }
//   cube: { origin, size, uv: [u, v] | { north: {uv, uv_size}, ... }, inflate, mirror, pivot, rotation }
// 1.8 files may inherit ("geometry.child:geometry.parent"); child bones replace parent bones by name.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// The engine's built-in classic humanoid (64x32), which the sample pack doesn't ship.
const HUMANOID = {
  texW: 64, texH: 32,
  bones: [
    { name: 'body', pivot: [0, 24, 0], cubes: [{ origin: [-4, 12, -2], size: [8, 12, 4], uv: [16, 16] }] },
    { name: 'head', parent: 'body', pivot: [0, 24, 0], cubes: [{ origin: [-4, 24, -4], size: [8, 8, 8], uv: [0, 0] }] },
    { name: 'hat', parent: 'head', pivot: [0, 24, 0], cubes: [{ origin: [-4, 24, -4], size: [8, 8, 8], uv: [32, 0], inflate: 0.5 }] },
    { name: 'rightArm', parent: 'body', pivot: [-5, 22, 0], cubes: [{ origin: [-8, 12, -2], size: [4, 12, 4], uv: [40, 16] }] },
    { name: 'leftArm', parent: 'body', pivot: [5, 22, 0], mirror: true, cubes: [{ origin: [4, 12, -2], size: [4, 12, 4], uv: [40, 16] }] },
    { name: 'rightLeg', parent: 'body', pivot: [-1.9, 12, 0], cubes: [{ origin: [-3.9, 0, -2], size: [4, 12, 4], uv: [0, 16] }] },
    { name: 'leftLeg', parent: 'body', pivot: [1.9, 12, 0], mirror: true, cubes: [{ origin: [-0.1, 0, -2], size: [4, 12, 4], uv: [0, 16] }] }
  ]
};

function normBone(b) {
  return {
    name: b.name, parent: b.parent || null,
    pivot: b.pivot || [0, 0, 0], rotation: b.rotation || null,
    // 1.8 bind_pose_rotation turns only this bone's cubes, not its children.
    bindPose: b.bind_pose_rotation || null,
    mirror: !!b.mirror, neverRender: !!b.neverRender,
    cubes: (b.cubes || []).map(c => ({
      origin: c.origin, size: c.size, uv: c.uv || [0, 0], inflate: c.inflate || 0,
      mirror: c.mirror ?? b.mirror ?? false, pivot: c.pivot || null, rotation: c.rotation || null
    }))
  };
}

export async function loadGeometries(modelsDir) {
  const raw = new Map();            // id -> { parent, texW, texH, bones }
  for (const f of await readdir(modelsDir)) {
    if (!f.endsWith('.json')) continue;
    let d;
    try { d = JSON.parse(await readFile(path.join(modelsDir, f), 'utf8')); } catch { continue; }
    if (Array.isArray(d['minecraft:geometry'])) {
      for (const g of d['minecraft:geometry']) {
        const desc = g.description || {};
        raw.set(desc.identifier, { file: f, texW: desc.texture_width || 64, texH: desc.texture_height || 64, bones: (g.bones || []).map(normBone) });
      }
    }
    for (const [key, g] of Object.entries(d)) {
      if (!key.startsWith('geometry.')) continue;
      const [id, parent] = key.split(':');
      raw.set(id, { file: f, parent, texW: g.texturewidth, texH: g.textureheight, bones: (g.bones || []).map(normBone) });
    }
  }
  raw.set('geometry.humanoid', { file: '(builtin)', ...HUMANOID, bones: HUMANOID.bones.map(normBone) });

  const done = new Map();
  function resolve(id, depth = 0) {
    if (done.has(id)) return done.get(id);
    const g = raw.get(id);
    if (!g || depth > 8) return null;
    let out = { id, file: g.file, texW: g.texW, texH: g.texH, bones: g.bones };
    if (g.parent) {
      const p = resolve(g.parent, depth + 1);
      if (p) {
        const mine = new Map(g.bones.map(b => [b.name, b]));
        const bones = p.bones.map(b => mine.get(b.name) || b);
        for (const b of g.bones) if (!p.bones.some(pb => pb.name === b.name)) bones.push(b);
        out = { id, file: g.file, texW: g.texW || p.texW, texH: g.texH || p.texH, bones };
      }
    }
    out.texW ||= 64; out.texH ||= 32;
    done.set(id, out);
    return out;
  }
  for (const id of raw.keys()) resolve(id);
  addDerived(done);
  return done;
}

// Mojang's player armour (player_armor.json, geometry.player.armor1 / armor2), per limb: the bone's pivot and its
// cube with the inflate of layer 1 (helmet, chestplate, boots: texture {tier}_1) and layer 2 (leggings: {tier}_2).
const ARMOR = {
  head: { pivot: [0, 24, 0], cubes: [{ origin: [-4, 24, -4], size: [8, 8, 8], uv: [0, 0], inflate: [1, 0] },
    { origin: [-4, 24, -4], size: [8, 8, 8], uv: [32, 0], inflate: [1.5, 0], over: 0.5 }] },
  body: { pivot: [0, 24, 0], cubes: [{ origin: [-4, 12, -2], size: [8, 12, 4], uv: [16, 16], inflate: [1.01, 0.5] }] },
  rightarm: { pivot: [-5, 22, 0], cubes: [{ origin: [-8, 12, -2], size: [4, 12, 4], uv: [40, 16], inflate: [1, 0] }] },
  leftarm: { pivot: [5, 22, 0], mirror: true, cubes: [{ origin: [4, 12, -2], size: [4, 12, 4], uv: [40, 16], inflate: [1, 0] }] },
  rightleg: { pivot: [-1.9, 12, 0], cubes: [{ origin: [-3.9, 0, -2], size: [4, 12, 4], uv: [0, 16], inflate: [1, 0.49] }] },
  leftleg: { pivot: [1.9, 12, 0], mirror: true, cubes: [{ origin: [-0.1, 0, -2], size: [4, 12, 4], uv: [0, 16], inflate: [1, 0.49] }] }
};

/**
 * The two armour layers for a humanoid geometry, as Bedrock draws them: the base's own bones (same names,
 * pivots and parents, so they pose together), with Mojang's armour cubes on the six limbs moved to each
 * limb's pivot. Each shell is inflated at least as much as Mojang's, and enough to clear the mob's own
 * cubes and overlays (a piglin's wide head and ears, a drowned's outer layer). → [layer1, layer2] (64x32).
 */
export function armorLayers(base) {
  const kids = new Map();
  for (const b of base.bones) if (b.parent) (kids.get(b.parent) || kids.set(b.parent, []).get(b.parent)).push(b);
  const limbOf = b => ARMOR[b.name.toLowerCase()];
  // Bounding box of a limb's cubes plus its overlay children (hat, jacket, sleeves, pants, ears), not the limbs under it.
  function box(b, out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]) {
    if (!b.neverRender) for (const c of b.cubes) for (let i = 0; i < 3; i++) {
      out[i] = Math.min(out[i], c.origin[i] - c.inflate);
      out[i + 3] = Math.max(out[i + 3], c.origin[i] + c.size[i] + c.inflate);
    }
    for (const k of kids.get(b.name) || []) if (!limbOf(k) && !/item/i.test(k.name)) box(k, out);
    return out;
  }
  const layers = [0, 1].map(() => ({ texW: 64, texH: 32, bones: [] }));
  for (const b of base.bones) {
    const A = limbOf(b), bb = A && box(b);
    const fit = [0, 0];
    if (A) for (const c of A.cubes) {
      if (c.over) continue;
      const d = b.pivot.map((p, i) => p - A.pivot[i]);
      let need = -Infinity;
      for (let i = 0; i < 3; i++) need = Math.max(need, c.origin[i] + d[i] - bb[i], bb[i + 3] - (c.origin[i] + d[i] + c.size[i]));
      // Layer 2 inside layer 1 with a gap; both clear of the mob's own cubes.
      fit[1] = c.inflate[1] ? Math.max(c.inflate[1], need + 0.2) : 0;
      fit[0] = Math.max(c.inflate[0], need + 0.2, fit[1] ? fit[1] + 0.3 : 0);
    }
    layers.forEach((L, li) => {
      const cubes = !A ? [] : A.cubes.filter(c => c.inflate[li]).map(c => {
        const d = b.pivot.map((p, i) => p - A.pivot[i]);
        return { origin: c.origin.map((o, i) => o + d[i]), size: c.size, uv: c.uv, inflate: fit[li] + (c.over || 0),
          mirror: !!A.mirror, pivot: null, rotation: null };
      });
      L.bones.push({ ...b, bindPose: null, neverRender: false, cubes });
    });
  }
  return layers;
}

const shift = (c, [dx, dy, dz], k = 1) => ({ ...c, origin: [c.origin[0] * k + dx, c.origin[1] * k + dy, c.origin[2] * k + dz], size: c.size.map(v => v * k) });

/** Geometries the sample pack lacks or only completes through animation scripts. */
function addDerived(done) {
  // Alex: the player model with 3-pixel arms.
  const steve = done.get('geometry.humanoid.custom');
  if (steve) {
    const slim = b => /Arm|Sleeve/.test(b.name) ? { ...b, cubes: b.cubes.map(c => ({ ...c, size: [3, c.size[1], c.size[2]],
      origin: [c.origin[0] < 0 ? -7 : 4, c.origin[1], c.origin[2]] })) } : b;
    done.set('geometry.humanoid.customSlim', { ...steve, id: 'geometry.humanoid.customSlim', bones: steve.bones.map(slim) });
  }
  // Ender Dragon: Mojang draws one neck segment and the tail by repeating it in code. Rebuild the chain:
  // head pushed forward on 4 neck segments, 10 tail segments trailing behind the body.
  const dragon = done.get('geometry.dragon');
  if (dragon) {
    const neck = dragon.bones.find(b => b.name === 'neck');
    const out = [];
    const fwd = -34;
    for (const b of dragon.bones) {
      if (b.name === 'head' || b.name === 'jaw') out.push({ ...b, pivot: [b.pivot[0], b.pivot[1], b.pivot[2] + fwd], cubes: b.cubes.map(c => shift(c, [0, 0, fwd])) });
      else if (b.name === 'neck') for (let i = 0; i < 4; i++) out.push({ ...b, name: 'neck' + i, cubes: b.cubes.map(c => shift(c, [0, -i * 0.5, -6 - i * 8])) });
      else if (b.name === 'wing1' || b.name === 'wingtip1') {
        // The right wing is stored as a copy of the left one (Mojang flips it with an animation):
        // mirror it across the body. wing1 flips around its own pivot, wingtip1 around the centre line.
        const cx = b.name === 'wing1' ? b.pivot[0] : 0;
        out.push({ ...b, parent: b.name === 'wingtip1' ? 'wing1' : b.parent, pivot: [2 * cx - b.pivot[0], b.pivot[1], b.pivot[2]], mirror: !b.mirror,
          cubes: b.cubes.map(c => ({ ...c, origin: [2 * cx - (c.origin[0] + c.size[0]), c.origin[1], c.origin[2]], mirror: !c.mirror })) });
      }
      else if (!/tip|foot/.test(b.name)) out.push(b);
      else if (b.name === 'wingtip') out.push({ ...b, parent: 'wing' });      // the outer half flaps with its wing
    }
    for (let i = 0; i < 10; i++) {
      const k = 1 - i * 0.05;
      out.push({ name: 'tail' + i, parent: null, pivot: [0, 20, 58 + i * 9], rotation: null, mirror: false, neverRender: false,
        cubes: neck.cubes.map(c => shift(c, [0, -2 - i * 0.8, 60 + i * 9], k)) });
    }
    done.set('geometry.dragon', { ...dragon, bones: out });
  }
}
