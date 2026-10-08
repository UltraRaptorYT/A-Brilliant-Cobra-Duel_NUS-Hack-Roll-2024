import { AgentConfig, isConfig } from "../components/game/decisions";
import { isMatch, Match } from "../components/game/match";

export type Player = {
  id: string;
  seat: 0 | 1;
  ready: boolean;
  config: AgentConfig;
};
export type RoomState = {
  epoch: string;
  players: Player[];
  match: Match;
  score: [number, number];
};
export type ServerMessage =
  | { type: "welcome"; id: string }
  | { type: "state"; room: RoomState }
  | { type: "error"; message: string };
export type ClientMessage =
  | { type: "setup"; config: AgentConfig; ready: boolean }
  | { type: "snapshot"; epoch: string; match: Match }
  | { type: "sync" };
export function isRoomState(value: unknown): value is RoomState {
  const room = value as RoomState;
  return (
    !!room &&
    typeof room.epoch === "string" &&
    Array.isArray(room.players) &&
    room.players.length <= 2 &&
    room.players.every(
      (p) =>
        typeof p.id === "string" &&
        (p.seat === 0 || p.seat === 1) &&
        typeof p.ready === "boolean" &&
        isConfig(p.config),
    ) &&
    Array.isArray(room.score) &&
    room.score.length === 2 &&
    room.score.every((n) => Number.isSafeInteger(n) && n >= 0) &&
    isMatch(room.match)
  );
}
