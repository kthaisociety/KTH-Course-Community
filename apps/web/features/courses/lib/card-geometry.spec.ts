import { describe, expect, it } from "vitest";
import { SAMPLE_GEO } from "@/data/course-card-sample";
import {
  CARD_RAMP_CEILING,
  CARD_RAMP_FLOOR,
  COLLAPSED_CARD_GEOMETRY,
  courseCardGeometry,
  EXPANDED_CARD_GEOMETRY,
} from "./card-geometry";

describe("courseCardGeometry", () => {
  // The whole point of the ramp is that its top end is the artboard. If this
  // drifts, every card in the app is drawn to a geometry the design never had.
  it("lands on the artboard's own geometry at full width", () => {
    expect(
      courseCardGeometry(Number.POSITIVE_INFINITY, { animated: false }),
    ).toEqual(SAMPLE_GEO);
  });

  it("is fully expanded once the column reaches the ceiling", () => {
    expect(courseCardGeometry(CARD_RAMP_CEILING)).toEqual(
      EXPANDED_CARD_GEOMETRY,
    );
  });

  it("crops to the same floor for any width below it", () => {
    expect(courseCardGeometry(120)).toEqual(COLLAPSED_CARD_GEOMETRY);
    expect(courseCardGeometry(CARD_RAMP_FLOOR)).toEqual(
      COLLAPSED_CARD_GEOMETRY,
    );
  });

  it("drops the labels and the summary at the floor", () => {
    expect(COLLAPSED_CARD_GEOMETRY.showLabel).toBe(false);
    expect(COLLAPSED_CARD_GEOMETRY.summaryMax).toBe("0px");
    expect(COLLAPSED_CARD_GEOMETRY.summaryOpacity).toBe(0);
    // Icon-only buttons, so the row still fits what is left of the column.
    expect(COLLAPSED_CARD_GEOMETRY.reviewFlex).toBe("0 0 34px");
    expect(COLLAPSED_CARD_GEOMETRY.saveFlex).toBe("0 0 68px");
  });

  it("narrows the rail as the column does, without ever jumping", () => {
    const midway = courseCardGeometry(CARD_RAMP_FLOOR + 85);
    expect(midway.railW).toBe("179px");
    expect(Number.parseFloat(midway.titleSize)).toBeGreaterThan(15.5);
    expect(Number.parseFloat(midway.titleSize)).toBeLessThan(17);
  });

  // Whole 19px line boxes only: half a line of text sliced across its x-height
  // reads as a rendering bug rather than as a clipped summary.
  it("gives the summary whole lines or none", () => {
    expect(courseCardGeometry(CARD_RAMP_FLOOR + 40).summaryMax).toBe("0px");
    expect(courseCardGeometry(CARD_RAMP_FLOOR + 80).summaryMax).toBe("19px");
    expect(courseCardGeometry(CARD_RAMP_FLOOR + 120).summaryMax).toBe("38px");
  });

  it("stops transitions while the ramp is being dragged", () => {
    expect(courseCardGeometry(600, { animated: false }).tween).toBe("none");
    expect(courseCardGeometry(600).tween).toContain("ease-out");
  });
});
