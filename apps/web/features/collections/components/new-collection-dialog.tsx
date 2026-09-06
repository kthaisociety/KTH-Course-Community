"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CourseCardCourse } from "@/features/courses";

type Props = {
  open: boolean;
  /**
   * The only courses the dialog may offer.
   *
   * A course may only join a collection its owner has also saved, so the list is
   * built from the saved codes rather than filtered for them — nothing here can
   * offer an unsaved course and leave the server to refuse it.
   */
  savedCourses: readonly CourseCardCourse[];
  onClose: () => void;
  onCreate: (name: string, courseCodes: string[]) => void;
};

/**
 * Naming a new collection and choosing which saved courses start in it.
 *
 * The draft lives here and dies with the dialog, so a cancelled name is never
 * offered back the next time it opens.
 */
export function NewCollectionDialog({
  open,
  savedCourses,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");

  function reset() {
    setName("");
    setQuery("");
    setPicked([]);
    setError("");
  }

  function close() {
    reset();
    onClose();
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give this collection a name");
      return;
    }
    const courseCodes = picked;
    reset();
    onClose();
    onCreate(trimmed, courseCodes);
  }

  const needle = query.trim().toLowerCase();
  const matches = savedCourses.filter(
    (course) =>
      !needle ||
      `${course.courseCode} ${course.titleEng}`.toLowerCase().includes(needle),
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        showCloseButton={false}
        className="cc-theme w-[440px] max-w-[calc(100vw-2rem)] gap-0 rounded-[14px] bg-cc-surface p-[22px] text-cc-ink shadow-[0_18px_48px_rgba(20,30,45,0.26)]"
      >
        <div className="flex items-center justify-between gap-3">
          <DialogTitle className="font-semibold text-[18px]">
            New collection
          </DialogTitle>
          <button
            type="button"
            onClick={close}
            aria-label="Cancel"
            className="flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] text-[17px] text-cc-dim leading-none hover:bg-cc-pill"
          >
            ×
          </button>
        </div>
        <DialogDescription className="sr-only">
          Name a collection and pick which of your saved courses start in it.
        </DialogDescription>

        <input
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          placeholder="Collection name"
          aria-label="Collection name"
          className="mt-3.5 box-border h-[38px] w-full rounded-[9px] border border-cc-rule3 bg-cc-surface px-3 text-[13.5px] text-cc-ink outline-none focus:border-cc-brand"
        />

        {savedCourses.length > 0 ? (
          <>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter saved courses"
              aria-label="Filter saved courses"
              className="mt-2 box-border h-[34px] w-full rounded-[9px] border border-cc-rule bg-cc-inset px-3 text-[12.5px] text-cc-ink outline-none focus:border-cc-brand"
            />
            <div className="scrollbar-subtle mt-2.5 max-h-[210px] overflow-auto rounded-[9px] border border-cc-rule">
              {matches.map((course) => {
                const checked = picked.includes(course.courseCode);
                return (
                  <label
                    key={course.courseCode}
                    className="flex w-full cursor-pointer items-center gap-2.5 border-cc-rule border-b px-[11px] py-[9px] text-left last:border-b-0 hover:bg-cc-inset"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setPicked((current) =>
                          checked
                            ? current.filter(
                                (code) => code !== course.courseCode,
                              )
                            : [...current, course.courseCode],
                        )
                      }
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={`flex size-4 flex-none items-center justify-center rounded-[4px] border ${
                        checked
                          ? "border-cc-brand bg-cc-brand text-cc-btn-fg"
                          : "border-cc-rule3"
                      }`}
                    >
                      {checked ? <Check size={11} /> : null}
                    </span>
                    <span className="font-mono text-[11.5px] text-cc-dim">
                      {course.courseCode}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {course.titleEng}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div className="text-[12px] text-cc-muted">
                {picked.length} selected
              </div>
              {error ? (
                <div
                  role="alert"
                  className="font-medium text-[12px] text-cc-danger"
                >
                  {error}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="mt-2.5 rounded-[9px] border border-cc-rule bg-cc-inset px-[13px] py-[11px] text-[12.5px] text-cc-muted">
            You have no saved courses yet. Name the collection now and add
            courses to it once you have saved some — a collection can only hold
            courses you have saved.
            {error ? (
              <div role="alert" className="mt-2 font-medium text-cc-danger">
                {error}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-3.5 flex gap-2">
          <button
            type="button"
            onClick={submit}
            className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-[9px] bg-cc-btn font-semibold text-[13.5px] text-cc-btn-fg hover:opacity-[0.88]"
          >
            Create collection
          </button>
          <button
            type="button"
            onClick={close}
            className="flex h-10 cursor-pointer items-center justify-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-4 font-medium text-[13.5px] text-cc-ink hover:border-cc-hov"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
