# Starea implementării

Actualizat: 2026-10-08 · ramura `build/studio-v0.1`

## Ce înseamnă marcajele

| Marcaj | Înseamnă |
| --- | --- |
| [✓] | Implementat și verificat: test automat sau randare reală inspectată |
| [~] | Implementat, dar verificat doar parțial (sau doar manual), ori cu limite cunoscute |
| [>] | În lucru |
| [ ] | Neimplementat |
| [!] | Risc sau limită importantă, de știut înainte de folosire |

**Porțile de calitate la data de mai sus:**

| Poartă | Rezultat |
| --- | --- |
| `npm run typecheck` | trece |
| `npm run lint` | trece |
| `npm test` | 49 teste unitare + 8 de integrare trec |
| `npm run test:render` | 5 teste trec: toate cele 124 de capabilități randate, determinismul cadrelor (toleranță de rasterizare 2/255), MP4 H.264 + AAC verificat |
| `npm run e2e -- --fresh` | trece: 2 formate, ~22,7 s, 0 blocaje, −14,2 LUFS / −1,6 dBTP, fără cadre negre, flash-uri sau înghețări |

## 1. Instalare și mediu

- [✓] `install.ps1` (Windows): Node/Git prin winget doar cu acord, `npm ci`, browserele, `.env`, setup, `doctor`. Rulat cap-coadă pe Windows 11.
- [✓] `npm run doctor`: verifică fără să instaleze nimic. Ieșire 1 la probleme.
- [✓] `npm run update`, `.env.example`, `.gitignore`, `.gitattributes`.
- [~] `install.sh` (macOS/Linux): scris, **netestat** pe aceste sisteme.
- [✓] FFmpeg/FFprobe din Remotion; fără Python.

## 2. Modelul de date și proiectele

- [✓] Scheme zod pentru toate entitățile: proiect, brief, research, brand, materiale, script, storyboard, timeline, audio, critică, versiuni, stare.
- [✓] Depozitul de proiecte cu versiuni imuabile: înghețare, versiune automată la editare și la recompilare, exporturi care nu se suprascriu (teste unitare și de integrare).
- [✓] Vocea se reface automat când textul sau setările ei se schimbă (amprentă; test de integrare).
- [✓] `STATE.md` actualizat la fiecare pas; aprobările cer frazele exacte „aprob” / „render final”.

## 3. Captură și materiale

- [✓] Captură reală cu Playwright: capturi 2×, pagină întreagă, mobil, zone din DOM, date de pagină, CSS, date personale (email). Testat în integrare.
- [✓] Înregistrare cadru cu cadru → MP4 la FPS constant (tastare, clicuri, drag).
- [✓] Opțiuni de captură: `--wait`, `--click`, `--hide`, `--type`, `--steps` (verificat manual pe produsul demo).
- [~] Autentificare interactivă (`mms login`, profil persistent): implementată, **netestată automat** (cere un om).
- [✓] Ingestie: sha256 și duplicate, ffprobe, fontkit, SVG, miniatură, punct focal, paletă, dHash, clasificarea rolului.
- [✓] Date personale: detectare la captură; decizia „estompează / lasă vizibile” (Studio, `mms pii`); compilatorul pune estomparea; validatorul blochează capturile fără decizie (test unitar + randare verificată).
- [~] Detecția datelor personale acoperă doar adresele de email din textul paginii. Numele, telefoanele și datele din imagini nu sunt detectate.

## 4. Research și afirmații

- [✓] Surse cu citat, dată și încredere. Afirmațiile au tipul fapt, inferență sau interpretare. Cifrele și prețurile intră în „de confirmat” (teste).
- [✓] Validatorul blochează cifrele fără afirmație verificată sau aprobată.
- [~] Research-ul vine doar din paginile capturate (fără căutare pe web). Afirmațiile din alte surse se adaugă cu `mms add-claim`.

## 5. Brand

- [✓] Brand kit dedus din variabilele CSS, din frecvența culorilor și din logo (SVG). Fonturile se potrivesc cu biblioteca.
- [✓] Analiza videourilor de referință (`mms reference`): tăieturi, durata cadrelor, mișcare, culoare, tempo, cu limitele scrise în profil. Verificată manual: 5 din 6 tăieturi găsite pe un preview cunoscut (dizolvarea lentă ratată, limită notată). Tempo-ul nesigur nu se prezintă ca fapt.
- [~] Fonturile site-ului care nu sunt în bibliotecă se înlocuiesc cu cel mai apropiat font OFL inclus. Fontul real intră doar dacă utilizatorul îl dă (cu drepturi).

## 6. Creativ, script, storyboard

- [✓] Direcțiile A–F ca profiluri executabile; propune 3 când lipsește direcția.
- [✓] Întrebările A–H, inclusiv livrarea (grupa G); fiecare răspuns are câmp în brief.
- [✓] Schița de script păstrează hook-ul, CTA-ul și frazele obligatorii ale utilizatorului; validarea scriptului (teste).
- [✓] 8 șabloane, constructorul de storyboard (potrivirea replicilor, materialele, zonele de interes).
- [~] Scrisul creativ propriu-zis (rescrierea scriptului, alegerea rețetelor) îl face Claude în Claude Code (`/make-ad`). Schița automată e doar un punct de plecare factual.

## 7. Motorul de mișcare

- [✓] 124 de capabilități în registry, fiecare cu fișă, parametri zod, sunet declarat și exemplu, toate randate de testul de catalog: 14 camere, 21 tranziții, 14 straturi de text, 10 straturi UI + 6 widgeturi, 7 rame, 7 media, fundaluri, lumini, particule, distorsiuni, 4 logo, 6 grafice, 12 modificatori.
- [✓] 16 rețete, gramatica de montaj, tăieturi pe beat, adaptoare de layout pe format.
- [✓] Camera: chei, aim spre țintă, parallax pe adâncimi, handheld, shake, punch pe ritm, DOF, blur de mișcare calibrat (180°).
- [✓] Callout-ul alege partea după locul real de pe ecran la finalul push-ului și păstrează aceeași mărime la orice zoom. Zoom-ul se limitează ca materialul să nu intre peste titlu (teste unitare + randare verificată).
- [✓] Determinism: același timeline octet cu octet la fiecare compilare. Aceleași cadre randate de două ori ies identice. Lint-ul interzice `Math.random`/`Date.now` în randare.
- [!] Rasterizarea Chrome poate varia rar cu cel mult 2/255 între randări (GPU și software): invizibil, tolerat explicit de teste (docs/DECIZII.md, punctul 38).
- [~] 3D înseamnă CSS 3D (rame, stive, cărți, orbită). Nu există geometrie 3D reală (Three.js), pentru că nu a fost necesară (docs/DECIZII.md).

## 8. Timeline, validare, formate

- [✓] Compilator storyboard → timeline, cu text măsurat cu fonturile reale.
- [✓] Validator: footage real, drepturi, cifre, zone sigure, zone excluse, lizibilitate la 360 px, flash-uri, goluri, date personale.
- [✓] Formate 9:16, 16:9, 1:1, 4:5, 4K, personalizat. FPS 24, 25, 30, 50, 60. Același storyboard dă aceleași tăieturi în toate formatele (±1 cadru), indiferent de FPS (test de integrare).
- [!] Zonele sigure ale platformelor vin din surse secundare (încredere medie). Verifică-le în Ads Manager înainte de o campanie mare.

## 9. Audio

- [✓] WAV, filtre, loudness BS.1770-4 (valori de referință), true peak 4×, limitator, ducking cu rampă de 500 ms, verificarea tăcerilor (teste).
- [✓] 35 de efecte sonore sintetizate; muzică originală pe structura reclamei; beat grid; cue sheet; subtitrări `.srt` și arse în video.
- [✓] Voce Windows offline (inclusiv română, cu marcaje de cuvinte); cache; vocea utilizatorului din fișier.
- [~] ElevenLabs și OpenAI TTS: implementate, **netestate** (fără chei în mediul de test).
- [~] macOS `say` și `espeak`: implementate, netestate.
- [✓] Muzica utilizatorului: decodare, beat grid detectat, tăieturi realiniate și mix. Verificat manual cu un fișier de 112 BPM: tempo detectat exact, −14,18 LUFS / −1,57 dBTP.
- [!] Detecția tempo-ului e verificată doar pe muzică sintetizată. Pe piese reale (rubato, fără tobe) poate greși; tempo-ul se poate fixa în brief (`audio.music.bpm`).
- [!] Drepturile comerciale ale vocilor TTS de sistem nu sunt clare: exportul final afișează o atenționare (docs/LICENTE.md).
- [!] Sunetul nu poate fi judecat de AI: notele utilizatorului pe timestamp sunt singura verificare reală (regula 15).

## 10. Randare și verificarea video

- [✓] Preview MP4 (H.264, yuv420p, BT.709, AAC), foaie de contact, cadre, raport (cadre negre, flash-uri, înghețări).
- [✓] Export final: doar cu „render final”, fără blocaje, cu mix „ok”, fără suprascriere. Pachetul de postare (copertă fără subtitrări + text din replicile aprobate) e testat prin `mms post-pack`.
- [~] Exportul final propriu-zis nu a fost rulat pe proiectul demo, pentru că regula 6 cere ca utilizatorul să scrie „render final”. Poarta e testată (refuză fără aprobare). Randarea folosește același motor ca preview-ul, testat.
- [!] Viteza de randare: ~2,5–3,5× durata reclamei pe acest laptop (de ex. ~60–80 s pentru 22,7 s).

## 11. Critică și iterație

- [✓] Critica automată cu rubrica fixă, același reviewer în toate rundele, bilanț la fiecare 3 runde și oprire după 2 runde fără progres.
- [!] Critica automată e euristică: verifică structura, nu imaginea, și dă note mari demo-ului. Revizuirea vizuală o face Claude, separat (`claude-visual`); în această sesiune a prins și reparat probleme pe care critica automată nu le vede (suprapuneri, callout tăiat).
- [✓] Comenzi în limbaj natural, în română și engleză: zoom la timestamp, hold pe CTA, viteza tranzițiilor, muzică sub voce, nivelul muzicii și al efectelor, hook original sau variantă, hook mai agresiv sau mai calm, direcție, durata scenei, textul la timestamp, înlocuirea materialului. Fiecare comandă creează o versiune nouă, cu jurnal (teste).
- [✓] Variante de hook ca versiuni din același părinte (test de integrare).

## 12. Studio (interfața locală)

- [✓] Proiecte, brief (formular complet, inclusiv livrarea), materiale (încărcare, roluri, drepturi, focus, date personale), research, brand, script, storyboard, Preview & timeline, audio (note pe timestamp), critică, versiuni, export. Joburi cu progres, doar pe 127.0.0.1 (testat în integrare și manual cu Playwright).
- [~] Timeline-ul din Studio e o **vizualizare cu navigare** (scene, straturi, voce, efecte, subtitrări, bătăi; clic = salt). Nu e un editor cu tragere de clipuri: editarea se face prin storyboard, script, comenzi sau Claude.
- [✓] Remotion Studio pe timeline-ul unui proiect sau pe catalog (`npm run remotion`): pornit și verificat cu Playwright (compoziția se încarcă, fără erori în consolă).
- [!] Remotion Studio ascultă pe toate interfețele de rețea (comportamentul Remotion 4.0.534, fără opțiune de limitare): cât rulează, e accesibil din rețeaua locală. Studio-ul propriu ascultă doar pe 127.0.0.1.

## 13. Claude Code

- [✓] `CLAUDE.md`: regulile utilizatorului, neschimbate, plus constituția de inginerie.
- [✓] Comenzile `/make-ad`, `/fix-at`, `/add-effect` și `/new-version` (`.claude/commands/`) folosesc doar comenzi `mms` care există.
- [~] Comenzile sunt instrucțiuni pentru Claude; nu au test automat (cer o sesiune Claude Code).

## 14. Documentație

- [✓] README pentru începători, ARHITECTURA, BIBLIOTECA (generată din cod), DECIZII, DEPANARE, GLOSAR, LICENTE, FLUX, acest fișier, AUDIT, CHANGELOG.

## Ce lipsește, concret, și pasul următor

| | Ce | Pasul următor |
| --- | --- | --- |
| [ ] | Test pe o a doua aplicație reală (ordinea de construcție, pasul 10) | Rulează `/make-ad` pe un produs real, ales de tine |
| [ ] | Reparația proiectului de test anterior (Spotify v5, din CLAUDE.md), pe baza notelor tale de ascultare | După testul pe a doua aplicație; proiectul nu e în acest repo |
| [ ] | Importul celor 96 de sunete din proiectul anterior (`PLAN.md`, Faza 4) | Adaugă-le ca materiale ale tale, după verificarea licenței (poarta de drepturi) |
| [ ] | Detecția datelor personale în afară de email (nume, telefoane, OCR în imagini) | Detecție de telefon și nume în DOM; OCR doar dacă e nevoie |
| [ ] | Editare directă în timeline (tragere, tăiere) în Studio | Doar dacă fluxul prin storyboard și comenzi nu ajunge |
| [ ] | Research pe web (dincolo de paginile capturate) | Cu sursă și dată, prin Claude, cu `add-claim` |
| [~] | Testarea `install.sh` și a vocilor cu chei API | Pe un Mac și cu chei reale |
