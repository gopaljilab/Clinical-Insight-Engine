import { User } from "@shared/schema";
import { Multer } from "multer";

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: User;
      file?: Multer.File;
      id?: string;
    }
  }
}
