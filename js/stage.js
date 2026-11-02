// WebGL stage: glossy LED ring, truss lights, bloom, LED wall, bokeh crowd, confetti, camera framing, hit sparks.
// An optional painted arena backdrop can be dropped in as assets/arena/bg.jpg (supplied by the project owner).
import * as THREE from './vendor/three.min.js';

export const FIGHTER_X = 0.5; // distance of each fighter from ring centre

function canvasTexture(draw, w, h, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060f);
  scene.fog = new THREE.Fog(0x070a1c, 9, 22);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const camRig = { shake: 0, base: new THREE.Vector3(), look: new THREE.Vector3(0, 1.0, 0) };

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0xa9c2ff, 0x3a2a36, 0.85));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.6);
  key.position.set(1.5, 5, 3.2); key.target.position.set(0, 0.8, 0);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -2, near: 1, far: 12 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rimR = new THREE.DirectionalLight(0xff3d5e, 1.3); rimR.position.set(-4, 2.5, -2); scene.add(rimR);
  const rimB = new THREE.DirectionalLight(0x3d8bff, 1.3); rimB.position.set(4, 2.5, -2); scene.add(rimB);
  const glowR = new THREE.PointLight(0xff2a4d, 1.6, 4); glowR.position.set(-1.7, 0.5, 1.2); scene.add(glowR);
  const glowB = new THREE.PointLight(0x2a7bff, 1.6, 4); glowB.position.set(1.7, 0.5, 1.2); scene.add(glowB);

  // ---- ring ----
  const floorTex = canvasTexture((g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, 0); bg.addColorStop(0, '#3a2540'); bg.addColorStop(0.5, '#222c52'); bg.addColorStop(1, '#1d3a6e');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff14'; g.lineWidth = 2;
    for (let i = 0; i < 24; i++) { g.beginPath(); g.moveTo(0, (i / 24) * h); g.lineTo(w, (i / 24) * h); g.stroke(); }
    const rg = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, h * 0.42);
    rg.addColorStop(0, '#ffffff30'); rg.addColorStop(1, '#ffffff00'); g.fillStyle = rg; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd98a'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h / 2, h * 0.32, 0, 7); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, h * 0.36, 0, 7); g.stroke();
    g.fillStyle = '#ffe3a1'; g.font = '900 ' + h * 0.2 + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VS', w / 2, h / 2 + 6);
    g.fillStyle = '#ff2a4d'; g.fillRect(0, 0, w * 0.5, 18); g.fillRect(0, h - 18, w * 0.5, 18);
    g.fillStyle = '#2a7bff'; g.fillRect(w * 0.5, 0, w * 0.5, 18); g.fillRect(w * 0.5, h - 18, w * 0.5, 18);
  }, 1024, 700);
  const RING_W = 4.6, RING_D = 3.2;
  const edge = new THREE.MeshStandardMaterial({ color: 0x0c1124, roughness: 0.5, metalness: 0.3 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(RING_W, 0.3, RING_D), [edge, edge,
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.32, metalness: 0.25 }), edge, edge, edge]);
  floor.position.y = -0.15; floor.receiveShadow = true; scene.add(floor);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(RING_W + 1.6, 0.2, RING_D + 1.6), new THREE.MeshStandardMaterial({ color: 0x0b0f20, roughness: 0.4, metalness: 0.5 }));
  apron.position.y = -0.4; scene.add(apron);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x05070f, roughness: 0.6, metalness: 0.4 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52; scene.add(ground);

  // LED strip around the apron (red left half, blue right half) — bloom makes it glow
  const ledR = new THREE.MeshBasicMaterial({ color: 0xff2a4d }), ledB = new THREE.MeshBasicMaterial({ color: 0x2a7bff });
  const strip = (x, z, w, d, m) => { const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), m); s.position.set(x, -0.28, z); scene.add(s); };
  const aw = RING_W + 1.6, ad = RING_D + 1.6;
  strip(-aw / 4, ad / 2, aw / 2, 0.06, ledR); strip(aw / 4, ad / 2, aw / 2, 0.06, ledB);
  strip(-aw / 4, -ad / 2, aw / 2, 0.06, ledR); strip(aw / 4, -ad / 2, aw / 2, 0.06, ledB);
  strip(-aw / 2, 0, 0.06, ad, ledR); strip(aw / 2, 0, 0.06, ad, ledB);

  // posts + glowing ropes (back and sides; camera side stays open)
  const postM = new THREE.MeshStandardMaterial({ color: 0x9aa1b8, metalness: 0.8, roughness: 0.3 });
  const hx = RING_W / 2 - 0.08, hz = RING_D / 2 - 0.08;
  for (const [x, z, c] of [[-hx, -hz, 0xff2a4d], [hx, -hz, 0x2a7bff], [-hx, hz, 0xff2a4d], [hx, hz, 0x2a7bff]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 12), postM); p.position.set(x, 0.7, z); p.castShadow = true; scene.add(p);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 12), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.7, roughness: 0.5 })); pad.position.set(x, 0.95, z); scene.add(pad);
  }
  const ropeCols = [0xff2a4d, 0xffffff, 0x2a7bff];
  const ropeMat = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.4 });
  [0.5, 0.85, 1.2].forEach((y, i) => {
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, hx * 2, 8), ropeMat(ropeCols[i]));
    back.rotation.z = Math.PI / 2; back.position.set(0, y, -hz); scene.add(back);
    for (const x of [-hx, hx]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, hz * 2, 8), ropeMat(ropeCols[i])); m.rotation.x = Math.PI / 2; m.position.set(x, y, 0); scene.add(m); }
  });

  // ---- arena background ----
  const wallGroup = new THREE.Group(); scene.add(wallGroup);
  // curved crowd wall: procedural canvas with tiers, silhouettes, phone-light bokeh, LED ad band
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const wallTex = canvasTexture((g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#0a0e24'); grd.addColorStop(0.6, '#171a3d'); grd.addColorStop(1, '#0b0c1d');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let tier = 0; tier < 7; tier++) {
      const y = h * (0.22 + tier * 0.1);
      for (let i = 0; i < 150; i++) {
        const x = rnd() * w, r = 9 + rnd() * 7;
        g.fillStyle = `hsl(${220 + rnd() * 60},25%,${5 + rnd() * 9}%)`;
        g.beginPath(); g.arc(x, y + rnd() * 6, r, 0, 7); g.fill();
        g.fillRect(x - r, y + r * 0.6, r * 2, h * 0.07);
      }
    }
    for (let i = 0; i < 520; i++) { // phone flashes / bokeh
      const x = rnd() * w, y = h * (0.2 + rnd() * 0.7), r = 1.5 + rnd() * 3.5;
      g.fillStyle = ['#ffffffcc', '#ffd98acc', '#9cc8ffcc', '#ff9db0cc'][(rnd() * 4) | 0];
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    g.fillStyle = '#0a0d1c'; g.fillRect(0, h * 0.05, w, h * 0.12);
    g.font = '900 ' + h * 0.09 + 'px system-ui,sans-serif'; g.textBaseline = 'middle';
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#2a7bff' : '#ff2a4d'; g.fillText('LIVE ARENA ⚡ TRUMP VS PUTIN', (i * w) / 3 - 40, h * 0.11); }
  }, 2048, 640);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 8, 48, 1, true, Math.PI - 1.25, 2.5), new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide, fog: false, toneMapped: false }));
  wall.position.set(0, 3.6, 0); wall.scale.x = -1; wallGroup.add(wall);

  // LED wall behind the ring (red / blue split with title)
  const ledTex = canvasTexture((g, w, h) => {
    const a = g.createLinearGradient(0, 0, w, 0); a.addColorStop(0, '#7a0f26'); a.addColorStop(0.5, '#1a1030'); a.addColorStop(1, '#0f3a8a');
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff10'; g.lineWidth = 1; for (let x = 0; x < w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = '#ffe3a1'; g.font = 'italic 900 ' + h * 0.34 + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff9a3c'; g.shadowBlur = 30; g.fillText('TRUMP  VS  PUTIN', w / 2, h * 0.42);
    g.shadowBlur = 0; g.fillStyle = '#ffffffcc'; g.font = '800 ' + h * 0.11 + 'px system-ui,sans-serif'; g.fillText('LIVE ARENA · ALEGE ECHIPA · TRIMITE CADOURI', w / 2, h * 0.78);
  }, 1024, 400);
  const led = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.5), new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false, fog: false, color: 0x8a8a8a }));
  led.position.set(0, 3.1, -5.2); wallGroup.add(led);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.7, 0.1), new THREE.MeshStandardMaterial({ color: 0x0a0d1c, metalness: 0.8, roughness: 0.3 }));
  frame.position.set(0, 3.1, -5.26); wallGroup.add(frame);

  // truss with coloured lamps + sweeping beams
  const trussM = new THREE.MeshStandardMaterial({ color: 0x2a2f45, metalness: 0.9, roughness: 0.35 });
  const truss = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.12), trussM); truss.position.set(0, 5.2, -1.2); scene.add(truss);
  const beams = [];
  const beamMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (let i = 0; i < 7; i++) {
    const x = -3.6 + i * 1.2, c = i % 2 ? 0x4aa0ff : 0xff4d6e;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: c })); lamp.position.set(x, 5.1, -1.2); scene.add(lamp);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.9, 6, 20, 1, true), beamMat(c));
    cone.geometry.translate(0, -3, 0); cone.position.set(x, 5.1, -1.2); scene.add(cone);
    beams.push({ cone, ph: i * 0.9, sw: 0.18 + (i % 3) * 0.05 });
  }

  // confetti / embers (additive points) drifting upward
  const dotTex = canvasTexture((g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, '#fff'); r.addColorStop(1, '#fff0'); g.fillStyle = r; g.fillRect(0, 0, w, h); }, 64, 64, false);
  const NP = 140, pp = new Float32Array(NP * 3), pc = new Float32Array(NP * 3), pv = new Float32Array(NP);
  const cols = [[1, 0.3, 0.4], [0.3, 0.6, 1], [1, 0.85, 0.5]];
  for (let i = 0; i < NP; i++) { pp.set([(rnd() - 0.5) * 7, rnd() * 4, -2 + rnd() * 3.5], i * 3); pc.set(cols[i % 3], i * 3); pv[i] = 0.08 + rnd() * 0.18; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.07, map: dotTex, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  // painted backdrop (assets/arena/bg.jpg): screen-space "cover" background; the 3D ring + fighters render on top
  let bgTex = null, bgAsp = 1, bgFocus = 0.52;
  function fitBackdrop() {
    if (!bgTex) return;
    const A = W / H, frac = Math.min(1, bgAsp / A);
    bgTex.repeat.set(1, frac); bgTex.offset.set(0, Math.max(0, Math.min(1 - frac, (1 - bgFocus) - frac / 2)));
  }
  function setBackdrop(img) {
    bgTex = new THREE.Texture(img); bgTex.colorSpace = THREE.SRGBColorSpace; bgTex.needsUpdate = true;
    bgAsp = img.width / img.height; scene.background = bgTex; scene.fog = null;
    ground.visible = false; wallGroup.visible = false; beams.forEach((b) => { b.cone.visible = false; });
    fitBackdrop();
  }

  // hit sparks (pooled)
  const sparkGeo = new THREE.SphereGeometry(0.03, 6, 5);
  const sparks = [];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffd36e, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; scene.add(m); sparks.push({ m, v: new THREE.Vector3(), life: 0 });
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.visible = false; scene.add(ring);
  let ringLife = 0, flash = 0;

  function burst(pos, power, tint) {
    let n = power > 1.5 ? 32 : 16;
    for (const s of sparks) {
      if (n-- <= 0) break;
      s.life = 0.35 + Math.random() * 0.4; s.m.visible = true; s.m.position.copy(pos);
      s.v.set((Math.random() - 0.5) * 3, Math.random() * 2.4, (Math.random() - 0.3) * 3).multiplyScalar(0.6 + power * 0.4);
      s.m.material.color.setHex(Math.random() < 0.5 ? 0xffd36e : tint);
    }
    ring.position.copy(pos); ring.visible = true; ringLife = 0.25; ring.scale.setScalar(0.5); ring.lookAt(camera.position);
    camRig.shake = Math.max(camRig.shake, 0.014 * power);
    flash = Math.max(flash, 0.25 * power);
  }

  // ---- post-processing (bloom). Disabled automatically on slow devices via setQuality(false). ----
  let composer = null, bloom = null, hq = true;
  function buildComposer(w, h) {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(Math.round(w / 2), Math.round(h / 2)), 0.4, 0.45, 0.92);
    composer.addPass(bloom);
    composer.addPass(new THREE.OutputPass());
    composer.setPixelRatio(pixelRatio); composer.setSize(w, h);
  }

  let aspect = 1, W = 10, H = 10;
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    W = Math.max(10, Math.round(r.width)); H = Math.max(10, Math.round(r.height));
    renderer.setSize(W, H, false);
    if (hq) { if (!composer) buildComposer(W, H); else { composer.setPixelRatio(pixelRatio); composer.setSize(W, H); bloom.resolution.set(Math.round(W / 2), Math.round(H / 2)); } }
    aspect = W / H; camera.aspect = aspect; fitBackdrop();
    const needW = 3.7, needH = 2.35;
    const vf = THREE.MathUtils.degToRad(camera.fov);
    const dist = Math.max(needH / 2 / Math.tan(vf / 2), needW / 2 / (Math.tan(vf / 2) * aspect));
    camRig.base.set(0.0, 1.55, dist * 0.98 + 0.3);
    camera.position.copy(camRig.base); camRig.look.set(0, 0.92, 0); camera.lookAt(camRig.look);
    camera.updateProjectionMatrix();
  }
  function setQuality(high) {
    hq = high; pixelRatio = high ? Math.min(window.devicePixelRatio || 1, 2) : Math.min(window.devicePixelRatio || 1, 1.25);
    renderer.setPixelRatio(pixelRatio); renderer.shadowMap.enabled = high; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    resize();
  }

  let t = 0;
  function update(dt) {
    t += dt;
    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.life -= dt; s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt);
      s.m.material.opacity = Math.max(0, s.life * 2.5);
      if (s.life <= 0) s.m.visible = false;
    }
    if (ringLife > 0) { ringLife -= dt; ring.scale.multiplyScalar(1 + dt * 9); ring.material.opacity = Math.max(0, ringLife * 4); if (ringLife <= 0) ring.visible = false; }
    beams.forEach((b) => { b.cone.rotation.z = Math.sin(t * 0.7 + b.ph) * b.sw; b.cone.rotation.x = Math.cos(t * 0.5 + b.ph) * 0.12; });
    const a = pg.attributes.position;
    for (let i = 0; i < NP; i++) { let y = a.getY(i) + pv[i] * dt; if (y > 4.2) y = 0; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t + i) * 0.1 * dt); }
    a.needsUpdate = true;
    if (flash > 0) { flash = Math.max(0, flash - dt * 2.4); if (bloom) bloom.strength = 0.4 + flash * 1.0; }
    if (camRig.shake > 0) {
      camera.position.set(camRig.base.x + (Math.random() - 0.5) * camRig.shake, camRig.base.y + (Math.random() - 0.5) * camRig.shake, camRig.base.z);
      camRig.shake = Math.max(0, camRig.shake - dt * 0.09);
      if (camRig.shake === 0) camera.position.copy(camRig.base);
      camera.lookAt(camRig.look);
    }
  }

  const render = () => { if (hq && composer) composer.render(); else renderer.render(scene, camera); };
  return { renderer, scene, camera, resize, update, burst, render, setQuality, setBackdrop, get hq() { return hq; } };
}
