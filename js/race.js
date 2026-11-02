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
  C: COUNTRIES.map((c) => ({ ...c, pos: 0, dp: 0, sup: 0, pts: 0, phase: Math.random() * 6, sprint: 0 })),
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
  const top = Math.round(H * 0.17), bot = Math.round(H * 0.16);
  L = { top, laneTop: top, laneH: (H - top - bot) / S.C.length, bot: H - bot, startX: 46, finX: W - 14 };
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
  for (const c of S.C) { c.dp += (c.pos - c.dp) * Math.min(1, dt * 5); c.sprint = Math.max(0, c.sprint - dt * 1.2); c.phase += dt * (2 + c.sprint * 14 + (c.pos - c.dp) * 80); }
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

// ---------- drawing ----------
function horse(x, y, s, col, phase, sprint, flip) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const sw = Math.sin(phase), sw2 = Math.sin(phase + Math.PI);
  ctx.shadowColor = col; ctx.shadowBlur = 6 + sprint * 14;
  ctx.strokeStyle = col; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  const leg = (x0, sv) => { ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + sv * 7, 10); ctx.lineTo(x0 + sv * 3, 17); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(x0 + sv * 3 - 1.5, 16, 3.5, 2.5); };
  leg(-9, sw); leg(-6, sw2); leg(8, sw2); leg(11, sw);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, -1, 14, 6.5, 0, 0, 7); ctx.fill();            // body
  ctx.beginPath(); ctx.moveTo(9, -4); ctx.lineTo(17, -13); ctx.lineTo(21, -10); ctx.lineTo(13, 1); ctx.fill(); // neck
  ctx.beginPath(); ctx.ellipse(21, -11, 6, 3.4, 0.5, 0, 7); ctx.fill();          // head
  ctx.fillStyle = '#ffffffee'; ctx.beginPath(); ctx.moveTo(12, -9); ctx.lineTo(8, -14 + sw * 1.5); ctx.lineTo(16, -12); ctx.fill(); // mane
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-13, -3); ctx.quadraticCurveTo(-21, -4 + sw * 3, -22, 2 + sw2 * 2); ctx.stroke(); // tail
  ctx.shadowBlur = 0; ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(22.5, -12, 0.9, 0, 7); ctx.fill();
  ctx.restore();
}
function draw() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d2a3a'); g.addColorStop(0.18, '#0b1d12'); g.addColorStop(1, '#06110a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // header
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe08a'; ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 12; ctx.font = 'italic 900 ' + Math.round(W * 0.075) + 'px system-ui,sans-serif';
  ctx.fillText('🏁 CURSA ȚĂRILOR', W / 2, L.top * 0.26); ctx.shadowBlur = 0;
  ctx.fillStyle = '#d7f5e1'; ctx.font = '800 ' + Math.round(W * 0.029) + 'px system-ui,sans-serif';
  ctx.fillText('SCRIE CODUL ȚĂRII ÎN CHAT · CADOURILE = IMPULS', W / 2, L.top * 0.5);
  const tl = S.phase === 'race' ? Math.max(0, Math.ceil(ROUND_TIME - S.t)) : S.phase === 'result' ? 0 : ROUND_TIME;
  const dbl = S.dbl >= 0 && S.t - S.dbl < 15 && S.phase === 'race';
  ctx.fillStyle = dbl ? '#ffd34d' : '#ffffffcc'; ctx.font = '900 ' + Math.round(W * 0.04) + 'px system-ui,sans-serif';
  ctx.fillText((dbl ? '⚡ x2 ' + Math.ceil(15 - (S.t - S.dbl)) + 's · ' : '') + '⏱ ' + String(Math.floor(tl / 60)).padStart(2, '0') + ':' + String(tl % 60).padStart(2, '0') + ' · 🎯 ' + Math.round(S.boostSum * 100) + '/' + Math.round(S.goalB * 100), W / 2, L.top * 0.74);
  // standings (top 3)
  const order = [...S.C.keys()].sort((a, b) => S.C[b].pos - S.C[a].pos).slice(0, 3);
  ctx.font = '800 ' + Math.round(W * 0.03) + 'px system-ui,sans-serif'; ctx.fillStyle = '#ffffffdd';
  ctx.fillText(order.map((i, k) => (k + 1) + '.' + S.C[i].flag + Math.round(S.C[i].pos * 100) + '%').join('   '), W / 2, L.top * 0.93);
  // lanes
  const lh = L.laneH;
  S.C.forEach((c, i) => {
    const y = L.laneTop + i * lh;
    ctx.fillStyle = i % 2 ? '#1c6a30' : '#237a38'; ctx.fillRect(0, y, W, lh);
    ctx.fillStyle = '#ffffff22'; ctx.fillRect(0, y, W, 1);
    // flag chip + code
    ctx.fillStyle = '#00000066'; ctx.fillRect(0, y, L.startX - 4, lh);
    ctx.font = Math.round(lh * 0.55) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.fillText(c.flag, 3, y + lh * 0.45);
    ctx.font = '900 ' + Math.round(lh * 0.26) + 'px system-ui,sans-serif'; ctx.fillStyle = c.col; ctx.fillText(c.code, 5, y + lh * 0.86);
    // ghost name watermark
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff'; ctx.font = 'italic 900 ' + Math.round(lh * 0.5) + 'px system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(c.name.toUpperCase(), W * 0.55, y + lh * 0.55); ctx.globalAlpha = 1;
    const x = L.startX + c.dp * (L.finX - L.startX - 28);
    horse(x + 14, y + lh * 0.55, lh / 30, c.col, c.phase, c.sprint, false);
    if (i === leader() && c.pos > 0.02) { ctx.textAlign = 'left'; ctx.font = Math.round(lh * 0.4) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.fillText('👑', x + 8, y + lh * 0.18); }
    ctx.textAlign = 'left'; ctx.font = '800 ' + Math.round(lh * 0.22) + 'px system-ui,sans-serif'; ctx.fillStyle = '#ffffffcc';
    ctx.fillText(c.sup > 0 ? '👥' + c.sup : '', x + 38, y + lh * 0.2);
  });
  // start / finish
  ctx.fillStyle = '#ffffffaa'; ctx.fillRect(L.startX - 4, L.laneTop, 2, S.C.length * lh);
  const fx = L.finX - 4, ch = 8;
  for (let r = 0; r < S.C.length * lh / ch; r++) for (let k = 0; k < 2; k++) { ctx.fillStyle = (r + k) % 2 ? '#111' : '#fff'; ctx.fillRect(fx + k * ch / 1.2, L.laneTop + r * ch, ch / 1.2, ch); }
  S.spark.forEach((p) => { ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 3, 3); }); ctx.globalAlpha = 1;
  // bottom: gift legend + feed
  ctx.fillStyle = '#04100a'; ctx.fillRect(0, L.bot, W, H - L.bot);
  ctx.textAlign = 'center'; const gx = W / 5; Object.values(GIFTS).forEach((g2, i) => {
    ctx.font = Math.round(W * 0.06) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(g2.e, gx * (i + 0.5), L.bot + (H - L.bot) * 0.2);
    ctx.font = '900 ' + Math.round(W * 0.028) + 'px system-ui,sans-serif'; ctx.fillStyle = '#ffe08a'; ctx.fillText('+' + (g2.boost * 100).toFixed(1).replace('.0', '') + '%', gx * (i + 0.5), L.bot + (H - L.bot) * 0.42);
  });
  ctx.textAlign = 'left'; ctx.font = '700 ' + Math.round(W * 0.03) + 'px system-ui,sans-serif';
  S.feed.slice(0, 3).forEach((f, i) => { ctx.globalAlpha = clamp(1.2 - (S.t - f.at) * 0.03, 0.35, 1) * (1 - i * 0.2); ctx.fillStyle = '#e8fff0'; ctx.fillText(f.msg.slice(0, 54), 8, L.bot + (H - L.bot) * (0.62 + i * 0.16)); }); ctx.globalAlpha = 1;
  // countdown banner
  if (S.phase === 'count') { ctx.textAlign = 'center'; ctx.fillStyle = '#000a'; ctx.fillRect(0, H * 0.4, W, H * 0.16); ctx.fillStyle = '#ffe08a'; ctx.font = '1000 ' + Math.round(W * 0.2) + 'px system-ui,sans-serif'; ctx.fillText(String(Math.max(1, Math.ceil(S.count))), W / 2, H * 0.48); }
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
