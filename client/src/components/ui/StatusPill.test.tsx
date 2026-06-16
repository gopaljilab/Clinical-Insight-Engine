import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StatusPill from "./StatusPill";

describe("StatusPill component", () => {
  it("renders with default props", () => {
    render(<StatusPill />);
    const pill = screen.getByRole("status");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent("DEFAULT");
    expect(String(pill.getAttribute("style"))).toContain("background-color: rgb(243, 244, 246)");
    expect(String(pill.getAttribute("style"))).toContain("color: rgb(55, 65, 81)");
  });

  it("renders correctly with 'low' variant", () => {
    render(<StatusPill variant="low" />);
    const pill = screen.getByRole("status");
    expect(pill).toHaveTextContent("LOW");
    expect(String(pill.getAttribute("style"))).toContain("background-color: rgb(230, 244, 234)");
    expect(String(pill.getAttribute("style"))).toContain("color: rgb(6, 95, 70)");
  });

  it("renders correctly with 'moderate' variant", () => {
    render(<StatusPill variant="moderate" />);
    const pill = screen.getByRole("status");
    expect(pill).toHaveTextContent("MODERATE");
  });

  it("renders correctly with 'high' variant", () => {
    render(<StatusPill variant="high" label="Critical" />);
    const pill = screen.getByRole("status");
    expect(pill).toHaveTextContent("Critical");
    expect(pill).toHaveAttribute("title", "Risk: Critical");
  });

  it("supports highlightedLabel", () => {
    render(<StatusPill variant="high" label="Critical" highlightedLabel={<span>Crit</span>} />);
    const pill = screen.getByRole("status");
    expect(pill).toHaveTextContent("Crit");
    // Ensure the span is inside the role status
    expect(pill.querySelector("span")).toBeInTheDocument();
  });
});
