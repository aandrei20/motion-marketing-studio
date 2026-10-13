/** Brief-ul: întrebările A–H, cu variante, și aprobarea. */
import { useEffect, useState } from "react";
import type { Brief } from "../../../core/schema";
import type { Ctx } from "../App";
import { api } from "../api";
import { Section } from "../common";

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
  audio: {
    voice: { mode: "tts", provider: "windows", voiceId: "", rate: 1 },
    music: { mode: "synth", mood: "driving" },
    sfxDensity: "medium",
    intentionalSilence: false,
    voiceCompression: true,
    ambience: "none",
  },
  references: [],
  captions: { burnIn: true, srt: true },
  delivery: { postPack: false, hookVariants: 0, previews: "until-threshold" },
  approvedAt: null,
};

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export function BriefPanel({ ctx }: { ctx: Ctx }) {
  const [b, setB] = useState<Brief>(ctx.bundle.brief ?? EMPTY_BRIEF);
  const [raw, setRaw] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");
  const [voices, setVoices] = useState<Array<{ provider: string; name: string; language: string }>>([]);
  const [suggest, setSuggest] = useState<Array<{ direction: string; why: string }>>([]);
  useEffect(() => setB(ctx.bundle.brief ?? EMPTY_BRIEF), [ctx.bundle.brief]);
  useEffect(
    () =>
      void api
        .voices()
        .then(setVoices)
        .catch(() => undefined),
    [],
  );
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
      <Section
        title="Brief"
        aside={
          <button type="button" className="btn ghost" onClick={() => setRaw(raw === null ? JSON.stringify(b, null, 2) : null)}>
            {raw === null ? "JSON avansat" : "Formular"}
          </button>
        }
      >
        {raw !== null ? (
          <textarea className="code" rows={30} value={raw} onChange={(e) => setRaw(e.target.value)} />
        ) : (
          <div className="form">
            <h3>A. Produs și obiectiv</h3>
            <label>
              Obiectiv
              <select value={b.objective} onChange={(e) => up({ objective: e.target.value as Brief["objective"] })}>
                {["awareness", "signups", "downloads", "sales", "launch", "feature-adoption", "other"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
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
              <textarea
                rows={2}
                value={b.audience.painPoints.join("\n")}
                onChange={(e) => up({ audience: { ...b.audience, painPoints: lines(e.target.value) } })}
              />
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
                  <input
                    type="checkbox"
                    checked={b.platforms.includes(p as never)}
                    onChange={(e) => up({ platforms: (e.target.checked ? [...b.platforms, p] : b.platforms.filter((x) => x !== p)) as Brief["platforms"] })}
                  />{" "}
                  {p}
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
              <textarea
                rows={2}
                value={b.userVision.hooks.join("\n")}
                onChange={(e) => up({ userVision: { ...b.userVision, hooks: lines(e.target.value) } })}
              />
            </label>
            <label>
              Fraze obligatorii, exacte (câte una pe rând)
              <textarea
                rows={2}
                value={b.userVision.mandatoryPhrases.map((m) => m.text).join("\n")}
                onChange={(e) =>
                  up({
                    userVision: {
                      ...b.userVision,
                      mandatoryPhrases: lines(e.target.value).map((t, i) => ({ id: `fraza-${i + 1}`, text: t, channel: "any" as const })),
                    },
                  })
                }
              />
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
                  {["slow", "medium", "fast", "aggressive"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                Ton (cuvinte, separate prin virgulă)
                <input
                  value={b.tone.join(", ")}
                  onChange={(e) =>
                    up({
                      tone: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label>
                Nivel de efecte
                <select
                  value={b.visual.effectsLevel}
                  onChange={(e) => up({ visual: { ...b.visual, effectsLevel: e.target.value as Brief["visual"]["effectsLevel"] } })}
                >
                  {["subtle", "medium", "bold"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>
            {!b.direction ? (
              <div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={async () =>
                    setSuggest(
                      await (
                        await fetch("/api/suggest-directions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ tone: b.tone, pacing: b.pacing, category: ctx.bundle.project.product.category, platforms: b.platforms }),
                        })
                      ).json(),
                    )
                  }
                >
                  Propune 3 direcții
                </button>
                {suggest.map((s) => (
                  <button type="button" key={s.direction} className="suggest" onClick={() => up({ direction: s.direction as Brief["direction"] })}>
                    {s.why} <span className="muted">(alege)</span>
                  </button>
                ))}
              </div>
            ) : null}
            <label>
              Capabilități interzise (id-uri din registry, separate prin virgulă)
              <input
                value={b.visual.forbiddenCapabilities.join(", ")}
                onChange={(e) =>
                  up({
                    visual: {
                      ...b.visual,
                      forbiddenCapabilities: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    },
                  })
                }
              />
            </label>
            <h3>E/F. Limbă, subtitrări, audio</h3>
            <div className="grid2">
              <label>
                Vocea
                <select
                  value={b.audio.voice.mode}
                  onChange={(e) => up({ audio: { ...b.audio, voice: { ...b.audio.voice, mode: e.target.value as Brief["audio"]["voice"]["mode"] } } })}
                >
                  <option value="tts">TTS</option>
                  <option value="user-file">vocea mea (fișier)</option>
                  <option value="none">fără voce</option>
                </select>
              </label>
              {b.audio.voice.mode === "tts" ? (
                <label>
                  Vocea TTS
                  <select
                    value={`${b.audio.voice.provider ?? ""}|${b.audio.voice.voiceId ?? ""}`}
                    onChange={(e) => {
                      const [provider, voiceId] = e.target.value.split("|");
                      up({ audio: { ...b.audio, voice: { ...b.audio.voice, provider, voiceId } } });
                    }}
                  >
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
                  <select
                    value={b.audio.voice.assetId ?? ""}
                    onChange={(e) => up({ audio: { ...b.audio, voice: { ...b.audio.voice, assetId: e.target.value || undefined } } })}
                  >
                    <option value="">— alege —</option>
                    {ctx.bundle.assets.assets
                      .filter((a) => a.type === "audio")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.originalName}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <span />
              )}
              <label>
                Muzica
                <select
                  value={b.audio.music.mode}
                  onChange={(e) => up({ audio: { ...b.audio, music: { ...b.audio.music, mode: e.target.value as Brief["audio"]["music"]["mode"] } } })}
                >
                  <option value="synth">sintetizată de studio (originală)</option>
                  <option value="user-file">muzica mea (fișier)</option>
                  <option value="none">fără muzică</option>
                </select>
              </label>
              {b.audio.music.mode === "synth" ? (
                <label>
                  Dispoziția muzicii
                  <select
                    value={b.audio.music.mood}
                    onChange={(e) => up({ audio: { ...b.audio, music: { ...b.audio.music, mood: e.target.value as Brief["audio"]["music"]["mood"] } } })}
                  >
                    {["driving", "uplifting", "dark", "calm", "playful"].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
              ) : b.audio.music.mode === "user-file" ? (
                <label>
                  Fișierul muzicii (asset)
                  <select
                    value={b.audio.music.assetId ?? ""}
                    onChange={(e) => up({ audio: { ...b.audio, music: { ...b.audio.music, assetId: e.target.value || undefined } } })}
                  >
                    <option value="">— alege —</option>
                    {ctx.bundle.assets.assets
                      .filter((a) => a.type === "audio")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.originalName}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <span />
              )}
              <label>
                Efecte sonore
                <select value={b.audio.sfxDensity} onChange={(e) => up({ audio: { ...b.audio, sfxDensity: e.target.value as Brief["audio"]["sfxDensity"] } })}>
                  {["none", "low", "medium", "high"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                Ambianță
                <select value={b.audio.ambience} onChange={(e) => up({ audio: { ...b.audio, ambience: e.target.value as Brief["audio"]["ambience"] } })}>
                  {[
                    ["none", "fără"],
                    ["room", "încăpere caldă"],
                    ["air", "aer deschis"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={b.audio.voiceCompression} onChange={(e) => up({ audio: { ...b.audio, voiceCompression: e.target.checked } })} />{" "}
                compresor pe voce
              </label>
              <label className="check">
                <input type="checkbox" checked={b.captions.burnIn} onChange={(e) => up({ captions: { ...b.captions, burnIn: e.target.checked } })} /> subtitrări
                arse în video
              </label>
              <label className="check">
                <input type="checkbox" checked={b.captions.srt} onChange={(e) => up({ captions: { ...b.captions, srt: e.target.checked } })} /> fișier .srt
              </label>
              <label className="check">
                <input type="checkbox" checked={b.delivery.postPack} onChange={(e) => up({ delivery: { ...b.delivery, postPack: e.target.checked } })} /> pachet
                de postare (copertă + text)
              </label>
              <label>
                Variante de hook
                <select value={b.delivery.hookVariants} onChange={(e) => up({ delivery: { ...b.delivery, hookVariants: Number(e.target.value) } })}>
                  {[0, 2, 3].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Preview-uri
                <select
                  value={b.delivery.previews}
                  onChange={(e) => up({ delivery: { ...b.delivery, previews: e.target.value as Brief["delivery"]["previews"] } })}
                >
                  <option value="one">1 preview</option>
                  <option value="two">2 preview-uri</option>
                  <option value="until-threshold">până trece pragul 8/10</option>
                </select>
              </label>
            </div>
          </div>
        )}
        <div className="actions">
          <button type="button" className="btn primary" onClick={save}>
            Salvează brief-ul
          </button>
        </div>
      </Section>
      <Section title="Aprobare">
        {approvedAt ? (
          <p className="ok">Brief aprobat la {approvedAt.slice(0, 16).replace("T", " ")}.</p>
        ) : (
          <>
            <p>
              Lucrul începe doar după ce scrii exact <b>aprob</b>.
            </p>
            <div className="row">
              <input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="aprob" />
              <button
                type="button"
                className="btn primary"
                disabled={!ctx.bundle.brief}
                onClick={async () => {
                  try {
                    await api.approve(ctx.bundle.project.id, "brief", phrase);
                    ctx.notify("Brief aprobat.");
                    await ctx.reload();
                  } catch (e) {
                    ctx.notify((e as Error).message, "err");
                  }
                }}
              >
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
              {ctx.meta.questions
                .filter((q) => q.group === g)
                .map((q) => (
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
