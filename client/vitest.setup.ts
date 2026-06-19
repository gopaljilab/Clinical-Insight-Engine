import "@testing-library/jest-dom/vitest";
import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import en from "./src/locales/en/translation.json";

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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      const parts = key.split(".");
      let val: any = en;
      for (const part of parts) {
        if (val && typeof val === "object" && part in val) {
          val = val[part];
        } else {
          return key;
        }
      }
      if (typeof val === "string") {
        if (options && typeof options === "object") {
          let text = val;
          for (const [k, v] of Object.entries(options)) {
            text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
          }
          return text;
        }
        return val;
      }
      return key;
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

