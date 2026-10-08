import React from "react";
import { Composition, staticFile, type CalculateMetadataFunction } from "remotion";
import type { Timeline } from "../../core/schema";
import { buildCatalogTimeline } from "../../motion/catalog";
import { TimelineComposition } from "../composition/TimelineComposition";

type Props = {
  timeline?: Timeline | null;
  /** cale publică spre un timeline JSON (folosită de `npm run remotion -- <proiect>`) */
  timelinePath?: string | null;
  quality?: "draft" | "full";
  muted?: boolean;
};

const calc: CalculateMetadataFunction<Props> = async ({ props }) => {
  let t = props.timeline ?? null;
  if (!t && props.timelinePath) {
    const res = await fetch(staticFile(props.timelinePath));
    if (!res.ok) throw new Error(`Nu pot citi timeline-ul ${props.timelinePath} (${res.status})`);
    t = (await res.json()) as Timeline;
  }
  if (!t) t = buildCatalogTimeline().timeline;
  return { durationInFrames: t.durationInFrames, fps: t.fps, width: t.width, height: t.height, props: { ...props, timeline: t } };
};

const Render: React.FC<Props> = ({ timeline, quality, muted }) => {
  if (!timeline) return null;
  return <TimelineComposition timeline={timeline} quality={quality ?? "full"} muted={muted} />;
};

const catalogCalc: CalculateMetadataFunction<Props> = async ({ props }) => {
  const t = buildCatalogTimeline().timeline;
  return { durationInFrames: t.durationInFrames, fps: t.fps, width: t.width, height: t.height, props: { ...props, timeline: t } };
};

export const Root: React.FC = () => (
  <>
    <Composition id="Timeline" component={Render} defaultProps={{ timeline: null, timelinePath: null, quality: "full", muted: false } as Props} calculateMetadata={calc} durationInFrames={1} fps={30} width={1920} height={1080} />
    <Composition id="Catalog" component={Render} defaultProps={{ timeline: null, quality: "full", muted: true } as Props} calculateMetadata={catalogCalc} durationInFrames={1} fps={30} width={1920} height={1080} />
  </>
);
