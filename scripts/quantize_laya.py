"""Optional one-time CPU optimization; no Python is used at game runtime."""
from pathlib import Path
from onnxruntime.quantization import quantize_dynamic, QuantType

directory = Path(__file__).resolve().parents[1] / "models" / "laya"
quantize_dynamic(
    str(directory / "model.onnx"), str(directory / "model.int8.onnx"),
    weight_type=QuantType.QInt8, per_channel=True,
    op_types_to_quantize=["MatMul", "Gemm"],
    extra_options={"MatMulConstBOnly": True},
)
print("Wrote model.int8.onnx. Benchmark and validate before enabling it.")
