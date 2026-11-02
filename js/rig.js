// Procedural rigged character: a real THREE.Skeleton (18 bones) + one THREE.SkinnedMesh
// with per-vertex bone weights. Animation is applied ONLY by rotating bones (AnimationMixer),
// never by tilting/skewing a flat picture. Stylised caricature, NOT a photoreal scan.
import * as THREE from './vendor/three.min.js';

export const BONE_DEFS = [
  // name, parent, bind-pose offset from parent (metres, character faces +X, up +Y, right-hand side = +Z)
  ['root', null, [0, 0, 0]],
  ['hips', 'root', [0, 0.98, 0]],
  ['spine', 'hips', [0, 0.12, 0]],
  ['chest', 'spine', [0, 0.2, 0]],
  ['neck', 'chest', [0, 0.28, 0]],
  ['head', 'neck', [0, 0.1, 0]],
  ['uArmL', 'chest', [0, 0.22, -0.2]], ['fArmL', 'uArmL', [0, -0.3, 0]], ['handL', 'fArmL', [0, -0.27, 0]],
  ['uArmR', 'chest', [0, 0.22, 0.2]], ['fArmR', 'uArmR', [0, -0.3, 0]], ['handR', 'fArmR', [0, -0.27, 0]],
  ['thighL', 'hips', [0, -0.02, -0.1]], ['shinL', 'thighL', [0, -0.44, 0]], ['footL', 'shinL', [0, -0.44, 0]],
  ['thighR', 'hips', [0, -0.02, 0.1]], ['shinR', 'thighR', [0, -0.44, 0]], ['footR', 'shinR', [0, -0.44, 0]],
];
export const BONE_NAMES = BONE_DEFS.map((b) => b[0]);
const IDX = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i]));

const SEG = 16;

function col(hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }

// Builds one merged tube geometry from rings. Every ring carries its own bone weights,
// so joints (elbow, knee, waist, shoulder) deform smoothly.
function buildBody(rings) {
  const pos = [], colr = [], si = [], sw = [], idx = [];
  for (const tube of rings) {
    const base = pos.length / 3;
    for (const r of tube) {
      const ws = r.w.slice(0, 4);
      for (let k = 0; k < SEG; k++) {
        const a = (k / SEG) * Math.PI * 2;
        pos.push(r.cx + Math.cos(a) * r.rx, r.y, r.cz + Math.sin(a) * r.rz);
        colr.push(...r.c);
        const ii = [0, 0, 0, 0], ww = [0, 0, 0, 0];
        ws.forEach(([n, w], j) => { ii[j] = IDX[n]; ww[j] = w; });
        si.push(...ii); sw.push(...ww);
      }
    }
    for (let i = 0; i < tube.length - 1; i++) {
      for (let k = 0; k < SEG; k++) {
        const a = base + i * SEG + k, b = base + i * SEG + ((k + 1) % SEG);
        const c = a + SEG, d = b + SEG;
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const R = (y, rx, rz, w, c, cx = 0, cz = 0) => ({ y, rx, rz, w, c, cx, cz });

export function createCharacter(spec) {
  const sk = col(spec.skin), jk = col(spec.suit), tr = col(spec.trousers), gl = col(spec.glove);
  const bulk = spec.bulk ?? 1, belly = spec.belly ?? 0;

  const tubes = [];
  // Torso (hips -> chest) including jacket
  tubes.push([
    R(0.86, 0.001, 0.001, [['hips', 1]], tr),
    R(0.88, 0.12 * bulk, 0.15 * bulk, [['hips', 1]], tr),
    R(0.98, 0.15 * bulk, 0.2 * bulk, [['hips', 1]], tr),
    R(1.08, (0.145 + belly * 0.4) * bulk, 0.19 * bulk, [['hips', 0.5], ['spine', 0.5]], jk),
    R(1.2, (0.14 + belly) * bulk, 0.185 * bulk, [['spine', 1]], jk),
    R(1.3, 0.15 * bulk, 0.21 * bulk, [['spine', 0.5], ['chest', 0.5]], jk),
    R(1.42, 0.165 * bulk, 0.24 * bulk, [['chest', 1]], jk),
    R(1.52, 0.15 * bulk, 0.27 * bulk, [['chest', 1]], jk),
    R(1.58, 0.09, 0.16 * bulk, [['chest', 0.5], ['neck', 0.5]], jk),
    R(1.6, 0.075, 0.1, [['chest', 0.4], ['neck', 0.6]], sk),
    R(1.605, 0.001, 0.001, [['neck', 1]], sk),
  ]);
  // Neck
  tubes.push([
    R(1.5, 0.001, 0.001, [['chest', 1]], sk),
    R(1.56, 0.066 * bulk, 0.066 * bulk, [['chest', 0.5], ['neck', 0.5]], sk),
    R(1.64, 0.056 * bulk, 0.056 * bulk, [['neck', 1]], sk),
    R(1.72, 0.052, 0.052, [['neck', 0.4], ['head', 0.6]], sk),
    R(1.78, 0.001, 0.001, [['head', 1]], sk),
  ]);
  for (const s of [-1, 1]) {
    const L = s < 0 ? 'L' : 'R', cz = s * 0.2;
    const u = 'uArm' + L, f = 'fArm' + L, h = 'hand' + L, t = 'thigh' + L, sh = 'shin' + L, ft = 'foot' + L;
    tubes.push([
      R(1.6, 0.001, 0.001, [[u, 1]], jk, 0, cz),
      R(1.56, 0.05, 0.05, [[u, 0.8], ['chest', 0.2]], jk, 0, cz),
      R(1.52, 0.08 * bulk, 0.08 * bulk, [[u, 0.75], ['chest', 0.25]], jk, 0, cz),
      R(1.4, 0.072 * bulk, 0.072 * bulk, [[u, 1]], jk, 0, cz),
      R(1.28, 0.062 * bulk, 0.062 * bulk, [[u, 1]], jk, 0, cz),
      R(1.22, 0.058 * bulk, 0.058 * bulk, [[u, 0.5], [f, 0.5]], jk, 0, cz),
      R(1.12, 0.056 * bulk, 0.056 * bulk, [[f, 1]], jk, 0, cz),
      R(1.02, 0.048, 0.048, [[f, 1]], jk, 0, cz),
      R(0.95, 0.045, 0.045, [[f, 0.5], [h, 0.5]], jk, 0, cz),
      R(0.9, 0.04, 0.04, [[h, 1]], gl, 0, cz),
      R(0.88, 0.001, 0.001, [[h, 1]], gl, 0, cz),
    ]);
    const lz = s * 0.1;
    tubes.push([
      R(1.0, 0.105 * bulk, 0.105 * bulk, [['hips', 0.6], [t, 0.4]], tr, 0, lz),
      R(0.92, 0.1 * bulk, 0.1 * bulk, [[t, 1]], tr, 0, lz),
      R(0.75, 0.088 * bulk, 0.088 * bulk, [[t, 1]], tr, 0, lz),
      R(0.6, 0.072 * bulk, 0.072 * bulk, [[t, 1]], tr, 0, lz),
      R(0.52, 0.062, 0.062, [[t, 0.5], [sh, 0.5]], tr, 0, lz),
      R(0.38, 0.062, 0.062, [[sh, 1]], tr, 0, lz),
      R(0.22, 0.05, 0.05, [[sh, 1]], tr, 0, lz),
      R(0.12, 0.043, 0.043, [[sh, 1]], tr, 0, lz),
      R(0.08, 0.042, 0.042, [[sh, 0.5], [ft, 0.5]], tr, 0, lz),
      R(0.03, 0.04, 0.04, [[ft, 1]], tr, 0, lz),
      R(0.02, 0.001, 0.001, [[ft, 1]], tr, 0, lz),
    ]);
  }

  const geometry = buildBody(tubes);
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 });

  // ---- skeleton (bones in bind pose) ----
  const bones = BONE_DEFS.map(([name, , off]) => { const b = new THREE.Bone(); b.name = name; b.position.set(...off); return b; });
  BONE_DEFS.forEach(([, parent], i) => { if (parent) bones[IDX[parent]].add(bones[i]); });
  const mesh = new THREE.SkinnedMesh(geometry, bodyMat);
  mesh.name = spec.id + '_body';
  mesh.add(bones[0]);
  mesh.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  mesh.frustumCulled = false;
  mesh.castShadow = true; mesh.receiveShadow = true;

  const B = (n) => bones[IDX[n]];
  const mat = (hex, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });
  const part = (geo, m, parent, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz);
    o.castShadow = true; parent.add(o); return o;
  };
  const sph = new THREE.SphereGeometry(1, 20, 14);
  const box = new THREE.BoxGeometry(1, 1, 1);

  // gloves (rigid on hand bones — they follow the forearm exactly)
  const gloveM = mat(spec.glove, 0.45, 0.05), cuffM = mat(0xf2f2f2, 0.8);
  for (const L of ['L', 'R']) {
    part(sph, gloveM, B('hand' + L), 0, -0.075, 0, 0.095, 0.1, 0.09);
    part(sph, gloveM, B('hand' + L), 0.045, -0.095, 0.0, 0.05, 0.05, 0.05); // thumb bulge
    part(box, cuffM, B('hand' + L), 0, -0.012, 0, 0.1, 0.03, 0.1);
  }
  // shoes
  const shoeM = mat(0x15151a, 0.5, 0.1);
  for (const L of ['L', 'R']) part(box, shoeM, B('foot' + L), 0.075, -0.04, 0, 0.27, 0.08, 0.115);

  // head, face, hair (rigid on head bone)
  const hd = spec.head, skinM = mat(spec.skin, 0.55);
  const head = B('head');
  const headMesh = part(sph, skinM, head, 0, 0.115, 0, hd.rx, hd.ry, hd.rz);
  const jawMesh = part(sph, skinM, head, 0.012, 0.045, 0, hd.rx * 0.88, hd.ry * 0.62, hd.rz * 0.92); // jaw/chin volume
  for (const z of [-1, 1]) part(sph, skinM, head, 0, 0.12, z * (hd.rz + 0.005), 0.018, 0.034, 0.012); // ears
  const faceParts = [];
  const _p = part;
  const eyeW = mat(0xfafafa, 0.3), eyeD = mat(0x1b1b1b, 0.2), browM = mat(spec.brow, 0.8);
  for (const z of [-1, 1]) {
    faceParts.push(part(sph, eyeW, head, hd.rx * 0.82, 0.14, z * 0.038, 0.016, 0.012, 0.02));
    faceParts.push(part(sph, eyeD, head, hd.rx * 0.82 + 0.01, 0.14, z * 0.038, 0.007, 0.008, 0.009));
    const brow = part(box, browM, head, hd.rx * 0.8, 0.168, z * 0.04, 0.012, 0.008, 0.045, 0, 0, 0); brow.rotation.x = z * -0.18; faceParts.push(brow);
  }
  faceParts.push(part(box, skinM, head, hd.rx + 0.006, 0.105, 0, 0.03, 0.05, 0.026, 0, 0, -0.25)); // nose
  faceParts.push(part(box, mat(0x6e2d2d, 0.6), head, hd.rx * 0.78, 0.062, 0, 0.012, 0.011, 0.06)); // mouth
  const hairM = mat(spec.hair, 0.55);
  if (spec.hairStyle === 'swoop') {
    part(sph, hairM, head, -0.012, 0.185, 0, hd.rx * 1.06, 0.07, hd.rz * 1.06);
    part(sph, hairM, head, 0.075, 0.222, 0, 0.1, 0.034, 0.1, 0, 0, -0.18); // front swept volume
    part(sph, hairM, head, -0.07, 0.12, 0, 0.05, 0.075, hd.rz * 1.04);
  } else {
    part(sph, hairM, head, -0.035, 0.19, 0, hd.rx * 0.92, 0.05, hd.rz * 0.97); // receding, short
    part(sph, hairM, head, -0.07, 0.125, 0, 0.04, 0.07, hd.rz * 1.0);
  }

  // shirt V and tie (rigid on chest)
  const chest = B('chest');
  part(box, mat(0xf4f4f4, 0.8), chest, 0.158 * bulk + 0.005, 0.1, 0, 0.012, 0.3, 0.1);
  part(box, mat(spec.tie, 0.5), chest, 0.158 * bulk + 0.018 + belly * 0.5, spec.tieLen * -0.5 + 0.2, 0, 0.012, spec.tieLen, 0.05);

  const root = new THREE.Group();
  root.name = spec.id;
  root.add(mesh);
  if (spec.scale) root.scale.setScalar(spec.scale);
  // Optional photo face: projected planar onto a front shell of the head ellipsoid (feathered edge).
  // `img` is supplied by the project owner (assets/faces/*.jpg); nothing is bundled or downloaded here.
  let facePatch = null;
  function setFace(img, crop = {}) {
    const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const g = cv.getContext('2d');
    const cw = (crop.w ?? 1) * img.width, ch = (crop.h ?? 1) * img.height;
    const side = Math.min(cw, ch);
    const cx = (crop.cx ?? 0.5) * img.width, cy = (crop.cy ?? 0.5) * img.height;
    g.drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, N, N);
    g.globalCompositeOperation = 'destination-in';
    const grd = g.createRadialGradient(N / 2, N / 2, N * 0.22, N / 2, N / 2, N * 0.5);
    grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, N, N);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const geo = new THREE.SphereGeometry(1, 40, 30, Math.PI - 1.15, 2.3, 0.3, Math.PI - 0.6);
    const P = geo.attributes.position, UV = geo.attributes.uv;
    for (let i = 0; i < P.count; i++) { UV.setXY(i, 0.5 - 0.5 * P.getZ(i) / 0.92, 0.5 + 0.5 * P.getY(i) / 0.95); }
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    if (facePatch) { head.remove(facePatch); }
    facePatch = new THREE.Mesh(geo, m);
    facePatch.position.set(0, 0.115, 0); facePatch.scale.set(hd.rx * 1.02, hd.ry * 1.02, hd.rz * 1.02);
    head.add(facePatch);
    faceParts.forEach((o) => { o.visible = false; });
    // photo faces need a taller skull so the mouth/chin lie inside the projected patch
    jawMesh.visible = false; headMesh.scale.set(hd.rx, hd.ry * 1.16, hd.rz); headMesh.position.y = 0.1;
    facePatch.scale.set(hd.rx * 1.02, hd.ry * 1.16 * 1.02, hd.rz * 1.02); facePatch.position.y = 0.1;
  }

  return { setFace, group: root, mesh, bones, skeleton, boneMap: Object.fromEntries(BONE_NAMES.map((n, i) => [n, bones[i]])) };
}
