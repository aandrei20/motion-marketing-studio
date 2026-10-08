import React from "react";
import { z } from "zod";
import { rand } from "../../core/random";
import { resolveColor } from "../core/context";
import { EASE, SPRINGS, clamp, prog, sp } from "../core/easing";
import { hitDecay } from "../core/hits";
import { ChromaFilterDefs } from "../transitions/transitions";
import { ORIGINAL, defineLayer } from "../types";
import { TextBase, TextFrame, exitState, textExample, useTextLayout, wordSlots } from "./shared";

const base = {
  category: "typography" as const,
  compatibleMedia: ["text" as const],
  status: "tested" as const,
  performance: "light" as const,
  license: ORIGINAL,
  timing: { model: "duration" as const, defaultFrames: 60, minFrames: 18 },
};

const wordCount = (p: { text: string; lines?: string[] }) => (p.lines ? p.lines.join(" ") : p.text).split(/\s+/).filter(Boolean).length;

export const textWordReveal = defineLayer({
  ...base,
  id: "text.word-reveal",
  title: "Apariție pe cuvinte (stagger)",
  description: "Cuvintele urcă și apar pe rând, pe arc fără depășire. Textul de bază pentru mesaje.",
  tags: ["text", "stagger", "words", "reveal", "headline", "body"],
  sfx: [{ sound: "tick-soft", at: "each", gainDb: -14 }],
  params: TextBase.extend({ stagger: z.number().min(0).max(12).default(3), rise: z.number().min(0).max(2).default(0.45) }),
  events: (p) => Array.from({ length: wordCount(p) }, (_, i) => ({ at: i * p.stagger })),
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const ex = exitState(p, frame, duration);
    return (
      <TextFrame
        p={p}
        t={t}
        env={env}
        containerStyle={{ opacity: 1 - ex, transform: `translateY(${-ex * 0.3 * t.fontSize}px)` }}
        wordStyle={(w) => {
          const s = sp(frame, env.fps, w.index * p.stagger, SPRINGS.body);
          return { opacity: clamp(s * 1.6, 0, 1), transform: `translateY(${((1 - s) * p.rise).toFixed(3)}em)` };
        }}
      />
    );
  },
  example: textExample("Un mesaj clar, cuvânt cu cuvânt", { emphasis: ["clar"] }),
});

export const textCharReveal = defineLayer({
  ...base,
  id: "text.char-reveal",
  title: "Apariție pe litere",
  description: "Literele apar pe rând cu o mică rotație și urcare. Pentru titluri scurte.",
  tags: ["text", "letters", "characters", "stagger", "title"],
  sfx: [{ sound: "whoosh-soft", at: "start", gainDb: -10 }],
  params: TextBase.extend({ stagger: z.number().min(0).max(6).default(1.2) }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const ex = exitState(p, frame, duration);
    let charIndex = 0;
    return (
      <TextFrame
        p={p}
        t={t}
        env={env}
        containerStyle={{ opacity: 1 - ex }}
        renderWord={(w, _total, color) => (
          <span style={{ display: "inline-block", color }}>
            {[...w.text].map((ch, k) => {
              const i = charIndex++;
              const s = sp(frame, env.fps, i * p.stagger, SPRINGS.ui);
              return (
                <span key={k} style={{ display: "inline-block", opacity: clamp(s * 2, 0, 1), transform: `translateY(${((1 - s) * 0.5).toFixed(3)}em) rotate(${((1 - s) * 8).toFixed(2)}deg)` }}>
                  {ch}
                </span>
              );
            })}
          </span>
        )}
      />
    );
  },
  example: textExample("Literă cu literă"),
});

export const textMaskReveal = defineLayer({
  ...base,
  id: "text.mask-reveal",
  title: "Text ieșit de sub mască",
  description: "Fiecare rând urcă de sub o linie invizibilă (mask reveal). Elegant, editorial.",
  tags: ["mask", "reveal", "lines", "editorial", "premium"],
  sfx: [{ sound: "whoosh-soft", at: "start", gainDb: -8 }],
  params: TextBase.extend({ stagger: z.number().min(0).max(20).default(5) }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const ex = exitState(p, frame, duration);
    return (
      <TextFrame
        p={p}
        t={t}
        env={env}
        lineStyle={(li) => ({ overflow: "hidden", paddingBottom: "0.08em", marginBottom: "-0.08em" })}
        renderWord={(w, _total, color) => {
          const s = prog(frame, w.line * p.stagger, w.line * p.stagger + 14, EASE.expoOut);
          const out = ex;
          return (
            <span style={{ display: "inline-block", color, transform: `translateY(${((1 - s) * 105 - out * 105).toFixed(2)}%)` }}>{w.text}</span>
          );
        }}
      />
    );
  },
  example: textExample("Rând cu rând, de sub linie"),
});

export const textSlam = defineLayer({
  ...base,
  id: "text.slam",
  title: "Slam",
  description: "Textul cade din scară mare cu impact, un mic tremur și blur la intrare. Pentru afirmații tari.",
  tags: ["slam", "impact", "aggressive", "hook", "bold"],
  sfx: [{ sound: "slam", at: "start" }],
  params: TextBase.extend({ fromScale: z.number().min(1).max(5).default(2.4), shake: z.number().min(0).max(40).default(14) }),
  Component: ({ params: p, frame, duration, box, env, layer }) => {
    const t = useTextLayout(p, box, env);
    const s = sp(frame, env.fps, 0, SPRINGS.slam);
    const scale = p.fromScale + (1 - p.fromScale) * s;
    const k = hitDecay(frame, [3], 4);
    const jx = (rand(layer.id, "x", frame) - 0.5) * 2 * p.shake * k;
    const jy = (rand(layer.id, "y", frame) - 0.5) * 2 * p.shake * k;
    const ex = exitState(p, frame, duration);
    return (
      <TextFrame
        p={p}
        t={t}
        env={env}
        containerStyle={{
          transform: `translate(${jx.toFixed(2)}px, ${jy.toFixed(2)}px) scale(${(scale * (1 - 0.15 * ex)).toFixed(4)})`,
          opacity: clamp(s * 3, 0, 1) * (1 - ex),
          filter: s < 0.6 ? `blur(${((0.6 - s) * 20).toFixed(2)}px)` : undefined,
        }}
      />
    );
  },
  example: textExample("STOP SCROLLING", { uppercase: true, emphasis: ["stop"] }),
});

export const textPop = defineLayer({
  ...base,
  id: "text.pop",
  title: "Pop cu depășire",
  description: "Fiecare cuvânt sare din nimic, depășește puțin mărimea finală și se așază. Jucăuș, social.",
  tags: ["pop", "bounce", "playful", "social", "energetic"],
  sfx: [{ sound: "pop", at: "each", gainDb: -6 }],
  params: TextBase.extend({ stagger: z.number().min(0).max(15).default(4) }),
  events: (p) => Array.from({ length: wordCount(p) }, (_, i) => ({ at: i * p.stagger })),
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const ex = exitState(p, frame, duration);
    return (
      <TextFrame
        p={p}
        t={t}
        env={env}
        wordStyle={(w) => {
          const s = sp(frame, env.fps, w.index * p.stagger, SPRINGS.pop);
          return { transform: `scale(${(s * (1 - ex)).toFixed(4)})`, opacity: s > 0.01 ? 1 - ex : 0 };
        }}
      />
    );
  },
  example: textExample("Simplu. Rapid. Al tău.", { emphasis: ["rapid"] }),
});

export const textBlurReveal = defineLayer({
  ...base,
  id: "text.blur-reveal",
  title: "Apariție din blur",
  description: "Cuvintele trec din blur în focus. Calm, premium, cinematic.",
  tags: ["blur", "focus", "soft", "premium", "cinematic"],
  sfx: [{ sound: "whoosh-soft", at: "start", gainDb: -10 }],
  params: TextBase.extend({ stagger: z.number().min(0).max(12).default(4), blur: z.number().min(2).max(60).default(24) }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const ex = exitState(p, frame, duration);
    return (
      <TextFrame
        p={p}
        t={t}
        env={env}
        wordStyle={(w) => {
          const s = prog(frame, w.index * p.stagger, w.index * p.stagger + 16, EASE.out);
          return { opacity: s * (1 - ex), filter: `blur(${((1 - s) * p.blur + ex * 10).toFixed(2)}px)` };
        }}
      />
    );
  },
  example: textExample("Clar, din ceață", { font: "display" }),
});

export const textTracking = defineLayer({
  ...base,
  id: "text.tracking",
  title: "Animație de spațiere (tracking)",
  description: "Spațierea dintre litere se strânge spre valoarea finală, cu apariție. Rafinat, pentru titluri scurte.",
  tags: ["tracking", "letter-spacing", "premium", "title", "minimal"],
  sfx: [{ sound: "whoosh-soft", at: "start", gainDb: -10 }],
  params: TextBase.extend({ fromTracking: z.number().min(-0.05).max(1).default(0.35) }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const s = prog(frame, 0, Math.min(40, duration * 0.7), EASE.expoOut);
    const ex = exitState(p, frame, duration);
    const tr = p.fromTracking + (t.font.tracking - p.fromTracking) * s;
    return <TextFrame p={p} t={t} env={env} containerStyle={{ letterSpacing: `${tr.toFixed(4)}em`, opacity: clamp(s * 1.5, 0, 1) * (1 - ex) }} />;
  },
  example: textExample("PREMIUM", { uppercase: true, align: "center" }),
});

export const textTypewriter = defineLayer({
  ...base,
  id: "text.typewriter",
  title: "Typewriter cu cursor",
  description: "Textul se scrie literă cu literă, cu cursor care clipește. Fiecare tastă are sunet.",
  tags: ["typewriter", "typing", "terminal", "prompt", "ai", "search"],
  sfx: [{ sound: "key", at: "each", gainDb: -12 }],
  params: TextBase.extend({
    charsPerSecond: z.number().min(2).max(80).default(18),
    startDelay: z.number().int().min(0).default(4),
    caret: z.boolean().default(true),
  }),
  events: (p) => {
    const n = [...p.text].length;
    return Array.from({ length: n }, (_, i) => ({ at: Math.round(p.startDelay + (i * 30) / p.charsPerSecond) })).filter((_, i) => [...p.text][i] !== " ");
  },
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const ex = exitState(p, frame, duration);
    const total = [...t.lines.join(" ")].length;
    const shown = Math.floor(clamp(((frame - p.startDelay) / env.fps) * p.charsPerSecond, 0, total));
    let count = 0;
    const caretOn = Math.floor(frame / Math.round(env.fps * 0.5)) % 2 === 0 || shown < total;
    const caretColor = resolveColor(env.palette, p.emphasisColor, "accent");
    let caretPlaced = false;
    return (
      <TextFrame
        p={p}
        t={t}
        env={env}
        containerStyle={{ opacity: 1 - ex }}
        renderWord={(w, _total, color) => {
          const chars = [...w.text];
          const start = count;
          count += chars.length + 1;
          const visible = clamp(shown - start, 0, chars.length);
          const showCaret = !caretPlaced && p.caret && shown >= start && shown <= start + chars.length;
          if (showCaret) caretPlaced = true;
          return (
            <span style={{ color, position: "relative" }}>
              <span>{chars.slice(0, visible).join("")}</span>
              <span style={{ opacity: 0 }}>{chars.slice(visible).join("")}</span>
              {showCaret ? (
                <span style={{ position: "absolute", left: `${(visible / Math.max(1, chars.length)) * 100}%`, top: "0.08em", bottom: "0.08em", width: "0.07em", background: caretColor, opacity: caretOn ? 1 : 0 }} />
              ) : null}
            </span>
          );
        }}
      />
    );
  },
  example: textExample("Caută orice, în câteva secunde", { font: "mono", maxSize: 80, charsPerSecond: 24 }),
});

export const textSplit = defineLayer({
  ...base,
  id: "text.split",
  title: "Text despicat",
  description: "Prima jumătate a cuvintelor vine din stânga, a doua din dreapta, și se întâlnesc. Pentru contraste („înainte / după”).",
  tags: ["split", "contrast", "meet", "versus", "energetic"],
  sfx: [{ sound: "swipe", at: "start", gainDb: -6 }],
  params: TextBase.extend({ distance: z.number().min(0).max(2000).default(700) }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const ex = exitState(p, frame, duration);
    const n = wordSlots(t.lines, []).length;
    return (
      <TextFrame
        p={p}
        t={t}
        env={env}
        containerStyle={{ opacity: 1 - ex }}
        wordStyle={(w) => {
          const s = sp(frame, env.fps, 0, SPRINGS.ui);
          const dir = w.index < n / 2 ? -1 : 1;
          return { transform: `translateX(${(dir * (1 - s) * p.distance).toFixed(1)}px)`, opacity: clamp(s * 2, 0, 1) };
        }}
      />
    );
  },
  example: textExample("Înainte. După.", { align: "center", emphasis: ["după"] }),
});

export const textHighlight = defineLayer({
  ...base,
  id: "text.highlight",
  title: "Evidențiere pe cuvânt (marker, subliniere, tăiere, cerc)",
  description: "Textul apare, apoi cuvintele de accent primesc un marker, o subliniere, o tăiere sau un cerc desenat.",
  tags: ["highlight", "marker", "underline", "strikethrough", "circle", "emphasis"],
  sfx: [{ sound: "marker", at: "param:markAt", gainDb: -8 }],
  params: TextBase.extend({
    style: z.enum(["marker", "underline", "strike", "circle"]).default("marker"),
    markAt: z.number().int().min(0).default(14),
    markColor: z.string().default("accent"),
  }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const ex = exitState(p, frame, duration);
    const appear = sp(frame, env.fps, 0, SPRINGS.body);
    const mark = prog(frame, p.markAt, p.markAt + 12, EASE.out);
    const markColor = resolveColor(env.palette, p.markColor, "accent");
    return (
      <TextFrame
        p={{ ...p, emphasisColor: p.style === "marker" ? p.color : p.emphasisColor }}
        t={t}
        env={env}
        containerStyle={{ opacity: clamp(appear * 1.5, 0, 1) * (1 - ex), transform: `translateY(${((1 - appear) * 0.3).toFixed(3)}em)` }}
        renderWord={(w, _total, color) => (
          <span style={{ position: "relative", display: "inline-block", color }}>
            {w.emphasized && p.style === "marker" ? (
              <span style={{ position: "absolute", left: "-0.08em", right: "-0.08em", top: "0.12em", bottom: "0.02em", background: markColor, opacity: 0.85, transform: `scaleX(${mark})`, transformOrigin: "left", zIndex: -1, borderRadius: "0.08em" }} />
            ) : null}
            {w.emphasized && p.style === "underline" ? (
              <span style={{ position: "absolute", left: 0, right: 0, bottom: "-0.02em", height: "0.08em", background: markColor, transform: `scaleX(${mark})`, transformOrigin: "left" }} />
            ) : null}
            {w.emphasized && p.style === "strike" ? (
              <span style={{ position: "absolute", left: "-0.05em", right: "-0.05em", top: "52%", height: "0.08em", background: markColor, transform: `scaleX(${mark})`, transformOrigin: "left" }} />
            ) : null}
            {w.emphasized && p.style === "circle" ? (
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: "absolute", left: "-12%", top: "-18%", width: "124%", height: "136%", overflow: "visible" }}>
                <ellipse cx={50} cy={20} rx={48} ry={18} fill="none" stroke={markColor} strokeWidth={2.4} vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - mark} style={{ strokeWidth: "0.07em" }} />
              </svg>
            ) : null}
            <span style={{ position: "relative" }}>{w.text}</span>
          </span>
        )}
      />
    );
  },
  example: textExample("Economisești timp în fiecare zi", { emphasis: ["timp"], style: "marker" }),
});

export const textOutlineFill = defineLayer({
  ...base,
  id: "text.outline-fill",
  title: "Contur, apoi umplere",
  description: "Textul apare doar ca un contur, apoi se umple cu culoare de la stânga la dreapta.",
  tags: ["outline", "stroke", "fill", "title", "graphic"],
  sfx: [{ sound: "whoosh-soft", at: "start", gainDb: -10 }],
  params: TextBase.extend({ fillAt: z.number().int().min(0).default(14), strokeWidth: z.number().min(0.5).max(8).default(2.5) }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const ex = exitState(p, frame, duration);
    const appear = prog(frame, 0, 10, EASE.out);
    const fill = prog(frame, p.fillAt, p.fillAt + 18, EASE.inOut);
    const color = resolveColor(env.palette, p.color, "text");
    return (
      <div style={{ position: "absolute", inset: 0, opacity: appear * (1 - ex) }}>
        <TextFrame p={p} t={t} env={env} containerStyle={{ color: "transparent", WebkitTextStroke: `${p.strokeWidth}px ${color}` }} renderWord={(w) => <span>{w.text}</span>} />
        <TextFrame p={p} t={t} env={env} containerStyle={{ clipPath: `inset(0 ${(100 - fill * 100).toFixed(2)}% 0 0)` }} />
      </div>
    );
  },
  example: textExample("CONTUR", { uppercase: true }),
});

export const textGlitch = defineLayer({
  ...base,
  id: "text.glitch",
  title: "Text glitch",
  description: "Textul intră cu canale de culoare separate și salturi digitale câteva cadre, apoi se stabilizează.",
  tags: ["glitch", "digital", "tech", "error", "aggressive"],
  sfx: [{ sound: "glitch", at: "start", gainDb: -4 }],
  params: TextBase.extend({ glitchFrames: z.number().int().min(2).max(30).default(10), intensity: z.number().min(0).max(1).default(0.8) }),
  Component: ({ params: p, frame, duration, box, env, layer }) => {
    const t = useTextLayout(p, box, env);
    const ex = exitState(p, frame, duration);
    const active = frame < p.glitchFrames || (p.exit === "snap" && frame >= duration - 4);
    const id = `tg-${layer.id}`.replace(/[^a-zA-Z0-9-]/g, "");
    const jx = active ? (rand(layer.id, "gx", frame) - 0.5) * 40 * p.intensity : 0;
    const off = active ? 4 + 14 * p.intensity * rand(layer.id, "go", frame) : 0;
    const visible = frame >= 1 && rand(layer.id, "flick", frame) > (active ? 0.18 : 0);
    return (
      <div style={{ position: "absolute", inset: 0, opacity: visible ? 1 - ex : 0 }}>
        {active ? <ChromaFilterDefs id={id} offset={off} /> : null}
        <TextFrame p={p} t={t} env={env} containerStyle={{ transform: `translateX(${jx.toFixed(1)}px)`, filter: active ? `url(#${id})` : undefined }} />
      </div>
    );
  },
  example: textExample("SEMNAL PIERDUT", { uppercase: true }),
});

export const textBigWord = defineLayer({
  ...base,
  id: "text.big-word",
  title: "Un cuvânt pe tot ecranul",
  description: "Un singur cuvânt, cât de mare încape, pentru un moment mare. Intră cu un punch de scară.",
  tags: ["big", "fullscreen", "word", "moment", "impact", "hook"],
  sfx: [{ sound: "impact-small", at: "start" }],
  params: TextBase.extend({ maxSize: z.number().default(520), minSize: z.number().default(60), maxLines: z.number().int().default(1) }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const s = sp(frame, env.fps, 0, SPRINGS.slam);
    const ex = exitState(p, frame, duration);
    return <TextFrame p={p} t={t} env={env} containerStyle={{ transform: `scale(${(1.25 - 0.25 * s) * (1 + 0.1 * ex)})`, opacity: clamp(s * 3, 0, 1) * (1 - ex) }} />;
  },
  example: { ...textExample("ACUM", { uppercase: true, align: "center" }), box: { x: 80, y: 140, w: 1760, h: 800 } },
});

export const textBody = defineLayer({
  ...base,
  id: "text.body",
  title: "Text secundar",
  description: "Text de susținere (subtitlu, detaliu), care apare discret, fără să concureze cu mesajul principal.",
  tags: ["body", "subtitle", "support", "secondary", "caption"],
  sfx: [],
  params: TextBase.extend({ font: z.enum(["display", "body", "mono"]).default("body"), maxSize: z.number().default(56), minSize: z.number().default(24), delay: z.number().int().min(0).default(0) }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const t = useTextLayout(p, box, env);
    const s = sp(frame, env.fps, p.delay, SPRINGS.body);
    const ex = exitState(p, frame, duration);
    return <TextFrame p={p} t={t} env={env} containerStyle={{ opacity: clamp(s * 1.4, 0, 1) * (1 - ex), transform: `translateY(${((1 - s) * 0.6).toFixed(3)}em)` }} />;
  },
  example: textExample("Un detaliu care susține mesajul principal, fără să concureze cu el.", { font: "body", maxSize: 56 }),
});

export const TEXT_LAYERS = [
  textWordReveal,
  textCharReveal,
  textMaskReveal,
  textSlam,
  textPop,
  textBlurReveal,
  textTracking,
  textTypewriter,
  textSplit,
  textHighlight,
  textOutlineFill,
  textGlitch,
  textBigWord,
  textBody,
];
