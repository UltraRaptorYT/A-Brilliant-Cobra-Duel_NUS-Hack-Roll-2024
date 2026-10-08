import { DurableObject } from "cloudflare:workers";
import { defaultConfig, isConfig } from "../../../components/game/decisions";
import { isMatch, Match, newMatch } from "../../../components/game/match";
import { outcome } from "../../../components/game/engine";
import { Player, RoomState, ServerMessage } from "../../../lib/room-protocol";

type Session = { id: string; seat: 0 | 1 | null; lastMessage: number };

export class GameRoom extends DurableObject<Env> {
  private room!: RoomState;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)",
      );
      const rows = this.ctx.storage.sql
        .exec<{ value: string }>("SELECT value FROM room WHERE id = 1")
        .toArray();
      this.room = rows.length
        ? JSON.parse(rows[0].value)
        : {
            epoch: crypto.randomUUID(),
            players: [],
            match: newMatch(),
            score: [0, 0],
          };
      // After a runtime restart only attached sockets are still present.
      const connected = new Set(
        this.ctx
          .getWebSockets()
          .map((ws) => (ws.deserializeAttachment() as Session).id),
      );
      const players = this.room.players.filter((p) => connected.has(p.id));
      if (players.length !== this.room.players.length)
        this.save({
          ...this.room,
          players,
          epoch: crypto.randomUUID(),
          match: newMatch(),
        });
    });
  }
  private save(room: RoomState) {
    this.ctx.storage.sql.exec(
      "INSERT INTO room(id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value",
      JSON.stringify(room),
    );
    this.room = room;
  }
  private send(ws: WebSocket, message: ServerMessage) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      /* Close event removes stale membership. */
    }
  }
  private broadcast() {
    for (const ws of this.ctx.getWebSockets())
      this.send(ws, { type: "state", room: this.room });
  }
  async fetch(request: Request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response("WebSocket required", { status: 426 });
    if (this.ctx.getWebSockets().length >= 16)
      return new Response("Room full", { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const seat = !this.room.players.some((p) => p.seat === 0)
      ? 0
      : !this.room.players.some((p) => p.seat === 1)
        ? 1
        : null;
    const session: Session = { id: crypto.randomUUID(), seat, lastMessage: 0 };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(session);
    if (seat !== null) {
      const player: Player = {
        id: session.id,
        seat,
        ready: false,
        config: defaultConfig(),
      };
      this.save({
        ...this.room,
        epoch: crypto.randomUUID(),
        players: [...this.room.players, player].sort((a, b) => a.seat - b.seat),
        match: newMatch(),
      });
    }
    this.send(server, { type: "welcome", id: session.id });
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string" || raw.length > 500000) {
      ws.close(1009, "Message too large");
      return;
    }
    const session = ws.deserializeAttachment() as Session;
    let data: {
      type?: unknown;
      config?: unknown;
      ready?: unknown;
      epoch?: unknown;
      match?: unknown;
    };
    try {
      data = JSON.parse(raw);
    } catch {
      this.send(ws, { type: "error", message: "Invalid message." });
      return;
    }
    if (data?.type === "sync") {
      this.send(ws, { type: "state", room: this.room });
      return;
    }
    const player = this.room.players.find((p) => p.id === session.id);
    if (!player) {
      this.send(ws, {
        type: "error",
        message: "Spectators cannot change the room.",
      });
      return;
    }
    if (data?.type === "setup") {
      if (
        this.room.match.running ||
        !isConfig(data.config) ||
        typeof data.ready !== "boolean"
      ) {
        this.send(ws, {
          type: "error",
          message: "Pause the round before changing setup.",
        });
        return;
      }
      const config = data.config,
        ready = data.ready;
      this.save({
        ...this.room,
        players: this.room.players.map((p) =>
          p.id === player.id ? { ...p, config, ready } : p,
        ),
      });
    } else if (data?.type === "snapshot") {
      if (
        player.seat !== 0 ||
        data.epoch !== this.room.epoch ||
        !isMatch(data.match)
      ) {
        this.send(ws, {
          type: "error",
          message: "Only the current host can advance this round.",
        });
        return;
      }
      const match: Match = data.match;
      const before = this.room.match;
      if (match.revision !== before.revision + 1) {
        this.send(ws, { type: "state", room: this.room });
        return;
      }
      if (
        (match.running || match.board.turn > before.board.turn) &&
        (this.room.players.length !== 2 ||
          !this.room.players.every((p) => p.ready))
      ) {
        this.send(ws, {
          type: "error",
          message: "Both players must be ready.",
        });
        return;
      }
      if (
        match.round === before.round &&
        (match.board.turn < before.board.turn ||
          match.board.turn > before.board.turn + 1)
      ) {
        this.send(ws, { type: "error", message: "Invalid turn sequence." });
        return;
      }
      if (
        match.round !== before.round &&
        (match.board.turn !== 0 || match.running)
      ) {
        this.send(ws, { type: "error", message: "Invalid new round." });
        return;
      }
      const score: [number, number] = [...this.room.score];
      const result = outcome(match.board);
      if (!outcome(before.board) && result && match.round === before.round) {
        if (result.winner === "P1") score[0]++;
        if (result.winner === "P2") score[1]++;
      }
      this.save({ ...this.room, match, score });
    } else {
      this.send(ws, { type: "error", message: "Unknown message." });
      return;
    }
    this.broadcast();
  }
  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.remove(ws);
    // Abnormal-disconnect codes (1005/1006/1015) cannot be sent in a close frame.
    ws.close([1005, 1006, 1015].includes(code) ? 1000 : code, reason);
  }
  async webSocketError(ws: WebSocket) {
    this.remove(ws);
  }
  private remove(ws: WebSocket) {
    const session = ws.deserializeAttachment() as Session;
    if (!this.room.players.some((p) => p.id === session.id)) return;
    this.save({
      ...this.room,
      epoch: crypto.randomUUID(),
      players: this.room.players
        .filter((p) => p.id !== session.id)
        .map((p) => ({ ...p, ready: false })),
      match: newMatch(),
    });
    this.broadcast();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true });
    const match = /^\/rooms\/([a-zA-Z0-9-]{1,64})$/.exec(url.pathname);
    if (!match) return new Response("Not found", { status: 404 });
    const origin = request.headers.get("Origin");
    if (
      !origin ||
      !env.ALLOWED_ORIGINS.split(",")
        .map((s) => s.trim())
        .includes(origin)
    )
      return new Response("Origin not allowed", { status: 403 });
    return env.ROOMS.getByName(match[1]).fetch(request);
  },
} satisfies ExportedHandler<Env>;
