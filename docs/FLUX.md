# Fluxul de lucru (referință)

Ghidul pas cu pas pentru începători e `README_flux.md`. Aici e referința completă: fiecare pas, ce produce, comanda din linia de comandă și locul din Studio. `<id>` e id-ul proiectului.

Toate comenzile se scriu în **PowerShell**, în folderul repo-ului, ca `npm run mms -- <comandă>`. Lista completă: `npm run mms -- help`.

## Pașii

| # | Pas | Comandă | În Studio | Produce |
| --- | --- | --- | --- | --- |
| 1 | Proiect nou | `new <id> --name … --product … --category … --format 9x16:tiktok:30:30 --text-lang ro --voice-lang ro` | + Proiect nou | `project.json`, `STATE.md` |
| 2 | Întrebări A–H | `questions` | Brief | lista întrebărilor cu variante |
| 3 | Brief | `brief <id> --file brief.json` | Brief → Salvează | `brief.json` |
| 4 | Aprobare | `approve <id> brief "aprob"` | Brief → Aprobare | aprobarea în `approvals.json` |
| 5 | Captură reală | `capture <id> --url … [--full] [--viewport mobile] [--record --type "#q=text"] [--click …] [--hide …] [--wait ms] [--steps pasi.json]` | Materiale → Captură | `captures/<cap>.png/.mp4/.json` (zone din DOM, date de pagină), materiale în `assets.json`, afirmații în `research.json` |
| 6 | Fișierele tale | `add-asset <id> <fișier> [--role logo] [--tag nume] [--third-party]` | Materiale → Încarcă | material analizat (dimensiuni, culori, punct focal) |
| 7 | Drepturi | `rights <id> <assetId> confirmed\|denied` | Materiale | `rights` în manifest |
| 8 | Research | `research <id>` · `claim <id> <claimId> approved\|rejected` · `add-claim <id> "text" --category … --source …` | Research | afirmații cu sursă; lista „de confirmat” |
| 9 | Brand | `brand <id>` | Brand | `brand.json` (culori, fonturi, logo) |
| 10 | Script | `script <id> [--force]` | Script | `versions/vN/script.json` |
| 11 | Storyboard | `storyboard <id> [--template saas] [--force]` | Storyboard | `versions/vN/storyboard.json` |
| 12 | Voce | `voice <id>` | Audio | `versions/vN/audio/voice.json` + WAV-uri |
| 13 | Compilare | `compile <id>` | Prezentare → Pașii de producție → Compilează timeline | `timeline-<format>.json` pe fiecare format, `compile-report.json` |
| 14 | Audio | `audio <id>` | Audio | `mix.wav`, `mix-report.json`, `cue-sheet.json`, `captions.srt` |
| 15 | Preview | `preview <id> [--format 9x16] [--from 0 --to 150]` | Export → Preview | `renders/preview-<format>.mp4`, `contact-<format>.png`, `stills-<format>/`, `check-<format>.json` |
| 16 | Critică | `critique <id> [--format 9x16]` | Critică | o rundă în `critique.json` |
| 17 | Revizuire vizuală / notele tale | `review <id> --file review.json` | Audio → „Notele tale după ascultare” | o rundă `claude-visual` sau `user-notes` |
| 18 | Iterație | `iterate <id> "…"` | bara de comenzi de sus (și butoanele din Audio) | versiune nouă, cu jurnal |
| 19 | Variante de hook | `hook-variants <id> [--count 2]` | – | câte o versiune pe variantă |
| 20 | Export final | `approve <id> render-final "render final" --version vN` apoi `npm run render -- <id> --version vN --format 9x16` | Export | `exports/<id>-vN-<format>-final.mp4` (+ `.srt`, raport, pachet de postare) |

Totul într-un pas, după brief, captură și brand: `make <id>` (script → storyboard → voce → compilare → audio → preview → critică).

## Comenzi de iterație recunoscute

Română sau engleză; fiecare creează o versiune nouă. Ce nu se recunoaște se cere lui Claude (`/fix-at`).

| Exemplu | Efect |
| --- | --- |
| „la 00:14 zoom pe câmpul de căutare” / „At 00:14 zoom into the search field” | camera intră pe zona din captură care se potrivește textului |
| „CTA-ul să stea 3 secunde” / „Make the CTA hold for 2 seconds” | scena CTA ține cel puțin atât |
| „tranziții mai rapide” / „mai lente” | duratele tranzițiilor ×0,6 / ×1,4 |
| „mai puțină muzică sub voce” | ducking mai adânc (−5 dB) |
| „muzica mai tare / mai încet”, „fără muzică” | nivelul muzicii |
| „efectele sonore mai încet / mai tare” | nivelul efectelor |
| „folosește fraza mea exactă” / „Use the original phrase I gave you” | hook-ul devine exact fraza ta din brief |
| „folosește hook-ul hook-2” | hook-ul devine varianta din `script.hooks` |
| „fă hook-ul mai agresiv / mai calm” | tipografie, cameră și energie pentru hook |
| „fă-l mai premium” (și celelalte direcții) | direcția versiunii; tranzițiile se aleg din nou |
| „scena 2 mai lungă cu 1 secundă” | durata unei scene |
| „textul la 7 „Noul text”” | textul scenei de la acel moment |
| „Replace the screenshot at 5 with <assetId>” | alt material în scena de la acel moment |

## Fișierul de revizuire (`review.json`)

Pentru revizuirea vizuală a lui Claude (după ce citește foaia de contact și cadrele) sau pentru notele tale:

```json
{
  "reviewer": "claude-visual",
  "sceneScores": [
    { "sceneId": "hook", "scores": { "hook": 8, "clarity": 9, "rhythm": 8, "hierarchy": 8, "variety": 8, "brand": 9, "cta": 8 }, "notes": ["Textul apare pe impact."] }
  ],
  "findings": [
    { "frame": 420, "timecode": "00:14.00", "sceneId": "focus", "dimension": "hierarchy", "severity": "major",
      "problem": "Callout-ul se suprapune cu subtitrarea.", "recommendation": "Mută callout-ul deasupra zonei." }
  ]
}
```

- `reviewer`: `claude-visual` sau `user-notes`.
- `dimension`: una din rubrică (`hook`, `clarity`, `rhythm`, `hierarchy`, `variety`, `brand`, `cta`) sau o verificare tehnică.
- `severity`: `blocker`, `major`, `minor` sau `nit`.

Pentru notele tale de sunet, Studio → Audio („Notele tale după ascultare”, câte o notă pe rând: `secunda: problema`) scrie același format, cu `user-notes`.

## Bucla de calitate

1. Preview → critică automată (aceeași rubrică și același reviewer în toate rundele).
2. Revizuirea vizuală a lui Claude.
3. Corecții locale, într-o versiune nouă.
4. Pragul: fiecare scenă cel puțin 8/10.
5. La fiecare 3 runde vezi progresul și decizi dacă se continuă.
6. Bucla se oprește singură după 2 runde fără îmbunătățire.

Critica automată verifică structura, nu imaginea: un scor mare nu înlocuiește privitul preview-ului. Sunetul îl judeci tu.

## Structura unui proiect

```
projects/<id>/
  project.json  brief.json  research.json  brand.json  assets.json  approvals.json  state.json  STATE.md
  captures/     <cap>.png  <cap>.mp4  <cap>.json        (capturi reale + zone + date de pagină)
  assets/       fișierele tale, cu nume stabile
  sources/      textul paginilor citate în research
  references/   profilurile videourilor de referință
  cache/        voci TTS, analize
  versions/vN/  version.json (stare, părinte, jurnal)  script.json  storyboard.json
                timeline-<format>.json  compile-report.json  critique.json  brief.snapshot.json
                audio/  voice.json  mix.wav  mix-report.json  cue-sheet.json  captions.srt
                renders/  preview-<format>.mp4  contact-<format>.png  stills-<format>/  check-<format>.json
  exports/      <id>-vN-<format>-final.mp4  .srt  .check.json  [-cover.png  -post.md]
```
