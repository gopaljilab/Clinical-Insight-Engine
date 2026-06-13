import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth, requireVerified } from "../auth";
import Papa from "papaparse";
import { insertAssessmentSchema } from "@shared/schema";
import { MLService } from "../services/mlService";
import { storage } from "../storage";
import { logger } from "../logger";

const uploadRouter = Router();

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
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
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const createdBy = req.session.user?.email;
      if (!createdBy) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      try {
        const csvString = file.buffer.toString("utf-8");
        const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });
        
        let processed = 0;
        let created = 0;
        let failed = 0;

        // Process rows sequentially to avoid overwhelming the ML service or DB
        for (const row of parsed.data as Record<string, unknown>[]) {
          processed++;
          
          try {
            // Pre-process boolean fields
            const hypertensionVal = String(row.hypertension).toLowerCase();
            const heartDiseaseVal = String(row.heartDisease).toLowerCase();
            
            const rowData = {
              ...row,
              hypertension: hypertensionVal === 'true' || hypertensionVal === 'yes' || hypertensionVal === '1',
              heartDisease: heartDiseaseVal === 'true' || heartDiseaseVal === 'yes' || heartDiseaseVal === '1',
            };

            const parseResult = insertAssessmentSchema.safeParse(rowData);
            if (!parseResult.success) {
              failed++;
              continue;
            }

            const validData = parseResult.data;
            const { prediction } = await MLService.runAssessmentInference(validData);

            await storage.createAssessment({
              ...validData,
              riskScore: prediction.riskScore,
              riskCategory: prediction.riskCategory,
              factors: prediction.factors,
              confidenceInterval: prediction.confidenceInterval,
              modelConfidence: prediction.modelConfidence,
              createdBy
            });
            
            created++;
          } catch (rowErr) {
            logger.error({ err: rowErr, row }, "Error processing CSV row");
            failed++;
          }
        }

        return res.status(200).json({
          message: "Lab results imported successfully",
          processed,
          created,
          failed
        });
      } catch (parseErr: any) {
        logger.error({ err: parseErr }, "Error parsing CSV file");
        return res.status(500).json({ message: "Failed to parse CSV file" });
      }
    });
  }
);

export default uploadRouter;
