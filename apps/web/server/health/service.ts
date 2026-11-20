import { ping } from "./repository";

type HealthCheckResult = {
  ok: boolean;
  [key: string]: unknown;
};

async function checkDb() {
  const start = Date.now();
  await ping();
  return { ok: true, ms: Date.now() - start };
}

async function checkKthApi() {
  const start = Date.now();
  // The course search ingest reads (server/ingest/kth-web.ts, ADR 0012).
  const url =
    "https://www.kth.se/student/kurser/intern-api/sok/sv?department=SF";
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`KTH course search HTTP ${res.status}`);
  }
  return { ok: true, ms: Date.now() - start };
}

function serializeError(reason: unknown): HealthCheckResult {
  if (reason instanceof Error) {
    return {
      ok: false,
      error: reason.message,
      name: reason.name,
    };
  }
  return { ok: false, error: String(reason) };
}

function format(
  res: PromiseSettledResult<HealthCheckResult>,
): HealthCheckResult {
  return res.status === "fulfilled" ? res.value : serializeError(res.reason);
}

export async function testAll() {
  const results = await Promise.allSettled([checkDb(), checkKthApi()]);
  const [dbRes, kthRes] = results;
  const database = format(dbRes);
  const kth = format(kthRes);
  const ok = Boolean(database.ok && kth.ok);
  return { ok, services: { db: database, kth } };
}
