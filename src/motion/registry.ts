import { CAMERAS } from "./camera/presets";
import { DATA } from "./data/charts";
import { BACKGROUNDS } from "./fx/backgrounds";
import { FX_LAYERS } from "./fx/effects";
import { SHAPES } from "./fx/shapes";
import { LOGOS } from "./logo/logo";
import { FRAMES } from "./media/frames";
import { MEDIA } from "./media/media";
import { MODIFIERS } from "./modifiers/modifiers";
import { TRANSITIONS } from "./transitions/transitions";
import { TEXT_LAYERS } from "./typography/kinetic";
import { textCaptions, textCounter } from "./typography/counter-captions";
import { UI_OVERLAYS } from "./ui/overlays";
import { UI_WIDGETS } from "./ui/widgets";
import type { CameraCapability, Capability, LayerCapability, ModifierCapability, TransitionCapability } from "./types";

/**
 * Registry-ul capabilităților. Fiecare intrare are implementare reală, parametri validați,
 * sunet declarat și un exemplu randat de testul de catalog.
 */
export const LAYERS: LayerCapability[] = [
  ...BACKGROUNDS,
  ...FX_LAYERS,
  ...SHAPES,
  ...TEXT_LAYERS,
  textCounter,
  textCaptions,
  ...MEDIA,
  ...FRAMES,
  ...UI_OVERLAYS,
  ...UI_WIDGETS,
  ...LOGOS,
  ...DATA,
] as unknown as LayerCapability[];

export const MODIFIER_LIST: ModifierCapability[] = MODIFIERS as unknown as ModifierCapability[];
export const CAMERA_LIST: CameraCapability[] = CAMERAS as unknown as CameraCapability[];
export const TRANSITION_LIST: TransitionCapability[] = TRANSITIONS as unknown as TransitionCapability[];

export const ALL_CAPABILITIES: Capability[] = [...LAYERS, ...MODIFIER_LIST, ...CAMERA_LIST, ...TRANSITION_LIST];

const byId = new Map<string, Capability>();
for (const c of ALL_CAPABILITIES) {
  if (byId.has(c.id)) throw new Error(`Capabilitate duplicată în registry: ${c.id}`);
  byId.set(c.id, c);
}

export function getCapability(id: string): Capability | undefined {
  return byId.get(id);
}

export function getLayer(id: string): LayerCapability {
  const c = byId.get(id);
  if (!c || c.kind !== "layer") throw new Error(`Nu există stratul „${id}” în registry.`);
  return c;
}
export function getModifier(id: string): ModifierCapability {
  const c = byId.get(id);
  if (!c || c.kind !== "modifier") throw new Error(`Nu există modificatorul „${id}” în registry.`);
  return c;
}
export function getCamera(id: string): CameraCapability {
  const c = byId.get(id);
  if (!c || c.kind !== "camera") throw new Error(`Nu există camera „${id}” în registry.`);
  return c;
}
export function getTransition(id: string): TransitionCapability {
  const c = byId.get(id);
  if (!c || c.kind !== "transition") throw new Error(`Nu există tranziția „${id}” în registry.`);
  return c;
}
