# Testarea

Ce verifică fiecare poartă, cum se rulează și ce înseamnă când pică. Rezultatele la zi sunt în `docs/IMPLEMENTATION_STATUS.md`.

## Porțile, în ordinea în care se rulează

| Comandă | Durata (laptopul de test) | Ce verifică |
| --- | --- | --- |
| `npm run typecheck` | ~30 s | tipurile TypeScript în tot repo-ul |
| `npm run lint` | ~5 s | Biome (bug-uri frecvente, importuri și variabile nefolosite, hook-uri React, accesibilitatea JSX, formatarea) plus regulile verificabile automat: fără nume de produs în motor, fără `Math.random`/`Date.now` în randare, fără chei în fișierele urmărite, fără co-autori în commit-urile noi, fără caractere de control în sursă, inventarul și referințele lui |
| `npm test` | ~1,5 min | testele unitare și de integrare (fără randare video, cu excepția celor marcate) |
| `npm run test:coverage` | ~2,5 min | aceleași teste, cu acoperirea codului Node măsurată; sub pragul din `vitest.config.ts` (linii 70%, ramuri 57%, funcții 73%) poarta pică. Rulează în CI. Codul care rulează în browser (compozițiile, interfața Studio) e verificat de testele de randare și de testul interfeței, nu de acoperirea V8 |
| `npm run test:render` | ~10–20 min | randarea: catalogul întreg, determinismul pixelilor, MP4, regresia vizuală |
| `npm run e2e -- --fresh` | ~4–7 min | testul de acceptanță cap-coadă pe produsul demo fictiv |
| `npm run e2e:real -- --url <site> --fresh` | ~2–6 min | același flux pe un site public real (cere internet); opțional, nu face parte din `check` |
| `npm run bench -- <proiect>` | ~2–5 min | viteza randării la mai multe valori de concurență, pe mașina liniștită; nu e o poartă, ci măsurătoarea pentru `MMS_RENDER_CONCURRENCY` (docs/DECIZII.md, punctul 77) |

CI-ul (`.github/workflows/ci.yml`, pe Windows) rulează la fiecare push pe `main` și la fiecare pull request: `npm audit` pe dependențele de producție, typecheck, lint, testele cu acoperire, testul cap-coadă fără randare, apoi testele de randare cu randare software (`MMS_GL=swangle`); cadrele care nu trec regresia vizuală devin artefact.

Nimic din acestea nu instalează ceva (regula 11). Dacă lipsește o dependență, `npm run doctor` spune ce trebuie rulat.

## Testele unitare (`tests/unit/`)

| Fișier | Ce acoperă |
| --- | --- |
| `core.test.ts` | aleatorul cu sămânță, timecode-urile, formatele și zonele sigure, contrastul WCAG, așezarea textului (mărime, rânduri, majuscule românești), curățarea cache-ului de bundle-uri, bugetul cache-ului și spațiul pe disc, migrarea schemelor (lanț de migrări, fișier neatins, fișier mai nou, migrare lipsă), concurența randării |
| `security.test.ts` | politica de adrese a capturii (rețea locală, metadate, protocoale, date de autentificare în adresă, pașii `goto`), id-urile de proiect și de versiune care nu ies din folderele lor, Remotion Studio mutat pe 127.0.0.1 (toate formele de `listen`) |
| `inner-cuts.test.ts` | tăieturile din interiorul scenelor (cadrul pe cuvânt, forma „decupaj” și forma „cameră”, condițiile care le opresc, zona deasupra subtitrărilor, fără blur pe tăietură), camera inversată la rețete repetate, unitatea de spațiere și grila, proximitatea titlu–subtitlu |
| `jobs.test.ts` | recuperarea joburilor la pornire: doar joburile proceselor oprite devin „întrerupte” |
| `counterpart.test.ts` | captura de telefon pentru vertical: aceeași pagină, același tip, zonele demonstrate, drepturi refuzate, pagină neadaptată, date personale fără decizie |
| `usage.test.ts` | jurnalul operațiilor (apeluri, cache, eșecuri, unități), bugetul de apeluri plătite, modelul vocii în cheia de cache |
| `store-validate.test.ts` | versiunile imuabile, aprobările cu fraza exactă, validatorul timeline-ului (goluri, flash-uri, cifre fără sursă, zone sigure, footage real, date personale, drepturile cerute o dată pe site), camera, coperta și variantele de hook |
| `registry.test.ts` | fiecare capabilitate are fișă completă, parametri zod, sunet declarat, exemplu |
| `creative.test.ts` | direcțiile, întrebările A–H, șabloanele, scriptul (cuvintele utilizatorului păstrate), storyboard-ul, decupajul în jurul zonei demonstrate (doar când camera nu ajunge, fără text tăiat), partea folosită a unui container |
| `creative-director.test.ts` | conceptele (scor pe 10 criterii, conceptul utilizatorului are prioritate), intake-ul inteligent |
| `quality.test.ts` | problemele (câmpuri, compatibilitate cu formatul vechi, prioritizare, unire), scorul și verdictele (PASS / POLISH / FIX / FAIL, praguri configurabile, categorii neevaluate, rubrica regulii 7), operațiile de editare (și scenele blocate), amprentele și impactul, registrul capabilităților de sistem, pasele pe adâncimi, profilurile de platformă, subtitrările față de zona demonstrată, criticul pe pixeli |
| `research.test.ts` | planul de citire a site-ului, graful de afirmații (coroborare, conflicte, concurenți) |
| `references.test.ts` | Reference DNA (ritm, cameră, culoare) și aplicarea ei pe direcție |
| `audio.test.ts` | DSP, loudness BS.1770-4 pe valori de referință, true peak, limitator, ducking, compresorul pe voce, ambianța (umple liniștea, tace în liniștea intenționată, mixul rămâne la −14 LUFS) |
| `audio-intel.test.ts` | structura muzicii (secțiuni, drop-uri; nimic inventat pe tempo nesigur), efectele sonore coborâte sub voce |
| `pii.test.ts` | datele personale: email, telefon, card (Luhn), IBAN (mod 97), CNP (cifra de control), nume din salut |
| `inventory.test.ts` | inventarul de design și producție: fiecare referință trimite la cod care există |

## Testele de integrare (`tests/integration/`)

| Fișier | Ce acoperă |
| --- | --- |
| `pipeline.test.ts` | fluxul pe produsul demo: timeline-uri valide, mix verificat; pe 9:16 capturile de telefon (sau motivul pentru care rămâne desktopul), pe 16:9 cele desktop; aceleași tăieturi în alte formate și FPS-uri; L-cut-ul (tăietura imaginii mai devreme, vocea pe loc); iterația și variantele de hook nu ating versiunea veche; recompilarea pe o versiune înghețată; bucla „fast” (fără randare, 11 categorii, pase 0–9); editarea cu undo/redo, impactul, rollback-ul și instantaneele |
| `produce.test.ts` | producția automată (concept → script și storyboard → timeline → mix → calitate → corecturi automate cu rollback), regenerarea selectivă a vocii, arcul de energie; apoi fiecare tab din Studio pe proiectul produs: fără erori în consolă, fără probleme WCAG 2 A/AA grave (axe), fără conținut ieșit din ecran la 1280 și 820 px |
| `cli.test.ts` | linia de comandă apelată direct: ajutorul, întrebările, biblioteca, proiect nou, brief, aprobarea cu fraza exactă, starea, verificarea proiectului, erorile cu cod |
| `projects-check.test.ts` | proiectele existente față de schemele de acum: fișier invalid, material șters de mână, fără să ascundă celelalte proiecte |
| `jobs-crash.test.ts` | un crash real: Studio-ul ca proces separat, o captură pornită, procesul omorât cu tot cu browserul; la repornire jobul e „întrerupt”, se reia și termină, proiectul rămâne valid, nicio captură dublată |
| `studio-lint.test.ts` | serverul Studio: interfața, proiect + brief + aprobarea cu fraza exactă, fișiere cu Range; protecțiile (Host local, Origin local, antetul `X-MMS`, tipurile de fișier la încărcare), oprirea, manifestul și reluarea joburilor; regulile lint-ului |
| `assets-ocr.test.ts` | OCR-ul offline pe o captură dată de utilizator: zone de text folosibile pentru zoom (doar pe Windows) |
| `capture-page.test.ts` | datele paginii din captură (butoane, titluri, logo) și recunoașterea unei pagini neadaptate pentru telefon (depășire vizibilă sau ascunsă cu `overflow: hidden`) |
| `capture-network.test.ts` | filtrul de rețea pe o pagină publică (fără internet), pe proxy-ul real: resursele și WebSocket-urile spre rețeaua locală sunt oprite înainte să plece; o redirecționare spre o adresă locală și DNS rebinding nu ajung la serverul local |

## Testele de randare (`tests/render/`)

| Fișier | Ce acoperă |
| --- | --- |
| `catalog.test.ts` | toate capabilitățile din registry randate din exemplul din fișă, fiecare cu conținut vizibil; aceleași cadre randate de două ori ies identice (toleranța de rasterizare 2/255); fără cadre negre; regresia vizuală față de `tests/golden/catalog.json` |
| `golden.test.ts` | toate rețetele, compilate prin compilatorul real pe 16:9 și 9:16, față de `tests/golden/recipes-*.json`; un test care arată că pragurile prind un element dispărut și unul mutat |
| `video.test.ts` | MP4 H.264 + AAC redabil, fără cadre negre și fără flash-uri peste limită; o randare oprită la jumătate nu lasă fișiere, iar reluarea produce un MP4 valid; același cadru randat de două ori e identic |

### Regresia vizuală

Referințele sunt grile RGB mici (32 × N), nu imagini: ocupă puțin, nu depind de compresie și ignoră variația de rasterizare. Detaliile și pragurile: `docs/CALITATE.md`, secțiunea „Regresia vizuală”.

Când o schimbare vizuală e intenționată (o capabilitate sau o rețetă arată altfel, voit):

1. Uită-te la cadrele noi (`npm run remotion` pentru catalog sau o foaie de contact).
2. `$env:MMS_UPDATE_GOLDEN="1"; npm run test:render; Remove-Item Env:MMS_UPDATE_GOLDEN`
3. Commit cu referințele noi și motivul în mesaj.

O capabilitate sau o rețetă nouă fără referință pică testul („fără referință”) până când referința e scrisă, după verificarea vizuală.

## Testul cap-coadă (`npm run e2e`)

Pe produsul demo fictiv (`examples/demo-product`), proiectul `e2e-kolibri`:

captură reală → research → brand → concept (al utilizatorului, din brief) → script și storyboard (curate sau `--auto`) → voce → timeline → mix → bucla de calitate (standard; `fast` cu `--no-render`) → corecturi automate (`--autofix`) → final QA pe preview-ul randat o singură dată.

Opțiuni: `--fresh` (șterge doar proiectul `e2e-kolibri`), `--auto`, `--no-render`, `--autofix`, `--export`.

Cu `--export`, testul merge până la MP4-ul final al produsului demo fictiv: aprobarea „render final” o înregistrează testul (ca aprobarea brief-ului), iar fiecare export se verifică cu ffprobe (rezoluția și FPS-ul formatului, durata timeline-ului, H.264, pistă audio) și cu analiza video (fără cadre negre, maximum 2 flash-uri pe secundă). Pe o reclamă reală, fraza o scrie omul (regula 6, `docs/DECIZII.md` punctul 76).

## Testul pe un produs real (`npm run e2e:real`)

Ca studioul să nu fie verificat doar pe un produs fictiv. Adresa vine la rulare; codul nu conține niciun nume de produs.

```powershell
npm run e2e:real -- --url https://site-public.example --fresh --lang en [--no-render] [--duration 20] [--vision "…"] [--max-pages 4]
```

Flux: intake inteligent pe pagina reală → proiect și brief deduse → aprobarea de test → captură reală (pagina, pagina întreagă, logo-ul) → research pe site (paginile relevante devin și materiale) → brand → concepte → `produce` (calitate standard, corecturi automate cu rollback, un preview, Final QA).

Ce verifică pe lângă flux: site-ul e al altcuiva, deci capturile au drepturi neconfirmate; reclama trebuie să iasă marcată „concept” pe toate formatele, iar exportul final trebuie refuzat. Proiectul se cheamă `e2e-…` (`--fresh` șterge doar un astfel de proiect).

Limba: `--lang` alege limba reclamei (implicit `ro`). Dacă e alta decât a site-ului, citatele de pe site apar ca probleme mari „de tradus”: traducerea e decizia utilizatorului, nu a testului.

## Ce nu se testează automat (și de ce)

- **Sunetul** îl judecă omul (regula 15): testele verifică doar măsurătorile (LUFS, true peak, clipping, tăceri).
- **Vocile cu cheie API** (ElevenLabs, OpenAI) și `install.sh`: lipsesc cheile și un Mac în mediul de test.
- **Autentificarea interactivă** (`mms login`): cere un om.
- **Comenzile Claude Code** (`/make-ad` etc.): sunt instrucțiuni pentru Claude, cer o sesiune.
- **Revizuirea vizuală a lui Claude**: se face în sesiune, pe pachetul `critique-pack`; testele verifică doar pachetul și primirea observațiilor.
- **Exportul final al unei reclame reale**: cere „render final” de la utilizator (regula 6). Poarta e testată (refuză fără aprobare), iar drumul complet până la MP4 se verifică pe produsul demo fictiv cu `npm run e2e -- --export`.
- **Testul pe produsul real** cere internet și depinde de site (se poate schimba oricând): nu intră în `npm run check`. Rezultatul ultimei rulări e în `docs/IMPLEMENTATION_STATUS.md`.

## Când pică o poartă

- Mesajul de eroare e în română și spune ce să faci (`MmsError` cu indicație). Nu ascunde eroarea și nu marca testul „skip”.
- O regresie vizuală neintenționată e un bug: găsește schimbarea din cod, nu actualiza referința.
- O diferență de pixeli peste 2/255 între două randări identice e un bug de determinism (regula 18).
