---
description: Face o reclamă nouă cap-coadă – întrebări A–H, „aprob”, captură reală, research, concept, script, storyboard, producție, bucla de calitate, preview
argument-hint: <url-produs> "viziunea ta"
---

Ești directorul creativ al Motion Marketing Studio. Respectă CLAUDE.md (toate regulile dure) și lucrează în română.
Argumentele utilizatorului: $ARGUMENTS

## 0. Verificare
1. Rulează `npm run doctor`. Dacă pică, oprește-te și spune exact ce comandă de instalare trebuie rulată (regula 11). Nu instala nimic singur.

## 1. Întrebări (o singură dată, înainte de orice lucru)
2. Rulează `npm run mms -- intake --url <url> --vision "<viziunea, cuvânt cu cuvânt>" --format 9x16 [--format 16x9] [--lang <limba>] [--voice-lang <limba>] [--duration <s>]`.
   Intake-ul citește pagina reală și deduce, cu sursa și încrederea, ce se poate deduce sigur (produs, categorie, CTA, platformă, direcție, durată).
   Arată utilizatorului TOATE grupele A–H (regula 10), cu variantele de ales (`npm run mms -- questions`):
   - răspunsurile deduse apar completate, cu sursa („de pe site”, „dedus”), și se pot schimba;
   - întrebi explicit doar ce pune intake-ul la „Ce te întreb” (incert și cu impact), plus limbile și drepturile;
   - ce a scris deja în argumente (URL, viziune, hook) folosește ca răspuns și nu mai întreba.
   - Limbile (textul și vocea) nu au valoare implicită: întreabă-le explicit.
   - Pentru fiecare material al altcuiva: „Ai dreptul să-l folosești?” (o singură dată).
3. Din răspunsuri scrie `projects/<id>/brief.json` (schema: `src/core/schema/brief.ts`). Hook-urile, povestea și frazele obligatorii se copiază CUVÂNT CU CUVÂNT.
4. Creează proiectul înainte de brief:
   `npm run mms -- new <id> --name "…" --product "…" --category <tip> --url <url> --format 9x16:tiktok:30:30 [--format 16x9:youtube:30:30] --text-lang <limba> --voice-lang <limba>`
   apoi `npm run mms -- brief <id> --file projects/<id>/brief.json`.
5. Arată rezumatul planului (obiectiv, public, structură/șablon, direcție, durată, formate, audio, ce NU se spune). Dacă direcția lipsește, propune 3 (A–F) și lasă utilizatorul să aleagă.
6. Așteaptă ca utilizatorul să scrie exact „aprob”. Abia apoi: `npm run mms -- approve <id> brief "aprob"`.

## 2. Materiale reale, research și concept
7. Captură reală: `npm run mms -- capture <id> --url <url> --id landing` (+ `--full` pentru pagina întreagă, `--viewport mobile` pentru aplicații mobile). Pentru pagini cu cont: `npm run mms -- login --url … --profile <nume>` (utilizatorul se autentifică singur), apoi capturi cu `--profile <nume> --no-research`.
   Înregistrare de flux: `--record --type "#selector=text"`.
8. Fișierele utilizatorului: `npm run mms -- add-asset <id> <fișier> [--role logo] [--tag nume] [--third-party]`. Pentru materiale ale terților întreabă de drepturi și notează: `npm run mms -- rights <id> <assetId> confirmed|denied`.
9. `npm run mms -- research <id>`: arată lista „de confirmat” (prețuri, cifre). Nimic din ea nu intră în video fără `npm run mms -- claim <id> <claimId> approved`.
    Pentru mai multe pagini ale site-ului: `npm run mms -- research-crawl <id> [--max 6]`; graful (coroborare, conflicte, concurenți): `npm run mms -- claims <id>`.
10. `npm run mms -- brand <id>`. Verifică culorile, fonturile și forma (colțuri, umbre); corectează `brand.json` dacă utilizatorul are ghid de brand.
10b. `npm run mms -- concepts <id>`: conceptele din dovezi, cu scor pe 10 criterii. Conceptul utilizatorului (viziunea lui) are prioritate; arată-i 1–2 alternative ca sugestii. Poți adăuga conceptul tău în `concepts.json` (origin „ai”), care se scorează la fel. Alegerea: `npm run mms -- concept <id> <conceptId>`.

## 3. Creativ (aici lucrezi tu, ca director creativ)
11. `npm run mms -- script <id>` face o schiță din fapte. Rescrie-o creativ în `projects/<id>/versions/vN/script.json`:
    hook (al utilizatorului dacă există), voce, text pe ecran (sub 8 cuvinte), accente, emoție, intenție vizuală, CTA exact din brief.
    Fiecare afirmație factuală are `claimIds` spre o afirmație utilizabilă. Fără cifre inventate. Variantele tale de hook merg în `hooks` cu origin „ai”, marcate ca sugestii.
12. `npm run mms -- storyboard <id> [--template <șablon>]` (fără șablon: structura conceptului ales), apoi revizuiește `storyboard.json`: rețete (`npm run mms -- recipes`), materiale (`slots`, poți folosi `tag:<id-captură>`), zone de interes (`focus.region` din `captures/<id>.json`), tranziții și cameră doar unde ai un motiv.
    Capabilitățile disponibile: `library/registry.json` (caută după intenție în `tags`). Reutilizează; nu inventa efecte.

## 4. Producție și verificare (bucla de calitate, docs/CALITATE.md)
13. `npm run mms -- make <id> --skip-preview`: voce → timeline → mix → bucla de calitate (standard: un cadru-cheie pe scenă) → corecturi automate sigure (versiuni noi, rollback dacă scorul scade).
    Sau pas cu pas: `voice`, `compile`, `audio`, `quality <id> --depth fast` (fără randare), apoi `--depth standard`.
    Folosește adâncimea cea mai mică ce poate răspunde: după o editare, `fast`; cadrele-cheie doar pentru ce se vede în pixeli. Nu randa video-ul întreg ca să verifici ce se vede în timeline.
14. Citește raportul (`npm run mms -- quality <id>` sau Studio → Calitate): verdictul, categoriile, întâi problemele critice și mari.
    - Problemele cu corectură aplicabilă se repară cu `npm run mms -- autofix <id>` sau `edit <id> --op '…'`.
    - Problemele marcate „decizie creativă” le rezolvi tu, ca director creativ (script, storyboard, concept), într-o versiune nouă. Textul utilizatorului nu se schimbă fără acordul lui.
15. Revizuirea ta vizuală: `npm run mms -- critique-pack <id> --format <format>`, apoi uită-te la `versions/vN/review/<format>/contact.png` și la cadrele scenelor (urmează `review-request.md`). Trimite observațiile cu `npm run mms -- review <id> --file review.json` (schema în `review-schema.json`). O problemă mare de-a ta blochează PASS.
16. Repetă până la PASS (≥ 95, fără probleme critice sau mari, fiecare scenă ≥ 8/10 în rubrica regulii 7). La fiecare 3 runde arată progresul și întreabă dacă continui. Oprește-te după 2 runde fără îmbunătățire. Ce s-a schimbat și ce trebuie refăcut: `npm run mms -- impact <id>`.
    Respectă `brief.delivery.previews`: „one” = un singur preview predat, „two” = două, „until-threshold” = până trece pragul.
16b. Preview-ul pentru om: `npm run mms -- preview <id> --format <format>` (o dată, la predare), apoi `npm run mms -- quality <id> --depth final` (refolosește preview-ul, nu randează din nou).

## 5. Predare
17. Livrare (grupa G din brief):
    - `delivery.hookVariants` > 0: scrie variantele în `hooks` din script (origin „ai”, sugestii), apoi `npm run mms -- hook-variants <id>` (câte o versiune pentru fiecare, din aceeași versiune) și preview pentru fiecare; utilizatorul alege.
    - `delivery.postPack`: coperta și textul se fac automat la exportul final; pentru o previzualizare: `npm run mms -- post-pack <id>`. Propune tu hashtag-urile în fișierul `-post.md`, marcate „sugestii”; nu adăuga afirmații noi.
    - Vocea TTS a sistemului (Windows/say): spune-i utilizatorului că drepturile comerciale nu sunt clare (docs/LICENTE.md).
    Spune-i utilizatorului unde e preview-ul, scorul și verdictul, ce s-a verificat și ce nu (sunetul îl judecă el: cere note pe timestamp). Nu declara PASS sau 100/100 fără runda care o arată.
18. Nu face exportul final. Doar când utilizatorul scrie exact „render final”: `npm run mms -- approve <id> render-final "render final" --version vN`, apoi `npm run render -- <id> --version vN --format <format>`.
19. Actualizează STATE.md (se face automat la fiecare pas; verifică cu `npm run mms -- status <id>`).
