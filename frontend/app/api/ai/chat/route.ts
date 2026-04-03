import { type NextRequest, NextResponse } from "next/server";

/**
 * Proxy route: forwards the AI SDK chat request to the NestJS backend.
 *
 * The frontend `useChat` hook sends:
 *   POST /api/ai/chat  { messages: UIMessage[] }
 *
 * This handler forwards the body verbatim to:
 *   POST <NEXT_PUBLIC_BACKEND_DOMAIN>/ai/chat
 *
 * and streams the response back to the client, preserving the AI SDK's
 * UI message stream format so `useChat` can parse it correctly.
 *
 * NOTE: Add authentication middleware here when you want to guard this route.
 */
export async function POST(request: NextRequest) {
  const backendDomain = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  if (!backendDomain) {
    return new NextResponse("NEXT_PUBLIC_BACKEND_DOMAIN is not set", {
      status: 500,
    });
  }

  const body = await request.text();

  const backendResponse = await fetch(`${backendDomain}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!backendResponse.ok) {
    return new NextResponse(await backendResponse.text(), {
      status: backendResponse.status,
    });
  }

  // Stream the AI SDK UI message stream directly back to the browser.
  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: {
      "Content-Type":
        backendResponse.headers.get("Content-Type") ?? "text/plain",
      "Transfer-Encoding": "chunked",
      "x-vercel-ai-data-stream": "v1",
    },
  });
}
