# Auditurile

Două audituri: cel inițial (înainte de cod) și cel de la începutul etapei „Video Production OS” (după versiunea 0.1.0).

# 1. Auditul inițial

Starea repo-ului la începutul construcției (2026-10-08) și ce s-a decis pe baza ei.

## Ce exista

Un singur commit (`acae7c9`, „Plan initial si documentatie”, 2026-10-07), doar cu documente:

| Fișier | Conținut |
| --- | --- |
| `CLAUDE.md` | Regulile permanente (19 reguli dure, biblioteca, ordinea de construcție, comenzi, Git) |
| `PLAN.md` | Planul complet pe faze (0–16), cu deciziile luate și catalogul de efecte dorit |
| `README_ce_este.md`, `README_flux.md` | Prezentarea și fluxul pentru utilizator, scrise înaintea codului |
| `docs/TUTORIAL.md`, `docs/PROMPT_START.md` | Explicarea deciziilor și promptul de pornire |
| `docs/referinte/…Master_Blueprint.docx` | Documentul de referință al utilizatorului |

## Ce lipsea

Tot codul: nu exista `package.json`, motor, teste, instalator sau comenzi Claude Code. Comenzile din `CLAUDE.md` (`npm run studio`, `render`, `doctor`, `test`, `update`) și din `README_flux.md` (`/make-ad`, `/fix-at`, `/add-effect`, `/new-version`) nu existau încă.

## Nepotriviri găsite în documentele inițiale (corectate)

- `README_ce_este.md` și `README_flux.md` trimiteau la `README_instalare.md`, `GLOSAR.md` și `DEPANARE.md`, care nu existau. Acum trimit la `README.md`, `docs/GLOSAR.md` și `docs/DEPANARE.md`.
- `README_flux.md` dădea adresa `localhost:3000` pentru Studio și folderul `out/` pentru export. Acum: `127.0.0.1:4321` și `exports/`.
- `README_flux.md` promitea un „animatic” separat. Acum: un prim preview complet (randarea e suficient de rapidă).
- Întrebările de livrare (pachet de postare, variante de hook, număr de preview-uri) nu aveau unde să ajungă. Acum au câmpuri în brief și funcții reale.

## Ce din plan nu s-a preluat (cu motiv)

- **Cele 96 de sunete din proiectul de test anterior** (`PLAN.md`, Faza 4): nu sunt în acest repo, iar licența lor trebuie verificată. Studioul folosește 35 de efecte sintetizate din cod, originale. Sunetele vechi pot intra ca materiale ale utilizatorului, cu poarta de drepturi.
- **Python și FFmpeg instalate separat:** nu sunt necesare (docs/DECIZII.md, punctele 1–2).
- **GSAP și Three.js:** nu au fost necesare pentru efectele cerute (docs/DECIZII.md, punctul 5).

## Ordinea de construcție (CLAUDE.md) – unde s-a ajuns

| Pas | Stare |
| --- | --- |
| 1. Repo, instalare, `doctor` | făcut |
| 2. CLAUDE.md, reguli, registru de licențe | făcut (`docs/LICENTE.md`) |
| 3. Captură Playwright, manifest, test de footage real | făcut |
| 4. Motor: timeline declarativ, validare, preview, randare de probă | făcut |
| 5. Registry, fișă standard, catalog demo | făcut |
| 6. Efectele pe pachete | făcut (124 de capabilități) |
| 7. Audio: cue sheet, beat grid, mix, licențe | făcut |
| 8. Zone de siguranță și multi-format | făcut |
| 9. `/make-ad` și comenzile ajutătoare | făcut |
| 10. Test pe o a doua aplicație; apoi reparația proiectului de test anterior | **de făcut**: are nevoie de un produs real ales de utilizator și de notele lui de ascultare |

Starea detaliată: `docs/IMPLEMENTATION_STATUS.md`.

# 2. Auditul etapei „Video Production OS” (2026-10-08, după 0.1.0)

Punctul de plecare: ramura `build/studio-v0.1` (versiunea 0.1.0), cu motorul, cele 124 de capabilități, 16 rețete, audio, Studio și testele trecute. Auditul s-a făcut pe cod, nu pe documente: un lucru e „implementat” doar dacă e folosit de flux și are test sau o randare verificată.

## Ce lipsea sau era doar parțial

| Zonă | Starea găsită | Ce s-a făcut |
| --- | --- | --- |
| Bucla de calitate | Critica era o rubrică euristică pe structură; nu se uita la imagine și dădea note mari. Nu exista un scor general, un verdict sau probleme structurate. | Pase 0–9 cu metode și costuri, scorul `quality-v1` pe 11 categorii, probleme cu toate câmpurile cerute; rubrica regulii 7 păstrată (`src/quality/`) |
| Randări inutile | Fiecare verificare vizuală cerea un preview întreg; nimic nu se refolosea între versiuni. | Cache pe conținut pentru cadre-cheie, mix și preview; motorul de impact (`src/pipeline/impact.ts`) |
| Corecturi | Doar comenzi în limbaj natural, aplicate de om; fără verificarea efectului și fără revenire. | Operații de editare comune (`src/core/schema/edit.ts`), corecturi automate cu rollback, undo/redo |
| Criticul vizual | Revizuirea vizuală a lui Claude exista, dar manual, fără pachet și fără schemă. | Contrastul măsurat pe pixeli, pachetul `critique-pack` cu schema răspunsului |
| Creativ | Direcțiile A–F și șabloanele, fără concepte comparate și fără scor. | Concepte din dovezi cu scor pe 10 criterii; intake inteligent |
| Research | Doar pagina capturată. | Citirea paginilor relevante ale site-ului, graful de afirmații |
| Date personale | Doar emailuri în textul paginii. | Telefon, card, IBAN, CNP, nume din salut; OCR offline în imagini |
| Formate | Același storyboard pe toate formatele, fără verificarea zonei demonstrate după reîncadrare. | Verificarea reîncadrării, profiluri de platformă |
| Studio | Timeline doar pentru vizualizare; joburile se pierdeau la oprire; fără protecție CSRF. | Editorul de scene, panourile Calitate și Concept, joburi cu manifest și reluare, protecții Host / Origin / antet |
| Teste | Catalogul se randa, dar fără comparație cu o referință: o schimbare vizuală trecea neobservată. | Regresia vizuală pe catalog și pe rețete, cu test de sensibilitate |
| Contribuitori | 10 commit-uri vechi (`50deafb`…`f6cb12c`) aveau trailere `Co-Authored-By`. | Atribuirea dezactivată în `.claude/settings.json`; lint-ul refuză trailerele în commit-urile noi; istoricul vechi nu a fost rescris |

## Ce nu s-a făcut (cu motiv)

- **Apel automat la un model de vedere prin API**: ar cere o cheie și ar trimite cadrele în afara calculatorului; revizuirea vizuală rămâne a lui Claude, în sesiune (`docs/DECIZII.md`, punctul 45).
- **Testul pe un produs real**: produsul îl alege utilizatorul (pasul 10 din ordinea de construcție).
- **Tragerea clipurilor cu mouse-ul în timeline**: editorul de scene acoperă operațiile; tragerea ar fi încă un mod de a face același lucru.

Inventarul complet, cu starea și prioritatea fiecărui element: `docs/INVENTAR.md` (generat din `src/inventory/inventory.ts`).
