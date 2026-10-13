# Decizii tehnice

Fiecare decizie are motivul ei. Deciziile de produs (ce face studioul, regulile) sunt în `PLAN.md` și `CLAUDE.md`. Aici sunt cele de construcție, luate pe 2026-10-08.

## Stack

1. **Totul în TypeScript, fără Python.** Audio-ul (WAV, filtre, loudness BS.1770-4, true peak, limitator, reverb, detecția tempo-ului, muzica și efectele sintetizate) e scris în TypeScript. Motiv: o singură instalare (`npm ci`), fără al doilea ecosistem pe Windows. Costul: am implementat noi algoritmii; testele le verifică cu valori de referință (de ex. sinus de 997 Hz la 0 dBFS = −3,01 LUFS).
2. **FFmpeg nu se instalează separat.** Remotion vine cu FFmpeg/FFprobe (`@remotion/compositor-win32-x64-msvc`); `src/core/binaries.ts` le folosește pentru probe, miniaturi, decodare și asamblarea înregistrărilor. Motiv: instalare mai simplă și o singură versiune de FFmpeg.
3. **zod 4 e singura sursă a schemelor.** Tipurile TypeScript, validarea fișierelor și JSON Schema din `library/registry.json` (`z.toJSONSchema`) vin din aceleași definiții. Motiv: Claude scrie JSON pe care motorul îl validează exact.
4. **Remotion 4, versiuni fixate exact.** Toate pachetele `@remotion/*` au aceeași versiune (verificată de `doctor`). Studio-ul folosește `@remotion/player` cu aceeași compoziție ca randarea, deci preview-ul din browser și MP4-ul arată la fel.
5. **Fără GSAP și fără Three.js, deocamdată.** 3D-ul (rame de dispozitiv, stive, cărți, orbită, înclinări) e CSS 3D real, cu perspectivă. Motiv: e suficient pentru interfețe plane, e determinist și nu adaugă un motor de randare. Three.js intră doar când un efect cere geometrie reală (CLAUDE.md: „cu motiv scris”).
6. **Studio fără framework de server.** Un server Node `http` (API JSON, fișiere cu Range, SSE, coadă de joburi), plus interfață React construită cu esbuild la pornire. Motiv: zero dependențe în plus și pornire rapidă. Ascultă doar pe 127.0.0.1.

## Captură

7. **Înregistrarea se face cadru cu cadru, nu cu `recordVideo` din Playwright.** Capturi JPEG în rafală cu marcaj de timp, apoi asamblare la FPS constant cu FFmpeg. Motiv: `recordVideo` are FPS variabil și calitate mică; în reclamă înregistrarea trebuie să fie clară și sincronizabilă.
8. **Zonele din captură se iau din DOM.** Butoane, câmpuri, carduri și titluri, cu poziția exactă în pixelii capturii. Motiv: efectele (zoom, spotlight, callout, cursor) pot ținti „câmpul de căutare” fără să ghicească din imagine.
9. **Culorile de brand vin întâi din variabilele CSS calculate.** Le citim cu `getComputedStyle` (merge și pe `file://`, unde regulile CSS sunt blocate), apoi din frecvența culorilor. Accentele se ordonează după saturație × luminozitate × frecvență.
10. **Paginile de aplicație nu intră în research** (`research: false`). Motiv: datele de test din aplicație („18 / 24 sarcini”) nu sunt afirmații despre produs.

## Motor de mișcare

11. **Timeline declarativ, compilat.** Claude scrie storyboard-ul (intenții); compilatorul produce timeline-ul (cadre, pixeli). Randarea citește doar timeline-ul. Motiv: determinism, validare înainte de randare și comenzi locale („la 00:14…”) fără regenerarea totului.
12. **Scenele se suprapun pe durata tranziției.** Scena nouă începe cu `d` cadre înainte de finalul celei vechi. Motiv: nu există cadre fără scenă, deci nu apar cadre negre între scene.
13. **Camera e un punct din lume pus în centrul cadrului, cu adâncime pe strat.** Adâncimea 0 = fix pe ecran (text, subtitrări), 1 = în scenă, între ele = parallax. Motiv: textul rămâne lizibil în timp ce camera se mișcă, iar parallax-ul vine gratuit.
14. **Blur-ul de mișcare e calculat din viteza camerei, calibrat ca un obturator de 180°.** Prima variantă era mult prea puternică.
15. **Textul se măsoară cu fontul real și în Node (fontkit), și în browser (canvas)**, cu același algoritm (căutare binară pe mărime + împărțire pe rânduri). Compilatorul scrie rândurile și mărimea în timeline. Motiv: validatorul știe exact cât de mare e textul (test de 360 px), fără randare.
16. **Copiii unui `media.screen` sunt în pixelii capturii.** Spotlight-ul, cursorul și callout-ul urmăresc astfel zoom-ul, decupajul și scroll-ul capturii.
17. **Adaptoare de layout pe format.** Pe vertical, o captură de desktop devine un card decupat în jurul funcției (`focusCrop`; pe orizontal, vezi punctul 78). Textul fix ocolește zonele excluse ale platformei, iar camera țintește centrul zonei media, nu centrul cadrului.

## Montaj și creativ

18. **Duratele vin din gramatica de montaj**, nu din șablon: timp de citire = max(0,8 s, cuvinte / 3), vocea prelungește scena, hold minim de 2,5 s pe CTA, J-cut. Șablonul dă doar ponderi.
19. **Tranziția se alege după direcție și diferența de energie** și nu se repetă de două ori la rând.
20. **Direcțiile A–F sunt profiluri executabile** (fonturi, ritm, tranziții, cameră, culori, muzică), nu doar descrieri.
21. **Critica automată e euristică și declarată ca atare.** `mms-auto-critic-v1` verifică structura (durate, text, ritm, repetiții, zone sigure, mix, raportul video). Nu vede imaginea. Revizuirea vizuală (foaia de contact, cadrele) o face Claude, separat, ca reviewer `claude-visual`. Motiv: CLAUDE.md cere același reviewer și aceeași rubrică în toate rundele, iar un critic determinist e comparabil de la o rundă la alta.
22. **Variantele de hook sunt versiuni separate**, toate pornind din aceeași versiune. Utilizatorul le compară ca preview-uri complete.
23. **Pachetul de postare nu inventează hashtag-uri.** Titlul și descrierea sunt replici deja aprobate din script, iar hashtag-urile le propune Claude și le aprobă utilizatorul (regula 5).

## Audio

24. **Muzica originală e compusă pe structura reclamei**: tempo după direcție, accente pe tăieturi, final pe CTA. Muzica utilizatorului primește beat grid detectat (comb pe faze + faza benzii joase pentru prima bătaie).
25. **Ducking cu rampă de 500 ms, normalizare la −14 LUFS, limitator cu plafon −1 dBTP măsurat cu interpolare 4×.** Mixerul raportează; exportul final cere raport „ok”.
26. **TTS offline prin Windows OneCore** (PowerShell + WinRT), cu marcaje de cuvinte pentru subtitrări. Textul se transmite printr-un fișier UTF-8, altfel se pierd diacriticele. Pentru folosirea comercială a vocilor Windows, vezi `docs/LICENTE.md`.
27. **Subtitrările au un fundal discret** pe toate formatele: pe vertical zona media continuă sub banda lor, iar pe orizontal push-ul camerei poate aduce captura sub ele.

## Siguranță și calitate

28. **Zonele sigure ale platformelor vin din surse secundare** (încredere medie, verificate pe 2026-10-08), cu sursa trecută în `src/core/formats.ts`. Înainte de o campanie mare, verifică-le în Ads Manager.
29. **Testul de 360 px** se face pe latura scurtă a videoului, afișată la 360 px. Minimum 12 px pentru textul principal și 9 px pentru cel secundar. Interpretare proprie a regulii 17, notată aici.
30. **Versiunile se îngheață** la crearea unei versiuni-copil, la preview, la aprobare și la final. Rapoartele de randare se pot scrie și pe o versiune înghețată, pentru că descriu randarea, nu o schimbă. Exporturile nu se suprascriu niciodată.
31. **Randarea folosește un bundle cache-uit** (hash pe surse) și un folder public pregătit doar cu fișierele folosite (hard links). Motiv: randări repetate rapide, fără copierea proiectului.
32. **Nimic nu se instalează în timpul lucrului.** `doctor` doar verifică și spune comanda; `install.ps1` instalează Node/Git doar cu acordul utilizatorului.

## Așezarea peste capturi (după revizuirea vizuală)

33. **Callout-urile au mărime constantă pe ecran**: compensează și scara capturii, și zoom-ul camerei (`CameraZoomContext`). Partea pe care stau se alege după poziția finală a zonei pe ecran, după push, în limitele capturii vizibile și ale zonei media.
34. **Materialul nu trece peste textul fix.** Zoom-ul push-urilor se limitează (`limitZoomForText`), iar centrul camerei din demonstrații se mută cât e nevoie (`clearOfText`). Dacă limita lasă un zoom neglijabil, camera nu mai traversează captura, ci face un push lent pe centru.
35. **Capturile de pagină întreagă se derulează automat** până la zona țintită, când aceasta e sub partea vizibilă.

## Versiuni și voce

36. **Vocea are o amprentă** (setările din brief + textul rostit). Compilarea refolosește vocea doar dacă amprenta e aceeași; altfel o reface (TTS-ul e în cache, deci e rapid). Motiv: un script editat manual nu trebuie să ajungă cu vocea veche.
37. **Compilarea pe o versiune înghețată creează versiunea următoare**, cu jurnal („recompilare”), ca orice altă modificare.

## Determinism

38. **Garanția de determinism e pe două niveluri.** Timeline-ul (toate deciziile, pozițiile, timpii, sunetele) e identic octet cu octet la fiecare compilare. Pixelii sunt identici în aproape toate randările, dar rasterizarea Chrome poate varia rar cu cel mult 2/255. Am observat asta pe GPU (o bandă la marginea plăcilor de 256 px) și în randarea software (filtrul SVG al tranziției glitch). Testele tolerează exact această diferență și nimic peste ea. Un bug real (aleator nefixat, timp real) produce diferențe mari și e prins.

## Bucla de calitate (Production OS, 2026-10-08)

39. **Pasele 0–9 sunt porți, nu randări.** Fiecare verificare declară metoda și costul (de la `schema` la `full-render`), iar adâncimea rundei (`fast`, `standard`, `deep`, `final`) stabilește ce e permis. Motiv: majoritatea problemelor se văd în date (timeline, mix, afirmații), iar randarea e partea scumpă. O verificare sărită apare ca sărită, iar categoria neevaluată rămâne `null`, nu 100.
40. **Cache pe conținut, nu pe timp.** Cadrele-cheie au cheia conținutului scenei plus hash-ul codului de randare, mixul cheia `audioKey`, preview-ul cheia timeline-ului. O scenă mutată în timp, dar neschimbată, nu se mai randează. Motiv: corecturile ating de obicei 1–3 scene, iar restul trebuie refolosit.
41. **Scorul `quality-v1` se adaugă rubricii regulii 7, nu o înlocuiește.** Rubrica (`rubric-v1`, `mms-auto-critic-v1`) rămâne aceeași în toate rundele, iar pragul de 8/10 pe scenă e o condiție a verdictului PASS. Pragurile 92/95, ponderile și penalizările sunt configurabile per proiect (`project.json`, `quality`).
42. **Penalizări descrescătoare pe categorie** (×0,85 pentru fiecare problemă în plus din aceeași categorie) și ponderate cu încrederea. Motiv: zece observații mici nu trebuie să valoreze cât o problemă mare, iar o euristică nesigură nu trebuie să coste cât o măsurătoare.
43. **Corecturile automate ating doar ce e mecanic și sigur:** durate, tranziții, cameră, decalaje, poziția subtitrărilor, culoarea lizibilă din paletă. Textul utilizatorului, afirmațiile și conceptul rămân decizii de om (regula 14). Fiecare iterație e o versiune nouă; dacă scorul scade sau apare o problemă mare nouă, versiunea se marchează `rejected` (nu se șterge, regula 9) și se revine la cea bună.
44. **Contrastul se măsoară pe pixeli, nu pe culorile declarate.** Fundalul de sub text se citește din cadrul randat, fără culorile de design ale textului însuși (marker, accent). Motiv: un text alb pe o captură deschisă la culoare trecea verificarea pe culori și era ilizibil.
45. **Fără apel automat la un model de vedere prin API.** Revizuirea vizuală o face Claude în sesiunea Claude Code, pe pachetul `critique-pack` (cadre-cheie, foaie de contact, listă de verificat, schema răspunsului). Motiv: fără chei în cod (regula 19), fără cadre trimise în afara calculatorului, fără o funcție netestabilă în acest mediu.
46. **Subtitrările ocolesc zona demonstrată, nu interfața întreagă.** Zona demonstrată vine din focusul scenei (zona din captură, spotlight, drag, cursor), urmărită prin cameră. Dacă nu există loc liber în zona sigură, problema rămâne raportată pentru o decizie de om.
47. **Mișcarea reală se citește din preview-ul existent la Final QA**, nu din cadre randate separat. Motiv: o randare de 150 de cadre dura ~140 s; preview-ul există deja și are toate cadrele.

## Materiale, research, referințe

48. **OCR offline prin Windows (WinRT)**, doar pentru capturile fără DOM (date de utilizator, poze cu interfață). Zonele de text din OCR se folosesc ca zonele din DOM (zoom, focus) și pentru datele personale. Pe alte sisteme, OCR-ul lipsește și se spune asta. Motiv: fără dependențe noi și fără trimiterea imaginilor în afară.
49. **Datele personale se validează, nu doar se caută cu expresii:** cardul cu Luhn, IBAN-ul cu mod 97, CNP-ul cu cifra de control, numele doar după un salut și cu majusculă. Motiv: mai puține alarme false pe cifre obișnuite.
50. **Citirea site-ului rămâne pe același domeniu** și ocolește paginile de cont, de aplicație și juridice. Afirmațiile despre concurenți intră „de confirmat” și blochează dacă sunt folosite fără aprobare.
51. **Reference DNA ignoră ultimul cadru al referinței** (de obicei cartonașul final), ca ritmul să nu fie mascat de el. Tempo-ul cu încredere sub 0,35 nu aliniază tăieturi și nu inventează structură.

## Studio și joburi

52. **Protecția Studio-ului: Host local + Origin local + antetul `X-MMS`.** Motiv: serverul ascultă doar pe 127.0.0.1, dar o pagină deschisă în browser ar putea trimite cereri spre el (CSRF, DNS rebinding). Un antet propriu nu poate fi trimis de un formular străin fără preflight.
53. **Joburile au manifest pe disc** (`.cache/jobs/`), timeout pe tip și oprire până la randare. Un job întrerupt de oprirea procesului nu se reia singur: apare „întrerupt” și îl reiei tu. Motiv: o randare reluată fără să știi ar consuma timp fără acord.
54. **Editorul de scene folosește aceleași operații ca corecturile automate și CLI-ul** (`src/core/schema/edit.ts`). Motiv: o singură implementare testată, un singur jurnal, undo/redo pentru toate.

## Teste

55. **Regresia vizuală compară grile RGB de 32 × N, nu imagini întregi.** Pragurile (medie 6/255, bloc 60/255) sunt mult peste variația de rasterizare (2/255) și sub o schimbare vizibilă; un test arată că prind un element dispărut și unul mutat. Referințele se actualizează doar explicit (`MMS_UPDATE_GOLDEN=1`), după o verificare vizuală.

## Contribuitori

56. **Fără co-autori și fără atribuiri automate.** Commit-urile nu au trailere `Co-authored-by` sau „Generated with”, iar repo-ul nu are fișier sau secțiune de contribuitori. `.claude/settings.json` dezactivează atribuirea, iar `npm run lint` refuză commit-urile noi cu astfel de trailere (de la `f6cb12c` încoace). Istoricul mai vechi nu a fost rescris.

## Testul pe un produs real (după primele rulări pe un site public)

57. **Testul cap-coadă pe un produs real** (`npm run e2e:real -- --url <site>`) nu are niciun nume de produs în cod: adresa vine la rulare. Capturile site-ului altcuiva intră ca materiale ale unui terț (`--third-party` la captură), deci reclama iese „concept”, iar exportul final rămâne blocat; testul verifică ambele. Aprobarea brief-ului e a testului (proiect `e2e-…`, fără export).
58. **Butoanele unei pagini includ linkurile stilizate ca butoane** (fundal sau contur, padding, cel mult 6 cuvinte): pe site-urile reale, CTA-ul e aproape mereu un `<a>`. Titlurile din meniu și din subsol nu intră în titlurile paginii.
59. **Logo-ul se ia din pagină doar cu semnal clar** (scor ≥ 3: „logo”/„brand” în atribute, link spre pagina principală, antet). SVG-ul inline se salvează cu culoarea calculată (fără recolorare); un SVG cu simboluri externe (`<use>`) nu se salvează. Un logo greșit e mai rău decât niciunul.
60. **Paginile citite la research devin materiale** (fără pagina de start, deja capturată, și fără concurenți), cu drepturile capturilor existente de pe același site. Storyboard-ul preferă captura paginii din care vine afirmația replicii și penalizează aceeași captură folosită de mai multe ori.
61. **Limba replicilor se verifică offline** (cuvinte de legătură și diacritice). Un citat de pe site în altă limbă decât reclama e o problemă mare: citatul trebuie tradus, iar traducerea o propune Claude și o aprobă utilizatorul. Originalul rămâne sursa afirmației. Cuvintele utilizatorului nu se semnalează (regula 14).
62. **CTA-ul nestabilit („de confirmat”) e o problemă critică**, ca să nu ajungă în video. Durata peste ținta din brief (+15% medie, +50% mare) e o problemă de platformă. Drepturile se raportează o dată pe material, iar o problemă cu același text pe toate formatele devine una singură.
63. **Schița automată de script** folosește funcțiile de pe pagina principală și din paginile oficiale; noutățile datate doar dacă nu ajung; documentația, ajutorul, concurenții și articolele terților deloc (o sursă necunoscută rămâne admisă). Titlul de pe ecran e scurt, fără dată. O scenă cu mai multe ecrane primește cel mult 3 capturi. Capturile de pagină întreagă intră pentru o funcție doar cu o zonă care se potrivește textului.
64. **O cameră aleasă explicit (editor, corectură automată) păstrează reglajele rețetei când e aceeași mișcare**, iar zoom-ul din focusul rețetei e cel deja limitat sub titlu. Înainte, „set-camera camera.push” fără parametri relua zoom-ul complet (1,76× pe produsul real) și captura intra peste titlu pe 16:9. Verificarea `ui.material-over-text` măsoară pe ecran, la zoom-ul maxim al scenei, cât din text acoperă materialul (peste 12% = problemă, peste 30% = mare).
65. **Culorile de text se fac lizibile din aceeași nuanță de brand**, nu se înlocuiesc: textul secundar ajunge la minimum 4,5:1 pe fundal, iar cuvântul rostit din subtitrări la minimum 3:1 pe fundalul translucid al subtitrărilor (în cel mai rău caz, peste alb), alegând dintre accent și culoarea principală nuanța care rămâne mai colorată. Pe un site real, „accentul” extras era bleumarin închis și cuvântul activ dispărea.
66. **Hold-ul de pe CTA nu e un îngheț nedorit**: imaginea nemișcată din scena de CTA, de cel mult 5 s, se raportează separat (`heldRuns`), nu ca problemă. Peste 5 s rămâne problemă.
67. **Ca dezvăluire, turul paginii arată logo-ul deasupra titlului** (cutia are proporțiile logo-ului, scară uniformă, aliniat cu titlul), ca reamintirea brandului să nu depindă de alegerea șablonului.
68. **Odihna vizuală se propune pe o scenă fără demonstrație**, nu pe o funcție: acolo push-ul face interfața lizibilă, iar cele două corecturi se anulau una pe alta. Varietatea nu mai propune „camera.push” unei scene care deja împinge.

## Securitate, costuri și formatele verticale (etapa de consolidare)

69. **Captura are o politică de adrese (SSRF).** Adresa de start poate fi http, https sau file (o machetă locală), fără nume/parolă în adresă și niciodată un serviciu de metadate al norilor. Aplicația ta de pe localhost sau din rețeaua locală se poate captura (adresa de start locală e intenția ta). O pagină **publică** nu poate trage captura în rețeaua locală: resursele, iframe-urile și WebSocket-urile spre localhost, IP-uri private sau nume care se rezolvă la IP-uri private sunt oprite înainte să plece; service worker-ii sunt blocați (ar ocoli filtrul); un pas `goto` nu duce spre o adresă locală; logo-ul nu se citește de pe disc pentru o pagină de pe internet. Playwright nu trece prin filtru pașii unei redirecționări: aceia se observă, iar captura se oprește și nu salvează nimic. Limite rămase: cererea GET a unei redirecționări a plecat deja când e observată, iar un DNS care se schimbă între rezolvarea din Node și cea din Chromium (DNS rebinding) nu e prins. Test: `tests/integration/capture-network.test.ts`, fără internet (`--host-resolver-rules`).
70. **Id-urile care devin căi pe disc se validează acolo unde devin căi.** `projectDir` cere un slug, `versionDir` cere `v1`, `v2`… Înainte, un id de versiune din URL-ul Studio-ului (`..%2F..%2F`) putea scrie `script.json` în afara proiectului.
71. **Pe formatele verticale se folosește captura de telefon a aceleiași pagini.** Motiv: o captură desktop pe 9:16 lasă interfața la ~4 px la testul de 360 px. La un proiect cu format vertical, fiecare captură statică desktop primește și varianta de telefon (`<id>-mobile`, viewport 390 × 844 la 3×); `--no-mobile` o oprește. Storyboard-ul rămâne comun formatelor și folosește captura desktop; compilatorul o înlocuiește pe vertical doar dacă pagina e adaptată pentru telefon (nu iese pe orizontală și nu are text tăiat de margine), captura nu are drepturi refuzate sau date personale fără decizie și **arată toate zonele demonstrate în scenă** (focusul și zonele din parametrii rețetei, de ex. drag & drop), cu id-urile remapate. Altfel rămâne captura desktop, iar raportul compilării spune de ce. O înregistrare desktop își păstrează zonele desktop. Pixelii rămân reali: se alege altă captură reală, nimic nu se redesenează.
72. **Drepturile capturilor se cer o dată pe site** (înlocuiește „o dată pe material” de la punctul 62 pentru capturi). Capturile aceluiași site (desktop, telefon, pagină întreagă, logo-ul din pagină) sunt o singură problemă de drepturi, cu același text pe toate formatele; `mms rights <proiect> --source <site> confirmed` le confirmă pe toate. Celelalte materiale rămân pe material.
73. **Bundle-urile vechi de randare se șterg singure.** Fiecare schimbare de cod lăsa un bundle de 20–60 MB (1,4 GB adunați). După un bundle nou se păstrează cel curent, ultimele 2 folosite și orice bundle folosit în ultimele 2 ore (un Studio pornit cu codul vechi îl poate folosi încă). `mms cache [--prune]` arată mărimea cache-ului.
74. **Operațiile care costă se înregistrează, iar apelurile plătite au buget.** `projects/<id>/usage.jsonl`: furnizor, model, operație, motiv, unități (caractere, cadre), durată, rezultat, refolosire din cache; fără texte sau chei. Costul în bani nu se estimează: furnizorii nu îl întorc în aceste apeluri. Apelurile plătite ale unei rulări sunt limitate de `MMS_MAX_PAID_CALLS` (implicit 60). `mms usage <proiect>` arată totalurile.
75. **Modelul vocii din cloud intră în cheia de cache** (și în cheia pasului de voce), doar când există, ca vocile locale deja sintetizate să rămână valabile. Un apel la o voce din cloud are timeout de 90 s.
76. **Testul cap-coadă poate merge până la exportul final, doar pe produsul demo fictiv** (`npm run e2e -- --export`): aprobarea „render final” o înregistrează testul, la fel ca aprobarea brief-ului, iar fișierul exportat se verifică cu ffprobe (rezoluție, FPS, durată, H.264, pistă audio) și cu analiza video (cadre negre, flash-uri). O reclamă reală cere fraza de la om (regula 6).

## Consolidarea tehnică (după auditul „10/10”)

77. **Concurența randării rămâne cea implicită a Remotion (min(8, nuclee/2)), reglabilă cu `MMS_RENDER_CONCURRENCY`.** Măsurat cu `npm run bench` pe laptopul de referință (Ryzen 7 7435HS, 16 nuclee logice), pe mașina liniștită (procesor ocupat 3–4% înainte), 10 s din produsul demo: pe 9:16, 13,2 / 14,0 / 15,1 / 14,7 cadre/s la concurența 4 / 6 / 8 / 12; pe 16:9, 14,2–14,3 cadre/s la orice concurență (~2,1× durata reclamei). Procesorul stă la ~50–60%, iar codarea H.264 ține pasul (cadrele randate se termină la 18,5 s din 19,8 s): limita e procesul GPU al browserului, comun tuturor tab-urilor. Randarea software (`swangle`) e de ~7× mai lentă și tot plată. Două browsere separate, fiecare cu jumătate din cadre, câștigă doar ~12%, iar trei nimic; nu justifică împărțirea pe intervale și lipirea video-ului și a sunetului.
78. **Decupajul în jurul zonei demonstrate se face și pe orizontal, dar doar când camera nu ajunge.** Pe 16:9, o captură desktop întreagă (2880 px într-o casetă de ~1016 px) lasă textul interfeței la ~4 px la testul de 360 px, iar push-ul camerei e limitat de titlul de lângă captură (zoom ~1,17 pe site-ul real). `focusCrop` decupează atunci în jurul zonei, până la ~7 px, cu zona întreagă și cel puțin 40% din lățimea paginii. Dacă push-ul pe captura întreagă trece deja de pragul verificării (5 px), captura rămâne întreagă: camera arată zona cu context, fără margini tăiate (pe produsul demo, zoom 1,6–2,2, nimic nu se schimbă). Marginile decupajului nu trec prin titluri, butoane, câmpuri sau carduri capturate: se mută ca să le includă sau să le lase afară. Pe vertical se decupează acum și capturile de pagină întreagă, în jurul unei zone demonstrate. Rezultat pe site-ul real: problemele de lizibilitate de pe 16:9 și 9:16 au dispărut (scor 89,4 → 94,2, la adâncimea fast, fără mix).
79. **Zona demonstrată a unui container e partea lui cu conținut.** O coloană de kanban de 1040 px, cu cardurile în primii ~500, nu mai e toată „elementul demonstrat”: la drag & drop, încadrarea, conturul și subtitrările se raportează la partea de sus a coloanei până sub ultimul card din ea și sub locul unde ajunge cardul mutat (`usedPart`). Pe 9:16, subtitrările acopereau 20% din coloană (partea goală, dar cu conturul tras în jurul ei); acum nu o mai ating, fără nicio decizie de om, fără mutarea capturii și fără scoaterea subtitrărilor.
80. **Un traseu de cursor ale cărui zone nu încap împreună în decupaj urmează prima zonă.** Pe vertical, un câmp în stânga și un buton în dreapta nu încap în cardul înalt; înainte, decupajul centrat pe amândouă tăia butonul pe margine. Acum decupajul urmează prima zonă, iar cursorul le vizitează doar pe cele care se văd întregi. Fixture-ul regresiei vizuale folosește regiunile reale ale capturii (înainte: o regiune inventată, peste un spațiu gol).
