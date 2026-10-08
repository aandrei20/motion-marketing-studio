# Capabilitățile de sistem și bucla de calitate

Fișier generat din `src/pipeline/graph.ts` și `src/quality/checks.ts` de `npm run docs`. Graful de dependențe (intrări → ieșiri) decide ce se recalculează după o schimbare.

| Id | Domeniu | Ce face | Intrări → ieșiri | Implementare | Teste | Stare | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `research.capture` v1 | research | Captură reală (Playwright): capturi, zone din DOM, text, CSS, date personale | brief → captures, assets | `src/capture/capture.ts#capture` | `tests/integration/pipeline.test.ts` | implemented · încredere high | 5 |
| `research.extract` v1 | research | Afirmații cu citat, sursă, dată și încredere din paginile capturate | captures → research | `src/research/extract.ts#extractFromPage` | `tests/unit/creative.test.ts`, `tests/integration/pipeline.test.ts` | implemented · încredere high | 1 |
| `research.crawl` v1 | research | Research pe site: pagini relevante (prețuri, funcții, noutăți, documentație), fără login/aplicație; concurenții doar ca „de confirmat” | brief → research | `src/research/crawl.ts#crawlSite` | `tests/unit/research.test.ts` | implemented · încredere medium | 5 |
| `claims.graph` v1 | claims | Graful de afirmații: dovadă, sursă, încredere după coroborare, conflicte, concurenți | research → quality | `src/research/graph.ts#claimGraph` | `tests/unit/research.test.ts` | implemented · încredere high | 0 |
| `claims.script-gate` v1 | claims | Validarea scriptului: fraze obligatorii, afirmații utilizabile, cifre cu sursă, interdicții | script, research, brief → quality | `src/creative/script.ts#validateScript` | `tests/unit/creative.test.ts` | implemented · încredere high | 1 |
| `brand.infer` v1 | brand | Brand kit din CSS-ul paginii și din logo: culori, fonturi, rază, umbre, spațiere, gradiente | captures, assets → brand | `src/brand/infer.ts#inferBrand` | `tests/integration/pipeline.test.ts` | implemented · încredere medium | 1 |
| `assets.ingest` v1 | assets | Ingestie: sha256, duplicate, ffprobe, fonturi, SVG, paletă, punct focal, dHash, rol | captures → assets | `src/assets/ingest.ts#ingestFile` | `tests/unit/store-validate.test.ts`, `tests/integration/pipeline.test.ts` | implemented · încredere high | 2 |
| `assets.ocr` v1 | assets | OCR offline (Windows): text și zone din imagini, cu cache (Doar pe Windows.) | assets → assets | `src/assets/ocr.ts#ocrImage` | `tests/integration/assets-ocr.test.ts`, `tests/unit/pii.test.ts` | partial · încredere medium | 2 |
| `assets.pii` v1 | assets | Date personale în text (DOM și OCR), cu validatori (Luhn, IBAN, CNP) | captures, assets → assets | `src/assets/pii.ts#findPii` | `tests/unit/pii.test.ts` | implemented · încredere medium | 0 |
| `references.analyze` v1 | references | Profilul unei referințe video (tăieturi, mișcare, culoare, tempo, energie) (Include estimarea mișcării camerei și ponderea tăieturilor simple.) | assets → references | `src/references/analyze.ts#analyzeReference` | `tests/unit/references.test.ts` | implemented · încredere medium | 3 |
| `references.dna` v1 | references | Reference DNA → direcție: durata cadrelor, ritm, tranziții, cameră, tempo (doar sigur) | references, brief → timeline, beatgrid | `src/references/dna.ts#applyDna` | `tests/unit/references.test.ts` | implemented · încredere medium | 0 |
| `creative.intake` v1 | creative | Întrebările A–H cu variante | — → brief | `src/creative/intake.ts#intakeMarkdown` | — | implemented · încredere high | 0 |
| `creative.smart-intake` v1 | creative | Intake inteligent: deduce din pagina reală ce se poate, întreabă doar ce e incert și important | captures → brief | `src/creative/smart-intake.ts#inferIntake` | `tests/unit/creative-director.test.ts` | implemented · încredere medium | 5 |
| `creative.concepts` v1 | creative | Directorul creativ: teritorii din dovezi, concepte, scor pe 10 criterii, alegere (ideea utilizatorului prioritară) | brief, research, assets → concepts | `src/creative/concepts.ts#ensureConcepts` | `tests/unit/creative-director.test.ts` | implemented · încredere medium | 1 |
| `creative.templates` v1 | creative | Alegerea structurii (șablon) după categorie, direcție, durată, obiectiv | brief → storyboard | `src/creative/templates.ts#chooseTemplate` | `tests/unit/creative.test.ts` | implemented · încredere medium | 0 |
| `creative.script-draft` v1 | creative | Schița factuală de script (citatele din research + cuvintele utilizatorului) | brief, research → script | `src/creative/script.ts#draftScript` | `tests/unit/creative.test.ts` | implemented · încredere medium | 1 |
| `creative.storyboard` v1 | creative | Storyboard executabil din conceptul ales (șablon, direcție), script și materiale | script, brief, research, assets, concepts → storyboard | `src/creative/storyboard.ts#buildStoryboard` | `tests/unit/creative.test.ts` | implemented · încredere medium | 1 |
| `editing.grammar` v1 | editing | Gramatica de montaj: durate, tranziții, J-cut, hold pe CTA | storyboard, voice → timeline | `src/editing/grammar.ts#sceneDuration` | `tests/unit/creative.test.ts` | implemented · încredere high | 0 |
| `editing.nl-commands` v1 | editing | Comenzi în limbaj natural → operații locale pe storyboard/script | storyboard, script, timeline → storyboard, script | `src/iterate/intents.ts#parseCommand` | `tests/unit/creative.test.ts`, `tests/integration/pipeline.test.ts` | implemented · încredere medium | 0 |
| `audio.voice` v1 | audio | Vocea (TTS / fișier), cu amprentă și cache | script, brief → voice | `src/pipeline/steps.ts#stepVoice` | `tests/integration/pipeline.test.ts` | implemented · încredere high | 2 |
| `audio.beat` v1 | audio | Beat grid (tempo, fază, încredere) din muzica utilizatorului sau ales pentru muzica sintetizată | assets, brief, storyboard → beatgrid | `src/pipeline/steps.ts#planBeatGrid` | `tests/unit/audio.test.ts` | implemented · încredere medium | 2 |
| `audio.structure` v1 | audio | Structura muzicii utilizatorului: energie pe măsuri, secțiuni, drop-uri (dezvăluirea pe drop) | assets, beatgrid → beatgrid | `src/audio/beat.ts#musicStructure` | `tests/unit/audio-intel.test.ts` | implemented · încredere medium | 2 |
| `audio.mix` v1 | audio | Muzică, efecte, voce, ducking, −14 LUFS, true peak ≤ −1 dBTP, tăceri | timeline, storyboard, brief, beatgrid → mix | `src/pipeline/steps.ts#stepAudio` | `tests/unit/audio.test.ts`, `tests/integration/pipeline.test.ts` | implemented · încredere high | 2 |
| `timeline.compile` v1 | timeline | Compilatorul storyboard → timeline (determinist, text măsurat cu fonturile reale) | storyboard, script, brief, brand, assets, research, voice, beatgrid, references → timeline | `src/timeline/compile.ts#compileTimeline` | `tests/integration/pipeline.test.ts`, `tests/unit/store-validate.test.ts` | implemented · încredere high | 1 |
| `timeline.validate` v1 | timeline | Validatorul: footage real, drepturi, cifre, zone sigure, 360 px, flash, goluri, date personale | timeline, assets, research → quality | `src/timeline/validate.ts#validateTimeline` | `tests/unit/store-validate.test.ts` | implemented · încredere high | 1 |
| `render.stills` v1 | render | Cadre randate (selectate) | timeline → stills | `src/renderer/node/render.ts#renderStills` | `tests/render/catalog.test.ts` | implemented · încredere high | 3 |
| `render.full` v1 | render | Video MP4 (întreg sau un interval de cadre) | timeline, mix → full-render, scene-render | `src/renderer/node/render.ts#renderTimelineVideo` | `tests/render/video.test.ts` | implemented · încredere high | 6 |
| `render.video-check` v1 | render | Verificarea video-ului randat: cadre negre, flash-uri, înghețări | full-render → critique | `src/renderer/node/analyze-video.ts#analyzeVideo` | `tests/render/video.test.ts` | implemented · încredere high | 3 |
| `critique.auto` v1 | critique | Critica automată cu rubrica fixă (rubric-v1), fiecare depunctare ca problemă structurată | timeline, brief, mix → critique | `src/critique/auto.ts#autoCritique` | `tests/unit/quality.test.ts` | implemented · încredere medium | 1 |
| `critique.pixel` v1 | critique | Criticul pe pixeli: contrast real, spațiu gol, compoziție, aglomerare, culorile brandului (cadre-cheie din cache) | stills, timeline → critique | `src/critique/pixel.ts#analyzeSample` | `tests/unit/quality.test.ts` | implemented · încredere medium | 3 |
| `critique.visual-pack` v1 | critique | Pachetul de revizuire vizuală pentru criticul multimodal (Claude): cadre-cheie, foaie de contact, schema răspunsului (Verificat manual pe proiectul demo (revizuire claude-visual); fără test automat al pachetului.) | stills, timeline, quality → critique | `src/critique/pack.ts#critiquePack` | — | partial · încredere medium | 3 |
| `critique.review` v1 | critique | Observațiile lui Claude / ale utilizatorului (secunda X → cadru, scenă), validate strict (Verificat manual (mms review).) | timeline → critique | `src/pipeline/iterate.ts#addReview` | — | partial · încredere high | 0 |
| `quality.loop` v1 | quality | Bucla de calitate adaptivă: 10 pase, metoda cea mai ieftină permisă de adâncime, cache pe amprente | timeline, mix, brief, research, assets, brand, script, storyboard → quality, critique, stills, scene-render, full-render | `src/quality/run.ts#runQuality` | `tests/integration/pipeline.test.ts` | implemented · încredere high | 3 |
| `quality.autofix` v1 | quality | Corecturi automate sigure, cu verificare doar a ce s-a schimbat și rollback (Rulat cap-coadă pe proiectul demo (npm run e2e -- --autofix); fără test automat dedicat pentru rollback (rollback-ul de versiune e testat în integrare).) | quality, storyboard → storyboard | `src/quality/autofix.ts#autoFixLoop` | — | partial · încredere medium | 4 |
| `quality.impact` v1 | quality | Motorul de impact: amprente pe artefacte și scene, diferența dintre versiuni, planul minim de lucru | storyboard, script, timeline, mix → quality | `src/pipeline/impact.ts#planImpact` | `tests/unit/quality.test.ts`, `tests/integration/pipeline.test.ts` | implemented · încredere high | 0 |
| `editing.ops` v1 | editing | Operațiile de editare pe storyboard (editor, corecturi automate) | storyboard → storyboard | `src/editing/ops.ts#applyEditOps` | `tests/unit/quality.test.ts` | implemented · încredere high | 0 |
| `editing.history` v1 | editing | Undo / redo pe jurnalul de operații și snapshot-uri | storyboard → storyboard | `src/editing/history.ts#applyEdit` | `tests/integration/pipeline.test.ts` | implemented · încredere high | 0 |
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
| `creative.concept` – Conceptul creativ: ales, susținut de dovezi, respectat de storyboard | static | creative | nu (formatul principal) |

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
| `ui.caption-occlusion` – Subtitrările nu acoperă elementul demonstrat (zona țintită, pe ecran, cu decupaj, scroll și cameră) | timeline | ui, typography | da |

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
| `platform.reframing` – Reîncadrarea pe format: zona demonstrată rămâne în cadru și în zona sigură la momentul de hold | timeline | platform, ui | da |

### PASS 9 – Final QA: determinism, fișiere, video randat, porți de export

| Verificare | Metodă | Categorii | Pe format |
| --- | --- | --- | --- |
| `technical.recompile` – Recompilare de control: același timeline octet cu octet (determinism) sau date învechite | static | technical | da |
| `final.video` – Video-ul randat: cadre negre, flash-uri, înghețări (refolosit dacă e la zi) | full-render | technical, motion | da |
