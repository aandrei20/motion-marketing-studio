import { z } from "zod";
import { ALL_CAPABILITIES } from "../motion/registry";
import { RECIPES } from "../recipes/recipes";

/**
 * Registry-ul în formă JSON (pentru Claude, Studio și library/registry.json): fiecare capabilitate cu
 * parametrii ca JSON Schema, sunetul asociat, rețetele care o folosesc, starea și testele.
 */
export function registryJson() {
  return {
    schemaVersion: 1,
    note: "Generat din cod (src/motion/registry.ts) de `npm run registry`. Nu edita de mână.",
    capabilities: ALL_CAPABILITIES.map((c) => {
      let params: unknown;
      try {
        params = z.toJSONSchema(c.params, { io: "input", unrepresentable: "any" });
      } catch {
        params = null;
      }
      return {
        id: c.id,
        kind: c.kind,
        category: c.category,
        title: c.title,
        description: c.description,
        tags: c.tags,
        compatibleMedia: c.compatibleMedia,
        timing: c.timing,
        sfx: c.sfx,
        status: c.status,
        performance: c.performance,
        license: c.license,
        recipes: RECIPES.filter((r) => r.capabilities.includes(c.id)).map((r) => r.id),
        implementation: implementationPath(c.id, c.kind),
        tests: ["tests/render/catalog.test.ts (randare + determinism)", "tests/unit/registry.test.ts (schemă și exemplu)"],
        params,
        example: c.example,
      };
    }),
    recipes: RECIPES.map((r) => ({ id: r.id, title: r.title, description: r.description, tags: r.tags, roles: r.roles, slots: r.slots, minSec: r.minSec, capabilities: r.capabilities })),
  };
}

function implementationPath(id: string, kind: string): string {
  const prefix = id.split(".")[0];
  const map: Record<string, string> = {
    camera: "src/motion/camera/presets.ts",
    tr: "src/motion/transitions/transitions.tsx",
    text: id === "text.counter" || id === "text.captions" ? "src/motion/typography/counter-captions.tsx" : "src/motion/typography/kinetic.tsx",
    bg: "src/motion/fx/backgrounds.tsx",
    fx: "src/motion/fx/effects.tsx",
    shape: "src/motion/fx/shapes.tsx",
    media: "src/motion/media/media.tsx",
    frame: "src/motion/media/frames.tsx",
    ui: ["ui.zoom-lens", "ui.notification", "ui.progress", "ui.toggle", "ui.code", "ui.terminal"].includes(id) ? "src/motion/ui/widgets.tsx" : "src/motion/ui/overlays.tsx",
    logo: "src/motion/logo/logo.tsx",
    data: "src/motion/data/charts.tsx",
    mod: "src/motion/modifiers/modifiers.tsx",
  };
  return map[prefix] ?? `(${kind})`;
}
