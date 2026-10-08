import { access, readFile } from "node:fs/promises";
import path from "node:path";
import * as ort from "onnxruntime-node";
import {
  AutoTokenizer,
  env,
  PreTrainedTokenizer,
} from "@huggingface/transformers";

// Local files only: model loading must never initiate a download in a game turn.
env.allowRemoteModels = false;
type Config = {
  max_len: number;
  head_max_len: number;
  cls_token_id: number;
  sep_token_id: number;
  mask_token_id: number;
  mask_token: string;
  temperature: number[];
  temperature_by_options: Record<string, number>;
};
type Runtime = {
  session: ort.InferenceSession;
  tokenizer: PreTrainedTokenizer;
  config: Config;
};
const cache = globalThis as typeof globalThis & {
  cobraLaya?: Promise<Runtime>;
  cobraLayaRun?: Promise<unknown>;
};
export const modelDirectory = () =>
  path.resolve(process.env.LAYA_MODEL_DIR || "models/laya");
export async function modelFile() {
  const dir = modelDirectory();
  if (
    process.env.LAYA_PRECISION === "int8" &&
    (await access(path.join(dir, "model.int8.onnx")).then(
      () => true,
      () => false,
    ))
  )
    return path.join(dir, "model.int8.onnx");
  return path.join(dir, "model.onnx");
}
export function loadLaya(): Promise<Runtime> {
  if (!cache.cobraLaya)
    cache.cobraLaya = (async () => {
      const dir = modelDirectory();
      const config = JSON.parse(
        await readFile(path.join(dir, "laya_config.json"), "utf8"),
      ) as Config;
      const tokenizer = await AutoTokenizer.from_pretrained(dir, {
        local_files_only: true,
      });
      const session = await ort.InferenceSession.create(await modelFile(), {
        executionProviders:
          process.env.LAYA_DEVICE === "dml"
            ? [
                {
                  name: "dml",
                  deviceId: Number(process.env.LAYA_DEVICE_ID || 0),
                },
                "cpu",
              ]
            : ["cpu"],
        intraOpNumThreads: 4,
        enableMemPattern: process.env.LAYA_DEVICE !== "dml",
        executionMode: "sequential",
      });
      return { config, tokenizer, session };
    })().catch((error) => {
      cache.cobraLaya = undefined;
      throw error;
    });
  return cache.cobraLaya;
}

// Matches laya.common.build_sequence, including option markers and budgets.
export async function buildSequence(
  state: string,
  instructions: string,
  criteria: Record<string, string>,
) {
  const { tokenizer, config: c } = await loadLaya();
  const encode = (text: string) =>
    tokenizer.encode(text.replaceAll(c.mask_token, " "), {
      add_special_tokens: false,
    });
  let options = Object.entries(criteria).map(([key, value]) => [
    c.mask_token_id,
    ...encode(" " + (value ? `${key}: ${value}` : key)).slice(0, 48),
  ]);
  let budget = c.head_max_len - options.reduce((n, o) => n + o.length, 0);
  if (budget < 16) {
    const per = Math.max(4, Math.floor((c.head_max_len - 16) / options.length));
    options = options.map((o) => o.slice(0, per));
    budget = c.head_max_len - options.reduce((n, o) => n + o.length, 0);
  }
  const ids = [
    c.cls_token_id,
    ...encode(`choice question: ${instructions}`).slice(0, Math.max(8, budget)),
    c.sep_token_id,
  ];
  const markers: number[] = [];
  options.forEach((o) => {
    markers.push(ids.length);
    ids.push(...o);
  });
  ids.push(c.sep_token_id);
  ids.push(
    ...encode(state).slice(0, Math.max(0, c.max_len - ids.length - 1)),
    c.sep_token_id,
  );
  if (markers.some((m) => m >= c.max_len))
    throw new Error("Too many Laya options.");
  return { ids: ids.slice(0, c.max_len), markers };
}

export async function layaLogits(ids: number[], markers: number[]) {
  const { session } = await loadLaya();
  const tensor = (data: number[]) =>
    new ort.Tensor("int64", BigInt64Array.from(data.map(BigInt)), [
      1,
      data.length,
    ]);
  const feeds = {
    input_ids: tensor(ids),
    attention_mask: tensor(ids.map(() => 1)),
    marker_pos: tensor(markers),
  };
  // DirectML requires sequential Run calls on a shared inference session.
  const pending =
    process.env.LAYA_DEVICE === "dml"
      ? (cache.cobraLayaRun || Promise.resolve()).then(() => session.run(feeds))
      : session.run(feeds);
  if (process.env.LAYA_DEVICE === "dml")
    cache.cobraLayaRun = pending.catch(() => {});
  const result = await pending;
  return Array.from(result.logits.data as Float32Array);
}

export async function layaChoice(
  state: string,
  instructions: string,
  criteria: Record<string, string>,
) {
  const keys = Object.keys(criteria);
  if (keys.length < 2 || keys.length > 4)
    throw new Error("Laya expects 2–4 choices.");
  const seq = await buildSequence(state, instructions, criteria);
  const logits = await layaLogits(seq.ids, seq.markers);
  if (logits.length !== keys.length || logits.some((v) => !Number.isFinite(v)))
    throw new Error("Invalid Laya logits.");
  const { config } = await loadLaya();
  const temperature = Math.max(
    0.001,
    config.temperature_by_options?.[
      keys.length === 2 ? "choice:2" : "choice:3-5"
    ] ?? config.temperature[0],
  );
  const max = Math.max(...logits);
  const exp = logits.map((v) => Math.exp((v - max) / temperature));
  const sum = exp.reduce((a, b) => a + b, 0);
  const best = logits.indexOf(max);
  return { choice: keys[best], probability: exp[best] / sum };
}
