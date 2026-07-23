import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Target, Calendar as CalendarIcon, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format, parseISO } from "date-fns";

interface SmartGoal {
  id: number;
  assessmentId: number;
  description: string;
  targetValue: string | null;
  dueDate: string | null;
  reminderDate: string | null;
  clinicianNotes: string | null;
  patientExplanation: string | null;
  status: "Not Started" | "In Progress" | "Completed";
  createdAt: string;
  updatedAt: string;
}

interface SmartGoalsTrackerProps {
  assessmentId: number;
  viewMode: "patient" | "clinician";
}

export function SmartGoalsTracker({ assessmentId, viewMode }: SmartGoalsTrackerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: goals = [], isLoading } = useQuery<SmartGoal[]>({
    queryKey: ["assessment-goals", assessmentId],
    queryFn: async () => {
      const res = await fetch(`/api/assessments/${assessmentId}/goals`);
      if (!res.ok) throw new Error("Failed to fetch goals");
      return res.json();
    }
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/assessments/${assessmentId}/goals/generate`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to generate goals");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-goals", assessmentId] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { id: number; data: Partial<SmartGoal> }) => {
      const res = await fetch(`/api/goals/${args.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.data)
      });
      if (!res.ok) throw new Error("Failed to update goal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-goals", assessmentId] });
      setEditingId(null);
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Completed": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "In Progress": return <PlayCircle className="w-5 h-5 text-blue-500" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="mt-6 border-slate-200 shadow-sm">
        <CardContent className="p-8 flex justify-center items-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <CardTitle className="text-lg text-slate-800 dark:text-slate-100">
            {t("smartGoals.title", "Smart Goals & Follow-up Tracker")}
          </CardTitle>
        </div>
        {viewMode === "clinician" && goals.length === 0 && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {t("smartGoals.generate", "Auto-Generate Goals")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {goals.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p>{t("smartGoals.noGoals", "No active goals set for this assessment.")}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {goals.map((goal) => {
              const isEditing = editingId === goal.id;

              return (
                <div key={goal.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">{getStatusIcon(goal.status)}</div>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                          {goal.description}
                        </h4>
                        
                        {viewMode === "patient" ? (
                          <>
                            {goal.patientExplanation && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                                {goal.patientExplanation}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                              {goal.targetValue && (
                                <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                  <Target className="w-3 h-3" />
                                  Target: {goal.targetValue}
                                </span>
                              )}
                              {goal.dueDate && (
                                <span className="flex items-center gap-1 text-slate-500">
                                  <CalendarIcon className="w-3 h-3" />
                                  Due: {format(parseISO(goal.dueDate), "MMM d, yyyy")}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          // Clinician View
                          <div className="mt-3 space-y-3">
                            {isEditing ? (
                              <form 
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const fd = new FormData(e.currentTarget);
                                  updateMutation.mutate({
                                    id: goal.id,
                                    data: {
                                      targetValue: fd.get("targetValue") as string,
                                      dueDate: fd.get("dueDate") as string,
                                      clinicianNotes: fd.get("clinicianNotes") as string,
                                      status: fd.get("status") as any,
                                    }
                                  });
                                }}
                                className="space-y-4"
                              >
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium">Target Value</label>
                                    <Input name="targetValue" defaultValue={goal.targetValue || ""} />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium">Due Date</label>
                                    <Input type="date" name="dueDate" defaultValue={goal.dueDate ? goal.dueDate.split('T')[0] : ""} />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium">Clinician Notes</label>
                                  <Textarea name="clinicianNotes" defaultValue={goal.clinicianNotes || ""} rows={2} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium">Status</label>
                                  <Select name="status" defaultValue={goal.status}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Not Started">Not Started</SelectItem>
                                      <SelectItem value="In Progress">In Progress</SelectItem>
                                      <SelectItem value="Completed">Completed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                                  <Button type="submit" size="sm" disabled={updateMutation.isPending}>Save</Button>
                                </div>
                              </form>
                            ) : (
                              <>
                                <div className="flex items-center gap-4 text-sm">
                                  {goal.targetValue && (
                                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 px-2 py-1 rounded font-medium">
                                      <Target className="w-3.5 h-3.5" />
                                      {goal.targetValue}
                                    </span>
                                  )}
                                  {goal.dueDate && (
                                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                      <CalendarIcon className="w-3.5 h-3.5" />
                                      Due: {format(parseISO(goal.dueDate), "MMM d, yyyy")}
                                    </span>
                                  )}
                                  <span className={cn(
                                    "px-2 py-1 rounded text-xs font-medium",
                                    goal.status === "Completed" ? "bg-green-100 text-green-700" :
                                    goal.status === "In Progress" ? "bg-blue-100 text-blue-700" :
                                    "bg-slate-100 text-slate-700"
                                  )}>
                                    {goal.status}
                                  </span>
                                </div>
                                {goal.clinicianNotes && (
                                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md text-sm text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                                    <span className="font-semibold block mb-1 text-xs text-slate-500">Clinician Notes:</span>
                                    {goal.clinicianNotes}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {viewMode === "clinician" && !isEditing && (
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(goal.id)}>
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
