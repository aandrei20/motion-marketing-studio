/**
 * Joburi de producție rulate pe rând (o randare odată), cu log și progres transmise interfeței.
 */
import { formatError } from "../core/errors";
import { redactSecrets } from "../core/env";

export type JobState = "queued" | "running" | "done" | "failed";

export interface Job {
  id: string;
  projectId: string;
  type: string;
  label: string;
  state: JobState;
  progress: number | null;
  log: string[];
  result: unknown;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

type Listener = (j: Job) => void;

export class JobQueue {
  private jobs: Job[] = [];
  private queue: Array<{ job: Job; run: (ctx: { log: (m: string) => void; progress: (p: number) => void }) => Promise<unknown> }> = [];
  private running = false;
  private listeners = new Set<Listener>();
  private n = 0;

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit(j: Job) {
    for (const l of this.listeners) l(j);
  }

  list(projectId?: string): Job[] {
    return this.jobs.filter((j) => !projectId || j.projectId === projectId).slice(-50);
  }

  get(id: string): Job | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  enqueue(projectId: string, type: string, label: string, run: (ctx: { log: (m: string) => void; progress: (p: number) => void }) => Promise<unknown>): Job {
    const job: Job = { id: `job-${++this.n}`, projectId, type, label, state: "queued", progress: null, log: [], result: null, error: null, createdAt: new Date().toISOString(), finishedAt: null };
    this.jobs.push(job);
    this.queue.push({ job, run });
    this.emit(job);
    void this.pump();
    return job;
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    const next = this.queue.shift();
    if (!next) return;
    this.running = true;
    const { job, run } = next;
    job.state = "running";
    this.emit(job);
    let lastEmit = 0;
    try {
      job.result = await run({
        log: (m) => {
          job.log.push(redactSecrets(m));
          this.emit(job);
        },
        progress: (p) => {
          job.progress = p;
          const now = Date.now();
          if (now - lastEmit > 250) {
            lastEmit = now;
            this.emit(job);
          }
        },
      });
      job.state = "done";
    } catch (e) {
      job.state = "failed";
      job.error = redactSecrets(formatError(e));
    }
    job.finishedAt = new Date().toISOString();
    this.emit(job);
    this.running = false;
    void this.pump();
  }
}
