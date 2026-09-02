import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./ai/ai.module";
// AUTH imports (Better Auth)
import { AuthModule } from "./auth/auth.module";
import { CourseModule } from "./course/course.module";
import { DrizzleModule } from "./db/drizzle.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { HealthModule } from "./health/health.module";
import { IngestModule } from "./ingest/ingest.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { ElasticSearchModule } from "./search/search.module";
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
    CourseModule,
    ReviewsModule,
    FeedbackModule,
    AuthModule,
  ],
})
export class AppModule {}
