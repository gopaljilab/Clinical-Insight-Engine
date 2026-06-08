export type ImportAssessmentRow = {
  patientName: string;
  gender: "Male" | "Female";
  age: number;
  hypertension: boolean;
  heartDisease: boolean;
  smokingHistory: "never" | "No Info" | "current" | "former";
  bmi: number;
  hba1cLevel: number;
  bloodGlucoseLevel: number;
};

export type ImportPreviewRow = {
  rowNumber: number;
  status: "valid" | "invalid";
  errors: string[];
  warnings: string[];
  raw: Record<string, unknown>;
  data?: ImportAssessmentRow;
};

export type ImportPreviewSummary = {
  rows: ImportPreviewRow[];
  validRows: ImportPreviewRow[];
  invalidRows: ImportPreviewRow[];
  duplicateRows: ImportPreviewRow[];
  formulaRows: ImportPreviewRow[];
};

const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r\n]/;
const GENDERS = new Set(["Male", "Female"]);
const SMOKING_HISTORY = new Set(["never", "No Info", "current", "former"]);

function readField(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return "";
}

export function sanitizeImportCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return FORMULA_PREFIX_PATTERN.test(text) ? `'${text}` : text;
}

function hasFormulaLikeValue(row: Record<string, unknown>): boolean {
  return Object.values(row).some((value) => FORMULA_PREFIX_PATTERN.test(String(value ?? "").trim()));
}

function parseNumber(value: unknown, label: string, min: number, max: number, errors: string[]): number {
  const raw = String(value ?? "").trim().replace(/,/g, ".");
  const number = Number(raw);
  if (!raw) {
    errors.push(`${label} is required.`);
    return Number.NaN;
  }
  if (!Number.isFinite(number)) {
    errors.push(`${label} must be a valid number.`);
    return Number.NaN;
  }
  if (number < min || number > max) {
    errors.push(`${label} must be between ${min} and ${max}.`);
  }
  return number;
}

function parseBoolean(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y"].includes(normalized);
}

function normalizeGender(value: unknown, errors: string[]): "Male" | "Female" {
  const text = sanitizeImportCell(value);
  const gender = text.toLowerCase() === "male" ? "Male" : text.toLowerCase() === "female" ? "Female" : text;
  if (!GENDERS.has(gender)) {
    errors.push("Gender must be Male or Female.");
    return "Male";
  }
  return gender as "Male" | "Female";
}

function normalizeSmokingHistory(value: unknown, errors: string[]): ImportAssessmentRow["smokingHistory"] {
  const text = sanitizeImportCell(value);
  const normalized = text.toLowerCase();
  const smoking =
    normalized === "no info" || normalized === "no_info"
      ? "No Info"
      : normalized === "never" || normalized === "current" || normalized === "former"
        ? normalized
        : text;

  if (!SMOKING_HISTORY.has(smoking)) {
    errors.push("Smoking history must be never, No Info, current, or former.");
    return "No Info";
  }
  return smoking as ImportAssessmentRow["smokingHistory"];
}

export function buildCsvImportPreview(rows: Record<string, unknown>[]): ImportPreviewSummary {
  const patientNameCounts = new Map<string, number>();
  rows.forEach((row) => {
    const patientName = sanitizeImportCell(readField(row, ["patientName", "name"]));
    if (patientName) {
      const key = patientName.toLowerCase();
      patientNameCounts.set(key, (patientNameCounts.get(key) ?? 0) + 1);
    }
  });

  const previewRows = rows.map((row, index): ImportPreviewRow => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    const formulaLike = hasFormulaLikeValue(row);
    const patientName = sanitizeImportCell(readField(row, ["patientName", "name"]));

    if (!patientName) {
      errors.push("Patient name is required.");
    }
    if (formulaLike) {
      warnings.push("Formula-like CSV value detected and neutralized with a leading quote.");
    }
    if (patientName && (patientNameCounts.get(patientName.toLowerCase()) ?? 0) > 1) {
      warnings.push("Duplicate patient name detected in this CSV.");
    }

    const data: ImportAssessmentRow = {
      patientName,
      gender: normalizeGender(readField(row, ["gender"]), errors),
      age: parseNumber(readField(row, ["age"]), "Age", 1, 120, errors),
      hypertension: parseBoolean(readField(row, ["hypertension"])),
      heartDisease: parseBoolean(readField(row, ["heartDisease", "heart_disease"])),
      smokingHistory: normalizeSmokingHistory(readField(row, ["smokingHistory", "smoking_history"]), errors),
      bmi: parseNumber(readField(row, ["bmi"]), "BMI", 10, 60, errors),
      hba1cLevel: parseNumber(readField(row, ["hba1cLevel", "HbA1c_level", "hba1c_level"]), "HbA1c level", 3, 15, errors),
      bloodGlucoseLevel: parseNumber(
        readField(row, ["bloodGlucoseLevel", "blood_glucose_level"]),
        "Blood glucose level",
        50,
        400,
        errors,
      ),
    };

    return {
      rowNumber,
      status: errors.length === 0 ? "valid" : "invalid",
      errors,
      warnings,
      raw: row,
      data: errors.length === 0 ? data : undefined,
    };
  });

  return {
    rows: previewRows,
    validRows: previewRows.filter((row) => row.status === "valid"),
    invalidRows: previewRows.filter((row) => row.status === "invalid"),
    duplicateRows: previewRows.filter((row) => row.warnings.some((warning) => warning.includes("Duplicate"))),
    formulaRows: previewRows.filter((row) => row.warnings.some((warning) => warning.includes("Formula-like"))),
  };
}
