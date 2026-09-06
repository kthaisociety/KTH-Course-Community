"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A small panel anchored to a button: the tile's ⋯ menu, and the detail's "Add
 * course" list.
 *
 * Both artboards close their popovers on a pointer down anywhere outside, and
 * this adds the two things a keyboard needs and markup alone cannot give:
 * Escape closes, and closing puts focus back on the trigger it came from —
 * without that, dismissing a menu drops the caret at the top of the document.
 *
 * The trigger is excluded from "outside" so a click on it toggles once rather
 * than closing on pointer down and reopening on click.
 */
export function usePopover<Panel extends HTMLElement = HTMLDivElement>() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<Panel>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggle = useCallback(() => setIsOpen((open) => !open), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isOpen]);

  return { isOpen, toggle, close, panelRef, triggerRef };
}
