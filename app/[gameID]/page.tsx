"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Share2 } from "lucide-react";
import Game from "@/components/game/Game";
import {
  AgentConfig,
  defaultConfig,
  withProvider,
  withStrategy,
  Provider,
  Strategy,
} from "@/components/game/decisions";
import { Match, newMatch } from "@/components/game/match";
import {
  ClientMessage,
  isRoomState,
  RoomState,
  ServerMessage,
} from "@/lib/room-protocol";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";

const samples = [
  "Stay alive, avoid traps and collect food when safe.",
  "Prefer food, but avoid head-on collisions and leave enough room to turn.",
];
const systemMessage =
  "You control a snake on a 10 by 10 board. Both snakes move simultaneously. Avoid walls, bodies and head-on collisions. Do not reverse. Food grows your snake. There is no turn limit; when the board fills, the longer snake wins.";
export default function GameRoom() {
  const { gameID } = useParams<{ gameID: string }>();
  const [id, setId] = useState("");
  const [room, setRoom] = useState<RoomState>({
    epoch: "",
    players: [],
    match: newMatch(),
    score: [0, 0],
  });
  const [draft, setDraft] = useState<AgentConfig>(defaultConfig);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [available, setAvailable] = useState<Record<Provider, boolean>>({
    builtin: true,
    laya: false,
    openai: false,
  });
  const socket = useRef<WebSocket | null>(null);
  const valid = /^[a-zA-Z0-9-]{1,64}$/.test(gameID);
  const endpoint =
    process.env.NEXT_PUBLIC_ROOMS_URL ||
    (process.env.NODE_ENV === "development" ? "ws://127.0.0.1:8787" : "");
  const mine = room.players.find((p) => p.id === id);
  const host = mine?.seat === 0;
  useEffect(() => {
    if (!valid || !endpoint) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout>;
    function connect() {
      const url = new URL(endpoint);
      if (url.protocol === "http:") url.protocol = "ws:";
      if (url.protocol === "https:") url.protocol = "wss:";
      url.pathname = "/rooms/" + gameID;
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.onopen = () => {
        if (!disposed) {
          setConnected(true);
          setMessage("");
        }
      };
      ws.onmessage = (event) => {
        if (disposed || event.data === "pong") return;
        let data: ServerMessage;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === "welcome") setId(data.id);
        if (data.type === "state" && isRoomState(data.room)) setRoom(data.room);
        if (data.type === "error") setMessage(data.message);
      };
      ws.onclose = () => {
        if (disposed) return;
        setConnected(false);
        setMessage("Room connection lost. Reconnecting…");
        retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      socket.current?.close();
      socket.current = null;
    };
  }, [endpoint, gameID, valid]);
  useEffect(() => {
    fetch("/api/llm")
      .then((r) => r.json())
      .then(setAvailable)
      .catch(() => {});
  }, []);
  const savedConfig = mine ? JSON.stringify(mine.config) : null;
  useEffect(() => {
    if (savedConfig) setDraft(JSON.parse(savedConfig));
  }, [savedConfig]);
  const send = useCallback((data: ClientMessage) => {
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setMessage("Wait for the room to reconnect.");
      return;
    }
    socket.current.send(JSON.stringify(data));
  }, []);
  const publish = useCallback(
    (match: Match) => send({ type: "snapshot", epoch: room.epoch, match }),
    [room.epoch, send],
  );
  const agents: [AgentConfig, AgentConfig] = [
    room.players.find((p) => p.seat === 0)?.config || defaultConfig(),
    room.players.find((p) => p.seat === 1)?.config || defaultConfig(),
  ];
  const locked =
    !connected ||
    room.players.length !== 2 ||
    !room.players.every((p) => p.ready);
  return (
    <main className="flex min-h-[100dvh] flex-col items-center py-8 px-4 w-full min-w-[300px] max-w-[850px] mx-auto gap-4">
      <div className="flex flex-wrap gap-4 items-center justify-around w-full">
        <div className="text-xl flex gap-4 items-center">
          Game Code: <span className="font-bold">{gameID}</span>
          <Button
            aria-label="Copy invite"
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setMessage("Game URL Copied!");
              } catch {
                setMessage("Copy the URL from your address bar.");
              }
            }}
          >
            <Share2 size={16} />
          </Button>
        </div>
        <div className="flex text-lg gap-4 items-center">
          Score [P1-P2]:{" "}
          <span className="font-bold">
            {room.score[0]}-{room.score[1]}
          </span>
        </div>
      </div>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="instructions" className="rounded-lg border-2">
          <AccordionTrigger className="px-4">Instructions</AccordionTrigger>
          <AccordionContent className="px-4 space-y-2">
            <p>{systemMessage}</p>
            <p>
              Each player selects an engine and strategy, edits their Human
              Message, and clicks Ready. Green controls Start, Pause and Step.
            </p>
            <p>
              The built-in bot reads the full board using fixed rules. Laya
              selects a direction from map-derived move analyses. Human Message
              applies to Laya and GPT.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {!valid ? (
        <p role="alert">Invalid game code.</p>
      ) : !endpoint ? (
        <p role="alert">Online rooms are not configured on this server.</p>
      ) : (
        <>
          <p role="status" className="text-sm">
            {connected
              ? mine
                ? `You are Player ${mine.seat + 1} (${host ? "Green" : "Blue"})`
                : "Spectating"
              : "Connecting to room…"}
          </p>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
          {room.players.length < 2 && (
            <p className="text-xl text-center py-6">
              Waiting for other player...
            </p>
          )}
          {mine && !room.match.running && (
            <div className="w-full space-y-4">
              <h1 className="text-center font-semibold underline">
                Sample Prompts
              </h1>
              <div className="flex overflow-auto gap-3">
                {samples.map((text) => (
                  <Card key={text} className="min-w-[260px] flex-1">
                    <CardContent className="p-4">
                      <button
                        disabled={mine.ready}
                        className="text-left text-xs"
                        onClick={() =>
                          setDraft((d) => ({ ...d, prompt: text }))
                        }
                      >
                        {text}
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <table className="w-full text-sm text-center border">
                <thead>
                  <tr>
                    <th className="p-2">Player</th>
                    <th>Agent</th>
                    <th>Ready</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1].map((seat) => {
                    const p = room.players.find(
                      (player) => player.seat === seat,
                    );
                    return (
                      <tr key={seat}>
                        <td className="p-2">P{seat + 1}</td>
                        <td>{p?.config.provider || "—"}</td>
                        <td>{p?.ready ? "✓" : "✕"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-4">
                <label className="text-sm">
                  Agent{" "}
                  <select
                    aria-label="Your engine"
                    disabled={mine.ready}
                    className="border rounded p-2 bg-background"
                    value={draft.provider}
                    onChange={(e) =>
                      setDraft((d) =>
                        withProvider(d, e.target.value as Provider),
                      )
                    }
                  >
                    <option value="builtin">Built-in bot</option>
                    <option value="laya" disabled={!available.laya}>
                      Laya
                    </option>
                    <option value="openai" disabled={!available.openai}>
                      GPT
                    </option>
                  </select>
                </label>
                <label className="text-sm">
                  Strategy{" "}
                  <select
                    aria-label="Your strategy"
                    disabled={mine.ready}
                    className="border rounded p-2 bg-background"
                    value={draft.strategy}
                    onChange={(e) =>
                      setDraft((d) =>
                        withStrategy(d, e.target.value as Strategy),
                      )
                    }
                  >
                    <option value="balanced">Balanced</option>
                    <option value="food">Food hunter</option>
                    <option value="survival">Survival first</option>
                    <option value="aggressive">
                      Aggressive - hunt opponent
                    </option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="system-message">System Message</Label>
                  <Textarea
                    id="system-message"
                    rows={8}
                    value={systemMessage}
                    disabled
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="human-message">Human Message</Label>
                  <Textarea
                    id="human-message"
                    rows={8}
                    maxLength={2000}
                    value={draft.prompt}
                    disabled={mine.ready}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, prompt: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-center">
                <Button
                  disabled={!connected}
                  className={
                    mine.ready
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-green-500 hover:bg-green-600 text-white"
                  }
                  onClick={() =>
                    send({ type: "setup", config: draft, ready: !mine.ready })
                  }
                >
                  {mine.ready ? "Not Ready" : "Ready"}
                </Button>
              </div>
            </div>
          )}
          {room.players.length === 2 && (
            <Game
              key={room.epoch}
              host={host}
              remote={room.match}
              onSnapshot={publish}
              agents={agents}
              locked={locked}
            />
          )}
        </>
      )}
      <Link className="text-sm underline" href="/">
        Back to lobby
      </Link>
    </main>
  );
}
