import { expect, test } from "@playwright/test";
import {
  survivalPrompt,
  aggressivePrompt,
} from "../../components/game/decisions";

test("smaller board and editable model presets", async ({ page }) => {
  await page.route("**/api/llm", (route) =>
    route.fulfill({ json: { builtin: true, laya: true, openai: true } }),
  );
  await page.route("**/api/laya/warmup", (route) =>
    route.fulfill({ json: { ready: true } }),
  );
  await page.goto("/local");
  const engine = page.getByLabel("Green snake engine");
  const prompt = page.getByLabel("Green snake instructions");
  await engine.selectOption("laya");
  await expect(prompt).toHaveValue(survivalPrompt);
  await engine.selectOption("openai");
  await expect(prompt).toHaveValue(survivalPrompt);
  await page.getByLabel("Green snake strategy").selectOption("aggressive");
  await expect(prompt).toHaveValue(aggressivePrompt);
  await prompt.fill("Attack from the side.");
  await expect(prompt).toHaveValue("Attack from the side.");
  const board = page.getByRole("img", { name: /^Snake arena/ });
  expect((await board.boundingBox())!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/smaller-board-presets.png",
    fullPage: true,
  });
});
