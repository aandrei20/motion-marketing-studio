import { defineConfig } from "vitest/config";

// Testele de randare pornesc Chrome headless prin Remotion; sunt lente și rulează separat.
export default defineConfig({
  test: {
    include: ["tests/render/**/*.test.ts"],
    environment: "node",
    testTimeout: 900_000,
    hookTimeout: 900_000,
    pool: "forks",
    fileParallelism: false,
  },
});
