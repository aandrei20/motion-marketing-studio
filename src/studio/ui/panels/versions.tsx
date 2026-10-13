/** Versiunile: istoricul, versiunea nouă și alegerea versiunii de lucru. */
import type { Ctx } from "../App";
import { Section } from "../common";
import { keyed } from "../keys";

export function VersionsPanel({ ctx, onSelect }: { ctx: Ctx; onSelect: (v: string) => void }) {
  return (
    <Section
      title="Versiuni"
      aside={
        <button type="button" className="btn" onClick={() => ctx.runJob("new-version", { label: "manual" })}>
          Versiune nouă
        </button>
      }
    >
      <p className="muted small">
        Nicio versiune nu se suprascrie: o versiune cu preview, aprobată sau finală e înghețată; modificările creează versiunea următoare, cu jurnalul
        schimbărilor.
      </p>
      {[...ctx.bundle.versions].reverse().map((v) => (
        <div key={v.id} className={`version ${v.id === ctx.versionId ? "current" : ""}`}>
          <div className="row">
            <b>{v.id}</b>
            <span className={`chip ${v.status}`}>{v.status}</span>
            {v.frozen ? <span className="chip">înghețată</span> : <span className="chip ok">editabilă</span>}
            {v.parent ? <span className="muted small">din {v.parent}</span> : null}
            <span className="muted small">{v.createdAt.slice(0, 16).replace("T", " ")}</span>
            <button type="button" className="btn tiny" onClick={() => onSelect(v.id)}>
              Deschide
            </button>
          </div>
          {v.label ? <div className="muted">{v.label}</div> : null}
          <ul>
            {keyed(v.changes, (c) => `${c.at}:${c.op}:${c.description}`).map(({ key, item: c }) => (
              <li key={key}>
                {c.description} {c.request ? <span className="muted small">(„{c.request}”)</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}
