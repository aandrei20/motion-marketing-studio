/** Materialele: captura reală, încărcarea fișierelor și lista materialelor, cu drepturi și date personale. */
import { useState } from "react";
import type { Asset } from "../../../core/schema";
import type { Ctx } from "../App";
import { api, fileUrl } from "../api";
import { Section } from "../common";

function AssetCard({ a, ctx }: { a: Asset; ctx: Ctx }) {
  const src = fileUrl(`projects/${ctx.bundle.project.id}/${a.file}`);
  const patch = async (b: Record<string, unknown>) => {
    try {
      await api.patchAsset(ctx.bundle.project.id, a.id, b);
      await ctx.reload();
    } catch (e) {
      ctx.notify((e as Error).message, "err");
    }
  };
  const f = a.analysis.focalPoint;
  const focusable = a.type === "image" || a.type === "svg";
  return (
    <div className="asset">
      {focusable ? (
        <button
          type="button"
          className="thumb"
          aria-label={`Punctul focal al lui ${a.originalName}: clic pe imagine sau săgeți`}
          title="Clic pe imagine sau săgeți = punct focal"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            void patch({ focalPoint: { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } });
          }}
          onKeyDown={(e) => {
            const step = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[e.key];
            if (!step) return;
            e.preventDefault();
            const cur = f ?? { x: 0.5, y: 0.5 };
            const clamp = (v: number) => Math.min(1, Math.max(0, Math.round(v * 100) / 100));
            void patch({ focalPoint: { x: clamp(cur.x + step[0]), y: clamp(cur.y + step[1]) } });
          }}
        >
          <img src={src} alt="" />
          {f ? <span className="focal" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }} /> : null}
        </button>
      ) : (
        <div className="thumb">
          {a.type === "video" ? (
            <video src={src} muted controls />
          ) : a.type === "audio" ? (
            // biome-ignore lint/a11y/useMediaCaption: miniatura unui material încărcat (muzică, efecte, voce), fără transcriere
            <audio src={src} controls />
          ) : (
            <div className="file-type">{a.type}</div>
          )}
        </div>
      )}
      <div className="asset-body">
        <div className="asset-name" title={a.originalName}>
          {a.originalName}
        </div>
        <div className="muted small">
          {a.id} · {a.origin} · {a.media.width ? `${a.media.width}×${a.media.height}` : ""} {a.media.durationSec ? `${a.media.durationSec.toFixed(1)} s` : ""}
          {a.capture ? ` · ${a.capture.regions.length} zone` : ""}
          {a.analysis.bpm ? ` · ${a.analysis.bpm} BPM` : ""}
        </div>
        <label className="small">
          Rol
          <select value={a.role} onChange={(e) => patch({ role: e.target.value })}>
            {[
              "screenshot",
              "screen-recording",
              "logo",
              "product-image",
              "photo",
              "background",
              "icon",
              "music",
              "voiceover",
              "sfx",
              "font",
              "brand-guide",
              "reference-video",
              "reference-image",
              "document",
              "other",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        {a.analysis.palette.length ? (
          <div className="palette">
            {a.analysis.palette.slice(0, 6).map((c) => (
              <span key={c} style={{ background: c }} title={c} />
            ))}
          </div>
        ) : null}
        {a.rights.thirdParty ? (
          <div className={`rights ${a.rights.status}`}>
            Material al unui terț: <b>{a.rights.status}</b>
            {a.rights.status !== "confirmed-by-user" ? (
              <div className="row">
                <span className="small">Ai dreptul să-l folosești?</span>
                <button type="button" className="btn tiny" onClick={() => patch({ rights: "confirmed-by-user" })}>
                  Da
                </button>
                <button type="button" className="btn tiny ghost" onClick={() => patch({ rights: "denied" })}>
                  Nu
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {a.pii.regions.length ? (
          <div className="warn small">
            {a.pii.regions.length} zone cu date personale.{" "}
            {a.pii.blurApproved ? "Se estompează în video." : a.pii.keepApproved ? "Rămân vizibile (decizia ta)." : "Decide:"}{" "}
            {!a.pii.blurApproved ? (
              <button type="button" className="btn tiny" onClick={() => patch({ blurApproved: true })}>
                Estompează
              </button>
            ) : null}{" "}
            {!a.pii.keepApproved ? (
              <button type="button" className="btn tiny" onClick={() => patch({ keepApproved: true })}>
                Lasă-le vizibile
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AssetsPanel({ ctx }: { ctx: Ctx }) {
  const [url, setUrl] = useState(ctx.bundle.project.product.url ?? "");
  const [viewport, setViewport] = useState("desktop");
  const [full, setFull] = useState(false);
  const [research, setResearch] = useState(true);
  const [capThird, setCapThird] = useState(false);
  const [third, setThird] = useState(false);
  const [busy, setBusy] = useState(false);
  const assets = ctx.bundle.assets.assets;
  return (
    <div>
      <div className="cols">
        <Section title="Captură reală (Playwright)">
          <p className="muted small">
            Un browser automat deschide pagina și face capturi 2× cu zonele din DOM (butoane, câmpuri, carduri). Interfața nu se redesenează niciodată.
          </p>
          <label>
            URL
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </label>
          <div className="row">
            <select aria-label="Viewport-ul capturii" value={viewport} onChange={(e) => setViewport(e.target.value)}>
              {["desktop", "laptop", "tablet", "mobile"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <label className="check">
              <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> pagină întreagă
            </label>
            <label className="check">
              <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} /> textul intră în research
            </label>
            <label className="check">
              <input type="checkbox" checked={capThird} onChange={(e) => setCapThird(e.target.checked)} /> site-ul altcuiva (întreb de drepturi)
            </label>
          </div>
          {viewport !== "mobile" && ctx.bundle.project.formats.some((f) => f.height > f.width * 1.15) ? (
            <p className="muted small">Proiectul are un format vertical: se face automat și varianta de telefon a paginii, folosită pe vertical.</p>
          ) : null}
          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => ctx.runJob("capture", { demo: true })}>
              Capturează produsul demo
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!url}
              onClick={() => ctx.runJob("capture", { url, viewport, fullPage: full, research, thirdParty: capThird, captureId: `cap-${Date.now() % 100000}` })}
            >
              Capturează
            </button>
          </div>
          <p className="muted small">
            Pentru pagini cu autentificare: <code>npm run mms -- login --url … --profile nume</code>, apoi capturează cu <code>--profile nume</code>.
          </p>
        </Section>
        <Section title="Încarcă fișiere">
          <p className="muted small">Logo, capturi, video, muzică, voce, fonturi, PDF-uri, referințe. Duplicatele exacte se recunosc după conținut.</p>
          <label className="check">
            <input type="checkbox" checked={third} onChange={(e) => setThird(e.target.checked)} /> materialele sunt ale altcuiva (întreb de drepturi)
          </label>
          <input
            aria-label="Încarcă fișiere"
            type="file"
            multiple
            disabled={busy}
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              setBusy(true);
              for (const f of files) {
                try {
                  const r = await api.upload(ctx.bundle.project.id, f, { thirdParty: third });
                  ctx.notify(`${f.name}: ${r.duplicate ? "există deja" : "adăugat"}`);
                } catch (err) {
                  ctx.notify(`${f.name}: ${(err as Error).message}`, "err");
                }
              }
              setBusy(false);
              e.target.value = "";
              await ctx.reload();
            }}
          />
        </Section>
      </div>
      <Section title={`Materiale (${assets.length})`}>
        <div className="asset-grid">
          {assets.map((a) => (
            <AssetCard key={a.id} a={a} ctx={ctx} />
          ))}
        </div>
      </Section>
    </div>
  );
}
