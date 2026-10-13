/** Research-ul: afirmațiile de confirmat, faptele și sursele. */
import type { Claim } from "../../../core/schema";
import type { Ctx } from "../App";
import { api } from "../api";
import { Section } from "../common";

export function ResearchPanel({ ctx }: { ctx: Ctx }) {
  const r = ctx.bundle.research;
  const by = (s: Claim["status"]) => r.claims.filter((c) => c.status === s);
  const set = async (c: Claim, status: string) => {
    try {
      await api.claim(ctx.bundle.project.id, c.id, status);
      await ctx.reload();
    } catch (e) {
      ctx.notify((e as Error).message, "err");
    }
  };
  const row = (c: Claim) => (
    <div key={c.id} className="claim">
      <div>
        <span className={`chip ${c.status}`}>{c.status}</span> <span className="chip kind">{c.kind}</span> <span className="chip">{c.category}</span>{" "}
        <span className="muted small">încredere {c.confidence}</span>
      </div>
      <div className="claim-text">{c.text}</div>
      {c.quote && c.quote !== c.text ? <blockquote>{c.quote}</blockquote> : null}
      <div className="muted small">
        {c.id} · surse: {c.sourceIds.join(", ")} · {c.checkedAt.slice(0, 10)} {c.notes ? `· ${c.notes}` : ""}
      </div>
      <div className="row">
        {c.status !== "approved-by-user" ? (
          <button type="button" className="btn tiny" onClick={() => set(c, "approved-by-user")}>
            Confirm (poate intra în video)
          </button>
        ) : null}
        {c.status !== "rejected" ? (
          <button type="button" className="btn tiny ghost" onClick={() => set(c, "rejected")}>
            Resping
          </button>
        ) : null}
      </div>
    </div>
  );
  return (
    <div className="cols">
      <Section title={`De confirmat (${by("needs-confirmation").length})`}>
        <p className="muted small">Prețuri și cifre: nu intră în video fără acordul tău.</p>
        {by("needs-confirmation").map(row)}
      </Section>
      <Section title="Fapte și surse">
        <p>{r.productSummary}</p>
        <h3>Surse</h3>
        {r.sources.map((s) => (
          <div key={s.id} className="source">
            <span className="chip">{s.kind}</span> <b>{s.title}</b>{" "}
            <span className="muted small">
              {s.url ?? s.assetId} · {s.fetchedAt.slice(0, 10)} · {s.reliability}
            </span>
          </div>
        ))}
        <h3>Afirmații utilizabile</h3>
        {[...by("approved-by-user"), ...by("verified")].map(row)}
        {by("rejected").length ? (
          <details>
            <summary>Respinse ({by("rejected").length})</summary>
            {by("rejected").map(row)}
          </details>
        ) : null}
      </Section>
    </div>
  );
}
