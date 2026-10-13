# Bucla de calitate

Cum verifică studioul o reclamă, cum dă scorul și cum o corectează singur, fără randări inutile.

Codul: `src/quality/` (pase, scor, probleme, corecturi automate), `src/pipeline/impact.ts` și `src/pipeline/graph.ts` (impactul schimbărilor), `src/critique/` (rubrica regulii 7, analiza pixelilor, pachetul de revizuire vizuală).

## Principiul: cea mai ieftină metodă care poate răspunde

Cele 10 pase (0–9) sunt **porți de calitate, nu 10 randări**. Fiecare verificare declară metoda de care are nevoie și costul ei:

| Metodă | Cost | Ce folosește |
| --- | --- | --- |
| `schema` | 0 | doar datele validate |
| `static` | 1 | fișierele proiectului (brief, research, brand, concepte) |
| `timeline` | 1 | timeline-ul compilat (compilarea durează milisecunde) |
| `asset` | 1 | analiza deja făcută a materialelor |
| `audio` | 2 | raportul mixului (mixul e în cache pe conținut) |
| `stills` | 3 | un cadru-cheie pe scenă, la scară redusă |
| `scene-render` | 4 | câteva cadre pe scenă, pentru mișcarea reală |
| `full-render` | 6 | video-ul întreg (preview) |

Adâncimea rundei stabilește costul maxim permis:

| Adâncime | Cost maxim | Când |
| --- | --- | --- |
| `fast` | 2 | după fiecare editare; nu randează nimic |
| `standard` | 3 | runda obișnuită; randează doar cadrele-cheie ale scenelor schimbate |
| `deep` | 4 | adaugă mișcarea reală pe scene (randări mici, la scara 0,2) |
| `final` | 6 | înainte de predare; folosește preview-ul, randat o singură dată |

O verificare mai scumpă decât adâncimea e raportată „sărită”, cu motivul. Categoriile pe care nu le-a evaluat nicio verificare apar cu `null`, nu cu 100.

## Pasele

| Pas | Verificări |
| --- | --- |
| 0 Plan | `timeline.validate` (footage real, drepturi, cifre, zone sigure, 360 px, flash-uri, goluri, date personale), `claims.script`, `claims.confidence` (graful de afirmații: conflict sau afirmație despre concurent → critică) |
| 1 Poveste | `critique.rubric` (rubrica regulii 7), `story.structure`, `story.energy-arc`, `story.brand-reveal`, `story.pacing`, `creative.concept` |
| 2 Vizual | `visual.pixels`: contrast WCAG măsurat pe pixelii randați, densitatea marginilor, ocuparea, ponderea culorilor brandului; `visual.text-placement`: locul textului principal pe scene, din timeline (același loc în trei scene la rând = problemă medie) |
| 3 Mișcare | `motion.grammar` (odihnă vizuală, varietatea animațiilor de text, raportul dintre tranziții și tăieturi simple), `motion.scene` (mișcarea reală dintre cadre, înghețări) |
| 4 Interfață | `ui.legibility` (interfața la testul de 360 px), `ui.caption-occlusion` (subtitrări peste zona demonstrată), `ui.material-over-text` (materialul mărit de cameră peste titlu) |
| 5 Tipografie | `typography.caption-redundancy`, `typography.consistency` |
| 6 Audio | `audio.mix` (−14 LUFS, ≤ −1 dBTP, clipping, tăceri) |
| 7 Brand | `brand.stale` (brand kit mai vechi decât capturile sau referințele), `brand.rules` (logo: doar scară uniformă), `brand.color-presence` |
| 8 Platformă | `platform.profile` (durată, hook, subtitrări, densitate pe profilul platformei), `platform.reframing` (reîncadrarea pe fiecare format păstrează zona demonstrată) |
| 9 Final QA | `technical.recompile` (determinism: aceeași compilare, octet cu octet), `final.video` (cadre negre, flash-uri, înghețări în video-ul randat) |

## Ce se refolosește (cache-ul)

Nimic nu se refăce dacă intrările lui nu s-au schimbat:

- **Cadrele-cheie** au cheia `sceneContentKey` + hash-ul codului de randare. O scenă mutată în timp, dar neschimbată, își păstrează cadrul.
- **Mixul** are cheia `audioKey`: cue sheet-ul (efecte, voce, câștig, panoramare), fișierele vocii, beat grid-ul, structura scenelor și setările audio din brief.
- **Preview-ul** are cheia `timelineRenderKey`: același timeline și același cod dau același MP4 (`.cache/renders/`), refolosit și de Final QA.
- **Conceptele** se refac doar când se schimbă brief-ul, research-ul sau materialele.
- **Instantaneele** intrărilor unei versiuni (`projects/<id>/snapshots/<tip>-<hash>.json`) permit compararea exactă a două versiuni.

`npm run mms -- impact <id> [--from v2 --to v3]` arată ce s-a schimbat și ce trebuie refăcut. Graful de dependențe e în `src/pipeline/graph.ts` (`SYSTEM_CAPABILITIES`, `downstream`).

## Problemele

Fiecare problemă are aceleași câmpuri (`Finding`, `src/core/schema/critique.ts`):

`id`, `severity` (critical / high / medium / low), `category` (una din cele 11), `timecode` și `frame`, `durationSec`, `sceneId`, `layerId`, `formatId`, `problem`, `whyItMatters`, `recommendation`, `confidence` (0–1), `autoFixable`, `suggestedFix` (operații de editare reale), `method`, `source`, `status`.

Problemele identice se unesc (cheia include formatul). Cele de la revizuirea vizuală a lui Claude (`claude-visual`) și din notele utilizatorului (`user-notes`) intră în același sistem: o problemă mare de acolo blochează PASS.

## Scorul

Modelul `quality-v1` (`src/quality/score.ts`): 11 categorii, fiecare 0–100. Fiecare problemă scade din categoria ei penalizarea de bază (critică 45, mare 18, medie 7, mică 2) înmulțită cu încrederea; a k-a problemă din aceeași categorie scade cu factorul 0,85^k (zece probleme mici nu înseamnă o reclamă proastă). Scorul general e media ponderată a categoriilor evaluate.

Verdictul:

| Condiție | Verdict |
| --- | --- |
| cel puțin o problemă critică | **FAIL** |
| cel puțin o problemă mare | **FIX** |
| scor sub 92 | **FIX** |
| scor între 92 și 95 | **POLISH** (finisaj opțional) |
| scor ≥ 95, fără critice și mari, rubrica regulii 7 ≥ 8/10 pe fiecare scenă | **PASS** |

Pragurile, ponderile, penalizările și limitele buclei se schimbă în `project.json`, câmpul `quality` (schema `QualityConfig`).

**Regula 7 rămâne în vigoare:** rubrica fixă (`rubric-v1`, reviewer `mms-auto-critic-v1`, aceleași 7 criterii) se calculează în fiecare rundă, pragul de 8/10 pe scenă face parte din PASS, iar bilanțul la 3 runde și oprirea după 2 runde fără progres funcționează ca înainte. Scorul `quality-v1` se adaugă rubricii; nu o înlocuiește.

## Corecturile automate

`npm run mms -- autofix <id> [--depth standard] [--max 3]` (și pasul automat din `make`):

1. Alege problemele cu corectură mecanică sigură: `autoFixable`, încredere ≥ 0,6, scenă neblocată. Cele mai grave primele, maximum 8 pe iterație (`maxAutoFixes`).
2. Le unește într-un set de operații și le aplică într-o **versiune nouă** (regula 9).
3. Recompilează, reface mixul doar dacă s-a schimbat ceva audio, apoi verifică din nou. Doar scenele schimbate se randează.
4. Dacă scorul scade sau apare o problemă mare nouă: **rollback**. Versiunea rămâne pe disc marcată `rejected`, versiunea curentă revine la cea bună, iar corecturile respinse nu se mai încearcă.
5. Se oprește la PASS, după `maxIterations`, când câștigul e sub `minScoreImprovement` sau când nu mai există corecturi sigure.

Nu se ating automat: textul utilizatorului (regula 14), afirmațiile, conceptul și orice decizie creativă. Acestea apar ca „decizie creativă (Claude / tu)”. Raportul iterațiilor e în `versions/vN/autofix.json` și în panoul „Calitate” din Studio.

## Criticul vizual (multimodal)

Trei niveluri, de la ieftin la scump:

1. **Pixelii măsurați** (`src/critique/pixel.ts`): contrastul real dintre text și fundalul de sub el (nu culoarea declarată), aglomerarea, ocuparea, prezența brandului. Rulează pe cadrele-cheie din cache.
2. **Pachetul de revizuire** (`npm run mms -- critique-pack <id>`): cadrele-cheie, foaia de contact, cererea de revizuire (`review-request.md`, cu lista de verificat) și schema răspunsului (`review-schema.json`), în `versions/vN/review/<format>/`. Claude se uită la imagini în Claude Code și trimite observațiile cu `npm run mms -- review <id> --file review.json` (reviewer `claude-visual`).
3. **Notele utilizatorului** pe timestamp, singura verificare reală a sunetului (regula 15).

Nu există un apel automat la un model de vedere prin API: ar cere o cheie și ar trimite cadrele în afara calculatorului. Revizuirea vizuală se face de Claude, în sesiunea Claude Code, pe pachetul de mai sus.

## Regresia vizuală (teste)

`tests/render/golden.ts`: fiecare cadru de referință se reduce la o grilă RGB de 32 × N (medie pe blocuri), salvată în `tests/golden/`. O randare nouă pică testul dacă diferența medie depășește 6/255 sau un bloc depășește 60/255; variația de rasterizare (≤ 2/255) rămâne mult sub prag. Un test separat demonstrează că pragurile prind un element dispărut și unul mutat.

- `tests/golden/catalog.json`: toate capabilitățile din catalog.
- `tests/golden/recipes-16x9.json`, `recipes-9x16.json`: toate rețetele, compilate prin compilatorul real, pe două formate.

Referințele se actualizează doar după o verificare vizuală, explicit: `$env:MMS_UPDATE_GOLDEN="1"; npm run test:render`.

## În Studio

Tab-ul **Calitate**: scorul și verdictul, cele 11 categorii, acoperirea, rubrica regulii 7, randările noi și refolosite, problemele cu filtre (gravitate, categorie), „de ce contează”, corectura aplicabilă cu un clic, revizuirea lui Claude și notele tale, pasele cu metoda și starea fiecărei verificări (rulată, din cache, sărită), impactul față de versiunea anterioară, iterațiile corecturilor automate și istoricul rundelor. Butoane: Rapid, Cadre-cheie, Final QA, Corecturi automate, Pachet de revizuire.

Tab-ul **Concept**: conceptele cu scorul pe cele 10 criterii, cel ales, riscurile, alegerea altuia și storyboard-ul din conceptul ales.

În **Preview & timeline**, editorul scenei: durată, mutare, duplicare, ștergere, blocare, sunete, tranziție, cameră, text, straturi (ascunde, decalaj), undo/redo. Fiecare editare e o operație reală (`src/core/schema/edit.ts`), aceeași pe care o folosesc corecturile automate.
