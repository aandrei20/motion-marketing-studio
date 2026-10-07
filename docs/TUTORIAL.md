# Tutorial și documentație – Motion Marketing Studio

Fiecare decizie din `PLAN.md`, explicată în cuvinte simple. Catalogul complet de efecte (cu toate elementele) este în `PLAN.md`; aici e varianta scurtă, pe categorii.

## Glosar

| Termen | Ce înseamnă |
| --- | --- |
| Repo | Folderul proiectului, pus pe GitHub ca backup și ca să-l instalezi pe orice calculator |
| Privat | Repo-ul îl vezi doar tu |
| Node | Programul care rulează codul JavaScript și TypeScript |
| TypeScript | Limbajul codului, cu verificări care prind greșelile devreme |
| Remotion | Face videoul din cod, cadru cu cadru |
| Playwright | Deschide un site și face capturi sau înregistrări reale |
| FFmpeg | Asamblează imaginea și sunetul în fișierul MP4 |
| Cheie API | Parolă pentru un serviciu extern (voce, muzică, căutare) |
| .env | Fișier doar pe calculatorul tău, unde stau cheile; nu ajunge niciodată online |
| Motor | Sistemul reutilizabil; reclamele sunt proiecte separate |
| Primitivă | Un efect de bază, reutilizabil (de exemplu zoom-ul) |
| Registry | Catalogul cu fișele tuturor efectelor, pe care Claude îl caută |
| Determinist | Același rezultat la fiecare randare, pe orice calculator |
| CC0 | Licență care permite folosirea liberă, fără credit |
| Hook | Primele 1–3 secunde, care opresc utilizatorul din derulat |
| CTA | Apelul la acțiune de la final („Încearcă gratuit”) |
| Manifest | Lista tuturor materialelor, cu sursa și drepturile fiecăruia |
| Punct de focus | Zona din captură pe care camera trebuie să o urmărească |
| Camera virtuală | O cameră simulată care se mișcă peste elementele poziționate într-un spațiu |
| Zonă de siguranță | Partea din cadru unde nimic important nu trebuie pus, pentru că platforma o acoperă |
| Match cut | Tăietură între două scene care se potrivesc ca formă sau poziție |
| Layout adapter | Regulă care reorganizează același conținut pentru alt format |
| TTS | Voce generată de calculator din text |
| Ducking | Muzica scade automat când vorbește vocea |
| LUFS | Volum perceput; −14 e standardul pentru platformele sociale |
| dBTP | Vârful semnalului; sub −1 nu apar distorsiuni |
| Cue sheet | Fișier unic cu momentul fiecărui efect vizual și sunetul lui |
| Timeline | Lista cu tot ce se întâmplă în reclamă și când |
| Contact sheet | Imagine cu multe cadre mici, pentru o privire rapidă |
| Smoke test | Randare scurtă de probă |
| Rubrică | Lista fixă de criterii după care se notează reclama |
| Skill | Un set de instrucțiuni pe care Claude le rulează cu o comandă scurtă |
| Animatic | Versiune rapidă a reclamei, doar pentru structură și ritm |
| Storyboard | Planul scenă cu scenă, cu cadre, durate și elemente |
| Commit | Un pas salvat în istoricul proiectului |
| Ramură (branch) | O copie de lucru separată, pentru o schimbare nouă |
| Etichetă (tag) | Un nume pus pe o versiune stabilă |
| Changelog | Jurnalul schimbărilor |
| Pre-commit | Verificare automată înainte ca un commit să fie salvat |

## Faza 0 – Repo și instalare

**Decizii luate**

1. Nume: `motion-marketing-studio`, repo privat pe GitHub.
2. Tehnologie: Node 20+, TypeScript strict, Remotion, Playwright, FFmpeg. Nimic altceva până nu cere un proiect real.
3. Instalare: întâi `install.ps1` (Windows), `install.sh` la final.
4. Comenzi: `npm run studio`, `npm run render`, `npm run doctor`, `npm test`.
5. Chei API doar în `.env`; fără chei, sistemul merge cu variante gratuite.
6. Licență: toate drepturile rezervate, schimbată dacă repo-ul devine public.
7. Folderul `projects/` e ignorat de Git: reclamele nu intră în repo, doar motorul.

**Ce face fiecare comandă**

| Comandă | Ce face | Când o rulezi |
| --- | --- | --- |
| `npm run studio` | Deschide previzualizarea în browser, la `http://localhost:3000` | Cât lucrezi la o reclamă |
| `npm run render` | Face MP4-ul final | Doar după ce scrii „render final” |
| `npm run doctor` | Verifică Node, Git, FFmpeg, Playwright și fișierul `.env`, apoi spune ce lipsește | După instalare și când ceva nu merge |
| `npm test` | Verifică dacă s-a stricat ceva în motor | După orice modificare a bibliotecii |

**Instalare pe un calculator nou (Windows)**

1. Instalezi Node și Git, apoi clonezi repo-ul.
2. Rulezi `install.ps1` în PowerShell.
3. Copiezi `.env.example` în `.env` și completezi cheile dorite (opțional).
4. Rulezi `npm run doctor`; când totul e verde, rulezi `npm run studio`.

## Faza 1 – Reguli permanente (CLAUDE.md)

CLAUDE.md e fișierul pe care Claude îl citește la începutul fiecărui proiect.

| # | Regulă | Pe scurt |
| --- | --- | --- |
| 1 | Footage real pentru interfață | Orice cadru cu aplicația vine dintr-o captură reală sau dintr-un fișier dat de tine |
| 2 | Elemente puse de Claude | Fundaluri, particule, grafică, stock fără chipuri: libere oricând, dacă îmbunătățesc videoul |
| 3 | Poarta de drepturi | Pentru materialele unui terț, Claude întreabă o singură dată dacă ai dreptul să le folosești |
| 4 | Fără produse în motor | Codul motorului nu conține nume de produse |
| 5 | Fără minciuni | Niciun preț, număr sau promisiune inventată; fiecare are sursă |
| 6 | Export cu acordul tău | MP4-ul final se face doar după „render final” |
| 7 | Calitatea înaintea timpului | Verificare până la 8/10 pe toate scenele |
| 8 | Stil banat | Text centrat implicit, fade generic, etichete în colț |
| 9 | Versiuni | Nimic nu suprascrie o versiune veche |

**Poarta de drepturi, în detaliu**

- Se aplică la logo-uri, fonturi, muzică, footage și capturi cu marca altcuiva.
- Claude întreabă „Ai dreptul să-l folosești?” o singură dată pe material.
- Da: materialul se folosește 100%, iar manifestul notează „drepturi confirmate de utilizator”.
- Nu sau nu știi: materialul apare doar într-un preview marcat „concept”, nu în varianta finală.
- Claude nu poate verifica dreptul, deci răspunderea rămâne la tine.

**Regula 7, în detaliu**

- Verificarea continuă până toate scenele ating 8/10.
- La fiecare 3 runde Claude îți arată progresul și decizi dacă mergem mai departe.
- Se oprește singură dacă două runde la rând nu aduc nicio îmbunătățire.
- Același reviewer și aceeași listă de criterii în toate rundele, ca scorurile să fie comparabile.

## Faza 2 – Captura de footage real

Rezultatul e un folder cu capturi și înregistrări, plus un manifest care spune de unde vine fiecare fișier.

| Pas | Ce se întâmplă | Detaliu |
| --- | --- | --- |
| 1 | Playwright deschide URL-ul | Screenshot-uri curate la 2x și înregistrări de 5–10 s la 60 fps: pagina de start, funcțiile principale, un clic sau o derulare |
| 2 | Autentificare (dacă produsul cere cont) | Te loghezi tu o dată în fereastra deschisă; sesiunea rămâne doar pe calculatorul tău; Claude nu vede parola |
| 3 | Manifest de materiale | Fiecare fișier are sursă: captură reală, dat de tine, generat sau stock, plus drepturile confirmate |
| 4 | Punct de focus | Zona importantă (buton, card) e marcată, ca să se știe unde se face zoom sau pan |
| 5 | Test de blocare | Un cadru „interfață” care nu e captură reală sau fișier dat de tine oprește exportul și spune care cadru e problema |
| 6 | Curățare | Fără date personale vizibile; dacă apar, sunt marcate, iar estomparea cere acordul tău |

Termeni noi: **2x** = captură de două ori mai mare decât ecranul, ca să rămână clară la zoom; **60 fps** = 60 de cadre pe secundă, mișcări mai fluide.

## Faza 3 – Research și brand

| Pas | Ce se întâmplă | Detaliu |
| --- | --- | --- |
| 1 | Surse | Site oficial, prețuri, documentație, blog sau changelog, pagina de ajutor; competitori doar când ajută |
| 2 | Dosar de research | Funcții, prețuri, public, promisiuni oficiale; fiecare cu link, dată și nivel de încredere (sigur, probabil, nesigur) |
| 3 | Fapte separate de creativitate | Întâi dosarul, apoi ideile; scriptul folosește doar fapte din dosar |
| 4 | Lista „de confirmat” | Cifrele sau prețurile fără sursă clară nu intră în video fără aprobarea ta |
| 5 | Brand | Culori exacte, fonturi, logo, colțuri, spațiere, ton și reguli oficiale de folosire a logo-ului |
| 6 | Fonturi | Dacă fontul oficial nu e disponibil legal, alternativă liberă apropiată, cu mențiune |
| 7 | Brief creativ | Ideea ta are prioritate; propunerile Claude sunt separate, marcate „sugestii” |
| 8 | Script | Hook, voce, text pe ecran, CTA și 2–3 variante alternative de hook |

## Faza 4 – Biblioteca de motion

Biblioteca e folderul `library/` din care Claude își ia toate efectele. Nu scrie animații de la zero: caută în catalog, alege ce se potrivește și compune scena.

| # | Decizie | Pe scurt |
| --- | --- | --- |
| 1 | Folder pe categorii | Cameră, text, tranziții, interfață, lumină, particule, distorsiuni, logo, date, sunete, șabloane de scene |
| 2 | Pe pachete | Pachetul 1 = esențialul (~40–60 elemente); următoarele completează; intră doar ce a fost randat și testat |
| 3 | Fișă per element | Ce face, parametri, sunet asociat, pe ce se aplică, exemplu |
| 4 | Sunet legat de imagine | Fiecare efect își declară sunetul în aceeași fișă |
| 5 | Sunete cu licență clară | Sintetizate de noi sau CC0; licența în registru; cele 96 din Spotify v5 se reutilizează |
| 6 | Catalog demo | Un proiect care arată și redă fiecare element |
| 7 | Registry | Claude caută după intenție, de exemplu „tranziție energică” |
| 8 | Reutilizare mai întâi | Ce lipsește se creează generic, se testează și se adaugă |
| 9 | Stare de calitate | tested, experimental, deprecated |
| 10 | Unelte noi doar la nevoie | GSAP, Three.js și altele, cu motiv scris |
| 11 | Determinism | Fiecare efect arată identic la fiecare randare |

## Catalog de elemente (varianta scurtă)

| Categorie | Elemente |
| --- | --- |
| 1. Cameră și mișcare | Zoom înainte/înapoi, pan și tilt, parallax, orbită ușoară, tremur de cameră, handheld, speed ramp, rack focus, motion blur, dolly zoom, focus automat, regula de continuitate |
| 2. 3D | Telefon/laptop 3D, stivă de ecrane, logo/text extrudat, obiecte stilizate, iluminare 3D, camere 3D, modele GLB, particule 3D, tranziții 3D |
| 3. Text | Pop cu overshoot, stagger, slam, mască, typewriter, tracking, blur in/out, glitch, marker, strikethrough, contur apoi umplere, shine, captions, text pe tot ecranul, contor, callouts, text pe traiectorie, text 3D |
| 4. Tranziții | Beat cut, match cut, whip pan, zoom through, push/slide, flash cut, blur transition, wipe cu mască, parallax handoff, glitch cut, light leak, speed-ramp, lichid, dezintegrare, tranziție 3D, tăietură cu tăcere; fără cadru negru |
| 5. Interfață și produs | Rame de dispozitiv, cursor, click, hover, scriere, scroll, drag and drop, notificări, spotlight, zoom pe detaliu, evidențiere, split screen, control viteză, cascadă de carduri, progres, comutator/butoane, glisor, siguranță TikTok |
| 6. Lumină, particule, textură | Glow, light sweep, rim light, vignetă, gradient animat, bokeh, god rays, neon, lens flare, gradare de culoare, grain, praf/scântei, confetti, dots/trails, forme plutitoare, ceață, fundal audio-reactiv, sticlă mată, umbre/reflexii, scanlines |
| 7. Distorsiuni, logo, date | Ripple, displacement, RGB split, valuri lichide, pixelare, zoom blur radial, fisheye; reveal, asamblare, split/morph, glint, puls, lockup, final cu hold, loop seam; bare, linii, contor, inel de progres, pie, comparație, clasament, linie de timp, stat tile, sparkline |
| 8. Sunet | Efecte de interfață, whoosh, riser, impact, sub-drop, stinger, glitch, tape-stop, record scratch, tăcere intenționată, pop/slam, tick, sunet de logo, ambianță, muzică cu secțiuni și stem-uri, voci, lanț de voce, ducking, țintă −14 LUFS, beat grid |
| 9. Șabloane de scene | Hook-uri (pattern interrupt, întrebare, afirmație, problemă, înainte/după, POV, teaser, început în tăcere); scene (problemă, revelare, funcție, montaj, cum funcționează, walkthrough, dovadă, transformare, comparație); final (ofertă, card final cu hold, buclă); structuri (15 s, 30 s, 45–60 s, problemă → soluție, parada funcțiilor, demonstrație, lansare, mărturie) |

**Limite 3D:** arată foarte bine stilizat; fotorealismul de film nu se atinge din cod; randarea e mai lentă decât în 2D; animațiile Blender se pot folosi ca fișiere video date de tine.

## Faza 5 – Orientare în spațiu și ritm

Regulile care fac ca reclama să aibă sens vizual, nu să pară o suită de slide-uri.

| # | Decizie | Pe scurt |
| --- | --- | --- |
| 1 | Lume cu cameră virtuală | Capturile stau într-un spațiu mare; camera se mută între ele |
| 2 | Focus și direcție | Un lucru important și o direcție pe scenă; tăietura următoare o continuă |
| 3 | Continuitate | Elementul important rămâne în aceeași zonă între scene |
| 4 | Zone TikTok | Text și butoane rămân departe de marginile unde TikTok pune controale |
| 5 | Timp de citire | Minimum 1 s la 3 cuvinte; card final 2,5–3 s fără mișcare |
| 6 | Un mesaj pe moment | Restul îl susține |
| 7 | Durata scenei | Decisă de informație, voce și ritm |
| 8 | Multi-format | 9:16, 1:1 și 16:9 din același conținut |

## Faza 6 – Audio

| # | Decizie | Pe scurt |
| --- | --- | --- |
| 1 | Voce | Vocea ta, apoi TTS de calitate, apoi voce gratuită de rezervă |
| 2 | Limba | Aleasă de utilizator în întrebările de început, fără implicit |
| 3 | Muzică | A ta (cu poarta de drepturi), biblioteci cu licență clară, sau sintetizată |
| 4 | Beat grid | BPM și secțiuni mapate pe timeline; tăieturi pe ritm |
| 5 | Cue sheet | Fiecare moment vizual își declară sunetul |
| 6 | Mix automat | Ducking 500 ms, −14 LUFS, vârf ≤ −1 dBTP, fără tăcere nedorită peste 1 s |
| 7 | Licențe | Registru; exportul se oprește dacă lipsește una |
| 8 | Ascultare | O faci tu, după fiecare preview; notele merg pe timestamp |

## Faza 7 – Timeline, preview și verificări

| # | Decizie | Pe scurt |
| --- | --- | --- |
| 1 | Timeline declarativ | Un fișier descrie tot; randarea citește doar el |
| 2 | Modificări naturale | „La secunda 14 un push-in” schimbă doar acel element |
| 3 | Validare înainte de randare | Referințe lipsă, fonturi, codecuri, drepturi, footage real |
| 4 | Randare de probă | Câteva secunde, ca să vedem dacă proiectul se construiește |
| 5 | Preview | Studio, contact sheet la 2 cadre/s, cadre critice |
| 6 | Verificări tehnice | Zone de siguranță, depășiri, cadre negre, flash-uri, test 360 px, determinism, audio |
| 7 | Critică creativă | Rubrică fixă, scoruri 1–10, prag 8, același reviewer |
| 8 | Ascultarea ta | Note pe timestamp după fiecare preview |
| 9 | Corecții pe timestamp | Se repară doar zonele notate, apoi re-verificare |
| 10 | Aprobare și versiuni | Export doar la „render final”; versiunile se păstrează |

## Faza 8 – Formate

| Decizie | Pe scurt |
| --- | --- |
| Preseturi | 9:16 (1080×1920), 4:5 (1080×1350), 1:1 (1080×1080), 16:9 (1920×1080), 4K vertical (2160×3840), personalizat |
| FPS | 30 implicit; 24, 25, 50, 60 la cerere |
| Durată | 15, 30, 45, 60 s sau oricât |
| Layout adapters | Aceeași reclamă se aranjează automat per format |
| Zone de siguranță | Reguli separate pentru TikTok, Reels, Shorts |
| Buclă TikTok | Ultimul cadru se leagă de primul |

## Faza 9 – Comanda `/make-ad`

`/make-ad` e comanda care pornește tot procesul. O scrii în Claude Code, nu în PowerShell.

| # | Decizie | Pe scurt |
| --- | --- | --- |
| 1 | Un singur punct de pornire | `/make-ad <url> "viziunea mea"` rulează tot fluxul până la preview |
| 2 | Întreabă o singură dată | Obiectiv, public, platformă, durată, format, materiale, drepturi |
| 3 | Se oprește la preview | Nu exportă fără „render final” |
| 4 | Comenzi ajutătoare | `/fix-at` (corecții pe timestamp), `/add-effect` (efect nou cu fișă și test), `/new-version` (pornește v2 fără să atingă v1) |

## Faza 10 – Git și dezvoltare în timp

| # | Decizie | Pe scurt |
| --- | --- | --- |
| 1 | Commit-uri mici | Fiecare schimbare e un pas separat cu mesaj clar |
| 2 | Etichete pe versiuni | v0.1, v0.2…; fiecare etichetă înseamnă „asta merge” |
| 3 | Ramuri | `main` stabil; funcții noi pe ramuri separate |
| 4 | Teste | La fiecare modificare a bibliotecii; un test care pică oprește schimbarea |
| 5 | Changelog | Ce s-a adăugat sau schimbat la fiecare versiune |
| 6 | Experimental | Nu devine implicit fără teste |
| 7 | Secrete | Chei doar în `.env`; pre-commit blochează orice cheie |
| 8 | Proiecte separate | `projects/` ignorat sau într-un repo separat |
| 9 | Documentație vie | README, CLAUDE.md, tutorial actualizate |
| 10 | Backup | Repo privat pe GitHub + copii locale înainte de modificări mari |

## Faza 11 – Întrebările de la început

`/make-ad` pune toate întrebările înainte să lucreze. Răspunsurile devin brief-ul, iar lucrul începe doar după „aprob”.

| Grup | Ce se întreabă |
| --- | --- |
| A. Produs și obiectiv | Nume și URL, fișiere, tip de produs, obiectiv, public, apel la acțiune cu sursă, interdicții |
| B. Platformă și format | Platforme, format și rezoluție, durată și FPS, bucla TikTok |
| C. Poveste și creativ | Povestea ta sau 3 concepte, ideile tale de hook, structură, ton, ritm, chipuri sau nu, stil vizual, nivel de efecte, 3D, referințe |
| D. Materiale și footage real | Ce ai deja, autentificare, funcții de arătat, date personale, drepturi pe materialele altora |
| E. Text și limbă | Limba textului, limba vocii, subtitrări, fonturi și culori, cifre cu sursă |
| F. Audio | Voce, muzică, audio-ul tău (moment și mod), efecte sonore, tăcere intenționată |
| G. Livrare | Pachet de postare (opțional), variante de hook (opțional), previewuri, mod de preview, efort și buget |
| H. Confirmare | Rezumatul planului; începe doar după „aprob” |

## Faza 12 – Instalare completă dintr-o dată

| Decizie | Pe scurt |
| --- | --- |
| Un singur script | `install.ps1` instalează tot: Node, Git, FFmpeg, Playwright, Remotion, Three.js, Python cu bibliotecile de audio, fonturi, voci TTS gratuite |
| Nimic în timpul lucrului | Dacă lipsește ceva, Claude se oprește și îți spune să rulezi instalarea |
| Doctor | `npm run doctor` blochează `/make-ad` dacă lipsește ceva sau nu e destul spațiu pe disc |
| Dependențe noi | Intră în script și în `doctor`; `npm run update` le instalează dintr-o dată |
| Sisteme | Windows primul; Mac și Linux mai târziu |

## Faza 13 – Documentație

| Fișier | Ce conține |
| --- | --- |
| `README_ce_este.md` | Ce e aplicația și cum funcționează |
| `README_instalare.md` | Instalare pas cu pas; fiecare comandă etichetată „PowerShell” sau „Claude Code” |
| `README_flux.md` | Fluxul utilizatorului, de la prima comandă până la MP4 |
| `GHID_efecte.md` | Catalogul de efecte |
| `DEPANARE.md` | Probleme frecvente și soluții |
| `GLOSAR.md` | Termenii, în cuvinte simple |

Toată documentația este doar în română.

## Faza 14 – Platforme și livrare

| Decizie | Pe scurt |
| --- | --- |
| Platforme | TikTok, Instagram Reels, YouTube Shorts, YouTube 16:9, feed Instagram/Facebook, LinkedIn, X |
| Specificații | Cercetate cu sursă și dată la fiecare construcție |
| Subtitrări | Arse în video (opțional) și fișier `.srt`, în limba aleasă |
| Pachet de postare | Opțional: copertă, titlu, descriere, hashtag-uri |
| Variante de hook | Opțional: 2–3, randate doar pentru primele secunde |

## Faza 15 – Referințe și materialele tale

| Decizie | Pe scurt |
| --- | --- |
| Povestea ta și hook-urile tale | Păstrate cuvânt cu cuvânt; Claude le dezvoltă doar după aprobare |
| Videouri de referință | Le dai ca fișiere; se extrage un profil de stil (ritm, tăieturi pe secundă, text, structură, sunet); nu se copiază |
| Audio propriu | Alegi fișierul, momentul, modul (întreg, tăiat, sub voce) și ce nu se schimbă |
| Brand kit | Salvat pe produs, reutilizat |

## Faza 16 – Continuitate și răspundere

| Decizie | Pe scurt |
| --- | --- |
| `STATE.md` | Actualizat după fiecare pas; reiei exact de unde ai rămas |
| Buget de tokeni | Estimare pe etapă și bilanț la fiecare 3 runde |
| Locație | Motorul și proiectele în `C:\dev\`, în afara OneDrive |
| Răspundere | Fiecare utilizator răspunde de drepturile și de conținutul reclamelor lui; fără notă automată de „concept” |

## Ordinea de construcție

1. Repo, instalare și doctor (Faza 0).
2. CLAUDE.md, reguli și registru de licențe (Faza 1).
3. Captură Playwright, manifest și test de footage real (Faza 2).
4. Motorul: timeline, validare, preview, randare de probă (Faza 7).
5. Registry, fișă standard de element și catalog demo (Faza 4).
6. Efectele pe pachete: esențialul din fiecare categorie, apoi restul.
7. Audio: cue sheet, beat grid, mix, licențe (Faza 6).
8. Zone de siguranță și multi-format (Faze 5 și 8).
9. `/make-ad` și comenzile ajutătoare (Faza 9).
10. Test pe o a doua aplicație; apoi repară Spotify v5.
