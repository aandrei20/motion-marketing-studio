/** Piesele comune ale panourilor din Studio: secțiunea, timecode-ul, salvarea versionată, subtitrările. */
import type React from "react";
import type { Ctx } from "./App";
import { api, fileUrl } from "./api";

export const tc = (frames: number, fps: number) => {
  const s = frames / fps;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
};

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Salvează în versiunea curentă; dacă e înghețată, creează întâi versiunea următoare. */
export async function saveVersioned(ctx: Ctx, kind: "script" | "storyboard", data: unknown): Promise<void> {
  const id = ctx.bundle.project.id;
  const v = ctx.versionId;
  if (!v) throw new Error("Nu există versiune.");
  const frozen = ctx.bundle.versions.find((x) => x.id === v)?.frozen;
  let target = v;
  if (frozen) {
    if (!window.confirm(`Versiunea ${v} e înghețată (nu se mai modifică). Creez versiunea următoare cu modificările tale?`)) return;
    const meta = await fetch(`/api/projects/${id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: v, label: `editare ${kind}` }),
    }).then((r) => r.json());
    if (meta.error) throw new Error(meta.error);
    target = meta.id;
  }
  if (kind === "script") await api.saveScript(id, target, data);
  else await api.saveStoryboard(id, target, data);
  ctx.notify(`${kind === "script" ? "Script" : "Storyboard"} salvat în ${target}. Recompilează ca să vezi efectul.`);
  await ctx.reload();
}

/** Subtitrările versiunii (aceleași replici ca în .srt), pentru playerele din Studio. */
export function captionsOf(ctx: Ctx): { src: string; lang: string } | null {
  const vtt = ctx.version?.captions;
  if (!vtt) return null;
  return { src: fileUrl(vtt), lang: ctx.bundle.project.language.voice ?? ctx.bundle.project.language.text ?? "ro" };
}
