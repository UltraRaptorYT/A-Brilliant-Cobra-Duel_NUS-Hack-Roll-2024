import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  isBoardState,
  outcome,
  refillFood,
  SIZE,
  step,
} from "../components/game/engine";
import {
  BoardStateType,
  Direction,
  PosType,
  SnakeType,
} from "../components/game/gameTypes";
import { chooseBuiltin, defaultConfig } from "../components/game/decisions";
import { formatPrompt } from "../components/game/promptFormatting";
import { isMatch, newMatch } from "../components/game/match";

const snake = (body: PosType[], dir: Direction = "R"): SnakeType => ({
  body,
  dir,
  prevDir: dir,
  dirArr: body.map(() => dir),
  isAlive: true,
});
const board = (
  a: SnakeType,
  b: SnakeType,
  food: PosType[] = [],
): BoardStateType => ({ turn: 0, snake1: a, snake2: b, food });

test("initial state is independent and valid", () => {
  const a = initialState();
  a.snake1.body[0][0] = 0;
  assert.equal(initialState().snake1.body[0][0], 5);
  assert.ok(isBoardState(initialState()));
});
test("one turn moves both snakes once without mutating input", () => {
  const before = initialState(),
    copy = structuredClone(before);
  const after = step(before, "D", "U", () => 0);
  assert.deepEqual(before, copy);
  assert.deepEqual(after.snake1.body[0], [5, 3]);
  assert.deepEqual(after.snake2.body[0], [9, 11]);
  assert.equal(after.turn, 1);
  assert.equal(after.snake1.body.length, 4);
});
test("positive edge at SIZE is lethal", () => {
  const s = board(
    snake([
      [14, 2],
      [13, 2],
    ]),
    snake([
      [5, 8],
      [4, 8],
    ]),
  );
  const n = step(s, "R", "R");
  assert.equal(n.snake1.isAlive, false);
  assert.equal(outcome(n)?.winner, "P2");
});
test("all four wall edges are lethal", () => {
  const cases: [PosType, Direction][] = [
    [[0, 3], "L"],
    [[14, 3], "R"],
    [[3, 0], "U"],
    [[3, 14], "D"],
  ];
  for (const [p, d] of cases)
    assert.equal(
      step(board(snake([p], d), snake([[7, 7]])), d, "R").snake1.isAlive,
      false,
    );
});
test("food is removed by coordinates, the correct snake grows, and food refills", () => {
  const s = board(
    snake([
      [4, 3],
      [3, 3],
    ]),
    snake(
      [
        [9, 9],
        [10, 9],
      ],
      "L",
    ),
    [
      [5, 3],
      [0, 0],
    ],
  );
  const n = step(s, "R", "L", () => 0.5);
  assert.equal(n.snake1.body.length, 3);
  assert.equal(n.snake2.body.length, 2);
  assert.ok(n.food.some((p) => p[0] === 0 && p[1] === 0));
  assert.ok(!n.food.some((p) => p[0] === 5 && p[1] === 3));
  assert.equal(n.food.length, 2);
  assert.equal(n.snake1.dirArr.length, 3);
});
test("both snakes can eat on the same turn", () => {
  const s = board(snake([[4, 3]]), snake([[9, 9]], "L"), [
    [5, 3],
    [8, 9],
  ]);
  const n = step(s, "R", "L");
  assert.equal(n.snake1.body.length, 2);
  assert.equal(n.snake2.body.length, 2);
});
test("same destination and head swaps kill both, independent of length", () => {
  const s = board(
    snake([
      [4, 3],
      [3, 3],
    ]),
    snake([[6, 3]], "L"),
    [[5, 3]],
  );
  assert.equal(outcome(step(s, "R", "L"))?.winner, "draw");
  const swap = board(snake([[4, 3]]), snake([[5, 3]], "L"));
  assert.equal(outcome(step(swap, "R", "L"))?.winner, "draw");
});
test("simultaneous wall deaths draw", () => {
  assert.equal(
    outcome(step(board(snake([[14, 2]]), snake([[0, 9]], "L")), "R", "L"))
      ?.winner,
    "draw",
  );
});
test("reversal is ignored", () => {
  assert.deepEqual(step(initialState(), "L", "R").snake1.body[0], [6, 2]);
});
test("vacating own tail is legal", () => {
  const s = board(
    snake(
      [
        [2, 2],
        [2, 3],
        [1, 3],
        [1, 2],
      ],
      "U",
    ),
    snake([[10, 10]]),
  );
  assert.equal(step(s, "L", "R").snake1.isAlive, true);
});
test("vacating opponent tail is legal unless opponent eats", () => {
  const s = board(
    snake([[4, 3]]),
    snake([
      [6, 3],
      [5, 3],
    ]),
  );
  assert.equal(step(s, "R", "R").snake1.isAlive, true);
  s.food = [[7, 3]];
  assert.equal(step(s, "R", "R").snake1.isAlive, false);
});
test("self collision with retained body is lethal", () => {
  const s = board(
    snake(
      [
        [2, 2],
        [2, 3],
        [1, 3],
        [1, 2],
        [0, 2],
      ],
      "U",
    ),
    snake([[10, 10]]),
  );
  assert.equal(step(s, "L", "R").snake1.isAlive, false);
});
test("turn limit awards length winner, ties draw, finished games cannot advance", () => {
  const s = initialState();
  s.turn = 99;
  const n = step(s, "R", "L");
  assert.equal(outcome(n)?.winner, "draw");
  assert.equal(step(n, "R", "L"), n);
  n.snake1.body.push([2, 2]);
  assert.equal(outcome(n)?.winner, "P1");
});
test("food search terminates on full board without overlaps", () => {
  const s = initialState();
  s.food = [];
  s.snake1.body = Array.from(
    { length: SIZE * SIZE },
    (_, i) => [i % SIZE, Math.floor(i / SIZE)] as PosType,
  );
  assert.equal(refillFood(s).food.length, 0);
});
test("malformed states are rejected", () => {
  for (const s of [
    null,
    {},
    { ...initialState(), turn: NaN },
    { ...initialState(), food: [[99, 1]] },
    { ...initialState(), snake1: { ...initialState().snake1, body: [] } },
  ])
    assert.equal(isBoardState(s), false);
});
test("all prompt aliases work, including legacy plural and lowercase", () => {
  const text = formatPrompt(
    "{Emojis_board} {emoji_board} {Chars_board} {board_state_str}",
    initialState(),
  );
  assert.ok(!text.includes("_board}"));
  assert.ok(text.includes('"turn":0'));
});
test("snapshots reject inconsistent histories", () => {
  assert.ok(isMatch(newMatch()));
  assert.equal(
    isMatch({ ...newMatch(), board: { ...initialState(), turn: 1 } }),
    false,
  );
});
test("seeded built-in tournaments preserve invariants and always terminate", () => {
  for (let seed = 1; seed <= 20; seed++) {
    let rng = seed;
    const random = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    };
    let s = initialState();
    while (!outcome(s)) {
      const a = chooseBuiltin(s, "snake1", defaultConfig());
      const b = chooseBuiltin(s, "snake2", {
        ...defaultConfig(),
        strategy: "food",
      });
      const next = step(s, a.action, b.action, random);
      assert.equal(next.turn, s.turn + 1);
      assert.ok(isBoardState(next), "engine must generate valid states");
      s = next;
    }
    assert.ok(s.turn <= 100);
  }
});
