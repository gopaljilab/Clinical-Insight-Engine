import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth, requireVerified } from "../auth";
import Papa from "papaparse";
import { insertAssessmentSchema, type InsertAssessment } from "@shared/schema";
import { MLService } from "../services/mlService";
import { storage } from "../storage";
import { logger } from "../logger";
import { uploadLimiter } from "../middleware/rateLimit";

const uploadRouter = Router();

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req: any, file: unknown, cb: unknown) => {
    // HARDENING: Restrict to ONLY CSV files to prevent upload of executable or unwanted MIME types
    const allowedMimeTypes = ["text/csv"];
    const allowedExtensions = [".csv"];
    
    const ext = path.extname((file as any).originalname).toLowerCase();
    
    if (allowedMimeTypes.includes((file as any).mimetype) && allowedExtensions.includes(ext)) {
      (cb as any)(null, true);
    } else {
      (cb as any)(new Error("Invalid file type. Only CSV files are allowed."));
    }
  }
});

uploadRouter.post(
  "/lab-results",
  requireAuth,
  requireVerified,
  uploadLimiter,
  (req, res) => {
    upload.single("file")(req, res, async (err: unknown) => {
      if (err) {
        return res.status(400).json({ message: (err as Error).message });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "api.errors.noFileUploaded" });
      }

      const createdBy = req.session.user?.email;
      const userId = req.session.user?.id;
      if (!userId || !createdBy) {
        return res.status(401).json({ message: "api.errors.unauthorized" });
      }

      try {
        const csvString = req.file.buffer.toString("utf-8");
        const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });

        if (parsed.data.length > 100) {
          return res.status(400).json({ message: "CSV exceeds maximum limit of 100 rows." });
        }
        
        // Phase 1: Validate all rows (no ML inference yet)
        const validRows: { rowData: InsertAssessment; rowId: string | number }[] = [];
        let processed = 0;
        let failed = 0;

        for (const row of parsed.data as Record<string, unknown>[]) {
          processed++;

          try {
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
            const rowId = (row as any).id || (row as any).patient_id || (row as any).patientName || processed;
            validRows.push({ rowData: validData, rowId });
          } catch (rowErr) {
            logger.error({ err: rowErr, row }, "Error processing CSV row");
            failed++;
          }
        }

        // Phase 2: Run ML inference for every valid row in a single batch
        // call. runAssessmentInferenceBatch acquires only ONE mlConcurrency
        // semaphore slot for the entire upload (instead of one slot per row),
        // so a single CSV upload can no longer saturate the semaphore and
        // starve concurrent /preview, /simulate, or queue-worker inference.
        const inferred: { rowData: InsertAssessment; prediction: any }[] = [];
        if (validRows.length > 0) {
          try {
            const { predictions } = await MLService.runAssessmentInferenceBatch(
              validRows.map((v) => v.rowData),
              "csv-upload",
              { throwOnFailure: true }
            );
            validRows.forEach((v, i) => {
              inferred.push({ rowData: v.rowData, prediction: predictions[i] });
            });
          } catch (batchErr) {
            logger.error({ err: batchErr }, "Batch ML inference failed for CSV upload");
            failed += validRows.length;
          }
        }

        // Phase 3: Insert all valid assessments in a single transaction
        let created = 0;
        if (inferred.length > 0) {
          const createdAssessments = await storage.createAssessmentsBatch(
            inferred.map(({ rowData, prediction }) => ({
              ...rowData,
              riskScore: prediction.riskScore,
              riskCategory: prediction.riskCategory,
              factors: prediction.factors,
              confidenceInterval: prediction.confidenceInterval,
              modelConfidence: prediction.modelConfidence,
              createdBy,
            }))
          );
          created = createdAssessments.length;
        }   

        return res.status(200).json({ 
          message: "Lab results imported successfully",
          processed,
          imported: created,
          created,
          failed
        });
      } catch (parseErr: unknown) {
        logger.error({ err: parseErr }, "CSV parse error");
        return res.status(500).json({ message: "api.errors.csvParseFailed" });
      }
    });
  }
);

export default uploadRouter;
