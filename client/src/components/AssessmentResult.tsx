import { useState } from "react";
import { type AssessmentResponse } from "@shared/routes";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { AlertCircle, CheckCircle2, Info, Activity, Stethoscope, UserCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AssessmentResultProps {
  assessment: AssessmentResponse;
}

export function AssessmentResult({ assessment }: AssessmentResultProps) {
  const [view, setView] = useState<"patient" | "clinician">("patient");

  const getRiskColor = (category: string) => {
    switch (category.toUpperCase()) {
      case "LOW": return "text-green-600 bg-green-50 border-green-200";
      case "MODERATE": return "text-amber-600 bg-amber-50 border-amber-200";
      case "HIGH": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-blue-600 bg-blue-50 border-blue-200";
    }
  };

  const getRiskColorHex = (category: string) => {
    switch (category.toUpperCase()) {
      case "LOW": return "#16a34a";
      case "MODERATE": return "#d97706";
      case "HIGH": return "#dc2626";
      default: return "#2563eb";
    }
  };

  const factors = (() => {
    if (Array.isArray(assessment.factors)) {
      return assessment.factors;
    }

    if (typeof assessment.factors === "string") {
      try {
        const parsed = JSON.parse(assessment.factors);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  })();

  const chartData = factors.map((f: any) => ({
    name: f.name,
    value: f.impact === 'positive' ? 1 : -1, // Simplified impact for visualization
    impact: f.impact,
    description: f.description
  }));

  const riskScore = Number(assessment.riskScore).toFixed(1);
  const positiveFactors = factors.filter((f: any) => f.impact === "positive");
  const protectiveFactors = factors.filter((f: any) => f.impact !== "positive");
  const patientGuidance = [
    "Review these results with a qualified clinician before making medical decisions.",
    "Focus first on the highlighted risk factors that can be changed through care planning.",
    "Track BMI, HbA1c, and blood glucose over time so future assessments have context.",
  ];
  const clinicianActions = [
    "Confirm risk category against the patient's full history and current medication profile.",
    "Use the factor breakdown to prioritize follow-up labs, counselling, or referrals.",
    "Compare this assessment with prior visits to identify meaningful trajectory changes.",
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/60 overflow-hidden flex flex-col"
    >
      {/* Header/Tabs */}
      <div className="flex border-b border-border/60 bg-muted/30">
        <button
          onClick={() => setView("patient")}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors ${
            view === "patient" 
              ? "text-primary border-b-2 border-primary bg-background" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <UserCircle className="w-4 h-4" />
          Patient View
        </button>
        <button
          onClick={() => setView("clinician")}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors ${
            view === "clinician" 
              ? "text-primary border-b-2 border-primary bg-background" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          Clinician View
        </button>
      </div>

      <div className="p-6 md:p-8">
        <AnimatePresence mode="wait">
          {view === "patient" ? (
            <motion.div
              key="patient"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-8"
            >
              {/* Patient Hero */}
              <div className="text-center space-y-4 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary">
                  <UserCircle className="h-4 w-4" />
                  Plain-language summary
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Your Health Assessment</h2>
                <div className={`inline-flex flex-col items-center justify-center w-36 h-36 sm:w-48 sm:h-48 rounded-full border-8 shadow-inner ${getRiskColor(assessment.riskCategory)}`}>
                  <span className="text-sm font-bold uppercase tracking-widest opacity-80 mb-1">Risk Level</span>
                  <span className="text-3xl sm:text-4xl font-display font-black">{assessment.riskCategory}</span>
                </div>
                <p className="text-muted-foreground text-lg">
                  Based on your provided information, your preventive diabetes risk is considered <strong>{assessment.riskCategory.toLowerCase()}</strong>.
                </p>
              </div>

              {/* Patient Key Insights */}
              <div className="bg-secondary/50 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" /> What this means for you
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {factors.map((factor: any, i: number) => (
                    <div key={i} className="flex gap-3 bg-card p-4 rounded-lg shadow-sm border border-border/50">
                      {factor.impact === 'positive' ? (
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold text-foreground">{factor.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">{factor.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {patientGuidance.map((item, index) => (
                  <div key={item} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="clinician"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-8"
            >
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">Clinician decision support</p>
                    <h2 className="mt-1 text-2xl font-bold text-foreground">Detailed risk interpretation</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      This view keeps the quantitative score, model confidence, contributing factors, and follow-up actions together for clinical review.
                    </p>
                  </div>
                  <div className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-bold ${getRiskColor(assessment.riskCategory)}`}>
                    {assessment.riskCategory} risk
                  </div>
                </div>
              </div>

              {/* Clinician Top Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Predicted Risk Score</p>
                  <p className="text-3xl font-bold font-display flex items-baseline gap-1">
                    {riskScore}<span className="text-xl text-muted-foreground">%</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Model probability
                    {assessment.confidenceInterval && (
                      <span className="block text-[10px] mt-0.5 opacity-80">
                        (95% CI: {assessment.confidenceInterval})
                      </span>
                    )}
                  </p>
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Risk Category</p>
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-bold mt-1 ${getRiskColor(assessment.riskCategory)}`}>
                    {assessment.riskCategory}
                  </div>
                  {assessment.modelConfidence && (
                    <p className="text-[10px] text-muted-foreground mt-2 italic">
                      Model confidence: {Number(assessment.modelConfidence).toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Patient Vitals summary</p>
                  <div className="flex flex-col sm:flex-row gap-4 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">BMI</p>
                      <p className="font-semibold">{assessment.bmi}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">HbA1c</p>
                      <p className="font-semibold">{assessment.hba1cLevel}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Glucose</p>
                      <p className="font-semibold">{assessment.bloodGlucoseLevel}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 font-bold">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    Risk-driving factors
                  </h3>
                  <div className="space-y-3">
                    {positiveFactors.length > 0 ? positiveFactors.map((factor: any) => (
                      <div key={factor.name} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                        <p className="font-semibold">{factor.name}</p>
                        <p className="mt-1 text-amber-900/80">{factor.description}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No risk-driving factors were highlighted by the model.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 font-bold">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Protective or lower-risk signals
                  </h3>
                  <div className="space-y-3">
                    {protectiveFactors.length > 0 ? protectiveFactors.map((factor: any) => (
                      <div key={factor.name} className="rounded-lg bg-green-50 p-3 text-sm text-green-950">
                        <p className="font-semibold">{factor.name}</p>
                        <p className="mt-1 text-green-900/80">{factor.description}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No lower-risk signals were highlighted by the model.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Clinician Chart */}
              <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm overflow-hidden">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> Factor Coefficient Impact
                </h3>
                <div className="h-56 sm:h-64 w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <ReferenceLine x={0} stroke="#cbd5e1" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-popover text-popover-foreground border border-border p-3 rounded-lg shadow-xl text-sm max-w-xs">
                                <p className="font-bold mb-1">{data.name}</p>
                                <p className="text-muted-foreground">{data.description}</p>
                                <p className={`mt-2 font-semibold ${data.impact === 'positive' ? 'text-red-500' : 'text-green-500'}`}>
                                  Impact: {data.impact === 'positive' ? 'Increases Risk' : 'Decreases Risk'}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.impact === 'positive' ? '#ef4444' : '#22c55e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-5">
                <h3 className="mb-4 font-bold">Suggested clinical follow-up</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {clinicianActions.map((action) => (
                    <div key={action} className="rounded-lg border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}