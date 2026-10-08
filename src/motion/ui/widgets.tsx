import React from "react";
import { Img } from "remotion";
import { z } from "zod";
import { readableOn, withAlpha } from "../core/color";
import { resolveColor, useAssetUrl } from "../core/context";
import { EASE, SPRINGS, clamp, prog, sp } from "../core/easing";
import { ORIGINAL, defineLayer } from "../types";

const base = {
  category: "ui" as const,
  compatibleMedia: ["none" as const],
  status: "tested" as const,
  license: ORIGINAL,
  performance: "light" as const,
  timing: { model: "duration" as const, defaultFrames: 60, minFrames: 6 },
};
const hex = (c: string) => (c.startsWith("#") ? c : "#ffffff");

export const uiZoomLens = defineLayer({
  ...base,
  id: "ui.zoom-lens",
  title: "Lupă pe un detaliu",
  description: "Un cerc sau un card care arată mărit o zonă reală din captură. Se folosește împreună cu un contur pe zona-sursă.",
  tags: ["zoom", "lens", "magnify", "detail", "close-up", "feature"],
  compatibleMedia: ["screenshot"],
  sfx: [{ sound: "pop", at: "start", gainDb: -6 }],
  params: z.object({
    src: z.string(),
    imageWidth: z.number().positive(),
    imageHeight: z.number().positive(),
    region: z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }),
    shape: z.enum(["circle", "rounded"]).default("rounded"),
    border: z.string().default("accent"),
  }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const url = useAssetUrl();
    const s = sp(frame, env.fps, 0, SPRINGS.pop);
    const fade = 1 - prog(frame, duration - 5, duration, EASE.in);
    const k = Math.max(box.w / p.region.w, box.h / p.region.h);
    const ox = p.region.x + p.region.w / 2 - box.w / k / 2;
    const oy = p.region.y + p.region.h / 2 - box.h / k / 2;
    const c = resolveColor(env.palette, p.border, "accent");
    return (
      <div style={{ position: "absolute", inset: 0, transform: `scale(${s})`, opacity: fade, borderRadius: p.shape === "circle" ? "50%" : 28, overflow: "hidden", boxShadow: `0 0 0 6px ${c}, 0 30px 70px rgba(0,0,0,0.5)` }}>
        <Img src={url(p.src)} style={{ position: "absolute", left: 0, top: 0, width: p.imageWidth, height: p.imageHeight, maxWidth: "none", transformOrigin: "0 0", transform: `scale(${k}) translate(${-ox}px, ${-oy}px)` }} />
      </div>
    );
  },
  example: { params: { src: "$screenshot", imageWidth: "$screenshot.w", imageHeight: "$screenshot.h", region: { x: 200, y: 150, w: 400, h: 220 } }, durationInFrames: 40, box: { x: 1100, y: 300, w: 640, h: 360 }, needs: ["screenshot"] },
});

export const uiNotification = defineLayer({
  ...base,
  id: "ui.notification",
  title: "Notificare / toast (grafică generică)",
  description:
    "Un card de notificare generic, în culorile brandului, care alunecă în cadru cu sunet. Grafică, nu interfața produsului: textul trebuie să fie un fapt verificat.",
  tags: ["notification", "toast", "alert", "message", "success"],
  sfx: [{ sound: "notification", at: "start" }],
  params: z.object({ title: z.string().min(1), body: z.string().default(""), icon: z.string().default("✓"), from: z.enum(["top", "right", "bottom"]).default("top"), color: z.string().default("surface"), accent: z.string().default("accent") }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const s = sp(frame, env.fps, 0, SPRINGS.ui);
    const out = prog(frame, duration - 6, duration, EASE.in);
    const bg = resolveColor(env.palette, p.color, "surface");
    const ac = resolveColor(env.palette, p.accent, "accent");
    const dy = p.from === "top" ? -1 : p.from === "bottom" ? 1 : 0;
    const dx = p.from === "right" ? 1 : 0;
    const h = box.h;
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: h * 0.18, padding: `0 ${h * 0.22}px`, borderRadius: h * 0.24, background: bg, boxShadow: "0 24px 60px rgba(0,0,0,0.35)", transform: `translate(${((1 - s + out) * dx * box.w * 1.2).toFixed(1)}px, ${((1 - s + out) * dy * box.h * 1.8).toFixed(1)}px)`, opacity: clamp(s * 2, 0, 1) * (1 - out) }}>
        <div style={{ width: h * 0.52, height: h * 0.52, borderRadius: h * 0.14, background: ac, color: readableOn(hex(ac)), display: "flex", alignItems: "center", justifyContent: "center", fontSize: h * 0.3, fontWeight: 800, fontFamily: `"${env.typography.body.family}"`, flexShrink: 0 }}>{p.icon}</div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, fontFamily: `"${env.typography.body.family}"`, color: resolveColor(env.palette, "text") }}>
          <div style={{ fontWeight: 700, fontSize: h * 0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
          {p.body ? <div style={{ fontWeight: 500, fontSize: h * 0.15, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.body}</div> : null}
        </div>
      </div>
    );
  },
  example: { params: { title: "Raport gata", body: "Exportat acum 2 secunde (exemplu)" }, durationInFrames: 50, box: { x: 560, y: 120, w: 800, h: 150 } },
});

export const uiProgress = defineLayer({
  ...base,
  id: "ui.progress",
  title: "Bară de progres",
  description: "O bară care se umple până la o valoare, cu sunet la final. Grafică generică.",
  tags: ["progress", "loading", "upload", "complete", "bar"],
  sfx: [{ sound: "ding", at: "param:endFrame" }],
  params: z.object({ value: z.number().min(0).max(1).default(1), startFrame: z.number().int().min(0).default(4), endFrame: z.number().int().min(1).default(40), color: z.string().default("accent"), track: z.string().default("surface"), label: z.string().default("") }),
  Component: ({ params: p, frame, box, env }) => {
    const t = prog(frame, p.startFrame, p.endFrame, EASE.inOut) * p.value;
    const c = resolveColor(env.palette, p.color, "accent");
    const h = p.label ? box.h * 0.4 : box.h;
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: box.h * 0.1 }}>
        {p.label ? <div style={{ fontFamily: `"${env.typography.body.family}"`, fontWeight: 600, fontSize: box.h * 0.32, color: resolveColor(env.palette, "text") }}>{p.label} {Math.round(t * 100)}%</div> : null}
        <div style={{ height: h, borderRadius: h, background: resolveColor(env.palette, p.track, "surface"), overflow: "hidden" }}>
          <div style={{ width: `${(t * 100).toFixed(2)}%`, height: "100%", borderRadius: h, background: c, boxShadow: `0 0 20px ${withAlpha(hex(c), 0.6)}` }} />
        </div>
      </div>
    );
  },
  example: { params: { label: "Sincronizare" }, durationInFrames: 50, box: { x: 460, y: 460, w: 1000, h: 120 } },
});

export const uiToggle = defineLayer({
  ...base,
  id: "ui.toggle",
  title: "Comutator",
  description: "Un comutator generic care trece pe „pornit” cu arc și sunet.",
  tags: ["toggle", "switch", "on", "setting", "enable"],
  sfx: [{ sound: "toggle", at: "param:at" }],
  params: z.object({ at: z.number().int().min(0).default(12), color: z.string().default("accent") }),
  Component: ({ params: p, frame, box, env }) => {
    const s = sp(frame, env.fps, p.at, SPRINGS.ui);
    const c = resolveColor(env.palette, p.color, "accent");
    const h = box.h;
    const w = box.w;
    return (
      <div style={{ position: "absolute", inset: 0, borderRadius: h, background: `color-mix(in srgb, ${c} ${(s * 100).toFixed(1)}%, #5b5b66)` }}>
        <div style={{ position: "absolute", top: h * 0.1, left: h * 0.1 + (w - h) * clamp(s, 0, 1.1), width: h * 0.8, height: h * 0.8, borderRadius: "50%", background: "#fff", boxShadow: "0 3px 8px rgba(0,0,0,0.3)" }} />
      </div>
    );
  },
  example: { params: { at: 10 }, durationInFrames: 40, box: { x: 860, y: 480, w: 200, h: 110 } },
});

// ─── cod și terminal ─────────────────────────────────────────────────────────

const KEYWORDS = new Set(
  "const let var function return if else for while import from export default async await class new type interface def print in of true false null None True False await yield try catch finally".split(" "),
);

/** Colorare sintactică simplă (cuvinte cheie, șiruri, comentarii, numere) pentru JS/TS/Python/shell. */
export function tokenize(line: string): Array<{ text: string; kind: "kw" | "str" | "com" | "num" | "plain" }> {
  const out: Array<{ text: string; kind: "kw" | "str" | "com" | "num" | "plain" }> = [];
  const re = /(\/\/.*$|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1]) out.push({ text: m[1], kind: "com" });
    else if (m[2]) out.push({ text: m[2], kind: "str" });
    else if (m[3]) out.push({ text: m[3], kind: "num" });
    else if (m[4]) out.push({ text: m[4], kind: KEYWORDS.has(m[4]) ? "kw" : "plain" });
    else out.push({ text: m[5] ?? "", kind: "plain" });
  }
  return out;
}

const CODE_COLORS = { kw: "#c792ea", str: "#c3e88d", com: "#697098", num: "#f78c6c", plain: "#e6e6f0" } as const;

function WindowChrome({ box, title, children, env }: { box: { w: number; h: number }; title: string; children: React.ReactNode; env: { typography: { mono: { family: string } } } }) {
  const bar = Math.max(28, box.h * 0.08);
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: bar * 0.4, overflow: "hidden", background: "#15151c", boxShadow: "0 30px 80px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: bar * 0.2, padding: `0 ${bar * 0.4}px`, background: "#1e1e27" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: bar * 0.3, height: bar * 0.3, borderRadius: "50%", background: c }} />
        ))}
        <div style={{ marginLeft: bar * 0.3, color: "#8a8aa0", fontFamily: `"${env.typography.mono.family}"`, fontSize: bar * 0.38 }}>{title}</div>
      </div>
      <div style={{ position: "absolute", top: bar, left: 0, right: 0, bottom: 0, padding: bar * 0.6 }}>{children}</div>
    </div>
  );
}

export const uiCode = defineLayer({
  ...base,
  id: "ui.code",
  title: "Cod animat",
  description: "Un bloc de cod real (dat de utilizator) cu colorare sintactică, scris rând cu rând sau literă cu literă; rânduri evidențiate.",
  tags: ["code", "developer", "api", "snippet", "technical", "sdk"],
  performance: "light",
  sfx: [{ sound: "key", at: "each", gainDb: -16 }],
  params: z.object({ code: z.string().min(1), title: z.string().default(""), typing: z.enum(["lines", "chars", "none"]).default("lines"), lineStagger: z.number().int().min(1).default(5), cps: z.number().min(5).max(200).default(40), highlight: z.array(z.number().int().min(1)).default([]), fontSize: z.number().min(10).max(80).default(30) }),
  events: (p) => {
    const lines = p.code.split("\n");
    if (p.typing === "lines") return lines.map((_, i) => ({ at: i * p.lineStagger }));
    if (p.typing === "chars") return Array.from({ length: Math.min(200, p.code.length) }, (_, i) => ({ at: Math.round((i * 30) / p.cps) })).filter((_, i) => i % 2 === 0);
    return [];
  },
  Component: ({ params: p, frame, box, env }) => {
    const lines = p.code.split("\n");
    const charsShown = p.typing === "chars" ? Math.floor((frame / env.fps) * p.cps) : Infinity;
    let budget = charsShown;
    return (
      <WindowChrome box={box} title={p.title} env={env}>
        <div style={{ fontFamily: `"${env.typography.mono.family}"`, fontSize: p.fontSize, lineHeight: 1.55, whiteSpace: "pre" }}>
          {lines.map((line, i) => {
            const lineIn = p.typing === "lines" ? prog(frame, i * p.lineStagger, i * p.lineStagger + 6, EASE.out) : 1;
            const visible = p.typing === "chars" ? Math.max(0, Math.min(line.length, budget)) : line.length;
            if (p.typing === "chars") budget -= line.length + 1;
            let used = 0;
            const hl = p.highlight.includes(i + 1);
            return (
              <div key={i} style={{ opacity: lineIn, transform: `translateX(${(1 - lineIn) * 20}px)`, background: hl ? "rgba(255,255,255,0.08)" : undefined, boxShadow: hl ? `inset 4px 0 0 ${resolveColor(env.palette, "accent")}` : undefined, paddingLeft: "0.4em", minHeight: "1.55em" }}>
                <span style={{ color: "#4b4b60", marginRight: "1em" }}>{String(i + 1).padStart(2, " ")}</span>
                {tokenize(line).map((tk, j) => {
                  const start = used;
                  used += tk.text.length;
                  const shown = tk.text.slice(0, Math.max(0, visible - start));
                  return shown ? <span key={j} style={{ color: CODE_COLORS[tk.kind] }}>{shown}</span> : null;
                })}
              </div>
            );
          })}
        </div>
      </WindowChrome>
    );
  },
  example: { params: { code: 'import { create } from "sdk";\n\n// trei rânduri până la primul raport\nconst report = await create({ range: "7d" });\nconsole.log(report.total);', title: "index.ts", highlight: [4] }, durationInFrames: 60, box: { x: 260, y: 160, w: 1400, h: 760 } },
});

export const uiTerminal = defineLayer({
  ...base,
  id: "ui.terminal",
  title: "Terminal animat",
  description: "Comenzi scrise într-un terminal, urmate de ieșirea lor rând cu rând. Comenzile și ieșirea trebuie să fie reale.",
  tags: ["terminal", "cli", "command", "developer", "install", "technical"],
  performance: "light",
  sfx: [{ sound: "key", at: "each", gainDb: -14 }],
  params: z.object({
    entries: z.array(z.object({ cmd: z.string(), output: z.array(z.string()).default([]) })).min(1),
    prompt: z.string().default("$"),
    cps: z.number().min(5).max(120).default(28),
    outputStagger: z.number().int().min(1).default(4),
    pause: z.number().int().min(0).default(8),
    fontSize: z.number().min(10).max(80).default(30),
    title: z.string().default("terminal"),
  }),
  events: (p) => {
    const ev: Array<{ at: number }> = [];
    let t = 4;
    for (const e of p.entries) {
      for (let i = 0; i < e.cmd.length; i += 2) ev.push({ at: Math.round(t + (i * 30) / p.cps) });
      t += (e.cmd.length * 30) / p.cps + p.pause + e.output.length * p.outputStagger + p.pause;
    }
    return ev;
  },
  Component: ({ params: p, frame, box, env }) => {
    const rows: React.ReactNode[] = [];
    let t = 4;
    const caretOn = Math.floor(frame / 15) % 2 === 0;
    for (let i = 0; i < p.entries.length; i++) {
      const e = p.entries[i];
      if (frame < t) break;
      const typeEnd = t + (e.cmd.length * 30) / p.cps;
      const shown = e.cmd.slice(0, Math.floor(((frame - t) / 30) * p.cps));
      const typing = frame < typeEnd + p.pause;
      rows.push(
        <div key={`c${i}`}>
          <span style={{ color: resolveColor(env.palette, "accent") }}>{p.prompt} </span>
          <span style={{ color: "#f2f2f7" }}>{shown}</span>
          {typing ? <span style={{ background: "#f2f2f7", opacity: caretOn ? 1 : 0 }}>&nbsp;</span> : null}
        </div>,
      );
      const outStart = typeEnd + p.pause;
      e.output.forEach((o, j) => {
        if (frame >= outStart + j * p.outputStagger) rows.push(<div key={`o${i}-${j}`} style={{ color: "#a9a9bd" }}>{o}</div>);
      });
      t = outStart + e.output.length * p.outputStagger + p.pause;
    }
    return (
      <WindowChrome box={box} title={p.title} env={env}>
        <div style={{ fontFamily: `"${env.typography.mono.family}"`, fontSize: p.fontSize, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{rows}</div>
      </WindowChrome>
    );
  },
  example: { params: { entries: [{ cmd: "npm install exemplu", output: ["added 12 packages in 2s"] }, { cmd: "exemplu init", output: ["✔ gata"] }] }, durationInFrames: 90, box: { x: 260, y: 200, w: 1400, h: 680 } },
});

export const UI_WIDGETS = [uiZoomLens, uiNotification, uiProgress, uiToggle, uiCode, uiTerminal];
