import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx", "tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    pool: "forks",
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // codul care rulează în browser (compozițiile Remotion, interfața Studio) e verificat de testele de randare
      // și de testul interfeței cu Playwright, nu de acoperirea V8 din Node
      exclude: ["src/motion/**", "src/renderer/composition/**", "src/renderer/remotion/**", "src/studio/ui/**"],
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: ".cache/coverage",
      // pragul minim e măsurarea din 2026-10-13 (linii 70,9%, ramuri 57,2%): acoperirea poate doar să crească
      thresholds: { lines: 70, statements: 68, functions: 73, branches: 57 },
    },
  },
});
