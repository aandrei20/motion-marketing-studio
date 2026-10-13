/** Storyboard-ul: scenele, cu rol, energie, rețetă și materiale. */
import { useEffect, useState } from "react";
import type { Storyboard } from "../../../core/schema";
import type { Ctx } from "../App";
import { api } from "../api";
import { saveVersioned, Section, tc } from "../common";
import { keyed } from "../keys";

export function StoryboardPanel({ ctx }: { ctx: Ctx }) {
  const [sb, setSb] = useState<Storyboard | null>(ctx.version?.storyboard ?? null);
  const [caps, setCaps] = useState<{ transitions: string[]; cameras: string[] }>({ transitions: [], cameras: [] });
  useEffect(() => setSb(ctx.version?.storyboard ?? null), [ctx.version?.storyboard]);
  useEffect(
    () =>
      void api.registry().then((r) =>
        setCaps({
          transitions: r.capabilities.filter((c) => c.kind === "transition").map((c) => c.id),
          cameras: r.capabilities.filter((c) => c.kind === "camera").map((c) => c.id),
        }),
      ),
    [],
  );
  const report = ctx.version?.compileReport?.[ctx.formatId];
  if (!sb)
    return (
      <Section title="Storyboard">
        <p>Nu există încă. Se construiește din șablon + script + materiale.</p>
        <button type="button" className="btn primary" onClick={() => ctx.runJob("storyboard")}>
          Construiește storyboard-ul
        </button>
      </Section>
    );
  const up = (i: number, patch: Partial<Storyboard["scenes"][number]>) => setSb({ ...sb, scenes: sb.scenes.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const tl = ctx.version?.timelines[ctx.formatId];
  return (
    <div>
      <Section
        title={`Storyboard (${sb.scenes.length} scene${sb.templateId ? ` · șablon ${sb.templateId}` : ""}${sb.direction ? ` · direcție ${sb.direction}` : ""})`}
        aside={
          <div className="row">
            <button type="button" className="btn" onClick={() => ctx.runJob("compile")}>
              Recompilează
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => saveVersioned(ctx, "storyboard", sb).catch((e) => ctx.notify((e as Error).message, "err"))}
            >
              Salvează
            </button>
          </div>
        }
      >
        {keyed(sb.rationale, (r) => r).map(({ key, item: r }) => (
          <div key={key} className="muted small">
            • {r}
          </div>
        ))}
        <div className="scenes">
          {sb.scenes.map((s, i) => {
            const rep = report?.scenes.find((x) => x.id === s.id);
            const ts = tl?.scenes.find((x) => x.id === s.id);
            return (
              <div key={s.id} className="scene">
                <div className="scene-head">
                  <b>
                    {i + 1}. {s.id}
                  </b>
                  <span className="chip">{s.narrativeRole}</span>
                  <span className="chip">{s.emotionalRole}</span>
                  {ts ? (
                    <button type="button" className="btn tiny ghost" onClick={() => ctx.seek(ts.from + 1)}>
                      {tc(ts.from, tl!.fps)} · {(ts.durationInFrames / tl!.fps).toFixed(2)} s
                    </button>
                  ) : null}
                </div>
                <div className="muted small">{s.purpose}</div>
                <div className="grid2 tight">
                  <label>
                    Rețeta
                    <select value={s.recipe.id} onChange={(e) => up(i, { recipe: { id: e.target.value, params: {} } })}>
                      {ctx.meta.recipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Durata (s, gol = automat)
                    <input
                      type="number"
                      step={0.1}
                      value={s.durationSec ?? ""}
                      onChange={(e) => up(i, { durationSec: e.target.value ? Number(e.target.value) : null })}
                    />
                  </label>
                  <label>
                    Titlu pe ecran
                    <input value={s.text.headline ?? ""} onChange={(e) => up(i, { text: { ...s.text, headline: e.target.value || undefined } })} />
                  </label>
                  <label>
                    Text secundar / CTA
                    <input value={s.text.sub ?? ""} onChange={(e) => up(i, { text: { ...s.text, sub: e.target.value || undefined } })} />
                  </label>
                  <label>
                    Tranziția de intrare
                    <select
                      value={s.transitionIn?.capability ?? ""}
                      onChange={(e) => up(i, { transitionIn: e.target.value ? { capability: e.target.value, durationFrames: null, params: {} } : null })}
                    >
                      <option value="">automat (gramatica de montaj)</option>
                      {caps.transitions.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Camera
                    <select
                      value={s.camera?.capability ?? ""}
                      onChange={(e) => up(i, { camera: e.target.value ? { capability: e.target.value, params: {} } : undefined })}
                    >
                      <option value="">din rețetă</option>
                      {caps.cameras.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Energie {s.energy.toFixed(2)}
                    <input type="range" min={0} max={1} step={0.05} value={s.energy} onChange={(e) => up(i, { energy: Number(e.target.value) })} />
                  </label>
                  <label>
                    Materiale
                    <input
                      value={Object.entries(s.slots)
                        .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("|") : v}`)
                        .join(", ")}
                      onChange={(e) =>
                        up(i, {
                          slots: Object.fromEntries(
                            e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean)
                              .map((x) => {
                                const [k, v] = x.split("=");
                                return [k, v?.includes("|") ? v.split("|") : (v ?? "")];
                              }),
                          ),
                        })
                      }
                    />
                  </label>
                </div>
                {rep ? (
                  <div className="muted small">
                    Durata: {rep.reasons.join("; ")} · tranziție {rep.transition ?? "—"}
                    {rep.notes.length ? ` · ${rep.notes.join(" ")}` : ""}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
