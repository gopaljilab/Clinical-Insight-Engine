import "@testing-library/jest-dom/vitest";
import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import enTranslations from "./src/locales/en/translation.json";

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

// Mock translation globally so keys resolve to English translations
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const parts = key.split(".");
      let val: any = enTranslations;
      for (const part of parts) {
        if (val && typeof val === "object") {
          val = val[part];
        } else {
          val = undefined;
          break;
        }
      }
      return val || key;
    },
    i18n: {
      changeLanguage: () => Promise.resolve(),
      language: "en",
    },
  }),
  initReactI18next: {
    type: "3rdParty",
    init: () => {},
  },
}));
