import { AppLayout } from "@/components/layout/AppLayout";
import { useAssessments } from "@/hooks/use-assessments";
import { format } from "date-fns";
import { Loader2, Search, Calendar, User, Activity } from "lucide-react";
import { useState } from "react";

export default function History() {
  const { data: assessments, isLoading, error } = useAssessments();
  const [searchTerm, setSearchTerm] = useState("");

  const getRiskBadge = (category: string) => {
    switch (category?.toUpperCase()) {
      case "LOW": return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold tracking-wide">LOW</span>;
      case "MODERATE": return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold tracking-wide">MODERATE</span>;
      case "HIGH": return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold tracking-wide">HIGH</span>;
      default: return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold tracking-wide">{category}</span>;
    }
  };

  const filteredAssessments = assessments?.filter(a => 
    a.gender.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.riskCategory.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black font-display text-foreground tracking-tight">
              Patient History
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Review past preventive risk assessments.
            </p>
          </div>

          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search history..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all w-full md:w-64"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p>Loading assessment history...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-center">
            Failed to load history. Please try again later.
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 text-muted-foreground">
              <Activity className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No Assessments Found</h3>
            <p className="text-muted-foreground max-w-md">
              There are no patient assessments matching your criteria. Go to the dashboard to create a new assessment.
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Patient Profile</th>
                    <th className="p-4 font-semibold">Vitals</th>
                    <th className="p-4 font-semibold">Risk Score</th>
                    <th className="p-4 font-semibold">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAssessments.map((assessment) => (
                    <tr key={assessment.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 align-top">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {assessment.createdAt ? format(new Date(assessment.createdAt), 'MMM d, yyyy') : 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground ml-6 mt-0.5">
                          {assessment.createdAt ? format(new Date(assessment.createdAt), 'h:mm a') : ''}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold">{assessment.age}y {assessment.gender}</span>
                        </div>
                        <div className="text-xs text-muted-foreground ml-6 mt-1 flex flex-wrap gap-x-2 gap-y-1">
                          {assessment.hypertension && <span className="bg-secondary px-1.5 py-0.5 rounded">Hypertension</span>}
                          {assessment.heartDisease && <span className="bg-secondary px-1.5 py-0.5 rounded">Heart Disease</span>}
                          <span className="bg-secondary px-1.5 py-0.5 rounded">{assessment.smokingHistory}</span>
                        </div>
                      </td>
                      <td className="p-4 align-top text-sm">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span className="text-muted-foreground">BMI:</span> <span className="font-semibold">{assessment.bmi}</span>
                          <span className="text-muted-foreground">HbA1c:</span> <span className="font-semibold">{assessment.hba1cLevel}%</span>
                          <span className="text-muted-foreground">Glucose:</span> <span className="font-semibold">{assessment.bloodGlucoseLevel}</span>
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-display font-bold text-lg">
                          {Number(assessment.riskScore).toFixed(1)}%
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        {getRiskBadge(assessment.riskCategory)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
