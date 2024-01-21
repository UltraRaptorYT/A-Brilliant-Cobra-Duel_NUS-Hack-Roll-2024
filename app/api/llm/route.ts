import OpenAI from "openai";
import { NextResponse } from "next/server";
import { NextApiRequest } from "next/types";
import { createClient } from "@supabase/supabase-js";

export type PosType = [number, number];

export type SnakeType = {
  body: PosType[];
  dir: Direction;
  prevDir: Direction;
  dirArr: Direction[];
  isAlive: boolean;
};

export type Direction = "U" | "D" | "L" | "R";

export type BoardStateType = {
  turn: number;
  snake1: SnakeType;
  snake2: SnakeType;
  food: PosType[];
};

export type GameBoardProps = {
  size: number;
  board: number[][];
  boardState: BoardStateType;
};

export type SnakeProps = {
  dir?: Direction;
  color: string;
  keyProp: string;
};

export interface SnakeActionType {
  turn: number;
  action: string;
  reason: string;
}

const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_API_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_API_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function openAISnake1(content: string) {
  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    messages: [
      {
        role: "system",
        content:
          "You are an expert gamer agent playing the 1vs1 snake game in a grid board.You are Snake1. You can move up, down, left or right. You can eat food to grow. If you hit a wall or another snake, you die. The game ends when one of the snakes dies. You are compiting against another snake.\n\nRules:\n1.You Must always give reason for your action taken\n2.Must always format output in JSON with two keys 'action' and 'reason'Example:{'action':'U','reason':string...}\n3.Final action must be either 'U','D','L','R'",
      },
      { role: "user", content: `${content}` },
    ],
    model: "gpt-4-1106-preview",
    response_format: { type: "json_object" },
  };

  const chatCompletion: OpenAI.Chat.ChatCompletion =
    await openai.chat.completions.create(params);

  var arg1 = chatCompletion.choices[0].message.content;
  console.dir("arg1\n", arg1);

  if (!arg1) {
    throw new Error("No arg");
  }

  // var { action, reason } = JSON.parse(arg);
  var { action, reason } = JSON.parse(arg1);
  return { action: action, reason: reason };
}

async function openAISnake2(content: string) {
  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    messages: [
      {
        role: "system",
        content:
          "You are an expert gamer agent playing the 1vs1 snake game in a grid board.You are Snake2. You can move up, down, left or right. You can eat food to grow. If you hit a wall or another snake, you die. The game ends when one of the snakes dies. You are compiting against another snake.\n\nRules:\n1.You Must always give reason for your action taken\n2.Must always format output in JSON with two keys 'action' and 'reason'Example:{'action':'U','reason':string...}\n3.Final action must be either 'U','D','L','R'",
      },
      { role: "user", content: `${content}` },
    ],
    model: "gpt-4-1106-preview",
    response_format: { type: "json_object" },
  };
  const chatCompletion: OpenAI.Chat.ChatCompletion =
    await openai.chat.completions.create(params);

  var arg1 = chatCompletion.choices[0].message.content;
  console.dir("arg1\n", arg1);

  if (!arg1) {
    throw new Error("No arg");
  }

  // var { action, reason } = JSON.parse(arg);
  var { action, reason } = JSON.parse(arg1);
  return { action: action, reason: reason };
}

interface turnData {
  turn_id: number;
  round_id: number;
  game_id: string;
  snake1action: string;
  snake1reason: string;
  snake2action: string;
  snake2reason: string;
  boardState: string;
}

//
async function postTurnData(turnData: turnData) {
  // Unpack the turnData

  const { data, error } = await supabase.from("abcd_turn").insert(turnData);

  if (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  console.log("REQ BODY", req.body);

  var { snake1prompt, snake2prompt, game_id, round_id, turn, boardState } =
    await req.json();

  const promiseResults = Promise.all([
    openAISnake1(snake1prompt),
    openAISnake2(snake2prompt),
  ]);
  const [res1, res2] = await promiseResults;

  // Unpack the action and reason
  var { action: action1, reason: reason1 } = res1;
  var { action: action2, reason: reason2 } = res2;

  // Insert to database
  var turnData: turnData = {
    turn_id: turn,
    round_id: round_id,
    game_id: game_id,
    snake1action: action1,
    snake1reason: reason1,
    snake2action: action2,
    snake2reason: reason2,
    boardState: boardState,
  };

  console.log(turnData, "TURN DATA");
  console.log("boardState", typeof boardState);
  await postTurnData(turnData);

  return NextResponse.json({ action1, reason1, action2, reason2 });
}
