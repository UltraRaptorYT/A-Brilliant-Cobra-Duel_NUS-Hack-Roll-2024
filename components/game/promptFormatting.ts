import { BoardStateType, PosType } from "./gameTypes";
import { inside, SIZE } from "./engine";
function render(state: BoardStateType, symbols: string[]) {
  const cells = Array.from({ length: SIZE }, () =>
    Array<string>(SIZE).fill(symbols[0]),
  );
  const put = (p: PosType, symbol: string) => {
    if (inside(p)) cells[p[1]][p[0]] = symbol;
  };
  state.food.forEach((p) => put(p, symbols[5]));
  state.snake1.body.forEach((p, i) => put(p, symbols[i === 0 ? 1 : 2]));
  state.snake2.body.forEach((p, i) => put(p, symbols[i === 0 ? 3 : 4]));
  return cells.map((row) => row.join(" ")).join("\n");
}
export const toEmoji_board = (state: BoardStateType) =>
  render(state, ["⬜", "🟢", "🟩", "🔵", "🟦", "🍎"]);
export const toChars_board = (state: BoardStateType) =>
  render(state, ["-", "G", "g", "B", "b", "F"]);
export const toBoard_state_str = (state: BoardStateType) =>
  JSON.stringify(state);
export function formatPrompt(content: string, state: BoardStateType): string {
  return content.replace(
    /\{(emojis?_board|chars_board|board_state_str)\}/gi,
    (_, name: string) => {
      const key = name.toLowerCase();
      return key === "chars_board"
        ? toChars_board(state)
        : key === "board_state_str"
          ? toBoard_state_str(state)
          : toEmoji_board(state);
    },
  );
}
