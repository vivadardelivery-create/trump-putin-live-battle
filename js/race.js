// CURSA ȚĂRILOR — country horse race for TikTok LIVE (2D canvas, all art drawn in code).
// Rules: nothing moves a horse except viewer events (gift / chat / like). No idle auto-movement.
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const canvas = $('c'), ctx = canvas.getContext('2d');

const COUNTRIES = [
  { code: 'RO', name: 'România', flag: '🇷🇴', col: '#f7d117', alias: ['romania', 'ro'] },
  { code: 'US', name: 'SUA', flag: '🇺🇸', col: '#3d7bff', alias: ['usa', 'us', 'america', 'sua'] },
  { code: 'BR', name: 'Brazilia', flag: '🇧🇷', col: '#2fd36b', alias: ['brazil', 'brasil', 'brazilia', 'br'] },
  { code: 'TR', name: 'Turcia', flag: '🇹🇷', col: '#ff3b4a', alias: ['turkey', 'turcia', 'turkiye', 'tr'] },
  { code: 'IN', name: 'India', flag: '🇮🇳', col: '#ff9a2e', alias: ['india', 'in'] },
  { code: 'ID', name: 'Indonezia', flag: '🇮🇩', col: '#ff6b6b', alias: ['indonesia', 'indonezia', 'id'] },
  { code: 'PH', name: 'Filipine', flag: '🇵🇭', col: '#4aa8ff', alias: ['philippines', 'filipine', 'ph'] },
  { code: 'MX', name: 'Mexic', flag: '🇲🇽', col: '#38c172', alias: ['mexico', 'mexic', 'mx'] },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', col: '#ff5252', alias: ['vietnam', 'vn'] },
  { code: 'TH', name: 'Thailanda', flag: '🇹🇭', col: '#9b7bff', alias: ['thailand', 'thailanda', 'th'] },
];
const GIFTS = {
  rose: { e: '🌹', n: 'Trandafir', boost: 0.012 },
  heart: { e: '💖', n: 'Inimă', boost: 0.03 },
  flame: { e: '🔥', n: 'Flacără', boost: 0.06 },
  rocket: { e: '🚀', n: 'Rachetă', boost: 0.12 },
  lion: { e: '🦁', n: 'Leu', boost: 0.25 },
};
const ROUND_TIME = 100, COUNTDOWN = 3, AUTO_NEXT = 10;

const S = {
  phase: 'intro', t: 0, count: 0, auto: 0, goalB: 1.2, boostSum: 0, dbl: -1, idle: 0, round: 1,
  C: COUNTRIES.map((c) => ({ ...c, pos: 0, dp: 0, sup: 0, pts: 0, phase: 0, cyc: Math.random(), sprint: 0 })),
  users: new Map(), roundPts: new Map(), feed: [], seen: new Set(), spark: [], confetti: [],
  wins: {}, winner: -1, sock: null, relayOpen: false, verified: false, bots: false, botT: 0, flash: 0,
};
try { S.wins = JSON.parse(localStorage.getItem('race.wins') || '{}'); } catch (e) { S.wins = {}; }

// ---------- layout ----------
let W = 400, H = 600, dpr = 1, L = {};
function layout() {
  const r = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(200, r.width); H = Math.max(300, r.height);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = Math.round(H * 0.2), bot = Math.round(H * 0.17);
  L = { top, laneTop: top, laneH: (H - top - bot) / S.C.length, bot: H - bot, startX: 52, finX: W - 10 };
}
window.addEventListener('resize', layout, { passive: true });
if ('ResizeObserver' in window) new ResizeObserver(layout).observe(canvas);

// ---------- helpers ----------
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
function countryOf(text) {
  const w = norm(text).replace(/^[!#@]/, '').split(/\s+/)[0] || '';
  return S.C.findIndex((c) => c.alias.includes(w) || norm(c.name) === w || c.code.toLowerCase() === w);
}
function feed(msg) { S.feed.unshift({ msg, at: S.t }); S.feed.length = Math.min(S.feed.length, 6); }
const leader = () => S.C.reduce((b, c, i) => (c.pos > S.C[b].pos ? i : b), 0);
const lastPlace = () => S.C.reduce((b, c, i) => (c.pos < S.C[b].pos ? i : b), 0);

// ---------- events (single entry point: nothing else moves a horse) ----------
function user(name) {
  name = String(name || 'Spectator').replace(/[\u0000-\u001f]/g, '').slice(0, 20) || 'Spectator';
  const k = name.toLowerCase();
  if (!S.users.has(k)) S.users.set(k, { name, c: -1, lastChat: -9 });
  return S.users.get(k);
}
function join(name, ci, quiet) {
  const u = user(name); if (u.c === ci) return u;
  if (u.c >= 0) S.C[u.c].sup--;
  u.c = ci; S.C[ci].sup++;
  if (!quiet) feed(`👤 ${u.name} a intrat în echipa ${S.C[ci].flag} ${S.C[ci].code}`);
  return u;
}
function push(ci, amount, who) { // the ONLY function that advances a horse
  if (S.phase !== 'race' || ci < 0) return;
  const last = lastPlace() === ci && S.C[leader()].pos - S.C[ci].pos > 0.2;
  const mult = (S.dbl >= 0 && S.t - S.dbl < 15 ? 2 : 1) * (last ? 1.2 : 1);
  const c = S.C[ci]; c.pos = Math.min(1, c.pos + amount * mult); c.sprint = 1; c.pts += amount * mult * 100;
  if (who) S.roundPts.set(who, (S.roundPts.get(who) || 0) + amount * mult * 100);
  S.boostSum += amount; S.idle = 0;
  if (S.boostSum >= S.goalB) { S.goalB += 1.5; S.dbl = S.t; feed('🎯 ȚINTĂ ATINSĂ! Impulsuri x2 timp de 15 s'); }
  for (let i = 0; i < 6; i++) S.spark.push({ x: L.startX + c.pos * (L.finX - L.startX), y: L.laneTop + (ci + 0.7) * L.laneH, vx: -30 - Math.random() * 60, vy: -20 + Math.random() * 40, life: 0.5, col: c.col });
  if (c.pos >= 1) finish(ci);
}
function ev(e) {
  if (!e || typeof e !== 'object') return;
  const name = e.username;
  if (e.id) { const id = String(e.id).slice(0, 120); if (S.seen.has(id)) return; S.seen.add(id); if (S.seen.size > 800) S.seen.clear(); }
  if (e.type === 'chat') {
    const ci = countryOf(e.text); const u = user(name);
    if (ci >= 0) join(name, ci);
    else if (u.c >= 0 && S.t - u.lastChat > 3) { u.lastChat = S.t; push(u.c, 0.002, u.name); }
  } else if (e.type === 'join') {
    const ci = countryOf(e.team); if (ci >= 0) join(name, ci);
  } else if (e.type === 'like') {
    const u = user(name); if (u.c >= 0) push(u.c, Math.min(Number(e.count) || 1, 15) * 0.0006, u.name);
  } else if (e.type === 'gift') {
    const g = GIFTS[e.gift]; if (!g) return;
    const n = clamp(Math.floor(Number(e.count) || 1), 1, 15);
    let ci = countryOf(e.team); const u = user(name);
    if (ci >= 0) join(name, ci, true); else ci = u.c;
    if (ci < 0 && S.phase === 'race') { ci = Math.floor(Math.random() * S.C.length); join(name, ci, true); feed(`🎲 ${u.name} nu și-a ales țara: i-am dat ${S.C[ci].flag}`); }
    if (ci < 0) return;
    feed(`${S.verified ? '🎁' : '📡'} ${u.name} · ${g.e} ${g.n} x${n} → ${S.C[ci].flag} ${S.C[ci].code}`);
    push(ci, g.boost * n, u.name);
  }
}

// ---------- round flow ----------
function begin() {
  S.C.forEach((c) => { c.pos = 0; c.dp = 0; c.pts = 0; c.sprint = 0; });
  S.roundPts = new Map(); S.t = 0; S.count = COUNTDOWN; S.phase = 'count'; S.boostSum = 0; S.goalB = 1.2; S.dbl = -1; S.idle = 0; S.winner = -1;
  S.confetti = []; $('intro').hidden = true; $('result').hidden = true;
  feed('Runda ' + S.round + ' începe! Scrie codul țării tale.');
}
function finish(ci) {
  if (S.phase !== 'race') return;
  S.phase = 'result'; S.winner = ci; S.flash = 1;
  const c = S.C[ci]; S.wins[c.code] = (S.wins[c.code] || 0) + 1;
  try { localStorage.setItem('race.wins', JSON.stringify(S.wins)); } catch (e) { /* optional */ }
  for (let i = 0; i < 120; i++) S.confetti.push({ x: Math.random() * W, y: -Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 160, r: 3 + Math.random() * 4, col: ['#ffd34d', '#ff5d7a', '#58b6ff', '#5dff9a'][i % 4], rot: Math.random() * 6 });
  const mvp = [...S.roundPts.entries()].sort((a, b) => b[1] - a[1])[0];
  const top = Object.entries(S.wins).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + v).join(' · ');
  $('rFlag').textContent = c.flag; $('rTitle').textContent = c.name.toUpperCase() + ' CÂȘTIGĂ!';
  $('rText').textContent = `${c.sup} susținători${mvp ? ' · 👑 MVP: ' + mvp[0] : ' · fără cadouri în runda asta'}`;
  $('rBoard').textContent = 'Victorii (pe acest dispozitiv): ' + top;
  setTimeout(() => { if (S.phase === 'result') $('result').hidden = false; }, 900);
  S.auto = AUTO_NEXT;
}

function update(dt) {
  S.t += dt;
  if (S.phase === 'count') { S.count -= dt; if (S.count <= 0) { S.phase = 'race'; S.t = 0; feed('🏁 START!'); } }
  else if (S.phase === 'race') {
    if (S.t >= ROUND_TIME) finish(leader()); // timeout: the horse in front wins
    S.idle += dt;
    if (S.idle > 15) { S.idle = 0; feed('💬 Scrie codul țării tale și trimite cadouri!'); } // text only
  } else if (S.phase === 'result') { S.auto -= dt; $('again').textContent = '↻ CURSA URMĂTOARE (' + Math.max(0, Math.ceil(S.auto)) + ')'; if (S.auto <= 0) { S.round++; begin(); } }
  if (S.bots) { S.botT -= dt; if (S.botT <= 0) { S.botT = 0.12 + Math.random() * 0.25; bot(); } }
  for (const c of S.C) { c.dp += (c.pos - c.dp) * Math.min(1, dt * 5); c.sprint = Math.max(0, c.sprint - dt * 1.2); const run = c.sprint > 0.02 || Math.abs(c.pos - c.dp) > 0.004; if (run) c.cyc = (c.cyc || 0) + dt * (2.6 + c.sprint * 2.2 + Math.min(2, (c.pos - c.dp) * 30)); }
  S.spark = S.spark.filter((p) => (p.life -= dt) > 0); S.spark.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; });
  S.confetti.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 4; }); S.confetti = S.confetti.filter((p) => p.y < H + 20);
  S.flash = Math.max(0, S.flash - dt * 2);
}

// simulated viewers: clearly labelled test bots (never presented as real TikTok users)
const BOTN = ['ana', 'mihai', 'luca', 'sara', 'omar', 'kenji', 'lia', 'diego', 'mert', 'putra', 'nam', 'somsak', 'raj', 'bia', 'tony'];
function bot() {
  const name = '🤖' + BOTN[Math.floor(Math.random() * BOTN.length)] + Math.floor(Math.random() * 9);
  const u = user(name);
  if (u.c < 0) { ev({ type: 'chat', username: name, text: S.C[Math.floor(Math.random() * S.C.length)].code }); return; }
  const r = Math.random();
  if (r < 0.55) ev({ type: 'chat', username: name, text: 'go' });
  else if (r < 0.65) ev({ type: 'like', username: name, count: 5 });
  else ev({ type: 'gift', username: name, gift: r < 0.9 ? 'rose' : r < 0.96 ? 'heart' : r < 0.985 ? 'flame' : 'rocket', count: 1 });
}

// ---------- assets (Gemini-generated, see assets/race/README.md) ----------
const IMG = { horse: new Image(), stadium: new Image(), dirt: new Image() };
IMG.horse.src = 'assets/race/horse_bay.webp'; IMG.stadium.src = 'assets/race/stadium.jpg'; IMG.dirt.src = 'assets/race/dirt.jpg';
const COATS = [{ l: 1, s: 1 }, { l: 0.55, s: 0.8 }, { l: 1.22, s: 1.3, r: 1.14, b: 0.78 }, { l: 1.2, s: 0.12 }, { l: 0.34, s: 0.5 }];
let atlases = null, dirtPat = null; const FR = 8;
function hexRGB(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function buildAtlases() {
  const im = IMG.horse; if (!im.complete || !im.naturalWidth) return;
  atlases = S.C.map((c, ci) => {
    const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    const id = g.getImageData(0, 0, cv.width, cv.height), d = id.data, fw = cv.width / FR, fh = cv.height;
    const coat = COATS[ci % COATS.length], [cr, cg, cb] = hexRGB(c.col);
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const o = (y * cv.width + x) * 4; if (d[o + 3] < 8) continue;
      const r = d[o], g2 = d[o + 1], b = d[o + 2], mx = Math.max(r, g2, b), mn = Math.min(r, g2, b), lum = r * 0.3 + g2 * 0.59 + b * 0.11;
      const fx = (x % fw) / fw, fy = y / fh;
      if (mn > 135 && mx - mn < 48 && fy < 0.52 && fx < 0.8) { // white silks / helmet -> country colour (keeps the cloth shading)
        const k = clamp(lum / 225, 0.25, 1.1); d[o] = clamp(cr * k + 18, 0, 255); d[o + 1] = clamp(cg * k + 18, 0, 255); d[o + 2] = clamp(cb * k + 18, 0, 255);
      } else if (!(mn > 135 && mx - mn < 48)) { // coat colour variants
        let nr = lum + (r - lum) * coat.s, ng = lum + (g2 - lum) * coat.s, nb = lum + (b - lum) * coat.s;
        nr *= coat.l * (coat.r || 1); ng *= coat.l; nb *= coat.l * (coat.b || 1);
        d[o] = clamp(nr, 0, 255); d[o + 1] = clamp(ng, 0, 255); d[o + 2] = clamp(nb, 0, 255);
      }
    }
    g.putImageData(id, 0, 0); return cv;
  });
}
IMG.horse.onload = buildAtlases; if (IMG.horse.complete) buildAtlases();
IMG.dirt.onload = () => { dirtPat = ctx.createPattern(IMG.dirt, 'repeat'); }; if (IMG.dirt.complete && IMG.dirt.naturalWidth) dirtPat = ctx.createPattern(IMG.dirt, 'repeat');
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function glass(x, y, w, h, r, edge) { rr(x, y, w, h, r); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,.04)'); ctx.fillStyle = 'rgba(6,16,12,.62)'; ctx.fill(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = edge || 'rgba(255,224,138,.35)'; ctx.lineWidth = 1; ctx.stroke(); }

function drawHorse(ci, cx, baseY, h) {
  const c = S.C[ci], at = atlases && atlases[ci]; if (!at) return;
  const fw = at.width / FR, fh = at.height, w = h * fw / fh;
  const running = c.sprint > 0.02 || Math.abs(c.pos - c.dp) > 0.004;
  const frame = running ? Math.floor(((c.cyc % 1) + 1) % 1 * FR) : 2;
  const bob = running ? Math.sin(c.cyc * Math.PI * 2) * h * 0.02 : Math.sin(S.t * 1.6 + ci) * h * 0.008;
  // soft ground shadow
  ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.beginPath(); ctx.ellipse(cx, baseY + 1, w * 0.36, h * 0.07, 0, 0, 7); ctx.fill();
  if (running) { ctx.globalAlpha = 0.25 + c.sprint * 0.3; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { const yy = baseY - h * (0.2 + k * 0.22); ctx.beginPath(); ctx.moveTo(cx - w * 0.5 - 10 - k * 6, yy); ctx.lineTo(cx - w * 0.5 - 38 - k * 8, yy); ctx.stroke(); } ctx.globalAlpha = 1; }
  if (i_leader === ci && c.pos > 0.02) { ctx.shadowColor = c.col; ctx.shadowBlur = 14; }
  ctx.drawImage(at, frame * fw, 0, fw, fh, cx - w * 0.5, baseY - h + bob, w, h); ctx.shadowBlur = 0;
}
let i_leader = 0;
function draw() {
  i_leader = leader();
  ctx.fillStyle = '#04100a'; ctx.fillRect(0, 0, W, H);
  // ---- header: stadium photo + title ----
  const st = IMG.stadium;
  if (st.complete && st.naturalWidth) { const r = Math.max(W / st.naturalWidth, L.top / st.naturalHeight), w = st.naturalWidth * r, h = st.naturalHeight * r; ctx.drawImage(st, (W - w) / 2, (L.top - h) / 2, w, h); }
  const hg = ctx.createLinearGradient(0, 0, 0, L.top); hg.addColorStop(0, 'rgba(3,10,6,.55)'); hg.addColorStop(0.55, 'rgba(3,10,6,.35)'); hg.addColorStop(1, 'rgba(3,10,6,.92)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, W, L.top);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tg = ctx.createLinearGradient(0, L.top * 0.12, 0, L.top * 0.42); tg.addColorStop(0, '#fff3c4'); tg.addColorStop(0.5, '#ffd34d'); tg.addColorStop(1, '#d98a1c');
  ctx.font = 'italic 1000 ' + Math.round(W * 0.082) + 'px system-ui,sans-serif'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; ctx.fillStyle = tg;
  ctx.fillText('CURSA ȚĂRILOR', W / 2, L.top * 0.27); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#e8fff0'; ctx.font = '800 ' + Math.round(W * 0.027) + 'px system-ui,sans-serif'; ctx.fillText('SCRIE CODUL ȚĂRII ÎN CHAT · CADOURILE = IMPULS', W / 2, L.top * 0.5);
  const tl = S.phase === 'race' ? Math.max(0, Math.ceil(ROUND_TIME - S.t)) : S.phase === 'result' ? 0 : ROUND_TIME;
  const dbl = S.dbl >= 0 && S.t - S.dbl < 15 && S.phase === 'race';
  const pw = W * 0.9, px = (W - pw) / 2, py = L.top * 0.64, ph = L.top * 0.31;
  glass(px, py, pw, ph, 12, dbl ? 'rgba(255,211,77,.9)' : undefined);
  ctx.font = '900 ' + Math.round(W * 0.034) + 'px system-ui,sans-serif'; ctx.fillStyle = dbl ? '#ffd34d' : '#ffffff';
  ctx.fillText((dbl ? '⚡ x2 ' + Math.ceil(15 - (S.t - S.dbl)) + 's  ' : '') + '⏱ ' + String(Math.floor(tl / 60)).padStart(2, '0') + ':' + String(tl % 60).padStart(2, '0') + '   🎯 ' + Math.round(S.boostSum * 100) + '/' + Math.round(S.goalB * 100), W / 2, py + ph * 0.34);
  const order = [...S.C.keys()].sort((a, b) => S.C[b].pos - S.C[a].pos).slice(0, 3); const medals = ['🥇', '🥈', '🥉'];
  ctx.font = '800 ' + Math.round(W * 0.03) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.fillStyle = '#ffffffee';
  ctx.fillText(order.map((i, k) => medals[k] + S.C[i].flag + ' ' + Math.round(S.C[i].pos * 100) + '%').join('    '), W / 2, py + ph * 0.74);
  // ---- track ----
  const lh = L.laneH, tx0 = 0, tw = W;
  S.C.forEach((c, i) => {
    const y = L.laneTop + i * lh;
    if (dirtPat) { ctx.save(); ctx.translate(0, y); ctx.fillStyle = dirtPat; ctx.fillRect(0, 0, tw, lh); ctx.restore(); } else { ctx.fillStyle = '#8a6a45'; ctx.fillRect(0, y, tw, lh); }
    ctx.fillStyle = i % 2 ? 'rgba(20,10,0,.32)' : 'rgba(20,10,0,.18)'; ctx.fillRect(0, y, tw, lh);
    const lg = ctx.createLinearGradient(0, y, 0, y + lh); lg.addColorStop(0, 'rgba(0,0,0,.22)'); lg.addColorStop(0.2, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,.28)'); ctx.fillStyle = lg; ctx.fillRect(0, y, tw, lh);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(0, y + lh - 1, tw, 1.2);
  });
  // lane progress glow under each horse
  S.C.forEach((c, i) => { const y = L.laneTop + i * lh; ctx.fillStyle = c.col; ctx.globalAlpha = 0.5; ctx.fillRect(L.startX, y + lh - 3, (L.finX - L.startX) * c.dp, 2.4); ctx.globalAlpha = 1; });
  // finish gantry
  const fx = L.finX - 6, fh2 = S.C.length * lh, ch = 7;
  for (let r = 0; r < fh2 / ch; r++) for (let k = 0; k < 2; k++) { ctx.fillStyle = (r + k) % 2 ? '#111' : '#fff'; ctx.fillRect(fx + k * ch, L.laneTop + r * ch, ch, Math.min(ch, fh2 - r * ch)); }
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffffff55'; ctx.fillRect(fx - 1, L.laneTop, 1.5, fh2); ctx.shadowBlur = 0;
  // start line
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(L.startX - 3, L.laneTop, 2, fh2);
  // horses + badges (top to bottom so lower lanes overlap upper ones: depth)
  S.C.forEach((c, i) => {
    const y = L.laneTop + i * lh, x = L.startX + c.dp * (L.finX - L.startX - lh * 2.0) + lh * 1.05;
    drawHorse(i, x, y + lh * 0.94, lh * 1.3);
    if (i_leader === i && c.pos > 0.02) { ctx.font = Math.round(lh * 0.42) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('👑', x + lh * 0.2, y - lh * 0.02); }
    if (c.sup > 0) { const t = '👥 ' + c.sup, w = ctx.measureText(t).width; ctx.font = '800 ' + Math.round(lh * 0.24) + 'px system-ui,"Noto Color Emoji",sans-serif'; const tw2 = ctx.measureText(t).width + 10; glass(x + lh * 0.9, y + lh * 0.04, tw2, lh * 0.3, 8, c.col); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t, x + lh * 0.9 + tw2 / 2, y + lh * 0.2); }
    // flag badge
    glass(3, y + 2, L.startX - 8, lh - 4, 9, c.col);
    ctx.textAlign = 'center'; ctx.font = Math.round(lh * 0.5) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(c.flag, (L.startX - 2) / 2, y + lh * 0.38);
    ctx.font = '900 ' + Math.round(lh * 0.25) + 'px system-ui,sans-serif'; ctx.fillStyle = c.col; ctx.fillText(c.code, (L.startX - 2) / 2, y + lh * 0.78);
  });
  S.spark.forEach((p) => { ctx.globalAlpha = clamp(p.life * 2, 0, 0.8); ctx.fillStyle = '#d9bf93'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
  // ---- bottom panel ----
  const bg2 = ctx.createLinearGradient(0, L.bot, 0, H); bg2.addColorStop(0, '#07150d'); bg2.addColorStop(1, '#030a06'); ctx.fillStyle = bg2; ctx.fillRect(0, L.bot, W, H - L.bot);
  const gh = (H - L.bot) * 0.36, gw = (W - 12) / 5;
  Object.values(GIFTS).forEach((g2, i) => { const x = 6 + i * gw + 2; glass(x, L.bot + 6, gw - 4, gh, 10); ctx.textAlign = 'center'; ctx.font = Math.round(gh * 0.5) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(g2.e, x + (gw - 4) / 2, L.bot + 6 + gh * 0.36); ctx.font = '900 ' + Math.round(gh * 0.26) + 'px system-ui,sans-serif'; ctx.fillStyle = '#ffd34d'; ctx.fillText('+' + (g2.boost * 100).toFixed(1).replace('.0', '') + '%', x + (gw - 4) / 2, L.bot + 6 + gh * 0.82); });
  ctx.textAlign = 'left'; ctx.font = '700 ' + Math.round(W * 0.029) + 'px system-ui,"Noto Color Emoji",sans-serif';
  S.feed.slice(0, 3).forEach((f, i) => { const y = L.bot + 6 + gh + 14 + i * (H - L.bot - gh - 18) / 3; ctx.globalAlpha = clamp(1.25 - (S.t - f.at) * 0.03, 0.4, 1) * (1 - i * 0.18); ctx.fillStyle = '#e8fff0'; ctx.fillText(f.msg.slice(0, 56), 10, y); }); ctx.globalAlpha = 1;
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (S.phase === 'count') { ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, H * 0.4, W, H * 0.16); ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 24; ctx.fillStyle = '#ffe08a'; ctx.font = '1000 ' + Math.round(W * 0.2) + 'px system-ui,sans-serif'; ctx.fillText(String(Math.max(1, Math.ceil(S.count))), W / 2, H * 0.48); ctx.shadowBlur = 0; }
  S.confetti.forEach((p) => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); });
  if (S.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + S.flash * 0.35 + ')'; ctx.fillRect(0, 0, W, H); }
}

// ---------- relay (same protocol as the boxing game; status is never assumed) ----------
function setStatus() { $('status').textContent = S.sock && S.relayOpen ? (S.verified ? '● TIKTOK LIVE (raportat de relay)' : '● RELAY NEVERIFICAT') : S.bots ? '● DEMO · BOȚI' : '● DEMO'; }
function disc() { if (S.sock) { S.sock.onclose = null; S.sock.close(); S.sock = null; } S.relayOpen = false; S.verified = false; setStatus(); $('cstat').textContent = '● Deconectat'; }
function conn() {
  const url = $('relay').value.trim();
  if (!/^wss:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(url)) { $('cstat').textContent = 'Adresa trebuie să înceapă cu wss://'; return; }
  disc(); $('cstat').textContent = '◌ Conectare...';
  try {
    const s = new WebSocket(url); S.sock = s;
    s.onopen = () => { if (S.sock !== s) return; S.relayOpen = true; S.verified = false; setStatus(); $('cstat').textContent = '● Conectat, dar NEVERIFICAT: nu am primit confirmarea unei camere TikTok LIVE.'; };
    s.onmessage = (m) => { if (S.sock !== s) return; try { const d = JSON.parse(m.data); if (d.type === 'status') { S.verified = d.tiktok === 'connected' && typeof d.roomId === 'string' && d.roomId.length > 0; setStatus(); $('cstat').textContent = S.verified ? '● Relay raportează camera ' + d.roomId.slice(0, 24) + ' (nu e verificat de joc)' : '● Relay: TikTok ' + String(d.tiktok || 'necunoscut').slice(0, 30); } else ev(d); } catch (e) { /* malformed */ } };
    s.onerror = () => { if (S.sock === s) $('cstat').textContent = '● Conexiune eșuată'; };
    s.onclose = () => { if (S.sock === s) disc(); };
  } catch (e) { disc(); }
}

// ---------- UI ----------
const sel = $('myc'); S.C.forEach((c, i) => { const o = document.createElement('option'); o.value = i; o.textContent = c.flag + ' ' + c.name; sel.append(o); });
$('start').addEventListener('click', begin);
$('again').addEventListener('click', () => { S.round++; begin(); });
document.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => ev({ type: 'gift', username: 'Tu', gift: b.dataset.g, count: 1, team: S.C[+sel.value].code })));
function sendChat() { const v = $('chat').value.trim().slice(0, 60); $('chat').value = ''; if (!v) return; ev({ type: 'chat', username: 'Tu', text: v }); if (countryOf(v) < 0) feed('💬 Tu: ' + v); }
$('send').addEventListener('click', sendChat); $('chat').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });
sel.addEventListener('change', () => join('Tu', +sel.value));
$('bots').addEventListener('click', () => { S.bots = !S.bots; $('bots').textContent = '🤖 BOȚI: ' + (S.bots ? 'ON' : 'OFF'); setStatus(); });
$('set').addEventListener('click', () => { $('settings').hidden = false; }); $('closeSet').addEventListener('click', () => { $('settings').hidden = true; });
$('conn').addEventListener('click', conn); $('disc').addEventListener('click', disc); window.addEventListener('pagehide', disc);
if (new URLSearchParams(location.search).get('live') === '1') $('ctl').hidden = true; // clean broadcast view

layout(); join('Tu', 0, true);
let last = performance.now(), raf = 0;
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); raf = requestAnimationFrame(frame); }
raf = requestAnimationFrame(frame);

window.RaceV1 = {
  version: '1.0-prototype', demo: true,
  getState: () => ({ phase: S.phase, t: S.t, pos: S.C.map((c) => +c.pos.toFixed(3)), sup: S.C.map((c) => c.sup), winner: S.winner, wins: { ...S.wins }, round: S.round, verified: S.verified }),
  inject: ev,
  advance(sec, step = 1 / 60) { cancelAnimationFrame(raf); for (let t = 0; t < sec - 1e-9; t += step) update(Math.min(step, sec - t)); draw(); },
  resume() { last = performance.now(); raf = requestAnimationFrame(frame); },
};
