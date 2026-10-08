import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { initialState, step, outcome } from "../components/game/engine";
import {
  chooseBuiltin,
  defaultConfig,
  decisionContext,
  compactLayaContext,
} from "../components/game/decisions";
import { buildSequence, layaChoice, loadLaya, modelFile } from "../lib/laya";

async function main() {
  const start = performance.now();
  await loadLaya();
  const loadMs = performance.now() - start;
  const records: {
    turn: number;
    snake: string;
    ms: number;
    tokens: number;
    choice: string;
    probability: number;
  }[] = [];
  let state = initialState();
  const instructions =
    "Choose the snake move. Prioritize survival and enough reachable space, then follow the strategy and preference.";
  for (let turn = 0; turn < 8 && !outcome(state); turn++) {
    for (const snake of ["snake1", "snake2"] as const) {
      const context = decisionContext(state, snake, defaultConfig());
      const names = { U: "up", D: "down", L: "left", R: "right" };
      const criteria = Object.fromEntries(
        context.candidates.map((c) => [c.action, names[c.action]]),
      );
      const text = compactLayaContext(context);
      const sequence = await buildSequence(text, instructions, criteria);
      const began = performance.now();
      const result = await layaChoice(text, instructions, criteria);
      records.push({
        turn,
        snake,
        ms: Math.round(performance.now() - began),
        tokens: sequence.ids.length,
        ...result,
      });
    }
    state = step(
      state,
      chooseBuiltin(state, "snake1", defaultConfig()).action,
      chooseBuiltin(state, "snake2", defaultConfig()).action,
      () => 0.5,
    );
  }
  const report = {
    model: await modelFile(),
    loadMs: Math.round(loadMs),
    meanMs: Math.round(records.reduce((a, b) => a + b.ms, 0) / records.length),
    records,
  };
  if (process.argv[2])
    await writeFile(process.argv[2], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
