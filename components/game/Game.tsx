import GameBoard from "./GameBoard";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import supabase from "@/lib/supabase";

type TurnData = {
  action1: "U" | "D" | "L" | "R";
  action2: "U" | "D" | "L" | "R";
  reason1: string;
  reason2: string;
  turn: number;
};

const mapDirection = {
  U: "⬆️",
  L: "⬅️",
  R: "➡️",
  D: "⬇️",
};

export default function Game({
  game_id,
  round_id,
  gameState,
  playerData,
  channel,
  updateState,
}: {
  game_id: string;
  round_id: number;
  gameState: boolean;
  playerData: {
    player1: { user_id: string; prompt: string };
    player2: { user_id: string; prompt: string };
  };
  channel: RealtimeChannel;
  updateState: BoardStateType;
}) {
  const size = 15;
  const MAX_TURN = 100;
  const [isPlaying, setIsPlaying] = useState<boolean>(gameState);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [board, setBoard] = useState<number[][]>([]);
  const [boardState, setBoardState] = useState<BoardStateType>(updateState);
  const [turn, setTurn] = useState<number>(0);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalText, setModalText] = useState<string>("");
  const [turnData, setTurnData] = useState<TurnData[]>([]);

  useEffect(() => {
    setIsPlaying(gameState);
  }, [gameState]);

  async function addWinner(winner: "P1" | "P2") {
    const { error } = await supabase
      .from("abcd_round")
      .update({ winner: winner })
      .eq("round_id", round_id)
      .eq("game_id", game_id);
    if (error) {
      return console.log(error);
    }
  }

  useEffect(() => {
    console.log(updateState);
    setBoardState(updateState);
    setIsPlaying(false);
    // Game Over
    if (
      updateState.snake2.body.some((e) => {
        return (
          e[0] == updateState.snake1.body[0][0] &&
          e[1] == updateState.snake1.body[0][1]
        );
      }) ||
      updateState.snake1.body.slice(1).some((e) => {
        return (
          e[0] == updateState.snake1.body[0][0] &&
          e[1] == updateState.snake1.body[0][1]
        );
      }) ||
      updateState.snake1.body[0][0] < 0 ||
      updateState.snake1.body[0][1] < 0 ||
      updateState.snake1.body[0][0] > size ||
      updateState.snake1.body[0][1] > size
    ) {
      updateState.snake1.isAlive = false;
      setModalText("Player 2 [Blue Snake] for winning");
      setShowModal(true);
      setGameOver(true);
      setIsPlaying(false);
      addWinner("P2")
    }

    if (
      updateState.snake1.body.some((e) => {
        return (
          e[0] == updateState.snake2.body[0][0] &&
          e[1] == updateState.snake2.body[0][1]
        );
      }) ||
      updateState.snake2.body.slice(1).some((e) => {
        return (
          e[0] == updateState.snake2.body[0][0] &&
          e[1] == updateState.snake2.body[0][1]
        );
      }) ||
      updateState.snake2.body[0][0] < 0 ||
      updateState.snake2.body[0][1] < 0 ||
      updateState.snake2.body[0][0] > size ||
      updateState.snake2.body[0][1] > size
    ) {
      updateState.snake2.isAlive = false;
      setModalText("Player 1 [Green Snake] for winning");
      setShowModal(true);
      setGameOver(true);
      setIsPlaying(false);
      addWinner("P1");
    }
  }, [updateState]);

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
    setShowModal(false);
  }, []);

  // useEffect(() => {
  //   alert("GAME OVER");
  // }, [gameOver]);

  useEffect(() => {
    if (isPlaying) {
      moveSnake(boardState, boardState.snake1);
      moveSnake(boardState, boardState.snake2);
    }
  }, [boardState]);

  useEffect(() => {
    if (isPlaying) {
      let currentBoardState = boardState;
      currentBoardState = {
        ...currentBoardState,
        turn: currentBoardState.turn++,
      };
      channel.send({
        type: "broadcast",
        event: "updateState",
        payload: boardState,
      });
      if (currentBoardState.food.length < 2) {
        let newFoodPos: PosType | undefined = placeFood(currentBoardState);
        if (newFoodPos !== undefined) {
          const updatedFood = [
            ...currentBoardState.food,
            newFoodPos as PosType,
          ];
          currentBoardState = {
            ...currentBoardState,
            food: updatedFood,
          };
          console.log(updatedFood);
          channel.send({
            type: "broadcast",
            event: "updateTurn",
            payload: currentBoardState,
          });
        }
      }

      console.log(currentBoardState);

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

        if (playerData.player2.user_id == localStorage.getItem("user_id")) {
          return;
        }
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

        setTurnData((prevState) => [
          ...prevState,
          {
            action1,
            action2,
            reason1,
            reason2,
            turn: boardState.turn,
          },
        ]);

        moveDirection("snake1", action1);
        moveDirection("snake2", action2);

        setIsPlaying(true);

        // turn++;
        setTurn(turn + 1);
        channel.send({
          type: "broadcast",
          event: "updateTurn",
          payload: currentBoardState,
        });
      };

      MakeAction(
        playerData.player1.prompt,
        playerData.player2.prompt,
        currentBoardState,
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
      <div className="grid grid-cols-1 md:grid-cols-[150px_1fr_150px] gap-4 items-start">
        <div className="flex flex-col w-[150px] gap-3 h-[75dvh] overflow-auto order-2 md:order-1">
          {turnData.map((val: TurnData, idx) => {
            return (
              <Card key={"player1_" + idx}>
                <CardHeader className="p-3">
                  <CardTitle className="text-lg">
                    Turn {val.turn} - {mapDirection[val.action1]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <p className="text-sm">{val.reason1}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <GameBoard
          size={size}
          board={board}
          boardState={boardState}
        ></GameBoard>
        <div className="flex flex-col w-[150px] gap-3 h-[75dvh] overflow-auto order-3">
          {turnData.map((val: TurnData, idx) => {
            return (
              <Card key={"player2_" + idx}>
                <CardHeader className="p-3">
                  <CardTitle className="text-lg">
                    Turn {val.turn} - {mapDirection[val.action2]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <p className="text-sm">{val.reason2}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <Dialog
        open={showModal}
        onOpenChange={() => {
          setShowModal((prev) => !prev);
        }}
      >
        <DialogContent>
          <DialogHeader className="sm:text-center gap-4">
            <DialogTitle>Congratulations to {modalText}</DialogTitle>
            <DialogDescription>
              <Button
                onClick={() => {
                  location.reload();
                }}
              >
                Play Again?
              </Button>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
