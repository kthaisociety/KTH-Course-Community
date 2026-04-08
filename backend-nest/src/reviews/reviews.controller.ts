import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ReviewsService } from "./reviews.service";

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  create(
    @Body() body: {
      courseCode: string;
      userId: string;
      easyScore: number;
      usefulScore: number;
      interestingScore: number;
      wouldRecommend: boolean;
      content: string;
    },
  ) {
    const { courseCode, userId, ...reviewData } = body;
    return this.reviewsService.create(courseCode, userId, reviewData);
  }

  @Get()
  findAll(
    @Query("courseCode") courseCode?: string,
    @Query("userId") userId?: string,
  ) {
    return this.reviewsService.findAll(courseCode, userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.reviewsService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() reviewData: {
      easyScore: number;
      usefulScore: number;
      interestingScore: number;
      wouldRecommend: boolean;
      content: string;
    },
  ) {
    return this.reviewsService.update(id, reviewData);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.reviewsService.remove(id);
  }

  @Post(":id/like")
  likeReview(@Param("id") reviewId: string, @Body() body: { userId: string }) {
    return this.reviewsService.toggleVote(reviewId, body.userId, "like");
  }

  @Post(":id/dislike")
  dislikeReview(
    @Param("id") reviewId: string,
    @Body() body: { userId: string },
  ) {
    return this.reviewsService.toggleVote(reviewId, body.userId, "dislike");
  }

  @Delete(":id/vote")
  removeVote(@Param("id") reviewId: string, @Body() body: { userId: string }) {
    return this.reviewsService.removeVote(reviewId, body.userId);
  }
}
