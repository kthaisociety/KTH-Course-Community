import { describe, expect, it } from "vitest";
import { applyReorder } from "./collection-order";

/**
 * These hold `applyReorder` against `reorderCollectionCourses` in
 * `server/collections/service.ts` — the optimistic order the picker shows has to
 * be the order the server is about to store, or the list jumps when the refetch
 * lands.
 */
describe("applyReorder", () => {
  const MEMBERS = ["AA1000", "BB2000", "CC3000", "DD4000"];

  it("puts the named codes first, in the order named", () => {
    expect(applyReorder(MEMBERS, ["CC3000", "AA1000"])).toEqual([
      "CC3000",
      "AA1000",
      "BB2000",
      "DD4000",
    ]);
  });

  it("keeps the members it does not name behind them, in their own order", () => {
    expect(applyReorder(MEMBERS, ["DD4000"])).toEqual([
      "DD4000",
      "AA1000",
      "BB2000",
      "CC3000",
    ]);
  });

  it("takes a complete order as it is given", () => {
    const reversed = [...MEMBERS].reverse();
    expect(applyReorder(MEMBERS, reversed)).toEqual(reversed);
  });

  // The server rejects a non-member outright, and the UI only ever reorders
  // codes it is already rendering. Dropping it leaves the optimistic list equal
  // to what a request that succeeds returns.
  it("drops a code that is not a member", () => {
    expect(applyReorder(MEMBERS, ["ZZ9000", "BB2000"])).toEqual([
      "BB2000",
      "AA1000",
      "CC3000",
      "DD4000",
    ]);
  });

  it("counts a repeated code once, at its first mention", () => {
    expect(applyReorder(MEMBERS, ["BB2000", "AA1000", "BB2000"])).toEqual([
      "BB2000",
      "AA1000",
      "CC3000",
      "DD4000",
    ]);
  });

  it("leaves an empty request untouched", () => {
    expect(applyReorder(MEMBERS, [])).toEqual(MEMBERS);
  });
});
