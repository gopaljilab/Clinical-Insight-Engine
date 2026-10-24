import { describe, expect, it } from "vitest";
import { shouldUseSecureSessionCookie } from "./sessionCookie";

describe("session cookie security", () => {
  it("keeps cookies secure in production by default", () => {
    expect(shouldUseSecureSessionCookie({ nodeEnv: "production", appUrl: "https://app.example" })).toBe(true);
  });

  it("allows the explicit insecure-cookie override only for loopback HTTP", () => {
    expect(shouldUseSecureSessionCookie({
      nodeEnv: "production",
      secureOverride: "false",
      appUrl: "http://localhost:5001",
    })).toBe(false);
  });

  it("ignores the insecure-cookie override for non-loopback production origins", () => {
    expect(shouldUseSecureSessionCookie({
      nodeEnv: "production",
      secureOverride: "false",
      appUrl: "http://app.example",
    })).toBe(true);
  });

  it("does not mark development cookies secure", () => {
    expect(shouldUseSecureSessionCookie({ nodeEnv: "development", appUrl: "https://app.example" })).toBe(false);
  });
});
