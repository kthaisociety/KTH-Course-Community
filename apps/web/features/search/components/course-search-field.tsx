"use client";

import { Search as SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** The field's accessible name. There is no visible label inside the bar. */
  label: string;
  /**
   * Layout only — the width cap, the margins, the place in a row. The bar's own
   * shape (its height, border, radius and focus treatment) is not a prop,
   * because a caller that changes it stops being this bar.
   */
  className?: string;
};

/**
 * The bar a course is searched from — Explore's, and the catalogue search
 * inside "Add a course by hand".
 *
 * From `docs/design_ref/2026-09-06/Course Community - Explore.dc.html`. The
 * modal in `Course Community - Taken Courses.dc.html` draws its own bar a
 * hair tighter (9px radius, 13px padding, 13.5px text); this renders Explore's
 * measurements in both places. They are one control to the reader — the same
 * icon, the same box, searching the same catalogue — and the half-pixel
 * differences between the two artboards buy nothing that being one component
 * does not buy more of.
 *
 * ## The focus treatment is the reason this is a component
 *
 * The bar *is* the control here: the input inside it is transparent and
 * unbordered, so the app's one focus ring came up around the *text*, inside
 * the bar's own border, with a couple of pixels of surface showing between the
 * two rounded rectangles. `data-cc-field` suppresses the input's own ring and
 * `has-[input:focus-visible]:border-cc-focus` lights the box's border instead.
 * Both halves are argued in `globals.css`, and **neither works without the
 * other** — an input carrying `data-cc-field` with nothing lighting up around
 * it has no focus indicator at all. Keeping the pair in one place is what
 * stops a third bar being built with only one half of it, which is how the
 * modal's bar came to ring its text.
 *
 * The landing's hero bar is deliberately not this component. It is the element
 * `search-morph.tsx` measures and animates, and it carries `data-hero-clear`
 * for the graph's keep-out — it is a bar with a second job, and it renders the
 * same pair by hand with a comment saying so.
 */
export function CourseSearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex h-[42px] items-center gap-2.5 rounded-[10px] border border-cc-rule3 bg-cc-surface px-3.5 has-[input:focus-visible]:border-cc-focus",
        className,
      )}
    >
      <SearchIcon
        size={16}
        strokeWidth={2}
        aria-hidden
        className="shrink-0 text-cc-muted"
      />
      {/* `type="search"` for the Escape-clears and the semantics; the native
          clear button is hidden because the artboard draws none, and the two
          surfaces that use this bar both offer their own way back to nothing. */}
      <input
        type="search"
        data-cc-field
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-cc-ink outline-none placeholder:text-cc-dim2 [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  );
}
