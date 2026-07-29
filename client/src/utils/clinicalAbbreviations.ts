const ABBREVIATIONS: Record<string, string> = {
  BP: "Blood Pressure",
  HR: "Heart Rate",
  COPD: "Chronic Obstructive Pulmonary Disease",
  CHF: "Congestive Heart Failure",
  ECG: "Electrocardiogram",
};

export function expandClinicalAbbreviations(text: string): string {
  return Object.entries(ABBREVIATIONS).reduce((result, [abbr, full]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, "g");
    return result.replace(regex, `${abbr} (${full})`);
  }, text);
}