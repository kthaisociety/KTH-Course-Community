"use client";

import { FileText, Info, Upload } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";
import { MAX_TRANSCRIPT_LABEL } from "../api/transcript";

type Props = {
  /** The first read of a transcript, or a re-read over a list that exists. */
  variant: "first" | "update";
  includeGrades: boolean;
  onIncludeGradesChange: (next: boolean) => void;
  /** Handed the chosen file and nothing else. Nothing here keeps it. */
  onFile: (file: File) => void;
  /** "Last read 24 Aug 2026" — only the update flow has one to show. */
  lastReadLine?: string | null;
  /** Offered on the first-read screen: skip the file and type a course in. */
  onAddByHand?: () => void;
  /** Offered in the update dialog. */
  onCancel?: () => void;
};

/**
 * Where a Ladok transcript goes in — `docs/design_ref/2026-09-06/Course Community -
 * Taken Courses.dc.html`, the `isEmpty` screen and the `isUpdateModal` body,
 * which draw the same zone at two sizes.
 *
 * It hands the file up and forgets it. The file never reaches component state,
 * `localStorage` or a log: it is a student's academic record, it is read once
 * on the server, and what comes back is a proposal rather than a row.
 *
 * **The grades switch is not a parse option.** The artboard says grade columns
 * are "left out of the parse", but the parse runs on the server and always
 * reads them; the switch decides what is *kept* when the proposal is confirmed.
 * The copy here says that instead, which is the smallest change that stops the
 * page promising something the server does not do.
 */
export function TranscriptDropZone({
  variant,
  includeGrades,
  onIncludeGradesChange,
  onFile,
  lastReadLine,
  onAddByHand,
  onCancel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const switchId = useId();
  const isFirst = variant === "first";

  function take(file: File | undefined) {
    if (file) onFile(file);
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    take(event.dataTransfer.files[0]);
  }

  return (
    <div className="w-full">
      {isFirst ? (
        <div className="flex items-start gap-2.5 rounded-[10px] bg-cc-pill px-[13px] py-[11px] text-left">
          <Info
            size={15}
            aria-hidden
            className="mt-px flex-none text-cc-dim"
            strokeWidth={2}
          />
          <p className="m-0 text-[12.5px] text-cc-ink2 leading-[1.5]">
            Remember to pick{" "}
            <span className="font-semibold">Resultatintyg</span> in Ladok, and
            make sure course codes are included.
          </p>
        </div>
      ) : (
        <p className="m-0 text-[13.5px] text-cc-muted leading-[1.55]">
          Upload a newer Resultatintyg. Courses already in your list keep the
          edits you made — a re-read updates them rather than adding them twice.
        </p>
      )}

      <div
        className={`mt-3.5 flex items-start justify-between gap-4 ${
          isFirst
            ? "border-cc-rule border-b py-3.5"
            : "rounded-[12px] border border-cc-rule bg-cc-pg p-[15px]"
        }`}
      >
        <div className="min-w-0">
          <label
            htmlFor={switchId}
            className="cursor-pointer font-semibold text-[13.5px]"
          >
            Read grades from transcript
          </label>
          <p className="m-0 mt-[3px] text-[12.5px] text-cc-muted leading-[1.5]">
            {includeGrades
              ? "Grades from the file are kept with your courses when you confirm. Only you can see them."
              : "Grades are dropped when you confirm, so no grade of yours is stored. Credits, names and years are still read."}
          </p>
        </div>
        <button
          type="button"
          id={switchId}
          role="switch"
          aria-checked={includeGrades}
          onClick={() => onIncludeGradesChange(!includeGrades)}
          className={`flex h-6 w-[42px] flex-none cursor-pointer items-center rounded-full p-[3px] transition-colors ${
            includeGrades
              ? "justify-end bg-cc-brand"
              : "justify-start bg-cc-rule3"
          }`}
        >
          <span
            aria-hidden
            className="size-[18px] rounded-full bg-cc-surface shadow-[0_1px_2px_rgba(20,30,45,.28)]"
          />
        </button>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={`mt-5 flex w-full cursor-pointer flex-col items-center rounded-[14px] border-2 border-dashed bg-cc-pill text-center ${
          isFirst ? "px-7 py-10" : "px-[22px] py-[30px]"
        } ${dragging ? "border-cc-brand" : "border-cc-hov"}`}
      >
        <span className="flex size-12 items-center justify-center rounded-[13px] bg-cc-pill text-cc-brand">
          <Upload size={21} strokeWidth={1.9} aria-hidden />
        </span>
        <span className="mt-3.5 font-semibold text-[16px]">
          {dragging
            ? "Drop to start reading"
            : isFirst
              ? "Drop your Ladok transcript here"
              : "Drop the new PDF here"}
        </span>
        <span className="mt-[5px] text-[12.5px] text-cc-muted">
          PDF from Ladok · up to {MAX_TRANSCRIPT_LABEL}
        </span>
        <span className="mt-4 flex h-[38px] items-center gap-2 rounded-[9px] bg-cc-btn px-[15px] font-semibold text-[13px] text-cc-btn-fg">
          <FileText size={14} strokeWidth={2} aria-hidden />
          Choose a PDF
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="Ladok transcript PDF"
        onChange={(event) => {
          take(event.target.files?.[0]);
          // The picker keeps its selection, so choosing the same file twice in
          // a row would not fire again. Clearing it also drops this component's
          // last handle on the file.
          event.target.value = "";
        }}
      />

      <div className="mt-4 flex items-center justify-between gap-3 text-[12.5px]">
        {onAddByHand ? (
          <button
            type="button"
            onClick={onAddByHand}
            className="cursor-pointer font-medium text-cc-brand hover:underline"
          >
            Add courses manually instead
          </button>
        ) : (
          <span className="text-cc-dim">{lastReadLine ?? ""}</span>
        )}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer font-medium text-cc-brand hover:underline"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
