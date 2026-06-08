import { type Assessment } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";
import type { Recommendation } from "@shared/routes";

type Rule = (assessment: Partial<Assessment> & { riskCategory?: string }) => Recommendation[];

const rules: Rule[] = [
  (a) => {
    const recs: Recommendation[] = [];
    const bmi = typeof a.bmi === "number" ? a.bmi : Number(a.bmi || 0);
    if (bmi >= 30) {
      recs.push({
        id: uuidv4(),
        title: "Weight reduction target",
        description: "Recommend a structured weight reduction goal of 5–10% body weight with diet and exercise support.",
        urgency: "medium",
        audience: "both",
        checklist: true,
      });
      recs.push({
        id: uuidv4(),
        title: "Increase physical activity",
        description: "Encourage at least 150 minutes/week of moderate-intensity aerobic activity, plus strength training.",
        urgency: "low",
        audience: "both",
        checklist: true,
      });
    } else if (bmi >= 25) {
      recs.push({
        id: uuidv4(),
        title: "Weight management",
        description: "Discuss modest weight loss (around 5%) and lifestyle modification to reduce cardiometabolic risk.",
        urgency: "low",
        audience: "both",
        checklist: true,
      });
    }
    return recs;
  },
  (a) => {
    const recs: Recommendation[] = [];
    const hba1c = typeof a.hba1cLevel === "number" ? a.hba1cLevel : Number(a.hba1cLevel || 0);
    if (hba1c >= 7) {
      recs.push({
        id: uuidv4(),
        title: "Repeat HbA1c testing",
        description: "Repeat HbA1c testing in ~3 months to assess response to lifestyle or medication changes.",
        urgency: "medium",
        audience: "both",
        checklist: true,
      });
      recs.push({
        id: uuidv4(),
        title: "Consider medication review",
        description: "Review current medications and consider adjustments to improve glycemic control.",
        urgency: "high",
        audience: "clinician",
        checklist: false,
      });
    }
    return recs;
  },
  (a) => {
    const recs: Recommendation[] = [];
    const glucose = typeof a.bloodGlucoseLevel === "number" ? a.bloodGlucoseLevel : Number(a.bloodGlucoseLevel || 0);
    if (glucose > 200) {
      recs.push({
        id: uuidv4(),
        title: "Urgent glycemic review",
        description: "Blood glucose >200 mg/dL — consider urgent review and possible medication adjustment.",
        urgency: "high",
        audience: "clinician",
        checklist: false,
      });
    }
    return recs;
  },
  (a) => {
    const recs: Recommendation[] = [];
    const smoking = (a.smokingHistory || "").toString().toLowerCase();
    if (smoking === "current") {
      recs.push({
        id: uuidv4(),
        title: "Smoking cessation counseling",
        description: "Offer smoking cessation counseling and pharmacotherapy where appropriate.",
        urgency: "high",
        audience: "both",
        checklist: true,
      });
    }
    return recs;
  },
  (a) => {
    const recs: Recommendation[] = [];
    if (a.hypertension) {
      recs.push({
        id: uuidv4(),
        title: "Monitor blood pressure",
        description: "Recommend regular blood pressure monitoring and consider home BP logs for management.",
        urgency: "medium",
        audience: "both",
        checklist: true,
      });
    }
    return recs;
  },
  (a) => {
    const recs: Recommendation[] = [];
    if (a.heartDisease) {
      recs.push({
        id: uuidv4(),
        title: "Cardiology follow-up",
        description: "Consider cardiology review and optimization of secondary prevention strategies.",
        urgency: "high",
        audience: "clinician",
        checklist: false,
      });
    }
    return recs;
  },
  (a) => {
    const recs: Recommendation[] = [];
    const age = typeof a.age === "number" ? a.age : Number(a.age || 0);
    if (age >= 65) {
      recs.push({
        id: uuidv4(),
        title: "Age-appropriate preventive checks",
        description: "Assess fall risk, ensure immunizations are up to date, and consider geriatric-specific risks.",
        urgency: "low",
        audience: "both",
        checklist: false,
      });
    }
    return recs;
  },
  (a) => {
    const recs: Recommendation[] = [];
    const rc = (a.riskCategory || "").toString().toUpperCase();
    if (rc === "HIGH") {
      recs.push({
        id: uuidv4(),
        title: "Intensive risk management",
        description: "High-risk classification: consider close follow-up, multifactorial interventions, and specialist referrals as needed.",
        urgency: "high",
        audience: "clinician",
        checklist: false,
      });
    }
    return recs;
  },
];

export function generateRecommendations(input: Partial<Assessment> & { riskCategory?: string }): Recommendation[] {
  const seen = new Set<string>();
  const out: Recommendation[] = [];
  for (const r of rules) {
    const recs = r(input);
    for (const rec of recs) {
      const key = `${rec.title}:${rec.description}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(rec);
      }
    }
  }
  return out;
}

export default { generateRecommendations };
