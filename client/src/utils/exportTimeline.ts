import { type Assessment } from "@shared/schema";
import { formatReadableDate } from "./dateFormat";

export function exportTimelineToCsv(assessments: Assessment[]) {
  if (!assessments || assessments.length === 0) return;

  const headers = [
    "Date",
    "Patient Name",
    "Age",
    "Gender",
    "Risk Category",
    "Risk Score",
    "BMI",
    "HbA1c Level (%)",
    "Blood Glucose (mg/dL)",
    "Hypertension",
    "Heart Disease",
    "Smoking History",
    "Clinical Notes"
  ];
  
  const rows = assessments.map(a => [
    formatReadableDate(a.createdAt),
    a.patientName,
    a.age,
    a.gender,
    a.riskCategory,
    a.riskScore,
    a.bmi,
    a.hba1cLevel,
    a.bloodGlucoseLevel,
    a.hypertension ? "Yes" : "No",
    a.heartDisease ? "Yes" : "No",
    a.smokingHistory,
    a.clinicalNote ? a.clinicalNote.replace(/"/g, '""') : ""
  ]);
  
  const csvContent = [headers, ...rows]
    .map(e => e.map(item => `"${String(item || '')}"`).join(","))
    .join("\n");
    
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  
  const patientName = assessments[0]?.patientName?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || "patient";
  link.setAttribute("download", `timeline-export-${patientName}.csv`);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
