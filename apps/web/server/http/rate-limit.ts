/**
 * Bounds on how often a caller with no account may reach an expensive route.
 *
 * `server/http/` is the domain-neutral shelf `body-cap.ts` already sits on, and
 * this belongs beside it for the same reason: nothing here knows what the
 * request contains. It exists because `/api/user/transcript` now answers a
 * signed-out visitor — the Taken Courses artboard has a guest upload a
 * transcript and asks for the account at the *keep* step
 * (`docs/design_ref/2026-09-06/Course Community - Taken Courses.dc.html`)
 * — and a route that runs a PDF parser for anyone who asks needs a ceiling
 * that an account no longer provides.
 *
 * ## What this is, and what it is not
 *
 * The counters live in this process's memory. That is worth stating plainly
 * rather than dressing up:
 *
 * - **It holds within one server.** The app ships as `output: "standalone"` in
 *   a container (`Dockerfile.web`), so it is one long-lived Node process and
 *   the counters survive between requests. Run two replicas and the effective
 *   ceiling is two ceilings; a restart or a redeploy resets them to zero.
 * - **The key is client-supplied.** There is no socket address in a Fetch
 *   `Request`, so the caller is identified from `x-forwarded-for` /
 *   `x-real-ip`, which only an ingress that *overwrites* them makes truthful.
 *   Anyone willing to vary that header can have as many buckets as they like.
 * - So a per-caller limit here is a **speed bump**: it stops an accident, a
 *   stuck retry loop and casual abuse. It does not stop a determined attacker,
 *   and nothing in one process's memory would.
 *
 * The bound that actually holds against a determined attacker is elsewhere and
 * predates this: `server/ingest/transcript/pdf-text.ts` runs at most two
 * extractions at once, queues at most eight more, refuses past that, and kills
 * a worker thread at five seconds. However fast requests arrive, the CPU they
 * can hold is bounded by that, and `capRequestBody` bounds the bytes. What a
 * flood can still do is make *everyone else* wait behind it, which is why the
 * route also holds the guest share down with the gate below — so a signed-in
 * reader is never queued behind a stranger's flood.
 *
 * The real fix for the distributed case is a shared counter (Redis, or Neon
 * with a cheap upsert). There is no Redis in this stack today and adding one
 * for this route alone is not worth a dependency; when one arrives for another
 * reason, this file is the seam to move behind it.
 */

/** Whether a request may proceed, and when to come back if not. */
export type RateVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const ALLOWED: RateVerdict = { allowed: true };

export type FixedWindowLimiter = {
  /** Counts one request against `key`, and says whether it may proceed. */
  take(key: string, now?: number): RateVerdict;
  /** Test seam: forgets every window. */
  reset(): void;
};

type Bucket = { count: number; resetAt: number };

/**
 * A fixed-window counter: `limit` requests per `windowMs`, per key.
 *
 * Fixed window rather than a sliding log or a token bucket because the thing
 * being limited costs whole seconds of CPU and is expected a handful of times
 * per person per year. Precision at the window edge — the classic complaint,
 * that a caller can spend two windows' worth across the boundary — buys nothing
 * here and costs a per-key array of timestamps that an attacker chooses the
 * length of.
 *
 * **The map is bounded.** An unbounded key space *is* the denial of service the
 * limiter was added to prevent: one request per forged header would otherwise
 * grow a `Map` until the process died. Expired buckets are swept once the map
 * outgrows `maxKeys`, and if the sweep does not free anything — every bucket
 * live, which means a flood across many keys — the oldest are dropped. A
 * dropped bucket is a caller who gets their allowance back early; that is the
 * right way to fail, because the concurrency cap is still underneath it.
 */
export function createFixedWindowLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): FixedWindowLimiter {
  const buckets = new Map<string, Bucket>();

  function sweep(now: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    // Insertion order is close enough to age: a bucket is re-inserted when it
    // expires and is taken again, so the front of the map is the least
    // recently started window.
    for (const key of buckets.keys()) {
      if (buckets.size <= maxKeys) break;
      buckets.delete(key);
    }
  }

  return {
    take(key, now = Date.now()) {
      const bucket = buckets.get(key);
      if (bucket === undefined || bucket.resetAt <= now) {
        if (buckets.size >= maxKeys) sweep(now);
        buckets.delete(key);
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return ALLOWED;
      }
      if (bucket.count >= limit) {
        return {
          allowed: false,
          // Rounded up, and never zero: a `Retry-After: 0` invites the client
          // straight back into the same refusal.
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((bucket.resetAt - now) / 1000),
          ),
        };
      }
      bucket.count += 1;
      return ALLOWED;
    },
    reset() {
      buckets.clear();
    },
  };
}

export type InFlightGate = {
  /** Takes a slot, or answers `false` when they are all held. */
  enter(): boolean;
  /** Hands the slot back. Safe to call only once per successful `enter`. */
  leave(): void;
};

/**
 * At most `limit` of something at a time, process-wide.
 *
 * Refuses rather than queues, which is the difference that matters: the route
 * uses this to keep signed-out callers from occupying the parser's own slots,
 * and a queue there would recreate exactly the wait it exists to prevent.
 */
export function createInFlightGate(limit: number): InFlightGate {
  let held = 0;
  return {
    enter() {
      if (held >= limit) return false;
      held += 1;
      return true;
    },
    leave() {
      if (held > 0) held -= 1;
    },
  };
}

/**
 * Who is calling, as well as a Fetch `Request` can say.
 *
 * A `Request` carries no socket address, so this is whatever the ingress put in
 * front of the app wrote down — see the caveats at the top of this file. The
 * left-most `x-forwarded-for` entry is the original client where a proxy
 * appends honestly, and is trivially forged where nothing overwrites it; both
 * are true and the callers here are built for the second case.
 *
 * `null` when neither header is present, so the caller decides what an
 * unattributable request is worth rather than having every one of them silently
 * share a bucket by accident.
 */
export function clientAddress(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  return real ? real : null;
}
