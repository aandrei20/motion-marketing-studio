/**
 * Aplicarea operațiilor de editare pe storyboard (sursa de adevăr). Timeline-ul se recompilează după.
 * Fiecare operație se validează (capabilitate, rețetă, material existente) și se descrie în română
 * pentru jurnalul versiunii. Scenele și straturile blocate nu se modifică de corecturile automate.
 */
import { MmsError } from "../core/errors";
import { Storyboard, type AssetManifest, type EditOp, type Timeline } from "../core/schema";
import { getCapability } from "../motion/registry";
import { RECIPES } from "../recipes/recipes";

export interface ApplyEditsOptions {
  /** timeline-ul compilat al versiunii (pentru duratele actuale ale scenelor) */
  timeline?: Timeline | null;
  assets?: AssetManifest | null;
  /** true = sare peste scenele/straturile blocate (corecturile automate); false = editorul utilizatorului */
  respectLocks?: boolean;
}

export interface AppliedEdit {
  op: EditOp;
  description: string;
  skipped?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function applyEditOps(input: Storyboard, ops: EditOp[], o: ApplyEditsOptions = {}): { storyboard: Storyboard; applied: AppliedEdit[] } {
  const sb: Storyboard = structuredClone(input);
  const applied: AppliedEdit[] = [];
  const fps = o.timeline?.fps ?? 30;
  const sceneOf = (id: string) => {
    const s = sb.scenes.find((x) => x.id === id);
    if (!s) throw new MmsError("SCENE_MISSING", `Scena „${id}” nu există în storyboard.`, `Scene: ${sb.scenes.map((x) => x.id).join(", ")}`);
    return s;
  };
  const currentSec = (id: string, hint?: number) => {
    const t = o.timeline?.scenes.find((x) => x.id === id);
    return hint ?? (t ? t.durationInFrames / fps : 2);
  };
  const needCap = (id: string, kind: "layer" | "camera" | "transition") => {
    const c = getCapability(id);
    if (!c || c.kind !== kind) throw new MmsError("CAPABILITY_UNKNOWN", `„${id}” nu e o capabilitate de tip ${kind} din registry.`, "Vezi: npm run mms -- catalog");
  };
  const override = (sceneId: string, slot: string) => {
    const s = sceneOf(sceneId);
    let ov = s.overrides.find((x) => x.slot === slot);
    if (!ov) {
      ov = { slot, params: {} };
      s.overrides.push(ov);
    }
    return ov;
  };
  for (const op of ops) {
    if (o.respectLocks && "sceneId" in op) {
      const s = sb.scenes.find((x) => x.id === op.sceneId);
      if (s?.locked) {
        applied.push({ op, description: `Scena ${op.sceneId} e blocată: schimbarea „${op.op}” nu s-a aplicat.`, skipped: "locked" });
        continue;
      }
      if ("slot" in op && s?.overrides.some((x) => x.slot === op.slot && x.locked)) {
        applied.push({ op, description: `Stratul „${op.slot}” din ${op.sceneId} e blocat.`, skipped: "locked" });
        continue;
      }
    }
    switch (op.op) {
      case "scene-duration": {
        sceneOf(op.sceneId).durationSec = op.sec;
        applied.push({ op, description: op.sec === null ? `Scena ${op.sceneId}: durata se calculează din nou (voce, citire, ritm).` : `Scena ${op.sceneId}: durata ${op.sec.toFixed(2)} s.` });
        break;
      }
      case "scene-extend": {
        const s = sceneOf(op.sceneId);
        const cur = s.durationSec ?? currentSec(op.sceneId, op.currentSec);
        s.durationSec = Math.round(clamp(cur + op.deltaSec, 0.8, 60) * 100) / 100;
        applied.push({ op, description: `Scena ${op.sceneId}: ${cur.toFixed(2)} s → ${s.durationSec.toFixed(2)} s.` });
        break;
      }
      case "scene-delete": {
        if (sb.scenes.length <= 1) throw new MmsError("LAST_SCENE", "Nu se poate șterge singura scenă.");
        sceneOf(op.sceneId);
        sb.scenes = sb.scenes.filter((x) => x.id !== op.sceneId);
        applied.push({ op, description: `Scena ${op.sceneId} ștearsă.` });
        break;
      }
      case "scene-duplicate": {
        const s = sceneOf(op.sceneId);
        let id = op.newId ?? `${s.id}-copie`;
        for (let k = 2; sb.scenes.some((x) => x.id === id); k++) id = `${op.newId ?? `${s.id}-copie`}-${k}`;
        const copy = { ...structuredClone(s), id, transitionIn: null };
        sb.scenes.splice(sb.scenes.indexOf(s) + 1, 0, copy);
        applied.push({ op, description: `Scena ${op.sceneId} duplicată ca ${id}.` });
        break;
      }
      case "scene-move": {
        const s = sceneOf(op.sceneId);
        const from = sb.scenes.indexOf(s);
        const to = clamp(op.to, 0, sb.scenes.length - 1);
        sb.scenes.splice(from, 1);
        sb.scenes.splice(to, 0, s);
        // tranzițiile din jur se aleg din nou după noua vecinătate
        s.transitionIn = null;
        if (sb.scenes[from]) sb.scenes[from].transitionIn = null;
        applied.push({ op, description: `Scena ${op.sceneId}: poziția ${from + 1} → ${to + 1}.` });
        break;
      }
      case "scene-lock":
        sceneOf(op.sceneId).locked = op.locked;
        applied.push({ op, description: `Scena ${op.sceneId} ${op.locked ? "blocată" : "deblocată"} pentru corecturile automate.` });
        break;
      case "scene-mute": {
        const s = sceneOf(op.sceneId);
        s.audio = { ...s.audio, sfx: op.muted ? "none" : "auto" };
        applied.push({ op, description: `Scena ${op.sceneId}: efecte sonore ${op.muted ? "oprite" : "pornite"}.` });
        break;
      }
      case "scene-energy":
        sceneOf(op.sceneId).energy = op.energy;
        applied.push({ op, description: `Scena ${op.sceneId}: energie ${op.energy}.` });
        break;
      case "scene-text": {
        const s = sceneOf(op.sceneId);
        s.text = { ...s.text, ...(op.headline !== undefined ? { headline: op.headline } : {}), ...(op.sub !== undefined ? { sub: op.sub } : {}) };
        applied.push({ op, description: `Scena ${op.sceneId}: text${op.headline !== undefined ? ` „${op.headline}”` : ""}${op.sub !== undefined ? ` / „${op.sub}”` : ""}.` });
        break;
      }
      case "set-transition": {
        const s = sceneOf(op.sceneId);
        if (op.capability) needCap(op.capability, "transition");
        s.transitionIn = op.capability ? { capability: op.capability, durationFrames: op.durationFrames, params: {} } : null;
        applied.push({ op, description: `Scena ${op.sceneId}: tranziția ${op.capability ?? "aleasă automat"}${op.durationFrames ? ` (${op.durationFrames} cadre la 30 fps)` : ""}.` });
        break;
      }
      case "set-camera":
        needCap(op.capability, "camera");
        sceneOf(op.sceneId).camera = { capability: op.capability, params: op.params };
        applied.push({ op, description: `Scena ${op.sceneId}: camera ${op.capability}.` });
        break;
      case "set-recipe": {
        if (!RECIPES.some((r) => r.id === op.recipe)) throw new MmsError("RECIPE_UNKNOWN", `Rețeta „${op.recipe}” nu există.`, "Vezi: npm run mms -- recipes");
        const s = sceneOf(op.sceneId);
        s.recipe = { id: op.recipe, params: op.params };
        s.overrides = [];
        applied.push({ op, description: `Scena ${op.sceneId}: rețeta ${op.recipe}.` });
        break;
      }
      case "beat-snap":
        sceneOf(op.sceneId).beat = { snap: op.snap };
        applied.push({ op, description: `Scena ${op.sceneId}: tăietura ${op.snap === "none" ? "liberă" : `pe ${op.snap === "bar" ? "măsură" : "bătaie"}`}.` });
        break;
      case "replace-asset": {
        if (o.assets && !op.assetId.startsWith("tag:") && !o.assets.assets.some((a) => a.id === op.assetId)) throw new MmsError("ASSET_MISSING", `Materialul „${op.assetId}” nu există în proiect.`);
        const s = sceneOf(op.sceneId);
        s.slots = { ...s.slots, [op.slot]: op.assetId };
        if (s.focus && s.focus.assetId !== op.assetId) s.focus = undefined;
        applied.push({ op, description: `Scena ${op.sceneId}: slotul „${op.slot}” primește ${op.assetId}.` });
        break;
      }
      case "layer-params": {
        const ov = override(op.sceneId, op.slot);
        ov.params = { ...ov.params, ...op.params };
        applied.push({ op, description: `Scena ${op.sceneId}, stratul „${op.slot}”: ${Object.entries(op.params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}.` });
        break;
      }
      case "layer-capability": {
        needCap(op.capability, "layer");
        const ov = override(op.sceneId, op.slot);
        ov.capability = op.capability;
        ov.params = { ...ov.params, ...op.params };
        applied.push({ op, description: `Scena ${op.sceneId}, stratul „${op.slot}”: animația ${op.capability}.` });
        break;
      }
      case "layer-hide":
        override(op.sceneId, op.slot).hidden = op.hidden;
        applied.push({ op, description: `Scena ${op.sceneId}, stratul „${op.slot}” ${op.hidden ? "ascuns" : "vizibil"}.` });
        break;
      case "layer-shift": {
        const ov = override(op.sceneId, op.slot);
        ov.shiftSec = Math.round(clamp((ov.shiftSec ?? 0) + op.deltaSec, -10, 10) * 100) / 100;
        applied.push({ op, description: `Scena ${op.sceneId}, stratul „${op.slot}”: start decalat cu ${ov.shiftSec} s.` });
        break;
      }
      case "layer-lock":
        override(op.sceneId, op.slot).locked = op.locked;
        applied.push({ op, description: `Scena ${op.sceneId}, stratul „${op.slot}” ${op.locked ? "blocat" : "deblocat"}.` });
        break;
      case "mix":
        sb.audio = {
          ...sb.audio,
          musicGainDb: clamp(sb.audio.musicGainDb + op.musicDb, -30, 12),
          sfxGainDb: clamp(sb.audio.sfxGainDb + op.sfxDb, -30, 12),
          duckDb: clamp(sb.audio.duckDb + op.duckDb, -30, 0),
        };
        applied.push({ op, description: `Mix: muzică ${sb.audio.musicGainDb} dB, efecte ${sb.audio.sfxGainDb} dB, ducking ${sb.audio.duckDb} dB.` });
        break;
      case "recompile":
        applied.push({ op, description: "Recompilare din datele actuale (brief, brand, materiale, research)." });
        break;
    }
  }
  return { storyboard: Storyboard.parse(sb), applied };
}

/** Comasează operațiile repetate pe aceeași țintă (de ex. două prelungiri ale aceleiași scene → cea mai mare). */
export function mergeOps(ops: EditOp[]): EditOp[] {
  const out: EditOp[] = [];
  const keyOf = (op: EditOp) => `${op.op}|${"sceneId" in op ? op.sceneId : ""}|${"slot" in op ? op.slot : ""}`;
  const seen = new Map<string, number>();
  for (const op of ops) {
    const k = keyOf(op);
    const i = seen.get(k);
    if (i === undefined) {
      seen.set(k, out.length);
      out.push(op);
      continue;
    }
    const prev = out[i];
    if (prev.op === "scene-extend" && op.op === "scene-extend" && Math.abs(op.deltaSec) > Math.abs(prev.deltaSec)) out[i] = op;
    if (prev.op === "layer-params" && op.op === "layer-params") out[i] = { ...prev, params: { ...prev.params, ...op.params } };
  }
  // un singur „recompile” e suficient
  return out.filter((op, i) => op.op !== "recompile" || out.findIndex((x) => x.op === "recompile") === i);
}
