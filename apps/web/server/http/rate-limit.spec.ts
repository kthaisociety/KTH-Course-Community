import { describe, expect, it } from "vitest";
import {
  clientAddress,
  createFixedWindowLimiter,
  createInFlightGate,
} from "./rate-limit";

const START = 1_000_000;

describe("a fixed-window limiter", () => {
  it("allows a caller up to the limit and refuses the next", () => {
    const limiter = createFixedWindowLimiter({ limit: 2, windowMs: 1000 });

    expect(limiter.take("a", START).allowed).toBe(true);
    expect(limiter.take("a", START).allowed).toBe(true);
    expect(limiter.take("a", START).allowed).toBe(false);
  });

  it("counts each caller separately", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 1000 });
    limiter.take("a", START);

    expect(limiter.take("b", START).allowed).toBe(true);
  });

  it("says how long the refusal lasts, and never says zero", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 5000 });
    limiter.take("a", START);

    const early = limiter.take("a", START + 1500);
    expect(early).toEqual({ allowed: false, retryAfterSeconds: 4 });
    // A `Retry-After: 0` would invite the client straight back into the same
    // refusal, so the last fraction of a window still rounds up to a second.
    const late = limiter.take("a", START + 4999);
    expect(late).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it("starts the caller over once their window has passed", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 1000 });
    limiter.take("a", START);

    expect(limiter.take("a", START + 1000).allowed).toBe(true);
  });

  /**
   * An unbounded key space is the denial of service the limiter exists to
   * prevent: one request per forged header would grow the map until the process
   * died. Both halves are checked — the sweep that frees expired windows, and
   * the eviction that has to fire when a flood keeps every one of them live.
   */
  it("does not grow without bound when every key is fresh", () => {
    const limiter = createFixedWindowLimiter({
      limit: 1,
      windowMs: 60_000,
      maxKeys: 4,
    });
    for (let index = 0; index < 50; index += 1) {
      limiter.take(`caller-${index}`, START);
    }

    // Nothing here can read the map, so the observable consequence is what is
    // asserted: an early caller's window was dropped, so their allowance is
    // back. That is the intended way to fail — the parser's own concurrency
    // cap is still underneath it.
    expect(limiter.take("caller-0", START).allowed).toBe(true);
  });

  it("frees expired windows before it evicts live ones", () => {
    const limiter = createFixedWindowLimiter({
      limit: 1,
      windowMs: 1000,
      maxKeys: 2,
    });
    limiter.take("old", START);
    limiter.take("also-old", START);
    // Long after both windows closed: the sweep clears them, so the caller
    // arriving now is not competing for a slot with anybody.
    limiter.take("new", START + 10_000);

    expect(limiter.take("new", START + 10_000).allowed).toBe(false);
  });
});

describe("an in-flight gate", () => {
  it("hands out at most the slots it has, and takes them back", () => {
    const gate = createInFlightGate(1);

    expect(gate.enter()).toBe(true);
    expect(gate.enter()).toBe(false);
    gate.leave();
    expect(gate.enter()).toBe(true);
  });

  it("cannot be pushed below zero by a stray release", () => {
    const gate = createInFlightGate(1);
    gate.leave();
    gate.leave();

    expect(gate.enter()).toBe(true);
    expect(gate.enter()).toBe(false);
  });
});

describe("naming the caller", () => {
  function requestWith(headers: Record<string, string>): Request {
    return new Request("https://example.test/", { headers });
  }

  it("takes the left-most forwarded address", () => {
    expect(
      clientAddress(
        requestWith({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
      ),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(clientAddress(requestWith({ "x-real-ip": "203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
  });

  it("says nothing rather than inventing a caller", () => {
    expect(clientAddress(requestWith({}))).toBeNull();
    expect(clientAddress(requestWith({ "x-forwarded-for": "  " }))).toBeNull();
  });
});
