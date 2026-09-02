import { Client } from "@elastic/elasticsearch";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AiModule } from "../ai/ai.module.js";
import { CourseModule } from "../course/course.module.js";
import { DrizzleModule } from "../db/drizzle.module.js";
import { DepartmentsController } from "./departments.controller.js";
import { DepartmentsService } from "./departments.service.js";
import { ES } from "./search.constants.js";
import { SearchController } from "./search.controller.js";
import { SearchService } from "./search.service.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    CourseModule,
    AiModule,
  ],
  providers: [
    {
      provide: ES,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Client | null => {
        const elasticsearchEnabled =
          config.get<string>("ELASTICSEARCH_ENABLED", "true") !== "false";
        if (!elasticsearchEnabled) {
          return null;
        }

        const url = config.get<string>("ELASTICSEARCH_URL");
        if (!url) throw new Error("ELASTICSEARCH_URL is not set");

        const username =
          config.get<string>("ELASTICSEARCH_USERNAME") ?? "elastic";
        const password = config.get<string>("ELASTICSEARCH_PASSWORD");
        if (!password) throw new Error("ELASTICSEARCH_PASSWORD is not set");

        return new Client({
          node: url,
          auth: { username, password },
          headers: {
            accept: "application/vnd.elasticsearch+json; compatible-with=8",
            "content-type":
              "application/vnd.elasticsearch+json; compatible-with=8",
          },
        });
      },
    },
    SearchService,
    DepartmentsService,
  ],
  controllers: [SearchController, DepartmentsController],
  exports: [ES, SearchService],
})
export class ElasticSearchModule {}
