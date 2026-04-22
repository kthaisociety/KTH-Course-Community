import type { Review } from "@shared/types";
import type { ReviewFormData } from "@/components/review";

export async function createReview(
  courseCode: string,
  userId: string,
  reviewForm: ReviewFormData,
): Promise<void> {
  const backend = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  if (!backend) throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");

  const res = await fetch(`${backend}/reviews`, {
    cache: "no-store",
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ courseCode, userId, ...reviewForm }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function findAllReviews(
  courseCode: string,
  userId?: string,
): Promise<Review[] | null> {
  const backend = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  if (!backend) throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");

  const url = new URL(`${backend}/reviews`);
  url.searchParams.set("courseCode", courseCode);
  if (userId) {
    url.searchParams.set("userId", userId);
  }

  const res = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "include",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function likeReview(
  reviewId: string,
  userId: string,
): Promise<void> {
  const backend = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  if (!backend) throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");

  const res = await fetch(`${backend}/reviews/${reviewId}/like`, {
    cache: "no-store",
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
