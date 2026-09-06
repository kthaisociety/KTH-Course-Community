"use client";

import { useForm } from "@tanstack/react-form";
import { Mail } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { requestedReturnTo } from "../lib/return-to";

const formSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

/**
 * The design's **field**, from the "Controls" row of
 * `docs/design_ref/2026-09-06/Course Community - Design System.dc.html`: 40px
 * tall, 10px radius, 14px of side padding, `--rule3` around `--surface`, 14px
 * text. shadcn's `Input` is 32px at a 10px radius, which is what this was.
 *
 * Focus follows `feedback-form.tsx` for the reason recorded there — the
 * artboards draw no focus state, and `--cc-hov` is the palette's own emphasis
 * border, so a keyboard gets something to follow without a new colour.
 *
 * The invalid border is `--cc-danger`, matching `find-your-dot.tsx`, which is
 * the other place in this repo that asks for an email address and mails a link
 * back. The Landing artboard draws that border as a saturated `#c2410c` rather
 * than a tint, and no `--cc-*` token is that colour; `--cc-danger` is the one
 * the sibling settled on and the one the message underneath uses, so the two
 * halves of "this is wrong" are the same colour.
 */
const FIELD =
  "h-10 w-full rounded-[10px] border border-cc-rule3 bg-cc-surface px-[14px] text-[14px] text-cc-ink outline-none focus-visible:border-cc-hov focus-visible:ring-2 focus-visible:ring-cc-hov/40 aria-invalid:border-cc-danger";

/**
 * The design's **Primary action**, same row: 38px tall, 9px radius, 16px of
 * side padding, `--btn` under `--btnFg` at 13.5px/600, and `.88` opacity on
 * hover.
 */
const SUBMIT =
  "flex h-[38px] w-full cursor-pointer items-center justify-center gap-2 rounded-[9px] bg-cc-btn px-4 font-semibold text-[13.5px] text-cc-btn-fg outline-none hover:opacity-[0.88] focus-visible:ring-2 focus-visible:ring-cc-hov/40 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * The first thing wrong with the address, in the words `formSchema` gave it.
 *
 * TanStack Form hands back whatever the validator produced, which for a
 * Standard Schema is an issue object rather than a string. Reading `message`
 * off it — and tolerating a bare string — keeps the schema the single place the
 * wording lives, instead of a second copy of "Enter a valid email address."
 * sitting in the markup and drifting from it.
 */
function firstError(errors: readonly unknown[]): string | null {
  for (const error of errors) {
    if (typeof error === "string" && error) return error;
    if (error && typeof error === "object" && "message" in error) {
      const { message } = error as { message?: unknown };
      if (typeof message === "string" && message) return message;
    }
  }
  return null;
}

export function MagicLinkForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const id = useId();
  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signIn.magicLink({
        email: value.email,
        // Where the visitor was when they asked for the link, not the front
        // door. This is the path that cannot recover a destination any other
        // way: the link is opened in a new tab, so nothing but the URL the
        // mail carries survives to say where they were going.
        callbackURL: requestedReturnTo(),
        errorCallbackURL: "/auth",
      });
      if (error) {
        toast.error("Could not send sign-in link");
        return;
      }
      setSentTo(value.email);
    },
  });

  if (sentTo) {
    return (
      // `output` is the element for a result the page computed; its implicit
      // role is `status`, which is what announces this without stealing focus
      // from a visitor who is already reaching for their inbox. Same element
      // and same banner the contact form's "Message sent" uses, on the Design
      // System's success family (`BANNERS`: `--successTint` on
      // `--successTintBorder` with `--successInk`).
      //
      // "Check your inbox" is the artboard's own title for this state
      // (`Course Community - Landing.dc.html`, the `isDotSent` branch). Its
      // body is not, because the artboard's mock cannot send anything and hedges
      // — "if an account exists for this email" — where we know perfectly well
      // that one was just sent, to an address the visitor typed a moment ago
      // and may want to check for a typo, and that it does not last long.
      <output className="mt-4 flex animate-in items-start gap-[11px] rounded-[12px] border border-cc-success-tint-border bg-cc-success-tint px-4 py-[15px] duration-200 ease-out fade-in slide-in-from-bottom-[6px]">
        <Mail
          size={17}
          strokeWidth={2.1}
          aria-hidden
          className="mt-px shrink-0 text-cc-success-ink"
        />
        <div>
          <div className="font-semibold text-[14px] text-cc-success-ink">
            Check your inbox
          </div>
          <div className="mt-[3px] text-[12.5px] text-cc-ink2 leading-[1.5]">
            We sent a sign-in link to {sentTo}. It expires in 5 minutes.
          </div>
        </div>
      </output>
    );
  }

  return (
    <form
      className="mt-4"
      // `type="email"` makes the browser refuse the submit and raise its own
      // bubble, which is native chrome in a typeface and colour the design has
      // no say over — and which meant `formSchema`'s message, the artboard's
      // own "Enter a valid email address.", was unreachable in a real browser.
      // Turning the native pass off routes a bad address to the designed line
      // instead. The type attribute stays: it is what asks a phone for the
      // right keyboard and what tells a password manager this is an address.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid;
          const message = isInvalid
            ? firstError(field.state.meta.errors)
            : null;
          return (
            <div>
              <label
                className="mb-1.5 block font-medium text-[12.5px] text-cc-ink2"
                htmlFor={`${id}-email`}
              >
                Email
              </label>
              <input
                id={`${id}-email`}
                name={field.name}
                type="email"
                autoComplete="email"
                placeholder="your.email@kth.se"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={isInvalid}
                // Tied to the message rather than left to the visitor to find:
                // the line below is the only thing that says what to fix, and
                // a screen reader reaches the field first.
                aria-describedby={message ? `${id}-email-error` : undefined}
                className={FIELD}
              />
              {message ? (
                <p
                  id={`${id}-email-error`}
                  role="alert"
                  className="mt-2 text-[12.5px] text-cc-danger"
                >
                  {message}
                </p>
              ) : null}
            </div>
          );
        }}
      </form.Field>
      {/* 14px under the field, which is the gap the Landing artboard's own
          email panel leaves between the address and the button that sends
          to it. */}
      <div className="mt-3.5">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <button type="submit" disabled={isSubmitting} className={SUBMIT}>
              {isSubmitting ? <Spinner /> : null}
              Email me a sign-in link
            </button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
