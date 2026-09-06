"use client";

import { Check } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { GuestImportState } from "../hooks/use-guest-saves";

type Props = {
  /** Whether there is an account to import *into*. */
  signedIn: boolean;
  /** The codes sitting in this browser. */
  guestCodes: readonly string[];
  state: GuestImportState;
  onRun: () => void;
  onDismiss: () => void;
};

/**
 * The hand-off from browser to account, above the saved list.
 *
 * Four rows, one at a time, from
 * `docs/design_ref/2026-09-06/Course Community - Saved.dc.html`: the
 * offer (`pendingImport`), and the three `aria-live` results above it —
 * `importRunning`, `importDone`, `importDupes`.
 *
 * The offer shows only for a signed-in reader who still has codes in this
 * browser, which is the artboard's own condition (`member &&
 * v.localSaves.length > 0 && v.importState !== "running"`). A guest sees
 * nothing here: their list *is* the page, and there is no account to move it
 * into yet.
 *
 * `--cc-pill` on the two live rows and `--cc-surface` on the offer, as drawn.
 * The dupes row is the one that sits on `--cc-pg` in `--cc-muted` rather than
 * in `--cc-brand`, because it reports that nothing happened.
 */
export function GuestSavesImportBanner({
  signedIn,
  guestCodes,
  state,
  onRun,
  onDismiss,
}: Props) {
  if (!signedIn) return null;

  if (state.status === "running") {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2.5 rounded-[10px] border border-cc-rule2 bg-cc-pill px-[14px] py-3 text-[12.5px] text-cc-brand"
      >
        <Spinner />
        Adding the courses saved in this browser to your account…
      </div>
    );
  }

  if (state.status === "done") {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2.5 rounded-[10px] border border-cc-rule2 bg-cc-pill px-[14px] py-3 text-[12.5px] text-cc-brand"
      >
        <Check size={15} strokeWidth={2.2} aria-hidden className="shrink-0" />
        <span className="flex-1">
          {state.count === 1
            ? "1 saved course added to your account"
            : `${state.count} saved courses added to your account`}
        </span>
        <DismissButton onDismiss={onDismiss} />
      </div>
    );
  }

  if (state.status === "dupes") {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2.5 rounded-[10px] border border-cc-rule2 bg-cc-pg px-[14px] py-3 text-[12.5px] text-cc-muted"
      >
        <Check
          size={15}
          strokeWidth={2}
          aria-hidden
          className="shrink-0 text-cc-dim"
        />
        <span className="flex-1">
          Your saved courses are already up to date
        </span>
        <DismissButton onDismiss={onDismiss} />
      </div>
    );
  }

  if (state.status === "failed") {
    // Not an artboard state. The artboard's import cannot fail — it is a
    // `setTimeout` over local arrays — and ours is a run of real writes that
    // can. Saying so is better than either silently reverting to the offer, or
    // showing "added" over courses that were not. The codes are still in the
    // browser, so the offer below is the recovery and the button is the retry.
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-3 rounded-[10px] border border-cc-danger-tint-border bg-cc-danger-tint px-[14px] py-3 text-[12.5px] text-cc-danger-ink"
      >
        <span className="flex-1">
          Some courses could not be added. They are still saved in this browser.
        </span>
        <button
          type="button"
          onClick={onRun}
          className="flex h-[30px] cursor-pointer items-center rounded-lg bg-cc-btn px-3 font-semibold text-[12.5px] text-cc-btn-fg hover:opacity-[0.88]"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!guestCodes.length) return null;

  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-cc-rule2 bg-cc-surface px-[14px] py-3 text-[12.5px] text-cc-ink2">
      <span className="flex-1">
        {guestCodes.length === 1
          ? "1 course saved in this browser is ready to add to your account."
          : `${guestCodes.length} courses saved in this browser are ready to add to your account.`}
      </span>
      <button
        type="button"
        onClick={onRun}
        className="flex h-[30px] shrink-0 cursor-pointer items-center rounded-lg bg-cc-btn px-3 font-semibold text-[12.5px] text-cc-btn-fg hover:opacity-[0.88]"
      >
        Add to my account
      </button>
    </div>
  );
}

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss"
      className="cursor-pointer text-cc-muted leading-none hover:text-cc-ink"
    >
      ×
    </button>
  );
}
