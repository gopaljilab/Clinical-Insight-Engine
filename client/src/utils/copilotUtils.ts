import type { AssessmentResponse } from "@shared/routes";

export interface CopilotSuggestion {
  id: string;
  category: "diagnostic_test" | "monitoring" | "lifestyle" | "referral" | "follow_up";
  title: string;
  description: string;
  rationale: string;
  urgency: "high" | "medium" | "low";
  evidence: string;
}

export function generateCopilotSuggestions(assessment: AssessmentResponse): CopilotSuggestion[] {
  const suggestions: CopilotSuggestion[] = [];
  const rc = (assessment.riskCategory || "").toUpperCase();
  const bmi = Number(assessment.bmi) || 0;
  const hba1c = Number(assessment.hba1cLevel) || 0;
  const glucose = Number(assessment.bloodGlucoseLevel) || 0;
  const smoking = (assessment.smokingHistory || "").toLowerCase();
  const hasHypertension = assessment.hypertension;
  const hasHeartDisease = assessment.heartDisease;
  const isHighRisk = rc === "HIGH";
  const isModerate = rc === "MODERATE";

  if (isHighRisk || hba1c >= 6.5 || glucose >= 126) {
    suggestions.push({
      id: "ogtt",
      category: "diagnostic_test",
      title: "Oral Glucose Tolerance Test (OGTT)",
      description: "Confirm diabetes diagnosis with a 2-hour 75g OGTT if not already performed.",
      rationale: `HbA1c of ${hba1c}% and glucose of ${glucose} mg/dL suggest impaired glucose regulation requiring confirmatory testing.`,
      urgency: "high",
      evidence: "ADA Standards of Care 2025 recommend OGTT for diabetes confirmation when HbA1c is discordant with fasting glucose."
    });
  }

  if (isHighRisk || hasHypertension || hasHeartDisease) {
    suggestions.push({
      id: "lipid_panel",
      category: "diagnostic_test",
      title: "Comprehensive Lipid Panel",
      description: "Order fasting lipid panel (TC, LDL-C, HDL-C, TGs) to assess cardiovascular risk profile.",
      rationale: `${isHighRisk ? "High-risk classification" : "Cardiovascular comorbidity"} warrants full lipid assessment for ASCVD risk calculation.`,
      urgency: "high",
      evidence: "ACC/AHA guidelines recommend lipid panel in all patients with elevated cardiovascular risk."
    });
  }

  if (bmi >= 30 || (bmi >= 25 && isHighRisk)) {
    suggestions.push({
      id: "liver_function",
      category: "diagnostic_test",
      title: "Liver Function Tests (LFTs)",
      description: "Screen for non-alcoholic fatty liver disease (NAFLD) with ALT, AST, GGT.",
      rationale: `BMI of ${bmi} places the patient at risk for NAFLD, which is commonly associated with metabolic syndrome.`,
      urgency: "medium",
      evidence: "AASLD guidelines recommend NAFLD screening in patients with obesity and metabolic risk factors."
    });
  }

  if (isHighRisk) {
    suggestions.push({
      id: "monitor_hba1c_3mo",
      category: "monitoring",
      title: "HbA1c Monitoring Every 3 Months",
      description: "Repeat HbA1c every 3 months until stable below 7.0%, then every 6 months.",
      rationale: "High-risk patients require frequent glycemic monitoring to assess treatment response and prevent complications.",
      urgency: "high",
      evidence: "ADA recommends HbA1c testing at least twice yearly in stable patients, quarterly in uncontrolled diabetes."
    });
  }

  if (hasHypertension) {
    suggestions.push({
      id: "bp_monitoring",
      category: "monitoring",
      title: "Home Blood Pressure Monitoring",
      description: "Daily home BP monitoring with a validated device; log readings for review at next visit.",
      rationale: "Hypertension requires active monitoring to guide medication titration and assess control.",
      urgency: "medium",
      evidence: "ACC/AHA guideline recommends home BP monitoring for all patients with diagnosed hypertension."
    });
  }

  if (bmi >= 25) {
    suggestions.push({
      id: "weight_program",
      category: "lifestyle",
      title: "Structured Weight Management Program",
      description: `Target ${bmi >= 30 ? "5-10% body weight reduction" : "weight maintenance with improved metabolic fitness"} through a comprehensive program of diet and physical activity.`,
      rationale: `BMI of ${bmi} falls in the ${bmi >= 30 ? "obese" : "overweight"} range, a primary modifiable risk factor for diabetes and cardiovascular disease.`,
      urgency: bmi >= 30 ? "high" : "medium",
      evidence: "Look AHEAD trial and multiple meta-analyses show that 5-7% weight loss reduces diabetes incidence by 58%."
    });
  }

  if (smoking === "current") {
    suggestions.push({
      id: "smoking_cessation",
      category: "lifestyle",
      title: "Intensive Smoking Cessation Program",
      description: "Combine pharmacotherapy (nicotine replacement, varenicline) with behavioral counseling.",
      rationale: "Current smoking significantly compounds cardiovascular and diabetic microvascular risk.",
      urgency: "high",
      evidence: "USPSTF recommends offering pharmacotherapy and behavioral interventions for all tobacco users."
    });
  }

  if (bmi >= 25 || isModerate || isHighRisk) {
    suggestions.push({
      id: "diet_referral",
      category: "lifestyle",
      title: "Medical Nutrition Therapy (MNT)",
      description: "Refer to registered dietitian for individualized medical nutrition therapy focused on glycemic control and cardiometabolic health.",
      rationale: "Dietary modification is a cornerstone of diabetes prevention and management.",
      urgency: isHighRisk ? "high" : "medium",
      evidence: "ADA recommends MNT provided by a registered dietitian as an essential component of diabetes management."
    });
  }

  if (isHighRisk || (isModerate && (hasHeartDisease || hasHypertension))) {
    suggestions.push({
      id: "cardiology_referral",
      category: "referral",
      title: "Cardiology Consultation",
      description: "Refer to cardiology for comprehensive cardiovascular risk assessment and management.",
      rationale: `${isHighRisk ? "High diabetes risk" : "Moderate risk with cardiac comorbidity"} necessitates specialist evaluation.`,
      urgency: isHighRisk ? "high" : "medium",
      evidence: "ACC/AHA guidelines recommend cardiology referral for patients with elevated cardiovascular risk and multiple risk factors."
    });
  }

  if (hasHeartDisease && isModerate) {
    suggestions.push({
      id: "endocrinology_referral",
      category: "referral",
      title: "Endocrinology Consultation",
      description: "Refer to endocrinology for specialized metabolic risk management.",
      rationale: "Coexisting heart disease and metabolic risk warrant specialized endocrine evaluation.",
      urgency: "medium",
      evidence: "AACE guidelines recommend endocrinology referral for complex metabolic cases."
    });
  }

  if (isModerate || isHighRisk) {
    suggestions.push({
      id: "follow_up_1mo",
      category: "follow_up",
      title: `Follow-Up Visit Within ${isHighRisk ? "2 Weeks" : "1 Month"}`,
      description: `Schedule follow-up within ${isHighRisk ? "2 weeks" : "1 month"} to review lab results, assess treatment response, and adjust care plan.`,
      rationale: "Timely follow-up ensures treatment adherence and allows early intervention for worsening trends.",
      urgency: isHighRisk ? "high" : "medium",
      evidence: "Clinical practice guidelines recommend short-interval follow-up for patients with elevated cardiometabolic risk."
    });
  }

  return suggestions;
}
