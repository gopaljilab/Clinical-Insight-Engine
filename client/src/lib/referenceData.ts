export const referenceData = {
  hba1c: {
    title: "HbA1c",
    ranges: [
      "Normal: < 5.7%",
      "Prediabetes: 5.7% - 6.4%",
      "Diabetes: ≥ 6.5%",
      "Note: Individual targets may differ based on age, comorbidities, and treatment goals.",
    ],
  },
  bloodGlucose: {
    title: "Blood Glucose",
    ranges: [
      "Normal fasting: 70 - 99 mg/dL",
      "Prediabetes fasting: 100 - 125 mg/dL",
      "Diabetes fasting: ≥ 126 mg/dL",
      "Note: Post-meal values and personal targets may vary by clinical recommendation.",
    ],
  },
  bmi: {
    title: "Body Mass Index (BMI)",
    ranges: [
      "Underweight: < 18.5",
      "Healthy weight: 18.5 - 24.9",
      "Overweight: 25.0 - 29.9",
      "Obesity: ≥ 30.0",
      "Note: BMI is a screening tool and should be interpreted with overall clinical context.",
    ],
  },
} as const;

export type ClinicalMetricKey = keyof typeof referenceData;
