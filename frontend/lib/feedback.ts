// frontend/lib/feedback.ts
import { nestHttpUrl } from "@/lib/nest-http";

export async function sendFeedback(data: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  const res = await fetch(nestHttpUrl("/feedback"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
}
