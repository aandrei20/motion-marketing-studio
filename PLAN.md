# PLAN – Motion Marketing Studio

Planul complet, discutat și aprobat punct cu punct. Bifat `[x]` = decis. Explicațiile în cuvinte simple sunt în `docs/TUTORIAL.md`.

## Verdict

Direcția e corectă și blueprintul e solid: se construiește un studio reutilizabil, nu un generator de clipuri. Pentru ca să funcționeze, se pornește mic, se adaugă regula de footage real și se testează pe un al doilea produs înainte de extindere.

- **Ce e bun:** motor independent de produs, CLAUDE.md + registry de capabilități, approval gate înainte de export, flux clone → install → .env → studio.
- **Ce lipsea:** regula de footage real pentru interfață; faza de captură cu Playwright; ascultarea umană ca pas obligatoriu (recenzenții AI văd doar cadre statice); limită de bucle și un singur reviewer constant.
- **Ce era riscant:** structura de peste 40 de foldere construită dinainte duce la cod mort. Biblioteca se construiește pe pachete testate.
- **Ce s-a învățat din Spotify v5:** cue sheet unic pentru imagine și sunet, margini de siguranță pentru TikTok, scenele cu scor sub 7 se repară pe timestamp, nu se reface tot filmul.

---

## Faza 0 – Repo și instalare

- [x] Repo nou `motion-marketing-studio`, separat de proiectul Spotify, privat pe GitHub
- [x] `.gitignore`: `node_modules/`, `out/`, `*.mp4`, `.env`, `projects/`, capturi cu drepturi de autor
- [x] `package.json` cu scripturi: `studio`, `render`, `doctor`, `test`, `update`
- [x] `install.ps1` (Windows) și, mai târziu, `install.sh`: verifică și instalează Node, Git, FFmpeg, Playwright
- [x] `npm run doctor`: spune exact ce lipsește
- [x] `.env.example` pentru chei opționale (TTS, muzică, research)
- [x] `README.md`: clone → install → .env → studio, plus depanare
- [x] Licență: toate drepturile rezervate; se schimbă dacă repo-ul devine public

Tehnologie: Node 20+, TypeScript strict, Remotion, Playwright, FFmpeg. Nimic altceva până nu cere un proiect real.

## Faza 1 – Reguli permanente (CLAUDE.md)

- [x] Interfața produsului vine doar din captură reală sau fișier dat de utilizator; nu se redesenează și nu se inventează
- [x] Elementele puse de Claude (fundal, particule, grafică, stock fără chipuri) sunt libere dacă îmbunătățesc videoul
- [x] Poarta de drepturi: pentru orice material al unui terț, Claude întreabă o dată „Ai dreptul să-l folosești?”; da → folosit 100% și notat în manifest; nu/nesigur → doar în preview marcat „concept”
- [x] Niciun nume de produs hardcodat în motor
- [x] Fără claim-uri, prețuri sau statistici inventate; fiecare are sursă
- [x] Fără render final până nu scrii „render final”
- [x] Calitatea înaintea timpului: critică până toate scenele ating 8/10, bilanț cu utilizatorul la fiecare 3 runde, oprire după 2 runde fără progres, același reviewer și aceeași rubrică
- [x] Stil banat: text centrat implicit, fade generic, etichete în colț (permise doar ca alegere conștientă)
- [x] Nicio versiune finală nu suprascrie una veche (v1, v2, approved, final)

## Faza 2 – Captură de footage real

- [x] Modul Playwright: intră pe URL, face screenshot-uri curate (2x) și înregistrări de 5–10 s la 60 fps ale fluxurilor principale
- [x] Autentificare făcută de utilizator în fereastra deschisă (fără CAPTCHA automat); sesiunea se salvează doar local
- [x] Manifest de materiale cu sursă: `real_capture | user_provided | generated | stock`, plus confirmarea drepturilor
- [x] Punct de focus marcat per captură, pentru zoom și pan
- [x] Test care blochează exportul dacă un cadru „interfață” nu e captură reală sau fișier dat de utilizator
- [x] Fișiere procesate corect: rezoluție, fps, upscale doar marcat, fără chipuri de persoane celebre
- [x] Date personale vizibile (nume, email, cont) marcate; estomparea doar cu acordul utilizatorului

## Faza 3 – Research și brand

- [x] Surse în ordine: site oficial, prețuri, documentație, blog/changelog, pagina de ajutor; competitori doar când ajută mesajul
- [x] Dosar de research structurat: funcții, prețuri, public țintă, promisiuni oficiale, fiecare cu link, dată și nivel de încredere
- [x] Faptele sunt separate de creativitate: scriptul folosește doar fapte din dosar
- [x] Lista „de confirmat”: cifrele sau prețurile fără sursă clară nu intră în video fără aprobarea utilizatorului
- [x] Extragere brand: culori exacte, fonturi, logo, colțuri, spațiere, ton, reguli oficiale de logo
- [x] Fonturi cu licență verificată; alternativă liberă apropiată dacă fontul oficial lipsește, cu mențiune
- [x] Brief creativ: ideea utilizatorului are prioritate; propunerile Claude apar separat, marcate „sugestii”
- [x] Script: hook, voce, text pe ecran, CTA și 2–3 variante alternative de hook

## Faza 4 – Biblioteca de motion

- [x] Folder `library/` cu tot ce poate folosi Claude, pe categorii: cameră, text, tranziții, interfață, lumină, particule, distorsiuni, logo, date/grafice, sunete, șabloane de scene
- [x] Construcție pe pachete: Pachetul 1 = esențialul din fiecare categorie (~40–60 elemente), următoarele completează până acoperim tot; un element intră doar după randare și test
- [x] Fișă per element: ce face, parametri, sunet asociat, pe ce se aplică, exemplu
- [x] Sunetul vine cu imaginea: fiecare efect vizual are sunetul declarat în aceeași fișă
- [x] Sunete cu licență clară (sintetizate de noi sau CC0), licența notată în registru; cele 96 din Spotify v5 se reutilizează
- [x] Catalog vizual și audio: proiect demo care arată și redă fiecare element
- [x] Registry: Claude caută după intenție și găsește elementul potrivit
- [x] Reutilizare mai întâi; dacă lipsește ceva, se creează unul generic, testat, și se adaugă
- [x] Stare de calitate: `tested`, `experimental`, `deprecated`
- [x] Unelte noi (GSAP, Three.js) doar când un efect cere asta, cu motiv scris
- [x] Determinism: fiecare efect arată identic la fiecare randare

### Catalog de elemente

**Categoria 1 – Cameră și mișcare**

- [x] Zoom înainte / înapoi (push-in, pull-out) spre un punct de focus
- [x] Pan și tilt peste o captură mare
- [x] Parallax: straturi cu viteze diferite, pentru adâncime
- [x] Orbită ușoară în jurul unui obiect
- [x] Tremur de cameră (shake): mic, mediu, puternic
- [x] Handheld: mișcare fină continuă, ca de cameră reală
- [x] Speed ramp: viteza se schimbă brusc pe moment
- [x] Rack focus simulat: focusul trece de la un element la altul
- [x] Motion blur pe orice mișcare rapidă
- [x] Dolly zoom (efect „vertigo”), folosit rar
- [x] Camera urmărește automat punctul de focus marcat în captură
- [x] Regulă de continuitate: tăietura următoare continuă direcția mișcării anterioare

**Categoria 2 – 3D (Three.js)**

- [x] Telefon sau laptop 3D care se rotește, se înclină sau plutește, cu captura reală pe ecran
- [x] Stivă de ecrane în adâncime; camera trece printre ele
- [x] Logo sau text extrudat 3D, cu lumină și reflexii
- [x] Obiecte simple stilizate generate din cod: cuburi, sfere, discuri, bare de egalizator, valuri
- [x] Iluminare 3D: lumini colorate, umbre, rim light, reflexii
- [x] Camere 3D: orbită completă, trecere prin scenă, zoom pe obiect
- [x] Modele 3D gata făcute (GLB), cu licență confirmată prin poarta de drepturi
- [x] Particule 3D: puncte, scântei, fire de lumină
- [x] Tranziții 3D: ecranul se răsucește sau se rupe în bucăți

Limite 3D: arată foarte bine stilizat; fotorealismul de film nu se atinge din cod; randarea e mai lentă decât în 2D; animațiile Blender se pot folosi ca fișiere video date de utilizator.

**Categoria 3 – Text**

- [x] Pop cu overshoot
- [x] Apariție pe cuvinte sau litere (stagger)
- [x] Slam: textul cade cu impact și tremur
- [x] Mască (mask reveal): textul iese de sub o linie
- [x] Typewriter, cu cursor
- [x] Tracking: spațierea literelor se strânge sau se deschide
- [x] Blur in / out
- [x] Glitch: text rupt, cu dungi colorate
- [x] Subliniere sau evidențiere pe cuvânt (marker)
- [x] Tăiere (strikethrough) pe un cuvânt
- [x] Contur apoi umplere
- [x] Strălucire (shine) peste text sau logo
- [x] Subtitrări cuvânt cu cuvânt, stil TikTok, cuvântul curent evidențiat
- [x] Text pe tot ecranul: un cuvânt uriaș pentru un moment mare
- [x] Contor care numără (300M, 99+, procente), cu sunet
- [x] Etichete și bule (callouts) cu săgeată sau cerc spre un element din captură
- [x] Text pe traiectorie (curbă sau linie)
- [x] Text 3D extrudat, pentru titluri mari

**Categoria 4 – Tranziții**

- [x] Tăietură pe ritm (beat cut): schimbarea cade pe bătaia muzicii
- [x] Match cut: scena nouă începe cu un element asemănător ca formă sau poziție
- [x] Whip pan: mișcare rapidă și estompată spre scena următoare
- [x] Zoom through: camera intră într-un element (ecranul telefonului) și iese în scena nouă
- [x] Push și slide
- [x] Flash cut: fulger alb scurt (maximum 2 pe secundă)
- [x] Blur transition
- [x] Wipe cu mască: cerc, bandă sau logo dezvăluie scena nouă
- [x] Parallax handoff: straturile ies și intră în direcții opuse
- [x] Glitch cut de 2–4 cadre
- [x] Light leak: lumină caldă care acoperă tăietura
- [x] Speed-ramp transition
- [x] Lichid sau ondulare
- [x] Dezintegrare în particule
- [x] Tranziție 3D (răsucire sau rupere)
- [x] Tăietură cu tăcere: sunetul se oprește exact la schimbarea scenei
- [x] Regulă: niciodată cadru negru între scene; fade-ul generic e interzis

**Categoria 5 – Interfață și produs** (straturi peste capturi reale, nu redesenare)

- [x] Ramă de telefon, laptop și browser (2D), fără marcă de producător
- [x] Cursor animat, cu accelerare și încetinire naturale
- [x] Click cu undă și sunet de click
- [x] Hover: elementul se luminează
- [x] Scriere într-un câmp, literă cu literă, cu sunet de tastă
- [x] Derulare fluidă (scroll) cu viteză controlată
- [x] Drag and drop
- [x] Notificări și toast-uri cu sunet
- [x] Spotlight: restul ecranului se întunecă
- [x] Zoom pe detaliu, cu contur pe sursă
- [x] Contur sau cerc de evidențiere cu animație de desenare
- [x] Split screen / înainte și după, cu separator care glisează
- [x] Redare video cu control al vitezei (accelerat, încetinit, înghețat)
- [x] Cascadă de carduri
- [x] Progres și încărcare, cu sunet la final
- [x] Comutator și butoane: animația de apăsare
- [x] Glisor cu valoare care se schimbă
- [x] Ramă de dispozitiv cu siguranță TikTok (controalele deasupra barei de jos)

**Categoria 6 – Lumină, particule și textură**

- [x] Glow / bloom
- [x] Light sweep: dungă de lumină peste un element
- [x] Rim light pe marginea obiectelor
- [x] Vignetă ușoară
- [x] Fundal gradient animat, în culorile brandului
- [x] Bokeh
- [x] Raze de lumină (god rays)
- [x] Neon cu puls
- [x] Lens flare subtil, folosit rar
- [x] Gradare de culoare: duotone în culorile brandului și tratamente neutre
- [x] Grain și zgomot fin de film
- [x] Particule de praf și scântei
- [x] Confetti și explozii (bursts)
- [x] Puncte cu urme (dots, trails)
- [x] Forme geometrice plutitoare
- [x] Ceață și fum
- [x] Fundal audio-reactiv: bare, valuri sau cercuri după muzică
- [x] Sticlă mată (frosted glass)
- [x] Umbre de contact și reflexii pe suprafețe lucioase
- [x] Scanlines / CRT, folosit rar

**Categoria 7 – Distorsiuni, logo și date**

*Distorsiuni*

- [x] Ondulare (ripple)
- [x] Displacement după o hartă de zgomot
- [x] Aberație cromatică / RGB split
- [x] Valuri lichide
- [x] Pixelare (mosaic)
- [x] Zoom blur radial
- [x] Lentilă (fisheye)

*Logo*

- [x] Reveal cu pop și sunet
- [x] Asamblare din piese
- [x] Split / morph
- [x] Glint și shine
- [x] Puls cu glow
- [x] Lockup logo + text, conform regulilor oficiale
- [x] Final cu hold suficient pentru citire
- [x] Loop seam: ultimul cadru se leagă de primul

*Date și grafice*

- [x] Bare și linii animate, cu sunet
- [x] Contor mare
- [x] Inel de progres și gauge
- [x] Grafic circular (pie)
- [x] Comparație a două valori
- [x] Clasament cu schimbare de locuri
- [x] Linie de timp
- [x] Stat tile: cifră mare + etichetă
- [x] Sparkline

**Categoria 8 – Sunet**

*Efecte de interfață*

- [x] Click, tap, comutator, swipe
- [x] Scriere la tastatură
- [x] Pop-uri și notificări
- [x] Succes (chime), eroare, încărcare terminată

*Tranziții și impact*

- [x] Whoosh (scurt, lung, rapid), swipe
- [x] Riser și downlifter
- [x] Impact, boom și sub-drop
- [x] Stinger pe momente cheie
- [x] Glitch și tape-stop
- [x] Record scratch
- [x] Tăcere intenționată cu reintrare puternică

*Text și grafice*

- [x] Pop și slam pentru text
- [x] Tick pentru contoare și bare
- [x] Sunet de logo (reveal, glint, final)

*Ambianță*

- [x] Fundaluri de realism: mulțime, oraș, cameră, vânt, ploaie

*Muzică*

- [x] Fundaluri muzicale pe stil și dispoziție, cu BPM și secțiuni marcate (intro, build, drop, outro)
- [x] Stem-uri separate: tobe, bas, melodie
- [x] Loop-uri și stinger-e de început și de final
- [x] Muzica utilizatorului are prioritate, cu poarta de drepturi

*Voce*

- [x] Mai multe voci și stiluri (TTS), plus vocea utilizatorului
- [x] Lanț de procesare pentru voce: egalizare, compresie, claritate pe difuzor de telefon

*Mix*

- [x] Ducking: muzica scade sub voce, rampă de 500 ms
- [x] Țintă −14 LUFS, vârf ≤ −1 dBTP, fără tăcere nedorită peste 1 secundă
- [x] Beat grid: BPM, tact și secțiuni mapate pe timeline

**Categoria 9 – Șabloane de scene și structuri de reclamă**

*Hook-uri*

- [x] Pattern interrupt: o reclamă falsă întrerupe, apoi tăcere
- [x] Întrebare directă
- [x] Afirmație îndrăzneață (cifră sau promisiune oficială)
- [x] Problema în față
- [x] Înainte și după
- [x] POV: privirea utilizatorului
- [x] Teaser cu numărătoare
- [x] Început în tăcere, sunetul intră cu impact

*Scene*

- [x] Problema: montaj de frustrare sau cifră care doare
- [x] Revelarea produsului (logo sau dispozitiv)
- [x] Funcție în prim-plan: un singur mesaj pe o captură reală
- [x] Montaj de funcții: 3–5 tăieturi rapide pe ritm
- [x] Cum funcționează: 3 pași
- [x] Demonstrație (walkthrough) cu cursor și zoom
- [x] Dovadă: cifră oficială cu sursă, citate reale, premii
- [x] Transformare înainte / după
- [x] Comparație cu o alternativă generică, fără a numi mărci fără drept

*Final*

- [x] Card de ofertă cu preț și condiții verificate
- [x] Card final cu hold, fără mișcare la momentul deciziei
- [x] Bucla TikTok: finalul se leagă de început

*Structuri complete*

- [x] Teaser 15 s
- [x] Standard 30 s
- [x] Poveste 45–60 s
- [x] Problemă → soluție
- [x] Parada funcțiilor
- [x] Demonstrație pas cu pas
- [x] Anunț de lansare
- [x] Stil „mărturie”, doar cu citate reale

## Faza 5 – Orientare în spațiu și ritm

- [x] Lume cu cameră virtuală: pan, zoom, parallax între elemente, nu slide-uri în șir
- [x] Un punct de focus și o direcție de mișcare pe scenă; tăietura următoare continuă direcția
- [x] Continuitate de poziție între scene (match cut)
- [x] Zone de siguranță TikTok calculate automat per format (pornind de la v5: 160 px dreapta, telefoane deasupra barei de jos)
- [x] Timp de citire: minimum 1 s la 3 cuvinte, minimum 0,8 s; card final minimum 2,5–3 s fără mișcare
- [x] Un mesaj principal pe moment; elementele secundare îl susțin
- [x] Durata scenei decisă de informație, voce și ritm, nu de un șablon fix
- [x] Același conținut în 9:16, 1:1 și 16:9, prin layout adapters

## Faza 6 – Audio

- [x] Voce, în ordine: vocea utilizatorului, TTS de calitate (cheie API opțională), voce gratuită de rezervă
- [x] Limba vocii: aleasă de utilizator în întrebările de început, fără implicit
- [x] Muzică, în ordine: a utilizatorului (cu poarta de drepturi), biblioteci cu licență clară, sintetizată de noi
- [x] Beat grid: BPM și secțiuni mapate pe timeline, tăieturi pe ritm
- [x] Cue sheet unic: fiecare moment vizual își declară sunetul
- [x] Mix automat: ducking 500 ms, −14 LUFS, vârf ≤ −1 dBTP, fără tăcere nedorită peste 1 s, verificat la fiecare randare
- [x] Registru de licențe; exportul se oprește dacă lipsește una
- [x] Ascultare obligatorie de către utilizator, cu note pe timestamp

## Faza 7 – Timeline, preview și verificări

- [x] Timeline declarativ: un fișier descrie tot (element, start, durată, strat, parametri, rol); randarea citește doar acest fișier
- [x] Modificări în limbaj natural afectează doar elementul vizat
- [x] Validare înainte de randare: referințe lipsă, fonturi, codecuri, poarta de drepturi, regula de footage real
- [x] Randare de probă scurtă (câteva secunde)
- [x] Preview în Studio, contact sheet la 2 cadre/secundă și cadre critice (hook, tranziții, card final, ultimul cadru)
- [x] Verificări tehnice automate: zone de siguranță, depășiri, cadre negre, maximum 2 flash-uri/s, test 360 px, determinism, audio fără clipping
- [x] Critică creativă cu rubrică fixă (hook, claritate, ritm, ierarhie, varietate, brand, CTA), scoruri 1–10, prag 8, același reviewer
- [x] Ascultarea utilizatorului după fiecare preview, cu note pe timestamp
- [x] Corecții pe timestamp, fără refacerea întregului film, apoi re-verificare
- [x] Export final doar la „render final”; fiecare versiune se păstrează

## Faza 8 – Multi-format

- [x] Preseturi: 9:16 (1080×1920), 4:5, 1:1, 16:9, 4K vertical și personalizat; FPS 30 implicit (24, 25, 50, 60 la cerere); durată 15/30/45/60 s sau oricât
- [x] Layout adapters: aceeași reclamă se aranjează automat per format, cu zone de siguranță separate pentru TikTok, Reels și Shorts
- [x] Bucla TikTok: ultimul cadru se leagă de primul

## Faza 9 – Comanda `/make-ad`

- [x] `/make-ad <url> "viziunea mea"` rulează tot fluxul: intake → captură → research → script → storyboard → animatic → producție → critică → preview
- [x] Întreabă o singură dată, la început, tot ce lipsește (obiectiv, public, platformă, durată, format, materiale, drepturi), apoi lucrează singur
- [x] Se oprește la preview; nu exportă fără „render final”
- [x] Comenzi ajutătoare: `/fix-at` (corecții pe timestamp), `/add-effect` (efect nou cu fișă și test), `/new-version` (pornește v2 fără să atingă v1)

## Faza 10 – Git și dezvoltare în timp

- [x] Commit-uri mici, cu mesaj clar
- [x] Etichete pe versiuni stabile (v0.1, v0.2…)
- [x] `main` mereu stabil; funcții noi pe ramuri separate, unite doar după teste
- [x] Teste la fiecare modificare a bibliotecii: randare de probă, determinism, validare fișe; un test care pică oprește schimbarea
- [x] Changelog cu ce s-a adăugat sau schimbat la fiecare versiune
- [x] Componentele experimentale nu devin implicite fără teste
- [x] Chei API doar în `.env`; test de pre-commit blochează orice cheie
- [x] `projects/` separat de motor (ignorat de Git sau repo separat)
- [x] Documentație vie: README, CLAUDE.md și tutorialul actualizate; fișa unui efect nou există din start
- [x] Backup: repo privat pe GitHub + copii locale înainte de modificări mari

## Faza 11 – Întrebările de la început (intake complet)

- [x] Regulă: Claude pune toate întrebările, cu variante de ales, înainte să lucreze; răspunsurile devin brief-ul; lucrul începe doar după „aprob”
- [x] A. Produs și obiectiv: nume și URL, fișiere (logo, capturi, brand guide), tip de produs, obiectiv, public, apel la acțiune cu ofertă și sursă, ce nu se spune sau arată
- [x] B. Platformă și format: platforme (alegere multiplă), format și rezoluție pe platformă, durată și FPS, bucla TikTok
- [x] C. Poveste și creativ: povestea utilizatorului sau 3 concepte propuse, ideile lui de hook, structură, ton, ritm, cu sau fără chipuri, stil vizual, nivel de efecte și efecte interzise, 3D permis, videouri de referință
- [x] D. Materiale și footage real: ce există deja, ce face sistemul, autentificare, funcții de arătat în ordinea importanței, date personale în capturi, materialele altora și dreptul de folosire
- [x] E. Text și limbă: limba textului, limba vocii, subtitrări, fonturi și culori, cifre cu sursă
- [x] F. Audio: voce (a utilizatorului, TTS, fără), muzică (a utilizatorului, bibliotecă, sintetizată, fără), audio-ul utilizatorului cu moment și mod de folosire, densitatea efectelor sonore, tăcere intenționată
- [x] G. Livrare: pachet de postare (opțional), variante de hook (opțional: 0, 2 sau 3), număr de previewuri, mod de preview, nivel de efort și buget de tokeni
- [x] H. Confirmare: rezumatul planului și aprobarea utilizatorului înainte de orice lucru

## Faza 12 – Instalare completă dintr-o dată

- [x] Un singur script (`install.ps1`) instalează tot: Node, Git, FFmpeg, Playwright cu browserul lui, Remotion, Three.js, Python cu bibliotecile de audio, fonturi și voci TTS gratuite
- [x] Nimic nu se instalează în timpul unui proiect sau al randării; dacă lipsește ceva, Claude se oprește și spune să se ruleze instalarea
- [x] `npm run doctor` verifică tot înainte de `/make-ad` și blochează pornirea dacă lipsește ceva, inclusiv spațiul liber pe disc
- [x] Dependențele noi apărute ulterior intră în script și în `doctor`; `npm run update` le instalează dintr-o dată
- [x] Windows primul; Mac și Linux mai târziu, prin `install.sh`

## Faza 13 – Documentație (doar în română)

- [x] `README_ce_este.md`: ce e aplicația și cum funcționează
- [x] `README_instalare.md`: instalare pas cu pas pentru începători; fiecare comandă etichetată „PowerShell” sau „Claude Code”
- [x] `README_flux.md`: fluxul utilizatorului, de la prima comandă până la MP4
- [x] `GHID_efecte.md` (catalogul), `DEPANARE.md` (probleme frecvente), `GLOSAR.md` (termeni)
- [x] Fără regulă de traducere în engleză
- [x] Documentația se actualizează odată cu fiecare funcție nouă

## Faza 14 – Platforme și livrare

- [x] Platforme la alegere: TikTok, Instagram Reels, YouTube Shorts, YouTube 16:9, feed Instagram/Facebook, LinkedIn, X
- [x] Specificațiile fiecărei platforme (format, durată maximă, zone de siguranță) se cercetează cu sursă și dată
- [x] Subtitrări arse în video (opțional) și fișier `.srt`, în limba aleasă
- [x] Pachet de postare opțional (copertă, titlu, descriere, hashtag-uri), doar dacă se alege în întrebări
- [x] Variante de hook opționale (2–3, randate doar pentru primele secunde), doar dacă se aleg în întrebări

## Faza 15 – Referințe și materialele utilizatorului

- [x] Povestea și ideile de hook ale utilizatorului se păstrează cuvânt cu cuvânt și au prioritate; Claude le dezvoltă doar după aprobare
- [x] Videouri de referință: se dau ca fișiere; sistemul extrage ritm, tăieturi pe secundă, densitate de text, structură și ritm de sunet într-un profil de stil; nu se copiază
- [x] Control total asupra audio-ului utilizatorului: ce fișier, unde (la ce secundă), cum (întreg, tăiat, mai încet sub voce) și ce nu se schimbă
- [x] Brand kit salvat pe produs, reutilizat la următoarele reclame

## Faza 16 – Continuitate și răspundere

- [x] `STATE.md` pe fiecare proiect, actualizat după fiecare pas, ca să se poată relua exact de unde s-a rămas
- [x] Buget de tokeni: estimare pe etapă și bilanț la fiecare 3 runde
- [x] Motorul și proiectele stau în `C:\dev\`, în afara OneDrive
- [x] Fiecare utilizator răspunde de drepturile și de conținutul reclamelor lui; nu se adaugă nicio notă automată de „concept”

---

## Ordinea de construcție

1. Repo, instalare și `doctor` (Faza 0).
2. CLAUDE.md, reguli și registru de licențe (Faza 1).
3. Captură Playwright, manifest și test de footage real (Faza 2).
4. Motorul: timeline declarativ, validare, preview, randare de probă (Faza 7).
5. Registry, fișă standard de element și catalog demo (Faza 4).
6. Efectele, pe pachete: Pachetul 1 (esențialul din fiecare categorie), apoi cameră, text, tranziții, interfață, lumină, logo și date, 3D, sunet.
7. Audio: cue sheet, beat grid, mix, licențe (Faza 6).
8. Zone de siguranță și multi-format (Faze 5 și 8).
9. `/make-ad` și comenzile ajutătoare (Faza 9).
10. Test pe o a doua aplicație; abia apoi se repară Spotify v5 pe baza notelor de ascultare.

**Criteriul de reușită:** repo-ul se clonează pe alt calculator, `npm run doctor` trece, iar o reclamă nouă se face cu o singură comandă și un singur preview.
