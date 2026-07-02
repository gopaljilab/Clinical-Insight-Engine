import { type Request, type Response } from "express";
import { validateFhirBundle, parseFhirBundle, convertToInternalSchema } from "../services/fhirParser";
import { MLService } from "../services/mlService";
import { generateRecommendations } from "../services/recommendation-engine";
import { storage } from "../storage";
import { logger } from "../logger";

export const parseFhirBundleOnly = async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // 1. Validate FHIR Bundle Structure
    try {
      validateFhirBundle(payload);
    } catch (err: unknown) {
      return res.status(400).json({
        status: "error",
        message: (err as Error).message || "Invalid FHIR payload",
      });
    }

    // 2. Parse FHIR Bundle
    const parsed = parseFhirBundle(payload);

    // 3. Convert to internal schema & validate fields
    let assessmentInput;
    try {
      assessmentInput = convertToInternalSchema(parsed);
    } catch (err: unknown) {
      return res.status(400).json({
        status: "error",
        message: (err as Error).message || "Validation failed for parsed clinical data",
      });
    }

    return res.status(200).json({
      status: "success",
      data: assessmentInput,
    });
  } catch (err: unknown) {
    logger.error({ err }, "FHIR parsing failed");
    return res.status(500).json({
      status: "error",
      message: (err as Error).message || "Internal server error during FHIR parsing",
    });
  }
};

export const handleFhirIngestion = async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // 1. Validate FHIR Bundle Structure
    try {
      validateFhirBundle(payload);
    } catch (err: unknown) {
      return res.status(400).json({
        status: "error",
        message: (err as Error).message || "Invalid FHIR payload",
      });
    }

    // 2. Parse FHIR Bundle
    const parsed = parseFhirBundle(payload);

    // 3. Convert to internal schema & validate fields
    let assessmentInput;
    try {
      assessmentInput = convertToInternalSchema(parsed);
    } catch (err: unknown) {
      return res.status(400).json({
        status: "error",
        message: (err as Error).message || "Validation failed for parsed clinical data",
      });
    }

    // 4. Run ML Pipeline Inference (with fallback)
    const { prediction } = await MLService.runAssessmentInference(assessmentInput);

    // 5. Generate recommendations
    const recommendations = generateRecommendations({
      ...assessmentInput,
      riskCategory: prediction.riskCategory,
    });

    // 6. Persist assessment to DB
    const userEmail = req.session.user?.email || "system@clinical-insight-engine.dev";
    const userId = (req.session.user)?.id;

    const savedAssessment = await storage.createAssessment({
      ...assessmentInput,
      riskScore: prediction.riskScore,
      riskCategory: prediction.riskCategory,
      factors: prediction.factors ?? [],
      confidenceInterval: prediction.confidenceInterval ?? null,
      modelConfidence: prediction.modelConfidence ?? null,
      createdBy: userEmail,
      userId: userId ? String(userId) : null,
    });

    // 7. Format insights array
    const insights: any[] = [
      {
        type: "risk",
        category: prediction.riskCategory,
        score: prediction.riskScore,
        confidence: prediction.modelConfidence ?? null,
        confidenceInterval: prediction.confidenceInterval ?? null,
      },
      ...recommendations.map(r => ({
        type: "recommendation",
        id: r.id,
        title: r.title,
        description: r.description,
        urgency: r.urgency,
        audience: r.audience,
        checklist: r.checklist,
      })),
      ...(prediction.clinicianAdvice || []).map(advice => ({
        type: "clinician_advice",
        text: advice,
      })),
      ...(prediction.patientAdvice || []).map(advice => ({
        type: "patient_advice",
        text: advice,
      })),
    ];

    return res.status(200).json({
      status: "success",
      patient_id: parsed.patient?.id || String(savedAssessment.id),
      observations_processed: parsed.observations.length,
      documents_processed: parsed.documents.length,
      insights,
      clinical_note: savedAssessment.clinicalNote || null,
      explainable_insights: savedAssessment.explainableInsights || null,
    });

  } catch (err: unknown) {
    logger.error({ err }, "FHIR Ingestion failed");
    return res.status(500).json({
      status: "error",
      message: (err as Error).message || "Internal server error during FHIR ingestion",
    });
  }
};
