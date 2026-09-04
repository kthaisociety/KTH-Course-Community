"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebouncedQuery, useSearchCourses } from "@/features/search";
import { creditsLabel, type TakenEdits } from "../lib/taken-rows";

/** The credits a KTH course usually carries, as the artboard's own chips. */
const CREDIT_CHOICES = [6, 7.5, 9, 15];

/** The grades a KTH transcript prints. Self-reported, so nothing validates them. */
const GRADES = ["A", "B", "C", "D", "E", "F", "P"];

type Picked = { courseCode: string; name: string; credits: number | null };

type Props = {
  open: boolean;
  /** Course codes already on the list, so the picker cannot offer one twice. */
  takenCourseCodes: readonly string[];
  onClose: () => void;
  /**
   * Records the course. Rejecting is how the parent says the write did not
   * land: the dialog stays open holding the draft, so nothing the reader typed
   * has to be typed twice.
   */
  onAdd: (courseCode: string, edits: TakenEdits) => Promise<void>;
};

/**
 * Adding one course to the list by hand — the artboard's "Add a course by hand"
 * modal.
 *
 * **The course has to be one the catalogue has.** The artboard offers a
 * free-form course with no code ("Add ... as a free-form course"), and the
 * schema cannot hold one: `user_taken_courses.course_code` is a foreign key to
 * `courses.code`, so a row with no catalogue course has nowhere to be stored.
 * The code and name fields are therefore filled from a catalogue search rather
 * than typed, and the free-form path is gone; everything else about the form —
 * the credit chips, the year box, the grade chips — is the artboard's.
 *
 * The grade chips are shown always, where the artboard shows them only when its
 * transcript switch is on. That switch decides what an *import* keeps; a course
 * being typed in by hand has no transcript to keep a grade from.
 */
export function AddTakenCourseDialog({
  open,
  takenCourseCodes,
  onClose,
  onAdd,
}: Props) {
  const [query, setQuery] = useState("");
  const [debounced] = useDebouncedQuery(query);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [year, setYear] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const search = useSearchCourses({ q: debounced });
  const results = search.data?.results ?? [];
  const alreadyTaken = new Set(takenCourseCodes);

  function reset() {
    setQuery("");
    setPicked(null);
    setCredits(null);
    setGrade(null);
    setYear("");
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    if (!picked || isSaving) return;
    const parsedYear = /^\d{4}$/.test(year) ? Number(year) : null;
    setIsSaving(true);
    try {
      await onAdd(picked.courseCode, {
        grade,
        earnedCredits: credits,
        attendanceYear: parsedYear,
      });
      reset();
      onClose();
    } catch {
      // The parent has already said so. The draft stays where it is.
    } finally {
      setIsSaving(false);
    }
  }

  const creditChoices = [
    ...new Set(
      picked?.credits != null
        ? [picked.credits, ...CREDIT_CHOICES]
        : CREDIT_CHOICES,
    ),
  ].sort((a, b) => a - b);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[rgba(14,26,44,0.34)] supports-backdrop-filter:backdrop-blur-none"
        className="cc-theme w-[560px] max-w-[calc(100vw-2rem)] gap-0 rounded-[14px] border-cc-rule2 bg-cc-surface p-[22px] text-cc-ink shadow-[0_18px_48px_rgba(20,30,45,0.26)]"
      >
        <div className="flex items-start justify-between gap-3.5">
          <div>
            <p className="m-0 font-semibold text-[11px] text-cc-brand uppercase tracking-[0.06em]">
              Add missing course
            </p>
            <DialogTitle className="mt-[7px] font-semibold text-[19px] leading-[1.25]">
              Add a course by hand
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cancel"
            className="flex size-7 flex-none cursor-pointer items-center justify-center rounded-[7px] text-[18px] text-cc-dim leading-none hover:bg-cc-pill"
          >
            ×
          </button>
        </div>
        <DialogDescription className="sr-only">
          Find a course in the KTH catalogue and record the credits, grade and
          year you got for it.
        </DialogDescription>

        <div className="mt-3.5">
          <span className="font-medium text-[11.5px] text-cc-dim">
            Search the KTH catalogue
          </span>
          <div className="mt-1.5 flex h-[42px] items-center gap-2.5 rounded-[9px] border border-cc-rule3 bg-cc-surface px-[13px]">
            <Search
              size={16}
              strokeWidth={2}
              aria-hidden
              className="flex-none text-cc-dim"
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPicked(null);
              }}
              placeholder="Course code or name, e.g. DD2421"
              aria-label="Search the KTH catalogue"
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-cc-ink outline-none"
            />
          </div>
        </div>

        {picked === null && debounced.trim() !== "" ? (
          <div className="mt-2 overflow-hidden rounded-[10px] border border-cc-rule">
            {search.isPending ? (
              <p className="m-0 bg-cc-pg px-3.5 py-[13px] text-[13px] text-cc-muted">
                Searching…
              </p>
            ) : results.length === 0 ? (
              <p className="m-0 bg-cc-pg px-3.5 py-[13px] text-[13px] text-cc-muted">
                Nothing in the catalogue matches “{debounced}”. Only courses KTH
                has can be added — there is no way to record one that is not in
                the catalogue.
              </p>
            ) : (
              <ul className="m-0 flex max-h-[220px] list-none flex-col overflow-y-auto p-0">
                {results.map((course) => {
                  const isTaken = alreadyTaken.has(course.courseCode);
                  return (
                    <li key={course.courseCode} className="m-0">
                      <button
                        type="button"
                        disabled={isTaken}
                        onClick={() => {
                          setPicked({
                            courseCode: course.courseCode,
                            name: course.titleEng,
                            credits: course.credits ?? null,
                          });
                          setCredits(course.credits ?? null);
                        }}
                        className="flex w-full cursor-pointer items-center gap-[11px] border-cc-rule border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-cc-pill disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent"
                      >
                        <span className="w-[74px] flex-none font-medium font-mono text-[12.5px] text-cc-brand">
                          {course.courseCode}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px]">
                          {course.titleEng}
                        </span>
                        <span className="flex-none text-[12.5px] text-cc-dim">
                          {isTaken
                            ? "In your list"
                            : creditsLabel(course.credits ?? null)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {picked ? (
          <>
            <div className="mt-3.5 flex items-center gap-[11px] rounded-[10px] bg-cc-pill px-3 py-2.5">
              <span className="font-medium font-mono text-[12.5px] text-cc-brand">
                {picked.courseCode}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px]">
                {picked.name}
              </span>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <fieldset className="m-0 min-w-0 border-none p-0">
                <legend className="font-medium text-[11.5px] text-cc-dim">
                  Credits (hp)
                </legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {creditChoices.map((choice) => (
                    <Chip
                      key={choice}
                      on={credits === choice}
                      label={String(choice)}
                      onClick={() =>
                        setCredits(credits === choice ? null : choice)
                      }
                    />
                  ))}
                </div>
              </fieldset>
              <div className="min-w-0">
                <label
                  htmlFor="taken-add-year"
                  className="font-medium text-[11.5px] text-cc-dim"
                >
                  Year
                </label>
                <input
                  id="taken-add-year"
                  value={year}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="2025"
                  onChange={(event) =>
                    setYear(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  className="mt-1.5 box-border h-[34px] w-full rounded-[8px] border border-cc-rule3 bg-cc-surface px-[11px] text-[13px] text-cc-ink tabular-nums outline-none focus:border-cc-brand"
                />
              </div>
            </div>

            <fieldset className="m-0 mt-3.5 border-none p-0">
              <legend className="font-medium text-[11.5px] text-cc-dim">
                Grade
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {GRADES.map((option) => (
                  <Chip
                    key={option}
                    on={grade === option}
                    label={option}
                    onClick={() => setGrade(grade === option ? null : option)}
                  />
                ))}
                <Chip
                  on={grade === null}
                  label="no grade"
                  onClick={() => setGrade(null)}
                />
              </div>
            </fieldset>
          </>
        ) : null}

        <div className="mt-[18px] flex items-center justify-between gap-3 border-cc-rule border-t pt-3.5">
          <p className="m-0 text-[12px] text-cc-dim2">
            Credits, grade and year are your own entries, not a KTH record.
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={close}
              className="flex h-[38px] cursor-pointer items-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-3.5 font-medium text-[13px] text-cc-chip-ink hover:border-cc-hov"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={picked === null || isSaving}
              className="flex h-[38px] cursor-pointer items-center rounded-[9px] bg-cc-btn px-4 font-semibold text-[13px] text-cc-btn-fg hover:opacity-[0.88] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isSaving ? "Adding…" : "Add course"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Chip({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-[34px] cursor-pointer items-center rounded-[8px] border px-3 text-[13px] tabular-nums hover:border-cc-brand ${
        on
          ? "border-cc-brand bg-cc-pill font-semibold text-cc-brand"
          : "border-cc-rule3 bg-cc-surface font-medium text-cc-muted"
      }`}
    >
      {label}
    </button>
  );
}
