import type { CreativeDirection, Pacing } from "../core/schema";
import type { Mood } from "../audio/music";

/**
 * Direcțiile creative A–F, ca profiluri executabile: ce tranziții, ce tipografie, ce cameră,
 * ce fundal, ce muzică. Storyboard-ul și compilatorul aleg capabilități din aceste profiluri.
 */
export interface DirectionProfile {
  id: CreativeDirection;
  letter: "A" | "B" | "C" | "D" | "E" | "F";
  label: string;
  description: string;
  pacing: Pacing;
  bpm: [number, number];
  mood: Mood;
  /** durata unui cadru fără voce (secunde) */
  shotSec: [number, number];
  transitions: { calm: string[]; rise: string[]; drop: string[] };
  text: { hook: string; headline: string; support: string; list: string };
  camera: { calm: string; active: string; ui: string };
  background: { capability: string; params: Record<string, unknown> };
  overlays: Array<{ capability: string; params: Record<string, unknown> }>;
  displayPersonality: string[];
  uppercaseHook: boolean;
  sfxDensity: "low" | "medium" | "high";
}

export const DIRECTIONS: Record<CreativeDirection, DirectionProfile> = {
  emotional: {
    id: "emotional",
    letter: "A",
    label: "Emoțional",
    description: "Ritm respirat, lumină caldă, text care apare din blur, muzică luminoasă. Pentru povești și transformări personale.",
    pacing: "slow",
    bpm: [86, 100],
    mood: "uplifting",
    shotSec: [2.2, 3.6],
    transitions: { calm: ["tr.light-leak", "tr.blur", "tr.dissolve"], rise: ["tr.parallax-handoff", "tr.push-through"], drop: ["tr.blur"] },
    text: { hook: "text.blur-reveal", headline: "text.mask-reveal", support: "text.body", list: "text.word-reveal" },
    camera: { calm: "camera.parallax-drift", active: "camera.push", ui: "camera.push" },
    background: { capability: "bg.gradient", params: { from: "background", to: "primary", strength: 0.35, mode: "radial" } },
    overlays: [{ capability: "fx.light-leak", params: { opacity: 0.25 } }, { capability: "fx.grain", params: { opacity: 0.05 } }],
    displayPersonality: ["emotional", "editorial"],
    uppercaseHook: false,
    sfxDensity: "low",
  },
  aggressive: {
    id: "aggressive",
    letter: "B",
    label: "Agresiv",
    description: "Tăieturi pe ritm, text care lovește (slam), tremur pe impacturi, contrast mare. Pentru hook-uri care opresc scroll-ul.",
    pacing: "aggressive",
    bpm: [128, 145],
    mood: "dark",
    shotSec: [0.7, 1.4],
    transitions: { calm: ["tr.cut", "tr.push"], rise: ["tr.zoom-through", "tr.whip", "tr.glitch"], drop: ["tr.cut", "tr.flash"] },
    text: { hook: "text.slam", headline: "text.slam", support: "text.word-reveal", list: "text.pop" },
    camera: { calm: "camera.beat-punch", active: "camera.shake", ui: "camera.push" },
    background: { capability: "bg.grid", params: { perspective: true, opacity: 0.14, speed: 60 } },
    overlays: [{ capability: "fx.grain", params: { opacity: 0.07 } }, { capability: "fx.vignette", params: { strength: 0.5 } }],
    displayPersonality: ["aggressive", "bold"],
    uppercaseHook: true,
    sfxDensity: "high",
  },
  premium: {
    id: "premium",
    letter: "C",
    label: "Premium / cinematic",
    description: "Mișcări lente de cameră în 3D, lumini difuze, tipografie rafinată, tranziții cu adâncime. Pentru produse care vor să pară scumpe.",
    pacing: "medium",
    bpm: [92, 110],
    mood: "calm",
    shotSec: [2, 3.2],
    transitions: { calm: ["tr.parallax-handoff", "tr.push-through", "tr.scale"], rise: ["tr.push-through", "tr.zoom-through"], drop: ["tr.light-leak"] },
    text: { hook: "text.mask-reveal", headline: "text.mask-reveal", support: "text.body", list: "text.blur-reveal" },
    camera: { calm: "camera.orbit", active: "camera.tilt", ui: "camera.push" },
    background: { capability: "bg.mesh", params: { intensity: 0.45, speed: 0.4 } },
    overlays: [{ capability: "fx.glow-orbs", params: { intensity: 0.3 } }, { capability: "fx.grain", params: { opacity: 0.04 } }, { capability: "fx.vignette", params: { strength: 0.4 } }],
    displayPersonality: ["premium", "cinematic"],
    uppercaseHook: false,
    sfxDensity: "medium",
  },
  technical: {
    id: "technical",
    letter: "D",
    label: "Tehnic",
    description: "Interfața în prim-plan, cursor și tastare reale, zoom pe detalii, grilă fină. Pentru produse tehnice și dezvoltatori.",
    pacing: "medium",
    bpm: [104, 120],
    mood: "driving",
    shotSec: [1.6, 2.6],
    transitions: { calm: ["tr.push", "tr.wipe"], rise: ["tr.zoom-through", "tr.push"], drop: ["tr.cut"] },
    text: { hook: "text.typewriter", headline: "text.word-reveal", support: "text.body", list: "text.word-reveal" },
    camera: { calm: "camera.push", active: "camera.focus-track", ui: "camera.focus-track" },
    background: { capability: "bg.grid", params: { opacity: 0.12 } },
    overlays: [{ capability: "fx.vignette", params: { strength: 0.35 } }],
    displayPersonality: ["technical", "developer"],
    uppercaseHook: false,
    sfxDensity: "medium",
  },
  minimal: {
    id: "minimal",
    letter: "E",
    label: "Minimal",
    description: "Puține elemente, mult spațiu, mișcare precisă. Fundal plin, fără texturi. Pentru mesaje simple și branduri curate.",
    pacing: "medium",
    bpm: [96, 112],
    mood: "calm",
    shotSec: [1.8, 3],
    transitions: { calm: ["tr.slide", "tr.cut"], rise: ["tr.push"], drop: ["tr.cut"] },
    text: { hook: "text.word-reveal", headline: "text.word-reveal", support: "text.body", list: "text.word-reveal" },
    camera: { calm: "camera.static", active: "camera.push", ui: "camera.push" },
    background: { capability: "bg.solid", params: { color: "background" } },
    overlays: [],
    displayPersonality: ["minimal", "neutral"],
    uppercaseHook: false,
    sfxDensity: "low",
  },
  energetic: {
    id: "energetic",
    letter: "F",
    label: "Energic / social",
    description: "Culoare, pop-uri pe ritm, whip-uri, accente pe cuvinte. Pentru TikTok/Reels și public tânăr.",
    pacing: "fast",
    bpm: [118, 132],
    mood: "playful",
    shotSec: [0.9, 1.7],
    transitions: { calm: ["tr.push", "tr.color-sweep"], rise: ["tr.whip", "tr.zoom-through"], drop: ["tr.cut"] },
    text: { hook: "text.pop", headline: "text.highlight", support: "text.word-reveal", list: "text.pop" },
    camera: { calm: "camera.handheld", active: "camera.beat-punch", ui: "camera.push" },
    background: { capability: "bg.mesh", params: { intensity: 0.6, speed: 0.9 } },
    overlays: [{ capability: "fx.particles", params: { mode: "dust", count: 50, opacity: 0.35 } }],
    displayPersonality: ["energetic", "social"],
    uppercaseHook: false,
    sfxDensity: "high",
  },
};

/** Propune 3 direcții când utilizatorul nu a ales una (nu se forțează alternative dacă viziunea e clară). */
export function suggestDirections(input: { tone: string[]; pacing: Pacing; category: string; platforms: string[] }): Array<{ direction: CreativeDirection; why: string }> {
  const scores: Record<CreativeDirection, number> = { emotional: 0, aggressive: 0, premium: 0, technical: 0, minimal: 0, energetic: 0 };
  const tone = input.tone.join(" ").toLowerCase();
  const bump = (d: CreativeDirection, w: number) => (scores[d] += w);
  if (/emo|cald|poveste|story|uman/.test(tone)) bump("emotional", 3);
  if (/agresiv|bold|șoc|soc|direct|provoc/.test(tone)) bump("aggressive", 3);
  if (/premium|lux|elegant|cinematic|rafinat/.test(tone)) bump("premium", 3);
  if (/tehnic|developer|precis|clar/.test(tone)) bump("technical", 3);
  if (/minimal|simplu|curat|calm/.test(tone)) bump("minimal", 3);
  if (/energic|amuzant|fun|tânăr|tanar|social/.test(tone)) bump("energetic", 3);
  if (input.pacing === "aggressive") bump("aggressive", 2);
  if (input.pacing === "fast") bump("energetic", 2);
  if (input.pacing === "slow") (bump("emotional", 1), bump("premium", 1));
  if (/developer|ai-product|saas/.test(input.category)) bump("technical", 1);
  if (/fintech|enterprise/.test(input.category)) bump("premium", 1);
  if (input.platforms.some((p) => ["tiktok", "reels", "shorts"].includes(p))) (bump("energetic", 1), bump("aggressive", 1));
  return (Object.keys(scores) as CreativeDirection[])
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, 3)
    .map((d) => ({ direction: d, why: `${DIRECTIONS[d].letter} – ${DIRECTIONS[d].label}: ${DIRECTIONS[d].description}` }));
}
