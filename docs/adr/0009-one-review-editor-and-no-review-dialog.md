# 9. One review editor, in the page rather than in a dialog

Date: 2026-09-07

## Status

Accepted.

## Context

Three surfaces asked for a review, and one of them was from an earlier design.

`features/reviews/components/review.tsx` was a shadcn `Dialog` driven by
TanStack Form: star `Rating` controls for the two 1–10 scores, six
`<input type="number">` boxes for the examination split with a "Total: n% (must
be 100%)" hint under them, a plain `Slider` for theory/applied, a `Switch` for
happy-took, and a Lexical rich-text editor for the write-up. The workspace
pane's review draft panel and the fast-track card stack on `/taken` had both
moved to the current design — a draggable examination bar, `ScoreSlider`, an
explicit "I don't remember" checkbox, a plain textarea — and neither could open
a dialog.

The split was never between screens. It was between **writing** a review and
**rewriting** one:

- Writing went through the current design, on both surfaces that offer it.
- Rewriting went through the dialog, on both surfaces that offer it — My Page's
  Reviews tab (`my-page.tsx`) and a course's review list
  (`review-list.tsx`, drawn inside the workspace pane's details tab).

`useEditReview` had exactly one caller, and it was the dialog. So a reader who
wrote a review with the draggable bar and then corrected a score was handed six
number inputs that had to add up to 100 by hand.

Nothing had connected the two, because nothing could: there was no way to load a
stored `Review` into a draft. The mapping ran one way only —
`toReviewFormData` on the way out — and three fields do not survive a naive
inverse (see **Consequences**).

## Decision

**One editor, in the page, for both writing and rewriting.**

`ReviewDraftEditor` (`features/reviews/components/review-draft-editor.tsx`) is
the only form that edits a review. It is presentation and arithmetic: it takes a
`ReviewDraft` and reports a new one. Two hosts wrap it —

- the **workspace pane**, which adds the progress header, the sign-in dance and
  the Post button, and holds an unpublished draft in `localStorage`;
- **My Page's review detail**, which adds the course header and a Save button,
  and holds nothing.

`toReviewDraft(review)` is the inverse that makes rewriting possible. Past it,
rewriting a review is the same code as writing one.

**The dialog is deleted**, along with `components/RichEditor.tsx`, the
`components/editor/**` Lexical tree it composed, and the eleven `lexical` /
`@lexical/*` dependencies. Nothing else imported any of it.

**My Page opens a review into the space the artboard already reserves.**
`docs/design_ref/2026-09-06/Course Community - My Page.dc.html:211` has an
`isDetail` branch: the two review columns give way to one 760px panel with a
back link, the course above it and the review's own blocks inside it. That panel
had never been built. It is built here, and its "Edit review" button — which the
artboard draws with no handler — turns the same panel into the editor. The
artboard's `reviewState: idle | editing | saving | saved | failed` prop is
declared and never read anywhere in that file; this is the state it names.

**The course review list hands off to the pane's review tab.** The list is drawn
inside `CourseDetailsPanel`, and the pane already has a review tab for that
course whose whole job is the form. The author's pencil switches to it rather
than unfolding a second copy of the form inside a scrolling list inside a pane.

## Consequences

### The model is one model, with two names

`features/workspace/lib/review-draft.ts` moved into the reviews feature and the
old `features/reviews/lib/review-draft.ts` became `review-answers.ts`. The two
types are now:

- `ReviewAnswers` — the picked methods, the parallel shares, the scores, the
  write-up, and every bar transform. What the fast-track card edits.
- `ReviewDraft extends ReviewAnswers` — plus `examinationForgotten` and
  `approachForgotten`. What the review editor edits.

The split survives because it is about which form draws a checkbox, not about
which screen is asking: the fast-track card, by its artboard, treats a question
left alone as the "I don't remember" answer and has nowhere to put a flag.
`ReviewAnswers` was already the name the workspace aliased the old type to.

### Three fields do not round-trip perfectly, and two are clamped on the way in

`toReviewDraft` is not a perfect inverse, and the reasons are recorded on it:

1. **Method order.** The draft holds the order the reviewer picked in; the
   column does not store it. A reopened review lays its segments out in
   `EXAMINATION_DISTRIBUTION_KEYS` order. Cosmetic — every share keeps its
   width.
2. **The approach.** `reviews.approach_theory_percent` takes 0–100; the editor's
   track stops at 5 and 95, because at either end one of the two labels has no
   width and the bar reads as broken. A stored 0 or 100 — which only the retired
   dialog's slider could write — is clamped **on the way in**, so the reviewer
   sees the value they are about to save rather than having it moved under them
   at the moment of saving.
3. **The write-up.** `reviews.message` is markup; the editor's textarea is plain
   text. A message comes in through `toPlainText` and goes back out through
   `fromPlainText`. A one-paragraph write-up therefore round-trips byte for
   byte, and the bold runs and lists that only the rich-text dialog could
   produce do not survive being edited. This is accepted rather than mitigated:
   there is no editor left in the app that can produce that markup, so the
   alternative is preserving formatting that can never again be authored or
   corrected.

Everything else round-trips exactly, which is asserted directly —
`review-draft.spec.ts` sends an untouched review through both mappers and
compares it with the row.

### The pane's review tab is no longer a dead end

It used to draw the form for a course the viewer had already reviewed and then
refuse to send it, with a banner telling them to go and edit it somewhere else.
That somewhere else was the dialog. The tab now loads the review instead.

### Two findings in the audit ledger are resolved incidentally

`audit-ledger.md` N-03 (three `RichEditor` scroll containers with no scrollbar
utility, on "live production UI") and R-03 (the reviews barrel dragging a CSS
pipeline into the `logic` vitest project through `Review` → `RichTextEditor`)
both describe files this removes. The ledger is a point-in-time audit record of
a specific branch and is deliberately left unedited.

The barrel still exports components, so the pure modules that hold a draft in
browser storage still import `features/reviews/lib/review-draft` by path rather
than through it. The reason is now React and a DOM rather than a stylesheet, and
the comment saying so moved with the code.
