"use client";

import { Plus } from "lucide-react";
import { SignInPrompt } from "@/features/auth";
import type { CollectionsState } from "../hooks/use-collections-state";
import { CollectionChip } from "./collection-chip";

/** Chip-shaped placeholders, so the band is never briefly empty. */
const SKELETON_KEYS = ["s0", "s1"] as const;

/**
 * The height of the band's controls, and of Explore's search bar.
 *
 * The chip is drawn `h-10` by its own artboard and the bar is `h-[42px]`, and
 * #208's body reconciles the 2px by absorbing it into the band's padding. It is
 * spent here instead, so that "the same height as the search bar" — which is
 * what the whole change is for — is literally true rather than nearly true.
 */
const CONTROL_H = "h-[42px]";

export interface CollectionsStripProps {
  /** One `useCollectionsState` call, shared with `CollectionsBody`. */
  state: CollectionsState;
}

/**
 * The reader's collections as the narrow band above Saved's workspace row.
 *
 * ## What the band is for
 *
 * Explore and Saved differ only by title, subtitle, and what sits in this band.
 * Explore's is the search bar and the school filter; this is the reader's
 * collections and the button that makes one. Both are exactly
 * `--cc-search-block-h` tall at `@3xl`, which is what puts the two pages'
 * workspace tab strips on the same line — measured at y=229 on a 1920px
 * viewport, on both routes.
 *
 * Before #208 Saved had nothing to put here and *reserved* the height as blank
 * padding on its row. The token's meaning changes with this component: it was
 * "the height Saved holds empty", it is now "the height of the band", on both
 * pages.
 *
 * ## Why the chips scroll sideways
 *
 * A wrapping row would make the band's height a function of how many
 * collections the reader has, and the band's height is the thing levelling the
 * two pages. Seven chips would push the strips apart again — the exact defect
 * this is meant to fix, triggered by user data instead of by page. `flex-nowrap`
 * in a scroller makes the height independent of the width, the chips stay
 * tabbable, and `scrollbar-hidden` is already this codebase's idiom for it.
 *
 * ## Why "New collection" is on the right
 *
 * It used to render before the chips. The band is meant to read as the same
 * furniture as Taken's — content on the left, the page's one action pinned
 * right — so the button is pinned outside the scroller and the chips fill from
 * the left towards it.
 *
 * ## Below `@3xl`
 *
 * The band renders at every width. It carries real content now, so there is
 * nothing to gate: the chips and the create button have to be reachable on a
 * phone. Only the fixed 74px is `@3xl`; narrower, the band takes its natural
 * height, because there is no second tab strip down there to line up with.
 */
export function CollectionsStrip({ state }: Readonly<CollectionsStripProps>) {
  return (
    <div
      data-testid="collections-band"
      /*
        Deliberately without Explore's `@3xl:mr-[236px]`. That margin exists to
        move a *centred* bar onto the viewport's centre line by cancelling the
        rail's 236px. This band is left-aligned — chips from the left, button
        pinned right — so the same margin would centre nothing and merely cut
        236px off its right-hand end, when the two bands are meant to occupy the
        same box. Measured: the row runs 490→1666, and so does this.
      */
      className="flex shrink-0 items-center gap-3 px-7 pt-[18px] pb-3.5 @3xl:h-[var(--cc-search-block-h)] @3xl:pt-0 @3xl:pb-0 @max-[440px]:px-[14px]"
    >
      {state.isLoading ? <StripSkeleton /> : null}
      {!state.isLoading && !state.signedIn ? <GuestRow state={state} /> : null}
      {!state.isLoading && state.signedIn ? <ChipRow state={state} /> : null}
    </div>
  );
}

function StripSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 gap-2">
      {SKELETON_KEYS.map((key) => (
        <div
          key={key}
          className={`w-[118px] flex-none animate-pulse rounded-[9px] border border-cc-rule bg-cc-surface ${CONTROL_H}`}
        />
      ))}
    </div>
  );
}

/**
 * The signed-out band: one line, both entry points, full width.
 *
 * The card this replaces was three rows and about 120px tall. Left in a band
 * that levels two pages, it would have put a visitor's tab strips 46px out of
 * step with Explore's — on a page Explore does not mirror, so nothing would
 * have corrected it.
 *
 * The sync promise ("…and sync across devices") is dropped, knowingly: one line
 * has no room for it and signing up is one click away. Both buttons stay, and
 * they are `h-8` inside a 42px row rather than filling it, because they are the
 * row's controls and not the row.
 *
 * The row itself is {@link SignInPrompt} now, shared with My Page and
 * `/collections`. This was the only one of the three drawn without a card
 * around it, and the shared component is this row grown a border rather than
 * the other two shrunk into a band — so the height, and everything the height
 * levels, is unchanged.
 *
 * It is drawn at {@link CONTROL_H} by the shared component itself rather than
 * by anything passed from here, which is why this is the one control in the
 * band that does not carry that class: repeating it would be two files
 * declaring one height, and the one that lost would do so silently.
 */
function GuestRow({ state }: { state: CollectionsState }) {
  return (
    <SignInPrompt
      title="Organize your saved courses into collections"
      action={{
        kind: "ask",
        onSignUp: () => state.setAuthReason("sign-up"),
        onLogIn: () => state.setAuthReason("log-in"),
      }}
      className="min-w-0 flex-1"
    />
  );
}

function ChipRow({ state }: { state: CollectionsState }) {
  return (
    <>
      <div className="relative min-w-0 flex-1">
        <div
          data-testid="collections-scroller"
          className="scrollbar-hidden flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden"
        >
          {(state.collections ?? []).map((collection) => (
            <CollectionChip
              key={collection.id}
              collection={collection}
              /*
                The chips persist while a detail is open — they are the design's
                only way into collections, so they stay as navigation rather than
                being replaced by a back control. The open one has to say so.
              */
              active={state.openId === collection.id}
              /*
                Opening the chip that is already open is a no-op, the way
                clicking the current item in any nav is. The way back out is the
                detail's own control, which is where it has always been.
              */
              onOpen={() => state.openCollection(collection.id)}
              onRename={(name) => state.onRename(collection, name)}
              onDelete={() => state.requestDelete(collection)}
            />
          ))}
        </div>
        {/*
          The scroller's right edge, faded rather than cut, so a chip running
          under the button reads as "there is more" instead of as a clipped
          control. The gradient goes to `--cc-pg`, which is what the band
          actually sits on — measured, not assumed: the band paints no
          background of its own and the shell behind it is `bg-cc-pg`. A
          hardcoded white would invert in dark mode.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-r from-transparent to-cc-pg"
        />
      </div>

      <button
        type="button"
        onClick={state.openDialog}
        /*
          Two layers, not one: `--cc-info` is a **translucent** blue, so on its
          own it takes the colour of whatever it is over. In the band that is
          the page — `--cc-pg`, which is warm — and the button came out a muddy
          cream rather than the pale blue it is meant to be, and did not match
          the chips beside it, which are `--cc-surface`. So the surface goes
          underneath as the background *colour* and the tint sits on top as a
          background *image*: blue over white, on one element and with no extra
          node. It tracks the theme through both tokens rather than pinning a
          literal white, which would invert in dark.
        */
        className={`box-border flex flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-cc-hov border-dashed bg-cc-surface bg-[linear-gradient(var(--cc-info),var(--cc-info))] px-[13px] font-semibold text-[13px] text-cc-brand hover:border-cc-brand ${CONTROL_H}`}
      >
        <Plus size={14} aria-hidden />
        New collection
      </button>
    </>
  );
}
