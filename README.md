# TRUMP VS PUTIN • LIVE ARENA V4 (prototip 3D WebGL)

Joc satiric pentru browserul telefonului (Android/Chrome), servit static (GitHub Pages). Randare **three.js 0.187** (WebGL), vendorizat în `js/vendor/` (licență MIT inclusă) — fără CDN, fără build.

## Ce este nou față de V3
- Fără imagini decupate, WebP, GIF sau înclinări artificiale: toate sprite-urile au fost șterse.
- Fiecare luptător are un **schelet real de 18 oase** (`THREE.Skeleton`) și un `THREE.SkinnedMesh` cu greutăți per-vertex (cot, genunchi, talie se deformează neted).
- Animații pe oase prin `THREE.AnimationMixer`, fiecare personaj cu **clipuri proprii**: `guard` (buclă), `jab`, `hook` (croșeu), `impactLight`, `impactHeavy`, `ko`, `victory`.
  - Trump: stânga (ortodox), mai greu și mai lent. Putin: dreptaci în gardă inversă (southpaw), mai compact și mai rapid.
- **Nicio lovitură nu pornește singură.** Atacul se pornește doar scoțând un eveniment din coada de cadouri; impactul/KO-ul victimei se declanșează la cadrul de contact al clipului atacatorului. Test: 20 s fără cadouri → 0 lovituri.
- Păstrate: interfața TikTok LIVE, echipe, puncte, clasament, activitate, cadouri simulate (🌹💖 = jab, 🔥🚀🦁 = croșeu).

## Luptători și retenție (V4.1)
- **Două seturi** (selector în ecranul de start): *Luptători realiști* (implicit) = două persoane **fictive originale**, cu fețe fotorealiste generate cu Gemini (`assets/faces/fighter_*.jpg`), proiectate pe capul 3D rigat; și *Caricaturi Trump vs Putin* (capete stilizate).
- **Nu generez fotografii fotorealiste cu persoane reale** (politicieni). Pentru caricaturi folosești capul stilizat; fotografii proprii cu licență verificată pot fi puse în `assets/faces/trump.jpg` / `putin.jpg`.
- **Rulează singur:** după fiecare rundă, revanșa pornește automat în 12 s (LIVE fără apăsări manuale).
- **Mecanici de retenție:** bară ⚡ SUPER (cadourile o încarcă; la 100% se pune în coadă o lovitură, tot dintr-un eveniment), țintă de cadouri cu **puncte x2 timp de 15 s**, bonus COMEBACK (+25% daune sub 30% HP), serie de victorii, MVP-ul rundei, top all-time pe dispozitiv (localStorage), mesaje de îndemn (doar text) după 18 s fără activitate. Eficiența lor asupra retenției **nu a fost măsurată**; sursele găsite sunt vânzători de unelte, nu studii.
- **Independent de PC:** jocul e pagină statică (GitHub Pages), rulează pe telefon. **Cadourile TikTok reale cer însă un server relay** în cloud (nu PC), care nu e inclus și nu a fost testat.

## Grafică arenă
Ring cu LED-uri și corzi luminoase, ecran LED, truss cu fascicule, public cu bokeh, confetti, bloom la impact, ticker de cadouri. Calitatea scade automat (fără bloom/umbre) dacă primele ~100 de cadre rulează sub ~30 fps; `?hq=1` / `?hq=0` forțează. Fundalul pictat `assets/arena/bg.jpg` (generat cu Gemini prin conectorul Composio, 9:16, redimensionat la 1072×1920) este desenat pe tot ecranul în spatele ringului 3D; fără el se folosește arena procedurală. Nu atinge nivelul artei pictate din LIVE-urile de tip Arena; aceea e artă 2D făcută separat.

## Fețe foto
Pune `assets/faces/trump.jpg` și `assets/faces/putin.jpg` (frontale) și sunt proiectate pe capul 3D. Detalii în `assets/faces/README.md`. Proiecția e verificată doar cu o imagine de test sintetică; calitatea cu fotografii reale nu a fost evaluată.

## Limitări (declarate onest)
- Personajele sunt **caricaturi 3D stilizate generate procedural în cod**, nu scanări fotorealiste și nu modele din Blender/Mixamo. Nu am avut modele licențiate ale persoanelor reale.
- Animațiile sunt **keyframe-uri scrise manual** pe oase (nu motion capture). Calibrarea contactului pumn→cap este măsurată numeric (≈0,2 m între centrul mânușii și centrul capului, la ambii), dar croșeul lui Putin lovește puțin sub nivelul capului (diferență de înălțime), iar mișcările pot arăta rigid.
- **Testat doar pe Chromium headless cu emulare Pixel 7 (randare software SwiftShader)**, nu pe un telefon Android fizic sau emulator Android. FPS-ul real pe telefoane nu a fost măsurat.
- **TikTok LIVE nu este conectat.** Cadourile sunt simulate local. Adaptorul WSS acceptă un relay extern; statusul „TIKTOK LIVE” apare doar dacă relay-ul trimite `{"type":"status","tiktok":"connected","roomId":"…"}`, iar jocul afișează doar ce raportează serverul (nu poate verifica). Fără relay: „DEMO”. Relay-ul nu este inclus și nu a fost testat cu TikTok.
- Fără WebGL, jocul nu pornește (nu există mod de rezervă cu imagini).

## Relay (format evenimente)
`{"type":"gift","team":"trump|putin","gift":"rose|heart|flame|rocket|lion","count":1,"username":"x","id":"unic"}`, plus `join`, `chat`, `status`. Deduplicare pe `id`, maxim 15 per eveniment, coadă de 20.

## Structură
`index.html` (UI) · `js/rig.js` (schelet + skinning) · `js/anim.js` (clipuri) · `js/chars.js` (parametri personaje) · `js/stage.js` (ring, lumini, cameră) · `js/game.js` (reguli, UI, relay).
Hook de diagnostic: `window.GameV4.debug.advance(sec)` rulează simularea determinist.

## Cursa țărilor (`race.html`) — v2
**v2:** 10 cai diferiți (4 seturi de cadre Gemini + variante de blană + nume și ritm propriu), spectacol (numărătoare „pe locuri / fiți gata”, depășiri, bannere TURBO la 🚀🦁, ultimele 10 s cu cadouri x1,5 și puls roșu, photo finish în slow-motion cu zoom pe câștigător, podium cu cal în două picioare și trofeu), progres pe termen lung (sezon de 10 curse cu puncte pe locuri, campioană + trofeu, nivele și titluri pentru spectatori, serii zilnice, recorduri; totul în localStorage, doar pe dispozitivul acesta, fără conturi verificate; boții nu se salvează).

Joc 2D separat, construit după tiparul „country race” din LIVE-urile TikTok: 10 țări cu steag și cal, spectatorii scriu codul țării (RO, US, BR…), cadourile/like-urile/chat-ul împing calul țării lor spre linia de sosire, victorii pe țară (localStorage), MVP, țintă cu x2, bonus pentru ultimul loc, revanșă automată. Caii sunt **realiști** (8 cadre de galop cu cal și jockey, generate cu Gemini și decupate de pe fundal verde; blana variază în 5 culori, iar tricoul jockey-ului ia culoarea țării), pista și antetul sunt foto generate cu Gemini (`assets/race/`). Interfața (panouri, steaguri, linia de sosire) e desenată în cod; nu copiază artă din alte LIVE-uri. Imaginile AI au fost verificate vizual doar în capturi; termenii serviciului trebuie verificați pentru uz comercial.
- Nimic nu mișcă un cal în afara evenimentelor; la 100 s câștigă cel din față.
- „Boții” de test sunt marcați 🤖 și nu sunt prezentați ca utilizatori TikTok. `?live=1` ascunde comenzile pentru transmisie.
- Același relay WSS și aceeași regulă de statusuri ca la jocul de box: fără confirmare explicită de la relay rămâne „NEVERIFICAT”. Nu e conectat la TikTok LIVE; relay-ul nu e inclus.
- Alegerea acestui format s-a bazat pe o singură captură cu 1,7K spectatori; retenția nu e măsurată.

## Cadouri TikTok reale (relay) — vezi `relay/README.md`
`relay/` conține serverul Node care citește evenimentele LIVE (biblioteca neoficială `tiktok-live-connector`) și le trimite jocului prin WebSocket. Testat **doar cu simulare** (mod `MOCK=1`): cheie greșită respinsă, conectare automată din link, cursă pornită singură, evenimente care mișcă caii. **Netestat cu TikTok real.**
Link LIVE (după ce pagina e găzduită, ex. GitHub Pages): `race.html?relay=wss://SERVERUL-TAU&key=PAROLA&live=1`.
