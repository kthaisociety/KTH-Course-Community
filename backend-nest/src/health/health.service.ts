import type { Client as ESClient } from "@elastic/elasticsearch";
import { HttpService } from "@nestjs/axios";
import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { firstValueFrom } from "rxjs";
import { DRIZZLE } from "../db/drizzle.module";
import { ES } from "../search/search.constants.js";

type HealthCheckResult = {
  ok: boolean;
  [key: string]: unknown;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly http: HttpService,
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase,
    @Inject(ES) private readonly es: ESClient | null,
  ) {}

  private async checkDb() {
    const start = Date.now();
    await this.db.execute(sql`select 1`);
    return { ok: true, ms: Date.now() - start };
  }

  private async checkElasticsearch() {
    if (!this.es) {
      return { ok: true, skipped: true, reason: "disabled" };
    }
    const start = Date.now();
    await this.es.ping();
    return { ok: true, ms: Date.now() - start };
  }

  private async checkKthApi() {
    const start = Date.now();
    const url = "https://api.kth.se/api/kopps/v2/courses?l=en";
    await firstValueFrom(
      this.http.get(url, {
        timeout: 10000,
        responseType: "json",
      }),
    );
    return { ok: true, ms: Date.now() - start };
  }

  async testAll() {
    const results = await Promise.allSettled([
      this.checkDb(),
      this.checkElasticsearch(),
      this.checkKthApi(),
    ]);

    const [dbRes, esRes, kthRes] = results;

    const serializeError = (reason: unknown) => {
      if (reason instanceof Error) {
        return {
          ok: false,
          error: reason.message,
          name: reason.name,
        };
      }

      if (
        reason &&
        typeof reason === "object" &&
        "message" in reason &&
        typeof (reason as { message?: unknown }).message === "string"
      ) {
        const maybeReason = reason as {
          message: string;
          name?: unknown;
          response?: { status?: unknown };
        };
        return {
          ok: false,
          error: maybeReason.message,
          name:
            typeof maybeReason.name === "string"
              ? maybeReason.name
              : "UnknownError",
          status:
            typeof maybeReason.response?.status === "number"
              ? maybeReason.response.status
              : undefined,
        };
      }

      return { ok: false, error: String(reason) };
    };

    const format = (
      res: PromiseSettledResult<HealthCheckResult>,
    ): HealthCheckResult =>
      res.status === "fulfilled" ? res.value : serializeError(res.reason);

    const db = format(dbRes);
    const elasticsearch = format(esRes);
    const kth = format(kthRes);

    const ok = Boolean(db.ok && elasticsearch.ok && kth.ok);

    return { ok, services: { db, elasticsearch, kth } };
  }
}
