import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

const baseResolve = {
  alias: {
    "@": path.resolve(__dirname, "client", "src"),
    "@shared": path.resolve(__dirname, "shared"),
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: baseResolve,
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 10,
        branches: 10,
        functions: 10,
        lines: 10,
      },
      exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "**/*.test.*", "**/*.config.*", "**/vitest.setup.ts"],
    },
    projects: [
      {
        name: "client",
        test: {
          include: ["client/src/**/*.test.{ts,tsx}"],
          globals: true,
          environment: "jsdom",
          setupFiles: ["./client/vitest.setup.ts"],
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "client", "src"),
          },
        },
      },
      {
        name: "server",
        test: {
          include: ["server/**/*.test.ts"],
          globals: true,
          environment: "node",
        },
        resolve: baseResolve,
      },
      {
        name: "shared",
        test: {
          include: ["shared/**/*.test.ts"],
          globals: true,
          environment: "node",
        },
        resolve: baseResolve,
      },
      {
        name: "tests",
        test: {
          include: ["tests/**/*.test.ts"],
          globals: true,
          environment: "node",
        },
        resolve: baseResolve,
      },
    ],
  },
});
