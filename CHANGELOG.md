# Changelog

Formatul: o secțiune pe versiune; în fiecare: Adăugat, Schimbat, Reparat. Versiunile stabile primesc o etichetă Git (`v0.1.0`…).

## [Nelansat] – `main` (integrat din ramura `build/production-os`)

Etapa „Video Production OS”: calitatea înaintea numărului de funcții. Auditul și motivele: `docs/AUDIT.md` (secțiunea 2); bucla: `docs/CALITATE.md`.

### Adăugat

- **Bucla de calitate adaptivă** (`mms quality`): pase 0–9 ca porți, fiecare verificare cu metoda și costul ei, adâncimi fast / standard / deep / final; verificările scumpe rulează doar când adâncimea o permite.
- **Cache pe conținut și motorul de impact** (`mms impact`): amprente pe artefacte și pe scene; cadrele-cheie, mixul și preview-ul se refolosesc când intrările nu s-au schimbat; graful de dependențe al sistemului.
- **Scorul `quality-v1`**: 11 categorii (poveste, creativ, vizual, mișcare, tipografie, interfață, audio, brand, afirmații, tehnic, platformă), verdict PASS / POLISH / FIX / FAIL, praguri și ponderi configurabile per proiect; rubrica regulii 7 rămâne și face parte din PASS.
- **Probleme structurate**: gravitate, categorie, timestamp, durată, scenă, strat, format, de ce contează, recomandare, încredere, corectură propusă (operații reale).
- **Corecturi automate** (`mms autofix`, pas în `mms make`): doar corecturi mecanice sigure, fiecare iterație într-o versiune nouă, rollback dacă scorul scade, limite de iterații și de corecturi.
- **Operații de editare, undo/redo** (`mms edit`, `undo`, `redo`), comune pentru Studio, CLI și corecturile automate.
- **Criticul pe pixeli**: contrastul real dintre text și fundal, aglomerarea, ocuparea, prezența culorilor brandului; **pachetul de revizuire vizuală** pentru Claude (`mms critique-pack`).
- **Directorul creativ**: concepte din dovezi cu scor pe 10 criterii (`mms concepts`, `concept`); conceptul utilizatorului are prioritate. **Intake inteligent** (`mms intake`): deduce din site ce se poate și întreabă doar ce e incert.
- **Research pe site** (`mms research-crawl`) și **graful de afirmații** (`mms claims`): coroborare, conflicte, afirmații despre concurenți.
- **Reference DNA** (ritm, cameră, culoare) aplicat pe direcție; **structura muzicii** (secțiuni, drop-uri); **forma brandului** (colțuri, umbre, spațiere) folosită de rețete.
- **OCR offline** (Windows) pe capturile fără DOM; **date personale** cu validatori: telefon, card (Luhn), IBAN, CNP, nume din salut.
- **Verificarea reîncadrării** pe fiecare format și **profiluri de platformă** configurabile.
- **Studio**: tab-urile Calitate și Concept, editorul de scene cu undo/redo în Preview & timeline, etapa și oprirea joburilor, reluarea joburilor întrerupte.
- **Inventarul de design și producție** (`docs/INVENTAR.md`, `docs/SISTEM.md`), cu referințe spre cod verificate de lint.
- **Regresia vizuală**: referințe pentru tot catalogul și pentru toate rețetele (16:9 și 9:16), cu test de sensibilitate.
- **Testul pe un produs real** (`npm run e2e:real -- --url <site>`): intake, captură, research, brand, concepte și producția pe un site public, cu verificarea porții de drepturi (reclama „concept”, export refuzat).
- **Logo-ul din pagină** (SVG inline cu culoarea lui sau imaginea din antet), doar cu semnal clar; **paginile citite la research devin materiale**; captura cu `--third-party` pentru site-ul altcuiva.
- **Verificarea limbii replicilor** (offline): citatele de pe site în altă limbă decât reclama apar ca problemă mare, de tradus cu acordul utilizatorului.
- În Studio, banda „Unde e reclama”: etapele cap-coadă (brief → … → export), calculate din datele reale, cu etapa curentă și marcajul „concept”.
- **Captura de telefon pe formatele verticale**: la un proiect cu 9:16 sau 4:5, fiecare captură desktop se face și pe telefon (`--no-mobile` o oprește); compilatorul o folosește pe vertical doar dacă pagina e adaptată pentru telefon și arată toate zonele demonstrate în scenă, altfel raportul spune de ce rămâne desktopul. Pe un site real, interfața de pe 9:16 a trecut de la ~3,7 px la testul de 360 px la lizibilă.
- **Politica de adrese a capturii (SSRF)**: o pagină publică nu poate atinge rețeaua locală (resurse, WebSocket, service workers, redirecționări, pași `goto`), metadatele norilor nu se deschid niciodată, fără date de autentificare în adresă.
- **Jurnalul operațiilor** (`projects/<id>/usage.jsonl`, `mms usage`): vocile din cloud și locale, refolosirile din cache, randările, cu durată și unități; **bugetul de apeluri plătite** pe rulare (`MMS_MAX_PAID_CALLS`).
- `mms cache [--prune]` și curățarea automată a bundle-urilor vechi de randare.
- `mms rights <proiect> --source <site> confirmed`: drepturile tuturor capturilor unui site, într-o singură decizie.
- `npm run e2e -- --export`: testul cap-coadă merge până la exportul final al produsului demo fictiv, verificat cu ffprobe și cu analiza video.
- În Studio, la captură: opțiunea „site-ul altcuiva” (drepturi neconfirmate) și nota despre varianta de telefon.
- Documentație: deciziile 69–76.

### Schimbat

- `mms critique` rulează aceeași buclă la adâncimea „fast” (fără randare). `mms make` face un singur preview, la predare.
- Subtitrările ocolesc zona demonstrată (nu interfața întreagă) și nu se mai ard când replica e deja scrisă pe ecran.
- Cuvântul marcat de `text.highlight` primește o culoare lizibilă pe culoarea markerului.
- Tăieturile pe beat se aplică doar când tempo-ul e sigur; tăieturile spre dezvăluire cad pe drop-uri.
- Efectele sonore se coboară sub voce (−4 dB).
- Studio-ul acceptă doar Host-ul local; cererile care modifică cer Origin local și antetul `X-MMS`; încărcările acceptă doar tipuri cunoscute, maximum 500 MB.
- Joburile au manifest pe disc, timeout pe tip și oprire până la randarea Remotion.
- Drepturile capturilor se cer o dată pe site, cu același text pe toate formatele (înainte: o problemă pe fiecare captură și format).
- Storyboard-ul folosește captura desktop când există și varianta de telefon a aceleiași pagini; alegerea pe format o face compilatorul.
- Produsul demo fictiv are și așezare pentru telefon (doar sub 600 px; desktopul e neschimbat).

### Reparat

- Mișcarea reală la Final QA se citește din preview-ul existent (înainte: ~140 s de cadre randate separat).
- Contrastul se judeca pe culorile declarate: textul alb pe capturi deschise trecea verificarea.
- Intake-ul lua verbul „ai” drept „AI” și alegea butonul de autentificare drept CTA.
- Citirea site-ului relua pagina de start pe `file://` și urma legăturile spre aplicație.
- Ritmul din Reference DNA era mascat de cartonașul final.
- Brand kit-ul folosea o captură veche, fără datele de formă.
- O versiune nouă nu primea fișierele vocii.
- Găsite de testul pe produsul real:
  - CTA-ul nu era găsit pe site-urile unde butonul e un link, iar „de confirmat” ajungea pe cardul final și în voce. Acum linkurile stilizate ca butoane contează, CTA-ul nestabilit e critic, iar „free” nu mai alege un element de meniu.
  - Categoria devenea „produs AI” la o singură mențiune; acum semnalele au greutăți.
  - Titlurile din meniu și subsol apăreau ca funcții.
  - Pe ecran apărea un paragraf întreg din jurnalul de schimbări, cu data în față.
  - Documentația dădea „funcții” din textul de navigare.
  - Toate capturile intrau într-o singură scenă de montaj.
  - Drepturile apăreau o dată pe fiecare strat și format, nu pe material.
  - Durata peste ținta din brief nu era o problemă.
  - Platforma unui format din intake era aceeași pentru toate formatele (un 16:9 primea zonele TikTok).
  - Intake-ul promitea „logo din pagină” fără să-l extragă.
  - O corectură automată a camerei relua zoom-ul complet și captura intra peste titlu pe 16:9; acum păstrează zoom-ul limitat al rețetei, iar verificarea nouă `ui.material-over-text` prinde suprapunerea.
  - Cuvântul rostit din subtitrări dispărea când accentul brandului e închis; textul secundar (adresa de pe cardul final) avea contrast 2,3:1. Ambele se fac lizibile din aceeași nuanță.
  - Hold-ul de pe CTA era raportat ca „imagine înghețată”.
  - Scena de dezvăluire cu turul paginii nu arăta logo-ul.
  - Corecturile de cameră pentru odihnă vizuală și pentru lizibilitate se anulau una pe alta.
  - Adresa de pe cardul final păstra „/” la sfârșit.
  - Schița de script lua „funcții” din documentație și din paginile concurenților.
- Securitate: un id de versiune din URL-ul Studio-ului (`..%2F..%2F`) putea scrie în afara folderului proiectului; id-urile de proiect și de versiune se validează acum acolo unde devin căi. Logo-ul unei pagini de pe internet putea fi citit de pe disc (`file:`) sau din rețeaua locală.
- Cheia de cache a vocilor din cloud nu includea modelul (un model nou refolosea vocea veche), iar apelurile nu aveau timeout.
- Bundle-urile de randare se adunau la fiecare schimbare de cod (1,4 GB pe laptopul de test; 254 MB după curățare).
- README și `docs/LICENTE.md` spuneau „repo privat”, deși repo-ul e public; licența (toate drepturile rezervate) nu s-a schimbat.

### Contribuitori

- Fără co-autori și fără atribuiri automate: atribuirea e dezactivată în `.claude/settings.json`, iar `npm run lint` refuză commit-urile noi cu trailere de co-autor. Istoricul vechi nu a fost rescris.

## [0.1.0] – 2026-10-08

Prima versiune funcțională a studioului.

### Adăugat

- **Model de date** (zod) pentru toate entitățile și un depozit de proiecte cu versiuni imuabile, aprobări cu fraze exacte și `STATE.md`.
- **Captură reală** cu Playwright: capturi, pagină întreagă, mobil, înregistrări cadru cu cadru, zone din DOM, date personale, profil persistent pentru autentificare, opțiunile `--wait/--click/--hide/--type/--steps`.
- **Materiale:** ingestie cu analiză (ffprobe, fontkit, SVG, paletă, punct focal, dHash, rol), poarta de drepturi, decizia pentru date personale (estompare automată în video).
- **Research** cu surse, citate, încredere și lista „de confirmat”; **brand kit** din CSS și logo; **analiza videourilor de referință**.
- **Creativ:** direcțiile A–F, întrebările A–H (inclusiv livrarea), 8 șabloane, schița de script, constructorul de storyboard, gramatica de montaj.
- **Motorul de mișcare:** 124 de capabilități (cameră, tranziții, tipografie, interfață peste capturi, rame, media, 3D CSS, lumină, particule, distorsiuni, logo, grafice, modificatori) și 16 rețete.
- **Timeline** compilat și validator (footage real, drepturi, cifre, zone sigure, 360 px, flash-uri, goluri, date personale); formate 9:16, 16:9, 1:1, 4:5, 4K și personalizat, la 24–60 fps.
- **Audio** în TypeScript: 35 de efecte sintetizate, muzică originală, beat grid, voce (Windows offline, ElevenLabs, OpenAI, fișier), ducking, −14 LUFS, true peak ≤ −1 dBTP, subtitrări.
- **Randare:** preview MP4, foaie de contact, verificarea video; export final protejat; pachet de postare; variante de hook.
- **Critică** cu rubrica fixă și **iterație** în limbaj natural, cu versiuni noi.
- **Studio** local (React + Remotion Player) și **CLI** `mms`; Remotion Studio pe proiect sau pe catalog.
- **Instalare:** `install.ps1`, `install.sh`, `doctor`, `setup`, `update`.
- **Porți de calitate:** typecheck, lint pe regulile din CLAUDE.md, teste unitare, de integrare și de randare, testul cap-coadă pe produsul demo fictiv.
- **Claude Code:** `/make-ad`, `/fix-at`, `/add-effect`, `/new-version`; constituția de inginerie în `CLAUDE.md`.
- **Documentație** în română: README, arhitectură, bibliotecă (generată din cod), decizii, depanare, glosar, licențe, flux, stare, audit.

### Reparat (în timpul construcției, găsit de teste sau de revizuirea vizuală)

- Tăieturile diferă între formate cu FPS diferit (mixul comun se desincroniza): structura se calculează acum o dată, la 30 fps.
- Callout-ul se suprapunea cu subtitrarea pe vertical, ieșea din cadru după push sau era tăiat de marginea capturii. Acum partea se alege după poziția finală de pe ecran și eticheta are mărime constantă.
- Push-ul cu zoom mare împingea captura sub titlu: zoom-ul se limitează.
- Pe capturile de pagină întreagă, zona țintită putea fi în afara ecranului: derulare automată.
- `iterate` scria `voice.json` într-un folder inexistent.
- Un script editat după sinteza vocii ajungea în video cu vocea veche: vocea are acum amprentă și se reface automat.
- Compilarea pe o versiune înghețată se oprea cu eroare: acum creează versiunea următoare.
- Demonstrațiile trăgeau captura sub titlu: centrul camerei se limitează.
- Analiza referințelor număra o tranziție rapidă ca două tăieturi și dădea tempo-ul nesigur ca fapt.
- Capturile cu date personale nu aveau decizie și nu se estompau în video.
- Întrebările de livrare (grupa G) nu aveau efect.
- Opțiunea de calitate JPEG trimisă la randări PNG.
- Testul de determinism al cadrelor cerea octeți identici, deși rasterizarea Chrome variază rar cu 1–2/255. Acum tolerează exact această diferență, iar determinismul strict se verifică pe timeline.
