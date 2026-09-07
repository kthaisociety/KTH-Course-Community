import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  /** Omitted entirely when there is nothing to say — the artboard renders no empty line. */
  subtitle?: ReactNode;
  /**
   * Drawn to the left of the title block, vertically centred against it.
   *
   * Only `/profile` passes one, and passes an avatar: the page's subject is the
   * reader themselves, so their picture belongs beside their name rather than
   * in a second block underneath. The slot takes a finished node so this
   * component stays domain-neutral — it is shared by six routes and must not
   * learn what a user is.
   */
  leading?: ReactNode;
};

/**
 * The one page-title block every wide-shell page uses — same padding, size and
 * spacing everywhere, so no page hand-writes its own header markup.
 *
 * Straight from `docs/design_ref/2026-09-06/Course Community - Page Header.dc.html`, which is
 * the whole of that artboard.
 */
export function PageHeader({ title, subtitle, leading }: Props) {
  return (
    // The named shell container is deliberately used here instead of this
    // component's nearest PageColumn container. It is the same breakpoint the
    // rail and top-bar heading use, so nested page containers cannot create a
    // tablet interval with zero (or two) route headings.
    <div className="hidden px-7 pt-[26px] @3xl/shell:block">
      {/*
        A flex row even with no `leading`, which is why the title block carries
        `flex-1`: a lone flex child that fills its line lays out exactly as the
        block element this used to be, so the five pages that pass no slot keep
        the header they had. `gap` only applies between items, so it costs them
        nothing either.
      */}
      <div className="flex items-center gap-3.5">
        {leading}
        <div className="min-w-0 flex-1">
          <h1 className="m-0 font-semibold text-[26px] tracking-[-0.02em]">
            {title}
          </h1>
          {subtitle ? (
            <div className="mt-1.5 text-[13.5px] text-cc-muted leading-[1.5]">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
