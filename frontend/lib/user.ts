import { nestHttpUrl } from "@/lib/nest-http";

// Fetches a list of user favorite courses (courseCodes).
export async function getUserFavorites(): Promise<string[]> {
  const res = await fetch(nestHttpUrl("/user/favorites"), {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as string[] | { favorites: string[] };
  return Array.isArray(data) ? data : data.favorites;
}

// Adds / removes a course to user favorite courses.
export async function toggleUserFavorite(
  courseCode: string,
): Promise<{ action: "added" | "removed" }> {
  const res = await fetch(nestHttpUrl("/user/toggle-favorite"), {
    cache: "no-store",
    credentials: "include",
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
