import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseGuardedLaya,
  defaultConfig,
  withProvider,
  withStrategy,
  survivalPrompt,
  aggressivePrompt,
  isConfig,
} from "../components/game/decisions";
import { initialState, step } from "../components/game/engine";

const config = { ...defaultConfig(), provider: "laya" as const };
const neverPredict = async () => {
  throw new Error("Model should not be called");
};

test("model selection fills survival instructions and aggression is a valid preset", () => {
  for (const provider of ["laya", "openai"] as const) {
    const selected = withProvider(defaultConfig(), provider);
    assert.equal(selected.prompt, survivalPrompt);
    assert.equal(selected.strategy, "survival");
    const aggressive = withStrategy(selected, "aggressive");
    assert.equal(aggressive.prompt, aggressivePrompt);
    assert.ok(isConfig(aggressive));
    assert.equal(withProvider(aggressive, provider).strategy, "aggressive");
  }
});

test("aggression permits contested moves but still excludes guaranteed wall death", async () => {
  const board = initialState();
  board.snake1.body = [
    [5, 5],
    [4, 5],
    [3, 5],
    [2, 5],
  ];
  board.snake2.body = [
    [7, 5],
    [8, 5],
    [9, 5],
    [10, 5],
  ];
  const risky = withStrategy(config, "aggressive");
  const decision = await chooseGuardedLaya(
    board,
    "snake1",
    risky,
    async (_s, _i, choices) => {
      assert.ok(choices.R);
      return { choice: "R", probability: 0.8 };
    },
  );
  assert.equal(decision.action, "R");
  board.snake1.body = [
    [14, 0],
    [13, 0],
    [12, 0],
    [11, 0],
  ];
  assert.equal(
    (await chooseGuardedLaya(board, "snake1", risky, neverPredict)).action,
    "D",
  );
});

test("right wall is excluded even when the model tries to keep going right", async () => {
  const board = initialState();
  board.snake1.body = [
    [14, 1],
    [13, 1],
    [13, 2],
    [13, 3],
  ];
  const decision = await chooseGuardedLaya(
    board,
    "snake1",
    config,
    async (_state, _instructions, choices) => {
      assert.deepEqual(Object.keys(choices).sort(), ["D", "U"]);
      return { choice: "R", probability: 0.99 };
    },
  );
  assert.notEqual(decision.action, "R");
  assert.equal(decision.fallback, true);
  assert.equal(step(board, decision.action, "U").snake1.isAlive, true);
});

test("corner takes the only safe turn without invoking Laya", async () => {
  const board = initialState();
  board.snake1.body = [
    [14, 0],
    [13, 0],
    [12, 0],
    [11, 0],
  ];
  const decision = await chooseGuardedLaya(
    board,
    "snake1",
    config,
    neverPredict,
  );
  assert.equal(decision.action, "D");
  assert.equal(decision.provider, "builtin");
  assert.match(decision.reason, /Safety override/);
});

test("Laya still selects between safe moves", async () => {
  const decision = await chooseGuardedLaya(
    initialState(),
    "snake1",
    config,
    async () => ({ choice: "D", probability: 0.6 }),
  );
  assert.equal(decision.action, "D");
  assert.equal(decision.provider, "laya");
  assert.equal(decision.fallback, undefined);
});

test("potential head-on collision is excluded when guaranteed-safe replies exist", async () => {
  const board = initialState();
  board.snake1.body = [
    [5, 5],
    [4, 5],
    [3, 5],
    [2, 5],
  ];
  board.snake2.body = [
    [7, 5],
    [8, 5],
    [9, 5],
    [10, 5],
  ];
  await chooseGuardedLaya(
    board,
    "snake1",
    config,
    async (_state, _instructions, choices) => {
      assert.equal(choices.R, undefined);
      return { choice: "U", probability: 0.7 };
    },
  );
});

test("unavoidable death remains a legal fallback, with no claim of safety", async () => {
  const board = initialState();
  board.snake1.body = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 2],
  ];
  board.snake1.dir = "L";
  const decision = await chooseGuardedLaya(
    board,
    "snake1",
    config,
    neverPredict,
  );
  assert.equal(decision.fallback, true);
  assert.match(decision.reason, /no move survives/);
});
