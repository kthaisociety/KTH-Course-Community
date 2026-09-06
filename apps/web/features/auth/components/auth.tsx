import { AuthProviders } from "./auth-providers";
import { MagicLinkForm } from "./magic-link-form";

/**
 * The **sign-in page**, `/auth`.
 *
 * No artboard draws it, and that is not an oversight: the design's sign-in
 * surface is a panel over the page it interrupted —
 * `docs/design_ref/2026-09-06/Course Community - Landing.dc.html` draws it as a
 * 400px card on `--surface` at a 14px radius, which `AuthReasonDialog` renders.
 * This route exists because one branch of that panel cannot stay a panel: the
 * link we mail is opened in a new tab, so the email path has to survive leaving
 * this document entirely, and a modal does not.
 *
 * So the page is that panel with the scrim taken away. Same width, same radius,
 * same `--cc-surface` inside `--cc-rule2`, same kicker → title → body block; it
 * rests on `--cc-pg` under the artboards' own resting-card shadow rather than
 * floating over a darkened page. Control metrics come from the "Controls" row
 * of `docs/design_ref/2026-09-06/Course Community - Design System.dc.html`,
 * which is the authority for the numbers no other artboard states.
 *
 * What it deliberately does *not* copy is the artboard's labels. The Landing
 * panel offers "Continue with KTH account", and `server/auth.ts` configures no
 * KTH IdP — naming a provider that does not exist is the one way this page
 * could lie to a first-time visitor, so the buttons keep the providers that do.
 *
 * Before this, `/auth` was shadcn's `login-02` block close to verbatim and the
 * only file under `features/` with no `--cc-*` class at all. The visible
 * cost was not only that it looked borrowed: `bg-muted` resolves through
 * `globals.css` to `--cc-pill`, which in dark theme is a 16% cream over
 * `--cc-pg` — a `#2d3a4d` grey ground standing behind the `#0b254c` card. The
 * ground was lighter than the thing on it, which is the surface hierarchy
 * upside down, and it was the first screen a signed-out visitor saw.
 */
export function Auth({ error }: { error?: string }) {
  return (
    <main className="cc-theme flex min-h-svh flex-col bg-cc-pg px-4 py-10 text-cc-ink">
      {/* Centred with auto margins rather than `justify-center`, which is the
          difference between a card that stays reachable and one whose top is
          cut off the screen: a flex item centred by justification overflows
          both ends of a container it outgrows, and this card grows — the
          expired-link banner adds most of a hundred pixels to it on a landscape
          phone. Auto margins collapse to nothing instead.

          The container is the card, not the viewport, because what reflows here
          is the pair of provider buttons inside it and the card's own width is
          what decides whether they fit side by side. */}
      <div className="@container m-auto w-full max-w-[400px] rounded-[14px] border border-cc-rule2 bg-cc-surface p-6 shadow-[0_4px_20px_rgba(20,30,45,0.08)]">
        {/* `REASONS["log-in"]` from the Landing artboard — the same three lines
            `AuthReasonDialog` renders when it asks this question. Written out
            rather than shared with the dialog, because that map is keyed by
            *why* a protected action interrupted somebody, and `/auth` is
            reached with no such reason: a visitor typed the URL, or took the
            dialog's own email hand-off. Sharing the map would make this page
            claim a reason it has no way to know. */}
        <p className="font-semibold text-[11px] text-cc-brand uppercase tracking-[0.06em]">
          Welcome back
        </p>
        <h1 className="mt-2 font-semibold text-[19px] leading-[1.25] tracking-[-0.012em]">
          Log in to Course Community
        </h1>
        <p className="mt-1.5 text-[13.5px] text-cc-muted leading-[1.5]">
          Browsing never needs an account — logging in adds saved courses, your
          reviews and your own sidebar.
        </p>

        {/* `?error=` on this route means one thing: Better Auth was handed a
            magic link it would not accept. The artboard has words for exactly
            that — its `isDotExpired` state — and they are better than the ones
            that were here, because they say why it happened and what to do
            rather than only that something failed.

            Shaped as the Design System's "Error banner" (`BANNERS` pairs
            `--dangerTint` with `--dangerTintBorder` and `--dangerInk`) instead
            of the artboard's whole-panel takeover, since this page still has
            two working ways in underneath it and should not hide them. */}
        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-[11px] border border-cc-danger-tint-border bg-cc-danger-tint px-[14px] py-[13px]"
          >
            <p className="font-semibold text-[13.5px] text-cc-danger-ink">
              This link no longer works
            </p>
            <p className="mt-1 text-[12.5px] text-cc-muted leading-[1.5]">
              Private links expire after a short while, and each one can be used
              once. Request a new link to try again.
            </p>
          </div>
        ) : null}

        <div className="mt-4">
          <AuthProviders />
        </div>

        {/* The stock block drew this with `after:border-t` on a centred line and
            a label that had to repaint the card's own background over it. Two
            real hairlines and the label between them need no such trick, and
            they survive a label that wraps. `--cc-rule` is "hairline between
            rows"; the label is the Design System's eyebrow — 11px, 600, .09em,
            uppercase, `--cc-dim`. */}
        <div className="mt-[18px] flex items-center gap-3">
          <span className="h-px flex-1 bg-cc-rule" />
          <span className="font-semibold text-[11px] text-cc-dim uppercase tracking-[0.09em]">
            Or continue with email
          </span>
          <span className="h-px flex-1 bg-cc-rule" />
        </div>

        <MagicLinkForm />
      </div>
    </main>
  );
}
