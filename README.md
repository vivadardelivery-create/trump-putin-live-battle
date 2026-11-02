# TRUMP VS PUTIN • LIVE ARENA V3

Joc arcade fictiv pentru browserul telefonului. Nu depinde de un calculator pornit: pagina este servită de GitHub Pages.

## Funcțional (demo)
- Grafică fotorealistă generată în nouă cadre pentru secvența de lovitură a echipei Trump, cu scenă 2.5D și efecte vizuale.
- Echipe roșu/albastru, puncte, clasament și feed de evenimente.
- Comenzi prin text `TRUMP` / `PUTIN` și selecție cu butoane, exclusiv în sesiunea locală.
- 5 categorii de cadouri simulate, lovituri pornite doar la evenimente. Fără cadouri = fără atacuri.
- Timer de 90 secunde, scor persistent pe durata sesiunii, revanșe.
- Adaptor opțional WebSocket `wss://` pentru un *relay extern* care transmite evenimente de tip gift/join/chat. Acesta **nu este conectat cu TikTok LIVE în mod automat**.

## Limitări clare
- Personajele nu sunt modele 3D rigate: animația echipei Trump este pe cadre, iar reacția echipei Putin este efect procedural / lovitură sugerată, nu o animație 3D completă. Nu pretindem altceva.
- Utilizatorii, comentariile și cadourile din butoanele demo sunt locale și nu reprezintă persoane care chiar au intrat în LIVE. Clasamentul este local.
- Pentru cadourile reale trebuie un backend online separat, autentificat, care validează evenimentele, deduplică ID-urile, aplică limitări de frecvență și le trimite prin WSS. Nu introduce secrete TikTok în JavaScript-ul public.
- Transmiterea ecranului telefonului prin aplicația TikTok depinde de disponibilitatea opțiunii în cont.

**Efectul cadourilor:** Trandafir 3 HP/1 pct, Inimă 7 HP/5 pct, Flacără 12 HP/10 pct, Rachetă 22 HP/35 pct, Leu 37 HP/75 pct. Aceste numere sunt valori interne DEMO, nu prețuri TikTok.