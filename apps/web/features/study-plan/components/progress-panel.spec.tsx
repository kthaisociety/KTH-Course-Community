import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProgressSection } from "../lib/progress";
import { ProgressPanel } from "./progress-panel";

const bachelor: ProgressSection = {
  id: "bachelor",
  title: "Bachelor part · years 1–3",
  subtitle: "Basic-level studies and the gate to the master's part",
  criteria: [
    {
      state: "planned",
      text: "Credits, years 1–3",
      meter: { done: 120, planned: 60, need: 180, unit: "hp" },
    },
    {
      state: "short",
      text: "Mandatory courses",
      codes: ["SF1625", "ID1018"],
      meter: { done: 16, planned: 0, need: 18, unit: "courses" },
    },
    { state: "met", text: "Kandidat project done before the master's starts" },
  ],
};

const done: ProgressSection = {
  id: "degree",
  title: "The whole degree",
  subtitle: "",
  criteria: [
    {
      state: "met",
      text: "All credits",
      meter: { done: 300, planned: 0, need: 300, unit: "hp" },
    },
  ],
};

describe("ProgressPanel", () => {
  it("draws a count as a label, a value and a bar rather than a sentence", () => {
    render(<ProgressPanel sections={[bachelor]} onShow={() => {}} />);
    expect(screen.getByText("Credits, years 1–3")).toBeInTheDocument();
    expect(screen.getByText("180 / 180 hp")).toBeInTheDocument();
    // The native meter carries the value for assistive tech, including what is only planned.
    const meter = screen.getByLabelText(/^Credits, years 1–3:/);
    expect(meter).toHaveAttribute("value", "180");
    expect(meter.getAttribute("aria-label")).toContain(
      "120 passed · 60 planned",
    );
  });

  it("counts courses without a unit, and offers the missing ones as chips", () => {
    const onShow = vi.fn();
    render(<ProgressPanel sections={[bachelor]} onShow={onShow} />);
    expect(screen.getByText("16 / 18")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "SF1625" }));
    expect(onShow).toHaveBeenCalledWith("SF1625");
  });

  it("heads a card with a pill: how many are not met, or done", () => {
    render(<ProgressPanel sections={[bachelor, done]} onShow={() => {}} />);
    const first = screen.getByRole("region", { name: /Bachelor part/ });
    expect(within(first).getByText("1 not met")).toBeInTheDocument();
    const second = screen.getByRole("region", { name: "The whole degree" });
    expect(within(second).getByText("Done")).toBeInTheDocument();
  });

  it("folds a long checklist's met and planned rows, leading with what is not met", () => {
    const entry: ProgressSection = {
      id: "eligibility",
      title: "Getting into TMAIM",
      subtitle: "",
      criteria: [
        { state: "met", text: "SF1625 Calculus in One Variable" },
        { state: "planned", text: "SF1624 Algebra and Geometry" },
        { state: "met", text: "ID1018 Programming I" },
        { state: "short", text: "SF1626 Calculus in Several Variables" },
      ],
    };
    render(<ProgressPanel sections={[entry]} onShow={() => {}} />);

    expect(
      screen.getByText("SF1626 Calculus in Several Variables"),
    ).toBeInTheDocument();
    expect(screen.queryByText("ID1018 Programming I")).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "3 on track" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByText("ID1018 Programming I")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide the 3 on track" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps a short checklist whole: folding two rows hides more than it saves", () => {
    render(<ProgressPanel sections={[bachelor]} onShow={() => {}} />);
    expect(
      screen.getByText("Kandidat project done before the master's starts"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /met$|on track$/ })).toBeNull();
  });

  it("asks for a setup when there is nothing to show", () => {
    render(<ProgressPanel sections={[]} onShow={() => {}} />);
    expect(
      screen.getByText("Set up your plan to see your progress."),
    ).toBeInTheDocument();
  });
});
