/**
 * Sistemul de probleme: orice verificare (validator, critică automată, analiza pixelilor, revizuirea
 * lui Claude, notele utilizatorului) produce probleme cu aceeași structură (schema Finding):
 * timp, scenă, strat, gravitate, categorie, de ce contează, recomandare, încredere, corectură sugerată.
 */
import { formatTimecode } from "../core/time";
import { CATEGORY_OF, SEVERITY_ORDER, type Dimension, type EditOp, type Finding, type QualityCategory, type Severity } from "../core/schema";

export interface IssueDraft {
  frame: number | null;
  sceneId: string | null;
  dimension: Dimension;
  severity: Severity;
  problem: string;
  recommendation: string;
  category?: QualityCategory;
  whyItMatters?: string;
  confidence?: number;
  suggestedFix?: EditOp[];
  /** implicit: true dacă există o corectură sugerată */
  autoFixable?: boolean;
  method?: string;
  layerId?: string | null;
  formatId?: string | null;
  durationSec?: number | null;
  source?: Finding["source"];
}

/** De ce contează fiecare tip de problemă, când detectorul nu dă o explicație mai precisă. */
export const WHY: Partial<Record<Dimension, string>> = {
  hook: "Primele secunde decid dacă privitorul se oprește din scroll; un hook slab pierde publicul înainte de mesaj.",
  clarity: "Un mesaj greu de citit sau neclar nu ajunge la privitor, oricât de bună ar fi imaginea.",
  rhythm: "Ritmul ține atenția; monotonia sau tăieturile pe lângă muzică se simt ca amatorism.",
  hierarchy: "Fără un singur element principal, ochiul nu știe unde să se uite și mesajul se pierde.",
  variety: "Repetiția aceleiași mișcări face reclama previzibilă și scade atenția.",
  brand: "Privitorul trebuie să rețină a cui e reclama; fără brand la momentele-cheie, efectul ajunge la altcineva.",
  cta: "Apelul la acțiune e momentul conversiei; prea scurt sau neclar înseamnă pierderea rezultatului.",
  "safe-zone": "Textul sub butoanele platformei sau tăiat la margini nu se vede pe telefon.",
  readability: "Pe un telefon textul mic sau prea scurt pe ecran nu poate fi citit.",
  flash: "Peste 2 flash-uri pe secundă e risc de sănătate (fotosensibilitate) și platformele pot respinge reclama.",
  "black-frame": "Un cadru negru între scene arată ca o eroare de montaj.",
  audio: "Sunetul prea tare, prea încet sau cu tăceri neintenționate se simte imediat și scade încrederea.",
  claims: "O afirmație fără sursă poate fi falsă și expune utilizatorul la probleme legale și de reputație.",
  rights: "Materialele unui terț fără drepturi confirmate nu pot fi publicate.",
  "real-footage": "Interfața produsului trebuie să fie cea reală; o interfață inventată induce în eroare.",
  determinism: "Aceeași reclamă trebuie să iasă identic la fiecare randare, altfel corecturile nu sunt controlabile.",
  assets: "Un material lipsă sau nepregătit oprește randarea sau arată greșit.",
  timing: "Structura de timp stricată produce goluri, suprapuneri sau desincronizare.",
  format: "Formatul greșit pentru platformă înseamnă decupaje și zone pierdute.",
  story: "Fără o structură clară (hook → tensiune → dovadă → recompensă → CTA), reclama nu convinge.",
  pacing: "Prea rapid nu se înțelege, prea lent plictisește; ritmul trebuie să servească mesajul.",
  contrast: "Textul fără contrast față de fundalul real (captură, imagine) nu se citește pe telefon.",
  clutter: "Prea multe elemente simultan obosesc ochiul și ascund mesajul.",
  composition: "O compoziție dezechilibrată sau cu subiectul prea mic pare neintenționată.",
  whitespace: "Spațiul gol fără rost face cadrul să pară neterminat.",
  motion: "Mișcarea fără motiv sau repetitivă pare artificială și distrage de la produs.",
  "ui-legibility": "Interfața prea mică pe ecran nu demonstrează nimic: privitorul nu vede funcția.",
  typography: "Tipografia inconsecventă slăbește ierarhia și impresia de calitate.",
  "brand-consistency": "Culorile, fonturile sau logo-ul folosite altfel decât brandul slăbesc recunoașterea.",
  platform: "Fiecare platformă are durate, zone și obiceiuri de vizionare; nepotrivirea scade performanța.",
  "beat-sync": "Tăieturile pe muzică dau senzația de montaj intenționat; o sincronizare greșită e mai rea decât niciuna.",
  stale: "Un timeline compilat din date vechi nu mai reflectă brief-ul, brandul sau materialele actuale.",
  reframing: "Pe alt format subiectul sau textul pot ieși din cadru dacă nu se reîncadrează.",
  creative: "Ideea creativă trebuie să fie clară și relevantă pentru produs, altfel efectele nu salvează reclama.",
};

export function makeIssue(d: IssueDraft, id: string, round: number, fps: number): Finding {
  const suggestedFix = d.suggestedFix ?? [];
  return {
    id,
    round,
    frame: d.frame,
    timecode: d.frame === null ? null : formatTimecode(d.frame, fps),
    durationSec: d.durationSec ?? null,
    sceneId: d.sceneId,
    layerId: d.layerId ?? null,
    formatId: d.formatId ?? null,
    dimension: d.dimension,
    category: d.category ?? CATEGORY_OF[d.dimension],
    severity: d.severity,
    problem: d.problem,
    whyItMatters: d.whyItMatters ?? WHY[d.dimension] ?? "",
    recommendation: d.recommendation,
    confidence: d.confidence ?? 1,
    autoFixable: d.autoFixable ?? suggestedFix.length > 0,
    suggestedFix,
    method: d.method ?? "timeline",
    source: d.source ?? "auto-check",
    status: "open",
  };
}

/** Un colector de probleme cu id-uri stabile (prefix + număr) și timecode după FPS. */
export function issueCollector(prefix: string, round: number, fps: number) {
  const out: Finding[] = [];
  let n = 0;
  return {
    issues: out,
    add(d: IssueDraft): Finding {
      const f = makeIssue(d, `${prefix}${++n}`, round, fps);
      out.push(f);
      return f;
    },
  };
}

/**
 * Cheia unei probleme între runde: aceeași verificare, aceeași scenă și același strat, cu textul fără cifre.
 * Servește la detectarea problemelor noi introduse de o corectură (rollback) și la cache.
 */
export function issueKey(f: Pick<Finding, "dimension" | "sceneId" | "layerId" | "problem"> & { formatId?: string | null }): string {
  const p = f.problem.toLowerCase().replace(/[\d.,]+/g, "#").replace(/\s+/g, " ").slice(0, 80);
  return `${f.dimension}|${f.formatId ?? "*"}|${f.sceneId ?? "-"}|${f.layerId ?? "-"}|${p}`;
}

/** Ordinea de lucru: gravitate, apoi încredere, apoi timp. */
export function prioritize(list: Finding[]): Finding[] {
  return [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.confidence - a.confidence || (a.frame ?? 1e9) - (b.frame ?? 1e9));
}

/**
 * Aceeași problemă raportată de două verificări (de ex. validatorul și critica) se păstrează o dată, la
 * gravitatea maximă. Cu `formats`: aceeași problemă, cu exact același text, pe fiecare format devine una
 * singură „pe toate formatele” (formatId null), de exemplu drepturile unui material sau o replică.
 */
export function dedupe(list: Finding[], formats: string[] = []): Finding[] {
  const by = new Map<string, Finding>();
  for (const f of list) {
    const k = issueKey(f);
    const prev = by.get(k);
    if (!prev || SEVERITY_ORDER[f.severity] < SEVERITY_ORDER[prev.severity]) by.set(k, f);
  }
  const out = [...by.values()];
  if (formats.length < 2) return out;
  const across = (f: Finding) => `${f.dimension}|${f.sceneId ?? "-"}|${f.layerId ?? "-"}|${f.problem}`;
  const groups = new Map<string, Finding[]>();
  for (const f of out) if (f.formatId) (groups.get(across(f)) ?? groups.set(across(f), []).get(across(f))!).push(f);
  const done = new Set<string>();
  const result: Finding[] = [];
  for (const f of out) {
    const g = f.formatId ? groups.get(across(f))! : null;
    if (!g || new Set(g.map((x) => x.formatId)).size < formats.length) {
      result.push(f);
      continue;
    }
    if (done.has(across(f))) continue;
    done.add(across(f));
    const worst = g.reduce((a, b) => (SEVERITY_ORDER[b.severity] < SEVERITY_ORDER[a.severity] ? b : a));
    result.push({ ...worst, formatId: null });
  }
  return result;
}

export function countBySeverity(list: Finding[]): Record<Severity, number> {
  const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of list) if (f.status === "open" || f.status === "needs-human") c[f.severity]++;
  return c;
}
