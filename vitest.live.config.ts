import { defineConfig } from "vitest/config";
import path from "node:path";

// Opt-in live acceptance is separate from the default, credential-free suite.
export default defineConfig({
  test: {
    environment: "node",
    include: ["shared/project-memory/agent-live-llm.acceptance.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
