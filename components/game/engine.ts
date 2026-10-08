import { BoardStateType, Direction, PosType, SnakeType } from "./gameTypes";

export const SIZE = 10;
export const DIRECTIONS: Direction[] = ["U", "D", "L", "R"];
export const OPPOSITE: Record<Direction, Direction> = {
  U: "D",
  D: "U",
  L: "R",
  R: "L",
};
const DELTA: Record<Direction, PosType> = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0],
};
export type SnakeId = "snake1" | "snake2";
export type Outcome = { winner: "P1" | "P2" | "draw"; reason: string };
export const same = (a: PosType, b: PosType) => a[0] === b[0] && a[1] === b[1];
export const inside = ([x, y]: PosType) =>
  x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export const isDirection = (value: unknown): value is Direction =>
  DIRECTIONS.includes(value as Direction);
export const advance = (p: PosType, d: Direction): PosType => [
  p[0] + DELTA[d][0],
  p[1] + DELTA[d][1],
];
export const legalDirections = (snake: SnakeType) =>
  DIRECTIONS.filter(
    (d) => snake.body.length === 1 || d !== OPPOSITE[snake.dir],
  );

export function initialState(): BoardStateType {
  return {
    turn: 0,
    snake1: {
      body: [
        [3, 2],
        [2, 2],
        [1, 2],
        [0, 2],
      ],
      dir: "R",
      prevDir: "R",
      dirArr: ["R", "R", "R", "R"],
      isAlive: true,
    },
    snake2: {
      body: [
        [6, 7],
        [7, 7],
        [8, 7],
        [9, 7],
      ],
      dir: "L",
      prevDir: "L",
      dirArr: ["L", "L", "L", "L"],
      isAlive: true,
    },
    food: [
      [4, 4],
      [5, 5],
    ],
  };
}

export function outcome(state: BoardStateType): Outcome | null {
  const a = state.snake1,
    b = state.snake2;
  if (!a.isAlive && !b.isAlive)
    return { winner: "draw", reason: "Both snakes collided on the same turn." };
  if (!a.isAlive || !b.isAlive)
    return {
      winner: a.isAlive ? "P1" : "P2",
      reason: "The other snake collided.",
    };
  if (a.body.length + b.body.length >= SIZE * SIZE) {
    return {
      winner:
        a.body.length === b.body.length
          ? "draw"
          : a.body.length > b.body.length
            ? "P1"
            : "P2",
      reason: "Round complete. The longer snake wins; equal lengths draw.",
    };
  }
  return null;
}

export function refillFood(
  state: BoardStateType,
  random = Math.random,
): BoardStateType {
  const occupied = new Set(
    [...state.snake1.body, ...state.snake2.body, ...state.food].map((p) =>
      p.join(","),
    ),
  );
  const free: PosType[] = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (!occupied.has(`${x},${y}`)) free.push([x, y]);
  const food = [...state.food];
  while (food.length < 2 && free.length)
    food.push(
      ...free.splice(
        Math.min(
          free.length - 1,
          Math.max(0, Math.floor(random() * free.length)),
        ),
        1,
      ),
    );
  return { ...state, food };
}

/** One immutable, simultaneous turn. Reversals/invalid actions continue straight. */
export function step(
  state: BoardStateType,
  action1: Direction,
  action2: Direction,
  random = Math.random,
): BoardStateType {
  if (outcome(state)) return state;
  function move(snake: SnakeType, action: Direction): SnakeType {
    const dir = legalDirections(snake).includes(action) ? action : snake.dir;
    const head = advance(snake.body[0], dir);
    const eats = state.food.some((p) => same(p, head));
    const body = [
      head,
      ...snake.body
        .slice(0, eats ? undefined : -1)
        .map((p) => [...p] as PosType),
    ];
    return {
      ...snake,
      body,
      dir,
      prevDir: snake.dir,
      dirArr: [dir, ...snake.dirArr].slice(0, body.length),
    };
  }
  const a = move(state.snake1, action1),
    b = move(state.snake2, action2);
  const headOn = same(a.body[0], b.body[0]);
  const swap =
    same(a.body[0], state.snake2.body[0]) &&
    same(b.body[0], state.snake1.body[0]);
  const collides = (snake: SnakeType, other: SnakeType) =>
    !inside(snake.body[0]) ||
    snake.body.slice(1).some((p) => same(p, snake.body[0])) ||
    other.body.slice(1).some((p) => same(p, snake.body[0]));
  a.isAlive = !headOn && !swap && !collides(a, b);
  b.isAlive = !headOn && !swap && !collides(b, a);
  const next = {
    turn: state.turn + 1,
    snake1: a,
    snake2: b,
    food: state.food
      .filter((p) => !same(p, a.body[0]) && !same(p, b.body[0]))
      .map((p) => [...p] as PosType),
  };
  return outcome(next) ? next : refillFood(next, random);
}

/** Reject malformed/unbounded input before simulation or provider calls. */
export function isBoardState(value: unknown): value is BoardStateType {
  if (!value || typeof value !== "object") return false;
  const s = value as BoardStateType;
  const pos = (p: unknown): p is PosType =>
    Array.isArray(p) &&
    p.length === 2 &&
    p.every((n) => Number.isInteger(n) && n >= -1 && n <= SIZE);
  const snake = (v: SnakeType) =>
    v &&
    Array.isArray(v.body) &&
    v.body.length > 0 &&
    v.body.length <= SIZE * SIZE &&
    v.body.every(pos) &&
    isDirection(v.dir) &&
    isDirection(v.prevDir) &&
    Array.isArray(v.dirArr) &&
    v.dirArr.length === v.body.length &&
    v.dirArr.every(isDirection) &&
    typeof v.isAlive === "boolean" &&
    v.body.every(
      (p, i) =>
        (inside(p) || (!v.isAlive && i === 0)) &&
        (i === 0 ||
          Math.abs(p[0] - v.body[i - 1][0]) +
            Math.abs(p[1] - v.body[i - 1][1]) ===
            1),
    );
  if (!(
    Number.isSafeInteger(s.turn) &&
    s.turn >= 0 &&
    snake(s.snake1) &&
    snake(s.snake2) &&
    Array.isArray(s.food) &&
    s.food.length <= 2 &&
    s.food.every((p) => pos(p) && inside(p))
  ))
    return false;
  const cells = [...s.snake1.body, ...s.snake2.body, ...s.food].map((p) =>
    p.join(","),
  );
  return outcome(s) !== null || new Set(cells).size === cells.length;
}
