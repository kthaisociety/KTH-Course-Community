"use client";

import { CircleCheck } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { useSubmitFeedback } from "../api/mutations";

/**
 * The **Feedback form** — `docs/design/Course Community - Contact Form.dc.html`,
 * which the About artboard imports as a section and `/contact` renders on its
 * own.
 *
 * It is deliberately unauthenticated: `feedback_form` carries no user foreign
 * key, so nothing here reads a session, and nothing here offers an account.
 * A visitor types three fields and sends.
 *
 * The heading above it belongs to the caller — an `h2` inside the About page,
 * the shell's `PageHeader` `h1` on `/contact` — because the artboard keeps that
 * heading outside the sent/form switch, visible in both states.
 */

type Draft = { name: string; email: string; message: string };

const EMPTY: Draft = { name: "", email: "", message: "" };

/** The artboard's own address test, kept character for character. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The artboard's two checks in the artboard's own words: one line under the
 * button rather than a message per field.
 *
 * This is a courtesy to the person typing, never the security boundary —
 * `feedback.submit` validates the body again on the server and that is what
 * actually decides whether a row is written.
 */
function problemWith(draft: Draft): string | null {
  if (!draft.name.trim() || !draft.message.trim()) {
    return "Name and message are required.";
  }
  if (!EMAIL.test(draft.email.trim())) {
    return "Enter a valid email.";
  }
  return null;
}

const LABEL = "mb-1.5 block font-medium text-[12.5px] text-cc-ink2";

/**
 * The artboard sets `outline:none` and draws no focus state at all, which would
 * leave a keyboard with nothing to follow. The border moves to `--cc-hov` — the
 * palette's own emphasis border — rather than a new colour, so the focus ring is
 * added without changing the design.
 */
const CONTROL =
  "w-full rounded-[9px] border border-cc-rule3 bg-cc-surface text-[14px] text-cc-ink outline-none focus-visible:border-cc-hov focus-visible:ring-2 focus-visible:ring-cc-hov/40";

export function FeedbackForm() {
  const submitFeedback = useSubmitFeedback();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const id = useId();

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const problem = problemWith(draft);
    if (problem) {
      setError(problem);
      return;
    }

    const entry = {
      name: draft.name.trim(),
      email: draft.email.trim(),
      message: draft.message.trim(),
    };

    try {
      await submitFeedback.mutateAsync(entry);
      setError(null);
      setSentTo(entry.email);
    } catch {
      // The artboard has no server-error state — its store cannot fail. The
      // designed error slot is the smallest place to put a real one.
      setError("That did not send. Please try again.");
    }
  }

  if (sentTo !== null) {
    return (
      // `output` is the element for a result the page computed; its implicit
      // role is `status`, which is what announces the confirmation.
      //
      // The artboard paints this panel green — `#e9f3ef` on `#cfe4de` with
      // `#1c6b60` ink — and the palette has no green. There is no success or
      // danger family among the 24 `--cc-*` tokens at all, and inventing one
      // here would desynchronise `globals.css` from `cc-theme.css`, which it
      // mirrors. So the panel takes the nearest family that swaps correctly for
      // dark — `--cc-info` on `--cc-rule` with `--cc-brand` ink — and the tick
      // carries the "this worked" reading that the hue no longer does. The PR
      // reports the gap so the design gets a success token at source.
      <output className="mt-4 flex animate-in items-start gap-[11px] rounded-[12px] border border-cc-rule bg-cc-info px-4 py-[15px] duration-200 ease-out fade-in slide-in-from-bottom-[6px]">
        <CircleCheck
          size={17}
          strokeWidth={2.1}
          aria-hidden
          className="mt-px shrink-0 text-cc-brand"
        />
        <div>
          <div className="font-semibold text-[14px] text-cc-brand">
            Message sent
          </div>
          <div className="mt-[3px] text-[12.5px] text-cc-ink2">
            Thanks — we'll get back to you at {sentTo}.
          </div>
        </div>
      </output>
    );
  }

  // The artboard greys the button out while a field is blank but still lets the
  // click through, so the validation line is reachable. Kept, rather than a
  // `disabled` button that would silently swallow the tap.
  const complete = Boolean(
    draft.name.trim() && draft.email.trim() && draft.message.trim(),
  );

  return (
    <form
      onSubmit={send}
      noValidate
      className="mt-4 flex max-w-[480px] flex-col gap-3.5"
    >
      <div>
        <label className={LABEL} htmlFor={`${id}-name`}>
          Name
        </label>
        <input
          id={`${id}-name`}
          name="name"
          autoComplete="name"
          placeholder="Your name"
          value={draft.name}
          onChange={(event) =>
            setDraft((current) => ({ ...current, name: event.target.value }))
          }
          className={cn(CONTROL, "h-10 px-3")}
        />
      </div>

      <div>
        <label className={LABEL} htmlFor={`${id}-email`}>
          Email
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@kth.se"
          value={draft.email}
          onChange={(event) =>
            setDraft((current) => ({ ...current, email: event.target.value }))
          }
          className={cn(CONTROL, "h-10 px-3")}
        />
      </div>

      <div>
        <label className={LABEL} htmlFor={`${id}-message`}>
          Message
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={5}
          placeholder="What's on your mind?"
          value={draft.message}
          onChange={(event) =>
            setDraft((current) => ({ ...current, message: event.target.value }))
          }
          className={cn(CONTROL, "resize-y px-3 py-2.5 leading-[1.5]")}
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={submitFeedback.isPending}
          className={cn(
            "inline-flex h-[42px] cursor-pointer items-center rounded-[9px] px-5 font-semibold text-[13.5px] hover:opacity-[0.88]",
            complete
              ? "bg-cc-btn text-cc-btn-fg"
              : // `--cc-btn-fg` is white, which is invisible on `--cc-pill`.
                // The palette's own name for ink on a pill is `--cc-chip-ink`.
                "cursor-not-allowed bg-cc-pill text-cc-chip-ink",
          )}
        >
          {submitFeedback.isPending ? "Sending…" : "Send message"}
        </button>
        {/* The artboard's `#a3452a` has no token either, and `--cc-warn-ink` is
            the palette's only ink that means "look at this" and swaps for dark.
            `role="alert"` is what actually carries the message, so the reading
            does not rest on the hue. Reported in the PR with the panel above. */}
        {error ? (
          <p className="mt-2 text-[12.5px] text-cc-warn-ink" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
