import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  /** Omitted entirely when there is nothing to say — the artboard renders no empty line. */
  subtitle?: ReactNode;
};

/**
 * The one page-title block every wide-shell page uses — same padding, size and
 * spacing everywhere, so no page hand-writes its own header markup.
 *
 * Straight from `docs/design/Course Community - Page Header.dc.html`, which is
 * the whole of that artboard.
 */
export function PageHeader({ title, subtitle }: Props) {
  return (
    // The named shell container is deliberately used here instead of this
    // component's nearest PageColumn container. It is the same breakpoint the
    // rail and top-bar heading use, so nested page containers cannot create a
    // tablet interval with zero (or two) route headings.
    <div className="hidden px-7 pt-[26px] @3xl/shell:block">
      <h1 className="m-0 font-semibold text-[26px] tracking-[-0.02em]">
        {title}
      </h1>
      {subtitle ? (
        <div className="mt-1.5 text-[13.5px] text-cc-muted leading-[1.5]">
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
