# Starea implementării

Actualizat: 2026-10-13 · ramura `main` (după 0.1.0: etapa „Video Production OS”, consolidarea de securitate și costuri, consolidarea „10/10” (deciziile 77–97), apoi compoziția dinamică (deciziile 98–102))

## Ce înseamnă marcajele

| Marcaj | Înseamnă |
| --- | --- |
| [✓] | Implementat și verificat: test automat sau randare reală inspectată |
| [~] | Implementat, dar verificat doar parțial (sau doar manual), ori cu limite cunoscute |
| [ ] | Neimplementat |
| [!] | Risc sau limită importantă, de știut înainte de folosire |

Inventarul complet de design și producție (201 elemente, cu stare și prioritate, verificat de test): `docs/INVENTAR.md`. Toate cele 85 de elemente P0 sunt implementate; 174 de elemente sunt implementate, 21 parțiale și 6 lipsesc (niciunul P0 sau P1). Capabilitățile de sistem (intrări, ieșiri, implementare, teste): `docs/SISTEM.md`.

**Porțile de calitate la data de mai sus:**

| Poartă | Rezultat |
| --- | --- |
| `npm run typecheck` | trece |
| `npm run lint` | trece (nume de produs, determinism, secrete, fără co-autori în commit-urile noi) |
| `npm test` | 186 de teste în 27 de fișiere trec (unitare + integrare), ~60 s |
| `npm run test:render` | 9 teste trec, 3 min 10 s: toate cele 126 de capabilități randate și comparate cu referința vizuală, determinismul cadrelor (toleranță 2/255), MP4 H.264 + AAC (și oprirea la jumătate), toate cele 16 rețete pe 16:9 și 9:16 față de referință (actualizată pe 2026-10-13 după verificarea cadrelor: locul textului, dezvăluirea cu produsul), testul de sensibilitate al pragurilor |
| `npm run e2e -- --fresh --autofix --export` | ultima rulare (2026-10-13, după toate reparațiile): v1 **100/100, PASS** din prima rundă, fără nicio problemă (nici mică), deci fără corecturi automate; conceptul utilizatorului ales (82,1/100); 2 formate × 23,5 s; capturi desktop + variantele de telefon; textul principal alternează locul pe ambele formate; −14,12 LUFS / −1,58 dBTP; 705 cadre pe format fără cadre negre, flash-uri sau înghețări; exportul final 9:16 verificat (1080×1920 @ 30 fps, 23,51 s, H.264 + AAC, 21,6 MB). Exportul 16:9 din această rulare s-a oprit: FFmpeg n-a mai putut porni (0xC0000142), cu memoria calculatorului plină; în rularea anterioară din aceeași zi (aceleași rețete de randare, fără reparațiile de geometrie și de culoare a adresei) exportul 16:9 a trecut (1920×1080 @ 30 fps, 23,51 s, 21,1 MB) |
| `npm run e2e:real -- --url <site public> --fresh --lang en` | trece, 277 s, pe același site public real (adresa dată la rulare, niciun nume în cod): v2 **96,6, FIX** (linia de bază din 2026-10-11: 91,4; etapa anterioară: 95,1), 0 critice, 1 problemă mare: drepturile capturilor site-ului (o singură întrebare, decizia utilizatorului, regula 3). Textul alternează locul pe ambele formate; materialul mărit nu mai atinge titlul de sub el, iar adresa de pe CTA e lizibilă (punctele 103–104). Rămân pentru om și Claude, din script: hook-ul de 4,3 s și ritmul lent pentru TikTok (replicile lungi citate de pe site), plus lipsa unei scene calme (toate scenele demonstrează funcții). Reclama iese „concept”, iar exportul final e refuzat, cum cere regula 3 |

## 1. Instalare și mediu

- [✓] `install.ps1` (Windows): Node/Git prin winget doar cu acord, `npm ci`, browserele, `.env`, setup, `doctor`. Rulat cap-coadă pe Windows 11 (0.1.0).
- [✓] `npm run doctor`: verifică fără să instaleze nimic (inclusiv versiunile fixate, cache-ul față de buget și proiectele existente față de schemele de acum). Ieșire 1 la probleme.
- [✓] `npm run update` (aduce versiunea nouă, `npm ci`, browserele de randare și captură), `.env.example`, `.gitignore`, `.gitattributes`.
- [✓] Politica dependențelor: versiuni fixate exact, Remotion actualizat împreună, actualizarea pe o ramură cu toate porțile (`docs/ARHITECTURA.md`); `npm audit` în CI (0 vulnerabilități).
- [~] `install.sh` (macOS/Linux): scris, **netestat** pe aceste sisteme.
- [✓] FFmpeg/FFprobe din Remotion; fără Python. Etapa aceasta nu a adăugat nicio dependență.

## 2. Modelul de date și proiectele

- [✓] Scheme zod pentru toate entitățile, inclusiv cele noi: probleme (`Finding`), scorul și configurarea calității, operațiile de editare, conceptele, OCR-ul materialelor.
- [✓] Migrarea schemelor la citire, în memorie (versiunile înghețate nu se rescriu); un fișier dintr-un studio mai nou e refuzat cu indicația `npm run update`; `mms check-projects` verifică proiectele existente (teste unitare și de integrare).
- [✓] Versiuni imuabile: înghețare, versiune automată la editare și la recompilare, `rejected` la rollback (versiunea rămâne pe disc), exporturi care nu se suprascriu.
- [✓] Instantaneele intrărilor fiecărei versiuni (`snapshots/`), pentru compararea exactă a versiunilor.
- [✓] Vocea se reface automat când textul sau setările ei se schimbă; o versiune nouă primește fișierele vocii.
- [✓] `STATE.md` actualizat la fiecare pas; aprobările cer frazele exacte „aprob” / „render final”.

## 3. Captură și materiale

- [✓] Captură reală cu Playwright: capturi 2×, pagină întreagă, mobil, zone din DOM, date de pagină, CSS, forma interfeței (colțuri, umbre, spațiere). Înregistrare cadru cu cadru → MP4.
- [✓] Butoanele includ linkurile stilizate ca butoane (CTA-ul real al majorității site-urilor); titlurile din meniu și subsol nu intră în datele paginii (verificat pe un site real).
- [✓] Logo-ul din pagină (SVG inline cu culoarea lui sau imaginea din antet), doar cu semnal clar; deduplicat cu logo-ul dat de utilizator (test de integrare).
- [✓] `--third-party` la captură (și în Studio): site-ul altcuiva intră cu drepturi neconfirmate (poarta de drepturi, regula 3). Capturile unui site sunt o singură întrebare (`mms rights <proiect> --source <site>`), cu o singură problemă în raport (test unitar + rularea pe site-ul real).
- [✓] Captura de telefon pentru formatele verticale: la un proiect cu 9:16 sau 4:5, fiecare captură desktop se face și pe telefon; compilatorul o folosește pe vertical doar dacă pagina e adaptată pentru telefon (depășirea orizontală, vizibilă sau ascunsă, e detectată) și arată toate zonele demonstrate în scenă. Teste unitare și de integrare; pe site-ul real, problemele de lizibilitate de pe 9:16 au dispărut (vezi porțile).
- [✓] Politica de adrese (SSRF): o pagină publică nu atinge rețeaua locală (resurse, WebSocket, service workers, pași `goto`, logo-ul); o redirecționare spre o adresă locală oprește captura fără să salveze ceva; metadatele norilor nu se deschid niciodată (teste unitare + test de integrare fără internet).
- [✓] Proxy-ul de filtrare: tot traficul unei pagini publice trece printr-un proxy local care rezolvă singur numele și se conectează la IP-ul verificat; redirecționările spre rețeaua locală și DNS rebinding sunt oprite înainte să plece (test de integrare pe proxy-ul real, punctul 91).
- [~] Autentificare interactivă (`mms login`, profil persistent): implementată, **netestată automat** (cere un om).
- [✓] Ingestie: sha256 și duplicate, ffprobe, fontkit, SVG, miniatură, punct focal, paletă, dHash, rolul.
- [✓] Date personale: email, telefon, card (Luhn), IBAN (mod 97), CNP (cifra de control), nume după salut; din DOM și din OCR. Decizia „estompează / lasă vizibile”; validatorul blochează capturile fără decizie (teste unitare).
- [~] OCR offline (Windows, WinRT) pe capturile fără DOM: zonele de text se folosesc pentru zoom și pentru datele personale (test de integrare). Pe macOS/Linux OCR-ul lipsește, iar ingestia spune asta.
- [!] Numele de persoane se recunosc doar după un salut („Bună, Ana”); un nume izolat într-o listă nu e detectat.

## 4. Research și afirmații

- [✓] Surse cu citat, dată și încredere; afirmațiile au tipul fapt, inferență sau interpretare; cifrele și prețurile intră „de confirmat”.
- [✓] Citirea paginilor relevante ale site-ului (`research-crawl`): același domeniu, fără paginile de cont, aplicație și juridice; capturile paginilor devin și materiale, cu drepturile capturilor de pe același site (teste unitare + rulare pe produsul demo și pe un site real).
- [✓] Graful de afirmații (`claims`): coroborare între surse, conflicte, afirmații despre concurenți. Conflictul sau concurentul folosit fără aprobare → problemă critică.
- [~] Fără căutare pe web dincolo de site-ul produsului. Afirmațiile din alte surse se adaugă cu `mms add-claim` (sau de Claude, cu sursă).

## 5. Brand și referințe

- [✓] Brand kit din CSS, frecvența culorilor și logo; fonturile potrivite cu biblioteca; forma (colțuri, umbre, spațiere, gradienți) folosită de rețete pentru carduri și butoane.
- [✓] Analiza referințelor (tăieturi, mișcare, culoare, tempo) și Reference DNA aplicat pe direcție și ritm (teste unitare).
- [~] Fonturile site-ului care nu sunt în bibliotecă se înlocuiesc cu cel mai apropiat font OFL inclus.
- [✓] Spațierea din brand e unitatea așezării: grila de 12 coloane pe orizontal, subtitlul la o unitate sub titlu (punctul 85). Linia de bază comună lipsește (P2).

## 6. Creativ, script, storyboard

- [✓] Intake inteligent (`mms intake`): deduce din pagina reală și din cerere, cu sursa și încrederea; toate grupele A–H rămân acoperite; întreabă doar ce e incert și cu impact (teste).
- [✓] Concepte creative din dovezi, scor pe 10 criterii, conceptul utilizatorului cu prioritate; storyboard-ul folosește structura conceptului ales (teste + Studio).
- [✓] Direcțiile A–F, 8 șabloane, schița de script cu cuvintele utilizatorului păstrate, constructorul de storyboard.
- [✓] Validarea scriptului: CTA-ul nestabilit („de confirmat”) e critic; textul pe ecran foarte lung e problemă mare; citatele în altă limbă decât reclama sunt semnalate pentru traducere (teste).
- [~] Scrisul creativ propriu-zis (rescrierea scriptului, traducerea, alegerea rețetelor) îl face Claude în Claude Code (`/make-ad`). Conceptele și schița automată sunt un punct de plecare factual: pe un site real, schița citează textul site-ului, care e lung și scris pentru web, nu pentru o reclamă.

## 7. Motorul de mișcare

- [✓] 126 de capabilități în registry, fiecare cu fișă, parametri zod, sunet declarat și exemplu, toate randate și comparate cu referința vizuală (noi: `mod.blend`, `shape.icon`; anticipația în `mod.enter`).
- [✓] Tăieturi în interiorul scenelor lungi (punch-in) pe platformele rapide, pe cuvânt; varietatea: animația titlului după energie, camera inversată la rețete repetate; arcul de energie al storyboard-ului automat (punctele 81, 83, 84).
- [✓] L-cut din storyboard (`audio.lCutSec`): tăietura imaginii mai devreme, vocea pe loc (punctul 87).
- [✓] Planificatorul de compoziție: compoziția `auto` (implicită) mută textul între scene, stânga ↔ dreapta pe orizontal și sus ↔ jos pe vertical; frazele unei secvențe își alternează locul; verificarea `visual.text-placement` prinde textul ținut în același loc în trei scene la rând (punctul 98, teste unitare + produsul demo pe ambele formate).
- [✓] Odihna vizuală planificată: când toate scenele mișcă camera, cea mai calmă scenă fără demonstrație primește cameră fixă (punctul 99).
- [✓] Dezvăluirea cu produsul real (slotul opțional `screen`), sub slogan (punctul 100).
- [✓] 16 rețete, gramatica de montaj, tăieturi pe beat doar cu tempo sigur, tăieturile spre dezvăluire pe drop-uri.
- [✓] Camera, callout-urile, limitarea zoom-ului sub text, derularea capturilor de pagină întreagă (0.1.0, teste).
- [✓] Determinism: timeline identic octet cu octet; cadre identice (toleranță de rasterizare 2/255); recompilarea e verificată și în bucla de calitate (`technical.recompile`).
- [!] Rasterizarea Chrome poate varia rar cu cel mult 2/255 (docs/DECIZII.md, punctul 38).
- [~] 3D înseamnă CSS 3D; nu există geometrie 3D reală (Three.js), pentru că nu a fost necesară.

## 8. Timeline, validare, formate

- [✓] Compilator storyboard → timeline, cu text măsurat cu fonturile reale; subtitrările ocolesc zona demonstrată și nu dublează textul de pe ecran.
- [✓] Validator: footage real, drepturi, cifre, zone sigure, zone excluse, 360 px, flash-uri, goluri, date personale; fiecare problemă cu corectura propusă.
- [✓] Formate 9:16, 16:9, 1:1, 4:5, 4K, personalizat; 24–60 fps; aceleași tăieturi în toate formatele.
- [✓] Pe vertical și pe pătrat, așezarea „thirds-right” pune materialul sus și textul lipit sub el, deasupra subtitrărilor; zona textului se dimensionează după conținut (fără subtitlu, materialul crește).
- [!] Storyboard-urile scrise înainte de punctul 98 au compoziția salvată explicit (`thirds-left`/`thirds-right`) și rămân cum erau; pentru textul dinamic, compoziția scenelor trebuie să devină `auto` (sau storyboard-ul se regenerează).
- [✓] Verificarea reîncadrării: zona demonstrată rămâne în cadru și lizibilă pe fiecare format (`platform.reframing`).
- [✓] Materialul mărit de cameră nu intră peste titlu, nici când camera e aleasă de o corectură sau din editor (zoom-ul limitat al rețetei se păstrează); verificarea `ui.material-over-text` măsoară suprapunerea pe ecran (test de integrare + verificată pe timeline-ul real care avea defectul: 45–46% din titlu acoperit, prins).
- [✓] Culorile de text lizibile din nuanța brandului: textul secundar ≥ 4,5:1, cuvântul rostit din subtitrări ≥ 3:1 pe fundalul lor (cadre verificate pe produsul real).
- [✓] Profiluri de platformă (durată, hook, subtitrări, densitate) pentru TikTok, Reels, Shorts, YouTube, feed, LinkedIn, X, generic; ajustabile per proiect.
- [!] Zonele sigure ale platformelor vin din surse secundare (încredere medie). Verifică-le în Ads Manager înainte de o campanie mare.
- [~] Pe 9:16 se folosește captura de telefon a aceleiași pagini (punctul 3). Rămâne captura desktop, cu motivul în raportul compilării, când pagina nu e adaptată pentru telefon sau când zonele demonstrate nu apar pe ecranul de telefon (de ex. o tablă kanban sub ecran); atunci interfața poate rămâne mică.
- [✓] Pe 16:9 (și 1:1), decupajul în jurul zonei demonstrate, doar când camera nu ajunge singură: pe site-ul real, interfața de pe 16:9 și 9:16 trece testul de 360 px (punctul 78).
- [✓] La drag & drop, zona demonstrată e partea coloanei cu conținut: pe 9:16, subtitrările nu mai acoperă tabla kanban a produsului demo (punctul 79).
- [~] O zonă demonstrată prea înaltă ca să încapă între titlu și subtitrări rămâne raportată (subtitrările nu se mută peste ea); decizia e a omului.

## 9. Audio

- [✓] WAV, filtre, loudness BS.1770-4, true peak 4×, limitator, ducking cu rampă de 500 ms (și pentru efectele sonore, −4 dB sub voce), verificarea tăcerilor.
- [✓] 35 de efecte sonore sintetizate; muzică originală; beat grid cu încredere; structura muzicii (secțiuni, drop-uri); cue sheet; subtitrări.
- [✓] Voce Windows offline (inclusiv română); vocea utilizatorului din fișier. Mixul e în cache pe conținut (`audioKey`).
- [✓] Compresorul pe voce (implicit, prag adaptiv, nivelul mediu păstrat) și ambianța sintetizată (opțională), cu întrebările F6–F7 (punctul 86; se judecă la ascultare).
- [~] ElevenLabs și OpenAI TTS: implementate, **netestate** (fără chei). macOS `say` și `espeak`: netestate. Modelul vocii din cloud intră în cheia de cache, apelurile au timeout de 90 s și un buget pe rulare (`MMS_MAX_PAID_CALLS`, test unitar); fiecare sinteză și refolosire din cache intră în jurnalul proiectului (`mms usage`).
- [!] Detecția tempo-ului e verificată pe muzică sintetizată și pe un fișier de 112 BPM. Pe piese reale fără tobe poate greși; sub încrederea 0,35 nu aliniază tăieturi și nu inventează structură. Tempo-ul se poate fixa în brief.
- [!] Drepturile comerciale ale vocilor TTS de sistem nu sunt clare (docs/LICENTE.md).
- [!] Sunetul nu poate fi judecat de AI: notele utilizatorului pe timestamp sunt singura verificare reală (regula 15).

## 10. Bucla de calitate (docs/CALITATE.md)

- [✓] Pase 0–9 cu 26 de verificări, fiecare cu metoda și costul ei; adâncimi fast / standard / deep / final; verificările sărite și categoriile neevaluate sunt raportate (teste unitare și de integrare).
- [✓] Cache pe conținut: cadrele-cheie (conținutul scenei + codul de randare), mixul, preview-ul; motorul de impact între versiuni (teste).
- [✓] Scorul `quality-v1`, 11 categorii, verdict PASS / POLISH / FIX / FAIL, configurabil per proiect; rubrica regulii 7 păstrată și inclusă în PASS (teste).
- [✓] Probleme structurate cu toate câmpurile cerute; problemele lui Claude (`claude-visual`) și ale utilizatorului intră în același sistem.
- [✓] Corecturi automate cu limite, rollback și interdicția de a reîncerca o corectură respinsă (test de integrare + rulare pe produsul demo).
- [✓] Criticul pe pixeli: contrastul măsurat, aglomerarea, ocuparea, culorile brandului (teste unitare + cadre verificate).
- [✓] Pachetul de revizuire vizuală (`critique-pack`) și primirea observațiilor (`review`), folosite în această etapă pe produsul demo.
- [!] Criticul automat rămâne euristic pentru poveste și creativ: verifică structura, ritmul, arcul de energie și dovezile, nu „cât de bună e ideea”. Aceea e judecata lui Claude și a utilizatorului.
- [!] Nu există apel automat la un model de vedere prin API (docs/DECIZII.md, punctul 45). Revizuirea vizuală cere o sesiune Claude Code.

## 11. Editare și iterație

- [✓] Operații de editare (scene, tranziții, cameră, rețetă, material, straturi, sunete, recompilare) cu validare; undo/redo pe jurnal și instantanee (teste unitare și de integrare).
- [✓] Comenzi în limbaj natural, în română și engleză; fiecare creează o versiune nouă, cu jurnal.
- [✓] Variante de hook ca versiuni din același părinte.

## 12. Randare și export

- [✓] Preview MP4 (H.264, yuv420p, BT.709, AAC), foaie de contact, cadre, raport (cadre negre, flash-uri, înghețări); preview-ul identic se refolosește din cache.
- [✓] Randarea se poate opri (semnalul ajunge la Remotion) și poate randa doar un interval de cadre, la scară redusă (pentru verificarea mișcării). E atomică (fișier temporar, redenumit la final) și verifică spațiul liber înainte (test de randare: oprire la jumătate, apoi reluare).
- [✓] Cache-urile care se pot reface au buget (`MMS_CACHE_MAX_GB`, implicit 10 GB).
- [✓] Export final: doar cu „render final”, fără blocaje, cu mix „ok”, fără suprascriere. Pachetul de postare testat prin `mms post-pack`.
- [✓] Drumul complet până la exportul final, pe produsul demo fictiv (`npm run e2e -- --export`, aprobarea de test): două MP4-uri finale verificate cu ffprobe (rezoluție, FPS, durată, H.264, pistă audio) și cu analiza video. O reclamă reală cere „render final” de la om (regula 6); poarta e testată separat.
- [✓] Bundle-urile vechi de randare se șterg singure (cel curent + ultimele 2 + cele folosite în ultimele 2 ore); `mms cache [--prune]`. Pe laptopul de test: 1498 MB → 254 MB.
- [✓] Jurnalul operațiilor (`mms usage <proiect>`): sinteze de voce (din cloud sau locale, refolosite din cache), randări de preview și finale, cu durata și unitățile. Pe testul cap-coadă: 7 sinteze locale (4,7 s), 2 preview-uri și 2 exporturi (1382 de cadre fiecare, ~114 s).
- [!] Viteza de randare: ~2,0–2,1× durata reclamei pe laptopul de test, măsurată pe mașina liniștită (`npm run bench`). Limita e procesul GPU al browserului, nu concurența (punctul 77).

## 13. Studio (interfața locală)

- [✓] Proiecte, brief, materiale, research, brand, **Concept**, script, storyboard, **Preview & timeline cu editorul scenei**, audio, **Calitate**, critică, versiuni, export. Verificat cu Playwright: tab-urile noi se încarcă fără erori, iar o editare (+0,5 s) și undo rulează cap-coadă din interfață.
- [✓] Joburi cu etapă, progres, oprire, timeout pe tip, manifest pe disc și reluarea celor întrerupte (test de integrare).
- [✓] Protecții: doar 127.0.0.1, doar Host local, Origin local + antetul `X-MMS` pe cererile care modifică, tipuri de fișier permise și maximum 500 MB la încărcare (test de integrare). Id-urile de proiect și de versiune din URL nu pot ieși din folderele lor (test unitar).
- [✓] Fiecare tab, pe un proiect produs: fără erori în consolă, fără probleme WCAG 2 A/AA grave (axe), fără conținut ieșit din ecran la 1280 și 820 px (test de integrare).
- [✓] Un crash în mijlocul unui job: la repornire jobul e „întrerupt”, se reia și termină (test cu procesul omorât). Două Studio-uri nu își mai marchează joburile unul altuia.
- [~] Timeline-ul nu are tragere de clipuri cu mouse-ul: editarea se face din panoul scenei (operațiile reale), din storyboard, comenzi sau Claude.
- [✓] Remotion Studio pe un proiect sau pe catalog (`npm run remotion`).
- [✓] Remotion Studio ascultă doar pe 127.0.0.1 (preload-ul `scripts/loopback-only.cjs`, test unitar).

## 14. Claude Code

- [✓] `CLAUDE.md`: regulile utilizatorului neschimbate, plus constituția de inginerie (bucla de calitate, legătura cu regulile 7 și 10, fără co-autori).
- [✓] `/make-ad`, `/fix-at`, `/add-effect`, `/new-version` folosesc doar comenzi `mms` care există și fluxul nou (intake, concept, adâncimi, `critique-pack`, `impact`).
- [~] Comenzile sunt instrucțiuni pentru Claude; nu au test automat.
- [✓] Fără atribuiri automate: `.claude/settings.json` le dezactivează; lint-ul refuză commit-urile noi cu trailere de co-autor.

## 15. Documentație

- [✓] README, ARHITECTURA, CALITATE, TESTARE, BIBLIOTECA / INVENTAR / SISTEM (generate din cod), DECIZII (1–97), DEPANARE, GLOSAR, LICENTE, FLUX, AUDIT (inițial + etapa „Video Production OS”), CHANGELOG, acest fișier.

## 16. Inginerie

- [✓] CI pe Windows: `npm audit`, typecheck, lint, testele cu acoperire, testul cap-coadă fără randare, randarea cu randare software.
- [✓] Biome (lint și formatare) fără erori; acoperirea codului Node cu prag minim (linii 70%, funcții 72%, ramuri 57%), măsurat fără voce, ca pe CI.
- [✓] Fișierele mari împărțite: panourile Studio, rețetele, verificările buclei de calitate (fără schimbări de logică).

## Ce lipsește, concret, și pasul următor

| | Ce | Pasul următor |
| --- | --- | --- |
| [ ] | Test pe o a doua aplicație reală (ordinea de construcție, pasul 10) | Rulează `/make-ad` pe un produs real ales de tine; rezultatul se compară cu produsul demo |
| [ ] | Reparația proiectului de test anterior (Spotify v5) | După testul pe a doua aplicație; proiectul nu e în acest repo |
| [ ] | Importul celor 96 de sunete din proiectul anterior | Ca materiale ale tale, după verificarea licenței (poarta de drepturi) |
| [ ] | Licența proiectului: repo-ul e public, fără fișier de licență (drepturi rezervate) | Decizia autorului (`docs/LICENTE.md`) |
| [ ] | Publicarea: push pe GitHub, ștergerea ramurilor remote vechi, eticheta de versiune (de ex. `v0.2.0`) | Cu acordul autorului |
| [ ] | Pe site-ul real: hook-ul de 4,3 s și ritmul TikTok (~4,1 s pe plan) vin din replicile lungi citate de pe site | Decizie de script (Claude în `/make-ad` și utilizatorul): un hook sub 3 s, replici mai scurte |
| [ ] | Elementele P2/P3 rămase (morph de text și de forme, graphic match, tranziția prin obiect, obiecțiile, stilul ilustrațiilor) | `docs/INVENTAR.md`; doar când un proiect le cere |
| [~] | Linia de bază comună a textelor (grila are doar coloane) | Doar dacă un proiect o cere |
| [~] | Zonele sigure ale platformelor din surse secundare | Verificarea în Ads Manager, cu contul tău |
| [~] | `install.sh`, vocile cu chei API, OCR pe macOS/Linux | Pe un Mac și cu chei reale |
| [~] | Revizuirea vizuală automată fără sesiune Claude Code | Doar dacă e nevoie; cere o cheie și trimiterea cadrelor în afară (decizia 45) |
