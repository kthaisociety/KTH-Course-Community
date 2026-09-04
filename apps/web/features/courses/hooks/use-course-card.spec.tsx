import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseStats } from "@/types";
import { useCourseCard } from "./use-course-card";

const useMe = vi.fn();
const setSaved = vi.fn();
const takenList = vi.fn();
const collectionsList = vi.fn();
const create = vi.fn();
const addCourse = vi.fn();
const removeCourse = vi.fn();
const markTaken = vi.fn();
const onRequestAuth = vi.fn();
const toastError = vi.fn();

vi.mock("@/features/auth", () => ({ useMe: () => useMe() }));
vi.mock("@/features/favorites", () => ({
  useSetCourseSaved: () => ({ setSaved }),
}));
vi.mock("@/features/courses/api/queries", () => ({
  useCollections: (enabled: boolean) => collectionsList(enabled),
  useTakenCourses: (enabled: boolean) => takenList(enabled),
}));
vi.mock("@/features/courses/api/mutations", () => ({
  useCollectionMutations: () => ({
    create: { mutateAsync: create },
    addCourse: { mutateAsync: addCourse },
    removeCourse: { mutateAsync: removeCourse },
  }),
  useMarkCourseTaken: () => ({ mutateAsync: markTaken }),
}));
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m) } }));

const COURSE = {
  courseCode: "DD2380",
  titleEng: "Artificial Intelligence",
  credits: 6,
  department: "EECS",
};

const NO_REVIEWS: CourseStats = { reviews: null, takenCount: 0 };

function signedOut() {
  useMe.mockReturnValue({ user: null });
}

function signedIn(savedCourseCodes: string[] = []) {
  useMe.mockReturnValue({ user: { userId: "u1", savedCourseCodes } });
}

function card(overrides: Record<string, unknown> = {}) {
  return renderHook(() =>
    useCourseCard({
      course: COURSE,
      stats: NO_REVIEWS,
      onRequestAuth,
      ...overrides,
    }),
  );
}

beforeEach(() => {
  signedOut();
  takenList.mockReturnValue({ data: undefined });
  collectionsList.mockReturnValue({ data: undefined });
  setSaved.mockResolvedValue(undefined);
  create.mockResolvedValue({ id: "k-new", name: "Spring", courseCodes: [] });
  addCourse.mockResolvedValue(undefined);
  removeCourse.mockResolvedValue(undefined);
  markTaken.mockResolvedValue(undefined);
});

describe("useCourseCard", () => {
  describe("a visitor", () => {
    // Every one of these procedures is protected, so a request would only be
    // rejected. The prompts hand off to AuthReasonDialog instead.
    it("asks none of the protected queries", () => {
      card();
      expect(takenList).toHaveBeenCalledWith(false);
      expect(collectionsList).toHaveBeenCalledWith(false);
    });

    it("is asked to sign in rather than silently failing to save", async () => {
      const { result } = card();
      await act(async () => result.current.c.onSave?.());
      expect(setSaved).not.toHaveBeenCalled();
      expect(onRequestAuth).toHaveBeenCalledWith("save-course");
    });

    it("gets the design's inline prompt over the taken pill", async () => {
      const { result } = card();
      await act(async () => result.current.c.onTaken?.());
      expect(markTaken).not.toHaveBeenCalled();
      expect(result.current.c.takenPickerOpen).toBe(true);
    });

    // The prompt names the reason; the dialog does the signing in.
    it("routes both prompt buttons to the one sign-in surface", async () => {
      const { result } = card();
      await act(async () => result.current.c.onSignUp?.());
      await act(async () => result.current.c.onLogIn?.());
      expect(onRequestAuth).toHaveBeenCalledWith("sign-up");
      expect(onRequestAuth).toHaveBeenCalledWith("log-in");
    });

    // Otherwise the panel sits behind the dialog and is still open when the
    // reader dismisses it.
    it("puts away the panel that asked before the dialog opens", async () => {
      const { result } = card();
      await act(async () => result.current.c.onTaken?.());
      expect(result.current.c.takenPickerOpen).toBe(true);

      await act(async () => result.current.c.onSignUp?.());
      expect(result.current.c.takenPickerOpen).toBe(false);
      expect(result.current.c.pickerOpen).toBe(false);
      expect(onRequestAuth).toHaveBeenCalledWith("sign-up");
    });
  });

  describe("a signed-in viewer", () => {
    beforeEach(() => signedIn());

    it("saves and unsaves through the same course code", async () => {
      const { result } = card();
      await act(async () => result.current.c.onSave?.());
      expect(setSaved).toHaveBeenCalledWith("DD2380", true);

      signedIn(["DD2380"]);
      const saved = card();
      await act(async () => saved.result.current.c.onSave?.());
      expect(setSaved).toHaveBeenLastCalledWith("DD2380", false);
    });

    it("marks the course taken, and nothing else", async () => {
      const { result } = card({
        prerequisites: [
          { code: "DD1337", name: "Programming", inCatalog: true },
        ],
      });
      await act(async () => result.current.c.onTaken?.());
      // One write, for this course. A prerequisite is never marked with it.
      expect(markTaken).toHaveBeenCalledTimes(1);
      expect(markTaken).toHaveBeenCalledWith({ courseCode: "DD2380" });
    });

    it("stops offering the pill once the course is marked", () => {
      takenList.mockReturnValue({ data: [{ courseCode: "DD2380" }] });
      const { result } = card();
      expect(result.current.c.onTaken).toBeUndefined();
    });

    describe("the collections picker", () => {
      beforeEach(() => {
        collectionsList.mockReturnValue({
          data: [
            { id: "k1", name: "Spring P3", courseCodes: [] },
            { id: "k2", name: "Maybe", courseCodes: ["DD2380"] },
          ],
        });
      });

      it("ticks only the collections the course is already in", () => {
        const { result } = card();
        expect(result.current.c.collections.map((row) => row.tick)).toEqual([
          "",
          "m8.5 12 2.4 2.4 4.6-4.9",
        ]);
        expect(result.current.c.hasCollections).toBe(true);
      });

      // A course may only join a collection its owner has also saved, so the
      // picker saves first rather than letting the service reject the write.
      it("saves an unsaved course before adding it", async () => {
        const { result } = card();
        await act(async () => result.current.c.collections[0]?.onClick?.());
        expect(setSaved).toHaveBeenCalledWith("DD2380", true);
        expect(addCourse).toHaveBeenCalledWith({
          collectionId: "k1",
          courseCode: "DD2380",
        });
      });

      it("does not re-save a course it already holds", async () => {
        signedIn(["DD2380"]);
        const { result } = card();
        await act(async () => result.current.c.collections[0]?.onClick?.());
        expect(setSaved).not.toHaveBeenCalled();
        expect(addCourse).toHaveBeenCalledOnce();
      });

      it("removes the course from a collection that holds it", async () => {
        const { result } = card();
        await act(async () => result.current.c.collections[1]?.onClick?.());
        expect(removeCourse).toHaveBeenCalledWith({
          collectionId: "k2",
          courseCode: "DD2380",
        });
        expect(addCourse).not.toHaveBeenCalled();
      });

      it("creates a collection and puts the course straight into it", async () => {
        const { result } = card();
        act(() => result.current.c.onPicker?.());
        act(() => result.current.c.onNewCollection?.());
        act(() => result.current.onDraftChange("Spring"));
        expect(result.current.c.creating).toBe(true);

        await act(async () => result.current.onDraftCommit());
        expect(create).toHaveBeenCalledWith({ name: "Spring" });
        await waitFor(() =>
          expect(addCourse).toHaveBeenCalledWith({
            collectionId: "k-new",
            courseCode: "DD2380",
          }),
        );
        expect(result.current.c.creating).toBe(false);
      });

      it("writes nothing for a blank name", async () => {
        const { result } = card();
        act(() => result.current.c.onNewCollection?.());
        act(() => result.current.onDraftChange("   "));
        await act(async () => result.current.onDraftCommit());
        expect(create).not.toHaveBeenCalled();
      });

      // Reopening the picker must not offer a name abandoned last time.
      it("abandons the draft when the picker closes", () => {
        const { result } = card();
        act(() => result.current.c.onPicker?.());
        act(() => result.current.c.onNewCollection?.());
        act(() => result.current.onDraftChange("Half typed"));
        act(() => result.current.c.onPicker?.());

        expect(result.current.draftName).toBe("");
        expect(result.current.c.creating).toBe(false);
      });

      // Each write can fail on its own, so the message has to name the step that
      // actually failed rather than blame the whole gesture.
      describe("when a write fails", () => {
        it("does not blame the add for a save that failed", async () => {
          setSaved.mockRejectedValue(new Error("nope"));
          const { result } = card();
          await act(async () => result.current.c.collections[0]?.onClick?.());
          await waitFor(() =>
            expect(toastError).toHaveBeenCalledWith(
              'Could not save DD2380, so it was not added to "Spring P3".',
            ),
          );
          expect(addCourse).not.toHaveBeenCalled();
        });

        // The save is a real, visible outcome; leaving it unsaid would make the
        // Save button look like it flipped on its own.
        it("says the course was saved even though the add failed", async () => {
          addCourse.mockRejectedValue(new Error("nope"));
          const { result } = card();
          await act(async () => result.current.c.collections[0]?.onClick?.());
          await waitFor(() =>
            expect(toastError).toHaveBeenCalledWith(
              'Saved DD2380, but could not add it to "Spring P3".',
            ),
          );
        });

        it("names the collection a removal failed on", async () => {
          removeCourse.mockRejectedValue(new Error("nope"));
          const { result } = card();
          await act(async () => result.current.c.collections[1]?.onClick?.());
          await waitFor(() =>
            expect(toastError).toHaveBeenCalledWith(
              'Could not remove DD2380 from "Maybe".',
            ),
          );
        });
      });

      // `collections.create` has no uniqueness on name, so sending the reader
      // back to the name field would make a second empty collection. The
      // recovery is the row the picker now lists.
      // Pointing at the collection's row is only useful if clicking it could
      // work. A failed save blocks that row too — the service will not let an
      // unsaved course join a collection — so the advice has to change with it.
      it("names the save as the blocker when creating, and does not send the reader to a row that cannot work", async () => {
        setSaved.mockRejectedValue(new Error("nope"));
        const { result } = card();
        act(() => result.current.c.onNewCollection?.());
        act(() => result.current.onDraftChange("Spring"));
        await act(async () => result.current.onDraftCommit());

        expect(create).toHaveBeenCalledWith({ name: "Spring" });
        await waitFor(() =>
          expect(toastError).toHaveBeenCalledWith(
            'Created "Spring", but could not save DD2380, so it is not in the collection yet. Save the course, then pick "Spring" from the list.',
          ),
        );
        expect(addCourse).not.toHaveBeenCalled();
      });

      it("does not call a made collection a failed one when only the add failed", async () => {
        addCourse.mockRejectedValue(new Error("nope"));
        const { result } = card();
        act(() => result.current.c.onNewCollection?.());
        act(() => result.current.onDraftChange("Spring"));
        await act(async () => result.current.onDraftCommit());

        expect(create).toHaveBeenCalledWith({ name: "Spring" });
        await waitFor(() =>
          expect(toastError).toHaveBeenCalledWith(
            'Created "Spring", but could not add DD2380 to it. Pick it from the list to try again.',
          ),
        );
      });

      it("reports a creation that genuinely failed as one", async () => {
        create.mockRejectedValue(new Error("nope"));
        const { result } = card();
        act(() => result.current.c.onNewCollection?.());
        act(() => result.current.onDraftChange("Spring"));
        await act(async () => result.current.onDraftCommit());

        await waitFor(() =>
          expect(toastError).toHaveBeenCalledWith(
            'Could not create the collection "Spring".',
          ),
        );
        expect(addCourse).not.toHaveBeenCalled();
      });
    });
  });
});
