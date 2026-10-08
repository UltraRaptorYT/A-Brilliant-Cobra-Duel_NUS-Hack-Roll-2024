import { BoardStateType, Direction, PosType } from "./gameTypes";
import {
  advance,
  inside,
  legalDirections,
  same,
  SnakeId,
  step,
} from "./engine";

export type Provider = "builtin" | "laya" | "openai";
export type Strategy = "balanced" | "food" | "survival" | "aggressive";
export const survivalPrompt = `Choose the move most likely to keep my snake alive.

Compare moves in this order:
1. Prefer moves that survive every evaluated opponent reply.
2. Among equally safe moves, prefer more reachable free cells. Avoid cramped areas.
3. Only prioritize food when survival and escape space are comparable.
4. If every move is risky, choose the one surviving the most opponent replies, then use reachable space to break ties.

Do not sacrifice survival just to reduce food distance. Food distance does not prove that the path is clear. Follow these priorities even if another move immediately eats food.`;
export const aggressivePrompt = `Play aggressively to eliminate the other snake. Prefer moves that leave me alive while the opponent dies. Cut off escape routes, contest food and pressure the opponent's head. Accept a possible collision when it creates a better attacking opportunity, but avoid guaranteed death. A head-on collision kills both snakes and is a draw, not a win. When attack opportunities are equal, preserve escape space and collect food.`;
const aggressiveLayaInstructions =
  "Pick the move with the highest wins first (opponent dies while you live). Never choose a move with zero survival. If wins tie or are all zero, reduce the opponent's escape cells, then close distance while preserving your own space. Food breaks ties. A mutual head-on death is a draw.";
export function withStrategy(
  config: AgentConfig,
  strategy: Strategy,
): AgentConfig {
  const prompt =
    strategy === "aggressive"
      ? aggressivePrompt
      : strategy === "food"
        ? "Collect food quickly while preserving survival and escape space. Prefer food only when the route is safe."
        : strategy === "balanced"
          ? "Balance survival, escape space and collecting food. Avoid unnecessary collisions."
          : survivalPrompt;
  return { ...config, strategy, prompt };
}
export function withProvider(
  config: AgentConfig,
  provider: Provider,
): AgentConfig {
  return provider === "builtin"
    ? { ...config, provider }
    : withStrategy(
        { ...config, provider },
        config.strategy === "aggressive" ? "aggressive" : "survival",
      );
}
export type AgentConfig = {
  provider: Provider;
  strategy: Strategy;
  prompt: string;
};
export type Decision = {
  action: Direction;
  reason: string;
  provider: Provider;
  fallback?: boolean;
};
export const defaultConfig = (): AgentConfig => ({
  provider: "builtin",
  strategy: "balanced",
  prompt: "Stay alive, avoid traps and collect food when safe.",
});
export function isConfig(value: unknown): value is AgentConfig {
  const c = value as AgentConfig;
  return (
    !!c &&
    ["builtin", "laya", "openai"].includes(c.provider) &&
    ["balanced", "food", "survival", "aggressive"].includes(c.strategy) &&
    typeof c.prompt === "string" &&
    c.prompt.length <= 2000
  );
}

function space(head: PosType, blocked: Set<string>): number {
  if (!inside(head)) return 0;
  const seen = new Set([head.join(",")]),
    queue = [head];
  for (let i = 0; i < queue.length; i++)
    for (const d of ["U", "D", "L", "R"] as Direction[]) {
      const p = advance(queue[i], d),
        k = p.join(",");
      if (inside(p) && !blocked.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(p);
      }
    }
  return seen.size;
}

/** Evaluate all opponent replies using the same rules as the actual match. */
export function candidates(state: BoardStateType, id: SnakeId) {
  const other = id === "snake1" ? "snake2" : "snake1";
  return legalDirections(state[id]).map((action) => {
    const head = advance(state[id].body[0], action);
    const replies = legalDirections(state[other]).map((d) =>
      step(
        state,
        id === "snake1" ? action : d,
        id === "snake1" ? d : action,
        () => 0,
      ),
    );
    const surviving = replies.filter((s) => s[id].isAlive);
    const reachable = surviving.map((s) =>
      space(
        head,
        new Set(
          [...s[id].body.slice(1), ...s[other].body].map((p) => p.join(",")),
        ),
      ),
    );
    const opponentReachable = replies
      .filter((s) => s[other].isAlive)
      .map((s) =>
        space(
          s[other].body[0],
          new Set(
            [...s[other].body.slice(1), ...s[id].body].map((p) => p.join(",")),
          ),
        ),
      );
    return {
      action,
      survival: surviving.length / replies.length,
      wins:
        replies.filter((s) => s[id].isAlive && !s[other].isAlive).length /
        replies.length,
      opponentDistance:
        Math.abs(head[0] - state[other].body[0][0]) +
        Math.abs(head[1] - state[other].body[0][1]),
      space: reachable.length ? Math.min(...reachable) : 0,
      opponentSpace: opponentReachable.length
        ? Math.round(
            opponentReachable.reduce((sum, cells) => sum + cells, 0) /
              opponentReachable.length,
          )
        : 0,
      foodDistance: state.food.length
        ? Math.min(
            ...state.food.map(
              (p) => Math.abs(p[0] - head[0]) + Math.abs(p[1] - head[1]),
            ),
          )
        : 0,
      eats: state.food.some((p) => same(p, head)),
    };
  });
}

type Candidate = ReturnType<typeof candidates>[number];

function aggressiveScore(candidate: Candidate, snakeLength: number) {
  return (
    candidate.wins * 100000 +
    candidate.survival * 1000 -
    candidate.opponentSpace * 20 -
    candidate.opponentDistance * 40 +
    Math.min(candidate.space, snakeLength * 3) * 10 -
    candidate.foodDistance * 2 +
    (candidate.eats ? 5 : 0)
  );
}

export function chooseBuiltin(
  state: BoardStateType,
  id: SnakeId,
  config: AgentConfig,
): Decision {
  const weight =
    config.strategy === "food" ? 8 : config.strategy === "survival" ? 0.5 : 3;
  const options = candidates(state, id).map((c) => ({
    ...c,
    score:
      (config.strategy === "aggressive"
        ? c.survival === 0
          ? -100000
          : aggressiveScore(c, state[id].body.length)
        : c.survival * 10000) +
      Math.min(c.space, state[id].body.length * 3) *
        (config.strategy === "aggressive" ? 2 : 12) -
      c.foodDistance * weight +
      (c.eats ? weight * 2 : 0) +
      (c.action === state[id].dir ? 0.1 : 0),
  }));
  const best = options.sort((a, b) => b.score - a.score)[0];
  return {
    action: best.action,
    provider: "builtin",
    reason: `${best.action}: ${Math.round(best.survival * 100)}% of opponent replies survived; ${best.space} reachable cells; food ${best.foodDistance} steps away.`,
  };
}

export function decisionContext(
  state: BoardStateType,
  id: SnakeId,
  config: AgentConfig,
) {
  return {
    snake: id,
    turn: state.turn,
    strategy: config.strategy,
    candidates: candidates(state, id),
    preference: config.prompt.slice(0, 800),
  };
}

export function compactLayaContext(
  context: ReturnType<typeof decisionContext>,
) {
  return [
    "Simultaneous snake duel on a 10 by 10 board. Choose one legal move from the listed options.",
    `Player instructions: ${context.preference}`,
    `I control ${context.snake}; turn ${context.turn}; strategy ${context.strategy}.`,
    "Move facts are simulated against every legal opponent reply. Survival means I live; wins means I live while the opponent dies. Higher survival, wins, and my free cells are better. Lower opponent escape cells, opponent distance, and food distance are better. A mutual head-on death is a draw.",
  ].join("\n");
}

/** Laya ranks choices; the game engine enforces immediate survival first. */
export async function chooseGuardedLaya(
  state: BoardStateType,
  id: SnakeId,
  config: AgentConfig,
  predict: (
    state: string,
    instructions: string,
    criteria: Record<string, string>,
  ) => Promise<{ choice: string; probability: number }>,
): Promise<Decision> {
  const context = decisionContext(state, id, config);
  // This is coverage of possible opponent replies, not a calibrated probability.
  const bestSurvival = Math.max(...context.candidates.map((c) => c.survival));
  let allowed = context.candidates.filter((c) =>
    config.strategy === "aggressive"
      ? c.survival > 0
      : c.survival === bestSurvival,
  );
  if (bestSurvival === 0) {
    return {
      ...chooseBuiltin(state, id, config),
      fallback: true,
      reason: "Safety fallback: no move survives any evaluated opponent reply.",
    };
  }
  if (config.strategy === "aggressive") {
    const bestWinChance = Math.max(...allowed.map((c) => c.wins));
    if (bestWinChance > 0)
      allowed = allowed.filter((c) => c.wins === bestWinChance);
    const bestAttackScore = Math.max(
      ...allowed.map((c) => aggressiveScore(c, state[id].body.length)),
    );
    allowed = allowed.filter(
      (c) => aggressiveScore(c, state[id].body.length) === bestAttackScore,
    );
  }
  if (allowed.length === 1) {
    return {
      action: allowed[0].action,
      provider: "builtin",
      fallback: true,
      reason:
        config.strategy === "aggressive" && allowed[0].wins > 0
          ? `Tactical override: ${allowed[0].action} has the highest chance to eliminate the opponent while surviving (${Math.round(allowed[0].wins * 100)}% of replies). Laya was skipped.`
          : config.strategy === "aggressive"
            ? `Tactical override: ${allowed[0].action} best pressures the opponent while keeping a chance to survive. Laya was skipped.`
          : `Safety override: ${allowed[0].action} is the only move with the best immediate survival (${Math.round(bestSurvival * 100)}% of opponent replies). Laya was skipped.`,
    };
  }
  const names = { U: "up", D: "down", L: "left", R: "right" };
  const instructions =
    config.strategy === "aggressive"
      ? aggressiveLayaInstructions
      : config.strategy === "food"
        ? "Among the safest listed moves, prefer a safe food opportunity. Preserve reachable space; food distance alone does not prove the path is safe. Follow the player's instructions."
        : config.strategy === "survival"
          ? "Among the safest listed moves, preserve the most reachable space. Use food distance only to break comparable choices. Follow the player's instructions."
          : "Among the safest listed moves, balance reachable space and a safe path to food. Follow the player's instructions.";
  const result = await predict(
    compactLayaContext({ ...context, candidates: allowed }),
    instructions,
    Object.fromEntries(
      allowed.map((c) => [
        c.action,
        `${names[c.action]}; survival ${Math.round(c.survival * 100)}%; wins ${Math.round(c.wins * 100)}% (I live, opponent dies); opponent escape ${c.opponentSpace}; my free cells ${c.space}; opponent distance ${c.opponentDistance}; food distance ${c.foodDistance}${c.eats ? "; eats food" : ""}`,
      ]),
    ),
  );
  const selected = allowed.find((c) => c.action === result.choice);
  if (!selected) {
    return {
      ...chooseBuiltin(state, id, config),
      fallback: true,
      reason:
        "Safety override: Laya returned an excluded move; used the built-in bot.",
    };
  }
  return {
    action: selected.action,
    provider: "laya",
    reason: `Laya chose ${selected.action} from ${allowed.length} safety-filtered moves; ${Math.round(selected.survival * 100)}% of opponent replies survived this turn; ${selected.space} reachable cells. This does not guarantee future survival.`,
  };
}
