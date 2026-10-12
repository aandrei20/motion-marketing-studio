/**
 * Captura de telefon a aceleiași pagini pe formatele verticale: alegerea ei, zona echivalentă și cazurile în
 * care rămâne captura desktop (drepturi refuzate, date personale fără decizie, altă pagină).
 */
import { describe, expect, it } from "vitest";
import { chooseCounterpart, counterpartRegion, mobileCounterparts, samePageKey } from "../../src/assets/counterpart";
import { Asset, AssetManifest, type AssetInput, type Region } from "../../src/core/schema";

const region = (id: string, text: string, kind: Region["kind"] = "heading"): Region => ({ id, label: text, kind, text, rect: { x: 0, y: 0, w: 100, h: 40 } });

function shot(
  id: string,
  o: {
    url?: string;
    width?: number;
    fullPage?: boolean;
    regions?: Region[];
    rights?: AssetInput["rights"];
    pii?: AssetInput["pii"];
    role?: AssetInput["role"];
  } = {},
) {
  return Asset.parse({
    id,
    file: `assets/${id}.png`,
    originalName: `${id}.png`,
    sha256: id,
    bytes: 1,
    mime: "image/png",
    type: "image",
    origin: "real_capture",
    role: o.role ?? "screenshot",
    roleSource: "inferred",
    roleConfidence: 1,
    showsProductUI: true,
    rights: o.rights ?? { thirdParty: false, status: "owned" },
    media: { width: 1000, height: 1000 },
    capture: {
      url: o.url ?? "https://exemplu.ro/",
      viewport: { width: o.width ?? 1440, height: 900 },
      deviceScaleFactor: 2,
      capturedAt: "2026-10-12T10:00:00Z",
      fullPage: o.fullPage ?? false,
      regions: o.regions ?? [],
    },
    pii: o.pii,
    addedAt: "2026-10-12T10:00:00Z",
  });
}

describe("aceeași pagină", () => {
  it("ignoră fragmentul și bara finală, nu și calea sau parametrii", () => {
    expect(samePageKey("https://exemplu.ro/#preturi")).toBe(samePageKey("https://exemplu.ro"));
    expect(samePageKey("https://exemplu.ro/app/")).toBe(samePageKey("https://exemplu.ro/app"));
    expect(samePageKey("https://exemplu.ro/app")).not.toBe(samePageKey("https://exemplu.ro/blog"));
    expect(samePageKey("https://exemplu.ro/?a=1")).not.toBe(samePageKey("https://exemplu.ro/?a=2"));
  });
});

describe("captura de telefon pentru vertical", () => {
  const desktop = shot("landing", { regions: [region("heading-simplu", "Simplu și rapid"), region("heading-tabla", "Tabla echipei")] });
  const desktopFull = shot("landing-full", { fullPage: true });
  const phone = shot("landing-mobile", { width: 390, regions: [region("heading-simplu", "Simplu și rapid")] });
  const phoneFull = shot("landing-full-mobile", {
    width: 390,
    fullPage: true,
    regions: [region("heading-simplu", "Simplu și rapid"), region("heading-tabla", "Tabla echipei")],
  });
  const first = (m: ReturnType<typeof AssetManifest.parse>, a: typeof desktop) => mobileCounterparts(m, a)?.usable[0]?.id ?? null;

  it("alege captura de telefon a aceleiași pagini, de același tip (ecran / pagină întreagă)", () => {
    const m = AssetManifest.parse({ schemaVersion: 1, assets: [desktop, desktopFull, phone, phoneFull] });
    expect(first(m, desktop)).toBe("landing-mobile");
    expect(first(m, desktopFull)).toBe("landing-full-mobile");
    // o captură care e deja de telefon nu se înlocuiește
    expect(mobileCounterparts(m, phone)).toBeNull();
  });

  it("fără captură de telefon a aceleiași pagini rămâne captura desktop", () => {
    const other = shot("blog-mobile", { width: 390, url: "https://exemplu.ro/blog" });
    expect(mobileCounterparts(AssetManifest.parse({ schemaVersion: 1, assets: [desktop, other] }), desktop)).toBeNull();
  });

  it("zona demonstrată decide: captura de telefon trebuie s-o arate", () => {
    const m = AssetManifest.parse({ schemaVersion: 1, assets: [desktop, phone, phoneFull] });
    // zona e pe ecranul de telefon: se alege captura de același tip
    expect(chooseCounterpart(m, desktop, [desktop.capture!.regions[0]]).asset?.id).toBe("landing-mobile");
    // zona e mai jos pe pagină: doar captura întreagă o are
    expect(chooseCounterpart(m, desktop, [desktop.capture!.regions[1]]).asset?.id).toBe("landing-full-mobile");
    // drag & drop: ambele zone trebuie să fie în aceeași captură de telefon
    expect(chooseCounterpart(m, desktop, desktop.capture!.regions).asset?.id).toBe("landing-full-mobile");
    // fără nicio captură care s-o arate rămâne desktopul, cu explicația în raport
    const onlyPhone = AssetManifest.parse({ schemaVersion: 1, assets: [desktop, phone] });
    const c = chooseCounterpart(onlyPhone, desktop, desktop.capture!.regions[1] ? [desktop.capture!.regions[1]] : []);
    expect(c.asset).toBeNull();
    expect(c.note).toMatch(/nu apar toate în aceeași captură de telefon/);
  });

  it("nu alege o captură cu drepturi refuzate, una neadaptată pentru telefon sau una cu date personale fără decizie", () => {
    const denied = shot("landing-mobile", { width: 390, rights: { thirdParty: true, status: "denied" } });
    expect(mobileCounterparts(AssetManifest.parse({ schemaVersion: 1, assets: [desktop, denied] }), desktop)).toBeNull();
    const undecided = shot("landing-mobile", {
      width: 390,
      pii: { regions: [region("pii-email", "ana@exemplu.ro", "pii")], blurApproved: false, keepApproved: false },
    });
    const c = chooseCounterpart(AssetManifest.parse({ schemaVersion: 1, assets: [desktop, undecided] }), desktop, []);
    expect(c.asset).toBeNull();
    expect(c.note).toMatch(/date personale/);
    const wide = Asset.parse({ ...shot("landing-mobile", { width: 390 }), capture: { ...shot("x", { width: 390 }).capture!, overflowX: true } });
    expect(chooseCounterpart(AssetManifest.parse({ schemaVersion: 1, assets: [desktop, wide] }), desktop, []).note).toMatch(/nu e adaptată/);
    const decided = shot("landing-mobile", {
      width: 390,
      pii: { regions: [region("pii-email", "ana@exemplu.ro", "pii")], blurApproved: true, keepApproved: false },
    });
    expect(first(AssetManifest.parse({ schemaVersion: 1, assets: [desktop, decided] }), desktop)).toBe("landing-mobile");
  });

  it("zona țintită se regăsește pe telefon după id sau după text și tip", () => {
    const byId = shot("m1", { width: 390, regions: [region("heading-simplu", "Simplu și rapid")] });
    expect(counterpartRegion(desktop.capture!.regions[0], byId)?.id).toBe("heading-simplu");
    const byText = shot("m2", { width: 390, regions: [region("heading-simplu-2", "SIMPLU și  rapid")] });
    expect(counterpartRegion(desktop.capture!.regions[0], byText)?.id).toBe("heading-simplu-2");
    const none = shot("m3", { width: 390, regions: [region("button-start", "Simplu și rapid", "button")] });
    expect(counterpartRegion(desktop.capture!.regions[0], none)).toBeNull();
  });
});
