import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "html" : "list",
  use: { baseURL, trace: "on-first-retry", screenshot: "only-on-failure", video: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  timeout: 60000,
  // 用生产 build 跑 e2e（Turbopack dev server 在 React 19 + Next.js 16 下 hydration 不工作）
  webServer: {
    command:
      "rm -rf .tmp/e2e-knowledge && mkdir -p .tmp/e2e-knowledge && npm run build && KNOWLEDGE_DATA_DIR=.tmp/e2e-knowledge SEED_DEMO=1 AGENT_RUN_MODE=deterministic npm run start",
    url: baseURL,
    reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE_SERVER,
    timeout: 120000,
  },
});
