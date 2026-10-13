/** Ajutoarele comune ale verificărilor: straturile aplatizate și cadrele în secunde. */
import type { Timeline, TimelineLayer } from "../../core/schema";

export const flat = (ls: TimelineLayer[]): TimelineLayer[] => ls.flatMap((l) => [l, ...flat(l.children)]);
export const sec = (t: Timeline, f: number) => f / t.fps;
