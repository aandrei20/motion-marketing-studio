import React, { useMemo } from "react";
import { z } from "zod";
import type { Rect } from "../../core/schema";
import type { MotionEnv } from "../core/context";
import { resolveColor } from "../core/context";
import { EASE, prog } from "../core/easing";
import { browserMeasure, layoutText, type FontSpec } from "../core/text-layout";

export const TextBase = z.object({
  text: z.string().min(1),
  font: z.enum(["display", "body", "mono"]).default("display"),
  color: z.string().default("text"),
  emphasis: z.array(z.string()).default([]),
  emphasisColor: z.string().default("accent"),
  align: z.enum(["left", "center", "right"]).default("left"),
  vAlign: z.enum(["top", "middle", "bottom"]).default("middle"),
  maxSize: z.number().min(8).max(800).default(140),
  minSize: z.number().min(8).max(400).default(30),
  lineHeight: z.number().min(0.8).max(2).default(1.04),
  maxLines: z.number().int().min(1).max(12).optional(),
  weight: z.number().int().min(100).max(1000).optional(),
  uppercase: z.boolean().optional(),
  tracking: z.number().min(-0.1).max(0.5).optional(),
  /** ieșirea la finalul stratului: snap (rapid) sau none (rămâne, de ex. pe CTA) */
  exit: z.enum(["snap", "none"]).default("snap"),
  exitFrames: z.number().int().min(1).max(20).default(5),
  shadow: z.boolean().default(false),
  /** calculate de compilator (fontkit), ca validarea și randarea să folosească aceleași rânduri */
  lines: z.array(z.string()).optional(),
  fontSize: z.number().optional(),
});
export type TextBaseParams = z.infer<typeof TextBase>;

export function fontSpecFor(env: MotionEnv, p: Pick<TextBaseParams, "font" | "weight" | "uppercase" | "tracking">): FontSpec {
  const t = env.typography[p.font];
  return {
    family: t.family,
    weight: p.weight ?? t.weight,
    tracking: p.tracking ?? t.tracking,
    uppercase: p.uppercase ?? t.uppercase,
  };
}

export interface ComputedText {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  font: FontSpec;
}

export function useTextLayout(p: TextBaseParams, box: Rect, env: MotionEnv): ComputedText {
  const font = fontSpecFor(env, p);
  return useMemo(() => {
    if (p.lines && p.fontSize) return { lines: p.lines, fontSize: p.fontSize, lineHeight: p.lineHeight, font };
    const l = layoutText(p.text, font, { w: box.w, h: box.h }, browserMeasure, {
      maxSize: p.maxSize,
      minSize: p.minSize,
      lineHeight: p.lineHeight,
      maxLines: p.maxLines,
    });
    return { lines: l.lines, fontSize: l.fontSize, lineHeight: p.lineHeight, font };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.text, p.lines, p.fontSize, box.w, box.h, font.family, font.weight, font.tracking, font.uppercase, p.maxSize, p.minSize, p.lineHeight, p.maxLines]);
}

const norm = (w: string) => w.toLocaleLowerCase("ro").replace(/[^\p{L}\p{N}%$€+]/gu, "");

/** Indicii cuvintelor (în lista aplatizată) acoperite de expresiile de accent. */
export function emphasisIndices(words: string[], emphasis: string[]): Set<number> {
  const out = new Set<number>();
  const n = words.map(norm);
  for (const phrase of emphasis) {
    const parts = phrase.split(/\s+/).map(norm).filter(Boolean);
    if (!parts.length) continue;
    for (let i = 0; i + parts.length <= n.length; i++) {
      if (parts.every((p, k) => n[i + k] === p)) for (let k = 0; k < parts.length; k++) out.add(i + k);
    }
  }
  return out;
}

export interface WordSlot {
  text: string;
  line: number;
  index: number;
  emphasized: boolean;
}

export function wordSlots(lines: string[], emphasis: string[]): WordSlot[] {
  const words: WordSlot[] = [];
  lines.forEach((l, li) => l.split(/\s+/).filter(Boolean).forEach((w) => words.push({ text: w, line: li, index: words.length, emphasized: false })));
  const em = emphasisIndices(
    words.map((w) => w.text),
    emphasis,
  );
  for (const w of words) w.emphasized = em.has(w.index);
  return words;
}

export function exitState(p: TextBaseParams, frame: number, duration: number): number {
  if (p.exit === "none") return 0;
  return prog(frame, duration - p.exitFrames, duration, EASE.snap);
}

const JUSTIFY = { top: "flex-start", middle: "center", bottom: "flex-end" } as const;
const ALIGN = { left: "flex-start", center: "center", right: "flex-end" } as const;

/**
 * Desenează textul pe rânduri; `wordStyle` dă stilul fiecărui cuvânt (animația).
 * `wrapLine` permite măști pe rând (mask reveal).
 */
export function TextFrame({
  p,
  t,
  env,
  wordStyle,
  renderWord,
  lineStyle,
  containerStyle,
}: {
  p: TextBaseParams;
  t: ComputedText;
  env: MotionEnv;
  wordStyle?: (w: WordSlot, total: number) => React.CSSProperties;
  renderWord?: (w: WordSlot, total: number, color: string) => React.ReactNode;
  lineStyle?: (line: number, totalLines: number) => React.CSSProperties;
  containerStyle?: React.CSSProperties;
}) {
  const words = wordSlots(t.lines, p.emphasis);
  const color = resolveColor(env.palette, p.color, "text");
  const emColor = resolveColor(env.palette, p.emphasisColor, "accent");
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: JUSTIFY[p.vAlign],
        alignItems: ALIGN[p.align],
        textAlign: p.align,
        fontFamily: `"${t.font.family}"`,
        fontWeight: t.font.weight,
        fontSize: t.fontSize,
        lineHeight: t.lineHeight,
        letterSpacing: `${t.font.tracking}em`,
        color,
        textShadow: p.shadow ? "0 6px 30px rgba(0,0,0,0.45)" : undefined,
        ...containerStyle,
      }}
    >
      {t.lines.map((_, li) => (
        <div key={li} style={{ whiteSpace: "pre", position: "relative", ...(lineStyle ? lineStyle(li, t.lines.length) : {}) }}>
          {words
            .filter((w) => w.line === li)
            .map((w, k, arr) => (
              <React.Fragment key={w.index}>
                {renderWord ? (
                  renderWord(w, words.length, w.emphasized ? emColor : color)
                ) : (
                  <span style={{ display: "inline-block", color: w.emphasized ? emColor : color, ...(wordStyle ? wordStyle(w, words.length) : {}) }}>{w.text}</span>
                )}
                {k < arr.length - 1 ? " " : null}
              </React.Fragment>
            ))}
        </div>
      ))}
    </div>
  );
}

export const textExample = (text: string, extra: Record<string, unknown> = {}) => ({
  params: { text, emphasis: [], ...extra },
  durationInFrames: 60,
  box: { x: 160, y: 300, w: 1600, h: 480 },
});
