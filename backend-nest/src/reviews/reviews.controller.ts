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
      examinationMethods: number;
      theoreticalVsApplied: number;
      workload: number;
      learningExperience: number;
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
      examinationMethods: number;
      theoreticalVsApplied: number;
      workload: number;
      learningExperience: number;
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
    return this.reviewsService.toggleLike(reviewId, body.userId);
  }
}
