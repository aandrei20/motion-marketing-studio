import React, { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type { Timeline, TimelineLayer } from "../../core/schema";
import { TimelineComposition } from "../../renderer/composition/TimelineComposition";
import type { Ctx } from "./App";

const tc = (frames: number, fps: number) => {
  const s = frames / fps;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
};

interface Bar {
  from: number;
  to: number;
  label: string;
  title: string;
  kind: string;
}

function category(cap: string): "media" | "text" | "ui" | "fx" {
  if (cap.startsWith("media.") || cap.startsWith("frame.")) return "media";
  if (cap.startsWith("text.")) return "text";
  if (cap.startsWith("ui.")) return "ui";
  return "fx";
}

/** Barele timeline-ului din datele reale: scene, tranziții, straturi pe categorii, voce, efecte, subtitrări. */
function buildTracks(t: Timeline): Record<string, Bar[]> {
  const tracks: Record<string, Bar[]> = { scene: [], transitions: [], media: [], text: [], ui: [], fx: [], voice: [], sfx: [], captions: [] };
  for (const s of t.scenes) {
    tracks.scene.push({ from: s.from, to: s.from + s.durationInFrames, label: s.id, title: `${s.id} · ${s.meta.recipe} · ${s.meta.narrativeRole}\n${s.meta.purpose}`, kind: s.meta.narrativeRole });
    if (s.transitionIn && s.transitionIn.durationInFrames > 0) tracks.transitions.push({ from: s.from, to: s.from + s.transitionIn.durationInFrames, label: s.transitionIn.capability.replace("tr.", ""), title: `${s.transitionIn.capability} · ${s.transitionIn.durationInFrames} cadre`, kind: "transition" });
    const visit = (l: TimelineLayer, base: number) => {
      const from = base + l.from;
      tracks[category(l.capability)].push({ from, to: from + l.durationInFrames, label: l.capability, title: `${l.capability}\n${l.id}${typeof l.params.text === "string" ? `\n„${l.params.text}”` : ""}`, kind: l.role });
      l.children.forEach((c) => visit(c, from));
    };
    s.layers.forEach((l) => visit(l, s.from));
  }
  for (const c of t.audio.cues) {
    if (c.kind === "voice") tracks.voice.push({ from: c.atFrame, to: c.atFrame + 1, label: c.reason.replace("vocea replicii ", ""), title: `${c.reason} · ${tc(c.atFrame, t.fps)}`, kind: "voice" });
    else tracks.sfx.push({ from: c.atFrame, to: c.atFrame + 3, label: c.sound, title: `${c.sound} · ${c.reason} · ${c.gainDb} dB`, kind: "sfx" });
  }
  // lungimea replicilor de voce = până la ultimul cuvânt din subtitrări sau următoarea replică
  tracks.voice.sort((a, b) => a.from - b.from);
  tracks.voice.forEach((v, i) => (v.to = Math.max(v.from + 6, (tracks.voice[i + 1]?.from ?? t.durationInFrames) - 2)));
  for (const w of t.captions?.words ?? []) tracks.captions.push({ from: w.from, to: w.to, label: w.text, title: w.text, kind: "caption" });
  return tracks;
}

const TRACK_LABELS: Record<string, string> = { scene: "Scene", transitions: "Tranziții", media: "Media / ecrane", text: "Text", ui: "Interfață", fx: "Fundal & efecte", voice: "Voce", sfx: "Efecte sonore", captions: "Subtitrări" };

function TimelineView({ t, frame, onSeek }: { t: Timeline; frame: number; onSeek: (f: number) => void }) {
  const tracks = useMemo(() => buildTracks(t), [t]);
  const [zoom, setZoom] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - 130));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const px = (width * zoom) / t.durationInFrames;
  const beats: number[] = [];
  if (t.audio.beatGrid) {
    const step = (60 / t.audio.beatGrid.bpm) * t.fps;
    for (let f = t.audio.beatGrid.offsetSec * t.fps; f < t.durationInFrames; f += step) beats.push(f);
  }
  const seconds = Array.from({ length: Math.floor(t.durationInFrames / t.fps) + 1 }, (_, i) => i);
  const clickSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    onSeek(Math.max(0, Math.min(t.durationInFrames - 1, Math.round((e.clientX - r.left + (e.currentTarget as HTMLDivElement).scrollLeft) / px))));
  };
  return (
    <div className="timeline" ref={ref}>
      <div className="timeline-tools">
        <span className="muted small">Timeline-ul real al versiunii (date din timeline.json). Editarea se face prin Storyboard, comenzi sau Claude; aici se inspectează și se navighează.</span>
        <label className="small">
          zoom <input type="range" min={1} max={6} step={0.5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
      </div>
      <div className="timeline-body">
        <div className="track-labels">
          <div className="ruler-label">{tc(frame, t.fps)}</div>
          {Object.keys(tracks).map((k) => <div key={k} className="track-label">{TRACK_LABELS[k]}</div>)}
        </div>
        <div className="track-scroll" onClick={clickSeek}>
          <div style={{ width: t.durationInFrames * px, position: "relative" }}>
            <div className="ruler">
              {seconds.map((s) => <span key={s} style={{ left: s * t.fps * px }}>{s}s</span>)}
              {beats.map((b, i) => <i key={i} className={i % (t.audio.beatGrid?.beatsPerBar ?? 4) === 0 ? "bar-tick" : "beat-tick"} style={{ left: b * px }} />)}
            </div>
            {Object.entries(tracks).map(([k, bars]) => (
              <div key={k} className={`track track-${k}`}>
                {bars.map((b, i) => (
                  <div key={i} className={`tbar k-${b.kind}`} title={b.title} style={{ left: b.from * px, width: Math.max(2, (b.to - b.from) * px) }}>
                    {(b.to - b.from) * px > 40 ? b.label : ""}
                  </div>
                ))}
              </div>
            ))}
            {t.markers.filter((m) => m.kind === "cta-hold").map((m, i) => <div key={i} className="marker" style={{ left: m.frame * px }} title={m.label} />)}
            <div className="playhead" style={{ left: frame * px }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PreviewPanel({ ctx }: { ctx: Ctx }) {
  const t = ctx.version?.timelines[ctx.formatId];
  const ref = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [quality, setQuality] = useState<"draft" | "full">("draft");
  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    const on = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    p.addEventListener("frameupdate", on);
    return () => p.removeEventListener("frameupdate", on);
  }, [t]);
  useEffect(() => {
    if (ctx.seekRequest && ref.current) {
      ref.current.seekTo(ctx.seekRequest.frame);
      setFrame(ctx.seekRequest.frame);
    }
  }, [ctx.seekRequest]);
  if (!t)
    return (
      <div className="card">
        <h2>Preview</h2>
        <p>Versiunea nu are încă timeline compilat pentru {ctx.formatId}.</p>
        <button className="btn primary" disabled={!ctx.versionId} onClick={() => ctx.runJob("compile")}>Compilează</button>
      </div>
    );
  const portrait = t.height > t.width;
  const scene = [...t.scenes].reverse().find((s) => frame >= s.from && frame < s.from + s.durationInFrames);
  const issues = ctx.version?.compileReport?.[ctx.formatId]?.validation.findings ?? [];
  return (
    <div>
      <div className={`preview ${portrait ? "portrait" : "landscape"}`}>
        <div className="player-wrap">
          <Player
            ref={ref}
            component={TimelineComposition}
            inputProps={{ timeline: t, assetBase: "/files", quality }}
            durationInFrames={t.durationInFrames}
            fps={t.fps}
            compositionWidth={t.width}
            compositionHeight={t.height}
            style={{ width: "100%", aspectRatio: `${t.width} / ${t.height}`, background: "#000", borderRadius: 12, overflow: "hidden" }}
            controls
            clickToPlay
            acknowledgeRemotionLicense
          />
          <div className="row small">
            <label className="check"><input type="checkbox" checked={quality === "full"} onChange={(e) => setQuality(e.target.checked ? "full" : "draft")} /> calitate completă (particule, grain)</label>
            {!t.audio.src ? <span className="warn">fără mix audio încă</span> : null}
            {t.concept ? <span className="warn">CONCEPT: materiale fără drepturi confirmate</span> : null}
          </div>
        </div>
        <div className="card scene-info">
          <h2>{scene ? scene.id : "—"}</h2>
          {scene ? (
            <>
              <div className="muted">{scene.meta.purpose}</div>
              <div className="small">
                rețetă <b>{scene.meta.recipe}</b> · rol {scene.meta.narrativeRole} · cadru {scene.meta.shot} · energie {scene.meta.energy}
              </div>
              <div className="small">
                {tc(scene.from, t.fps)} → {tc(scene.from + scene.durationInFrames, t.fps)} ({(scene.durationInFrames / t.fps).toFixed(2)} s)
                {scene.transitionIn ? ` · intră cu ${scene.transitionIn.capability}` : ""}
              </div>
              <h3>Straturi</h3>
              <ul className="layers">
                {scene.layers.map((l) => (
                  <li key={l.id}>
                    <code>{l.capability}</code> <span className="muted small">{l.role}{l.depth === 0 ? " · fix" : ` · adâncime ${l.depth}`}</span>
                    {typeof l.params.text === "string" ? <div className="small">„{l.params.text}”</div> : null}
                    {l.children.length ? <div className="small muted">+ {l.children.map((c) => c.capability).join(", ")}</div> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {issues.length ? (
            <>
              <h3>Validare</h3>
              {issues.map((f, i) => (
                <div key={i} className={`issue ${f.severity}`}>
                  {f.frame !== null ? <button className="btn tiny ghost" onClick={() => ref.current?.seekTo(f.frame!)}>{f.timecode}</button> : null} {f.problem}
                </div>
              ))}
            </>
          ) : (
            <p className="ok small">Validarea nu are observații pentru {ctx.formatId}.</p>
          )}
        </div>
      </div>
      <TimelineView t={t} frame={frame} onSeek={(f) => { ref.current?.seekTo(f); setFrame(f); }} />
    </div>
  );
}
