import { describe, expect, it } from "vitest";
import { selectUnreviewedCourses } from "./unreviewed";

const TAKEN = [{ courseCode: "DD2424" }, { courseCode: "SF1918" }];

function codes(taken: { courseCode: string }[]): string[] {
  return taken.map((course) => course.courseCode);
}

describe("selectUnreviewedCourses", () => {
  it("keeps the taken courses the viewer has not reviewed", () => {
    const kept = selectUnreviewedCourses(
      TAKEN,
      [{ courseCode: "SF1918", userId: "u1" }],
      "u1",
    );

    expect(codes(kept)).toEqual(["DD2424"]);
  });

  // Reviews are public, so a course's list is everybody's reviews of it. Only
  // the viewer's own answers the question this card asks.
  it("ignores reviews written by other students", () => {
    const kept = selectUnreviewedCourses(
      TAKEN,
      [
        { courseCode: "DD2424", userId: "u2" },
        { courseCode: "SF1918", userId: "u3" },
      ],
      "u1",
    );

    expect(codes(kept)).toEqual(["DD2424", "SF1918"]);
  });

  it("keeps a reviewed course that is not among the taken ones out of the way", () => {
    const kept = selectUnreviewedCourses(
      TAKEN,
      [{ courseCode: "AK2030", userId: "u1" }],
      "u1",
    );

    expect(codes(kept)).toEqual(["DD2424", "SF1918"]);
  });

  // Nobody signed in means no author to compare against; prompting anyone at
  // all would be prompting the wrong person.
  it("prompts nobody when there is no viewer", () => {
    expect(selectUnreviewedCourses(TAKEN, [], "")).toEqual([]);
  });
});
