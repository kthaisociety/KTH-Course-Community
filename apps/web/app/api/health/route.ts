import { testAll } from "@/server/services/health";

export const runtime = "nodejs";

export async function GET() {
  const status = await testAll();
  return Response.json(status, { status: status.ok ? 200 : 503 });
}
