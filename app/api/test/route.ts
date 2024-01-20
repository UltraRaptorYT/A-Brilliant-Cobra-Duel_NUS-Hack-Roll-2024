import { NextResponse } from "next/server";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";

const OPENAI_API_ENDPOINT: string = process.env.OPENAI_API_ENDPOINT || "";
const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY || "";
const OPENAI_API_ENGINE: string = process.env.OPENAI_API_ENGINE || "";

export async function POST(req: Request) {
  const client = new OpenAIClient(
    OPENAI_API_ENDPOINT,
    new AzureKeyCredential(OPENAI_API_KEY)
  );
  const { message } = await req.json();
  const events = client.listChatCompletions(OPENAI_API_ENGINE, [
    { role: "user", content: message },
  ]);
  let output = "";
  for await (const event of events) {
    for (const choice of event.choices) {
      const delta = choice.delta?.content;
      if (delta !== undefined) {
        output += delta;
        console.log(`Chatbot: ${delta}`);
      }
    }
  }
  return NextResponse.json({ message: output });
}
