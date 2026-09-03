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

/**
 * Why the visitor is being asked to sign in. Browsing never needs an account, so
 * every prompt names the one thing that does — and promises the work in progress
 * survives it.
 */
export type AuthReason = "log-in" | "sign-up" | "save-course" | "post-review";

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
};

type Props = {
  reason: AuthReason | null;
  onReasonChange: (reason: AuthReason) => void;
  onClose: () => void;
};

export function AuthReasonDialog({ reason, onReasonChange, onClose }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<OauthProvider | null>(null);
  const copy = REASONS[reason ?? "log-in"];

  async function signInWith(provider: OauthProvider) {
    setPending(provider);
    try {
      // Come back to exactly where they were — nothing they were reading is lost.
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: window.location.pathname + window.location.search,
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
        overlayClassName="bg-[rgba(14,26,44,0.34)] supports-backdrop-filter:backdrop-blur-none"
        className="cc-theme w-[400px] max-w-[calc(100vw-2rem)] gap-0 rounded-[14px] border-cc-rule2 bg-cc-surface p-6 text-cc-ink shadow-[0_18px_48px_rgba(20,30,45,0.26)]"
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
            className="flex size-[26px] items-center justify-center rounded-[7px] text-[17px] text-cc-dim leading-none hover:bg-cc-pill"
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
            className="flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-cc-btn font-semibold text-[13.5px] text-cc-btn-fg hover:opacity-[0.88] disabled:opacity-60 [&>svg]:size-4 [&>svg]:shrink-0"
          >
            {pending === "google" ? <Spinner /> : <GoogleIcon />}
            Continue with Google
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => signInWith("github")}
            className="flex h-[42px] items-center justify-center gap-2 rounded-[9px] border border-cc-rule3 bg-cc-surface font-medium text-[13.5px] text-cc-ink hover:border-cc-hov disabled:opacity-60 [&>svg]:size-4 [&>svg]:shrink-0"
          >
            {pending === "github" ? <Spinner /> : <GithubIcon />}
            Continue with GitHub
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => router.push("/auth")}
            className="flex h-[42px] items-center justify-center rounded-[9px] border border-cc-rule3 bg-cc-surface font-medium text-[13.5px] text-cc-ink hover:border-cc-hov disabled:opacity-60"
          >
            Continue with email
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            onReasonChange(reason === "log-in" ? "sign-up" : "log-in")
          }
          className="mt-3.5 text-center font-medium text-[12.5px] text-cc-brand hover:underline"
        >
          {reason === "log-in"
            ? "New here? Sign up instead"
            : "Already have an account? Log in"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 text-center text-[12.5px] text-cc-dim hover:text-cc-brand"
        >
          {copy.cancel}
        </button>
      </DialogContent>
    </Dialog>
  );
}
