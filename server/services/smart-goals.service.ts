import { type Assessment, type InsertSmartGoal } from "@shared/schema";
import { addMonths, addWeeks } from "date-fns";

export function generateSmartGoals(assessment: Assessment): Partial<InsertSmartGoal>[] {
  const goals: Partial<InsertSmartGoal>[] = [];
  const now = new Date();

  // BMI Rule
  const bmi = typeof assessment.bmi === "number" ? assessment.bmi : Number(assessment.bmi || 0);
  if (bmi >= 25) {
    goals.push({
      description: "Weight Management: Reduce body weight by 5% through diet and exercise.",
      targetValue: "5% reduction",
      dueDate: addMonths(now, 3),
      reminderDate: addMonths(now, 1),
      patientExplanation: "Losing a small amount of weight can significantly lower your risk.",
    });
  }

  // HbA1c Rule
  const hba1c = typeof assessment.hba1cLevel === "number" ? assessment.hba1cLevel : Number(assessment.hba1cLevel || 0);
  if (hba1c >= 6.5) {
    goals.push({
      description: "Blood Sugar Control: Lower HbA1c levels below 6.5%.",
      targetValue: "< 6.5%",
      dueDate: addMonths(now, 3),
      reminderDate: addMonths(now, 1),
      patientExplanation: "Keeping your blood sugar in a healthy range protects your heart and nerves.",
    });
  } else if (hba1c >= 5.7) {
    goals.push({
      description: "Blood Sugar Monitoring: Prevent progression to diabetes.",
      targetValue: "< 5.7%",
      dueDate: addMonths(now, 6),
      reminderDate: addMonths(now, 3),
      patientExplanation: "You are in the prediabetes range. Diet and exercise can help return your sugar to normal.",
    });
  }

  // Blood Glucose Rule
  const glucose = typeof assessment.bloodGlucoseLevel === "number" ? assessment.bloodGlucoseLevel : Number(assessment.bloodGlucoseLevel || 0);
  if (glucose > 140) {
    goals.push({
      description: "Daily Blood Glucose Tracking",
      targetValue: "Fasting < 100 mg/dL",
      dueDate: addMonths(now, 1),
      reminderDate: addWeeks(now, 2),
      patientExplanation: "Track your blood sugar daily to understand how food and activity affect it.",
    });
  }

  // Smoking Rule
  const smoking = (assessment.smokingHistory || "").toString().toLowerCase();
  if (smoking === "current") {
    goals.push({
      description: "Smoking Cessation: Join a cessation program and quit smoking.",
      targetValue: "0 cigarettes/day",
      dueDate: addMonths(now, 2),
      reminderDate: addMonths(now, 1),
      patientExplanation: "Quitting smoking is one of the best things you can do for your health and diabetes risk.",
    });
  }

  // Hypertension Rule
  if (assessment.hypertension) {
    goals.push({
      description: "Blood Pressure Control: Maintain BP below 130/80 mmHg.",
      targetValue: "< 130/80 mmHg",
      dueDate: addMonths(now, 2),
      reminderDate: addMonths(now, 1),
      patientExplanation: "Controlling your blood pressure protects your kidneys and heart.",
    });
  }

  // If no high-risk rules match, provide a general goal
  if (goals.length === 0) {
    goals.push({
      description: "Maintain Healthy Lifestyle",
      targetValue: "150 mins exercise/week",
      dueDate: addMonths(now, 6),
      reminderDate: addMonths(now, 3),
      patientExplanation: "Keep up the good work with your healthy habits to prevent diabetes.",
    });
  }

  // Limit to 5 goals max
  return goals.slice(0, 5);
}
