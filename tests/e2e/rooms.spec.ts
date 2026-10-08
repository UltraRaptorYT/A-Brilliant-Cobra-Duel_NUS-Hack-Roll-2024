import { expect, test } from "@playwright/test";

test("original lobby and footer attribution removal", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "A Brilliant Cobra Duel" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Join Game", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Laya project" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/restored-lobby.png" });
});

test("two browsers ready and play a synchronized Cloudflare room", async ({
  browser,
}) => {
  const green = await browser.newPage(),
    blue = await browser.newPage();
  const code = "e2e-" + Date.now();
  try {
    await green.goto("/" + code);
    await expect(green.getByText("You are Player 1 (Green)")).toBeVisible();
    await blue.goto("/" + code);
    await expect(blue.getByText("You are Player 2 (Blue)")).toBeVisible();
    await green
      .getByLabel("Human Message")
      .fill("Avoid walls and collect food.");
    await green.getByRole("button", { name: "Ready", exact: true }).click();
    await blue.getByRole("button", { name: "Ready", exact: true }).click();
    await expect(
      green.getByRole("button", { name: "Start duel" }),
    ).toBeEnabled();
    await green.getByRole("button", { name: "Step", exact: true }).click();
    for (const page of [green, blue])
      await expect(
        page.getByRole("img", { name: /^Snake arena/ }),
      ).toHaveAttribute("aria-label", /turn 1\./);
    await green.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(
      blue.getByRole("img", { name: /^Snake arena/ }),
    ).not.toHaveAttribute("aria-label", /turn 1\./);
    await green.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(blue.getByLabel("Replay turn")).toBeEnabled();
    await green.getByRole("button", { name: "New round" }).click();
    await expect(
      blue.getByRole("img", { name: /^Snake arena/ }),
    ).toHaveAttribute("aria-label", /turn 0\./);
    await green.screenshot({
      path: "test-results/restored-room.png",
      fullPage: true,
    });
    await green.close();
    await expect(blue.getByText("Waiting for other player...")).toBeVisible();
  } finally {
    if (!green.isClosed()) await green.close();
    await blue.close();
  }
});
