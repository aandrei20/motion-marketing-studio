import React from "react";
import { Img } from "remotion";
import { z } from "zod";
import { hashString, mulberry32 } from "../../core/random";
import { withAlpha } from "../core/color";
import { resolveColor, useAssetUrl } from "../core/context";
import { EASE, SPRINGS, clamp, prog, sp } from "../core/easing";
import { ORIGINAL, defineLayer } from "../types";

/**
 * Logo-ul se folosește doar la scară uniformă: fără recolorare, fără rotire, fără deformare
 * (regulile oficiale de logo). Efectele (lumină, particule) se aplică în jurul lui sau prin masca lui.
 */
const base = {
  category: "logo" as const,
  compatibleMedia: ["logo" as const, "svg" as const],
  status: "tested" as const,
  license: ORIGINAL,
  timing: { model: "duration" as const, defaultFrames: 75, minFrames: 20 },
};

const hex = (c: string) => (c.startsWith("#") ? c : "#ffffff");

function LogoImg({ src, style }: { src: string; style?: React.CSSProperties }) {
  const url = useAssetUrl();
  return <Img src={url(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", ...style }} />;
}

export const logoReveal = defineLayer({
  ...base,
  id: "logo.reveal",
  title: "Logo reveal (pop, scară, urcare, mască, asamblare)",
  description: "Apariția logo-ului: pop cu arc, creștere lentă, urcare, dezvăluire cu mască sau asamblare din benzi. Fără rotire sau recolorare.",
  tags: ["logo", "reveal", "brand", "ending", "intro", "pop"],
  performance: "light",
  sfx: [{ sound: "impact-small", at: "param:at" }],
  params: z.object({ src: z.string(), mode: z.enum(["pop", "scale", "rise", "mask", "assemble"]).default("pop"), at: z.number().int().min(0).default(0), strips: z.number().int().min(2).max(16).default(6) }),
  Component: ({ params: p, frame, env }) => {
    if (p.mode === "assemble") {
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: p.strips }, (_, i) => {
            const s = sp(frame, env.fps, p.at + i * 2, SPRINGS.ui);
            const dir = i % 2 ? 1 : -1;
            return (
              <div key={i} style={{ position: "absolute", inset: 0, clipPath: `inset(${(i / p.strips) * 100}% 0 ${100 - ((i + 1) / p.strips) * 100}% 0)`, transform: `translateX(${(dir * (1 - s) * 60).toFixed(2)}%)`, opacity: clamp(s * 2, 0, 1) }}>
                <LogoImg src={p.src} />
              </div>
            );
          })}
        </div>
      );
    }
    const cfg = p.mode === "pop" ? SPRINGS.pop : p.mode === "scale" ? SPRINGS.soft : SPRINGS.ui;
    const s = sp(frame, env.fps, p.at, cfg);
    const style: React.CSSProperties =
      p.mode === "pop"
        ? { transform: `scale(${s.toFixed(4)})`, opacity: frame >= p.at ? 1 : 0 }
        : p.mode === "scale"
          ? { transform: `scale(${(0.7 + 0.3 * s).toFixed(4)})`, opacity: clamp(s * 1.5, 0, 1) }
          : p.mode === "rise"
            ? { transform: `translateY(${((1 - s) * 30).toFixed(2)}%)`, opacity: clamp(s * 2, 0, 1) }
            : { clipPath: `inset(0 ${((1 - prog(frame, p.at, p.at + 18, EASE.inOut)) * 100).toFixed(2)}% 0 0)` };
    return <LogoImg src={p.src} style={style} />;
  },
  example: { params: { src: "$logo", mode: "pop", at: 4 }, durationInFrames: 50, box: "center", needs: ["logo"] },
});

export const logoLightPass = defineLayer({
  ...base,
  id: "logo.light-pass",
  title: "Lumină care trece peste logo",
  description: "O dungă de lumină traversează logo-ul, decupată exact pe forma lui (mască din canalul alfa).",
  tags: ["logo", "shine", "glint", "light", "premium", "sheen"],
  performance: "light",
  sfx: [{ sound: "shimmer", at: "param:at", gainDb: -6 }],
  params: z.object({ src: z.string(), at: z.number().int().min(0).default(10), frames: z.number().int().min(6).default(22), color: z.string().default("#ffffff"), intensity: z.number().min(0).max(1).default(0.85) }),
  Component: ({ params: p, frame, env }) => {
    const url = useAssetUrl();
    const t = prog(frame, p.at, p.at + p.frames, EASE.inOut);
    const pos = -40 + t * 180;
    const c = hex(resolveColor(env.palette, p.color));
    const mask = `url("${url(p.src)}") center / contain no-repeat`;
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <LogoImg src={p.src} />
        {t > 0 && t < 1 ? (
          <div style={{ position: "absolute", inset: 0, mask, WebkitMask: mask, background: `linear-gradient(110deg, transparent ${pos - 18}%, ${withAlpha(c, p.intensity)} ${pos}%, transparent ${pos + 18}%)` }} />
        ) : null}
      </div>
    );
  },
  example: { params: { src: "$logo", at: 6 }, durationInFrames: 40, box: "center", needs: ["logo"] },
});

export const logoParticles = defineLayer({
  ...base,
  id: "logo.particles",
  title: "Logo din particule",
  description: "Particule vin din toate direcțiile spre centru, iar la sosire apare logo-ul cu un flash discret.",
  tags: ["logo", "particles", "assemble", "magic", "launch", "reveal"],
  performance: "medium",
  sfx: [{ sound: "riser-short", at: "start", gainDb: -8 }, { sound: "impact", at: "param:arrive" }],
  params: z.object({ src: z.string(), arrive: z.number().int().min(4).default(24), count: z.number().int().min(10).max(400).default(120), colors: z.array(z.string()).min(1).default(["primary", "accent", "#ffffff"]) }),
  Component: ({ params: p, frame, box, env, layer }) => {
    const r = mulberry32(hashString(`${layer.id}:lp`));
    const n = env.quality === "draft" ? Math.ceil(p.count / 2) : p.count;
    const t = prog(frame, 0, p.arrive, EASE.in);
    const logoS = sp(frame, env.fps, p.arrive, SPRINGS.pop);
    const flash = Math.exp(-Math.max(0, frame - p.arrive) / 4) * (frame >= p.arrive ? 1 : 0);
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {frame < p.arrive + 2
          ? Array.from({ length: n }, (_, i) => {
              const a = r() * Math.PI * 2;
              const d = (0.6 + r() * 0.9) * Math.max(box.w, box.h);
              const tx = box.w / 2 + (r() - 0.5) * box.w * 0.5;
              const ty = box.h / 2 + (r() - 0.5) * box.h * 0.5;
              const x = tx + Math.cos(a) * d * (1 - t);
              const y = ty + Math.sin(a) * d * (1 - t);
              const c = resolveColor(env.palette, p.colors[i % p.colors.length], "primary");
              const sz = 4 + r() * 6;
              return <div key={i} style={{ position: "absolute", left: x - sz / 2, top: y - sz / 2, width: sz, height: sz, borderRadius: "50%", background: c, opacity: 0.4 + 0.6 * t }} />;
            })
          : null}
        <div style={{ position: "absolute", inset: 0, transform: `scale(${logoS})`, opacity: frame >= p.arrive ? 1 : 0, filter: flash > 0.02 ? `brightness(${1 + flash})` : undefined }}>
          <LogoImg src={p.src} />
        </div>
      </div>
    );
  },
  example: { params: { src: "$logo", arrive: 24 }, durationInFrames: 50, box: "center", needs: ["logo"] },
});

export const logoLockup = defineLayer({
  ...base,
  id: "logo.lockup",
  title: "Lockup logo + text",
  description: "Logo-ul apare, apoi se mută lateral și lasă loc unui text (nume, slogan sau CTA), care se dezvăluie din spatele lui.",
  tags: ["logo", "lockup", "tagline", "ending", "cta", "brand"],
  performance: "light",
  sfx: [{ sound: "pop", at: "start" }, { sound: "swipe", at: "param:textAt", gainDb: -8 }],
  params: z.object({ src: z.string(), text: z.string().min(1), textAt: z.number().int().min(0).default(14), logoSize: z.number().min(0.1).max(0.9).default(0.32), font: z.enum(["display", "body"]).default("display"), color: z.string().default("text") }),
  Component: ({ params: p, frame, box, env }) => {
    const s = sp(frame, env.fps, 0, SPRINGS.pop);
    const m = prog(frame, p.textAt, p.textAt + 16, EASE.expoOut);
    const lw = box.w * p.logoSize;
    const lh = box.h * 0.9;
    const font = env.typography[p.font];
    const fs = Math.min(box.h * 0.42, (box.w - lw) / Math.max(4, p.text.length * 0.55));
    const logoX = box.w / 2 - lw / 2 - (box.w / 2 - lw / 2) * m;
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", left: logoX, top: (box.h - lh) / 2, width: lw, height: lh, transform: `scale(${s})` }}>
          <LogoImg src={p.src} />
        </div>
        <div style={{ position: "absolute", left: lw + box.w * 0.03, right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", overflow: "hidden" }}>
          <div style={{ fontFamily: `"${font.family}"`, fontWeight: font.weight, letterSpacing: `${font.tracking}em`, textTransform: font.uppercase ? "uppercase" : "none", fontSize: fs, color: resolveColor(env.palette, p.color, "text"), transform: `translateX(${((1 - m) * -110).toFixed(2)}%)`, whiteSpace: "nowrap" }}>{p.text}</div>
        </div>
      </div>
    );
  },
  example: { params: { src: "$logo", text: "Încearcă gratuit" }, durationInFrames: 50, box: { x: 360, y: 400, w: 1200, h: 280 }, needs: ["logo"] },
});

export const LOGOS = [logoReveal, logoLightPass, logoParticles, logoLockup];
