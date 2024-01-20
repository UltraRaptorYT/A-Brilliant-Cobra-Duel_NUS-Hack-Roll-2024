import GameBoard from "./GameBoard";
import { useState, useEffect } from "react";
import { PosType, SnakeType, BoardStateType, Direction } from "./gameTypes";
import { Button } from "@/components/ui/button";

const initBoardState: BoardStateType = {
  turn: 0,
  snake1: {
    body: [
      [5, 2],
      [4, 2],
      [3, 2],
      [2, 2],
    ],
    dir: "R",
    prevDir: "R",
    dirArr: ["R", "R", "R", "R"],
    isAlive: true,
  },
  snake2: {
    body: [
      [9, 12],
      [10, 12],
      [11, 12],
      [12, 12],
    ],
    dir: "L",
    prevDir: "L",
    dirArr: ["L", "L", "L", "L"],
    isAlive: true,
  },
  food: [[1, 2]],
};

export default function Game() {
  const size = 15;
  const MAX_TURN = 100;
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [board, setBoard] = useState<number[][]>([]);
  const [boardState, setBoardState] = useState<BoardStateType>(initBoardState);

  function placeFood(boardState: BoardStateType): PosType | undefined {
    let newFoodPos: PosType;
    let count = 0;
    do {
      count++;
      newFoodPos = [
        Math.floor(Math.random() * 15),
        Math.floor(Math.random() * 15),
      ];
    } while (
      (boardState.snake1.body.some((e) => {
        return e[0] == newFoodPos[0] && e[1] == newFoodPos[1];
      }) ||
        boardState.snake2.body.some((e) => {
          return e[0] == newFoodPos[0] && e[1] == newFoodPos[1];
        }) ||
        boardState.food.some((e) => {
          return e[0] == newFoodPos[0] && e[1] == newFoodPos[1];
        })) &&
      count <= 50
    );
    if (count <= 50) {
      return newFoodPos;
    }
    return undefined;
  }

  function moveDirection(snake: "snake1" | "snake2", direction: Direction) {
    setBoardState((prevState) => {
      let finalState = { ...prevState };
      let newDirArr = [...prevState[snake].dirArr];
      newDirArr.pop();
      newDirArr.unshift(direction);
      finalState[snake] = {
        ...prevState[snake],
        dir: direction,
        prevDir: prevState[snake].dir,
        dirArr: newDirArr,
      };
      return finalState;
    });
  }

  function moveSnake(boardState: BoardStateType, snake: SnakeType) {
    let head: PosType = [...snake["body"][0]];
    if (snake["dir"] != snake["prevDir"]) {
      // alert("Turn");
    }
    switch (snake["dir"]) {
      case "U":
        head = [head[0], head[1] - 1];
        break;
      case "D":
        head = [head[0], head[1] + 1];
        break;
      case "L":
        head = [head[0] - 1, head[1]];
        break;
      case "R":
        head = [head[0] + 1, head[1]];
        break;
    }
    snake["body"].unshift(head);

    if (
      boardState["food"].some((e) => {
        return e[0] == head[0] && e[1] == head[1];
      })
    ) {
      boardState["food"].splice(boardState["food"].indexOf(head), 1);
    } else {
      snake["body"].pop();
    }
  }

  useEffect(() => {
    let board = [];
    for (let i = 0; i < size; i++) {
      board.push(new Array(size).fill(0));
    }
    setBoard(board);
  }, []);

  // useEffect(() => {
  //   alert("GAME OVER");
  // }, [gameOver]);

  useEffect(() => {
    if (isPlaying) {
      moveSnake(boardState, boardState.snake1);
      moveSnake(boardState, boardState.snake2);

      setIsPlaying(false);
      // Game Over
      if (
        boardState.snake2.body.some((e) => {
          return (
            e[0] == boardState.snake1.body[0][0] &&
            e[1] == boardState.snake1.body[0][1]
          );
        }) ||
        boardState.snake1.body.slice(1).some((e) => {
          return (
            e[0] == boardState.snake1.body[0][0] &&
            e[1] == boardState.snake1.body[0][1]
          );
        }) ||
        boardState.snake1.body[0][0] < 0 ||
        boardState.snake1.body[0][1] < 0 ||
        boardState.snake1.body[0][0] > size ||
        boardState.snake1.body[0][1] > size
      ) {
        boardState.snake1.isAlive = false;
        alert("P2 Win");
        setGameOver(true);
      }

      if (
        boardState.snake1.body.some((e) => {
          return (
            e[0] == boardState.snake2.body[0][0] &&
            e[1] == boardState.snake2.body[0][1]
          );
        }) ||
        boardState.snake2.body.slice(1).some((e) => {
          return (
            e[0] == boardState.snake2.body[0][0] &&
            e[1] == boardState.snake2.body[0][1]
          );
        }) ||
        boardState.snake2.body[0][0] < 0 ||
        boardState.snake2.body[0][1] < 0 ||
        boardState.snake2.body[0][0] > size ||
        boardState.snake2.body[0][1] > size
      ) {
        boardState.snake2.isAlive = false;
        alert("P1 Win");
        setGameOver(true);
      }
    }
  }, [boardState]);

  useEffect(() => {
    if (isPlaying) {
      // while (!gameOver && boardState.turn < MAX_TURN) {
      setBoardState((prevState) => ({
        ...prevState,
        turn: prevState["turn"]++,
      }));
      if (boardState.food.length < 2) {
        let newFoodPos: PosType | undefined = placeFood(boardState);
        if (newFoodPos !== undefined) {
          setBoardState((prevState) => {
            const updatedFood = [...prevState.food, newFoodPos as PosType];
            return {
              ...prevState,
              food: updatedFood,
            };
          });
        }
      }
      // Agent Logic
      moveDirection("snake1", "D");
      moveDirection("snake2", "L");
    }
  }, [isPlaying]);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setIsPlaying(true);
        }}
      >
        Button
      </Button>
      <GameBoard size={size} board={board} boardState={boardState}></GameBoard>
    </>
  );
}
