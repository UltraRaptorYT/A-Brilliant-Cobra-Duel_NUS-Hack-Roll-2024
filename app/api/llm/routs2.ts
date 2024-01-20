import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

async function main() {

  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    
    messages: [{ role: 'user', content: 'Say this is a test' }],
    model: 'gpt-3.5-turbo-1106',
    tools: [
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
  ],
  tool_choice: { type: "function", function: { name: "make_action" } },
    response_format: { type: "json_object" },
    
  };
  const chatCompletion: OpenAI.Chat.ChatCompletion = await openai.chat.completions.create(params);

  var arg = chatCompletion.choices[0].message.tool_calls?.[0].function.arguments;

  

}

main();