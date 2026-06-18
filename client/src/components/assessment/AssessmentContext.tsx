import React, { createContext, useContext, useState, ReactNode } from "react";

type ViewType = "patient" | "clinician";

interface WhatIfFactor {
  name: string;
  impact: string;
  description: string;
}

interface AssessmentContextType {
  view: ViewType;
  setView: (view: ViewType) => void;
  isPresenting: boolean;
  setIsPresenting: (presenting: boolean) => void;
  isGeneratingPDF: boolean;
  setIsGeneratingPDF: (generating: boolean) => void;
  pdfError: string;
  setPdfError: (error: string) => void;
  whatIfFactors: WhatIfFactor[] | null;
  setWhatIfFactors: (factors: WhatIfFactor[] | null) => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export function AssessmentProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewType>("patient");
  const [isPresenting, setIsPresenting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string>("");
  const [whatIfFactors, setWhatIfFactors] = useState<WhatIfFactor[] | null>(null);

  return (
    <AssessmentContext.Provider
      value={{
        view,
        setView,
        isPresenting,
        setIsPresenting,
        isGeneratingPDF,
        setIsGeneratingPDF,
        pdfError,
        setPdfError,
        whatIfFactors,
        setWhatIfFactors,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessmentContext() {
  const context = useContext(AssessmentContext);
  if (context === undefined) {
    throw new Error("useAssessmentContext must be used within an AssessmentProvider");
  }
  return context;
}
