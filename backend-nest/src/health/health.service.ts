import type { Client as ESClient } from "@elastic/elasticsearch";
import { HttpService } from "@nestjs/axios";
import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { firstValueFrom } from "rxjs";
import { DRIZZLE } from "../db/drizzle.module";
import { ES } from "../search/search.constants.js";

@Injectable()
export class HealthService {
  constructor(
    private readonly http: HttpService,
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase,
    @Inject(ES) private readonly es: ESClient,
  ) {}

  private async checkDb() {
    const start = Date.now();
    await this.db.execute(sql`select 1`);
    return { ok: true, ms: Date.now() - start };
  }

  private async checkElasticsearch() {
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

    /*const format = (res: PromiseSettledResult<any>) =>
      res.status === "fulfilled"
        ? res.value
        : { ok: false, error: res.reason?.message ?? String(res.reason) };*/
    const format = (res: PromiseSettledResult<unknown>) =>
      res.status === "fulfilled" ? res.value : res.reason;

    const db = format(dbRes);
    const elasticsearch = format(esRes);
    const kth = format(kthRes);

    const ok = Boolean(db.ok && elasticsearch.ok && kth.ok);

    return { ok, services: { db, elasticsearch, kth } };
  }
}
