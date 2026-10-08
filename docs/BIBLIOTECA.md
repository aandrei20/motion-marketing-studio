# Biblioteca de efecte

Fișier generat din cod de `scripts/build-docs.ts` – nu îl edita de mână. Sursa de adevăr: `src/motion/registry.ts` și `library/registry.json`.

**124 capabilități** · **16 rețete** · **8 șabloane** · **35 sunete sintetizate** · **6 direcții creative**

Fiecare capabilitate are implementare reală, parametri validați (zod), sunet declarat și un exemplu randat de testul de catalog (`tests/render/catalog.test.ts`), care verifică și determinismul. Starea „tested” înseamnă că exemplul a fost randat și a trecut testele.

Vezi catalogul vizual: `npm run remotion` (compoziția „Catalog”).

## Fundaluri (5)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `bg.solid` | **Fundal plin.** O culoare plină din paleta brandului. | — | tested |
| `bg.gradient` | **Gradient animat.** Gradient lent în culorile brandului, cu unghi care derivă. Fundal discret, nu concurează cu mesajul. | — | tested |
| `bg.mesh` | **Gradient „mesh” viu.** Pete mari de culoare, estompate, care plutesc lent (zgomot cu sămânță). Fundal modern, cu adâncime. | — | tested |
| `bg.grid` | **Grilă tehnică.** Grilă fină de linii, plată sau în perspectivă (podea), care derivă lent. Pentru produse tehnice/dev. | — | tested |
| `bg.image` | **Fundal din imagine (estompat).** O imagine (de ex. o captură) folosită ca fundal: estompată, întunecată și ușor mărită, pentru adâncime. | — | tested |

## Lumină (10)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `bg.waves` | **Valuri.** Linii sinusoidale suprapuse care curg lent (SVG). Pentru audio, fluxuri, date. | — | tested |
| `bg.beat-bars` | **Bare de egalizator pe ritm.** Bare care pulsează pe bătăile din beat grid (deterministe). Reacționează la ritmul declarat, nu la spectrul audio real. | — | tested |
| `fx.vignette` | **Vignetă.** Margini ușor întunecate care duc ochiul spre centru. | — | tested |
| `fx.light-sweep` | **Dungă de lumină (light sweep).** O bandă de lumină traversează cutia o dată, pe diagonală. Pune accent pe un element sau pe un logo. | shimmer (start) | tested |
| `fx.glow-orbs` | **Lumini difuze (glow / bloom).** Surse de lumină mari și moi care respiră lent. Dau strălucire și adâncime fundalului. | — | tested |
| `fx.god-rays` | **Raze de lumină.** Raze care pornesc dintr-un punct și se rotesc lent, pentru o revelare (produs, logo). | — | tested |
| `fx.fog` | **Ceață / fum.** Straturi mari de ceață moale care derivă, pentru atmosferă (cinematic, emoțional). | — | tested |
| `fx.glass` | **Panou de sticlă mată.** Un panou translucid care estompează ce e în spate (backdrop-filter), cu margine luminoasă. Suport pentru text. | whoosh-soft (start) | tested |
| `fx.lens-flare` | **Lens flare subtil.** O sursă de lumină cu o dungă orizontală și câteva cercuri pe diagonală, care trece prin cadru. Folosit rar. | — | tested |
| `fx.light-leak` | **Light leak (strat).** Lumină caldă care se scurge pe margine și pulsează lent, ca pe peliculă. | — | tested |

## Textură (2)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `fx.grain` | **Grain de film.** Zgomot fin, schimbat de câteva ori pe secundă, ca pe film. Calculat cu sămânță pe cadru (determinist). | — | tested |
| `fx.scanlines` | **Scanlines / CRT.** Linii orizontale fine și o bandă care rulează, ca pe un monitor vechi. Folosit rar. | — | tested |

## Particule (4)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `fx.particles` | **Particule (praf, scântei, bokeh, jar).** Particule cu poziții din sămânță și mișcare calculată din cadru. Numărul se reduce automat în modul draft. | — | tested |
| `fx.burst` | **Explozie de confetti / scântei.** O explozie la un moment dat: bucăți care zboară pe traiectorii balistice (formulă închisă, deterministă) și cad. | pop (param:at), sparkle (param:at) | tested |
| `fx.shapes` | **Forme geometrice plutitoare.** Cercuri, pătrate și triunghiuri contur care plutesc și se rotesc lent. Decor grafic, nu interfață. | — | tested |
| `fx.trails` | **Puncte cu urme.** Puncte care se mișcă pe curbe și lasă urme care se sting (traiectorii calculate din cadru). | — | tested |

## Forme (3)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `shape.panel` | **Panou / bloc de culoare.** Un dreptunghi (cu colțuri) în culoarea brandului care intră pe o direcție. Bază pentru text, separator grafic sau card de CTA. | swipe (start) | tested |
| `shape.line-draw` | **Linie / săgeată desenată.** O linie sau o curbă care se trasează între puncte, opțional cu vârf de săgeată. Pentru legături și indicații. | marker (start) | tested |
| `shape.ring-pulse` | **Inel de impact.** Unul sau mai multe inele care se extind și se sting dintr-un punct, la un impact (logo, buton, drop). | impact-small (param:at) | tested |

## Tipografie (16)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `text.word-reveal` | **Apariție pe cuvinte (stagger).** Cuvintele urcă și apar pe rând, pe arc fără depășire. Textul de bază pentru mesaje. | tick-soft (each) | tested |
| `text.char-reveal` | **Apariție pe litere.** Literele apar pe rând cu o mică rotație și urcare. Pentru titluri scurte. | whoosh-soft (start) | tested |
| `text.mask-reveal` | **Text ieșit de sub mască.** Fiecare rând urcă de sub o linie invizibilă (mask reveal). Elegant, editorial. | whoosh-soft (start) | tested |
| `text.slam` | **Slam.** Textul cade din scară mare cu impact, un mic tremur și blur la intrare. Pentru afirmații tari. | slam (start) | tested |
| `text.pop` | **Pop cu depășire.** Fiecare cuvânt sare din nimic, depășește puțin mărimea finală și se așază. Jucăuș, social. | pop (each) | tested |
| `text.blur-reveal` | **Apariție din blur.** Cuvintele trec din blur în focus. Calm, premium, cinematic. | whoosh-soft (start) | tested |
| `text.tracking` | **Animație de spațiere (tracking).** Spațierea dintre litere se strânge spre valoarea finală, cu apariție. Rafinat, pentru titluri scurte. | whoosh-soft (start) | tested |
| `text.typewriter` | **Typewriter cu cursor.** Textul se scrie literă cu literă, cu cursor care clipește. Fiecare tastă are sunet. | key (each) | tested |
| `text.split` | **Text despicat.** Prima jumătate a cuvintelor vine din stânga, a doua din dreapta, și se întâlnesc. Pentru contraste („înainte / după”). | swipe (start) | tested |
| `text.highlight` | **Evidențiere pe cuvânt (marker, subliniere, tăiere, cerc).** Textul apare, apoi cuvintele de accent primesc un marker, o subliniere, o tăiere sau un cerc desenat. | marker (param:markAt) | tested |
| `text.outline-fill` | **Contur, apoi umplere.** Textul apare doar ca un contur, apoi se umple cu culoare de la stânga la dreapta. | whoosh-soft (start) | tested |
| `text.glitch` | **Text glitch.** Textul intră cu canale de culoare separate și salturi digitale câteva cadre, apoi se stabilizează. | glitch (start) | tested |
| `text.big-word` | **Un cuvânt pe tot ecranul.** Un singur cuvânt, cât de mare încape, pentru un moment mare. Intră cu un punch de scară. | impact-small (start) | tested |
| `text.body` | **Text secundar.** Text de susținere (subtitlu, detaliu), care apare discret, fără să concureze cu mesajul principal. | — | tested |
| `text.counter` | **Contor animat.** Un număr care numără până la valoare (cu prefix/sufix, de ex. 99%, 3×, 10.000+). Valoarea trebuie să vină dintr-o afirmație verificată (claimId). | counter (start), tick-hi (param:countFrames) | tested |
| `text.captions` | **Subtitrări cuvânt cu cuvânt.** Subtitrări sincronizate cu vocea: fraza curentă, cu cuvântul rostit evidențiat (stil TikTok). Timpii vin din motorul TTS sau din estimare. | — | tested |

## Interfață (straturi peste captura reală) (19)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `media.screen` | **Ecran real (captură sau înregistrare) în ramă.** Afișează o captură reală sau o înregistrare de ecran, opțional într-o ramă (browser, telefon, laptop, fereastră), cu decupare pe o zonă (UI crop / zoom pe regiune) și scroll animat. Straturile-copil (cursor, evidențieri, callout-uri) se poziționează în pixelii capturii și urmăresc zoom-ul și scroll-ul. | — | tested |
| `media.compare` | **Înainte / după cu separator glisant.** Două imagini suprapuse; un separator glisează și dezvăluie varianta „după”. Etichete opționale. | swipe (param:startFrame) | tested |
| `media.cards` | **Cascadă de carduri.** Mai multe imagini (capturi, decupaje) intră ca un evantai de carduri, pe rând, cu sunet pe fiecare. | pop (each) | tested |
| `ui.cursor` | **Cursor animat cu clicuri.** Un cursor care trece prin puncte (în pixelii capturii), cu accelerare/încetinire naturală, arc ușor și undă la clic. Fiecare clic are sunet. | click (each) | tested |
| `ui.click` | **Undă de clic.** Undă care pornește din punctul apăsat. Folosit și fără cursor, pentru tap-uri pe mobil. | click (param:at) | tested |
| `ui.hover` | **Hover: elementul se luminează.** Zona (un buton, un card) se luminează și se ridică ușor, ca la trecerea mouse-ului. | tick-soft (start) | tested |
| `ui.typing` | **Scriere într-un câmp real.** Text scris literă cu literă peste câmpul (input) găsit în captură, cu cursor de text. Fiecare tastă are sunet. | key (each) | tested |
| `ui.spotlight` | **Spotlight pe o zonă.** Restul ecranului se întunecă; zona aleasă rămâne luminată, cu margine moale. | whoosh-soft (start) | tested |
| `ui.highlight` | **Contur desenat în jurul unei zone.** Un dreptunghi, o elipsă sau o subliniere se desenează în jurul zonei (animație de trasare). | marker (start) | tested |
| `ui.callout` | **Callout cu linie spre element.** O etichetă scurtă legată printr-o linie de o zonă din captură. Eticheta și linia păstrează aceeași mărime pe ecran la orice zoom (al capturii sau al camerei). | pop (start) | tested |
| `ui.tooltip` | **Tooltip.** O bulă mică cu săgeată, deasupra unei zone, pentru o explicație de 2–4 cuvinte. | pop (start) | tested |
| `ui.drag` | **Drag and drop.** O bucată din captură (zona sursă) este ridicată și mutată la o țintă, cu umbră; pixelii sunt cei reali. | tick-soft (param:at), drop (param:dropAt) | tested |
| `ui.blur-region` | **Estompare date personale.** Estompează o zonă cu date personale (email, nume de cont). Se aplică doar cu acordul utilizatorului (pii.blurApproved). | — | tested |
| `ui.zoom-lens` | **Lupă pe un detaliu.** Un cerc sau un card care arată mărit o zonă reală din captură. Se folosește împreună cu un contur pe zona-sursă. | pop (start) | tested |
| `ui.notification` | **Notificare / toast (grafică generică).** Un card de notificare generic, în culorile brandului, care alunecă în cadru cu sunet. Grafică, nu interfața produsului: textul trebuie să fie un fapt verificat. | notification (start) | tested |
| `ui.progress` | **Bară de progres.** O bară care se umple până la o valoare, cu sunet la final. Grafică generică. | ding (param:endFrame) | tested |
| `ui.toggle` | **Comutator.** Un comutator generic care trece pe „pornit” cu arc și sunet. | toggle (param:at) | tested |
| `ui.code` | **Cod animat.** Un bloc de cod real (dat de utilizator) cu colorare sintactică, scris rând cu rând sau literă cu literă; rânduri evidențiate. | key (each) | tested |
| `ui.terminal` | **Terminal animat.** Comenzi scrise într-un terminal, urmate de ieșirea lor rând cu rând. Comenzile și ieșirea trebuie să fie reale. | key (each) | tested |

## Media (imagini, video, ecrane) (2)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `media.image` | **Imagine (produs, foto, ilustrație).** O imagine încadrată (cover/contain) cu colțuri și mișcare Ken Burns opțională (zoom lent spre un punct). | — | tested |
| `media.video` | **Video cu viteză controlată (speed ramp, freeze).** Un clip video (înregistrare de ecran sau footage) cu tăiere, viteză pe segmente (speed ramp real, segment cu segment) și înghețare pe ultimul cadru. | — | tested |

## 3D (CSS 3D real) (3)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `media.stack-3d` | **Stivă de ecrane în adâncime.** Mai multe capturi așezate în spațiu 3D (CSS 3D real), prin care camera trece în timp. | whoosh-long (start) | tested |
| `media.device-3d` | **Dispozitiv 3D cu captura reală.** Un telefon sau laptop generic care se rotește și plutește în 3D (CSS 3D cu perspectivă), cu captura reală pe ecran. | whoosh-soft (start) | tested |
| `mod.tilt-3d` | **Înclinare 3D în perspectivă.** Stratul se rotește în 3D (rotateX/rotateY cu perspectivă reală CSS) între două unghiuri. Pentru ecrane și carduri. | — | tested |

## Rame de dispozitiv (generice) (4)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `frame.browser` | **Ramă de browser.** Fereastră de browser generică (bară cu adresă), în jurul unei capturi de site. | — | tested |
| `frame.phone` | **Ramă de telefon.** Telefon generic (fără marcă), în jurul unei capturi de aplicație mobilă. | — | tested |
| `frame.laptop` | **Ramă de laptop.** Laptop generic, pentru aplicații desktop sau web. | — | tested |
| `frame.desktop` | **Fereastră de aplicație desktop.** Fereastră generică de aplicație (bară de titlu). | — | tested |

## Logo (4)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `logo.reveal` | **Logo reveal (pop, scară, urcare, mască, asamblare).** Apariția logo-ului: pop cu arc, creștere lentă, urcare, dezvăluire cu mască sau asamblare din benzi. Fără rotire sau recolorare. | impact-small (param:at) | tested |
| `logo.light-pass` | **Lumină care trece peste logo.** O dungă de lumină traversează logo-ul, decupată exact pe forma lui (mască din canalul alfa). | shimmer (param:at) | tested |
| `logo.particles` | **Logo din particule.** Particule vin din toate direcțiile spre centru, iar la sosire apare logo-ul cu un flash discret. | riser-short (start), impact (param:arrive) | tested |
| `logo.lockup` | **Lockup logo + text.** Logo-ul apare, apoi se mută lateral și lasă loc unui text (nume, slogan sau CTA), care se dezvăluie din spatele lui. | pop (start), swipe (param:textAt) | tested |

## Date și grafice (doar cifre cu sursă) (6)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `data.bars` | **Bare animate.** Bare care cresc pe rând până la valorile lor, cu etichetă și valoare. Sunet tick pe fiecare bară. | tick (each) | tested |
| `data.line` | **Linie / sparkline care se desenează.** O linie de date se trasează de la stânga la dreapta, cu zonă umplută și punct final. Mică (sparkline) sau mare. | whoosh-soft (start), tick-hi (param:drawFrames) | tested |
| `data.ring` | **Inel de progres / gauge.** Un inel care se umple până la un procent, cu numărul în centru. | counter (start), ding (param:fillFrames) | tested |
| `data.compare` | **Comparație între două valori.** Două bare verticale una lângă alta (de ex. „înainte” și „după”), cu valorile numărând. | tick (start), impact-small (param:revealAt) | tested |
| `data.pie` | **Grafic circular (donut).** Segmente care se desenează pe rând într-un donut, cu legendă. | tick (each) | tested |
| `data.timeline` | **Linie de timp / pași.** O linie se desenează și dezvăluie pe rând etape (pași ai unui flux sau momente dintr-o lansare). | pop (each) | tested |

## Modificatori (se aplică pe orice strat) (8)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `mod.enter` | **Intrare și ieșire cu arc.** Intrarea standard a oricărui strat (pop, urcare, cădere, alunecare, scară), cu motion blur din viteză și ieșire rapidă. Fade-ul simplu e doar alegere conștientă. | — | tested |
| `mod.glow` | **Glow / neon cu puls.** Aură luminoasă în jurul stratului (drop-shadow colorat), opțional pulsând ca un neon. | — | tested |
| `mod.shadow` | **Umbră (moale sau de contact).** Umbră care așază stratul în spațiu: moale și largă, sau scurtă și densă (umbră de contact). | — | tested |
| `mod.reflection` | **Reflexie pe suprafață lucioasă.** O copie oglindită, estompată spre jos, sub strat (ca pe o masă lucioasă). | — | tested |
| `mod.blur` | **Blur animat.** Estompare care crește sau scade în timp (de ex. fundalul se estompează când apare textul). | — | tested |
| `mod.color-grade` | **Gradare de culoare.** Tratamente de culoare: duotone în culorile brandului, cald, rece, alb-negru, contrast cinematic. | — | tested |
| `mod.mask-reveal` | **Dezvăluire cu mască.** Stratul apare dintr-o mască: wipe pe o direcție, cerc din centru sau bandă diagonală. | swipe (start) | tested |
| `mod.float` | **Plutire.** Mișcare lentă sus-jos și o rotație mică, ca nimic să nu stea perfect înghețat. | — | tested |

## Distorsiuni (3)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `mod.chromatic` | **Aberație cromatică (RGB split).** Canalele roșu și albastru se separă orizontal. Static sau cu impulsuri pe momente date. | — | tested |
| `mod.ripple` | **Ondulare / lichid / deplasare.** Deformare cu hartă de zgomot (feTurbulence + feDisplacementMap). Lent = lichid, rapid = ondulare. | — | tested |
| `mod.pixelate` | **Pixelare (mozaic).** Imaginea se descompune în pătrate mari și se recompune. Pentru dezvăluiri și tranziții digitale. | — | tested |

## Cameră (14)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `camera.static` | **Cameră fixă.** Cadru fix, opțional ușor mărit. Pentru momente de citire și cardul final (hold fără mișcare). | — | tested |
| `camera.push` | **Push-in spre punctul de interes.** Camera înaintează spre punctul de focus al scenei (o zonă din captură). Zoom geometric, easing configurabil. | — | tested |
| `camera.pull` | **Pull-out (dezvăluire).** Pornește aproape de punctul de interes și se retrage, dezvăluind contextul. | — | tested |
| `camera.pan` | **Pan (stânga, dreapta, sus, jos).** Translație laterală sau verticală peste scenă. Zoom-ul crește automat cât să nu se vadă marginile. | — | tested |
| `camera.tilt` | **Tilt 3D (înclinare).** Camera se înclină în jurul axei orizontale (rotateX cu perspectivă), pentru o intrare cinematică peste un ecran. | — | tested |
| `camera.orbit` | **Orbită ușoară.** Rotire în jurul axei verticale (rotateY cu perspectivă), ca o cameră care ocolește obiectul. | — | tested |
| `camera.dolly-zoom` | **Dolly zoom (vertigo).** Fundalul (straturi cu adâncime 1) se mărește sau se micșorează în timp ce subiectul pus la adâncime 0 rămâne fix. Efect rar, pentru un moment de șoc. | — | tested |
| `camera.handheld` | **Handheld (cameră din mână).** Mișcare fină, continuă și organică (zgomot fractal cu sămânță), plus un zoom mic ca marginile să nu se vadă. | — | tested |
| `camera.shake` | **Tremur de impact.** Tremur care se stinge rapid la fiecare impact. Folosit doar pe impacturi (slam, logo, drop). | — | tested |
| `camera.focus-track` | **Camera urmărește punctele de interes.** Trece pe rând prin mai multe puncte de interes (de ex. zonele găsite la captură: căutare, buton, rezultat), cu zoom pe fiecare. | — | tested |
| `camera.whip` | **Whip pan la final de scenă.** Cadru stabil, apoi o smucitură rapidă în ultimele cadre (cu blur de mișcare) care predă scena următoarei. | — | tested |
| `camera.rack-focus` | **Rack focus (focus care trece între planuri).** Focusul trece de pe un plan de adâncime pe altul: stratul nefocalizat se estompează. Cere straturi cu adâncimi diferite. | — | tested |
| `camera.parallax-drift` | **Derivă cu parallax.** Derivă laterală lentă; straturile cu adâncimi diferite se mișcă diferit, dând senzația de spațiu. | — | tested |
| `camera.beat-punch` | **Punch-in pe ritm.** Zoom scurt care sare pe fiecare bătaie din beat grid (sau pe momente date) și revine. Pentru montaje energice. | — | tested |

## Tranziții (21)

| Id | Ce face | Sunet | Stare |
| --- | --- | --- | --- |
| `tr.cut` | **Tăietură.** Tăietură directă. Combinată cu snap pe beat grid (storyboard: beat.snap = beat/bar) devine tăietură pe ritm (beat cut). | — | tested |
| `tr.dissolve` | **Dizolvare (cross-dissolve).** Scena nouă apare peste cea veche. Interzis ca implicit generic; doar ca alegere conștientă (ritm lent, emoțional). | — | tested |
| `tr.dip` | **Trecere prin culoare.** Imaginea trece printr-o culoare a brandului (nu negru), apoi intră scena nouă. Fără cadre negre. | whoosh-soft (start) | tested |
| `tr.push` | **Push.** Scena nouă împinge scena veche afară din cadru, pe o direcție. Continuă direcția mișcării anterioare. | swipe (start) | tested |
| `tr.slide` | **Slide peste.** Scena nouă alunecă peste cea veche, care se retrage puțin și se întunecă (adâncime). | swipe (start) | tested |
| `tr.wipe` | **Wipe liniar.** O margine dreaptă dezvăluie scena nouă pe o direcție. | swipe (start) | tested |
| `tr.mask-iris` | **Wipe cu mască circulară (iris).** Un cerc care crește dintr-un punct dezvăluie scena nouă. Bun pentru match cut pe un element rotund (buton, avatar, logo). | pop (start) | tested |
| `tr.mask-diagonal` | **Wipe diagonal cu bandă de culoare.** O bandă diagonală în culoarea brandului traversează cadrul; scena nouă apare în urma ei. | whoosh (start) | tested |
| `tr.whip` | **Whip pan.** Mișcare foarte rapidă, cu blur direcțional puternic, spre scena următoare. Pentru ritm alert. | whoosh-fast (start) | tested |
| `tr.zoom-through` | **Zoom through.** Camera intră în scena veche (zoom + blur) și iese în cea nouă, care se așază dintr-o scară mai mare. | whoosh (start), impact-small (end) | tested |
| `tr.scale` | **Scale-in ca un card.** Scena nouă crește dintr-un card cu colțuri rotunjite până umple cadrul; cea veche se retrage. | pop (start) | tested |
| `tr.flash` | **Flash de expunere.** Supraexpunere scurtă (2–4 cadre) pe tăietură, cu opacitate maximă 0,55. Validatorul limitează la maximum 2 flash-uri pe secundă. | impact (start) | tested |
| `tr.blur` | **Tranziție prin blur.** Scena veche se estompează până devine abstractă, iar cea nouă se clarifică. | whoosh-soft (start) | tested |
| `tr.parallax-handoff` | **Parallax handoff.** Scena veche iese lent, cea nouă intră rapid peste ea din direcția opusă: viteze diferite, senzație de adâncime. | swipe (start) | tested |
| `tr.push-through` | **Camera trece prin scenă.** Scena veche crește spre cameră și dispare, ca și cum camera trece prin ea; cea nouă e deja în spate. | whoosh-long (start) | tested |
| `tr.color-sweep` | **Panou de culoare.** Un panou plin în culoarea brandului traversează cadrul; scenele se schimbă cât timp ecranul e acoperit. | whoosh (start) | tested |
| `tr.glitch` | **Glitch cut.** 2–6 cadre de glitch: canale RGB separate, salturi orizontale cu sămânță și benzi de interferență, apoi tăietură. | glitch (start) | tested |
| `tr.light-leak` | **Light leak.** Lumină caldă (sau în culoarea brandului) inundă cadrul și acoperă tăietura, ca pe film. | shimmer (start) | tested |
| `tr.film-strip` | **Film strip (pan legat).** Cele două scene se mișcă împreună ca o bandă de film, fără spațiu între ele și fără cadru negru; blur din viteză. | swipe (start) | tested |
| `tr.ripple` | **Tranziție lichidă (ondulare).** Imaginea se deformează ca un lichid (hartă de deplasare din zgomot) și se reface în scena nouă. | whoosh-soft (start) | tested |
| `tr.speed-ramp` | **Speed ramp.** Scena veche aproape îngheață, apoi accelerează brusc (zoom) într-o tăietură; cea nouă intră încetinind. | riser-short (start) | tested |

## Rețete (combinații de nivel înalt)

O rețetă primește scena (rol, text, materiale, energie, format) și produce straturile, camera și sunetele. Claude alege rețeta; motorul o execută.

| Id | Pentru | Materiale | Ce face |
| --- | --- | --- | --- |
| `hook-kinetic` | hook, agitation, benefit | screen? | **Hook cu tipografie cinetică.** Fraza de hook pe tot ecranul, cu stilul de text al direcției (slam, pop, blur), camera pe ritm și, opțional, captura reală estompată în fundal. |
| `kinetic-sequence` | agitation, benefit, hook, problem | — | **Secvență de fraze pe ritm.** Mai multe fraze scurte, una după alta, pe bătăi. Bun pentru agitație („încă un tabel, încă o ședință…”) sau beneficii rapide. |
| `problem-statement` | problem, agitation | before? | **Problema, spusă clar.** Problema publicului în cuvintele lui, cu cuvântul-durere tăiat sau subliniat; atmosferă mai rece, vignetă. |
| `product-reveal` | reveal, solution, outro | logo? | **Revelarea produsului (logo).** Logo-ul apare din particule sau cu un pop, raze de lumină în spate, sloganul se dezvăluie sub el. Momentul „iată soluția”. |
| `ui-spotlight` | feature, demo, solution, benefit | screen | **Funcție în prim-plan pe captura reală.** Captura reală în ramă intră în cadru, camera împinge spre zona funcției, restul se întunecă (spotlight), zona primește contur și un callout cu textul din script. |
| `ui-walkthrough` | demo, feature, solution | screen | **Demonstrație: cursor, clic, tastare, camera urmărește.** Pe captura reală: cursorul trece pe la 2–3 zone (găsite la captură), face clic, scrie textul din script în câmpul real, iar camera urmărește punctele. Sau o înregistrare reală a fluxului. |
| `feature-montage` | feature, benefit, demo | screens | **Montaj rapid de funcții.** 3–5 tăieturi rapide pe ritm, fiecare pe o zonă reală din capturi (decupaj UI), cu eticheta funcției din script. |
| `scroll-tour` | feature, demo, reveal, solution | page | **Tur prin pagină (scroll real).** O captură de pagină întreagă într-o ramă de browser, derulată lin de sus până la o zonă-țintă. |
| `device-hero` | reveal, feature, solution | screen | **Dispozitiv 3D cu aplicația.** Un telefon sau laptop generic se rotește lent în 3D cu captura reală pe ecran, lumini difuze în spate. Pentru aplicații mobile și momente-hero. |
| `stack-3d` | feature, reveal, benefit | screens | **Stivă de ecrane 3D.** Mai multe capturi reale așezate în adâncime; camera trece printre ele. Arată amploarea produsului. |
| `before-after` | transformation, proof, solution | before, after | **Înainte / după.** Două imagini reale (înainte și după) cu un separator care glisează; etichetele vin din script. |
| `steps` | demo, solution, feature | screen? | **Cum funcționează în 3 pași.** O linie de timp se desenează și dezvăluie pașii (din script), opțional cu captura reală alături. |
| `proof-metric` | proof, benefit | — | **Dovadă: cifră verificată sau citat real.** O cifră mare care numără (doar dintr-o afirmație verificată, cu claimId) sau un citat real cu atribuire. |
| `launch-burst` | reveal, hook, outro | logo? | **Anunț de lansare.** Un cuvânt mare („NOU”, o dată, un nume de funcție), explozie de confetti, logo, tremur pe impact. |
| `technical-demo` | demo, feature, solution | — | **Demo tehnic (terminal sau cod).** Comenzi într-un terminal sau un fragment de cod scris pe ecran. Conținutul trebuie să fie real (din documentație sau de la utilizator). |
| `cta-end` | cta, outro | logo?, screen? | **Card final cu apel la acțiune.** Logo + CTA (textul exact din brief) pe un buton grafic, adresa sub el; o singură dungă de lumină, apoi hold fără mișcare la momentul deciziei. Centrat conștient. |

## Șabloane de structură (templates/)

| Id | Durată | Scene | Descriere |
| --- | --- | --- | --- |
| `ai-product` | 20–40 s | hook-kinetic → problem-statement? → ui-walkthrough → ui-spotlight → cta-end | Produs AI (25–35 s). Hook scris ca un prompt, problema, demonstrație cu tastare reală, rezultat pe captură, CTA. |
| `cinematic` | 25–50 s | product-reveal → device-hero → ui-spotlight → stack-3d? → cta-end | Cinematic premium (30–45 s). Revelare cinematică, produs în 3D, funcție pe captură, stivă de ecrane, CTA. |
| `feature-showcase` | 20–40 s | hook-kinetic → scroll-tour → ui-spotlight → ui-spotlight → feature-montage? → cta-end | Parada funcțiilor (30 s). Hook, pagina reală derulată, 2–3 funcții pe zone reale, montaj rapid, CTA. |
| `mobile-app` | 15–35 s | hook-kinetic → device-hero → ui-spotlight → feature-montage? → cta-end | Aplicație mobilă (vertical, 20–30 s). Hook, telefonul 3D cu aplicația, funcții pe ecrane reale, CTA de descărcare. |
| `product-launch` | 15–35 s | launch-burst → product-reveal → ui-spotlight → kinetic-sequence? → cta-end | Anunț de lansare (20–30 s). Anunț, revelare, ce e nou pe captură, beneficiu, CTA. |
| `saas` | 25–40 s | hook-kinetic → problem-statement? → product-reveal → ui-spotlight → ui-walkthrough → proof-metric? → cta-end | SaaS standard (30 s). Hook, problemă, produsul, funcție pe captură, demonstrație, dovadă (opțională), CTA. |
| `startup` | 28–50 s | hook-kinetic → problem-statement → kinetic-sequence? → product-reveal → steps → ui-spotlight → proof-metric? → cta-end | Problemă și soluție (30–45 s). Hook, problemă, agitare, soluția, cum funcționează în 3 pași, dovadă, CTA. |
| `teaser-15` | 10–18 s | hook-kinetic → product-reveal → feature-montage → cta-end | Teaser (15 s). Hook, revelare, montaj, CTA. Pentru reclame scurte pe social. |

## Direcții creative

- **A – Emoțional** (`emotional`): Ritm respirat, lumină caldă, text care apare din blur, muzică luminoasă. Pentru povești și transformări personale. Tranziții: tr.light-leak, tr.blur, tr.dissolve, tr.parallax-handoff, tr.push-through. Text: text.blur-reveal. Muzică: uplifting, 86–100 BPM.
- **B – Agresiv** (`aggressive`): Tăieturi pe ritm, text care lovește (slam), tremur pe impacturi, contrast mare. Pentru hook-uri care opresc scroll-ul. Tranziții: tr.cut, tr.push, tr.zoom-through, tr.whip, tr.glitch. Text: text.slam. Muzică: dark, 128–145 BPM.
- **C – Premium / cinematic** (`premium`): Mișcări lente de cameră în 3D, lumini difuze, tipografie rafinată, tranziții cu adâncime. Pentru produse care vor să pară scumpe. Tranziții: tr.parallax-handoff, tr.push-through, tr.scale, tr.zoom-through. Text: text.mask-reveal. Muzică: calm, 92–110 BPM.
- **D – Tehnic** (`technical`): Interfața în prim-plan, cursor și tastare reale, zoom pe detalii, grilă fină. Pentru produse tehnice și dezvoltatori. Tranziții: tr.push, tr.wipe, tr.zoom-through. Text: text.typewriter. Muzică: driving, 104–120 BPM.
- **E – Minimal** (`minimal`): Puține elemente, mult spațiu, mișcare precisă. Fundal plin, fără texturi. Pentru mesaje simple și branduri curate. Tranziții: tr.slide, tr.cut, tr.push. Text: text.word-reveal. Muzică: calm, 96–112 BPM.
- **F – Energic / social** (`energetic`): Culoare, pop-uri pe ritm, whip-uri, accente pe cuvinte. Pentru TikTok/Reels și public tânăr. Tranziții: tr.push, tr.color-sweep, tr.whip, tr.zoom-through. Text: text.pop. Muzică: playful, 118–132 BPM.

## Sunete sintetizate (src/audio/sfx.ts)

Toate sunetele sunt generate din cod (originale, fără licențe externe), deterministe, în cache la `.cache/sfx/`.

`pop` (Pop) · `pop-hi` (Pop înalt) · `pop-lo` (Pop grav) · `slam` (Slam text) · `impact` (Impact cinematic) · `impact-small` (Impact mic) · `bass-hit` (Lovitură de bas (808)) · `sub-drop` (Sub-drop) · `tick` (Tick) · `tick-hi` (Tick înalt) · `tick-soft` (Tick discret) · `click` (Clic de interfață) · `key` (Tastă) · `toggle` (Comutator) · `drop` (Drop (plasare)) · `notification` (Notificare) · `ding` (Succes / gata) · `error` (Eroare) · `whoosh` (Whoosh) · `whoosh-fast` (Whoosh rapid) · `whoosh-long` (Whoosh lung) · `whoosh-soft` (Whoosh discret) · `swipe` (Swipe) · `riser` (Riser) · `riser-short` (Riser scurt) · `downlifter` (Downlifter) · `rev-cymbal` (Cinel invers) · `shimmer` (Shimmer / glint) · `sparkle` (Scânteie) · `glitch` (Glitch) · `marker` (Marker pe hârtie) · `counter` (Contor (rolă)) · `tape-stop` (Tape stop) · `scratch` (Record scratch) · `heartbeat` (Bătaie de inimă)
