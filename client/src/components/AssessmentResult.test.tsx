import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { AssessmentResult } from "./AssessmentResult";

vi.mock("@/hooks/use-assessments", () => ({
  useAssessments: () => ({ data: { data: [] } }),
  useWhatIfAuto: () => ({ mutate: vi.fn(), data: null, isPending: false }),
  useWhatIfAssessment: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useWhatIfBatch: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  Cell: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, asChild }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
}));

// Provide basic matchMedia mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const mockAssessment = {
  id: 1,
  patientName: "John Doe",
  age: 45,
  gender: "Male",
  hypertension: false,
  heartDisease: false,
  smokingHistory: "never",
  bmi: "25.0",
  hba1cLevel: "5.5",
  bloodGlucoseLevel: "100",
  riskScore: "15.0",
  riskCategory: "LOW",
  factors: "[]",
  recommendations: [],
  prediction: {
    patientAdvice: ["Eat healthy", "Exercise"],
    clinicianAdvice: ["Monitor annually"],
  },
  modelConfidence: "0.95",
  qualityAlerts: [],
  attentionNavigator: [],
  explanation: null,
};

test("renders patient view with correct risk category", () => {
  render(<AssessmentResult assessment={mockAssessment as any} />);
  expect(screen.getByText(/Your Health Assessment/i)).toBeInTheDocument();
  // We expect "LOW" since riskCategory is LOW
  expect(screen.getAllByText("LOW").length).toBeGreaterThan(0);
});
