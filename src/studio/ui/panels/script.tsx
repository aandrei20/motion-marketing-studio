/** Scriptul: replicile (voce, text pe ecran, accente) și verificările lor. */
import { useEffect, useState } from "react";
import type { Script } from "../../../core/schema";
import type { Ctx } from "../App";
import { saveVersioned, Section } from "../common";
import { keyed } from "../keys";

export function ScriptPanel({ ctx }: { ctx: Ctx }) {
  const [s, setS] = useState<Script | null>(ctx.version?.script ?? null);
  useEffect(() => setS(ctx.version?.script ?? null), [ctx.version?.script]);
  if (!s)
    return (
      <Section title="Script">
        <p>
          Nu există încă. Schița se face din faptele verificate și din cuvintele tale (hook, fraze obligatorii, CTA); Claude o rescrie creativ în Claude Code.
        </p>
        <button type="button" className="btn primary" onClick={() => ctx.runJob("script")}>
          Fă schița
        </button>
      </Section>
    );
  const upLine = (i: number, patch: Partial<Script["lines"][number]>) => setS({ ...s, lines: s.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  return (
    <div>
      {ctx.version?.scriptIssues.length ? (
        <Section title="Verificări">
          {keyed(ctx.version.scriptIssues, (x) => `${x.lineId ?? "-"}:${x.message}`).map(({ key, item: i }) => (
            <div key={key} className={`issue ${i.severity}`}>
              [{i.severity}] {i.lineId ? <code>{i.lineId}</code> : null} {i.message}
            </div>
          ))}
        </Section>
      ) : null}
      <Section
        title={`Script (${s.lines.length} replici · text ${s.textLanguage} · voce ${s.voiceLanguage ?? "—"})`}
        aside={
          <button type="button" className="btn primary" onClick={() => saveVersioned(ctx, "script", s).catch((e) => ctx.notify((e as Error).message, "err"))}>
            Salvează
          </button>
        }
      >
        <table className="table script">
          <thead>
            <tr>
              <th>Replica</th>
              <th>Pe ecran</th>
              <th>Voce</th>
              <th>Accente</th>
              <th>Afirmații</th>
              <th>Origine</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l, i) => (
              <tr key={l.id}>
                <td>
                  <code>{l.id}</code>
                  <div className="small muted">
                    {l.isHook ? "hook" : l.isCta ? "CTA" : ""} {l.emotion}
                  </div>
                </td>
                <td>
                  <textarea
                    rows={2}
                    aria-label={`Textul pe ecran, replica ${l.id}`}
                    value={l.onScreen}
                    onChange={(e) => upLine(i, { onScreen: e.target.value, origin: l.origin === "user-verbatim" ? "user-polished" : l.origin })}
                  />
                </td>
                <td>
                  <textarea
                    rows={2}
                    aria-label={`Vocea, replica ${l.id}`}
                    value={l.voiceover}
                    onChange={(e) => upLine(i, { voiceover: e.target.value, origin: l.origin === "user-verbatim" ? "user-polished" : l.origin })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Cuvintele accentuate, replica ${l.id}`}
                    value={l.emphasis.join(", ")}
                    onChange={(e) =>
                      upLine(i, {
                        emphasis: e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </td>
                <td className="small">{l.claimIds.join(", ") || <span className="muted">—</span>}</td>
                <td className="small">
                  <span className={`chip ${l.origin}`}>{l.origin}</span>
                  {l.mandatoryPhraseIds.length ? <div className="chip ok">frază obligatorie</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
