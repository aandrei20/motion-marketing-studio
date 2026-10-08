# Motion Marketing Studio

Un studio local de producție video pentru aplicații, site-uri și software. Îi dai produsul (adresa, capturile, logo-ul, ideea ta), iar el face reclama: capturează interfața reală, adună faptele cu sursă, scrie scriptul și storyboard-ul, animă, adaugă voce, muzică și efecte sonore, verifică totul și îți arată un preview. Exportul final se face doar când scrii „render final”.

**Claude decide ce se face; motorul decide cum se face.** Claude (în Claude Code) e directorul creativ: alege direcția, structura, textele și efectele. Motorul (TypeScript + Remotion) execută deciziile determinist: aceeași reclamă randată de două ori iese identic.

> Starea exactă a fiecărei părți (ce e testat, ce e parțial, ce lipsește): [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).

---

## 1. Ce este

- Un **motor reutilizabil**, fără nimic specific vreunui produs. Reclamele sunt proiecte separate, în `projects/`.
- O **interfață web locală** (Studio) în care vezi și controlezi tot: proiecte, brief, materiale, research, brand, script, storyboard, preview cu timeline, audio, critică, versiuni, export.
- O **linie de comandă** (`mms`) și **comenzi pentru Claude Code** (`/make-ad`, `/fix-at`, `/add-effect`, `/new-version`).

## 2. Ce poate face

- **Captură reală** a produsului cu un browser automat (Playwright): capturi 2×, pagina întreagă, înregistrări de flux (tastare, clicuri) și zonele din pagină (butoane, câmpuri, carduri), ca efectele să poată ținti „câmpul de căutare”. Interfața produsului nu se redesenează niciodată.
- **Research cu surse**: faptele de pe site, cu citat, dată și nivel de încredere. Prețurile și cifrele intră în lista „de confirmat” și nu apar în video fără acordul tău.
- **Brand kit** dedus din CSS-ul site-ului și din logo (culori exacte, fonturi), editabil.
- **Script și storyboard structurate**: hook-ul și frazele tale se păstrează cuvânt cu cuvânt; fiecare scenă are scop, rol, energie, rețetă, materiale și cameră.
- **124 de efecte reale** (cameră, tranziții, tipografie cinetică, cursor/clic/tastare/spotlight/callout peste capturi, rame de dispozitiv, 3D CSS, lumină, particule, distorsiuni, logo, grafice) și **16 rețete** care le combină. Lista completă: [`docs/BIBLIOTECA.md`](docs/BIBLIOTECA.md).
- **Formate multiple din același storyboard**: 9:16, 16:9, 1:1, 4:5, 4K și personalizat; 24, 25, 30, 50, 60 fps. Zonele de siguranță ale platformelor (TikTok, Reels, Shorts…) sunt respectate automat.
- **Audio complet**: voce (Windows offline, inclusiv română; ElevenLabs/OpenAI cu cheie; vocea ta din fișier), muzică originală sintetizată pe structura reclamei sau muzica ta (cu tempo detectat), 35 de efecte sonore sintetizate, ducking sub voce, −14 LUFS, true peak ≤ −1 dBTP, subtitrări arse și `.srt`.
- **Verificări automate**: validarea timeline-ului (footage real, drepturi, cifre cu sursă, zone sigure, lizibilitate la 360 px, flash-uri, cadre goale), verificarea mixului și a video-ului randat (cadre negre, flash-uri, înghețări), critică cu rubrică fixă (hook, claritate, ritm, ierarhie, varietate, brand, CTA).
- **Iterație în limbaj natural**: „la 00:14 zoom pe câmpul de căutare”, „CTA-ul să stea 3 secunde”, „tranziții mai rapide”, „mai puțină muzică sub voce”, „folosește fraza mea exactă”, „fă hook-ul mai agresiv”, „fă-l mai premium”. Fiecare comandă creează o versiune nouă; cele vechi nu se ating.

## 3. Cerințe

- Windows 10/11 (testat pe Windows 11). macOS/Linux: prin `install.sh` (netestat încă pe aceste sisteme).
- Node.js 20.11 sau mai nou (instalatorul îl poate instala prin winget, cu acordul tău).
- Git (pentru actualizări).
- ~3 GB pentru dependențe și browsere, plus spațiu pentru proiecte și randări (recomandat 10 GB liberi).
- Internet doar la instalare (și pentru capturarea site-urilor online sau pentru vocile cu cheie API).

FFmpeg și Python **nu** trebuie instalate separat: FFmpeg vine cu Remotion, iar tot audio-ul e scris în TypeScript.

## 4. Instalare

În PowerShell:

```powershell
cd C:\dev
git clone <adresa-repo> motion-marketing-studio
cd motion-marketing-studio
powershell -ExecutionPolicy Bypass -File install.ps1
```

Instalatorul verifică Node și Git (și le instalează doar dacă accepți), rulează `npm ci`, descarcă browserul de randare și pe cel de captură, creează `.env` din `.env.example`, pregătește folderele, sintetizează efectele sonore și rulează `npm run doctor`. Ține repo-ul în `C:\dev\`, nu în OneDrive.

macOS / Linux: `bash install.sh`.

## 5. Configurare

Totul merge fără chei. Cheile opționale stau doar în `.env` (nu urcă niciodată pe Git):

| Variabilă | Pentru |
| --- | --- |
| `ELEVENLABS_API_KEY` | voce ElevenLabs (cu marcaje de cuvinte pentru subtitrări) |
| `OPENAI_API_KEY` | voce OpenAI TTS |
| `REMOTION_LICENSE_KEY` | licența Remotion pentru companii (vezi [Licențe](docs/LICENTE.md)) |
| `MMS_PROJECTS_DIR` | alt folder pentru proiecte |
| `MMS_STUDIO_PORT` | alt port pentru Studio (implicit 4321) |

Dacă un pas cere o cheie care lipsește, primești o eroare clară cu numele variabilei.

## 6. Pornire

```powershell
npm run studio
```

Se deschide `http://127.0.0.1:4321`. Verificarea instalării oricând: `npm run doctor`.

## 7. Crearea unui proiect

Varianta recomandată, în Claude Code (în folderul repo-ului):

```
/make-ad https://produsul-tau.ro "vreau o reclamă energică de 30 s cu hook-ul: «…»"
```

Claude pune toate întrebările de început (grupele A–H: produs și obiectiv, platformă și format, poveste, materiale, limbă, audio, livrare), îți arată rezumatul și începe doar după ce scrii **aprob**.

În Studio: **+ Proiect nou** (nume, produs, tip, limbi, formate) → tabul **Brief** (completezi formularul, salvezi, scrii „aprob”).

Din linia de comandă:

```powershell
npm run mms -- new reclama-mea --name "Reclama mea" --product "Produsul" --category saas --url https://… --format 9x16:tiktok:30:30 --format 16x9:youtube:30:30 --text-lang ro --voice-lang ro
npm run mms -- brief reclama-mea --file brief.json
npm run mms -- approve reclama-mea brief "aprob"
```

Un brief complet de exemplu: [`examples/demo-product/brief.json`](examples/demo-product/brief.json).

## 8. Materialele

- **Captură reală** (Studio → Materiale, sau `npm run mms -- capture <proiect> --url <adresă> [--full] [--viewport mobile] [--record --type "#cautare=text"]`).
- **Pagini cu cont**: `npm run mms -- login --url <adresă> --profile <nume>` deschide un browser; te autentifici tu, sesiunea rămâne doar pe calculatorul tău. Apoi capturi cu `--profile <nume>`.
- **Fișierele tale** (logo, capturi, video, muzică, voce, fonturi, PDF, referințe): Studio → Materiale → Încarcă, sau `npm run mms -- add-asset <proiect> <fișier> [--role logo]`. Duplicatele se recunosc după conținut.
- **Drepturi**: pentru materialele altcuiva ești întrebat o dată „Ai dreptul să-l folosești?”. Fără confirmare, preview-ul e marcat „concept” și exportul final e blocat.
- **Date personale** găsite în capturi (de ex. emailuri) sunt marcate; se estompează doar cu acordul tău.
- **Video de referință**: `npm run mms -- reference <proiect> <assetId>` extrage ritmul (tăieturi, durata cadrelor), mișcarea, culoarea și tempo-ul muzicii, ca direcție creativă (nu se copiază nimic).

## 9. Preview

- Studio → **Preview & timeline**: Player-ul redă reclama cu aceleași componente ca la randare; timeline-ul de dedesubt arată scenele, tranzițiile, straturile, vocea, efectele sonore, subtitrările și bătăile muzicii; clic pe timeline = salt în video.
- Randare de preview (MP4 + foaie de contact + verificări): Studio → Export, sau `npm run preview -- <proiect> --format 9x16`.
- Remotion Studio pe timeline-ul unui proiect: `npm run remotion -- <proiect>`.
- **Ascultă tu sunetul** (pe telefon, la volum normal): AI-ul nu aude. Notele tale pe timestamp („11: muzica sună ciudat”) se salvează din Studio → Audio.

## 10. Iterația

- Bara de comenzi din Studio sau `npm run mms -- iterate <proiect> "la 00:14 zoom pe câmpul de căutare"`.
- În Claude Code: `/fix-at <proiect> "7,3: logo-ul e prea mic; 14: push-in agresiv"` – corectează doar zonele notate, într-o versiune nouă.
- Editare directă: Studio → Script / Storyboard (dacă versiunea e înghețată, se creează automat următoarea).
- Critica: `npm run mms -- critique <proiect>` (rubrica fixă, prag 8/10; bilanț la fiecare 3 runde; oprire după 2 runde fără progres).

## 11. Exportul

Scrie exact **render final** (Studio → Export, sau `npm run mms -- approve <proiect> render-final "render final" --version v3`), apoi:

```powershell
npm run render -- <proiect> --version v3 --format 9x16
```

Exportul se oprește dacă există blocaje de validare, materiale fără drepturi confirmate sau probleme de mix. Fișierul ajunge în `projects/<proiect>/exports/` (cu `.srt` și raportul de verificare) și nu se suprascrie niciodată.

## 12. Teste

```powershell
npm run check          # typecheck + reguli + teste unitare și de integrare (~1 min)
npm run test:render    # randează toate efectele din catalog, determinism, MP4 real (~3 min)
npm run e2e -- --fresh # producție completă pe produsul demo fictiv, cu preview MP4 (~3–5 min)
npm run doctor         # instalarea
```

## 13. Arhitectura (pe scurt)

```
brief → captură + materiale + research + brand → script → storyboard
      → [compilator] → timeline-<format>.json → [mixer] → mix.wav → [Remotion] → MP4
```

- `src/core` – schemele de date (zod), căi, formate și zone sigure, binare
- `src/capture`, `src/assets`, `src/research`, `src/brand`, `src/references` – materiale și fapte
- `src/creative`, `src/editing`, `src/recipes` – direcții, șabloane, script, storyboard, gramatică de montaj, rețete
- `src/motion` – capabilitățile (registry) · `src/timeline` – compilator și validator
- `src/audio` – voce, muzică, efecte, beat grid, loudness, mix · `src/renderer` – compoziția Remotion și randarea
- `src/critique`, `src/iterate`, `src/pipeline` – critică, comenzi, pașii · `src/studio`, `src/cli` – interfețele

Detalii: [`docs/ARHITECTURA.md`](docs/ARHITECTURA.md).

## 14. Biblioteca de efecte

Fiecare capabilitate are o fișă în cod: id, categorie, ce face, parametri (zod), media compatibile, sunet asociat, stare, performanță, licență și un exemplu. Registry-ul complet, ca JSON pentru Claude: [`library/registry.json`](library/registry.json); ca listă: [`docs/BIBLIOTECA.md`](docs/BIBLIOTECA.md). Catalogul vizual: `npm run remotion` (compoziția „Catalog”).

## 15. Capabilități noi

În Claude Code: `/add-effect "ce efect lipsește"`. Pe scurt: o capabilitate generică nouă în `src/motion/<categorie>/` cu `defineLayer`/`defineModifier`/`defineCamera`/`defineTransition`, parametri zod, sunet declarat și exemplu; `npm run registry`; `npm test` și `npm run test:render`; abia apoi starea devine „tested”. Pași detaliați: [`docs/ARHITECTURA.md`](docs/ARHITECTURA.md#cum-adaugi-o-capabilitate).

## 16. Șabloane și rețete noi

- **Șablon** (structura unei reclame): un JSON în `templates/` cu scenele (rol, rețetă, energie, emoție, tip de cadru, ce replică primește, pondere, opțional). Se validează automat.
- **Rețetă** (cum arată o scenă): o funcție în `src/recipes/recipes.ts` cu `defineRecipe` (sloturi de materiale, durată minimă, capabilitățile folosite, `build`). Folosește uneltele din `src/recipes/kit.ts` (zone pe format, ecrane, zone din captură). Detalii în `docs/ARHITECTURA.md`.

## 17. Depanare

Primul pas: `npm run doctor`. Problemele frecvente și soluțiile: [`docs/DEPANARE.md`](docs/DEPANARE.md). Termeni: [`docs/GLOSAR.md`](docs/GLOSAR.md).

---

Documentație: [Fluxul de lucru](docs/FLUX.md) · [Arhitectura](docs/ARHITECTURA.md) · [Biblioteca](docs/BIBLIOTECA.md) · [Decizii](docs/DECIZII.md) · [Licențe](docs/LICENTE.md) · [Stare](docs/IMPLEMENTATION_STATUS.md) · [Audit inițial](docs/AUDIT.md) · [Plan](PLAN.md) · [Reguli](CLAUDE.md)

Licență: toate drepturile rezervate (repo privat). Componentele terțe au licențele lor: [`docs/LICENTE.md`](docs/LICENTE.md).
