# Arhitectura

## Principiul

**AI-ul decide CE se face. Motorul decide CUM se face.**

Claude (în Claude Code, prin comenzile din `.claude/commands/`) scrie date validate: brief, script, storyboard, alegeri de rețete și capabilități. Motorul transformă datele în timeline și pixeli, determinist. O reclamă nouă nu cere cod nou; doar date. Un efect nou intră în bibliotecă o singură dată, generic, testat.

## Fluxul datelor

```
                   ┌──────────── captură reală (Playwright) ─────────────┐
brief.json ──┐     │  capturi 2× + zone din DOM + înregistrări + text     │
             ├──► assets.json (manifest: sursă, rol, drepturi, analiză)  │
             ├──► research.json (surse, afirmații cu citat și stare) ◄───┘
             └──► brand.json (culori, fonturi, logo, reguli)
                              │
              script.json ◄───┤  (replici: voce, text, accente, afirmații, frază obligatorie)
           storyboard.json ◄──┘  (scene: rol, emoție, energie, rețetă, materiale, focus, cameră, tranziție)
                              │
              ┌─ vocea (TTS / fișier) → audio/voice.json (durate + cuvinte)
              ▼
     [compilator] src/timeline/compile.ts
       durate (gramatica de montaj) → tăieturi pe beat → tranziții → rețete → straturi
       → text măsurat cu fonturile reale → cameră → cue sheet → subtitrări → validare
              ▼
     versions/vN/timeline-<format>.json   ← singura sursă pentru randare
              ▼
     [mixer] src/audio → audio/mix.wav (−14 LUFS, ≤ −1 dBTP) + raport
              ▼
     [Remotion] src/renderer → preview MP4 + foaie de contact + verificarea video
              ▼
     bucla de calitate (src/quality): pase 0–9, metoda cea mai ieftină, cache pe conținut
       → scor quality-v1 (11 categorii) + rubrica regulii 7 → probleme cu corecturi
       → corecturi automate (versiune nouă, rollback) → revizuirea vizuală a lui Claude + notele tale
       → … → „render final” → exports/
```

Înainte de script, conceptul creativ (`src/creative/concepts.ts`) alege structura și direcția din dovezi; conceptul utilizatorului are prioritate (regula 14). `mms make` (`src/pipeline/produce.ts`) leagă pașii: concepte → script → storyboard → voce → compilare → mix → calitate (standard) → corecturi automate → Final QA cu un singur preview. Detaliile buclei: `docs/CALITATE.md`.

### Schemele și proiectele vechi

Fiecare fișier de proiect are `schemaVersion` în schema lui. O schimbare compatibilă (câmp nou opțional sau cu valoare implicită) nu o schimbă. O schimbare incompatibilă crește `schemaVersion` în schemă și înregistrează migrarea de la versiunea anterioară (`registerMigrations` din `src/core/migrate.ts`), cu un test pe un fișier vechi. `readJson` aplică migrările la citire, în memorie: versiunile înghețate nu se rescriu, iar fișierul ajunge în forma nouă doar când e salvat din nou. Un fișier scris de un studio mai nou e refuzat cu indicația `npm run update`. `mms check-projects` (și `npm run doctor`) citește toate proiectele existente cu schemele de acum și verifică fișierele la care trimit manifestul și timeline-urile.

## Modulele

| Folder | Rol |
| --- | --- |
| `src/core/schema/` | Toate entitățile, cu zod: proiect, brief, research, brand, materiale, script, storyboard, timeline, audio, critică, versiuni, stare. Fișierele de proiect se citesc și se scriu doar prin scheme. |
| `src/core/` | Căi (`paths.ts`), binarele FFmpeg/FFprobe din Remotion (`binaries.ts`), formate și zone sigure cu sursă (`formats.ts`), aleator determinist (`random.ts`), timp, JSON atomic, `.env`, erori. |
| `src/projects/` | Depozitul de proiecte: structura pe disc, versiuni imuabile (inclusiv `rejected` la rollback), aprobări, `STATE.md`, instantaneele intrărilor (`snapshots.ts`). |
| `src/capture/` | Captura reală cu Playwright: capturi, pagină întreagă, zone din DOM, date de pagină, date personale, înregistrare cadru cu cadru, profil persistent pentru autentificare. |
| `src/assets/` | Ingestie (sha256, nume stabil), ffprobe, fontkit, SVG, miniaturi prin FFmpeg, punct focal, paletă, dHash, cadre video pentru analiză; OCR offline (Windows) pentru capturile fără DOM (`ocr.ts`); datele personale cu validatori (`pii.ts`: email, telefon, card, IBAN, CNP, nume din salut). |
| `src/research/` | Surse și afirmații extrase din pagini (fapt/inferență/interpretare, citat, încredere, „de confirmat”); citirea paginilor relevante ale site-ului (`crawl.ts`); graful de afirmații: coroborare, conflicte, concurenți (`graph.ts`). |
| `src/brand/` | Brand kit dedus din CSS și logo; potrivirea cu fonturile bibliotecii; forma brandului (colțuri, umbre, spațiere, gradienți) folosită de rețete. |
| `src/references/` | Profilul unui video de referință (tăieturi, mișcare, culoare, tempo) și Reference DNA (`dna.ts`): ritmul, camera și culoarea aplicate pe direcție și ritm. |
| `src/creative/` | Direcțiile A–F (profiluri executabile), șabloanele, întrebările A–H, intake-ul inteligent (`smart-intake.ts`), conceptele creative cu scor pe 10 criterii (`concepts.ts`), schița și validarea scriptului, constructorul de storyboard. |
| `src/editing/` | Gramatica de montaj: timp de citire, durata scenei, alegerea tranziției, J-cut, hold pe CTA. Operațiile de editare (`ops.ts`, schema în `src/core/schema/edit.ts`) și istoricul cu undo/redo (`history.ts`), folosite de Studio, CLI și corecturile automate. |
| `src/motion/` | Capabilitățile (registry): straturi, modificatori, camere, tranziții + nucleul (easing, text, filtre, context, fonturi) + catalogul. Rulează în browser. |
| `src/recipes/` | Rețetele (combinații de nivel înalt) și uneltele lor (zone pe format, ecrane, zone din captură, adaptoare de layout). |
| `src/timeline/` | Compilatorul storyboard → timeline, măsurarea textului cu fontkit, validatorul. |
| `src/audio/` | WAV, DSP, efecte sintetizate, muzică generativă, voce (TTS), decodare, beat grid, loudness BS.1770, mixer. |
| `src/renderer/` | Compoziția Remotion (`TimelineComposition`), foaia de contact, randarea din Node (bundle cache-uit, folder public pregătit doar cu fișierele folosite), analiza video-ului randat. |
| `src/critique/` | Rubrica fixă a regulii 7 (`auto.ts`), criticul pe pixeli (`pixel.ts`), pachetul de revizuire vizuală pentru Claude (`pack.ts`). |
| `src/quality/` | Bucla de calitate: verificările pe pase și metode (tipurile și lista în `checks.ts`, câte un fișier pe pasă în `passes/`), rularea cu cache (`run.ts`), problemele (`issues.ts`), scorul `quality-v1` (`score.ts`), corecturile automate cu rollback (`autofix.ts`). |
| `src/platform/` | Profilurile de platformă (durată, hook, subtitrări, densitate), ajustabile per proiect. |
| `src/inventory/` | Inventarul de design și producție (stare, prioritate, referințe spre cod verificate de lint) → `docs/INVENTAR.md`. |
| `src/iterate/` | Comenzile în limbaj natural → operații locale pe storyboard/script. |
| `src/pipeline/` | Pașii de producție (captură, brand, script, storyboard, voce, compilare, audio, preview, final, critică, iterație), `produce.ts` (`mms make`), graful de dependențe (`graph.ts`) și motorul de impact (`impact.ts`). |
| `src/studio/` | Serverul local (API, fișiere cu Range, joburi recuperabile, SSE, protecții) și interfața React (Player, timeline, editorul scenei, Calitate, Concept). |
| `src/cli/` | `mms` – linia de comandă. |

## Timeline-ul

`versions/vN/timeline-<format>.json` conține tot ce trebuie pentru randare: dimensiuni, FPS, durată, zona sigură, fonturile (căi publice), paleta, tipografia, scenele (de la cadrul X, durată, tranziția de intrare, camera, straturile), straturile globale, subtitrările (cuvinte în cadre), audio-ul (mixul, cue sheet-ul, beat grid-ul), marcajele și steagul „concept”.

- **Scenele** se suprapun exact pe durata tranziției: scena nouă începe cu `d` cadre înainte de finalul celei vechi. Fără goluri, deci fără cadre negre.
- **Straturile** au capabilitate, cadru de start, durată, cutie (pixeli), parametri, adâncime (0 = fix pe ecran, 1 = planul scenei, altele = parallax), rol, modificatori și copii. Copiii unui `media.screen` sunt în pixelii capturii (de aceea un spotlight urmărește zoom-ul și scroll-ul).
- **Camera** e o pistă de chei (punct, zoom, rotații) plus mână liberă, tremur, punch pe ritm, profunzime de câmp și blur de mișcare calculat din viteză.

## Registry-ul și fișa unei capabilități

Fiecare intrare (`src/motion/types.ts`) are: `id`, `kind` (layer/modifier/camera/transition), `category`, `title`, `description`, `tags` (pentru căutarea după intenție), `compatibleMedia`, `timing`, `sfx` (sunetul asociat: la start, la final, la fiecare element, la un cadru din parametri), `status`, `performance`, `license`, `params` (zod, cu valori implicite), `example` și implementarea (componentă React, funcție de aplicare, funcție de construcție a camerei sau prezentarea tranziției). `npm run registry` scrie `library/registry.json` (cu parametrii ca JSON Schema), pe care Claude îl citește ca să aleagă.

### Cum adaugi o capabilitate

1. Verifică întâi că nu există (caută în `library/registry.json` după `tags`). Poate ajunge un parametru nou.
2. În fișierul categoriei din `src/motion/` (de ex. `fx/effects.tsx`), definește-o cu `defineLayer` (sau `defineModifier`, `defineCamera`, `defineTransition`):
   - `id: "categorie.nume"`, generic, fără nume de produs;
   - `params: z.object({...})` cu valori implicite;
   - componenta primește `{ params, frame, duration, box, env }` și calculează totul din `frame` (aleator doar cu `rand(...)`/`noise1(...)` din `src/core/random.ts`);
   - `sfx: [{ sound: "pop", at: "start" }]` cu un id din `src/audio/sfx.ts` (sau adaugă un sunet nou acolo);
   - `example`: parametri și durată (catalogul îl randează);
   - `status: "experimental"`.
3. Adaug-o în lista exportată a fișierului (de ex. `FX_LAYERS`), care e deja inclusă în `src/motion/registry.ts`.
4. `npm run typecheck`, `npm run registry`, `npm test`, `npm run test:render`. Uită-te la cadrul randat (`npm run remotion`, compoziția „Catalog”).
5. Doar după ce trec: `status: "tested"`, `npm run registry`, `npm run docs`, CHANGELOG.

## Rețetele

O rețetă (`src/recipes/`, câte un fișier pe grup: `text`, `reveal`, `ui`, `proof`, `cta`; lista în `recipes.ts`; `defineRecipe`) are: `id`, `roles` (pentru ce roluri narative e potrivită), `slots` (materialele cerute: screenshot, înregistrare, logo, imagine, pagină întreagă), `minSec` (+ `minSecFor` calculat din text), `capabilities` (pe care le poate folosi) și `params` (zod). `build(ctx, params)` întoarce straturile, camera (preset + parametri), punctul de interes și sunetele proprii.

Contextul (`RecipeContext`) dă: dimensiunile, orientarea, zona sigură (cu zonele excluse ale platformei), durata, scena, direcția, textul (titlu, secundar, elemente, accente, voce), materialele rezolvate (cu zonele din captură), logo-ul, paleta, bătăile din scenă, zona de interes, nivelul de efecte, capabilitățile interzise și dacă există subtitrări.

Unelte din `src/recipes/kit.ts`: `zones()` (unde stă textul și materialul pe fiecare orientare/compoziție), `layer()` (creează un strat; textul fix evită automat butoanele platformei), `screenParams()`, `regionFocus()` (unde ajunge pe ecran o zonă din captură și ce zoom o încadrează), `bestRegion()` (zona care se potrivește unui text), `focusCrop()` (decupajul în jurul zonei demonstrate: pe vertical cardul înalt, pe orizontal mărirea interfeței până la ~7 px la testul de 360 px), `directionBase()` (fundalul și texturile direcției).

## Șabloanele

Un șablon (`templates/<id>.json`, schema în `src/creative/templates.ts`) descrie structura unei reclame: scene cu `role`, `recipe`, `energy`, `emotion`, `shot`, `line` (ce fel de replică primește: hook, problem, reveal, feature, benefit, proof, cta), `weight` și `optional`. Constructorul de storyboard potrivește replicile scriptului cu scenele, alege materialele (captura cea mai potrivită textului) și zona de interes. Testul `tests/unit/creative.test.ts` verifică toate șabloanele.

## Determinismul

- Totul se calculează din cadru; aleatorul vine din `rand()`/`mulberry32()` cu sămânța proiectului și id-ul stratului.
- Canvas-urile (grain, particule) se desenează sincron din cadru.
- Audio-ul e generat determinist și pus în cache pe conținut.
- Compilarea e deterministă octet cu octet: aceleași date dau exact același timeline (test de integrare).
- `tests/render/*` verifică: aceleași cadre randate de două ori ies identice. Rasterizarea Chrome (GPU sau software) poate varia rar cu 1–2 niveluri din 255, la marginea plăcilor de rasterizare sau în filtrele SVG. Diferența e invizibilă și e tolerată explicit (`tests/render/pixels.ts`); orice diferență mai mare pică testul.
- Randarea grafică se poate alege cu `MMS_GL` (`angle` = GPU, implicit; `swangle` = software, mai lentă).
- `npm run lint` interzice `Math.random()`/`Date.now()` în codul care se randează.

## Studio

- Server Node fără framework (`src/studio/server.ts`), doar pe 127.0.0.1: API JSON, fișiere cu Range (pentru video/audio în Player), joburi rulate pe rând (o randare odată), evenimente SSE.
- Protecții: se acceptă doar Host-ul local (contra DNS rebinding); cererile care modifică cer Origin local și antetul `X-MMS` (contra CSRF); încărcările acceptă doar tipuri de fișier cunoscute, maximum 500 MB; scrierile JSON sunt atomice.
- Joburile (`src/studio/jobs.ts`) au etapă, progres, timeout pe tip și oprire (semnalul ajunge până la randarea Remotion). Fiecare job are un manifest în `.cache/jobs/`; un job întrerupt de oprirea procesului apare „întrerupt” și se poate relua cu aceiași parametri.
- Interfața (`src/studio/ui/`: `App.tsx`, un fișier pe panou în `panels/`, piesele comune în `common.tsx`, preview-ul și calitatea separat) e construită cu esbuild la pornire și folosește `@remotion/player` cu aceeași `TimelineComposition` ca randarea. Fișierele se servesc prin `/files/<cale publică>` (contextul `AssetBaseContext`).
- Timeline-ul din interfață arată datele reale (scene, straturi, voce, efecte, subtitrări, bătăi; clic = salt). Scena de sub cursor se editează în panoul alăturat prin operațiile de editare, cu undo/redo; o versiune înghețată duce editarea în versiunea următoare. Nu există tragere de clipuri cu mouse-ul.

## Formate și zone de siguranță

`src/core/formats.ts`: preseturi (9:16, 16:9, 1:1, 4:5, 4K) și dimensiuni personalizate; zonele sigure pe platformă, ca procente, cu sursele și data verificării. Pe vertical se aplică și zonele excluse (de ex. coloana de butoane TikTok). Același storyboard produce câte un timeline pe format; adaptoarele de layout din rețete rearanjează conținutul (de ex. pe vertical o captură de desktop devine un card decupat în jurul funcției).

## Randarea

`src/renderer/node/render.ts`: bundle-ul Remotion se construiește o dată pentru o versiune a codului (hash pe surse) în `.cache/bundles/`; înainte de fiecare randare, în folderul public al bundle-ului se pun legături (hard links) doar spre fișierele folosite de timeline. Video: H.264, yuv420p, BT.709, AAC 320k. Cadre: PNG/JPEG. Foaia de contact e o compoziție Remotion separată.

Randarea scrie într-un fișier temporar din același folder, redenumit doar la final; o oprire nu lasă un MP4 pe jumătate. Înainte de randare se verifică spațiul liber. Concurența (cadre în paralel) e cea implicită a Remotion, reglabilă cu `MMS_RENDER_CONCURRENCY`; măsurătorile sunt în `docs/DECIZII.md`, punctul 77, iar `npm run bench -- <proiect>` le repetă pe altă mașină.

## Dependențele și actualizarea lor

- Toate versiunile sunt fixate exact în `package.json` (fără `^` sau `~`), iar `package-lock.json` e în Git. Instalarea folosește `npm ci`, deci aceleași versiuni pe orice mașină. `npm run doctor` avertizează dacă ce e instalat diferă de ce e fixat (de ex. după un `npm install <pachet>` făcut de mână).
- Pachetele `remotion` și `@remotion/*` se actualizează **împreună**, la aceeași versiune; `doctor` refuză versiuni diferite. O versiune nouă de Remotion poate schimba rasterizarea, deci cere și regresia vizuală.
- O actualizare se face pe o ramură separată, nu în timpul producției unei reclame: `npm outdated` → versiunile noi în `package.json` → `npm install` → porțile complete (`npm run typecheck`, `npm run lint`, `npm run test:coverage`, `npm run test:render`, `npm run e2e -- --fresh`) → o notă în `CHANGELOG.md`. Referințele vizuale (`tests/golden/`) se actualizează doar după ce te uiți la cadrele schimbate (`docs/TESTARE.md`).
- Playwright vine cu browserul lui: după actualizare, `npx playwright install chromium` (îl face și `npm run update`). Pe mașina ta nu se instalează nimic în timpul lucrului (regula 11); `npm run update` aduce versiunea nouă și instalează ce lipsește.
- `npm audit` rulează în CI (dependențele de producție, prag „high”). O vulnerabilitate se rezolvă prin actualizarea pachetului, cu aceleași porți.
- Licența Remotion pentru companii: `docs/LICENTE.md`.
