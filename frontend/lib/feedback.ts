// frontend/lib/feedback.ts
export async function sendFeedback(data: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  const backend = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  if (!backend) throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");

  const res = await fetch(`${backend}/feedback`, {
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
