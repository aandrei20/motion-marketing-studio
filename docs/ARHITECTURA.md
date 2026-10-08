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
     critică (rubrica fixă) → iterație (versiune nouă) → … → „render final” → exports/
```

## Modulele

| Folder | Rol |
| --- | --- |
| `src/core/schema/` | Toate entitățile, cu zod: proiect, brief, research, brand, materiale, script, storyboard, timeline, audio, critică, versiuni, stare. Fișierele de proiect se citesc și se scriu doar prin scheme. |
| `src/core/` | Căi (`paths.ts`), binarele FFmpeg/FFprobe din Remotion (`binaries.ts`), formate și zone sigure cu sursă (`formats.ts`), aleator determinist (`random.ts`), timp, JSON atomic, `.env`, erori. |
| `src/projects/` | Depozitul de proiecte: structura pe disc, versiuni imuabile, aprobări, `STATE.md`. |
| `src/capture/` | Captura reală cu Playwright: capturi, pagină întreagă, zone din DOM, date de pagină, date personale, înregistrare cadru cu cadru, profil persistent pentru autentificare. |
| `src/assets/` | Ingestie (sha256, nume stabil), ffprobe, fontkit, SVG, miniaturi prin FFmpeg, punct focal, paletă, dHash, cadre video pentru analiză. |
| `src/research/` | Surse și afirmații extrase din pagini (fapt/inferență/interpretare, citat, încredere, „de confirmat”). |
| `src/brand/` | Brand kit dedus din CSS și logo; potrivirea cu fonturile bibliotecii. |
| `src/references/` | Profilul unui video de referință (tăieturi, mișcare, culoare, tempo). |
| `src/creative/` | Direcțiile A–F (profiluri executabile), șabloanele, întrebările A–H, schița și validarea scriptului, constructorul de storyboard. |
| `src/editing/` | Gramatica de montaj: timp de citire, durata scenei, alegerea tranziției, J-cut, hold pe CTA. |
| `src/motion/` | Capabilitățile (registry): straturi, modificatori, camere, tranziții + nucleul (easing, text, filtre, context, fonturi) + catalogul. Rulează în browser. |
| `src/recipes/` | Rețetele (combinații de nivel înalt) și uneltele lor (zone pe format, ecrane, zone din captură, adaptoare de layout). |
| `src/timeline/` | Compilatorul storyboard → timeline, măsurarea textului cu fontkit, validatorul. |
| `src/audio/` | WAV, DSP, efecte sintetizate, muzică generativă, voce (TTS), decodare, beat grid, loudness BS.1770, mixer. |
| `src/renderer/` | Compoziția Remotion (`TimelineComposition`), foaia de contact, randarea din Node (bundle cache-uit, folder public pregătit doar cu fișierele folosite), analiza video-ului randat. |
| `src/critique/` | Critica automată (rubrica fixă) și regulile buclei de calitate. |
| `src/iterate/` | Comenzile în limbaj natural → operații locale pe storyboard/script. |
| `src/pipeline/` | Pașii de producție (captură, brand, script, storyboard, voce, compilare, audio, preview, final, critică, iterație). |
| `src/studio/` | Serverul local (API, fișiere cu Range, joburi, SSE) și interfața React (Player + timeline). |
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

O rețetă (`src/recipes/recipes.ts`, `defineRecipe`) are: `id`, `roles` (pentru ce roluri narative e potrivită), `slots` (materialele cerute: screenshot, înregistrare, logo, imagine, pagină întreagă), `minSec` (+ `minSecFor` calculat din text), `capabilities` (pe care le poate folosi) și `params` (zod). `build(ctx, params)` întoarce straturile, camera (preset + parametri), punctul de interes și sunetele proprii.

Contextul (`RecipeContext`) dă: dimensiunile, orientarea, zona sigură (cu zonele excluse ale platformei), durata, scena, direcția, textul (titlu, secundar, elemente, accente, voce), materialele rezolvate (cu zonele din captură), logo-ul, paleta, bătăile din scenă, zona de interes, nivelul de efecte, capabilitățile interzise și dacă există subtitrări.

Unelte din `src/recipes/kit.ts`: `zones()` (unde stă textul și materialul pe fiecare orientare/compoziție), `layer()` (creează un strat; textul fix evită automat butoanele platformei), `screenParams()`, `regionFocus()` (unde ajunge pe ecran o zonă din captură și ce zoom o încadrează), `bestRegion()` (zona care se potrivește unui text), `portraitCrop()` (adaptorul pentru vertical), `directionBase()` (fundalul și texturile direcției).

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
- Interfața (`src/studio/ui/`) e construită cu esbuild la pornire și folosește `@remotion/player` cu aceeași `TimelineComposition` ca randarea. Fișierele se servesc prin `/files/<cale publică>` (contextul `AssetBaseContext`).
- Timeline-ul din interfață e o vizualizare a datelor reale (inspectare + navigare). Editarea se face prin storyboard, script, comenzi în limbaj natural sau Claude.

## Formate și zone de siguranță

`src/core/formats.ts`: preseturi (9:16, 16:9, 1:1, 4:5, 4K) și dimensiuni personalizate; zonele sigure pe platformă, ca procente, cu sursele și data verificării. Pe vertical se aplică și zonele excluse (de ex. coloana de butoane TikTok). Același storyboard produce câte un timeline pe format; adaptoarele de layout din rețete rearanjează conținutul (de ex. pe vertical o captură de desktop devine un card decupat în jurul funcției).

## Randarea

`src/renderer/node/render.ts`: bundle-ul Remotion se construiește o dată pentru o versiune a codului (hash pe surse) în `.cache/bundles/`; înainte de fiecare randare, în folderul public al bundle-ului se pun legături (hard links) doar spre fișierele folosite de timeline. Video: H.264, yuv420p, BT.709, AAC 320k. Cadre: PNG/JPEG. Foaia de contact e o compoziție Remotion separată.
