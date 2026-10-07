# Cum folosești Motion Marketing Studio, pas cu pas

Acest ghid presupune că ai terminat instalarea din `README_instalare.md` și că `npm run doctor` a ieșit fără erori.

**Unde scrii fiecare comandă.** Fiecare rând de mai jos are o etichetă:
- **[PowerShell]** înseamnă că scrii în fereastra neagră PowerShell.
- **[Claude Code]** înseamnă că scrii în fereastra în care rulează Claude, după ce ai pornit-o cu `claude`.

Dacă greșești locul, nu se strică nimic, dar comanda nu merge.

Notă: comenzile `/make-ad`, `/fix-at`, `/add-effect` și `/new-version` se creează în pasul 9 al construcției. Acest ghid se verifică și se completează după ce există.

---

## 1. Deschide proiectul

1. **[PowerShell]** Scrie: `cd C:\dev\motion-marketing-studio` și apasă Enter.
2. **[PowerShell]** Verifică instalarea: `npm run doctor`. Dacă apare ceva roșu, rulează din nou instalarea (vezi `README_instalare.md`) și repetă.
3. **[PowerShell]** Pornește Claude: `claude`.

## 2. Începe o reclamă nouă

4. **[Claude Code]** Scrie: `/make-ad` urmat de adresa produsului și ideea ta. Exemplu: `/make-ad https://exemplu.ro „vreau o reclamă energică de 30 s, cu un hook neașteptat”`.
5. Claude îți pune toate întrebările, cu variante de ales (produs, obiectiv, public, platformă, format, durată, poveste, hook, ton, stil, materiale, limbă, sunet, livrare). Răspunde la toate. Dacă nu știi un răspuns, alege „decide Claude”.
6. Dacă ai idei de hook sau o poveste, scrie-le exact cum le vrei. Claude le păstrează și le dezvoltă doar după ce le aprobi.
7. Dacă ai fișiere (logo, capturi, muzică, voce, videouri de referință), spune-i unde sunt. Pentru fiecare material al altcuiva te întreabă o dată dacă ai dreptul să-l folosești.

## 3. Aprobă planul

8. Claude îți arată un rezumat al planului. Citește-l.
9. **[Claude Code]** Dacă e bine, scrie `aprob`. Dacă vrei schimbări, spune-i ce, iar el îți arată din nou rezumatul.

Nimic nu începe înainte de „aprob”.

## 4. Lasă-l să lucreze

10. Claude face capturile, cercetarea, scriptul, storyboard-ul și o primă versiune rapidă (animatic). Dacă pentru captură trebuie să te loghezi, se deschide o fereastră de browser: te loghezi tu acolo, iar parola nu o vede Claude.
11. Dacă apar cifre sau prețuri fără sursă clară, Claude le pune într-o listă „de confirmat”. Nu intră în video fără acordul tău.
12. La fiecare 3 runde de verificare îți arată progresul. Tu decizi dacă mai continuă.
13. Starea fiecărui pas se salvează în `projects/<nume>/STATE.md`. Dacă te oprești sau se termină tokenii, poți relua oricând.

## 5. Vezi previewul

14. Deschide o a doua fereastră **[PowerShell]**, intră în folder (`cd C:\dev\motion-marketing-studio`) și scrie: `npm run studio`.
15. Deschide în browser adresa afișată (de obicei `http://localhost:3000`) și alege proiectul tău.
16. **Ascultă cu sunetul pornit.** Claude nu poate auzi, deci ce auzi tu este singura verificare reală pentru muzică, voce și sincronizare.
17. Dacă poți, exportă un MP4 de probă și vezi-l pe telefon, la volum normal.

## 6. Dă note

18. **[Claude Code]** Scrie notele pe secundă, de exemplu:
    - `la 7,3 logo-ul e prea mic`
    - `la 11 muzica sună ciudat`
    - `la 14 vreau un push-in agresiv`
19. Claude repară doar zonele notate, nu refacerea întregului film, apoi verifică din nou.
20. Repetă pașii 14–19 până ești mulțumit.

## 7. Exportă

21. **[Claude Code]** Scrie exact: `render final`.
22. Așteaptă. Randarea durează de la câteva minute la mai mult, în funcție de lungime și de efecte.
23. Videoul final este în `projects/<nume>/out/`. Vechile versiuni rămân intacte.
24. Dacă ai ales pachetul de postare sau subtitrările, sunt în același folder.

## 8. Reia sau continuă

- **Ai închis și vrei să continui:** **[PowerShell]** `cd C:\dev\motion-marketing-studio`, apoi `claude --continue`. Claude citește `STATE.md` și continuă de unde ai rămas.
- **Vrei o versiune nouă fără să strici cea veche:** **[Claude Code]** `/new-version`.
- **Vrei să adaugi un efect nou în bibliotecă:** **[Claude Code]** `/add-effect`.
- **Vrei să repari ceva pe baza notelor tale:** **[Claude Code]** `/fix-at`.

## Dacă ceva nu merge

1. **[PowerShell]** Rulează `npm run doctor`.
2. Caută mesajul în `DEPANARE.md`.
3. Dacă nu găsești, copiază mesajul de eroare întreg și scrie-l în Claude Code.
