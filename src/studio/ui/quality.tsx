import type React from "react";
import { useMemo, useState } from "react";
import type { EditOpInput, Finding, QualityCategory, Timeline, TimelineScene } from "../../core/schema";
import type { Ctx } from "./App";
import { api } from "./api";
import { keyed } from "./keys";

const CAT_LABEL: Record<QualityCategory, string> = {
  story: "Poveste",
  creative: "Creativ",
  visual: "Vizual",
  motion: "Mișcare",
  typography: "Tipografie",
  ui: "Interfață",
  audio: "Audio",
  brand: "Brand",
  claims: "Afirmații",
  technical: "Tehnic",
  platform: "Platformă",
};
const SEV_LABEL: Record<string, string> = { critical: "critică", high: "mare", medium: "medie", low: "mică" };
const VERDICT: Record<string, { label: string; cls: string; hint: string }> = {
  PASS: { label: "PASS", cls: "ok", hint: "gata pentru revizuirea ta" },
  POLISH: { label: "POLISH", cls: "warn", hint: "finisaj opțional" },
  FIX: { label: "FIX", cls: "warn", hint: "de corectat înainte de predare" },
  FAIL: { label: "FAIL", cls: "err", hint: "blocat de o problemă critică" },
};

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
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

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const cls = value === null ? "na" : value >= 95 ? "good" : value >= 85 ? "mid" : "low";
  return (
    <div className={`qbar ${cls}`} title={value === null ? "neevaluat în această rundă" : `${value}/100`}>
      <span className="qbar-label">{label}</span>
      <span className="qbar-track">
        <span style={{ width: `${value ?? 0}%` }} />
      </span>
      <span className="qbar-value">{value === null ? "—" : value}</span>
    </div>
  );
}

/** Panoul bucla de calitate: scor, verdict, pase și metode, randări refolosite, probleme, iterații. */
export function QualityPanel({ ctx }: { ctx: Ctx }) {
  const run = ctx.version?.quality ?? null;
  const [sev, setSev] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const tl = ctx.version?.timelines[ctx.formatId];
  const rounds = (ctx.version?.critique.rounds ?? []).filter((r) => r.quality);
  const external = (ctx.version?.critique.rounds ?? [])
    .filter((r) => r.reviewer !== "mms-auto-critic-v1")
    .flatMap((r) => r.findings.map((f) => ({ ...f, reviewer: r.reviewer })));
  const issues = useMemo(
    () => (run?.issues ?? []).filter((f) => (sev === "all" || f.severity === sev) && (cat === "all" || f.category === cat)),
    [run, sev, cat],
  );
  const applyFix = async (f: Finding) => {
    const j = await ctx.runJob("edit", { ops: f.suggestedFix });
    if (j) ctx.notify(`Corectura se aplică într-o versiune editabilă: ${f.problem.slice(0, 60)}…`);
  };
  const actions = (
    <div className="row">
      <button type="button" className="btn" onClick={() => ctx.runJob("quality", { depth: "fast" })} title="Fără randare: reguli, timeline, audio">
        Rapid
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => ctx.runJob("quality", { depth: "standard" })}
        title="+ un cadru-cheie pe scenă (doar scenele schimbate)"
      >
        Cadre-cheie
      </button>
      <button type="button" className="btn" onClick={() => ctx.runJob("quality", { depth: "final" })} title="+ video întreg (refolosit dacă e la zi)">
        Final QA
      </button>
      <button type="button" className="btn primary" onClick={() => ctx.runJob("autofix", { depth: "standard" })}>
        Corecturi automate
      </button>
      <button
        type="button"
        className="btn ghost"
        onClick={() => ctx.runJob("critique-pack")}
        title="Cadre-cheie + foaie de contact pentru revizuirea vizuală a lui Claude"
      >
        Pachet de revizuire
      </button>
    </div>
  );
  if (!run)
    return (
      <Card title="Calitate" aside={actions}>
        <p className="muted">
          Versiunea nu are încă o rundă a buclei de calitate. „Rapid” nu randează nimic; „Cadre-cheie” randează un cadru pe scenă; „Final QA” folosește video-ul
          întreg (doar dacă nu există unul la zi).
        </p>
      </Card>
    );
  const v = VERDICT[run.score.verdict];
  const passes = run.passes;
  return (
    <div>
      <Card title={`Calitate · ${run.versionId} · runda ${run.round}`} aside={actions}>
        <div className="qhead">
          <div className={`qscore ${v.cls}`}>
            <b>{run.score.overall}</b>
            <span>/100</span>
          </div>
          <div>
            <div className={`pill ${v.cls}`}>{v.label}</div> <span className="muted small">{v.hint}</span>
            <div className="small">
              adâncime <b>{run.depth}</b> · acoperire {Math.round(run.score.coverage * 100)}% · critice {run.score.counts.critical} · mari{" "}
              {run.score.counts.high} · medii {run.score.counts.medium} · mici {run.score.counts.low}
            </div>
            {run.rubric.minScene !== null ? <div className="small">rubrica regulii 7: minim {run.rubric.minScene}/10 pe scenă</div> : null}
            <div className="small muted">
              randări: {run.renders.stillsRendered} cadre noi · {run.renders.stillsReused} din cache · video {run.renders.fullRendered} randat /{" "}
              {run.renders.fullReused} refolosit · {(run.durationMs / 1000).toFixed(1)} s
            </div>
          </div>
        </div>
        <div className="qbars">
          {(Object.keys(CAT_LABEL) as QualityCategory[]).map((k) => (
            <ScoreBar key={k} label={CAT_LABEL[k]} value={run.score.categories[k] ?? null} />
          ))}
        </div>
        {run.score.reasons.length ? (
          <ul className="small">
            {keyed(run.score.reasons, (r) => r).map(({ key, item: r }) => (
              <li key={key}>{r}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card
        title={`Probleme (${run.issues.length})`}
        aside={
          <div className="row small">
            <select aria-label="Filtrează după gravitate" value={sev} onChange={(e) => setSev(e.target.value)}>
              <option value="all">toate gravitățile</option>
              {Object.entries(SEV_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <select aria-label="Filtrează după categorie" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">toate categoriile</option>
              {Object.entries(CAT_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {issues.length ? null : <p className="ok small">Nicio problemă cu filtrele alese.</p>}
        {issues.map((f) => (
          <div key={f.id} className={`issue ${f.severity}`}>
            <div className="row">
              {f.frame !== null && tl ? (
                <button type="button" className="btn tiny ghost" onClick={() => ctx.seek(f.frame!)}>
                  {f.timecode}
                </button>
              ) : null}
              <b>{SEV_LABEL[f.severity]}</b>
              <span className="muted small">
                {CAT_LABEL[f.category]} · {f.dimension}
                {f.formatId ? ` · ${f.formatId}` : ""}
                {f.sceneId ? ` · ${f.sceneId}` : ""} · {f.method} · încredere {Math.round(f.confidence * 100)}%
              </span>
            </div>
            <div>{f.problem}</div>
            {f.whyItMatters ? <div className="muted small">De ce contează: {f.whyItMatters}</div> : null}
            <div className="small">→ {f.recommendation}</div>
            {f.autoFixable && f.suggestedFix.length ? (
              <button type="button" className="btn tiny" onClick={() => applyFix(f)} title={JSON.stringify(f.suggestedFix)}>
                Aplică corectura ({f.suggestedFix.map((o) => o.op).join(", ")})
              </button>
            ) : (
              <span className="muted small">decizie creativă (Claude / tu)</span>
            )}
          </div>
        ))}
      </Card>

      {external.length ? (
        <Card title={`Revizuirea vizuală și notele tale (${external.length})`}>
          {external.map((f) => (
            <div key={`${f.reviewer}-${f.id}`} className={`issue ${f.severity}`}>
              {f.frame !== null && tl ? (
                <button type="button" className="btn tiny ghost" onClick={() => ctx.seek(f.frame!)}>
                  {f.timecode}
                </button>
              ) : null}{" "}
              <b>{f.reviewer}</b> · {f.problem} <span className="muted small">→ {f.recommendation}</span>
            </div>
          ))}
        </Card>
      ) : null}

      <Card title="Pasele (metoda cea mai ieftină permisă de adâncime)">
        <table className="table small">
          <thead>
            <tr>
              <th>Pas</th>
              <th>Verificare</th>
              <th>Metodă</th>
              <th>Stare</th>
              <th>Probleme</th>
              <th>ms</th>
            </tr>
          </thead>
          <tbody>
            {passes.flatMap((p) =>
              p.checks.map((c, i) => (
                <tr key={`${p.id}-${c.id}`} className={c.status === "skipped" ? "muted" : ""}>
                  <td>{i === 0 ? `${p.n} · ${p.title.split(":")[0]}` : ""}</td>
                  <td title={c.title}>{c.id}</td>
                  <td>{c.method}</td>
                  <td>{c.status === "cached" ? "din cache" : c.status === "skipped" ? `sărit (${c.reason ?? ""})` : "rulat"}</td>
                  <td>{c.issues}</td>
                  <td>{c.ms}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </Card>

      {ctx.version?.impact ? (
        <Card title="Impactul față de versiunea anterioară">
          <ul className="small">
            {keyed(ctx.version.impact.reasons, (r) => r).map(({ key, item: r }) => (
              <li key={key}>{r}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {ctx.version?.autofix ? (
        <Card title={`Corecturi automate: ${ctx.version.autofix.startVersion} → ${ctx.version.autofix.finalVersion}`}>
          <p className="small">{ctx.version.autofix.stopReason}</p>
          <ul className="small">
            {ctx.version.autofix.iterations.map((it) => (
              <li key={it.n}>
                iterația {it.n}: {it.from} → {it.to} ·{" "}
                <b className={it.decision === "kept" ? "ok" : "warn"}>{it.decision === "kept" ? "păstrată" : "respinsă (rollback)"}</b> · {it.reason} ·{" "}
                {it.fixes.length} corecturi
              </li>
            ))}
          </ul>
          {ctx.version.autofix.needsHuman.length ? <p className="small warn">{ctx.version.autofix.needsHuman.length} probleme cer decizie creativă.</p> : null}
        </Card>
      ) : null}

      {rounds.length > 1 ? (
        <Card title="Istoricul rundelor pe această versiune">
          <table className="table small">
            <thead>
              <tr>
                <th>Runda</th>
                <th>Adâncime</th>
                <th>Scor</th>
                <th>Verdict</th>
                <th>Minim rubrică</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.n}>
                  <td>{r.n}</td>
                  <td>{r.depth}</td>
                  <td>{r.quality!.overall}</td>
                  <td>{r.quality!.verdict}</td>
                  <td>{r.minScene}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}

/** Conceptele creative: scor pe 10 criterii, cel ales, alegerea altuia. */
export function ConceptsPanel({ ctx }: { ctx: Ctx }) {
  const c = ctx.bundle.concepts;
  const pid = ctx.bundle.project.id;
  const choose = async (id: string) => {
    try {
      await api.concepts(pid, id);
      ctx.notify("Concept ales. Regenerează storyboard-ul ca să-l aplici.");
      await ctx.reload();
    } catch (e) {
      ctx.notify((e as Error).message, "err");
    }
  };
  const actions = (
    <div className="row">
      <button type="button" className="btn" onClick={() => ctx.runJob("concepts", { force: true })}>
        Regenerează conceptele
      </button>
      <button type="button" className="btn primary" onClick={() => ctx.runJob("storyboard", { force: true })} disabled={!ctx.bundle.project.currentVersion}>
        Storyboard din conceptul ales
      </button>
    </div>
  );
  if (!c)
    return (
      <Card title="Concept creativ" aside={actions}>
        <p className="muted">Conceptele se generează din research, brief și materiale (după captură).</p>
      </Card>
    );
  const sorted = [...c.concepts].sort((a, b) => b.total - a.total);
  return (
    <Card title="Concept creativ" aside={actions}>
      <ul className="small">
        {keyed(c.rationale.slice(0, 2), (r) => r).map(({ key, item: r }) => (
          <li key={key}>{r}</li>
        ))}
      </ul>
      <div className="concepts">
        {sorted.map((x) => (
          <div key={x.id} className={`concept ${x.id === c.selectedId ? "selected" : ""}`}>
            <div className="row">
              <b>{x.title}</b>
              <span className="pill">{x.total}/100</span>
              <span className="muted small">
                {x.origin === "user" ? "ideea ta" : x.origin === "ai" ? "Claude (sugestie)" : "sugestie din date"} · {x.templateId} · {x.direction}
              </span>
              {x.id === c.selectedId ? (
                <span className="ok small">ales</span>
              ) : (
                <button type="button" className="btn tiny" onClick={() => choose(x.id)}>
                  Alege
                </button>
              )}
            </div>
            <div>{x.bigIdea}</div>
            <div className="small">
              hook ({x.hook.origin === "user-verbatim" ? "cuvintele tale" : x.hook.origin === "site-quote" ? "citat de pe site" : "sugestie"}): „{x.hook.text}”
            </div>
            <div className="small muted">arc: {x.arc.join(" → ")}</div>
            {x.risks.length ? <div className="small warn">riscuri: {x.risks.join("; ")}</div> : null}
            <div className="cscores">
              {Object.entries(x.scores).map(([k, sc]) => (
                <span key={k} title={sc!.why} className="chip">
                  {k} {sc!.value}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Editorul scenei selectate: operații reale pe storyboard (versiune nouă dacă cea curentă e înghețată), cu undo/redo. */
export function SceneEditor({
  ctx,
  t,
  scene,
  transitions,
  cameras,
}: {
  ctx: Ctx;
  t: Timeline;
  scene: TimelineScene;
  transitions: string[];
  cameras: string[];
}) {
  const sb = ctx.version?.storyboard?.scenes.find((s) => s.id === scene.id);
  const idx = t.scenes.findIndex((s) => s.id === scene.id);
  const [sec, setSec] = useState((scene.durationInFrames / t.fps).toFixed(2));
  const [headline, setHeadline] = useState(sb?.text.headline ?? "");
  const edits = ctx.version?.edits.entries ?? [];
  const canUndo = edits.some((e) => !e.undone) && !ctx.version?.meta.frozen;
  const canRedo = edits.some((e) => e.undone) && !ctx.version?.meta.frozen;
  const run = (ops: EditOpInput[]) => ctx.runJob("edit", { ops });
  if (!sb) return <p className="muted small">Scena nu e în storyboard-ul acestei versiuni.</p>;
  return (
    <div className="editor">
      <h3>Editare {ctx.version?.meta.frozen ? <span className="muted small">(versiune înghețată: editarea creează versiunea următoare)</span> : null}</h3>
      <div className="row small">
        <label>
          durata <input className="num" value={sec} onChange={(e) => setSec(e.target.value)} /> s
        </label>
        <button type="button" className="btn tiny" onClick={() => run([{ op: "scene-duration", sceneId: scene.id, sec: Number(sec) || null }])}>
          aplică
        </button>
        <button
          type="button"
          className="btn tiny ghost"
          onClick={() => run([{ op: "scene-extend", sceneId: scene.id, deltaSec: -0.5, currentSec: scene.durationInFrames / t.fps }])}
        >
          −0,5 s
        </button>
        <button
          type="button"
          className="btn tiny ghost"
          onClick={() => run([{ op: "scene-extend", sceneId: scene.id, deltaSec: 0.5, currentSec: scene.durationInFrames / t.fps }])}
        >
          +0,5 s
        </button>
        <button
          type="button"
          className="btn tiny ghost"
          onClick={() => run([{ op: "scene-duration", sceneId: scene.id, sec: null }])}
          title="din voce, citire și ritm"
        >
          auto
        </button>
      </div>
      <div className="row small">
        <button type="button" className="btn tiny ghost" disabled={idx <= 0} onClick={() => run([{ op: "scene-move", sceneId: scene.id, to: idx - 1 }])}>
          ← mută
        </button>
        <button
          type="button"
          className="btn tiny ghost"
          disabled={idx >= t.scenes.length - 1}
          onClick={() => run([{ op: "scene-move", sceneId: scene.id, to: idx + 1 }])}
        >
          mută →
        </button>
        <button type="button" className="btn tiny ghost" onClick={() => run([{ op: "scene-duplicate", sceneId: scene.id }])}>
          duplică
        </button>
        <button
          type="button"
          className="btn tiny ghost"
          onClick={() => {
            if (confirm(`Ștergi scena ${scene.id}? (rămâne în versiunea anterioară)`)) void run([{ op: "scene-delete", sceneId: scene.id }]);
          }}
        >
          șterge
        </button>
        <button type="button" className="btn tiny ghost" onClick={() => run([{ op: "scene-lock", sceneId: scene.id, locked: !sb.locked }])}>
          {sb.locked ? "deblochează" : "blochează"}
        </button>
        <button type="button" className="btn tiny ghost" onClick={() => run([{ op: "scene-mute", sceneId: scene.id, muted: sb.audio.sfx !== "none" }])}>
          {sb.audio.sfx === "none" ? "pornește sunetele" : "fără efecte sonore"}
        </button>
      </div>
      <div className="row small">
        <label htmlFor={`tr-${scene.id}`}>tranziție</label>
        <select
          id={`tr-${scene.id}`}
          value={sb.transitionIn?.capability ?? ""}
          onChange={(e) => run([{ op: "set-transition", sceneId: scene.id, capability: e.target.value || null, durationFrames: null }])}
          disabled={idx === 0}
        >
          <option value="">automată</option>
          {transitions.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <label htmlFor={`cam-${scene.id}`}>cameră</label>
        <select
          id={`cam-${scene.id}`}
          value={sb.camera?.capability ?? ""}
          onChange={(e) => e.target.value && run([{ op: "set-camera", sceneId: scene.id, capability: e.target.value, params: {} }])}
        >
          <option value="">a rețetei</option>
          {cameras.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>
      <div className="row small">
        <label htmlFor={`txt-${scene.id}`}>text</label>
        <input id={`txt-${scene.id}`} className="wide" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="titlul scenei" />
        <button type="button" className="btn tiny" onClick={() => run([{ op: "scene-text", sceneId: scene.id, headline }])}>
          schimbă
        </button>
      </div>
      <div className="small">
        straturi:
        {scene.layers
          .filter((l) => !l.capability.startsWith("bg.") && !l.capability.startsWith("fx."))
          .map((l) => {
            const ov = sb.overrides.find((o) => o.slot === l.id);
            return (
              <div key={l.id} className="row">
                <code>{l.capability}</code>
                <button
                  type="button"
                  className="btn tiny ghost"
                  onClick={() => run([{ op: "layer-hide", sceneId: scene.id, slot: l.id, hidden: !ov?.hidden }])}
                >
                  {ov?.hidden ? "arată" : "ascunde"}
                </button>
                <button type="button" className="btn tiny ghost" onClick={() => run([{ op: "layer-shift", sceneId: scene.id, slot: l.id, deltaSec: -0.2 }])}>
                  −0,2 s
                </button>
                <button type="button" className="btn tiny ghost" onClick={() => run([{ op: "layer-shift", sceneId: scene.id, slot: l.id, deltaSec: 0.2 }])}>
                  +0,2 s
                </button>
              </div>
            );
          })}
      </div>
      <div className="row">
        <button type="button" className="btn tiny" disabled={!canUndo} onClick={() => ctx.runJob("undo")}>
          ↶ undo
        </button>
        <button type="button" className="btn tiny" disabled={!canRedo} onClick={() => ctx.runJob("redo")}>
          ↷ redo
        </button>
        <span className="muted small">
          {edits.length ? `${edits.filter((e) => !e.undone).length} editări în ${ctx.versionId}` : "nicio editare în această versiune"}
        </span>
      </div>
    </div>
  );
}

interface FlowStage {
  id: string;
  label: string;
  done: boolean;
  detail: string;
}

/** Etapele fluxului cap-coadă, deduse din datele reale ale proiectului și ale versiunii curente. */
export function flowStages(ctx: Ctx): FlowStage[] {
  const b = ctx.bundle;
  const v = ctx.version;
  const vid = ctx.versionId;
  const claims = b.research.claims;
  const toConfirm = claims.filter((c) => c.status === "needs-confirmation").length;
  const concept = b.concepts?.concepts.find((c) => c.id === b.concepts?.selectedId);
  const formats = Object.keys(v?.timelines ?? {});
  const previews = (v?.renders ?? []).filter((r) => /preview-[^/]+\.mp4$/.test(r));
  const reviews = (v?.critique.rounds ?? []).filter((r) => r.reviewer !== "mms-auto-critic-v1");
  const q = v?.quality ?? null;
  const finalApproved = b.approvals.items.some((a) => a.kind === "render-final" && a.versionId === vid);
  return [
    { id: "brief", label: "Brief", done: b.project.status !== "intake", detail: b.project.status !== "intake" ? "aprobat" : "așteaptă „aprob”" },
    {
      id: "research",
      label: "Research",
      done: claims.length > 0,
      detail: claims.length ? `${claims.length} afirmații, ${toConfirm} de confirmat` : "fără captură",
    },
    { id: "concept", label: "Concept", done: !!concept, detail: concept ? `${concept.title} (${concept.total})` : "neales" },
    { id: "storyboard", label: "Storyboard", done: !!v?.storyboard, detail: v?.storyboard ? `${v.storyboard.scenes.length} scene` : "—" },
    {
      id: "build",
      label: "Timeline + mix",
      done: formats.length > 0 && !!v?.mixReport,
      detail: formats.length ? `${formats.join(", ")}${v?.mixReport ? ` · ${v.mixReport.integratedLufs} LUFS` : " · fără mix"}` : "—",
    },
    { id: "quality", label: "Calitate", done: !!q, detail: q ? `${q.score.overall} · ${q.score.verdict} (${q.depth})` : "—" },
    {
      id: "polish",
      label: "Corecturi",
      done: !!v?.autofix || q?.score.verdict === "PASS",
      detail: v?.autofix ? `${v.autofix.iterations.length} iterații` : q?.score.verdict === "PASS" ? "nu e nevoie" : "—",
    },
    { id: "preview", label: "Preview", done: previews.length > 0, detail: previews.length ? `${previews.length} formate` : "—" },
    {
      id: "review",
      label: "Revizuire (Claude + tu)",
      done: reviews.length > 0,
      detail: reviews.length ? reviews.map((r) => r.reviewer).join(", ") : "ascultă și notează",
    },
    { id: "approve", label: "Aprobare", done: finalApproved, detail: finalApproved ? "„render final” scris" : "scrie „render final”" },
    { id: "final-qa", label: "Final QA", done: q?.depth === "final", detail: q?.depth === "final" ? `${q.score.verdict}` : "—" },
    { id: "export", label: "Export", done: v?.meta.status === "final", detail: v?.meta.status === "final" ? "exportat" : "blocat până la aprobare" },
  ];
}

export function ProductionFlow({ ctx }: { ctx: Ctx }) {
  const stages = flowStages(ctx);
  const current = stages.find((s) => !s.done)?.id ?? null;
  const concept = Object.values(ctx.version?.timelines ?? {}).some((t) => t.concept);
  return (
    <div className="card">
      <div className="card-head">
        <h2>Unde e reclama</h2>
        <span className="muted small">
          {current ? `etapa curentă: ${stages.find((s) => s.id === current)!.label}` : "toate etapele sunt făcute"}
          {ctx.versionId ? ` · ${ctx.versionId}` : ""}
        </span>
      </div>
      <ol className="flow">
        {stages.map((s) => (
          <li key={s.id} className={s.done ? "done" : s.id === current ? "current" : ""}>
            <b>{s.label}</b>
            <span className="small muted">{s.detail}</span>
          </li>
        ))}
      </ol>
      {concept ? (
        <p className="warn small">Se folosesc materiale fără drepturi confirmate: preview-ul e marcat „concept”, iar exportul final e blocat (regula 3).</p>
      ) : null}
    </div>
  );
}
