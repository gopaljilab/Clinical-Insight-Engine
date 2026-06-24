import { Multer } from "multer";
import type { AuthenticatedUser } from "../auth";

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: AuthenticatedUser;
      file?: Multer.File;
      id?: string;
    }
  }
}
