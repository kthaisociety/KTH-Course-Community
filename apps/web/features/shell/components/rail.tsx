"use client";

import {
  Bookmark,
  BookOpen,
  CircleCheck,
  LogOut,
  Search,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthReason } from "@/features/auth";
import { useLogout, useMe, useSessionData } from "@/features/auth";
import { cn } from "@/lib/utils";

/**
 * The rail: the blue column every page renders beside.
 *
 * It is `--cc-rail` in both themes, but that token is **not** one colour in
 * both: `cc-theme.css` now calls it "the sidebar (darkens with the theme)" and
 * gives it `#1751a6` in light and `#0d2e5e` in dark. #85 was told the opposite
 * — "brand blue in both themes" — and #127 §2 corrects it. Nothing here changes
 * as a result; the token already swaps and the rail already reads it. Against
 * the revised dark page (`--cc-pg` `#071831`) the darker rail is still the
 * lighter of the two, so the column still separates from the content beside it
 * without the light theme's full brand blue glaring out of a dark screen.
 *
 * Its foreground is fixed even though its background is not. There is no
 * `--cc-rail-fg` in the palette, and the artboard paints on the rail with plain
 * white at varying alpha in both themes — which is what the `white/nn`
 * utilities here do, and what `--sidebar-*` in `globals.css` mirrors. That is
 * the one place this file is not reading a `--cc-*` token, and it is the
 * design's own decision.
 *
 * The avatar chip is a rail colour the artboard states outright with no token
 * behind it — `#7ea6d8` on `#0d2f5e`, in all seven artboards that draw the rail.
 * Tokens win over raw hex, so it joins the white-alpha family instead; the PR
 * says so, which is how the design gets corrected at source.
 *
 * **The Sign up button is not that case, and this comment used to say it was.**
 * It claimed the artboard's ink is `#12417f` and that white-alpha was the
 * deliberate substitution. Neither half survives the 2026-09-06 export. Six
 * artboards — About:44, Explore:45, My Page:45, Saved:45, Saved copy:45, Taken
 * Courses:44 — draw it as `background:#8bb3ef; color:#0a2449`. Landing:151 alone
 * still draws `#fff` / `#12417f`, which is where the old reading came from.
 *
 * So the button below is `bg-white text-cc-rail`, and that is what **no**
 * artboard draws: `--cc-rail` is `#1751a6` in light, not `#12417f`. Everything
 * else about it already matches — `mt-2.5`, `h-[34px]`, `rounded-[8px]`,
 * `13px/600`. Only the two colours are wrong, and they are not corrected here
 * because one rail component cannot follow two artboards; the export has to
 * agree with itself first. Tracked as the issue filed from #167, marked as
 * needing a design decision.
 *
 * The drawer renders this same component rather than a second one, so it keeps
 * the rail's metrics. The Mobile Preview draws slightly different ones — 56px of
 * top padding, a 28px mark — but that padding is the iOS device frame's status
 * bar, not a web value, and one rail is what keeps the two in step.
 */

type NavItem = {
  href: string;
  label: string;
  icon: typeof Search;
  strokeWidth: number;
};

/**
 * "Taken courses" is back, which #85 deferred only because `/taken` did not
 * exist yet and it would not ship a link that 404s. #92 built the route, so the
 * rail is the artboard's four items again.
 *
 * It is **fourth**, after "My Page", which is where the artboards draw it —
 * `Course Community - Explore.dc.html` and `Course Community - Taken
 * Courses.dc.html` both order the group Explore, Saved courses, My Page, Taken
 * courses. #85's note said "third in the list" in the same breath as calling it
 * "the rail's fourth link"; the artboards settle it.
 */
/**
 * "Collections" is deliberately *not* here, and #91's stopgap entry for it was
 * removed by #90. The artboard's rail has no such link: `Saved.dc.html` reaches
 * Collections by importing that artboard as a section of itself, and Saved now
 * does the same, so the design's own way in exists. `/collections` stays as the
 * route a `?collection=` permalink resolves to; nothing needs a second door.
 */
const NAV: readonly NavItem[] = [
  { href: "/search", label: "Explore", icon: Search, strokeWidth: 2.4 },
  {
    href: "/saved",
    label: "Saved courses",
    icon: Bookmark,
    strokeWidth: 2,
  },
  { href: "/profile", label: "My Page", icon: UserRound, strokeWidth: 2 },
  {
    href: "/taken",
    label: "Taken courses",
    icon: CircleCheck,
    strokeWidth: 1.8,
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The shape of every item in the rail's two link groups. */
const LINK =
  "flex items-center gap-2.5 rounded-[8px] px-2.5 py-[9px] no-underline hover:bg-white/10";

/**
 * How the account shows itself in the rail: a display name and the initials on
 * the avatar. Both fall back through the same fields in the same order, so the
 * circle can never disagree with the name beside it.
 */
function identity(
  user: { name?: string | null; email?: string | null } | null,
) {
  const full = user?.name?.trim() ?? "";
  const email = user?.email?.trim() ?? "";
  const initials = full
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return {
    name: full || email.split("@")[0] || "",
    initials: initials || email.charAt(0).toUpperCase() || "?",
  };
}

type Props = {
  /** Ask the shell to open the sign-in dialog. */
  onRequestAuth: (reason: AuthReason) => void;
  /** Set when the rail is the mobile drawer: closes it after a tap. */
  onDismiss?: () => void;
};

export function Rail({ onRequestAuth, onDismiss }: Props) {
  const pathname = usePathname() ?? "";
  const { user, isPending } = useSessionData();
  const { user: me } = useMe();
  const logout = useLogout();

  const savedCount = me?.savedCourseCodes.length ?? 0;
  const { name, initials } = identity(user);

  return (
    // `data-cc-sidebar` is the hook `globals.css` scopes the on-rail focus ring
    // to. It is here rather than a class because it marks what this surface *is*
    // — the one region painted in the brand colour — and the page's own focus
    // pair is invisible against it.
    <div
      data-cc-sidebar
      className="flex h-full w-full flex-col gap-1.5 bg-cc-rail px-2.5 py-3.5 text-white"
    >
      <div className="flex items-center justify-between gap-2 pr-1">
        <Link
          href="/"
          onClick={onDismiss}
          className="flex items-center gap-2.5 px-2 pt-1.5 pb-3.5 text-white no-underline"
        >
          {/* biome-ignore lint/performance/noImgElement: the mark is a fixed 34px asset; next/image adds a loader for nothing. */}
          <img
            src="/ais-symbol-white.png"
            alt="KTH AI Society"
            className="size-[34px] shrink-0 object-contain"
          />
          <span aria-hidden className="h-[28px] w-px bg-white/35" />
          <span className="font-semibold text-[15px] leading-[1.15]">
            Course
            <br />
            Community
          </span>
        </Link>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close menu"
            className="flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-white hover:bg-white/16"
          >
            <X size={15} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>

      <nav aria-label="Main" className="mt-3.5 flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onDismiss}
              aria-current={active ? "page" : undefined}
              className={cn(
                LINK,
                "text-white",
                active ? "bg-white/16 font-semibold" : "font-normal",
              )}
            >
              <item.icon
                size={16}
                strokeWidth={item.strokeWidth}
                className="shrink-0"
                aria-hidden
              />
              <span className="flex-1">{item.label}</span>
              {item.href === "/saved" && savedCount > 0 ? (
                <span className="rounded-[9px] bg-white/22 px-[7px] py-px font-semibold text-[11.5px]">
                  {savedCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5">
        <Link
          href="/about"
          onClick={onDismiss}
          className={cn(LINK, "text-white/82")}
        >
          <BookOpen
            size={16}
            strokeWidth={2}
            className="shrink-0"
            aria-hidden
          />
          About &amp; contact
        </Link>

        {/* Until the session has resolved we know neither state, and telling a
            member they are browsing as a guest for one frame is worse than a
            beat of nothing where the block will be. */}
        {isPending ? null : user ? (
          <div className="mt-2 flex items-center gap-2.5 rounded-[8px] bg-white/10 p-2.5">
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-white/25 font-bold text-[13px] text-white">
              {initials}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-[13px]">
              {name}
            </span>
            <button
              type="button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => {
                onDismiss?.();
                void logout();
              }}
              className="flex size-[28px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] text-white/75 hover:bg-white/16 hover:text-white"
            >
              <LogOut size={15} strokeWidth={1.9} aria-hidden />
            </button>
          </div>
        ) : (
          <div className="mt-2 border-white/20 border-t pt-3">
            {/* Reader-facing copy follows the artboard, so "guest" is right here
                even though CONTEXT.md bans it as an identifier. */}
            <p className="m-0 text-[11.5px] text-white/[0.78] leading-[1.45]">
              Browsing as a guest. Saving courses and posting reviews need an
              account.
            </p>
            <button
              type="button"
              onClick={() => {
                onDismiss?.();
                onRequestAuth("sign-up");
              }}
              className="mt-2.5 flex h-[34px] w-full cursor-pointer items-center justify-center rounded-[8px] bg-white font-semibold text-[13px] text-cc-rail"
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => {
                onDismiss?.();
                onRequestAuth("log-in");
              }}
              className="mt-1.5 flex h-[34px] w-full cursor-pointer items-center justify-center rounded-[8px] border border-white/40 font-medium text-[13px] text-white"
            >
              Log in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
