"use client";

import { LogOut, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  type AuthReason,
  AuthReasonDialog,
  useLogout,
  useSessionData,
} from "@/features/auth";
import { ThemeToggle } from "@/features/shell";
import { isUnplaced, useNeighbourhood } from "../api/queries";
import { FindYourDot, type FindYourDotStatus } from "./find-your-dot";
import { HeroNetwork } from "./hero-network";

/**
 * The landing page.
 *
 * It owns its own chrome. `/` sits outside the app shell deliberately — the
 * artboard gives this page a wordmark bar and no rail — so the header here is
 * the landing's, not a second copy of the shell's.
 *
 * Responsive is a container query on the page itself, matching the artboards:
 * the layout answers to its rendered box, not to the viewport.
 */

const TRY = ["deep learning", "machine learning", "DD2380"];

const SECTIONS = [
  {
    kicker: "Search",
    title: "Every KTH course, one field",
    body: "Filter by school, credits or rating. Open as many courses as you like side by side.",
  },
  {
    kicker: "Read",
    title: "Numbers, not vibes",
    body: "Examination mix, theoretical versus applied, workload and learning — aggregated per course.",
  },
  {
    kicker: "Review",
    title: "Write first, sign in last",
    body: "Fill in a review as a guest. You only need an account at the moment you post it.",
  },
] as const;

export function Landing() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isPending: sessionPending } = useSessionData();
  const logout = useLogout();

  const arrivedFromLink = searchParams.get("dot");
  const [query, setQuery] = useState("");
  const [authReason, setAuthReason] = useState<AuthReason | null>(null);
  const [dotOpen, setDotOpen] = useState(arrivedFromLink !== null);
  const [expired, setExpired] = useState(arrivedFromLink === "expired");

  // The private link lands here with its outcome in the URL. Read once, then
  // take it back out so a reload does not replay the reveal.
  useEffect(() => {
    if (arrivedFromLink !== null) router.replace("/");
  }, [arrivedFromLink, router]);

  const signedIn = user !== null;
  const neighbourhood = useNeighbourhood(dotOpen && signedIn && !expired);

  const status = dotStatus({
    expired,
    sessionPending,
    signedIn,
    isSuccess: neighbourhood.isSuccess,
    isError: neighbourhood.isError,
    error: neighbourhood.error,
  });

  function submitSearch(value: string) {
    const q = value.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="@container cc-theme min-h-dvh bg-cc-pg text-cc-ink text-sm @lg:h-dvh @lg:overflow-y-auto">
      <header className="relative z-10 flex h-[66px] items-center justify-between gap-5 border-cc-rule border-b bg-cc-pg px-4 @lg:px-7">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-cc-ink no-underline"
        >
          {/* biome-ignore lint/performance/noImgElement: a fixed 26px mark; next/image adds a loader for nothing. */}
          <img
            src="/ais-symbol-blue.png"
            alt=""
            data-testid="landing-mark-light"
            className="size-[26px] shrink-0 object-contain dark:hidden"
          />
          {/* biome-ignore lint/performance/noImgElement: a fixed 26px mark; next/image adds a loader for nothing. */}
          <img
            src="/ais-symbol-white.png"
            alt=""
            data-testid="landing-mark-dark"
            className="hidden size-[26px] shrink-0 object-contain dark:block"
          />
          <span aria-hidden className="h-[28px] w-px bg-cc-rule3" />
          <span className="font-semibold text-[15px] leading-[1.15]">
            Course
            <br />
            Community
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {sessionPending ? null : user ? (
            <div className="flex items-center gap-2">
              <span className="flex h-[34px] items-center gap-2 rounded-[8px] bg-cc-pill py-0 pr-[11px] pl-[5px]">
                <span className="flex size-6 items-center justify-center rounded-full bg-cc-btn font-bold text-[10px] text-cc-btn-fg">
                  {initials(user)}
                </span>
                <span className="max-w-[10rem] truncate font-medium text-[13px]">
                  {displayName(user)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Log out"
                className="flex h-[34px] items-center gap-1.5 rounded-[8px] px-[11px] font-medium text-[13px] text-cc-chip-ink hover:bg-cc-pill"
              >
                <LogOut size={15} strokeWidth={1.9} aria-hidden />
                <span className="hidden @lg:inline">Log out</span>
              </button>
            </div>
          ) : (
            // On a narrow frame the artboard moves these two into a card at the
            // foot of the page instead of crowding the bar.
            <div className="hidden items-center gap-2 @lg:flex">
              <button
                type="button"
                onClick={() => setAuthReason("log-in")}
                className="flex h-[34px] items-center rounded-[8px] border border-transparent bg-transparent px-[13px] font-medium text-[13px] text-cc-brand hover:bg-cc-pill"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setAuthReason("sign-up")}
                className="flex h-[34px] items-center rounded-[8px] bg-cc-btn px-[15px] font-semibold text-[13px] text-cc-btn-fg hover:opacity-[0.88]"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </header>

      <section
        data-hero
        className="relative min-h-[480px] @lg:min-h-[600px] overflow-hidden"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          <HeroNetwork neighbourhood={neighbourhood.data ?? null} />
        </div>

        <div className="relative z-[1] flex min-h-[480px] @lg:min-h-[600px] flex-col items-center justify-center px-4 py-14 @lg:px-7">
          <div className="flex w-full max-w-[720px] flex-col items-center text-center">
            <p
              data-hero-clear
              className="m-0 font-semibold text-[11px] text-cc-dim uppercase tracking-[0.09em]"
            >
              Run by students at KTH
            </p>
            <h1
              data-hero-clear
              className="mt-3.5 text-balance font-semibold text-[30px] @lg:text-[44px] leading-[1.08] tracking-[-0.025em]"
            >
              Find the Course You Will Be Happy You Took
            </h1>

            <form
              data-hero-clear
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch(query);
              }}
              className="mt-4 @lg:mt-[97px] flex h-[42px] w-full @lg:max-w-[560px] items-center gap-2.5 rounded-[10px] border border-cc-rule3 bg-cc-surface px-3.5"
            >
              <Search
                size={16}
                strokeWidth={2}
                aria-hidden
                className="shrink-0 text-cc-muted"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a course, code or subject"
                aria-label="Search a course, code or subject"
                className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-cc-ink outline-none"
              />
            </form>

            <div
              data-hero-clear
              className="mt-4 flex flex-wrap items-center justify-center gap-[7px]"
            >
              <span className="text-[12px] text-cc-dim">Try</span>
              {TRY.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => submitSearch(term)}
                  className="flex h-7 items-center rounded-[14px] border border-cc-rule2 bg-cc-surface px-[11px] text-[12.5px] text-cc-chip-ink hover:border-cc-hov"
                >
                  {term}
                </button>
              ))}
            </div>

            <p
              data-hero-clear
              className="mt-5 flex items-center gap-1.5 text-[12.5px] text-cc-dim"
            >
              <span>Already a member?</span>
              <button
                type="button"
                onClick={() => {
                  setExpired(false);
                  setDotOpen(true);
                }}
                className="cursor-pointer font-medium text-cc-muted underline underline-offset-2 hover:text-cc-brand"
              >
                Find your dot.
              </button>
            </p>
          </div>
        </div>
      </section>

      <section className="border-cc-rule border-t bg-cc-surface px-4 py-[34px] @lg:px-7">
        <div className="mx-auto flex max-w-[960px] flex-col gap-[22px] @lg:grid @lg:grid-cols-3">
          {SECTIONS.map((section) => (
            <div key={section.kicker}>
              <p className="m-0 font-semibold text-[10.5px] text-cc-dim uppercase tracking-[0.09em]">
                {section.kicker}
              </p>
              <p className="mt-[7px] mb-0 font-semibold text-[15px]">
                {section.title}
              </p>
              <p className="mt-[5px] mb-0 text-[13.5px] text-cc-muted leading-[1.5]">
                {section.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {!sessionPending && !signedIn ? (
        <section className="px-5 pt-5 pb-9 @lg:hidden">
          <div className="rounded-[11px] border border-cc-rule2 bg-cc-surface p-5">
            <p className="m-0 font-semibold text-[11px] text-cc-brand uppercase tracking-[0.06em]">
              Join
            </p>
            <p className="mt-2 mb-0 font-semibold text-[17px] leading-[1.25]">
              Create your account
            </p>
            <p className="mt-1.5 mb-0 text-[13px] text-cc-muted leading-[1.5]">
              Free for KTH students. You keep everything you were looking at.
            </p>
            <button
              type="button"
              onClick={() => setAuthReason("sign-up")}
              className="mt-4 flex h-[42px] w-full items-center justify-center rounded-[9px] bg-cc-btn font-semibold text-[13.5px] text-cc-btn-fg hover:opacity-[0.88]"
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setAuthReason("log-in")}
              className="mt-2 flex h-[42px] w-full items-center justify-center rounded-[9px] border border-cc-rule3 bg-cc-surface font-medium text-[13.5px] text-cc-ink hover:border-cc-hov"
            >
              Log in
            </button>
          </div>
        </section>
      ) : null}

      <FindYourDot
        open={dotOpen}
        status={status}
        onClose={() => {
          setDotOpen(false);
          setExpired(false);
        }}
        onRetry={() => {
          if (expired) {
            setExpired(false);
            return;
          }
          void neighbourhood.refetch();
        }}
      />

      <AuthReasonDialog
        reason={authReason}
        onReasonChange={setAuthReason}
        onClose={() => setAuthReason(null)}
      />
    </div>
  );
}

/**
 * Where the flow has got to.
 *
 * Order matters: a dead link is reported before anything else is attempted, and
 * an unresolved session never shows a member the sign-in form for one frame.
 */
function dotStatus(input: {
  expired: boolean;
  sessionPending: boolean;
  signedIn: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
}): FindYourDotStatus {
  if (input.expired) return "expired";
  if (input.sessionPending) return "locating";
  if (!input.signedIn) return "sign-in";
  if (input.isSuccess) return "placed";
  if (isUnplaced(input.error)) return "unplaced";
  if (input.isError) return "unavailable";
  return "locating";
}

function displayName(user: { name?: string | null; email?: string | null }) {
  return user.name?.trim() || (user.email?.trim().split("@")[0] ?? "");
}

function initials(user: { name?: string | null; email?: string | null }) {
  const name = user.name?.trim() ?? "";
  const fromName = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return fromName || user.email?.trim().charAt(0).toUpperCase() || "?";
}
