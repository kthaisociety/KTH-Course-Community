"use client";

import { Lock } from "lucide-react";
import Link from "next/link";

/**
 * What the two controls do, which is the one thing that differs between the
 * places this prompt stands.
 *
 * `link` sends the reader to `/auth` and back. `ask` raises
 * {@link AuthReasonDialog} over the page they are already on. The choice is the
 * host page's: a page that is *entirely* signed out has nothing to come back to
 * mid-task, and a band above a working list does.
 */
export type SignInPromptAction =
  | {
      kind: "link";
      /**
       * Where both controls lead. One href, not two: `/auth` is a single
       * surface that signs up and logs in from the same field, so the two
       * labels are two ways of naming the same destination — which is what
       * My Page's panel has always done.
       */
      href: string;
    }
  | { kind: "ask"; onSignUp: () => void; onLogIn: () => void };

type Props = {
  /** The one line of copy. There is no second line — see the note below. */
  title: string;
  action: SignInPromptAction;
  /** Spacing from the host. The card owns everything inside its border. */
  className?: string;
};

/**
 * The app's invitation to sign in, wherever a signed-out reader meets a surface
 * that needs an account.
 *
 * ## One shape, everywhere
 *
 * There used to be three of these, in two shapes. My Page and `/collections`
 * each drew a `max-w-[520px]` card of three rows — lock and title, a line of
 * body copy, then the buttons — and Saved drew a bare 42px row with no card
 * around it at all, because #208 had to fit it inside a band that levels two
 * pages' tab strips and a 120px card does not fit in 74px.
 *
 * This is the reconciliation, and it goes the *slim* way: the card chrome comes
 * back and the height does not. Full width of whatever column it stands in, one
 * line, buttons pinned right. The card that fits in Saved's band is the card
 * every page gets, so the three surfaces are one component rather than three
 * that drift.
 *
 * ## The body copy is gone, knowingly
 *
 * "Your course list, reviews and average stay private to you and sync across
 * devices" and "Sign up or log in to create collections and sync across
 * devices" are not here. One line has no room for them, and this is the second
 * time that promise has been dropped for the same reason — `CollectionsStrip`
 * dropped it first, in #208, on the argument that signing up is one click away
 * and the promise is better kept by `/auth` than by a banner. The same argument
 * covers the other two now.
 *
 * ## Height
 *
 * `h-[42px]` is Explore's search bar and the collection chip, and it is what
 * lets this stand in Saved's `--cc-search-block-h` band without moving the
 * workspace tab strips off Explore's line. The buttons are `h-8` inside it
 * rather than filling it, because they are the row's controls and not the row.
 *
 * Below `@560px` it takes its natural height and the controls wrap, which is
 * the narrow behaviour `GuestRow` already had. Nothing below that width is
 * levelling anything.
 */
export function SignInPrompt({ title, action, className }: Readonly<Props>) {
  return (
    <div
      data-testid="sign-in-prompt"
      className={`flex h-[42px] items-center gap-2 rounded-[10px] border border-cc-rule2 bg-cc-surface px-3.5 @max-[560px]:h-auto @max-[560px]:flex-wrap @max-[560px]:py-2.5 ${className ?? ""}`}
    >
      <Lock size={15} className="flex-none text-cc-dim" aria-hidden />
      <span className="min-w-0 truncate font-semibold text-[13.5px]">
        {title}
      </span>
      <div className="ml-auto flex flex-none gap-[7px] @max-[560px]:ml-0">
        {action.kind === "link" ? (
          <>
            <Link href={action.href} className={SIGN_UP_CLASS}>
              Sign up
            </Link>
            <Link href={action.href} className={LOG_IN_CLASS}>
              Log in
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={action.onSignUp}
              className={`cursor-pointer ${SIGN_UP_CLASS}`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={action.onLogIn}
              className={`cursor-pointer ${LOG_IN_CLASS}`}
            >
              Log in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The filled control, on `--btn`. Shared by both renderings so they cannot drift. */
const SIGN_UP_CLASS =
  "flex h-8 items-center whitespace-nowrap rounded-[8px] bg-cc-btn px-3.5 font-semibold text-[12.5px] text-cc-btn-fg no-underline hover:opacity-[0.88]";

/** The outlined one beside it. */
const LOG_IN_CLASS =
  "flex h-8 items-center whitespace-nowrap rounded-[8px] border border-cc-rule3 bg-cc-surface px-3.5 font-medium text-[12.5px] text-cc-brand no-underline hover:border-cc-hov";
