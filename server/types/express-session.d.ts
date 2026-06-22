import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      name: string;
      role: string | null;
      emailVerified: boolean;
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
