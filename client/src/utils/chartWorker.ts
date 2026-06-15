import { isValid } from "date-fns";

self.onmessage = (event: MessageEvent) => {
  const { assessments, patientGroups, isComparisonMode } = event.data;

  let chartData = [];

  try {
    if (isComparisonMode && patientGroups) {
      const merged: Record<string, any> = {};
      for (const group of patientGroups) {
        for (const a of group.assessments) {
          const dateObj = a.createdAt ? new Date(a.createdAt) : null;
          const dateKey = dateObj && isValid(dateObj) ? dateObj.toISOString() : `?${a.id}`;
          if (!merged[dateKey]) {
            merged[dateKey] = { date: dateKey };
          }
          merged[dateKey][`${group.patientName}_riskScore`] = Number(Number(a.riskScore).toFixed(1));
          merged[dateKey][`${group.patientName}_bmi`] = Number(Number(a.bmi).toFixed(1));
          merged[dateKey][`${group.patientName}_hba1cLevel`] = Number(Number(a.hba1cLevel).toFixed(1));
          merged[dateKey][`${group.patientName}_bloodGlucoseLevel`] = Number(Number(a.bloodGlucoseLevel).toFixed(1));
        }
      }
      chartData = Object.values(merged).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (assessments) {
      chartData = [...assessments]
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
        .map(a => {
          const dateObj = a.createdAt ? new Date(a.createdAt) : null;
          return {
            date: dateObj && isValid(dateObj) ? dateObj.toISOString() : "?",
            riskScore: Number(Number(a.riskScore).toFixed(1)),
            bmi: Number(Number(a.bmi).toFixed(1)),
            hba1cLevel: Number(Number(a.hba1cLevel).toFixed(1)),
            bloodGlucoseLevel: Number(Number(a.bloodGlucoseLevel).toFixed(1)),
            riskCategory: a.riskCategory,
          };
        });
    }
    
    // Processed data send back to main thread
    self.postMessage(chartData);
  } catch (error) {
    console.error("Web Worker Processing Error:", error);
    self.postMessage([]); // Fallback to empty array on fail
  }
};
