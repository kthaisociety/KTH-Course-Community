import { getAuth } from "@/server/auth";
import { TranscriptParseError } from "@/server/ingest/transcript/parse";
import { extractTranscriptText } from "@/server/ingest/transcript/pdf-text";
import { buildTranscriptProposal } from "@/server/ingest/transcript/service";

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

  // Checked before `formData()` so an oversized upload is refused rather than
  // buffered into memory first. `file.size` below is the check that counts; a
  // client can send any Content-Length it likes.
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_BYTES) {
    return Response.json({ message: TOO_LARGE }, { status: 413 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json(
      { message: "No transcript provided" },
      { status: 400 },
    );
  }
  if (file.type !== "application/pdf") {
    return Response.json(
      { message: "Upload the transcript PDF that Ladok generates" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ message: TOO_LARGE }, { status: 413 });
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
