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
  createdAt: string;
  updatedAt: string;
  likeCount?: number;
  userVote?: "like" | "dislike" | null;
}
