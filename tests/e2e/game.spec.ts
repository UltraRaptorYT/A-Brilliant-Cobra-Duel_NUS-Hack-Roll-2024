import { expect, test } from "@playwright/test";
import { initialState } from "../../components/game/engine";
import { defaultConfig } from "../../components/game/decisions";

test("local game steps, runs, pauses, replays, and resets", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/local");
  await expect(page.getByRole("heading", { name: "Local Game" })).toBeVisible();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.getByRole("img", { name: /^Snake arena/ })).toHaveAttribute(
    "aria-label",
    /turn 1\./,
  );
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByRole("img", { name: /^Snake arena/ }),
  ).not.toHaveAttribute("aria-label", /turn 1\./);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await page
    .getByRole("img", { name: /^Snake arena/ })
    .getAttribute("aria-label");
  await page.waitForTimeout(900);
  await expect(page.getByRole("img", { name: /^Snake arena/ })).toHaveAttribute(
    "aria-label",
    paused!,
  );
  await page.getByRole("slider", { name: "Replay turn" }).fill("0");
  await expect(page.getByRole("img", { name: /^Snake arena/ })).toHaveAttribute(
    "aria-label",
    /turn 0\./,
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download replay" }).click();
  expect((await download).suggestedFilename()).toMatch(/cobra-duel-.*\.json/);
  await page.getByRole("button", { name: "New round" }).click();
  await expect(page.getByRole("img", { name: /^Snake arena/ })).toHaveAttribute(
    "aria-label",
    /turn 0\./,
  );
  await expect(page.getByRole("button", { name: "Start duel" })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("reset discards a late pending move", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const intercepted = new Promise<void>((resolve) => {
    entered = resolve;
  });
  await page.route("**/api/llm", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    entered();
    await pending;
    await route
      .fulfill({
        json: {
          turn: 0,
          player1: { action: "D", reason: "test", provider: "builtin" },
          player2: { action: "U", reason: "test", provider: "builtin" },
        },
      })
      .catch(() => {});
  });
  await page.goto("/local");
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await intercepted;
  await page.getByRole("button", { name: "New round" }).click();
  release();
  await page.waitForTimeout(400);
  await expect(page.getByRole("img", { name: /^Snake arena/ })).toHaveAttribute(
    "aria-label",
    /turn 0\./,
  );
});

test("API validates input and returns real built-in moves", async ({
  request,
}) => {
  expect((await request.post("/api/llm", { data: {} })).status()).toBe(400);
  expect(
    (
      await request.post("/api/llm", {
        data: "not-json",
        headers: { "Content-Type": "application/json" },
      })
    ).status(),
  ).toBe(400);
  const response = await request.post("/api/llm", {
    data: {
      boardState: initialState(),
      player1: defaultConfig(),
      player2: defaultConfig(),
    },
  });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.turn).toBe(0);
  expect(data.player1.provider).toBe("builtin");
  expect(["U", "D", "R"]).toContain(data.player1.action);
  expect(
    (
      await request.post("/api/llm", {
        data: {
          boardState: { ...initialState(), turn: 100 },
          player1: defaultConfig(),
          player2: defaultConfig(),
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post("/api/llm", { data: { oversized: "x".repeat(33000) } })
    ).status(),
  ).toBe(413);
});

test("Laya inference works through the Next.js route when exported", async ({
  request,
}) => {
  const capabilities = await (await request.get("/api/llm")).json();
  test.skip(!capabilities.laya, "Run the one-time model export to test Laya.");
  const config = { ...defaultConfig(), provider: "laya" };
  const response = await request.post("/api/llm", {
    timeout: 60000,
    data: { boardState: initialState(), player1: config, player2: config },
  });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.player1.provider).toBe("laya");
  expect(data.player2.provider).toBe("laya");
  expect(data.player1.fallback).toBeUndefined();
});

test("mobile board fits the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/local");
  const box = await page
    .getByRole("img", { name: /^Snake arena/ })
    .boundingBox();
  expect(box!.width).toBeLessThanOrEqual(375);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/mobile-arena.png",
    fullPage: true,
  });
});
