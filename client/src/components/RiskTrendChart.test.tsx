import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import RiskTrendChart from "./RiskTrendChart";

vi.mock("@/utils/chartWorker?worker", () => {
  return {
    default: class MockWorker {
      onmessage: any;
      postMessage() {
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage({ data: [{ date: "2023-01-01", riskScore: 10 }, { date: "2023-02-01", riskScore: 15 }] });
          }
        }, 0);
      }
      terminate() {}
    }
  };
});

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
}));

const mockAssessments = [
  { id: 1, createdAt: new Date("2023-01-01") },
  { id: 2, createdAt: new Date("2023-02-01") },
];

test("renders RiskTrendChart correctly when there are enough assessments", async () => {
  render(<RiskTrendChart assessments={mockAssessments as any} />);
  expect(screen.getByText(/Risk Trend Analytics/i)).toBeInTheDocument();
  expect(await screen.findByTestId("line-chart")).toBeInTheDocument();
});

test("shows warning when there are not enough assessments", () => {
  render(<RiskTrendChart assessments={[mockAssessments[0]] as any} />);
  expect(screen.getByText(/At least 2 assessments are needed/i)).toBeInTheDocument();
});
