import { env, exports } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { afterEach, expect, test } from "vitest";
import { defaultConfig } from "../../../components/game/decisions";
import { newMatch } from "../../../components/game/match";

const sockets: WebSocket[] = [];
afterEach(async () => {
  await Promise.all(
    sockets.splice(0).map(
      (ws) =>
        new Promise<void>((resolve) => {
          if (ws.readyState === WebSocket.CLOSED) {
            resolve();
            return;
          }
          ws.addEventListener("close", () => resolve(), { once: true });
          ws.close(1000);
        }),
    ),
  );
});
async function connect(room: string) {
  const response = await exports.default.fetch(
    new Request(`https://rooms.test/rooms/${room}`, {
      headers: { Upgrade: "websocket", Origin: "http://localhost:3100" },
    }),
  );
  expect(response.status).toBe(101);
  const ws = response.webSocket!;
  const messages: Record<string, any>[] = [];
  ws.addEventListener("message", (e) => {
    messages.push(JSON.parse(e.data as string));
  });
  ws.accept();
  sockets.push(ws);
  await expect
    .poll(() => messages.find((m) => m.type === "welcome"))
    .toBeTruthy();
  return {
    ws,
    messages,
    id: messages.find((m) => m.type === "welcome")!.id,
    state: () => messages.filter((m) => m.type === "state").at(-1)?.room,
  };
}
test("rejects unknown origins and invalid room paths", async () => {
  expect(
    (
      await exports.default.fetch(
        new Request("https://rooms.test/rooms/test", {
          headers: { Origin: "https://evil.test", Upgrade: "websocket" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (await exports.default.fetch(new Request("https://rooms.test/invalid")))
      .status,
  ).toBe(404);
});
test("rooms isolate membership, assign two seats, and protect host updates", async () => {
  const name = crypto.randomUUID();
  const a = await connect(name),
    b = await connect(name),
    spectator = await connect(name),
    other = await connect(crypto.randomUUID());
  await expect.poll(() => a.state()?.players.length).toBe(2);
  expect(a.state().players[0].id).toBe(a.id);
  expect(a.state().players[1].id).toBe(b.id);
  expect(other.state().players.length).toBe(1);
  spectator.ws.send(
    JSON.stringify({ type: "setup", config: defaultConfig(), ready: true }),
  );
  await expect
    .poll(() => spectator.messages.some((m) => m.type === "error"))
    .toBe(true);
  for (const peer of [a, b])
    peer.ws.send(
      JSON.stringify({ type: "setup", config: defaultConfig(), ready: true }),
    );
  await expect
    .poll(() => a.state()?.players.every((p: { ready: boolean }) => p.ready))
    .toBe(true);
  const epoch = a.state().epoch;
  b.ws.send(
    JSON.stringify({
      type: "snapshot",
      epoch,
      match: { ...newMatch(), revision: 1, running: true },
    }),
  );
  await expect
    .poll(() => b.messages.some((m) => m.type === "error"))
    .toBe(true);
  a.ws.send(
    JSON.stringify({
      type: "snapshot",
      epoch,
      match: { ...newMatch(), revision: 1, running: true },
    }),
  );
  await expect.poll(() => b.state()?.match.running).toBe(true);
  expect(spectator.state().match.revision).toBe(1);
  const persisted = await runInDurableObject(
    env.ROOMS.getByName(name),
    (_object, state) =>
      state.storage.sql
        .exec<{ value: string }>("SELECT value FROM room WHERE id = 1")
        .one().value,
  );
  expect(JSON.parse(persisted).match.revision).toBe(1);
  a.ws.send(
    JSON.stringify({
      type: "snapshot",
      epoch,
      match: { ...newMatch(), revision: 1, running: false },
    }),
  );
  a.ws.send(JSON.stringify({ type: "sync" }));
  await expect.poll(() => a.state()?.match.running).toBe(true);
  a.ws.close(1000);
  await expect.poll(() => b.state()?.players.length).toBe(1);
  expect(b.state().match.running).toBe(false);
  expect(b.state().epoch).not.toBe(epoch);
});
