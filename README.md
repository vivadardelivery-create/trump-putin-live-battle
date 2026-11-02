# TRUMP VS PUTIN • LIVE ARENA V4 (prototip 3D WebGL)

Joc satiric pentru browserul telefonului (Android/Chrome), servit static (GitHub Pages). Randare **three.js 0.187** (WebGL), vendorizat în `js/vendor/` (licență MIT inclusă) — fără CDN, fără build.

## Ce este nou față de V3
- Fără imagini decupate, WebP, GIF sau înclinări artificiale: toate sprite-urile au fost șterse.
- Fiecare luptător are un **schelet real de 18 oase** (`THREE.Skeleton`) și un `THREE.SkinnedMesh` cu greutăți per-vertex (cot, genunchi, talie se deformează neted).
- Animații pe oase prin `THREE.AnimationMixer`, fiecare personaj cu **clipuri proprii**: `guard` (buclă), `jab`, `hook` (croșeu), `impactLight`, `impactHeavy`, `ko`, `victory`.
  - Trump: stânga (ortodox), mai greu și mai lent. Putin: dreptaci în gardă inversă (southpaw), mai compact și mai rapid.
- **Nicio lovitură nu pornește singură.** Atacul se pornește doar scoțând un eveniment din coada de cadouri; impactul/KO-ul victimei se declanșează la cadrul de contact al clipului atacatorului. Test: 20 s fără cadouri → 0 lovituri.
- Păstrate: interfața TikTok LIVE, echipe, puncte, clasament, activitate, cadouri simulate (🌹💖 = jab, 🔥🚀🦁 = croșeu).

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
