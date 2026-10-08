/**
 * Detecția datelor personale în text (din DOM la captură sau din OCR pe imagini): email, telefon,
 * IBAN (cu suma de control mod 97), card (Luhn), CNP (cu cifra de control), ID-uri de cont, nume din saluturi
 * („Bună dimineața, Ana”). Validatorii reduc alarmele false (datele, prețurile și cifrele de interfață nu
 * sunt date personale). Ce nu se poate detecta sigur (nume în liste, adrese) rămâne pe revizuirea omului.
 */

export type PiiKind = "email" | "phone" | "iban" | "card" | "cnp" | "account-id" | "name";

export interface PiiHit {
  kind: PiiKind;
  match: string;
}

export const PII_LABEL: Record<PiiKind, string> = {
  email: "adresă de email",
  phone: "număr de telefon",
  iban: "IBAN",
  card: "număr de card",
  cnp: "CNP",
  "account-id": "ID de cont",
  name: "nume de persoană",
};

const digits = (s: string) => s.replace(/\D/g, "");

export function luhn(num: string): boolean {
  const d = digits(num);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let x = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      x *= 2;
      if (x > 9) x -= 9;
    }
    sum += x;
  }
  return sum % 10 === 0;
}

export function ibanValid(raw: string): boolean {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const c of v) rem = (rem * 10 + Number(c)) % 97;
  }
  return rem === 1;
}

export function cnpValid(raw: string): boolean {
  const d = digits(raw);
  if (d.length !== 13 || !/^[1-9]/.test(d)) return false;
  const key = "279146358279";
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * Number(key[i]);
  let c = sum % 11;
  if (c === 10) c = 1;
  return c === Number(d[12]);
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g;
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g;
const CARD = /\b(?:\d[ -]?){13,19}\b/g;
const ACCOUNT = /\b(?:id|cont|account|client|user|utilizator|abonat)\s*(?:nr\.?|no\.?)?\s*[:#]\s*[A-Z0-9][A-Z0-9-]{5,}\b/gi;
// salutul poate începe cu majusculă; numele trebuie să înceapă cu majusculă (de aceea fără flag „i”)
const GREETING = /(?<![A-Za-zăâîșțĂÂÎȘȚ])(?:[Bb]un[ăa] (?:diminea[țt]a|ziua|seara)|[Ss]alut|[Bb]ine ai venit(?: înapoi)?|[Hh]ello|[Hh]i|[Hh]ey|[Ww]elcome(?: back)?|[Gg]ood (?:morning|afternoon|evening))[,!]?\s+([A-ZĂÂÎȘȚ][a-zăâîșțé]+(?:\s[A-ZĂÂÎȘȚ][a-zăâîșțé]+)?)/g;

/** Toate datele personale găsite într-un text, validate. */
export function findPii(text: string): PiiHit[] {
  const out: PiiHit[] = [];
  for (const m of text.matchAll(EMAIL)) out.push({ kind: "email", match: m[0] });
  for (const m of text.matchAll(IBAN)) if (ibanValid(m[0])) out.push({ kind: "iban", match: m[0] });
  for (const m of text.matchAll(CARD)) if (luhn(m[0]) && !out.some((h) => h.match.includes(m[0].trim()))) out.push({ kind: "card", match: m[0].trim() });
  for (const m of text.matchAll(/\b\d{13}\b/g)) if (cnpValid(m[0])) out.push({ kind: "cnp", match: m[0] });
  for (const m of text.matchAll(PHONE)) {
    const d = digits(m[0]);
    const s = m[0].trim();
    // telefon: 9–13 cifre, fără să fie dată, oră, preț, card sau CNP deja găsit
    if (d.length < 9 || d.length > 13) continue;
    if (/\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{1,2}:\d{2}/.test(s) || /[€$£]|lei|ron|eur/i.test(text.slice(Math.max(0, (m.index ?? 0) - 4), (m.index ?? 0) + s.length + 4))) continue;
    if (out.some((h) => digits(h.match).includes(d))) continue;
    if (!/^\+|^0|\s|-/.test(s)) continue;
    out.push({ kind: "phone", match: s });
  }
  for (const m of text.matchAll(ACCOUNT)) out.push({ kind: "account-id", match: m[0] });
  for (const m of text.matchAll(GREETING)) out.push({ kind: "name", match: m[1] });
  return out;
}

/** Textul care merită verificat (filtru ieftin înainte de validatori, folosit și în pagină la captură). */
export const PII_CANDIDATE_SOURCE = String.raw`@|\d{6,}|\d{2,4}[\s.-]\d{2,4}[\s.-]\d{2,4}|[A-Z]{2}\d{2}\s?[A-Z0-9]{4}|\b(id|cont|account|client|user)\s*[:#]|bun[ăa] (diminea|ziua|seara)|salut|bine ai venit|hello|\bhi\b|\bhey\b|welcome|good (morning|afternoon|evening)`;
