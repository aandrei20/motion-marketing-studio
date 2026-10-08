import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Project } from "../../core/schema";
import { api, type Job, type Meta, type ProjectBundle, type VersionBundle } from "./api";
import { AssetsPanel, AudioPanel, BrandPanel, BriefPanel, CritiquePanel, ExportPanel, OverviewPanel, ResearchPanel, ScriptPanel, StoryboardPanel, VersionsPanel } from "./panels";
import { PreviewPanel } from "./preview";
import { NewProject } from "./new-project";

export const TABS = [
  ["overview", "Prezentare"],
  ["brief", "Brief"],
  ["assets", "Materiale"],
  ["research", "Research"],
  ["brand", "Brand"],
  ["script", "Script"],
  ["storyboard", "Storyboard"],
  ["preview", "Preview & timeline"],
  ["audio", "Audio"],
  ["critique", "Critică"],
  ["versions", "Versiuni"],
  ["export", "Export"],
] as const;
export type Tab = (typeof TABS)[number][0];

export interface Ctx {
  bundle: ProjectBundle;
  version: VersionBundle | null;
  versionId: string | null;
  formatId: string;
  meta: Meta;
  jobs: Job[];
  reload: () => Promise<void>;
  runJob: (type: string, params?: Record<string, unknown>) => Promise<Job | null>;
  setTab: (t: Tab) => void;
  seek: (frame: number) => void;
  seekRequest: { frame: number; n: number } | null;
  notify: (msg: string, kind?: "ok" | "err") => void;
}

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [current, setCurrent] = useState<string | null>(() => new URLSearchParams(location.hash.slice(1)).get("p"));
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.hash.slice(1)).get("t") as Tab) || "overview");
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [version, setVersion] = useState<VersionBundle | null>(null);
  const [formatId, setFormatId] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [seekRequest, setSeekRequest] = useState<{ frame: number; n: number } | null>(null);

  const notify = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), kind === "err" ? 9000 : 3500);
  }, []);

  const loadProjects = useCallback(async () => setProjects(await api.projects()), []);
  useEffect(() => {
    void loadProjects();
    void api.meta().then(setMeta);
    void api.jobs().then(setJobs);
    const es = new EventSource("/api/events");
    es.onmessage = (ev) => {
      const j = JSON.parse(ev.data) as Job;
      setJobs((prev) => {
        const i = prev.findIndex((x) => x.id === j.id);
        if (i < 0) return [...prev, j];
        const copy = prev.slice();
        copy[i] = j;
        return copy;
      });
    };
    return () => es.close();
  }, [loadProjects]);

  const reload = useCallback(async () => {
    if (!current) return;
    try {
      const b = await api.project(current);
      setBundle(b);
      const v = versionId && b.versions.some((x) => x.id === versionId) ? versionId : b.project.currentVersion;
      setVersionId(v);
      if (!formatId || !b.project.formats.some((f) => f.id === formatId)) setFormatId(b.project.formats[0]?.id ?? "");
      setVersion(v ? await api.version(current, v) : null);
    } catch (e) {
      notify((e as Error).message, "err");
    }
  }, [current, versionId, formatId, notify]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, versionId]);

  useEffect(() => {
    if (current) location.hash = `p=${encodeURIComponent(current)}&t=${tab}`;
  }, [current, tab]);

  // la terminarea unui job al proiectului curent, reîncărcăm datele
  const finishedKey = jobs.filter((j) => j.projectId === current && (j.state === "done" || j.state === "failed")).map((j) => j.id + j.state).join(",");
  useEffect(() => {
    if (!finishedKey) return;
    const last = jobs.filter((j) => j.projectId === current).slice(-1)[0];
    if (last?.state === "failed") notify(`${last.label}: ${last.error}`, "err");
    if (last?.state === "done") notify(`${last.label}: gata`);
    void reload().then(loadProjects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedKey]);

  const runJob = useCallback(
    async (type: string, params: Record<string, unknown> = {}) => {
      if (!current) return null;
      try {
        return await api.job(current, type, { version: versionId ?? undefined, format: formatId || undefined, ...params });
      } catch (e) {
        notify((e as Error).message, "err");
        return null;
      }
    },
    [current, versionId, formatId, notify],
  );

  const ctx: Ctx | null = useMemo(
    () =>
      bundle && meta
        ? { bundle, version, versionId, formatId, meta, jobs: jobs.filter((j) => j.projectId === current), reload, runJob, setTab, seek: (frame) => { setTab("preview"); setSeekRequest((s) => ({ frame, n: (s?.n ?? 0) + 1 })); }, seekRequest, notify }
        : null,
    [bundle, version, versionId, formatId, meta, jobs, current, reload, runJob, seekRequest, notify],
  );

  const running = jobs.filter((j) => j.state === "running" || j.state === "queued");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-mark" />
          <div>
            <div className="logo-title">Motion Marketing Studio</div>
            <div className="logo-sub">{meta ? `${meta.capabilities} capabilități · ${meta.recipes.length} rețete` : "…"}</div>
          </div>
        </div>
        <button className="btn primary wide" onClick={() => setCreating(true)}>
          + Proiect nou
        </button>
        <nav className="project-list">
          {projects.map((p) => (
            <button key={p.id} className={`project-item ${p.id === current ? "active" : ""}`} onClick={() => { setCurrent(p.id); setVersionId(null); setCreating(false); }}>
              <span className="project-name">{p.name}</span>
              <span className="project-meta">
                {p.status} · {p.currentVersion ?? "fără versiune"}
              </span>
            </button>
          ))}
          {!projects.length ? <p className="muted small">Niciun proiect încă. Creează unul sau rulează testul demo (npm run e2e).</p> : null}
        </nav>
        <div className="jobs">
          <div className="jobs-title">Joburi</div>
          {running.length === 0 ? <div className="muted small">Nimic în lucru.</div> : null}
          {running.map((j) => (
            <div key={j.id} className="job">
              <div className="job-head">
                <span>{j.label}</span>
                <span className="muted">{j.state === "queued" ? "în așteptare" : j.progress !== null ? `${Math.round(j.progress * 100)}%` : "…"}</span>
              </div>
              {j.progress !== null ? <div className="bar"><span style={{ width: `${Math.round(j.progress * 100)}%` }} /></div> : null}
              <div className="job-log">{j.log.slice(-2).join("\n")}</div>
            </div>
          ))}
        </div>
      </aside>
      <main className="main">
        {creating && meta ? (
          <NewProject meta={meta} onCancel={() => setCreating(false)} onCreated={async (id) => { await loadProjects(); setCurrent(id); setCreating(false); setTab("brief"); }} notify={notify} />
        ) : !ctx ? (
          <div className="empty">
            <h1>Alege sau creează un proiect</h1>
            <p className="muted">Fiecare proiect are brief, materiale reale, research cu surse, script, storyboard, timeline, audio, versiuni și export. Lucrul începe după ce aprobi brief-ul cu „aprob”.</p>
          </div>
        ) : (
          <>
            <header className="topbar">
              <div>
                <h1>{ctx.bundle.project.name}</h1>
                <div className="muted small">
                  {ctx.bundle.project.product.name} · {ctx.bundle.project.product.category} · stare <b>{ctx.bundle.project.status}</b>
                </div>
              </div>
              <div className="topbar-controls">
                <label>
                  Versiune
                  <select value={versionId ?? ""} onChange={(e) => setVersionId(e.target.value || null)}>
                    {ctx.bundle.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id} · {v.status}
                        {v.frozen ? " · înghețată" : ""}
                      </option>
                    ))}
                    {!ctx.bundle.versions.length ? <option value="">—</option> : null}
                  </select>
                </label>
                <label>
                  Format
                  <select value={formatId} onChange={(e) => setFormatId(e.target.value)}>
                    {ctx.bundle.project.formats.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.id} · {f.width}×{f.height} · {f.fps} fps · {f.platform}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </header>
            <CommandBar ctx={ctx} />
            <nav className="tabs">
              {TABS.map(([id, label]) => (
                <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </nav>
            <section className="panel">
              {tab === "overview" && <OverviewPanel ctx={ctx} />}
              {tab === "brief" && <BriefPanel ctx={ctx} />}
              {tab === "assets" && <AssetsPanel ctx={ctx} />}
              {tab === "research" && <ResearchPanel ctx={ctx} />}
              {tab === "brand" && <BrandPanel ctx={ctx} />}
              {tab === "script" && <ScriptPanel ctx={ctx} />}
              {tab === "storyboard" && <StoryboardPanel ctx={ctx} />}
              {tab === "preview" && <PreviewPanel ctx={ctx} />}
              {tab === "audio" && <AudioPanel ctx={ctx} />}
              {tab === "critique" && <CritiquePanel ctx={ctx} />}
              {tab === "versions" && <VersionsPanel ctx={ctx} onSelect={(v) => setVersionId(v)} />}
              {tab === "export" && <ExportPanel ctx={ctx} />}
            </section>
          </>
        )}
      </main>
      {toast ? <div className={`toast ${toast.kind}`}>{toast.msg}</div> : null}
    </div>
  );
}

function CommandBar({ ctx }: { ctx: Ctx }) {
  const [cmd, setCmd] = useState("");
  const examples = ["la 00:14 zoom pe câmpul de căutare", "CTA-ul să stea 3 secunde", "tranziții mai rapide", "mai puțină muzică sub voce", "folosește fraza mea exactă", "fă hook-ul mai agresiv", "fă-l mai premium"];
  return (
    <form
      className="command"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!cmd.trim()) return;
        const j = await ctx.runJob("iterate", { command: cmd });
        if (j) {
          ctx.notify(`Comandă trimisă: „${cmd}” (se creează o versiune nouă)`);
          setCmd("");
        }
      }}
    >
      <input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder={`Spune ce vrei schimbat… de ex. „${examples[0]}”`} list="cmd-examples" disabled={!ctx.bundle.project.currentVersion} />
      <datalist id="cmd-examples">
        {examples.map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
      <button className="btn primary" type="submit" disabled={!ctx.bundle.project.currentVersion}>
        Aplică
      </button>
    </form>
  );
}
