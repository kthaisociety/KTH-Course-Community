"use client";

import { Check, Minus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  type ConfirmRequest,
} from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { useLogout } from "@/features/auth";
import { useClearStoredGrades, useDeleteAccount } from "../api/mutations";
import type { TakenCourse } from "../api/queries";

/**
 * The two questions this section can ask, keyed by the state that asks them.
 *
 * Hoisted because `confirming` already names which one is open, so a lookup is
 * the whole of the branching — and because the account question is the most
 * destructive in the app and its wording should be readable without stepping
 * through JSX to find it.
 *
 * Both are deliberate deviations from the artboard, which removes and then
 * offers a note: `user.delete` cascades across taken courses, collections,
 * reviews and votes, and clearing grades drops every value read from a
 * transcript. Neither has an undo to offer once it has run (#155).
 */
const CONFIRMATIONS: Record<"grades" | "account", ConfirmRequest> = {
  grades: {
    eyebrow: "Grades",
    title: "Delete the grades already stored?",
    body: "Turning this off removes every grade read from your transcript, and your average with it. Course names, credits and terms stay. To get grades back you upload the transcript again with grade reading switched on.",
    cancelLabel: "Keep my grades",
    actionLabel: "Delete grades",
  },
  account: {
    eyebrow: "Account",
    title: "Delete your account?",
    body: "Your course list, grades, collections and the reviews you published are removed with it. This cannot be undone.",
    cancelLabel: "Keep my account",
    actionLabel: "Delete account",
  },
};

type Props = {
  /** The viewer's taken courses — the rows the grade switch actually acts on. */
  takenCourses: readonly TakenCourse[];
  /** Whether any of those rows carries a grade. That *is* the grade setting. */
  hasStoredGrades: boolean;
  /** The average an A-E grade set works out to, or null when there is none. */
  average: number | null;
  showAverage: boolean;
  onShowAverageChange: (next: boolean) => void;
};

const SWITCH_CLASS =
  "h-6 w-[42px] data-checked:bg-cc-btn data-unchecked:bg-cc-rule3 [&_[data-slot=switch-thumb]]:size-[18px]";

/**
 * The Settings tab — `docs/design_ref/2026-09-06/Course Community - My Page.dc.html`,
 * the `isSettings` branch.
 *
 * Three of its four panels needed the schema consulted before they could be
 * drawn honestly:
 *
 * **"What others see" said reviews carry your name.** They do not. `reviews`
 * is attributed to a user id and every surface that renders one renders it
 * anonymously; `cc-store.js`'s `author` / `signedName` is a sketch that the
 * Review Card artboard itself contradicts. The line says what is true.
 *
 * **"Store grades from my transcript" is not a flag.** There is no such column
 * on `users`. The switch reflects whether any taken course carries a grade and
 * turning it off clears the real column on every row — which is exactly what
 * the artboard's own code does, and why it needs a confirmation.
 *
 * **"Delete my account" promised published reviews would stay.** `reviews`
 * cascades on `users`, so deleting an account deletes its reviews with it. The
 * copy says so, because a promise the database breaks is worse than a blunt
 * one.
 */
export function AccountSettings({
  takenCourses,
  hasStoredGrades,
  average,
  showAverage,
  onShowAverageChange,
}: Props) {
  const logout = useLogout();
  const deleteAccount = useDeleteAccount();
  const { clearGrades, isPending: isClearing } = useClearStoredGrades();
  const [confirming, setConfirming] = useState<"grades" | "account" | null>(
    null,
  );

  const averageShown = hasStoredGrades && showAverage && average !== null;

  async function handleClearGrades() {
    setConfirming(null);
    try {
      await clearGrades(takenCourses);
      toast.success("Grades deleted from your account");
    } catch {
      toast.error("Some grades could not be deleted.", {
        description: "Reload to see which are still stored, then try again.",
      });
    }
  }

  async function handleDeleteAccount() {
    setConfirming(null);
    try {
      await deleteAccount.mutateAsync();
    } catch {
      toast.error("Your account could not be deleted.", {
        description: "Nothing was removed. Try again later.",
      });
      return;
    }
    await logout();
  }

  return (
    <div className="flex flex-col gap-3.5 px-7 pt-[22px] @max-[440px]:px-[14px] @max-[440px]:pt-3">
      <section className="rounded-xl border border-cc-rule bg-cc-surface px-[17px] pt-4 pb-[15px]">
        <h2 className="m-0 font-semibold text-[10.5px] text-cc-dim uppercase tracking-[0.09em]">
          What others see
        </h2>
        <ul className="m-0 mt-2.5 flex list-none flex-col gap-2.5 p-0">
          <li className="flex gap-[9px]">
            <Check
              aria-hidden
              className="mt-0.5 size-[15px] flex-none text-cc-brand"
              strokeWidth={2}
            />
            <span className="text-[12.5px] text-cc-ink2 leading-[1.5]">
              Your reviews, with no name on them.
            </span>
          </li>
          <li className="flex gap-[9px]">
            <Minus
              aria-hidden
              className="mt-0.5 size-[15px] flex-none text-cc-dim"
              strokeWidth={2}
            />
            <span className="text-[12.5px] text-cc-ink2 leading-[1.5]">
              Never your grades, your average or your course list.
            </span>
          </li>
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-cc-rule bg-cc-surface">
        <div className="border-cc-rule border-b px-[18px] pt-4 pb-3.5">
          <h2 className="m-0 font-semibold text-[15.5px]">GPA and grades</h2>
          <p className="m-0 mt-[5px] text-[13px] text-cc-muted leading-[1.5]">
            Grades are private to you in every case. These two switches decide
            whether they are stored at all, and whether an average is worked out
            from them.
          </p>
        </div>

        <div className="flex items-start gap-[13px] border-cc-rule border-b px-[18px] py-4">
          <Switch
            className={SWITCH_CLASS}
            checked={hasStoredGrades}
            disabled={isClearing}
            aria-label="Store grades from my transcript"
            onCheckedChange={(next) => {
              if (next) {
                toast.info(
                  "Import a transcript with grade reading on to fill grades in.",
                );
                return;
              }
              setConfirming("grades");
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[14px]">
              Store grades from my transcript
            </div>
            <p className="m-0 mt-1 text-[12.5px] text-cc-muted leading-[1.5]">
              {hasStoredGrades
                ? "Grades read from your transcript are kept with your course list. Only you ever see them."
                : "No grades are stored. Course names, credits and terms are unaffected."}
            </p>
          </div>
        </div>

        <div
          className={`flex items-start gap-[13px] px-[18px] py-4 ${
            hasStoredGrades ? "" : "opacity-55"
          }`}
        >
          <Switch
            className={SWITCH_CLASS}
            checked={hasStoredGrades && showAverage}
            disabled={!hasStoredGrades}
            aria-label="Calculate my average"
            onCheckedChange={onShowAverageChange}
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[14px]">
              Calculate my average
            </div>
            <p className="m-0 mt-1 text-[12.5px] text-cc-muted leading-[1.5]">
              {hasStoredGrades
                ? "A credit-weighted average over your A-E courses, shown on this page. Pass/fail courses are left out. Kept in this browser, so it does not follow you to another device."
                : "Unavailable while no grades are stored."}
            </p>
          </div>
          {averageShown ? (
            <div className="flex-none font-semibold text-[19px] text-cc-brand tabular-nums">
              {average.toFixed(1)}
            </div>
          ) : null}
        </div>
      </section>

      <section className="flex items-center justify-between gap-4 rounded-xl border border-cc-rule bg-cc-surface px-[18px] py-4">
        <div className="min-w-0">
          <h2 className="m-0 font-semibold text-[14px]">Delete my account</h2>
          <p className="m-0 mt-1 text-[12.5px] text-cc-muted leading-[1.5]">
            Removes your course list, grades, collections and the reviews you
            published. It cannot be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirming("account")}
          disabled={deleteAccount.isPending}
          className="flex h-[38px] flex-none cursor-pointer items-center rounded-[9px] border border-cc-danger/40 bg-cc-surface px-3.5 font-medium text-[13px] text-cc-danger hover:bg-cc-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete account
        </button>
      </section>

      <div className="mt-2 border-cc-rule border-t pt-4">
        <h2 className="m-0 font-semibold text-[11px] text-cc-dim2 uppercase tracking-[0.09em]">
          Who runs this service
        </h2>
        <p className="m-0 mt-2 max-w-[640px] text-[12.5px] text-cc-dim2 leading-[1.6] text-pretty">
          Course Community is built and run by KTH AI Society, a student
          organisation. It is not an official KTH service. Credits, grades and
          averages are your own entries from a transcript you uploaded — for the
          official record, use Ladok. Reviews are the opinions of individual
          students, and courses change between rounds.
        </p>
        {/*
          The artboard's row also carries "Terms of use" and "What we store
          about you", both pointing at `#terms` / `#privacy` placeholders. No
          such route exists, so they are left out rather than shipped as links
          that go nowhere. Whoever writes those pages puts them back here.
        */}
        <div className="mt-2.5 flex flex-wrap gap-4 font-medium text-[12.5px]">
          <Link href="/contact" className="text-cc-brand hover:underline">
            Contact KTH AI Society
          </Link>
          <Link href="/about" className="text-cc-brand hover:underline">
            About Course Community
          </Link>
        </div>
      </div>

      <ConfirmDialog
        request={confirming ? CONFIRMATIONS[confirming] : null}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming === "grades") void handleClearGrades();
          if (confirming === "account") void handleDeleteAccount();
        }}
      />
    </div>
  );
}
