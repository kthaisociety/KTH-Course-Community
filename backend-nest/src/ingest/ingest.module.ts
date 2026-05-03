// src/ingest/ingest.module.ts

import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { DrizzleModule } from "../db/drizzle.module";
import { ElasticSearchModule } from "../search/search.module";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";
import { KoppsService } from "./kopps.service";

@Module({
  imports: [HttpModule, DrizzleModule, ElasticSearchModule, AiModule],
  providers: [IngestService, KoppsService],
  controllers: [IngestController],
  exports: [IngestService, KoppsService],
})
export class IngestModule {}
