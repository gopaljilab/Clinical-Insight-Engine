import { Router, Request, Response } from 'express';

const router = Router();

// Explicit structural model interface definition for strict return mapping properties
interface PatientRecord {
  id: string;
  name: string;
  medicalHistory: string;
  createdAt: Date;
  assessmentData?: {
    score: number;
    notes: string;
    flagged: boolean;
  };
}

// Mock database provider object matching the strict entity structures
const db = {
  patients: {
    findAll: async (): Promise<PatientRecord[]> => []
  }
};

/**
 * Handle Patient Record Ingestion Streams.
 * Replaces generic `any` mapping parameters to safeguard against stripping nested assessment subfields.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const rawRecords: PatientRecord[] = await db.patients.findAll();

    // Map out objects safely by enforcing interface compliance down through the transformation block
    const sanitizedRecords = rawRecords.map((record: PatientRecord) => {
      return {
        id: record.id,
        name: record.name,
        medicalHistory: record.medicalHistory,
        // Safeguard explicit compilation binding for nested assessment fields
        assessmentData: record.assessmentData ? {
          score: record.assessmentData.score,
          notes: record.assessmentData.notes,
          flagged: record.assessmentData.flagged
        } : undefined
      };
    });

    return res.status(200).json({
      success: true,
      data: sanitizedRecords
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

export default router;
