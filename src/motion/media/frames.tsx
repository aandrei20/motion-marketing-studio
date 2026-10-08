import React from "react";
import { z } from "zod";
import { withAlpha } from "../core/color";
import { ORIGINAL, defineLayer } from "../types";

/**
 * Rame generice (fără marcă de producător): browser, telefon, laptop, fereastră desktop.
 * Rama doar încadrează captura reală; nu desenează interfața produsului.
 */
export type FrameKind = "none" | "browser" | "phone" | "laptop" | "desktop";

export interface FrameGeometry {
  /** zona ecranului în interiorul cutiei stratului */
  screen: { x: number; y: number; w: number; h: number };
  radius: number;
}

/** Calculează unde stă ecranul în cutie, pentru fiecare tip de ramă. */
export function frameGeometry(kind: FrameKind, box: { w: number; h: number }, screenAspect: number): FrameGeometry {
  if (kind === "none") {
    // ecranul ocupă cutia cu raportul cerut, centrat
    let w = box.w;
    let h = w / screenAspect;
    if (h > box.h) {
      h = box.h;
      w = h * screenAspect;
    }
    return { screen: { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h }, radius: Math.min(w, h) * 0.02 };
  }
  if (kind === "browser" || kind === "desktop") {
    const barRatio = kind === "browser" ? 0.055 : 0.045;
    // înălțimea totală = ecran + bară; bara proporțională cu lățimea
    let w = box.w;
    let bar = w * barRatio;
    let h = w / screenAspect;
    if (h + bar > box.h) {
      const k = box.h / (h + bar);
      w *= k;
      h *= k;
      bar *= k;
    }
    const x = (box.w - w) / 2;
    const y = (box.h - (h + bar)) / 2 + bar;
    return { screen: { x, y, w, h }, radius: w * 0.012 };
  }
  if (kind === "phone") {
    const bezel = 0.035;
    let outerW = box.w;
    let screenW = outerW * (1 - 2 * bezel);
    let screenH = screenW / screenAspect;
    let outerH = screenH + outerW * 2 * bezel;
    if (outerH > box.h) {
      const k = box.h / outerH;
      outerW *= k;
      screenW *= k;
      screenH *= k;
      outerH *= k;
    }
    const ox = (box.w - outerW) / 2;
    const oy = (box.h - outerH) / 2;
    return { screen: { x: ox + outerW * bezel, y: oy + outerW * bezel, w: screenW, h: screenH }, radius: screenW * 0.11 };
  }
  // laptop: ecran + bază (punte) dedesubt
  const bezel = 0.025;
  const baseH = 0.06;
  let outerW = box.w * 0.84;
  let screenW = outerW * (1 - 2 * bezel);
  let screenH = screenW / screenAspect;
  let lidH = screenH + outerW * 2 * bezel;
  let total = lidH + box.w * baseH;
  if (total > box.h) {
    const k = box.h / total;
    outerW *= k;
    screenW *= k;
    screenH *= k;
    lidH *= k;
    total *= k;
  }
  const ox = (box.w - outerW) / 2;
  const oy = (box.h - total) / 2;
  return { screen: { x: ox + outerW * bezel, y: oy + outerW * bezel, w: screenW, h: screenH }, radius: screenW * 0.008 };
}

/** Desenează rama în jurul unei geometrii; `children` e conținutul ecranului (deja poziționat). */
export function DeviceFrame({ kind, box, geo, children, url, theme = "dark" }: { kind: FrameKind; box: { w: number; h: number }; geo: FrameGeometry; children: React.ReactNode; url?: string; theme?: "dark" | "light" }) {
  const s = geo.screen;
  const dark = theme === "dark";
  const chrome = dark ? "#1d1d22" : "#eceef2";
  const chromeEdge = dark ? "#33333b" : "#d5d8de";
  const screenEl = (
    <div style={{ position: "absolute", left: s.x, top: s.y, width: s.w, height: s.h, overflow: "hidden", borderRadius: kind === "browser" || kind === "desktop" ? `0 0 ${geo.radius}px ${geo.radius}px` : geo.radius, background: "#000" }}>
      {children}
    </div>
  );
  if (kind === "none") return screenEl;
  if (kind === "browser" || kind === "desktop") {
    const bar = s.w * (kind === "browser" ? 0.055 : 0.045);
    const dot = bar * 0.22;
    return (
      <>
        <div style={{ position: "absolute", left: s.x, top: s.y - bar, width: s.w, height: bar + s.h, borderRadius: geo.radius, background: chrome, boxShadow: `0 0 0 1px ${chromeEdge}` }} />
        <div style={{ position: "absolute", left: s.x + bar * 0.45, top: s.y - bar / 2 - dot / 2, display: "flex", gap: dot * 0.8 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: dot, height: dot, borderRadius: "50%", background: dark ? withAlpha(c, 0.85) : c }} />
          ))}
        </div>
        {kind === "browser" ? (
          <div style={{ position: "absolute", left: s.x + s.w * 0.22, top: s.y - bar * 0.78, width: s.w * 0.56, height: bar * 0.56, borderRadius: bar * 0.28, background: dark ? "#2a2a31" : "#ffffff", color: dark ? "#a5a5ae" : "#55565c", fontFamily: "Inter, sans-serif", fontSize: bar * 0.26, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", whiteSpace: "nowrap" }}>
            {url ?? ""}
          </div>
        ) : null}
        {screenEl}
      </>
    );
  }
  if (kind === "phone") {
    const bez = s.w * 0.035 / (1 - 0.07);
    const outer = { x: s.x - bez, y: s.y - bez, w: s.w + 2 * bez, h: s.h + 2 * bez };
    return (
      <>
        <div style={{ position: "absolute", left: outer.x, top: outer.y, width: outer.w, height: outer.h, borderRadius: geo.radius + bez, background: "#0d0d10", boxShadow: "inset 0 0 0 2px #3a3a42, 0 0 0 1px #000" }} />
        {screenEl}
        <div style={{ position: "absolute", left: s.x + s.w * 0.36, top: s.y + s.w * 0.025, width: s.w * 0.28, height: s.w * 0.075, borderRadius: s.w, background: "#000" }} />
      </>
    );
  }
  // laptop
  const bez = s.w * 0.025 / (1 - 0.05);
  const lid = { x: s.x - bez, y: s.y - bez, w: s.w + 2 * bez, h: s.h + 2 * bez };
  const baseW = lid.w * 1.16;
  const baseH = box.w * 0.06 * (lid.w / (box.w * 0.84));
  return (
    <>
      <div style={{ position: "absolute", left: lid.x, top: lid.y, width: lid.w, height: lid.h, borderRadius: bez * 1.2, background: "#121216", boxShadow: "inset 0 0 0 2px #2c2c33" }} />
      {screenEl}
      <div style={{ position: "absolute", left: lid.x + lid.w / 2 - baseW / 2, top: lid.y + lid.h, width: baseW, height: baseH * 0.35, background: "linear-gradient(#c8cad0, #8d9097)", borderRadius: `0 0 ${baseH}px ${baseH}px`, clipPath: "polygon(0 0, 100% 0, 97% 100%, 3% 100%)" }} />
      <div style={{ position: "absolute", left: lid.x + lid.w / 2 - baseW * 0.08, top: lid.y + lid.h, width: baseW * 0.16, height: baseH * 0.12, background: "#6e7178", borderRadius: `0 0 ${baseH * 0.2}px ${baseH * 0.2}px` }} />
    </>
  );
}

const frameMeta = (id: string, kind: FrameKind, title: string, description: string, tags: string[]) =>
  defineLayer({
    id,
    category: "frame",
    title,
    description,
    tags,
    compatibleMedia: ["screenshot", "video"],
    timing: { model: "duration", defaultFrames: 60, minFrames: 1 },
    sfx: [],
    status: "tested",
    performance: "light",
    license: ORIGINAL,
    params: z.object({ aspect: z.number().positive().default(kind === "phone" ? 390 / 844 : 16 / 10), theme: z.enum(["dark", "light"]).default("dark"), url: z.string().optional() }),
    Component: ({ params: p, box }) => {
      const geo = frameGeometry(kind, box, p.aspect);
      return (
        <DeviceFrame kind={kind} box={box} geo={geo} url={p.url} theme={p.theme}>
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, #23232b 0 12px, #1b1b22 12px 24px)" }} />
        </DeviceFrame>
      );
    },
    example: { params: { url: "exemplu.ro" }, durationInFrames: 20, box: "center" },
  });

/** Ramele ca intrări de registry (se folosesc prin `frame` în media.screen; pot fi desenate și singure). */
export const FRAMES = [
  frameMeta("frame.browser", "browser", "Ramă de browser", "Fereastră de browser generică (bară cu adresă), în jurul unei capturi de site.", ["browser", "web", "site", "saas", "frame"]),
  frameMeta("frame.phone", "phone", "Ramă de telefon", "Telefon generic (fără marcă), în jurul unei capturi de aplicație mobilă.", ["phone", "mobile", "app", "device", "frame"]),
  frameMeta("frame.laptop", "laptop", "Ramă de laptop", "Laptop generic, pentru aplicații desktop sau web.", ["laptop", "desktop", "device", "frame"]),
  frameMeta("frame.desktop", "desktop", "Fereastră de aplicație desktop", "Fereastră generică de aplicație (bară de titlu).", ["window", "desktop", "app", "frame"]),
];
