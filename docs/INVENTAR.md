# Inventarul de design și producție

Fișier generat din `src/inventory/inventory.ts` de `npm run docs` – nu îl edita de mână. Testul `tests/unit/inventory.test.ts` verifică fiecare trimitere la cod: un element „IMPLEMENTED” fără implementare reală pică testul.

Priorități: **P0** esențial pentru un rezultat profesional · **P1** valoare mare · **P2** avansat · **P3** experimental / nișă.

| Stare | Total | P0 | P1 | P2 | P3 |
| --- | --- | --- | --- | --- | --- |
| IMPLEMENTED | 159 | 83 | 46 | 26 | 4 |
| PARTIAL | 25 | 2 | 10 | 8 | 5 |
| MISSING | 13 | 0 | 0 | 10 | 3 |
| REDUNDANT | 0 | 0 | 0 | 0 | 0 |
| PLANNED | 0 | 0 | 0 | 0 | 0 |
| **toate** | **197** | 85 | 56 | 44 | 12 |

## Design vizual (33)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Layout pe orientare și compoziție | P0 | IMPLEMENTED | `module:src/recipes/kit.ts#zones` | — |
| Compoziție (treimi, centru, split, full-bleed, stivă) | P0 | IMPLEMENTED | `module:src/recipes/kit.ts#zones`, `check:visual.pixels` | — |
| Grilă de layout (coloane, linie de bază) | P2 | PARTIAL | `module:src/recipes/kit.ts#zones` | Zonele au proporții fixe pe orientare; nu există o grilă de coloane din brand. **Următorul pas:** Grilă derivată din brand.shape.spacing, folosită de zones(). |
| Spațiere consecventă | P1 | PARTIAL | `module:src/recipes/kit.ts#padRect` | Spațierea vine din zone și padding-uri locale, nu din tokenul brandului. **Următorul pas:** Rețetele să folosească brand.shape.spacing ca unitate. |
| Aliniere (stânga, centru, dreapta; sus/mijloc/jos) | P0 | IMPLEMENTED | `module:src/motion/typography/shared.tsx#TextBase` | — |
| Ierarhie vizuală (un singur erou pe moment) | P0 | IMPLEMENTED | `check:critique.rubric` | — |
| Scară (text adaptat la cutie cu fontul real) | P0 | IMPLEMENTED | `module:src/motion/core/text-layout.ts#layoutText` | — |
| Echilibru vizual | P2 | PARTIAL | `check:visual.pixels` | Se măsoară ocuparea cadrului, nu centrul de greutate vizuală. **Următorul pas:** Metrica de centroid al detaliului în criticul pe pixeli. |
| Contrast real (măsurat pe pixeli) și contrastul paletei | P0 | IMPLEMENTED | `check:visual.pixels`, `check:critique.rubric` | — |
| Spațiu negativ intenționat vs. spațiu gol | P1 | PARTIAL | `check:visual.pixels` | Spațiul gol e detectat euristic (încredere 0,5), fără intenție declarată în storyboard. **Următorul pas:** Câmp „negativeSpace” în compoziție; criticul îl tolerează când e intenționat. |
| Adâncime: prim-plan, plan mediu, fundal (parallax) | P0 | IMPLEMENTED | `module:src/motion/camera/rig.ts#layerTransform`, `cap:camera.parallax-drift` | — |
| Punct focal (din captură, automat sau dat de utilizator) | P0 | IMPLEMENTED | `module:src/assets/analyze.ts#focalPoint`, `cap:camera.focus-track` | — |
| Ritm vizual (alternanță calm/activ) | P1 | PARTIAL | `check:motion.grammar`, `check:critique.rubric` | Se detectează lipsa de odihnă vizuală și monotonia; nu se planifică alternanța în storyboard. **Următorul pas:** Profil de energie țintă pe scene, folosit de constructorul de storyboard. |
| Încadrare (rame de dispozitiv, decupaj pe vertical) | P0 | IMPLEMENTED | `cap:frame.browser`, `cap:frame.phone`, `module:src/recipes/kit.ts#portraitCrop` | — |
| Zone de siguranță și zone excluse pe platformă | P0 | IMPLEMENTED | `module:src/core/formats.ts#resolveSafeZone`, `check:timeline.validate` | — |
| Decupare (zonă din captură, crop pe format) | P0 | IMPLEMENTED | `cap:media.screen`, `module:src/recipes/kit.ts#portraitCrop` | — |
| Măști și decupaje animate | P1 | IMPLEMENTED | `cap:mod.mask-reveal`, `cap:text.mask-reveal`, `cap:tr.mask-iris` | — |
| Gradiente | P1 | IMPLEMENTED | `cap:bg.gradient`, `cap:bg.mesh` | — |
| Umbre (straturi și text) | P1 | IMPLEMENTED | `cap:mod.shadow`, `module:src/motion/typography/shared.tsx#TextBase` | — |
| Lumini de evidențiere (sweep) | P2 | IMPLEMENTED | `cap:fx.light-sweep`, `cap:logo.light-pass` | — |
| Strălucire | P2 | IMPLEMENTED | `cap:mod.glow`, `cap:fx.glow-orbs` | — |
| Lumină (raze, scurgeri, flare) | P2 | IMPLEMENTED | `cap:fx.god-rays`, `cap:fx.light-leak`, `cap:fx.lens-flare` | — |
| Reflexii | P3 | IMPLEMENTED | `cap:mod.reflection` | — |
| Textură, zgomot, grain | P1 | IMPLEMENTED | `cap:fx.grain`, `cap:fx.scanlines` | — |
| Blur | P1 | IMPLEMENTED | `cap:mod.blur`, `cap:tr.blur` | — |
| Profunzime de câmp | P2 | IMPLEMENTED | `cap:camera.rack-focus` | — |
| Vignetă | P2 | IMPLEMENTED | `cap:fx.vignette` | — |
| Tratament de culoare / color grading | P1 | IMPLEMENTED | `cap:mod.color-grade` | — |
| Overlay-uri (ceață, sticlă, scurgeri de lumină) | P2 | IMPLEMENTED | `cap:fx.fog`, `cap:fx.glass`, `cap:fx.light-leak` | — |
| Moduri de amestec (blend) | P2 | MISSING | — | **Următorul pas:** Modificator generic mod.blend (mix-blend-mode), randat și testat în catalog. |
| Carduri, panouri, containere | P1 | IMPLEMENTED | `cap:shape.panel`, `cap:media.cards` | — |
| Fundaluri (plin, gradient, mesh, grilă, imagine, valuri) | P0 | IMPLEMENTED | `cap:bg.solid`, `cap:bg.mesh`, `cap:bg.image`, `cap:bg.waves` | — |
| Elemente decorative | P2 | IMPLEMENTED | `cap:fx.shapes`, `cap:shape.line-draw`, `cap:shape.ring-pulse` | — |

## Tipografie (20)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Perechi de fonturi (titlu + text + mono) | P0 | IMPLEMENTED | `module:src/brand/infer.ts#matchLibraryFont` | — |
| Ierarhie tipografică (raport principal/secundar) | P0 | IMPLEMENTED | `check:critique.rubric`, `check:typography.consistency` | — |
| Mărimi calculate cu fontul real + test 360 px | P0 | IMPLEMENTED | `module:src/motion/core/text-layout.ts#layoutText`, `check:timeline.validate` | — |
| Tracking (spațiere între litere) | P1 | IMPLEMENTED | `cap:text.tracking`, `module:src/motion/typography/shared.tsx#TextBase` | — |
| Kerning | P3 | PARTIAL | `module:src/motion/typography/shared.tsx#TextBase` | Kerning-ul din font (implicit în browser); fără control per pereche. **Următorul pas:** Doar dacă un brand o cere explicit. |
| Interlinie | P1 | IMPLEMENTED | `module:src/motion/typography/shared.tsx#TextBase` | — |
| Rânduri echilibrate | P0 | IMPLEMENTED | `module:src/motion/core/text-layout.ts#layoutText` | — |
| Apariția textului (cuvânt, literă, mască, blur) | P0 | IMPLEMENTED | `cap:text.word-reveal`, `cap:text.char-reveal`, `cap:text.mask-reveal`, `cap:text.blur-reveal` | — |
| Tipografie kinetică (slam, pop, split, cuvânt mare) | P0 | IMPLEMENTED | `cap:text.slam`, `cap:text.pop`, `cap:text.split`, `cap:text.big-word` | — |
| Accent pe cuvânt (culoare, marker lizibil, subliniere, cerc) | P0 | IMPLEMENTED | `cap:text.highlight` | — |
| Animație pe caracter (mașină de scris, glitch) | P2 | IMPLEMENTED | `cap:text.typewriter`, `cap:text.glitch`, `cap:text.char-reveal` | — |
| Text mascat | P2 | IMPLEMENTED | `cap:text.mask-reveal`, `cap:text.outline-fill` | — |
| Morph între două texte | P3 | MISSING | — | **Următorul pas:** text.morph generic, doar dacă o direcție creativă îl cere. |
| Contoare (legate de o afirmație verificată) | P1 | IMPLEMENTED | `cap:text.counter`, `check:timeline.validate` | — |
| Subtitrări cuvânt cu cuvânt, poziție care ocolește interfața, fără dublarea textului | P0 | IMPLEMENTED | `cap:text.captions`, `module:src/timeline/compile.ts#captionSegments`, `check:ui.caption-occlusion`, `check:typography.caption-redundancy` | — |
| Fișier .srt | P0 | IMPLEMENTED | `module:src/pipeline/steps.ts#toSrt` | — |
| Adnotări și callout-uri | P1 | IMPLEMENTED | `cap:ui.callout`, `cap:ui.tooltip` | — |
| Badge-uri / etichete | P2 | PARTIAL | `cap:shape.panel`, `cap:text.body` | Se compun din panou + text; fără capabilitate dedicată. **Următorul pas:** ui.badge generic dacă rețetele îl folosesc des. |
| Titluri și subtitluri | P0 | IMPLEMENTED | `cap:text.mask-reveal`, `cap:text.body` | — |
| Tipografia CTA (card final) | P0 | IMPLEMENTED | `recipe:cta-end` | — |

## Interfață și vizualizarea produsului (21)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Rame: browser, telefon, laptop, desktop | P0 | IMPLEMENTED | `cap:frame.browser`, `cap:frame.phone`, `cap:frame.laptop`, `cap:frame.desktop` | — |
| Interfața reală (captură Playwright, înregistrare cadru cu cadru) | P0 | IMPLEMENTED | `module:src/capture/capture.ts#capture`, `check:timeline.validate` | — |
| Interfață responsive (desktop / mobil) | P1 | PARTIAL | `module:src/capture/capture.ts#capture` | Capturi pe mai multe viewport-uri; fără trecere animată între ele într-o scenă. **Următorul pas:** Rețetă desktop→mobil cu două capturi reale. |
| Cursor | P0 | IMPLEMENTED | `cap:ui.cursor` | — |
| Clicuri | P0 | IMPLEMENTED | `cap:ui.click`, `sfx:click` | — |
| Hover | P1 | IMPLEMENTED | `cap:ui.hover` | — |
| Focus pe un element | P1 | IMPLEMENTED | `cap:ui.spotlight`, `cap:ui.highlight` | — |
| Tastare | P0 | IMPLEMENTED | `cap:ui.typing`, `sfx:key` | — |
| Scroll animat pe captură | P0 | IMPLEMENTED | `cap:media.screen`, `recipe:scroll-tour` | — |
| Navigare (clic real înregistrat) | P1 | IMPLEMENTED | `module:src/capture/capture.ts#capture`, `recipe:ui-walkthrough` | Navigarea se arată din înregistrarea reală (pași de captură), nu redesenată. |
| Stări reale: încărcare, gol, succes, eroare, dialoguri, formulare, meniuri | P1 | PARTIAL | `module:src/capture/capture.ts#capture` | Se pot arăta doar dacă au fost capturate (pașii de captură); nu se inventează (regula 1). **Următorul pas:** Pași de captură predefiniți pentru stări uzuale (validare formular, toast de succes). |
| Notificări (grafică generică, nu interfața produsului) | P2 | IMPLEMENTED | `cap:ui.notification`, `sfx:notification` | — |
| Tooltip-uri | P1 | IMPLEMENTED | `cap:ui.tooltip` | — |
| Înainte / după | P1 | IMPLEMENTED | `cap:media.compare`, `recipe:before-after` | — |
| Zoom pe zona funcției (din zonele DOM ale capturii) | P0 | IMPLEMENTED | `module:src/recipes/kit.ts#regionFocus`, `cap:camera.push` | — |
| Spotlight / magnifier | P1 | IMPLEMENTED | `cap:ui.spotlight`, `cap:ui.zoom-lens` | — |
| Callout pe funcție (mărime constantă pe ecran) | P0 | IMPLEMENTED | `cap:ui.callout`, `recipe:ui-spotlight` | — |
| Lizibilitatea interfeței pe ecran (scară × zoom) | P0 | IMPLEMENTED | `check:ui.legibility` | — |
| Date personale estompate în capturi | P0 | PARTIAL | `cap:ui.blur-region`, `check:timeline.validate` | Detecția acoperă emailurile din DOM; telefoanele, numele și textul din imagini nu. **Următorul pas:** Detecție DOM pentru telefon/IBAN/ID-uri + OCR pe imagini (Windows OCR). |
| Cod și terminal (grafică generică) | P2 | IMPLEMENTED | `cap:ui.code`, `cap:ui.terminal` | — |
| Vizualizare de date legate de afirmații | P1 | IMPLEMENTED | `cap:data.bars`, `cap:data.line`, `cap:data.ring`, `recipe:proof-metric` | — |

## Mișcare (15)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Poziție, scară, rotație, opacitate | P0 | IMPLEMENTED | `cap:mod.enter` | — |
| Înclinare (skew) | P3 | PARTIAL | `cap:mod.tilt-3d` | Înclinare 3D, fără skew 2D. **Următorul pas:** Parametru skew în mod.enter, doar la cerere. |
| Perspectivă 3D (CSS) | P1 | IMPLEMENTED | `cap:mod.tilt-3d`, `cap:media.device-3d`, `cap:media.stack-3d` | — |
| Easing, spring, overshoot, elastic | P0 | IMPLEMENTED | `module:src/motion/core/easing.ts#SPRINGS`, `module:src/motion/core/easing.ts#EASE` | — |
| Anticipație (mișcare inversă scurtă înainte de acțiune) | P2 | MISSING | — | **Următorul pas:** Opțiune „anticipate” în mod.enter (recul de 4–6 cadre). |
| Follow-through / settle | P2 | IMPLEMENTED | `module:src/motion/core/easing.ts#SPRINGS` | — |
| Stagger și cascadă | P0 | IMPLEMENTED | `cap:text.word-reveal`, `cap:media.cards` | — |
| Morph de forme | P3 | MISSING | — | **Următorul pas:** Doar dacă o direcție creativă îl cere (SVG path morph). |
| Revelare / wipe / mască | P0 | IMPLEMENTED | `cap:mod.mask-reveal`, `cap:tr.wipe` | — |
| Particule | P2 | IMPLEMENTED | `cap:fx.particles`, `cap:fx.burst`, `cap:logo.particles` | — |
| Mișcare procedurală (zgomot cu sămânță) | P1 | IMPLEMENTED | `module:src/core/random.ts#noise1`, `cap:bg.waves`, `cap:fx.trails` | — |
| Mișcare fizică (gravitație, coliziuni) | P3 | PARTIAL | `module:src/motion/core/easing.ts#sp` | Doar arcuri (spring); fără gravitație sau coliziuni. **Următorul pas:** Doar la cerere. |
| Impact, tremur de ecran, punch pe ritm | P1 | IMPLEMENTED | `cap:camera.shake`, `cap:camera.beat-punch`, `cap:text.slam`, `sfx:impact` | — |
| Mișcare organică (plutire, mână liberă) | P2 | IMPLEMENTED | `cap:mod.float`, `cap:camera.handheld` | — |
| Verificarea mișcării reale (scene statice, mișcare excesivă) | P1 | IMPLEMENTED | `check:motion.scene`, `check:motion.grammar` | — |

## Tranziții (16)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Tăietură simplă | P0 | IMPLEMENTED | `cap:tr.cut` | — |
| Dizolvare / fade | P0 | IMPLEMENTED | `cap:tr.dissolve`, `cap:tr.dip` | — |
| Whip pan | P1 | IMPLEMENTED | `cap:tr.whip`, `cap:camera.whip` | — |
| Zoom-through | P1 | IMPLEMENTED | `cap:tr.zoom-through`, `cap:tr.scale` | — |
| Match cut (aceeași poziție/formă peste tăietură) | P1 | PARTIAL | `cap:tr.parallax-handoff`, `cap:tr.push-through` | Continuitatea mișcării e păstrată; potrivirea automată de formă/poziție între scene nu. **Următorul pas:** Ancore de potrivire în storyboard (același punct pe ecran la ieșire și la intrare). |
| Graphic match | P2 | MISSING | — | **Următorul pas:** Odată cu ancorele de potrivire (match cut). |
| Wipe și mască (iris, diagonală) | P1 | IMPLEMENTED | `cap:tr.wipe`, `cap:tr.mask-iris`, `cap:tr.mask-diagonal` | — |
| Tranziție prin blur | P2 | IMPLEMENTED | `cap:tr.blur` | — |
| Flash și lumină (max. 2 flash-uri/s) | P1 | IMPLEMENTED | `cap:tr.flash`, `cap:tr.light-leak`, `check:timeline.validate` | — |
| Tranziții direcționale cu continuitate | P1 | IMPLEMENTED | `cap:tr.push`, `cap:tr.slide`, `module:src/editing/grammar.ts#continuityDirection` | — |
| Tranziție prin obiect (element care trece dintr-o scenă în alta) | P2 | MISSING | — | **Următorul pas:** Strat global cu interval peste două scene, după ancorele de potrivire. |
| Tranziție de cameră (push-through) | P1 | IMPLEMENTED | `cap:tr.push-through` | — |
| Trecere fără cusătură | P2 | IMPLEMENTED | `cap:tr.parallax-handoff` | — |
| Tăieturi pe bătaie | P0 | IMPLEMENTED | `module:src/timeline/compile.ts#compileTimeline`, `op:beat-snap` | — |
| Alegerea tranziției după energie și direcție, fără repetiție | P0 | IMPLEMENTED | `module:src/editing/grammar.ts#chooseTransition` | — |
| Glitch, film strip, ripple, speed ramp | P3 | IMPLEMENTED | `cap:tr.glitch`, `cap:tr.film-strip`, `cap:tr.ripple`, `cap:tr.speed-ramp` | — |

## Montaj (15)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Tipuri de cadre (establishing, hero, close-up, insert, detail, wide, title, montage) | P0 | IMPLEMENTED | `module:src/editing/grammar.ts#baseShotSec` | — |
| Durata scenelor din voce, timp de citire, ritm și rețetă | P0 | IMPLEMENTED | `module:src/editing/grammar.ts#sceneDuration` | — |
| Hold pe CTA (minimum 2,5 s) | P0 | IMPLEMENTED | `module:src/editing/grammar.ts#CTA_HOLD_SEC`, `check:platform.profile` | — |
| J-cut (vocea începe înaintea imaginii) | P1 | IMPLEMENTED | `module:src/editing/grammar.ts#voiceLeadFrames` | — |
| L-cut (vocea continuă peste imaginea următoare) | P2 | MISSING | — | **Următorul pas:** Opțiune în storyboard: replica scenei continuă peste începutul scenei următoare. |
| Construcție, escaladare, punct culminant, recompensă | P0 | IMPLEMENTED | `check:story.energy-arc`, `check:story.structure` | — |
| Ritm și frecvența tăieturilor (pe platformă) | P0 | IMPLEMENTED | `check:story.pacing`, `module:src/platform/profiles.ts#platformProfile` | — |
| Pattern interrupt / resetare vizuală | P2 | PARTIAL | `cap:tr.glitch`, `cap:tr.flash` | Există efectele, nu există primitivul de montaj („rupe tiparul aici”). **Următorul pas:** Rol de scenă „interrupt” cu reguli în gramatica de montaj. |
| Montaj și secvențe | P1 | IMPLEMENTED | `recipe:feature-montage`, `recipe:kinetic-sequence` | — |
| Repetiție și variație (rețete, camere, tranziții) | P0 | IMPLEMENTED | `check:critique.rubric`, `check:motion.grammar` | — |
| Tăcere intenționată | P2 | IMPLEMENTED | `module:src/audio/mixer.ts#mix` | — |
| Speed ramp | P2 | IMPLEMENTED | `cap:tr.speed-ramp` | — |
| Operații de editare: durată, ștergere, duplicare, mutare, blocare, sunet, text, material, cameră, tranziție, straturi | P0 | IMPLEMENTED | `module:src/editing/ops.ts#applyEditOps`, `op:scene-duplicate`, `op:scene-move`, `op:layer-hide` | — |
| Undo / redo (jurnal de operații + snapshot-uri) | P0 | IMPLEMENTED | `module:src/editing/history.ts#undo`, `module:src/editing/history.ts#redo` | — |
| Comenzi în limbaj natural | P1 | IMPLEMENTED | `module:src/iterate/intents.ts#parseCommand` | — |

## Cameră și limbaj cinematic (12)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Larg, mediu, aproape, macro (zoom pe regiune) | P0 | IMPLEMENTED | `cap:camera.push`, `module:src/recipes/kit.ts#regionFocus` | — |
| Push-in / pull-out | P0 | IMPLEMENTED | `cap:camera.push`, `cap:camera.pull` | — |
| Urmărire (focus-track) | P1 | IMPLEMENTED | `cap:camera.focus-track` | — |
| Pan și tilt | P1 | IMPLEMENTED | `cap:camera.pan`, `cap:camera.tilt` | — |
| Orbită | P2 | IMPLEMENTED | `cap:camera.orbit` | — |
| Mișcare de macara (crane) | P3 | PARTIAL | `cap:camera.tilt`, `cap:camera.push` | Se obține combinând tilt + push; fără preset dedicat. **Următorul pas:** Preset camera.crane doar dacă o direcție îl folosește. |
| Mână liberă simulată | P2 | IMPLEMENTED | `cap:camera.handheld` | — |
| Rack focus | P2 | IMPLEMENTED | `cap:camera.rack-focus` | — |
| Dolly zoom | P3 | IMPLEMENTED | `cap:camera.dolly-zoom` | — |
| Efecte de lentilă (flare, aberație cromatică) | P3 | IMPLEMENTED | `cap:fx.lens-flare`, `cap:mod.chromatic` | — |
| Blur de mișcare calibrat (180°) | P1 | IMPLEMENTED | `module:src/motion/camera/rig.ts#cameraMotionBlur` | — |
| Schimbări de viteză (playbackRate, speed ramp) | P2 | IMPLEMENTED | `cap:media.video`, `cap:tr.speed-ramp` | — |

## Audio (17)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Voce (TTS offline / cheie API / fișierul utilizatorului) | P0 | IMPLEMENTED | `module:src/pipeline/steps.ts#stepVoice` | — |
| Muzică originală pe structura reclamei sau muzica utilizatorului | P0 | IMPLEMENTED | `module:src/audio/music.ts#composeMusic` | — |
| Beat grid: tempo, fază, măsuri, încredere | P0 | IMPLEMENTED | `module:src/audio/beat.ts#detectBeatGrid`, `check:audio.mix` | — |
| Secțiuni muzicale, energie pe măsuri, drop-uri (dezvăluirea pe drop) | P1 | IMPLEMENTED | `module:src/audio/beat.ts#musicStructure` | — |
| Efecte sonore originale (impact, whoosh, riser, click, UI, notificare) | P0 | IMPLEMENTED | `sfx:impact`, `sfx:whoosh`, `sfx:riser`, `sfx:click`, `sfx:notification` | — |
| Ambianță (room tone) | P2 | MISSING | — | **Următorul pas:** Strat de ambianță sintetizat discret, opțional în brief. |
| Ducking al muzicii sub voce (rampă 500 ms) | P0 | IMPLEMENTED | `module:src/audio/mixer.ts#duckEnvelope` | — |
| Efectele sub voce (−4 dB, rampă scurtă) | P1 | IMPLEMENTED | `module:src/audio/mixer.ts#mix` | — |
| EQ / filtre | P2 | IMPLEMENTED | `module:src/audio/dsp.ts#eq`, `module:src/audio/dsp.ts#band` | — |
| Compresie pe voce | P2 | MISSING | — | **Următorul pas:** Compresor simplu pe stem-ul de voce înainte de mix. |
| Loudness −14 LUFS, true peak ≤ −1 dBTP, limitator | P0 | IMPLEMENTED | `module:src/audio/dsp.ts#limit`, `check:audio.mix` | — |
| Tăceri neintenționate peste 1 s | P0 | IMPLEMENTED | `check:audio.mix` | — |
| Pauze în voce | P1 | IMPLEMENTED | `module:src/core/schema/script.ts#ScriptLine` | — |
| Accent în voce | P2 | PARTIAL | `module:src/core/schema/script.ts#ScriptLine` | Accentul e doar vizual; TTS-ul de sistem nu primește SSML de accent. **Următorul pas:** SSML pentru furnizorii care îl acceptă. |
| Pronunție | P1 | IMPLEMENTED | `module:src/core/schema/script.ts#ScriptLine` | — |
| Cue sheet: fiecare efect vizual își declară sunetul | P0 | IMPLEMENTED | `module:src/timeline/compile.ts#compileTimeline` | — |
| Mix adresat prin conținut (nu se recalculează dacă intrările nu s-au schimbat) | P1 | IMPLEMENTED | `module:src/pipeline/impact.ts#audioKey` | — |

## Grafică (7)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Iconițe (set original, licență proprie) | P2 | MISSING | — | **Următorul pas:** Set mic de iconițe SVG originale ca strat generic (icon.<nume>). |
| Linii, conectori, săgeți | P2 | PARTIAL | `cap:shape.line-draw` | Linii desenate; fără vârf de săgeată. **Următorul pas:** Parametru arrowhead în shape.line-draw. |
| Diagrame / cronologii | P2 | PARTIAL | `cap:data.timeline` | Doar cronologie. **Următorul pas:** Diagramă de flux generică (noduri + conectori). |
| Grafice (bare, linie, inel, comparație, pie) | P1 | IMPLEMENTED | `cap:data.bars`, `cap:data.line`, `cap:data.ring`, `cap:data.compare`, `cap:data.pie` | — |
| Indicatori de progres | P2 | IMPLEMENTED | `cap:ui.progress` | — |
| Marcaje, evidențieri, etichete | P1 | IMPLEMENTED | `cap:text.highlight`, `cap:ui.callout` | — |
| Forme decorative, grile, rame | P2 | IMPLEMENTED | `cap:fx.shapes`, `cap:bg.grid`, `cap:shape.panel` | — |

## Brand (9)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Logo (doar scară uniformă; reguli de brand) | P0 | IMPLEMENTED | `cap:logo.reveal`, `cap:logo.lockup`, `check:brand.rules` | — |
| Culori din CSS și logo | P0 | IMPLEMENTED | `module:src/brand/infer.ts#inferBrand`, `check:brand.color-presence` | — |
| Fonturi (biblioteca OFL sau fontul utilizatorului cu drepturi) | P0 | IMPLEMENTED | `module:src/brand/infer.ts#matchLibraryFont` | — |
| Raze de colț, umbre, spațiere din CSS-ul real, folosite de cardurile și butoanele rețetelor | P1 | IMPLEMENTED | `module:src/brand/infer.ts#brandShape`, `module:src/recipes/kit.ts#cardRadius` | — |
| Gradiente de brand (citite din CSS; altfel primar → accent) | P2 | IMPLEMENTED | `module:src/brand/infer.ts#brandShape` | — |
| Consecvența brandului în reclamă (paletă, logo, date la zi) | P0 | IMPLEMENTED | `check:brand.rules`, `check:brand.stale` | — |
| Stilul imaginilor / ilustrațiilor / iconițelor | P3 | MISSING | — | **Următorul pas:** Descriere în brand.json, completată de Claude din capturi. |
| Limbajul de mișcare al brandului | P1 | PARTIAL | `module:src/creative/directions.ts#DIRECTIONS` | Direcțiile A–F definesc mișcarea; brand.personality.motion nu ajustează încă direcția. **Următorul pas:** brand.personality.motion să moduleze viteza și tranzițiile direcției. |
| Tonul vocii (copy) | P1 | PARTIAL | `module:src/core/schema/brief.ts#Brief` | Tonul vine din brief; nu se extrage din textul site-ului. **Următorul pas:** Claude rezumă tonul din research în brief (sugestie, aprobată de utilizator). |

## Conținut publicitar (13)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Hook (al utilizatorului cuvânt cu cuvânt + variante marcate „sugestie”) | P0 | IMPLEMENTED | `recipe:hook-kinetic`, `module:src/creative/script.ts#draftScript`, `check:critique.rubric` | — |
| Problemă / tensiune | P0 | IMPLEMENTED | `recipe:problem-statement` | — |
| Promisiune / dezvăluire | P0 | IMPLEMENTED | `recipe:product-reveal` | — |
| Dovadă (cifre doar cu afirmație verificată) | P0 | IMPLEMENTED | `recipe:proof-metric`, `check:timeline.validate` | — |
| Demonstrație pe interfața reală | P0 | IMPLEMENTED | `recipe:ui-walkthrough`, `recipe:technical-demo`, `recipe:ui-spotlight` | — |
| Beneficiu | P0 | IMPLEMENTED | `recipe:steps`, `recipe:feature-montage` | — |
| Diferențiere | P1 | PARTIAL | `recipe:before-after` | Fără rețetă de comparație cu alternativa (afirmațiile despre concurenți cer surse). **Următorul pas:** Rețetă „noi vs. vechiul mod” fără nume de concurenți. |
| Răspuns la obiecții | P2 | MISSING | — | **Următorul pas:** Rol narativ „objection” și o linie de șablon. |
| Dovadă socială (testimoniale) | P1 | PARTIAL | `module:src/core/schema/research.ts#Claim` | Categoria „testimonial” există în afirmații; nu există rețetă de testimonial. **Următorul pas:** Rețetă de citat cu sursă (fără chipuri, regula 2). |
| Transformare | P1 | IMPLEMENTED | `recipe:before-after` | — |
| CTA, hold pe CTA, card final | P0 | IMPLEMENTED | `recipe:cta-end`, `check:platform.profile` | — |
| Reamintirea brandului (logo la dezvăluire și la final) | P0 | IMPLEMENTED | `check:story.brand-reveal` | — |
| Structuri de reclamă (8 șabloane) | P0 | IMPLEMENTED | `template:saas`, `template:product-launch`, `template:teaser-15`, `template:cinematic` | — |

## Gramatica reclamei (5)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Curiozitate (rol emoțional) | P0 | IMPLEMENTED | `module:src/core/schema/storyboard.ts#EmotionalRole` | — |
| Escaladare și punct culminant | P0 | IMPLEMENTED | `check:story.energy-arc` | — |
| Hook → problemă → dezvăluire → dovadă → recompensă → CTA | P0 | IMPLEMENTED | `check:story.structure` | — |
| Recompensă emoțională și de produs | P0 | IMPLEMENTED | `module:src/core/schema/storyboard.ts#NarrativeRole` | — |
| Pattern interrupt | P2 | PARTIAL | `cap:tr.glitch` | Vezi montaj.pattern-interrupt. **Următorul pas:** Rol de scenă „interrupt”. |

## Platformă (5)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Formate 9:16, 16:9, 1:1, 4:5, 4K, personalizat | P0 | IMPLEMENTED | `module:src/core/formats.ts#makeFormat` | — |
| Zone sigure și zonele butoanelor platformei | P0 | IMPLEMENTED | `module:src/core/formats.ts#resolveSafeZone`, `check:timeline.validate` | — |
| Zone pentru subtitrări (fără ocluzie) | P0 | IMPLEMENTED | `module:src/timeline/compile.ts#captionSegments`, `check:ui.caption-occlusion` | — |
| Profiluri configurabile: TikTok, Reels, Shorts, YouTube, LinkedIn, X, Feed | P0 | IMPLEMENTED | `module:src/platform/profiles.ts#platformProfile`, `check:platform.profile` | — |
| Reîncadrare pe format (adaptoare de layout, decupaj, camera pe zona media) | P0 | PARTIAL | `module:src/recipes/kit.ts#portraitCrop`, `module:src/recipes/kit.ts#zones` | Adaptoarele rearanjează conținutul; nu există o verificare că zona țintită rămâne vizibilă pe fiecare format. **Următorul pas:** Verificare „reframing”: zona de interes a scenei e în zona media vizibilă la hold, pe fiecare format. |

## Materiale și media (9)

| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |
| --- | --- | --- | --- | --- |
| Capturi reale (2×, pagină întreagă, mobil) | P0 | IMPLEMENTED | `module:src/capture/capture.ts#capture` | — |
| Înregistrări de ecran la FPS constant | P0 | IMPLEMENTED | `module:src/capture/capture.ts#capture` | — |
| Ingestie: hash, duplicate, ffprobe, paletă, dHash, rol | P0 | IMPLEMENTED | `module:src/assets/ingest.ts#ingestFile` | — |
| Fonturi (fontkit) | P1 | IMPLEMENTED | `module:src/assets/ingest.ts#ingestFile` | — |
| Video și fotografii | P1 | IMPLEMENTED | `cap:media.video`, `cap:media.image` | — |
| Poarta de drepturi | P0 | IMPLEMENTED | `module:src/assets/ingest.ts#setRights`, `check:timeline.validate` | — |
| Text din imagini (OCR) | P2 | MISSING | — | **Următorul pas:** OCR offline prin Windows (WinRT), ca vocea; zonele găsite intră în regiuni și în detecția datelor personale. |
| Calitatea materialului față de folosire (mărire peste rezoluție) | P1 | IMPLEMENTED | `check:ui.legibility` | — |
| Materiale generate | P3 | PARTIAL | `module:src/core/schema/assets.ts#AssetOrigin` | Originea „generated” există; grafica lui Claude e cod (capabilități), nu fișiere generate. **Următorul pas:** Doar dacă apare un generator cu licență clară. |

## Capabilități folosite de rețete

Din 124 capabilități, 46 sunt folosite direct de rețete; tranzițiile și camerele se aleg de gramatica de montaj și de direcții. Celelalte se folosesc doar când Claude le alege explicit în storyboard (suprascrieri), deci nu sunt „moarte”, dar nici nu intră automat:

`bg.solid` · `bg.gradient` · `bg.mesh` · `bg.grid` · `bg.waves` · `bg.beat-bars` · `fx.grain` · `fx.scanlines` · `fx.particles` · `fx.shapes` · `fx.fog` · `fx.glass` · `fx.lens-flare` · `fx.light-leak` · `fx.trails` · `shape.line-draw` · `text.char-reveal` · `text.tracking` · `text.split` · `text.outline-fill` · `text.glitch` · `text.captions` · `media.video` · `media.cards` · `frame.browser` · `frame.phone` · `frame.laptop` · `frame.desktop` · `ui.click` · `ui.hover` · `ui.tooltip` · `ui.blur-region` · `ui.zoom-lens` · `ui.notification` · `ui.progress` · `ui.toggle` · `logo.lockup` · `data.bars` · `data.line` · `data.ring` · `data.compare` · `data.pie` · `mod.glow` · `mod.blur` · `mod.chromatic` · `mod.ripple` · `mod.pixelate` · `mod.mask-reveal` · `mod.float` · `mod.tilt-3d`
