import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { DRIZZLE } from "../db/drizzle.module";
import * as schema from "../db/schema";

@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async getDepartments(): Promise<string[]> {
    // Get all unique departments from the courses table and sort alphabetically
    const result = await this.db.execute(
      sql`SELECT DISTINCT department FROM ${schema.courses} ORDER BY department ASC`,
    );
    return result.rows.map((r) => r.department as string);
  }
}
