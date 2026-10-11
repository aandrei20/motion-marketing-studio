# Starea implementării

Actualizat: 2026-10-11 · ramura `build/production-os` (după 0.1.0, etapa „Video Production OS”)

## Ce înseamnă marcajele

| Marcaj | Înseamnă |
| --- | --- |
| [✓] | Implementat și verificat: test automat sau randare reală inspectată |
| [~] | Implementat, dar verificat doar parțial (sau doar manual), ori cu limite cunoscute |
| [ ] | Neimplementat |
| [!] | Risc sau limită importantă, de știut înainte de folosire |

Inventarul complet de design și producție (200 de elemente, cu stare și prioritate, verificat de test): `docs/INVENTAR.md`. Toate cele 85 de elemente P0 sunt implementate; 24 sunt parțiale și 12 lipsesc (niciunul P0 sau P1). Capabilitățile de sistem (intrări, ieșiri, implementare, teste): `docs/SISTEM.md`.

**Porțile de calitate la data de mai sus:**

| Poartă | Rezultat |
| --- | --- |
| `npm run typecheck` | trece |
| `npm run lint` | trece (nume de produs, determinism, secrete, fără co-autori în commit-urile noi) |
| `npm test` | 125 de teste în 15 fișiere trec (unitare + integrare), ~1 min |
| `npm run test:render` | 8 teste trec, ~4 min: toate cele 124 de capabilități randate și comparate cu referința vizuală, determinismul cadrelor (toleranță 2/255), MP4 H.264 + AAC, toate cele 16 rețete pe 16:9 și 9:16 față de referință, testul de sensibilitate al pragurilor |
| `npm run e2e -- --fresh --autofix` | trece, 303 s: 2 formate × 23 s; v1 96,6 → corecturi automate (4 corecturi, 3 scene re-verificate, restul din cache) → v2 97,3; −14,25 LUFS / −1,58 dBTP; 691 de cadre pe format fără cadre negre, flash-uri sau înghețări. Verdict **FIX**: rămâne o problemă mare (subtitrările acoperă 20% din coloana demonstrată în s6, pe 9:16), care cere o decizie de om |
| `npm run e2e:real -- --url <site public> --fresh --lang en` | trece, 316 s, pe un site public real (adresa dată la rulare, niciun nume în cod): 5 pagini citite, 119 afirmații (21 de confirmat); 2 formate × 20,5 s; v1 89,7 → corecturi automate → v2 **91,4, FIX**, 0 probleme critice; −14,26 LUFS / −1,5 dBTP; fără cadre negre, flash-uri sau înghețări (hold-ul de 3,3 s de pe CTA e raportat separat). Cele 3 probleme mari sunt drepturile capturilor unui terț: reclama iese „concept”, iar exportul final e refuzat, cum cere regula 3. Rămân pentru om și Claude: hook-ul de 4,5 s, ritmul lent pentru TikTok, interfața desktop ilizibilă la 360 px pe 9:16 |

## 1. Instalare și mediu

- [✓] `install.ps1` (Windows): Node/Git prin winget doar cu acord, `npm ci`, browserele, `.env`, setup, `doctor`. Rulat cap-coadă pe Windows 11 (0.1.0).
- [✓] `npm run doctor`: verifică fără să instaleze nimic. Ieșire 1 la probleme.
- [✓] `npm run update`, `.env.example`, `.gitignore`, `.gitattributes`.
- [~] `install.sh` (macOS/Linux): scris, **netestat** pe aceste sisteme.
- [✓] FFmpeg/FFprobe din Remotion; fără Python. Etapa aceasta nu a adăugat nicio dependență.

## 2. Modelul de date și proiectele

- [✓] Scheme zod pentru toate entitățile, inclusiv cele noi: probleme (`Finding`), scorul și configurarea calității, operațiile de editare, conceptele, OCR-ul materialelor.
- [✓] Versiuni imuabile: înghețare, versiune automată la editare și la recompilare, `rejected` la rollback (versiunea rămâne pe disc), exporturi care nu se suprascriu.
- [✓] Instantaneele intrărilor fiecărei versiuni (`snapshots/`), pentru compararea exactă a versiunilor.
- [✓] Vocea se reface automat când textul sau setările ei se schimbă; o versiune nouă primește fișierele vocii.
- [✓] `STATE.md` actualizat la fiecare pas; aprobările cer frazele exacte „aprob” / „render final”.

## 3. Captură și materiale

- [✓] Captură reală cu Playwright: capturi 2×, pagină întreagă, mobil, zone din DOM, date de pagină, CSS, forma interfeței (colțuri, umbre, spațiere). Înregistrare cadru cu cadru → MP4.
- [✓] Butoanele includ linkurile stilizate ca butoane (CTA-ul real al majorității site-urilor); titlurile din meniu și subsol nu intră în datele paginii (verificat pe un site real).
- [✓] Logo-ul din pagină (SVG inline cu culoarea lui sau imaginea din antet), doar cu semnal clar; deduplicat cu logo-ul dat de utilizator (test de integrare).
- [✓] `--third-party` la captură: site-ul altcuiva intră cu drepturi neconfirmate (poarta de drepturi, regula 3).
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
- [~] Spațierea din brand nu e încă unitatea de spațiere a rețetelor (`docs/INVENTAR.md`, „Spațiere consecventă”).

## 6. Creativ, script, storyboard

- [✓] Intake inteligent (`mms intake`): deduce din pagina reală și din cerere, cu sursa și încrederea; toate grupele A–H rămân acoperite; întreabă doar ce e incert și cu impact (teste).
- [✓] Concepte creative din dovezi, scor pe 10 criterii, conceptul utilizatorului cu prioritate; storyboard-ul folosește structura conceptului ales (teste + Studio).
- [✓] Direcțiile A–F, 8 șabloane, schița de script cu cuvintele utilizatorului păstrate, constructorul de storyboard.
- [✓] Validarea scriptului: CTA-ul nestabilit („de confirmat”) e critic; textul pe ecran foarte lung e problemă mare; citatele în altă limbă decât reclama sunt semnalate pentru traducere (teste).
- [~] Scrisul creativ propriu-zis (rescrierea scriptului, traducerea, alegerea rețetelor) îl face Claude în Claude Code (`/make-ad`). Conceptele și schița automată sunt un punct de plecare factual: pe un site real, schița citează textul site-ului, care e lung și scris pentru web, nu pentru o reclamă.

## 7. Motorul de mișcare

- [✓] 124 de capabilități în registry, fiecare cu fișă, parametri zod, sunet declarat și exemplu, toate randate și comparate cu referința vizuală.
- [✓] 16 rețete, gramatica de montaj, tăieturi pe beat doar cu tempo sigur, tăieturile spre dezvăluire pe drop-uri.
- [✓] Camera, callout-urile, limitarea zoom-ului sub text, derularea capturilor de pagină întreagă (0.1.0, teste).
- [✓] Determinism: timeline identic octet cu octet; cadre identice (toleranță de rasterizare 2/255); recompilarea e verificată și în bucla de calitate (`technical.recompile`).
- [!] Rasterizarea Chrome poate varia rar cu cel mult 2/255 (docs/DECIZII.md, punctul 38).
- [~] 3D înseamnă CSS 3D; nu există geometrie 3D reală (Three.js), pentru că nu a fost necesară.

## 8. Timeline, validare, formate

- [✓] Compilator storyboard → timeline, cu text măsurat cu fonturile reale; subtitrările ocolesc zona demonstrată și nu dublează textul de pe ecran.
- [✓] Validator: footage real, drepturi, cifre, zone sigure, zone excluse, 360 px, flash-uri, goluri, date personale; fiecare problemă cu corectura propusă.
- [✓] Formate 9:16, 16:9, 1:1, 4:5, 4K, personalizat; 24–60 fps; aceleași tăieturi în toate formatele.
- [✓] Verificarea reîncadrării: zona demonstrată rămâne în cadru și lizibilă pe fiecare format (`platform.reframing`).
- [✓] Materialul mărit de cameră nu intră peste titlu, nici când camera e aleasă de o corectură sau din editor (zoom-ul limitat al rețetei se păstrează); verificarea `ui.material-over-text` măsoară suprapunerea pe ecran (test de integrare + verificată pe timeline-ul real care avea defectul: 45–46% din titlu acoperit, prins).
- [✓] Culorile de text lizibile din nuanța brandului: textul secundar ≥ 4,5:1, cuvântul rostit din subtitrări ≥ 3:1 pe fundalul lor (cadre verificate pe produsul real).
- [✓] Profiluri de platformă (durată, hook, subtitrări, densitate) pentru TikTok, Reels, Shorts, YouTube, feed, LinkedIn, X, generic; ajustabile per proiect.
- [!] Zonele sigure ale platformelor vin din surse secundare (încredere medie). Verifică-le în Ads Manager înainte de o campanie mare.
- [!] Pe 9:16, capturile desktop ale unui site rămân mici: interfața se vede la ~4 px la testul de 360 px (problemă medie raportată), iar sub captură rămâne mult spațiu gol. Remediul real e o captură pe mobil pentru formatele verticale (vezi „Ce lipsește”).
- [!] Pe 9:16, o scenă cu interfață lată poate să nu lase loc subtitrărilor fără să acopere zona demonstrată; atunci problema rămâne raportată pentru o decizie de om (mutarea materialului sau fără subtitrări pe scenă).

## 9. Audio

- [✓] WAV, filtre, loudness BS.1770-4, true peak 4×, limitator, ducking cu rampă de 500 ms (și pentru efectele sonore, −4 dB sub voce), verificarea tăcerilor.
- [✓] 35 de efecte sonore sintetizate; muzică originală; beat grid cu încredere; structura muzicii (secțiuni, drop-uri); cue sheet; subtitrări.
- [✓] Voce Windows offline (inclusiv română); vocea utilizatorului din fișier. Mixul e în cache pe conținut (`audioKey`).
- [~] ElevenLabs și OpenAI TTS: implementate, **netestate** (fără chei). macOS `say` și `espeak`: netestate.
- [!] Detecția tempo-ului e verificată pe muzică sintetizată și pe un fișier de 112 BPM. Pe piese reale fără tobe poate greși; sub încrederea 0,35 nu aliniază tăieturi și nu inventează structură. Tempo-ul se poate fixa în brief.
- [!] Drepturile comerciale ale vocilor TTS de sistem nu sunt clare (docs/LICENTE.md).
- [!] Sunetul nu poate fi judecat de AI: notele utilizatorului pe timestamp sunt singura verificare reală (regula 15).

## 10. Bucla de calitate (docs/CALITATE.md)

- [✓] Pase 0–9 cu 25 de verificări, fiecare cu metoda și costul ei; adâncimi fast / standard / deep / final; verificările sărite și categoriile neevaluate sunt raportate (teste unitare și de integrare).
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
- [✓] Randarea se poate opri (semnalul ajunge la Remotion) și poate randa doar un interval de cadre, la scară redusă (pentru verificarea mișcării).
- [✓] Export final: doar cu „render final”, fără blocaje, cu mix „ok”, fără suprascriere. Pachetul de postare testat prin `mms post-pack`.
- [~] Exportul final propriu-zis nu a fost rulat pe proiectul demo: regula 6 cere ca utilizatorul să scrie „render final”. Poarta e testată.
- [!] Viteza de randare: ~2,5–3,5× durata reclamei pe acest laptop.

## 13. Studio (interfața locală)

- [✓] Proiecte, brief, materiale, research, brand, **Concept**, script, storyboard, **Preview & timeline cu editorul scenei**, audio, **Calitate**, critică, versiuni, export. Verificat cu Playwright: tab-urile noi se încarcă fără erori, iar o editare (+0,5 s) și undo rulează cap-coadă din interfață.
- [✓] Joburi cu etapă, progres, oprire, timeout pe tip, manifest pe disc și reluarea celor întrerupte (test de integrare).
- [✓] Protecții: doar 127.0.0.1, doar Host local, Origin local + antetul `X-MMS` pe cererile care modifică, tipuri de fișier permise și maximum 500 MB la încărcare (test de integrare).
- [~] Timeline-ul nu are tragere de clipuri cu mouse-ul: editarea se face din panoul scenei (operațiile reale), din storyboard, comenzi sau Claude.
- [✓] Remotion Studio pe un proiect sau pe catalog (`npm run remotion`).
- [!] Remotion Studio ascultă pe toate interfețele de rețea (limită a Remotion 4.0.534): pornește-l doar la nevoie.

## 14. Claude Code

- [✓] `CLAUDE.md`: regulile utilizatorului neschimbate, plus constituția de inginerie (bucla de calitate, legătura cu regulile 7 și 10, fără co-autori).
- [✓] `/make-ad`, `/fix-at`, `/add-effect`, `/new-version` folosesc doar comenzi `mms` care există și fluxul nou (intake, concept, adâncimi, `critique-pack`, `impact`).
- [~] Comenzile sunt instrucțiuni pentru Claude; nu au test automat.
- [✓] Fără atribuiri automate: `.claude/settings.json` le dezactivează; lint-ul refuză commit-urile noi cu trailere de co-autor.

## 15. Documentație

- [✓] README, ARHITECTURA, CALITATE, TESTARE, BIBLIOTECA / INVENTAR / SISTEM (generate din cod), DECIZII (1–68), DEPANARE, GLOSAR, LICENTE, FLUX, AUDIT (inițial + etapa aceasta), CHANGELOG, acest fișier.

## Ce lipsește, concret, și pasul următor

| | Ce | Pasul următor |
| --- | --- | --- |
| [ ] | Test pe o a doua aplicație reală (ordinea de construcție, pasul 10) | Rulează `/make-ad` pe un produs real ales de tine; rezultatul se compară cu produsul demo |
| [ ] | Reparația proiectului de test anterior (Spotify v5) | După testul pe a doua aplicație; proiectul nu e în acest repo |
| [ ] | Importul celor 96 de sunete din proiectul anterior | Ca materiale ale tale, după verificarea licenței (poarta de drepturi) |
| [ ] | Capturi pe mobil pentru formatele verticale (pe un site real, captura desktop e ilizibilă pe 9:16) | Captura și pe viewport mobil, iar compilatorul alege pe vertical captura mobilă a aceleiași pagini, cu zonele ei |
| [ ] | Spațierea brandului ca unitate în rețete; grila de coloane | `docs/INVENTAR.md`, design vizual |
| [ ] | Elementele P2/P3 lipsă (blend, anticipație, L-cut, iconițe, ambianță, compresie pe voce…) | `docs/INVENTAR.md`; doar când un proiect le cere |
| [~] | `install.sh`, vocile cu chei API, OCR pe macOS/Linux | Pe un Mac și cu chei reale |
| [~] | Revizuirea vizuală automată fără sesiune Claude Code | Doar dacă e nevoie; cere o cheie și trimiterea cadrelor în afară (decizia 45) |
