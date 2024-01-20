import { PosType, SnakeType, BoardStateType, Direction } from "./gameTypes";


// Example of a boardState
// const boardState: BoardStateType = {
//   turn: 2,
//   snake1: {
//     body: [
//       [5, 3],
//       [5, 2],
//       [4, 2],
//       [3, 2]
//     ],
//     dir: "R",
//     prevDir: "R",
//     dirArr: ["R", "R", "R", "R"],
//     isAlive: true
//   },
//   snake2: {
//     body: [
//       [9, 11],
//       [9, 12],
//       [10, 12],
//       [11, 12]
//     ],
//     dir: "L",
//     prevDir: "L",
//     dirArr: ["L", "L", "L", "L"],
//     isAlive: true
//   },
//   food: [
//     [1, 2]
//   ]
// };
// Create funcitons to transform BoardState to LLM Promptable string

export function toEmoji_board(boardState:BoardStateType): string {
  // ⬜- empty, 🟩- snake1,🟢- snake1Head, 🔵- snake2head 🟦- snake2, 🍎- food
  // Create Empty board of size 15x15
  let emojiBoard = Array.from(Array(15), () => new Array(15).fill("⬜"));

  // Add snake1 Head to the board
  emojiBoard[boardState.snake1.body[0][1]][boardState.snake1.body[0][0]] = "🟢";
  // Add snake1 body to the board
  for (let i = 1; i < boardState.snake1.body.length; i++) {
    emojiBoard[boardState.snake1.body[i][1]][boardState.snake1.body[i][0]] = "🟩";
  }

  // Add snake2 Head to the board
  emojiBoard[boardState.snake2.body[0][1]][boardState.snake2.body[0][0]] = "🔵";
  // Add snake2 body to the board
  for (let i = 1; i < boardState.snake2.body.length; i++) {
    emojiBoard[boardState.snake2.body[i][1]][boardState.snake2.body[i][0]] = "🟦";
  }

  // Add food to the board
  for (let i = 0; i < boardState.food.length; i++) {
    emojiBoard[boardState.food[i][1]][boardState.food[i][0]] = "🍎";
  }

  // Convert to string
  let emojiBoardString = emojiBoard.map(row => row.join("")).join("\n");

  return emojiBoardString;
  
}

export function toChars_board(boardState:BoardStateType):string {
  // -- empty, g- snake1,G- snake1Head, b- snake2head B- snake2, F- food
  // Create Empty board of size 15x15
  let charBoard = Array.from(Array(15), () => new Array(15).fill("-"));

  // Add snake1 Head to the board
  charBoard[boardState.snake1.body[0][1]][boardState.snake1.body[0][0]] = "G";
  // Add snake1 body to the board
  for (let i = 1; i < boardState.snake1.body.length; i++) {
    charBoard[boardState.snake1.body[i][1]][boardState.snake1.body[i][0]] = "g";
  }

  // Add snake2 Head to the board
  charBoard[boardState.snake2.body[0][1]][boardState.snake2.body[0][0]] = "B";
  // Add snake2 body to the board
  for (let i = 1; i < boardState.snake2.body.length; i++) {
    charBoard[boardState.snake2.body[i][1]][boardState.snake2.body[i][0]] = "b";
  }

  // Add food to the board
  for (let i = 0; i < boardState.food.length; i++) {
    charBoard[boardState.food[i][1]][boardState.food[i][0]] = "F";
  }

  // Convert to string
  let charBoardString = charBoard.map(row => row.join("")).join("\n");
  return charBoardString;

}

export function toBoard_state_str(boardState:BoardStateType):string{
  // Convert boardState to string
  let boardStateString = JSON.stringify(boardState);
  return boardStateString;
}


export function formatPrompt(content:string,boardState:BoardStateType):string {
  // Format userPrompt to be ready for OpenAI API
  const extractString:string[] = ["{Emoji_board}", "{Chars_board}", "{Board_state_str}"];

  
  // string regrex for function names
  for (let i = 0; i < extractString.length; i++) {
    let regrex = new RegExp(extractString[i], "g");
    
    // If match, replace 
    if (content.match(regrex)) {

      switch (extractString[i]) {
        case "{Emoji_board}":
          content = content.replace(regrex, "\n"+toEmoji_board(boardState)+"\n");
          break;
        case "{Chars_board}":
          content = content.replace(regrex, "\n"+toChars_board(boardState)+"\n");
          break;
        case "{Board_state_str}":
          content = content.replace(regrex, "\n"+toBoard_state_str(boardState)+"\n");
          break;
      }
    }
  }
  return content;

}
