import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { environment: "node", setupFiles: ["tests/setup.ts"] },
  resolve: {
    alias: { obsidian: path.resolve(__dirname, "tests/__mocks__/obsidian.ts") },
  },
});
