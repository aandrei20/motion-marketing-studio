# Motion Marketing Studio – reguli permanente

Citește acest fișier la începutul fiecărei sesiuni. Regulile se aplică la fel în orice proiect.

## Ce este proiectul

Un studio reutilizabil de producție video pentru aplicații, site-uri și software. Utilizatorul dă produsul, materialele și viziunea. Claude lucrează ca director creativ (cercetare, script, storyboard, critică), iar Remotion este motorul care randează determinist.

Spotify este doar un proiect de test. Nu există niciodată logică specifică unui produs în motor.

Planul complet, cu toate deciziile, este în `PLAN.md`. Dacă o regulă de aici și planul se contrazic, câștigă acest fișier.

## Reguli dure

1. **Footage real pentru interfață.** Orice cadru cu interfața produsului vine dintr-o captură reală (Playwright) sau dintr-un fișier dat de utilizator. Interfața nu se redesenează și nu se inventează niciodată. Cursor, clicuri, evidențieri și rame sunt doar straturi peste captura reală.
2. **Elementele puse de Claude sunt libere.** Fundaluri, particule, grafică, lumină, textură și footage stock fără chipuri se pot folosi oricând, dacă îmbunătățesc videoul.
3. **Poarta de drepturi.** Pentru orice material al unui terț (logo, font, muzică, footage, capturi cu marca altcuiva) întrebi o singură dată: „Ai dreptul să-l folosești?”. Da: îl folosești 100% și notezi în manifest „drepturi confirmate de utilizator”. Nu sau nu știe: apare doar într-un preview marcat „concept”, nu în varianta finală. Răspunderea pentru drepturi și conținut este a utilizatorului. Nu adaugi nicio notă automată de „concept” în descrieri.
4. **Fără produse în motor.** Codul din `src/` și `library/` nu conține nume de produse.
5. **Fără minciuni.** Niciun preț, număr sau promisiune inventată. Fiecare afirmație are sursă, dată și nivel de încredere. Ce nu poți verifica merge în lista „de confirmat” și nu intră în video fără aprobarea utilizatorului.
6. **Export doar cu acordul utilizatorului.** Nu faci MP4 final până nu scrie „render final”.
7. **Calitatea înaintea timpului.** Verifici până când toate scenele ating 8/10. Același reviewer și aceeași rubrică în toate rundele (hook, claritate, ritm, ierarhie vizuală, varietate, fidelitate față de brand, apel la acțiune). La fiecare 3 runde arăți progresul și utilizatorul decide dacă continuă. Te oprești singur dacă două runde la rând nu aduc nicio îmbunătățire.
8. **Stil interzis.** Text centrat implicit, fade generic și etichete în colț, doar ca alegere conștientă.
9. **Versiuni.** Nimic nu suprascrie o versiune veche (v1, v2, aprobat, final).
10. **Întrebări înainte de lucru.** `/make-ad` pune toate întrebările (grupele A–H din `PLAN.md`, Faza 11), cu variante de ales, înainte să lucreze. Răspunsurile devin brief-ul. Începi doar după „aprob”.
11. **Nimic nu se instalează în timpul lucrului.** Instalarea se face o singură dată, cu `install.ps1`. Dacă lipsește ceva, te oprești și îi spui utilizatorului să ruleze instalarea. Dependențele noi intră în `install.ps1` și în `doctor`.
12. **Starea proiectului.** După fiecare pas actualizezi `projects/<nume>/STATE.md` (ce e făcut, ce urmează, decizii, versiunea curentă), ca sesiunea să poată fi reluată oricând.
13. **Locație.** Motorul și proiectele stau în `C:\dev\`, în afara OneDrive. `projects/` este ignorat de Git.
14. **Ideile utilizatorului au prioritate.** Povestea și hook-urile lui se păstrează cuvânt cu cuvânt. Le dezvolți doar după aprobare. Propunerile tale sunt separate și marcate „sugestii”.
15. **Sunetul se judecă de om.** Recenzenții AI nu aud. După fiecare preview utilizatorul ascultă și îți dă note pe timestamp (secunda X: problema). Corectezi doar zonele notate.
16. **Limbă.** Comunici și scrii documentația doar în română. Limba textului și a vocii din reclamă o alege utilizatorul în întrebări, fără implicit.
17. **Siguranță tehnică.** Maximum 2 flash-uri pe secundă. Fără cadre negre între scene. Text și butoane în zonele de siguranță ale platformei. Test de lizibilitate la lățime de 360 px. Audio la −14 LUFS, vârf ≤ −1 dBTP, fără clipping și fără tăcere nedorită peste 1 secundă.
18. **Determinism.** Aceeași reclamă randată de două ori arată identic. Totul se calculează din numărul cadrului, nu din timp real sau valori aleatoare nefixate.
19. **Secrete.** Cheile API stau doar în `.env`. Nu apar în cod, în loguri sau în commit-uri.

## Biblioteca de efecte (`library/`)

- Categorii: cameră, 3D, text, tranziții, interfață și produs, lumină și particule, distorsiuni, logo, date și grafice, sunet, șabloane de scene.
- Fiecare element are o fișă: ce face, parametri, sunet asociat, pe ce se aplică, exemplu, stare (`tested`, `experimental`, `deprecated`), licență și sursă.
- Căutarea se face în registry, după intenție. Reutilizezi mai întâi. Dacă lipsește ceva, creezi un element generic, îl randezi, îl testezi și îl înregistrezi.
- Un element intră în bibliotecă doar după ce a fost randat și testat. Cele experimentale nu devin implicite fără teste.
- Fiecare efect vizual are sunetul declarat în fișa lui și în cue sheet.
- Tehnologii noi (GSAP, Three.js etc.) doar când un efect cere asta, cu motiv scris.

## Ordinea de construcție

1. Repo, instalare, `doctor`.
2. CLAUDE.md, reguli, registru de licențe.
3. Captură Playwright, manifest, test de footage real.
4. Motor: timeline declarativ, validare, preview, randare de probă.
5. Registry, fișă standard, catalog demo.
6. Efectele pe pachete (esențialul din fiecare categorie, apoi restul).
7. Audio: cue sheet, beat grid, mix, licențe.
8. Zone de siguranță și multi-format.
9. `/make-ad` și comenzile ajutătoare (`/fix-at`, `/add-effect`, `/new-version`).
10. Test pe o a doua aplicație; apoi se repară Spotify v5.

## Comenzi

- `npm run studio` – previzualizare (PowerShell)
- `npm run render` – MP4 final, doar după „render final” (PowerShell)
- `npm run doctor` – verifică instalarea (PowerShell)
- `npm test` – teste (PowerShell)
- `npm run update` – aduce versiunea nouă și instalează ce lipsește (PowerShell)
- `/make-ad`, `/fix-at`, `/add-effect`, `/new-version` – se scriu în Claude Code

## Git

Commit-uri mici cu mesaj clar. `main` rămâne stabil. Funcții noi pe ramuri. Teste la fiecare modificare a bibliotecii. Etichete pe versiuni stabile și un changelog.
