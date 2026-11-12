/**
 * Reads the data a public kth.se page embeds for its own client.
 *
 * Every programme and course page on kth.se renders from one JSON object it
 * ships as `window.__compressedApplicationStore__`, a URL-encoded string. That
 * object is what the page itself shows, so reading it is reading the page —
 * no private API, no login. KOPPS, which used to serve the same facts, is
 * closed (docs/adr/0004-course-round-identity.md).
 */

const USER_AGENT =
  "Mozilla/5.0 (compatible; KTH Course Community programme ingest; read-only)";

export const KTH_BASE = "https://www.kth.se/student/kurser";

export type Store = Record<string, unknown>;

export function decodeStore(html: string): Store | null {
  const match = html.match(/__compressedApplicationStore__\s*=\s*"([\s\S]*?)"/);
  if (!match) return null;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(match[1]));
    return value && typeof value === "object" ? (value as Store) : null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A page's HTML, or null on 404 or after three failed tries. */
export async function fetchHtml(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
    } catch {
      // network blip: retry below
    }
    await sleep(1500 + attempt * 2500);
  }
  return null;
}

/** A page's store, or null when the page has none or keeps failing. */
export async function fetchStore(url: string): Promise<Store | null> {
  const html = await fetchHtml(url);
  return html ? decodeStore(html) : null;
}

/** Runs `fn` over `items` with at most `limit` in flight, pausing between calls. */
export async function mapPolitely<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  pauseMs = 300,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
      await sleep(pauseMs);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}
