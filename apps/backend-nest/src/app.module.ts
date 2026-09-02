import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./ai/ai.module";
import { CourseModule } from "./course/course.module";
import { DrizzleModule } from "./db/drizzle.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { HealthModule } from "./health/health.module";
import { IngestModule } from "./ingest/ingest.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { ElasticSearchModule } from "./search/search.module";
import { SupertokensModule } from "./supertokens/supertokens.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AiModule,
    IngestModule,
    HealthModule,
    DrizzleModule,
    ElasticSearchModule,
    UserModule,
    SupertokensModule,
    CourseModule,
    ReviewsModule,
    FeedbackModule,
  ],
})
export class AppModule {}
