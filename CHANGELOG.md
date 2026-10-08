# Changelog

Formatul: o secțiune pe versiune; în fiecare: Adăugat, Schimbat, Reparat. Versiunile stabile primesc o etichetă Git (`v0.1.0`…).

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
