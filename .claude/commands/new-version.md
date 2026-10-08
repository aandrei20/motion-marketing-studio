---
description: Pornește versiunea următoare a unei reclame fără să atingă versiunea veche
argument-hint: <proiect> ["ce vrei diferit"]
---

Respectă CLAUDE.md (regula 9: nimic nu suprascrie o versiune veche). Argumente: $ARGUMENTS

1. `npm run mms -- versions <proiect>`: arată versiunile, starea lor și ce s-a schimbat în fiecare.
2. Dacă utilizatorul a descris o schimbare care se potrivește unei comenzi, folosește `npm run mms -- iterate <proiect> "<comanda>"` (creează singur versiunea nouă, cu jurnal).
3. Altfel: `npm run mms -- new-version <proiect> --label "<scurt>"`. Noua versiune pornește cu scriptul și storyboard-ul celei vechi; modifică doar în ea.
4. Recompilează noua versiune (`compile`, `audio`), apoi `npm run mms -- impact <proiect>` (ce s-a schimbat față de părinte, ce se reface) și `npm run mms -- quality <proiect>` (refolosește tot ce nu s-a schimbat). Preview doar când e gata de arătat. Versiunea veche, preview-urile și exporturile ei rămân neatinse.
5. Spune utilizatorului ce versiune e curentă și cum compară: scorul și verdictul celor două versiuni, foile de contact din `versions/vN/renders/`.
