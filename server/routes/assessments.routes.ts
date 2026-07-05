import { Router } from "express";
import { assessmentLimiter, previewLimiter } from "../middleware/rateLimit";
import { requireAuth, requireVerified } from "../auth";
import { validateDTO } from "../middleware/validateDTO";
import { api } from "@shared/routes";

import {
  previewAssessment,
  simulateWhatIf,
  batchWhatIf,
  autoWhatIf,
  createAssessment,
  simulateFallback,
  getPatientTrends,
  getDashboardTrends,
  getJobStatus,
  getAssessments,
  getBiomarkerAlerts,
  searchAssessments,
  autocompleteAssessments,
  getAssessmentById,
  deleteAssessment,
  getCohortStats
} from "../controllers/assessments.controller";
import { storage } from "../storage";
import sanitizeHtml from "sanitize-html";
import { canAccessPatientRecord } from "../services/authz/patient-access";
import { logAccessAttempt } from "../security/access-audit";
import { logger } from "../logger";

const assessmentsRouter = Router();

assessmentsRouter.post(
  "/preview",
  requireAuth,
  requireVerified,
  previewLimiter,
  validateDTO(api.assessments.preview.input),
  previewAssessment
);

assessmentsRouter.post(
  "/what-if",
  requireAuth,
  requireVerified,
  previewLimiter,
  validateDTO(api.assessments.simulate.input),
  simulateWhatIf
);

assessmentsRouter.post(
  "/what-if/batch",
  requireAuth,
  requireVerified,
  batchWhatIf
);

assessmentsRouter.post(
  "/what-if/auto",
  requireAuth,
  requireVerified,
  autoWhatIf
);

assessmentsRouter.post(
  "/",
  requireAuth,
  requireVerified,
  assessmentLimiter,
  validateDTO(api.assessments.create.input),
  createAssessment
);

assessmentsRouter.post(
  "/simulate",
  requireAuth,
  requireVerified,
  previewLimiter,
  validateDTO(api.assessments.simulate.input),
  simulateFallback
);

assessmentsRouter.get(
  "/patient/:patientName/trends",
  requireAuth,
  requireVerified,
  getPatientTrends
);

assessmentsRouter.get(
  "/trends/dashboard",
  requireAuth,
  requireVerified,
  getDashboardTrends
);

assessmentsRouter.get(
  "/jobs/:id",
  requireAuth,
  requireVerified,
  getJobStatus
);

assessmentsRouter.get(
  "/",
  requireAuth,
  requireVerified,
  getAssessments
);

assessmentsRouter.get(
  "/biomarker-alerts",
  requireAuth,
  requireVerified,
  getBiomarkerAlerts
);

assessmentsRouter.get(
  "/search",
  requireAuth,
  requireVerified,
  searchAssessments
);

assessmentsRouter.get(
  "/autocomplete",
  requireAuth,
  requireVerified,
  autocompleteAssessments
);

assessmentsRouter.get(
  "/cohort",
  requireAuth,
  requireVerified,
  getCohortStats
);

assessmentsRouter.get(
  "/:id",
  requireAuth,
  requireVerified,
  getAssessmentById
);

assessmentsRouter.patch(
  "/:id/note",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "api.errors.invalidAssessmentId" });
      }

      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "api.errors.unauthorized" });
      }

      const assessment = await storage.getAssessmentById(id);
      if (!assessment) {
        return res.status(404).json({ message: "api.errors.assessmentNotFound" });
      }

      if (!canAccessPatientRecord(user, assessment)) {
        logAccessAttempt(
          user.id,
          "Assessment",
          id,
          false,
          "IDOR attempt: User not authorized to edit notes on this patient record"
        );
        return res.status(403).json({ message: "Forbidden" });
      }

      const { clinicalNote } = req.body;
      if (typeof clinicalNote !== 'string' && clinicalNote !== null && clinicalNote !== undefined) {
        return res.status(400).json({ message: "api.errors.clinicalNoteString" });
      }

      const sanitized = sanitizeHtml(clinicalNote);

      const updated = await storage.updateClinicalNote(id, sanitized);
      if (!updated) {
        return res.status(500).json({ message: "api.errors.updateClinicalNoteFailed" });
      }

      logAccessAttempt(user.id, "Assessment", id, true, "Clinical note updated");
      return res.json({ clinicalNote: updated.clinicalNote });
    } catch (err) {
      logger.error({ err }, "Clinical note update error:");
      return res.status(500).json({ message: "api.errors.updateClinicalNoteFailed" });
    }
  }
);

assessmentsRouter.delete(
  "/:id",
  requireAuth,
  requireVerified,
  deleteAssessment
);


export default assessmentsRouter;
