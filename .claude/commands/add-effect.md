---
description: Adaugă o capabilitate nouă în bibliotecă (implementare + fișă + sunet + test), doar după ce e randată și testată
argument-hint: "ce efect lipsește și unde e nevoie de el"
---

Respectă CLAUDE.md (secțiunile „Biblioteca de efecte” și „Reguli de inginerie”). Cererea: $ARGUMENTS

1. Caută întâi în registry dacă există deja ceva potrivit: `library/registry.json` (după `tags`, `category`, `description`) și `npm run mms -- catalog`. Reutilizarea are prioritate; poate ajunge un parametru nou la o capabilitate existentă.
2. Dacă lipsește, creează o capabilitate GENERICĂ (fără nume de produs) în fișierul categoriei potrivite din `src/motion/` (vezi docs/ARHITECTURA.md):
   - `defineLayer` / `defineModifier` / `defineCamera` / `defineTransition` cu id `categorie.nume`;
   - parametri cu zod și valori implicite; totul calculat din cadru (fără Math.random/Date.now – folosește `rand()`/`noise1()` cu sămânță);
   - `sfx`: sunetul asociat (id din `npm run mms -- sfx`), sau un sunet nou sintetizat în `src/audio/sfx.ts`;
   - `example` (parametri + durată) – îl randează testul de catalog;
   - `status: "experimental"` până trec testele.
3. Înregistreaz-o în `src/motion/registry.ts` (dacă e într-un fișier nou) și rulează `npm run registry`.
4. Verifică: `npm run typecheck`, `npm test`, apoi randează exemplul: `npm run test:render` (catalogul îl include automat). Uită-te la cadrul randat.
5. Doar după ce randarea și testele trec, schimbă `status` în `"tested"`, rulează din nou `npm run registry`, actualizează CHANGELOG.md.
6. Tehnologii noi (GSAP, Three.js etc.) doar dacă efectul nu se poate face altfel; scrie motivul în docs/DECIZII.md și adaugă dependența în `install.ps1` și în `doctor`.
7. Commit mic, pe o ramură, cu mesaj clar.
