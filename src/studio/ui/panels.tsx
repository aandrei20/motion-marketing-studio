import React, { useEffect, useMemo, useState } from "react";
import type { Asset, Brief, Claim, Script, Storyboard } from "../../core/schema";
import type { Ctx } from "./App";
import { api, fileUrl } from "./api";

const tc = (frames: number, fps: number) => {
  const s = frames / fps;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
};

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
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

/** Salvează în versiunea curentă; dacă e înghețată, creează întâi versiunea următoare. */
async function saveVersioned(ctx: Ctx, kind: "script" | "storyboard", data: unknown): Promise<void> {
  const id = ctx.bundle.project.id;
  const v = ctx.versionId;
  if (!v) throw new Error("Nu există versiune.");
  const frozen = ctx.bundle.versions.find((x) => x.id === v)?.frozen;
  let target = v;
  if (frozen) {
    if (!window.confirm(`Versiunea ${v} e înghețată (nu se mai modifică). Creez versiunea următoare cu modificările tale?`)) return;
    const meta = await fetch(`/api/projects/${id}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: v, label: `editare ${kind}` }) }).then((r) => r.json());
    if (meta.error) throw new Error(meta.error);
    target = meta.id;
  }
  if (kind === "script") await api.saveScript(id, target, data);
  else await api.saveStoryboard(id, target, data);
  ctx.notify(`${kind === "script" ? "Script" : "Storyboard"} salvat în ${target}. Recompilează ca să vezi efectul.`);
  await ctx.reload();
}

// ─── Prezentare ─────────────────────────────────────────────────────────────

function Markdownish({ text }: { text: string }) {
  return (
    <div className="md">
      {text.split("\n").map((l, i) => {
        if (l.startsWith("# ")) return <h2 key={i}>{l.slice(2)}</h2>;
        if (l.startsWith("## ")) return <h3 key={i}>{l.slice(3)}</h3>;
        if (l.startsWith("- ") || l.startsWith("  - ")) return <div key={i} className={l.startsWith("  ") ? "li sub" : "li"} dangerouslySetInnerHTML={{ __html: l.replace(/^\s*- /, "").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>") }} />;
        return l.trim() ? <p key={i}>{l}</p> : null;
      })}
    </div>
  );
}

export function OverviewPanel({ ctx }: { ctx: Ctx }) {
  const p = ctx.bundle.project;
  const approved = p.status !== "intake";
  return (
    <div className="cols">
      <Section title="Pașii de producție">
        <p className="muted small">Fiecare pas e un job; progresul apare în stânga. Lucrul de producție începe doar după aprobarea brief-ului.</p>
        <div className="steps">
          <button className="btn" disabled={!approved} onClick={() => ctx.runJob("capture", { demo: false, url: p.product.url, captureId: `cap-${Date.now() % 100000}` })}>
            Captură reală (URL produs)
          </button>
          <button className="btn" disabled={!approved} onClick={() => ctx.runJob("brand")}>
            Brand kit din captură
          </button>
          <button className="btn" disabled={!approved} onClick={() => ctx.runJob("script")}>
            Schiță de script
          </button>
          <button className="btn" disabled={!approved} onClick={() => ctx.runJob("storyboard")}>
            Storyboard
          </button>
          <button className="btn" disabled={!ctx.versionId} onClick={() => ctx.runJob("voice")}>
            Voce
          </button>
          <button className="btn" disabled={!ctx.versionId} onClick={() => ctx.runJob("compile")}>
            Compilează timeline
          </button>
          <button className="btn" disabled={!ctx.versionId} onClick={() => ctx.runJob("audio")}>
            Audio (mix)
          </button>
          <button className="btn" disabled={!ctx.versionId} onClick={() => ctx.runJob("preview")}>
            Preview
          </button>
          <button className="btn primary" disabled={!approved} onClick={() => ctx.runJob("make")}>
            Producție completă
          </button>
        </div>
        {!approved ? <p className="warn">Brief-ul nu e aprobat. Completează-l în tabul Brief și scrie „aprob”.</p> : null}
        <h3>Joburi recente</h3>
        <div className="joblist">
          {ctx.jobs.slice(-8).reverse().map((j) => (
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
  );
}

// ─── Brief ──────────────────────────────────────────────────────────────────

const EMPTY_BRIEF: Brief = {
  schemaVersion: 1,
  objective: "signups",
  objectiveNote: "",
  audience: { description: "", painPoints: [], sophistication: "mixed" },
  userVision: { story: "", hooks: [], mandatoryPhrases: [], roughScript: "", concept: "" },
  tone: [],
  desiredEmotion: "",
  pacing: "medium",
  direction: null,
  visual: { effectsLevel: "medium", forbiddenCapabilities: [], allow3d: true, faces: false, notes: "" },
  cta: { text: "", claimIds: [] },
  doNotSay: [],
  doNotShow: [],
  platforms: ["tiktok"],
  durationSec: 30,
  audio: { voice: { mode: "tts", provider: "windows", voiceId: "", rate: 1 }, music: { mode: "synth", mood: "driving" }, sfxDensity: "medium", intentionalSilence: false },
  references: [],
  captions: { burnIn: true, srt: true },
  approvedAt: null,
};

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function BriefPanel({ ctx }: { ctx: Ctx }) {
  const [b, setB] = useState<Brief>(ctx.bundle.brief ?? EMPTY_BRIEF);
  const [raw, setRaw] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");
  const [voices, setVoices] = useState<Array<{ provider: string; name: string; language: string }>>([]);
  const [suggest, setSuggest] = useState<Array<{ direction: string; why: string }>>([]);
  useEffect(() => setB(ctx.bundle.brief ?? EMPTY_BRIEF), [ctx.bundle.brief]);
  useEffect(() => void api.voices().then(setVoices).catch(() => undefined), []);
  const up = (patch: Partial<Brief>) => setB((x) => ({ ...x, ...patch }));
  const save = async () => {
    try {
      const data = raw !== null ? JSON.parse(raw) : b;
      await api.saveBrief(ctx.bundle.project.id, data);
      ctx.notify("Brief salvat.");
      setRaw(null);
      await ctx.reload();
    } catch (e) {
      ctx.notify((e as Error).message, "err");
    }
  };
  const approvedAt = ctx.bundle.approvals.items.find((a) => a.kind === "brief")?.at;
  return (
    <div className="cols">
      <Section title="Brief" aside={<button className="btn ghost" onClick={() => setRaw(raw === null ? JSON.stringify(b, null, 2) : null)}>{raw === null ? "JSON avansat" : "Formular"}</button>}>
        {raw !== null ? (
          <textarea className="code" rows={30} value={raw} onChange={(e) => setRaw(e.target.value)} />
        ) : (
          <div className="form">
            <h3>A. Produs și obiectiv</h3>
            <label>
              Obiectiv
              <select value={b.objective} onChange={(e) => up({ objective: e.target.value as Brief["objective"] })}>
                {["awareness", "signups", "downloads", "sales", "launch", "feature-adoption", "other"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label>
              Funcții de arătat (în ordinea importanței) / note
              <textarea rows={2} value={b.objectiveNote} onChange={(e) => up({ objectiveNote: e.target.value })} />
            </label>
            <label>
              Public
              <textarea rows={2} value={b.audience.description} onChange={(e) => up({ audience: { ...b.audience, description: e.target.value } })} />
            </label>
            <label>
              Ce îl doare (câte una pe rând)
              <textarea rows={2} value={b.audience.painPoints.join("\n")} onChange={(e) => up({ audience: { ...b.audience, painPoints: lines(e.target.value) } })} />
            </label>
            <div className="grid2">
              <label>
                CTA (text exact)
                <input value={b.cta.text} onChange={(e) => up({ cta: { ...b.cta, text: e.target.value } })} />
              </label>
              <label>
                Link CTA
                <input value={b.cta.url ?? ""} onChange={(e) => up({ cta: { ...b.cta, url: e.target.value || undefined } })} />
              </label>
            </div>
            <label>
              Ce NU se spune (câte una pe rând)
              <textarea rows={2} value={b.doNotSay.join("\n")} onChange={(e) => up({ doNotSay: lines(e.target.value) })} />
            </label>
            <h3>B. Platformă și durată</h3>
            <div className="chips">
              {["tiktok", "reels", "shorts", "youtube", "feed", "linkedin", "x"].map((p) => (
                <label key={p} className="check">
                  <input type="checkbox" checked={b.platforms.includes(p as never)} onChange={(e) => up({ platforms: (e.target.checked ? [...b.platforms, p] : b.platforms.filter((x) => x !== p)) as Brief["platforms"] })} /> {p}
                </label>
              ))}
            </div>
            <label>
              Durata țintă (s)
              <input type="number" value={b.durationSec} onChange={(e) => up({ durationSec: Number(e.target.value) })} />
            </label>
            <h3>C. Poveste și creativ (cuvintele tale se păstrează exact)</h3>
            <label>
              Povestea ta
              <textarea rows={2} value={b.userVision.story} onChange={(e) => up({ userVision: { ...b.userVision, story: e.target.value } })} />
            </label>
            <label>
              Hook-urile tale (câte unul pe rând)
              <textarea rows={2} value={b.userVision.hooks.join("\n")} onChange={(e) => up({ userVision: { ...b.userVision, hooks: lines(e.target.value) } })} />
            </label>
            <label>
              Fraze obligatorii, exacte (câte una pe rând)
              <textarea rows={2} value={b.userVision.mandatoryPhrases.map((m) => m.text).join("\n")} onChange={(e) => up({ userVision: { ...b.userVision, mandatoryPhrases: lines(e.target.value).map((t, i) => ({ id: `fraza-${i + 1}`, text: t, channel: "any" as const })) } })} />
            </label>
            <div className="grid2">
              <label>
                Direcția
                <select value={b.direction ?? ""} onChange={(e) => up({ direction: (e.target.value || null) as Brief["direction"] })}>
                  <option value="">propune-mi</option>
                  <option value="emotional">A – emoțional</option>
                  <option value="aggressive">B – agresiv</option>
                  <option value="premium">C – premium / cinematic</option>
                  <option value="technical">D – tehnic</option>
                  <option value="minimal">E – minimal</option>
                  <option value="energetic">F – energic / social</option>
                </select>
              </label>
              <label>
                Ritm
                <select value={b.pacing} onChange={(e) => up({ pacing: e.target.value as Brief["pacing"] })}>
                  {["slow", "medium", "fast", "aggressive"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
              <label>
                Ton (cuvinte, separate prin virgulă)
                <input value={b.tone.join(", ")} onChange={(e) => up({ tone: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
              </label>
              <label>
                Nivel de efecte
                <select value={b.visual.effectsLevel} onChange={(e) => up({ visual: { ...b.visual, effectsLevel: e.target.value as Brief["visual"]["effectsLevel"] } })}>
                  {["subtle", "medium", "bold"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            </div>
            {!b.direction ? (
              <div>
                <button className="btn ghost" onClick={async () => setSuggest(await (await fetch("/api/suggest-directions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tone: b.tone, pacing: b.pacing, category: ctx.bundle.project.product.category, platforms: b.platforms }) })).json())}>
                  Propune 3 direcții
                </button>
                {suggest.map((s) => (
                  <div key={s.direction} className="suggest" onClick={() => up({ direction: s.direction as Brief["direction"] })}>
                    {s.why} <span className="muted">(alege)</span>
                  </div>
                ))}
              </div>
            ) : null}
            <label>
              Capabilități interzise (id-uri din registry, separate prin virgulă)
              <input value={b.visual.forbiddenCapabilities.join(", ")} onChange={(e) => up({ visual: { ...b.visual, forbiddenCapabilities: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} />
            </label>
            <h3>E/F. Limbă, subtitrări, audio</h3>
            <div className="grid2">
              <label>
                Vocea
                <select value={b.audio.voice.mode} onChange={(e) => up({ audio: { ...b.audio, voice: { ...b.audio.voice, mode: e.target.value as Brief["audio"]["voice"]["mode"] } } })}>
                  <option value="tts">TTS</option>
                  <option value="user-file">vocea mea (fișier)</option>
                  <option value="none">fără voce</option>
                </select>
              </label>
              {b.audio.voice.mode === "tts" ? (
                <label>
                  Vocea TTS
                  <select value={`${b.audio.voice.provider ?? ""}|${b.audio.voice.voiceId ?? ""}`} onChange={(e) => { const [provider, voiceId] = e.target.value.split("|"); up({ audio: { ...b.audio, voice: { ...b.audio.voice, provider, voiceId } } }); }}>
                    <option value="|">— alege —</option>
                    {voices.map((v) => (
                      <option key={`${v.provider}|${v.name}`} value={`${v.provider}|${v.name}`}>
                        {v.provider} · {v.name} · {v.language}
                      </option>
                    ))}
                  </select>
                </label>
              ) : b.audio.voice.mode === "user-file" ? (
                <label>
                  Fișierul vocii (asset)
                  <select value={b.audio.voice.assetId ?? ""} onChange={(e) => up({ audio: { ...b.audio, voice: { ...b.audio.voice, assetId: e.target.value || undefined } } })}>
                    <option value="">— alege —</option>
                    {ctx.bundle.assets.assets.filter((a) => a.type === "audio").map((a) => <option key={a.id} value={a.id}>{a.originalName}</option>)}
                  </select>
                </label>
              ) : <span />}
              <label>
                Muzica
                <select value={b.audio.music.mode} onChange={(e) => up({ audio: { ...b.audio, music: { ...b.audio.music, mode: e.target.value as Brief["audio"]["music"]["mode"] } } })}>
                  <option value="synth">sintetizată de studio (originală)</option>
                  <option value="user-file">muzica mea (fișier)</option>
                  <option value="none">fără muzică</option>
                </select>
              </label>
              {b.audio.music.mode === "synth" ? (
                <label>
                  Dispoziția muzicii
                  <select value={b.audio.music.mood} onChange={(e) => up({ audio: { ...b.audio, music: { ...b.audio.music, mood: e.target.value as Brief["audio"]["music"]["mood"] } } })}>
                    {["driving", "uplifting", "dark", "calm", "playful"].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
              ) : b.audio.music.mode === "user-file" ? (
                <label>
                  Fișierul muzicii (asset)
                  <select value={b.audio.music.assetId ?? ""} onChange={(e) => up({ audio: { ...b.audio, music: { ...b.audio.music, assetId: e.target.value || undefined } } })}>
                    <option value="">— alege —</option>
                    {ctx.bundle.assets.assets.filter((a) => a.type === "audio").map((a) => <option key={a.id} value={a.id}>{a.originalName}</option>)}
                  </select>
                </label>
              ) : <span />}
              <label>
                Efecte sonore
                <select value={b.audio.sfxDensity} onChange={(e) => up({ audio: { ...b.audio, sfxDensity: e.target.value as Brief["audio"]["sfxDensity"] } })}>
                  {["none", "low", "medium", "high"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={b.captions.burnIn} onChange={(e) => up({ captions: { ...b.captions, burnIn: e.target.checked } })} /> subtitrări arse în video
              </label>
            </div>
          </div>
        )}
        <div className="actions">
          <button className="btn primary" onClick={save}>
            Salvează brief-ul
          </button>
        </div>
      </Section>
      <Section title="Aprobare">
        {approvedAt ? (
          <p className="ok">Brief aprobat la {approvedAt.slice(0, 16).replace("T", " ")}.</p>
        ) : (
          <>
            <p>Lucrul începe doar după ce scrii exact <b>aprob</b>.</p>
            <div className="row">
              <input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="aprob" />
              <button className="btn primary" disabled={!ctx.bundle.brief} onClick={async () => { try { await api.approve(ctx.bundle.project.id, "brief", phrase); ctx.notify("Brief aprobat."); await ctx.reload(); } catch (e) { ctx.notify((e as Error).message, "err"); } }}>
                Aprob
              </button>
            </div>
          </>
        )}
        <h3>Întrebările de început (A–H)</h3>
        {Object.entries(ctx.meta.groups).map(([g, label]) => (
          <details key={g}>
            <summary>
              {g}. {label}
            </summary>
            <ul>
              {ctx.meta.questions.filter((q) => q.group === g).map((q) => (
                <li key={q.id}>
                  {q.text} {q.options ? <span className="muted small">({q.options.join(" · ")})</span> : null}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </Section>
    </div>
  );
}

// ─── Materiale ──────────────────────────────────────────────────────────────

function AssetCard({ a, ctx }: { a: Asset; ctx: Ctx }) {
  const src = fileUrl(`projects/${ctx.bundle.project.id}/${a.file}`);
  const patch = async (b: Record<string, unknown>) => {
    try {
      await api.patchAsset(ctx.bundle.project.id, a.id, b);
      await ctx.reload();
    } catch (e) {
      ctx.notify((e as Error).message, "err");
    }
  };
  const f = a.analysis.focalPoint;
  return (
    <div className="asset">
      <div className="thumb" onClick={(e) => {
        if (a.type !== "image" && a.type !== "svg") return;
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        void patch({ focalPoint: { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } });
      }} title="Clic pe imagine = punct focal">
        {a.type === "image" || a.type === "svg" ? <img src={src} alt="" /> : a.type === "video" ? <video src={src} muted controls /> : a.type === "audio" ? <audio src={src} controls /> : <div className="file-type">{a.type}</div>}
        {f && (a.type === "image" || a.type === "svg") ? <span className="focal" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }} /> : null}
      </div>
      <div className="asset-body">
        <div className="asset-name" title={a.originalName}>{a.originalName}</div>
        <div className="muted small">
          {a.id} · {a.origin} · {a.media.width ? `${a.media.width}×${a.media.height}` : ""} {a.media.durationSec ? `${a.media.durationSec.toFixed(1)} s` : ""}
          {a.capture ? ` · ${a.capture.regions.length} zone` : ""}
          {a.analysis.bpm ? ` · ${a.analysis.bpm} BPM` : ""}
        </div>
        <label className="small">
          Rol
          <select value={a.role} onChange={(e) => patch({ role: e.target.value })}>
            {["screenshot", "screen-recording", "logo", "product-image", "photo", "background", "icon", "music", "voiceover", "sfx", "font", "brand-guide", "reference-video", "reference-image", "document", "other"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        {a.analysis.palette.length ? (
          <div className="palette">
            {a.analysis.palette.slice(0, 6).map((c) => <span key={c} style={{ background: c }} title={c} />)}
          </div>
        ) : null}
        {a.rights.thirdParty ? (
          <div className={`rights ${a.rights.status}`}>
            Material al unui terț: <b>{a.rights.status}</b>
            {a.rights.status !== "confirmed-by-user" ? (
              <div className="row">
                <span className="small">Ai dreptul să-l folosești?</span>
                <button className="btn tiny" onClick={() => patch({ rights: "confirmed-by-user" })}>Da</button>
                <button className="btn tiny ghost" onClick={() => patch({ rights: "denied" })}>Nu</button>
              </div>
            ) : null}
          </div>
        ) : null}
        {a.pii.regions.length ? (
          <div className="warn small">
            {a.pii.regions.length} zone cu date personale.{" "}
            {a.pii.blurApproved ? "Estomparea e aprobată." : <button className="btn tiny" onClick={() => patch({ blurApproved: true })}>Aprob estomparea</button>}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AssetsPanel({ ctx }: { ctx: Ctx }) {
  const [url, setUrl] = useState(ctx.bundle.project.product.url ?? "");
  const [viewport, setViewport] = useState("desktop");
  const [full, setFull] = useState(false);
  const [research, setResearch] = useState(true);
  const [third, setThird] = useState(false);
  const [busy, setBusy] = useState(false);
  const assets = ctx.bundle.assets.assets;
  return (
    <div>
      <div className="cols">
        <Section title="Captură reală (Playwright)">
          <p className="muted small">Un browser automat deschide pagina și face capturi 2× cu zonele din DOM (butoane, câmpuri, carduri). Interfața nu se redesenează niciodată.</p>
          <label>
            URL
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </label>
          <div className="row">
            <select value={viewport} onChange={(e) => setViewport(e.target.value)}>
              {["desktop", "laptop", "tablet", "mobile"].map((v) => <option key={v}>{v}</option>)}
            </select>
            <label className="check"><input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> pagină întreagă</label>
            <label className="check"><input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} /> textul intră în research</label>
          </div>
          <div className="actions">
            <button className="btn ghost" onClick={() => ctx.runJob("capture", { demo: true })}>Capturează produsul demo</button>
            <button className="btn primary" disabled={!url} onClick={() => ctx.runJob("capture", { url, viewport, fullPage: full, research, captureId: `cap-${Date.now() % 100000}` })}>Capturează</button>
          </div>
          <p className="muted small">Pentru pagini cu autentificare: <code>npm run mms -- login --url … --profile nume</code>, apoi capturează cu <code>--profile nume</code>.</p>
        </Section>
        <Section title="Încarcă fișiere">
          <p className="muted small">Logo, capturi, video, muzică, voce, fonturi, PDF-uri, referințe. Duplicatele exacte se recunosc după conținut.</p>
          <label className="check"><input type="checkbox" checked={third} onChange={(e) => setThird(e.target.checked)} /> materialele sunt ale altcuiva (întreb de drepturi)</label>
          <input
            type="file"
            multiple
            disabled={busy}
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              setBusy(true);
              for (const f of files) {
                try {
                  const r = await api.upload(ctx.bundle.project.id, f, { thirdParty: third });
                  ctx.notify(`${f.name}: ${r.duplicate ? "există deja" : "adăugat"}`);
                } catch (err) {
                  ctx.notify(`${f.name}: ${(err as Error).message}`, "err");
                }
              }
              setBusy(false);
              e.target.value = "";
              await ctx.reload();
            }}
          />
        </Section>
      </div>
      <Section title={`Materiale (${assets.length})`}>
        <div className="asset-grid">
          {assets.map((a) => <AssetCard key={a.id} a={a} ctx={ctx} />)}
        </div>
      </Section>
    </div>
  );
}

// ─── Research ───────────────────────────────────────────────────────────────

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
        <span className={`chip ${c.status}`}>{c.status}</span> <span className="chip kind">{c.kind}</span> <span className="chip">{c.category}</span> <span className="muted small">încredere {c.confidence}</span>
      </div>
      <div className="claim-text">{c.text}</div>
      {c.quote && c.quote !== c.text ? <blockquote>{c.quote}</blockquote> : null}
      <div className="muted small">
        {c.id} · surse: {c.sourceIds.join(", ")} · {c.checkedAt.slice(0, 10)} {c.notes ? `· ${c.notes}` : ""}
      </div>
      <div className="row">
        {c.status !== "approved-by-user" ? <button className="btn tiny" onClick={() => set(c, "approved-by-user")}>Confirm (poate intra în video)</button> : null}
        {c.status !== "rejected" ? <button className="btn tiny ghost" onClick={() => set(c, "rejected")}>Resping</button> : null}
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
            <span className="chip">{s.kind}</span> <b>{s.title}</b> <span className="muted small">{s.url ?? s.assetId} · {s.fetchedAt.slice(0, 10)} · {s.reliability}</span>
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

// ─── Brand ──────────────────────────────────────────────────────────────────

export function BrandPanel({ ctx }: { ctx: Ctx }) {
  const [b, setB] = useState(ctx.bundle.brand);
  useEffect(() => setB(ctx.bundle.brand), [ctx.bundle.brand]);
  if (!b)
    return (
      <Section title="Brand kit">
        <p>Nu există încă. Se deduce din captura site-ului și din logo.</p>
        <button className="btn primary" onClick={() => ctx.runJob("brand")}>Deduce brand kit-ul</button>
      </Section>
    );
  const colorKeys = ["primary", "accent", "secondary", "background", "surface", "text", "textMuted"] as const;
  const logos = ctx.bundle.assets.assets.filter((a) => a.role === "logo");
  const fonts = ["Inter", "Archivo", "Space Grotesk", "Instrument Serif", "JetBrains Mono", "Manrope"];
  const fontRef: Record<string, string> = { Inter: "inter", Archivo: "archivo", "Space Grotesk": "space-grotesk", "Instrument Serif": "instrument-serif", "JetBrains Mono": "jetbrains-mono", Manrope: "manrope" };
  return (
    <div className="cols">
      <Section title="Culori" aside={<span className="muted small">sursă: {b.colors.origin}</span>}>
        <div className="colors">
          {colorKeys.map((k) => (
            <label key={k} className="color">
              <input type="color" value={(b.colors[k] as string | undefined) ?? "#000000"} onChange={(e) => setB({ ...b, colors: { ...b.colors, [k]: e.target.value, origin: "user" } })} />
              <span>{k}</span>
              <code>{b.colors[k]}</code>
            </label>
          ))}
        </div>
        <div className="brand-preview" style={{ background: b.colors.background, color: b.colors.text, fontFamily: b.typography.display.family }}>
          <div style={{ fontSize: 34, fontWeight: 800 }}>
            Titlu cu <span style={{ color: b.colors.accent }}>accent</span>
          </div>
          <div style={{ fontFamily: b.typography.body.family, color: b.colors.textMuted }}>Text secundar în fontul de corp.</div>
          <span className="pill" style={{ background: b.colors.primary }}>Buton principal</span>
        </div>
      </Section>
      <Section title="Tipografie, logo, reguli">
        {(["display", "body"] as const).map((role) => (
          <label key={role}>
            Font {role === "display" ? "titluri" : "corp"}
            <select value={b.typography[role].family} onChange={(e) => setB({ ...b, typography: { ...b.typography, [role]: { ...b.typography[role], family: e.target.value, source: "library", ref: fontRef[e.target.value] }, origin: "user" } })}>
              {fonts.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={b.typography.display.uppercase} onChange={(e) => setB({ ...b, typography: { ...b.typography, display: { ...b.typography.display, uppercase: e.target.checked } } })} /> titluri cu majuscule
        </label>
        <label>
          Logo principal
          <select value={b.logo.primary ?? ""} onChange={(e) => setB({ ...b, logo: { ...b.logo, primary: e.target.value || undefined } })}>
            <option value="">—</option>
            {logos.map((l) => <option key={l.id} value={l.id}>{l.originalName}</option>)}
          </select>
        </label>
        <p className="muted small">Logo-ul se folosește la scară uniformă: fără recolorare, rotire sau deformare.</p>
        <button className="btn primary" onClick={async () => { try { await api.saveBrand(ctx.bundle.project.id, b); ctx.notify("Brand salvat. Recompilează versiunea ca să se aplice."); await ctx.reload(); } catch (e) { ctx.notify((e as Error).message, "err"); } }}>
          Salvează brand kit-ul
        </button>
      </Section>
    </div>
  );
}

// ─── Script ─────────────────────────────────────────────────────────────────

export function ScriptPanel({ ctx }: { ctx: Ctx }) {
  const [s, setS] = useState<Script | null>(ctx.version?.script ?? null);
  useEffect(() => setS(ctx.version?.script ?? null), [ctx.version?.script]);
  if (!s)
    return (
      <Section title="Script">
        <p>Nu există încă. Schița se face din faptele verificate și din cuvintele tale (hook, fraze obligatorii, CTA); Claude o rescrie creativ în Claude Code.</p>
        <button className="btn primary" onClick={() => ctx.runJob("script")}>Fă schița</button>
      </Section>
    );
  const upLine = (i: number, patch: Partial<Script["lines"][number]>) => setS({ ...s, lines: s.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  return (
    <div>
      {ctx.version?.scriptIssues.length ? (
        <Section title="Verificări">
          {ctx.version.scriptIssues.map((i, k) => (
            <div key={k} className={`issue ${i.severity}`}>
              [{i.severity}] {i.lineId ? <code>{i.lineId}</code> : null} {i.message}
            </div>
          ))}
        </Section>
      ) : null}
      <Section title={`Script (${s.lines.length} replici · text ${s.textLanguage} · voce ${s.voiceLanguage ?? "—"})`} aside={<button className="btn primary" onClick={() => saveVersioned(ctx, "script", s).catch((e) => ctx.notify((e as Error).message, "err"))}>Salvează</button>}>
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
                  <div className="small muted">{l.isHook ? "hook" : l.isCta ? "CTA" : ""} {l.emotion}</div>
                </td>
                <td>
                  <textarea rows={2} value={l.onScreen} onChange={(e) => upLine(i, { onScreen: e.target.value, origin: l.origin === "user-verbatim" ? "user-polished" : l.origin })} />
                </td>
                <td>
                  <textarea rows={2} value={l.voiceover} onChange={(e) => upLine(i, { voiceover: e.target.value, origin: l.origin === "user-verbatim" ? "user-polished" : l.origin })} />
                </td>
                <td>
                  <input value={l.emphasis.join(", ")} onChange={(e) => upLine(i, { emphasis: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
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

// ─── Storyboard ─────────────────────────────────────────────────────────────

export function StoryboardPanel({ ctx }: { ctx: Ctx }) {
  const [sb, setSb] = useState<Storyboard | null>(ctx.version?.storyboard ?? null);
  const [caps, setCaps] = useState<{ transitions: string[]; cameras: string[] }>({ transitions: [], cameras: [] });
  useEffect(() => setSb(ctx.version?.storyboard ?? null), [ctx.version?.storyboard]);
  useEffect(() => void api.registry().then((r) => setCaps({ transitions: r.capabilities.filter((c) => c.kind === "transition").map((c) => c.id), cameras: r.capabilities.filter((c) => c.kind === "camera").map((c) => c.id) })), []);
  const report = ctx.version?.compileReport?.[ctx.formatId];
  if (!sb)
    return (
      <Section title="Storyboard">
        <p>Nu există încă. Se construiește din șablon + script + materiale.</p>
        <button className="btn primary" onClick={() => ctx.runJob("storyboard")}>Construiește storyboard-ul</button>
      </Section>
    );
  const up = (i: number, patch: Partial<Storyboard["scenes"][number]>) => setSb({ ...sb, scenes: sb.scenes.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const tl = ctx.version?.timelines[ctx.formatId];
  return (
    <div>
      <Section title={`Storyboard (${sb.scenes.length} scene${sb.templateId ? ` · șablon ${sb.templateId}` : ""}${sb.direction ? ` · direcție ${sb.direction}` : ""})`} aside={<div className="row"><button className="btn" onClick={() => ctx.runJob("compile")}>Recompilează</button><button className="btn primary" onClick={() => saveVersioned(ctx, "storyboard", sb).catch((e) => ctx.notify((e as Error).message, "err"))}>Salvează</button></div>}>
        {sb.rationale.map((r, i) => <div key={i} className="muted small">• {r}</div>)}
        <div className="scenes">
          {sb.scenes.map((s, i) => {
            const rep = report?.scenes.find((x) => x.id === s.id);
            const ts = tl?.scenes.find((x) => x.id === s.id);
            return (
              <div key={s.id} className="scene">
                <div className="scene-head">
                  <b>{i + 1}. {s.id}</b>
                  <span className="chip">{s.narrativeRole}</span>
                  <span className="chip">{s.emotionalRole}</span>
                  {ts ? <button className="btn tiny ghost" onClick={() => ctx.seek(ts.from + 1)}>{tc(ts.from, tl!.fps)} · {(ts.durationInFrames / tl!.fps).toFixed(2)} s</button> : null}
                </div>
                <div className="muted small">{s.purpose}</div>
                <div className="grid2 tight">
                  <label>
                    Rețeta
                    <select value={s.recipe.id} onChange={(e) => up(i, { recipe: { id: e.target.value, params: {} } })}>
                      {ctx.meta.recipes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                    </select>
                  </label>
                  <label>
                    Durata (s, gol = automat)
                    <input type="number" step={0.1} value={s.durationSec ?? ""} onChange={(e) => up(i, { durationSec: e.target.value ? Number(e.target.value) : null })} />
                  </label>
                  <label>
                    Titlu pe ecran
                    <input value={s.text.headline ?? ""} onChange={(e) => up(i, { text: { ...s.text, headline: e.target.value || undefined } })} />
                  </label>
                  <label>
                    Text secundar / CTA
                    <input value={s.text.sub ?? ""} onChange={(e) => up(i, { text: { ...s.text, sub: e.target.value || undefined } })} />
                  </label>
                  <label>
                    Tranziția de intrare
                    <select value={s.transitionIn?.capability ?? ""} onChange={(e) => up(i, { transitionIn: e.target.value ? { capability: e.target.value, durationFrames: null, params: {} } : null })}>
                      <option value="">automat (gramatica de montaj)</option>
                      {caps.transitions.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </label>
                  <label>
                    Camera
                    <select value={s.camera?.capability ?? ""} onChange={(e) => up(i, { camera: e.target.value ? { capability: e.target.value, params: {} } : undefined })}>
                      <option value="">din rețetă</option>
                      {caps.cameras.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </label>
                  <label>
                    Energie {s.energy.toFixed(2)}
                    <input type="range" min={0} max={1} step={0.05} value={s.energy} onChange={(e) => up(i, { energy: Number(e.target.value) })} />
                  </label>
                  <label>
                    Materiale
                    <input value={Object.entries(s.slots).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("|") : v}`).join(", ")} onChange={(e) => up(i, { slots: Object.fromEntries(e.target.value.split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const [k, v] = x.split("="); return [k, v?.includes("|") ? v.split("|") : (v ?? "")]; })) })} />
                  </label>
                </div>
                {rep ? <div className="muted small">Durata: {rep.reasons.join("; ")} · tranziție {rep.transition ?? "—"}{rep.notes.length ? ` · ${rep.notes.join(" ")}` : ""}</div> : null}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ─── Audio ──────────────────────────────────────────────────────────────────

export function AudioPanel({ ctx }: { ctx: Ctx }) {
  const m = ctx.version?.mixReport;
  const tl = ctx.version?.timelines[ctx.formatId];
  const [notes, setNotes] = useState("");
  const mixUrl = tl?.audio.src ? fileUrl(tl.audio.src) : null;
  return (
    <div className="cols">
      <Section title="Mix" aside={<button className="btn" onClick={() => ctx.runJob("audio")}>Refă mixul</button>}>
        {m ? (
          <>
            <div className="stats">
              <div><b>{m.integratedLufs ?? "—"}</b><span>LUFS (țintă {m.targetLufs})</span></div>
              <div><b>{m.truePeakDbtp}</b><span>dBTP (plafon {m.truePeakCeiling})</span></div>
              <div><b>{m.clippedSamples}</b><span>eșantioane la limită</span></div>
              <div><b>{m.silences.filter((s) => !s.intentional).length}</b><span>tăceri neintenționate</span></div>
            </div>
            <p className={m.ok ? "ok" : "warn"}>{m.ok ? "Mixul trece verificările tehnice." : m.problems.join(" ")}</p>
            {mixUrl ? <audio controls src={mixUrl} className="wide" /> : null}
            <p className="muted small">Recenzenții AI nu aud: ascultă cu atenție (pe telefon, la volum normal) și notează problemele pe timestamp.</p>
          </>
        ) : (
          <p>Nu există încă un mix pentru această versiune.</p>
        )}
        <h3>Ajustări (versiune nouă, prin comenzi)</h3>
        <div className="steps">
          {["mai puțină muzică sub voce", "muzica mai tare", "muzica mai încet", "efectele sonore mai încet", "fără muzică"].map((c) => (
            <button key={c} className="btn tiny" onClick={() => ctx.runJob("iterate", { command: c })}>{c}</button>
          ))}
        </div>
        <h3>Notele tale după ascultare</h3>
        <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={"secunda 7,3: logo-ul e prea mic\n11: muzica sună ciudat"} />
        <button
          className="btn primary"
          disabled={!notes.trim() || !ctx.versionId || !tl}
          onClick={async () => {
            const findings = notes.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
              const mm = l.match(/(\d{1,2}:\d{2}(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*[:\-–]\s*(.+)/);
              const sec = mm ? (mm[1].includes(":") ? Number(mm[1].split(":")[0]) * 60 + Number(mm[1].split(":")[1].replace(",", ".")) : Number(mm[1].replace(",", "."))) : null;
              const frame = sec !== null ? Math.round(sec * tl!.fps) : null;
              const scene = frame !== null ? tl!.scenes.filter((s) => s.from <= frame).slice(-1)[0]?.id ?? null : null;
              return { frame, timecode: frame !== null ? tc(frame, tl!.fps) : null, sceneId: scene, dimension: "audio" as const, severity: "major" as const, problem: mm ? mm[2] : l, recommendation: "Corectează doar zona notată." };
            });
            try {
              await api.review(ctx.bundle.project.id, ctx.versionId!, { reviewer: "user-notes", findings });
              ctx.notify(`${findings.length} note salvate în critica versiunii.`);
              setNotes("");
              await ctx.reload();
            } catch (e) {
              ctx.notify((e as Error).message, "err");
            }
          }}
        >
          Salvează notele
        </button>
      </Section>
      <Section title={`Cue sheet (${ctx.version?.cueSheet?.length ?? 0})`}>
        <p className="muted small">Fiecare efect vizual își declară sunetul; vocea și efectele au momentul exact.</p>
        <div className="scroll">
          <table className="table">
            <thead><tr><th>Timp</th><th>Tip</th><th>Sunet</th><th>dB</th><th>De ce</th></tr></thead>
            <tbody>
              {(ctx.version?.cueSheet ?? []).map((c) => (
                <tr key={c.id} onClick={() => ctx.seek(c.atFrame)} className="clickable">
                  <td><code>{c.timecode}</code></td>
                  <td>{c.kind}</td>
                  <td>{c.kind === "voice" ? c.sound.split("/").pop() : c.sound}</td>
                  <td>{c.gainDb}</td>
                  <td className="small">{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ─── Critică ────────────────────────────────────────────────────────────────

export function CritiquePanel({ ctx }: { ctx: Ctx }) {
  const c = ctx.version?.critique;
  const rounds = c?.rounds ?? [];
  const last = [...rounds].reverse().find((r) => r.reviewer === "mms-auto-critic-v1");
  const keys = ["hook", "clarity", "rhythm", "hierarchy", "variety", "brand", "cta"] as const;
  const labels: Record<string, string> = { hook: "hook", clarity: "claritate", rhythm: "ritm", hierarchy: "ierarhie", variety: "varietate", brand: "brand", cta: "CTA" };
  const tl = ctx.version?.timelines[ctx.formatId];
  return (
    <div>
      <Section title="Critică (rubrica fixă, prag 8/10)" aside={<button className="btn primary" onClick={() => ctx.runJob("critique")}>Rundă nouă</button>}>
        {last ? (
          <>
            <p>
              Runda {last.n} · {last.reviewer} · scor minim <b>{last.minScene}</b>/10
            </p>
            <table className="table scores">
              <thead>
                <tr>
                  <th>Scena</th>
                  {keys.map((k) => <th key={k}>{labels[k]}</th>)}
                </tr>
              </thead>
              <tbody>
                {last.sceneScores.map((s) => (
                  <tr key={s.sceneId}>
                    <td>{s.sceneId}</td>
                    {keys.map((k) => (
                      <td key={k} className={`score s${Math.floor(s.scores[k] ?? 0)}`}>{s.scores[k]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p>Nicio rundă încă.</p>
        )}
        <p className="muted small">Critica automată măsoară ce se poate măsura (timp până la primul text, timp de citire, ierarhie, varietate, hold pe CTA, ritm pe beat, audio, cadre negre). Revizuirea vizuală pe foaia de contact o face Claude și se adaugă ca rundă separată.</p>
      </Section>
      <Section title="Observații deschise">
        {rounds.flatMap((r) => r.findings.filter((f) => f.status === "open").map((f) => ({ ...f, reviewer: r.reviewer }))).map((f) => (
          <div key={`${f.reviewer}-${f.id}`} className={`issue ${f.severity}`}>
            {f.frame !== null && tl ? <button className="btn tiny ghost" onClick={() => ctx.seek(f.frame!)}>{f.timecode}</button> : null} <b>{f.dimension}</b> · {f.problem} <span className="muted">→ {f.recommendation}</span> <span className="muted small">({f.reviewer})</span>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ─── Versiuni ───────────────────────────────────────────────────────────────

export function VersionsPanel({ ctx, onSelect }: { ctx: Ctx; onSelect: (v: string) => void }) {
  return (
    <Section title="Versiuni" aside={<button className="btn" onClick={() => ctx.runJob("new-version", { label: "manual" })}>Versiune nouă</button>}>
      <p className="muted small">Nicio versiune nu se suprascrie: o versiune cu preview, aprobată sau finală e înghețată; modificările creează versiunea următoare, cu jurnalul schimbărilor.</p>
      {[...ctx.bundle.versions].reverse().map((v) => (
        <div key={v.id} className={`version ${v.id === ctx.versionId ? "current" : ""}`}>
          <div className="row">
            <b>{v.id}</b>
            <span className={`chip ${v.status}`}>{v.status}</span>
            {v.frozen ? <span className="chip">înghețată</span> : <span className="chip ok">editabilă</span>}
            {v.parent ? <span className="muted small">din {v.parent}</span> : null}
            <span className="muted small">{v.createdAt.slice(0, 16).replace("T", " ")}</span>
            <button className="btn tiny" onClick={() => onSelect(v.id)}>Deschide</button>
          </div>
          {v.label ? <div className="muted">{v.label}</div> : null}
          <ul>
            {v.changes.map((c, i) => (
              <li key={i}>
                {c.description} {c.request ? <span className="muted small">(„{c.request}”)</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}

// ─── Export ─────────────────────────────────────────────────────────────────

export function ExportPanel({ ctx }: { ctx: Ctx }) {
  const [phrase, setPhrase] = useState("");
  const renders = ctx.version?.renders ?? [];
  const videos = renders.filter((r) => r.endsWith(".mp4"));
  const sheets = renders.filter((r) => r.endsWith(".png"));
  const tl = ctx.version?.timelines[ctx.formatId];
  const finalApproved = ctx.bundle.approvals.items.some((a) => a.kind === "render-final" && a.versionId === ctx.versionId);
  const exportsList = useMemo(() => ctx.bundle.versions.filter((v) => v.status === "final"), [ctx.bundle.versions]);
  return (
    <div className="cols">
      <Section title="Preview">
        <p className="muted small">Preview-ul e o randare completă (MP4) plus foaia de contact; versiunea se îngheață după preview.</p>
        <div className="row">
          {ctx.bundle.project.formats.map((f) => (
            <button key={f.id} className="btn" disabled={!tl} onClick={() => ctx.runJob("preview", { format: f.id })}>Randează preview {f.id}</button>
          ))}
        </div>
        {videos.map((v) => (
          <div key={v} className="render">
            <div className="small muted">{v.split("/").pop()}</div>
            <video src={fileUrl(v)} controls className="render-video" />
          </div>
        ))}
        {sheets.map((s) => (
          <a key={s} href={fileUrl(s)} target="_blank" rel="noreferrer" className="small">foaie de contact: {s.split("/").pop()}</a>
        ))}
      </Section>
      <Section title="Render final">
        {tl?.concept ? <p className="warn">Versiunea folosește materiale fără drepturi confirmate („concept”): exportul final e blocat.</p> : null}
        <p>Exportul final se face doar după ce scrii exact <b>render final</b> pentru versiunea {ctx.versionId}.</p>
        {finalApproved ? (
          <button className="btn primary" onClick={() => ctx.runJob("final")}>Randează final {ctx.formatId}</button>
        ) : (
          <div className="row">
            <input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="render final" />
            <button className="btn primary" disabled={!ctx.versionId} onClick={async () => { try { await api.approve(ctx.bundle.project.id, "render-final", phrase, ctx.versionId!); ctx.notify("Aprobare înregistrată."); await ctx.reload(); } catch (e) { ctx.notify((e as Error).message, "err"); } }}>
              Confirm
            </button>
          </div>
        )}
        <p className="muted small">Exporturile ajung în <code>projects/{ctx.bundle.project.id}/exports/</code> și nu se suprascriu. Versiuni finale: {exportsList.map((v) => v.id).join(", ") || "—"}.</p>
      </Section>
    </div>
  );
}
