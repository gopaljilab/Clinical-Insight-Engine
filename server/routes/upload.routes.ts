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
    const allowedMimeTypes = ["application/pdf", "text/csv", "image/png", "image/jpeg"];
    const allowedExtensions = [".pdf", ".csv", ".png", ".jpg", ".jpeg"];
    
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, CSV, PNG, and JPG files are allowed."));
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
