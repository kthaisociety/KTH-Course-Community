import { nestHttpUrl } from "@/lib/nest-http";

// Adds / removes a course to user favorite courses.
export async function toggleUserFavorite(
  courseCode: string,
): Promise<{ action: "added" | "removed" }> {
  const res = await fetch(nestHttpUrl("/user/toggle-favorite"), {
    cache: "no-store",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ courseCode }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as { action: "added" | "removed" };
  return data;
}

// TODO: Implement user liked courses and a toggle for that.

// TODO: Implement other user data fetches here.
