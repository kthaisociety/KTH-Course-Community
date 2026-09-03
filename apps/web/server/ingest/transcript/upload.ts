/** Raised while reading a request body that runs past the size cap. */
export class TranscriptTooLargeError extends Error {
  readonly code = "TRANSCRIPT_TOO_LARGE" as const;
  constructor() {
    super("Transcript upload exceeded the size limit");
    this.name = "TranscriptTooLargeError";
  }
}

/**
 * Re-wraps a request so that reading its body fails past `maxBytes`.
 *
 * `request.formData()` buffers the whole body before anything can look at the
 * file's size, and `Content-Length` is absent on a chunked upload and a lie
 * whenever the client wants it to be. Counting the bytes as they arrive is the
 * only cap that holds: the transform errors mid-stream, so an oversized upload
 * is abandoned rather than held in memory.
 */
export function capRequestBody(request: Request, maxBytes: number): Request {
  if (!request.body) return request;

  let seen = 0;
  const capped = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > maxBytes) {
          controller.error(new TranscriptTooLargeError());
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );

  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: capped,
    // Required whenever the body is a stream; missing from the DOM types.
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}
