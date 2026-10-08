import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3101",
    browserName: "chromium",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run rooms:dev",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "npm run dev -- --port 3101",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_ROOMS_URL: "ws://127.0.0.1:8787",
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
