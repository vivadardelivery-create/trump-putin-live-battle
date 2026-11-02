# Relay cadouri TikTok LIVE → joc

Citește evenimentele LIVE (cadouri, chat, like-uri) cu biblioteca **neoficială** `tiktok-live-connector` și le trimite jocului prin WebSocket.
Pornește pe un server în cloud (nu PC), ca jocul să primească cadouri reale.

## Pornire pe un host cloud (ex. Render, din browserul telefonului)
1. Cont pe un host cu Node + WebSocket (ex. Render „Web Service”), conectat la repo-ul GitHub.
2. Root Directory: `relay` · Build: `npm install` · Start: `node server.js`
3. Variabile de mediu:
   - `TIKTOK_USERNAME` = contul tău TikTok (fără @), cel care face LIVE
   - `RELAY_KEY` = o parolă lungă aleasă de tine (opțional, dar recomandat)
   - `EULER_API_KEY` = cheie pentru serverul de semnare folosit de bibliotecă (vezi eulerstream.com; fără ea conexiunea poate eșua, neverificat)
4. Adresa relay: `wss://<serviciul-tău>.onrender.com/?key=<RELAY_KEY>` (hosturile gratuite pot adormi: deschide `/health` înainte de LIVE).

## Test fără TikTok
`MOCK=1 node server.js` (sau `npm run mock`): trimite evenimente simulate. Statusul e „mock”, **niciodată** „connected”.

## Conectare joc
`race.html?relay=wss://...&key=...&live=1` conectează singur relay-ul și pornește cursa fără apăsări.
Mapare cadouri (diamante per bucată): 1 → 🌹 · 2–9 → 💖 · 10–99 → 🔥 · 100–999 → 🚀 · ≥1000 → 🦁.

## Limite
- **Neoficial:** se poate strica oricând, iar utilizarea poate implica risc pentru cont. Decizia îți aparține.
- Netestat cu TikTok real (doar cu simulare). Prima rulare reală: un LIVE mic.
- Spectatorii își aleg țara scriind codul în chat (RO, US…); fără cod, primesc una aleatorie.
