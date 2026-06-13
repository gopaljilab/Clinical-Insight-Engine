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
  const patient = (assessment.patientName || "patient")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  return `clinical-risk-assessment-${patient || "patient"}-${id}.pdf`;
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

export function downloadPatientSummaryPdf(assessments: PatientSummaryAssessment[]) {
  const summary = preparePatientSummaryReport(assessments);
  const pdf = new PdfDocument();

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

export function downloadClinicalAssessmentPdf(assessment: ReportAssessment) {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  let y = 50;

  const reportDate = formatDate(new Date().toISOString());
  const riskCategory = formatValue(assessment.riskCategory);
  const riskScore = formatNumber(assessment.riskScore, 1, "%");
  const modelConfidence = formatValue(assessment.modelConfidence);
  const confidenceInterval = formatValue(assessment.confidenceInterval);
  const factors = normalizeFactors(assessment.factors);
  const topFactors = factors.slice(0, 5);
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

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(SLATE);
  pdf.text("Clinical Diabetes Risk Report", MARGIN, y);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(MUTED);
  pdf.text(`Generated ${reportDate}`, MARGIN, y + 18);
  y += 32;

  pdf.setDrawColor(220, 226, 232);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 20;

  y = ensurePageSpace(pdf, y, 160);
  pdf.setFillColor(248, 250, 252);
  pdf.rect(MARGIN, y, CONTENT_WIDTH, 110, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(MUTED);
  pdf.text("Assessment overview", MARGIN + 12, y + 18);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(SLATE);
  pdf.text(`${riskCategory} risk — ${riskScore}`, MARGIN + 12, y + 42);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(MUTED);
  pdf.text(
    `Model confidence: ${modelConfidence}${confidenceInterval !== "N/A" ? ` (95% CI: ${confidenceInterval})` : ""}`,
    MARGIN + 12,
    y + 60,
  );
  y += 132;

  y = addSectionTitle(pdf, "Patient Information", y);
  y = addKeyValueRows(
    pdf,
    [
      ["Patient Name", formatValue(assessment.patientName)],
      ["Assessment Date", formatDate(assessment.createdAt)],
      ["Age", formatValue(assessment.age)],
      ["Gender", formatValue(assessment.gender)],
      ["BMI", formatNumber(assessment.bmi, 1)],
      ["HbA1c", formatNumber(assessment.hba1cLevel, 1, "%")],
      ["Blood Glucose", formatValue(assessment.bloodGlucoseLevel)],
      ["Smoking History", formatValue(assessment.smokingHistory)],
      ["Hypertension", formatValue(assessment.hypertension)],
      ["Heart Disease", formatValue(assessment.heartDisease)],
      ["Assessment ID", formatValue(assessment.id)],
    ],
    y,
    2,
  );

  y = ensurePageSpace(pdf, y, 40);
  y = addSectionTitle(pdf, "Top Contributing Risk Factors", y);

  if (topFactors.length === 0) {
    y = addWrappedText(pdf, "No risk factor details are available for this assessment.", MARGIN, y, CONTENT_WIDTH, 10, 14);
  } else {
    topFactors.forEach((factor, index) => {
      y = ensurePageSpace(pdf, y, 64);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(ACCENT);
      pdf.text(`${index + 1}. ${factor.name}`, MARGIN, y);
      y += 16;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(SLATE);
      const impactLabel = factor.impact === "positive" ? "Increases risk" : "Reduces risk";
      const reason = factorReasoning[factor.name.trim().toLowerCase()] ?? factor.description;
      y = addWrappedText(pdf, `${impactLabel}: ${reason}`, MARGIN + 12, y, CONTENT_WIDTH - 12, 9, 13);
      y += 8;
    });
  }

  y = ensurePageSpace(pdf, y, 40);
  y = addSectionTitle(pdf, "Personalized Recommendations", y);

  if (recommendations.length > 0) {
    y = addBulletList(pdf, recommendations, MARGIN, y, CONTENT_WIDTH);
  } else {
    y = addBulletList(pdf, clinicianAdvice, MARGIN, y, CONTENT_WIDTH);
    y = addBulletList(pdf, patientAdvice, MARGIN, y, CONTENT_WIDTH);
  }

  y = ensurePageSpace(pdf, y, 60);
  y = addSectionTitle(pdf, "Monitoring Workflow", y);
  y = addBulletList(
    pdf,
    [
      "Use this summary for provider review and patient documentation; it is not a standalone diagnosis.",
      "Repeat assessment after meaningful updates to BMI, HbA1c, blood glucose, smoking history, or cardiovascular history.",
      "Escalate high-risk or rapidly changing results to the appropriate clinical follow-up pathway.",
    ],
    MARGIN,
    y,
    CONTENT_WIDTH,
  );

  y = ensurePageSpace(pdf, y, 60);
  y = addSectionTitle(pdf, "Medical Disclaimer", y);
  y = addWrappedText(
    pdf,
    "This report is intended for clinical reference only and does not replace medical diagnosis, judgement, or treatment by a licensed healthcare provider.",
    MARGIN,
    y,
    CONTENT_WIDTH,
    9,
    12,
  );

  pdf.save(getReportFilename(assessment));
}