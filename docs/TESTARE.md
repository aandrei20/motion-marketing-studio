# Testarea

Ce verifică fiecare poartă, cum se rulează și ce înseamnă când pică. Rezultatele la zi sunt în `docs/IMPLEMENTATION_STATUS.md`.

## Porțile, în ordinea în care se rulează

| Comandă | Durata (laptopul de test) | Ce verifică |
| --- | --- | --- |
| `npm run typecheck` | ~30 s | tipurile TypeScript în tot repo-ul |
| `npm run lint` | ~5 s | regulile verificabile automat: fără nume de produs în motor, fără `Math.random`/`Date.now` în randare, fără chei în fișierele urmărite, fără co-autori în commit-urile noi, inventarul și referințele lui |
| `npm test` | ~1–2 min | testele unitare și de integrare (fără randare video, cu excepția celor marcate) |
| `npm run test:render` | ~10–20 min | randarea: catalogul întreg, determinismul pixelilor, MP4, regresia vizuală |
| `npm run e2e -- --fresh` | ~4–7 min | testul de acceptanță cap-coadă pe produsul demo fictiv |

Nimic din acestea nu instalează ceva (regula 11). Dacă lipsește o dependență, `npm run doctor` spune ce trebuie rulat.

## Testele unitare (`tests/unit/`)

| Fișier | Ce acoperă |
| --- | --- |
| `core.test.ts` | aleatorul cu sămânță, timecode-urile, formatele și zonele sigure, contrastul WCAG, așezarea textului (mărime, rânduri, majuscule românești) |
| `store-validate.test.ts` | versiunile imuabile, aprobările cu fraza exactă, validatorul timeline-ului (goluri, flash-uri, cifre fără sursă, zone sigure, footage real, date personale), camera, coperta și variantele de hook |
| `registry.test.ts` | fiecare capabilitate are fișă completă, parametri zod, sunet declarat, exemplu |
| `creative.test.ts` | direcțiile, întrebările A–H, șabloanele, scriptul (cuvintele utilizatorului păstrate), storyboard-ul |
| `creative-director.test.ts` | conceptele (scor pe 10 criterii, conceptul utilizatorului are prioritate), intake-ul inteligent |
| `quality.test.ts` | problemele (câmpuri, compatibilitate cu formatul vechi, prioritizare, unire), scorul și verdictele (PASS / POLISH / FIX / FAIL, praguri configurabile, categorii neevaluate, rubrica regulii 7), operațiile de editare (și scenele blocate), amprentele și impactul, registrul capabilităților de sistem, pasele pe adâncimi, profilurile de platformă, subtitrările față de zona demonstrată, criticul pe pixeli |
| `research.test.ts` | planul de citire a site-ului, graful de afirmații (coroborare, conflicte, concurenți) |
| `references.test.ts` | Reference DNA (ritm, cameră, culoare) și aplicarea ei pe direcție |
| `audio.test.ts` | DSP, loudness BS.1770-4 pe valori de referință, true peak, limitator, ducking |
| `audio-intel.test.ts` | structura muzicii (secțiuni, drop-uri; nimic inventat pe tempo nesigur), efectele sonore coborâte sub voce |
| `pii.test.ts` | datele personale: email, telefon, card (Luhn), IBAN (mod 97), CNP (cifra de control), nume din salut |
| `inventory.test.ts` | inventarul de design și producție: fiecare referință trimite la cod care există |

## Testele de integrare (`tests/integration/`)

| Fișier | Ce acoperă |
| --- | --- |
| `pipeline.test.ts` | fluxul pe produsul demo: timeline-uri valide, mix verificat; aceleași tăieturi în alte formate și FPS-uri; iterația și variantele de hook nu ating versiunea veche; recompilarea pe o versiune înghețată; bucla „fast” (fără randare, 11 categorii, pase 0–9); editarea cu undo/redo, impactul, rollback-ul și instantaneele |
| `studio-lint.test.ts` | serverul Studio: interfața, proiect + brief + aprobarea cu fraza exactă, fișiere cu Range; protecțiile (Host local, Origin local, antetul `X-MMS`, tipurile de fișier la încărcare), oprirea, manifestul și reluarea joburilor; regulile lint-ului |
| `assets-ocr.test.ts` | OCR-ul offline pe o captură dată de utilizator: zone de text folosibile pentru zoom (doar pe Windows) |

## Testele de randare (`tests/render/`)

| Fișier | Ce acoperă |
| --- | --- |
| `catalog.test.ts` | toate capabilitățile din registry randate din exemplul din fișă, fiecare cu conținut vizibil; aceleași cadre randate de două ori ies identice (toleranța de rasterizare 2/255); fără cadre negre; regresia vizuală față de `tests/golden/catalog.json` |
| `golden.test.ts` | toate rețetele, compilate prin compilatorul real pe 16:9 și 9:16, față de `tests/golden/recipes-*.json`; un test care arată că pragurile prind un element dispărut și unul mutat |
| `video.test.ts` | MP4 H.264 + AAC redabil, fără cadre negre și fără flash-uri peste limită; același cadru randat de două ori e identic |

### Regresia vizuală

Referințele sunt grile RGB mici (32 × N), nu imagini: ocupă puțin, nu depind de compresie și ignoră variația de rasterizare. Detaliile și pragurile: `docs/CALITATE.md`, secțiunea „Regresia vizuală”.

Când o schimbare vizuală e intenționată (o capabilitate sau o rețetă arată altfel, voit):

1. Uită-te la cadrele noi (`npm run remotion` pentru catalog sau o foaie de contact).
2. `$env:MMS_UPDATE_GOLDEN="1"; npm run test:render; Remove-Item Env:MMS_UPDATE_GOLDEN`
3. Commit cu referințele noi și motivul în mesaj.

O capabilitate sau o rețetă nouă fără referință pică testul („fără referință”) până când referința e scrisă, după verificarea vizuală.

## Testul cap-coadă (`npm run e2e`)

Pe produsul demo fictiv (`examples/demo-product`), proiectul `e2e-kolibri`:

captură reală → research → brand → script și storyboard (curate sau `--auto`) → voce → timeline → mix → bucla de calitate (standard; `fast` cu `--no-render`) → corecturi automate (`--autofix`) → final QA pe preview-ul randat o singură dată.

Opțiuni: `--fresh` (șterge doar proiectul `e2e-kolibri`), `--auto`, `--no-render`, `--autofix`.

## Ce nu se testează automat (și de ce)

- **Sunetul** îl judecă omul (regula 15): testele verifică doar măsurătorile (LUFS, true peak, clipping, tăceri).
- **Vocile cu cheie API** (ElevenLabs, OpenAI) și `install.sh`: lipsesc cheile și un Mac în mediul de test.
- **Autentificarea interactivă** (`mms login`): cere un om.
- **Comenzile Claude Code** (`/make-ad` etc.): sunt instrucțiuni pentru Claude, cer o sesiune.
- **Revizuirea vizuală a lui Claude**: se face în sesiune, pe pachetul `critique-pack`; testele verifică doar pachetul și primirea observațiilor.
- **Exportul final**: cere „render final” de la utilizator (regula 6). Poarta e testată (refuză fără aprobare); randarea folosește același motor ca preview-ul.

## Când pică o poartă

- Mesajul de eroare e în română și spune ce să faci (`MmsError` cu indicație). Nu ascunde eroarea și nu marca testul „skip”.
- O regresie vizuală neintenționată e un bug: găsește schimbarea din cod, nu actualiza referința.
- O diferență de pixeli peste 2/255 între două randări identice e un bug de determinism (regula 18).
