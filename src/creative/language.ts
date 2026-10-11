/**
 * Detecția limbii unui text scurt (replică, titlu), offline, după cuvintele de legătură și diacritice.
 * Folosită ca să nu ajungă în reclamă un citat de pe site în altă limbă decât cea aleasă de utilizator
 * (de ex. text în engleză citit de o voce română). Pe textele foarte scurte (nume, 1–2 cuvinte) nu decide.
 */

const STOP: Record<string, string[]> = {
  ro: ["și", "si", "în", "pe", "cu", "de", "la", "că", "ca", "este", "sunt", "nu", "mai", "pentru", "fără", "din", "care", "tău", "ta", "tale", "o", "un", "una", "să", "se", "ai", "sau", "acum", "totul", "fiecare", "vrei", "poți", "doar", "foarte"],
  en: ["the", "and", "to", "of", "in", "is", "it", "you", "your", "for", "with", "on", "that", "are", "no", "not", "or", "be", "this", "all", "can", "now", "get", "our", "we", "an", "a", "at", "from", "by", "easy", "use", "need", "without"],
  fr: ["le", "la", "les", "et", "des", "du", "un", "une", "est", "pour", "avec", "pas", "vous", "votre", "sur", "dans", "qui", "que", "plus", "sans"],
  de: ["der", "die", "das", "und", "ist", "nicht", "mit", "für", "auf", "ein", "eine", "sie", "ihr", "zu", "den", "von", "im", "ohne", "jetzt", "sich"],
  es: ["el", "la", "los", "las", "y", "es", "en", "con", "para", "por", "que", "una", "un", "su", "tu", "sin", "más", "del", "al", "ahora"],
  it: ["il", "lo", "la", "gli", "e", "è", "per", "con", "che", "non", "una", "un", "del", "della", "tuo", "senza", "più", "sono", "ora", "di"],
};
const MARKS: Record<string, RegExp> = { ro: /[ăâîșşțţ]/i, de: /[äöüß]/i, fr: /[àâçéèêëîïôûùüÿœ]/i, es: /[ñ¿¡áéíóú]/i };

export const LANGUAGE_NAME: Record<string, string> = { ro: "română", en: "engleză", fr: "franceză", de: "germană", es: "spaniolă", it: "italiană" };

export interface DetectedLanguage {
  lang: string | null;
  confidence: number;
}

export function detectLanguage(text: string): DetectedLanguage {
  const words = text.toLowerCase().normalize("NFC").match(/\p{L}+/gu) ?? [];
  if (words.length < 4) return { lang: null, confidence: 0 };
  const score: Record<string, number> = {};
  for (const [lang, list] of Object.entries(STOP)) {
    const set = new Set(list);
    score[lang] = words.filter((w) => set.has(w)).length;
    if (MARKS[lang]?.test(text)) score[lang] += 1.5;
  }
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (best[1] < 1.5) return { lang: null, confidence: 0 };
  // încrederea: cât de clar câștigă limba și câte cuvinte de legătură are textul
  const margin = (best[1] - second[1]) / best[1];
  const density = Math.min(1, best[1] / Math.max(3, words.length * 0.25));
  const confidence = Math.round(Math.min(1, margin * 0.7 + density * 0.4) * 100) / 100;
  return { lang: best[0], confidence };
}

/** Limba de bază („ro-RO” → „ro”). */
export const baseLang = (l: string | null | undefined): string | null => (l ? l.toLowerCase().split(/[-_]/)[0] : null);
