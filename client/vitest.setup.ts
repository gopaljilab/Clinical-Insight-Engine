import "@testing-library/jest-dom/vitest";
import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Automatically unmount and cleanup DOM after the test is finished.
afterEach(() => {
  cleanup();
});

// Mock ResizeObserver which is not implemented in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
