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

- `npm run studio` – Studio-ul (interfața web locală: proiecte, brief, materiale, research, brand, script, storyboard, preview cu timeline, audio, critică, versiuni, export) (PowerShell)
- `npm run remotion -- <proiect>` – Remotion Studio pe timeline-ul unui proiect; fără proiect, catalogul de efecte (PowerShell)
- `npm run mms -- <comandă>` – linia de comandă a studioului; `npm run mms -- help` arată toate comenzile (PowerShell)
- `npm run preview -- <proiect> [--format 9x16]` – preview randat (MP4 + foaie de contact) (PowerShell)
- `npm run render -- <proiect> --version vN` – MP4 final, doar după „render final” înregistrat pentru acea versiune (PowerShell)
- `npm run doctor` – verifică instalarea (PowerShell)
- `npm test` – teste unitare și de integrare; `npm run test:render` – randare (catalog, determinism, MP4) (PowerShell)
- `npm run typecheck`, `npm run lint` (regulile verificabile automat), `npm run registry` (regenerează library/registry.json) (PowerShell)
- `npm run e2e -- --fresh` – testul cap-coadă pe produsul demo fictiv (PowerShell)
- `npm run update` – aduce versiunea nouă și instalează ce lipsește (PowerShell)
- `/make-ad`, `/fix-at`, `/add-effect`, `/new-version` – se scriu în Claude Code (`.claude/commands/`)

## Git

Commit-uri mici cu mesaj clar. `main` rămâne stabil. Funcții noi pe ramuri. Teste la fiecare modificare a bibliotecii. Etichete pe versiuni stabile și un changelog.

---

# Constituția de inginerie

Regulile de mai sus au prioritate. Cele de mai jos spun cum se construiește și se schimbă codul. Detalii: `docs/ARHITECTURA.md`.

## Principiul de bază

**Claude (AI-ul) decide CE se face; motorul decide CUM se face.** Claude alege direcția, rețetele, capabilitățile, materialele, textul și ritmul, scriind date validate (brief, script, storyboard). Motorul (compilator + registry + Remotion) le execută determinist. Claude nu scrie cod de animație nou pentru fiecare reclamă; dacă lipsește o capabilitate, o adaugă generic în bibliotecă (`/add-effect`).

## Arhitectură

- Fluxul datelor: `brief.json` → `research.json` + `assets.json` + `brand.json` → `script.json` → `storyboard.json` → `timeline-<format>.json` (compilat) → mix audio → randare. Timeline-ul compilat e singura sursă pentru randare.
- `src/core/schema/` definește toate entitățile (zod). Orice fișier de proiect se citește și se scrie prin scheme (`readJson`/`writeValidated`). Nu se stochează decizii de producție ca text liber când există un câmp structurat.
- `src/motion/` = capabilități (straturi, modificatori, camere, tranziții); `src/recipes/` = combinații de nivel înalt; `src/timeline/` = compilare și validare; `src/audio/` = voce, muzică, efecte, mix; `src/pipeline/` = pașii; `src/studio/` = interfața; `src/cli/` = `mms`.
- Codul din `src/motion` și `src/renderer/composition` rulează în browser: fără module Node acolo.
- Produsul demo fictiv din `examples/` e singurul loc unde apar nume de produs; `npm run lint` verifică.

## Research și afirmații

- Fiecare afirmație are tip (fapt / inferență / interpretare creativă), sursă, citat, dată și încredere.
- Prețurile și cifrele intră implicit în „de confirmat”. Un grafic, un contor sau o replică cu cifră trebuie să trimită (`claimId`/`claimIds`) la o afirmație verificată sau aprobată de utilizator. Validatorul blochează altfel.
- Textul extras de pe site se citează, nu se rescrie ca fapt nou.

## Script

- Hook-urile, povestea și frazele obligatorii ale utilizatorului se păstrează exact (`origin: "user-verbatim"`). Dacă le modifici la cererea lui, marchează `user-polished`.
- Textul de pe ecran: un singur mesaj, de preferat sub 8 cuvinte. Vocea: sub 25 de cuvinte pe replică.
- Variantele tale de hook stau în `hooks` cu `origin: "ai"` (sugestii), nu înlocuiesc hook-ul utilizatorului.

## Storyboard și montaj

- Fiecare scenă are scop, rol narativ, rol emoțional, energie, tip de cadru, rețetă și materiale. Duratele vin din gramatica de montaj (voce, timp de citire, ritmul direcției, hold de minimum 2,5 s pe CTA), nu din șabloane fixe.
- Tranzițiile se aleg după direcție și diferența de energie; aceeași tranziție nu se repetă de două ori la rând.
- Tăieturile cad pe bătăi (beat grid) când `beat.snap` o cere.

## Mișcare

- Totul se calculează din numărul cadrului; aleatorul doar prin `rand()`/`noise1()`/`mulberry32` cu sămânță. Fără `Math.random()`, `Date.now()`.
- O capabilitate intră în registry doar cu implementare reală, parametri zod, sunet declarat, exemplu randat de testul de catalog și stare corectă. Nu se înregistrează nimic nefuncțional.
- Interfața produsului vine doar din `media.screen`/`media.device-3d`/... cu captură reală sau fișier de la utilizator. Straturile UI (cursor, spotlight, callout) sunt doar peste captura reală, în pixelii ei.
- Logo-ul: doar scară uniformă (fără recolorare, rotire, deformare), conform `brand.logo.rules`.

## Audio

- Fiecare efect vizual cu sunet îl declară în fișa lui; compilatorul face cue sheet-ul. Densitatea vine din brief.
- Mixul: ducking cu rampă de 500 ms sub voce, −14 LUFS integrat, true peak ≤ −1 dBTP, fără clipping, fără tăcere neintenționată peste 1 s. Mixerul verifică și raportează; exportul final cere raport „ok”.
- Muzica și efectele sintetizate sunt originale (fără licențe externe). Muzica utilizatorului trece prin poarta de drepturi.

## Calitate și teste

- Porți: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:render`, validarea timeline-ului, verificarea mixului, verificarea video-ului randat (cadre negre, flash-uri, înghețări).
- Testul de 360 px: latura scurtă a video-ului afișată la 360 px; textul principal ≥ 12 px, cel secundar ≥ 9 px.
- Nu spune că ceva merge fără să fi rulat testul sau randarea. Nu marca nimic „tested” fără randare. Raportează eșecurile cu mesajul real.
- Critica automată folosește aceeași rubrică (`rubric-v1`) și același reviewer (`mms-auto-critic-v1`) în toate rundele; revizuirea ta vizuală e o rundă separată (`claude-visual`).

## Versiuni

- O versiune cu preview, aprobată sau finală e înghețată. Orice schimbare creează versiunea următoare (`writableVersion`, `iterate`, `new-version`), cu jurnal de schimbări. Exporturile nu se suprascriu.

## Securitate

- Chei doar în `.env` (vezi `.env.example`); nu apar în cod, loguri, commit-uri. `npm run lint` caută chei în fișierele urmărite de Git.
- Sesiunile de browser pentru capturi cu cont stau în `.browser-profiles/` (ignorat de Git); utilizatorul se autentifică singur.
- Studio-ul ascultă doar pe 127.0.0.1. Remotion Studio (`npm run remotion`) ascultă pe toate interfețele (limită a Remotion): se pornește doar la nevoie și se oprește după.

## Nu falsifica

- Fără fișiere goale, funcții goale, UI fals sau intrări de registry fără implementare.
- Ce nu e terminat se marchează ca atare în `docs/IMPLEMENTATION_STATUS.md`, cu pasul următor concret.
- Nu ascunde erori și nu cădea în tăcere pe un comportament stricat: aruncă `MmsError` cu mesaj în română și indicație.
