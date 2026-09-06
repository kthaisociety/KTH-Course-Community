import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * Render every component test the way the app actually runs.
 *
 * Next enables Strict Mode for the App Router by default and `next.config.ts`
 * does not turn it off, so every mount in development runs its effects twice —
 * mount, clean up, mount again. Tests rendered without it, which is how a pane
 * that destroyed a stored review draft on its second mount shipped green: the
 * round-trip test in `workspace-pane.spec.tsx` unmounted and remounted, which
 * is one mount each, and the bug needed two in a row.
 *
 * Turning it on globally is deliberate. Anything that breaks under it is
 * something the development build is already doing to a real user, so the fix
 * belongs in the component and not in an exemption here.
 */
configure({ reactStrictMode: true });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Both, and here rather than in each suite's own `beforeEach`. The workspace
  // keeps its open list in `sessionStorage` and its review drafts in
  // `localStorage`, so a suite that clears only the one it remembers about
  // leaks the other into the next test — which is a failure in whichever test
  // runs second, about state it never set.
  sessionStorage.clear();
  localStorage.clear();
});

// jsdom ships neither of these, and Radix's dialog needs both to open.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Radix measures scrollbars and traps focus through these.
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
