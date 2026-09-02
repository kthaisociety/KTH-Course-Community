// src/ingest/ingest.controller.ts

import { createHash, timingSafeEqual } from "node:crypto";
import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { IngestService } from "./ingest.service";

// IngestKeyGuard is used to authenticate by INGEST_SECRET
class IngestKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const expected = process.env.INGEST_SECRET;
    // Fail closed: an unset secret locks the door rather than removing it.
    if (!expected) throw new UnauthorizedException();

    const provided = ctx.switchToHttp().getRequest().headers["x-ingest-key"];
    if (typeof provided !== "string") throw new UnauthorizedException();

    // sha256 equalises length, so timingSafeEqual can't throw on a mismatch.
    const a = createHash("sha256").update(provided).digest();
    const b = createHash("sha256").update(expected).digest();
    if (!timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}

@AllowAnonymous() // we do check by INGEST_SECRET
@UseGuards(IngestKeyGuard)
@Controller("ingest")
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  // ingests courses to BOTH elastic and Neon
  @Post("courses")
  @HttpCode(202)
  async triggerFullIngest() {
    void this.ingest.runFullIngest().catch((e) => console.error(e));
    return { status: "queued (in-process)", task: "courses" };
  }

  // ingests courses to Neon only
  @Post("courses/neon")
  @HttpCode(202)
  async triggerNeonIngest() {
    void this.ingest.runNeonIngest().catch((e) => console.error(e));
    return { status: "queued (in-process)", task: "courses/neon" };
  }

  // ingests courses to ElasticSearch only
  @Post("courses/elastic")
  @HttpCode(202)
  async triggerElasticIngest() {
    void this.ingest.runElasticIngest().catch((e) => console.error(e));
    return { status: "queued (in-process)", task: "courses/elastic" };
  }

  // returns the current status of the ingestion pipeline
  @Get("status")
  getIngestStatus() {
    return this.ingest.getIngestStatus();
  }

  // test endpoints for inserting a handful of courses, used to check ingestion pipelines
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
