import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import PatientTimeline from "./PatientTimeline";
import { type Assessment } from "@shared/schema";

vi.mock("@/utils/dateFormat", () => ({
  formatAssessmentDate: (date: any) => "Mock Date",
  formatCompactDate: (date: any) => "Mock Date"
}));

// Mock RiskTrendChart because it uses canvas/recharts which is hard to test in JSDOM
vi.mock("./RiskTrendChart", () => {
  return {
    default: () => <div data-testid="mock-risk-trend-chart">Mock Chart</div>,
    PATIENT_COLORS: []
  };
});

const mockAssessments: Partial<Assessment>[] = [
  {
    id: 1,
    patientName: "John Doe",
    age: 45,
    gender: "Male",
    bmi: 25.5,
    hba1cLevel: 5.8,
    bloodGlucoseLevel: 100,
    hypertension: false,
    heartDisease: false,
    smokingHistory: "never",
    riskScore: 15,
    riskCategory: "LOW",
    factors: [],
    createdAt: new Date("2026-06-01T10:00:00Z"),
    clinicalNote: "Patient doing well. Continue current plan.",
  },
  {
    id: 2,
    patientName: "John Doe",
    age: 45,
    gender: "Male",
    bmi: 26.0,
    hba1cLevel: 6.0,
    bloodGlucoseLevel: 110,
    hypertension: false,
    heartDisease: false,
    smokingHistory: "never",
    riskScore: 25,
    riskCategory: "MODERATE",
    factors: [],
    createdAt: new Date("2026-06-15T10:00:00Z"),
    clinicalNote: "Slight increase in weight and glucose. Monitor closely.",
  }
];

test("renders PatientTimeline correctly", () => {
  render(<PatientTimeline assessments={mockAssessments as any} />);
  
  expect(screen.getByTestId("mock-risk-trend-chart")).toBeInTheDocument();
  
  // Check clinical notes
  expect(screen.getByText("Patient doing well. Continue current plan.")).toBeInTheDocument();
  expect(screen.getByText("Slight increase in weight and glucose. Monitor closely.")).toBeInTheDocument();
  
  // Check Risk categories
  expect(screen.getByText(/LOW RISK/i)).toBeInTheDocument();
  expect(screen.getByText(/MODERATE RISK/i)).toBeInTheDocument();
});
