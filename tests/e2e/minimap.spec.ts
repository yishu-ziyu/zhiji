import { expect, test } from "@playwright/test";

test("canvas Mini Map stays small until the user points at it", async ({
  page,
}) => {
  await page.goto("/track/knowledge");
  const dock = page.getByTestId("canvas-minimap-dock");
  await expect(dock).toBeVisible();

  await expect
    .poll(async () => (await dock.boundingBox())?.width ?? 0)
    .toBeLessThan(80);

  await dock.hover();
  await expect
    .poll(async () => (await dock.boundingBox())?.width ?? 0)
    .toBeGreaterThan(180);

  await page.mouse.move(1, 1);
  await expect
    .poll(async () => (await dock.boundingBox())?.width ?? 0)
    .toBeLessThan(80);
});
