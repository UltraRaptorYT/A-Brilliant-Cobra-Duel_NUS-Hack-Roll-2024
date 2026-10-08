import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "workers/rooms/wrangler.jsonc" },
    }),
  ],
  test: { include: ["workers/rooms/test/**/*.test.ts"] },
});
