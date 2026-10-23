import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      name: string;
      role: string | null;
      emailVerified: boolean;
      /** Compatibility with legacy sessions that used the `verified` field. */
      verified?: boolean;
    };
    pendingUser?: {
      id: string;
      email: string;
    };
    oauthState?: {
      value: string;
      createdAt: number;
    };
  }
}
