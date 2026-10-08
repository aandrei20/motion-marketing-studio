import React from "react";
import { Freeze, Img, OffthreadVideo, Sequence } from "remotion";
import { z } from "zod";
import { withAlpha } from "../core/color";
import { OverlayScaleContext, resolveColor, useAssetUrl } from "../core/context";
import { EASE, SPRINGS, clamp, prog, sp } from "../core/easing";
import { ORIGINAL, defineLayer } from "../types";
import { DeviceFrame, frameGeometry, type FrameKind } from "./frames";

const base = {
  category: "media" as const,
  status: "tested" as const,
  license: ORIGINAL,
  timing: { model: "duration" as const, defaultFrames: 90, minFrames: 1 },
};

const RectP = z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() });
const FrameP = z.enum(["none", "browser", "phone", "laptop", "desktop"]);

function SourceMedia({ src, kind, w, h, startFrom, playbackRate, muted, videoFrames, frame }: { src: string; kind: "image" | "video"; w: number; h: number; startFrom?: number; playbackRate?: number; muted?: boolean; videoFrames?: number; frame: number }) {
  const url = useAssetUrl();
  const style: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: w, height: h, display: "block" };
  if (kind === "video") {
    const video = <OffthreadVideo src={url(src)} style={style} startFrom={startFrom} playbackRate={playbackRate} muted={muted ?? true} />;
    // înregistrarea reală e mai scurtă decât scena: ultimul ei cadru rămâne pe ecran (fără cadre goale)
    if (videoFrames && videoFrames > 1) {
      const last = Math.max(0, Math.floor((videoFrames - 1 - (startFrom ?? 0)) / (playbackRate ?? 1)) - 1);
      return <Freeze frame={last} active={frame >= last}>{video}</Freeze>;
    }
    return video;
  }
  return <Img src={url(src)} style={style} />;
}

export interface ScreenParams {
  imageWidth: number;
  imageHeight: number;
  frame: string;
  viewportAspect?: number;
  crop?: { x: number; y: number; w: number; h: number };
  scroll?: { from: number; to: number; start: number; end: number; ease: "inOut" | "out" | "linear" };
}

/**
 * Geometria unui ecran (media.screen): unde stă ecranul în cutie, scara k (pixeli captură → pixeli
 * compoziție) și decalajul (ox, oy) în pixelii capturii, la un cadru dat. Folosită de componentă și de
 * compilator (de exemplu, ca să afle unde ajunge pe ecran o zonă din captură).
 */
export function screenMapping(p: ScreenParams, box: { w: number; h: number }, frame = 0, duration = 1): { geo: ReturnType<typeof frameGeometry>; k: number; ox: number; oy: number; aspect: number } {
  const imgAspect = p.imageWidth / p.imageHeight;
  const cropAspect = p.crop ? p.crop.w / p.crop.h : undefined;
  const aspect = cropAspect ?? p.viewportAspect ?? (imgAspect < 0.4 ? 9 / 19.5 : imgAspect < 1.1 && p.frame !== "phone" ? 16 / 10 : imgAspect);
  const geo = frameGeometry(p.frame as FrameKind, box, aspect);
  const s = geo.screen;
  let k: number;
  let ox: number;
  let oy: number;
  if (p.crop) {
    k = Math.max(s.w / p.crop.w, s.h / p.crop.h);
    ox = p.crop.x + p.crop.w / 2 - s.w / k / 2;
    oy = p.crop.y + p.crop.h / 2 - s.h / k / 2;
  } else {
    k = s.w / p.imageWidth;
    ox = 0;
    const visibleH = s.h / k;
    if (p.scroll) {
      const t = prog(frame, p.scroll.start * duration, p.scroll.end * duration, p.scroll.ease === "out" ? EASE.out : p.scroll.ease === "linear" ? EASE.linear : EASE.inOut);
      oy = clamp(p.scroll.from + (p.scroll.to - p.scroll.from) * t, 0, Math.max(0, p.imageHeight - visibleH));
    } else oy = visibleH > p.imageHeight ? -(visibleH - p.imageHeight) / 2 : 0;
  }
  return { geo, k, ox, oy, aspect };
}

/** Unde ajunge un punct din captură (pixeli imagine) în cutia stratului. */
export function screenPointToBox(p: ScreenParams, box: { w: number; h: number }, pt: { x: number; y: number }, frame = 0, duration = 1): { x: number; y: number; k: number } {
  const m = screenMapping(p, box, frame, duration);
  return { x: m.geo.screen.x + (pt.x - m.ox) * m.k, y: m.geo.screen.y + (pt.y - m.oy) * m.k, k: m.k };
}

export const mediaScreen = defineLayer({
  ...base,
  id: "media.screen",
  category: "ui",
  title: "Ecran real (captură sau înregistrare) în ramă",
  description:
    "Afișează o captură reală sau o înregistrare de ecran, opțional într-o ramă (browser, telefon, laptop, fereastră), cu decupare pe o zonă (UI crop / zoom pe regiune) și scroll animat. Straturile-copil (cursor, evidențieri, callout-uri) se poziționează în pixelii capturii și urmăresc zoom-ul și scroll-ul.",
  tags: ["screenshot", "screen", "ui", "browser", "phone", "laptop", "crop", "scroll", "demo", "real-footage"],
  compatibleMedia: ["screenshot", "video"],
  performance: "light",
  sfx: [],
  ownsChildren: true,
  params: z.object({
    src: z.string(),
    kind: z.enum(["image", "video"]).default("image"),
    imageWidth: z.number().positive(),
    imageHeight: z.number().positive(),
    frame: FrameP.default("none"),
    theme: z.enum(["dark", "light"]).default("dark"),
    url: z.string().optional(),
    /** raportul lățime/înălțime al ecranului vizibil; implicit din imagine (sau 16:10 pentru capturi foarte înalte) */
    viewportAspect: z.number().positive().optional(),
    crop: RectP.optional(),
    scroll: z
      .object({ from: z.number().min(0), to: z.number().min(0), start: z.number().min(0).max(1).default(0.1), end: z.number().min(0).max(1).default(0.9), ease: z.enum(["inOut", "out", "linear"]).default("inOut") })
      .optional(),
    videoStartFrom: z.number().int().min(0).default(0),
    playbackRate: z.number().min(0.1).max(8).default(1),
    /** lungimea înregistrării în cadre (la FPS-ul compoziției); după ea se îngheață ultimul cadru */
    videoFrames: z.number().int().min(1).optional(),
    radius: z.number().min(0).max(200).optional(),
    shadow: z.boolean().default(true),
  }),
  Component: ({ params: p, frame, duration, box, children }) => {
    const { geo, k, ox, oy } = screenMapping(p, box, frame, duration);
    const inner = (
      <div style={{ position: "absolute", left: 0, top: 0, width: p.imageWidth, height: p.imageHeight, transformOrigin: "0 0", transform: `scale(${k.toFixed(6)}) translate(${(-ox).toFixed(3)}px, ${(-oy).toFixed(3)}px)` }}>
        <SourceMedia src={p.src} kind={p.kind} w={p.imageWidth} h={p.imageHeight} startFrom={p.videoStartFrom} playbackRate={p.playbackRate} videoFrames={p.videoFrames} frame={frame} />
        <OverlayScaleContext.Provider value={k}>{children}</OverlayScaleContext.Provider>
      </div>
    );
    const g = p.radius !== undefined ? { ...geo, radius: p.radius } : geo;
    return (
      <div style={{ position: "absolute", inset: 0, filter: p.shadow ? "drop-shadow(0 30px 60px rgba(0,0,0,0.35))" : undefined }}>
        <DeviceFrame kind={p.frame as FrameKind} box={box} geo={g} url={p.url} theme={p.theme}>
          {inner}
        </DeviceFrame>
      </div>
    );
  },
  example: { params: { src: "$screenshot", imageWidth: "$screenshot.w", imageHeight: "$screenshot.h", frame: "browser", url: "exemplu.ro" }, durationInFrames: 60, box: "center", needs: ["screenshot"] },
});

export const mediaImage = defineLayer({
  ...base,
  id: "media.image",
  title: "Imagine (produs, foto, ilustrație)",
  description: "O imagine încadrată (cover/contain) cu colțuri și mișcare Ken Burns opțională (zoom lent spre un punct).",
  tags: ["image", "photo", "product", "ken-burns", "still"],
  compatibleMedia: ["image", "logo", "svg"],
  performance: "light",
  sfx: [],
  params: z.object({
    src: z.string(),
    fit: z.enum(["cover", "contain"]).default("cover"),
    radius: z.number().min(0).max(400).default(0),
    kenBurns: z.object({ from: z.number().default(1), to: z.number().default(1.12), x: z.number().min(0).max(1).default(0.5), y: z.number().min(0).max(1).default(0.5) }).optional(),
  }),
  Component: ({ params: p, frame, duration }) => {
    const url = useAssetUrl();
    const kb = p.kenBurns;
    const t = prog(frame, 0, duration, EASE.linear);
    const scale = kb ? kb.from * (kb.to / kb.from) ** t : 1;
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: p.radius }}>
        <Img src={url(p.src)} style={{ width: "100%", height: "100%", objectFit: p.fit, transform: `scale(${scale.toFixed(5)})`, transformOrigin: kb ? `${kb.x * 100}% ${kb.y * 100}%` : "50% 50%" }} />
      </div>
    );
  },
  example: { params: { src: "$photo", kenBurns: { from: 1, to: 1.15 }, radius: 24 }, durationInFrames: 60, box: "center", needs: ["photo"] },
});

export const mediaVideo = defineLayer({
  ...base,
  id: "media.video",
  title: "Video cu viteză controlată (speed ramp, freeze)",
  description:
    "Un clip video (înregistrare de ecran sau footage) cu tăiere, viteză pe segmente (speed ramp real, segment cu segment) și înghețare pe ultimul cadru.",
  tags: ["video", "footage", "speed-ramp", "slow-motion", "freeze", "recording"],
  compatibleMedia: ["video"],
  performance: "medium",
  sfx: [],
  params: z.object({
    src: z.string(),
    fit: z.enum(["cover", "contain"]).default("cover"),
    startFrom: z.number().int().min(0).default(0),
    /** segmente de viteză: de la cadrul local `at`, viteza devine `rate` */
    rates: z.array(z.object({ at: z.number().int().min(0), rate: z.number().min(0.1).max(8) })).default([{ at: 0, rate: 1 }]),
    freezeAt: z.number().int().min(0).optional(),
    radius: z.number().min(0).max(400).default(0),
    muted: z.boolean().default(true),
  }),
  Component: ({ params: p, frame, duration }) => {
    const url = useAssetUrl();
    const segs = [...p.rates].sort((a, b) => a.at - b.at);
    // poziția în sursă (cadre) la începutul fiecărui segment: continuitate între viteze
    const starts: number[] = [];
    let srcPos = p.startFrom;
    for (let i = 0; i < segs.length; i++) {
      starts.push(srcPos);
      const len = (segs[i + 1]?.at ?? duration) - segs[i].at;
      srcPos += len * segs[i].rate;
    }
    const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: p.fit };
    const content = segs.map((sg, i) => {
      const len = (segs[i + 1]?.at ?? duration) - sg.at;
      if (len <= 0) return null;
      return (
        <Sequence key={i} from={sg.at} durationInFrames={len} layout="none">
          {/* Remotion: cadrul sursă = startFrom + cadrul local × viteza, deci startFrom e în cadre ale sursei */}
          <OffthreadVideo src={url(p.src)} style={style} startFrom={Math.round(starts[i])} playbackRate={sg.rate} muted={p.muted} />
        </Sequence>
      );
    });
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: p.radius, background: "#000" }}>
        {p.freezeAt !== undefined ? <Freeze frame={p.freezeAt} active={frame >= p.freezeAt}>{content}</Freeze> : content}
      </div>
    );
  },
  example: { params: { src: "$video", rates: [{ at: 0, rate: 1 }, { at: 20, rate: 0.35 }, { at: 40, rate: 2 }] }, durationInFrames: 60, box: "center", needs: ["video"] },
});

export const mediaCompare = defineLayer({
  ...base,
  id: "media.compare",
  category: "ui",
  title: "Înainte / după cu separator glisant",
  description: "Două imagini suprapuse; un separator glisează și dezvăluie varianta „după”. Etichete opționale.",
  tags: ["before-after", "compare", "split", "transformation", "slider"],
  compatibleMedia: ["image", "screenshot"],
  performance: "light",
  sfx: [{ sound: "swipe", at: "param:startFrame", gainDb: -6 }],
  params: z.object({
    before: z.string(),
    after: z.string(),
    beforeLabel: z.string().default(""),
    afterLabel: z.string().default(""),
    startFrame: z.number().int().min(0).default(10),
    frames: z.number().int().min(4).default(30),
    to: z.number().min(0).max(1).default(0.5),
    color: z.string().default("accent"),
    radius: z.number().min(0).default(24),
  }),
  Component: ({ params: p, frame, env, box }) => {
    const url = useAssetUrl();
    const t = prog(frame, p.startFrame, p.startFrame + p.frames, EASE.inOut);
    const pos = 1 - (1 - p.to) * t;
    const c = resolveColor(env.palette, p.color, "accent");
    const label = (txt: string, left: boolean): React.ReactNode =>
      txt ? (
        <div style={{ position: "absolute", top: box.h * 0.04, [left ? "left" : "right"]: box.w * 0.03, padding: "0.3em 0.7em", borderRadius: 999, background: "rgba(0,0,0,0.6)", color: "#fff", fontFamily: `"${env.typography.body.family}"`, fontWeight: 700, fontSize: Math.max(18, box.h * 0.04) }}>{txt}</div>
      ) : null;
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: p.radius }}>
        <Img src={url(p.before)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${(pos * 100).toFixed(2)}%)` }}>
          <Img src={url(p.after)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${(pos * 100).toFixed(2)}% - 3px)`, width: 6, background: c, boxShadow: `0 0 20px ${c}` }} />
        <div style={{ position: "absolute", top: "50%", left: `${(pos * 100).toFixed(2)}%`, width: 54, height: 54, marginLeft: -27, marginTop: -27, borderRadius: "50%", background: c, boxShadow: "0 6px 20px rgba(0,0,0,0.4)" }} />
        {label(p.beforeLabel, true)}
        {label(p.afterLabel, false)}
      </div>
    );
  },
  example: { params: { before: "$screenshot", after: "$photo", beforeLabel: "Înainte", afterLabel: "După" }, durationInFrames: 50, box: "center", needs: ["screenshot", "photo"] },
});

export const mediaStack3d = defineLayer({
  ...base,
  id: "media.stack-3d",
  category: "3d",
  title: "Stivă de ecrane în adâncime",
  description: "Mai multe capturi așezate în spațiu 3D (CSS 3D real), prin care camera trece în timp.",
  tags: ["3d", "stack", "depth", "screens", "layers", "fly-through"],
  compatibleMedia: ["screenshot", "image"],
  performance: "medium",
  sfx: [{ sound: "whoosh-long", at: "start", gainDb: -8 }],
  params: z.object({
    srcs: z.array(z.string()).min(1),
    spacing: z.number().min(50).max(2000).default(420),
    travel: z.number().min(0).max(1).default(0.75),
    rotateY: z.number().default(-18),
    rotateX: z.number().default(8),
    radius: z.number().default(18),
  }),
  Component: ({ params: p, frame, duration, box }) => {
    const url = useAssetUrl();
    const t = prog(frame, 0, duration, EASE.inOut);
    const z0 = t * p.travel * p.spacing * (p.srcs.length - 1);
    const cw = box.w * 0.56;
    const ch = cw * 0.62;
    return (
      <div style={{ position: "absolute", inset: 0, perspective: 1400, perspectiveOrigin: "50% 45%" }}>
        <div style={{ position: "absolute", left: box.w / 2, top: box.h / 2, transformStyle: "preserve-3d", transform: `rotateX(${p.rotateX}deg) rotateY(${p.rotateY}deg) translateZ(${z0.toFixed(2)}px)` }}>
          {p.srcs.map((src, i) => (
            <div key={i} style={{ position: "absolute", left: -cw / 2 + i * cw * 0.12, top: -ch / 2 - i * ch * 0.06, width: cw, height: ch, transform: `translateZ(${-i * p.spacing}px)`, borderRadius: p.radius, overflow: "hidden", boxShadow: "0 40px 80px rgba(0,0,0,0.45)" }}>
              <Img src={url(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
            </div>
          ))}
        </div>
      </div>
    );
  },
  example: { params: { srcs: ["$screenshot", "$photo", "$screenshot"] }, durationInFrames: 60, box: "full", needs: ["screenshot", "photo"] },
});

export const mediaDevice3d = defineLayer({
  ...base,
  id: "media.device-3d",
  category: "3d",
  title: "Dispozitiv 3D cu captura reală",
  description: "Un telefon sau laptop generic care se rotește și plutește în 3D (CSS 3D cu perspectivă), cu captura reală pe ecran.",
  tags: ["3d", "device", "phone", "laptop", "rotate", "float", "hero", "product"],
  compatibleMedia: ["screenshot"],
  performance: "medium",
  sfx: [{ sound: "whoosh-soft", at: "start", gainDb: -8 }],
  params: z.object({
    src: z.string(),
    imageWidth: z.number().positive(),
    imageHeight: z.number().positive(),
    device: z.enum(["phone", "laptop"]).default("phone"),
    fromY: z.number().default(-35),
    toY: z.number().default(-12),
    fromX: z.number().default(12),
    toX: z.number().default(4),
    float: z.number().min(0).max(60).default(12),
    enter: z.boolean().default(true),
  }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const url = useAssetUrl();
    const t = prog(frame, 0, duration, EASE.out);
    const s = p.enter ? sp(frame, env.fps, 0, SPRINGS.soft) : 1;
    const ry = p.fromY + (p.toY - p.fromY) * t;
    const rx = p.fromX + (p.toX - p.fromX) * t;
    const bob = Math.sin((frame / env.fps) * 1.6) * p.float;
    const aspect = p.device === "phone" ? Math.min(p.imageWidth / p.imageHeight, 0.5) : 16 / 10;
    const geo = frameGeometry(p.device as FrameKind, box, aspect);
    const k = geo.screen.w / p.imageWidth;
    return (
      <div style={{ position: "absolute", inset: 0, perspective: 2000 }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `translateY(${(bob + (1 - s) * 200).toFixed(2)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) scale(${(0.9 + 0.1 * s).toFixed(4)})`, opacity: clamp(s * 2, 0, 1) }}>
          <DeviceFrame kind={p.device as FrameKind} box={box} geo={geo}>
            <Img src={url(p.src)} style={{ position: "absolute", left: 0, top: 0, width: p.imageWidth * k, height: p.imageHeight * k }} />
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${115 + ry}deg, rgba(255,255,255,0.18), transparent 40%)` }} />
          </DeviceFrame>
        </div>
      </div>
    );
  },
  example: { params: { src: "$screenshot", imageWidth: "$screenshot.w", imageHeight: "$screenshot.h", device: "laptop" }, durationInFrames: 60, box: "center", needs: ["screenshot"] },
});

export const mediaCards = defineLayer({
  ...base,
  id: "media.cards",
  category: "ui",
  title: "Cascadă de carduri",
  description: "Mai multe imagini (capturi, decupaje) intră ca un evantai de carduri, pe rând, cu sunet pe fiecare.",
  tags: ["cards", "cascade", "stack", "gallery", "features", "montage"],
  compatibleMedia: ["screenshot", "image"],
  performance: "light",
  sfx: [{ sound: "pop", at: "each", gainDb: -8 }],
  params: z.object({ srcs: z.array(z.string()).min(1), stagger: z.number().int().min(1).max(30).default(6), spread: z.number().min(0).max(30).default(8), radius: z.number().default(20) }),
  events: (p) => p.srcs.map((_, i) => ({ at: i * p.stagger })),
  Component: ({ params: p, frame, box, env }) => {
    const url = useAssetUrl();
    const n = p.srcs.length;
    const cw = box.w * 0.62;
    const ch = box.h * 0.62;
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {p.srcs.map((src, i) => {
          const s = sp(frame, env.fps, i * p.stagger, SPRINGS.ui);
          const off = i - (n - 1) / 2;
          return (
            <div key={i} style={{ position: "absolute", left: box.w / 2 - cw / 2 + off * box.w * 0.08, top: box.h / 2 - ch / 2 + off * box.h * 0.03, width: cw, height: ch, borderRadius: p.radius, overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.4)", transform: `translateY(${((1 - s) * box.h * 0.6).toFixed(1)}px) rotate(${(off * p.spread * s).toFixed(2)}deg)`, opacity: clamp(s * 3, 0, 1) }}>
              <Img src={url(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
            </div>
          );
        })}
      </div>
    );
  },
  example: { params: { srcs: ["$screenshot", "$photo", "$screenshot"] }, durationInFrames: 50, box: "center", needs: ["screenshot", "photo"] },
});

export const MEDIA = [mediaScreen, mediaImage, mediaVideo, mediaCompare, mediaStack3d, mediaDevice3d, mediaCards];

export { withAlpha };
