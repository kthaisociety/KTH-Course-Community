"use client";

import { CircleCheck, FileWarning, Info, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMe, useRequireSession } from "@/features/auth";
import { useCourseSummaries, useTakenCourses } from "@/features/courses";
import {
  Review,
  UnreviewedCard,
  useUnreviewedTakenCourses,
} from "@/features/reviews";
import { PageColumn, PageHeader } from "@/features/shell";
import type { TranscriptProposal } from "@/server/ingest/transcript/service";
import { useTakenMutations } from "../api/mutations";
import { uploadTranscript } from "../api/transcript";
import {
  lastTranscriptImport,
  type TakenEdits,
  type TakenRow,
  takenUpdateInput,
  toConfirmedCourses,
  toTakenRows,
} from "../lib/taken-rows";
import { AddTakenCourseDialog } from "./add-taken-course-dialog";
import { TAKEN_GRID, TakenCourseRow } from "./taken-course-row";
import { TranscriptDropZone } from "./transcript-drop-zone";
import { TranscriptProposalReview } from "./transcript-proposal";

const READ_FAILED_TITLE = "We could not read that transcript";

const COLUMNS = [
  "Code",
  "Course",
  "Credits",
  "Grade",
  "Year",
  "Reviewed",
  "Actions",
] as const;

/** "24 Aug 2026", as the artboard prints it. */
function readDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function importedSummary(result: {
  inserted: number;
  updated: number;
}): string {
  const parts: string[] = [];
  if (result.inserted > 0) {
    parts.push(
      result.inserted === 1 ? "1 new course" : `${result.inserted} new courses`,
    );
  }
  if (result.updated > 0) {
    parts.push(
      result.updated === 1
        ? "1 course updated"
        : `${result.updated} courses updated`,
    );
  }
  return parts.length > 0
    ? `Transcript saved — ${parts.join(", ")}`
    : "Transcript read — nothing new in it";
}

/**
 * The reader's taken courses — `docs/design/Course Community - Taken
 * Courses.dc.html`.
 *
 * Four things about this screen are worth knowing before changing it.
 *
 * **A taken course has no title and no verdict.** `user_taken_courses` stores a
 * course code plus self-reported grade, credits, attendance and provenance.
 * Names are looked up here through `course.summary`; nothing on a row is a
 * review, and the Reviewed column reads the viewer's reviews rather than
 * anything on the row. Saving, taking and reviewing are three independent
 * relationships and this page never lets one stand in for another.
 *
 * **Nothing a transcript says is written until the reader confirms it.**
 * `POST /api/user/transcript` parses and returns a proposal; `transcript.confirm`
 * is the only write, and it upserts on `(userId, courseCode)` so a second read
 * of the same file updates rather than duplicates. The file itself is handed to
 * `uploadTranscript` and never kept — not in state, not in a cache, never in
 * `localStorage`.
 *
 * **Course codes the catalogue does not have are reported, not invented.**
 * They come back on the proposal as `unmatched` and are named on the confirm
 * screen. This page offers no way to create the missing course, because
 * `user_taken_courses.course_code` is a foreign key to `courses.code`.
 *
 * **The reviewer is the review form, not a second one.** The artboard draws a
 * bespoke card stack asking the same six questions the review dialog already
 * asks; building it would give a review two write paths and two validators.
 * `UnreviewedCard`'s `onSelect` and `onStart` fill a queue instead, and each
 * course opens `Review` in place — see the PR for the deviation.
 */
export function TakenCourses() {
  useRequireSession();
  const { isLoading: isSessionLoading } = useMe();
  const { data: taken, isPending } = useTakenCourses(!isSessionLoading);
  const { add, update, remove, confirmImport } = useTakenMutations();

  const takenCourses = taken ?? [];
  const courseCodes = takenCourses.map((course) => course.courseCode);
  const summaries = useCourseSummaries(courseCodes, !isSessionLoading);
  const names = new Map(
    summaries.flatMap((query) =>
      query.data ? [[query.data.courseCode, query.data.titleEng] as const] : [],
    ),
  );
  const rows = toTakenRows(takenCourses, names);

  const {
    courses: unreviewed,
    isLoading: isReviewsLoading,
    isUnavailable: areReviewsUnavailable,
  } = useUnreviewedTakenCourses();
  // A course is "not reviewed" only once every review list has arrived. While
  // they are in flight, or when one failed, the column says nothing rather than
  // marking everything done.
  const reviewsKnown = !isReviewsLoading && !areReviewsUnavailable;
  const unreviewedCodes = new Set(
    unreviewed.map((course) => course.courseCode),
  );

  const [addOpen, setAddOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [includeGrades, setIncludeGrades] = useState(false);
  const [proposal, setProposal] = useState<TranscriptProposal | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);

  const reviewing = reviewQueue[0] ?? null;
  const lastImport = lastTranscriptImport(takenCourses);
  const isBusy = update.isPending || remove.isPending || add.isPending;

  /**
   * Reads one transcript. The file is a parameter and never becomes state, so
   * it is unreferenced the moment the request has been built — which is the
   * whole point: it is a student's academic record and this page may not keep
   * it. What is kept, until the reader confirms or discards it, is the
   * proposal, which holds no file and writes nothing.
   */
  async function readTranscript(file: File) {
    setUpdateOpen(false);
    setReadError(null);
    setConfirmError(null);
    setBanner(null);
    setIsReading(true);
    try {
      setProposal(await uploadTranscript(file));
    } catch (error) {
      setReadError(
        error instanceof Error && error.message
          ? error.message
          : "The file could not be read.",
      );
    } finally {
      setIsReading(false);
    }
  }

  async function confirmProposal() {
    if (!proposal) return;
    setConfirmError(null);
    try {
      const result = await confirmImport.mutateAsync({
        courses: toConfirmedCourses(proposal.candidates, includeGrades),
      });
      setProposal(null);
      setBanner(importedSummary(result));
    } catch (error) {
      setConfirmError(
        error instanceof Error && error.message
          ? error.message
          : "That import did not reach the server.",
      );
    }
  }

  function addCourse(courseCode: string, edits: TakenEdits) {
    add
      .mutateAsync({ courseCode, ...edits })
      .catch(() => toast.error(`Could not add ${courseCode} to your courses.`));
  }

  /**
   * Puts a removed row back exactly as it was, periods included — the row is
   * the whole record, not the three fields the table happens to show.
   */
  function restoreCourse(row: TakenRow) {
    add
      .mutateAsync({
        courseCode: row.courseCode,
        grade: row.grade,
        earnedCredits: row.earnedCredits,
        attendancePeriods: row.attendancePeriods,
        attendanceYear: row.attendanceYear,
      })
      .catch(() =>
        toast.error(`Could not put ${row.courseCode} back in your courses.`),
      );
  }

  function saveEdits(row: TakenRow, edits: TakenEdits) {
    update
      .mutateAsync(takenUpdateInput(row, edits))
      .catch(() => toast.error(`Could not save your changes to ${row.name}.`));
  }

  function removeCourse(row: TakenRow) {
    remove
      .mutateAsync({ courseCode: row.courseCode })
      .then(() => {
        // Undo is offered only for a row nobody imported. Putting an imported
        // row back would go through `taken.add`, which writes no
        // `transcript_imported_at` — the course would come back quietly
        // re-labelled as hand-entered, and nothing in the API can set that
        // column back to what it was.
        toast.success(`Removed ${row.courseCode}`, {
          action: row.transcriptImportedAt
            ? undefined
            : { label: "Undo", onClick: () => restoreCourse(row) },
        });
      })
      .catch(() =>
        toast.error(`Could not remove ${row.courseCode} from your courses.`),
      );
  }

  function screen() {
    if (isSessionLoading || isPending) return <ListSkeleton />;

    if (proposal) {
      return (
        <TranscriptProposalReview
          proposal={proposal}
          includeGrades={includeGrades}
          isConfirming={confirmImport.isPending}
          error={confirmError}
          onConfirm={() => void confirmProposal()}
          onCancel={() => {
            setProposal(null);
            setConfirmError(null);
          }}
        />
      );
    }

    if (isReading) return <ReadingTranscript />;

    if (readError) {
      return (
        <ReadFailed
          message={readError}
          onRetry={() => setReadError(null)}
          onAddByHand={() => {
            setReadError(null);
            setAddOpen(true);
          }}
        />
      );
    }

    if (rows.length === 0) {
      return (
        <div className="flex justify-center px-5 pt-3.5 pb-10">
          <div className="w-full max-w-[480px]">
            <TranscriptDropZone
              variant="first"
              includeGrades={includeGrades}
              onIncludeGradesChange={setIncludeGrades}
              onFile={(file) => void readTranscript(file)}
              onAddByHand={() => setAddOpen(true)}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-w-0 flex-1 flex-col px-5">
        <div className="border-cc-rule border-b pt-5 pb-[18px]">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <p className="m-0 text-[13.5px] text-cc-muted">
              <span className="font-semibold text-cc-ink tabular-nums">
                {rows.length}
              </span>{" "}
              {rows.length === 1 ? "course" : "courses"}
            </p>
            <div className="flex min-w-0 flex-col items-end gap-1.5">
              <button
                type="button"
                onClick={() => setUpdateOpen(true)}
                className="flex h-[38px] cursor-pointer items-center gap-2 rounded-[9px] border border-cc-rule3 bg-cc-surface px-3.5 font-medium text-[13px] text-cc-chip-ink hover:border-cc-hov"
              >
                <RefreshCw size={15} strokeWidth={1.9} aria-hidden />
                Update transcript
              </button>
              <span className="whitespace-nowrap text-[12px] text-cc-dim2">
                {lastImport
                  ? `Last read ${readDate(lastImport)}`
                  : "Added by hand"}
              </span>
            </div>
          </div>

          {banner ? (
            <output className="mt-4 flex items-start gap-[11px] rounded-[11px] border border-cc-success/40 bg-cc-surface px-[15px] py-[13px]">
              <CircleCheck
                size={16}
                strokeWidth={2.1}
                aria-hidden
                className="mt-px flex-none text-cc-success"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[13.5px] text-cc-success">
                  {banner}
                </span>
                <span className="mt-1 block text-[12.5px] text-cc-muted leading-[1.5]">
                  Courses already in your list kept the edits you made.
                </span>
              </span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                aria-label="Dismiss"
                className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-[6px] text-[16px] text-cc-success leading-none"
              >
                ×
              </button>
            </output>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-[18px] pt-[18px]">
          {reviewsKnown ? (
            <UnreviewedCard
              courses={unreviewed.map((course) => ({
                code: course.courseCode,
                name: names.get(course.courseCode),
              }))}
              line={
                unreviewed.length === 1
                  ? "You have 1 unreviewed course."
                  : `You have ${unreviewed.length} unreviewed courses.`
              }
              onStart={() =>
                setReviewQueue(unreviewed.map((course) => course.courseCode))
              }
              onSelect={(courseCode) => setReviewQueue([courseCode])}
            />
          ) : null}

          <div className="overflow-x-auto overflow-y-hidden rounded-[12px] border border-cc-rule bg-cc-surface">
            <div
              className={`${TAKEN_GRID} border-cc-rule border-b bg-cc-pg px-4 py-3.5 font-semibold text-[11px] text-cc-dim uppercase tracking-[0.06em]`}
            >
              {COLUMNS.map((column) => (
                <div
                  key={column}
                  className={column === "Actions" ? "text-right" : undefined}
                >
                  {column}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="m-px flex w-[calc(100%-2px)] min-w-[600px] cursor-pointer items-center gap-2.5 rounded-[9px] border border-cc-brand/40 border-dashed bg-cc-brand/6 px-[15px] py-[11px] text-cc-brand hover:border-cc-brand hover:bg-cc-brand/11"
            >
              <Plus size={15} strokeWidth={2} aria-hidden />
              <span className="font-medium text-[13.5px]">
                Add a course by hand
              </span>
            </button>

            {rows.map((row) => (
              <TakenCourseRow
                key={row.courseCode}
                row={row}
                isReviewed={
                  reviewsKnown ? !unreviewedCodes.has(row.courseCode) : null
                }
                isBusy={isBusy}
                onSave={(edits) => saveEdits(row, edits)}
                onRemove={() => removeCourse(row)}
              />
            ))}
          </div>
        </div>

        <p className="m-0 flex items-center gap-2 pt-[18px] pb-[26px] text-[11.5px] text-cc-dim2">
          <Info size={13} strokeWidth={1.9} aria-hidden className="flex-none" />
          Course Community is run by KTH AI Society, a student organisation.
          Credits and grades shown here are your own entries — not an official
          KTH record.
        </p>
      </div>
    );
  }

  return (
    <PageColumn>
      <PageHeader title="Taken courses" subtitle="Your completed courses." />
      {screen()}

      <AddTakenCourseDialog
        open={addOpen}
        takenCourseCodes={courseCodes}
        onClose={() => setAddOpen(false)}
        onAdd={addCourse}
      />

      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-[rgba(14,26,44,0.34)] supports-backdrop-filter:backdrop-blur-none"
          className="cc-theme w-[460px] max-w-[calc(100vw-2rem)] gap-0 rounded-[14px] border-cc-rule2 bg-cc-surface p-[22px] text-cc-ink shadow-[0_18px_48px_rgba(20,30,45,0.26)]"
        >
          <DialogTitle className="font-semibold text-[19px] leading-[1.25]">
            Read a newer transcript
          </DialogTitle>
          <DialogDescription className="sr-only">
            Upload a newer Ladok Resultatintyg. Nothing is saved until you
            confirm what it read.
          </DialogDescription>
          <div className="mt-3.5">
            <TranscriptDropZone
              variant="update"
              includeGrades={includeGrades}
              onIncludeGradesChange={setIncludeGrades}
              onFile={(file) => void readTranscript(file)}
              lastReadLine={
                lastImport ? `Last read ${readDate(lastImport)}` : null
              }
              onCancel={() => setUpdateOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {reviewing ? (
        <Review
          key={reviewing}
          courseCode={reviewing}
          openOnLoad
          triggerless
          onClose={() => setReviewQueue((queue) => queue.slice(1))}
        />
      ) : null}
    </PageColumn>
  );
}

/** The artboard's `isParsing` screen. Nothing has been written at this point. */
function ReadingTranscript() {
  return (
    <div className="flex justify-center px-5 pt-[30px] pb-10">
      <div className="w-full max-w-[520px]">
        <h2 className="m-0 font-semibold text-[22px] leading-[1.2] tracking-[-0.015em]">
          Reading your transcript
        </h2>
        <p className="m-0 mt-2 text-[13.5px] text-cc-muted">
          Nothing is saved until you confirm.
        </p>
        <output
          aria-label="Reading your transcript"
          className="mt-5 block h-1.5 overflow-hidden rounded-full bg-cc-pill"
        >
          <span className="block h-full w-1/3 animate-pulse rounded-full bg-cc-btn" />
        </output>
      </div>
    </div>
  );
}

/**
 * The artboard's `isFailed` screen. It says outright that nothing was saved,
 * because nothing was: the parse is a read and the write is a separate call
 * that this path never reaches.
 */
function ReadFailed({
  message,
  onRetry,
  onAddByHand,
}: {
  message: string;
  onRetry: () => void;
  onAddByHand: () => void;
}) {
  return (
    <div className="flex justify-center px-5 pt-[18px] pb-10">
      <div className="w-full max-w-[620px]">
        <div className="flex items-center gap-2.5">
          <span className="flex size-[26px] items-center justify-center rounded-full bg-cc-danger/12 text-cc-danger">
            <FileWarning size={15} strokeWidth={2.2} aria-hidden />
          </span>
          <p className="m-0 font-semibold text-[11px] text-cc-danger uppercase tracking-[0.09em]">
            Reading failed
          </p>
        </div>
        <h2 className="m-0 mt-3 font-semibold text-[22px] leading-[1.2] tracking-[-0.015em]">
          {READ_FAILED_TITLE}
        </h2>
        <p
          role="alert"
          className="m-0 mt-2 text-[14px] text-cc-muted leading-[1.55]"
        >
          {message}
        </p>
        <p className="m-0 mt-4 flex items-center gap-3 rounded-[12px] border border-cc-danger/30 bg-cc-surface px-4 py-3.5 text-[13px] text-cc-ink2">
          <span className="flex-1">
            Download the certificate straight from Ladok rather than scanning it
            — if no text selects in the PDF, it is a scan and there is nothing
            to read.
          </span>
          <span className="flex-none font-medium text-[12.5px] text-cc-danger">
            Nothing was saved
          </span>
        </p>
        <div className="mt-[18px] flex items-center gap-[11px]">
          <button
            type="button"
            onClick={onRetry}
            className="flex h-11 cursor-pointer items-center rounded-[9px] bg-cc-btn px-5 font-semibold text-[14px] text-cc-btn-fg hover:opacity-[0.88]"
          >
            Try another file
          </button>
          <button
            type="button"
            onClick={onAddByHand}
            className="flex h-11 cursor-pointer items-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-4 font-medium text-[13.5px] text-cc-chip-ink hover:border-cc-hov"
          >
            Add courses manually
          </button>
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden className="px-5 pt-5">
      <div className="h-[300px] animate-pulse rounded-[12px] border border-cc-rule bg-cc-surface" />
    </div>
  );
}
