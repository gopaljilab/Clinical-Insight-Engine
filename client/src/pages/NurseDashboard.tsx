import React from 'react';
import { useState, useMemo } from "react";
import { useAssessments } from "@/hooks/use-assessments";
import { formatReadableDate } from "@/utils/dateFormat";
import { Loader2, Users, AlertCircle, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusPill from "@/components/ui/StatusPill";
import { AppLayout } from "@/components/layout/AppLayout";

export default function NurseDashboard() {
  // Fetch recent assessments for the queue
  const { data: assessmentsData, isLoading } = useAssessments({
    page: 1,
    limit: 50,
    sortBy: "createdAt",
    order: "desc"
  });

  const assessments = assessmentsData?.data ?? [];

  const stats = useMemo(() => {
    const total = assessments.length;
    const highRisk = total > 0 ? assessments.filter(a => (a.riskCategory || "").toUpperCase() === "HIGH").length : 0;
    
    // Count assessments from today
    const today = new Date().toDateString();
    const todayCount = total > 0 ? assessments.filter(a => new Date(a.createdAt!).toDateString() === today).length : 0;

    return [
      { label: "Today's Patients", value: String(todayCount), icon: Users },
      { label: "Pending Reviews", value: String(total), icon: Clock3 },
      { label: "High Risk Alerts", value: String(highRisk), icon: AlertCircle },
    ];
  }, [assessments]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-950/50 px-4 py-2 text-sm font-black text-blue-700 dark:text-blue-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]" />
          Nurse Station
        </div>
        <h1 className="text-3xl md:text-5xl font-black font-display text-[#1E293B] dark:text-gray-100 tracking-tight">Patient Queue</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg max-w-2xl leading-8">
          Review recent assessments, monitor incoming patient data, and prioritize high-risk individuals.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-slate-100 dark:border-gray-800 shadow-sm shadow-slate-900/3 dark:shadow-gray-950/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</CardTitle>
                <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-[#1E293B] dark:text-gray-100">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-slate-100 dark:border-gray-800 shadow-sm shadow-slate-900/3 dark:shadow-gray-950/30">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-gray-800">
          <CardTitle className="text-lg font-bold text-[#1E293B] dark:text-gray-100">Recent Assessments</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : assessments.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Users}
                title="No patients in queue"
                description="There are currently no recent patient assessments to review."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-gray-700 text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-gray-800/50">
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Vitals</th>
                    <th className="px-4 py-3 font-medium">Risk Score</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((assessment) => (
                    <tr key={assessment.id} className="border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#1E293B] dark:text-gray-200">{assessment.patientName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{assessment.age}y • {assessment.gender}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {formatReadableDate(assessment.createdAt, { fallback: "Unknown" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 text-xs">
                          <span className="text-slate-600 dark:text-slate-300">BMI: <span className="font-medium">{assessment.bmi}</span></span>
                          <span className="text-slate-600 dark:text-slate-300">A1C: <span className="font-medium">{assessment.hba1cLevel}%</span></span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold">{Number(assessment.riskScore).toFixed(1)}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={assessment.riskCategory} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </AppLayout>
  );
}

