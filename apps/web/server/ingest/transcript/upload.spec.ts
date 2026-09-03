import { describe, expect, it } from "vitest";
import { capRequestBody, TranscriptTooLargeError } from "./upload";

function streamingRequest(chunks: number[]): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });
  return new Request("https://example.test/api/user/transcript", {
    method: "POST",
    body,
    // @ts-expect-error `duplex` is required for a stream body and is missing
    // from the DOM RequestInit types Next ships.
    duplex: "half",
  });
}

describe("capRequestBody", () => {
  it("passes a body that stays under the cap through unchanged", async () => {
    const capped = capRequestBody(streamingRequest([100, 100]), 1000);

    expect((await capped.arrayBuffer()).byteLength).toBe(200);
  });

  it("rejects once the body passes the cap, rather than buffering it", async () => {
    const capped = capRequestBody(streamingRequest([600, 600, 600]), 1000);

    await expect(capped.arrayBuffer()).rejects.toBeInstanceOf(
      TranscriptTooLargeError,
    );
  });

  it("does not trust a Content-Length that undercounts the body", async () => {
    const request = new Request("https://example.test/api/user/transcript", {
      method: "POST",
      body: new Uint8Array(5000),
      headers: { "content-length": "10" },
    });

    await expect(capRequestBody(request, 1000).arrayBuffer()).rejects.toThrow();
  });
});
