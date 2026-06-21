import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "client",
      environment: "jsdom",
      setupFiles: ["./client/vitest.setup.ts"],
      include: ["client/src/**/*.test.{ts,tsx}"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "server",
      environment: "node",
      include: ["server/**/*.test.ts"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    },
  },
]);
