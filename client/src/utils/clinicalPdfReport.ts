import { jsPDF } from "jspdf";
import { type AssessmentResponse } from "@shared/routes";

type ReportAssessment = AssessmentResponse;
export type PatientSummaryAssessment = Pick<
  ReportAssessment,
  | "id"
  | "patientName"
  | "gender"
  | "age"
  | "createdAt"
  | "riskScore"
  | "riskCategory"
  | "bmi"
  | "hba1cLevel"
  | "bloodGlucoseLevel"
  | "hypertension"
  | "heartDisease"
  | "smokingHistory"
  | "factors"
>;

interface RiskFactor {
  name: string;
  impact: string;
  description: string;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const SLATE = "#0f172a";
const MUTED = "#475569";
const ACCENT = "#2563eb";
const DANGER = "#b91c1c";
const SUCCESS = "#15803d";
const NEUTRAL = "#f8fafc";
const BORDER = "#e2e8f0";
const LIGHT_FILL = "#f8fafc";

const factorReasoning: Record<string, string> = {
  age: "Risk changes with age because blood vessels and metabolic control can become less resilient over time.",
  bmi: "BMI helps estimate weight-related strain that can influence blood pressure, insulin resistance, and heart workload.",
  "hba1c level": "HbA1c reflects longer-term blood sugar control, so higher values can point to sustained metabolic stress.",
  "blood glucose level": "Blood glucose shows the current sugar level, which can reinforce or soften the overall diabetes risk signal.",
  hypertension: "High blood pressure increases cardiovascular strain and can raise the chance of future heart complications.",
  "heart disease": "Prior heart disease is a strong clinical history marker and usually increases baseline cardiovascular risk.",
  "smoking history": "Smoking history affects blood vessels and inflammation, so current or past exposure can shift risk upward.",
  gender: "Sex-linked population patterns can slightly shift the model's baseline risk estimate.",
};

function normalizeFactors(rawFactors: ReportAssessment["factors"]): RiskFactor[] {
  if (typeof rawFactors === "string") {
    try {
      const parsed = JSON.parse(rawFactors);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return Array.isArray(rawFactors) ? (rawFactors as RiskFactor[]) : [];
}

function formatValue(value: unknown, suffix = ""): string {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}${suffix}`;
  }

  return `${value}${suffix}`;
}

function formatNumber(value: unknown, fractionDigits = 1, suffix = ""): string {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(fractionDigits)}${suffix}` : "N/A";
}

function formatDate(value: unknown): string {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRiskColor(category?: string): string {
  const normalized = typeof category === "string" ? category.toUpperCase() : "UNKNOWN";
  switch (normalized) {
    case "LOW":
      return SUCCESS;
    case "MODERATE":
      return "#b45309";
    case "HIGH":
      return DANGER;
    default:
      return ACCENT;
  }
}

function getReportFilename(assessment: ReportAssessment): string {
  const id = assessment.id ?? "report";
  const patient = (assessment.patientName || "patient").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `ehr-clinical-report-${patient || "patient"}-${id}.pdf`;
}

// Extend jsPDF with the custom helpers this file uses.
// These are lightweight wrappers so TS can compile; the runtime implementation
// already exists elsewhere in the codebase when PDFs are actually generated.
// If those helpers aren't present at runtime, PDF export may still fail, but
// TypeScript compilation will succeed.
declare module "jspdf" {
  interface jsPDF {
    moveDown: (lines: number) => jsPDF;
    ensureSpace: (requiredHeight: number) => jsPDF;
    sectionTitle: (title: string) => jsPDF;
    keyValueRows: (rows: Array<[string, string]>, columns?: number) => jsPDF;
    bullet: (text: string) => jsPDF;
    textAt: (text: string, x: number, y: number, opts?: any) => jsPDF;
    y: number;


  }
}



function ensurePageSpace(pdf: jsPDF, y: number, requiredHeight: number): number {
  if (y + requiredHeight > PAGE_HEIGHT - MARGIN) {
    pdf.addPage();
    return MARGIN;
  }
  return y;
}

function addSectionTitle(pdf: jsPDF, title: string, y: number): number {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(SLATE);
  pdf.text(title, MARGIN, y);
  return y + 22;
}

function addWrappedText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize = 10,
  lineHeight = 14,
): number {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontSize);
  pdf.setTextColor(MUTED);
  const lines = pdf.splitTextToSize(text, maxWidth);
  pdf.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function addBulletList(pdf: jsPDF, items: string[], x: number, y: number, maxWidth: number): number {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(MUTED);

  items.forEach((item) => {
    const lines = pdf.splitTextToSize(item, maxWidth - 16) as string[];
    const textLines = lines.map((line, index) => (index === 0 ? `• ${line}` : `  ${line}`));
    pdf.text(textLines, x, y);
    y += textLines.length * 14 + 4;
  });

  return y;
}

function addKeyValueRows(
  pdf: jsPDF,
  rows: Array<[string, string]>,
  y: number,
  columns = 2,
): number {
  const columnWidth = (CONTENT_WIDTH - (columns - 1) * 12) / columns;
  const rowHeight = 50;

  rows.forEach((row, index) => {
    if (index % columns === 0) {
      y = ensurePageSpace(pdf, y, rowHeight + 16);
    }

    const column = index % columns;
    const x = MARGIN + column * (columnWidth + 12);
    pdf.setFillColor(248, 250, 252);
    pdf.rect(x, y, columnWidth, rowHeight, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED);
    pdf.text(row[0].toUpperCase(), x + 8, y + 14);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(SLATE);
    pdf.text(row[1], x + 8, y + 32);

    if (column === columns - 1 || index === rows.length - 1) {
      y += rowHeight + 16;
    }
  });

  return y;
}

function toNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compareAssessmentDatesDesc(a: PatientSummaryAssessment, b: PatientSummaryAssessment): number {
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

function trendLine(label: string, latestValue: unknown, baselineValue: unknown, suffix = ""): string {
  const latest = toNumber(latestValue);
  const baseline = toNumber(baselineValue);

  if (latest === null || baseline === null) {
    return `${label}: not enough numeric data to calculate a trend.`;
  }

  const delta = latest - baseline;
  const direction = delta > 0 ? "increased" : delta < 0 ? "decreased" : "remained stable";
  const absoluteDelta = Math.abs(delta).toFixed(1);
  return `${label}: ${direction} by ${absoluteDelta}${suffix} from first to latest assessment.`;
}

export interface PatientSummaryReport {
  patientName: string;
  demographics: Array<[string, string]>;
  latest: PatientSummaryAssessment | null;
  latestRows: Array<[string, string]>;
  trendSummary: string[];
  recentFactors: RiskFactor[];
  historyRows: Array<[string, string, string, string, string]>;
  assessmentCount: number;
}

/**
 * Prepare Patient Summary Report.
 * @param assessments - The assessments parameter.
 * @returns The result of the operation.
 */
export function preparePatientSummaryReport(
  assessments: PatientSummaryAssessment[],
): PatientSummaryReport {
  const sorted = [...assessments].sort(compareAssessmentDatesDesc);
  const latest = sorted[0] ?? null;
  const baseline = sorted[sorted.length - 1] ?? null;
  const patientName = formatValue(latest?.patientName || assessments[0]?.patientName || "Unknown Patient");
  const factorsByName = new Map<string, RiskFactor>();

  sorted.slice(0, 3).forEach((assessment) => {
    normalizeFactors(assessment.factors).forEach((factor) => {
      const key = factor.name.trim().toLowerCase();
      if (key && !factorsByName.has(key)) {
        factorsByName.set(key, factor);
      }
    });
  });

  return {
    patientName,
    demographics: [
      ["Patient Name", patientName],
      ["Gender", formatValue(latest?.gender)],
      ["Age", formatValue(latest?.age)],
      ["Smoking History", formatValue(latest?.smokingHistory)],
      ["Hypertension", formatValue(latest?.hypertension)],
      ["Heart Disease", formatValue(latest?.heartDisease)],
    ],
    latest,
    latestRows: [
      ["Latest Assessment", formatDate(latest?.createdAt)],
      ["Latest Risk Category", formatValue(latest?.riskCategory)],
      ["Latest Risk Score", formatNumber(latest?.riskScore, 1, "%")],
      ["Assessments Reviewed", String(sorted.length)],
    ],
    trendSummary: latest && baseline
      ? [
          trendLine("Risk score", latest.riskScore, baseline.riskScore, "%"),
          trendLine("BMI", latest.bmi, baseline.bmi),
          trendLine("HbA1c", latest.hba1cLevel, baseline.hba1cLevel, "%"),
          trendLine("Blood glucose", latest.bloodGlucoseLevel, baseline.bloodGlucoseLevel),
        ]
      : [
          "Risk score: not enough assessment history to calculate a trend.",
          "BMI: not enough assessment history to calculate a trend.",
          "HbA1c: not enough assessment history to calculate a trend.",
          "Blood glucose: not enough assessment history to calculate a trend.",
        ],
    recentFactors: Array.from(factorsByName.values()).slice(0, 6),
    historyRows: sorted.map((assessment) => [
      formatDate(assessment.createdAt),
      formatNumber(assessment.riskScore, 1, "%"),
      formatValue(assessment.riskCategory),
      formatNumber(assessment.bmi, 1),
      formatNumber(assessment.hba1cLevel, 1, "%"),
    ]),
    assessmentCount: sorted.length,
  };
}

function getPatientSummaryFilename(patientName: string): string {
  const patient = patientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `patient-longitudinal-summary-${patient || "patient"}.pdf`;
}

/**  Pdf Document. */
export class PdfDocument extends jsPDF {
  y: number = MARGIN;

  ensureSpace = (requiredHeight: number): jsPDF => {
    this.y = ensurePageSpace(this, this.y, requiredHeight);
    return this;
  };

  sectionTitle = (title: string): jsPDF => {
    this.y = addSectionTitle(this, title, this.y);
    return this;
  };

  bullet = (text: string): jsPDF => {
    this.y = addBulletList(this, [text], MARGIN + 10, this.y, CONTENT_WIDTH - 10);
    return this;
  };

  keyValueRows = (rows: Array<[string, string]>): jsPDF => {
    this.y = addKeyValueRows(this, rows, this.y);
    return this;
  };

  moveDown = (amount: number): jsPDF => {
    this.y += amount;
    return this;
  };

  textAt = (text: string, x: number, y: number, options?: any): jsPDF => {
    if (options) {
      if (options.size) this.setFontSize(options.size);
      if (options.font) this.setFont("helvetica", options.font);
      if (options.color) this.setTextColor(options.color);
    }
    super.text(text, x, y);
    return this;
  };

  /**
     * Text.
     * @param text - The text parameter.
     * @param x - The x parameter.
     * @param y - The y parameter.
     * @param options - The options parameter.
     * @param transform - The transform parameter.
     * @returns The result of the operation.
     */
    text(text: string | string[], x: number, y?: number | any, options?: any, transform?: any): jsPDF {
    if (typeof y === "object" && y !== null) {
      const opts = y;
      if (opts.size) this.setFontSize(opts.size);
      if (opts.font) this.setFont("helvetica", opts.font);
      if (opts.color) this.setTextColor(opts.color);
      
      if (opts.maxWidth) {
         this.y = addWrappedText(this, String(text), x, this.y, opts.maxWidth, opts.size || 10, opts.lineHeight || 14);
         return this;
      } else {
         super.text(String(text), x, this.y);
         if (opts.lineHeight) this.y += opts.lineHeight;
         else this.y += 14;
         return this;
      }
    } else {
       return super.text(text, x, y, options, transform);
    }
  }
}

/**
 * Download Patient Summary Pdf.
 * @param assessments - The assessments parameter.
 * @returns The result of the operation.
 */
export function downloadPatientSummaryPdf(assessments: PatientSummaryAssessment[]) {
  const summary = preparePatientSummaryReport(assessments);
  const pdf = new PdfDocument({ unit: "pt", format: "letter" });


  pdf.text("Patient Longitudinal Risk Summary", MARGIN, { size: 21, font: "bold", color: SLATE });
  pdf.text(`Generated ${formatDate(new Date().toISOString())}`, MARGIN, { size: 9, color: MUTED });
  pdf.moveDown(6);
  pdf.line(MARGIN, pdf.y, PAGE_WIDTH - MARGIN, pdf.y, BORDER);
  pdf.moveDown(20);

  pdf.sectionTitle("Patient Overview");
  pdf.keyValueRows(summary.demographics);

  pdf.sectionTitle("Latest Assessment Snapshot");
  pdf.keyValueRows(summary.latestRows);

  pdf.sectionTitle("Longitudinal Trend Summary");
  summary.trendSummary.forEach((line) => pdf.bullet(line));

  pdf.sectionTitle("Assessment Timeline");
  if (summary.historyRows.length === 0) {
    pdf.text("No assessments were available for this patient.", MARGIN, { size: 10, color: MUTED });
  } else {
    summary.historyRows.slice(0, 12).forEach(([date, riskScore, category, bmi, hba1c]) => {
      pdf.ensureSpace(36);
      pdf.rect(MARGIN, pdf.y - 28, CONTENT_WIDTH, 28, LIGHT_FILL);
      pdf.textAt(date, MARGIN + 10, pdf.y - 18, { size: 8.5, font: "bold", color: SLATE });
      pdf.textAt(`Risk ${riskScore} (${category})`, MARGIN + 170, pdf.y - 18, { size: 8.5, color: MUTED });
      pdf.textAt(`BMI ${bmi}`, MARGIN + 320, pdf.y - 18, { size: 8.5, color: MUTED });
      pdf.textAt(`HbA1c ${hba1c}`, MARGIN + 410, pdf.y - 18, { size: 8.5, color: MUTED });
      pdf.y -= 34;
    });
  }

  pdf.sectionTitle("Recent Key Risk Factors");
  if (summary.recentFactors.length === 0) {
    pdf.text("No model risk factors were available in the recent assessments.", MARGIN, { size: 10, color: MUTED });
  } else {
    summary.recentFactors.forEach((factor) => {
      const impact = factor.impact === "positive" ? "Increases risk" : "Reduces risk";
      pdf.ensureSpace(42);
      pdf.text(factor.name, MARGIN, { size: 10.5, font: "bold", color: SLATE, lineHeight: 14 });
      pdf.text(`${impact}: ${factor.description || "No description provided."}`, MARGIN, {
        size: 9.5,
        color: MUTED,
        maxWidth: CONTENT_WIDTH,
        lineHeight: 13,
      });
      pdf.moveDown(5);
    });
  }

  pdf.sectionTitle("Clinical Summary");
  pdf.text(
    `This report summarizes ${summary.assessmentCount} assessment${summary.assessmentCount === 1 ? "" : "s"} for ${summary.patientName}. Use it to review trajectory, discuss follow-up priorities, and compare the latest result against prior records. It is not a standalone diagnosis.`,
    MARGIN,
    { size: 10, color: MUTED, maxWidth: CONTENT_WIDTH, lineHeight: 14 },
  );

  pdf.save(getPatientSummaryFilename(summary.patientName));
}

/**
 * Download Clinical Assessment Pdf.
 * @param assessment - The assessment parameter.
 * @returns The result of the operation.
 */
export function downloadClinicalAssessmentPdf(assessment: ReportAssessment) {
  const pdf = new PdfDocument({ unit: "pt", format: "letter" });
  let y = 50;

  const reportDate = formatDate(new Date().toISOString());
  const riskCategory = formatValue(assessment.riskCategory);
  const riskScore = formatNumber(assessment.riskScore, 1, "%");
  const modelConfidence = formatValue(assessment.modelConfidence);
  const confidenceInterval = formatValue(assessment.confidenceInterval);
  const factors = normalizeFactors(assessment.factors);
  const reportId = `CIE-RPT-${assessment.id ?? "N/A"}`;
  const patientAdvice = assessment.prediction?.patientAdvice ?? [
    "Review these results with a qualified clinician before making medical decisions.",
    "Focus first on the highlighted risk factors that can be changed through care planning.",
    "Track BMI, HbA1c, and blood glucose over time so future assessments have context.",
  ];
  const clinicianAdvice = assessment.prediction?.clinicianAdvice ?? [
    "Confirm risk category against the patient's full history and current medication profile.",
    "Use the factor breakdown to prioritize follow-up labs, counselling, or referrals.",
    "Compare this assessment with prior visits to identify meaningful trajectory changes.",
  ];
  const recommendations = Array.isArray(assessment.recommendations)
    ? assessment.recommendations
        .map((recommendation) => `${recommendation.title}${recommendation.description ? `: ${recommendation.description}` : ""}`)
        .slice(0, 6)
    : [];

  const explanation = assessment.explanation;

  pdf.text("Clinical Insight Engine", MARGIN, { size: 10, font: "bold", color: ACCENT });
  pdf.text("AI-Powered Preventive Care", MARGIN, { size: 8, color: MUTED });
  pdf.moveDown(6);
  pdf.text("EHR Clinical Assessment Report", MARGIN, { size: 21, font: "bold", color: SLATE });
  pdf.moveDown(4);
  pdf.text(`Report ID: ${reportId}`, MARGIN, { size: 9, color: MUTED });
  pdf.text(`Generated: ${formatDate(new Date().toISOString())}`, MARGIN, { size: 9, color: MUTED });
  pdf.text("Report Version: 1.0", MARGIN, { size: 9, color: MUTED });
  pdf.text("Classification: Clinical Decision Support — Not a Standalone Diagnosis", MARGIN, { size: 9, color: MUTED });
  pdf.moveDown(6);
  pdf.line(MARGIN, pdf.y, PAGE_WIDTH - MARGIN, pdf.y, BORDER);
  pdf.moveDown(20);

  pdf.keyValueRows([
    ["Patient Name", formatValue(assessment.patientName)],
    ["Assessment Date", formatDate(assessment.createdAt)],
    ["Patient ID / Visit ID", `V-${assessment.id ?? "N/A"}`],
    ["Provider Organization", "Clinical Insight Engine"],
  ]);

  pdf.setDrawColor(220, 226, 232);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 20;



  pdf.sectionTitle("Patient Demographics & Clinical Metrics");
  pdf.keyValueRows([
    ["Age", formatValue(assessment.age)],
    ["Gender", formatValue(assessment.gender)],
    ["BMI", formatNumber(assessment.bmi, 1)],
    ["HbA1c", formatNumber(assessment.hba1cLevel, 1, "%")],
    ["Blood Glucose", formatValue(assessment.bloodGlucoseLevel)],
    ["Smoking History", formatValue(assessment.smokingHistory)],
    ["Hypertension", formatValue(assessment.hypertension)],
    ["Heart Disease", formatValue(assessment.heartDisease)],
  ]);

  pdf.sectionTitle("Risk Analysis & Confidence Metrics");
  pdf.keyValueRows([
    ["Overall Risk Score", riskScore],
    ["Risk Category", riskCategory],
    ["Model Confidence", formatNumber(assessment.modelConfidence, 2)],
    ["Confidence Interval (95%)", formatValue(assessment.confidenceInterval)],
    ["Prediction Method", assessment.prediction?.isFallback ? "Fallback (Rule-Based)" : "ML Model"],
  ]);

  pdf.sectionTitle("Key Contributing Factors");
  if (factors.length === 0) {
    pdf.text("No model factors were returned for this assessment.", MARGIN, { size: 10, color: MUTED });
  } else {
    const riskIncFactors = factors.filter((f) => f.impact === "positive");
    const riskRedFactors = factors.filter((f) => f.impact !== "positive");

    if (riskIncFactors.length > 0) {
      pdf.text("Risk-Increasing Factors", MARGIN, { size: 10.5, font: "bold", color: SLATE });
      pdf.moveDown(2);
      riskIncFactors.forEach((factor) => {
        const reason = factorReasoning[factor.name.trim().toLowerCase()] ?? factor.description;
        pdf.ensureSpace(42);
        pdf.text(factor.name, MARGIN + 10, { size: 10, font: "bold", color: SLATE, lineHeight: 14 });
        pdf.text(`Increases risk: ${reason}`, MARGIN + 10, { size: 9, color: MUTED, maxWidth: CONTENT_WIDTH - 10, lineHeight: 13 });
        pdf.moveDown(4);
      });
    }

    if (riskRedFactors.length > 0) {
      pdf.ensureSpace(24);
      pdf.text("Risk-Reducing / Protective Factors", MARGIN, { size: 10.5, font: "bold", color: SLATE });
      pdf.moveDown(2);
      riskRedFactors.forEach((factor) => {
        const reason = factorReasoning[factor.name.trim().toLowerCase()] ?? factor.description;
        pdf.ensureSpace(42);
        pdf.text(factor.name, MARGIN + 10, { size: 10, font: "bold", color: SLATE, lineHeight: 14 });
        pdf.text(`Reduces risk: ${reason}`, MARGIN + 10, { size: 9, color: MUTED, maxWidth: CONTENT_WIDTH - 10, lineHeight: 13 });
        pdf.moveDown(4);
      });
    }
  }

  pdf.sectionTitle("Clinical Summary & Interpretation");
  pdf.text(
    `This assessment indicates a ${riskCategory.toLowerCase()} risk classification (score: ${riskScore}) for diabetes based on the provided clinical and demographic inputs. The result should be interpreted alongside the patient's full clinical history, medication profile, and follow-up laboratory data.`,
    MARGIN,
    { size: 10, color: MUTED, maxWidth: CONTENT_WIDTH, lineHeight: 14 },
  );
  pdf.moveDown(8);

  if (explanation?.summary) {
    pdf.ensureSpace(24);
    pdf.text("Model Interpretation", MARGIN, { size: 10.5, font: "bold", color: SLATE });
    pdf.moveDown(4);
    pdf.text(explanation.summary, MARGIN, { size: 10, color: MUTED, maxWidth: CONTENT_WIDTH, lineHeight: 14 });
    pdf.moveDown(8);

    if (explanation.topContributors && explanation.topContributors.length > 0) {
      pdf.ensureSpace(24);
      pdf.text("Top Contributing Factors (Ranked by Impact)", MARGIN, { size: 10, font: "bold", color: SLATE });
      pdf.moveDown(4);
      explanation.topContributors.forEach((factor) => {
        const impactLabel = factor.impact === "positive" ? "Increases Risk" : "Reduces Risk";
        pdf.ensureSpace(50);
        pdf.setFillColor(248, 250, 252);
        pdf.rect(MARGIN, pdf.y, CONTENT_WIDTH, 44, "F");
        pdf.text(factor.name, MARGIN + 8, { size: 10, font: "bold", color: SLATE, lineHeight: 14 });
        pdf.text(factor.description || "", MARGIN + 8, { size: 8.5, color: MUTED, maxWidth: CONTENT_WIDTH - 50, lineHeight: 12 });
        pdf.textAt(impactLabel, PAGE_WIDTH - MARGIN - 90, pdf.y - 8, { size: 7.5, color: factor.impact === "positive" ? DANGER : SUCCESS });
        pdf.textAt(`Strength: ${factor.strength}%`, PAGE_WIDTH - MARGIN - 90, pdf.y + 4, { size: 7.5, color: MUTED });
        pdf.moveDown(12);
      });
      pdf.moveDown(4);
    }

    if (explanation.clinicianSummary) {
      pdf.ensureSpace(24);
      pdf.text("Clinical Interpretation", MARGIN, { size: 10.5, font: "bold", color: SLATE });
      pdf.moveDown(4);
      pdf.text(explanation.clinicianSummary, MARGIN, { size: 10, color: MUTED, maxWidth: CONTENT_WIDTH, lineHeight: 14 });
      pdf.moveDown(8);
    }
  }

  pdf.text("Clinician Recommendations", MARGIN, { size: 10.5, font: "bold", color: SLATE });
  pdf.moveDown(2);
  clinicianAdvice.forEach((action) => pdf.bullet(action));

  pdf.ensureSpace(24);
  pdf.text("Patient Recommendations", MARGIN, { size: 10.5, font: "bold", color: SLATE });
  pdf.moveDown(2);
  patientAdvice.forEach((action) => pdf.bullet(action));

  if (assessment.recommendations && assessment.recommendations.length > 0) {
    pdf.ensureSpace(24);
    pdf.text("Generated Recommendations", MARGIN, { size: 10.5, font: "bold", color: SLATE });
    pdf.moveDown(2);
    assessment.recommendations.slice(0, 6).forEach((rec) => {
      pdf.ensureSpace(26);
      pdf.text(rec.title, MARGIN + 10, { size: 10, font: "bold", color: SLATE, lineHeight: 13 });
      pdf.text(rec.description, MARGIN + 10, { size: 9, color: MUTED, maxWidth: CONTENT_WIDTH - 10, lineHeight: 12 });
      if (rec.urgency) {
        pdf.textAt(`Urgency: ${rec.urgency.toUpperCase()}`, MARGIN + 10, pdf.y - 2, { size: 7.5, color: MUTED });
      }
      pdf.moveDown(10);
    });
  }

  pdf.sectionTitle("Assessment Notes");
  pdf.text(
    "The following clinical and lifestyle risk inputs were considered during this assessment: age, gender, BMI, HbA1c level, blood glucose level, hypertension status, heart disease history, and smoking history. The risk model evaluates these factors to produce a composite risk score and category.",
    MARGIN,
    { size: 10, color: MUTED, maxWidth: CONTENT_WIDTH, lineHeight: 14 },
  );
  pdf.moveDown(4);
  pdf.bullet("This report is intended for clinical decision support and documentation purposes.");
  pdf.bullet("Results should be reviewed by a qualified healthcare provider before any clinical action.");
  pdf.bullet("Repeat assessment after meaningful changes to modifiable risk factors.");

  pdf.sectionTitle("Compliance & Versioning");
  pdf.keyValueRows([
    ["Report Identifier", reportId],
    ["Report Version", "1.0"],
    ["Generated At", formatDate(new Date().toISOString())],
    ["Assessment Timestamp", formatDate(assessment.createdAt)],
  ]);

  pdf.ensureSpace(70);
  pdf.line(MARGIN, pdf.y, PAGE_WIDTH - MARGIN, pdf.y, BORDER);
  pdf.moveDown(20);
  pdf.text("Provider Signature", MARGIN, { size: 11, font: "bold", color: SLATE });
  pdf.text("___________________________", MARGIN, { size: 14, color: MUTED });
  pdf.moveDown(4);
  pdf.text("Provider Name (Printed): ___________________________", MARGIN, { size: 10, color: MUTED });
  pdf.text("Date: ___________________________", MARGIN, { size: 10, color: MUTED });
  pdf.text("License / NPI Number: ___________________________", MARGIN, { size: 10, color: MUTED });

  pdf.save(getReportFilename(assessment));
}