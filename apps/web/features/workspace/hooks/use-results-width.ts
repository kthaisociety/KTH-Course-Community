"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The width of the column the pane shares its row with, watched rather than
 * assumed.
 *
 * Both hosts hand the course card a collapse ramp, and the ramp's input is this
 * number: `courseCardGeometry(width)` turns it into the card's `geo`. Watching
 * the column's own box rather than the viewport is what makes the ramp right for
 * every reason the column can narrow — a phone, a resized window, and a
 * workspace pane dragged open beside it. Neither host has to learn that the pane
 * exists; it lives here because the pane is the reason the column moves at all.
 *
 * `Infinity` is the honest starting value: it is the top of the ramp, so a card
 * renders fully expanded on the server and on the first client paint, and only
 * collapses once something has actually measured a narrower column. A zero
 * measurement is a column that is not laid out yet (or jsdom, which lays nothing
 * out), never one that has been crushed to nothing, so it is ignored.
 */
export function useResultsWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(Number.POSITIVE_INFINITY);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver !== "function") return;

    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? element.clientWidth;
      if (measured > 0) setWidth(measured);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
