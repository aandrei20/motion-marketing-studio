/** Prezentarea proiectului: pașii de producție, joburile recente și STATE.md. */
import type React from "react";
import type { Ctx } from "../App";
import { Section } from "../common";
import { keyed } from "../keys";
import { ProductionFlow } from "../quality";

/** **aldin** și `cod` dintr-un rând, ca elemente React: textul (care poate veni de pe un site capturat) nu devine HTML. */
function inlineMd(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] !== undefined ? <b key={m.index}>{m[1]}</b> : <code key={m.index}>{m[2]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdownish({ text }: { text: string }) {
  return (
    <div className="md">
      {keyed(text.split("\n"), (l) => l).map(({ key, item: l }) => {
        if (l.startsWith("# ")) return <h2 key={key}>{l.slice(2)}</h2>;
        if (l.startsWith("## ")) return <h3 key={key}>{l.slice(3)}</h3>;
        if (l.startsWith("- ") || l.startsWith("  - "))
          return (
            <div key={key} className={l.startsWith("  ") ? "li sub" : "li"}>
              {inlineMd(l.replace(/^\s*- /, ""))}
            </div>
          );
        return l.trim() ? <p key={key}>{l}</p> : null;
      })}
    </div>
  );
}

export function OverviewPanel({ ctx }: { ctx: Ctx }) {
  const p = ctx.bundle.project;
  const approved = p.status !== "intake";
  return (
    <>
      <ProductionFlow ctx={ctx} />
      <div className="cols">
        <Section title="Pașii de producție">
          <p className="muted small">Fiecare pas e un job; progresul apare în stânga. Lucrul de producție începe doar după aprobarea brief-ului.</p>
          <div className="steps">
            <button
              type="button"
              className="btn"
              disabled={!approved}
              onClick={() => ctx.runJob("capture", { demo: false, url: p.product.url, captureId: `cap-${Date.now() % 100000}` })}
            >
              Captură reală (URL produs)
            </button>
            <button type="button" className="btn" disabled={!approved} onClick={() => ctx.runJob("brand")}>
              Brand kit din captură
            </button>
            <button type="button" className="btn" disabled={!approved} onClick={() => ctx.runJob("script")}>
              Schiță de script
            </button>
            <button type="button" className="btn" disabled={!approved} onClick={() => ctx.runJob("storyboard")}>
              Storyboard
            </button>
            <button type="button" className="btn" disabled={!ctx.versionId} onClick={() => ctx.runJob("voice")}>
              Voce
            </button>
            <button type="button" className="btn" disabled={!ctx.versionId} onClick={() => ctx.runJob("compile")}>
              Compilează timeline
            </button>
            <button type="button" className="btn" disabled={!ctx.versionId} onClick={() => ctx.runJob("audio")}>
              Audio (mix)
            </button>
            <button type="button" className="btn" disabled={!ctx.versionId} onClick={() => ctx.runJob("preview")}>
              Preview
            </button>
            <button type="button" className="btn primary" disabled={!approved} onClick={() => ctx.runJob("make")}>
              Producție completă
            </button>
          </div>
          {!approved ? <p className="warn">Brief-ul nu e aprobat. Completează-l în tabul Brief și scrie „aprob”.</p> : null}
          <h3>Joburi recente</h3>
          <div className="joblist">
            {ctx.jobs
              .slice(-8)
              .reverse()
              .map((j) => (
                <details key={j.id}>
                  <summary>
                    <span className={`chip ${j.state}`}>{j.state}</span> {j.label}
                  </summary>
                  <pre className="log">{[...j.log, j.error ?? ""].join("\n")}</pre>
                </details>
              ))}
          </div>
        </Section>
        <Section title="STATE.md">
          <Markdownish text={ctx.bundle.stateMd} />
        </Section>
      </div>
    </>
  );
}
