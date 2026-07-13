import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

test.describe("Home Page", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("loads with correct title and track cards", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/FC-OPC/);
    await expect(page.getByText("电商经营 Agent").first()).toBeVisible();
    await expect(page.getByText("交付运营助手").first()).toBeVisible();
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
  test("shows sample analysis card on first load", async ({ page }) => {
    // Round 10 E2.33: 首屏预填示例样卡，不再显示空状态占位符
    await expect(page.getByText(/无线蓝牙耳机|选品分析报告|核心优势/).first()).toBeVisible();
  });
});

test.describe("Shopkeeper Agent", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("user can open the shopkeeper morning brief from the ecommerce track", async ({ page }) => {
    await page.goto(`${BASE_URL}/track/ecommerce`);

    const shopkeeperButton = page.getByRole("button", { name: /小掌柜/ });
    await expect(shopkeeperButton).toBeVisible();

    await shopkeeperButton.click();

    await expect(page.locator('[data-slot="card-title"]', { hasText: "小掌柜早报" })).toBeVisible();
    await expect(page.getByText(/匹配选品库 SKU-12/)).toBeVisible();
    await expect(page.getByRole("button", { name: "采纳建议" })).toBeVisible();
  });
});

test.describe("Efficiency Track — Delivery Ops", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("page loads with delivery workbench", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/track/efficiency`);
    expect(response?.status()).toBe(200);
    const headings = page.locator("h1");
    await expect(headings).toHaveCount(1);
    await expect(headings).toContainText("交付运营助手");
  });

  test("shows closed-loop framing and gold script action", async ({ page }) => {
    await page.goto(`${BASE_URL}/track/efficiency`);
    await expect(page.getByText("参赛主线")).toBeVisible();
    await expect(page.getByRole("button", { name: /使用客户对话剧本/ })).toBeVisible();
    await expect(page.getByText("闭环率").first()).toBeVisible();
  });

  test("gold script → accept → confirm updates closed-loop rate", async ({ page }) => {
    await page.goto(`${BASE_URL}/track/efficiency`);
    await page.evaluate(() => localStorage.removeItem("fc-opc-ibot-delivery-v1"));
    await page.reload();
    await page.getByRole("button", { name: /使用客户对话剧本/ }).click();
    await expect(page.getByText("承诺审阅")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("输出落地页改版原型")).toBeVisible();
    await page.getByRole("button", { name: /采纳并生成任务/ }).click();
    await expect(page.getByRole("heading", { name: "交付看板" })).toBeVisible();
    const taskTitle = "输出落地页改版原型";
    const taskSelect = page.locator(`div.bg-card:has(p:has-text("${taskTitle}")) select`);
    await taskSelect.selectOption("in_progress");
    await taskSelect.selectOption("delivered");
    await taskSelect.selectOption("confirmed");
    await expect(page.getByText(/\d+%/).first()).toBeVisible();
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

test.describe("交付看板状态切换", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/track/efficiency`, { waitUntil: "load" });
    await page.evaluate(() => localStorage.removeItem("fc-opc-ibot-delivery-v1"));
    await page.reload();
    await page.getByRole("button", { name: /使用客户对话剧本/ }).click();
    await expect(page.getByText("承诺审阅")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /采纳并生成任务/ }).click();
    await expect(page.locator("main").getByText("已捕获").first()).toBeVisible({ timeout: 5000 });
  });

  test("任务可跨列移动（已捕获 → 进行中）", async ({ page }) => {
    const taskTitle = "输出落地页改版原型";

    await expect(page.getByText(taskTitle).first()).toBeVisible();

    const capturedHeader = page.locator("div.text-xs.font-medium", { hasText: "已捕获" });
    const inProgressHeader = page.locator("div.text-xs.font-medium", { hasText: "进行中" });
    const capturedColumn = capturedHeader.locator("xpath=ancestor::div[contains(@class, 'rounded-xl')][1]");
    const inProgressColumn = inProgressHeader.locator("xpath=ancestor::div[contains(@class, 'rounded-xl')][1]");

    await expect(capturedColumn.getByText(taskTitle)).toHaveCount(1);
    await expect(inProgressColumn.getByText(taskTitle)).toHaveCount(0);

    const taskSelect = page.locator(`div.bg-card:has(p:has-text("${taskTitle}")) select`);
    await expect(taskSelect).toHaveValue("captured");
    await taskSelect.selectOption("in_progress");

    await expect(inProgressColumn.getByText(taskTitle)).toHaveCount(1);
    await expect(capturedColumn.getByText(taskTitle)).toHaveCount(0);
  });

  test("任务可走到已确认", async ({ page }) => {
    const taskTitle = "本周五前上线可分享预览链接";

    await expect(page.getByText(taskTitle).first()).toBeVisible();

    const confirmedHeader = page.locator("div.text-xs.font-medium", { hasText: "已确认" });
    const confirmedColumn = confirmedHeader.locator(
      "xpath=ancestor::div[contains(@class, 'rounded-xl')][1]",
    );

    const taskSelect = page.locator(`div.bg-card:has(p:has-text("${taskTitle}")) select`);
    await expect(taskSelect).toHaveValue("captured");
    await taskSelect.selectOption("in_progress");
    await taskSelect.selectOption("delivered");
    await taskSelect.selectOption("confirmed");

    await expect(confirmedColumn.getByText(taskTitle)).toHaveCount(1);
  });
});
