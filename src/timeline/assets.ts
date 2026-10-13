/** Fișierele la care trimite un timeline compilat (fără dependențe de randare: îl folosesc și verificările). */
import type { Timeline, TimelineLayer } from "../core/schema";

/** Toate căile publice referite de timeline (straturi, copii, fonturi, audio). */
export function timelineAssets(t: Timeline): string[] {
  const out = new Set<string>();
  const visit = (l: TimelineLayer) => {
    l.assets.forEach((a) => {
      out.add(a);
    });
    l.children.forEach(visit);
  };
  t.scenes.forEach((s) => {
    s.layers.forEach(visit);
  });
  t.overlays.forEach(visit);
  t.fonts.forEach((f) => {
    out.add(f.src);
  });
  if (t.audio.src) out.add(t.audio.src);
  return [...out];
}
