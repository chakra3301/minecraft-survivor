// Runs inside headless Chromium (driven by render-mobs.mjs). Builds Bedrock geometry with three.js,
// poses it procedurally and renders PMD-style 8-direction sprite sheets plus an "Enchanted" (glint) copy.
// Coordinates follow Blockbench's Bedrock import: x is negated, models face north (-z).
import * as THREE from 'three';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';

const DEG = Math.PI / 180, TAU = Math.PI * 2;
const VIEW = 192;                 // offscreen frame, 1 px = 1 texel at scale 1
const ORIGIN = [VIEW / 2, Math.round(VIEW * 0.74)];
const ELEV = 38 * DEG;            // camera pitch: 3/4 top-down like PMD sprites
const LIFT = 7;                   // how high flying mobs hover (model units)

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(VIEW, VIEW);
renderer.setClearColor(0x000000, 0);
const camera = new THREE.OrthographicCamera(-VIEW / 2, VIEW / 2, VIEW / 2, -VIEW / 2, -2000, 2000);
camera.position.set(0, Math.sin(ELEV) * 400, -Math.cos(ELEV) * 400);
camera.lookAt(0, 0, 0);
camera.setViewOffset(VIEW, VIEW, VIEW / 2 - ORIGIN[0], VIEW / 2 - ORIGIN[1], VIEW, VIEW);
camera.updateProjectionMatrix();

// ---------------- textures ----------------
async function loadTexture(t) {
  const bytes = Uint8Array.from(atob(t.b64), c => c.charCodeAt(0));
  let cv;
  if (t.kind === 'tga') {
    const d = new TGALoader().parse(bytes.buffer);       // rows top-to-bottom
    cv = new OffscreenCanvas(d.width, d.height);
    cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d.data.buffer, d.data.byteOffset, d.data.length), d.width, d.height), 0, 0);
  } else {
    const img = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    cv = new OffscreenCanvas(img.width, img.height);
    cv.getContext('2d').drawImage(img, 0, 0);
  }
  const cx = cv.getContext('2d');
  for (const [x, y, col] of t.patch || []) { cx.fillStyle = col; cx.fillRect(x, y, 1, 1); }
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = true;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// UV rectangles per face, in texels: [u1, v1, u2, v2] (u2 < u1 means flipped).
function boxFaces(c) {
  const [u, v] = c.uv, [w, h, d] = c.size.map(x => Math.floor(Math.abs(x)));
  const r = (x, y, sw, sh) => [x, y, x + sw, y + sh];
  const f = {
    east: r(u, d + v, d, h), west: r(d + w + u, d + v, d, h),
    up: r(d + w + u, d + v, -w, -d), down: r(d + w * 2 + u, v, -w, d),
    south: r(d * 2 + w + u, d + v, w, h), north: r(d + u, d + v, w, h)
  };
  if (c.mirror) {
    for (const k in f) { const [a, b, x, y] = f[k]; f[k] = [x, b, a, y]; }
    [f.east, f.west] = [f.west, f.east];
  }
  return f;
}
function perFace(c) {
  const f = {};
  for (const [k, o] of Object.entries(c.uv)) {
    if (!o || !o.uv) continue;
    const [u, v] = o.uv, [w, h] = o.uv_size || [0, 0];
    f[k] = [u, v, u + w, v + h];
  }
  return f;
}

function cubeMesh(c, tw, th, mat) {
  const inf = c.inflate || 0;
  const x1 = -(c.origin[0] + c.size[0]) - inf, x2 = -c.origin[0] + inf;
  const y1 = c.origin[1] - inf, y2 = c.origin[1] + c.size[1] + inf;
  const z1 = c.origin[2] - inf, z2 = c.origin[2] + c.size[2] + inf;
  const uvs = Array.isArray(c.uv) ? boxFaces(c) : perFace(c);
  // Corners per face as seen from outside: TL, TR, BL, BR.
  const corners = {
    north: [[x2, y2, z1], [x1, y2, z1], [x2, y1, z1], [x1, y1, z1]],
    south: [[x1, y2, z2], [x2, y2, z2], [x1, y1, z2], [x2, y1, z2]],
    east: [[x2, y2, z2], [x2, y2, z1], [x2, y1, z2], [x2, y1, z1]],
    west: [[x1, y2, z1], [x1, y2, z2], [x1, y1, z1], [x1, y1, z2]],
    up: [[x1, y2, z1], [x2, y2, z1], [x1, y2, z2], [x2, y2, z2]],
    down: [[x1, y1, z2], [x2, y1, z2], [x1, y1, z1], [x2, y1, z1]]
  };
  // Blockbench swaps east/west naming relative to the negated x axis.
  const faceUV = { north: uvs.north, south: uvs.south, east: uvs.west, west: uvs.east, up: uvs.up, down: uvs.down };
  const pos = [], uv = [], idx = [];
  for (const [k, q] of Object.entries(corners)) {
    const r = faceUV[k];
    if (!r) continue;
    const [a, b, cc, dd] = r;
    const base = pos.length / 3;
    const tuv = [[a, b], [cc, b], [a, dd], [cc, dd]];
    q.forEach((p, i) => { pos.push(...p); uv.push(tuv[i][0] / tw, 1 - tuv[i][1] / th); });
    idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  if (c.rotation) {
    const piv = new THREE.Group();
    // Without an explicit pivot, Bedrock rotates a cube around its own centre.
    const p = c.pivot || c.origin.map((o, i) => o + c.size[i] / 2);
    piv.position.set(-p[0], p[1], p[2]);
    piv.rotation.set(-c.rotation[0] * DEG, -c.rotation[1] * DEG, c.rotation[2] * DEG, 'ZYX');
    m.position.set(p[0], -p[1], -p[2]);
    piv.add(m);
    return piv;
  }
  return m;
}

/**
 * A held item (sword, axe, bow, crossbow, trident): its 16x16 texture on a double-sided plane in the
 * hand, like Minecraft's third-person view. The texture's handle (bottom-left) sits in the grip and
 * its tip points forward and up; the plane is turned a little toward the camera so it reads from above.
 */
function attachHeld(model, tex, at) {
  // `at` places it elsewhere: { bone, at: model point [x, y, z], rot: [x, y, z] ('YXZ'), size }, centred there
  // (a villager's book in front of its folded arms).
  const bone = at ? model.bones.get(at.bone) : model.bones.get('rightItem') || model.bones.get('rightArm') || model.bones.get('rightarm');
  if (!bone) return null;
  const S = at ? at.size : 15;                 // a bit bigger than vanilla, so it reads at sprite size
  const g = new THREE.PlaneGeometry(S, S);
  if (!at) g.translate(S * 0.36, S * 0.36, 0); // handle at the origin
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.userData.base = mat.color.clone();
  const m = new THREE.Mesh(g, mat);
  model.meshes.push(m);
  const grip = new THREE.Group();
  const R = at ? at.rot : window.HELD_ROT || [-0.35, Math.PI / 2 - 0.55, 0];
  grip.rotation.set(R[0], R[1], R[2], 'YXZ');      // blade forward (-z) and up, angled to the camera
  grip.add(m);
  if (at) { const p = bone.userData.pivot; grip.position.set(-at.at[0] - p[0], at.at[1] - p[1], at.at[2] - p[2]); }
  else if (bone.name !== 'rightItem') grip.position.y = -9;     // bare arm bone: down to the hand
  bone.add(grip);
  return m;
}

function build(geo, tex, hide, tint, glow, see) {
  // Glow layers (charged creeper energy) are additive and see-through; `see` layers keep the
  // texture's own translucency (the Sulfur Cube's jelly shell).
  const mat = glow
    ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    : see ? new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.02, depthWrite: false, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.1, side: THREE.DoubleSide });
  if (tint) mat.color.set(tint);
  mat.userData.base = mat.color.clone();
  const root = new THREE.Group();
  const bones = new Map(), info = new Map(), meshes = [];
  for (const b of geo.bones) {
    const g = new THREE.Group();
    g.name = b.name;
    const p = b.pivot;
    g.userData = { pivot: [-p[0], p[1], p[2]], rot: b.rotation ? [-b.rotation[0] * DEG, -b.rotation[1] * DEG, b.rotation[2] * DEG] : [0, 0, 0] };
    const skip = b.neverRender || hide.some(h => new RegExp(h, 'i').test(b.name));
    // Cubes are in model space; this group cancels the bone's pivot offset.
    const inner = new THREE.Group();
    inner.position.set(-g.userData.pivot[0], -g.userData.pivot[1], -g.userData.pivot[2]);
    if (!skip) for (const c of b.cubes) { const o = cubeMesh(c, geo.texW, geo.texH, mat); o.traverse(x => x.isMesh && meshes.push(x)); inner.add(o); }
    if (b.bindPose) {
      const bp = new THREE.Group();
      bp.rotation.set(-b.bindPose[0] * DEG, -b.bindPose[1] * DEG, b.bindPose[2] * DEG, 'ZYX');
      bp.add(inner);
      g.add(bp);
    } else g.add(inner);
    bones.set(b.name, g);
    info.set(b.name, b);
  }
  // Each bone sits at its pivot, relative to its parent's pivot.
  for (const b of geo.bones) {
    const g = bones.get(b.name);
    const parent = b.parent && bones.get(b.parent);
    const pp = parent ? parent.userData.pivot : [0, 0, 0];
    g.position.set(g.userData.pivot[0] - pp[0], g.userData.pivot[1] - pp[1], g.userData.pivot[2] - pp[2]);
    g.userData.base = g.position.clone();
    (parent || root).add(g);
  }
  return { root, bones, info, mat, meshes, tex, gait: gaitOf(geo) };
}

// ---------------- glint on gear (netherite armour, enchanted books) ----------------
/**
 * Renders a mask of the glinting meshes (cut-outs kept) into pixel data: white = full glint (an enchanted
 * book, like the Enchanted sheets), grey = the lighter gear glint (netherite armour and weapons), black = none.
 */
function glintMask(scene, models) {
  const saved = [];
  for (const m of models) for (const mesh of m.meshes) {
    const v = mesh.userData.ench === 'full' ? '1.0' : mesh.userData.ench || m.part.ench ? '0.5' : '0.0';
    saved.push([mesh, mesh.material]);
    const mat = new THREE.MeshBasicMaterial({ map: mesh.material.map, alphaTest: mesh.material.alphaTest || 0.1, side: THREE.DoubleSide });
    // Flat grey levels, not the texture's colours (the map only keeps its cut-outs).
    mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `outgoingLight = vec3(${v});\n#include <opaque_fragment>`); };
    mat.customProgramCacheKey = () => 'mask' + v;
    mesh.material = mat;
  }
  renderer.render(scene, camera);
  const cv = new OffscreenCanvas(VIEW, VIEW);
  cv.getContext('2d').drawImage(renderer.domElement, 0, 0);
  for (const [mesh, mat] of saved) { mesh.material.dispose(); mesh.material = mat; }
  return cv.getContext('2d').getImageData(0, 0, VIEW, VIEW).data;
}
/** The glint bands of glint() below, on the masked pixels of one frame only. */
function glintFrame(cv, mask, i, n) {
  const cx = cv.getContext('2d'), im = cx.getImageData(0, 0, VIEW, VIEW), d = im.data;
  for (let y = 0; y < VIEW; y++) for (let x = 0; x < VIEW; x++) {
    const p = (y * VIEW + x) * 4;
    if (d[p + 3] < 8 || mask[p] < 64) continue;
    const band = ((x + y * 0.6 + i * (32 / n)) % 22 + 22) % 22;
    if (mask[p] > 200) shade(d, p, band < 3 ? 1 : band < 5 ? 0.55 : 0.18);
    // Gear: a soft sheen sweeping across (no hard stripe, no tint between sweeps), so netherite stays dark.
    else if (band < 10) {
      const k = 0.42 * Math.sin(band / 10 * Math.PI);
      d[p] = Math.min(255, d[p] + 120 * k); d[p + 1] = Math.min(255, d[p + 1] + 45 * k); d[p + 2] = Math.min(255, d[p + 2] + 210 * k);
    }
  }
  cx.putImageData(im, 0, 0);
}
function shade(d, i, k) {
  d[i] = Math.min(255, d[i] * 0.85 + 120 * k + 20);
  d[i + 1] = Math.min(255, d[i + 1] * 0.75 + 50 * k);
  d[i + 2] = Math.min(255, d[i + 2] * 0.85 + 200 * k + 40);
}

/** A rider on a mount: legs forward and a little apart, its root glued to the mount's (which carries it). */
function seat(model) {
  model.root.rotation.set(0, 0, 0);
  model.root.position.set(0, model.root.position.y, 0);
  for (const [name, g] of model.bones) {
    if (model.gait.phase[name] === undefined || !isLeg(name)) continue;
    g.rotation.set(80 * DEG, -Math.sign(g.userData.pivot[0]) * 24 * DEG, 0, 'ZYX');
  }
}

// ---------------- gait: which limbs swing together ----------------
const isLeg = n => /leg/i.test(n) && !/legging|tip|foot/i.test(n);
const isArm = n => /arm/i.test(n) && !/armor|armadillo/i.test(n) && !/item/i.test(n) && n !== 'arms';   // villagers' folded 'arms' don't swing
function gaitOf(geo) {
  const byName = new Map(geo.bones.map(b => [b.name, b]));
  const top = (b, test) => !(b.parent && test(b.parent));
  const legs = geo.bones.filter(b => isLeg(b.name) && top(b, isLeg));
  const phase = {};
  const side = b => /left|_l$|L$/.test(b.name) && !/right/i.test(b.name) ? 1 : /right|_r$|R$/.test(b.name) ? -1 : Math.sign(b.pivot[0]) || 1;
  for (const s of [1, -1]) {
    const mine = legs.filter(b => side(b) === s).sort((a, b) => a.pivot[2] - b.pivot[2]);
    mine.forEach((b, i) => { phase[b.name] = (i % 2 ? -1 : 1) * s; });
  }
  for (const b of geo.bones) if (isArm(b.name) && top(b, isArm)) phase[b.name] = -side(b);
  return { phase, nLegs: legs.length, byName };
}

// ---------------- procedural poses ----------------
function pose(model, anim, t, job) {
  const rig = job.rig || 'auto';
  const s = Math.sin(t * TAU), s2 = Math.sin(t * TAU * 2);
  for (const g of model.bones.values()) {
    const [rx, ry, rz] = g.userData.rot;
    g.rotation.set(rx, ry, rz, 'ZYX');
    g.position.copy(g.userData.base);
    g.scale.setScalar(1);
  }
  const R = model.root;
  R.rotation.set(0, 0, 0);
  R.position.set(0, job.hover ? LIFT + Math.sin(t * TAU) * 1.2 : 0, 0);
  R.scale.set(1, 1, 1);
  const B = n => model.bones.get(n);
  const all = [...model.bones.entries()];
  const swing = { Walk: 0.7, Attack: 0.15, Shoot: 0.1 }[anim] || 0;

  // limbs
  for (const [name, g] of all) {
    const ph = model.gait.phase[name];
    if (ph === undefined) continue;
    if (isLeg(name)) {
      if (rig === 'spider') { g.rotation.y += ph * s * swing * 0.5; g.rotation.z += ph * Math.max(0, s) * swing * 0.3; }
      else g.rotation.x += ph * s * swing;
    } else if (rig !== 'zombie') g.rotation.x += ph * s * swing * 0.8;
  }
  const arms = all.filter(([n]) => model.gait.phase[n] !== undefined && isArm(n)).map(([, g]) => g);
  // Positive x raises an arm forward here (x is mirrored from Bedrock's convention).
  if (rig === 'zombie') for (const a of arms) a.rotation.x = 85 * DEG + s * 0.06;
  const head = B('head') || B('Head') || B('head1');

  // wings, tentacles, tails
  const flap = anim === 'Faint' ? 0 : (anim === 'Idle' ? 0.35 : 0.6);
  for (const [name, g] of all) {
    if (/wing/i.test(name) && !/tip/i.test(name)) {
      const sd = (g.userData.pivot[0] >= 0 ? 1 : -1);
      if (rig === 'dragon') g.rotation.z += sd * 0.35 * Math.sin(t * TAU);
      else g.rotation.z += sd * flap * Math.sin(t * TAU * 2);
    } else if (/tentacle/i.test(name)) {
      const i = +(name.match(/\d+/) || [0])[0];
      g.rotation.x += 0.22 * Math.sin(t * TAU + i * 0.9);
    } else if (/^tail/i.test(name)) {
      g.rotation.y += 0.25 * s;
    }
  }

  if (rig === 'hop') {
    const k = Math.max(0, Math.sin(t * TAU));
    if (anim === 'Walk' || anim === 'Attack') { R.position.y = k * 5; R.scale.set(1 + (1 - k) * 0.08, 1 - (1 - k) * 0.12 + k * 0.06, 1 + (1 - k) * 0.08); }
    if (anim === 'Idle') R.scale.set(1 + 0.03 * s, 1 - 0.04 * s, 1 + 0.03 * s);
  }
  if (rig === 'fish' && anim !== 'Faint') R.rotation.y = 0.18 * s * (anim === 'Walk' ? 1.5 : 1);
  if (rig === 'ghast' && anim === 'Shoot') R.scale.setScalar(1 + 0.05 * Math.sin(Math.min(1, t * 2) * Math.PI));
  if (rig === 'shulker') {
    const lid = B('lid'), hd = B('head');
    const open = { Idle: 1 + s, Walk: 2, Attack: 6, Shoot: 7, Charge: 4, Hurt: 0, Faint: 0 }[anim] ?? 0;
    if (lid) lid.position.y += open;
    if (hd) hd.position.y += open * 0.6;
  }
  if (rig === 'blaze') {
    // Three rings of four rods spinning around the head (Mojang places them with animation scripts).
    const rings = [[9, 2], [7, -5], [5, -12]];
    for (let i = 0; i < 12; i++) {
      const g = B('upperBodyParts' + i);
      if (!g) continue;
      const [r, y] = rings[Math.floor(i / 4)];
      const a = (i % 4) * Math.PI / 2 + t * TAU * (Math.floor(i / 4) % 2 ? -1 : 1) / 2;
      g.position.set(g.userData.base.x + Math.cos(a) * r, g.userData.base.y + y + Math.sin(t * TAU * 2 + i) * 0.8, g.userData.base.z + Math.sin(a) * r);
    }
  }

  if (anim === 'Idle') {
    if (rig !== 'hop' && !job.hover) R.position.y += Math.max(0, s) * 0.5;
    if (head) head.rotation.x += s * 0.05;
    for (const a of arms) a.rotation.z += (a.userData.pivot[0] > 0 ? 1 : -1) * (0.05 + 0.04 * s);
  }
  if (anim === 'Walk' && model.gait.nLegs === 2 && rig !== 'hop') R.position.y += Math.abs(s) * 0.6;
  if (anim === 'Attack') {
    // Wind up, then strike forward (arm swing / head lunge).
    const k = t < 0.4 ? -t / 0.4 : t < 0.6 ? -1 + (t - 0.4) / 0.2 * 2 : 1 - (t - 0.6) / 0.4;
    if (arms.length) arms[arms.length - 1].rotation.x = 110 * DEG * Math.max(0, -k) - 35 * DEG * Math.max(0, k) + (rig === 'zombie' ? 70 * DEG : 0);
    if (head) head.rotation.x += k * 0.25;
    R.position.z -= Math.max(0, k) * 3;
  }
  if (anim === 'Shoot') {
    for (const a of arms) a.rotation.x = 88 * DEG;
    R.position.z += Math.sin(Math.min(1, t * 2) * Math.PI) * 1.5;
  }
  if (anim === 'Charge') {
    R.scale.multiplyScalar(1 + 0.07 * Math.max(0, s2));
    for (const a of arms) a.rotation.z += (a.userData.pivot[0] > 0 ? 1 : -1) * 0.5;
  }
  if (anim === 'Hurt') {
    R.rotation.x = 0.25 * (1 - t);
    R.position.z += 2 * (1 - t);
  }
  if (anim === 'Faint') {
    // Minecraft death: tip over sideways (and flyers drop to the ground).
    const k = Math.min(1, t * 1.6);
    R.rotation.z = k * 90 * DEG;
    if (job.hover) R.position.y = LIFT * (1 - k);
  }
}

function trim(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let x1 = w, y1 = h, x2 = -1, y2 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) {
    if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
  }
  return x2 < 0 ? null : [x1, y1, x2, y2];
}

/** Enchantment glint: purple diagonal bands sweeping across the sprite, moving each frame. */
function glint(sheet, w, h, n) {
  const c = new OffscreenCanvas(sheet.width, sheet.height);
  const cx = c.getContext('2d');
  cx.drawImage(sheet, 0, 0);
  const im = cx.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (d[i + 3] < 8) continue;
    const f = Math.floor(x / w), lx = x % w, ly = y % h;
    const band = ((lx + ly * 0.6 + f * (32 / n)) % 22 + 22) % 22;
    shade(d, i, band < 3 ? 1 : band < 5 ? 0.55 : 0.18);
  }
  cx.putImageData(im, 0, 0);
  return c;
}

async function png(canvas) {
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

// job: { parts: [{geo, texture, tint, glow, see, ench, mount, at, rig, sit}], hide, rig, scale, hover, anims: {Name: {n, d}},
//        held, heldPart, heldAt, heldEnch }
//   mount = index of the part this one rides (placed at `at`, model units, on that part's root); rig = its own rig;
//   sit = seated pose; ench = enchantment glint on this part (and heldEnch on the held item).
window.renderMob = async job => {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-0.4, 1, -0.7);
  scene.add(sun);
  const holder = new THREE.Group();
  holder.scale.setScalar(job.scale || 1);
  scene.add(holder);
  const models = [];
  for (const p of job.parts) {
    const m = build(p.geo, await loadTexture(p.texture), job.hide || [], p.tint, p.glow, p.see);
    m.part = p;
    if (p.mount != null) {
      const seatG = new THREE.Group();
      seatG.position.set(-p.at[0], p.at[1], p.at[2]);
      seatG.add(m.root);
      models[p.mount].root.add(seatG);
    } else holder.add(m.root);
    models.push(m);
  }
  if (job.held) {
    const h = attachHeld(models[job.heldPart || 0], await loadTexture(job.held), job.heldAt);
    if (h && job.heldEnch) h.userData.ench = job.heldEnch;
  }
  const glinty = models.some(m => m.part.ench || m.meshes.some(x => x.userData.ench));

  const out = {};
  for (const [anim, spec] of Object.entries(job.anims)) {
    const frames = [];
    let box = null;
    for (let dir = 0; dir < 8; dir++) {
      for (let i = 0; i < spec.n; i++) {
        holder.rotation.y = dir * 45 * DEG;     // dir 0 faces the viewer (Down), then clockwise on screen
        for (const m of models) {
          const p = m.part;
          pose(m, anim, i / spec.n, p.mount != null ? { ...job, rig: p.rig, hover: false } : job);
          if (p.sit) seat(m);
          m.mat.color.copy(m.mat.userData.base);
          if (anim === 'Hurt' && i === 0) m.mat.color.multiply(new THREE.Color(1, 0.45, 0.45));
        }
        renderer.render(scene, camera);
        const cv = new OffscreenCanvas(VIEW, VIEW);
        const cx = cv.getContext('2d');
        cx.drawImage(renderer.domElement, 0, 0);
        if (glinty) glintFrame(cv, glintMask(scene, models), i, spec.n);
        const b = trim(cx, VIEW, VIEW);
        if (b) box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
        frames.push(cv);
      }
    }
    if (!box) throw new Error('empty render for ' + anim);
    // Shared crop for the whole sheet, keeping the feet anchor inside the frame.
    const pad = 1;
    const x1 = Math.min(box[0], ORIGIN[0] - 1) - pad, y1 = box[1] - pad;
    const x2 = Math.max(box[2], ORIGIN[0] + 1) + pad, y2 = Math.max(box[3], ORIGIN[1] + 1) + pad;
    const w = (x2 - x1 + 1) + ((x2 - x1 + 1) % 2), h = (y2 - y1 + 1) + ((y2 - y1 + 1) % 2);
    const sheet = new OffscreenCanvas(w * spec.n, h * 8);
    const sx = sheet.getContext('2d');
    frames.forEach((cv, k) => sx.drawImage(cv, x1, y1, w, h, (k % spec.n) * w, Math.floor(k / spec.n) * h, w, h));
    // Lowest opaque row of Idle frame 0 (for the hover flag, like PokéSurvivor's hover_flags.py).
    let low = 0;
    if (anim === 'Idle') { const bb = trim(sx, w, h); low = bb ? bb[3] : 0; }
    out[anim] = { png: await png(sheet), shiny: await png(glint(sheet, w, h, spec.n)), w, h, n: spec.n, r: 8, d: spec.d,
      ax: ORIGIN[0] - x1 - 0.5, ay: ORIGIN[1] - y1 - 0.5, low };
  }
  return out;
};
window.rendererReady = true;
