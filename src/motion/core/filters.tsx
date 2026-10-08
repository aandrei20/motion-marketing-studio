import React from "react";

/** Id sigur pentru filtre SVG (doar litere, cifre, cratimă). */
export const filterId = (...parts: Array<string | number>): string => parts.join("-").replace(/[^a-zA-Z0-9-]/g, "_");

/**
 * Blur direcțional (x, y separate) prin filtru SVG. CSS `blur()` e doar izotrop; pentru motion blur
 * pe o direcție folosim feGaussianBlur cu stdDeviation pe două axe.
 */
export function DirBlurDefs({ id, x, y }: { id: string; x: number; y: number }) {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id={id} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation={`${x.toFixed(2)} ${y.toFixed(2)}`} />
        </filter>
      </defs>
    </svg>
  );
}

/** Pixelare (mozaic): eșantionează un punct pe celulă și îl dilată pe toată celula. */
export function PixelateDefs({ id, size }: { id: string; size: number }) {
  const s = Math.max(2, Math.round(size));
  const half = Math.floor(s / 2);
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%">
          <feFlood x={half} y={half} width="1" height="1" />
          <feComposite width={s} height={s} />
          <feTile result="grid" />
          <feComposite in="SourceGraphic" in2="grid" operator="in" />
          <feMorphology operator="dilate" radius={half} />
        </filter>
      </defs>
    </svg>
  );
}

/** Duotone: luminanța imaginii mapată între două culori. */
export function DuotoneDefs({ id, dark, light }: { id: string; dark: [number, number, number]; light: [number, number, number] }) {
  const t = (i: number) => `${(dark[i] / 255).toFixed(3)} ${(light[i] / 255).toFixed(3)}`;
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues={t(0)} />
            <feFuncG type="table" tableValues={t(1)} />
            <feFuncB type="table" tableValues={t(2)} />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
