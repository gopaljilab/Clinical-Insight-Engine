import { Router } from "express";
import { requireAuth, requireVerified } from "../auth";
import { handleFhirIngestion, parseFhirBundleOnly } from "../controllers/fhir.controller";

const fhirRouter = Router();

fhirRouter.post(
  "/fhir",
  requireAuth,
  requireVerified,
  handleFhirIngestion
);

fhirRouter.post(
  "/fhir/parse",
  requireAuth,
  requireVerified,
  parseFhirBundleOnly
);

export default fhirRouter;
