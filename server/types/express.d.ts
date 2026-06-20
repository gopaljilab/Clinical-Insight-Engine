import { Multer } from "multer";

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: {
        userId: string;
        email: string;
        role: string;
        isActive: boolean;
        authMethod: "session" | "jwt";
      };
      file?: Multer.File;
      id?: string;
    }
  }
}
