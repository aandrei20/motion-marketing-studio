import React from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from "remotion";
import type { Timeline, TimelineLayer, TimelineScene } from "../../core/schema";
import { cameraMotionBlur, dofBlur, layerTransform, layerZoom, sampleCamera } from "../../motion/camera/rig";
import { AssetBaseContext, CameraZoomContext, MotionEnvProvider, SceneIdContext, useAssetUrl, useEnv, useSceneId, type MotionEnv } from "../../motion/core/context";
import { DirBlurDefs, filterId } from "../../motion/core/filters";
import { FontGate } from "../../motion/core/fonts";
import { getLayer, getModifier, getTransition } from "../../motion/registry";
import type { TransitionStyle } from "../../motion/types";

export interface TimelineCompositionProps {
  timeline: Timeline;
  quality?: "draft" | "full";
  /** baza URL pentru fișiere în Player (Studio); null în Remotion */
  assetBase?: string | null;
  /** ascunde audio (de ex. pentru cadre statice) */
  muted?: boolean;
}

// ─── straturi ────────────────────────────────────────────────────────────────

function LayerInner({ layer }: { layer: TimelineLayer }) {
  const frame = useCurrentFrame();
  const env = useEnv();
  const sceneId = useSceneId();
  const cap = getLayer(layer.capability);
  const childNodes = layer.children.length ? layer.children.map((c) => <LayerNode key={c.id} layer={c} />) : null;
  const Comp = cap.Component;
  let content: React.ReactNode = (
    <Comp layer={layer} params={layer.params as never} frame={frame} duration={layer.durationInFrames} box={layer.box} env={env}>
      {cap.ownsChildren ? childNodes : undefined}
    </Comp>
  );
  if (!cap.ownsChildren && childNodes) {
    content = (
      <>
        {content}
        <div style={{ position: "absolute", inset: 0 }}>{childNodes}</div>
      </>
    );
  }
  layer.modifiers.forEach((m, i) => {
    const mod = getModifier(m.capability);
    const r = mod.apply({ params: m.params as never, frame, duration: layer.durationInFrames, box: layer.box, env, id: `${sceneId}-${layer.id}-${i}` });
    const inner = r.wrap ? r.wrap(content) : content;
    content = <div style={{ position: "absolute", inset: 0, ...r.style }}>{inner}</div>;
  });
  return <div style={{ position: "absolute", left: layer.box.x, top: layer.box.y, width: layer.box.w, height: layer.box.h }}>{content}</div>;
}

export function LayerNode({ layer }: { layer: TimelineLayer }) {
  return (
    <Sequence from={layer.from} durationInFrames={layer.durationInFrames} layout="none" name={layer.id}>
      <LayerInner layer={layer} />
    </Sequence>
  );
}

// ─── scenă: cameră pe adâncimi ──────────────────────────────────────────────

function SceneContent({ scene }: { scene: TimelineScene }) {
  const frame = useCurrentFrame();
  const env = useEnv();
  const seed = `${env.seed}:${scene.id}`;
  const cam = sampleCamera(scene.camera, frame, env.fps, seed);
  const sorted = [...scene.layers].sort((a, b) => a.z - b.z);
  const blurCache = new Map<number, [number, number]>();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {sorted.map((layer) => {
        const d = layer.depth;
        const transform = layerTransform(cam, d, env.width, env.height, scene.camera.perspective);
        let mb = blurCache.get(d);
        if (!mb) {
          mb = d === 0 ? [0, 0] : cameraMotionBlur(scene.camera, frame, env.fps, seed, d);
          blurCache.set(d, mb);
        }
        const dof = dofBlur(scene.camera, frame, d);
        const mbId = filterId("mb", scene.id, layer.id);
        const filters: string[] = [];
        if (mb[0] > 0 || mb[1] > 0) filters.push(`url(#${mbId})`);
        if (dof > 0.3) filters.push(`blur(${dof.toFixed(2)}px)`);
        return (
          <AbsoluteFill key={layer.id} style={{ transform, transformOrigin: "0 0", filter: filters.length ? filters.join(" ") : undefined }}>
            {mb[0] > 0 || mb[1] > 0 ? <DirBlurDefs id={mbId} x={mb[0]} y={mb[1]} /> : null}
            <CameraZoomContext.Provider value={layerZoom(cam, d)}>
              <LayerNode layer={layer} />
            </CameraZoomContext.Provider>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
}

function styleFrom(s: TransitionStyle | undefined, id: string): { style: React.CSSProperties; defs: React.ReactNode } {
  if (!s) return { style: {}, defs: null };
  const filters: string[] = [];
  let defs: React.ReactNode = null;
  if (s.dirBlur && (s.dirBlur[0] > 0.2 || s.dirBlur[1] > 0.2)) {
    filters.push(`url(#${id})`);
    defs = <DirBlurDefs id={id} x={s.dirBlur[0]} y={s.dirBlur[1]} />;
  }
  if (s.filter) filters.push(s.filter);
  return {
    style: { transform: s.transform, opacity: s.opacity, clipPath: s.clipPath, filter: filters.length ? filters.join(" ") : undefined, zIndex: s.zIndex },
    defs,
  };
}

function transitionProgress(local: number, d: number): number {
  return Math.min(1, Math.max(0, (local + 0.5) / d));
}

function SceneShell({ scene, next, index }: { scene: TimelineScene; next: TimelineScene | undefined; index: number }) {
  const frame = useCurrentFrame();
  const env = useEnv();
  let inStyle: TransitionStyle | undefined;
  let outStyle: TransitionStyle | undefined;
  const tin = scene.transitionIn;
  if (tin && tin.durationInFrames > 0 && frame < tin.durationInFrames) {
    const tr = getTransition(tin.capability);
    inStyle = tr.present({ p: transitionProgress(frame, tin.durationInFrames), frame, duration: tin.durationInFrames, params: tin.params as never, env, seed: `${env.seed}:${scene.id}` }).incoming;
  }
  const tout = next?.transitionIn;
  if (next && tout && tout.durationInFrames > 0) {
    const start = scene.durationInFrames - tout.durationInFrames;
    if (frame >= start) {
      const local = frame - start;
      const tr = getTransition(tout.capability);
      outStyle = tr.present({ p: transitionProgress(local, tout.durationInFrames), frame: local, duration: tout.durationInFrames, params: tout.params as never, env, seed: `${env.seed}:${next.id}` }).outgoing;
    }
  }
  const a = styleFrom(outStyle, filterId("trout", scene.id));
  const b = styleFrom(inStyle, filterId("trin", scene.id));
  // scena nouă stă implicit deasupra; o tranziție poate cere ca scena veche să rămână deasupra (zIndex > 1)
  const outOnTop = (outStyle?.zIndex ?? 0) > 1;
  return (
    <SceneIdContext.Provider value={scene.id}>
      <AbsoluteFill style={{ ...a.style, zIndex: outOnTop ? (index + 1) * 2 + 1 : index * 2 }}>
        {a.defs}
        <AbsoluteFill style={{ ...b.style, zIndex: undefined }}>
          {b.defs}
          <SceneContent scene={scene} />
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneIdContext.Provider>
  );
}

function TransitionOverlay({ scene }: { scene: TimelineScene }) {
  const frame = useCurrentFrame();
  const env = useEnv();
  const tin = scene.transitionIn;
  if (!tin) return null;
  const tr = getTransition(tin.capability);
  const r = tr.present({ p: transitionProgress(frame, tin.durationInFrames), frame, duration: tin.durationInFrames, params: tin.params as never, env, seed: `${env.seed}:${scene.id}` });
  if (!r.overlay) return null;
  return <AbsoluteFill style={{ zIndex: 10_000, pointerEvents: "none" }}>{r.overlay}</AbsoluteFill>;
}

function ConceptMark() {
  return (
    <div style={{ position: "absolute", left: 24, bottom: 24, zIndex: 30_000, padding: "8px 14px", borderRadius: 8, background: "rgba(0,0,0,0.65)", color: "#ffd166", fontFamily: "sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: "0.08em" }}>
      CONCEPT · materiale fără drepturi confirmate
    </div>
  );
}

function MasterAudio({ src }: { src: string }) {
  const url = useAssetUrl();
  return <Audio src={url(src)} />;
}

export function envFromTimeline(t: Timeline, quality: "draft" | "full" = "full"): MotionEnv {
  return {
    fps: t.fps,
    width: t.width,
    height: t.height,
    seed: t.seed,
    palette: t.palette,
    typography: t.typography,
    safeZone: t.safeZone,
    beatGrid: t.audio.beatGrid,
    quality,
  };
}

export const TimelineComposition: React.FC<TimelineCompositionProps> = ({ timeline, quality = "full", assetBase = null, muted = false }) => {
  const env = envFromTimeline(timeline, quality);
  const scenes = timeline.scenes;
  return (
    <AssetBaseContext.Provider value={assetBase}>
      <MotionEnvProvider env={env}>
        <AbsoluteFill style={{ background: timeline.palette.background, overflow: "hidden" }}>
          <FontGate fonts={timeline.fonts}>
            {scenes.map((scene, i) => (
              <Sequence key={scene.id} from={scene.from} durationInFrames={scene.durationInFrames} name={`scenă ${scene.id}`}>
                <SceneShell scene={scene} next={scenes[i + 1]} index={i} />
              </Sequence>
            ))}
            {scenes.map((scene) =>
              scene.transitionIn && scene.transitionIn.durationInFrames > 0 ? (
                <Sequence key={`tr-${scene.id}`} from={scene.from} durationInFrames={scene.transitionIn.durationInFrames} name={`tranziție ${scene.transitionIn.capability}`}>
                  <TransitionOverlay scene={scene} />
                </Sequence>
              ) : null,
            )}
            <SceneIdContext.Provider value="global">
              <AbsoluteFill style={{ zIndex: 20_000, pointerEvents: "none" }}>
                {timeline.overlays.map((l) => (
                  <LayerNode key={l.id} layer={l} />
                ))}
                {timeline.captions ? (
                  <LayerNode
                    layer={{
                      id: "captions",
                      capability: "text.captions",
                      from: 0,
                      durationInFrames: timeline.durationInFrames,
                      z: 0,
                      box: timeline.captions.box,
                      params: { ...timeline.captions.params, words: timeline.captions.words },
                      depth: 0,
                      role: "caption",
                      modifiers: [],
                      assets: [],
                      children: [],
                    }}
                  />
                ) : null}
              </AbsoluteFill>
            </SceneIdContext.Provider>
            {timeline.concept ? <ConceptMark /> : null}
          </FontGate>
          {timeline.audio.src && !muted ? <MasterAudio src={timeline.audio.src} /> : null}
        </AbsoluteFill>
      </MotionEnvProvider>
    </AssetBaseContext.Provider>
  );
};
