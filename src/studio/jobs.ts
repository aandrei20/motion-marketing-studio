/**
 * Joburi de producție rulate pe rând (o randare odată), cu log, progres, etapă, anulare și timeout.
 * Fiecare job are un manifest pe disc (.cache/jobs/<id>.json: jobId, stare, etapă, progres, startedAt,
 * updatedAt, eroare, artefacte). Dacă procesul moare, la repornire joburile neterminate apar „întrerupte”
 * și se pot relua: pașii de producție sunt idempotenți și refolosesc tot ce s-a calculat deja (cache).
 */
import fs from "node:fs";
import path from "node:path";
import { formatError, MmsError, throwIfCancelled } from "../core/errors";
import { redactSecrets } from "../core/env";
import { writeJson } from "../core/json";
import { PATHS } from "../core/paths";

export type JobState = "queued" | "running" | "done" | "failed" | "cancelled" | "interrupted";

export interface Job {
  id: string;
  projectId: string;
  type: string;
  label: string;
  params: Record<string, unknown>;
  state: JobState;
  stage: string | null;
  progress: number | null;
  log: string[];
  result: unknown;
  /** rezumatul artefactelor produse (versiune, fișiere) */
  artifacts: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  finishedAt: string | null;
}

export interface JobContext {
  log: (m: string) => void;
  progress: (p: number) => void;
  stage: (name: string) => void;
  /** semnalul de anulare (utilizatorul a oprit jobul sau a expirat timpul) */
  signal: AbortSignal;
}

type Listener = (j: Job) => void;
type Runner = (ctx: JobContext) => Promise<unknown>;

/** Timpul maxim pe tip de job (minute); peste el jobul se anulează cu mesaj clar. */
const TIMEOUT_MIN: Record<string, number> = { make: 90, final: 60, preview: 45, quality: 45, autofix: 60, capture: 15, "research-crawl": 20 };

export class JobQueue {
  private jobs: Job[] = [];
  private queue: Array<{ job: Job; run: Runner; ctl: AbortController }> = [];
  private current: { job: Job; ctl: AbortController } | null = null;
  private listeners = new Set<Listener>();
  private n = 0;
  private dir: string;

  constructor(o: { dir?: string } = {}) {
    this.dir = o.dir ?? path.join(PATHS.cache, "jobs");
    this.recover();
  }

  /** La pornire: joburile rămase „în lucru” dintr-o rulare oprită devin „întrerupte” (se pot relua). */
  private recover(): void {
    if (!fs.existsSync(this.dir)) return;
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf8")) as Job;
        if (j.state === "running" || j.state === "queued") {
          j.state = "interrupted";
          j.error = "Studio-ul s-a oprit în timpul jobului. Poți relua: pașii deja făcuți se refolosesc.";
          j.updatedAt = new Date().toISOString();
          this.persist(j);
        }
        this.jobs.push(j);
        const k = Number(j.id.replace(/\D/g, ""));
        if (Number.isFinite(k)) this.n = Math.max(this.n, k);
      } catch {
        /* manifest corupt: îl ignorăm, nu blocăm pornirea */
      }
    }
    this.jobs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // păstrăm doar istoricul recent pe disc
    for (const j of this.jobs.slice(0, Math.max(0, this.jobs.length - 200))) fs.rmSync(path.join(this.dir, `${j.id}.json`), { force: true });
    this.jobs = this.jobs.slice(-200);
  }

  private persist(j: Job): void {
    writeJson(path.join(this.dir, `${j.id}.json`), { ...j, log: j.log.slice(-200), result: summarize(j.result) });
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit(j: Job, persist = true) {
    j.updatedAt = new Date().toISOString();
    if (persist) this.persist(j);
    for (const l of this.listeners) l(j);
  }

  list(projectId?: string): Job[] {
    return this.jobs.filter((j) => !projectId || j.projectId === projectId).slice(-50);
  }

  get(id: string): Job | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  enqueue(projectId: string, type: string, label: string, params: Record<string, unknown>, run: Runner): Job {
    const t = new Date().toISOString();
    const job: Job = { id: `job-${++this.n}`, projectId, type, label, params, state: "queued", stage: null, progress: null, log: [], result: null, artifacts: {}, error: null, createdAt: t, startedAt: null, updatedAt: t, finishedAt: null };
    this.jobs.push(job);
    this.queue.push({ job, run, ctl: new AbortController() });
    this.emit(job);
    void this.pump();
    return job;
  }

  /** Oprește un job: cel din coadă dispare, cel care rulează primește semnalul de anulare. */
  cancel(id: string): Job {
    const j = this.get(id);
    if (!j) throw new MmsError("JOB_MISSING", `Nu există jobul ${id}.`);
    const queued = this.queue.findIndex((q) => q.job.id === id);
    if (queued >= 0) {
      this.queue.splice(queued, 1);
      j.state = "cancelled";
      j.finishedAt = new Date().toISOString();
      this.emit(j);
    } else if (this.current?.job.id === id) this.current.ctl.abort("Oprit de utilizator.");
    return j;
  }

  private async pump(): Promise<void> {
    if (this.current) return;
    const next = this.queue.shift();
    if (!next) return;
    const { job, run, ctl } = next;
    this.current = { job, ctl };
    job.state = "running";
    job.startedAt = new Date().toISOString();
    this.emit(job);
    const limit = (TIMEOUT_MIN[job.type] ?? 20) * 60_000;
    const timer = setTimeout(() => ctl.abort(`Timpul maxim pentru „${job.label}” (${limit / 60_000} min) a expirat.`), limit);
    let lastEmit = 0;
    try {
      job.result = await run({
        log: (m) => {
          job.log.push(redactSecrets(m));
          if (job.log.length > 2000) job.log = job.log.slice(-1500);
          this.emit(job, false);
        },
        progress: (p) => {
          job.progress = p;
          const now = Date.now();
          if (now - lastEmit > 250) {
            lastEmit = now;
            this.emit(job, false);
          }
        },
        stage: (name) => {
          job.stage = name;
          job.log.push(`— ${name} —`);
          this.emit(job);
        },
        signal: ctl.signal,
      });
      throwIfCancelled(ctl.signal);
      job.state = "done";
      job.artifacts = summarize(job.result) as Record<string, unknown>;
    } catch (e) {
      job.state = ctl.signal.aborted ? "cancelled" : "failed";
      job.error = redactSecrets(ctl.signal.aborted ? String(ctl.signal.reason ?? "Oprit.") : formatError(e));
    } finally {
      clearTimeout(timer);
    }
    job.finishedAt = new Date().toISOString();
    this.emit(job);
    this.current = null;
    void this.pump();
  }
}

/** Rezumatul rezultatului pentru manifest (fără obiecte mari: timeline-uri, cadre). */
function summarize(r: unknown): unknown {
  if (!r || typeof r !== "object") return r ?? null;
  const o = r as Record<string, unknown>;
  const keep: Record<string, unknown> = {};
  for (const k of ["versionId", "finalVersion", "startVersion", "file", "contactSheet", "request", "stopReason", "reused", "renderMs"]) if (k in o) keep[k] = o[k];
  const score = (o.score ?? (o.run as Record<string, unknown> | undefined)?.score ?? o.finalScore) as { overall?: number; verdict?: string } | undefined;
  if (score?.overall !== undefined) keep.score = { overall: score.overall, verdict: score.verdict };
  return keep;
}
