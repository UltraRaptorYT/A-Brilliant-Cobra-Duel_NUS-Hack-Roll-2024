"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import GameBoard from "./GameBoard";
import AgentControls from "./AgentControls";
import { AgentConfig, defaultConfig, Provider } from "./decisions";
import { outcome, step } from "./engine";
import { isDecision, Match, newMatch } from "./match";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Game({
  host = true,
  remote,
  onSnapshot,
  agents,
  locked = false,
}: {
  host?: boolean;
  remote?: Match;
  onSnapshot?: (match: Match) => void;
  agents?: [AgentConfig, AgentConfig];
  locked?: boolean;
}) {
  const [match, setMatch] = useState<Match>(newMatch);
  const current = useRef(match);
  const [configs, setConfigs] = useState<[AgentConfig, AgentConfig]>([
    defaultConfig(),
    { ...defaultConfig(), strategy: "food" },
  ]);
  const active = agents || configs;
  const usesLaya = active.some((config) => config.provider === "laya");
  const [loadingModel, setLoadingModel] = useState(false);
  const [available, setAvailable] = useState<Record<Provider, boolean>>({
    builtin: true,
    laya: false,
    openai: false,
  });
  const [delay, setDelay] = useState(350);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [replay, setReplay] = useState<number | null>(null);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const send = useRef(onSnapshot);
  send.current = onSnapshot;
  const commit = useCallback((next: Match) => {
    current.current = next;
    setMatch(next);
    send.current?.(next);
  }, []);
  const cancel = useCallback(() => {
    generation.current++;
    request.current?.abort();
    request.current = null;
    setBusy(false);
  }, []);
  useEffect(() => {
    if (!host || !usesLaya) return;
    let active = true;
    setLoadingModel(true);
    fetch("/api/laya/warmup", { method: "POST" })
      .then((response) => {
        if (!response.ok)
          throw new Error(
            "Laya could not load. Select the built-in bot or retry.",
          );
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoadingModel(false);
      });
    return () => {
      active = false;
      setLoadingModel(false);
    };
  }, [host, usesLaya]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/llm", { signal: controller.signal })
      .then((r) => r.json())
      .then(setAvailable)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!host && remote) {
      current.current = remote;
      setMatch(remote);
    }
  }, [host, remote]);
  useEffect(() => {
    if (locked) {
      cancel();
      if (host && current.current.running)
        commit({
          ...current.current,
          running: false,
          revision: current.current.revision + 1,
        });
    }
  }, [locked, host, cancel, commit]);
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );

  const takeTurn = useCallback(async () => {
    if (
      !host ||
      locked ||
      loadingModel ||
      request.current ||
      outcome(current.current.board)
    )
      return;
    const before = current.current;
    const token = generation.current;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          boardState: before.board,
          player1: active[0],
          player2: active[1],
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not choose moves.");
      if (
        data.turn !== before.board.turn ||
        !isDecision(data.player1) ||
        !isDecision(data.player2)
      )
        throw new Error("Invalid move response.");
      if (token !== generation.current) return;
      const board = step(
        before.board,
        data.player1.action,
        data.player2.action,
      );
      commit({
        ...before,
        revision: before.revision + 1,
        board,
        running: before.running && !outcome(board),
        history: [
          ...before.history,
          {
            turn: board.turn,
            player1: data.player1,
            player2: data.player2,
            board,
          },
        ],
      });
      setReplay(null);
    } catch (e) {
      if (token !== generation.current) return;
      setError(
        controller.signal.aborted
          ? "Move timed out. Retry or select the built-in engine."
          : e instanceof Error
            ? e.message
            : "Move failed.",
      );
      commit({ ...before, running: false, revision: before.revision + 1 });
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }, [host, locked, loadingModel, active, commit]);

  useEffect(() => {
    if (
      !host ||
      locked ||
      loadingModel ||
      !match.running ||
      outcome(match.board)
    )
      return;
    const timer = setTimeout(() => void takeTurn(), delay);
    return () => clearTimeout(timer);
  }, [host, locked, loadingModel, match, delay, takeTurn]);

  const result = outcome(match.board);
  const shown =
    replay === null
      ? match.board
      : replay === 0
        ? newMatch().board
        : match.history[replay - 1]?.board || match.board;
  function reset() {
    cancel();
    setError("");
    setReplay(null);
    commit({
      ...newMatch(),
      round: crypto.randomUUID(),
      revision: current.current.revision + 1,
    });
  }
  function toggle() {
    cancel();
    setReplay(null);
    commit({
      ...current.current,
      running: !current.current.running,
      revision: current.current.revision + 1,
    });
  }
  function download() {
    const blob = new Blob(
      [JSON.stringify({ version: 1, agents: active, ...match }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobra-duel-${match.round}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="w-full space-y-5">
      {!agents && (
        <div className="grid gap-4 md:grid-cols-2">
          {configs.map((config, i) => (
            <AgentControls
              key={i}
              label={i === 0 ? "Green snake" : "Blue snake"}
              value={config}
              available={available}
              disabled={match.running || busy}
              onChange={(c) =>
                setConfigs((old) => (i === 0 ? [c, old[1]] : [old[0], c]))
              }
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          Green · {match.board.snake1.body.length}
        </span>
        <span className="text-sm">
          Turn {match.board.turn}
          {busy ? " · Thinking…" : ""}
        </span>
        <span className="font-semibold text-blue-600 dark:text-blue-400">
          Blue · {match.board.snake2.body.length}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[150px_minmax(0,1fr)_150px] gap-4 items-start">
        <div
          className="flex flex-col gap-3 max-h-[75dvh] overflow-auto order-2 md:order-1"
          aria-label="Green move history"
        >
          {[...match.history].reverse().map((row) => (
            <Card key={row.turn}>
              <CardHeader className="p-3">
                <CardTitle className="text-lg">
                  Turn {row.turn} - {row.player1.action}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 text-sm">
                {row.player1.reason}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="order-1 md:order-2">
          <GameBoard boardState={shown} />
        </div>
        <div
          className="flex flex-col gap-3 max-h-[75dvh] overflow-auto order-3"
          aria-label="Blue move history"
        >
          {[...match.history].reverse().map((row) => (
            <Card key={row.turn}>
              <CardHeader className="p-3">
                <CardTitle className="text-lg">
                  Turn {row.turn} - {row.player2.action}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 text-sm">
                {row.player2.reason}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {result && (
        <div role="status" className="rounded-xl border p-4 text-center">
          <p className="text-xl font-semibold">
            {result.winner === "draw"
              ? "Draw!"
              : result.winner === "P1"
                ? "Green wins!"
                : "Blue wins!"}
          </p>
          <p className="text-sm text-muted-foreground">{result.reason}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      {loadingModel && (
        <p role="status" className="text-center text-sm">
          Loading Laya into memory… This happens once per server start.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {host ? (
          <>
            <Button
              onClick={toggle}
              disabled={locked || loadingModel || !!result}
            >
              {match.running
                ? "Pause"
                : match.board.turn
                  ? "Resume"
                  : "Start duel"}
            </Button>
            <Button
              variant="secondary"
              disabled={
                locked || loadingModel || match.running || busy || !!result
              }
              onClick={() => void takeTurn()}
            >
              Step
            </Button>
            <Button variant="outline" onClick={reset} disabled={locked}>
              New round
            </Button>
            <label className="text-sm">
              Pace{" "}
              <select
                aria-label="Turn pace"
                className="rounded border bg-background p-2"
                value={delay}
                onChange={(e) => setDelay(Number(e.target.value))}
              >
                <option value={100}>Fast</option>
                <option value={350}>Normal</option>
                <option value={1000}>Slow</option>
              </select>
            </label>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            The host controls the round.
          </p>
        )}
        <Button
          variant="outline"
          disabled={!match.history.length}
          onClick={download}
        >
          Download replay
        </Button>
      </div>
      {match.history.length > 0 && (
        <div className="space-y-3">
          <label className="block text-sm">
            Replay · turn {shown.turn}
            <input
              aria-label="Replay turn"
              type="range"
              className="mt-2 w-full"
              min={0}
              max={match.board.turn}
              value={shown.turn}
              disabled={match.running}
              onChange={(e) => setReplay(Number(e.target.value))}
            />
          </label>
          <details>
            <summary className="cursor-pointer font-medium">
              Move history ({match.history.length} turns)
            </summary>
            <div className="mt-3 max-h-80 space-y-3 overflow-auto">
              {[...match.history].reverse().map((row) => (
                <div key={row.turn} className="rounded-lg border p-3 text-sm">
                  <b>Turn {row.turn}</b>
                  <p className="mt-1">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Green [{row.player1.provider}]
                    </span>{" "}
                    {row.player1.reason}
                  </p>
                  <p className="mt-1">
                    <span className="text-blue-600 dark:text-blue-400">
                      Blue [{row.player2.provider}]
                    </span>{" "}
                    {row.player2.reason}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Simultaneous moves · No reversing · Walls and bodies are lethal ·
        Head-on collisions draw · Longest snake wins when the board fills
      </p>
    </section>
  );
}
