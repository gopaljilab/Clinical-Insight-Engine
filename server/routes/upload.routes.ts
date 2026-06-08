import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth, requireVerified } from "../auth";

const uploadRouter = Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // HARDENING: Restrict to ONLY CSV files to prevent upload of executable or unwanted MIME types
    const allowedMimeTypes = ["text/csv"];
    const allowedExtensions = [".csv"];
    
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only CSV files are allowed."));
    }
  }
});

uploadRouter.post(
  "/lab-results",
  requireAuth,
  requireVerified,
  (req, res) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      
      if (!(req as any).file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      return res.status(200).json({ 
        message: "File uploaded successfully", 
        filename: (req as any).file.originalname 
      });
    });
  }
);

export default uploadRouter;
