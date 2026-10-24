export function shouldUseSecureSessionCookie(config: {
  nodeEnv?: string;
  secureOverride?: string;
  appUrl?: string;
}): boolean {
  if (config.nodeEnv !== "production") return false;

  let isLoopbackHttpOrigin = false;
  try {
    const appUrl = new URL(config.appUrl ?? "");
    isLoopbackHttpOrigin =
      appUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname);
  } catch {
    // Invalid or missing APP_URL is not a reason to weaken production cookies.
  }

  return !(config.secureOverride === "false" && isLoopbackHttpOrigin);
}
