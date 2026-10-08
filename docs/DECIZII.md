# Decizii tehnice

Fiecare decizie are motivul ei. Deciziile de produs (ce face studioul, regulile) sunt în `PLAN.md` și `CLAUDE.md`. Aici sunt cele de construcție, luate pe 2026-10-08.

## Stack

1. **Totul în TypeScript, fără Python.** Audio-ul (WAV, filtre, loudness BS.1770-4, true peak, limitator, reverb, detecția tempo-ului, muzica și efectele sintetizate) e scris în TypeScript. Motiv: o singură instalare (`npm ci`), fără al doilea ecosistem pe Windows. Costul: am implementat noi algoritmii; testele le verifică cu valori de referință (de ex. sinus de 997 Hz la 0 dBFS = −3,01 LUFS).
2. **FFmpeg nu se instalează separat.** Remotion vine cu FFmpeg/FFprobe (`@remotion/compositor-win32-x64-msvc`); `src/core/binaries.ts` le folosește pentru probe, miniaturi, decodare și asamblarea înregistrărilor. Motiv: instalare mai simplă și o singură versiune de FFmpeg.
3. **zod 4 e singura sursă a schemelor.** Tipurile TypeScript, validarea fișierelor și JSON Schema din `library/registry.json` (`z.toJSONSchema`) vin din aceleași definiții. Motiv: Claude scrie JSON pe care motorul îl validează exact.
4. **Remotion 4, versiuni fixate exact.** Toate pachetele `@remotion/*` au aceeași versiune (verificată de `doctor`). Studio-ul folosește `@remotion/player` cu aceeași compoziție ca randarea, deci preview-ul din browser și MP4-ul arată la fel.
5. **Fără GSAP și fără Three.js, deocamdată.** 3D-ul (rame de dispozitiv, stive, cărți, orbită, înclinări) e CSS 3D real, cu perspectivă. Motiv: e suficient pentru interfețe plane, e determinist și nu adaugă un motor de randare. Three.js intră doar când un efect cere geometrie reală (CLAUDE.md: „cu motiv scris”).
6. **Studio fără framework de server.** Un server Node `http` (API JSON, fișiere cu Range, SSE, coadă de joburi), plus interfață React construită cu esbuild la pornire. Motiv: zero dependențe în plus și pornire rapidă. Ascultă doar pe 127.0.0.1.

## Captură

7. **Înregistrarea se face cadru cu cadru, nu cu `recordVideo` din Playwright.** Capturi JPEG în rafală cu marcaj de timp, apoi asamblare la FPS constant cu FFmpeg. Motiv: `recordVideo` are FPS variabil și calitate mică; în reclamă înregistrarea trebuie să fie clară și sincronizabilă.
8. **Zonele din captură se iau din DOM.** Butoane, câmpuri, carduri și titluri, cu poziția exactă în pixelii capturii. Motiv: efectele (zoom, spotlight, callout, cursor) pot ținti „câmpul de căutare” fără să ghicească din imagine.
9. **Culorile de brand vin întâi din variabilele CSS calculate.** Le citim cu `getComputedStyle` (merge și pe `file://`, unde regulile CSS sunt blocate), apoi din frecvența culorilor. Accentele se ordonează după saturație × luminozitate × frecvență.
10. **Paginile de aplicație nu intră în research** (`research: false`). Motiv: datele de test din aplicație („18 / 24 sarcini”) nu sunt afirmații despre produs.

## Motor de mișcare

11. **Timeline declarativ, compilat.** Claude scrie storyboard-ul (intenții); compilatorul produce timeline-ul (cadre, pixeli). Randarea citește doar timeline-ul. Motiv: determinism, validare înainte de randare și comenzi locale („la 00:14…”) fără regenerarea totului.
12. **Scenele se suprapun pe durata tranziției.** Scena nouă începe cu `d` cadre înainte de finalul celei vechi. Motiv: nu există cadre fără scenă, deci nu apar cadre negre între scene.
13. **Camera e un punct din lume pus în centrul cadrului, cu adâncime pe strat.** Adâncimea 0 = fix pe ecran (text, subtitrări), 1 = în scenă, între ele = parallax. Motiv: textul rămâne lizibil în timp ce camera se mișcă, iar parallax-ul vine gratuit.
14. **Blur-ul de mișcare e calculat din viteza camerei, calibrat ca un obturator de 180°.** Prima variantă era mult prea puternică.
15. **Textul se măsoară cu fontul real și în Node (fontkit), și în browser (canvas)**, cu același algoritm (căutare binară pe mărime + împărțire pe rânduri). Compilatorul scrie rândurile și mărimea în timeline. Motiv: validatorul știe exact cât de mare e textul (test de 360 px), fără randare.
16. **Copiii unui `media.screen` sunt în pixelii capturii.** Spotlight-ul, cursorul și callout-ul urmăresc astfel zoom-ul, decupajul și scroll-ul capturii.
17. **Adaptoare de layout pe format.** Pe vertical, o captură de desktop devine un card decupat în jurul funcției (`portraitCrop`). Textul fix ocolește zonele excluse ale platformei, iar camera țintește centrul zonei media, nu centrul cadrului.

## Montaj și creativ

18. **Duratele vin din gramatica de montaj**, nu din șablon: timp de citire = max(0,8 s, cuvinte / 3), vocea prelungește scena, hold minim de 2,5 s pe CTA, J-cut. Șablonul dă doar ponderi.
19. **Tranziția se alege după direcție și diferența de energie** și nu se repetă de două ori la rând.
20. **Direcțiile A–F sunt profiluri executabile** (fonturi, ritm, tranziții, cameră, culori, muzică), nu doar descrieri.
21. **Critica automată e euristică și declarată ca atare.** `mms-auto-critic-v1` verifică structura (durate, text, ritm, repetiții, zone sigure, mix, raportul video). Nu vede imaginea. Revizuirea vizuală (foaia de contact, cadrele) o face Claude, separat, ca reviewer `claude-visual`. Motiv: CLAUDE.md cere același reviewer și aceeași rubrică în toate rundele, iar un critic determinist e comparabil de la o rundă la alta.
22. **Variantele de hook sunt versiuni separate**, toate pornind din aceeași versiune. Utilizatorul le compară ca preview-uri complete.
23. **Pachetul de postare nu inventează hashtag-uri.** Titlul și descrierea sunt replici deja aprobate din script, iar hashtag-urile le propune Claude și le aprobă utilizatorul (regula 5).

## Audio

24. **Muzica originală e compusă pe structura reclamei**: tempo după direcție, accente pe tăieturi, final pe CTA. Muzica utilizatorului primește beat grid detectat (comb pe faze + faza benzii joase pentru prima bătaie).
25. **Ducking cu rampă de 500 ms, normalizare la −14 LUFS, limitator cu plafon −1 dBTP măsurat cu interpolare 4×.** Mixerul raportează; exportul final cere raport „ok”.
26. **TTS offline prin Windows OneCore** (PowerShell + WinRT), cu marcaje de cuvinte pentru subtitrări. Textul se transmite printr-un fișier UTF-8, altfel se pierd diacriticele. Pentru folosirea comercială a vocilor Windows, vezi `docs/LICENTE.md`.
27. **Subtitrările au un fundal discret** pe toate formatele: pe vertical zona media continuă sub banda lor, iar pe orizontal push-ul camerei poate aduce captura sub ele.

## Siguranță și calitate

28. **Zonele sigure ale platformelor vin din surse secundare** (încredere medie, verificate pe 2026-10-08), cu sursa trecută în `src/core/formats.ts`. Înainte de o campanie mare, verifică-le în Ads Manager.
29. **Testul de 360 px** se face pe latura scurtă a videoului, afișată la 360 px. Minimum 12 px pentru textul principal și 9 px pentru cel secundar. Interpretare proprie a regulii 17, notată aici.
30. **Versiunile se îngheață** la crearea unei versiuni-copil, la preview, la aprobare și la final. Rapoartele de randare se pot scrie și pe o versiune înghețată, pentru că descriu randarea, nu o schimbă. Exporturile nu se suprascriu niciodată.
31. **Randarea folosește un bundle cache-uit** (hash pe surse) și un folder public pregătit doar cu fișierele folosite (hard links). Motiv: randări repetate rapide, fără copierea proiectului.
32. **Nimic nu se instalează în timpul lucrului.** `doctor` doar verifică și spune comanda; `install.ps1` instalează Node/Git doar cu acordul utilizatorului.

## Așezarea peste capturi (după revizuirea vizuală)

33. **Callout-urile au mărime constantă pe ecran**: compensează și scara capturii, și zoom-ul camerei (`CameraZoomContext`). Partea pe care stau se alege după poziția finală a zonei pe ecran, după push, în limitele capturii vizibile și ale zonei media.
34. **Materialul nu trece peste textul fix.** Zoom-ul push-urilor se limitează (`limitZoomForText`), iar centrul camerei din demonstrații se mută cât e nevoie (`clearOfText`). Dacă limita lasă un zoom neglijabil, camera nu mai traversează captura, ci face un push lent pe centru.
35. **Capturile de pagină întreagă se derulează automat** până la zona țintită, când aceasta e sub partea vizibilă.

## Versiuni și voce

36. **Vocea are o amprentă** (setările din brief + textul rostit). Compilarea refolosește vocea doar dacă amprenta e aceeași; altfel o reface (TTS-ul e în cache, deci e rapid). Motiv: un script editat manual nu trebuie să ajungă cu vocea veche.
37. **Compilarea pe o versiune înghețată creează versiunea următoare**, cu jurnal („recompilare”), ca orice altă modificare.
