/**
 * Tăieturile din interiorul unei scene (punch-in). Vocea dictează durata unei scene, așa că pe platformele cu
 * ritm rapid o demonstrație lungă rămâne un singur plan, mai lung decât planul tipic al platformei. Aici scena
 * primește o tăietură directă de la planul larg la prim-planul zonei demonstrate, pe începutul unui cuvânt
 * (sau pe o bătaie): ritmul crește fără să se schimbe textul, vocea sau povestea.
 *
 * Două forme, după cum e construită scena:
 *  - „decupaj”: când camera nu mărește (de regulă cardul decupat de pe vertical, limitat de titlu), captura
 *    continuă după tăietură în aceeași casetă, cu un decupaj mai strâns în jurul zonei. Straturile de peste
 *    captură (contur, spotlight, cursor) continuă din starea lor, fără să se redeseneze.
 *  - „cameră”: când rețeta are un focus cu zoom mare, primul plan e larg și aproape fix, iar al doilea e
 *    prim-planul pe care rețeta îl atingea la final (același zoom, aceeași țintă), deci aceeași geometrie
 *    față de titlu.
 * Pixelii rămân cei reali (regula 1): se alege doar ce parte a capturii se vede. O cameră aleasă explicit
 * (editor, corectură) și ritmul „slow” din brief opresc tăietura.
 */
import type { CameraKey, Rect, Region, TimelineLayer, TimelineScene } from "../core/schema";
import { clearCutEdges } from "../recipes/kit";

/** Rolurile în care se demonstrează ceva pe interfață. */
const DEMO_ROLES = new Set(["feature", "demo", "solution", "benefit"]);

export interface InnerCutInput {
  scene: TimelineScene;
  fps: number;
  width: number;
  height: number;
  /** durata tipică maximă a unui plan pe platformă (profilul platformei, `avgShotSec[1]`) */
  maxShotSec: number;
  /** începuturile cuvintelor vocii, în cadre relative la scenă */
  wordStarts: number[];
  /** bătăile muzicii, în cadre relative la scenă */
  beats: number[];
  /** focusul rețetei (punctul de interes, zoom-ul limitat de text, ținta pe ecran) */
  focus?: { x: number; y: number; zoom: number; target?: { x: number; y: number } };
  /** regiunile capturii din planul principal (pentru marginile decupajului) */
  regions: Region[];
  explicitCamera: boolean;
  pacing: string;
  /** banda subtitrărilor (cu margine), dacă reclama le arde: zona demonstrată din prim-plan rămâne deasupra ei */
  avoid?: Rect;
}

/** Cadrul tăieturii: începutul de cuvânt cel mai apropiat de mijloc, apoi o bătaie, apoi mijlocul. */
export function pickCutFrame(duration: number, fps: number, wordStarts: number[], beats: number[]): number | null {
  const lo = Math.max(Math.round(fps * 0.9), Math.round(duration * 0.35));
  const hi = Math.min(duration - Math.round(fps * 1.2), Math.round(duration * 0.7));
  if (hi <= lo) return null;
  const mid = duration / 2;
  const near = (xs: number[]) => xs.filter((f) => f >= lo && f <= hi).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
  return near(wordStarts) ?? near(beats) ?? Math.round(mid);
}

const isScreen = (l: TimelineLayer) => l.capability === "media.screen";

/** Zona demonstrată în pixelii capturii la momentul `local` (relativ la strat): conturul activ, apoi spotlight-ul. */
function regionAt(hero: TimelineLayer, local: number): Rect | null {
  const active = (c: TimelineLayer) => c.from <= local && local < c.from + c.durationInFrames;
  const hl = hero.children.filter((c) => c.capability === "ui.highlight");
  const h = hl.find(active) ?? hl[0];
  if (h) return h.box;
  const spot = hero.children.find((c) => c.capability === "ui.spotlight")?.params.region as Rect | undefined;
  return spot ?? null;
}

const key = (at: number, x: number, y: number, zoom: number, ease: CameraKey["ease"]): CameraKey => ({
  at,
  x,
  y,
  zoom,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  ease,
});

export function innerCut(i: InnerCutInput): TimelineScene {
  const s = i.scene;
  const d = s.durationInFrames;
  if (i.pacing === "slow" || i.explicitCamera || !DEMO_ROLES.has(s.meta.narrativeRole)) return s;
  if (d / i.fps <= i.maxShotSec * 1.25) return s;
  const hero = s.layers.find((l) => isScreen(l) && l.role === "hero") ?? s.layers.find(isScreen);
  if (!hero) return s;
  const cut = pickCutFrame(d, i.fps, i.wordStarts, i.beats);
  if (cut === null || cut <= hero.from || cut >= hero.from + hero.durationInFrames) return s;
  const camMax = Math.max(...s.camera.keys.map((k) => k.zoom));
  const p = hero.params as { kind?: string; scroll?: unknown; crop?: Rect; imageWidth?: number; imageHeight?: number; radius?: number };

  // decupaj: camera nu mărește, captura statică nu se derulează
  if (camMax <= 1.2 && p.kind !== "video" && !p.scroll && p.imageWidth && p.imageHeight) {
    const r = regionAt(hero, cut - hero.from);
    if (!r) return s;
    const V = p.crop ?? { x: 0, y: 0, w: p.imageWidth, h: p.imageHeight };
    const aspect = hero.box.w / hero.box.h;
    // prim-planul: ~1,6× față de planul larg, cu zona întreagă și margine, fără să mărească peste rezoluție
    let w = Math.max(V.w / 1.6, r.w * 1.3, r.h * 1.3 * aspect, (hero.box.w * camMax) / 1.5);
    if (i.avoid) {
      // mărirea maximă la care zona (cu margine, aliniată sus) încape între marginea casetei și subtitrări
      const limit = i.height / 2 + (i.avoid.y - i.height / 2) / camMax;
      const kMax = (limit - hero.box.y) / (r.h + 48);
      if (kMax <= 0) return s;
      w = Math.max(w, hero.box.w / kMax);
    }
    let h = w / aspect;
    if (h > p.imageHeight) {
      h = p.imageHeight;
      w = h * aspect;
    }
    if (V.w / w < 1.3) return s;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const zone = { id: "zona", label: "", kind: "custom" as const, rect: r };
    const [iw, ih] = [p.imageWidth, p.imageHeight];
    // marginea de jos a zonei pe ecran: caseta stratului, apoi zoom-ul camerei (push spre centrul cadrului)
    const bottomOnScreen = (c: Rect) => {
      const y = hero.box.y + (r.y + r.h - c.y) * (hero.box.h / c.h);
      return i.height / 2 + (y - i.height / 2) * camMax;
    };
    // zona se așază cât mai aproape de mijloc, dar deasupra subtitrărilor (la nevoie, sus în cadru); altfel
    // scena rămâne un singur plan
    const ys = [0.45, 0.35, 0.25, 0.15].map((bias) => cy - h * bias).concat(r.y - 24);
    const crop = ys
      .map((y) => clearCutEdges({ x: Math.min(Math.max(0, cx - w / 2), iw - w), y: Math.min(Math.max(0, y), ih - h), w, h }, i.regions, { w: iw, h: ih }, zone))
      .find((c) => r.y >= c.y && r.y + r.h <= c.y + c.h && (!i.avoid || bottomOnScreen(c) <= i.avoid.y));
    if (!crop) return s;
    const shift = cut - hero.from;
    const first: TimelineLayer = { ...hero, durationInFrames: shift };
    const second: TimelineLayer = {
      ...hero,
      id: `${hero.id}-b`,
      from: cut,
      durationInFrames: hero.durationInFrames - shift,
      params: { ...hero.params, crop, frame: "none", radius: p.radius ?? Math.round((Math.min(i.width, i.height) / 1080) * 24) },
      // fără a doua intrare: planul nou începe direct, ca o tăietură
      modifiers: hero.modifiers.filter((m) => m.capability !== "mod.enter"),
      // straturile de peste captură continuă din starea lor (start negativ = deja în desfășurare)
      children: hero.children.map((c) => ({ ...c, id: `${c.id}-b`, from: c.from - shift })).filter((c) => c.from + c.durationInFrames > 0),
    };
    const layers = s.layers.flatMap((l) => (l === hero ? [first, second] : [l]));
    return { ...s, layers, meta: { ...s.meta, cuts: [cut] } };
  }

  // cameră: plan larg aproape fix, apoi prim-planul rețetei
  const f = i.focus;
  if (!f || f.zoom < 1.35) return s;
  const c = { x: i.width / 2, y: i.height / 2 };
  const t = f.target ?? c;
  const aim = (z: number) => ({ x: f.x + (c.x - t.x) / z, y: f.y + (c.y - t.y) / z });
  const z0 = f.zoom * 0.94;
  const a0 = aim(z0);
  const a1 = aim(f.zoom);
  const keys = [
    key(0, c.x, c.y, 1, "linear"),
    key(cut - 1, c.x, c.y, 1.03, "linear"),
    key(cut, a0.x, a0.y, z0, "linear"),
    key(d - 1, a1.x, a1.y, f.zoom, "linear"),
  ];
  return { ...s, camera: { ...s.camera, keys }, meta: { ...s.meta, cuts: [cut] } };
}

/** Mișcarea camerei, pe scurt: zoom-ul de la început și de la final (aceeași semnătură ca la critica automată). */
const motion = (keys: CameraKey[]) => (keys.length > 1 ? `${keys[0].zoom.toFixed(2)}→${keys[keys.length - 1].zoom.toFixed(2)}` : "fix");

/**
 * Varietatea între două scene la rând cu aceeași rețetă: dacă și mișcarea camerei e aceeași, a doua scenă o
 * parcurge invers (un push devine pull-out care dezvăluie contextul). Cheile rămân aceleași puncte și zoom-uri,
 * doar ordinea în timp se inversează, deci zoom-ul maxim și geometria față de titlu nu se schimbă.
 */
export function varyCamera(keys: CameraKey[], prev: CameraKey[], duration: number): CameraKey[] {
  // doar mișcările simple (două chei): un traseu prin mai multe zone trebuie să urmeze ordinea cursorului
  if (keys.length !== 2 || motion(keys) !== motion(prev) || keys[0].zoom === keys[1].zoom) return keys;
  const n = keys.length;
  return [...keys].reverse().map((k, j) => ({ ...k, at: Math.max(0, duration - 1 - k.at), ease: j === 0 ? keys[0].ease : keys[n - j].ease }));
}
