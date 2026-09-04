import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  /** Omitted entirely when there is nothing to say — the artboard renders no empty line. */
  subtitle?: ReactNode;
};

/**
 * The one page-title block every page uses — same padding, size and spacing
 * everywhere, so no page hand-writes its own header markup.
 *
 * Straight from `docs/design/Course Community - Page Header.dc.html`, which is
 * the whole of that artboard.
 */
export function PageHeader({ title, subtitle }: Props) {
  return (
    <div className="px-7 pt-[26px]">
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
