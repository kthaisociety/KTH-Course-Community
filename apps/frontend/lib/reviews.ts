import type { Review } from "@shared/types";
import type { ReviewFormData } from "@/components/review";
import { nestHttpUrl } from "@/lib/nest-http";

export async function createReview(
  courseCode: string,
  _userId: string,
  reviewForm: ReviewFormData,
): Promise<void> {
  const res = await fetch(nestHttpUrl("/reviews"), {
    cache: "no-store",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ courseCode, ...reviewForm }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function findAllReviews(
  courseCode: string,
): Promise<Review[] | null> {
  const params = new URLSearchParams();
  params.set("courseCode", courseCode);

  const res = await fetch(`${nestHttpUrl("/reviews")}?${params.toString()}`, {
    cache: "no-store",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function likeReview(reviewId: string): Promise<void> {
  const res = await fetch(nestHttpUrl(`/reviews/${reviewId}/like`), {
    cache: "no-store",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
