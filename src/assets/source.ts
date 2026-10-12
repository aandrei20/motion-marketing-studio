/**
 * Sursa unui material capturat: site-ul de pe care vine. Capturile aceluiași site (desktop, telefon, pagină
 * întreagă, logo-ul găsit în pagină) sunt o singură întrebare de drepturi (regula 3: întrebi o singură dată).
 */
import type { Asset, AssetManifest } from "../core/schema";

const hostOf = (url: string): string | null => {
  try {
    const u = new URL(url);
    return u.protocol === "file:" ? "fișier local" : u.host || null;
  } catch {
    return null;
  }
};

/** Site-ul unei capturi reale (și al logo-ului găsit în ea), sau null pentru materialele care nu vin din captură. */
export function captureSource(manifest: AssetManifest, a: Asset): string | null {
  if (a.origin !== "real_capture") return null;
  if (a.capture?.url) return hostOf(a.capture.url);
  // logo-ul din pagină are eticheta capturii din care vine
  const parent = manifest.assets.find((x) => x.capture?.url && x.tags.some((t) => t !== "logo" && a.tags.includes(t)));
  return parent ? hostOf(parent.capture!.url) : null;
}
