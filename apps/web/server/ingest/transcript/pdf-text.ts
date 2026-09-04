import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { TranscriptParseError } from "./parse";

/**
 * Wall-clock ceiling on one extraction, in milliseconds.
 *
 * Measured, not guessed. On the development machine a cold worker — thread
 * start, pdf.js load and parse — costs 82-126ms for the two real Ladok
 * transcripts, and ~1150ms for a synthetic 1000-page, 3.5MB document, which is
 * about the largest text PDF that fits under the route's 4MB cap. The budget
 * sits above that worst legitimate case with room for slower hardware: ~4x the
 * heaviest admissible document and ~40x a real transcript.
 */
const DEFAULT_BUDGET_MS = 5_000;

/**
 * How many transcripts may be parsed at once, and how many may wait.
 *
 * A worker bounds the CPU one upload can spend; it does nothing about how many
 * uploads spend it at the same time. Left ungated, each concurrent request
 * starts its own parser thread, so a signed-in user can hold a core per
 * request for a whole budget each — the request thread is no longer the thing
 * that serialises them. Two at a time keeps the heaviest admissible document
 * (~1150ms) well inside the budget while leaving the box able to serve
 * everything else; the queue absorbs an ordinary burst without turning it into
 * an error.
 */
const MAX_CONCURRENT_EXTRACTIONS = 2;
const MAX_QUEUED_EXTRACTIONS = 8;

/** Raised when too many transcripts are already being parsed. */
export class TranscriptBusyError extends Error {
  readonly code = "TRANSCRIPT_BUSY" as const;
  constructor() {
    super("Transcript parsing is at capacity");
    this.name = "TranscriptBusyError";
  }
}

let running = 0;
const queued: Array<() => void> = [];

/**
 * Takes a parsing slot, waiting for one if the queue has room.
 *
 * Rejecting past the queue is deliberate: making a caller wait an unbounded
 * time is the same denial of service by a slower route, and the client would
 * rather be told to come back than hold a connection open.
 */
async function acquireSlot(): Promise<void> {
  if (running < MAX_CONCURRENT_EXTRACTIONS) {
    running++;
    return;
  }
  if (queued.length >= MAX_QUEUED_EXTRACTIONS) throw new TranscriptBusyError();
  await new Promise<void>((resume) => queued.push(resume));
  running++;
}

/** Hands the slot to whoever is next in line. */
function releaseSlot(): void {
  running--;
  queued.shift()?.();
}

/**
 * Runs inside the worker. Kept to one job so there is little to go wrong in a
 * context that cannot be debugged from a request.
 *
 * It posts back the text or a bare failure flag. The library's own error never
 * crosses the thread boundary: a PDF parser's message can quote bytes from the
 * document, and nothing from inside a transcript may reach a log or a response.
 */
const WORKER_SOURCE = `
import { workerData, parentPort } from "node:worker_threads";

try {
  const { extractText } = await import(workerData.unpdfUrl);
  const { text } = await extractText(workerData.bytes, { mergePages: true });
  parentPort.postMessage({ ok: true, text });
} catch {
  parentPort.postMessage({ ok: false });
}
`;

let cachedUnpdfUrl: string | undefined;

/**
 * Where the worker should import `unpdf` from.
 *
 * Resolved in the parent and handed over as a file URL, because an `eval`
 * worker resolves a bare specifier against the working directory rather than
 * against this module. `import.meta.url` is not usable as the resolution base:
 * Turbopack rewrites it to a numeric module id at build time, so anchoring on
 * it fails while Next collects page data. The application root is the base that
 * survives dev, Vitest and the standalone build alike — `unpdf` is a
 * `serverExternalPackage`, so it is a real directory under `node_modules` in
 * all three, and Node walks up from here to find it.
 *
 * Resolved on first use rather than at module scope: this module is evaluated
 * during `next build`, where throwing would fail the build rather than one
 * upload.
 */
function resolveUnpdfUrl(): string {
  if (!cachedUnpdfUrl) {
    // `createRequire` wants a file to resolve *from*, not a real file: only
    // the directory part is used, so `noop.js` never has to exist.
    const from = createRequire(join(process.cwd(), "noop.js"));
    cachedUnpdfUrl = pathToFileURL(from.resolve("unpdf")).href;
  }
  return cachedUnpdfUrl;
}

/** What the worker is allowed to send back. */
type WorkerReply = { ok: true; text: string } | { ok: false };

function unreadable(): TranscriptParseError {
  return new TranscriptParseError(
    "This file could not be read. Upload the PDF that Ladok generates, " +
      "not a scan or a screenshot of it.",
  );
}

/**
 * Pulls the text layer out of a transcript PDF.
 *
 * This is the only impure part of transcript import: everything downstream is a
 * pure function over the string it returns. The bytes stay in memory for the
 * length of one request — a transcript is a student's academic record and is
 * never written to disk, to blob storage, or to a log.
 *
 * The parse runs on a worker thread under a wall-clock budget. The size cap on
 * the route bounds how many bytes arrive, not how long they take to parse: a
 * small, deliberately pathological document can hold a parser far longer than
 * any real transcript, and on Node that is time the whole process spends not
 * serving anyone else. `terminate()` is what makes the budget real — it stops a
 * thread that is spinning in native code, which a cancelled promise cannot do.
 *
 * A document that runs past the budget fails exactly as an unreadable one does.
 * Distinguishing the two would only tell an attacker where the ceiling sits,
 * and the caller does the same thing either way: reject the upload, store
 * nothing.
 */
export async function extractTranscriptText(
  bytes: Uint8Array,
  { budgetMs = DEFAULT_BUDGET_MS }: { budgetMs?: number } = {},
): Promise<string> {
  // Before the thread exists: the point is to not create it under load.
  await acquireSlot();

  const worker = new Worker(WORKER_SOURCE, {
    eval: true,
    workerData: { unpdfUrl: resolveUnpdfUrl(), bytes },
  });

  try {
    return await new Promise<string>((resolve, reject) => {
      // Whichever outcome lands first wins, and the timer is cleared in every
      // case: an early result would otherwise hold the event loop open until
      // the whole budget had elapsed.
      let settled = false;
      let budget: ReturnType<typeof setTimeout>;
      const settle = (outcome: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(budget);
        outcome();
      };

      const fail = () => settle(() => reject(unreadable()));

      budget = setTimeout(fail, budgetMs);

      worker.on("message", (reply: WorkerReply) => {
        settle(() => (reply.ok ? resolve(reply.text) : reject(unreadable())));
      });
      // A worker that dies outright — an OOM kill, a failure to boot — is
      // reported the same way as a file the parser rejected. `exit` also fires
      // on the way out of a successful parse, after `terminate()` below; that
      // is a no-op because the promise has already settled, and it stays one
      // because Node delivers a worker's `message` before its `exit`.
      worker.on("error", fail);
      worker.on("exit", fail);
    });
  } finally {
    // Unconditional: on the timeout path this is what actually reclaims the
    // CPU, and on every other path the thread is done and must not be leaked.
    // The slot is handed on only once the thread is genuinely gone, or the cap
    // would let the next parse start alongside one still winding down.
    await worker.terminate();
    releaseSlot();
  }
}
