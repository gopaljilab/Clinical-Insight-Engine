import React from 'react';
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, ShieldAlert, Sparkles, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExplainableInsight {
  insight: string;
  source_snippet: string | null;
  source_index: [number, number] | null;
}

interface ClinicalNoteViewerProps {
  noteText: string;
  insights: ExplainableInsight[];
}

export function ClinicalNoteViewer({ noteText, insights }: ClinicalNoteViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const highlightRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Filter out null or invalid insights for the selector
  const validInsights = insights.filter(
    (ins) => ins.source_index && Array.isArray(ins.source_index) && ins.source_index.length === 2
  );

  useEffect(() => {
    if (selectedIndex !== null && highlightRef.current) {
      highlightRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (validInsights.length === 0) return;

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        if (prev === null) return insights.indexOf(validInsights[0]);
        const currentValidIdx = validInsights.indexOf(insights[prev]);
        const nextValidIdx = (currentValidIdx + 1) % validInsights.length;
        return insights.indexOf(validInsights[nextValidIdx]);
      });
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        if (prev === null) return insights.indexOf(validInsights[validInsights.length - 1]);
        const currentValidIdx = validInsights.indexOf(insights[prev]);
        const prevValidIdx = (currentValidIdx - 1 + validInsights.length) % validInsights.length;
        return insights.indexOf(validInsights[prevValidIdx]);
      });
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSelectedIndex(null);
    }
  };
const renderMedicalTerms = (text: string) => {
  return text.split(/(\b)/).map((part, index) => {
    const key = part.toLowerCase() as keyof typeof clinicalTerminology;

    if (clinicalTerminology[key]) {
      return (
        <MedicalTermTooltip key={index} term={key}>
          {part}
        </MedicalTermTooltip>
      );
    }

    return part;
  });
};
  const renderNoteWithHighlight = () => {
    if (selectedIndex === null) return (
  <p className="whitespace-pre-wrap leading-relaxed">
    {renderMedicalTerms(noteText)}
  </p>
);

    const selectedInsight = insights[selectedIndex];
    if (!selectedInsight || !selectedInsight.source_index) {
      return (
  <p className="whitespace-pre-wrap leading-relaxed">
    {renderMedicalTerms(noteText)}
  </p>
);
    }

    const [start, end] = selectedInsight.source_index;
    if (start < 0 || end > noteText.length || start > end) {
      return (
  <p className="whitespace-pre-wrap leading-relaxed">
    {renderMedicalTerms(noteText)}
  </p>
);
    }

    const before = noteText.substring(0, start);
    const highlight = noteText.substring(start, end);
    const after = noteText.substring(end);

    return (
      <p className="whitespace-pre-wrap leading-relaxed">
        {before}
        <mark
          ref={highlightRef as any}
          className="bg-yellow-200 border-b-2 border-yellow-400 font-bold px-1 py-0.5 rounded text-slate-900 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          tabIndex={0}
        >
          {highlight}
        </mark>
        {after}
      </p>
    );
  };

  return (
    <Card 
      className="border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 shadow-lg"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Clinical Note Source Citation Viewer"
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <div>
            <CardTitle className="text-lg">Clinical Note Source Citation</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Trace AI insights back to the original DocumentReference clinical transcript.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Note Viewer */}
          <div 
            ref={containerRef}
            className="relative h-72 sm:h-80 overflow-y-auto border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-950/45 p-4 rounded-xl font-mono text-sm leading-relaxed text-slate-800 dark:text-gray-300 shadow-inner focus-within:ring-2 focus-within:ring-blue-500/20"
          >
            {renderNoteWithHighlight()}
          </div>

          {/* Insights Selector */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Cited Insights</h4>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-72">
              {insights.map((ins, idx) => {
                const isSelected = selectedIndex === idx;
                const hasCitation = ins.source_index !== null;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedIndex(isSelected ? null : idx)}
                    disabled={!hasCitation}
                    className={cn(
                      "flex flex-col items-start text-left p-3.5 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500",
                      isSelected
                        ? "bg-blue-50/70 border-blue-500 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 shadow-sm"
                        : hasCitation
                        ? "bg-white dark:bg-gray-800/40 border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/80 cursor-pointer"
                        : "bg-slate-50 dark:bg-gray-950/20 border-slate-100 dark:border-gray-900/40 text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {hasCitation ? (
                        <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      ) : (
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="font-semibold text-sm leading-tight flex-1">{ins.insight}</span>
                    </div>
                    {ins.source_snippet && (
                      <span className="text-[11px] mt-1.5 opacity-80 italic line-clamp-2 bg-slate-100/60 dark:bg-slate-900/60 px-2 py-1 rounded w-full border border-slate-200/40 dark:border-slate-800/40">
                        "{ins.source_snippet}"
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-auto italic">
              * Navigate using mouse click or keyboard <b>Up/Down Arrow</b> keys. Press <b>ESC</b> to reset.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

