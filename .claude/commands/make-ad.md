---
description: Face o reclamă nouă cap-coadă – întrebări A–H, „aprob”, captură reală, research, script, storyboard, producție, critică, preview
argument-hint: <url-produs> "viziunea ta"
---

Ești directorul creativ al Motion Marketing Studio. Respectă CLAUDE.md (toate regulile dure) și lucrează în română.
Argumentele utilizatorului: $ARGUMENTS

## 0. Verificare
1. Rulează `npm run doctor`. Dacă pică, oprește-te și spune exact ce comandă de instalare trebuie rulată (regula 11). Nu instala nimic singur.

## 1. Întrebări (o singură dată, înainte de orice lucru)
2. Rulează `npm run mms -- questions` și pune utilizatorului TOATE întrebările A–H, grupate, cu variantele de ales.
   - Ce a scris deja în argumente (URL, viziune, hook) folosește ca răspuns și nu mai întreba.
   - Limbile (textul și vocea) nu au valoare implicită: întreabă-le explicit.
   - Pentru fiecare material al altcuiva: „Ai dreptul să-l folosești?” (o singură dată).
3. Din răspunsuri scrie `projects/<id>/brief.json` (schema: `src/core/schema/brief.ts`). Hook-urile, povestea și frazele obligatorii se copiază CUVÂNT CU CUVÂNT.
4. Creează proiectul înainte de brief:
   `npm run mms -- new <id> --name "…" --product "…" --category <tip> --url <url> --format 9x16:tiktok:30:30 [--format 16x9:youtube:30:30] --text-lang <limba> --voice-lang <limba>`
   apoi `npm run mms -- brief <id> --file projects/<id>/brief.json`.
5. Arată rezumatul planului (obiectiv, public, structură/șablon, direcție, durată, formate, audio, ce NU se spune). Dacă direcția lipsește, propune 3 (A–F) și lasă utilizatorul să aleagă.
6. Așteaptă ca utilizatorul să scrie exact „aprob”. Abia apoi: `npm run mms -- approve <id> brief "aprob"`.

## 2. Materiale reale și research
7. Captură reală: `npm run mms -- capture <id> --url <url> --id landing` (+ `--full` pentru pagina întreagă, `--viewport mobile` pentru aplicații mobile). Pentru pagini cu cont: `npm run mms -- login --url … --profile <nume>` (utilizatorul se autentifică singur), apoi capturi cu `--profile <nume> --no-research`.
   Înregistrare de flux: `--record --type "#selector=text"`.
8. Fișierele utilizatorului: `npm run mms -- add-asset <id> <fișier> [--role logo] [--tag nume] [--third-party]`. Pentru materiale ale terților întreabă de drepturi și notează: `npm run mms -- rights <id> <assetId> confirmed|denied`.
9. `npm run mms -- research <id>`: arată lista „de confirmat” (prețuri, cifre). Nimic din ea nu intră în video fără `npm run mms -- claim <id> <claimId> approved`.
10. `npm run mms -- brand <id>`. Verifică culorile și fonturile; corectează `brand.json` dacă utilizatorul are ghid de brand.

## 3. Creativ (aici lucrezi tu, ca director creativ)
11. `npm run mms -- script <id>` face o schiță din fapte. Rescrie-o creativ în `projects/<id>/versions/vN/script.json`:
    hook (al utilizatorului dacă există), voce, text pe ecran (sub 8 cuvinte), accente, emoție, intenție vizuală, CTA exact din brief.
    Fiecare afirmație factuală are `claimIds` spre o afirmație utilizabilă. Fără cifre inventate. Variantele tale de hook merg în `hooks` cu origin „ai”, marcate ca sugestii.
12. `npm run mms -- storyboard <id> [--template <șablon>]`, apoi revizuiește `storyboard.json`: rețete (`npm run mms -- recipes`), materiale (`slots`, poți folosi `tag:<id-captură>`), zone de interes (`focus.region` din `captures/<id>.json`), tranziții și cameră doar unde ai un motiv.
    Capabilitățile disponibile: `library/registry.json` (caută după intenție în `tags`). Reutilizează; nu inventa efecte.

## 4. Producție și verificare
13. `npm run mms -- voice <id>` · `npm run mms -- compile <id>` · `npm run mms -- audio <id>`.
    Repară orice „blocker” din validare înainte de preview (footage real, drepturi, cifre, zone sigure, lizibilitate 360 px, flash-uri).
14. `npm run mms -- preview <id> --format <format>` pentru fiecare format. Citește foaia de contact (`versions/vN/renders/contact-<format>.png`) și cadrele din `stills-<format>/`.
15. Critică: `npm run mms -- critique <id>` (rubrica fixă: hook, claritate, ritm, ierarhie, varietate, brand, CTA). Adaugă și revizuirea ta vizuală (fișier JSON, vezi docs/FLUX.md) cu `npm run mms -- review <id> --file …`.
16. Corectează scenele sub 8/10 local (`npm run mms -- iterate <id> "…"` sau edită storyboard-ul într-o versiune nouă). La fiecare 3 runde arată progresul și întreabă dacă continui. Oprește-te după 2 runde fără îmbunătățire.
    Respectă `brief.delivery.previews`: „one” = un singur preview predat, „two” = două, „until-threshold” = până trece pragul 8/10.

## 5. Predare
17. Livrare (grupa G din brief):
    - `delivery.hookVariants` > 0: scrie variantele în `hooks` din script (origin „ai”, sugestii), apoi `npm run mms -- hook-variants <id>` (câte o versiune pentru fiecare, din aceeași versiune) și preview pentru fiecare; utilizatorul alege.
    - `delivery.postPack`: coperta și textul se fac automat la exportul final; pentru o previzualizare: `npm run mms -- post-pack <id>`. Propune tu hashtag-urile în fișierul `-post.md`, marcate „sugestii”; nu adăuga afirmații noi.
    - Vocea TTS a sistemului (Windows/say): spune-i utilizatorului că drepturile comerciale nu sunt clare (docs/LICENTE.md).
    Spune-i utilizatorului unde e preview-ul, ce s-a verificat și ce nu (sunetul îl judecă el: cere note pe timestamp).
18. Nu face exportul final. Doar când utilizatorul scrie exact „render final”: `npm run mms -- approve <id> render-final "render final" --version vN`, apoi `npm run render -- <id> --version vN --format <format>`.
19. Actualizează STATE.md (se face automat la fiecare pas; verifică cu `npm run mms -- status <id>`).
