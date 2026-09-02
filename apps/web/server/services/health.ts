import { ping } from "../repositories/health";

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
  const url = "https://api.kth.se/api/kopps/v2/courses?l=en";
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`KOPPS HTTP ${res.status}`);
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
