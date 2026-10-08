import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Timeline, TimelineLayer } from "../../src/core/schema";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mms-store-"));
process.env.MMS_PROJECTS_DIR = tmp;

let store: typeof import("../../src/projects/store");
let formats: typeof import("../../src/core/formats");
let validate: typeof import("../../src/timeline/validate");
let rig: typeof import("../../src/motion/camera/rig");
let presets: typeof import("../../src/motion/camera/presets");

beforeAll(async () => {
  store = await import("../../src/projects/store");
  formats = await import("../../src/core/formats");
  validate = await import("../../src/timeline/validate");
  rig = await import("../../src/motion/camera/rig");
  presets = await import("../../src/motion/camera/presets");
});

describe("versiuni imuabile", () => {
  it("creează proiectul, versiunile și îngheață părintele", () => {
    store.createProject({ id: "t1", name: "Test", product: { name: "Produs X", category: "saas" }, formats: [formats.makeFormat("9x16", { platform: "tiktok", durationSec: 20 })], language: { text: "ro", voice: null } });
    expect(fs.existsSync(path.join(tmp, "t1", "STATE.md"))).toBe(true);
    const v1 = store.createVersion("t1");
    expect(v1.id).toBe("v1");
    store.saveScript("t1", "v1", { schemaVersion: 1, textLanguage: "ro", voiceLanguage: null, lines: [{ id: "a", origin: "ai", voiceover: "x" }] });
    const v2 = store.createVersion("t1", { label: "a doua" });
    expect(v2.parent).toBe("v1");
    expect(store.loadVersionMeta("t1", "v1").frozen).toBe(true);
    expect(() => store.saveScript("t1", "v1", { schemaVersion: 1, textLanguage: "ro", voiceLanguage: null, lines: [{ id: "b", origin: "ai" }] })).toThrow(/înghețată/);
    // conținutul a fost copiat, iar v1 a rămas neatinsă
    expect(store.loadScript("t1", "v2").lines[0].id).toBe("a");
    expect(store.loadScript("t1", "v1").lines[0].id).toBe("a");
    expect(store.writableVersion("t1")).toBe("v2");
    store.freezeVersion("t1", "v2", "preview");
    expect(store.writableVersion("t1")).toBe("v3");
  });
  it("aprobarea cere fraza exactă", async () => {
    const steps = await import("../../src/pipeline/steps");
    expect(() => steps.approve("t1", "brief", "ok")).toThrow(/aprob/);
    steps.approve("t1", "brief", "aprob");
    expect(store.loadProject("t1").status).toBe("brief-approved");
    expect(() => steps.approve("t1", "render-final", "da")).toThrow(/render final/);
  });
});

function layer(p: Partial<TimelineLayer> & Pick<TimelineLayer, "capability">): TimelineLayer {
  return { id: `l-${Math.random().toString(36).slice(2)}`, from: 0, durationInFrames: 60, z: 1, box: { x: 200, y: 400, w: 600, h: 200 }, params: {}, depth: 0, role: "hero", modifiers: [], assets: [], children: [], ...p };
}

function timeline(scenes: Timeline["scenes"]): Timeline {
  const last = scenes[scenes.length - 1];
  return {
    schemaVersion: 1,
    projectId: "t1",
    versionId: "v1",
    formatId: "9x16",
    seed: 1,
    fps: 30,
    width: 1080,
    height: 1920,
    durationInFrames: last.from + last.durationInFrames,
    safeZone: { top: 240, right: 120, bottom: 660, left: 120 },
    fonts: [],
    palette: { primary: "#6c5cff", secondary: "#333333", accent: "#2de2b0", background: "#0e0f1a", surface: "#171a2b", text: "#eef0ff", textMuted: "#9aa0c3" },
    typography: { display: { family: "Inter", weight: 700, tracking: 0, uppercase: false }, body: { family: "Inter", weight: 500, tracking: 0, uppercase: false }, mono: { family: "Inter", weight: 500, tracking: 0, uppercase: false } },
    scenes,
    overlays: [],
    captions: null,
    audio: { src: null, cues: [], beatGrid: null },
    markers: [],
    concept: false,
  };
}

const cam = { keys: [{ at: 0, x: 540, y: 960, zoom: 1, rotate: 0, rotateX: 0, rotateY: 0, ease: "inOut" as const }], handheld: 0, shake: [], punches: [], perspective: 1600, motionBlur: true };
const meta = (role = "feature") => ({ purpose: "p", narrativeRole: role, recipe: "r", shot: "hero", energy: 0.5 });

describe("validatorul de timeline", () => {
  const ctx = () => ({ assets: { schemaVersion: 1 as const, assets: [] }, research: { schemaVersion: 1 as const, productSummary: "", sources: [], claims: [], openQuestions: [] }, format: formats.makeFormat("9x16", { platform: "tiktok", durationSec: 10 }) });
  it("prinde golurile (cadre goale), flash-urile prea dese, cifrele fără sursă, textul ieșit din zona sigură", () => {
    const t = timeline([
      { id: "a", from: 0, durationInFrames: 30, transitionIn: null, camera: cam, layers: [layer({ capability: "text.word-reveal", params: { text: "Salut", fontSize: 120 }, box: { x: 200, y: 1500, w: 600, h: 200 } })], meta: meta() },
      { id: "b", from: 40, durationInFrames: 16, transitionIn: { capability: "tr.flash", durationInFrames: 4, params: {} }, camera: cam, layers: [layer({ capability: "text.counter", params: { value: 99 }, durationInFrames: 16 })], meta: meta() },
      { id: "c", from: 52, durationInFrames: 12, transitionIn: { capability: "tr.flash", durationInFrames: 4, params: {} }, camera: cam, layers: [], meta: meta() },
      { id: "d", from: 60, durationInFrames: 90, transitionIn: { capability: "tr.flash", durationInFrames: 4, params: {} }, camera: cam, layers: [], meta: meta("cta") },
    ]);
    const r = validate.validateTimeline(t, ctx());
    const dims = r.findings.map((f) => f.dimension);
    expect(dims).toContain("black-frame");
    expect(dims).toContain("flash");
    expect(dims).toContain("claims");
    expect(dims).toContain("safe-zone");
    expect(r.ok).toBe(false);
  });
  it("interfața produsului trebuie să vină din captură reală sau de la utilizator", () => {
    const asset = { id: "screenshot-1", file: "assets/screenshot-1.png", originalName: "x.png", sha256: "x", bytes: 1, mime: "image/png", type: "image" as const, origin: "generated" as const, role: "screenshot" as const, roleSource: "user" as const, roleConfidence: 1, showsProductUI: true, rights: { thirdParty: false, status: "owned" as const, note: "" }, media: {}, analysis: { palette: [], nearDuplicates: [] }, pii: { regions: [], blurApproved: false }, tags: [], notes: "", addedAt: "2026" };
    const t = timeline([{ id: "a", from: 0, durationInFrames: 90, transitionIn: null, camera: cam, layers: [layer({ capability: "media.screen", depth: 1, assets: ["projects/t1/assets/screenshot-1.png"], params: { src: "projects/t1/assets/screenshot-1.png", imageWidth: 100, imageHeight: 100 } })], meta: meta("cta") }]);
    const r = validate.validateTimeline(t, { ...ctx(), assets: { schemaVersion: 1, assets: [asset] } });
    expect(r.findings.some((f) => f.dimension === "real-footage" && f.severity === "blocker")).toBe(true);
  });
});

describe("camera", () => {
  it("adâncimea 0 nu se mișcă; adâncimea 1 urmează camera", () => {
    const s = rig.sampleCamera({ ...cam, keys: [{ ...cam.keys[0] }, { ...cam.keys[0], at: 30, x: 700, zoom: 2 }] }, 30, 30, "x");
    expect(rig.layerTransform(s, 0, 1080, 1920, 1600)).toBe("none");
    expect(rig.layerTransform(s, 1, 1080, 1920, 1600)).toContain("scale(2.0");
  });
  it("push-ul aduce punctul de interes în ținta de pe ecran", () => {
    const c = { duration: 60, width: 1920, height: 1080, focus: { x: 1500, y: 300 }, focusZoom: 2, energy: 0.5, target: { x: 1300, y: 540 } };
    const b = presets.cameraPush.build(presets.cameraPush.params.parse({ from: 1, to: 2 }) as never, c);
    const s = rig.sampleCamera({ ...cam, keys: b.keys }, 60, 30, "x");
    // poziția pe ecran a punctului F: C + z·(F − centruCamerei)
    const sx = 960 + s.zoom * (1500 - s.fx);
    const sy = 540 + s.zoom * (300 - s.fy);
    expect(sx).toBeCloseTo(1300, 3);
    expect(sy).toBeCloseTo(540, 3);
  });
  it("blur-ul de mișcare e zero pe cameră fixă", () => {
    expect(rig.cameraMotionBlur(cam, 10, 30, "x")).toEqual([0, 0]);
  });
});
