# Auditul inițial

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
