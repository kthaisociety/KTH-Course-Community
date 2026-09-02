import { getDb } from "@/server/db";
import { testAll } from "@/server/health";

export const runtime = "nodejs";

export async function GET() {
  const status = await testAll(getDb());
  return Response.json(status, { status: status.ok ? 200 : 503 });
}
