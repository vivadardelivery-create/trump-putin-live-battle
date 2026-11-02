// CURSA ȚĂRILOR v2 — country horse race for TikTok LIVE (2D canvas).
// Rules: nothing moves a horse except viewer events (gift / chat / like). No idle auto-movement.
// v2: varied Gemini horse sets, photo-finish slow-mo, last-10s snipe zone, lead-change callouts, season + viewer levels (localStorage).
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const canvas = $('c'), ctx = canvas.getContext('2d');

const COUNTRIES = [
  { code: 'RO', name: 'România', flag: '🇷🇴', col: '#f7d117', alias: ['romania', 'ro'], horse: { sheet: 'bay', coat: { l: 1, s: 1 }, name: 'Fulger', stride: 1.0 } },
  { code: 'US', name: 'SUA', flag: '🇺🇸', col: '#3d7bff', alias: ['usa', 'us', 'america', 'sua'], horse: { sheet: 'stallion', coat: { l: 1, s: 1 }, name: 'Maverick', stride: 1.1 } },
  { code: 'BR', name: 'Brazilia', flag: '🇧🇷', col: '#2fd36b', alias: ['brazil', 'brasil', 'brazilia', 'br'], horse: { sheet: 'chestnut', coat: { l: 1, s: 1 }, name: 'Samba', stride: 0.95 } },
  { code: 'TR', name: 'Turcia', flag: '🇹🇷', col: '#ff3b4a', alias: ['turkey', 'turcia', 'turkiye', 'tr'], horse: { sheet: 'grey', coat: { l: 1, s: 1 }, name: 'Yildirim', stride: 1.05 } },
  { code: 'IN', name: 'India', flag: '🇮🇳', col: '#ff9a2e', alias: ['india', 'in'], horse: { sheet: 'bay', coat: { l: 0.55, s: 0.8 }, name: 'Raja', stride: 0.92 } },
  { code: 'ID', name: 'Indonezia', flag: '🇮🇩', col: '#ff6b6b', alias: ['indonesia', 'indonezia', 'id'], horse: { sheet: 'chestnut', coat: { l: 1.15, s: 1.1, r: 1.1, b: 0.65 }, name: 'Garuda', stride: 1.12 } },
  { code: 'PH', name: 'Filipine', flag: '🇵🇭', col: '#4aa8ff', alias: ['philippines', 'filipine', 'ph'], horse: { sheet: 'grey', coat: { l: 0.7, s: 0.9 }, name: 'Bayani', stride: 0.98 } },
  { code: 'MX', name: 'Mexic', flag: '🇲🇽', col: '#38c172', alias: ['mexico', 'mexic', 'mx'], horse: { sheet: 'bay', coat: { l: 1.25, s: 1.1, r: 1.1, b: 0.8 }, name: 'Azteca', stride: 1.06 } },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', col: '#ff5252', alias: ['vietnam', 'vn'], horse: { sheet: 'grey', coat: { l: 1.25, s: 0.3 }, name: 'Rong', stride: 1.0 } },
  { code: 'TH', name: 'Thailanda', flag: '🇹🇭', col: '#9b7bff', alias: ['thailand', 'thailanda', 'th'], horse: { sheet: 'chestnut', coat: { l: 0.6, s: 1 }, name: 'Naga', stride: 1.03 } },
];
const GIFTS = {
  rose: { e: '🌹', n: 'Trandafir', boost: 0.012 },
  heart: { e: '💖', n: 'Inimă', boost: 0.03 },
  flame: { e: '🔥', n: 'Flacără', boost: 0.06 },
  rocket: { e: '🚀', n: 'Rachetă', boost: 0.12 },
  lion: { e: '🦁', n: 'Leu', boost: 0.25 },
};
const ROUND_TIME = 100, COUNTDOWN = 3.6, AUTO_NEXT = 12, FINISH_TIME = 3.0, SNIPE_WINDOW = 10, RACES_PER_SEASON = 10;
const PLACE_PTS = [10, 7, 5, 4, 3, 2, 1, 0, 0, 0];
const TITLES = [[1, 'Novice'], [3, 'Suporter'], [5, 'Fan'], [8, 'Ultra'], [12, 'Legendă']];
const titleOf = (lv) => TITLES.reduce((t, [m, n]) => (lv >= m ? n : t), 'Novice');
const levelOf = (xp) => Math.floor(Math.sqrt(xp / 10)) + 1;

// ---------- persistent progress (this device only) ----------
const DB_KEY = 'race.v2';
let DB = { season: 1, race: 0, pts: {}, trophies: {}, wins: {}, viewers: {}, records: {}, champs: [] };
try { Object.assign(DB, JSON.parse(localStorage.getItem(DB_KEY) || '{}')); } catch (e) { /* fresh */ }
let dirty = false;
function save() { dirty = false; try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) { /* storage optional */ } }
const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

const S = {
  phase: 'intro', t: 0, count: 0, auto: 0, fin: 0, ts: 1, zoom: 0, goalB: 1.2, boostSum: 0, dbl: -1, idle: 0, round: 1, lead: -1,
  C: COUNTRIES.map((c) => ({ ...c, pos: 0, dp: 0, sup: 0, pts: 0, cyc: Math.random(), sprint: 0 })),
  users: new Map(), roundPts: new Map(), feed: [], seen: new Set(), spark: [], confetti: [], order: [],
  call: null, big: null, comm: null, shake: 0, winner: -1, sock: null, relayOpen: false, verified: false, bots: false, botT: 0, flash: 0, finTxt: '',
};

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
function comm(txt) { S.comm = { txt, t: 3.2 }; }
const leader = () => S.C.reduce((b, c, i) => (c.pos > S.C[b].pos ? i : b), 0);
const lastPlace = () => S.C.reduce((b, c, i) => (c.pos < S.C[b].pos ? i : b), 0);
const isBot = (n) => n.startsWith('🤖');

// ---------- viewers & levels ----------
function user(name) {
  name = String(name || 'Spectator').replace(/[\u0000-\u001f]/g, '').slice(0, 20) || 'Spectator';
  const k = name.toLowerCase();
  if (!S.users.has(k)) {
    const u = { name, c: -1, lastChat: -9, xpS: 0 };
    if (!isBot(name)) { // daily-visit streak (persisted)
      const v = DB.viewers[k] || (DB.viewers[k] = { name, xp: 0, days: 0, streak: 0, last: '', wins: 0 });
      const t = today();
      if (v.last !== t) { v.streak = v.last === yesterday() ? v.streak + 1 : 1; v.days++; v.last = t; dirty = true; if (v.streak > 1) feed(`🔥 ${name} · seria de ${v.streak} zile`); }
    }
    S.users.set(k, u);
  }
  return S.users.get(k);
}
function addXp(u, amt) {
  if (isBot(u.name) || amt <= 0) return;
  const v = DB.viewers[u.name.toLowerCase()]; if (!v) return;
  const before = levelOf(v.xp); v.xp += amt; dirty = true;
  const after = levelOf(v.xp);
  if (after > before) { feed(`⬆️ ${u.name} a urcat la nivelul ${after} · ${titleOf(after)}`); S.call = { txt: `⬆️ ${u.name} · NIVEL ${after} · ${titleOf(after).toUpperCase()}`, t: 2.2, col: '#ffd34d' }; }
}
const badge = (u) => { if (isBot(u.name)) return ''; const v = DB.viewers[u.name.toLowerCase()]; return v ? ` [Lv${levelOf(v.xp)}]` : ''; };

function join(name, ci, quiet) {
  const u = user(name); if (u.c === ci) return u;
  if (u.c >= 0) S.C[u.c].sup--;
  u.c = ci; S.C[ci].sup++;
  if (!quiet) feed(`👤 ${u.name}${badge(u)} a intrat în echipa ${S.C[ci].flag} ${S.C[ci].code}`);
  return u;
}

// ---------- events (single entry point: nothing else moves a horse) ----------
function push(ci, amount, who, kind) { // the ONLY function that advances a horse
  if (S.phase !== 'race' || ci < 0) return;
  const last = lastPlace() === ci && S.C[leader()].pos - S.C[ci].pos > 0.2;
  const snipe = ROUND_TIME - S.t <= SNIPE_WINDOW;
  const mult = (S.dbl >= 0 && S.t - S.dbl < 15 ? 2 : 1) * (last ? 1.2 : 1) * (snipe ? 1.5 : 1);
  const c = S.C[ci]; c.pos = Math.min(1, c.pos + amount * mult); c.sprint = kind === 'big' ? 1.7 : 1; c.pts += amount * mult * 100;
  if (who) S.roundPts.set(who, (S.roundPts.get(who) || 0) + amount * mult * 100);
  S.boostSum += amount; S.idle = 0;
  if (S.boostSum >= S.goalB) { S.goalB += 1.5; S.dbl = S.t; feed('🎯 ȚINTĂ ATINSĂ! Impulsuri x2 timp de 15 s'); S.call = { txt: '🎯 ȚINTĂ ATINSĂ · IMPULSURI x2', t: 2.2, col: '#ffd34d' }; }
  const n = kind === 'big' ? 16 : 6;
  for (let i = 0; i < n; i++) S.spark.push({ x: L.startX + c.pos * (L.finX - L.startX), y: L.laneTop + (ci + 0.7) * L.laneH, vx: -30 - Math.random() * 80, vy: -30 + Math.random() * 50, life: 0.5, col: c.col });
  if (c.pos >= 1) finish(ci);
}
function ev(e) {
  if (!e || typeof e !== 'object') return;
  const name = e.username;
  if (e.id) { const id = String(e.id).slice(0, 120); if (S.seen.has(id)) return; S.seen.add(id); if (S.seen.size > 800) S.seen.clear(); }
  if (e.type === 'chat') {
    const ci = countryOf(e.text); const u = user(name);
    if (ci >= 0) join(name, ci);
    else if (u.c >= 0 && S.t - u.lastChat > 3) { u.lastChat = S.t; push(u.c, 0.002, u.name); addXp(u, 0.3); }
  } else if (e.type === 'join') {
    const ci = countryOf(e.team); if (ci >= 0) join(name, ci);
  } else if (e.type === 'like') {
    const u = user(name); if (u.c >= 0) { push(u.c, Math.min(Number(e.count) || 1, 15) * 0.0006, u.name); addXp(u, 0.1); }
  } else if (e.type === 'gift') {
    const g = GIFTS[e.gift]; if (!g) return;
    const n = clamp(Math.floor(Number(e.count) || 1), 1, 15);
    let ci = countryOf(e.team); const u = user(name);
    if (ci >= 0) join(name, ci, true); else ci = u.c;
    if (ci < 0 && S.phase === 'race') { ci = Math.floor(Math.random() * S.C.length); join(name, ci, true); feed(`🎲 ${u.name} nu și-a ales țara: i-am dat ${S.C[ci].flag}`); }
    if (ci < 0 || S.phase !== 'race') return;
    const val = g.boost * n;
    feed(`${S.verified ? '🎁' : '📡'} ${u.name}${badge(u)} · ${g.e} ${g.n} x${n} → ${S.C[ci].flag} ${S.C[ci].code}`);
    const big = e.gift === 'rocket' || e.gift === 'lion' || n >= 5;
    push(ci, val, u.name, big ? 'big' : '');
    addXp(u, val * 100);
    if (big) { S.big = { txt: `${g.e} ${u.name} · TURBO ${S.C[ci].flag} ${S.C[ci].horse.name}`, t: 2.4, col: S.C[ci].col }; S.flash = Math.max(S.flash, 0.35); S.shake = 0.5; comm(`${g.e} ${S.C[ci].horse.name} primește un TURBO!`); }
    if (!isBot(u.name) && (!DB.records.bigGift || val > DB.records.bigGift.val)) { DB.records.bigGift = { name: u.name, txt: `${g.e} ${g.n} x${n}`, val, code: S.C[ci].code }; dirty = true; }
  }
}

// ---------- round flow ----------
function begin() {
  S.C.forEach((c) => { c.pos = 0; c.dp = 0; c.pts = 0; c.sprint = 0; });
  S.roundPts = new Map(); S.t = 0; S.count = COUNTDOWN; S.phase = 'count'; S.boostSum = 0; S.goalB = 1.2; S.dbl = -1; S.idle = 0; S.winner = -1;
  S.lead = -1; S.ts = 1; S.zoom = 0; S.call = null; S.big = null; S.confetti = []; $('intro').hidden = true; $('result').hidden = true; $('hall').hidden = true;
  feed('Runda ' + S.round + ' · Sezon ' + DB.season + ' · cursa ' + (DB.race + 1) + '/' + RACES_PER_SEASON);
}
function finish(ci, timeout) {
  if (S.phase !== 'race') return;
  const sorted = [...S.C.keys()].sort((a, b) => (b === ci) - (a === ci) || S.C[b].pos - S.C[a].pos);
  S.order = sorted; S.winner = ci;
  const margin = S.C[ci].pos - S.C[sorted[1]].pos;
  S.finTxt = margin < 0.03 ? '📸 PHOTO FINISH!' : '🏁 ' + S.C[ci].flag + ' ' + S.C[ci].name.toUpperCase() + '!';
  S.phase = 'finish'; S.fin = FINISH_TIME; S.flash = 0.8; S.shake = 0.8; S.zoom = 0.001;
  S.finMargin = margin; S.finT = S.t;
  comm(margin < 0.03 ? 'Câștigă la milimetru!' : `${S.C[ci].horse.name} câștigă cursa!`);
}
function ceremony() { // after the slow-motion finish: scores, season, records, result screen
  const ci = S.winner, c = S.C[ci], ord = S.order;
  DB.wins[c.code] = (DB.wins[c.code] || 0) + 1;
  ord.forEach((i, k) => { DB.pts[S.C[i].code] = (DB.pts[S.C[i].code] || 0) + (PLACE_PTS[k] || 0); });
  const mvp = [...S.roundPts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (mvp && !isBot(mvp[0])) { const v = DB.viewers[mvp[0].toLowerCase()]; if (v) { v.wins = (v.wins || 0) + 1; v.xp += 15; } }
  if (!DB.records.fastest || S.finT < DB.records.fastest.t) DB.records.fastest = { code: c.code, t: +S.finT.toFixed(1) };
  if (S.finMargin > 0 && (!DB.records.closest || S.finMargin < DB.records.closest.m)) DB.records.closest = { code: c.code, m: +S.finMargin.toFixed(3) };
  DB.race++;
  let champTxt = '';
  if (DB.race >= RACES_PER_SEASON) {
    const best = Object.entries(DB.pts).sort((a, b) => b[1] - a[1] || (DB.wins[b[0]] || 0) - (DB.wins[a[0]] || 0))[0];
    if (best) { DB.trophies[best[0]] = (DB.trophies[best[0]] || 0) + 1; DB.champs.unshift({ season: DB.season, code: best[0], pts: best[1] }); DB.champs.length = Math.min(DB.champs.length, 12); const cc = COUNTRIES.find((x) => x.code === best[0]); champTxt = `🏆 CAMPIOANA SEZONULUI ${DB.season}: ${cc.flag} ${cc.name} (${best[1]} pct)`; }
    DB.season++; DB.race = 0; DB.pts = {};
  }
  save();
  for (let i = 0; i < 140; i++) S.confetti.push({ x: Math.random() * W, y: -Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 160, r: 3 + Math.random() * 4, col: ['#ffd34d', '#ff5d7a', '#58b6ff', '#5dff9a'][i % 4], rot: Math.random() * 6 });
  // result overlay (all text via textContent)
  $('rKick').textContent = `RUNDA ${S.round} · SEZON ${DB.race === 0 && champTxt ? DB.season - 1 : DB.season}`;
  $('rTitle').textContent = c.flag + ' ' + c.name.toUpperCase() + ' CÂȘTIGĂ!';
  const pod = $('rPodium'); pod.replaceChildren(...ord.slice(0, 3).map((i, k) => { const d = document.createElement('div'); d.textContent = ['🥇', '🥈', '🥉'][k] + ' ' + S.C[i].flag + ' ' + S.C[i].code + ' · +' + PLACE_PTS[k] + ' pct'; return d; }));
  $('rText').textContent = `${c.horse.name} · ${c.sup} susținători${mvp ? ' · 👑 MVP: ' + mvp[0] : ' · fără cadouri în runda asta'}`;
  $('rSeason').textContent = champTxt || `Sezon ${DB.season} · cursa ${DB.race}/${RACES_PER_SEASON} · clasament: ` + Object.entries(DB.pts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + v).join(' · ');
  drawRearHorse(ci);
  S.phase = 'result'; S.auto = AUTO_NEXT;
  setTimeout(() => { if (S.phase === 'result') $('result').hidden = false; }, 250);
}

function update(dt) {
  S.t += dt;
  const sd = dt * S.ts;
  if (S.phase === 'count') { S.count -= dt; if (S.count <= 0) { S.phase = 'race'; S.t = 0; S.shake = 0.4; feed('🏁 START!'); comm('Au pornit! Trimite cadouri!'); } }
  else if (S.phase === 'race') {
    if (S.t >= ROUND_TIME) finish(leader(), true); // timeout: the horse in front wins
    S.idle += dt;
    if (S.idle > 15) { S.idle = 0; feed('💬 Scrie codul țării tale și trimite cadouri!'); } // text only
    const ld = leader();
    if (S.C[ld].pos > 0.06 && S.C[ld].pos - S.C.filter((_, i) => i !== ld).reduce((m, c) => Math.max(m, c.pos), 0) > 0.012 && S.lead !== ld) {
      if (S.lead >= 0) { S.call = { txt: `👑 ${S.C[ld].flag} ${S.C[ld].horse.name} PREIA CONDUCEREA!`, t: 1.8, col: S.C[ld].col }; comm(`${S.C[ld].horse.name} o depășește pe ${S.C[S.lead].horse.name}!`); }
      S.lead = ld;
    }
    if (ROUND_TIME - S.t <= SNIPE_WINDOW && !S.snipeAnn) { S.snipeAnn = true; S.call = { txt: '⏱ ULTIMELE 10 SECUNDE · CADOURI x1.5', t: 2.6, col: '#ff6b6b' }; comm('Ultimele 10 secunde! Acum contează fiecare cadou!'); }
  } else if (S.phase === 'finish') {
    S.fin -= dt;
    S.ts = lerp(S.ts, S.fin > FINISH_TIME - 1.9 ? 0.28 : 0.7, Math.min(1, dt * 6));
    S.zoom = Math.min(1, S.zoom + dt * 1.1);
    if (S.fin <= 0) { S.ts = 1; ceremony(); }
  } else if (S.phase === 'result') {
    S.zoom = Math.max(0, S.zoom - dt * 1.5); S.ts = lerp(S.ts, 1, Math.min(1, dt * 5));
    S.auto -= dt; $('again').textContent = '↻ CURSA URMĂTOARE (' + Math.max(0, Math.ceil(S.auto)) + ')'; if (S.auto <= 0) { S.round++; begin(); }
  }
  if (S.phase !== 'race') S.snipeAnn = false;
  if (S.bots) { S.botT -= dt; if (S.botT <= 0) { S.botT = 0.12 + Math.random() * 0.25; bot(); } }
  for (const c of S.C) { c.dp += (c.pos - c.dp) * Math.min(1, sd * 5); c.sprint = Math.max(0, c.sprint - sd * 1.2); const run = c.sprint > 0.02 || Math.abs(c.pos - c.dp) > 0.004; if (run) c.cyc = (c.cyc || 0) + sd * (2.6 + c.sprint * 2.2 + Math.min(2, (c.pos - c.dp) * 30)) * c.horse.stride; }
  S.spark = S.spark.filter((p) => (p.life -= sd) > 0); S.spark.forEach((p) => { p.x += p.vx * sd; p.y += p.vy * sd; });
  S.confetti.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 4; }); S.confetti = S.confetti.filter((p) => p.y < H + 20);
  S.flash = Math.max(0, S.flash - dt * 2); S.shake = Math.max(0, S.shake - dt * 2.5);
  if (S.call && (S.call.t -= dt) <= 0) S.call = null; if (S.big && (S.big.t -= dt) <= 0) S.big = null; if (S.comm && (S.comm.t -= dt) <= 0) S.comm = null;
  if (dirty && Math.floor(S.t * 2) % 20 === 0) save();
}

// simulated viewers: clearly labelled test bots (never presented as real TikTok users, never saved)
const BOTN = ['ana', 'mihai', 'luca', 'sara', 'omar', 'kenji', 'lia', 'diego', 'mert', 'putra', 'nam', 'somsak', 'raj', 'bia', 'tony'];
function bot() {
  const name = '🤖' + BOTN[Math.floor(Math.random() * BOTN.length)] + Math.floor(Math.random() * 9);
  const u = user(name);
  if (u.c < 0) { ev({ type: 'chat', username: name, text: S.C[Math.floor(Math.random() * S.C.length)].code }); return; }
  const r = Math.random();
  if (r < 0.5) ev({ type: 'chat', username: name, text: 'go' });
  else if (r < 0.62) ev({ type: 'like', username: name, count: 5 });
  else ev({ type: 'gift', username: name, gift: r < 0.86 ? 'rose' : r < 0.94 ? 'heart' : r < 0.975 ? 'flame' : r < 0.992 ? 'rocket' : 'lion', count: 1 });
}

// ---------- assets (Gemini-generated, see assets/race/README.md) ----------
const SHEET_SRC = { bay: 'assets/race/horse_bay.webp', grey: 'assets/race/horse_grey.webp', chestnut: 'assets/race/horse_chestnut.webp', stallion: 'assets/race/horse_stallion.webp' };
const IMG = { stadium: new Image(), dirt: new Image(), rear: new Image(), trophy: new Image() };
IMG.stadium.src = 'assets/race/stadium.jpg'; IMG.dirt.src = 'assets/race/dirt.jpg'; IMG.rear.src = 'assets/race/horse_rear.webp'; IMG.trophy.src = 'assets/race/trophy.webp';
const SHEETS = {}; for (const k in SHEET_SRC) { SHEETS[k] = new Image(); SHEETS[k].src = SHEET_SRC[k]; }
const FR = 8, atlasCache = {};
let dirtPat = null;
function hexRGB(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
// recolours white silks/helmet to the country colour and applies a coat variant (brightness / saturation / tint)
function tintCanvas(im, col, coat, frames, region) {
  const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const id = g.getImageData(0, 0, cv.width, cv.height), d = id.data, fw = cv.width / frames, fh = cv.height, [cr, cg, cb] = hexRGB(col);
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    const o = (y * cv.width + x) * 4; if (d[o + 3] < 8) continue;
    const r = d[o], g2 = d[o + 1], b = d[o + 2], mx = Math.max(r, g2, b), mn = Math.min(r, g2, b), lum = r * 0.3 + g2 * 0.59 + b * 0.11;
    const fx = (x % fw) / fw, fy = y / fh, whiteish = mn > 135 && mx - mn < 48;
    if (whiteish && fy < region.y && fx < region.x) { const k = clamp(lum / 225, 0.25, 1.1); d[o] = clamp(cr * k + 18, 0, 255); d[o + 1] = clamp(cg * k + 18, 0, 255); d[o + 2] = clamp(cb * k + 18, 0, 255); }
    else if (!whiteish && coat) {
      let nr = lum + (r - lum) * coat.s, ng = lum + (g2 - lum) * coat.s, nb = lum + (b - lum) * coat.s;
      nr *= coat.l * (coat.r || 1); ng *= coat.l; nb *= coat.l * (coat.b || 1);
      d[o] = clamp(nr, 0, 255); d[o + 1] = clamp(ng, 0, 255); d[o + 2] = clamp(nb, 0, 255);
    }
  }
  g.putImageData(id, 0, 0); return cv;
}
function getAtlas(ci) {
  if (atlasCache[ci]) return atlasCache[ci];
  const c = S.C[ci], im = SHEETS[c.horse.sheet]; if (!im.complete || !im.naturalWidth) return null;
  return (atlasCache[ci] = tintCanvas(im, c.col, c.horse.coat, FR, { x: 0.8, y: 0.52 }));
}
IMG.dirt.onload = () => { dirtPat = ctx.createPattern(IMG.dirt, 'repeat'); }; if (IMG.dirt.complete && IMG.dirt.naturalWidth) dirtPat = ctx.createPattern(IMG.dirt, 'repeat');
function drawRearHorse(ci) { // winner celebration: rearing horse in the winning country's silks, on the result card
  const cv = $('rHorse'), g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
  if (!IMG.rear.complete || !IMG.rear.naturalWidth) return;
  const t = tintCanvas(IMG.rear, S.C[ci].col, S.C[ci].horse.coat, 1, { x: 0.62, y: 0.62 });
  const s = Math.min(cv.width / t.width, cv.height / t.height); g.drawImage(t, (cv.width - t.width * s) / 2, cv.height - t.height * s, t.width * s, t.height * s);
}
$('rTrophy').src = 'assets/race/trophy.webp';

function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function glass(x, y, w, h, r, edge) { rr(x, y, w, h, r); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,.04)'); ctx.fillStyle = 'rgba(6,16,12,.62)'; ctx.fill(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = edge || 'rgba(255,224,138,.35)'; ctx.lineWidth = 1; ctx.stroke(); }
function banner(txt, y, col, size, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = '1000 ' + Math.round(size) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width + 34; glass(W / 2 - w / 2, y - size * 0.8, w, size * 1.6, 14, col);
  ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.fillStyle = '#fff'; ctx.fillText(txt, W / 2, y); ctx.restore();
}

function drawHorse(ci, cx, baseY, h) {
  const c = S.C[ci], at = getAtlas(ci); if (!at) return;
  const fw = at.width / FR, fh = at.height, w = h * fw / fh;
  const running = c.sprint > 0.02 || Math.abs(c.pos - c.dp) > 0.004;
  const frame = running ? Math.floor((((c.cyc % 1) + 1) % 1) * FR) : 2;
  const bob = running ? Math.sin(c.cyc * Math.PI * 2) * h * 0.02 : Math.sin(S.t * 1.6 + ci) * h * 0.008;
  ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.beginPath(); ctx.ellipse(cx, baseY + 1, w * 0.36, h * 0.07, 0, 0, 7); ctx.fill();
  if (running) { ctx.globalAlpha = 0.25 + Math.min(1, c.sprint) * 0.3; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { const yy = baseY - h * (0.2 + k * 0.22); ctx.beginPath(); ctx.moveTo(cx - w * 0.5 - 10 - k * 6, yy); ctx.lineTo(cx - w * 0.5 - 38 - k * 8, yy); ctx.stroke(); } ctx.globalAlpha = 1; }
  if (c.sprint > 1.05) { ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 22; } else if (leaderIdx === ci && c.pos > 0.02) { ctx.shadowColor = c.col; ctx.shadowBlur = 14; }
  ctx.drawImage(at, frame * fw, 0, fw, fh, cx - w * 0.5, baseY - h + bob, w, h); ctx.shadowBlur = 0;
}
let leaderIdx = 0;
function draw() {
  leaderIdx = leader();
  ctx.fillStyle = '#04100a'; ctx.fillRect(0, 0, W, H);
  // camera: shake + finish zoom on the winning lane
  ctx.save();
  const lh = L.laneH, e = S.zoom * S.zoom * (3 - 2 * S.zoom);
  if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake * 6, (Math.random() - 0.5) * S.shake * 6);
  if (e > 0 && S.winner >= 0) {
    const wc = S.C[S.winner], hx = L.startX + wc.dp * (L.finX - L.startX - lh * 2.0) + lh * 1.05, hy = L.laneTop + S.winner * lh + lh * 0.6, z = 1 + 0.4 * e;
    ctx.translate(clamp((W * 0.56 - z * hx) * e, W - z * W, 0), clamp((H * 0.44 - z * hy) * e, H - z * H, 0)); ctx.scale(z, z);
  }
  // ---- header ----
  const st = IMG.stadium;
  if (st.complete && st.naturalWidth) { const r = Math.max(W / st.naturalWidth, L.top / st.naturalHeight), w = st.naturalWidth * r, h = st.naturalHeight * r; ctx.drawImage(st, (W - w) / 2, (L.top - h) / 2, w, h); }
  const hg = ctx.createLinearGradient(0, 0, 0, L.top); hg.addColorStop(0, 'rgba(3,10,6,.55)'); hg.addColorStop(0.55, 'rgba(3,10,6,.35)'); hg.addColorStop(1, 'rgba(3,10,6,.92)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, W, L.top);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tg = ctx.createLinearGradient(0, L.top * 0.12, 0, L.top * 0.42); tg.addColorStop(0, '#fff3c4'); tg.addColorStop(0.5, '#ffd34d'); tg.addColorStop(1, '#d98a1c');
  ctx.font = 'italic 1000 ' + Math.round(W * 0.082) + 'px system-ui,sans-serif'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; ctx.fillStyle = tg;
  ctx.fillText('CURSA ȚĂRILOR', W / 2, L.top * 0.25); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#e8fff0'; ctx.font = '800 ' + Math.round(W * 0.026) + 'px system-ui,sans-serif';
  ctx.fillText(`SEZON ${DB.season} · CURSA ${Math.min(DB.race + 1, RACES_PER_SEASON)}/${RACES_PER_SEASON}  ·  CODUL ȚĂRII ÎN CHAT, CADOURILE = IMPULS`, W / 2, L.top * 0.47);
  const tl = S.phase === 'race' ? Math.max(0, Math.ceil(ROUND_TIME - S.t)) : S.phase === 'count' ? ROUND_TIME : 0;
  const snipe = S.phase === 'race' && ROUND_TIME - S.t <= SNIPE_WINDOW, dbl = S.dbl >= 0 && S.t - S.dbl < 15 && S.phase === 'race';
  const pw = W * 0.9, px = (W - pw) / 2, py = L.top * 0.6, ph = L.top * 0.34;
  glass(px, py, pw, ph, 12, snipe ? 'rgba(255,90,90,.95)' : dbl ? 'rgba(255,211,77,.9)' : undefined);
  ctx.font = '900 ' + Math.round(W * 0.034) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.fillStyle = snipe ? '#ff8a8a' : dbl ? '#ffd34d' : '#ffffff';
  ctx.fillText((snipe ? '⚡ x1.5  ' : '') + (dbl ? '⚡ x2 ' + Math.ceil(15 - (S.t - S.dbl)) + 's  ' : '') + '⏱ ' + String(Math.floor(tl / 60)).padStart(2, '0') + ':' + String(tl % 60).padStart(2, '0') + '   🎯 ' + Math.round(S.boostSum * 100) + '/' + Math.round(S.goalB * 100), W / 2, py + ph * 0.32);
  const order = [...S.C.keys()].sort((a, b) => S.C[b].pos - S.C[a].pos).slice(0, 3); const medals = ['🥇', '🥈', '🥉'];
  ctx.font = '800 ' + Math.round(W * 0.03) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.fillStyle = '#ffffffee';
  ctx.fillText(order.map((i, k) => medals[k] + S.C[i].flag + ' ' + Math.round(S.C[i].pos * 100) + '%').join('    '), W / 2, py + ph * 0.72);
  // ---- track ----
  S.C.forEach((c, i) => {
    const y = L.laneTop + i * lh;
    if (dirtPat) { ctx.save(); ctx.translate(0, y); ctx.fillStyle = dirtPat; ctx.fillRect(0, 0, W, lh); ctx.restore(); } else { ctx.fillStyle = '#8a6a45'; ctx.fillRect(0, y, W, lh); }
    ctx.fillStyle = i % 2 ? 'rgba(20,10,0,.32)' : 'rgba(20,10,0,.18)'; ctx.fillRect(0, y, W, lh);
    const lg = ctx.createLinearGradient(0, y, 0, y + lh); lg.addColorStop(0, 'rgba(0,0,0,.22)'); lg.addColorStop(0.2, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,.28)'); ctx.fillStyle = lg; ctx.fillRect(0, y, W, lh);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(0, y + lh - 1, W, 1.2);
    ctx.fillStyle = c.col; ctx.globalAlpha = 0.5; ctx.fillRect(L.startX, y + lh - 3, (L.finX - L.startX) * c.dp, 2.4); ctx.globalAlpha = 1;
  });
  const fx = L.finX - 6, fh2 = S.C.length * lh, ch = 7;
  for (let r = 0; r < fh2 / ch; r++) for (let k = 0; k < 2; k++) { ctx.fillStyle = (r + k) % 2 ? '#111' : '#fff'; ctx.fillRect(fx + k * ch, L.laneTop + r * ch, ch, Math.min(ch, fh2 - r * ch)); }
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffffff55'; ctx.fillRect(fx - 1, L.laneTop, 1.5, fh2); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(L.startX - 3, L.laneTop, 2, fh2);
  S.C.forEach((c, i) => {
    const y = L.laneTop + i * lh, x = L.startX + c.dp * (L.finX - L.startX - lh * 2.0) + lh * 1.05;
    drawHorse(i, x, y + lh * 0.94, lh * 1.3);
    if (leaderIdx === i && c.pos > 0.02) { ctx.font = Math.round(lh * 0.42) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('👑', x + lh * 0.2, y - lh * 0.02); }
    if (c.sup > 0) { ctx.font = '800 ' + Math.round(lh * 0.24) + 'px system-ui,"Noto Color Emoji",sans-serif'; const t = '👥 ' + c.sup, tw2 = ctx.measureText(t).width + 10; glass(x + lh * 0.9, y + lh * 0.04, tw2, lh * 0.3, 8, c.col); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t, x + lh * 0.9 + tw2 / 2, y + lh * 0.2); }
    glass(3, y + 2, L.startX - 8, lh - 4, 9, c.col);
    ctx.textAlign = 'center'; ctx.font = Math.round(lh * 0.5) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(c.flag, (L.startX - 2) / 2, y + lh * 0.38);
    ctx.font = '900 ' + Math.round(lh * 0.25) + 'px system-ui,sans-serif'; ctx.fillStyle = c.col; ctx.fillText(c.code, (L.startX - 2) / 2, y + lh * 0.78);
  });
  S.spark.forEach((p) => { ctx.globalAlpha = clamp(p.life * 2, 0, 0.8); ctx.fillStyle = '#d9bf93'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
  ctx.restore();
  // ---- bottom panel (screen space) ----
  const bg2 = ctx.createLinearGradient(0, L.bot, 0, H); bg2.addColorStop(0, '#07150d'); bg2.addColorStop(1, '#030a06'); ctx.fillStyle = bg2; ctx.fillRect(0, L.bot, W, H - L.bot);
  const gh = (H - L.bot) * 0.36, gw = (W - 12) / 5;
  Object.values(GIFTS).forEach((g2, i) => { const x = 6 + i * gw + 2; glass(x, L.bot + 6, gw - 4, gh, 10); ctx.textAlign = 'center'; ctx.font = Math.round(gh * 0.5) + 'px system-ui,"Noto Color Emoji",sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(g2.e, x + (gw - 4) / 2, L.bot + 6 + gh * 0.36); ctx.font = '900 ' + Math.round(gh * 0.26) + 'px system-ui,sans-serif'; ctx.fillStyle = '#ffd34d'; ctx.fillText('+' + (g2.boost * 100).toFixed(1).replace('.0', '') + '%', x + (gw - 4) / 2, L.bot + 6 + gh * 0.82); });
  ctx.textAlign = 'left'; ctx.font = '700 ' + Math.round(W * 0.029) + 'px system-ui,"Noto Color Emoji",sans-serif';
  S.feed.slice(0, 3).forEach((f, i) => { const y = L.bot + 6 + gh + 14 + i * (H - L.bot - gh - 18) / 3; ctx.globalAlpha = clamp(1.25 - (S.t - f.at) * 0.03, 0.4, 1) * (1 - i * 0.18); ctx.fillStyle = '#e8fff0'; ctx.fillText(f.msg.slice(0, 58), 10, y); }); ctx.globalAlpha = 1;
  // vignette (+ red pulse in the last 10 seconds)
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (snipe) { const a = 0.12 + 0.1 * Math.sin(S.t * 8); ctx.fillStyle = 'rgba(255,40,40,' + a + ')'; ctx.fillRect(0, L.top, W, L.bot - L.top); }
  // callouts
  ctx.textAlign = 'center';
  if (S.phase === 'count') {
    const k = Math.ceil(S.count), txt = S.count > 2.6 ? 'PE LOCURI…' : S.count > 1.2 ? 'FIȚI GATA…' : 'START!';
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, H * 0.4, W, H * 0.16); ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 24; ctx.fillStyle = '#ffe08a'; ctx.font = '1000 ' + Math.round(W * (S.count > 1.2 ? 0.11 : 0.17)) + 'px system-ui,sans-serif'; ctx.fillText(txt, W / 2, H * 0.48); ctx.shadowBlur = 0;
  }
  if (S.comm) { ctx.font = 'italic 800 ' + Math.round(W * 0.03) + 'px system-ui,"Noto Color Emoji",sans-serif'; const tw3 = ctx.measureText('🎙 ' + S.comm.txt).width + 22; glass(W / 2 - tw3 / 2, L.laneTop + 6, tw3, 24, 12, 'rgba(255,255,255,.35)'); ctx.fillStyle = '#fff'; ctx.fillText('🎙 ' + S.comm.txt, W / 2, L.laneTop + 19); }
  if (S.call) banner(S.call.txt, H * 0.36, S.call.col || '#ffd34d', W * 0.04, clamp(S.call.t * 2, 0, 1));
  if (S.big) banner(S.big.txt, H * 0.46, S.big.col, W * 0.042, clamp(S.big.t * 2, 0, 1));
  if (S.phase === 'finish') banner(S.finTxt, H * 0.3, '#ffd34d', W * 0.06, 1);
  S.confetti.forEach((p) => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); });
  if (S.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + S.flash * 0.35 + ')'; ctx.fillRect(0, 0, W, H); }
}

// ---------- hall of fame / progress ----------
function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function renderHall() {
  const b = $('hallBody'), out = [];
  out.push(el('div', 'hh', `SEZON ${DB.season} · CURSA ${DB.race}/${RACES_PER_SEASON}`));
  const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = (DB.race / RACES_PER_SEASON * 100) + '%'; bar.append(fill); out.push(bar);
  const tab = Object.entries(DB.pts).sort((a, b2) => b2[1] - a[1]); const maxp = tab[0] ? tab[0][1] : 1;
  if (!tab.length) out.push(el('div', 'hr', 'Nicio cursă în acest sezon încă.'));
  tab.forEach(([code, v], i) => { const c = COUNTRIES.find((x) => x.code === code); const r = el('div', 'hr'); r.append(el('b', '', (i + 1) + '.'), el('span', '', c.flag + ' ' + c.name), el('em', '', v + ' pct' + (DB.trophies[code] ? ' · 🏆' + DB.trophies[code] : ''))); out.push(r); });
  out.push(el('div', 'hh', 'CAMPIONI AI SEZOANELOR'));
  if (!DB.champs.length) out.push(el('div', 'hr', 'Încă niciun sezon încheiat (' + RACES_PER_SEASON + ' curse).'));
  DB.champs.slice(0, 5).forEach((ch) => { const c = COUNTRIES.find((x) => x.code === ch.code); const r = el('div', 'hr'); r.append(el('b', '', 'Sezon ' + ch.season), el('span', '', c.flag + ' ' + c.name), el('em', '', ch.pts + ' pct')); out.push(r); });
  out.push(el('div', 'hh', 'TOP SPECTATORI (XP, acest dispozitiv)'));
  const vs = Object.values(DB.viewers).sort((a, b2) => b2.xp - a.xp).slice(0, 8);
  if (!vs.length) out.push(el('div', 'hr', 'Încă niciun spectator. Trimite un cadou!'));
  vs.forEach((v, i) => { const lv = levelOf(v.xp), r = el('div', 'hr'); r.append(el('b', '', (i + 1) + '.'), el('span', '', `${v.name} · Lv${lv} ${titleOf(lv)}`), el('em', '', Math.round(v.xp) + ' XP' + (v.streak > 1 ? ' · 🔥' + v.streak : '') + (v.wins ? ' · 👑' + v.wins : ''))); out.push(r); });
  out.push(el('div', 'hh', 'RECORDURI'));
  const R = DB.records;
  [R.bigGift ? `🎁 Cel mai mare cadou: ${R.bigGift.name} · ${R.bigGift.txt} → ${R.bigGift.code}` : null, R.fastest ? `⚡ Cea mai rapidă victorie: ${R.fastest.code} în ${R.fastest.t}s` : null, R.closest ? `📸 Cel mai strâns finiș: ${R.closest.code} (${(R.closest.m * 100).toFixed(1)}%)` : null].filter(Boolean).forEach((t) => out.push(el('div', 'hr', t)));
  if (!R.bigGift && !R.fastest && !R.closest) out.push(el('div', 'hr', 'Încă niciun record.'));
  b.replaceChildren(...out);
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
const openHall = () => { renderHall(); $('hall').hidden = false; };
$('hallBtn').addEventListener('click', openHall); $('hallBtn2').addEventListener('click', openHall); $('closeHall').addEventListener('click', () => { $('hall').hidden = true; });
$('set').addEventListener('click', () => { $('settings').hidden = false; }); $('closeSet').addEventListener('click', () => { $('settings').hidden = true; });
$('conn').addEventListener('click', conn); $('disc').addEventListener('click', disc); window.addEventListener('pagehide', () => { disc(); save(); });
if (new URLSearchParams(location.search).get('live') === '1') $('ctl').hidden = true; // clean broadcast view

layout(); join('Tu', 0, true);
let last = performance.now(), raf = 0;
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); raf = requestAnimationFrame(frame); }
raf = requestAnimationFrame(frame);

window.RaceV1 = {
  version: '2.0-prototype', demo: true,
  getState: () => ({ phase: S.phase, t: S.t, ts: S.ts, pos: S.C.map((c) => +c.pos.toFixed(3)), sup: S.C.map((c) => c.sup), winner: S.winner, season: DB.season, race: DB.race, pts: { ...DB.pts }, trophies: { ...DB.trophies }, wins: { ...DB.wins }, viewers: Object.keys(DB.viewers).length, round: S.round, verified: S.verified, call: S.call && S.call.txt, finTxt: S.finTxt }),
  inject: ev, db: () => DB, resetProgress() { DB = { season: 1, race: 0, pts: {}, trophies: {}, wins: {}, viewers: {}, records: {}, champs: [] }; save(); },
  advance(sec, step = 1 / 60) { cancelAnimationFrame(raf); for (let t = 0; t < sec - 1e-9; t += step) update(Math.min(step, sec - t)); draw(); },
  resume() { last = performance.now(); raf = requestAnimationFrame(frame); },
};
