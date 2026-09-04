"use client";

import type { TranscriptProposal } from "@/server/ingest/transcript/service";

/**
 * The largest file `POST /api/user/transcript` accepts, mirroring the route's
 * own `MAX_BYTES`. Checked here so an oversized file is refused before it is
 * uploaded, not after four megabytes have gone over the wire.
 */
export const MAX_TRANSCRIPT_BYTES = 4 * 1024 * 1024;

/** What the drop zone tells the reader the limit is. Kept beside the bound. */
export const MAX_TRANSCRIPT_LABEL = "4 MB";

const GENERIC_FAILURE =
  "We could not read that transcript. Try downloading a fresh Resultatintyg from Ladok.";

async function failureMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? (body as { message: unknown }).message
        : null;
    return typeof message === "string" && message.trim() !== ""
      ? message
      : GENERIC_FAILURE;
  } catch {
    return GENERIC_FAILURE;
  }
}

/**
 * Uploads one transcript and returns what the parser made of it.
 *
 * The file is handed straight to `fetch` and is never kept: it is a student's
 * academic record, so nothing here stores it, logs it or puts it in state, and
 * the route it posts to writes nothing either. What comes back is a
 * **proposal** — candidate rows plus the course codes the catalogue does not
 * have — and it stays a proposal until `transcript.confirm` is called.
 *
 * Multipart does not go through tRPC in this repo, which is why this is a
 * `fetch` rather than a procedure — and a plain function rather than the
 * `useMutation` wrapper the other `api/` files expose. A mutation keeps its
 * last `variables` for as long as the hook is mounted, and the variable here is
 * the student's transcript; awaiting a function leaves the file unreferenced as
 * soon as the request is built.
 */
export async function uploadTranscript(
  file: File,
): Promise<TranscriptProposal> {
  if (file.size > MAX_TRANSCRIPT_BYTES) {
    throw new Error(`Transcript must be less than ${MAX_TRANSCRIPT_LABEL}`);
  }

  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/user/transcript", {
    method: "POST",
    body,
  });
  if (!response.ok) throw new Error(await failureMessage(response));
  return (await response.json()) as TranscriptProposal;
}
