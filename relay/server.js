// Relay: reads TikTok LIVE events and forwards them to the game page over WebSocket.
// UNOFFICIAL: uses tiktok-live-connector (reverse engineered). It can break when TikTok changes, and using it may
// carry risk for the account; the owner decides. Never put secrets in the game page: keep them in env vars here.
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const USERNAME = String(process.env.TIKTOK_USERNAME || '').replace(/^@/, '');
const EULER_KEY = process.env.EULER_API_KEY || undefined; // sign-server key used by the connector (see eulerstream.com)
const RELAY_KEY = process.env.RELAY_KEY || '';            // optional shared secret in the ws:// URL (?key=...)
const MOCK = process.env.MOCK === '1';

let status = { tiktok: 'idle', roomId: '', detail: '' };
const clients = new Set();
const seen = new Set();

// ---- mapping: gift value (diamonds per unit) -> game tier ----
export function tierOf(d) { return d >= 1000 ? 'lion' : d >= 100 ? 'rocket' : d >= 10 ? 'flame' : d >= 2 ? 'heart' : 'rose'; }

function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(obj) { for (const c of clients) send(c, obj); }
function setStatus(tiktok, roomId = '', detail = '') { status = { tiktok, roomId, detail: String(detail).slice(0, 120) }; broadcast({ type: 'status', ...status }); console.log('[status]', tiktok, roomId, detail); }
function once(id) { if (!id) return true; if (seen.has(id)) return false; seen.add(id); if (seen.size > 5000) seen.clear(); return true; }

// ---- event handlers (shared by real connector and mock) ----
function onGift(d) {
  const det = d.giftDetails || {};
  const isStreak = det.giftType === 1;
  if (isStreak && !d.repeatEnd) return; // streak still running: wait for the final event (avoids double counting)
  const unit = Number(det.diamondCount ?? d.diamondCount ?? 1) || 1;
  const count = Math.max(1, Math.min(Number(d.repeatCount) || 1, 99));
  const user = d.user?.uniqueId || d.user?.nickname || 'spectator';
  const id = `g:${d.msgId ?? d.common?.msgId ?? ''}:${user}:${d.giftId}:${d.repeatCount}:${d.repeatEnd ?? ''}`;
  if (!once(id)) return;
  broadcast({ type: 'gift', id, username: user, gift: tierOf(unit), count, diamonds: unit * count, giftName: det.giftName || String(d.giftId) });
}
function onChat(d) { const user = d.user?.uniqueId || d.user?.nickname; if (user && d.comment) broadcast({ type: 'chat', id: d.msgId ? 'c:' + d.msgId : undefined, username: user, text: String(d.comment).slice(0, 80) }); }
function onLike(d) { const user = d.user?.uniqueId; if (user) broadcast({ type: 'like', username: user, count: Math.min(Number(d.likeCount) || 1, 50) }); }

// ---- real TikTok connection with gentle reconnect (the free sign service is rate-limited: do not hammer it) ----
async function startTikTok() {
  if (!USERNAME) { console.error('Set TIKTOK_USERNAME (the @username that goes LIVE).'); setStatus('config-missing'); return; }
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import('tiktok-live-connector');
  let delay = 10000, conn = null;
  const retry = (ms) => setTimeout(connect, ms);
  const connect = async () => {
    setStatus('connecting');
    conn = new TikTokLiveConnection(USERNAME, { signApiKey: EULER_KEY, enableExtendedGiftInfo: true });
    conn.on(WebcastEvent.GIFT, onGift); conn.on(WebcastEvent.CHAT, onChat); conn.on(WebcastEvent.LIKE, onLike);
    conn.on(ControlEvent.DISCONNECTED, () => { setStatus('disconnected'); retry(delay); delay = Math.min(delay * 2, 120000); });
    conn.on(ControlEvent.ERROR, (e) => console.error('[tiktok error]', e?.message || e));
    try { const st = await conn.connect(); delay = 10000; setStatus('connected', String(st.roomId)); }
    catch (e) {
      const msg = String(e?.name || '') + ' ' + String(e?.message || e);
      console.error('[connect failed]', msg);
      if (/offline|not.*live|UserOffline/i.test(msg)) { setStatus('offline', '', 'contul nu e live'); retry(45000); }            // gentle: every 45 s
      else if (/rate|limit|429|quota/i.test(msg)) { setStatus('rate-limited', '', 'limită serviciu semnare (EULER_API_KEY?)'); retry(120000); }
      else { setStatus('error', '', msg.slice(0, 100)); retry(delay); delay = Math.min(delay * 2, 120000); }
    }
  };
  connect();
}

// ---- mock: simulated viewers for testing the pipeline WITHOUT TikTok (status 'mock', never 'connected') ----
function startMock() {
  setStatus('mock', 'MOCK');
  const codes = ['RO', 'US', 'BR', 'TR', 'IN', 'ID', 'PH', 'MX', 'VN', 'TH'], names = ['ana', 'mihai', 'luca', 'sara', 'omar', 'kenji', 'lia'];
  let n = 0;
  setInterval(() => {
    const user = 'mock_' + names[n % names.length] + (n % 5); n++;
    const r = Math.random();
    if (r < 0.3) onChat({ user: { uniqueId: user }, comment: codes[Math.floor(Math.random() * codes.length)], msgId: 'm' + n });
    else if (r < 0.5) onLike({ user: { uniqueId: user }, likeCount: 5 });
    else { const dia = [1, 1, 1, 5, 30, 200][Math.floor(Math.random() * 6)]; onGift({ user: { uniqueId: user }, giftId: dia, repeatCount: 1, repeatEnd: true, giftDetails: { giftType: 0, diamondCount: dia, giftName: 'mock' }, msgId: 'mg' + n }); }
  }, 350);
}

// ---- http + websocket server ----
const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/health')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, ...status, clients: clients.size, mock: MOCK })); return; }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Cursa relay. Conectează-te prin WebSocket (wss). /health pentru stare.\n');
});
const wss = new WebSocketServer({ server });
wss.on('connection', (ws, req) => {
  const key = new URL(req.url || '/', 'http://x').searchParams.get('key') || '';
  if (RELAY_KEY && key !== RELAY_KEY) { ws.close(4401, 'bad key'); return; }
  clients.add(ws); send(ws, { type: 'status', ...status });
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => clients.delete(ws)); ws.on('error', () => clients.delete(ws));
});
setInterval(() => { for (const ws of clients) { if (!ws.isAlive) { ws.terminate(); clients.delete(ws); continue; } ws.isAlive = false; try { ws.ping(); } catch { /* closed */ } } }, 25000);

server.listen(PORT, () => { console.log(`relay listening on :${PORT} ${MOCK ? '(MOCK)' : ''}`); MOCK ? startMock() : startTikTok(); });
