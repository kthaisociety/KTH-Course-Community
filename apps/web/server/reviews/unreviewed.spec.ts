import { describe, expect, it } from "vitest";
import { selectUnreviewedCourses as clientSide } from "@/features/reviews/lib/unreviewed";
import { selectUnreviewedCourses } from "./unreviewed";

const TAKEN = [{ courseCode: "DD2424" }, { courseCode: "SF1918" }];

/**
 * The behaviour itself is covered by `features/reviews/lib/unreviewed.spec.ts`,
 * which has exercised it since the card was built. What is worth asserting here
 * is the thing #161 actually asked for: that the browser and the tier rule are
 * running the *same function*, not two that agree today.
 *
 * A spec is the only place in `server/` allowed to import from `features/`, and
 * this is what it is for — the moment somebody re-implements the client copy,
 * the identity check fails and says so.
 */
describe("one definition of unreviewed", () => {
  it("is the same function the reviews feature exports", () => {
    expect(clientSide).toBe(selectUnreviewedCourses);
  });

  it("still answers the question the tier rule narrows", () => {
    const unreviewed = selectUnreviewedCourses(
      TAKEN,
      [{ courseCode: "SF1918", userId: "u1" }],
      "u1",
    );

    expect(unreviewed.map((course) => course.courseCode)).toEqual(["DD2424"]);
  });
});
