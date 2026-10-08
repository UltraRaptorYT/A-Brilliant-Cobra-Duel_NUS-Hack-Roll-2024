import { NextResponse } from "next/server";
import OpenAI from "openai";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  isBoardState,
  legalDirections,
  outcome,
  SnakeId,
} from "@/components/game/engine";
import {
  AgentConfig,
  chooseBuiltin,
  Decision,
  decisionContext,
  chooseGuardedLaya,
  isConfig,
} from "@/components/game/decisions";
import { BoardStateType } from "@/components/game/gameTypes";
import { formatPrompt } from "@/components/game/promptFormatting";
import { layaChoice, modelDirectory } from "@/lib/laya";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const laya = await Promise.all(
    [
      "model.onnx",
      "laya_config.json",
      "tokenizer.json",
      "tokenizer_config.json",
    ].map((file) => access(path.join(modelDirectory(), file))),
  ).then(
    () => true,
    () => false,
  );
  return NextResponse.json({
    builtin: true,
    laya,
    openai: !!process.env.OPENAI_API_KEY,
  });
}

async function decide(
  state: BoardStateType,
  id: SnakeId,
  config: AgentConfig,
): Promise<Decision> {
  const fallback = chooseBuiltin(state, id, config);
  if (config.provider === "builtin") return fallback;
  const context = decisionContext(state, id, config);
  const options = legalDirections(state[id]);
  try {
    if (config.provider === "laya") {
      return await chooseGuardedLaya(state, id, config, layaChoice);
    }
    if (!process.env.OPENAI_API_KEY) throw new Error("Missing key");
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 15000,
      maxRetries: 0,
    });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content: `You control ${id} in simultaneous snake on a 10 by 10 board. Pick one legal direction from ${options.join(",")}. Return JSON {"action":"U","reason":"brief move summary"}. Use the supplied candidate metrics and player preference. Never reverse. Head-on collisions kill both snakes. There is no turn limit; when the board fills, the longer snake wins.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            ...context,
            preference: formatPrompt(config.prompt, state),
          }),
        },
      ],
    });
    const result = JSON.parse(response.choices[0]?.message.content || "{}");
    if (!options.includes(result.action) || typeof result.reason !== "string")
      throw new Error("Invalid choice");
    return {
      action: result.action,
      reason: result.reason.slice(0, 400),
      provider: "openai",
    };
  } catch (error) {
    console.warn(
      `${config.provider} unavailable:`,
      error instanceof Error ? error.message : "provider error",
    );
    return {
      ...fallback,
      fallback: true,
      reason: `${config.provider === "laya" ? "Laya" : "GPT"} unavailable or returned an invalid move; built-in fallback. ${fallback.reason}`,
    };
  }
}

// Bound expensive inference per server process; never queue unbounded model work.
let busy = false;
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length")) > 32768)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let data;
  try {
    const text = await req.text();
    if (text.length > 32768)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (
    !isBoardState(data?.boardState) ||
    !isConfig(data?.player1) ||
    !isConfig(data?.player2)
  )
    return NextResponse.json(
      { error: "Invalid board or agent configuration." },
      { status: 400 },
    );
  if (outcome(data.boardState))
    return NextResponse.json(
      { error: "This round has ended." },
      { status: 409 },
    );
  if (busy)
    return NextResponse.json(
      { error: "Inference is busy. Try again shortly." },
      { status: 429 },
    );
  busy = true;
  try {
    const [player1, player2] = await Promise.all([
      decide(data.boardState, "snake1", data.player1),
      decide(data.boardState, "snake2", data.player2),
    ]);
    return NextResponse.json({ turn: data.boardState.turn, player1, player2 });
  } finally {
    busy = false;
  }
}
