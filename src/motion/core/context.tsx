import React, { createContext, useContext } from "react";
import { staticFile } from "remotion";
import type { BeatGrid, Palette, Timeline, TypographySet } from "../../core/schema";

export interface MotionEnv {
  fps: number;
  width: number;
  height: number;
  seed: number;
  palette: Palette;
  typography: TypographySet;
  safeZone: Timeline["safeZone"];
  beatGrid: BeatGrid | null;
  /** „draft” reduce efectele scumpe (particule, filtre) pentru previzualizare rapidă */
  quality: "draft" | "full";
}

export const MotionEnvContext = createContext<MotionEnv | null>(null);

export function useEnv(): MotionEnv {
  const env = useContext(MotionEnvContext);
  if (!env) throw new Error("Componenta de mișcare trebuie să fie în interiorul unui timeline (MotionEnvContext).");
  return env;
}

/**
 * Baza URL pentru fișiere. `null` = Remotion (staticFile din folderul public).
 * În Studio-ul nostru (Player), serverul local servește fișierele la /files/.
 */
export const AssetBaseContext = createContext<string | null>(null);

export function useAssetUrl(): (p: string) => string {
  const base = useContext(AssetBaseContext);
  return (p: string) => {
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    if (base !== null) return `${base}/${p.split("/").map(encodeURIComponent).join("/")}`;
    return staticFile(p);
  };
}

export const PALETTE_KEYS = ["primary", "secondary", "accent", "background", "surface", "text", "textMuted"] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

/** Rezolvă o culoare: cheie din paletă („primary”) sau valoare CSS directă. */
export function resolveColor(palette: Palette, ref: string | undefined, fallback: PaletteKey = "text"): string {
  if (!ref) return palette[fallback];
  if ((PALETTE_KEYS as readonly string[]).includes(ref)) return palette[ref as PaletteKey];
  return ref;
}

export function useColor(): (ref: string | undefined, fallback?: PaletteKey) => string {
  const { palette } = useEnv();
  return (ref, fallback = "text") => resolveColor(palette, ref, fallback);
}

/**
 * Scara dintre spațiul de coordonate al copiilor (de ex. pixelii capturii) și pixelii compoziției.
 * Straturile de interfață o folosesc ca grosimile de linie și textul să rămână lizibile la orice zoom.
 */
export const OverlayScaleContext = createContext<number>(1);
export const useOverlayScale = (): number => useContext(OverlayScaleContext);

export const SceneIdContext = createContext<string>("scene");
export const useSceneId = (): string => useContext(SceneIdContext);

export function MotionEnvProvider({ env, children }: { env: MotionEnv; children: React.ReactNode }) {
  return <MotionEnvContext.Provider value={env}>{children}</MotionEnvContext.Provider>;
}
