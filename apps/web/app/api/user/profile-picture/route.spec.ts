import { put } from "@vercel/blob";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateImage } from "@/server/user/service";
import { POST } from "./route";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/server/auth", () => ({ getAuth: () => ({ api: { getSession } }) }));
vi.mock("@vercel/blob", () => ({
  put: vi.fn(async () => ({ url: "https://blob.test/avatar.png" })),
}));
vi.mock("@/server/user/service", () => ({ updateImage: vi.fn() }));

const URL_UNDER_TEST = "https://example.test/api/user/profile-picture";
const BOUNDARY = "----kthcccontentboundary";
const MEGABYTE = 1024 * 1024;
const encoder = new TextEncoder();

function partHeader(filename: string, type: string): Uint8Array {
  return encoder.encode(
    `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${type}\r\n\r\n`,
  );
}

const PART_FOOTER = encoder.encode(`\r\n--${BOUNDARY}--\r\n`);

/**
 * A multipart upload that arrives in chunks and counts what the server pulled.
 *
 * The count is the point. A route that buffers first and measures second drains
 * this source to the end before it can answer; a route that counts the bytes as
 * they arrive abandons it partway. Only the source can tell those two apart —
 * the status code is the same either way.
 */
function chunkedUpload(chunkCount: number, chunkBytes: number) {
  let produced = 0;
  let index = -1;

  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      index += 1;
      const chunk =
        index === 0
          ? partHeader("avatar.png", "image/png")
          : index <= chunkCount
            ? new Uint8Array(chunkBytes)
            : PART_FOOTER;
      produced += chunk.byteLength;
      controller.enqueue(chunk);
      if (index > chunkCount) controller.close();
    },
  });

  const request = new Request(URL_UNDER_TEST, {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
    body,
    // @ts-expect-error `duplex` is required for a stream body and is missing
    // from the DOM RequestInit types Next ships.
    duplex: "half",
  });

  return { request, produced: () => produced, total: chunkCount * chunkBytes };
}

/** A whole picture in memory, the way a browser actually posts one. */
function pictureUpload(bytes: number, type = "image/png"): Request {
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array(bytes)], "avatar.png", { type }),
  );
  return new Request(URL_UNDER_TEST, { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: "user-1" } });
});

describe("POST /api/user/profile-picture", () => {
  it("abandons an oversized upload instead of buffering it", async () => {
    // Twenty megabytes offered against a two megabyte limit. Before the cap,
    // `request.formData()` read all of it into memory and only then compared
    // `file.size`, so any signed-in caller could spend the server's memory at
    // will.
    const upload = chunkedUpload(40, 512 * 1024);

    const response = await POST(upload.request);

    expect(response.status).toBe(413);
    expect(upload.total).toBe(20 * MEGABYTE);
    // The cap is 2MB plus a small multipart allowance; a couple of chunks may
    // already be in flight when it trips. What must not happen is the whole
    // body being read.
    expect(upload.produced()).toBeLessThan(4 * MEGABYTE);
    expect(put).not.toHaveBeenCalled();
    expect(updateImage).not.toHaveBeenCalled();
  });

  it("never reads the body of an unauthenticated upload", async () => {
    getSession.mockResolvedValue(null);
    const upload = chunkedUpload(40, 512 * 1024);

    const response = await POST(upload.request);

    expect(response.status).toBe(401);
    // The runtime primes the stream with its first chunk when the request is
    // constructed, so "untouched" is the part headers and nothing after them.
    expect(upload.produced()).toBeLessThan(512 * 1024);
  });

  it("stores a picture that is inside the limit", async () => {
    const response = await POST(pictureUpload(64 * 1024));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://blob.test/avatar.png",
    });
    expect(updateImage).toHaveBeenCalledWith(
      "user-1",
      "https://blob.test/avatar.png",
    );
  });

  it("still rejects a picture over 2MB that fits inside the body allowance", async () => {
    // The stream cap bounds the envelope, so a file a little over the limit
    // gets through it and is caught by the exact check on `file.size`.
    const response = await POST(pictureUpload(2 * MEGABYTE + 8 * 1024));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: "Image must be less than 2MB",
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects a file whose type is not an allowed image", async () => {
    const response = await POST(pictureUpload(1024, "application/pdf"));

    expect(response.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });
});
