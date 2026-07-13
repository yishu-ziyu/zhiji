import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

test("home presents the customer-change product", async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle(/FC-OPC|交付/);
  await expect(page.getByText("客户变化处理").first()).toBeVisible();
  await expect(page.getByText("电商经营 Agent")).toHaveCount(0);
});

test("客户变化从原消息变成新的交付日期和尾款", async ({
  page,
  context,
  request,
}) => {
  await page.goto(`${BASE_URL}/track/efficiency`);
  await page.getByRole("button", { name: "载入演示项目" }).click();
  await expect(page.getByText("当前版本 v1")).toBeVisible();
  await expect(page.getByText("尾款 ¥4,000")).toBeVisible();

  await page.getByRole("button", { name: "载入演示消息" }).click();
  await page.getByRole("button", { name: "分析这条消息" }).click();
  await expect(page.getByText("增加一组 A/B 测试").first()).toBeVisible();
  await expect(page.getByText("需要服务方决定")).toHaveCount(2);
  await expect(page.getByText("价格先按之前的").first()).toBeVisible();

  await page
    .getByRole("textbox", { name: "新的工作范围" })
    .fill("单版本落地页，增加一组 A/B 测试");
  await page.getByLabel("新的交付日期").fill("2026-07-20");
  await page.getByLabel("新的总价（元）").fill("10000");
  await page.getByRole("button", { name: "发送给客户确认" }).click();

  const firstClientLink = await page.getByTestId("client-link").textContent();
  await page.reload();
  await expect(page.getByText("当前版本 v1")).toBeVisible();
  await expect(page.getByTestId("client-link")).toHaveText(firstClientLink!);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("新的交付日期").fill("2026-07-20");
  await page.getByRole("button", { name: "修改并重新发送" }).click();
  await expect(page.getByTestId("client-link")).not.toHaveText(
    firstClientLink!,
  );

  const clientLink = await page.getByTestId("client-link").textContent();
  expect(clientLink).toMatch(/\/c\/[a-f0-9-]{36}$/);
  expect(clientLink).not.toBe(firstClientLink);
  const oldToken = firstClientLink!.split("/").at(-1)!;
  const oldLinkResponse = await request.get(
    `${BASE_URL}/api/efficiency/changes/${oldToken}`,
  );
  expect(oldLinkResponse.status()).toBe(409);

  const clientPage = await context.newPage();
  await clientPage.setViewportSize({ width: 390, height: 844 });
  await clientPage.goto(clientLink!);
  await expect(
    clientPage.getByRole("heading", { name: "落地页改版：新方案" }),
  ).toBeVisible();
  await expect(clientPage.getByText("身份未验证")).toBeVisible();
  await expect(clientPage.getByText("2026-07-17 → 2026-07-20")).toBeVisible();
  await expect(clientPage.getByText("¥8,000 → ¥10,000")).toBeVisible();
  await expect(clientPage.getByText("¥4,000 → ¥6,000")).toBeVisible();
  expect(
    await clientPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await clientPage.getByRole("button", { name: "确认新方案" }).click();
  await expect(clientPage.getByText("新方案已生效")).toBeVisible();

  await expect(page.getByText("当前版本 v2")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("尾款 ¥6,000")).toBeVisible();
  await expect(page.getByText("交付日期和尾款已同时更新")).toBeVisible();

  const token = clientLink!.split("/").at(-1)!;
  const replay = await request.post(
    `${BASE_URL}/api/efficiency/changes/${token}`,
    { data: { action: "confirm" } },
  );
  expect(replay.status()).toBe(409);
});

test("客户要求修改后，服务方收到说明并生成新链接", async ({
  page,
  request,
}) => {
  const seeded = await request.post(`${BASE_URL}/api/efficiency/changes`, {
    data: { action: "seed" },
  });
  const seed = await seeded.json();
  const analyzed = await request.post(`${BASE_URL}/api/efficiency/changes`, {
    data: {
      action: "analyze",
      projectId: seed.project.id,
      providerSecret: seed.providerSecret,
      sourceText: "客户：再加一组 A/B 测试，还是周五上，价格先按之前的。",
      fixture: true,
    },
  });
  const proposal = await analyzed.json();
  const sent = await request.post(`${BASE_URL}/api/efficiency/changes`, {
    data: {
      action: "send",
      projectId: seed.project.id,
      providerSecret: seed.providerSecret,
      proposalId: proposal.id,
      scope: "单版本落地页，增加一组 A/B 测试",
      deliveryDate: "2026-07-20",
      totalPriceMinor: 1_000_000,
    },
  });
  const first = await sent.json();

  await page.goto(first.clientUrl);
  await page.getByRole("button", { name: "要求修改" }).click();
  await expect(
    page.getByText("请填写需要修改的内容", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("需要修改的内容（要求修改时必填）")
    .fill("交付日期改成 7 月 21 日");
  await page.getByRole("button", { name: "要求修改" }).click();
  await expect(page.getByText("修改意见已发送")).toBeVisible();

  const provider = await request.post(`${BASE_URL}/api/efficiency/changes`, {
    data: {
      action: "get",
      projectId: seed.project.id,
      providerSecret: seed.providerSecret,
    },
  });
  await expect(provider.json()).resolves.toMatchObject({
    proposal: {
      status: "changes_requested",
      clientNote: "交付日期改成 7 月 21 日",
    },
  });

  const resent = await request.post(`${BASE_URL}/api/efficiency/changes`, {
    data: {
      action: "send",
      projectId: seed.project.id,
      providerSecret: seed.providerSecret,
      proposalId: proposal.id,
      scope: "单版本落地页，增加一组 A/B 测试",
      deliveryDate: "2026-07-21",
      totalPriceMinor: 1_000_000,
    },
  });
  const second = await resent.json();
  expect(second.clientUrl).not.toBe(first.clientUrl);
  const oldToken = first.clientUrl.split("/").at(-1)!;
  expect(
    (
      await request.get(`${BASE_URL}/api/efficiency/changes/${oldToken}`)
    ).status(),
  ).toBe(409);
});

test("服务方接口不能执行客户确认", async ({ request }) => {
  const seeded = await request.post(`${BASE_URL}/api/efficiency/changes`, {
    data: { action: "seed" },
  });
  expect(seeded.status()).toBe(201);
  const body = await seeded.json();

  const wrongSecret = await request.post(`${BASE_URL}/api/efficiency/changes`, {
    data: {
      action: "get",
      projectId: body.project.id,
      providerSecret: "wrong-secret",
    },
  });
  expect(wrongSecret.status()).toBe(403);

  const forged = await request.post(`${BASE_URL}/api/efficiency/changes`, {
    data: {
      action: "confirm",
      projectId: body.project.id,
      providerSecret: body.providerSecret,
    },
  });
  expect(forged.status()).toBe(400);
  await expect(forged.json()).resolves.toMatchObject({
    error: "服务方接口不能执行客户确认",
  });
});

test("health endpoint responds", async ({ request }) => {
  const response = await request.get(`${BASE_URL}/api/llm/health`);
  expect(response.ok()).toBe(true);
});
