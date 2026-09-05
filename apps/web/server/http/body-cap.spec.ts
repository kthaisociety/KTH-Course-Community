import { describe, expect, it } from "vitest";
import {
  capRequestBody,
  isRequestBodyTooLarge,
  RequestBodyTooLargeError,
} from "./body-cap";

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
      RequestBodyTooLargeError,
    );
  });

  it("recognises the cap failure through a wrapping error", () => {
    const wrapped = new TypeError("terminated", {
      cause: new RequestBodyTooLargeError(),
    });

    expect(isRequestBodyTooLarge(new RequestBodyTooLargeError())).toBe(true);
    expect(isRequestBodyTooLarge(wrapped)).toBe(true);
    expect(isRequestBodyTooLarge(new Error("something else"))).toBe(false);
  });

  it("does not trust a Content-Length that undercounts the body", async () => {
    const request = new Request("https://example.test/api/user/transcript", {
      method: "POST",
      body: new Uint8Array(5000),
      headers: { "content-length": "10" },
    });

    await expect(capRequestBody(request, 1000).arrayBuffer()).rejects.toThrow();
  });

  it("stops pulling from the source once the cap is passed", async () => {
    // The point of the cap is not the error, it is that the bytes after it are
    // never asked for. A source that counts what it was pulled shows that: a
    // 10-chunk body capped at two chunks must not be drained to the end.
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 10) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(600));
      },
    });
    const request = new Request("https://example.test/api/user/transcript", {
      method: "POST",
      body,
      // @ts-expect-error `duplex` is required for a stream body.
      duplex: "half",
    });

    await expect(
      capRequestBody(request, 1000).arrayBuffer(),
    ).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    // Queueing means a chunk or two may be in flight when the cap trips; what
    // matters is that the whole 6000-byte body was never read.
    expect(pulled).toBeLessThan(10);
  });
});
