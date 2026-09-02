import { describe, expect, it, vi } from "vitest";
import * as userRepo from "../repositories/user";
import { toggleUserFavorite } from "./user";

vi.mock("../repositories/user");

describe("toggleUserFavorite", () => {
  it("removes an existing favorite", async () => {
    vi.mocked(userRepo.findFavorite).mockResolvedValue({
      userId: "u1",
      favoriteCourse: "DD2421",
    } as never);

    const result = await toggleUserFavorite("u1", "DD2421");

    expect(result).toEqual({ action: "removed" });
    expect(userRepo.removeFavorite).toHaveBeenCalledWith("u1", "DD2421");
  });

  it("adds a missing favorite", async () => {
    vi.mocked(userRepo.findFavorite).mockResolvedValue(undefined);

    const result = await toggleUserFavorite("u1", "DD2421");

    expect(result).toEqual({ action: "added" });
    expect(userRepo.addFavorite).toHaveBeenCalledWith("u1", "DD2421");
  });
});
