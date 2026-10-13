/** Critica: rubrica fixă a regulii 7 (prag 8/10) și observațiile deschise. */
import type { Ctx } from "../App";
import { Section } from "../common";

export function CritiquePanel({ ctx }: { ctx: Ctx }) {
  const c = ctx.version?.critique;
  const rounds = c?.rounds ?? [];
  const last = [...rounds].reverse().find((r) => r.reviewer === "mms-auto-critic-v1");
  const keys = ["hook", "clarity", "rhythm", "hierarchy", "variety", "brand", "cta"] as const;
  const labels: Record<string, string> = {
    hook: "hook",
    clarity: "claritate",
    rhythm: "ritm",
    hierarchy: "ierarhie",
    variety: "varietate",
    brand: "brand",
    cta: "CTA",
  };
  const tl = ctx.version?.timelines[ctx.formatId];
  return (
    <div>
      <Section
        title="Critică (rubrica fixă, prag 8/10)"
        aside={
          <button type="button" className="btn primary" onClick={() => ctx.runJob("critique")}>
            Rundă nouă
          </button>
        }
      >
        {last ? (
          <>
            <p>
              Runda {last.n} · {last.reviewer} · scor minim <b>{last.minScene}</b>/10
            </p>
            <table className="table scores">
              <thead>
                <tr>
                  <th>Scena</th>
                  {keys.map((k) => (
                    <th key={k}>{labels[k]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {last.sceneScores.map((s) => (
                  <tr key={s.sceneId}>
                    <td>{s.sceneId}</td>
                    {keys.map((k) => (
                      <td key={k} className={`score s${Math.floor(s.scores[k] ?? 0)}`}>
                        {s.scores[k]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p>Nicio rundă încă.</p>
        )}
        <p className="muted small">
          Critica automată măsoară ce se poate măsura (timp până la primul text, timp de citire, ierarhie, varietate, hold pe CTA, ritm pe beat, audio, cadre
          negre). Revizuirea vizuală pe foaia de contact o face Claude și se adaugă ca rundă separată.
        </p>
      </Section>
      <Section title="Observații deschise">
        {rounds
          .flatMap((r) => r.findings.filter((f) => f.status === "open").map((f) => ({ ...f, reviewer: r.reviewer })))
          .map((f) => (
            <div key={`${f.reviewer}-${f.id}`} className={`issue ${f.severity}`}>
              {f.frame !== null && tl ? (
                <button type="button" className="btn tiny ghost" onClick={() => ctx.seek(f.frame!)}>
                  {f.timecode}
                </button>
              ) : null}{" "}
              <b>{f.dimension}</b> · {f.problem} <span className="muted">→ {f.recommendation}</span> <span className="muted small">({f.reviewer})</span>
            </div>
          ))}
      </Section>
    </div>
  );
}
