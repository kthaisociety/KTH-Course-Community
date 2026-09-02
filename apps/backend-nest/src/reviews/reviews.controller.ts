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
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import { ReviewsService } from "./reviews.service";

/** The fields a review carries, as submitted by the author. */
// TODO: consider if this should be a shared type, as we can use it for the client request as well.
type ReviewInput = {
  examinationMethods: number;
  theoreticalVsApplied: number;
  workload: number;
  learningExperience: number;
  wouldRecommend: boolean;
  content: string;
};

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  create(
    @Session() session: UserSession,
    @Body() body: ReviewInput & { courseCode: string },
  ) {
    // The author is whoever holds the session. A `userId` in the body is not
    // read, so a review cannot be posted in someone else's name.
    const { courseCode, ...reviewData } = body;
    return this.reviewsService.create(courseCode, session.user.id, reviewData);
  }

  @AllowAnonymous()
  @Get()
  findAll(
    @Session() session: UserSession | null,
    @Query("courseCode") courseCode?: string,
  ) {
    // Open to visitors, who get no vote state of their own.
    // The viewer is resolved from the session, so a `userId` in the query string
    // can no longer read back somebody else's voting history.
    return this.reviewsService.findAll(courseCode, session?.user.id);
  }

  @AllowAnonymous()
  @Get(":id")
  findOne(@Param("id") id: string) {
    // fetches a single review by review-id. open for visitors.
    return this.reviewsService.findOne(id);
  }

  @Patch(":id")
  update(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body() reviewData: ReviewInput,
  ) {
    return this.reviewsService.update(id, session.user.id, reviewData);
  }

  @Delete(":id")
  remove(@Session() session: UserSession, @Param("id") id: string) {
    return this.reviewsService.remove(id, session.user.id);
  }

  @Post(":id/like")
  likeReview(@Session() session: UserSession, @Param("id") reviewId: string) {
    // Like / remove like toggle.
    return this.reviewsService.toggleVote(reviewId, session.user.id, "like");
  }
}
