import React from 'react';
import type { Assessment } from '@shared/schema';
import RiskTrendChart from './RiskTrendChart';
import { formatAssessmentDate } from '@/utils/dateFormat';
import { Badge } from '@/components/ui/badge';
import { Activity, Calendar, FileText, Droplets, Weight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  assessments: Assessment[];
}

export default function PatientTimeline({ assessments }: Props) {
  const sortedAssessments = [...assessments].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  return (
    <div className="space-y-8">
      {/* Risk Trend Chart */}
      <RiskTrendChart assessments={assessments} />

      {/* Clinical Notes Timeline */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-black text-foreground mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Clinical History Timeline
        </h3>

        <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          {sortedAssessments.map((assessment, index) => {
            const riskColor = 
              assessment.riskCategory === 'HIGH' ? 'bg-destructive text-destructive-foreground' :
              assessment.riskCategory === 'MODERATE' ? 'bg-amber-500 text-white' :
              'bg-emerald-500 text-white';
            
            const badgeBorderColor = 
              assessment.riskCategory === 'HIGH' ? 'border-destructive' :
              assessment.riskCategory === 'MODERATE' ? 'border-amber-500' :
              'border-emerald-500';

            return (
              <div key={assessment.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                
                {/* Timeline dot */}
                <div className={cn("flex items-center justify-center w-10 h-10 rounded-full border-4 border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm", riskColor)}>
                  <Activity className="w-4 h-4" />
                </div>
                
                {/* Timeline content */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 mb-3">
                    <time className="text-sm font-bold text-foreground">
                      {formatAssessmentDate(assessment.createdAt)}
                    </time>
                    <Badge variant="outline" className={cn("w-fit font-bold", riskColor, badgeBorderColor)}>
                      {assessment.riskCategory} RISK - {Number(assessment.riskScore).toFixed(1)}%
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Weight className="w-3.5 h-3.5" />
                      <span>BMI: <strong className="text-foreground">{Number(assessment.bmi).toFixed(1)}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Droplets className="w-3.5 h-3.5" />
                      <span>HbA1c: <strong className="text-foreground">{Number(assessment.hba1cLevel).toFixed(1)}%</strong></span>
                    </div>
                  </div>

                  {assessment.clinicalNote ? (
                    <div className="text-sm bg-muted/50 p-3 rounded-lg text-muted-foreground border border-border/50">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                        <FileText className="w-3.5 h-3.5" />
                        Clinical Note
                      </div>
                      <p className="whitespace-pre-wrap">{assessment.clinicalNote}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">
                      No clinical note recorded for this visit.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
