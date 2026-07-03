import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

test.describe("Home Page", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("loads with correct title and track cards", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/FC-OPC/);
    await expect(page.getByText("电商经营 Agent").first()).toBeVisible();
    await expect(page.getByText("效率 Agent").first()).toBeVisible();
  });
  test("navigates to ecommerce track", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByText("电商经营 Agent").first().click();
    await expect(page).toHaveURL(new RegExp(BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ".*track/ecommerce"));
  });
});

test.describe("Ecommerce Track", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.beforeEach(async ({ page }) => { await page.goto(`${BASE_URL}/track/ecommerce`); });
  test("shows sidebar and chat input", async ({ page }) => {
    await expect(page.getByText("电商经营 Agent").first()).toBeVisible();
    await expect(page.getByPlaceholder(/输入商品名称/)).toBeVisible();
  });
  test("shows empty state with mode hint", async ({ page }) => {
    await expect(page.getByText(/在「/)).toBeVisible();
  });
});

test.describe("Efficiency Track", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("page loads with HTTP 200 and renders", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/track/efficiency`);
    expect(response?.status()).toBe(200);
    const headings = page.locator("h1");
    await expect(headings).toHaveCount(1);
    await expect(headings).toContainText("效率 Agent");
  });
});

test.describe("API Endpoints", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/llm/health`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty("ok");
  });
  test("analyze endpoint validates input", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/ecommerce/analyze`, { data: {} });
    expect(res.status()).toBe(400);
  });
  test("minutes endpoint validates input", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/efficiency/minutes`, { data: {} });
    expect(res.status()).toBe(400);
  });
});

test.describe("LLM Integration", () => {
  test("analyze returns structured data", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/ecommerce/analyze`, { data: { productName: "无线蓝牙耳机" } });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty("productName");
    expect(data).toHaveProperty("marketHeat");
    expect(data).toHaveProperty("competition");
  });
  test("script returns data", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/ecommerce/script`, { data: { productName: "便携充电宝" } });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.raw || data.scripts).toBeDefined();
  });
  test("minutes returns structured data", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/efficiency/minutes`, { data: { transcript: "今天决定产品7月15日上线" } });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.title || data.raw).toBeDefined();
  });
});
