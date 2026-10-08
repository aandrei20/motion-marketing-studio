import { z } from "zod";

/**
 * Operațiile de editare pe storyboard (sursa de adevăr; timeline-ul se recompilează din el).
 * Același set servește editorului din Studio, corecturilor automate (auto-fix) și undo/redo,
 * ca o schimbare să aibă o singură formă, validată, oricine ar face-o.
 */
const SceneRef = z.object({ sceneId: z.string().min(1) });
const Params = z.record(z.string(), z.unknown());

export const EditOp = z.discriminatedUnion("op", [
  /** durata explicită a scenei (null = calculată din voce, citire și ritm) */
  SceneRef.extend({ op: z.literal("scene-duration"), sec: z.number().positive().max(60).nullable() }),
  /** prelungește/scurtează scena față de durata compilată (minimul gramaticii de montaj rămâne) */
  SceneRef.extend({ op: z.literal("scene-extend"), deltaSec: z.number().min(-20).max(20), currentSec: z.number().positive().optional() }),
  SceneRef.extend({ op: z.literal("scene-delete") }),
  SceneRef.extend({ op: z.literal("scene-duplicate"), newId: z.string().min(1).optional() }),
  /** mută scena pe poziția `to` (0 = prima) */
  SceneRef.extend({ op: z.literal("scene-move"), to: z.number().int().min(0) }),
  SceneRef.extend({ op: z.literal("scene-lock"), locked: z.boolean() }),
  /** fără efecte sonore în scenă (vocea și muzica rămân) */
  SceneRef.extend({ op: z.literal("scene-mute"), muted: z.boolean() }),
  SceneRef.extend({ op: z.literal("scene-energy"), energy: z.number().min(0).max(1) }),
  SceneRef.extend({ op: z.literal("scene-text"), headline: z.string().optional(), sub: z.string().optional() }),
  SceneRef.extend({ op: z.literal("set-transition"), capability: z.string().min(1).nullable(), durationFrames: z.number().int().min(0).max(60).nullable().default(null) }),
  SceneRef.extend({ op: z.literal("set-camera"), capability: z.string().min(1), params: Params.default({}) }),
  SceneRef.extend({ op: z.literal("set-recipe"), recipe: z.string().min(1), params: Params.default({}) }),
  SceneRef.extend({ op: z.literal("beat-snap"), snap: z.enum(["none", "beat", "bar"]) }),
  /** materialul dintr-un slot al rețetei (id de asset sau „tag:<etichetă>”) */
  SceneRef.extend({ op: z.literal("replace-asset"), slot: z.string().min(1), assetId: z.string().min(1) }),
  /** parametri pe un strat al rețetei (slot = capabilitatea sau o parte din id-ul stratului) */
  SceneRef.extend({ op: z.literal("layer-params"), slot: z.string().min(1), params: Params }),
  /** înlocuiește animația unui strat (aceeași cutie) */
  SceneRef.extend({ op: z.literal("layer-capability"), slot: z.string().min(1), capability: z.string().min(1), params: Params.default({}) }),
  SceneRef.extend({ op: z.literal("layer-hide"), slot: z.string().min(1), hidden: z.boolean() }),
  /** decalează startul unui strat în scenă (secunde; negativ = mai devreme, limitat la 0) */
  SceneRef.extend({ op: z.literal("layer-shift"), slot: z.string().min(1), deltaSec: z.number().min(-10).max(10) }),
  SceneRef.extend({ op: z.literal("layer-lock"), slot: z.string().min(1), locked: z.boolean() }),
  /** recompilează din datele actuale (brief, brand, materiale), fără altă schimbare: repară un timeline învechit */
  z.object({ op: z.literal("recompile") }),
  /** mixul versiunii: variații în dB față de valorile curente */
  z.object({ op: z.literal("mix"), musicDb: z.number().min(-20).max(20).default(0), sfxDb: z.number().min(-20).max(20).default(0), duckDb: z.number().min(-20).max(20).default(0) }),
]);
export type EditOp = z.infer<typeof EditOp>;
export type EditOpInput = z.input<typeof EditOp>;

/** O intrare din jurnalul de editare al unei versiuni (pentru undo/redo). */
export const EditLogEntry = z.object({
  n: z.number().int().min(1),
  at: z.string(),
  ops: z.array(EditOp),
  description: z.string(),
  /** amprenta storyboard-ului înainte și după (conținutul e în projects/<id>/snapshots/) */
  before: z.string(),
  after: z.string(),
  source: z.enum(["editor", "auto-fix", "claude", "command"]),
  undone: z.boolean().default(false),
});
export type EditLogEntry = z.infer<typeof EditLogEntry>;

export const EditLog = z.object({ schemaVersion: z.literal(1), entries: z.array(EditLogEntry).default([]) });
export type EditLog = z.infer<typeof EditLog>;
