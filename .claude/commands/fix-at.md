---
description: Corectează reclama doar la timestamp-urile notate („la 7,3 logo-ul e prea mic”), într-o versiune nouă
argument-hint: <proiect> "secunda: problema; secunda: problema"
---

Respectă CLAUDE.md. Argumente: $ARGUMENTS

1. Citește `npm run mms -- status <proiect>` și versiunea curentă (`versions/vN/`): timeline-ul formatului principal, storyboard-ul, scriptul.
2. Pentru fiecare notă „secunda X: problema”:
   - găsește scena de la secunda X (`scenes[].from`/`durationInFrames` în `timeline-<format>.json`, fps-ul e în fișier);
   - încearcă întâi o comandă recunoscută: `npm run mms -- iterate <proiect> "<comanda>"` (exemple în `npm run mms -- help` și docs/FLUX.md);
   - dacă nu se potrivește nicio comandă, creează o versiune nouă (`npm run mms -- new-version <proiect> --label "fix-at"`) și modifică DOAR scena vizată în `storyboard.json`/`script.json` (durată, text, rețetă, cameră, materiale, `overrides`).
3. Notează observațiile utilizatorului în critica versiunii (reviewer „user-notes”) cu `npm run mms -- review <proiect> --file note.json`.
4. Recompilează, refă mixul și preview-ul doar pe versiunea nouă: `compile`, `audio`, `preview`. Versiunea veche rămâne neatinsă.
5. Verifică zona corectată în cadrele randate (`renders/stills-<format>/`) și spune ce s-a schimbat (jurnalul din `npm run mms -- versions <proiect>`).
6. Sunetul nu îl poți judeca: cere utilizatorului să asculte din nou zona corectată.
