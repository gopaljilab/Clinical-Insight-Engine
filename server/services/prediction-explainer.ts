import { type Assessment, type AssessmentFactor } from "@shared/schema";
import type { PredictionExplanation } from "@shared/routes";

type ExplainerInput = Partial<Assessment> & {
  riskCategory?: string;
  factors?: AssessmentFactor[];
};

const factorStrengthMap: Record<string, number> = {
  "diabetic hba1c range": 100,
  "prediabetic hba1c": 80,
  "hyperglycemia": 95,
  "elevated fasting glucose": 75,
  "obese (bmi >= 30)": 90,
  "overweight (bmi 25-30)": 65,
  "hypertension": 60,
  "heart disease": 60,
  "age > 60": 55,
  "age > 45": 40,
  "smoking current": 70,
  "smoking": 70,
  "current smoker": 70,
  "stable profile": 20,
};

function normalizeFactors(factors?: AssessmentFactor[]): AssessmentFactor[] {
  if (!Array.isArray(factors)) return [];
  return factors;
}

function getFactorWeight(factor: AssessmentFactor, index: number): number {
  const key = factor.name.toLowerCase();
  const base = factorStrengthMap[key] ?? (factor.impact === "positive" ? 50 : 40);
  const positionBonus = Math.max(0, 20 - index * 5);
  return Math.min(100, base + positionBonus);
}

function getFactorWhy(factor: AssessmentFactor, input: ExplainerInput): string {
  const name = factor.name.toLowerCase();
  const reason = factor.description;

  if (name.includes("hba1c")) {
    const value = input.hba1cLevel;
    return value != null
      ? `HbA1c is ${value.toFixed(1)}%, so ${reason.toLowerCase()}`
      : reason;
  }

  if (name.includes("bmi")) {
    const value = input.bmi;
    return value != null
      ? `BMI is ${value.toFixed(1)}, indicating ${reason.toLowerCase()}`
      : reason;
  }

  if (name.includes("glucose")) {
    const value = input.bloodGlucoseLevel;
    return value != null
      ? `Blood glucose is ${value.toFixed(0)} mg/dL, which means ${reason.toLowerCase()}`
      : reason;
  }

  if (name.includes("hypertension") || name.includes("heart disease") || name.includes("smoking")) {
    const inputValue =
      name.includes("hypertension") && input.hypertension
        ? "yes"
        : name.includes("heart disease") && input.heartDisease
        ? "yes"
        : name.includes("smoking") && input.smokingHistory
        ? String(input.smokingHistory)
        : undefined;
    return inputValue
      ? `${reason} Current input: ${inputValue}.`
      : reason;
  }

  return reason;
}

function formatFactorLabel(name: string): string {
  if (name.toLowerCase().includes("hba1c")) return "HbA1c";
  if (name.toLowerCase().includes("bmi")) return "BMI";
  if (name.toLowerCase().includes("glucose")) return "Blood glucose";
  if (name.toLowerCase().includes("hypertension")) return "Hypertension";
  if (name.toLowerCase().includes("heart disease")) return "Heart disease";
  if (name.toLowerCase().includes("smoking")) return "Smoking history";
  if (name.toLowerCase().includes("age")) return "Age";
  return name;
}

function summarizeContributorNames(contributors: Array<PredictionExplanation["topContributors"][number]>): string {
  if (contributors.length === 0) return "no strong contributors";
  if (contributors.length === 1) return contributors[0].name;

  const names = contributors.map((item) => item.name);
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function generatePredictionExplanation(input: ExplainerInput): PredictionExplanation {
  const factors = normalizeFactors(input.factors);
  const weightedFactors = factors.map((factor, index) => ({
    ...factor,
    strength: getFactorWeight(factor, index),
    why: getFactorWhy(factor, input),
  }));

  const sortedByStrength = [...weightedFactors].sort((a, b) => b.strength - a.strength);
  const positiveContributors = sortedByStrength.filter((factor) => factor.impact === "positive");
  const negativeContributors = sortedByStrength.filter((factor) => factor.impact !== "positive");

  const topContributors = sortedByStrength.slice(0, 4);
  const strongestPositive = positiveContributors.slice(0, 3);
  const strongestNegative = negativeContributors.slice(0, 3);

  const riskCategory = (input.riskCategory || "LOW").toUpperCase();
  const riskLabel = riskCategory === "HIGH" ? "high" : riskCategory === "MODERATE" ? "moderate" : "low";

  const positiveNames = summarizeContributorNames(strongestPositive);
  const negativeNames = summarizeContributorNames(strongestNegative);

  const summary = `The model assigns a ${riskLabel} preventive diabetes risk category. The strongest drivers were ${positiveNames}.${negativeNames ? ` Protective or lower-risk contributors included ${negativeNames}.` : ""}`;

  const patientSummary = `Your assessment shows ${riskLabel} diabetes risk. It is mostly influenced by ${positiveNames.toLowerCase()}. ${negativeNames ? `Supportive factors included ${negativeNames.toLowerCase()}, which slightly reduce the overall risk.` : ""}`;

  const clinicianSummary = `This prediction uses clinical inputs and factor contributions to produce a ${riskLabel} risk classification. Key positive contributors are ${positiveNames.toLowerCase()}.${negativeNames ? ` Key protective signals are ${negativeNames.toLowerCase()}.` : ""} Review the contributor details and relevant vital signs to guide follow-up.`;

  return {
    summary,
    patientSummary,
    clinicianSummary,
    topContributors,
    strongestPositive,
    strongestNegative,
  };
}

export default { generatePredictionExplanation };
import type { Assessment, AssessmentFactor } from "@shared/schema";
import type { ExplanationContributor, PredictionExplanation } from "@shared/routes";

type PredictionInput = Partial<Assessment> & {
  riskCategory?: string;
  factors?: AssessmentFactor[];
};

const factorWeightMap: Record<string, number> = {
  "diabetic hba1c range": 100,
  "prediabetic hba1c": 80,
  "hyperglycemia": 95,
  "elevated fasting glucose": 70,
  "obese (bmi >= 30)": 85,
  "overweight (bmi 25-30)": 60,
  "hypertension": 55,
  "heart disease": 55,
  "age > 60": 50,
  "age > 45": 35,
  "smoking history": 65,
  "current smoker": 65,
  "stable profile": 10,
};

const fieldLabels: Record<string, string> = {
  hba1clevel: "HbA1c",
  bmi: "BMI",
  bloodglucoselevel: "Blood Glucose",
  hypertension: "Hypertension",
  heartdisease: "Heart Disease",
  smokinghistory: "Smoking History",
  age: "Age",
};

function normalizeFactorName(name: string): string {
  return name.trim().toLowerCase();
}

function getFactorStrength(factor: AssessmentFactor, index: number): number {
  const normalized = normalizeFactorName(factor.name);
  const base = factorWeightMap[normalized] ?? (factor.impact === "positive" ? 50 : 35);
  const orderingBonus = Math.max(0, 20 - index * 4);
  return Math.min(100, Math.max(10, base + orderingBonus));
}

function getFieldObservation(input: PredictionInput): string[] {
  const notes: string[] = [];
  const age = Number(input.age ?? 0);
  const bmi = Number(input.bmi ?? 0);
  const hba1c = Number(input.hba1cLevel ?? 0);
  const glucose = Number(input.bloodGlucoseLevel ?? 0);
  const smoking = String(input.smokingHistory ?? "").toLowerCase();

  if (age >= 65) {
    notes.push(`Age ${age} places this patient in an older demographic with increased baseline diabetes risk.`);
  } else if (age >= 45) {
    notes.push(`Age ${age} is above the midlife threshold where metabolic risk begins to climb.`);
  }

  if (bmi >= 30) {
    notes.push(`BMI ${bmi.toFixed(1)} is in the obese range, which is strongly associated with insulin resistance.`);
  } else if (bmi >= 25) {
    notes.push(`BMI ${bmi.toFixed(1)} is elevated and contributes to cardiometabolic strain.`);
  }

  if (hba1c >= 6.5) {
    notes.push(`HbA1c ${hba1c.toFixed(1)}% is in the diabetic range, making it a primary risk driver.`);
  } else if (hba1c >= 5.7) {
    notes.push(`HbA1c ${hba1c.toFixed(1)}% indicates prediabetes and increases future diabetes probability.`);
  }

  if (glucose >= 126) {
    notes.push(`Fasting blood glucose ${glucose.toFixed(0)} mg/dL confirms metabolic dysregulation.`);
  } else if (glucose >= 100) {
    notes.push(`Fasting blood glucose ${glucose.toFixed(0)} mg/dL is elevated and supports the risk assessment.`);
  }

  if (input.hypertension) {
    notes.push("Hypertension is present and is a recognized comorbidity that raises diabetes risk.");
  }

  if (input.heartDisease) {
    notes.push("A history of heart disease increases the overall cardiovascular and metabolic risk profile.");
  }

  if (smoking === "current") {
    notes.push("Current smoking status contributes additional inflammation and vascular risk.");
  } else if (smoking === "former") {
    notes.push("Former smoking history can still affect long-term metabolic and cardiovascular risk.");
  }

  return notes;
}

function formatContributorLabel(name: string): string {
  const normalized = normalizeFactorName(name);
  return fieldLabels[normalized] ?? name;
}

function buildContributor(factor: AssessmentFactor, index: number): ExplanationContributor {
  const strength = getFactorStrength(factor, index);
  const label = formatContributorLabel(factor.name);
  const why = factor.description ||
    (factor.impact === "positive"
      ? `${label} is contributing to higher diabetes risk.`
      : `${label} is contributing to lower diabetes risk.`);

  return {
    name: label,
    impact: factor.impact,
    strength,
    description: factor.description,
    why,
  };
}

export function generatePredictionExplanation(input: PredictionInput): PredictionExplanation {
  const riskCategory = (input.riskCategory ?? "LOW").toUpperCase();
  const factors = Array.isArray(input.factors) ? input.factors : [];
  const contributorList = factors.map(buildContributor);

  const sortedByStrength = [...contributorList].sort((a, b) => b.strength - a.strength);
  const strongestPositive = sortedByStrength.filter((item) => item.impact === "positive").slice(0, 3);
  const strongestNegative = sortedByStrength.filter((item) => item.impact !== "positive").slice(0, 3);
  const topContributors = sortedByStrength.slice(0, 4);

  const fieldNotes = getFieldObservation(input);
  const riskPhrase =
    riskCategory === "HIGH"
      ? "high likelihood of future type 2 diabetes"
      : riskCategory === "MODERATE"
      ? "moderate likelihood of developing type 2 diabetes"
      : "lower likelihood of developing type 2 diabetes";

  const summary = `The model classified this assessment as ${riskCategory} risk, driven by ${
    strongestPositive.length > 0
      ? strongestPositive.map((item) => item.name).join(", ")
      : "a stable clinical profile"
  }${strongestNegative.length > 0 ? ` and partially offset by ${strongestNegative.map((item) => item.name).join(", ")}` : ""}.`;

  const patientSummary = `Based on your current health values, the assessment shows ${riskPhrase}. ${
    fieldNotes.length > 0 ? fieldNotes.join(" ") : "The current risk factors and protective signals have been combined to generate this result."
  }`;

  const clinicianSummary = `A ${riskCategory} risk assessment was generated using the current clinical inputs. ${
    sortedByStrength.length > 0
      ? `Top contributors include ${topContributors.map((item) => `${item.name} (${item.impact === "positive" ? "raises" : "reduces"} risk)`).join(", ")}.` 
      : "No strong contributors were identified from the submitted inputs."
  } ${fieldNotes.length > 0 ? fieldNotes.join(" ") : "Review the input values for additional context."}`;

  return {
    summary,
    patientSummary,
    clinicianSummary,
    topContributors,
    strongestPositive,
    strongestNegative,
  };
}

export default { generatePredictionExplanation };