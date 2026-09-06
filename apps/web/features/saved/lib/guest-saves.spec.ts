/**
 * @vitest-environment jsdom
 *
 * `features/ ** /lib/` is the `logic` project, which runs in Node — right for
 * the pure helpers that live there, and wrong for this one. The whole subject
 * of this module is `window.localStorage` and the `storage` event, so it needs
 * a DOM even though it has no component in it. The docblock asks for one file's
 * worth rather than moving the module somewhere it does not belong.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GUEST_SAVES_KEY,
  readGuestSaves,
  resetGuestSavesCache,
  retireGuestSaves,
  setGuestSave,
  subscribeGuestSaves,
  writeGuestSaves,
} from "./guest-saves";

beforeEach(() => {
  window.localStorage.clear();
  resetGuestSavesCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the guest saves store", () => {
  it("reads back what it wrote, under the artboard's own key", () => {
    writeGuestSaves(["DD2380", "DD2421"]);

    expect(readGuestSaves()).toEqual(["DD2380", "DD2421"]);
    expect(
      JSON.parse(window.localStorage.getItem(GUEST_SAVES_KEY) ?? "null"),
    ).toEqual(["DD2380", "DD2421"]);
  });

  it("has nothing before anything is saved", () => {
    expect(readGuestSaves()).toEqual([]);
  });

  // `useSyncExternalStore` re-renders forever if the snapshot is a new array
  // every call, so this is a correctness test rather than a performance one.
  it("hands out the same array until the list actually changes", () => {
    writeGuestSaves(["DD2380"]);
    const first = readGuestSaves();

    expect(readGuestSaves()).toBe(first);

    setGuestSave("DD2421", true);
    expect(readGuestSaves()).not.toBe(first);
  });

  it("is stable across reads of an empty store too", () => {
    expect(readGuestSaves()).toBe(readGuestSaves());
  });

  describe("setGuestSave", () => {
    it("adds and removes one course", () => {
      setGuestSave("DD2380", true);
      expect(readGuestSaves()).toEqual(["DD2380"]);

      setGuestSave("DD2380", false);
      expect(readGuestSaves()).toEqual([]);
    });

    it("does not hold the same course twice", () => {
      setGuestSave("DD2380", true);
      setGuestSave("DD2380", true);
      expect(readGuestSaves()).toEqual(["DD2380"]);
    });

    it("ignores an unsave of a course that was never saved", () => {
      setGuestSave("DD2380", true);
      setGuestSave("DD1337", false);
      expect(readGuestSaves()).toEqual(["DD2380"]);
    });
  });

  it("leaves nothing behind once the list is emptied", () => {
    writeGuestSaves(["DD2380"]);
    retireGuestSaves(["DD2380"]);

    expect(readGuestSaves()).toEqual([]);
    expect(window.localStorage.getItem(GUEST_SAVES_KEY)).toBeNull();
  });

  describe("retireGuestSaves", () => {
    it("removes only what it was asked to remove", () => {
      writeGuestSaves(["DD2380", "DD2421", "DD1337"]);

      retireGuestSaves(["DD2380", "DD1337"]);

      expect(readGuestSaves()).toEqual(["DD2421"]);
    });

    /**
     * The regression behind the fix. An import holds a snapshot across awaited
     * account writes; another tab can add to the shared store meanwhile. The
     * subtraction has to be against storage as it is *now*, not against the
     * snapshot, or the newcomer is deleted having never reached an account.
     */
    it("keeps a code another tab added after the snapshot was taken", () => {
      const snapshot = ["DD2380", "DD2421"];
      writeGuestSaves(snapshot);

      // The other tab, mid-import.
      setGuestSave("DD1337", true);

      retireGuestSaves(snapshot);

      expect(readGuestSaves()).toEqual(["DD1337"]);
    });

    it("ignores codes that are not in the list", () => {
      writeGuestSaves(["DD2380"]);

      retireGuestSaves(["DD9999"]);

      expect(readGuestSaves()).toEqual(["DD2380"]);
    });

    it("does nothing, and notifies nobody, when given no codes", () => {
      writeGuestSaves(["DD2380"]);
      const onChange = vi.fn();
      subscribeGuestSaves(onChange);

      retireGuestSaves([]);

      expect(readGuestSaves()).toEqual(["DD2380"]);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("a store written by something else", () => {
    it("ignores unparseable content rather than throwing", () => {
      window.localStorage.setItem(GUEST_SAVES_KEY, "{not json");
      resetGuestSavesCache();

      expect(readGuestSaves()).toEqual([]);
    });

    it("ignores a value that is not a list", () => {
      window.localStorage.setItem(GUEST_SAVES_KEY, '{"DD2380":true}');
      resetGuestSavesCache();

      expect(readGuestSaves()).toEqual([]);
    });

    it("drops entries that are not course codes", () => {
      window.localStorage.setItem(
        GUEST_SAVES_KEY,
        JSON.stringify(["DD2380", 7, null, "", "DD2421"]),
      );
      resetGuestSavesCache();

      expect(readGuestSaves()).toEqual(["DD2380", "DD2421"]);
    });
  });

  // A browser set to block site data throws on access rather than returning
  // null. The page must still render; only the remembering is lost.
  describe("when storage is unavailable", () => {
    it("reads as empty instead of throwing", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });

      expect(() => readGuestSaves()).not.toThrow();
      expect(readGuestSaves()).toEqual([]);
    });

    // Blocked site data throws on both halves, so nothing can be persisted and
    // nothing can be read back. The list then lives in memory for as long as
    // the tab does: saving still works, and a reload is what loses it.
    it("keeps the list for this tab and does not throw", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      const onChange = vi.fn();
      subscribeGuestSaves(onChange);

      expect(() => writeGuestSaves(["DD2380"])).not.toThrow();

      expect(onChange).toHaveBeenCalled();
      expect(readGuestSaves()).toEqual(["DD2380"]);
    });

    // A quota error is the one case where writes fail and reads keep working.
    // The store does not pretend otherwise: storage is the authority, so the
    // save is gone on the next read rather than shown and then lost later.
    it("does not show a save that a full store rejected", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });

      writeGuestSaves(["DD2380"]);

      expect(readGuestSaves()).toEqual([]);
    });
  });

  describe("subscribers", () => {
    it("hears about a write in this tab", () => {
      const onChange = vi.fn();
      const stop = subscribeGuestSaves(onChange);

      setGuestSave("DD2380", true);
      expect(onChange).toHaveBeenCalledTimes(1);

      stop();
      setGuestSave("DD2421", true);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("re-reads storage when another tab writes", () => {
      const onChange = vi.fn();
      subscribeGuestSaves(onChange);
      expect(readGuestSaves()).toEqual([]);

      // The other tab's write, then the event this tab receives for it.
      window.localStorage.setItem(GUEST_SAVES_KEY, JSON.stringify(["DD2380"]));
      window.dispatchEvent(
        new StorageEvent("storage", { key: GUEST_SAVES_KEY }),
      );

      expect(onChange).toHaveBeenCalled();
      expect(readGuestSaves()).toEqual(["DD2380"]);
    });

    it("ignores another key changing", () => {
      const onChange = vi.fn();
      subscribeGuestSaves(onChange);

      window.dispatchEvent(
        new StorageEvent("storage", { key: "something-else" }),
      );

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
