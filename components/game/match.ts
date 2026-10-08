import { BoardStateType } from "./gameTypes";
import { Decision } from "./decisions";
import { initialState, isBoardState, isDirection } from "./engine";

export type TurnRecord = {
  turn: number;
  player1: Decision;
  player2: Decision;
  board: BoardStateType;
};
export type Match = {
  round: string;
  revision: number;
  board: BoardStateType;
  history: TurnRecord[];
  running: boolean;
};
export const newMatch = (): Match => ({
  round: "initial",
  revision: 0,
  board: initialState(),
  history: [],
  running: false,
});
export function isDecision(value: unknown): value is Decision {
  const d = value as Decision;
  return (
    !!d &&
    isDirection(d.action) &&
    typeof d.reason === "string" &&
    d.reason.length <= 1000 &&
    ["builtin", "laya", "openai"].includes(d.provider)
  );
}
export function isMatch(value: unknown): value is Match {
  const m = value as Match;
  return (
    !!m &&
    typeof m.round === "string" &&
    m.round.length <= 100 &&
    Number.isSafeInteger(m.revision) &&
    m.revision >= 0 &&
    isBoardState(m.board) &&
    typeof m.running === "boolean" &&
    Array.isArray(m.history) &&
    m.history.length === m.board.turn &&
    m.history.every(
      (r, i) =>
        r.turn === i + 1 &&
        isDecision(r.player1) &&
        isDecision(r.player2) &&
        isBoardState(r.board) &&
        r.board.turn === r.turn,
    )
  );
}
