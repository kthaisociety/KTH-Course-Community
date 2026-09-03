import { getAuth } from "@/server/auth";
import { TranscriptParseError } from "@/server/ingest/transcript/parse";
import { extractTranscriptText } from "@/server/ingest/transcript/pdf-text";
import { buildTranscriptProposal } from "@/server/ingest/transcript/service";
import {
  capRequestBody,
  TranscriptTooLargeError,
} from "@/server/ingest/transcript/upload";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;
const TOO_LARGE = "Transcript must be less than 4MB";

/**
 * Turns an uploaded Ladok transcript into a proposal of taken courses.
 *
 * Multipart does not go through tRPC in this repo, so the file arrives here —
 * and because a transcript may not be stored, the same request that receives
 * the file also parses it and returns the proposal. Confirming the proposal is
 * `transcript.confirm` over tRPC; this route writes nothing.
 *
 * Neither the file nor its text is persisted or logged.
 */
export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Counted as the body arrives: `formData()` would otherwise buffer the whole
  // upload before anything could look at the file's size, and Content-Length is
  // absent on a chunked upload and a lie whenever the client wants it to be.
  let formData: FormData;
  try {
    formData = await capRequestBody(request, MAX_BYTES).formData();
  } catch (error) {
    if (error instanceof TranscriptTooLargeError) {
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

  try {
    const text = await extractTranscriptText(
      new Uint8Array(await file.arrayBuffer()),
    );
    return Response.json(await buildTranscriptProposal(text));
  } catch (error) {
    if (error instanceof TranscriptParseError) {
      return Response.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
