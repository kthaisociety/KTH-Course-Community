/** Review as exposed over the API (timestamps serialized as ISO strings). */
export interface Review {
  id: string;
  userId: string;
  courseCode: string;
  easyScore: number;
  usefulScore: number;
  interestingScore: number;
  wouldRecommend: boolean;
  content: string;
  createdAt: string;
  updatedAt: string;
}
