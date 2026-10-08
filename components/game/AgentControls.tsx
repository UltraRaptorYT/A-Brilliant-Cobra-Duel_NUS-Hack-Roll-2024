import {
  AgentConfig,
  Provider,
  Strategy,
  withProvider,
  withStrategy,
} from "./decisions";

export default function AgentControls({
  label,
  value,
  onChange,
  disabled = false,
  available,
}: {
  label: string;
  value: AgentConfig;
  onChange: (config: AgentConfig) => void;
  disabled?: boolean;
  available: Record<Provider, boolean>;
}) {
  return (
    <fieldset
      disabled={disabled}
      className="space-y-3 rounded-xl border p-4 disabled:opacity-70"
    >
      <legend className="px-2 font-semibold">{label}</legend>
      <label className="block text-sm">
        Decision engine
        <select
          aria-label={`${label} engine`}
          className="mt-1 block w-full rounded-md border bg-background p-2"
          value={value.provider}
          onChange={(e) =>
            onChange(withProvider(value, e.target.value as Provider))
          }
        >
          <option value="builtin">Built-in · no setup</option>
          <option value="laya" disabled={!available.laya}>
            Laya · local model{!available.laya ? " (export model first)" : ""}
          </option>
          <option value="openai" disabled={!available.openai}>
            GPT{!available.openai ? " (API key needed)" : ""}
          </option>
        </select>
      </label>
      <label className="block text-sm">
        Strategy
        <select
          aria-label={`${label} strategy`}
          className="mt-1 block w-full rounded-md border bg-background p-2"
          value={value.strategy}
          onChange={(e) =>
            onChange(withStrategy(value, e.target.value as Strategy))
          }
        >
          <option value="balanced">Balanced</option>
          <option value="food">Food hunter</option>
          <option value="survival">Survival first</option>
          <option value="aggressive">Aggressive - hunt opponent</option>
        </select>
      </label>
      <label className="block text-sm">
        Instructions for Laya / GPT
        <textarea
          aria-label={`${label} instructions`}
          className="mt-1 block w-full min-h-[90px] rounded-md border bg-background p-2"
          maxLength={2000}
          value={value.prompt}
          onChange={(e) => onChange({ ...value, prompt: e.target.value })}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {value.strategy === "aggressive" && "High risk: accepts possible collisions to pressure the opponent. Mutual death is a draw. "}
        Built-in uses the strategy setting. Laya receives a compact move
        analysis; GPT also supports board placeholders.
      </p>
    </fieldset>
  );
}
