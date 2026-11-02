// Hand-authored skeletal animation. Every clip is a set of QuaternionKeyframeTracks (one per bone)
// plus position tracks for root/hips, played by THREE.AnimationMixer. Nothing here rotates a sprite or image.
// Trump and Putin each get their OWN clips (timing, amplitude, reach, stance) built from their own spec.
import * as THREE from './vendor/three.min.js';
import { BONE_NAMES, BONE_DEFS } from './rig.js';

const D2R = Math.PI / 180;
const FPS = 30;
const HIPS_Y = BONE_DEFS.find((b) => b[0] === 'hips')[2][1];

// Orthodox guard (lead = LEFT, character faces +X, right side = +Z). Euler order YXZ, degrees.
// Southpaw characters are produced by mirroring this pose across the sagittal plane.
const GUARD = {
  root: [0, 0, 0], hips: [0, -14, 0], spine: [0, -8, -5], chest: [0, -8, -4], neck: [0, 10, 5], head: [0, 8, 2],
  uArmL: [10, 0, 40], fArmL: [0, 0, 104], handL: [0, 0, 0],
  uArmR: [-16, 0, 30], fArmR: [0, 0, 118], handR: [0, 0, 0],
  thighL: [0, 0, 22], shinL: [0, 0, -34], footL: [0, 0, 12],
  thighR: [0, 0, -8], shinR: [0, 0, -26], footR: [0, 0, 34],
  rootPos: [0, 0, 0], hipsPos: [0, -0.06, 0],
};

const clone = (p) => JSON.parse(JSON.stringify(p));
const swapLR = (n) => (/L$/.test(n) ? n.slice(0, -1) + 'R' : /R$/.test(n) ? n.slice(0, -1) + 'L' : n);

function mirror(p) {
  const o = {};
  for (const k of Object.keys(p)) {
    if (k === 'rootPos' || k === 'hipsPos') o[k] = [p[k][0], p[k][1], -p[k][2]];
    else o[swapLR(k)] = [-p[k][0], -p[k][1], p[k][2]];
  }
  return o;
}

const EASE = {
  io: (t) => t * t * (3 - 2 * t),
  out: (t) => 1 - (1 - t) * (1 - t) * (1 - t),
  in: (t) => t * t * t,
  lin: (t) => t,
};

// keys: [{t, p: partial pose overrides, e: easing used while arriving at this key}]
function sampleClip(name, keys, base, southpaw, loop = false) {
  const full = keys.map((k) => { const p = clone(base); Object.assign(p, clone(k.p || {})); return { t: k.t, e: k.e || 'io', p: southpaw ? mirror(p) : p }; });
  const dur = full[full.length - 1].t;
  const n = Math.max(2, Math.round(dur * FPS) + 1);
  const times = [], qv = {}, pv = { root: [], hips: [] };
  BONE_NAMES.forEach((b) => (qv[b] = []));
  const q = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, 'YXZ');
  for (let i = 0; i < n; i++) {
    const t = Math.min(dur, i / FPS);
    times.push(t);
    let s = 0;
    while (s < full.length - 2 && t > full[s + 1].t) s++;
    const A = full[s], B = full[s + 1];
    const u = B.t === A.t ? 1 : Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t)));
    const w = (EASE[B.e] || EASE.io)(u);
    const lerp = (a, b) => a + (b - a) * w;
    for (const b of BONE_NAMES) {
      const a = A.p[b] || [0, 0, 0], c = B.p[b] || [0, 0, 0];
      eu.set(lerp(a[0], c[0]) * D2R, lerp(a[1], c[1]) * D2R, lerp(a[2], c[2]) * D2R, 'YXZ');
      q.setFromEuler(eu);
      qv[b].push(q.x, q.y, q.z, q.w);
    }
    const rp = [0, 1, 2].map((j) => lerp(A.p.rootPos[j], B.p.rootPos[j]));
    const hp = [0, 1, 2].map((j) => lerp(A.p.hipsPos[j], B.p.hipsPos[j]));
    pv.root.push(rp[0], rp[1], rp[2]);
    pv.hips.push(hp[0], HIPS_Y + hp[1], hp[2]);
  }
  if (loop) { // guarantee seamless loop
    for (const b of BONE_NAMES) for (let j = 0; j < 4; j++) qv[b][qv[b].length - 4 + j] = qv[b][j];
    for (const k of ['root', 'hips']) for (let j = 0; j < 3; j++) pv[k][pv[k].length - 3 + j] = pv[k][j];
  }
  const tracks = BONE_NAMES.map((b) => new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, qv[b]));
  tracks.push(new THREE.VectorKeyframeTrack('root.position', times, pv.root));
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, pv.hips));
  return new THREE.AnimationClip(name, dur, tracks);
}

// ---- per-character clip sets ---------------------------------------------------------------
// a: personality parameters (tempo = time scale, reach/lunge/hook yaw = amplitude, headYaw = side the head turns on a hook)
export function buildClips(spec) {
  const a = spec.anim, S = spec.lead === 'R', T = a.tempo;
  const G = clone(GUARD);
  Object.assign(G, a.guard || {});
  const clips = {}, meta = {};
  const mk = (name, keys, opts = {}) => {
    const k = keys.map((x) => ({ ...x, t: +(x.t * (opts.noTempo ? 1 : T)).toFixed(4) }));
    clips[name] = sampleClip(name, k, G, S, opts.loop);
    return clips[name];
  };

  // GUARD — looping breathing/weight-shift stance. This is NOT an attack: it plays whenever nothing happens.
  mk('guard', [
    { t: 0, p: {} },
    { t: 0.6, p: { chest: [0, -8, -2], spine: [0, -8, -4], head: [0, 8, 0], hipsPos: [0, -0.075, 0], uArmL: [10, 0, 43], uArmR: [-16, 0, 33], rootPos: [0.012, 0, 0] } },
    { t: 1.2, p: {} },
  ], { loop: true, noTempo: true });

  // JAB — lead straight: hip/shoulder drive, arm extends from the shoulder, rear hand stays at the chin
  const jab = a.jab;
  mk('jab', [
    { t: 0, p: {} },
    { t: 0.09, p: { hipsPos: [0, -0.09, 0], rootPos: [-0.02, 0, 0], uArmL: [10, 0, 34], fArmL: [0, 0, 122], chest: [0, -4, -4], head: [0, 10, 4] } },
    { t: 0.2, e: 'out', p: { hips: [0, -20, 0], spine: [0, -10, -8], chest: [0, -12, jab.lean], neck: [0, 16, 7], head: [0, 14, -3], uArmL: [jab.armX, jab.yaw, jab.shoulder], fArmL: [0, 0, jab.elbow], rootPos: [jab.lunge, 0, 0], hipsPos: [0, jab.drop, 0], thighL: [0, 0, 32], shinL: [0, 0, -36], thighR: [0, 0, -16], shinR: [0, 0, -34], footR: [0, 0, 46] } },
    { t: 0.27, e: 'lin', p: { hips: [0, -21, 0], spine: [0, -10, -8], chest: [0, -13, jab.lean], neck: [0, 16, 7], head: [0, 14, -3], uArmL: [jab.armX, jab.yaw, jab.shoulder + 2], fArmL: [0, 0, jab.elbow], rootPos: [jab.lunge + 0.02, 0, 0], hipsPos: [0, jab.drop, 0], thighL: [0, 0, 32], shinL: [0, 0, -36], thighR: [0, 0, -16], shinR: [0, 0, -34], footR: [0, 0, 46] } },
    { t: 0.42, p: { uArmL: [10, 0, 46], fArmL: [0, 0, 112], rootPos: [0.03, 0, 0], hipsPos: [0, -0.08, 0] } },
    { t: 0.58, p: {} },
  ]);
  meta.jab = { contact: 0.2 * T, duration: 0.58 * T, hand: S ? 'handR' : 'handL' };

  // CROSS-HOOK (croșeu) — rear hand: wind-up with torso rotation, then a horizontal arc driven by hips + trunk
  const hook = a.hook;
  const rear = 'R'; // authored for orthodox; the mirror handles southpaw
  mk('hook', [
    { t: 0, p: {} },
    { t: hook.wind, p: { hipsPos: [0, -0.13, 0], rootPos: [-0.03, 0, 0], hips: [0, -34, 0], spine: [0, -20, -6], chest: [0, -28, -5], neck: [0, 28, 6], head: [0, 26, 3], uArmL: [8, 0, 44], fArmL: [0, 0, 118], uArmR: [hook.armX - 2, hook.windYaw, 0], fArmR: [0, 0, 98], thighR: [0, 0, -10], shinR: [0, 0, -30], footR: [0, 0, 40] } },
    { t: hook.contact, e: 'in', p: { hipsPos: [0, hook.drop, 0], rootPos: [hook.lunge, 0, 0], hips: [0, hook.hipYaw, 0], spine: [0, hook.spineYaw, -6], chest: [0, hook.chestYaw, hook.lean], neck: [0, -22, 6], head: [0, -26, -2], uArmL: [8, 0, 40], fArmL: [0, 0, 112], uArmR: [hook.armX, hook.armYaw, 0], fArmR: [0, 0, hook.elbow], thighL: [0, 0, 16], shinL: [0, 0, -30], thighR: [0, 0, -24], shinR: [0, 0, -52], footR: [0, 0, 62] } },
    { t: hook.contact + 0.1, e: 'lin', p: { hipsPos: [0, hook.drop, 0], rootPos: [hook.lunge + 0.03, 0, 0], hips: [0, hook.hipYaw + 4, 0], spine: [0, hook.spineYaw + 3, -6], chest: [0, hook.chestYaw + 5, hook.lean], neck: [0, -24, 6], head: [0, -28, -2], uArmL: [8, 0, 40], fArmL: [0, 0, 112], uArmR: [hook.armX, hook.armYaw + 8, 0], fArmR: [0, 0, hook.elbow], thighL: [0, 0, 16], shinL: [0, 0, -30], thighR: [0, 0, -24], shinR: [0, 0, -52], footR: [0, 0, 62] } },
    { t: hook.end - 0.18, p: { uArmR: [-30, 0, 34], fArmR: [0, 0, 112], rootPos: [0.04, 0, 0], hips: [0, -20, 0], chest: [0, -12, -4], spine: [0, -9, -5] } },
    { t: hook.end, p: {} },
  ]);
  meta.hook = { contact: hook.contact * T, duration: hook.end * T, hand: S ? 'handL' : 'handR' };

  // IMPACT (light, from jab): head snaps back along the punch line, trunk folds, small step back
  const im = a.impact;
  mk('impactLight', [
    { t: 0, p: {} },
    { t: 0.07, e: 'out', p: { head: [-8, 2, -im.snap], neck: [0, 6, im.snap * 0.5], chest: [0, -6, 6], spine: [0, -8, 4], hipsPos: [-0.03, -0.07, 0], rootPos: [-im.step, 0, 0], uArmL: [10, 0, 30], uArmR: [-16, 0, 20], fArmL: [0, 0, 92] } },
    { t: 0.22, p: { head: [0, 8, 6], neck: [0, 10, 8], hipsPos: [0, -0.08, 0], rootPos: [-im.step * 0.8, 0, 0] } },
    { t: 0.5, p: { rootPos: [-im.step * 0.4, 0, 0] } },
  ]);
  meta.impactLight = { duration: 0.5 * T };

  // IMPACT (heavy, from hook): head whips sideways (yaw sign depends on which side the punch comes from), stagger
  const ys = a.headYawSign;
  mk('impactHeavy', [
    { t: 0, p: {} },
    { t: 0.09, e: 'out', p: { head: [0, ys * 52, 10], neck: [0, ys * 30, 8], chest: [0, -8 + ys * 10, 10], spine: [0, -8 + ys * 8, 6], hips: [0, -14 - ys * 8, 0], hipsPos: [-0.04, -0.12, 0], rootPos: [-im.step * 1.6, 0, 0], uArmL: [10, 0, 22], uArmR: [-30, 0, 18], fArmL: [0, 0, 70], fArmR: [0, 0, 80] } },
    { t: 0.3, p: { head: [0, ys * 22, 4], neck: [0, ys * 12, 4], hipsPos: [-0.02, -0.14, 0], rootPos: [-im.step * 2, 0, 0], uArmL: [10, 0, 34], fArmL: [0, 0, 100], uArmR: [-18, 0, 28], fArmR: [0, 0, 110] } },
    { t: 0.55, p: { rootPos: [-im.step * 1.6, 0, 0], hipsPos: [0, -0.1, 0] } },
    { t: 0.8, p: { rootPos: [-im.step * 0.8, 0, 0] } },
  ]);
  meta.impactHeavy = { duration: 0.8 * T };

  // KO — buckle, fall backwards (root pitched through 90°), settle on the canvas
  const ko = a.ko;
  mk('ko', [
    { t: 0, p: {} },
    { t: 0.1, e: 'out', p: { head: [0, ys * 55, 14], neck: [0, ys * 30, 10], chest: [0, -4, 8], spine: [0, -6, 5], hipsPos: [-0.04, -0.12, 0], rootPos: [-0.1, 0, 0], uArmL: [10, 0, 24], uArmR: [-18, 0, 20], fArmL: [0, 0, 60], fArmR: [0, 0, 70] } },
    { t: 0.5, p: { head: [0, ys * 25, 6], neck: [0, ys * 12, 4], chest: [0, 0, -14], spine: [0, 0, -12], hips: [0, -6, 0], hipsPos: [-0.12, -0.34, 0], rootPos: [-0.18, 0, 0], thighL: [0, 0, 56], shinL: [0, 0, -106], footL: [0, 0, 50], thighR: [0, 0, 50], shinR: [0, 0, -100], footR: [0, 0, 50], uArmL: [14, 0, 14], uArmR: [-14, 0, 12], fArmL: [0, 0, 25], fArmR: [0, 0, 22] } },
    { t: 1.15, e: 'in', p: { root: [0, 0, 88], head: [0, 0, 0], neck: [0, 0, -6], chest: [0, 0, 0], spine: [0, 0, 0], hips: [0, 0, 0], hipsPos: [0, -0.1, 0], rootPos: [ko.slide, 0.17, 0], thighL: [0, 0, 22], shinL: [0, 0, -50], footL: [0, 0, 30], thighR: [0, 0, 8], shinR: [0, 0, -34], footR: [0, 0, 40], uArmL: [30, 0, 8], uArmR: [-30, 0, 8], fArmL: [0, 0, 12], fArmR: [0, 0, 12] } },
    { t: 1.3, e: 'out', p: { root: [0, 0, 85], head: [0, 0, 8], neck: [0, 0, 6], hipsPos: [0, -0.1, 0], rootPos: [ko.slide - 0.03, 0.2, 0], thighL: [0, 0, 22], shinL: [0, 0, -50], footL: [0, 0, 30], thighR: [0, 0, 8], shinR: [0, 0, -34], footR: [0, 0, 40], uArmL: [38, 0, 8], uArmR: [-38, 0, 8], fArmL: [0, 0, 12], fArmR: [0, 0, 12] } },
    { t: 1.6, p: { root: [0, 0, 89], head: [0, 0, 0], neck: [0, 0, -4], hipsPos: [0, -0.1, 0], rootPos: [ko.slide - 0.02, 0.17, 0], thighL: [0, 0, 18], shinL: [0, 0, -44], footL: [0, 0, 30], thighR: [0, 0, 6], shinR: [0, 0, -28], footR: [0, 0, 40], uArmL: [44, 0, 8], uArmR: [-44, 0, 8], fArmL: [0, 0, 12], fArmR: [0, 0, 12] } },
    { t: 1.8, p: { root: [0, 0, 89], head: [0, 0, 0], neck: [0, 0, -4], hipsPos: [0, -0.1, 0], rootPos: [ko.slide - 0.02, 0.17, 0], thighL: [0, 0, 18], shinL: [0, 0, -44], footL: [0, 0, 30], thighR: [0, 0, 6], shinR: [0, 0, -28], footR: [0, 0, 40], uArmL: [44, 0, 8], uArmR: [-44, 0, 8], fArmL: [0, 0, 12], fArmR: [0, 0, 12] } },
  ], { noTempo: true });
  meta.ko = { duration: 1.8 };

  // VICTORY — arms raised, small bounce (loop, only after a round is decided)
  const vic = { uArmL: [24, 0, 158], uArmR: [-24, 0, 158], fArmL: [0, 0, 24], fArmR: [0, 0, 24], chest: [0, 0, 0], spine: [0, 0, 0], hips: [0, 0, 0], head: [0, 0, -4], neck: [0, 0, 0], thighL: [0, 0, 6], shinL: [0, 0, -12], footL: [0, 0, 6], thighR: [0, 0, 6], shinR: [0, 0, -12], footR: [0, 0, 6] };
  mk('victory', [
    { t: 0, p: { ...vic, hipsPos: [0, -0.02, 0] } },
    { t: 0.5, p: { ...vic, hipsPos: [0, 0.03, 0], uArmL: [24, 0, 150], uArmR: [-24, 0, 150], head: [0, 0, -8] } },
    { t: 1.0, p: { ...vic, hipsPos: [0, -0.02, 0] } },
  ], { loop: true, noTempo: true });

  return { clips, meta };
}

export { GUARD };
