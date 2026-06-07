import { jsPDF } from "jspdf";

interface BulkExportAssessment {
  id: number;
  patientName: string | null;
  gender: string | null;
  age: number | null;
  createdAt: string | null;
  riskScore: number | null;
  riskCategory: string | null;
  bmi: number | null;
  hba1cLevel: number | null;
  bloodGlucoseLevel: number | null;
  hypertension: boolean | null;
  heartDisease: boolean | null;
  smokingHistory: string | null;
  factors?: Array<{ name: string; impact: string; description: string }>;
  confidenceInterval?: string | null;
  modelConfidence?: number | null;
}

function fmt(val: unknown): string {
  if (val === null || val === undefined) return "—";
  return String(val);
}

export function downloadBulkAssessmentPdf(assessments: BulkExportAssessment[]): void {
  const doc = new jsPDF("landscape", "mm", "a4");
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 12;
  const cw = pw - 2 * m;

  const addFooter = () => {
    doc.setFontSize(8);
    doc.setFont("Helvetica", "italic");
    doc.text(
      `Clinical Insight Engine — Page ${doc.getCurrentPageInfo().pageNumber}`,
      pw / 2,
      ph - 6,
      { align: "center" }
    );
  };

  // ── Page 1: Title ──
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Assessment Export Report", pw / 2, 35, { align: "center" });

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pw / 2, 50, { align: "center" });
  doc.text(`Total assessments: ${assessments.length}`, pw / 2, 58, { align: "center" });

  // Risk distribution
  const counts: Record<string, number> = {};
  for (const a of assessments) {
    const cat = (a.riskCategory || "Unknown").toUpperCase();
    counts[cat] = (counts[cat] || 0) + 1;
  }
  const barMax = Math.max(...Object.values(counts), 1);
  const barStartY = 78;
  const barW = 40;
  const barGap = 10;
  const barH = 120;
  const colors: Record<string, [number, number, number]> = {
    LOW: [34, 197, 94],
    MODERATE: [234, 179, 8],
    HIGH: [239, 68, 68],
  };

  doc.setFontSize(14);
  doc.setFont("Helvetica", "bold");
  doc.text("Risk Distribution", pw / 2, 72, { align: "center" });

  const categories = Object.keys(counts).sort();
  const totalBars = categories.length;
  const totalBarArea = totalBars * barW + (totalBars - 1) * barGap;
  const barStartX = (pw - totalBarArea) / 2;
  const barBottomY = barStartY + barH;

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const count = counts[cat];
    const x = barStartX + i * (barW + barGap);
    const h = (count / barMax) * barH;
    const y = barBottomY - h;

    const color = colors[cat] || [100, 100, 100];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(x, y, barW, h, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text(cat, x + barW / 2, y - 4, { align: "center" });
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text(String(count), x + barW / 2, y - 14, { align: "center" });
  }

  addFooter();

  // ── Page 2+: Summary Table ──
  doc.addPage();
  const cols = [
    { label: "#", w: 10 },
    { label: "Date", w: 32 },
    { label: "Patient Name", w: 52 },
    { label: "Age", w: 12 },
    { label: "Gender", w: 16 },
    { label: "BMI", w: 16 },
    { label: "HbA1c", w: 16 },
    { label: "Glucose", w: 18 },
    { label: "Risk Score", w: 20 },
    { label: "Category", w: 20 },
  ];
  const colSum = cols.reduce((s, c) => s + c.w, 0);
  const scale = cw / colSum;
  const scaledCols = cols.map((c) => ({ ...c, w: c.w * scale }));
  const rowH = 7;
  const headerH = 8;
  const tableTop = 20;
  const availH = ph - m - tableTop - 10;
  const rowsPerPage = Math.floor(availH / rowH);
  let y = tableTop;

  const drawHeader = (yy: number) => {
    doc.setFillColor(41, 65, 117);
    doc.rect(m, yy, cw, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    let cx = m;
    for (const col of scaledCols) {
      doc.text(col.label, cx + col.w / 2, yy + headerH / 2 + 1.5, { align: "center" });
      cx += col.w;
    }
    doc.setTextColor(0, 0, 0);
  };

  drawHeader(y);
  y += headerH;

  for (let i = 0; i < assessments.length; i++) {
    const a = assessments[i];
    if (i > 0 && i % rowsPerPage === 0) {
      addFooter();
      doc.addPage();
      y = tableTop;
      drawHeader(y);
      y += headerH;
    }

    const isEven = i % 2 === 0;
    if (isEven) {
      doc.setFillColor(245, 247, 250);
      doc.rect(m, y, cw, rowH, "F");
    }

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    let cx = m;
    const vals = [
      String(i + 1),
      a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—",
      fmt(a.patientName),
      fmt(a.age),
      fmt(a.gender),
      a.bmi != null ? Number(a.bmi).toFixed(1) : "—",
      a.hba1cLevel != null ? `${Number(a.hba1cLevel).toFixed(1)}%` : "—",
      a.bloodGlucoseLevel != null ? Number(a.bloodGlucoseLevel).toFixed(1) : "—",
      a.riskScore != null ? `${Number(a.riskScore).toFixed(1)}%` : "—",
      fmt(a.riskCategory),
    ];

    for (let j = 0; j < scaledCols.length; j++) {
      doc.text(vals[j], cx + scaledCols[j].w / 2, y + rowH / 2 + 1.5, { align: "center" });
      cx += scaledCols[j].w;
    }
    y += rowH;
  }

  addFooter();

  // ── Individual Detail Pages ──
  for (const a of assessments) {
    doc.addPage();

    const labelVal = (label: string, val: string, yy: number) => {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.text(label, m, yy);
      doc.setFont("Helvetica", "normal");
      doc.text(val, m + 40, yy);
      return yy + 7;
    };

    let yy = m + 5;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text(fmt(a.patientName), m, yy);
    yy += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(m, yy, pw - m, yy);
    yy += 8;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Assessment Details", m, yy);
    yy += 8;

    yy = labelVal("Date:", a.createdAt ? new Date(a.createdAt).toLocaleString() : "—", yy);
    yy = labelVal("Gender:", fmt(a.gender), yy);
    yy = labelVal("Age:", fmt(a.age), yy);
    yy = labelVal("BMI:", a.bmi != null ? Number(a.bmi).toFixed(1) : "—", yy);
    yy = labelVal("HbA1c:", a.hba1cLevel != null ? `${Number(a.hba1cLevel).toFixed(1)}%` : "—", yy);
    yy = labelVal("Blood Glucose:", a.bloodGlucoseLevel != null ? Number(a.bloodGlucoseLevel).toFixed(1) : "—", yy);
    yy = labelVal("Hypertension:", a.hypertension ? "Yes" : a.hypertension === false ? "No" : "—", yy);
    yy = labelVal("Heart Disease:", a.heartDisease ? "Yes" : a.heartDisease === false ? "No" : "—", yy);
    yy = labelVal("Smoking:", fmt(a.smokingHistory), yy);
    yy = labelVal("Risk Score:", a.riskScore != null ? `${Number(a.riskScore).toFixed(1)}%` : "—", yy);
    yy = labelVal("Risk Category:", fmt(a.riskCategory), yy);
    if (a.modelConfidence != null) {
      yy = labelVal("Model Confidence:", `${Number(a.modelConfidence).toFixed(1)}%`, yy);
    }

    // Risk factors
    if (a.factors && a.factors.length > 0) {
      yy += 4;
      doc.line(m, yy, pw - m, yy);
      yy += 8;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Contributing Factors", m, yy);
      yy += 8;

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Factor", m + 2, yy);
      doc.text("Impact", m + 90, yy);
      doc.text("Description", m + 130, yy);
      yy += 5;
      doc.setDrawColor(200, 200, 200);
      doc.line(m, yy, pw - m, yy);
      yy += 3;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      for (const f of a.factors) {
        if (yy > ph - 20) {
          addFooter();
          doc.addPage();
          yy = m + 5;
        }
        const impactColor = f.impact === "positive" ? [34, 197, 94] : [239, 68, 68];
        doc.text(f.name, m + 2, yy);
        doc.setTextColor(impactColor[0], impactColor[1], impactColor[2]);
        doc.text(f.impact, m + 90, yy);
        doc.setTextColor(0, 0, 0);
        doc.text(f.description, m + 130, yy);
        yy += 6;
      }
    }

    addFooter();
  }

  doc.save("assessment-export.pdf");
}
