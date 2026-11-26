"use client";

import { ExternalLink, Plus, TriangleAlert } from "lucide-react";
import { type Slot, slotLabel } from "../lib/slots";
import { StatusPill } from "./status-pill";

export type CatchUpCourse = {
  code: string;
  title: string;
  /** Later courses in the plan that ask for it first. */
  neededBy: string[];
  /** The first period still to come that it's given in: before the first of those where it can be. */
  slot: Slot | null;
  /** Given only after the first course that needs it starts, which then has to move. */
  late: boolean;
};

type Props = {
  /** The open entrance, e.g. "COPEN", and the programme continued in, e.g. "CDATE". */
  open: string;
  next: string;
  intake: string;
  courses: CatchUpCourse[];
  onPlace: (code: string, slot: Slot) => void;
  onShow: (code: string) => void;
};

/**
 * What an open-entrance student has to catch up on: the courses of the
 * continuation's own year 1, which the open entrance's year 1 replaced, that
 * later courses in the plan ask for. Read from those courses' prerequisites,
 * so it names what blocks the plan; KTH's transition plan (övergångsplan) for
 * the student's cohort is the authority on which to take, and when.
 */
export function CatchUpCard({
  open,
  next,
  intake,
  courses,
  onPlace,
  onShow,
}: Props) {
  if (!courses.length) return null;
  return (
    <section
      aria-labelledby="sp-catch-up"
      className="rounded-[16px] border border-cc-rule bg-cc-surface px-5 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          id="sp-catch-up"
          className="font-semibold text-[14px] text-cc-ink leading-snug"
        >
          Catching up from {open}
        </h3>
        <StatusPill tone="warn" icon={TriangleAlert}>
          {courses.length} to add
        </StatusPill>
      </div>
      <p className="mt-0.5 text-[12px] text-cc-muted leading-snug">
        {`Prerequisites for courses still ahead in your plan. They're in ${next}'s year 1, which ${open} replaces.`}
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {courses.map((c) => (
          <li key={c.code} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onShow(c.neededBy[0])}
              className="min-w-0 flex-1 cursor-pointer text-left"
            >
              <span className="flex items-baseline gap-2">
                <span className="shrink-0 font-mono text-[11.5px] text-cc-brand">
                  {c.code}
                </span>
                <span className="truncate text-[13px] text-cc-ink">
                  {c.title}
                </span>
              </span>
              <span className="block truncate text-[11.5px] text-cc-muted">
                Needed by {c.neededBy.slice(0, 3).join(", ")}
                {c.neededBy.length > 3
                  ? ` and ${c.neededBy.length - 3} more`
                  : ""}
                {c.late ? ` · given too late for ${c.neededBy[0]}` : ""}
              </span>
            </button>
            {c.slot ? (
              <button
                type="button"
                onClick={() => c.slot && onPlace(c.code, c.slot)}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-cc-btn px-3 font-medium text-[12px] text-cc-btn-fg hover:opacity-90"
              >
                <Plus aria-hidden size={13} strokeWidth={2.4} />
                {slotLabel(c.slot)}
              </button>
            ) : (
              <span className="shrink-0 text-[11.5px] text-cc-muted">
                Dates unknown
              </span>
            )}
          </li>
        ))}
      </ul>
      <a
        href={`https://www.kth.se/student/kurser/program/${encodeURIComponent(open)}/${encodeURIComponent(intake)}/genomforande`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-[12px] text-cc-brand underline-offset-2 hover:underline"
      >
        How {open}'s transition plan works (KTH, Swedish)
        <ExternalLink aria-hidden size={12} />
      </a>
    </section>
  );
}
