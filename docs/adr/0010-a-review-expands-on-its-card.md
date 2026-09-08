# 10. A review expands on its card, not in a panel of its own

Date: 2026-09-08

## Status

Accepted. Supersedes one section of ADR 0009 — **My Page opens a review into
the space the artboard already reserves** — and nothing else in it.

## Context

ADR 0009 built the artboard's `isDetail` branch. On My Page's Reviews tab,
clicking one of the reader's own reviews swapped the whole two-column grid for a
centred 760px panel: a back link, the course above the review, its blocks inside
it, and a footer offering Delete review and Edit review — with Edit review
turning that same panel into the review editor.

It reads as a route change. It is not one: `my-page.tsx` held an `openReviewId`,
and the tab rendered either the panel or the columns. So the reader clicked a
card in a list and the list went away, along with the second column — the
reviews they had upvoted — which had nothing to do with what they clicked. There
was no URL to go back to, and no way to compare the review they opened with the
one below it. Getting back meant finding a "Back to your reviews" link at the
top of a panel they had probably scrolled down inside.

Meanwhile `ReviewCard` already unfolded in place everywhere else — on a course
page, and in fact in the upvoted column right beside the one that did not.
My Page suppressed that by passing an `onOpen` callback, which the card took as
"someone else is handling the click". Two columns of the same component behaved
in two different ways on one screen, and the difference was invisible until you
clicked.

ADR 0009 gave a reason for the panel, and it is a real one: half a column is
about 535px on a desktop viewport, and the examination bar wants more. The
artboard agrees with it.

## Decision

**A review unfolds on its own card, inside the column it is listed in.**

`ReviewCard` grows a controlled expansion pair — `expanded` and
`onExpandedChange` — and an `expandedSlot` drawn in the unfolded region in place
of the card's default read-back blocks. Given neither half of the pair it
remembers for itself, which is what a course's review list wants and what the
upvoted column has always had. `onOpen` and the `opensInPlace` flag it drove are
gone; there is no longer a variant of the card that refuses to unfold.

My Page passes its own body through the slot. That body is the panel from
0009, minus the frame it no longer needs: `review-detail.tsx` became
`expanded-review.tsx`, and the centring wrapper, the `max-w-[760px]` and the
reading-state back link came out of it. Everything else stayed — the amber
header band, the three read cards, the `ReviewDraftEditor` branch, the footer,
and the save and discard logic with the comments explaining why the draft is
seeded on demand rather than in an effect and why nothing reaches
`localStorage`.

**The grid does not move.** `grid-cols-[1fr_1px_1fr]` is exactly as it was, and
"Reviews you upvoted" stays put and stays visible while a card is open. The
~535px this leaves the examination bar is a known cost, accepted deliberately:
the objection ADR 0009 raised against unfolding here is correct and is
outweighed by not throwing the reader's list away under them. Widening the
column, hiding the other one, or giving the open card a full-bleed mode were all
considered and rejected — each of them reintroduces the disappearing act in a
quieter form.

**This deviates from the artboard.**
`docs/design_ref/2026-09-06/Course Community - My Page.dc.html:211` draws the
`isDetail` branch and this no longer builds it. The departure is at the owner's
request and is recorded here rather than argued from the artboard, which
normally governs. The header band that branch draws survives intact, so the
reader still gets the course title, the `hp · department` line and the "N
helpful" pill; that band now repeats the card's own meta row, and that
redundancy is accepted.

**One review is open at a time**, and My Page holds the id. A card knows whether
it is open and nothing about its siblings, so the tab is the only place that can
enforce it. The id is still cleared when the reader changes tab.

**Nothing else in ADR 0009 changes.** One editor for writing and rewriting,
`ReviewDraftEditor` as the only form, `toReviewDraft` as the inverse that makes
rewriting possible, the deleted dialog and the Lexical tree that went with it,
and the course list's hand-off to the workspace pane's review tab all stand
exactly as recorded.

## Consequences

### The card still knows nothing about editing a review

`ReviewDraftEditor` is not imported into `review-card.tsx` and must not be. My
Page supplies the editable body through the slot, so a course page renders a
list of cards without pulling a form in behind them. The card renders what it is
handed and looks no further into it.

### A stray click cannot discard a rewrite

The card's summary is what folds it away, so an accidental click on a review
being rewritten would have thrown the edit out. `ExpandedReview` reports whether
it is in the editor, and `ReviewColumn` declines to collapse while it is. The
explicit way out stays on the card — "Discard changes" while there is something
to lose, "Back to your review" when there is not.

Deliberately opening a *different* review still discards, and that is the line:
one review open at a time is the rule, and clicking another card is a choice the
reader made rather than a slip.

### The tab has one state, not two

`my-page.tsx` always renders the columns. `openReviewId` is still there and
still does the work it always did — it just no longer decides what the tab is.
A review deleted from the expanded card's footer takes its card with it and the
id simply stops matching anything; the `pendingDelete` / `DeleteReviewDialog`
wiring is untouched, and the confirmation still belongs to the page rather than
to a card inside a list on it.
