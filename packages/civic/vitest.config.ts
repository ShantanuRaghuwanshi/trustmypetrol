import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Resolve the workspace dep straight to source so tests never depend on a
// build step (mirrors how apps consume @tmp/shared).
export default defineConfig({
  resolve: {
    alias: {
      "@tmp/shared": resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  test: { globals: true },
});
