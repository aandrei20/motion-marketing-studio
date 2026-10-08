import type { Approvals, AssetManifest, Brand, Brief, Critique, MixReport, Project, ProjectState, Research, Script, Storyboard, Timeline, VersionMeta } from "../../core/schema";

export interface ProjectBundle {
  project: Project;
  state: ProjectState;
  stateMd: string;
  brief: Brief | null;
  brand: Brand | null;
  research: Research;
  assets: AssetManifest;
  approvals: Approvals;
  versions: VersionMeta[];
}

export interface VersionBundle {
  meta: VersionMeta;
  script: Script | null;
  storyboard: Storyboard | null;
  timelines: Record<string, Timeline>;
  critique: Critique;
  mixReport: MixReport | null;
  compileReport: Record<string, { scenes: Array<{ id: string; recipe: string; durationSec: number; minSec: number; reasons: string[]; transition: string | null; notes: string[] }>; warnings: string[]; validation: { ok: boolean; findings: Array<{ timecode: string | null; frame: number | null; severity: string; problem: string; recommendation: string; sceneId: string | null }> } }> | null;
  cueSheet: Array<{ id: string; kind: string; atFrame: number; sound: string; gainDb: number; reason: string; timecode: string }> | null;
  renders: string[];
  scriptIssues: Array<{ severity: string; lineId: string | null; message: string }>;
}

export interface Job {
  id: string;
  projectId: string;
  type: string;
  label: string;
  state: "queued" | "running" | "done" | "failed";
  progress: number | null;
  log: string[];
  error: string | null;
  result: unknown;
}

export interface Meta {
  questions: Array<{ id: string; group: string; text: string; options?: string[]; multi?: boolean; required: boolean }>;
  groups: Record<string, string>;
  templates: Array<{ id: string; title: string; description: string }>;
  recipes: Array<{ id: string; title: string; description: string; roles: string[]; slots: Array<{ name: string; kind: string; required: boolean; multiple?: boolean }> }>;
  formats: string[];
  capabilities: number;
}

export interface RegistryCap {
  id: string;
  kind: string;
  category: string;
  title: string;
  description: string;
  tags: string[];
  status: string;
  sfx: Array<{ sound: string; at: string }>;
  recipes: string[];
  implementation: string;
}

async function call<T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body instanceof Blob || body instanceof ArrayBuffer ? headers : { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : body instanceof Blob || body instanceof ArrayBuffer ? body : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.error) || `${res.status} ${res.statusText}`);
  return data as T;
}

export const api = {
  meta: () => call<Meta>("GET", "/api/meta"),
  registry: () => call<{ capabilities: RegistryCap[] }>("GET", "/api/registry"),
  voices: () => call<Array<{ provider: string; name: string; language: string; gender?: string }>>("GET", "/api/voices"),
  projects: () => call<Project[]>("GET", "/api/projects"),
  createProject: (b: unknown) => call<Project>("POST", "/api/projects", b),
  project: (id: string) => call<ProjectBundle>("GET", `/api/projects/${id}`),
  version: (id: string, v: string) => call<VersionBundle>("GET", `/api/projects/${id}/versions/${v}`),
  saveBrief: (id: string, b: unknown) => call<Brief>("PUT", `/api/projects/${id}/brief`, b),
  saveBrand: (id: string, b: unknown) => call<Brand>("PUT", `/api/projects/${id}/brand`, b),
  saveScript: (id: string, v: string, s: unknown) => call<Script>("PUT", `/api/projects/${id}/versions/${v}/script`, s),
  saveStoryboard: (id: string, v: string, s: unknown) => call<Storyboard>("PUT", `/api/projects/${id}/versions/${v}/storyboard`, s),
  review: (id: string, v: string, r: unknown) => call<unknown>("POST", `/api/projects/${id}/versions/${v}/review`, r),
  approve: (id: string, kind: string, phrase: string, versionId?: string) => call<unknown>("POST", `/api/projects/${id}/approve`, { kind, phrase, versionId }),
  claim: (id: string, claimId: string, status: string) => call<unknown>("POST", `/api/projects/${id}/claims/${claimId}`, { status }),
  patchAsset: (id: string, assetId: string, b: unknown) => call<unknown>("PATCH", `/api/projects/${id}/assets/${assetId}`, b),
  upload: (id: string, file: File, opts: { role?: string; thirdParty?: boolean }) =>
    call<{ asset: { id: string }; duplicate: boolean }>("POST", `/api/projects/${id}/assets`, file, { "x-filename": file.name, ...(opts.role ? { "x-role": opts.role } : {}), ...(opts.thirdParty ? { "x-third-party": "1" } : {}) }),
  job: (id: string, type: string, params: Record<string, unknown> = {}) => call<Job>("POST", `/api/projects/${id}/jobs`, { type, params }),
  jobs: (id?: string) => call<Job[]>("GET", `/api/jobs${id ? `?project=${id}` : ""}`),
};

export const fileUrl = (publicPath: string) => `/files/${publicPath.split("/").map(encodeURIComponent).join("/")}`;
