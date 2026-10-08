# Capabilitățile de sistem și bucla de calitate

Fișier generat din `src/pipeline/graph.ts` și `src/quality/checks.ts` de `npm run docs`. Graful de dependențe (intrări → ieșiri) decide ce se recalculează după o schimbare.

| Id | Domeniu | Ce face | Intrări → ieșiri | Implementare | Teste | Stare | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `research.capture` v1 | research | Captură reală (Playwright): capturi, zone din DOM, text, CSS, date personale | brief → captures, assets | `src/capture/capture.ts#capture` | `tests/integration/pipeline.test.ts` | implemented · încredere high | 5 |
| `research.extract` v1 | research | Afirmații cu citat, sursă, dată și încredere din paginile capturate | captures → research | `src/research/extract.ts#extractFromPage` | `tests/unit/creative.test.ts`, `tests/integration/pipeline.test.ts` | implemented · încredere high | 1 |
| `claims.script-gate` v1 | claims | Validarea scriptului: fraze obligatorii, afirmații utilizabile, cifre cu sursă, interdicții | script, research, brief → quality | `src/creative/script.ts#validateScript` | `tests/unit/creative.test.ts` | implemented · încredere high | 1 |
| `brand.infer` v1 | brand | Brand kit din CSS-ul paginii și din logo | captures, assets → brand | `src/brand/infer.ts#inferBrand` | `tests/integration/pipeline.test.ts` | implemented · încredere medium | 1 |
| `assets.ingest` v1 | assets | Ingestie: sha256, duplicate, ffprobe, fonturi, SVG, paletă, punct focal, dHash, rol | captures → assets | `src/assets/ingest.ts#ingestFile` | `tests/unit/store-validate.test.ts`, `tests/integration/pipeline.test.ts` | implemented · încredere high | 2 |
| `references.analyze` v1 | references | Profilul unei referințe video (tăieturi, mișcare, culoare, tempo, energie) (Profilul se calculează, dar nu intră încă în deciziile de montaj (vezi references.dna).) | assets → references | `src/references/analyze.ts#analyzeReference` | — | partial · încredere medium | 3 |
| `creative.intake` v1 | creative | Întrebările A–H cu variante | — → brief | `src/creative/intake.ts#intakeMarkdown` | — | implemented · încredere high | 0 |
| `creative.templates` v1 | creative | Alegerea structurii (șablon) după categorie, direcție, durată, obiectiv | brief → storyboard | `src/creative/templates.ts#chooseTemplate` | `tests/unit/creative.test.ts` | implemented · încredere medium | 0 |
| `creative.script-draft` v1 | creative | Schița factuală de script (citatele din research + cuvintele utilizatorului) | brief, research → script | `src/creative/script.ts#draftScript` | `tests/unit/creative.test.ts` | implemented · încredere medium | 1 |
| `creative.storyboard` v1 | creative | Storyboard executabil din șablon, script și materiale | script, brief, research, assets → storyboard | `src/creative/storyboard.ts#buildStoryboard` | `tests/unit/creative.test.ts` | implemented · încredere medium | 1 |
| `editing.grammar` v1 | editing | Gramatica de montaj: durate, tranziții, J-cut, hold pe CTA | storyboard, voice → timeline | `src/editing/grammar.ts#sceneDuration` | `tests/unit/creative.test.ts` | implemented · încredere high | 0 |
| `editing.nl-commands` v1 | editing | Comenzi în limbaj natural → operații locale pe storyboard/script | storyboard, script, timeline → storyboard, script | `src/iterate/intents.ts#parseCommand` | `tests/unit/creative.test.ts`, `tests/integration/pipeline.test.ts` | implemented · încredere medium | 0 |
| `audio.voice` v1 | audio | Vocea (TTS / fișier), cu amprentă și cache | script, brief → voice | `src/pipeline/steps.ts#stepVoice` | `tests/integration/pipeline.test.ts` | implemented · încredere high | 2 |
| `audio.beat` v1 | audio | Beat grid (tempo, fază, încredere) din muzica utilizatorului sau ales pentru muzica sintetizată | assets, brief, storyboard → beatgrid | `src/pipeline/steps.ts#planBeatGrid` | `tests/unit/audio.test.ts` | implemented · încredere medium | 2 |
| `audio.mix` v1 | audio | Muzică, efecte, voce, ducking, −14 LUFS, true peak ≤ −1 dBTP, tăceri | timeline, storyboard, brief, beatgrid → mix | `src/pipeline/steps.ts#stepAudio` | `tests/unit/audio.test.ts`, `tests/integration/pipeline.test.ts` | implemented · încredere high | 2 |
| `timeline.compile` v1 | timeline | Compilatorul storyboard → timeline (determinist, text măsurat cu fonturile reale) | storyboard, script, brief, brand, assets, research, voice, beatgrid, references → timeline | `src/timeline/compile.ts#compileTimeline` | `tests/integration/pipeline.test.ts`, `tests/unit/store-validate.test.ts` | implemented · încredere high | 1 |
| `timeline.validate` v1 | timeline | Validatorul: footage real, drepturi, cifre, zone sigure, 360 px, flash, goluri, date personale | timeline, assets, research → quality | `src/timeline/validate.ts#validateTimeline` | `tests/unit/store-validate.test.ts` | implemented · încredere high | 1 |
| `render.stills` v1 | render | Cadre randate (selectate) | timeline → stills | `src/renderer/node/render.ts#renderStills` | `tests/render/catalog.test.ts` | implemented · încredere high | 3 |
| `render.full` v1 | render | Video MP4 (întreg sau un interval de cadre) | timeline, mix → full-render, scene-render | `src/renderer/node/render.ts#renderTimelineVideo` | `tests/render/video.test.ts` | implemented · încredere high | 6 |
| `render.video-check` v1 | render | Verificarea video-ului randat: cadre negre, flash-uri, înghețări | full-render → critique | `src/renderer/node/analyze-video.ts#analyzeVideo` | `tests/render/video.test.ts` | implemented · încredere high | 3 |
| `critique.auto` v1 | critique | Critica automată cu rubrica fixă (rubric-v1), fiecare depunctare ca problemă structurată | timeline, brief, mix → critique | `src/critique/auto.ts#autoCritique` | `tests/unit/quality.test.ts` | implemented · încredere medium | 1 |
| `quality.score` v1 | quality | Scorul de calitate quality-v1: 11 categorii 0–100, verdict PASS/POLISH/FIX/FAIL | critique → quality | `src/quality/score.ts#scoreQuality` | `tests/unit/quality.test.ts` | implemented · încredere high | 0 |
| `platform.safe-zones` v1 | platform | Formate, zone sigure și zone excluse pe platformă (cu sursă și încredere) | brief → timeline | `src/core/formats.ts#resolveSafeZone` | `tests/unit/core.test.ts` | implemented · încredere medium | 0 |
| `export.final` v1 | export | Exportul final, doar cu „render final”, fără blocaje, cu mix „ok”, fără suprascriere | timeline, mix, quality → export | `src/pipeline/steps.ts#stepFinalRender` | `tests/integration/studio-lint.test.ts` | implemented · încredere high | 6 |
| `export.post-pack` v1 | export | Pachetul de postare (copertă + text din replicile aprobate) (Verificat manual (mms post-pack); fără test automat.) | timeline, script, brief → export | `src/pipeline/steps.ts#writePostPack` | — | partial · încredere medium | 3 |

## Pasele buclei de calitate și verificările lor

### PASS 0 – Plan: brief, afirmații, drepturi, validare

| Verificare | Metodă | Categorii | Pe format |
| --- | --- | --- | --- |
| `timeline.validate` – Validatorul timeline-ului (reguli dure: footage real, drepturi, cifre, zone, 360 px, flash, goluri) | timeline | claims, technical, platform, typography, ui | da |
| `claims.script` – Scriptul: fraze obligatorii exacte, afirmații verificate, cifre cu sursă, interdicții | static | claims, story | nu (formatul principal) |
| `claims.confidence` – Afirmațiile folosite: încredere și stare | static | claims | nu (formatul principal) |

### PASS 1 – Poveste: structură, hook, arc de energie, ritm

| Verificare | Metodă | Categorii | Pe format |
| --- | --- | --- | --- |
| `critique.rubric` – Rubrica fixă rubric-v1 (hook, claritate, ritm, ierarhie, varietate, brand, CTA) pe fiecare scenă | timeline | story, typography, motion | nu (formatul principal) |
| `story.structure` – Structura narativă: hook la început, recompensă înainte de CTA, problemă înaintea soluției | timeline | story, creative | nu (formatul principal) |
| `story.energy-arc` – Arcul de energie: escaladare, punct culminant, recompensă | timeline | story, creative | nu (formatul principal) |
| `story.brand-reveal` – Momentul în care apare brandul (logo sau numele produsului) | timeline | story, brand | nu (formatul principal) |
| `story.pacing` – Ritmul: durata medie a scenelor față de platformă și direcție | timeline | story, motion | da |

### PASS 2 – Vizual: contrast real, compoziție, aglomerare

| Verificare | Metodă | Categorii | Pe format |
| --- | --- | --- | --- |
| `visual.pixels` – Cadre-cheie randate: contrast real al textului, compoziție, spațiu gol, aglomerare | stills | visual, typography | da |

### PASS 3 – Mișcare: gramatică, repetiții, mișcare reală

| Verificare | Metodă | Categorii | Pe format |
| --- | --- | --- | --- |
| `motion.grammar` – Gramatica mișcării: odihnă vizuală, varietate de animații, tranziții | timeline | motion | nu (formatul principal) |
| `motion.scene` – Mișcarea reală în scene (secvențe de cadre): scene statice, mișcare excesivă | scene-render | motion | nu (formatul principal) |

### PASS 4 – Interfață: footage real, lizibilitate, rezoluție

| Verificare | Metodă | Categorii | Pe format |
| --- | --- | --- | --- |
| `ui.legibility` – Lizibilitatea interfeței reale pe ecran (scara capturii × zoom-ul camerei, la 360 px) | timeline | ui | da |
| `ui.caption-occlusion` – Subtitrările nu acoperă interfața sau materialul arătat (poziția reală pe ecran, cu camera) | timeline | ui, typography | da |

### PASS 5 – Tipografie: lizibilitate, consecvență

| Verificare | Metodă | Categorii | Pe format |
| --- | --- | --- | --- |
| `typography.caption-redundancy` – Subtitrările nu repetă textul deja scris pe ecran | timeline | typography | nu (formatul principal) |
| `typography.consistency` – Consecvența tipografică: familii, mărimi, densitate | timeline | typography | da |

### PASS 6 – Audio: mix, ritm, voce

| Verificare | Metodă | Categorii | Pe format |
| --- | --- | --- | --- |
| `audio.mix` – Raportul mixului: −14 LUFS, true peak, clipping, tăceri; voce acoperită; beat grid sigur | audio | audio | nu (formatul principal) |

### PASS 7 – Brand: consecvență, logo, culori, date la zi

| Verificare | Metodă | Categorii | Pe format |
| --- | --- | --- | --- |
| `brand.stale` – Timeline-ul e compilat din datele actuale (brief, brand, materiale, research)? | static | brand, technical | nu (formatul principal) |
| `brand.rules` – Regulile logo-ului (fără recolorare/rotire) și culorile din brand | timeline | brand | da |
| `brand.color-presence` – Culorile brandului se văd efectiv în cadrele randate | stills | brand | nu (formatul principal) |

### PASS 8 – Platformă: durată, hook, subtitrări, densitate

| Verificare | Metodă | Categorii | Pe format |
| --- | --- | --- | --- |
| `platform.profile` – Profilul platformei: durată, format, hook, subtitrări, densitatea textului, hold pe CTA | timeline | platform | da |

### PASS 9 – Final QA: determinism, fișiere, video randat, porți de export

| Verificare | Metodă | Categorii | Pe format |
| --- | --- | --- | --- |
| `technical.recompile` – Recompilare de control: același timeline octet cu octet (determinism) sau date învechite | static | technical | da |
| `final.video` – Video-ul randat: cadre negre, flash-uri, înghețări (refolosit dacă e la zi) | full-render | technical, motion | da |
