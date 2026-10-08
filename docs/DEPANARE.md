# Depanare

Primul pas, întotdeauna: **[PowerShell]** `npm run doctor`. Îți spune ce lipsește și comanda exactă de reparare.

Erorile studioului au un cod între paranteze drepte (de ex. `[FINAL_NOT_APPROVED]`) și o linie „→” cu ce ai de făcut.

## Instalare

| Simptom | Cauză | Ce faci |
| --- | --- | --- |
| `install.ps1 cannot be loaded because running scripts is disabled` | Politica de execuție PowerShell | Rulează exact: `powershell -ExecutionPolicy Bypass -File install.ps1` |
| `node` nu e recunoscut | Node.js lipsește sau terminalul e vechi | Lasă instalatorul să-l instaleze (răspunde „da”) sau instalează Node LTS de pe nodejs.org; **închide și redeschide** PowerShell |
| `doctor`: „Dependențe npm – lipsesc” | `npm ci` nu a rulat sau a fost întrerupt | `npm ci` |
| `doctor`: „Browser de randare (Remotion) – lipsește” | descărcarea a eșuat | `npx remotion browser ensure` |
| `doctor`: „Browser de captură (Playwright) – lipsește” | descărcarea a eșuat | `npx playwright install chromium` |
| `doctor`: „Locație … e în OneDrive” | repo-ul e în OneDrive | Mută folderul în `C:\dev\` și rulează din nou `install.ps1` |
| `doctor`: „Voci TTS locale – niciuna” | Windows fără voci instalate | Setări Windows → Timp și limbă → Vorbire → Adaugă voci (pentru română: „Microsoft Andrei”), sau folosește vocea ta / o cheie API |
| `npm ci` eșuează cu `EPERM` | un fișier din `node_modules` e blocat (Studio sau un editor deschis) | Oprește Studio-ul (Ctrl+C), închide editorul, reîncearcă |

## Captură

| Simptom | Ce faci |
| --- | --- |
| `[CAPTURE_HTTP]` (pagina răspunde cu eroare) sau `Timeout` la încărcare | Verifică adresa în browser. Pentru pagini lente: `--wait 3000`. Pentru aplicații cu cont: `mms login` întâi. |
| Captura arată pagina de autentificare | `npm run mms -- login --url <adresă> --profile <nume>`, te autentifici în fereastră, o închizi; apoi capturi cu `--profile <nume>` |
| Captura are bannere de cookies | Adaugă `--hide "#cookie-banner"` (selector CSS) sau un clic: `--click "#accept"` |
| „date personale detectate” | Răspunde la întrebarea de estompare; zonele marcate se estompează doar cu acordul tău |
| Captura e goală sau neagră | Unele site-uri blochează browserele automate. Fă tu capturile și adaugă-le: `mms add-asset … --role screenshot` |

## Producție

| Cod | Înseamnă | Ce faci |
| --- | --- | --- |
| `BRIEF_NOT_APPROVED` | Lucrul nu începe fără „aprob” | Scrie exact `aprob` (Studio → Brief, sau `mms approve <id> brief "aprob"`) |
| `VERSION_FROZEN` | Versiunea are preview/aprobare/final și nu se mai modifică | Normal: modificările merg automat în versiunea următoare. Din linia de comandă: `mms new-version <id>` |
| `ASSET_MISSING` | O scenă cere un material care nu există în proiect | Adaugă materialul (captură sau fișier) sau schimbă materialele scenei în storyboard |
| blocaj de validare „cifră fără sursă” | Un număr sau preț nu are sursă verificată | Confirmă afirmația (`mms claim <id> <claimId> approved`) sau scoate cifra |
| blocaj „material fără drepturi confirmate” | Material terț fără „da” la drepturi | `mms rights <id> <assetId> confirmed` dacă ai dreptul; altfel înlocuiește-l (preview-ul rămâne „concept”) |
| blocaj „text în afara zonei sigure” / „lizibil la 360 px” | Textul e prea mic sau sub butoanele platformei | Scurtează textul (sub 8 cuvinte), alege alt format de scenă sau altă rețetă |
| `LANGUAGE_MISSING` | Limba textului (sau a vocii) nu e aleasă; nu există valoare implicită | Răspunde la întrebările din grupa E |
| `ZOOM_NO_REGION` | Comanda „zoom pe …” nu găsește zona în captură | Folosește numele zonei din `captures/<id>.json` (câmpul `regions[].label`) sau descrie-o cu cuvintele de pe ecran |
| `HOOK_MISSING` / `NO_HOOK_VARIANTS` | Varianta de hook cerută nu există în script | Adaugă variante în `hooks` din `script.json` (origin „ai” pentru sugestii) |
| `LAYER_PARAMS` | Un strat are parametri invalizi (de obicei după o editare manuală a storyboard-ului) | Mesajul spune scena, capabilitatea și câmpul; fișa capabilității e în `library/registry.json` |
| `FINAL_NOT_APPROVED` | Exportul final cere „render final” | Scrie exact `render final` pentru versiunea dorită |
| `FINAL_EXISTS` | Exportul există deja | Nu se suprascrie niciodată: fă o versiune nouă |
| `FINAL_AUDIO` | Mixul nu respectă −14 LUFS / −1 dBTP sau are clipping/tăceri | Rulează din nou `mms audio <id>`; dacă persistă, verifică fișierul tău de muzică |
| `CONFIG_MISSING` | Un pas cere o cheie API | Pune cheia în `.env` (vezi `.env.example`) sau alege TTS-ul Windows / fără voce |
| `TTS_FAILED` / `TTS_UNAVAILABLE` | Vocea aleasă nu a pornit sau nu există pe acest calculator | `npm run mms -- voices` arată vocile; instalează vocea limbii alese (vezi mai sus) |

## Randare

| Simptom | Ce faci |
| --- | --- |
| Randarea e lentă | Normal pentru efecte grele (blur, 3D, particule): ~2–4× durata reclamei pe un laptop. Pentru verificări rapide: `mms preview <id> --from 0 --to 150` (doar un interval) |
| `Timeout` / `delayRender` | De obicei un font sau un fișier lipsă. Rulează `mms compile <id>` din nou (verifică materialele) și `npm run doctor` |
| Cadre negre / flash-uri raportate în `check-<format>.json` | Raportul dă timpul exact; schimbă tranziția scenei de acolo (`mms iterate <id> "tranziții mai lente"` sau editează storyboard-ul) |
| Imaginea arată diferit în Studio față de MP4 | Nu ar trebui (aceeași compoziție). Rulează `npm run test:render`; dacă trece, trimite-i lui Claude timpul exact |

## Studio

| Simptom | Ce faci |
| --- | --- |
| Windows Firewall întreabă de acces la rețea când pornește `npm run remotion` | Remotion Studio ascultă pe toate interfețele. Alege „Anulează” / doar rețele private; funcționează și local |
| `EADDRINUSE` la pornire | Portul 4321 e ocupat: `npm run studio -- --port 4400` sau `MMS_STUDIO_PORT` în `.env` |
| Pagina e goală | Reîncarcă (Ctrl+F5); în terminal vezi eroarea de construcție a interfeței |
| Player-ul nu pornește un video | Proiectul nu are încă timeline: Studio → Producție → Compilează |

## Resetare sigură

- Cache-ul (`.cache/`) se poate șterge oricând; se reface singur (bundle, efecte sonore, voci).
- **Nu șterge** `projects/` decât dacă vrei să pierzi reclamele (nu sunt pe Git).
- Reinstalare completă: șterge `node_modules`, apoi `install.ps1`.
