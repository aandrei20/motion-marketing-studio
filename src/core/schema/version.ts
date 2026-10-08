import { z } from "zod";
import { IsoDate, VersionId } from "./common";

export const Change = z.object({
  at: IsoDate,
  /** operația care a produs schimbarea, de ex. set-scene-duration */
  op: z.string(),
  description: z.string(),
  params: z.record(z.string(), z.unknown()).default({}),
  /** comanda în limbaj natural care a cerut schimbarea, dacă există */
  request: z.string().optional(),
});
export type Change = z.infer<typeof Change>;

/** rejected = respinsă de bucla de corectură automată (a înrăutățit scorul); rămâne pe disc, neatinsă */
export const VersionStatus = z.enum(["draft", "preview", "approved", "final", "rejected"]);
export type VersionStatus = z.infer<typeof VersionStatus>;

export const VersionMeta = z.object({
  id: VersionId,
  createdAt: IsoDate,
  parent: VersionId.nullable(),
  label: z.string().default(""),
  status: VersionStatus,
  /** o versiune înghețată nu mai poate fi modificată; schimbările creează versiunea următoare */
  frozen: z.boolean(),
  changes: z.array(Change).default([]),
  /** amprentele intrărilor la nivel de proiect folosite la compilare (brief, research, brand, assets); conținutul e în projects/<id>/snapshots/ */
  inputs: z.record(z.string(), z.string()).default({}),
  /** de ce a fost respinsă (rollback), dacă e cazul */
  rejectedReason: z.string().optional(),
});
export type VersionMeta = z.infer<typeof VersionMeta>;
