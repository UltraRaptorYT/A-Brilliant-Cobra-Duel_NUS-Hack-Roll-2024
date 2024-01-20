import GameBoard from "./GameBoard";
import { useState, useEffect } from "react";

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
  food: [[1, 2]],
};

// TESTING PURPOSES ONLY
const snake1Prompt: string = `You are an expert gamer agent playing the 1vs1 snake game in a grid board. You can move up, down, left or right. 
You can eat food to grow. If you hit a wall or another snake, you die. The game ends when one of the snakes dies. You are compiting against another snake.""",

"""You are the snake1, which is the color green. Your opponent is the snake2 with color blue. This is the game board in emojis where heads are rounds, bodies are squares and food is an apple: 
{Emojis_board}

and this is the board state in JSON, positions are in (x, y) format, the game board size is 15 by 15, x goes from 0 to 14 left to right and y goes 0 to 14 up to down: 
{Board_state_str}

The snake dir parameter is the first letter of the previous chosen direction of the snake, if you chose an opposite direction you will die as you will collide with your own body.
You have to shortly reason your next move in 1-3 lines and then always add one of the following emojis: ⬆️, ⬇️, ⬅️, ➡️ (for <up>, <down>, <left> and <right>) to chose the direction of your next move.
Make sure to always add a space after the emoji and only use one emoji in your response which will be your final decision for the turn.`;

const snake2Prompt: string = `You are an expert gamer agent playing the 1vs1 snake game in a grid board. You can move up, down, left or right. 
You can eat food to grow. If you hit a wall or another snake, you die. The game ends when one of the snakes dies. You are compiting against another snake.""",

"""You are the snake2, which is the color blue. Your opponent is the snake1 with color green. This is the game board in characters where heads are 'G' (green) and 'B' (blue), bodies are 'g' and 'b' and food is 'R'. Empty cells are marked with '_'. 
Every line starts also with its number which is at the same time the y coordinate for that line: 
Characters board:
{Chars_board}

and this is the board state in JSON, positions are in (x, y) format, the game board size is 15 by 15, x goes from 0 to 14 left to right and y goes 0 to 14 up to down: 
{Board_state_str}

The snake dir parameter is the first letter o{Emoji_board}f the previous chosen direction of the snake, if you chose an opposite direction you will die as you will collide with your own body.
You have to shortly reason your next move in 1-3 lines and then always add one of the following emojis: ⬆️, ⬇️, ⬅️, ➡️ (for <up>, <down>, <left> and <right>) to chose the direction of your next move.
Make sure to always add a space after the emoji and only use one emoji in your response which will be your final decision for the turn.

Makt the following Chain of Thought in few words:
1. Locate yourself and your head in the chars map (the <B> char) and the (x, y) coordinates from the board state (the element 0 of the body list in snake2, the body parts are ordered from head to tail)
2. Locate the closest food
3. Chose the direction to move on cell closer to the food, check if you will die/lose there and if so chose another direction
4. Finally output the emoji for the direction you chose`;

export default function Game({
  game_id,
  round_id,
  gameState,
  playerData,
}: {
  game_id: string;
  round_id: number;
  gameState: boolean;
  playerData: {
    player1: { user_id: string; prompt: string };
    player2: { user_id: string; prompt: string };
  };
}) {
  const size = 15;
  const MAX_TURN = 100;
  const [isPlaying, setIsPlaying] = useState<boolean>(gameState);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [board, setBoard] = useState<number[][]>([]);
  const [boardState, setBoardState] = useState<BoardStateType>(initBoardState);
  const [turn, setTurn] = useState<number>(0);

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

        console.log(`SNAKE 1: ${action1} ${reason1}`);
        console.log(`SNAKE 2: ${action2} ${reason2}`);

        moveDirection("snake1", action1);
        moveDirection("snake2", action2);

        setIsPlaying(true);

        // turn++;
        setTurn(turn + 1);
      };

      MakeAction(
        snake1Prompt,
        snake2Prompt,
        boardState,
        turn,
        game_id,
        round_id,
        gameOver
      );
    }
  }, [isPlaying]);

  return (
    <>
      <GameBoard size={size} board={board} boardState={boardState}></GameBoard>
    </>
  );
}
