import { insertAssessmentSchema, type InsertAssessment } from "../../shared/schema";
import { parseClinicalDate, extractDatesFromText, type ExtractedDate } from "../../shared/dateParser";

export interface NormalizedPatient {
  id?: string;
  name: string;
  gender: "Male" | "Female";
  birthDate?: string;
}

export interface NormalizedObservation {
  codeDisplay?: string;
  code?: string;
  valueQuantity?: {
    value: number;
    unit?: string;
  };
  valueString?: string;
  effectiveDateTime?: string;
  component?: Array<{
    code?: {
      coding?: Array<{
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    valueQuantity?: {
      value: number;
    };
  }>;
}

export interface NormalizedDocument {
  description?: string;
  type?: string;
  attachmentContent?: string;
  attachmentTitle?: string;
}

export interface NormalizedFhirStructure {
  patient?: NormalizedPatient;
  observations: NormalizedObservation[];
  documents: NormalizedDocument[];
}

/**
 * Validates the structure of a FHIR R4 Bundle.
 * Throws clean, informative validation errors if validation fails.
 */
export function validateFhirBundle(payload: any): void {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid FHIR payload");
  }

  if (!("resourceType" in payload)) {
    throw new Error("Invalid FHIR payload");
  }

  if (payload.resourceType !== "Bundle") {
    throw new Error("Unsupported FHIR structure");
  }

  if (!payload.type || typeof payload.type !== "string") {
    throw new Error("Unsupported FHIR structure");
  }

  if (!payload.entry || !Array.isArray(payload.entry)) {
    throw new Error("Missing Bundle entries");
  }

  if (payload.entry.length === 0) {
    throw new Error("Missing Bundle entries");
  }
}

/**
 * Parses supported FHIR R4 resources (Patient, Observation, DocumentReference)
 * and returns a normalized structure.
 */
export function parseFhirBundle(payload: any): NormalizedFhirStructure {
  const result: NormalizedFhirStructure = {
    observations: [],
    documents: [],
  };

  for (const entry of payload.entry) {
    if (!entry || typeof entry !== "object" || !entry.resource) {
      continue;
    }

    const resource = entry.resource;
    const resourceType = resource.resourceType;

    if (resourceType === "Patient") {
      let patientName = "";
      if (resource.name && Array.isArray(resource.name) && resource.name.length > 0) {
        // Try to find official or usual name, otherwise use the first one
        const nameObj = resource.name.find((n: any) => n.use === "official" || n.use === "usual") || resource.name[0];
        if (nameObj) {
          const given = Array.isArray(nameObj.given) ? nameObj.given.join(" ") : "";
          const family = nameObj.family || "";
          patientName = `${given} ${family}`.trim();
        }
      }

      let gender: "Male" | "Female" | undefined;
      if (resource.gender === "male") {
        gender = "Male";
      } else if (resource.gender === "female") {
        gender = "Female";
      }

      result.patient = {
        id: resource.id,
        name: patientName,
        gender: gender as any,
        birthDate: resource.birthDate,
      };
    } else if (resourceType === "Observation") {
      const codeCoding = resource.code?.coding?.[0];
      const codeDisplay = codeCoding?.display || resource.code?.text || "";
      const codeVal = codeCoding?.code || "";

      const obs: NormalizedObservation = {
        codeDisplay,
        code: codeVal,
        effectiveDateTime: resource.effectiveDateTime,
      };

      if (resource.valueQuantity) {
        obs.valueQuantity = {
          value: Number(resource.valueQuantity.value),
          unit: resource.valueQuantity.unit,
        };
      }

      if (resource.valueString) {
        obs.valueString = resource.valueString;
      }

      if (resource.component && Array.isArray(resource.component)) {
        obs.component = resource.component.map((comp: any) => ({
          code: comp.code,
          valueQuantity: comp.valueQuantity ? { value: Number(comp.valueQuantity.value) } : undefined,
        }));
      }

      result.observations.push(obs);
    } else if (resourceType === "DocumentReference") {
      const doc: NormalizedDocument = {
        description: resource.description,
        type: resource.type?.text || resource.type?.coding?.[0]?.display,
      };

      const attachment = resource.content?.[0]?.attachment;
      if (attachment) {
        doc.attachmentTitle = attachment.title;
        if (attachment.data) {
          try {
            doc.attachmentContent = Buffer.from(attachment.data, "base64").toString("utf-8");
          } catch (e) {
            // Ignore decoding errors
          }
        }
      }

      result.documents.push(doc);
    }
  }

  return result;
}

function getSentenceContaining(text: string, index: number, matchLength: number): { snippet: string; start: number; end: number } {
  // Look backwards for sentence start
  let start = index;
  while (start > 0) {
    const char = text[start - 1];
    if (char === '.' || char === '\n' || char === '!' || char === '?') {
      break;
    }
    start--;
  }

  // Look forwards for sentence end
  let end = index + matchLength;
  while (end < text.length) {
    const char = text[end];
    if (char === '.' || char === '\n' || char === '!' || char === '?') {
      break;
    }
    end++;
  }

  // Extract, trim, and adjust start/end accordingly
  const snippet = text.substring(start, end);
  const leadingSpaces = snippet.length - snippet.trimStart().length;
  const trailingSpaces = snippet.length - snippet.trimEnd().length;
  
  const finalStart = start + leadingSpaces;
  const finalEnd = end - trailingSpaces;
  
  return {
    snippet: snippet.trim(),
    start: finalStart,
    end: finalEnd,
  };
}

export interface ExplainableInsight {
  insight: string;
  source_snippet: string | null;
  source_index: [number, number] | null;
}

/**
 * Extract dates from free-form clinical note text and return only those that
 * are ambiguous or could not be parsed — these need clinician review.
 *
 * @param noteText - Raw clinical note text
 * @returns Array of `ExtractedDate` entries where `ambiguous === true` or `date === null`
 *          (confidence < 1.0 and not caused by a completely unrecognised format).
 */
export function extractClinicalNoteDateWarnings(noteText: string): ExtractedDate[] {
  if (!noteText) return [];
  return extractDatesFromText(noteText).filter(
    (d) => d.ambiguous || (d.date === null && d.confidence > 0)
  );
}

export function extractExplainableInsights(noteText: string): ExplainableInsight[] {
  const insights: ExplainableInsight[] = [];
  if (!noteText) {
    return [
      { insight: "Patient shows signs of hypertension", source_snippet: null, source_index: null },
      { insight: "Patient shows signs of heart disease", source_snippet: null, source_index: null },
      { insight: "Patient has a history of smoking", source_snippet: null, source_index: null }
    ];
  }

  const lowerText = noteText.toLowerCase();

  // 1. Hypertension
  let htInsight: ExplainableInsight = { insight: "Patient shows signs of hypertension", source_snippet: null, source_index: null };
  const bpRegex = /\b(?:bp|blood pressure|reading|vitals)?\s*(\d{2,3})\s*[/|-]\s*(\d{2,3})\b/i;
  const bpMatch = noteText.match(bpRegex);
  if (bpMatch) {
    const systolic = parseInt(bpMatch[1]);
    const diastolic = parseInt(bpMatch[2]);
    if (systolic > 140 || diastolic > 90) {
      const sentence = getSentenceContaining(noteText, bpMatch.index!, bpMatch[0].length);
      htInsight = {
        insight: "Patient shows signs of hypertension",
        source_snippet: sentence.snippet,
        source_index: [sentence.start, sentence.end],
      };
    }
  }
  
  if (!htInsight.source_snippet) {
    const htKeywords = ["hypertension", "high blood pressure", "htn"];
    for (const kw of htKeywords) {
      const idx = lowerText.indexOf(kw);
      if (idx !== -1) {
        const sentence = getSentenceContaining(noteText, idx, kw.length);
        htInsight = {
          insight: "Patient shows signs of hypertension",
          source_snippet: sentence.snippet,
          source_index: [sentence.start, sentence.end],
        };
        break;
      }
    }
  }
  insights.push(htInsight);

  // 2. Heart Disease
  let hdInsight: ExplainableInsight = { insight: "Patient shows signs of heart disease", source_snippet: null, source_index: null };
  const hdKeywords = [
    "heart disease",
    "coronary artery",
    "cad",
    "myocardial infarction",
    "mi",
    "heart failure",
    "atrial fibrillation"
  ];
  for (const kw of hdKeywords) {
    const idx = lowerText.indexOf(kw);
    if (idx !== -1) {
      const sentence = getSentenceContaining(noteText, idx, kw.length);
      hdInsight = {
        insight: "Patient shows signs of heart disease",
        source_snippet: sentence.snippet,
        source_index: [sentence.start, sentence.end],
      };
      break;
    }
  }
  insights.push(hdInsight);

  // 3. Smoking History
  let shInsight: ExplainableInsight = { insight: "Patient has a history of smoking", source_snippet: null, source_index: null };
  const shKeywords = [
    { kw: "current smoker", label: "Patient has a smoking history (current)" },
    { kw: "active smoker", label: "Patient has a smoking history (current)" },
    { kw: "smokes tobacco", label: "Patient has a smoking history (current)" },
    { kw: "smoking daily", label: "Patient has a smoking history (current)" },
    { kw: "former smoker", label: "Patient has a smoking history (former)" },
    { kw: "ex-smoker", label: "Patient has a smoking history (former)" },
    { kw: "quit smoking", label: "Patient has a smoking history (former)" },
    { kw: "history of smoking", label: "Patient has a smoking history (former)" },
    { kw: "never smoked", label: "Patient has a smoking history (never)" },
    { kw: "non-smoker", label: "Patient has a smoking history (never)" },
    { kw: "never smoker", label: "Patient has a smoking history (never)" }
  ];
  for (const item of shKeywords) {
    const idx = lowerText.indexOf(item.kw);
    if (idx !== -1) {
      const sentence = getSentenceContaining(noteText, idx, item.kw.length);
      shInsight = {
        insight: item.label,
        source_snippet: sentence.snippet,
        source_index: [sentence.start, sentence.end],
      };
      break;
    }
  }
  insights.push(shInsight);

  return insights;
}

/**
 * Return type for `convertToInternalSchema`.
 * `dateWarnings` carries any ambiguous or low-confidence dates found inside
 * clinical note text so callers can surface them in the API response.
 */
export interface ConvertedAssessment {
  assessment: InsertAssessment;
  /**
   * Dates extracted from clinical notes that were ambiguous (confidence 0.3)
   * or had only one valid interpretation but still required a format warning
   * (confidence 0.7).  Empty array means no date issues were found.
   */
  dateWarnings: Array<{
    rawMatch: string;
    offset: number;
    confidence: number;
    ambiguous: boolean;
    warning?: string;
    mmddInterpretation: string | null;
    ddmmInterpretation: string | null;
  }>;
}

/**
 * Maps the normalized FHIR structure to the internal InsertAssessment schema.
 * Performs rigorous validations and throws clean error messages.
 *
 * Returns a `ConvertedAssessment` which bundles the validated assessment data
 * with any date warnings extracted from clinical note text.
 */
export function convertToInternalSchema(structure: NormalizedFhirStructure): ConvertedAssessment {
  if (!structure.patient) {
    throw new Error("Missing required field: Patient Name");
  }

  if (!structure.patient.name) {
    throw new Error("Missing required field: Patient Name");
  }

  if (!structure.patient.gender) {
    throw new Error("Missing required field: Gender");
  }

  if (structure.patient.gender !== "Male" && structure.patient.gender !== "Female") {
    throw new Error("Gender must be 'Male' or 'Female'");
  }

  if (!structure.patient.birthDate) {
    throw new Error("Missing required field: Age");
  }

  // Use parseClinicalDate so ambiguous formats (e.g. 08/10/1990) are caught
  // rather than silently misinterpreted by the JS Date constructor.
  const parsedBirth = parseClinicalDate(structure.patient.birthDate);
  if (!parsedBirth.date) {
    if (parsedBirth.ambiguous) {
      throw new Error(
        `Ambiguous birth date "${structure.patient.birthDate}": ${parsedBirth.warning} ` +
          "Please supply the date in ISO 8601 format (YYYY-MM-DD)."
      );
    }
    throw new Error(
      `Invalid birth date format "${structure.patient.birthDate}". ` +
        "Use ISO 8601 (YYYY-MM-DD)."
    );
  }

  const birthDate = parsedBirth.date;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getUTCFullYear();
  const m = today.getMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getUTCDate())) {
    age--;
  }

  if (age < 1 || age > 120) {
    throw new Error("Age must be between 1 and 120");
  }

  let bmi: number | undefined;
  let hba1cLevel: number | undefined;
  let bloodGlucoseLevel: number | undefined;
  let hypertension = false;
  let heartDisease = false;
  let smokingHistory: "never" | "No Info" | "current" | "former" = "No Info";

  // Scan observations
  for (const obs of structure.observations) {
    const code = (obs.code || "").toLowerCase();
    const display = (obs.codeDisplay || "").toLowerCase();

    // 1. BMI
    if (code === "39156-5" || display.includes("bmi") || display.includes("body mass index")) {
      if (obs.valueQuantity) {
        bmi = obs.valueQuantity.value;
      }
    }

    // 2. HbA1c
    if (code === "4548-4" || display.includes("hba1c") || display.includes("hemoglobin a1c") || display.includes("glycated hemoglobin")) {
      if (obs.valueQuantity) {
        hba1cLevel = obs.valueQuantity.value;
      }
    }

    // 3. Blood Glucose
    if (code === "2339-0" || display.includes("glucose") || display.includes("blood glucose")) {
      if (obs.valueQuantity) {
        bloodGlucoseLevel = obs.valueQuantity.value;
      }
    }

    // 4. Hypertension (BP component observations or keyword)
    if (code === "85354-9" || code === "55284-4" || display.includes("blood pressure")) {
      if (obs.component && Array.isArray(obs.component)) {
        for (const comp of obs.component) {
          const compCode = comp.code?.coding?.[0]?.code || "";
          const compDisplay = (comp.code?.coding?.[0]?.display || comp.code?.text || "").toLowerCase();
          const val = comp.valueQuantity?.value;

          if (val !== undefined) {
            if (compCode === "8480-6" || compDisplay.includes("systolic")) {
              if (val > 140) hypertension = true;
            }
            if (compCode === "8462-4" || compDisplay.includes("diastolic")) {
              if (val > 90) hypertension = true;
            }
          }
        }
      }
    }

    if (display.includes("hypertension") || display.includes("high blood pressure") || display.includes("htn")) {
      if (obs.valueString) {
        const valStr = obs.valueString.toLowerCase();
        if (valStr.includes("yes") || valStr.includes("true") || valStr.includes("active") || valStr.includes("present")) {
          hypertension = true;
        }
      } else {
        hypertension = true;
      }
    }

    // 5. Heart Disease
    if (
      display.includes("heart disease") ||
      display.includes("coronary artery disease") ||
      display.includes("cad") ||
      display.includes("myocardial infarction") ||
      display.includes("mi") ||
      display.includes("heart failure") ||
      display.includes("atrial fibrillation")
    ) {
      if (obs.valueString) {
        const valStr = obs.valueString.toLowerCase();
        if (valStr.includes("yes") || valStr.includes("true") || valStr.includes("active") || valStr.includes("present")) {
          heartDisease = true;
        }
      } else {
        heartDisease = true;
      }
    }

    // 6. Smoking History
    if (display.includes("smoking") || display.includes("tobacco")) {
      const checkText = `${display} ${obs.valueString || ""}`.toLowerCase();
      if (checkText.includes("never smoked") || checkText.includes("non-smoker") || checkText.includes("never smoker")) {
        smokingHistory = "never";
      } else if (checkText.includes("current smoker") || checkText.includes("active smoker") || checkText.includes("smokes daily") || checkText.includes("smokes")) {
        smokingHistory = "current";
      } else if (checkText.includes("former smoker") || checkText.includes("ex-smoker") || checkText.includes("quit smoking") || checkText.includes("history of smoking")) {
        smokingHistory = "former";
      }
    }
  }

  // Scan documents
  for (const doc of structure.documents) {
    const textToScan = `${doc.description || ""} ${doc.type || ""} ${doc.attachmentTitle || ""} ${doc.attachmentContent || ""}`.toLowerCase();

    if (textToScan.includes("hypertension") || textToScan.includes("high blood pressure") || textToScan.includes("htn")) {
      hypertension = true;
    }

    if (
      textToScan.includes("heart disease") ||
      textToScan.includes("coronary artery") ||
      textToScan.includes("cad") ||
      textToScan.includes("myocardial infarction") ||
      textToScan.includes("mi") ||
      textToScan.includes("heart failure") ||
      textToScan.includes("atrial fibrillation")
    ) {
      heartDisease = true;
    }

    if (textToScan.includes("never smoked") || textToScan.includes("non-smoker") || textToScan.includes("never smoker")) {
      if (smokingHistory !== "current") {
        smokingHistory = "never";
      }
    } else if (textToScan.includes("current smoker") || textToScan.includes("active smoker") || textToScan.includes("smokes tobacco") || textToScan.includes("smoking daily")) {
      smokingHistory = "current";
    } else if (textToScan.includes("former smoker") || textToScan.includes("ex-smoker") || textToScan.includes("quit smoking") || textToScan.includes("history of smoking")) {
      if (smokingHistory !== "current") {
        smokingHistory = "former";
      }
    }
  }

  if (bmi === undefined) {
    throw new Error("Missing required field: BMI");
  }

  if (hba1cLevel === undefined) {
    throw new Error("Missing required field: HbA1c Level");
  }

  if (bloodGlucoseLevel === undefined) {
    throw new Error("Missing required field: Blood Glucose Level");
  }

  const clinicalNote = structure.documents
    .map(d => d.attachmentContent || d.description || "")
    .filter(Boolean)
    .join("\n\n");
  const explainableInsights = clinicalNote ? extractExplainableInsights(clinicalNote) : null;

  // ── Scan clinical notes for ambiguous / low-confidence dates ────────────
  // Any date in a clinical note that can't be resolved unambiguously to a
  // single calendar date is returned as a warning so the API can flag it
  // to the caller rather than silently guessing.
  const rawDateWarnings = clinicalNote
    ? extractClinicalNoteDateWarnings(clinicalNote)
    : [];

  const dateWarnings = rawDateWarnings.map((d) => {
    // Reconstruct both interpretations for display purposes
    const a = parseInt(d.rawMatch.split(/[\/\-]/)[0], 10);
    const b = parseInt(d.rawMatch.split(/[\/\-]/)[1], 10);
    const y = parseInt(d.rawMatch.split(/[\/\-]/)[2], 10);
    const makeISO = (yr: number, mo: number, dy: number) => {
      if (!yr || !mo || !dy) return null;
      const dt = new Date(Date.UTC(yr, mo - 1, dy));
      if (
        dt.getUTCFullYear() !== yr ||
        dt.getUTCMonth() + 1 !== mo ||
        dt.getUTCDate() !== dy
      ) return null;
      return `${yr}-${String(mo).padStart(2, "0")}-${String(dy).padStart(2, "0")}`;
    };
    return {
      rawMatch: d.rawMatch,
      offset: d.offset,
      confidence: d.confidence,
      ambiguous: d.ambiguous,
      warning: d.warning,
      mmddInterpretation: !isNaN(a) && !isNaN(b) && !isNaN(y) ? makeISO(y, a, b) : null,
      ddmmInterpretation: !isNaN(a) && !isNaN(b) && !isNaN(y) ? makeISO(y, b, a) : null,
    };
  });

  const assessment: InsertAssessment = {
    patientName: structure.patient.name,
    gender: structure.patient.gender,
    age,
    hypertension,
    heartDisease,
    smokingHistory,
    bmi,
    hba1cLevel,
    bloodGlucoseLevel,
    clinicalNote: clinicalNote || null,
    explainableInsights: explainableInsights || null,
  };

  // Zod parsing will validate range values
  try {
    const validated = insertAssessmentSchema.parse(assessment);
    return { assessment: validated, dateWarnings };
  } catch (err: unknown) {
    if ((err as any).errors && (err as any).errors.length > 0) {
      throw new Error((err as any).errors[0].message);
    }
    throw err;
  }
}