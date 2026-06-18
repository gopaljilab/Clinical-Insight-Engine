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
  "/:id",
  requireAuth,
  requireVerified,
  getAssessmentById
);

assessmentsRouter.delete(
  "/:id",
  requireAuth,
  requireVerified,
  deleteAssessment
);

assessmentsRouter.get(
  "/cohort",
  requireAuth,
  getCohortStats
);

export default assessmentsRouter;
