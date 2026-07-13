import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

test.describe("Home Page", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("loads efficiency-only home", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/FC-OPC|交付/);
    await expect(page.getByText("交付运营助手").first()).toBeVisible();
    await expect(page.getByText("电商经营 Agent")).toHaveCount(0);
  });

  test("navigates to efficiency track", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole("link", { name: /打开交付运营助手/ }).click();
    await expect(page).toHaveURL(/track\/efficiency/);
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
    await expect(
      page.getByRole("button", { name: /使用客户对话剧本/ }),
    ).toBeVisible();
    await expect(page.getByText("闭环率").first()).toBeVisible();
  });

  test("gold script → accept → confirm updates closed-loop rate", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/track/efficiency`);
    await page.evaluate(() =>
      localStorage.removeItem("fc-opc-ibot-delivery-v1"),
    );
    await page.reload();
    await page.getByRole("button", { name: /使用客户对话剧本/ }).click();
    await expect(page.getByText("承诺审阅")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("输出落地页改版原型")).toBeVisible();
    await page.getByRole("button", { name: /采纳并生成任务/ }).click();
    await expect(page.getByRole("heading", { name: "交付看板" })).toBeVisible();
    const taskTitle = "输出落地页改版原型";
    const taskSelect = page.locator(
      `div.bg-card:has(p:has-text("${taskTitle}")) select`,
    );
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

  test("commitments endpoint validates empty body", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/efficiency/commitments`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("commitments fixture returns structured commitments", async ({
    request,
  }) => {
    const res = await request.post(`${BASE_URL}/api/efficiency/commitments`, {
      data: { fixture: "dialog-01" },
    });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data.commitments)).toBe(true);
    expect(data.commitments.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe("交付看板状态切换", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/track/efficiency`, { waitUntil: "load" });
    await page.evaluate(() =>
      localStorage.removeItem("fc-opc-ibot-delivery-v1"),
    );
    await page.reload();
    await page.getByRole("button", { name: /使用客户对话剧本/ }).click();
    await expect(page.getByText("承诺审阅")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /采纳并生成任务/ }).click();
    await expect(
      page.locator("main").getByText("已捕获").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("任务可跨列移动（已捕获 → 进行中）", async ({ page }) => {
    const taskTitle = "输出落地页改版原型";
    await expect(page.getByText(taskTitle).first()).toBeVisible();

    const capturedHeader = page.locator("div.text-xs.font-medium", {
      hasText: "已捕获",
    });
    const inProgressHeader = page.locator("div.text-xs.font-medium", {
      hasText: "进行中",
    });
    const capturedColumn = capturedHeader.locator(
      "xpath=ancestor::div[contains(@class, 'rounded-xl')][1]",
    );
    const inProgressColumn = inProgressHeader.locator(
      "xpath=ancestor::div[contains(@class, 'rounded-xl')][1]",
    );

    await expect(capturedColumn.getByText(taskTitle)).toHaveCount(1);
    const taskSelect = page.locator(
      `div.bg-card:has(p:has-text("${taskTitle}")) select`,
    );
    await taskSelect.selectOption("in_progress");
    await expect(inProgressColumn.getByText(taskTitle)).toHaveCount(1);
    await expect(capturedColumn.getByText(taskTitle)).toHaveCount(0);
  });

  test("任务可走到已确认", async ({ page }) => {
    const taskTitle = "本周五前上线可分享预览链接";
    await expect(page.getByText(taskTitle).first()).toBeVisible();

    const confirmedHeader = page.locator("div.text-xs.font-medium", {
      hasText: "已确认",
    });
    const confirmedColumn = confirmedHeader.locator(
      "xpath=ancestor::div[contains(@class, 'rounded-xl')][1]",
    );
    const taskSelect = page.locator(
      `div.bg-card:has(p:has-text("${taskTitle}")) select`,
    );
    await taskSelect.selectOption("in_progress");
    await taskSelect.selectOption("delivered");
    await taskSelect.selectOption("confirmed");
    await expect(confirmedColumn.getByText(taskTitle)).toHaveCount(1);
  });
});
