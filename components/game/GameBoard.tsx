import { BoardStateType, Direction, PosType } from "./gameTypes";
import { same, SIZE } from "./engine";
import SnakeHead from "./snake/SnakeHead";
import SnakeBody from "./snake/SnakeBody";
import SnakeTail from "./snake/SnakeTail";
import Food from "./Food";

function toward(a: PosType, b: PosType): Direction {
  return b[0] > a[0] ? "R" : b[0] < a[0] ? "L" : b[1] > a[1] ? "D" : "U";
}

function bodyTurnCorner(body: PosType[], index: number) {
  if (index === 0 || index === body.length - 1) return undefined;
  const current = body[index];
  const towardHead = toward(current, body[index - 1]);
  const towardTail = toward(current, body[index + 1]);
  const directions = [towardHead, towardTail].sort().join(",");
  const corners: Record<string, string> = {
    "L,U": "rounded-br-[25%]",
    "R,U": "rounded-bl-[25%]",
    "D,L": "rounded-tr-[25%]",
    "D,R": "rounded-tl-[25%]",
  };
  return corners[directions];
}

export default function GameBoard({
  boardState,
}: {
  boardState: BoardStateType;
}) {
  return (
    <div
      role="img"
      aria-label={`Snake arena, turn ${boardState.turn}. Green length ${boardState.snake1.body.length}, blue length ${boardState.snake2.body.length}.`}
      className="grid w-full max-w-[390px] aspect-square mx-auto"
      style={{
        gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: SIZE * SIZE }, (_, i) => {
        const p: PosType = [i % SIZE, Math.floor(i / SIZE)];
        let content = null;
        for (const [snake, color] of [
          [boardState.snake1, "green"],
          [boardState.snake2, "blue"],
        ] as const) {
          const index = snake.body.findIndex((v) => same(v, p));
          if (index < 0) continue;
          content =
            index === 0 ? (
              <SnakeHead dir={snake.dir} color={color} keyProp={String(i)} />
            ) : index === snake.body.length - 1 ? (
              <SnakeTail
                dir={toward(p, snake.body[index - 1])}
                color={color}
                keyProp={String(i)}
              />
            ) : (
              <SnakeBody
                color={color}
                keyProp={String(i)}
                corner={bodyTurnCorner(snake.body, index)}
              />
            );
          break;
        }
        if (!content && boardState.food.some((v) => same(v, p)))
          content = <Food />;
        return (
          <div
            key={i}
            className="min-w-0 min-h-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800 border-[1.5px] border-white dark:border-black rounded-[0.25rem]"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
