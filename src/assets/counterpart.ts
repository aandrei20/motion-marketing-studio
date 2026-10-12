/**
 * Captura mobilă a aceleiași pagini, pentru formatele verticale. O captură desktop pe 9:16 rămâne mică
 * (interfața ~4 px la testul de 360 px); aceeași pagină pe viewport de telefon e lizibilă și umple cadrul.
 * Doar pixeli reali: se alege o altă captură reală a aceleiași adrese, nimic nu se redesenează (regula 1).
 */
import type { Asset, AssetManifest, Region } from "../core/schema";

/** Lățimea CSS sub care o captură e de telefon (aceeași limită ca rama „phone”). */
export const PHONE_MAX_CSS_WIDTH = 600;

/** Adresa normalizată: fără fragment și fără bara finală, ca „/” și „” să fie aceeași pagină. */
export function samePageKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return url;
  }
}

const isPhoneCapture = (a: Asset): boolean => !!a.capture && a.capture.viewport.width < PHONE_MAX_CSS_WIDTH;
const piiUndecided = (a: Asset): boolean => a.pii.regions.length > 0 && !a.pii.blurApproved && !a.pii.keepApproved;

export interface Counterparts {
  /** capturile de telefon utilizabile, în ordinea preferinței (același tip întâi, apoi cea mai nouă) */
  usable: Asset[];
  /** de ce nu s-a putut folosi o captură de telefon găsită (pentru raportul compilării) */
  skipped?: string;
}

/**
 * Capturile de telefon ale aceleiași pagini pentru o captură statică de desktop, sau null dacă nu există
 * niciuna. Preferă același tip (pagină întreagă / ecran). Nu se aleg: o captură cu drepturi refuzate, una a
 * unei pagini neadaptate pentru telefon (iese pe orizontală, interfața apare tăiată), una cu date personale
 * fără decizie (ar bloca validarea pe un format pe care utilizatorul nu l-a revăzut); ultimele două se raportează.
 */
export function mobileCounterparts(manifest: AssetManifest, a: Asset): Counterparts | null {
  if (!a.capture || a.role !== "screenshot" || isPhoneCapture(a)) return null;
  const key = samePageKey(a.capture.url);
  const candidates = manifest.assets
    .filter((x) => x.id !== a.id && x.role === "screenshot" && isPhoneCapture(x) && samePageKey(x.capture!.url) === key && x.rights.status !== "denied")
    .sort((x, y) => Number(y.capture!.fullPage === a.capture!.fullPage) - Number(x.capture!.fullPage === a.capture!.fullPage) || String(y.capture!.capturedAt).localeCompare(String(x.capture!.capturedAt)));
  if (!candidates.length) return null;
  const usable = candidates.filter((x) => !piiUndecided(x) && !x.capture!.overflowX);
  if (usable.length) return { usable };
  const first = candidates[0];
  return { usable, skipped: first.capture!.overflowX ? `pagina din captura de telefon „${first.id}” nu e adaptată pentru telefon (iese din ecran pe orizontală)` : `captura de telefon „${first.id}” are date personale fără decizie (estompează sau lasă vizibile)` };
}

/**
 * Captura de telefon pentru o scenă: dacă scena demonstrează zone anume (zona din focus, zonele din parametrii
 * rețetei, de ex. drag & drop), doar o captură în care toate se regăsesc; altfel scena ar arăta altă parte a
 * interfeței decât spune textul. Întoarce și nota pentru raport.
 */
export function chooseCounterpart(manifest: AssetManifest, a: Asset, regions: Region[]): { asset: Asset | null; note: string | null } {
  const c = mobileCounterparts(manifest, a);
  if (!c) return { asset: null, note: null };
  const pick = c.usable.find((x) => regions.every((r) => counterpartRegion(r, x)));
  if (pick) return { asset: pick, note: `pe vertical: captura de telefon „${pick.id}” în locul lui „${a.id}” (aceeași pagină, lizibilă pe telefon)` };
  if (c.usable.length) {
    const missing = regions.filter((r) => !c.usable.some((x) => counterpartRegion(r, x)));
    const names = (missing.length ? missing : regions).map((r) => `„${r.label.slice(0, 40)}”`).join(", ");
    return { asset: null, note: `pe vertical rămâne captura desktop „${a.id}”: zonele demonstrate (${names}) nu apar toate în aceeași captură de telefon; o captură de telefon a paginii întregi le-ar putea include` };
  }
  return { asset: null, note: c.skipped ? `pe vertical rămâne captura desktop „${a.id}”: ${c.skipped}` : null };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Zona echivalentă din captura mobilă: același id (id-urile vin din textul elementului) sau același text și
 * tip. Fără potrivire sigură întoarce null, iar rețeta alege zona după textul scenei.
 */
export function counterpartRegion(region: Region | null, target: Asset): Region | null {
  if (!region) return null;
  const regions = [...(target.capture?.regions ?? []), ...target.pii.regions];
  const byId = regions.find((r) => r.id === region.id);
  if (byId) return byId;
  const text = norm(`${region.text ?? region.label}`);
  if (!text) return null;
  return regions.find((r) => r.kind === region.kind && norm(`${r.text ?? r.label}`) === text) ?? null;
}
