import { TFunction } from "i18next";

export const patientAdviceMapping: Record<string, string> = {
  "Keep up the good work! Continue your healthy lifestyle and routine checkups.": "patientAdviceText.lowRisk",
  "Consider increasing physical activity and managing your diet to lower your risk.": "patientAdviceText.moderateRisk",
  "Please consult your doctor soon to discuss a detailed prevention plan.": "patientAdviceText.highRisk",
  "Focus on managing your blood sugar through diet and prescribed medications.": "patientAdviceText.hba1c",
  "Monitor your daily glucose readings closely and follow your meal plan.": "patientAdviceText.glucose",
  "Work on achieving a healthier weight through balanced nutrition and regular exercise.": "patientAdviceText.bmi",
  "Regularly check your blood pressure and reduce salt intake.": "patientAdviceText.hypertension",
  "Quitting smoking is one of the most effective ways to reduce your diabetes risk.": "patientAdviceText.smoking",
  "Manage your heart health as it is closely linked to diabetes risk.": "patientAdviceText.heartDisease",
  "As you get older, it's more important to stay active and monitor your health.": "patientAdviceText.age",

  "Please schedule an appointment with your clinician to check diagnostic lab ranges.": "patientAdviceText.fallbackHigh",
  "Making positive dietary changes and staying active helps lower type 2 diabetes risk.": "patientAdviceText.fallbackModerate",
  "Continue maintaining a healthy, balanced lifestyle and regular physical activity.": "patientAdviceText.fallbackLow",

  "Review these results with a qualified clinician before making medical decisions.": "patientAdviceText.default1",
  "Focus first on the highlighted risk factors that can be changed through care planning.": "patientAdviceText.default2",
  "Track BMI, HbA1c, and blood glucose over time so future assessments have context.": "patientAdviceText.default3"
};

export const translatePatientAdvice = (adviceList: string[], t: TFunction): string[] => {
  return adviceList.map(advice => {
    const key = patientAdviceMapping[advice];
    if (key) {
      return t(key);
    }
    // Fallback: If it's a dynamic string we don't know, we return the original string
    return advice;
  });
};
