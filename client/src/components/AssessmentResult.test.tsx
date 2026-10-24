import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { AssessmentResult } from "./AssessmentResult";
import { downloadClinicalAssessmentPdf, downloadPatientHandoutPdf } from "@/utils/clinicalPdfReport";

vi.mock("@/hooks/use-assessments", () => ({
  useAssessments: () => ({ data: { data: [] } }),
  useWhatIfAuto: () => ({ mutate: vi.fn(), data: null, isPending: false }),
  useWhatIfAssessment: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useWhatIfBatch: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useUpdateClinicalNote: () => ({ mutate: vi.fn(), isPending: false }),
  usePatientAssessments: () => ({ data: { pages: [] }, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false }),
}));

vi.mock("@/utils/clinicalPdfReport", () => ({
  downloadClinicalAssessmentPdf: vi.fn().mockResolvedValue(undefined),
  downloadPatientHandoutPdf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/components/CopySuccessToast", () => ({ CopySuccessToast: () => null }));
vi.mock("@/components/CollaborativeNotes", () => ({ CollaborativeNotes: () => null }));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  Cell: () => null,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
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

test("renders translated patient view with correct risk category", () => {
  render(<AssessmentResult assessment={mockAssessment as any} onClearResult={vi.fn()} />);
  expect(screen.getByText("Your Health Assessment")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Patient View" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByText(/patientResult\.[\w.]+/i)).not.toBeInTheDocument();
  // We expect "LOW" since riskCategory is LOW
  expect(screen.getAllByText("LOW").length).toBeGreaterThan(0);
});

test("keeps view selection and report actions in separate wrapping rows", () => {
  render(<AssessmentResult assessment={mockAssessment as any} />);

  const viewControls = screen.getByRole("group", { name: "Assessment result view" });
  const reportActions = screen.getByRole("group", { name: "Assessment report actions" });
  expect(viewControls.parentElement).toHaveClass("flex-col");
  expect(reportActions.parentElement).toHaveClass("flex-wrap");
  expect(document.getElementById("assessment-result-wrapper")).not.toHaveClass("overflow-x-clip");
});

test("switches between patient and clinician views using the assessment data", async () => {
  render(<AssessmentResult assessment={mockAssessment as any} />);
  fireEvent.click(screen.getByRole("button", { name: "Clinician View" }));

  expect(screen.getByRole("button", { name: "Clinician View" })).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByText("Detailed Interpretation")).toBeInTheDocument();
});

test("opens presentation mode and can clear the assessment result", () => {
  const onClearResult = vi.fn();
  render(<AssessmentResult assessment={mockAssessment as any} onClearResult={onClearResult} />);

  fireEvent.click(screen.getByRole("button", { name: "Present" }));
  expect(screen.getByRole("dialog", { name: "Your Health" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Clear Result & Start Over" }));
  expect(onClearResult).toHaveBeenCalledOnce();
});

test("exports the patient handout and clinician report from the existing handlers", async () => {
  render(<AssessmentResult assessment={mockAssessment as any} />);

  fireEvent.click(screen.getByRole("button", { name: "Export Patient Handout" }));
  await waitFor(() => expect(downloadPatientHandoutPdf).toHaveBeenCalledOnce());

  fireEvent.click(screen.getByRole("button", { name: "Clinician View" }));
  fireEvent.click(screen.getByRole("button", { name: "Download Clinical Report" }));
  await waitFor(() => expect(downloadClinicalAssessmentPdf).toHaveBeenCalledOnce());
});

test("copies, downloads JSON, and opens print using the toolbar actions", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const print = vi.spyOn(window, "print").mockImplementation(() => {});

  render(<AssessmentResult assessment={mockAssessment as any} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy assessment summary" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  expect(await screen.findByRole("button", { name: "Copy assessment summary" })).toHaveTextContent("Copied");

  fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
  expect(anchorClick).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "Print Report" }));
  expect(print).toHaveBeenCalledOnce();

  anchorClick.mockRestore();
  print.mockRestore();
});
