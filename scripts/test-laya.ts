import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildSequence, layaLogits, modelDirectory } from "../lib/laya";

async function main() {
  // Strict parity checks the lossless export, not the optional quantized model.
  process.env.LAYA_PRECISION = "fp32";
  const fixtures = JSON.parse(
    await readFile(path.join(modelDirectory(), "parity.json"), "utf8"),
  );
  for (const f of fixtures) {
    const seq = await buildSequence(f.state, f.instructions, f.criteria);
    assert.deepEqual(seq.ids, f.ids, "Token IDs must match Python exactly");
    assert.deepEqual(seq.markers, f.markers);
    const logits = await layaLogits(seq.ids, seq.markers);
    const maxError = Math.max(
      ...logits.map((v, i) => Math.abs(v - f.logits[i])),
    );
    assert.ok(maxError < 0.005, `ONNX/PyTorch logit error: ${maxError}`);
    console.log(
      `PASS ${seq.ids.length} tokens, ${seq.markers.length} choices, max logit error ${maxError.toFixed(6)}`,
    );
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
