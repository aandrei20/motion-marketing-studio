/** Exportul: preview-ul și „render final”. */
import { useMemo, useState } from "react";
import type { Ctx } from "../App";
import { api, fileUrl } from "../api";
import { captionsOf, Section } from "../common";

export function ExportPanel({ ctx }: { ctx: Ctx }) {
  const [phrase, setPhrase] = useState("");
  const renders = ctx.version?.renders ?? [];
  const cap = captionsOf(ctx);
  const videos = renders.filter((r) => r.endsWith(".mp4"));
  const sheets = renders.filter((r) => r.endsWith(".png"));
  const tl = ctx.version?.timelines[ctx.formatId];
  const finalApproved = ctx.bundle.approvals.items.some((a) => a.kind === "render-final" && a.versionId === ctx.versionId);
  const exportsList = useMemo(() => ctx.bundle.versions.filter((v) => v.status === "final"), [ctx.bundle.versions]);
  return (
    <div className="cols">
      <Section title="Preview">
        <p className="muted small">Preview-ul e o randare completă (MP4) plus foaia de contact; versiunea se îngheață după preview.</p>
        <div className="row">
          {ctx.bundle.project.formats.map((f) => (
            <button type="button" key={f.id} className="btn" disabled={!tl} onClick={() => ctx.runJob("preview", { format: f.id })}>
              Randează preview {f.id}
            </button>
          ))}
        </div>
        {videos.map((v) => (
          <div key={v} className="render">
            <div className="small muted">{v.split("/").pop()}</div>
            {cap ? (
              <video src={fileUrl(v)} controls className="render-video">
                <track kind="captions" src={cap.src} srcLang={cap.lang} label="Subtitrări" default />
              </video>
            ) : (
              // biome-ignore lint/a11y/useMediaCaption: fără voce în reclamă nu există replici de subtitrat
              <video src={fileUrl(v)} controls className="render-video" />
            )}
          </div>
        ))}
        {sheets.map((s) => (
          <a key={s} href={fileUrl(s)} target="_blank" rel="noreferrer" className="small">
            foaie de contact: {s.split("/").pop()}
          </a>
        ))}
      </Section>
      <Section title="Render final">
        {tl?.concept ? <p className="warn">Versiunea folosește materiale fără drepturi confirmate („concept”): exportul final e blocat.</p> : null}
        <p>
          Exportul final se face doar după ce scrii exact <b>render final</b> pentru versiunea {ctx.versionId}.
        </p>
        {finalApproved ? (
          <button type="button" className="btn primary" onClick={() => ctx.runJob("final")}>
            Randează final {ctx.formatId}
          </button>
        ) : (
          <div className="row">
            <input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="render final" />
            <button
              type="button"
              className="btn primary"
              disabled={!ctx.versionId}
              onClick={async () => {
                try {
                  await api.approve(ctx.bundle.project.id, "render-final", phrase, ctx.versionId!);
                  ctx.notify("Aprobare înregistrată.");
                  await ctx.reload();
                } catch (e) {
                  ctx.notify((e as Error).message, "err");
                }
              }}
            >
              Confirm
            </button>
          </div>
        )}
        <p className="muted small">
          Exporturile ajung în <code>projects/{ctx.bundle.project.id}/exports/</code> și nu se suprascriu. Versiuni finale:{" "}
          {exportsList.map((v) => v.id).join(", ") || "—"}.
        </p>
      </Section>
    </div>
  );
}
