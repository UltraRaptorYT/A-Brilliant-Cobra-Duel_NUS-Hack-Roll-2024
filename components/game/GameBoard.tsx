import { cn } from "@/lib/utils";
import { GameBoardProps } from "./gameTypes";
import SnakeBody from "./snake/SnakeBody";
import SnakeHead from "./snake/SnakeHead";
import SnakeTail from "./snake/SnakeTail";
import Food from "./Food";

export default function GameBoard({ size, board, boardState }: GameBoardProps) {
  return (
    <div
      className={cn(`grid relative order-1 md:order-2 w-fit mx-auto`)}
      style={{
        gridTemplateColumns: `repeat(${size}, clamp(20px,5vw,35px))`,
      }}
    >
      {board.map((row, rowIdx) => {
        return row.map((col, colIdx) => {
          let key =
            String(boardState.turn) + "GRID" + String(rowIdx) + String(colIdx);
          return (
            <div
              className="w-[clamp(20px,5vw,35px)] aspect-square bg-gray-200 dark:bg-gray-800 border-[1.5px] border-white dark:border-black rounded-[0.25rem]"
              key={key}
            ></div>
          );
        });
      })}
      <div
        className="absolute top-0 left-0 right-0 bottom-0 grid"
        style={{
          gridTemplateColumns: `repeat(${size}, clamp(20px,5vw,35px))`,
        }}
      >
        {board.map((row, rowIdx) => {
          return row.map((col, colIdx) => {
            for (let bodyPos of boardState.snake1.body) {
              let key =
                String(boardState.turn) +
                "Snake1" +
                String(rowIdx) +
                String(colIdx);
              let index = boardState.snake1.body.indexOf(bodyPos);
              if (bodyPos[0] == colIdx && bodyPos[1] == rowIdx) {
                if (index == 0) {
                  return (
                    <SnakeHead
                      dir={boardState.snake1.dir}
                      color={"green"}
                      keyProp={key}
                    />
                  );
                } else if (index + 1 == boardState.snake1.body.length) {
                  console.log(String(boardState.turn) + "Snake1");
                  return (
                    <SnakeTail
                      dir={
                        boardState.snake1.dirArr[
                          boardState.snake1.dirArr.length - 2
                        ]
                      }
                      color={"green"}
                      keyProp={key}
                    />
                  );
                }
                return <SnakeBody color={"green"} keyProp={key} />;
              }
            }

            for (let bodyPos of boardState.snake2.body) {
              let key =
                String(boardState.turn) +
                "Snake2" +
                String(rowIdx) +
                String(colIdx);
              let index = boardState.snake2.body.indexOf(bodyPos);
              if (bodyPos[0] == colIdx && bodyPos[1] == rowIdx) {
                if (index == 0) {
                  return (
                    <SnakeHead
                      dir={boardState.snake2.dir}
                      color={"blue"}
                      keyProp={key}
                    />
                  );
                } else if (index + 1 == boardState.snake2.body.length) {
                  return (
                    <SnakeTail
                      dir={
                        boardState.snake2.dirArr[
                          boardState.snake2.dirArr.length - 2
                        ]
                      }
                      color={"blue"}
                      keyProp={key}
                    />
                  );
                }
                return <SnakeBody color={"blue"} keyProp={key} />;
              }
            }
            for (let bodyPos of boardState.food) {
              let key =
                String(boardState.turn) +
                "Food" +
                String(rowIdx) +
                String(colIdx);
              if (bodyPos[0] == colIdx && bodyPos[1] == rowIdx) {
                return (
                  <div
                    className={`w-[clamp(20px,5vw,35px)] aspect-square border-transparent rounded-[0.25rem] flex items-center justify-center text-red-500`}
                    key={key}
                  >
                    <Food />
                  </div>
                );
              }
            }
            let key =
              String(boardState.turn) +
              "Blank" +
              String(rowIdx) +
              String(colIdx);
            return (
              <div
                className={`w-[clamp(20px,5vw,35px)] aspect-square border-transparent rounded-[0.25rem] flex items-center justify-center`}
                key={key}
              ></div>
            );
          });
        })}
      </div>
    </div>
  );
}
