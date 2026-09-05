"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";
import { keywordChips } from "@/features/courses/lib/course-card-model";
import type { CardGeometry, CourseCardAction, CourseCardModel } from "@/types";

/**
 * The course card, shared by Explore, Saved and Collections.
 *
 * Straight from `docs/design_ref/2026-09-05/Course Community - Course Card.dc.html`. It renders
 * `c` and measures nothing: geometry arrives as one `geo` object so the parent
 * owns the collapse ramp, and the only structural difference between the pages
 * is `action` — Explore's split Save button, or the picker on its own. That is
 * why this is one component rather than two.
 *
 * Everything derived from data is computed before it gets here, by
 * `toCourseCardModel`. The card decides no truth about a course; it draws the
 * one it is handed. In particular `hasX` / `noX` are drawn as the two
 * independent branches they are, so "no reviews yet" and "reviewed, but nobody
 * remembered the examination split" stay different pictures — and neither ever
 * becomes 0%.
 *
 * `geo` lands in custom properties rather than inline widths, which is what
 * lets the container query below `@max-[440px]` override the ramp for a card in
 * a phone-width column without the parent knowing anything about it.
 */

type Props = {
  c: CourseCardModel;
  geo: CardGeometry;
  /** Explore's split Save button, or Saved's picker-only control. */
  action?: CourseCardAction;
  /** Opens the picker upwards, for a card sitting near the bottom of a page. */
  pickerAbove?: boolean;
  /** Copy for the row that starts a new collection. */
  newLabel?: string;
  /**
   * Whether the viewer has an account. Defaults to `false`: a visitor sees the
   * design's sign-up prompt instead of a picker whose writes would be rejected.
   */
  signedIn?: boolean;
  /** The name being typed into the new-collection row. */
  draftName?: string;
  onDraftChange?: (name: string) => void;
  /** Enter, or blur with a name. */
  onDraftCommit?: () => void;
  /** Escape. */
  onDraftCancel?: () => void;
};

/**
 * Card metrics as custom properties, so a container query can override them.
 *
 * `geo` also carries `saveW`, `savePad`, `reviewPad`, `labelMax` and
 * `labelOpacity`, which Explore's own chrome interpolates but this card's markup
 * does not read — the artboard fixes those paddings. They are not emitted rather
 * than emitted unused.
 */
function geometryVars(geo: CardGeometry): CSSProperties {
  return {
    "--card-h": geo.cardHeight,
    "--card-title": geo.titleSize,
    "--card-gap": geo.cardGap,
    "--card-pad": geo.cardPad,
    "--card-facts-gap": geo.factsGap,
    "--card-rail-w": geo.railW,
    "--card-rail-pad": geo.railPad,
    "--card-summary-max": geo.summaryMax,
    "--card-summary-op": String(geo.summaryOpacity),
    "--card-review-flex": geo.reviewFlex,
    "--card-save-flex": geo.saveFlex,
  } as CSSProperties;
}

/**
 * The phone end of the ramp, from
 * `docs/design_ref/2026-09-05/Course Community - Mobile Preview.dc.html`. It is a
 * container query rather than a viewport one because a card is narrow whenever
 * its column is, phone or not.
 */
const MOBILE_GEOMETRY =
  "@max-[440px]:[--card-h:168px] @max-[440px]:[--card-title:15px] @max-[440px]:[--card-gap:7px] @max-[440px]:[--card-pad:12px] @max-[440px]:[--card-rail-w:118px] @max-[440px]:[--card-rail-pad:12px_11px] @max-[440px]:[--card-summary-max:0px] @max-[440px]:[--card-summary-op:0] @max-[440px]:[--card-review-flex:0_0_34px] @max-[440px]:[--card-save-flex:0_0_68px]";

const TAKEN_PILL =
  "flex h-[26px] flex-none items-center gap-1.5 rounded-[7px] py-0 pr-2 pl-[5px] text-[12px]";

function takenPillStyle(c: CourseCardModel): CSSProperties {
  return {
    background: c.takenBg,
    color: c.takenCountFg,
    "--taken-hover": c.takenHoverBg ?? "var(--cc-pill)",
  } as CSSProperties;
}

/** Shared by the pill's two forms, so they cannot drift apart. */
function TakenPillBody({ c }: { c: CourseCardModel }) {
  return (
    <>
      <CheckCircleIcon fill={c.takenFill} />
      <span className="tabular-nums">{c.statTaken}</span>
    </>
  );
}

/** Marks the picker's own subtree, so a blur inside it is not a blur away. */
const PICKER_MARKER = "data-collection-picker";

/**
 * Closes an open popover when the reader points or presses somewhere else.
 *
 * The artboard dismisses both panels from the screen, where one `closeAll` can
 * see every card. Here each card owns its own popover state, so the same
 * behaviour has to live with the DOM that defines "elsewhere" — which is this
 * component. It also settles the multi-card case for free: pointing at another
 * card's trigger is outside this one, so at most one panel is ever open.
 *
 * `close` is the trigger's own toggle, and it only runs while the panel is
 * open, so toggling is closing.
 */
function useDismissOnOutside(
  open: boolean,
  region: RefObject<HTMLElement | null>,
  close: (() => void) | undefined,
) {
  useEffect(() => {
    if (!open || !close) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && region.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, region]);
}

export function CourseCard({
  c,
  geo,
  action = "save",
  pickerAbove = false,
  newLabel = "Create new collection",
  signedIn = false,
  draftName = "",
  onDraftChange,
  onDraftCommit,
  onDraftCancel,
}: Props) {
  const tween = { transition: geo.tween };
  const keywords = keywordChips(c.keywords);
  // The display model normally supplies this, but CourseCard also renders
  // direct fixtures and future callers. A picker trigger that says only "▾"
  // is neither discoverable nor useful to assistive technology.
  const addLabel = c.addLabel?.trim() || "Add to collection";

  // Each popover's region is its trigger plus its panel: a press inside either
  // is not a press elsewhere.
  const takenRegion = useRef<HTMLDivElement>(null);
  const pickerRegion = useRef<HTMLDivElement>(null);
  useDismissOnOutside(c.takenPickerOpen ?? false, takenRegion, c.onTaken);
  useDismissOnOutside(c.pickerOpen, pickerRegion, c.onPicker);

  return (
    <div className="@container w-full" style={geometryVars(geo)}>
      <article
        // The resting border is a custom property, not an inline `border-color`:
        // an inline declaration would outrank the hover class and the card would
        // never light up under the pointer.
        className={`relative flex h-[var(--card-h)] rounded-[12px] border border-[color:var(--card-border)] bg-cc-surface shadow-[0_1px_2px_rgba(20,30,45,0.05)] transition-[border-color,box-shadow] hover:border-cc-hov hover:shadow-[0_2px_8px_rgba(20,30,45,0.09)] ${MOBILE_GEOMETRY}`}
        style={{ "--card-border": c.borderColor } as CSSProperties}
      >
        <div
          className="box-border flex min-w-0 flex-1 flex-col gap-[var(--card-gap)] p-[var(--card-pad)]"
          style={tween}
        >
          <div className="flex flex-none items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <h3
                className="m-0 font-semibold text-[length:var(--card-title)] text-cc-brand leading-[1.2]"
                style={tween}
                title={c.title}
              >
                {c.onOpen ? (
                  // Stretched over the whole card, so clicking anywhere opens
                  // the course while the only thing focus and a screen reader
                  // ever meet is this one button. The clipping lives on the
                  // inner span: `overflow:hidden` on the button would cut the
                  // overlay off at the title's own box.
                  <button
                    type="button"
                    onClick={c.onOpen}
                    className="block w-full cursor-pointer text-left after:absolute after:inset-0 after:content-[''] hover:underline"
                  >
                    <span className="block truncate">{c.title}</span>
                  </button>
                ) : (
                  <span className="block truncate">{c.title}</span>
                )}
              </h3>
              <div className="mt-[3px] truncate text-[13px] text-cc-muted">
                {c.meta}
              </div>
            </div>

            <div className="relative z-10 flex-none" ref={takenRegion}>
              {/* Without `onTaken` the pill is a reading, not a control: the
                  viewer has already marked the course, and unmarking it here
                  would discard the grade and credits recorded beside the row
                  without ever showing them. */}
              {c.onTaken ? (
                <button
                  type="button"
                  onClick={c.onTaken}
                  title={c.takenTitle}
                  aria-haspopup={signedIn ? undefined : "dialog"}
                  aria-expanded={
                    signedIn ? undefined : (c.takenPickerOpen ?? false)
                  }
                  className={`${TAKEN_PILL} cursor-pointer hover:bg-[var(--taken-hover)]`}
                  style={takenPillStyle(c)}
                >
                  <TakenPillBody c={c} />
                </button>
              ) : (
                <span
                  title={c.takenTitle}
                  className={TAKEN_PILL}
                  style={takenPillStyle(c)}
                >
                  <TakenPillBody c={c} />
                </span>
              )}

              {c.takenPickerOpen ? (
                <SignUpPrompt
                  title="Track courses you've taken"
                  body="Sign up or log in to mark courses as taken and build your profile."
                  onSignUp={c.onSignUp}
                  onLogIn={c.onLogIn}
                  className="absolute top-[30px] right-0 z-30 w-[250px]"
                />
              ) : null}
            </div>
          </div>

          {/* Keywords has no writer at all and prerequisites has no writer yet,
              so both headers stand over an empty row. Reserving the line keeps
              the card's structure the same for every course, which is what the
              artboard draws — and is honest in a way "None listed" would not
              be over a table nothing has ever written to (#68). */}
          <div
            className="flex flex-none flex-wrap gap-[var(--card-facts-gap)] py-0.5 @max-[440px]:hidden"
            style={tween}
          >
            <section className="min-w-0 flex-[1_1_150px]">
              <h4 className="mb-1 font-medium text-[11px] text-cc-muted">
                Keywords
              </h4>
              <div
                className="flex h-5 flex-nowrap gap-[5px] overflow-hidden"
                title={c.keywords}
              >
                {keywords.map((keyword) => (
                  <span
                    key={keyword.label}
                    className="inline-flex min-w-0 items-center overflow-hidden truncate text-[11.5px] text-cc-muted"
                    style={{ flex: keyword.flex }}
                  >
                    {keyword.label}
                  </span>
                ))}
              </div>
            </section>

            <section className="min-w-0 flex-[1_1_150px]">
              <h4 className="mb-1 font-medium text-[11px] text-cc-muted">
                Prerequisites
              </h4>
              {c.hasPrereq ? (
                <div
                  title={c.prereq}
                  className="flex h-5 flex-nowrap gap-[5px] overflow-hidden"
                >
                  {c.prereqCourses.map((prerequisite) => (
                    <span
                      key={prerequisite.code}
                      title={prerequisite.name}
                      className="inline-flex h-5 flex-none items-center whitespace-nowrap font-medium font-mono text-[11.5px] text-cc-brand"
                      style={{
                        gap: prerequisite.gap,
                        padding: prerequisite.padding,
                        borderRadius: prerequisite.radius,
                        background: prerequisite.bg,
                      }}
                    >
                      <PrerequisiteTickIcon taken={prerequisite.taken} />
                      {prerequisite.code}
                    </span>
                  ))}
                </div>
              ) : null}
              {/* Only when prerequisites were actually extracted and there are
                  none. An empty row instead means nobody has looked. */}
              {c.noPrereq ? (
                <p className="m-0 text-[13px] text-cc-dim2 leading-[19px]">
                  None listed
                </p>
              ) : null}
              {!c.hasPrereq && !c.noPrereq ? <div className="h-5" /> : null}
            </section>
          </div>

          <div
            className="min-h-0 max-h-[var(--card-summary-max)] flex-[1_1_auto] overflow-hidden opacity-[var(--card-summary-op)]"
            style={tween}
          >
            <p className="m-0 overflow-hidden text-[13px] text-cc-muted leading-[19px]">
              {c.summaryClipped}
            </p>
          </div>

          <div className="relative z-10 mt-auto flex min-w-0 flex-none gap-2 pt-0.5">
            <button
              type="button"
              onClick={c.onReview}
              title="Write a review"
              className="box-border flex h-[34px] min-w-[40px] flex-[var(--card-review-flex)] cursor-pointer items-center justify-center gap-[7px] overflow-hidden rounded-[8px] bg-cc-btn px-[10px] font-medium text-[13px] text-cc-btn-fg hover:opacity-90"
            >
              <ReviewIcon />
              {geo.showLabel ? (
                <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap @max-[440px]:hidden">
                  Write a review
                </span>
              ) : null}
            </button>

            <div
              className="relative min-w-[44px] flex-[var(--card-save-flex)]"
              ref={pickerRegion}
            >
              {action === "save" ? (
                <div
                  className="box-border flex h-[34px] max-w-full items-stretch overflow-hidden rounded-[8px] border"
                  style={{ borderColor: c.saveBorder, background: c.saveBg }}
                >
                  <button
                    type="button"
                    onClick={c.onSave}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-[7px] overflow-hidden px-[10px] text-[13px] hover:bg-cc-info"
                    style={{ color: c.saveFg }}
                  >
                    <BookmarkIcon fill={c.saveFill} />
                    {geo.showLabel ? (
                      <span className="min-w-0 overflow-hidden whitespace-nowrap @max-[440px]:hidden">
                        {c.saveLabel}
                      </span>
                    ) : null}
                  </button>
                  <div
                    className="w-px flex-none"
                    style={{ background: c.saveBorder }}
                  />
                  <button
                    type="button"
                    onClick={c.onPicker}
                    title={addLabel}
                    aria-label={addLabel}
                    aria-haspopup="menu"
                    aria-expanded={c.pickerOpen}
                    className="flex flex-none cursor-pointer items-center px-[9px] text-[10px] hover:bg-cc-info"
                    style={{ color: c.saveFg }}
                  >
                    ▾
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={c.onPicker}
                  aria-haspopup="menu"
                  aria-expanded={c.pickerOpen}
                  aria-label={addLabel}
                  className="box-border flex h-[34px] cursor-pointer items-center gap-[7px] overflow-hidden rounded-[8px] border border-cc-rule3 bg-cc-surface px-[10px] text-[13px] text-cc-ink hover:border-cc-hov hover:bg-cc-info"
                >
                  <AddToCollectionIcon />
                  {/* Same string as the accessible name above: a visible label
                      the accessible name does not contain is unreachable by
                      voice control (WCAG 2.5.3), and the label is hidden by the
                      container query on a narrow card, so it cannot be the only
                      name either. */}
                  {geo.showLabel ? (
                    <span className="min-w-0 overflow-hidden whitespace-nowrap @max-[440px]:hidden">
                      {addLabel}
                    </span>
                  ) : null}
                </button>
              )}

              {c.pickerOpen ? (
                <div
                  {...{ [PICKER_MARKER]: "" }}
                  className="absolute left-0 z-30 box-border w-[266px] rounded-[10px] border border-cc-rule2 bg-cc-surface p-[5px] shadow-[0_8px_24px_rgba(20,30,45,0.14)]"
                  style={pickerAbove ? { bottom: "38px" } : { top: "38px" }}
                >
                  {signedIn ? (
                    <div>
                      <div className="px-[9px] pt-2 pb-1.5 font-semibold text-[10.5px] text-cc-dim uppercase tracking-[0.09em]">
                        Add to collections
                      </div>
                      {c.creating ? (
                        <NewCollectionField
                          value={draftName}
                          onChange={onDraftChange}
                          onCommit={onDraftCommit}
                          onCancel={onDraftCancel}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={c.onNewCollection}
                          className="flex w-full cursor-pointer items-center gap-[9px] rounded-[7px] px-[9px] py-2 text-left font-medium text-[13px] text-cc-brand hover:bg-cc-pill"
                        >
                          <span className="flex w-4 flex-none justify-center">
                            <PlusIcon />
                          </span>
                          {newLabel}
                        </button>
                      )}
                      {c.hasCollections ? (
                        <div className="mx-1.5 my-1 h-px bg-cc-pill" />
                      ) : null}
                      {c.collections.map((collection) => (
                        <button
                          key={collection.id}
                          type="button"
                          onClick={collection.onClick}
                          className="flex w-full cursor-pointer items-center gap-[9px] rounded-[7px] px-[9px] py-2 text-left text-[13px] text-cc-ink2 hover:bg-cc-pill"
                        >
                          <span className="flex w-4 flex-none justify-center">
                            <CollectionCheckIcon
                              fill={collection.fill}
                              tick={collection.tick}
                            />
                          </span>
                          <span className="flex-1 truncate">
                            {collection.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <SignUpPrompt
                      title="Organize your saved courses"
                      body="Sign up or log in to create collections and sync across devices."
                      onSignUp={c.onSignUp}
                      onLogIn={c.onLogIn}
                    />
                  )}
                </div>
              ) : null}
            </div>

            {c.removeLabel && c.onRemove ? (
              <button
                type="button"
                onClick={c.onRemove}
                aria-label={c.removeLabel}
                title={c.removeLabel}
                // Removal is destructive in every state. The semantic danger
                // token keeps its colour coherent across themes.
                className="ml-auto flex size-[34px] flex-none cursor-pointer items-center justify-center rounded-[8px] border border-cc-rule3 bg-cc-surface text-cc-danger hover:border-cc-danger"
              >
                <TrashIcon />
              </button>
            ) : null}
          </div>
        </div>

        <div
          className="box-border flex w-[var(--card-rail-w)] flex-none flex-col justify-between gap-2.5 rounded-r-[11px] border-cc-rule border-l bg-cc-inset p-[var(--card-rail-pad)]"
          style={tween}
        >
          <div className="flex flex-col gap-[11px]">
            <div className="flex justify-end">
              {c.hasStats ? (
                <div className="truncate whitespace-nowrap rounded-[6px] bg-cc-pill px-[9px] py-[3px] text-[11.5px] text-cc-muted">
                  {c.examLabel}
                </div>
              ) : null}
              {c.noStats ? (
                <div className="whitespace-nowrap rounded-[6px] bg-cc-pill px-[9px] py-[3px] text-[11.5px] text-cc-dim">
                  No reviews yet
                </div>
              ) : null}
            </div>

            <div>
              {c.hasReviewStats ? (
                <>
                  <div className="mt-0.5">
                    <span className="font-semibold text-[26px] text-cc-brand leading-none tracking-[-0.02em] tabular-nums">
                      {c.happyPct}
                    </span>
                  </div>
                  <div className="mt-[3px] text-[11px] text-cc-muted leading-[1.3]">
                    of {c.statReviews} reviewers are happy they took the course
                  </div>
                </>
              ) : null}
              {c.noReviewStats ? (
                <>
                  <div className="mt-0.5 font-semibold text-[15px] text-cc-dim">
                    No reviews yet
                  </div>
                  <div className="mt-[3px] text-[11px] text-cc-muted leading-[1.3] @max-[440px]:hidden">
                    Be the first to say how it went.
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              {/* The artboard fills this bar with a fixed amber (#dfa53c) that
                  no `--cc-*` token carries: the palette has no accent family,
                  and `--cc-warn-btn` is amber only in dark, blue in light —
                  which would make both score bars one colour here. `--cc-warn-ink`
                  is the palette's amber-family value in both themes, so it is
                  substituted rather than a new token invented. In dark it sits
                  closer to `--cc-btn` than the design intends; the gap is real
                  and belongs in the palette, not in this file. */}
              <ScoreBar
                label="Workload"
                value={c.workload}
                width={c.wlW}
                barClass="bg-cc-warn-ink"
              />
              <ScoreBar
                label="Learning"
                value={c.learning}
                width={c.leW}
                barClass="bg-cc-btn"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 text-[12px] text-cc-muted @max-[440px]:hidden">
            <span className="flex items-center gap-1" title="Number of reviews">
              <ReviewCountIcon />
              {c.statReviews}
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}

/**
 * The row that names a new collection.
 *
 * It replaces the "Create new collection" row the moment that row is clicked, so
 * it takes focus on mount — otherwise the control the reader just activated has
 * vanished and their next keystrokes go nowhere. Focusing once on mount is why
 * this is its own component rather than an `autoFocus` attribute.
 *
 * Blur commits the name, as the artboard does — but only a blur that leaves the
 * picker. Blur fires before click, so committing on a blur *into* a collection
 * row would create a collection and toggle that row from one click.
 */
function NewCollectionField({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange?: (name: string) => void;
  onCommit?: () => void;
  onCancel?: () => void;
}) {
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-[9px] px-[9px] pt-0.5 pb-1.5">
      <span className="flex w-4 flex-none justify-center">
        <PlusIcon />
      </span>
      <input
        ref={field}
        value={value}
        aria-label="New collection name"
        onChange={(event) => onChange?.(event.target.value)}
        onBlur={(event) => {
          // `relatedTarget` is an EventTarget: it is null when focus leaves the
          // document, and `.closest` is not on every one of them.
          const next = event.relatedTarget;
          if (next instanceof Element && next.closest(`[${PICKER_MARKER}]`)) {
            return;
          }
          onCommit?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit?.();
          if (event.key === "Escape") onCancel?.();
        }}
        className="box-border h-7 min-w-0 flex-1 rounded-[6px] border border-cc-brand px-2 text-[13px] text-cc-ink outline-none"
      />
    </div>
  );
}

/**
 * One 1-10 mean. The number is shown raw and the bar is that number over ten,
 * which is the same width the artboard draws for the five-point scale it
 * predates (#68). Nothing here converts between scales.
 */
function ScoreBar({
  label,
  value,
  width,
  barClass,
}: {
  label: string;
  value: string;
  width: string;
  /** The bar's fill, as a token utility: the two bars must not share a colour. */
  barClass: string;
}) {
  return (
    <div>
      <div className="mb-[3px] flex justify-between text-[11.5px] text-cc-muted">
        <span>{label}</span>
        <span className="font-semibold text-cc-ink">{value}</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-[3px] bg-cc-pill">
        <div className={`h-full ${barClass}`} style={{ width }} />
      </div>
    </div>
  );
}

/**
 * The design's inline prompt over a control a visitor cannot use. Its two
 * buttons hand off to `AuthReasonDialog`, which is the app's one sign-in
 * surface — this panel only names the reason.
 */
function SignUpPrompt({
  title,
  body,
  onSignUp,
  onLogIn,
  className,
}: {
  title: string;
  body: string;
  onSignUp?: () => void;
  onLogIn?: () => void;
  className?: string;
}) {
  const panel = (
    <div className="px-[11px] pt-[11px] pb-2.5">
      <div className="flex items-center gap-2">
        <LockIcon />
        <div className="font-semibold text-[13.5px]">{title}</div>
      </div>
      <div className="mt-1.5 text-[12.5px] text-cc-muted leading-[1.5]">
        {body}
      </div>
      <div className="mt-[11px] flex gap-[7px]">
        <button
          type="button"
          onClick={onSignUp}
          className="flex h-8 flex-1 cursor-pointer items-center justify-center rounded-[8px] bg-cc-btn font-semibold text-[12.5px] text-cc-btn-fg hover:opacity-90"
        >
          Sign up
        </button>
        <button
          type="button"
          onClick={onLogIn}
          className="flex h-8 flex-1 cursor-pointer items-center justify-center rounded-[8px] border border-cc-rule3 bg-cc-surface font-medium text-[12.5px] text-cc-brand hover:border-cc-hov"
        >
          Log in
        </button>
      </div>
    </div>
  );

  if (!className) return panel;
  return (
    <div
      className={`box-border rounded-[10px] border border-cc-rule2 bg-cc-surface shadow-[0_8px_24px_rgba(20,30,45,0.14)] ${className}`}
    >
      {panel}
    </div>
  );
}

// The artboard's own glyphs, kept verbatim so the card does not drift from the
// design when an icon package renames or redraws one.

function Svg({
  size = 15,
  fill = "none",
  strokeWidth = 1.8,
  className,
  children,
}: {
  size?: number;
  fill?: string;
  strokeWidth?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function CheckCircleIcon({ fill }: { fill: string }) {
  return (
    <Svg size={16} fill={fill} className="flex-none">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

function PrerequisiteTickIcon({ taken }: { taken?: boolean }) {
  return (
    <Svg size={11} strokeWidth={2.2} className="flex-none">
      <circle cx="12" cy="12" r="10" />
      {taken ? <path d="m9 12 2 2 4-4" /> : null}
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg className="flex-none text-cc-dim">
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

function ReviewIcon() {
  return (
    <Svg strokeWidth={2} className="flex-none">
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3.2A8 8 0 1 1 21 12z" />
    </Svg>
  );
}

function BookmarkIcon({ fill }: { fill: string }) {
  return (
    <Svg fill={fill} className="flex-none">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

function AddToCollectionIcon() {
  return (
    <Svg className="flex-none">
      <rect x="3" y="5" width="14" height="14" rx="2.5" />
      <path d="M8.5 12h5M11 9.5v5" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg size={16} strokeWidth={2} className="text-cc-brand">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Svg>
  );
}

function CollectionCheckIcon({ fill, tick }: { fill: string; tick: string }) {
  return (
    <Svg size={16} fill={fill}>
      <rect x="3" y="5" width="14" height="14" rx="2.5" />
      {tick ? <path d={tick} /> : null}
    </Svg>
  );
}

function TrashIcon() {
  return (
    <Svg strokeWidth={1.9} className="flex-none">
      <path d="M4 7h16" />
      <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  );
}

function ReviewCountIcon() {
  return (
    <Svg size={14} strokeWidth={2} className="flex-none">
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3.2A8 8 0 1 1 21 12z" />
    </Svg>
  );
}
