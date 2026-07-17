import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "shared/**/*.test.ts",
      "tests/unit/**/*.test.ts",
      "tests/security/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/bench/**/*.test.ts",
      "tests/bench/**/*.bench.test.ts",
    ],
    // Live LLM tests require secrets; never part of default CI unit path.
    exclude: [
      "**/node_modules/**",
      "**/*live*.test.ts",
      "**/*.live.test.ts",
      "tmp/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
