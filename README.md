# A Brilliant Cobra Duel

A two-agent snake arena built with Next.js. Runs immediately with built-in opponents; optionally runs **Laya inside the Next.js Node server** or uses GPT. No Python service is involved.

## Run

Use Node.js 20 or newer (Node 24 tested).

```sh
npm ci
npm run dev
```

Open http://localhost:3000 for the original logo/join lobby. Choose **Play locally** to open `/local`. Pick each snake's engine and strategy, then **Start duel**. **Step** advances exactly one simultaneous turn. Pause to inspect the replay slider, or download the round as JSON. New round cancels pending moves.

The built-in opponent is a deterministic bot, not a trained model. It reads both snakes and food positions from the complete board, simulates each legal move against every legal opponent reply, and flood-fills reachable cells to avoid traps. Built-in agents use survival against every legal opponent reply, reachable space, and food distance. Their strategy dropdown changes food/survival priorities; free-text instructions apply only to Laya/GPT.

Selecting Laya or GPT fills the editable survival instructions. Selecting a strategy loads its matching prompt. **Aggressive - hunt opponent** favors eliminating the opponent and closing distance, and lets Laya consider contested moves with some surviving replies; guaranteed immediate death remains excluded. Built-in aggression uses winning-reply and opponent-distance metrics. It is a risky heuristic, not a guarantee of trapping the opponent. The board remains 15 by 15 cells and is displayed at up to 390 pixels wide.

## Laya in Next.js

The official [Laya](https://github.com/NandhaKishorM/laya) SDK uses PyTorch. This project exports its **full trained encoder and choice head** to ONNX, tokenizes with Transformers.js, and executes it using `onnxruntime-node` in `app/api/llm/route.ts`.

Python is used **once to convert the checkpoint**, not when running the game. This workspace already contains a verified local export in `models/laya`; model artifacts are excluded from Git because they are large.

For a fresh checkout:

```sh
python -m venv .venv-export
# Windows:
.venv-export/Scripts/python -m pip install -r scripts/requirements-export.txt
.venv-export/Scripts/python scripts/export_laya.py
# macOS / Linux: use .venv-export/bin/python instead
npm run test:laya
npm run dev
```

The exporter downloads a pinned upstream checkpoint and writes `model.onnx`, tokenizer files, configuration and reference fixtures. Keep **all files** in `models/laya` together. Alternatively copy a previously exported directory; that machine never needs Python.

The default FP32 ONNX model is about 1.7 GB. Allow several GB of server RAM and disk space. Use a persistent Node server (or container) with the model directory mounted; this is not an Edge runtime and generally does not fit small serverless deployment limits. Set `LAYA_MODEL_DIR` to an absolute directory if needed. Model/session loading is cached per server process; no models are downloaded at request time.

In normal strategies, Laya sees compact, deterministic candidate metrics and selects among directions with the best immediate survival across opponent replies. Aggressive mode permits riskier moves with at least one surviving reply. If only one remains, the engine takes it without inference and labels the safety override. If all moves are fatal, an explicitly labelled built-in fallback is used. This guard prevents avoidable immediate collisions, but does not plan multiple turns ahead. It is not a trained snake policy: model parity establishes correct inference, not superior playing strength. Logs show the chosen option probability and measured move facts, not invented model reasoning. The built-in engine is a useful baseline. Laya does not require an OpenAI key.

If a provider fails or returns an invalid direction, that snake uses an explicitly labelled built-in fallback for the turn. The API bounds concurrent inference; a busy response pauses the game so you can retry.

## Laya performance

The original runtime was CPU-only FP32. First use includes loading about 1.7 GB of weights; warm inference still runs a 421M-parameter encoder plus its decision layers. The app now preloads when Laya is selected and shows loading status. Compact move descriptions retain survival, reachable space and food metrics with fewer tokens.

On Windows with a supported GPU, set these in `.env.local` and restart:

```dotenv
LAYA_DEVICE=dml
LAYA_DEVICE_ID=0
LAYA_PRECISION=fp32
```

DirectML is enabled in this workspace after passing model parity checks. DirectML calls are serialized because that backend cannot run concurrently on the same session. Other servers default to CPU; set `LAYA_DEVICE=cpu` if GPU initialization fails. Device IDs depend on the machine.

Measured on this machine: the previous API took about **3.2 seconds per warm two-snake turn**. With compact input, individual CPU decisions averaged **1.21 seconds**; DirectML warm decisions ranged approximately **90-450 ms**, with a separate first-inference compilation cost. The updated production API measured **215-275 ms per warm two-snake turn**, with about **10.5 seconds** for the first cold request. These are machine/input-specific timings, not gameplay-strength benchmarks. Run `npx tsx scripts/benchmark-laya.ts` to measure your server.

Optional CPU INT8 conversion:

```sh
.venv-export/Scripts/python -m pip install onnxruntime==1.30.0
.venv-export/Scripts/python scripts/quantize_laya.py
```

Set `LAYA_PRECISION=int8` to opt in. It is smaller/faster but changed 4 of 16 choices in the comparison, so it is **not the default**. Strict `test:laya` always checks FP32; quantization is not numerically equivalent. Both paths use JavaScript inference during gameplay, with no Python service.

## Optional GPT

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`. Optionally change `OPENAI_MODEL` (default `gpt-4o-mini`). Restart Next.js. Keys remain server-side. GPT instructions support `{Emoji_board}`, `{Emojis_board}`, `{Chars_board}` and `{Board_state_str}`, case-insensitively.

## Cloudflare online rooms

Supabase has been removed. Rooms use a Cloudflare Worker with one SQLite-backed Durable Object per game and hibernating WebSockets.

Local development (two terminals):

```sh
npm run rooms:dev
npm run dev
```

The client uses `ws://127.0.0.1:8787` in development. For a local production build set `NEXT_PUBLIC_ROOMS_URL=ws://127.0.0.1:8787` in `.env.local` **before building**. Create a game in the lobby and share the URL. Each player configures their snake and clicks Ready. Green controls the round. A third connection spectates.

The Worker assigns player identities and seats, checks which socket is the host, rejects stale revisions, and persists the latest match and score in SQLite. A player leaving resets the round and clears ready flags; the vacant seat can be filled by a new connection. The remaining player's seat stays fixed. Scores survive round resets. As with the original game, the host supplies simulation snapshots; these are casual rooms, not cheat-proof ranked matches.

To deploy to your Cloudflare account:

1. Set `ALLOWED_ORIGINS` in `workers/rooms/wrangler.jsonc` to the exact public Next.js origin(s), comma-separated.
2. Authenticate Wrangler and run `npm run rooms:deploy`.
3. Set `NEXT_PUBLIC_ROOMS_URL=wss://cobra-duel-rooms.<your-subdomain>.workers.dev` on the Next.js host, then rebuild/restart it.

The Next.js app and local ONNX inference still run on a Node server. Only room coordination runs on Workers; a native ONNX model is not put inside a Durable Object. Local runtime tests and a deployment dry run are included; no live Cloudflare deployment is implied by those tests.

## Rules

- 15 × 15 board; coordinates 0–14. Up decreases y.
- Both agents decide from the same pre-turn state, then move simultaneously.
- Reversals are ignored (continue straight). Food grows a snake by one.
- Walls, self-body and opponent-body collisions kill a snake.
- A vacating tail can be entered, unless that snake eats and retains its tail.
- Same-cell head collisions and swapped head positions kill both snakes, regardless of length.
- Simultaneous deaths draw. Otherwise the survivor wins.
- At 100 turns, longer snake wins; equal lengths draw.
- Food spawns only in free cells; a full board cannot hang the placement loop.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:laya     # requires exported model; compares Node tokens/logits to original PyTorch
npm run test:e2e      # starts local Next.js + Cloudflare servers; includes two-browser multiplayer
npm run test:rooms    # Cloudflare Workers runtime tests
npm run rooms:typecheck
npm run rooms:types
```

Engine tests cover collisions, growth, tails, draws, limits, immutable updates, malformed input and seeded complete matches. Model tests check token IDs, marker positions and logits across different input lengths and choice counts.

Laya's upstream model/code is Apache-2.0 licensed; see its [license](https://github.com/NandhaKishorM/laya/blob/main/LICENSE).
