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

type PdfFont = "regular" | "bold" | "italic";

interface TextOptions {
  size?: number;
  font?: PdfFont;
  color?: string;
  maxWidth?: number;
  lineHeight?: number;
}

interface RiskFactor {
  name: string;
  impact: string;
  description: string;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const SLATE = "#0f172a";
const MUTED = "#475569";
const BORDER = "#cbd5e1";
const LIGHT_FILL = "#f8fafc";

const fontMap: Record<PdfFont, string> = {
  regular: "F1",
  bold: "F2",
  italic: "F3",
};

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

  return Array.isArray(rawFactors) ? rawFactors as RiskFactor[] : [];
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
  return Number.isNaN(date.getTime())
    ? "N/A"
    : date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function getRiskColor(category: string): string {
  switch (category.toUpperCase()) {
    case "LOW":
      return "#15803d";
    case "MODERATE":
      return "#b45309";
    case "HIGH":
      return "#b91c1c";
    default:
      return "#1d4ed8";
  }
}

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function hexToRgb(color: string): [number, number, number] {
  const hex = color.replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const averageCharWidth = fontSize * 0.48;
  const maxChars = Math.max(16, Math.floor(maxWidth / averageCharWidth));

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (nextLine.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  });

  if (line) {
    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

class PdfDocument {
  private pages: string[] = [];
  private current: string[] = [];
  y = PAGE_HEIGHT - MARGIN;

  constructor() {
    this.addPage();
  }

  addPage() {
    if (this.current.length > 0) {
      this.pages.push(this.current.join("\n"));
    }
    this.current = [];
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.addPage();
    }
  }

  text(value: string, x: number, options: TextOptions = {}) {
    const size = options.size ?? 10;
    const font = fontMap[options.font ?? "regular"];
    const color = options.color ?? SLATE;
    const [r, g, b] = hexToRgb(color);
    const lines = wrapText(value, options.maxWidth ?? CONTENT_WIDTH, size);
    const lineHeight = options.lineHeight ?? size + 4;

    lines.forEach((line, index) => {
      this.ensureSpace(lineHeight);
      this.current.push(
        "BT",
        `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`,
        `/${font} ${size} Tf`,
        `${x} ${(this.y - index * lineHeight).toFixed(2)} Td`,
        `(${escapePdfText(line)}) Tj`,
        "ET",
      );
    });

    this.y -= lines.length * lineHeight;
  }

  rect(x: number, y: number, width: number, height: number, color: string, fill = true) {
    const [r, g, b] = hexToRgb(color);
    this.current.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${fill ? "rg" : "RG"}`);
    this.current.push(`${x} ${y} ${width} ${height} re ${fill ? "f" : "S"}`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color = BORDER) {
    const [r, g, b] = hexToRgb(color);
    this.current.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
    this.current.push(`0.7 w ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  moveDown(points: number) {
    this.y -= points;
  }

  sectionTitle(title: string) {
    this.ensureSpace(38);
    this.moveDown(6);
    this.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y);
    this.moveDown(18);
    this.text(title, MARGIN, { size: 13, font: "bold", color: SLATE });
    this.moveDown(2);
  }

  keyValueRows(rows: Array<[string, string]>, columns = 2) {
    const columnWidth = CONTENT_WIDTH / columns;
    const rowHeight = 30;

    rows.forEach((row, index) => {
      if (index % columns === 0) {
        this.ensureSpace(rowHeight);
      }

      const column = index % columns;
      const x = MARGIN + column * columnWidth;
      const y = this.y - rowHeight + 5;
      this.rect(x, y, columnWidth - 8, rowHeight, LIGHT_FILL);
      this.textAt(row[0].toUpperCase(), x + 10, this.y - 12, { size: 7, font: "bold", color: MUTED });
      this.textAt(row[1], x + 10, this.y - 25, { size: 10, font: "bold", color: SLATE });

      if (column === columns - 1 || index === rows.length - 1) {
        this.y -= rowHeight + 8;
      }
    });
  }

  textAt(value: string, x: number, y: number, options: TextOptions = {}) {
    const size = options.size ?? 10;
    const font = fontMap[options.font ?? "regular"];
    const color = options.color ?? SLATE;
    const [r, g, b] = hexToRgb(color);
    this.current.push(
      "BT",
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`,
      `/${font} ${size} Tf`,
      `${x} ${y.toFixed(2)} Td`,
      `(${escapePdfText(value)}) Tj`,
      "ET",
    );
  }

  bullet(text: string) {
    this.ensureSpace(18);
    this.textAt("-", MARGIN + 6, this.y, { size: 10, color: MUTED });
    const startingY = this.y;
    this.text(text, MARGIN + 22, { size: 9.5, color: MUTED, maxWidth: CONTENT_WIDTH - 22, lineHeight: 13 });
    this.y = Math.min(this.y, startingY - 15);
  }

  save(filename: string) {
    if (this.current.length > 0) {
      this.pages.push(this.current.join("\n"));
      this.current = [];
    }

    const pdf = buildPdf(this.pages);
    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

function buildPdf(pageContents: string[]): Uint8Array {
  const objects: string[] = [];
  const pageIds: number[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>";

  pageContents.forEach((content, index) => {
    const contentId = 6 + index * 2;
    const pageId = contentId + 1;
    pageIds.push(pageId);
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objects[pageId] = [
      "<< /Type /Page",
      "/Parent 2 0 R",
      `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
      "/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >>",
      `/Contents ${contentId} 0 R`,
      ">>",
    ].join(" ");
  });

  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  const chunks: string[] = ["%PDF-1.4\n"];
  const offsets = [0];
  let byteOffset = chunks[0].length;

  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) {
      continue;
    }

    const objectChunk = `${id} 0 obj\n${objects[id]}\nendobj\n`;
    offsets[id] = byteOffset;
    chunks.push(objectChunk);
    byteOffset += objectChunk.length;
  }

  const xrefOffset = byteOffset;
  chunks.push(`xref\n0 ${objects.length}\n0000000000 65535 f \n`);

  for (let id = 1; id < objects.length; id += 1) {
    chunks.push(`${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`);
  }

  chunks.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new TextEncoder().encode(chunks.join(""));
}

function getReportFilename(assessment: ReportAssessment): string {
  const id = assessment.id ?? "report";
  const patient = (assessment.patientName || "patient").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `clinical-risk-assessment-${patient || "patient"}-${id}.pdf`;
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
  const pdf = new PdfDocument();
  const riskScore = formatNumber(assessment.riskScore, 1, "%");
  const riskCategory = formatValue(assessment.riskCategory);
  const riskColor = getRiskColor(assessment.riskCategory);
  const factors = normalizeFactors(assessment.factors);
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

  pdf.text("Patient Risk Assessment Summary", MARGIN, { size: 21, font: "bold", color: SLATE });
  pdf.text(`Generated ${formatDate(new Date().toISOString())}`, MARGIN, { size: 9, color: MUTED });
  pdf.moveDown(6);
  pdf.line(MARGIN, pdf.y, PAGE_WIDTH - MARGIN, pdf.y, BORDER);
  pdf.moveDown(20);

  pdf.keyValueRows([
    ["Patient Name", formatValue(assessment.patientName)],
    ["Assessment Date", formatDate(assessment.createdAt)],
    ["Risk Category", riskCategory],
    ["Numeric Risk Score", riskScore],
  ]);

  pdf.ensureSpace(64);
  pdf.rect(MARGIN, pdf.y - 54, CONTENT_WIDTH, 54, "#f1f5f9");
  pdf.textAt("RISK CLASSIFICATION", MARGIN + 16, pdf.y - 17, { size: 8, font: "bold", color: MUTED });
  pdf.textAt(`${riskCategory} Risk`, MARGIN + 16, pdf.y - 38, { size: 19, font: "bold", color: riskColor });
  pdf.textAt(riskScore, PAGE_WIDTH - MARGIN - 92, pdf.y - 34, { size: 18, font: "bold", color: riskColor });
  pdf.y -= 70;

  pdf.sectionTitle("Patient Demographics & Vitals");
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

  pdf.sectionTitle("Clinical Narrative & Recommendations");
  pdf.text(
    `This assessment indicates a ${riskCategory.toLowerCase()} risk classification with a numeric score of ${riskScore}. The result should be interpreted alongside the patient's full clinical history, medication profile, and follow-up laboratory data.`,
    MARGIN,
    { size: 10, color: MUTED, maxWidth: CONTENT_WIDTH, lineHeight: 14 },
  );
  pdf.moveDown(8);
  clinicianAdvice.forEach((action) => pdf.bullet(action));
  patientAdvice.forEach((action) => pdf.bullet(action));

  pdf.sectionTitle("Risk Factors");
  if (factors.length === 0) {
    pdf.text("No model factors were returned for this assessment.", MARGIN, { size: 10, color: MUTED });
  } else {
    factors.forEach((factor) => {
      const impact = factor.impact === "positive" ? "Increases risk" : "Reduces risk";
      const reason = factorReasoning[factor.name.trim().toLowerCase()] ?? factor.description;
      pdf.ensureSpace(46);
      pdf.text(factor.name, MARGIN, { size: 10.5, font: "bold", color: SLATE, lineHeight: 14 });
      pdf.text(`${impact}: ${reason}`, MARGIN, { size: 9.5, color: MUTED, maxWidth: CONTENT_WIDTH, lineHeight: 13 });
      pdf.moveDown(5);
    });
  }

  pdf.sectionTitle("Monitoring Workflow");
  pdf.bullet("Use this summary for provider review and patient documentation; it is not a standalone diagnosis.");
  pdf.bullet("Repeat assessment after meaningful updates to BMI, HbA1c, blood glucose, smoking history, or cardiovascular history.");
  pdf.bullet("Escalate high-risk or rapidly changing results to the appropriate clinical follow-up pathway.");

  pdf.save(getReportFilename(assessment));
}
