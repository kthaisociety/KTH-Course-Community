import { getAuth } from "@/server/auth";
import { capRequestBody, isRequestBodyTooLarge } from "@/server/http/body-cap";
import {
  clientAddress,
  createFixedWindowLimiter,
  createInFlightGate,
} from "@/server/http/rate-limit";
import { TranscriptParseError } from "@/server/ingest/transcript/parse";
import {
  extractTranscriptText,
  TranscriptBusyError,
} from "@/server/ingest/transcript/pdf-text";
import { buildTranscriptProposal } from "@/server/ingest/transcript/service";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;
const TOO_LARGE = "Transcript must be less than 4MB";
const BUSY =
  "Too many transcripts are being read right now. Try again in a moment.";

/**
 * How much parsing a signed-out visitor may ask for.
 *
 * A student reads their transcript once, looks at what came out, and confirms
 * it. Five reads in a quarter of an hour covers a retry, a second file and a
 * mistake; nobody legitimate reaches it. The all-callers window is a second
 * ceiling for the case the per-caller one cannot see — the same flood spread
 * across forged `x-forwarded-for` values — and it is deliberately generous
 * enough that a lecture hall of students would not trip it.
 *
 * Both are per-process and evadable; `server/http/rate-limit.ts` says exactly
 * how, and says what holds when they are evaded.
 */
const GUEST_WINDOW_MS = 15 * 60 * 1000;
const guestReads = createFixedWindowLimiter({
  limit: 5,
  windowMs: GUEST_WINDOW_MS,
});
const allGuestReads = createFixedWindowLimiter({
  limit: 120,
  windowMs: GUEST_WINDOW_MS,
});

/**
 * One signed-out parse at a time, process-wide.
 *
 * `pdf-text.ts` runs two extractions at once and queues eight. Left alone, a
 * signed-out flood can hold both slots and every queue place, and a signed-in
 * reader confirming their own transcript waits behind strangers or is told the
 * server is busy. This keeps at least one slot reachable by an account at all
 * times, at the cost of a rare second guest being asked to try again — a real
 * parse takes about a tenth of a second, so two colliding is already unlikely
 * and the answer they get is the "come back" the route already had words for.
 */
const guestParses = createInFlightGate(1);

/** The bucket an unattributable request shares. It is one caller's worth. */
const UNATTRIBUTED = "unattributed";

/**
 * Turns an uploaded Ladok transcript into a proposal of taken courses.
 *
 * Multipart does not go through tRPC in this repo, so the file arrives here —
 * and because a transcript may not be stored, the same request that receives
 * the file also parses it and returns the proposal. Confirming the proposal is
 * `transcript.confirm` over tRPC; this route writes nothing.
 *
 * Neither the file nor its text is persisted or logged.
 *
 * **A signed-out visitor may parse, and may not write.** The artboard has a
 * guest drop a transcript in, read what came out, and meet the account at the
 * *keep* step — "Sign in to keep this list"
 * (`docs/design_ref/2026-09-06/Course Community - Taken Courses.dc.html`)
 * — and that flow is implementable only because parsing and writing are two
 * calls. This one is open; `transcript.confirm` stays a `protectedProcedure`
 * and is the only thing in the flow that touches a row. Nothing a signed-out
 * caller does here reaches the database, and nothing it returns is stored
 * anywhere on the server.
 *
 * What being open costs is CPU, so the signed-out path is bounded twice over
 * before it is allowed to spend any: a rate limit per caller and across all
 * callers, and a gate that keeps guests from occupying the parser's slots. The
 * limits are checked before the body is read, so a refused caller never gets
 * four megabytes buffered on their behalf.
 */
export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  const isGuest = !session?.user;

  if (isGuest) {
    const caller = clientAddress(request) ?? UNATTRIBUTED;
    const verdict = guestReads.take(caller);
    const shared = verdict.allowed ? allGuestReads.take("all") : verdict;
    if (!shared.allowed) {
      return Response.json(
        {
          message:
            "That is a lot of transcripts. Sign in to keep reading them, or try again later.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(shared.retryAfterSeconds) },
        },
      );
    }
  }

  // Counted as the body arrives: `formData()` would otherwise buffer the whole
  // upload before anything could look at the file's size, and Content-Length is
  // absent on a chunked upload and a lie whenever the client wants it to be.
  let formData: FormData;
  try {
    formData = await capRequestBody(request, MAX_BYTES).formData();
  } catch (error) {
    if (isRequestBodyTooLarge(error)) {
      return Response.json({ message: TOO_LARGE }, { status: 413 });
    }
    return Response.json(
      { message: "Upload the transcript PDF that Ladok generates" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json(
      { message: "No transcript provided" },
      { status: 400 },
    );
  }
  // Advisory only — the browser sets this and a client may lie. The real check
  // is `extractTranscriptText` below, which fails on anything that is not a PDF.
  if (file.type !== "application/pdf") {
    return Response.json(
      { message: "Upload the transcript PDF that Ladok generates" },
      { status: 400 },
    );
  }

  // Taken around the parse only, and released in every case — a leaked slot
  // would shut the signed-out path for the life of the process.
  if (isGuest && !guestParses.enter()) {
    return Response.json(
      { message: BUSY },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }
  try {
    const text = await extractTranscriptText(
      new Uint8Array(await file.arrayBuffer()),
    );
    return Response.json(await buildTranscriptProposal(text));
  } catch (error) {
    if (error instanceof TranscriptParseError) {
      return Response.json({ message: error.message }, { status: 422 });
    }
    // Parsing is capacity-bound, so a burst is a "come back", not a bad file.
    // Saying so keeps the user from re-editing a transcript that was fine.
    if (error instanceof TranscriptBusyError) {
      return Response.json(
        { message: BUSY },
        { status: 503, headers: { "Retry-After": "10" } },
      );
    }
    throw error;
  } finally {
    if (isGuest) guestParses.leave();
  }
}
