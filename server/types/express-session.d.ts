import "express-session";
import { User } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    user: Pick<User, "id" | "email" | "role">;
  }
}
