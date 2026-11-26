import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatchUpCard } from "./catch-up-card";

describe("CatchUpCard", () => {
  it("lists what to catch up on, adds it to the period offered, and says when a period comes too late", () => {
    const onPlace = vi.fn();
    render(
      <CatchUpCard
        open="COPEN"
        next="CDATE"
        intake="20262"
        onShow={() => {}}
        onPlace={onPlace}
        courses={[
          {
            code: "DA1600",
            title: "Writing in the Engineering Profession",
            neededBy: ["DA150X"],
            slot: { ay: 2027, p: 1 },
            late: false,
          },
          {
            code: "DD1338",
            title: "Algorithms and Data Structures",
            neededBy: ["DD1368", "DD1366", "DD1367", "DD2350"],
            slot: { ay: 2027, p: 2 },
            late: true,
          },
          {
            code: "SF1671",
            title: "Mathematics, Basic course, with Discrete Mathematics",
            neededBy: ["DD1351"],
            slot: null,
            late: false,
          },
        ]}
      />,
    );

    expect(screen.getByText("3 to add")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Needed by DD1368, DD1366, DD1367 and 1 more · given too late for DD1368/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Dates unknown")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "HT 2027 P1" }));
    expect(onPlace).toHaveBeenCalledWith("DA1600", { ay: 2027, p: 1 });
  });

  it("shows nothing when there is nothing to catch up on", () => {
    const { container } = render(
      <CatchUpCard
        open="COPEN"
        next="CDATE"
        intake="20262"
        courses={[]}
        onPlace={() => {}}
        onShow={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
