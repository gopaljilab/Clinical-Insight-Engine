import { Router } from "express";
import { requireAuth, requireVerified } from "../auth";
import { handleFhirIngestion } from "../controllers/fhir.controller";

const fhirRouter = Router();

fhirRouter.post(
  "/fhir",
  requireAuth,
  requireVerified,
  handleFhirIngestion
);

export default fhirRouter;
