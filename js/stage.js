// WebGL stage: ring, lights, crowd, camera framing, hit sparks.
import * as THREE from './vendor/three.min.js';

export const FIGHTER_X = 0.5; // distance of each fighter from ring centre

function canvasTexture(draw, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b18);
  scene.fog = new THREE.Fog(0x070b18, 7, 16);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  const camRig = { shake: 0, base: new THREE.Vector3(), look: new THREE.Vector3(0, 1.0, 0) };

  // lights
  scene.add(new THREE.HemisphereLight(0x9db8ff, 0x3a2a36, 1.25));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
  key.position.set(1.5, 5, 3.2); key.target.position.set(0, 0.8, 0);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -2, near: 1, far: 12 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rimR = new THREE.DirectionalLight(0xff3d5e, 1.1); rimR.position.set(-4, 2.5, -2); scene.add(rimR);
  const rimB = new THREE.DirectionalLight(0x3d8bff, 1.1); rimB.position.set(4, 2.5, -2); scene.add(rimB);

  // ring floor (procedural canvas texture, not a photo)
  const floorTex = canvasTexture((g, w, h) => {
    g.fillStyle = '#2a3350'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff22'; g.lineWidth = 3;
    for (let i = 0; i < 18; i++) { g.beginPath(); g.moveTo(0, (i / 18) * h); g.lineTo(w, (i / 18) * h + 6); g.stroke(); }
    g.fillStyle = '#d4172e'; g.fillRect(0, 0, w * 0.5, 14); g.fillRect(0, h - 14, w * 0.5, 14);
    g.fillStyle = '#2468e6'; g.fillRect(w * 0.5, 0, w * 0.5, 14); g.fillRect(w * 0.5, h - 14, w * 0.5, 14);
    g.fillStyle = '#ffffff1a'; g.beginPath(); g.arc(w / 2, h / 2, h * 0.3, 0, 7); g.fill();
    g.strokeStyle = '#ffd98a'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, h * 0.3, 0, 7); g.stroke();
    g.fillStyle = '#ffd98a'; g.font = '900 ' + h * 0.17 + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VS', w / 2, h / 2 + 4);
  }, 1024, 700);
  const RING_W = 4.6, RING_D = 3.2;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(RING_W, 0.3, RING_D), [
    new THREE.MeshStandardMaterial({ color: 0x141a2c }), new THREE.MeshStandardMaterial({ color: 0x141a2c }),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x0a0e1a }),
    new THREE.MeshStandardMaterial({ color: 0x141a2c }), new THREE.MeshStandardMaterial({ color: 0x141a2c }),
  ]);
  floor.position.y = -0.15; floor.receiveShadow = true; scene.add(floor);
  // apron
  const apron = new THREE.Mesh(new THREE.BoxGeometry(RING_W + 1.4, 0.2, RING_D + 1.4), new THREE.MeshStandardMaterial({ color: 0x0d1220, roughness: 1 }));
  apron.position.y = -0.4; scene.add(apron);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x05070f, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52; scene.add(ground);

  // posts + ropes (back and both sides only: the camera side stays clear)
  const postM = new THREE.MeshStandardMaterial({ color: 0x80869a, metalness: 0.6, roughness: 0.4 });
  const ropeCols = [0xd4172e, 0xf0f0f0, 0x2468e6];
  const hx = RING_W / 2 - 0.08, hz = RING_D / 2 - 0.08;
  for (const [x, z, c] of [[-hx, -hz, 0xd4172e], [hx, -hz, 0x2468e6], [-hx, hz, 0xd4172e], [hx, hz, 0x2468e6]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 12), postM); p.position.set(x, 0.7, z); p.castShadow = true; scene.add(p);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })); pad.position.set(x, 0.95, z); scene.add(pad);
  }
  const rope = (x1, z1, x2, z2, y, color) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    m.rotation.z = Math.PI / 2; m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    scene.add(m);
  };
  [0.5, 0.85, 1.2].forEach((y, i) => {
    rope(-hx, -hz, hx, -hz, y, ropeCols[i]);
    const side = (x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, hz * 2, 8), new THREE.MeshStandardMaterial({ color: ropeCols[i], roughness: 0.5 })); m.rotation.x = Math.PI / 2; m.position.set(x, y, 0); scene.add(m); };
    side(-hx); side(hx);
  });

  // crowd: instanced silhouettes on tiers + a few light beams (cheap, no postprocessing)
  const crowdGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const CROWD = 360, crowd = new THREE.InstancedMesh(crowdGeo, new THREE.MeshStandardMaterial({ color: 0x1a2038, roughness: 1 }), CROWD);
  const mtx = new THREE.Matrix4(), cc = new THREE.Color();
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < CROWD; i++) {
    const row = Math.floor(i / 60), col = i % 60;
    const x = -9 + col * 0.3 + rnd() * 0.12, y = 0.2 + row * 0.55 + rnd() * 0.06, z = -4.2 - row * 0.7;
    mtx.makeTranslation(x, y, z); crowd.setMatrixAt(i, mtx);
    cc.setHSL(0.6 + rnd() * 0.15, 0.3, 0.1 + rnd() * 0.12); crowd.setColorAt(i, cc);
  }
  scene.add(crowd);
  const beamM = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const x of [-1.8, 0, 1.8]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.2, 7, 24, 1, true), beamM);
    b.position.set(x, 3.6, -0.3); scene.add(b);
  }

  // hit sparks (pooled)
  const sparkGeo = new THREE.SphereGeometry(0.025, 6, 5);
  const sparks = [];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffd36e, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; scene.add(m); sparks.push({ m, v: new THREE.Vector3(), life: 0 });
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.visible = false; scene.add(ring);
  let ringLife = 0;

  function burst(pos, power, tint) {
    let n = power > 1.5 ? 28 : 14;
    for (const s of sparks) {
      if (n-- <= 0) break;
      s.life = 0.35 + Math.random() * 0.35; s.m.visible = true; s.m.position.copy(pos);
      s.v.set((Math.random() - 0.5) * 3, Math.random() * 2.2, (Math.random() - 0.3) * 3).multiplyScalar(0.6 + power * 0.4);
      s.m.material.color.setHex(Math.random() < 0.5 ? 0xffd36e : tint);
    }
    ring.position.copy(pos); ring.visible = true; ringLife = 0.25; ring.scale.setScalar(0.5);
    ring.lookAt(camera.position);
    camRig.shake = Math.max(camRig.shake, 0.012 * power);
  }

  // framing: keeps both fighters + the KO fall area visible in a portrait phone viewport
  let aspect = 1;
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    renderer.setSize(w, h, false);
    aspect = w / h; camera.aspect = aspect;
    const needW = 3.7, needH = 2.35; // metres of ring that must stay in view
    const vf = THREE.MathUtils.degToRad(camera.fov);
    const distH = needH / 2 / Math.tan(vf / 2);
    const distW = needW / 2 / (Math.tan(vf / 2) * aspect);
    const dist = Math.max(distH, distW);
    camRig.base.set(0.0, 1.55, dist * 0.98 + 0.3);
    camera.position.copy(camRig.base);
    camRig.look.set(0, 0.92, 0);
    camera.lookAt(camRig.look);
    camera.updateProjectionMatrix();
  }

  function update(dt) {
    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.life -= dt; s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt);
      s.m.material.opacity = Math.max(0, s.life * 2.5);
      if (s.life <= 0) s.m.visible = false;
    }
    if (ringLife > 0) { ringLife -= dt; ring.scale.multiplyScalar(1 + dt * 9); ring.material.opacity = Math.max(0, ringLife * 4); if (ringLife <= 0) ring.visible = false; }
    if (camRig.shake > 0) {
      camera.position.set(camRig.base.x + (Math.random() - 0.5) * camRig.shake, camRig.base.y + (Math.random() - 0.5) * camRig.shake, camRig.base.z);
      camRig.shake = Math.max(0, camRig.shake - dt * 0.09);
      if (camRig.shake === 0) camera.position.copy(camRig.base);
      camera.lookAt(camRig.look);
    }
  }

  return { renderer, scene, camera, resize, update, burst, render: () => renderer.render(scene, camera) };
}
