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


const SUPABASE_URL: string = process.env.SUPABASE_URL || "";
const SUPABASE_API_KEY: string = process.env.SUPABASE_API_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_API_KEY);

async function POSTabcd_round(code:string) {
  const { data, error } = await supabase
    .from("abcd_room")
    .insert({ code: code })

  if (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

async function POSTabcd_round(round:number,boardState:)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function openAISnake1(content: string) {
  const messages = [
    {
      role: "system",
      content:
        "You are an expert gamer agent playing the 1vs1 snake game in a grid board. You can move up, down, left or right. You can eat food to grow. If you hit a wall or another snake, you die. The game ends when one of the snakes dies. You are compiting against another snake.\n\nRules:\n1.You Must always give reason for your action taken\n2.Must always format output in JSON\n3.Final action must be either 'U','D','L','R'",
    },
    { role: "user", content: `${content}` },
  ];
  const tools = [
    {
      type: "function",
      function: {
        name: "make_action",
        description:
          "Make an action for snake1, given the board state,rules and current board positon",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "Action to take for the snake. U,D,L,R",
              enum: ["U", "D", "L", "R"],
            },
            reason: {
              type: "string",
              description: "Reason for taking the action.",
            },
          },
          required: ["action", "reason"],
        },
      },
    },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    messages: messages,
    tools: tools,
    tool_choice: { type: "function", function: { name: "make_action" } },
    response_format: { type: "json_object" },
  });

  console.dir(response.choices[0].message, { depth: Infinity });

  var arg = response.choices[0].message.tool_calls[0].function.arguments;

  // Convert to json
  arg = JSON.parse(arg);
  // Convert to js object
  var { action, reason } = arg;

  return { action: action, reason: reason };
}

async function openAISnake2(content: string) {
  const messages = [
    {
      role: "system",
      content:
        "You are an expert gamer agent playing the 1vs1 snake game in a grid board. You can move up, down, left or right. You can eat food to grow. If you hit a wall or another snake, you die. The game ends when one of the snakes dies. You are compiting against another snake.\n\nRules:\n1.You Must always give reason for your action taken\n2.Must always format output in JSON\n3.Final action must be either 'U','D','L','R'",
    },
    { role: "user", content: `${content}` },
  ];
  const tools = [
    {
      type: "function",
      function: {
        name: "make_action",
        description:
          "Make an action for snake2, given the board state,rules and current board positon",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "Action to take for the snake. U,D,L,R",
              enum: ["U", "D", "L", "R"],
            },
            reason: {
              type: "string",
              description: "Reason for taking the action.",
            },
          },
          required: ["action", "reason"],
        },
      },
    },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    messages: messages,
    tools: tools,
    tool_choice: { type: "function", function: { name: "make_action" } },
    response_format: { type: "json_object" },
  });

  console.dir(response.choices[0].message, { depth: Infinity });

  var arg = response.choices[0].message.tool_calls[0].function.arguments;

  // Convert to json
  arg = JSON.parse(arg);
  // Convert to js object
  var { action, reason } = arg;

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
  boardState: BoardStateType;
} 

async function postTurnData(turnData: turnData) {
  const { data, error } = await supabase
    .from("abcd_turn")
    .insert({ turnData: turnData })

  if (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(req: NextApiRequest) {
  var { snake1prompt, snake2prompt } = req.body;

  const promiseResults = Promise.all([
    openAISnake1(snake1prompt),
    openAISnake2(snake2prompt),
  ]);
  const [res1, res2] = await promiseResults;

  // Unpack the action and reason
  var { action: action1, reason: reason1 } = res1;
  var { action: action2, reason: reason2 } = res2;
  
  return NextResponse.json({ action1, reason1, action2, reason2 });

}
