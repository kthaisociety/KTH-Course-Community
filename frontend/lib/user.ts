
const backend = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;

// Fetches a list of user favorite courses (courseCodes). 
export async function getUserFavorites(): Promise<string[]> {
  if (!backend) throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");

  const res = await fetch(`${backend}/user/favorites`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as { favorites: string[] };
  return data.favorites;
}


// Adds / removes a course to user favorite courses. 
export async function toggleUserFavorite(
  courseCode: string,
): Promise<{ action: "added" | "removed" }> {
  if (!backend) throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");

  const res = await fetch(`${backend}/user/toggle-favorite`, {
    cache: "no-store",
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ courseCode }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  return data;
}

// TODO: Implement user liked courses and a toggle for that. 

// TODO: Implement other user data fetches here. 