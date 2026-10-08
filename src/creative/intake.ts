/**
 * Întrebările de la început (PLAN, faza 11), grupele A–H, cu variante de ales. Răspunsurile devin
 * brief.json. Lucrul începe doar după „aprob”. Limbile nu au valoare implicită (regula 16).
 */
export interface IntakeQuestion {
  id: string;
  group: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
  text: string;
  options?: string[];
  multi?: boolean;
  /** câmpul din brief/proiect în care ajunge răspunsul */
  field: string;
  required: boolean;
}

export const INTAKE_GROUPS: Record<IntakeQuestion["group"], string> = {
  A: "Produs și obiectiv",
  B: "Platformă și format",
  C: "Poveste și creativ",
  D: "Materiale și footage real",
  E: "Text și limbă",
  F: "Audio",
  G: "Livrare",
  H: "Confirmare",
};

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  { id: "a1", group: "A", text: "Numele produsului și adresa (URL)?", field: "project.product", required: true },
  { id: "a2", group: "A", text: "Ce tip de produs este?", options: ["saas", "mobile-app", "desktop-app", "website", "ai-product", "developer-tool", "fintech", "productivity", "creative-tool", "ecommerce", "startup", "enterprise", "digital-service", "other"], field: "project.product.category", required: true },
  { id: "a3", group: "A", text: "Obiectivul reclamei?", options: ["awareness", "signups", "downloads", "sales", "launch", "feature-adoption", "other"], field: "brief.objective", required: true },
  { id: "a4", group: "A", text: "Cui i se adresează (public) și ce îl doare?", field: "brief.audience", required: true },
  { id: "a5", group: "A", text: "Apelul la acțiune (textul exact) și, dacă e o ofertă, sursa ei?", field: "brief.cta", required: true },
  { id: "a6", group: "A", text: "Ce NU se spune sau NU se arată?", field: "brief.doNotSay / brief.doNotShow", required: false },
  { id: "b1", group: "B", text: "Pe ce platforme? (mai multe)", options: ["tiktok", "reels", "shorts", "youtube", "feed", "linkedin", "x"], multi: true, field: "brief.platforms", required: true },
  { id: "b2", group: "B", text: "Format și rezoluție pe platformă?", options: ["9x16 (1080×1920)", "16x9 (1920×1080)", "1x1 (1080×1080)", "4x5 (1080×1350)", "9x16-4k", "personalizat"], multi: true, field: "project.formats", required: true },
  { id: "b3", group: "B", text: "Durata și FPS?", options: ["15 s", "30 s", "45 s", "60 s", "altă durată", "24 fps", "25 fps", "30 fps", "50 fps", "60 fps"], multi: true, field: "brief.durationSec / project.formats[].fps", required: true },
  { id: "c1", group: "C", text: "Ai o poveste sau un hook al tău? (se păstrează cuvânt cu cuvânt) Sau vrei 3 concepte propuse?", field: "brief.userVision", required: true },
  { id: "c2", group: "C", text: "Fraze obligatorii, exacte?", field: "brief.userVision.mandatoryPhrases", required: false },
  { id: "c3", group: "C", text: "Direcția creativă?", options: ["A – emoțional", "B – agresiv", "C – premium/cinematic", "D – tehnic", "E – minimal", "F – energic/social", "propune-mi 3"], field: "brief.direction", required: true },
  { id: "c4", group: "C", text: "Ritmul?", options: ["slow", "medium", "fast", "aggressive"], field: "brief.pacing", required: true },
  { id: "c5", group: "C", text: "Nivelul de efecte, efecte interzise, 3D permis, chipuri de oameni?", options: ["subtle", "medium", "bold"], field: "brief.visual", required: true },
  { id: "c6", group: "C", text: "Videouri sau imagini de referință? (fișiere)", field: "brief.references", required: false },
  { id: "d1", group: "D", text: "Ce materiale ai deja (logo, capturi, video, fonturi, brand guide)?", field: "assets", required: true },
  { id: "d2", group: "D", text: "Capturile le fac eu (captură reală automată)? E nevoie de autentificare?", options: ["da, fără autentificare", "da, mă autentific eu în fereastra deschisă", "nu, am capturile mele"], field: "capture", required: true },
  { id: "d3", group: "D", text: "Ce funcții se arată, în ordinea importanței?", field: "brief.objectiveNote", required: true },
  { id: "d4", group: "D", text: "Apar date personale în capturi (nume, email)? Le estompez?", options: ["nu apar", "apar – estompează", "apar – lasă-le"], field: "assets[].pii.blurApproved", required: true },
  { id: "d5", group: "D", text: "Pentru fiecare material al altcuiva: ai dreptul să-l folosești?", options: ["da", "nu", "nu știu"], field: "assets[].rights", required: true },
  { id: "e1", group: "E", text: "Limba textului de pe ecran?", field: "project.language.text", required: true },
  { id: "e2", group: "E", text: "Limba vocii?", field: "project.language.voice", required: true },
  { id: "e3", group: "E", text: "Subtitrări arse în video și/sau fișier .srt?", options: ["arse + .srt", "doar .srt", "fără"], field: "brief.captions", required: true },
  { id: "e4", group: "E", text: "Fonturi și culori: din brand kit, de pe site sau alese de mine?", field: "brand", required: false },
  { id: "e5", group: "E", text: "Cifre și prețuri: ai sursele? (altfel intră în lista „de confirmat”)", field: "research", required: false },
  { id: "f1", group: "F", text: "Vocea?", options: ["vocea mea (fișier)", "TTS gratuit (Windows)", "TTS cu cheie API (ElevenLabs/OpenAI)", "fără voce"], field: "brief.audio.voice", required: true },
  { id: "f2", group: "F", text: "Muzica?", options: ["muzica mea (fișier)", "sintetizată de studio (originală)", "fără muzică"], field: "brief.audio.music", required: true },
  { id: "f3", group: "F", text: "Audio-ul tău: ce fișier, de la ce secundă, cum (întreg, tăiat, mai încet sub voce)?", field: "brief.audio", required: false },
  { id: "f4", group: "F", text: "Densitatea efectelor sonore?", options: ["none", "low", "medium", "high"], field: "brief.audio.sfxDensity", required: true },
  { id: "f5", group: "F", text: "Tăcere intenționată undeva?", options: ["nu", "da (spune unde)"], field: "brief.audio.intentionalSilence", required: false },
  { id: "g1", group: "G", text: "Pachet de postare (copertă, titlu, descriere, hashtag-uri)?", options: ["da", "nu"], field: "brief.delivery.postPack", required: false },
  { id: "g2", group: "G", text: "Variante de hook?", options: ["0", "2", "3"], field: "brief.delivery.hookVariants", required: false },
  { id: "g3", group: "G", text: "Câte preview-uri și ce nivel de efort?", options: ["1 preview", "2 preview-uri", "până trece pragul 8/10"], field: "brief.delivery.previews", required: false },
  { id: "h1", group: "H", text: "Rezumatul planului e corect? Scrie „aprob” ca să încep.", field: "approvals", required: true },
];

export function intakeMarkdown(): string {
  const out: string[] = [];
  for (const g of Object.keys(INTAKE_GROUPS) as IntakeQuestion["group"][]) {
    out.push(`## ${g}. ${INTAKE_GROUPS[g]}`, "");
    for (const q of INTAKE_QUESTIONS.filter((x) => x.group === g)) {
      out.push(`- **${q.id}** ${q.text}${q.required ? "" : " (opțional)"}`);
      if (q.options) out.push(`  - variante: ${q.options.join(" · ")}${q.multi ? " (mai multe)" : ""}`);
    }
    out.push("");
  }
  return out.join("\n");
}
