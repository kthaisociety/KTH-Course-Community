"use client";

import { LogOut, Search } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  type AuthReason,
  AuthReasonDialog,
  useLogout,
  useSessionData,
} from "@/features/auth";
import {
  clearSearchBarHandoff,
  stashSearchBarHandoff,
  ThemeToggle,
} from "@/features/shell";
import { isUnplaced, useNeighbourhood, usePublicWindow } from "../api/queries";
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
 *
 * ## Leaving for Explore
 *
 * Submitting the search does not navigate straight away. The bar the reader
 * typed into is, visually, the same element as Explore's — same height, radius,
 * border, surface, padding and `max-w-[560px]` — so instead of swapping one page
 * for another it hands its box over and lets Explore continue it: the bar rises
 * into its place on Explore while the rail slides in from the left, both on one
 * spring. `@/features/shell`'s `search-morph` is the seam, and everything about
 * how the two ends are coupled is written up there.
 *
 * This page's half is the departure. Everything that is not the bar clears out
 * of the way over 130ms, the hero graph stops so the only thing moving is the
 * layout, and the navigation is fired by that exit *finishing* rather than by a
 * timer guessing when it will have. `Course Community - Landing.dc.html`'s
 * `toExplore()` (line 501) sketches the same departure with a blind
 * `setTimeout(130)`; this is the one place in the app authorised to improve on
 * the artboard, and that timer is most of the reason why.
 */

const TRY = ["deep learning", "machine learning", "DD2380"];

/** The artboard's own exit easing, `cubic-bezier(.4,0,1,1)` over roughly 130ms. */
const EXIT_EASE: [number, number, number, number] = [0.4, 0, 1, 1];

/**
 * Everything that leaves when the search is submitted.
 *
 * The set is "the page, except the bar". The bar is the one thing that survives
 * the navigation, so it is simply the one element with no `variants` — the
 * orchestrating root propagates the label to every motion child that has them
 * and the plain `<form>` is untouched.
 *
 * That is deliberately *not* the `data-hero-clear` set. Those marks exist for
 * the hero graph's keep-out, and the form carries one because the graph must not
 * draw dots behind the search bar — reusing them as the exit selector would fade
 * out the one element the whole transition is built to keep.
 *
 * The drift is up, not out: the bar is about to rise, and the artboard shifts
 * the whole landing layer up by 40px on the way to Explore. Ten pixels reads as
 * the page being drawn after it rather than as a separate movement.
 */
const HERO_EXIT: Variants = {
  "at-rest": { opacity: 1, y: 0 },
  leaving: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.13, ease: EXIT_EASE },
  },
};

/**
 * The three supporting blocks under the hero, in the artboard's order.
 *
 * "Search" departs from `Course Community - Landing.dc.html` by one sentence.
 * The artboard writes *"Open as many courses as you like side by side"*, which
 * promises a multi-column comparison the workspace pane does not do: the
 * **pane** sits side by side with the results, and the **courses inside it**
 * are tabs, one visible at a time (`Course Community - Workspace Pane.dc.html`
 * keeps a single active `tab` and an "All open panes" overflow menu). The
 * design governs copy, so this is the smallest edit that keeps the sentence's
 * shape and cadence while describing the pane the design itself draws.
 */
const SECTIONS = [
  {
    kicker: "Search",
    title: "Every KTH course, one field",
    body: "Filter by school, credits or rating. Open as many courses as you like, each a tab in the pane beside your results.",
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
  const reduceMotion = useReducedMotion();

  const arrivedFromLink = searchParams.get("dot");
  const [query, setQuery] = useState("");
  const [authReason, setAuthReason] = useState<AuthReason | null>(null);
  const [dotOpen, setDotOpen] = useState(arrivedFromLink !== null);
  const [expired, setExpired] = useState(arrivedFromLink === "expired");

  /** The bar whose box Explore continues. */
  const barRef = useRef<HTMLFormElement>(null);
  /** Where this page is going, once the surroundings have finished clearing. */
  const [leavingFor, setLeavingFor] = useState<string | null>(null);
  const navigatedRef = useRef(false);
  const prefetchedRef = useRef(false);

  // The private link lands here with its outcome in the URL. Read once, then
  // take it back out so a reload does not replay the reveal.
  useEffect(() => {
    if (arrivedFromLink !== null) router.replace("/");
  }, [arrivedFromLink, router]);

  const signedIn = user !== null;

  /**
   * The hero draws the real community to everybody, on load.
   *
   * A member gets their own bounded neighbourhood; anybody else gets the public
   * window around the community origin. The public read is also the fallback
   * when a member's own read fails, so a graph that can be drawn is drawn —
   * what a member loses in that case is the "You", not the community.
   */
  const neighbourhood = useNeighbourhood(!sessionPending && signedIn);
  const publicWindow = usePublicWindow(
    !sessionPending && (!signedIn || neighbourhood.isError),
  );
  const heroWindow = neighbourhood.data ?? publicWindow.data ?? null;

  const status = dotStatus({
    expired,
    sessionPending,
    signedIn,
    isSuccess: neighbourhood.isSuccess,
    isError: neighbourhood.isError,
    error: neighbourhood.error,
  });

  /**
   * Warm `/search` while the reader is still typing.
   *
   * The exit runs for 130ms and then navigates; without the route already in
   * the client cache, the reader watches the hero clear and then waits on a
   * fetch, and the bar arrives on Explore late enough that it reads as a new
   * page rather than the same one continuing.
   *
   * Both ways into a search warm it: focusing the field, and reaching for a
   * "Try" chip — a chip is a one-click submit that never touches the field, so
   * focus alone would leave that path cold. Fired from event handlers and fenced
   * by a ref: a prefetch is a request, not a piece of state, and putting
   * `router` in an effect's dependency array is how two of this repo's earlier
   * render loops started.
   */
  function warmExplore() {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    router.prefetch("/search");
  }

  function submitSearch(value: string) {
    const q = value.trim();
    if (!q) return;
    // A second Enter on a page that is already leaving would stash a second
    // rect and push twice.
    if (leavingFor) return;
    const href = `/search?q=${encodeURIComponent(q)}`;

    // Reduced motion is the plain navigation this page has always done, and the
    // artboard drops the transition here too. So is a bar with no measurable
    // box: there is nothing to hand over, and a rect Explore would reject is
    // worse than no rect at all. Either way any rect an earlier submit left
    // behind goes with it, so Explore can never inherit one.
    const from = barRef.current?.getBoundingClientRect();
    if (reduceMotion || !from?.width || !from.height) {
      clearSearchBarHandoff();
      router.push(href);
      return;
    }

    stashSearchBarHandoff(from);
    setLeavingFor(href);
  }

  /**
   * The exit is over; go.
   *
   * Hung off one of the clearing elements rather than off the orchestrating
   * root: every exit shares `HERO_EXIT`'s single transition, so any one of them
   * finishing means they all have, and a per-element callback does not depend on
   * how variant propagation reports completion upwards. It also fires once when
   * the page settles into `at-rest` on mount, which is what the `leavingFor`
   * guard is for.
   */
  function onExitComplete() {
    if (!leavingFor || navigatedRef.current) return;
    navigatedRef.current = true;
    router.push(leavingFor);
  }

  return (
    // The orchestrator: it animates nothing itself, it only broadcasts which
    // variant every clearing child should be in. `initial={false}` keeps the
    // page from playing its own arrival on mount.
    <motion.div
      initial={false}
      animate={leavingFor ? "leaving" : "at-rest"}
      className="@container cc-theme min-h-dvh bg-cc-pg text-cc-ink text-sm lg:h-dvh lg:overflow-y-auto"
    >
      <motion.header
        variants={HERO_EXIT}
        className="relative z-10 flex h-[66px] items-center justify-between gap-5 border-cc-rule border-b bg-cc-pg px-4 @lg:px-7"
      >
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
      </motion.header>

      <section
        data-hero
        className="relative min-h-[480px] @lg:min-h-[600px] overflow-hidden"
      >
        {/* The graph clears with everything else. It is the backdrop the bar is
            leaving, and a still canvas sitting behind a page that has faded out
            would be the last thing on screen when the route swaps. */}
        <motion.div
          variants={HERO_EXIT}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
        >
          {/*
            Find your dot only labels a node that is already on the canvas. The
            graph does not change when the flow succeeds — the reveal is the
            label, and closing the panel takes the label back off again.
          */}
          <HeroNetwork
            window={heroWindow}
            labelled={dotOpen && status === "placed"}
            paused={leavingFor !== null}
          />
        </motion.div>

        <div className="relative z-[1] flex min-h-[480px] @lg:min-h-[600px] flex-col items-center justify-center px-4 py-14 @lg:px-7">
          <div className="flex w-full max-w-[720px] flex-col items-center text-center">
            <motion.p
              variants={HERO_EXIT}
              data-hero-clear
              className="m-0 font-semibold text-[11px] text-cc-dim uppercase tracking-[0.09em]"
            >
              Run by students at KTH
            </motion.p>
            <motion.h1
              variants={HERO_EXIT}
              onAnimationComplete={onExitComplete}
              data-hero-clear
              className="mt-3.5 text-balance font-semibold text-[30px] @lg:text-[44px] leading-[1.08] tracking-[-0.025em]"
            >
              Find the Course You Will Be Happy You Took
            </motion.h1>

            {/* The one element that stays. It carries `data-hero-clear` for the
                graph's keep-out and no `variants` for the exit, which is the
                whole difference between the two sets. */}
            <form
              ref={barRef}
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
                onFocus={warmExplore}
                placeholder="Search a course, code or subject"
                aria-label="Search a course, code or subject"
                className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-cc-ink outline-none"
              />
            </form>

            <motion.div
              variants={HERO_EXIT}
              data-hero-clear
              className="mt-4 flex flex-wrap items-center justify-center gap-[7px]"
            >
              <span className="text-[12px] text-cc-dim">Try</span>
              {TRY.map((term) => (
                <button
                  key={term}
                  type="button"
                  onPointerEnter={warmExplore}
                  onFocus={warmExplore}
                  onClick={() => submitSearch(term)}
                  className="flex h-7 items-center rounded-[14px] border border-cc-rule2 bg-cc-surface px-[11px] text-[12.5px] text-cc-chip-ink hover:border-cc-hov"
                >
                  {term}
                </button>
              ))}
            </motion.div>

            <motion.p
              variants={HERO_EXIT}
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
            </motion.p>
          </div>
        </div>
      </section>

      <motion.section
        variants={HERO_EXIT}
        className="border-cc-rule border-t bg-cc-surface px-4 py-[34px] @lg:px-7"
      >
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
      </motion.section>

      {!sessionPending && !signedIn ? (
        <motion.section
          variants={HERO_EXIT}
          className="px-5 pt-5 pb-9 @lg:hidden"
        >
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
        </motion.section>
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
    </motion.div>
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
