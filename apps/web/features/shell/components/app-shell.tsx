"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { type AuthReason, AuthReasonDialog } from "@/features/auth";
import { Rail } from "@/features/shell/components/rail";
import { SearchMorphProvider } from "@/features/shell/components/search-morph";
import { ThemeToggle } from "@/features/shell/components/theme-toggle";
import { pageTitleFor } from "@/features/shell/lib/page-title";

/**
 * The frame every route renders inside: the blue rail, the topbar, and the
 * scrolling content column between them.
 *
 * Responsive is a container query on the frame itself, not a viewport media
 * query, matching how the artboards respond to their rendered box. Below `@3xl`
 * the rail leaves the flow and returns as a drawer behind the topbar's menu
 * button.
 *
 * Visitors get the same frame as members. Browsing, searching and reading
 * reviews never need an account, so nothing here gates the page on a session —
 * only the rail's footer changes, and it says what an account would add.
 *
 * `cc-theme` sits on the root because the frame now wraps every route: it is
 * the opted-in subtree that utility was written for, and it is what makes a
 * theme flip cross-fade rather than snap, exactly as `cc-theme.css` does.
 *
 * The frame also publishes its rail to the route rendering inside it, through
 * `SearchMorphProvider`. A search arriving from the landing page brings the rail
 * in from the left on the same spring that carries the search bar up, and the
 * bar belongs to Explore while the rail belongs here — so the shell hands the
 * rail over rather than leaving a page to go querying for chrome it does not
 * own. See `search-morph.tsx`.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authReason, setAuthReason] = useState<AuthReason | null>(null);
  const railRef = useRef<HTMLElement | null>(null);

  return (
    <div className="@container/shell cc-theme flex h-dvh w-full overflow-hidden bg-cc-pg text-cc-ink text-sm">
      {/* The rail is rendered before the content column, which is also the
          order React attaches their refs in: by the time a route's own layout
          effect runs, `railRef` is bound. */}
      <aside
        ref={railRef}
        className="hidden w-[236px] shrink-0 @3xl/shell:block"
      >
        <Rail onRequestAuth={setAuthReason} />
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          overlayClassName="bg-[rgba(20,30,45,0.4)] supports-backdrop-filter:backdrop-blur-none"
          className="w-[250px] max-w-[85vw] gap-0 border-none bg-cc-rail p-0 sm:max-w-[250px]"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Rail
            onRequestAuth={setAuthReason}
            onDismiss={() => setDrawerOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[66px] shrink-0 items-center gap-2.5 border-cc-rule border-b px-3.5 @3xl/shell:justify-end @3xl/shell:px-7">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex size-[36px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] text-cc-brand hover:bg-cc-pill @3xl/shell:hidden"
          >
            <Menu size={19} strokeWidth={2} aria-hidden />
          </button>
          {/* The page you are on, named the way the Mobile Preview names it —
              from the route, so it is right on the first paint. The brand is
              not lost with the rail: the drawer carries it, as it does there. */}
          <h1 className="min-w-0 flex-1 truncate font-semibold text-[16px] leading-[1.2] @3xl/shell:hidden">
            {pageTitleFor(pathname)}
          </h1>
          <ThemeToggle />
        </header>

        <main
          className={
            pathname === "/search"
              ? "min-h-0 flex-1 overflow-hidden"
              : "scrollbar-subtle min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
          }
        >
          <SearchMorphProvider railRef={railRef}>
            {children}
          </SearchMorphProvider>
        </main>
      </div>

      <AuthReasonDialog
        reason={authReason}
        onReasonChange={setAuthReason}
        onClose={() => setAuthReason(null)}
      />
    </div>
  );
}
