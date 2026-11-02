// LIVE ARENA V4 — 3D skeletal prototype.
// Rule: NO attack ever starts on its own. Every punch is dequeued from the gift/event queue.
import * as THREE from './vendor/three.min.js';
import { createCharacter } from './rig.js';
import { buildClips } from './anim.js';
import { CHAR_SETS } from './chars.js';
import { createStage, FIGHTER_X } from './stage.js';

const $ = (id) => document.getElementById(id);
const limit = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const TYPES = {
  rose: { emoji: '🌹', label: 'Trandafir', points: 1, damage: 3, kind: 'jab' },
  heart: { emoji: '💖', label: 'Inimă', points: 5, damage: 7, kind: 'jab' },
  flame: { emoji: '🔥', label: 'Flacără', points: 10, damage: 12, kind: 'hook' },
  rocket: { emoji: '🚀', label: 'Rachetă', points: 35, damage: 22, kind: 'hook' },
  lion: { emoji: '🦁', label: 'Leu', points: 75, damage: 37, kind: 'hook' },
};

const S = {
  running: false, round: 1, hp: [100, 100], wins: [0, 0], teamPoints: [0, 0], time: 90, selected: -1,
  users: new Map(), events: [], pending: [], act: null, sound: false, sock: null, activeTab: 'battle',
  names: ['TRUMP', 'PUTIN'], setName: 'real', streak: [0, 0], power: [0, 0], goal: 150, dbl: -1, idleT: 0, roundPts: new Map(), autoT: 0, seenIds: new Set(), roundOver: false,
  // honesty flag: stays false unless a relay explicitly reports a live TikTok room connection
  tiktokVerified: false, relayOpen: false,
};

// ---------- 3D setup ----------
let stage = null, fighters = [];
const canvas = $('arena');
let lastT = 0;
const clock = { start() { lastT = performance.now(); }, getDelta() { const n = performance.now(), d = (n - lastT) / 1000; lastT = n; return d; } };

function makeFighter(spec, idx) {
  const ch = createCharacter(spec);
  ch.group.position.set(idx === 0 ? -FIGHTER_X : FIGHTER_X, 0, 0);
  ch.group.rotation.y = idx === 0 ? 0 : Math.PI; // Putin faces -X; his own +X is "forward" in the shared rig
  const { clips, meta } = buildClips(spec);
  const mixer = new THREE.AnimationMixer(ch.group);
  const actions = {};
  for (const [name, clip] of Object.entries(clips)) {
    const a = mixer.clipAction(clip);
    if (['guard', 'victory'].includes(name)) { a.setLoop(THREE.LoopRepeat, Infinity); }
    else { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    actions[name] = a;
  }
  const f = { idx, spec, ch, mixer, actions, meta, cur: null, curName: '', state: 'guard', faceLoaded: false };
  if (spec.face) { // optional owner-supplied photo; if the file is absent the stylised head stays
    const img = new Image();
    img.onload = () => { ch.setFace(img, spec.face.crop); f.faceLoaded = true; };
    img.onerror = () => console.info('No face photo at ' + spec.face.src + ' — using stylised head');
    img.src = spec.face.src;
  }
  mixer.addEventListener('finished', (ev) => onFinished(f, ev.action));
  return f;
}

function play(f, name, fade = 0.1) {
  const next = f.actions[name], prev = f.cur;
  if (prev === next && fade > 0) return;
  next.reset(); next.setEffectiveTimeScale(1); next.setEffectiveWeight(1); next.play();
  if (prev && prev !== next && fade > 0) next.crossFadeFrom(prev, fade, false);
  else if (prev && prev !== next) prev.stop();
  f.cur = next; f.curName = name;
}

function loadSet(name) {
  if (!CHAR_SETS[name]) name = 'real';
  try { localStorage.setItem('arena.set', name); } catch (e) { /* storage optional */ }
  fighters.forEach((f) => { f.mixer.stopAllAction(); stage.scene.remove(f.ch.group); });
  S.setName = name;
  fighters = CHAR_SETS[name].map((spec, i) => makeFighter(spec, i));
  fighters.forEach((f) => { stage.scene.add(f.ch.group); f.ch.group.traverse((o) => { if (o.isMesh) o.castShadow = true; }); play(f, 'guard', 0); });
  S.names = fighters.map((f) => f.spec.name);
  const real = name === 'real';
  $('titleTxt').innerHTML = S.names[0] + ' <b>VS</b> ' + S.names[1];
  $('nameL').textContent = (real ? '🔴 ' : '🇺🇸 ') + S.names[0]; $('nameR').textContent = S.names[1] + (real ? ' 🔵' : ' 🇷🇺');
  $('choose0').textContent = (real ? '🔴 ECHIPA ' : '🇺🇸 ECHIPA ') + S.names[0]; $('choose1').textContent = (real ? '🔵 ECHIPA ' : '🇷🇺 ECHIPA ') + S.names[1];
  $('chat').placeholder = 'Scrie ' + S.names[0] + ' sau ' + S.names[1] + ' pentru a alege echipa';
  $('setReal').classList.toggle('on', real); $('setCari').classList.toggle('on', !real);
  const ih = document.querySelector('#intro h2'); if (ih) ih.innerHTML = '<span>' + S.names[0] + '</span><br>VS ' + S.names[1];
  document.title = S.names[0] + ' vs ' + S.names[1] + ' — LIVE ARENA';
}
function initStage() {
  stage = createStage(canvas);
  
  loadSet(localStorage.getItem('arena.set') || 'real');
  const q = new URLSearchParams(location.search).get('hq');
  if (q === '0') stage.setQuality(false);
  forceQ = q === '1' || q === '0';
  const bg = new Image(); bg.onload = () => stage.setBackdrop(bg); bg.onerror = () => {}; bg.src = 'assets/arena/bg.jpg';
  stage.resize();
  window.addEventListener('resize', () => stage.resize(), { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(() => stage.resize()).observe(canvas.parentElement);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); notify('Context WebGL pierdut — reîncarcă pagina'); });
}

// ---------- UI helpers ----------
let audio = null;
function notify(msg) { const n = $('notice'); n.textContent = msg; n.style.display = 'block'; setTimeout(() => { n.style.display = 'none'; }, 1700); }
function sound(freq, duration = 0.16) {
  if (!S.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const o = audio.createOscillator(), v = audio.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.45, audio.currentTime + duration);
    v.gain.setValueAtTime(0.045, audio.currentTime); v.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.connect(v); v.connect(audio.destination); o.start(); o.stop(audio.currentTime + duration);
  } catch (e) { /* audio is optional */ }
}
function pushEvent(msg, side = null) { S.events.unshift({ txt: msg, side, at: Date.now() }); S.events.length = Math.min(S.events.length, 30); $('feedline').textContent = msg; renderActivity(); }
function tickGift(txt, side) {
  const t = $('ticker'); if (!t) return;
  const row = document.createElement('div'); row.className = 'tk ' + (side === 1 ? 'b' : 'r'); row.textContent = txt;
  t.prepend(row); while (t.children.length > 5) t.lastChild.remove();
  setTimeout(() => row.remove(), 7000);
}
function refresh() {
  for (let i = 0; i < 2; i++) {
    $('hpbar' + i).style.width = S.hp[i] + '%'; $('hpnum' + i).textContent = Math.ceil(S.hp[i]);
    $('score' + i).textContent = S.teamPoints[i];
    $('cnt' + i).textContent = [...S.users.values()].filter((u) => u.team === i).length;
  }
  const t = Math.max(0, Math.ceil(S.time));
  $('clock').textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  $('round').textContent = String(S.round).padStart(2, '0');
  $('wins').textContent = S.wins.join(' — ');
  const arr = [...S.users.values()].sort((a, b) => b.points - a.points);
  $('pw0').textContent = Math.floor(S.power[0]); $('pw1').textContent = Math.floor(S.power[1]);
  { const dl = S.dbl >= 0 && S.time > S.dbl ? ' · x2 ' + Math.ceil(S.time - S.dbl) + 's' : ''; $('arenaGoal').textContent = 'ȚINTĂ ' + Math.min(S.teamPoints[0] + S.teamPoints[1], S.goal) + '/' + S.goal + dl; }
  $('mvp').textContent = (arr.find((u) => u.points > 0)?.name || '—').slice(0, 13);
  $('choose0').classList.toggle('selected', S.selected === 0);
  $('choose1').classList.toggle('selected', S.selected === 1);
}
function renderRanking() {
  const el = $('ranking');
  const sorted = [...S.users.values()].sort((a, b) => b.points - a.points);
  const at = Object.entries(allTime).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const head = document.createElement('div'); head.className = 'leaderrow'; head.textContent = '👑 TOP ALL-TIME (acest dispozitiv)';
  const atRows = at.map(([n, v], i) => { const r = document.createElement('div'); r.className = 'leaderrow'; r.textContent = (i + 1) + '. ' + n + ' — ' + v + ' pct'; return r; });
  if (!sorted.length) { el.replaceChildren(document.createTextNode('Niciun participant în runda asta. Alege o echipă pentru a intra.'), head, ...atRows); return; }
  el.replaceChildren(...sorted.slice(0, 10).map((u, i) => {
    const r = document.createElement('div'); r.className = 'leaderrow';
    const mark = document.createElement('span'); mark.className = 'miniBadge'; mark.textContent = i + 1;
    const name = document.createElement('span'); name.textContent = (u.team === 0 ? '🔴 ' : '🔵 ') + u.name;
    const point = document.createElement('em'); point.textContent = u.points + ' pct';
    r.append(mark, name, point); return r;
  }).concat(at.length ? [head, ...atRows] : []));
}
function renderActivity() {
  $('activity').replaceChildren(...S.events.slice(0, 15).map((v) => { const d = document.createElement('div'); d.className = 'leaderrow'; d.textContent = v.txt; return d; }));
}
function showTab(which) {
  S.activeTab = which;
  for (const id of ['battle', 'ranking', 'activity']) { $('tab-' + id).hidden = id !== which; document.querySelector('[data-tab="' + id + '"]').classList.toggle('active', id === which); }
  if (which === 'ranking') renderRanking(); if (which === 'activity') renderActivity();
}
function floatText(text, worldPos, color) {
  if (!stage) return;
  const v = worldPos.clone().project(stage.camera);
  const r = canvas.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'floaty'; el.textContent = text; el.style.color = color;
  el.style.left = ((v.x * 0.5 + 0.5) * r.width) + 'px'; el.style.top = ((-v.y * 0.5 + 0.5) * r.height - 20) + 'px';
  $('arenabox').appendChild(el); setTimeout(() => el.remove(), 900);
}

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/^!/, '');
function sideOf(t) {
  t = norm(t);
  if (!t) return -1;
  if (t === norm(S.names[0]) || ['trump', 'red', 'rosu', '1', 'left'].includes(t) && S.setName === 'cari' || ['red', 'rosu', '1', 'left'].includes(t)) return 0;
  if (t === norm(S.names[1]) || ['putin', 'blue', 'albastru', '2', 'right'].includes(t) && S.setName === 'cari' || ['blue', 'albastru', '2', 'right'].includes(t)) return 1;
  return -1;
}
// persistent all-time leaderboard (this device only)
let allTime = {};
try { allTime = JSON.parse(localStorage.getItem('arena.alltime') || '{}'); } catch (e) { allTime = {}; }
function saveAllTime(name, pts) {
  allTime[name] = (allTime[name] || 0) + pts;
  const keys = Object.keys(allTime); if (keys.length > 60) { keys.sort((a, b) => allTime[a] - allTime[b]).slice(0, keys.length - 50).forEach((k) => delete allTime[k]); }
  try { localStorage.setItem('arena.alltime', JSON.stringify(allTime)); } catch (e) { /* optional */ }
}

// ---------- game rules ----------
function join(name, side) {
  if (side !== 0 && side !== 1) return;
  name = String(name || 'Vizitator').trim().slice(0, 22) || 'Vizitator';
  const id = name.toLocaleLowerCase('ro'), old = S.users.get(id);
  if (old) old.team = side; else S.users.set(id, { name, team: side, points: 0 });
  if (name === 'Tu') S.selected = side;
  pushEvent('👤 ' + name + ' a intrat în ECHIPA ' + S.names[side], side);
  refresh(); renderRanking();
}
function resetFighters() {
  fighters.forEach((f) => { f.mixer.stopAllAction(); f.cur = null; f.state = 'guard'; play(f, 'guard', 0); f.mixer.update(0); });
}
function start() {
  S.running = true; S.roundOver = false; S.hp = [100, 100]; S.time = 90; S.pending = []; S.act = null;
  S.power = [0, 0]; S.goal = 150; S.dbl = -1; S.idleT = 0; S.roundPts = new Map(); S.autoT = 0;
  $('intro').hidden = true; $('result').hidden = true;
  resetFighters();
  $('announce').textContent = '🥊 FIGHT!';
  pushEvent('Runda ' + S.round + ' a început. Fără cadouri = fără atacuri.');
  refresh();
}
function end() {
  if (!S.running) return;
  S.running = false; S.pending = []; S.roundOver = true;
  const side = S.hp[0] === S.hp[1] ? -1 : S.hp[0] > S.hp[1] ? 0 : 1;
  if (side >= 0) { S.wins[side]++; const w = fighters[side]; if (w.state !== 'ko') { play(w, 'victory', 0.25); w.state = 'victory'; } }
  S.act = null;
  fighters.forEach((f) => { if (f.state === 'attack' || f.state === 'impact') { play(f, 'guard', 0.2); f.state = 'guard'; } });
  $('winner').textContent = side < 0 ? 'EGALITATE!' : S.names[side] + ' CÂȘTIGĂ!';
  $('winner').style.color = side < 0 ? '#ffda9a' : side === 0 ? '#ff748d' : '#8bc5ff';
  $('resultText').textContent = side < 0 ? 'Nicio echipă nu a reușit să decidă lupta.' : `Echipa ${S.names[side]} a câștigat runda ${S.round}${fighters[1 - side].state === 'ko' ? ' prin KO' : ''}.`;
  pushEvent('🏆 ' + $('winner').textContent);
  if (side >= 0) { S.streak[side]++; S.streak[1 - side] = 0; } else S.streak = [0, 0];
  const mvp = [...S.roundPts.entries()].sort((a, b) => b[1] - a[1])[0];
  $('resultExtra').textContent = (side >= 0 && S.streak[side] > 1 ? '🔥 Serie de ' + S.streak[side] + ' victorii · ' : '') + (mvp ? '👑 MVP runda: ' + mvp[0] + ' (' + mvp[1] + ' pct)' : 'Fără cadouri în runda asta. Trimite unul!');
  S.autoT = 12; // next round starts by itself: the LIVE can run unattended
  setTimeout(() => { if (S.roundOver) $('result').hidden = false; }, fighters.some((f) => f.state === 'ko') ? 600 : 400);
  refresh(); sound(260, 0.4);
}
function award(side, type, count, name, external, id) {
  if ((side !== 0 && side !== 1) || !TYPES[type]) return;
  count = limit(Math.floor(Number(count) || 1), 1, 15);
  name = String(name || 'Spectator').slice(0, 22).replace(/[\u0000-\u001f]/g, '');
  if (id) { id = String(id).slice(0, 120); if (S.seenIds.has(id)) return; S.seenIds.add(id); if (S.seenIds.size > 750) S.seenIds.clear(); }
  if (!S.running) { if (!external) notify('Pornește runda mai întâi'); return; }
  const key = name.toLocaleLowerCase('ro');
  if (!S.users.has(key)) join(name, side);
  const user = S.users.get(key); user.team = side;
  const dbl = S.time > S.dbl && S.dbl >= 0 ? 2 : 1; // gift-goal bonus window
  const pts = TYPES[type].points * count * dbl; user.points += pts; S.teamPoints[side] += pts; saveAllTime(user.name, pts);
  S.roundPts.set(user.name, (S.roundPts.get(user.name) || 0) + pts); S.idleT = 0;
  let dmg = Math.min(TYPES[type].damage * count, 90);
  if (S.hp[side] <= 30 && S.hp[1 - side] > S.hp[side]) { dmg = Math.round(dmg * 1.25); $('announce').textContent = '💪 COMEBACK · ' + S.names[side] + ' +25% daune'; }
  S.pending.push({ side, type, count, name, damage: dmg });
  // power meter: every gift charges the team's SUPER punch (still an event-driven attack, never automatic)
  S.power[side] += Math.min(pts, 60);
  if (S.power[side] >= 100) { S.power[side] -= 100; S.pending.push({ side, type: 'lion', count: 1, name: '⚡ SUPER ' + S.names[side], damage: 25 }); pushEvent('⚡ SUPER LOVITURĂ pentru ' + S.names[side], side); }
  const total = S.teamPoints[0] + S.teamPoints[1];
  if (total >= S.goal) { S.goal += 200; S.dbl = S.time - 15; pushEvent('🎯 ȚINTA ATINSĂ! Puncte x2 timp de 15 s'); $('announce').textContent = '🎯 PUNCTE x2 · 15 s'; }
  if (S.pending.length > 20) S.pending.shift();
  const src = external ? (S.tiktokVerified ? '🎁' : '📡') : '🧪';
  pushEvent(`${src} ${name} · ${TYPES[type].emoji} ${TYPES[type].label} x${count} pentru ${S.names[side]}`, side);
  tickGift(`${TYPES[type].emoji} ${name} · ${TYPES[type].label} x${count}`, side);
  refresh(); renderRanking();
}

// An attack is started ONLY from a queued gift event.
function startAttack(e) {
  const a = fighters[e.side], v = fighters[1 - e.side], kind = TYPES[e.type].kind;
  S.act = { a, v, kind, e, contacted: false, atkDone: false, vicDone: false };
  a.state = 'attack'; play(a, kind, 0.06);
  $('announce').textContent = (e.type === 'lion' ? '👑 ULTIMATE · ' : kind === 'hook' ? '🥊 CROȘEU · ' : '👊 JAB · ') + S.names[e.side];
}
function contact() {
  const { a, v, kind, e } = S.act;
  S.act.contacted = true;
  S.hp[v.idx] = limit(S.hp[v.idx] - e.damage, 0, 100);
  const heavy = e.damage >= 20 || kind === 'hook';
  const fist = new THREE.Vector3(); a.ch.boneMap[a.meta[kind].hand].getWorldPosition(fist);
  const head = new THREE.Vector3(); v.ch.boneMap.head.getWorldPosition(head); head.y += 0.1;
  const hit = fist.clone().lerp(head, 0.5);
  stage.burst(hit, e.damage >= 20 ? 2 : heavy ? 1.3 : 0.8, a.idx === 0 ? 0xff4c68 : 0x5eacff);
  floatText('-' + e.damage, head, a.idx === 0 ? '#ff8aa0' : '#8cc4ff');
  sound(e.damage >= 20 ? 190 : 480, e.damage >= 20 ? 0.3 : 0.13);
  if (S.hp[v.idx] <= 0) { v.state = 'ko'; play(v, 'ko', 0.05); $('announce').textContent = '💥 KO! ' + S.names[a.idx] + ' câștigă!'; S.act.vicDone = true; }
  else { v.state = 'impact'; play(v, heavy ? 'impactHeavy' : 'impactLight', 0.04); }
  refresh();
}
function onFinished(f, action) {
  if (f.cur !== action) return;
  if (f.state === 'ko') { if (S.running) end(); return; }
  if (f.state === 'attack' || f.state === 'impact') {
    const wasAttack = f.state === 'attack';
    f.state = 'guard'; play(f, 'guard', 0.18);
    if (S.act) { if (wasAttack && S.act.a === f) S.act.atkDone = true; if (!wasAttack && S.act.v === f) S.act.vicDone = true; }
  }
}

function update(dt) {
  fighters.forEach((f) => f.mixer.update(dt));
  if (S.running) {
    S.time -= dt;
    if (S.time <= 0) { S.time = 0; end(); }
    if (S.act) {
      const { a, kind } = S.act;
      if (!S.act.contacted && a.cur && a.curName === kind && a.cur.time >= a.meta[kind].contact) contact();
      if (S.act && S.act.atkDone && S.act.vicDone && fighters.every((f) => f.state === 'guard')) { S.act = null; $('announce').textContent = 'TRIMITE UN CADOU ȘI AJUTĂ-ȚI ECHIPA!'; }
    } else if (S.pending.length && fighters.every((f) => f.state === 'guard')) {
      startAttack(S.pending.shift());
    }
    S.idleT += dt;
    if (!S.act && !S.pending.length && S.idleT > 18) {
      S.idleT = 0; const tips = ['Scrie ' + S.names[0] + ' sau ' + S.names[1] + ' ca să alegi echipa!', 'Un cadou = o lovitură. Trimite 🌹 pentru jab, 🚀 pentru croșeu!', '⚡ Încarcă bara SUPER cu cadouri!', '🎯 Atingeți ținta ca să dați puncte x2!'];
      $('announce').textContent = tips[Math.floor(Math.random() * tips.length)]; // text only: never triggers an attack
    }
    refresh();
  } else if (S.roundOver && S.autoT > 0) {
    S.autoT -= dt; $('again').textContent = '↻ REVANȘĂ (' + Math.max(0, Math.ceil(S.autoT)) + ')';
    if (S.autoT <= 0) { S.round++; start(); }
  }
  stage.update(dt);
}

let rafId = 0, forceQ = false, qFrames = 0, qSum = 0;
function frame() {
  const raw = clock.getDelta(), dt = Math.min(0.05, raw);
  // auto quality: if the first ~100 frames average slower than ~30 fps, drop bloom/shadows/pixel ratio
  if (!forceQ && stage.hq && qFrames < 100 && raw < 0.5) { qFrames++; qSum += raw; if (qFrames === 100 && qSum / 100 > 0.034) { stage.setQuality(false); console.info('Auto quality: LOW (avg frame ' + (qSum * 10).toFixed(1) + ' ms)'); } }
  update(dt);
  stage.render();
  rafId = requestAnimationFrame(frame);
}

// ---------- chat / relay ----------
function handleChat() {
  const inp = $('chat'), msg = inp.value.trim().slice(0, 100); inp.value = ''; if (!msg) return;
  const lower = msg.toLocaleLowerCase('ro');
  const sd = sideOf(lower);
  if (sd >= 0) { join('Tu', sd); showTab('battle'); }
  else { pushEvent('💬 Tu: ' + msg); notify('Scrie ' + S.names[0] + ' sau ' + S.names[1] + ' pentru echipă'); }
}
function setStatus() {
  const st = $('status');
  if (S.sock && S.relayOpen) { st.textContent = S.tiktokVerified ? '● TIKTOK LIVE (raportat de relay)' : '● RELAY NEVERIFICAT'; }
  else st.textContent = '● DEMO';
}
function disconnect() {
  if (S.sock) { S.sock.onclose = null; S.sock.close(); S.sock = null; }
  S.relayOpen = false; S.tiktokVerified = false; setStatus();
  $('connectStatus').textContent = '● Deconectat • doar simulare locală';
}
function connect() {
  const url = $('relay').value.trim();
  if (!/^wss:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(url)) { notify('Adresa trebuie să înceapă cu wss://'); return; }
  disconnect(); $('connectStatus').textContent = '◌ Conectare în curs...';
  try {
    const sock = new WebSocket(url); S.sock = sock;
    sock.onopen = () => {
      if (S.sock !== sock) return;
      S.relayOpen = true; S.tiktokVerified = false; setStatus();
      $('connectStatus').textContent = '● Conectat la relay, dar NEVERIFICAT: nu am primit încă confirmarea unei camere TikTok LIVE de la server.';
      pushEvent('Relay WSS conectat. Conexiunea cu TikTok LIVE nu este verificată.');
    };
    sock.onmessage = (ev) => {
      if (S.sock !== sock) return;
      try {
        const d = JSON.parse(ev.data);
        const side = sideOf(d.team);
        if (d.type === 'status') {
          // Only the relay can know whether it is attached to a real LIVE room. We just display what it claims.
          S.tiktokVerified = d.tiktok === 'connected' && typeof d.roomId === 'string' && d.roomId.length > 0; setStatus();
          $('connectStatus').textContent = S.tiktokVerified ? '● Relay raportează cameră TikTok LIVE ' + d.roomId.slice(0, 24) + ' (raportat de server, nu verificat de acest joc)' : '● Relay conectat, TikTok: ' + String(d.tiktok || 'necunoscut').slice(0, 30);
        } else if (d.type === 'join') join(d.username, side);
        else if (d.type === 'gift') award(side, d.gift, d.count, d.username, true, d.id);
        else if (d.type === 'chat') pushEvent('💬 ' + String(d.username || 'Spectator').slice(0, 22) + ': ' + String(d.text || '').slice(0, 70));
      } catch (err) { console.warn('Malformed relay event'); }
    };
    sock.onerror = () => { if (S.sock === sock) $('connectStatus').textContent = '● Conexiunea a eșuat'; };
    sock.onclose = () => { if (S.sock === sock) disconnect(); };
  } catch (e) { disconnect(); notify('Server indisponibil'); }
}

// ---------- boot ----------
function bindUI() {
  $('start').addEventListener('click', start);
  $('setReal').addEventListener('click', () => loadSet('real'));
  $('setCari').addEventListener('click', () => loadSet('cari'));
  $('again').addEventListener('click', () => { S.round++; start(); });
  $('choose0').addEventListener('click', () => join('Tu', 0));
  $('choose1').addEventListener('click', () => join('Tu', 1));
  document.querySelectorAll('[data-gift]').forEach((el) => el.addEventListener('click', () => { if (S.selected < 0) { notify('Alege întâi o echipă'); return; } award(S.selected, el.dataset.gift, 1, 'Tu', false, null); }));
  document.querySelectorAll('[data-tab]').forEach((el) => el.addEventListener('click', () => showTab(el.dataset.tab)));
  $('send').addEventListener('click', handleChat);
  $('chat').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleChat(); } });
  $('sound').addEventListener('click', () => { S.sound = !S.sound; $('sound').textContent = S.sound ? '🔊' : '🔇'; sound(610, 0.09); });
  $('settingsBtn').addEventListener('click', () => { $('settings').hidden = false; });
  $('closeSettings').addEventListener('click', () => { $('settings').hidden = true; });
  $('connect').addEventListener('click', connect);
  $('disconnect').addEventListener('click', disconnect);
  window.addEventListener('pagehide', disconnect);
}

bindUI();
try {
  initStage();
  clock.start();
  frame();
} catch (err) {
  console.error(err);
  $('start').disabled = true;
  $('intro').querySelector('p.tiny').textContent = 'WebGL nu este disponibil pe acest dispozitiv/browser. Jocul 3D nu poate porni (nu există mod de rezervă cu imagini).';
}
refresh();

// Test/diagnostic API. `advance` steps the simulation deterministically (independent of rAF speed).
window.GameV4 = {
  version: '4.0-prototype', demo: true,
  getState: () => ({ running: S.running, hp: [...S.hp], teamPoints: [...S.teamPoints], participants: S.users.size, score: [...S.wins], time: S.time, pending: S.pending.length, fighterStates: fighters.map((f) => f.state + ':' + f.curName), tiktokVerified: S.tiktokVerified }),
  injectDemoGift: (side, type, count = 1, name = 'Demo') => award(side, type, count, name, false, null),
  debug: {
    THREE, fighters: () => fighters, stage: () => stage,
    advance(sec, step = 1 / 60) { cancelAnimationFrame(rafId); for (let t = 0; t < sec - 1e-9; t += step) update(Math.min(step, sec - t)); stage.render(); },
    resume() { clock.getDelta(); rafId = requestAnimationFrame(frame); },
    worldPos(idx, bone) { const f = fighters[idx]; f.ch.group.updateMatrixWorld(true); return f.ch.boneMap[bone].getWorldPosition(new THREE.Vector3()).toArray(); },
    pose(idx, clip, t) {
      const f = fighters[idx]; cancelAnimationFrame(rafId);
      f.mixer.stopAllAction(); const a = f.actions[clip]; a.reset(); a.play(); a.paused = true; a.time = t; f.mixer.update(0); stage.render();
    },
  },
};
