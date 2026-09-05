/**
 * Size caps for request bodies that arrive as a stream.
 *
 * This lived in `server/ingest/transcript/upload.ts` and filed under transcript
 * machinery, which is why the profile-picture route never found it and buffered
 * whatever a signed-in caller sent. Nothing here knows what the body contains,
 * so it belongs to no domain: `server/http/` is the neutral shelf every route
 * handler can reach without importing another domain's internals.
 *
 * Every multipart route in `app/api/` must cap its body here before touching
 * `formData()`. There is no second way to do it.
 */

/** Raised while reading a request body that runs past the size cap. */
export class RequestBodyTooLargeError extends Error {
  readonly code = "REQUEST_BODY_TOO_LARGE" as const;
  constructor() {
    super("Request body exceeded the size limit");
    this.name = "RequestBodyTooLargeError";
  }
}

/**
 * Whether reading a capped body failed because it ran past the cap.
 *
 * The body readers wrap a mid-stream error in one of their own on some
 * runtimes, so the cause is worth checking as well as the error itself.
 */
export function isRequestBodyTooLarge(error: unknown): boolean {
  return (
    error instanceof RequestBodyTooLargeError ||
    (error instanceof Error && error.cause instanceof RequestBodyTooLargeError)
  );
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
          controller.error(new RequestBodyTooLargeError());
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
