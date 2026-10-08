import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  // This app uses explicit refs/effects for asynchronous game and network state.
  // The React Compiler is not enabled; retain the standard Hooks checks.
  {
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "models/**",
    ".venv-export/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
  ]),
]);
