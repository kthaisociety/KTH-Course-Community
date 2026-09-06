import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractTranscriptText } from "@/server/ingest/transcript/pdf-text";
import { buildTranscriptProposal } from "@/server/ingest/transcript/service";
import { POST } from "./route";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/server/auth", () => ({ getAuth: () => ({ api: { getSession } }) }));
// The parser is the thing being protected, not the thing being tested: it runs
// a worker thread and a real PDF, and every assertion here is about who is
// allowed to reach it.
vi.mock("@/server/ingest/transcript/pdf-text", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/ingest/transcript/pdf-text")
  >("@/server/ingest/transcript/pdf-text");
  return { ...actual, extractTranscriptText: vi.fn() };
});
vi.mock("@/server/ingest/transcript/service", () => ({
  buildTranscriptProposal: vi.fn(),
}));

const URL_UNDER_TEST = "https://example.test/api/user/transcript";

function upload(caller: string): Request {
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array(16)], "resultatintyg.pdf", {
      type: "application/pdf",
    }),
  );
  return new Request(URL_UNDER_TEST, {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": caller },
  });
}

/** A fresh caller per test, so one test's allowance is never another's. */
let callerCount = 0;
function nextCaller(): string {
  callerCount += 1;
  return `198.51.100.${callerCount}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: "user-1" } });
  vi.mocked(extractTranscriptText).mockResolvedValue("transcript text");
  vi.mocked(buildTranscriptProposal).mockResolvedValue({
    candidates: [],
    unmatched: [],
  });
});

describe("a signed-in reader", () => {
  it("gets their transcript read", async () => {
    const response = await POST(upload(nextCaller()));

    expect(response.status).toBe(200);
    expect(extractTranscriptText).toHaveBeenCalledTimes(1);
  });

  /**
   * The guest limits must not touch an account. A signed-in reader re-reading a
   * transcript several times is ordinary — correcting a file, trying a fresh
   * export — and the ceiling that applies to them is the parser's own.
   */
  it("is not counted against the signed-out allowance", async () => {
    const caller = nextCaller();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      expect((await POST(upload(caller))).status).toBe(200);
    }
  });
});

describe("a signed-out visitor", () => {
  beforeEach(() => getSession.mockResolvedValue(null));

  /**
   * The change this route exists to make. The artboard has a guest read a
   * transcript and meet the account at the *keep* step
   * (`docs/design_ref/2026-09-06/Course Community - Taken Courses.dc.html:1305`),
   * which needs a parse that answers without a session — and which is safe only
   * because this route writes nothing.
   */
  it("gets their transcript read", async () => {
    const response = await POST(upload(nextCaller()));

    expect(response.status).toBe(200);
    expect(extractTranscriptText).toHaveBeenCalledTimes(1);
  });

  it("is refused once they have had their allowance", async () => {
    const caller = nextCaller();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await POST(upload(caller))).status).toBe(200);
    }

    const refused = await POST(upload(caller));
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  /**
   * Refused before the body is touched. `formData()` buffers the whole upload,
   * so a limiter that ran after it would still have spent four megabytes on
   * every request it was about to reject.
   */
  it("is refused without their upload being read", async () => {
    const caller = nextCaller();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await POST(upload(caller));
    }
    vi.mocked(extractTranscriptText).mockClear();

    const request = upload(caller);
    await POST(request);
    expect(request.bodyUsed).toBe(false);
    expect(extractTranscriptText).not.toHaveBeenCalled();
  });

  /**
   * The parser runs two extractions at once and queues eight more. Left alone,
   * a signed-out flood can hold all of that and a signed-in reader waits behind
   * strangers, so at most one signed-out parse is in flight at a time.
   */
  it("cannot occupy the parser while another guest is in it", async () => {
    let release: (text: string) => void = () => {};
    vi.mocked(extractTranscriptText).mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    const first = POST(upload(nextCaller()));
    // Waits for the first request to actually be inside the parser. A fixed
    // number of microtasks would not do: the route awaits the session, the
    // body and the file's bytes before it gets there, and how many ticks that
    // takes is not this test's to know.
    await vi.waitFor(() => expect(extractTranscriptText).toHaveBeenCalled());
    const second = await POST(upload(nextCaller()));

    expect(second.status).toBe(503);
    expect(second.headers.get("Retry-After")).toBe("5");

    release("transcript text");
    expect((await first).status).toBe(200);

    // And the slot comes back, or the signed-out path would be shut for the
    // life of the process.
    expect((await POST(upload(nextCaller()))).status).toBe(200);
  });

  it("hands the slot back when the parse throws", async () => {
    vi.mocked(extractTranscriptText).mockRejectedValueOnce(
      new Error("worker died"),
    );

    await expect(POST(upload(nextCaller()))).rejects.toThrow("worker died");
    expect((await POST(upload(nextCaller()))).status).toBe(200);
  });
});
