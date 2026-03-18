// src/ingest/ingest.controller.ts
import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import { IngestService } from "./ingest.service";

@Controller("ingest")
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  // ingests courses to BOTH elastic and Neon
  @Post("courses")
  @HttpCode(202)
  async triggerFullIngest() {
    this.ingest.runFullIngest().catch((e) => console.error(e));
    return { status: "queued (in-process)", task: "courses" };
  }

  // ingests courses to Neon only
  @Post("courses/neon")
  @HttpCode(202)
  async triggerNeonIngest() {
    this.ingest.runNeonIngest().catch((e) => console.error(e));
    return { status: "queued (in-process)", task: "courses/neon" };
  }

  // ingests courses to ElasticSearch only
  @Post("courses/elastic")
  @HttpCode(202)
  async triggerElasticIngest() {
    this.ingest.runElasticIngest().catch((e) => console.error(e));
    return { status: "queued (in-process)", task: "courses/elastic" };
  }

  // returns the current status of the ingestion pipeline
  @Get("status")
  async getIngestStatus() {
    return this.ingest.getIngestStatus();
  }

  @Post("test-neon")
  @HttpCode(200)
  async testNeon() {
    await this.ingest.runNeonTest();
    return { status: "ok", task: "test-neon" };
  }

  @Post("test-elastic")
  @HttpCode(200)
  async testElastic() {
    await this.ingest.runElasticTest();
    return { status: "queued", task: "test-elastic" };
  }
}
