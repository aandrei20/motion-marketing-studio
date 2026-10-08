# Licențe și drepturi

Registrul licențelor pentru tot ce vine cu studioul. Materialele din proiectele tale au drepturile notate în `projects/<id>/assets.json` (câmpul `rights`), conform porții de drepturi din CLAUDE.md (regula 3).

Afirmațiile despre licențele altora au sursă, dată și nivel de încredere. Termenii se pot schimba, așa că verifică sursa înainte de o lansare comercială.

## Ce produce studioul

| Element | Licență / drepturi | Note |
| --- | --- | --- |
| Muzica sintetizată (`src/audio/music.ts`) | Originală, generată din cod la fiecare proiect; fără licențe externe | Nu folosește mostre sau bucle ale altora |
| Efectele sonore sintetizate (`src/audio/sfx.ts`, 35) | Originale, generate din cod | Cache în `.cache/sfx/` |
| Grafica, fundalurile, particulele, ramele de dispozitiv | Originale, desenate din cod | Ramele sunt generice, fără mărci (fără logo Apple/Samsung etc.) |
| Produsul demo „Kolibri” (`examples/demo-product/`) | Fictiv, creat pentru acest repo | Numele, logo-ul și textele sunt inventate pentru test; orice asemănare e întâmplătoare |
| Materialele de catalog (`library/catalog/samples/`) | Capturi ale produsului demo fictiv | Generate de `scripts/make-catalog-samples.ts` |

## Fonturi incluse (`library/fonts/`)

Toate sunt sub **SIL Open Font License 1.1** (textul licenței e în `OFL.txt`, în folderul fiecărui font). Permite folosirea comercială, inclusiv în video. Sursa: github.com/google/fonts, descărcate pe 2026-10-08.

Inter · Archivo · Space Grotesk · Instrument Serif · JetBrains Mono · Manrope

## Componente software

| Componentă | Versiune | Licență | Sursă |
| --- | --- | --- | --- |
| Remotion (`remotion`, `@remotion/*`) | 4.0.534 | **Licența Remotion** (vezi mai jos) | remotion.dev/license |
| React, React DOM | 19.3.0 | MIT | github.com/facebook/react |
| zod | 4.6.5 | MIT | github.com/colinhacks/zod |
| Playwright (+ Chromium pentru captură) | 1.64.0 | Apache-2.0 (Chromium: BSD) | github.com/microsoft/playwright |
| fontkit | 2.0.4 | MIT | github.com/foliojs/fontkit |
| esbuild | 0.28.2 | MIT | github.com/evanw/esbuild |
| tsx, vitest | 4.23.15, 5.0.3 | MIT | npm |
| TypeScript | 7.0.2 | Apache-2.0 | github.com/microsoft/TypeScript |
| FFmpeg / FFprobe | inclus în `@remotion/compositor-*` | licența FFmpeg (LGPL/GPL, în funcție de build) | remotion.dev/docs/ffmpeg, ffmpeg.org/legal.html |

### Licența Remotion

- **Ce spune (rezumat):** Remotion e gratuit pentru persoane fizice, organizații non-profit și companii de până la 3 angajați. Companiile mai mari au nevoie de o licență de companie. Cheia se pune în `.env` ca `REMOTION_LICENSE_KEY`, iar studioul o transmite automat la randare.
- **Sursa:** remotion.dev/license. **Data:** 2026-10-08. **Încredere:** medie (rezumat după termenii publicați; condițiile exacte sunt cele de pe site).
- **Ce ai de făcut:** dacă folosești studioul într-o companie, verifică pragul pe remotion.dev/license și, la nevoie, cumpără licența.

## Voci (TTS)

| Furnizor | Drepturi asupra vocii generate | Încredere |
| --- | --- | --- |
| Windows (OneCore, de ex. „Microsoft Andrei”) | **De verificat înainte de folosirea comercială.** Vocile vin cu Windows și sunt destinate în principal accesibilității; termenii Windows nu acordă explicit dreptul de a publica vocea în reclame. | scăzută |
| ElevenLabs | Conform planului tău ElevenLabs (planurile plătite permit în general folosirea comercială). Sursă: elevenlabs.io/terms | medie |
| OpenAI TTS | Conform termenilor OpenAI; politica cere să spui ascultătorilor că vocea e generată de AI. Sursă: openai.com/policies | medie |
| Vocea ta (fișier) | A ta | – |

Recomandare: pentru reclame publicate comercial, folosește vocea ta sau un furnizor cu termeni comerciali clari. TTS-ul Windows e potrivit pentru preview-uri și teste.

## Materialele tale și ale altora

- Pentru orice material al altcuiva (logo, font, muzică, footage, capturi cu marca altcuiva) studioul întreabă o dată: „Ai dreptul să-l folosești?”.
- **Da:** materialul se folosește integral, iar în manifest se notează „drepturi confirmate de utilizator”.
- **Nu sau nu știi:** materialul apare doar în preview-uri marcate „concept”, iar exportul final e blocat.
- Răspunderea pentru drepturi și conținut este a ta (CLAUDE.md, regula 3).
- Video-urile de referință se analizează doar pentru ritm, mișcare, culoare și tempo. Nu se copiază nimic din ele în reclamă.

## Licența proiectului

Toate drepturile rezervate (repo privat), conform deciziei din `PLAN.md` (Faza 0). Dacă repo-ul devine public, licența se alege atunci.
