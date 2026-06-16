import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ConfidenceRange from "./ConfidenceRange";

describe("ConfidenceRange component", () => {
  it("renders a placeholder when low or high is null", () => {
    const { container } = render(<ConfidenceRange low={null} high={null} />);
    expect(container).toHaveTextContent("—");
  });

  it("renders correctly with valid low and high", () => {
    render(<ConfidenceRange low={20.5} high={40.2} />);
    const rangeContainer = screen.getByLabelText("Confidence interval: 20.5% to 40.2%");
    expect(rangeContainer).toBeInTheDocument();
    expect(rangeContainer).toHaveAttribute("title", "20.5% — 40.2%");
    expect(screen.getByText("20.5% — 40.2%")).toBeInTheDocument();
  });

  it("clamps values between 0 and 100", () => {
    render(<ConfidenceRange low={-10} high={150} />);
    const rangeContainer = screen.getByLabelText("Confidence interval: 0.0% to 100.0%");
    expect(rangeContainer).toBeInTheDocument();
    expect(screen.getByText("0.0% — 100.0%")).toBeInTheDocument();
  });

  it("renders a marker when value is provided", () => {
    const { container } = render(<ConfidenceRange low={20} high={80} value={50} />);
    
    // We expect the marker div to be rendered
    // Since it doesn't have text, we can check for its hidden aria attribute or class structure
    const marker = container.querySelector("[aria-hidden]");
    expect(marker).toBeInTheDocument();
  });
});
