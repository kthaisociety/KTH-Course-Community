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
  GUEST_SAVE_PREFIX,
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
    // One key per course, so nothing is a list that two tabs must rewrite.
    expect(
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith(GUEST_SAVE_PREFIX))
        .sort(),
    ).toEqual([`${GUEST_SAVE_PREFIX}DD2380`, `${GUEST_SAVE_PREFIX}DD2421`]);
  });

  it("has nothing before anything is saved", () => {
    expect(readGuestSaves()).toEqual([]);
  });

  // Key enumeration order is the browser's business, so each save carries a
  // sequence number and the list is sorted by it. Without that the saved list
  // would reorder itself between reloads.
  it("lists courses oldest save first, not in key order", () => {
    setGuestSave("DD2421", true);
    setGuestSave("DD1337", true);
    setGuestSave("DD2380", true);

    expect(readGuestSaves()).toEqual(["DD2421", "DD1337", "DD2380"]);
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
    expect(
      Object.keys(window.localStorage).filter((key) =>
        key.startsWith(GUEST_SAVE_PREFIX),
      ),
    ).toEqual([]);
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
    it("still counts a course whose order marker is nonsense", () => {
      window.localStorage.setItem(`${GUEST_SAVE_PREFIX}DD2380`, "not a number");
      resetGuestSavesCache();

      // The key is the save; the value only orders it. Dropping the course
      // over a bad hint would lose a save to fix a sort.
      expect(readGuestSaves()).toEqual(["DD2380"]);
    });

    it("ignores a key with no course code after the prefix", () => {
      window.localStorage.setItem(GUEST_SAVE_PREFIX, "1");
      resetGuestSavesCache();

      expect(readGuestSaves()).toEqual([]);
    });

    it("ignores keys belonging to anything else", () => {
      window.localStorage.setItem("kth-cc:theme", "dark");
      window.localStorage.setItem(`${GUEST_SAVE_PREFIX}DD2380`, "1");
      resetGuestSavesCache();

      expect(readGuestSaves()).toEqual(["DD2380"]);
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

    // Storage is the authority throughout: a save it refused is not shown as
    // saved. The page keeps working and the reader is not told a fiction.
    it("does not throw, and does not claim a save it could not store", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      const onChange = vi.fn();
      subscribeGuestSaves(onChange);

      expect(() => setGuestSave("DD2380", true)).not.toThrow();

      expect(onChange).toHaveBeenCalled();
      expect(readGuestSaves()).toEqual([]);
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

  /**
   * Every mutation is a read-modify-write over one shared key. Two of those
   * interleaving lose whichever read first, and the loss that matters is a
   * save — a lost retirement just leaves a course to be offered again.
   */
  /**
   * The finding this layout answers, three rounds of review on #194. With the
   * list under one key every change was a read-modify-write over shared
   * storage, so two tabs mutating at once lost whichever read first — and the
   * write that lost was somebody's saved course. Per-course keys mean no
   * mutation reads anything, so there is nothing to lose.
   */
  describe("concurrent tabs", () => {
    it("keeps a save another tab made, while this one saves", () => {
      writeGuestSaves(["DD2380"]);
      readGuestSaves();

      // The other tab, with no `storage` event delivered here yet.
      window.localStorage.setItem(
        `${GUEST_SAVE_PREFIX}DD1337`,
        String(Date.now() + 1000),
      );

      setGuestSave("DD2421", true);

      // Order is the other test's business; this one is about survival.
      expect([...readGuestSaves()].sort()).toEqual([
        "DD1337",
        "DD2380",
        "DD2421",
      ]);
    });

    it("keeps a save another tab made, while this one retires an import", () => {
      writeGuestSaves(["DD2380"]);
      readGuestSaves();

      window.localStorage.setItem(
        `${GUEST_SAVE_PREFIX}DD1337`,
        String(Date.now() + 1000),
      );

      retireGuestSaves(["DD2380"]);

      expect(readGuestSaves()).toEqual(["DD1337"]);
    });

    it("keeps a save another tab made, while this one unsaves", () => {
      writeGuestSaves(["DD2380"]);
      readGuestSaves();

      window.localStorage.setItem(
        `${GUEST_SAVE_PREFIX}DD1337`,
        String(Date.now() + 1000),
      );

      setGuestSave("DD2380", false);

      expect(readGuestSaves()).toEqual(["DD1337"]);
    });

    // No mutation reads the list, so there is no window between a read and a
    // write for another tab to slip into, and no lock needed to close one.
    it("never reads the list in order to change it", () => {
      writeGuestSaves(["DD2380"]);
      const reads = vi.spyOn(Storage.prototype, "getItem");

      setGuestSave("DD2421", true);
      setGuestSave("DD2380", false);
      retireGuestSaves(["DD2421"]);

      expect(reads).not.toHaveBeenCalled();
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
      window.localStorage.setItem(`${GUEST_SAVE_PREFIX}DD2380`, "1");
      window.dispatchEvent(
        new StorageEvent("storage", { key: `${GUEST_SAVE_PREFIX}DD2380` }),
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
