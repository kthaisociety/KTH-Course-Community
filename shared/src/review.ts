/** Review as exposed over the API (timestamps serialized as ISO strings). */
export interface Review {
  id: string;
  userId: string;
  courseCode: string;
  examinationMethods: number;
  theoreticalVsApplied: number;
  workload: number;
  learningExperience: number;
  wouldRecommend: boolean;
  content: string;
  likeCount?: number;
  dislikeCount?: number;
  createdAt: string;
  updatedAt: string;
  userVote?: "like" | "dislike" | null;
}

/** Review like/dislike as exposed over the API (timestamp serialized as ISO string). */
export interface ReviewLike {
  userId: string;
  reviewId: string;
  voteType: "like" | "dislike";
  createdAt: string;
}

/** User vote record with the full linked review payload. */
export interface UserLikedReview extends ReviewLike {
  review: Review;
}
