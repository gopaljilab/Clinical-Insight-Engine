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

  // Safe parse factors if they come as string or object
  const factors = typeof assessment.factors === 'string' 
    ? JSON.parse(assessment.factors) 
    : assessment.factors;

  const chartData = factors.map((f: any) => ({
    name: f.name,
    value: f.impact === 'positive' ? 1 : -1, // Simplified impact for visualization
    impact: f.impact,
    description: f.description
  }));

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
                <h2 className="text-2xl font-bold text-foreground">Your Health Assessment</h2>
                <div className={`inline-flex flex-col items-center justify-center w-48 h-48 rounded-full border-8 shadow-inner ${getRiskColor(assessment.riskCategory)}`}>
                  <span className="text-sm font-bold uppercase tracking-widest opacity-80 mb-1">Risk Level</span>
                  <span className="text-4xl font-display font-black">{assessment.riskCategory}</span>
                </div>
                <p className="text-muted-foreground text-lg">
                  Based on your provided information, your cardiovascular risk over the next 10 years is considered <strong>{assessment.riskCategory.toLowerCase()}</strong>.
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
            </motion.div>
          ) : (
            <motion.div
              key="clinician"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-8"
            >
              {/* Clinician Top Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Predicted Risk Score</p>
                  <p className="text-3xl font-bold font-display flex items-baseline gap-1">
                    {Number(assessment.riskScore).toFixed(1)}<span className="text-xl text-muted-foreground">%</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    10-year probability
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
                  <div className="flex gap-4 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">BMI</p>
                      <p className="font-semibold">{assessment.bmi}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">HbA1c</p>
                      <p className="font-semibold">{assessment.hba1cLevel}%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clinician Chart */}
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> Factor Coefficient Impact
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <ReferenceLine x={0} stroke="#cbd5e1" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#64748b', fontSize: 12 }} />
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
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.impact === 'positive' ? '#ef4444' : '#22c55e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
