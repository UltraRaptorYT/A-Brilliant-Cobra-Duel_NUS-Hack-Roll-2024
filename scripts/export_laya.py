"""One-time conversion only. The app runs ONNX in Node.js, never Python.

Install laya==0.3.4 transformers==4.57.6 onnx onnxscript, then run this file.
Exports the full encoder AND trained decision head, plus parity fixtures.
"""
import json
from pathlib import Path

import laya
import torch
import torch.nn.functional as F
from huggingface_hub import snapshot_download
from laya.common import build_sequence

out = Path(__file__).resolve().parents[1] / "models" / "laya"
out.mkdir(parents=True, exist_ok=True)
checkpoint = snapshot_download("convaiinnovations/laya", revision="1c5edc17a7acd8701df6fc341c0d179f1c62c982", allow_patterns=["model.safetensors", "rl_agent_config.json", "encoder/*", "tokenizer/*"])
agent = laya.load(checkpoint, device="cpu")
agent.model.encoder.config.reference_compile = False
torch.backends.mha.set_fastpath_enabled(False)


class ChoiceModel(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask, marker_pos):
        # Equivalent to Laya's choice path, with explicit attention reshapes.
        # PyTorch's legacy MHA exporter otherwise freezes the example sequence length.
        qtype = torch.zeros(input_ids.shape[0], dtype=torch.long, device=input_ids.device)
        h = self.model.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        h = h + self.model.type_emb(qtype)[:, None, :]
        for layer in self.model.head.layers:
            x = layer.norm1(h)
            attn = layer.self_attn
            batch, seq, dim = x.shape
            q, k, v = F.linear(x, attn.in_proj_weight, attn.in_proj_bias).chunk(3, dim=-1)
            heads = attn.num_heads
            q = q.reshape(batch, seq, heads, dim // heads).transpose(1, 2)
            k = k.reshape(batch, seq, heads, dim // heads).transpose(1, 2)
            v = v.reshape(batch, seq, heads, dim // heads).transpose(1, 2)
            scores = torch.matmul(q, k.transpose(-1, -2)) / (dim // heads) ** 0.5
            scores = scores.masked_fill(~attention_mask[:, None, None, :].bool(), float("-inf"))
            attended = torch.matmul(torch.softmax(scores, dim=-1), v).transpose(1, 2).reshape(batch, seq, dim)
            h = h + F.linear(attended, attn.out_proj.weight, attn.out_proj.bias)
            h = h + layer.linear2(layer.activation(layer.linear1(layer.norm2(h))))
        idx = marker_pos[:, :, None].expand(-1, -1, h.shape[-1])
        return self.model.scorer(torch.gather(h, 1, idx)).squeeze(-1).float()


model = ChoiceModel(agent.model).eval()
question = {"t": "choice", "ins": "Choose a safe direction.", "crit": {"U": "up", "D": "down", "R": "right"}}
state = "Snake near the left wall. Food is above."
ids, markers = build_sequence(agent.tok, state, question, agent.cfg["max_len"], agent.cfg["head_max_len"])
inputs = (torch.tensor([ids]), torch.ones(1, len(ids), dtype=torch.long), torch.tensor([markers]))
with torch.no_grad():
    logits = model(*inputs).tolist()[0]
    torch.onnx.export(
        model, inputs, str(out / "model.onnx"),
        input_names=["input_ids", "attention_mask", "marker_pos"], output_names=["logits"],
        dynamic_axes={"input_ids": {0: "batch", 1: "sequence"}, "attention_mask": {0: "batch", 1: "sequence"}, "marker_pos": {0: "batch", 1: "choices"}, "logits": {0: "batch", 1: "choices"}},
        opset_version=17, dynamo=False,
    )
agent.tok.save_pretrained(str(out))
config = {**agent.cfg, "cls_token_id": agent.tok.cls_token_id, "sep_token_id": agent.tok.sep_token_id, "mask_token_id": agent.tok.mask_token_id, "mask_token": agent.tok.mask_token, "pad_token_id": agent.tok.pad_token_id}
(out / "laya_config.json").write_text(json.dumps(config), encoding="utf-8")
fixtures = []
for text, options in [(state, question["crit"]), ("Food is to the left. Avoid the wall below.", {"L": "left", "U": "up"}), ("A longer example. " * 200, {"U": "up", "D": "down", "L": "left", "R": "right"})]:
    q = {**question, "crit": options}
    seq, marks = build_sequence(agent.tok, text, q, agent.cfg["max_len"], agent.cfg["head_max_len"])
    with torch.no_grad():
        expected = agent.model(torch.tensor([seq]), torch.ones(1, len(seq), dtype=torch.long), torch.tensor([marks]), torch.ones(1, len(marks), dtype=torch.bool), torch.zeros(1, dtype=torch.long))[0].tolist()[0]
    fixtures.append({"state": text, "instructions": q["ins"], "criteria": options, "ids": seq, "markers": marks, "logits": expected})
(out / "parity.json").write_text(json.dumps(fixtures), encoding="utf-8")
print(f"Exported full Laya choice model to {out}. Run npm run test:laya to verify Node.js parity.")
