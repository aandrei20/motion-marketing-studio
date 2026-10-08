# Ce este Motion Marketing Studio

## Pe scurt

Motion Marketing Studio face reclame video pentru aplicații, site-uri și software. Tu îi dai produsul și ideea ta, iar el face reclama: cercetează produsul, scrie scriptul, face capturile reale, animă, adaugă sunet, îți arată un preview, corectează ce nu-ți place și, doar când spui tu, exportă videoul final.

Nu este un generator de clipuri la întâmplare. Este un mic studio de producție, în care Claude este regizorul, iar Remotion este cel care desenează videoul cadru cu cadru.

## Ce primești

- Un video MP4 gata de postat (TikTok, Reels, Shorts, YouTube, feed, LinkedIn, X).
- Opțional: subtitrări (arse în video și fișier `.srt`).
- Opțional: un pachet de postare cu imagine de copertă, titlu și descriere (hashtag-urile le propune Claude și le aprobi tu).
- Opțional: 2–3 variante de hook, fiecare ca versiune separată, ca să alegi cea mai bună.

## De ce are nevoie de la tine

- Numele și adresa produsului (URL-ul).
- Ideea ta: povestea, hook-ul, tonul. Dacă ai idei, ele au prioritate absolută și Claude le păstrează cuvânt cu cuvânt.
- Materialele tale, dacă ai: logo, capturi, video, muzică, voce, fonturi, videouri de referință.
- Răspunsuri la întrebările de la început (durează câteva minute și sunt cu variante de ales).
- Ascultarea ta la final: Claude nu poate auzi sunetul, deci notele tale despre muzică și voce sunt singura lui verificare reală.

## Cum funcționează, în 8 pași

1. **Întrebări.** Claude pune toate întrebările la început: produs, obiectiv, platformă, format, durată, ton, sunet și multe altele. Tu alegi din variante.
2. **Aprobarea planului.** Claude îți arată un rezumat. Dacă ești de acord, scrii „aprob”. Nu începe nimic înainte.
3. **Captură reală.** Un browser automat intră pe site-ul sau aplicația ta și face capturi și înregistrări reale. Niciun ecran nu este inventat.
4. **Cercetare.** Claude adună faptele despre produs (funcții, prețuri, public), cu sursă și dată. Ce nu poate verifica îți arată într-o listă și nu apare în video fără acordul tău.
5. **Script și storyboard.** Claude scrie scriptul (hook, voce, text pe ecran, apel la acțiune) și planul scenă cu scenă.
6. **Producție.** Se alege din biblioteca de efecte (cameră, text, tranziții, interfață, lumină, 3D, sunet) și se construiește reclama.
7. **Preview și corecții.** Vezi videoul în Studio (`npm run studio`), cu timeline-ul dedesubt. Asculți. Îmi dai note pe secundă („la 7,3 logo-ul e prea mic”) și se repară doar ce ai notat.
8. **Export.** Când ești mulțumit, scrii „render final” și se face MP4-ul.

## Reguli de care ne ținem mereu

- Interfața produsului vine doar din captură reală sau din fișierele tale.
- Pentru materialele altora (logo, muzică, footage) te întreabă o dată dacă ai dreptul să le folosești. Răspunderea este a ta.
- Nimic inventat: fără prețuri, cifre sau promisiuni fără sursă.
- Nimic nu se exportă fără „render final”.
- Nimic nu se instalează în timpul lucrului. Instalezi tot o dată, la început.
- Nicio versiune nu o șterge pe cea veche.

## Cum e organizat folderul

- `src/` – motorul (codul care construiește videoul)
- `library/` – biblioteca de efecte, cu fișă pentru fiecare
- `projects/` – reclamele tale (nu urcă pe Git)
- `tests/` – verificările automate
- `docs/` – documentația
- `CLAUDE.md` – regulile pe care Claude le citește la fiecare sesiune
- `PLAN.md` – planul complet

## Unde continui

- Instalare și prezentare completă: `README.md`
- Folosire pas cu pas: `README_flux.md` (referința completă: `docs/FLUX.md`)
- Termeni necunoscuți: `docs/GLOSAR.md`
- Ceva nu merge: `docs/DEPANARE.md`
- Ce funcționează și ce nu încă: `docs/IMPLEMENTATION_STATUS.md`
