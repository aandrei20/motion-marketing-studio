# Glosar

Termenii folosiți în studio, în documentație și în mesajele de eroare. Glosarul din `docs/TUTORIAL.md` acoperă termenii generali (repo, Node, commit, LUFS…); aici sunt cei specifici studioului.

| Termen | Ce înseamnă aici |
| --- | --- |
| **Proiect** | O reclamă (sau o campanie), în `projects/<id>/`: brief, materiale, research, brand, versiuni, exporturi, `STATE.md` |
| **Brief** | Răspunsurile tale la întrebările A–H, salvate în `brief.json`. Lucrul începe doar după „aprob” |
| **Versiune** (v1, v2…) | O variantă completă a reclamei (script, storyboard, timeline, audio, preview-uri, critică). O versiune cu preview, aprobată sau finală e **înghețată**: orice schimbare creează versiunea următoare |
| **Material** (asset) | Orice fișier al proiectului: captură, înregistrare, logo, imagine, video, muzică, voce, font, referință. Are sursă, rol, drepturi și analiză în `assets.json` (manifestul) |
| **Captură reală** | Imagine sau înregistrare a produsului făcută de browserul automat (Playwright) sau dată de tine. Singura sursă pentru interfața produsului |
| **Zonă din captură** (region) | Un element al paginii (buton, câmp, card, titlu) cu poziția lui, găsit automat la captură. Efectele o pot ținti: „zoom pe câmpul de căutare” |
| **Afirmație** (claim) | Un lucru spus despre produs, cu tip (fapt / inferență / interpretare creativă), sursă, citat, dată și încredere. Doar afirmațiile verificate sau aprobate de tine pot intra în video |
| **De confirmat** | Afirmații (mai ales prețuri și cifre) care nu intră în video fără acordul tău |
| **Direcție creativă** (A–F) | Stilul general: emoțional, agresiv, premium, tehnic, minimal, energic. Fiecare are tipografie, ritm, tranziții, cameră, culoare și muzică proprii |
| **Șablon** | Structura unei reclame (ce scene, în ce ordine, cu ce rol), în `templates/` |
| **Rețetă** | Cum arată o scenă: combină capabilitățile (de ex. „ui-spotlight” = captură în ramă + cameră spre funcție + spotlight + contur + callout) |
| **Capabilitate** | Un efect sau un element din bibliotecă (strat, modificator, cameră, tranziție), cu fișă în registry |
| **Strat** (layer) | Un element din cadru: text, captură, fundal, particule, cursor… Are poziție, timp, parametri și adâncime |
| **Modificator** | Ceva ce se aplică peste orice strat: intrare animată, umbră, strălucire, blur, înclinare 3D, reflexie |
| **Adâncime** (depth) | Cât de mult urmărește stratul camera: 0 = fix pe ecran (text, subtitrări), 1 = în scenă; între ele = parallax |
| **Timeline compilat** | `timeline-<format>.json`: lista exactă de scene, straturi, cameră, sunete și subtitrări, cadru cu cadru. Singura sursă pentru randare |
| **Compilator** | Transformă storyboard-ul în timeline: durate, tăieturi pe beat, tranziții, rețete, text măsurat, sunete |
| **Validator** | Verifică timeline-ul înainte de randare: footage real, drepturi, cifre cu sursă, zone sigure, lizibilitate, flash-uri, goluri |
| **Blocaj** (blocker) | O problemă care oprește exportul final până e rezolvată |
| **Gramatica de montaj** | Regulile pentru durate și tăieturi: timpul de citire, hold pe CTA, J-cut, tăietura pe bătaie, alegerea tranziției după energie |
| **J-cut** | Vocea scenei următoare începe puțin înainte de tăietură |
| **Beat grid** | Pozițiile bătăilor muzicii (tempo, prima bătaie, măsuri). Tăieturile și impacturile se aliniază pe ele |
| **Cue sheet** | Lista tuturor sunetelor (voce, efecte, muzică), cu cadrul exact și motivul fiecăruia |
| **Mix** | Sunetul final (`mix.wav`): voce + muzică + efecte, cu ducking, −14 LUFS și vârf ≤ −1 dBTP |
| **Preview** | Randare MP4 a unei versiuni, cu foaie de contact și raport tehnic. Nu e exportul final |
| **Foaie de contact** | O imagine cu multe cadre mici din reclamă, ca să vezi tot filmul dintr-o privire |
| **Export final** | MP4-ul livrabil, în `exports/`, făcut doar după „render final” și doar fără blocaje |
| **Concept** | Marcaj pentru un preview care folosește materiale fără drepturi confirmate; un astfel de timeline nu se poate exporta final |
| **Rubrica** | Cele 7 criterii fixe ale criticii: hook, claritate, ritm, ierarhie vizuală, varietate, brand, CTA |
| **Critic automat** | Verificare euristică (`mms-auto-critic-v1`) a timeline-ului cu rubrica: durate, text, ritm, repetiții, zone sigure, mix. Nu vede imaginea; revizuirea vizuală o face Claude separat |
| **Iterație** | O schimbare cerută în cuvinte („la 00:14 zoom pe…”), aplicată local într-o versiune nouă, cu jurnal |
| **Zonă sigură** | Partea din cadru neacoperită de interfața platformei (butoane, descriere); textul și butoanele stau doar acolo |
| **Zonă exclusă** | O parte din zona sigură acoperită totuși (de ex. coloana de butoane din dreapta pe TikTok) |
| **Test de 360 px** | Latura scurtă a videoului afișată la 360 px: textul principal trebuie să aibă cel puțin 12 px, cel secundar 9 px |
| **Studio** | Interfața web locală (`npm run studio`) |
| **Remotion Studio** | Editorul vizual al Remotion (`npm run remotion -- <proiect>`), pentru inspectarea cadru cu cadru |
| **Registry** | Lista tuturor capabilităților, generată din cod în `library/registry.json` |
| **STATE.md** | Fișierul de stare al proiectului: ce s-a făcut, ce urmează, decizii, versiunea curentă |
