import type { Assessment, AssessmentFactor } from "@shared/schema";

export type AttentionPriority = {
  factor: string;
  priority: "high" | "moderate" | "monitor";
  reason: string;
  value?: number;
};

export type AttentionNavigator = {
  priorities: AttentionPriority[];
};

type NavigatorInput = Partial<Assessment> & {
  riskCategory?: string;
  factors?: AssessmentFactor[];
};

function normalizeSmoking(smoking: unknown): "current" | "former" | "never" | "unknown" {
  const raw = String(smoking ?? "").toLowerCase();
  if (raw.includes("current")) return "current";
  if (raw.includes("former")) return "former";
  if (raw.includes("never")) return "never";
  return "unknown";
}

function buildPriority(factor: string, priority: "high" | "moderate" | "monitor", reason: string, value?: number): AttentionPriority {
  return { factor, priority, reason, value };
}

function admissionPriority(value: number | undefined, threshold: number, keyLabel: string): "high" | "moderate" | "monitor" {
  if (value == null || Number.isNaN(value)) return "monitor";
  if (value >= threshold * 1.25) return "high";
  if (value >= threshold) return "moderate";
  return "monitor";
}

/**
 * Prioritizes clinical risk factors based on urgency (high/moderate/monitor) to navigate clinician attention to critical areas.
 * @param input - The input parameter.
 * @returns The result of the operation.
 */
export function generateAttentionNavigator(input: NavigatorInput): AttentionNavigator {
  const priorities: AttentionPriority[] = [];
  const age = Number(input.age ?? NaN);
  const bmi = Number(input.bmi ?? NaN);
  const hba1c = Number(input.hba1cLevel ?? NaN);
  const glucose = Number(input.bloodGlucoseLevel ?? NaN);
  const hypertension = Boolean(input.hypertension);
  const heartDisease = Boolean(input.heartDisease);
  const smoking = normalizeSmoking(input.smokingHistory);
  const riskCategory = String(input.riskCategory ?? "LOW").toUpperCase();
  const factors = Array.isArray(input.factors) ? input.factors : [];

  if (riskCategory === "HIGH") {
    priorities.push(
      buildPriority(
        "Risk category",
        "high",
        "High risk category indicates a need for urgent clinician attention.",
      )
    );
  } else if (riskCategory === "MODERATE") {
    priorities.push(
      buildPriority(
        "Risk category",
        "moderate",
        "Moderate risk category suggests active monitoring and follow-up.",
      )
    );
  }

  if (!Number.isNaN(hba1c)) {
    const priority = hba1c >= 9 ? "high" : hba1c >= 7 ? "moderate" : "monitor";
    const reason =
      priority === "high"
        ? "HbA1c is above the diabetic threshold and is a major driver of future complications."
        : priority === "moderate"
        ? "HbA1c is elevated and contributes significantly to the patient's metabolic risk."
        : "HbA1c is within acceptable range but should continue to be monitored.";
    priorities.push(buildPriority("HbA1c", priority, reason, hba1c));
  }

  if (!Number.isNaN(glucose)) {
    const priority = glucose >= 200 ? "high" : glucose >= 140 ? "moderate" : "monitor";
    const reason =
      priority === "high"
        ? "Blood glucose is severely elevated and requires prompt clinical review."
        : priority === "moderate"
        ? "Blood glucose is above normal and may contribute to worsening glycemic control."
        : "Blood glucose is not currently at a high-risk threshold.";
    priorities.push(buildPriority("Blood Glucose", priority, reason, glucose));
  }

  if (!Number.isNaN(bmi)) {
    const priority = bmi >= 30 ? "moderate" : bmi >= 25 ? "monitor" : "monitor";
    const reason =
      priority === "moderate"
        ? "Elevated BMI indicates overweight or obesity, which predisposes to metabolic complications."
        : "BMI is within a lower risk range but should be interpreted with other clinical factors.";
    priorities.push(buildPriority("BMI", priority, reason, bmi));
  }

  if (hypertension) {
    priorities.push(
      buildPriority(
        "Hypertension",
        "moderate",
        "Existing hypertension increases cardiovascular and metabolic risk and should be managed collaboratively.",
      )
    );
  }

  if (heartDisease) {
    priorities.push(
      buildPriority(
        "Heart Disease",
        "high",
        "History of heart disease raises overall clinical priority due to cardiovascular comorbidity."
      )
    );
  }

  if (smoking === "current") {
    priorities.push(
      buildPriority(
        "Smoking History",
        "moderate",
        "Current smoking is a modifiable risk factor that worsens cardiometabolic prognosis."
      )
    );
  } else if (smoking === "former") {
    priorities.push(
      buildPriority(
        "Smoking History",
        "monitor",
        "Former smoking history remains relevant but is less urgent than active smoking."
      )
    );
  }

  if (factors.length > 0) {
    const sorted = [...factors].sort((a, b) => {
      const aScore = a.impact === "positive" ? 2 : 1;
      const bScore = b.impact === "positive" ? 2 : 1;
      return bScore - aScore;
    });

    for (const factor of sorted.slice(0, 3)) {
      const label = factor.name;
      const priority = factor.impact === "positive" ? "high" : "monitor";
      priorities.push(
        buildPriority(
          label,
          priority,
          `Factor contribution: ${factor.description || "significant influence on risk"}.`,
        )
      );
    }
  }

  const unique = new Map<string, AttentionPriority>();
  priorities.forEach((item) => {
    const key = item.factor.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, item);
    } else {
      const existing = unique.get(key)!;
      if (existing.priority !== "high" && item.priority === "high") {
        unique.set(key, item);
      }
    }
  });

  const sortedPriorities = Array.from(unique.values()).sort((a, b) => {
    const rank = { high: 0, moderate: 1, monitor: 2 } as const;
    const delta = rank[a.priority] - rank[b.priority];
    return delta || a.factor.localeCompare(b.factor);
  });

  return { priorities: sortedPriorities };
}

export default { generateAttentionNavigator };
