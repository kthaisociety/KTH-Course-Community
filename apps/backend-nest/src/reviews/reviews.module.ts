import { Module } from "@nestjs/common";
import { DrizzleModule } from "../db/drizzle.module";
import { ReviewsController } from "./reviews.controller";
import { ReviewsGateway } from "./reviews.gateway";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [DrizzleModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsGateway],
})
export class ReviewsModule {}
