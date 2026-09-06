"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { GithubIcon, GoogleIcon } from "@/components/icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import type { OauthProvider } from "@/types";
import { authHref, currentReturnTo, safeReturnTo } from "../lib/return-to";

/**
 * Why the visitor is being asked to sign in. Browsing never needs an account, so
 * every prompt names the one thing that does — and promises the work in progress
 * survives it.
 */
export type AuthReason =
  | "log-in"
  | "sign-up"
  | "save-course"
  | "post-review"
  | "keep-course-list";

const REASONS: Record<
  AuthReason,
  { kicker: string; title: string; body: string; cancel: string }
> = {
  "log-in": {
    kicker: "Welcome back",
    title: "Log in to Course Community",
    body: "Browsing never needs an account — logging in adds saved courses, your reviews and your own sidebar.",
    cancel: "Keep browsing as a guest",
  },
  "sign-up": {
    kicker: "Join",
    title: "Create your account",
    body: "Free for KTH students. You keep everything you were looking at.",
    cancel: "Keep browsing as a guest",
  },
  "save-course": {
    kicker: "One step left",
    title: "Sign in to save this course",
    body: "Your search and the course you are looking at stay exactly as they are. We finish the save as soon as you are in.",
    cancel: "Back to the course",
  },
  "post-review": {
    kicker: "One step left",
    title: "Sign in to publish your review",
    body: "Your draft is held as it is — text, ratings and the course all stay put. Nothing is published until you confirm.",
    cancel: "Back to my draft",
  },
  /**
   * The Taken Courses gate. Its kicker and title are the artboard's own —
   * `docs/design_ref/2026-09-06/Course Community - Taken Courses.dc.html`
   * draws "ONE STEP LEFT" over "Sign in to keep this list", and puts the second
   * of those on the confirm button that opens this. The body is the artboard's
   * `authReturnLine` for a reader who has rows waiting.
   */
  "keep-course-list": {
    kicker: "One step left",
    title: "Sign in to keep this list",
    body: "Your course list is waiting — signing in brings you straight back to it. Nothing is saved until you confirm it.",
    cancel: "Back to the list",
  },
};

type Props = {
  reason: AuthReason | null;
  onReasonChange: (reason: AuthReason) => void;
  onClose: () => void;
  /**
   * Adjust where the sign-in comes back to.
   *
   * Given the page the visitor is on — path and query, which is the default —
   * return where they should land instead. It exists for the review draft,
   * whose caller knows something the URL has stopped saying: `?open=` is spent
   * on arrival and taken back out, so by the time a guest presses "Post
   * review" the URL no longer names the tab they are writing in. Putting it
   * back is what lets the *email* path work at all, since the link in that mail
   * opens a new tab where the URL is the only thing that arrived.
   *
   * A mapper rather than a string, because the page it maps from is read off
   * `window.location` at the moment of leaving, and this component renders on
   * the server too.
   */
  returnTo?: (here: string) => string;
};

export function AuthReasonDialog({
  reason,
  onReasonChange,
  onClose,
  returnTo,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<OauthProvider | null>(null);
  const copy = REASONS[reason ?? "log-in"];

  /** Come back to exactly where they were — nothing they were reading is lost. */
  function destination(): string {
    const here = currentReturnTo();
    return safeReturnTo(returnTo ? returnTo(here) : here);
  }

  async function signInWith(provider: OauthProvider) {
    setPending(provider);
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: destination(),
      });
      if (error) toast.error("Could not sign in. Try again.");
    } catch (error) {
      console.error(error);
      toast.error("Could not sign in. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={reason !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="cc-theme w-[400px] max-w-[calc(100vw-2rem)] gap-0 rounded-[14px] bg-cc-surface p-6 text-cc-ink shadow-[0_18px_48px_rgba(20,30,45,0.26)]"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-[11px] text-cc-brand uppercase tracking-[0.06em]">
            {copy.kicker}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="cursor-pointer flex size-[26px] items-center justify-center rounded-[7px] text-[17px] text-cc-dim leading-none hover:bg-cc-pill"
          >
            ×
          </button>
        </div>

        <DialogTitle className="mt-2 font-semibold text-[19px] leading-[1.25] tracking-[-0.012em]">
          {copy.title}
        </DialogTitle>
        <DialogDescription className="mt-1.5 text-[13.5px] text-cc-muted leading-[1.5]">
          {copy.body}
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => signInWith("google")}
            className="cursor-pointer flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-cc-btn font-semibold text-[13.5px] text-cc-btn-fg hover:opacity-[0.88] disabled:opacity-60 [&>svg]:size-4 [&>svg]:shrink-0"
          >
            {pending === "google" ? <Spinner /> : <GoogleIcon />}
            Continue with Google
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => signInWith("github")}
            className="cursor-pointer flex h-[42px] items-center justify-center gap-2 rounded-[9px] border border-cc-rule3 bg-cc-surface font-medium text-[13.5px] text-cc-ink hover:border-cc-hov disabled:opacity-60 [&>svg]:size-4 [&>svg]:shrink-0"
          >
            {pending === "github" ? <Spinner /> : <GithubIcon />}
            Continue with GitHub
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => router.push(authHref(destination()))}
            className="cursor-pointer flex h-[42px] items-center justify-center rounded-[9px] border border-cc-rule3 bg-cc-surface font-medium text-[13.5px] text-cc-ink hover:border-cc-hov disabled:opacity-60"
          >
            Continue with email
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            onReasonChange(reason === "log-in" ? "sign-up" : "log-in")
          }
          className="cursor-pointer mt-3.5 text-center font-medium text-[12.5px] text-cc-brand hover:underline"
        >
          {reason === "log-in"
            ? "New here? Sign up instead"
            : "Already have an account? Log in"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer mt-2 text-center text-[12.5px] text-cc-dim hover:text-cc-brand"
        >
          {copy.cancel}
        </button>
      </DialogContent>
    </Dialog>
  );
}
