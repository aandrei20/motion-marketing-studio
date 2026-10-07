# Mesaj de pornire pentru Claude Code

Lipește mesajul de mai jos în Claude Code, în folderul `C:\dev\motion-marketing-studio`, după ce ai pus în el fișierele `CLAUDE.md`, `PLAN.md`, `README_ce_este.md` și `README_flux.md`.

---

Construiește proiectul Motion Marketing Studio, începând cu pașii 1–3 din „Ordinea de construcție” din CLAUDE.md. Citește mai întâi CLAUDE.md și PLAN.md, complet. Planul a fost discutat și aprobat punct cu punct. Nu schimba deciziile și nu adăuga tehnologii care nu apar în plan.

**Înainte de orice cod:** verifică ce există pe acest calculator (Node, Git, FFmpeg, Python, spațiu liber pe disc, cum e instalat Claude Code). Spune-mi ce ai găsit într-un rezumat de 5 rânduri și continuă.

**Pasul 1 – Repo, instalare, doctor**
- Creează structura minimă a repo-ului (`src/`, `library/`, `projects/`, `tests/`, `docs/`, `.claude/`) și inițializează Git.
- `.gitignore` conform planului (Faza 0): `node_modules/`, `out/`, `*.mp4`, `.env`, `projects/`, capturi.
- `package.json` cu scripturile `studio`, `render`, `doctor`, `test`, `update`.
- `install.ps1` care instalează tot dintr-o dată: Node, Git, FFmpeg, Playwright cu browserul lui, Remotion, Three.js, Python cu bibliotecile de audio, fonturi și voci TTS gratuite. Nimic nu se instalează în timpul unui proiect.
- `npm run doctor`: verifică tot, inclusiv spațiul liber pe disc, și spune exact ce lipsește. `/make-ad` nu pornește dacă `doctor` nu trece.
- `.env.example` pentru cheile opționale.
- `README_instalare.md`: instalare pas cu pas pentru începători. Fiecare comandă are eticheta „PowerShell” sau „Claude Code”. Scrie-l abia după ce ai rulat instalarea pe acest calculator și ai verificat fiecare pas.

**Pasul 2 – Reguli**
- Așază CLAUDE.md în rădăcină și rulează în `.claude/rules/` regulile care se pot verifica automat.
- Creează registrul de licențe (muzică, efecte sonore, fonturi, modele 3D) și regula că exportul se oprește dacă lipsește o licență.

**Pasul 3 – Captură de footage real**
- Modul Playwright: intră pe un URL, face screenshot-uri la 2x și înregistrări de 5–10 s la 60 fps. Autentificarea o fac eu în fereastra deschisă, iar sesiunea rămâne doar local.
- Manifest de materiale cu sursa fiecărui fișier (`real_capture | user_provided | generated | stock`), drepturile confirmate și punctul de focus.
- Test care oprește exportul dacă un cadru marcat „interfață” nu vine dintr-o captură reală sau dintr-un fișier dat de mine.
- Marchează datele personale vizibile în capturi; estomparea doar cu acordul meu.

**Reguli pentru acest lucru**
- Lucrează în pași mici și face un commit după fiecare pas, cu mesaj clar.
- După fiecare pas rulează testele și `doctor`. Nu trece la pasul următor dacă ceva pică.
- Nu te opri să mă întrebi lucruri care sunt deja decise în plan. Dacă lipsește o informație care nu e în plan, ia cea mai simplă decizie, notează-o în `docs/DECIZII.md` și mergi mai departe.
- Dacă vezi o contradicție în plan, oprește-te și spune-mi exact care.
- Actualizează `STATE.md` din rădăcină după fiecare pas.
- Folosește calculatorul meu cu grijă: nu șterge nimic din afara folderului proiectului, iar proiectul Spotify existent îl copiezi, nu îl muți. Copiază din el doar ce se reutilizează (timing, componente, cue sheet), fără nimic specific produsului.

**La final:** oprește-te după pasul 3 și dă-mi un raport scurt: ce e gata, ce ai testat, ce nu a mers, ce urmează. Nu începe pasul 4 până nu confirm.
