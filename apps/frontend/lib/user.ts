"use client";

import { nestHttpUrl } from "@/lib/nest-http";

export type Me = {
  userId: string;
  name: string;
  email: string;
  userFavorites: string[];
  image: string | null;
};

export async function getMe(): Promise<Me | null> {
  const res = await fetch(nestHttpUrl("/user/me"));
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch user: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data?.userId || !data?.email) {
    throw new Error("Invalid user response from /user/me");
  }

  return {
    userId: data.userId,
    name: data.name ?? "",
    email: data.email,
    userFavorites: data.userFavorites ?? [],
    image: data.image ?? null,
  };
}

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

export async function uploadProfilePicture(
  file: File,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(nestHttpUrl("/user/profile-picture"), {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      try {
        const error = await res.json();
        errorMsg = error?.message || error?.error || errorMsg;
      } catch {
        errorMsg = await res.text();
      }
      throw new Error(errorMsg);
    }

    const data = await res.json();
    return { success: true, url: data.url };
  } catch (err) {
    if (err instanceof Error) {
      if (/file.*type/i.test(err.message)) {
        return { success: false, error: "Please select an image file." };
      }
      if (/file.*size/i.test(err.message)) {
        return { success: false, error: "Image must be less than 2MB." };
      }
      if (/no file/i.test(err.message)) {
        return { success: false, error: "No file provided." };
      }
      return { success: false, error: err.message };
    }
    return { success: false, error: "Unknown upload error" };
  }
}

export async function deleteAccount(): Promise<void> {
  const res = await fetch(nestHttpUrl("/user"), {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
