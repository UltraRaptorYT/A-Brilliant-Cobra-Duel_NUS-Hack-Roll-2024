import GameBoard from "./GameBoard";
import { useState, useEffect } from "react";

import { RealtimeChannel } from "@supabase/supabase-js";
import {
  PosType,
  SnakeType,
  BoardStateType,
  Direction,
  SnakeActionType,
} from "./gameTypes";

import {
  toEmoji_board,
  toChars_board,
  toBoard_state_str,
  formatPrompt,
} from "./promptFormatting";

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
  food: [[7, 7]],
};

// TESTING PURPOSES ONLY

export default function Game({
  game_id,
  round_id,
  gameState,
  playerData,
  channel,
}: {
  game_id: string;
  round_id: number;
  gameState: boolean;
  playerData: {
    player1: { user_id: string; prompt: string };
    player2: { user_id: string; prompt: string };
  };
  channel: RealtimeChannel;
}) {
  const size = 15;
  const MAX_TURN = 100;
  const [isPlaying, setIsPlaying] = useState<boolean>(gameState);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [board, setBoard] = useState<number[][]>([]);
  const [boardState, setBoardState] = useState<BoardStateType>(initBoardState);
  const [turn, setTurn] = useState<number>(0);

  useEffect(() => {
    setIsPlaying(gameState);
  }, [gameState]);

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

      console.log(boardState);

      const MakeAction = async (
        snake1Prompt: string,
        snake2Prompt: string,
        boardState: BoardStateType,
        turn: number,
        game_id: string,
        round_id: number,
        gameOver: boolean
      ) => {
        if (gameOver || boardState.turn >= MAX_TURN) {
          return setIsPlaying(false);
        }
        var snake1PromptFormatted: string = formatPrompt(
          snake1Prompt,
          boardState
        );
        var snake2PromptFormatted: string = formatPrompt(
          snake2Prompt,
          boardState
        );

        if (snake1PromptFormatted === "" || snake2PromptFormatted === "") {
          return setIsPlaying(false);
        }

        console.log("snake1PromptFormatted:", snake1PromptFormatted);
        console.log("snake2PromptFormatted:", snake2PromptFormatted);

        const response = await fetch("/api/llm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            snake1Prompt: snake1PromptFormatted,
            snake2Prompt: snake2PromptFormatted,
            boardState: boardState,
            turn: turn,
            game_id: game_id,
            round_id: round_id,
          }),
        });

        const { action1, reason1, action2, reason2 } = await response.json();

        console.log(`SNAKE 1: ${action1} ${reason1} ${boardState.turn}`);
        console.log(`SNAKE 2: ${action2} ${reason2} ${boardState.turn}`);

        moveDirection("snake1", action1);
        moveDirection("snake2", action2);

        setIsPlaying(true);

        // turn++;
        setTurn(turn + 1);
      };

      MakeAction(
        playerData.player1.prompt,
        playerData.player2.prompt,
        boardState,
        turn,
        game_id,
        round_id,
        gameOver
      );
    }
    console.log("HELLO", isPlaying);
  }, [isPlaying]);

  return (
    <>
      <GameBoard size={size} board={board} boardState={boardState}></GameBoard>
    </>
  );
}
